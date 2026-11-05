/* =========================================================
   export_card.js — 人生长图导出（Canvas 2D，零依赖）
   · 1080 宽，高度自适应；超过 16000px 自动分页导出多张
   · 只读取当前局数据，不写回存档
   · LS.CARD.render(ctx, opts) → canvas
   · LS.CARD.download(filename, opts) → Promise
   ========================================================= */
(function () {
  'use strict';

  var LS = window.LS = window.LS || {};
  var CARD = LS.CARD = LS.CARD || {};

  var W = 1080;
  var MAX_H = 16000;
  var PAD = 84;
  var INNER = W - PAD * 2;
  var CONTENT_TOP = 104;
  var BOTTOM = 96;
  var FRAME = 26;
  var FONT_STACK = '"Microsoft YaHei", "SimSun", "Noto Sans SC", sans-serif';

  var THEMES = {
    paper: {
      bg: '#e6dfd0',
      card: '#f7f3e9',
      ink: '#24262a',
      ink2: '#5b5f66',
      ink3: '#8a8578',
      line: '#d8cebb',
      accent: '#9c4a34',
      gold: '#8b7139',
      chip: '#ebe4d5',
      chipText: '#4c4a44',
      deadCircle: '#d7d1c3',
      deadText: '#77726a',
      onAccent: '#f7f3e9'
    },
    night: {
      bg: '#0c0e11',
      card: '#171a1f',
      ink: '#ece7db',
      ink2: '#a9aeb7',
      ink3: '#767c87',
      line: '#2b3038',
      accent: '#cf8a69',
      gold: '#bfa06a',
      chip: '#242a32',
      chipText: '#c3c8d0',
      deadCircle: '#2b3038',
      deadText: '#8a909a',
      onAccent: '#171a1f'
    }
  };

  var games = {};      // 头像缓存：gender|stage → Image
  var lastPages = null;
  var lastSnapshot = null;
  var measureCtx = null;

  /* ---------------- 基础工具 ---------------- */
  function num(v, d) {
    var n = Number(v);
    return isFinite(n) ? n : (d === undefined ? 0 : d);
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function font(size, weight) {
    return (weight || 400) + ' ' + size + 'px ' + FONT_STACK;
  }

  function mctx() {
    if (!measureCtx) {
      measureCtx = document.createElement('canvas');
      measureCtx.width = W;
      measureCtx.height = 240;
    }
    return measureCtx.getContext('2d');
  }

  function textWidth(str, size, weight) {
    var c = mctx();
    c.font = font(size, weight);
    return c.measureText(String(str)).width;
  }

  function ellipsis(str, maxW, size, weight) {
    var body = String(str == null ? '' : str).replace(/\s+/g, ' ').trim();
    if (!body) return '';
    if (textWidth(body, size, weight) <= maxW) return body;
    var out = '';
    for (var i = 0; i < body.length; i++) {
      var next = out + body.charAt(i);
      if (textWidth(next + '…', size, weight) > maxW) break;
      out = next;
    }
    return (out || body.charAt(0)) + '…';
  }

  /* 中文逐字换行，按行 measureText；最多 maxLines 行 */
  function wrap(str, maxW, size, weight, maxLines) {
    var body = String(str == null ? '' : str).replace(/\s+/g, ' ').trim();
    if (!body) return [];
    var lines = [];
    var cur = '';
    for (var i = 0; i < body.length; i++) {
      var ch = body.charAt(i);
      if (ch === '\n') {
        lines.push(cur);
        cur = '';
        continue;
      }
      var next = cur + ch;
      if (cur && textWidth(next, size, weight) > maxW) {
        lines.push(cur);
        cur = ch === ' ' ? '' : ch;
      } else {
        cur = next;
      }
    }
    if (cur) lines.push(cur);
    if (maxLines && lines.length > maxLines) {
      var tail = lines.slice(maxLines - 1).join('');
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = ellipsis(tail, maxW, size, weight);
    }
    return lines;
  }

  function drawText(ctx, str, x, y, size, weight, color, align, baseline) {
    ctx.fillStyle = color;
    ctx.font = font(size, weight);
    ctx.textAlign = align || 'left';
    ctx.textBaseline = baseline || 'alphabetic';
    ctx.fillText(String(str == null ? '' : str), x, y);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  function roundRect(ctx, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  function formatDate() {
    var d = new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function safeName(s) {
    return String(s == null ? '' : s).replace(/[\\/:*?"<>|\r\n]/g, '_').slice(0, 40);
  }

  /* ---------------- 主题 / 取数 ---------------- */
  function resolveTheme(opts, snap) {
    var t = (opts && opts.theme) || '';
    if (!t && snap && snap.game && snap.game.theme) t = snap.game.theme;
    if (!t && LS.SETTINGS && LS.SETTINGS.theme) t = LS.SETTINGS.theme;
    if (!t && LS.settings && LS.settings.theme) t = LS.settings.theme;
    if (!t) {
      try {
        t = localStorage.getItem('ls_theme') || localStorage.getItem('lifesim_theme') || '';
      } catch (e) { /* file:// 下可能不可用 */ }
    }
    if (!t && document.body) {
      t = document.body.getAttribute('data-theme') || '';
    }
    return /night|dark|夜/i.test(String(t)) ? THEMES.night : THEMES.paper;
  }

  function getGame(opts) {
    if (opts && opts.game) return opts.game;
    if (window.__LS_CARD_GAME) return window.__LS_CARD_GAME;
    if (LS.ui && typeof LS.ui.getGame === 'function') return LS.ui.getGame();
    return null;
  }

  function firstSentence(text) {
    var s = String(text || '').replace(/\s+/g, ' ').trim();
    if (!s) return '';
    var i = s.indexOf('。');
    return i > 8 ? s.slice(0, i + 1) : s;
  }

  /* 关键节点打分：岔路 + 重大结果优先 */
  var KEY_RE = /(结婚|离婚|复婚|生子|出生|降生|去世|离世|死亡|重病|手术|住院|高考|考上|落榜|大学|毕业|入职|升职|提拔|失业|下岗|创业|买房|卖房|搬家|退休|获奖|出国|参军|当兵|分手|失恋|车祸|事故|破产|失约|兑现|戒掉|康复)/;

  function scoreEvent(rec) {
    var tier = rec.tier || 'daily';
    var score = tier === 'crossroad' ? 140 : tier === 'echo' ? 45 : tier === 'sys' ? 55 : 20;
    var title = rec.title || '';
    var extra = title + ' ' + (rec.outcomeLabel || '') + ' ' + String(rec.resultText || '').slice(0, 50);
    if (rec.outcomeLabel) score += 18;
    if (rec.choiceLabel) score += 10;
    if (rec.resultText) score += 8;
    if (KEY_RE.test(extra)) score += 28;
    if (/出生|降生/.test(title)) score -= 18;
    if (/去世|离世|死亡|病逝/.test(title)) score -= 40;
    return score;
  }

  function bucketOf(age) {
    if (age <= 12) return 0;
    if (age <= 22) return 1;
    if (age <= 35) return 2;
    if (age <= 50) return 3;
    if (age <= 65) return 4;
    return 5;
  }

  function collectNodes(g, s) {
    var list = [];
    function add(age, title, tier, score, seq) {
      var body = String(title || '').replace(/\s+/g, ' ').trim();
      if (!body || !isFinite(age) || age < 0) return;
      var key = body.replace(/[「」『』"“”'']/g, '').slice(0, 12);
      for (var k = 0; k < list.length; k++) {
        if (list[k].age === age && list[k].title === body) return;
        /* 同一句式反复出现（如“该兑现的一句话”）只留最早的一条 */
        if (list[k].key === key) return;
      }
      list.push({ age: age, title: body, tier: tier || 'daily', score: score || 0, seq: seq || 0, key: key });
    }

    var log = g.eventLog || [];
    for (var i = 0; i < log.length; i++) {
      var rec = log[i];
      if (!rec || !rec.title) continue;
      add(num(rec.age, -1), rec.title, rec.tier, scoreEvent(rec), num(rec.seq, 0));
    }

    if (!list.length && s.memories && s.memories.length) {
      for (var mi = 0; mi < s.memories.length; mi++) {
        var m = s.memories[mi];
        add(num(m.age, -1), firstSentence(m.text).replace(/。$/, ''), 'daily', 30, mi);
      }
    }

    var hasBirth = false;
    for (var hb = 0; hb < list.length; hb++) if (list[hb].age <= 1) hasBirth = true;
    if (!hasBirth && s.birthYear) {
      add(0, '出生在' + (g.birthplace || '某个小城'), 'sys', 70, -5);
    }

    /* 阶段内先各取 1 条，再按分数补到 8 条 */
    var picked = [];
    var perBucket = {};
    var sorted = list.slice().sort(function (a, b) {
      return b.score - a.score || a.age - b.age;
    });
    var b, cand;
    for (b = 0; b < 6 && picked.length < 8; b++) {
      for (var j = 0; j < sorted.length; j++) {
        cand = sorted[j];
        if (bucketOf(cand.age) !== b) continue;
        if (picked.indexOf(cand) >= 0) continue;
        picked.push(cand);
        perBucket[b] = 1;
        break;
      }
    }
    for (var k = 0; k < sorted.length && picked.length < 8; k++) {
      cand = sorted[k];
      if (picked.indexOf(cand) >= 0) continue;
      var bk = bucketOf(cand.age);
      if ((perBucket[bk] || 0) >= 2) continue;
      picked.push(cand);
      perBucket[bk] = (perBucket[bk] || 0) + 1;
    }
    for (var f = 0; f < sorted.length && picked.length < 8; f++) {
      if (picked.indexOf(sorted[f]) < 0) picked.push(sorted[f]);
    }

    /* 不足 5 条时，用履历里的真实节点补足 */
    if (picked.length < 5) {
      var extra = [];
      if (s.birthYear) extra.push({ age: 0, title: '出生在' + (g.birthplace || '某个小城'), tier: 'sys' });
      (s.eduPath || []).slice(0, 2).forEach(function (p) {
        extra.push({ age: num(p.age, 18), title: p.text || '读书', tier: 'sys' });
      });
      (s.jobHistory || []).slice(0, 3).forEach(function (j) {
        extra.push({ age: num(j.age, 22), title: j.text || '第一份工作', tier: 'sys' });
      });
      if (s.marriage && s.marriage.spouseName) {
        extra.push({
          age: Math.max(20, num(s.age, 40) - num(s.marriage.years, 0)),
          title: '和' + s.marriage.spouseName + '成家',
          tier: 'sys'
        });
      }
      if (num(s.age, 0) >= 60) extra.push({ age: 60, title: '退休', tier: 'sys' });
      for (var e = 0; e < extra.length && picked.length < 5; e++) {
        var dup = false;
        for (var q = 0; q < picked.length; q++) {
          if (picked[q].age === extra[e].age && picked[q].title === extra[e].title) dup = true;
        }
        if (!dup) picked.push({ age: extra[e].age, title: extra[e].title, tier: 'sys', score: 0, seq: 999 + e });
      }
    }

    picked.sort(function (a, b2) {
      return a.age - b2.age || a.seq - b2.seq;
    });
    return picked.slice(0, 8);
  }

  function stageOfAge(age) {
    if (age <= 3) return 'infant';
    if (age <= 12) return 'child';
    if (age <= 18) return 'teen';
    if (age <= 30) return 'youth';
    if (age <= 55) return 'midlife';
    if (age <= 75) return 'elder';
    return 'late';
  }

  var ROLE_MAP = {
    intimacy: '旧识', friend: '朋友', spouse: '配偶', child: '子女',
    parent: '父母', colleague: '同事', boss: '上司', teacher: '老师',
    classmate: '同学', partner: '合伙人'
  };

  function roleText(role) {
    var r = String(role || '').trim();
    if (/^[A-Za-z_]+$/.test(r)) return ROLE_MAP[r.toLowerCase()] || '旧识';
    return r || '熟人';
  }

  function personScore(n) {
    var role = String((n && n.role) || '');
    var score = 0;
    if (n.isSpouse) score += 120;
    if (n.isChild) score += 95;
    if (/父|母/.test(role)) score += 90;
    if (/妻|夫|配偶|伴侣/.test(role)) score += 80;
    score += clamp(num(n.intimacy, 0), 0, 100) / 2;
    if (n.alive) score += 6;
    return score;
  }

  function collectPeople(g) {
    var all = (g.npcs || []).filter(function (n) { return n && n.name; });
    var alive = all.filter(function (n) { return !!n.alive; }).sort(function (a, b) {
      return personScore(b) - personScore(a);
    });
    var dead = all.filter(function (n) { return !n.alive; }).sort(function (a, b) {
      return personScore(b) - personScore(a) || num(b.deathYear, 0) - num(a.deathYear, 0);
    });

    function model(n, isAlive) {
      var age = num(n.age, 0);
      var deathYear = num(n.deathYear, 0);
      var lifespan = num(n.lifespan, num(n.deathAge, 76));
      var rawName = String(n.name || '').trim();
      var role = roleText(n.role);
      var name = rawName && !/^[A-Za-z_]+$/.test(rawName) ? rawName : role;
      return {
        name: name,
        role: role,
        gender: n.gender || '其他',
        alive: isAlive,
        age: age,
        stage: stageOfAge(age),
        birthYear: deathYear ? Math.round(deathYear - lifespan) : 0,
        deathYear: deathYear
      };
    }

    var aliveList = alive.slice(0, 4).map(function (n) { return model(n, true); });
    var deadLimit = Math.max(2, 8 - aliveList.length);
    var deadList = dead.slice(0, deadLimit).map(function (n) { return model(n, false); });
    return { alive: aliveList, dead: deadList };
  }

  function relicOf(g, s) {
    if (s.relics && s.relics.length) return s.relics.slice(0, 2).join('、');
    var items = [];
    if ((s.children || []).length) items.push('一张全家福');
    if (num(s.jobYears, 0) >= 15) items.push('一枚磨旧的工牌');
    if (g.edu && num(g.edu.level, 0) >= 6) items.push('一箱旧书');
    if (num(s.netWorth, 0) >= 500000 || num(s.assets, 0) >= 300000) items.push('一本压在抽屉底的存折');
    if (!items.length) items.push('几件洗得发白的旧衣服');
    return items.slice(0, 2).join('、');
  }

  function undoneOf(g, s) {
    if (s.undone) return s.undone;
    var ps = (g.promises || []).filter(function (p) {
      return p && (p.status === 'broken' || p.status === 'open') && p.text;
    });
    ps.sort(function (a, b) {
      return (a.status === 'broken' ? 1 : 0) - (b.status === 'broken' ? 1 : 0);
    });
    if (ps.length) {
      var p = ps[ps.length - 1];
      return '答应' + (p.npcRole || '一个人') + '的「' + p.text + '」，到最后也没做到';
    }
    if (s.sceneLast) return '最后停在「' + s.sceneLast + '」，有些话没能说完';
    return '有些话没能说完，有些事没能做完';
  }

  function snapshot(opts) {
    var g = getGame(opts);
    if (!g) throw new Error('LS.CARD：没有可导出的当前人生');
    var s = g.summary || {};
    var death = g.death || {};
    var age = num(s.age, num(death.age, num(g.age, 0)));
    var birthYear = num(s.birthYear, num(g.birthYear, 0));
    var deathYear = num(s.deathYear, num(death.year, 0));

    var tags = (s.tags || []).filter(Boolean).slice(0, 3);
    var endingTag = String(s.endingTag || '');
    if (endingTag && tags.length && tags[0] === endingTag) tags = tags.slice(1);

    var quote = String(s.lastWords || '');
    var quoteBy = '';
    if (!quote && s.kind !== 'early' && LS.V36 && typeof LS.V36.letter === 'function') {
      try {
        var letter = LS.V36.letter(g, s);
        if (letter && letter.quote) {
          quote = String(letter.quote.t || '');
          quoteBy = String(letter.quote.a || '');
        }
      } catch (e) { /* 信体失败则回退墓志铭 */ }
    }
    if (!quote) quote = firstSentence(s.epitaph || s.evaluation || '') || '这一生到这里，话就说到这里。';

    var seedCode = '';
    try {
      if (LS.REPLAY && typeof LS.REPLAY.exportCode === 'function') {
        seedCode = String(LS.REPLAY.exportCode() || '');
      }
    } catch (e) { seedCode = ''; }

    var people = collectPeople(g);

    return {
      game: g,
      name: String(s.name || g.name || '无名'),
      gender: String(s.gender || g.gender || ''),
      birthYear: birthYear,
      deathYear: deathYear,
      age: age,
      reason: String(s.reason || death.reason || ''),
      endingTag: endingTag,
      tags: tags,
      nodes: collectNodes(g, s),
      alive: people.alive,
      dead: people.dead,
      quote: quote.length > 110 ? quote.slice(0, 110) + '…' : quote,
      quoteBy: quoteBy,
      relic: relicOf(g, s),
      undone: undoneOf(g, s),
      seedCode: seedCode,
      gameName: '人生模拟器',
      date: formatDate()
    };
  }

  /* ---------------- 头像 ---------------- */
  function portraitKey(p) {
    return String(p.gender || '其他') + '|' + String(p.stage || 'youth');
  }

  function ensurePortraits(snap) {
    if (!LS.artPerson || !snap || !snap.alive.length) return Promise.resolve();
    var tasks = [];
    snap.alive.forEach(function (p) {
      var key = portraitKey(p);
      if (games[key]) return;
      var svg = '';
      try { svg = LS.artPerson(p.gender, p.stage) || ''; } catch (e) { svg = ''; }
      if (!svg) return;
      var img = new Image();
      games[key] = img;
      tasks.push(new Promise(function (res) {
        var settled = false;
        function done(ok) {
          if (settled) return;
          settled = true;
          if (!ok) delete games[key];
          res();
        }
        img.onload = function () { done(true); };
        img.onerror = function () { done(false); };
        setTimeout(function () {
          done(img.complete && img.naturalWidth > 0);
        }, 900);
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      }));
    });
    return Promise.all(tasks);
  }

  /* ---------------- 版式块 ---------------- */
  function headerBlock(snap, T) {
    var nameSize = 76;
    var name = String(snap.name || '无名');
    while (nameSize > 50 && textWidth(name, nameSize, 700) > INNER) nameSize -= 3;
    var nameText = ellipsis(name, INNER, nameSize, 700);
    var gender = /^男$|^女$/.test(snap.gender) ? snap.gender : '';

    var lifeText = '';
    var ageText = '活到 ' + snap.age + ' 岁';
    if (snap.birthYear && snap.deathYear) lifeText = snap.birthYear + ' — ' + snap.deathYear;

    var chips = [];
    if (snap.endingTag) chips.push({ text: snap.endingTag, primary: true });
    snap.tags.forEach(function (t) { if (t && (!snap.endingTag || t !== snap.endingTag)) chips.push({ text: t }); });

    var hasChips = chips.length > 0;
    var h = 118 + 40 + (snap.reason ? 34 : 8) + (hasChips ? 64 : 16) + 18;

    return {
      h: h,
      draw: function (ctx, y) {
        drawText(ctx, '人生长图', PAD, y + 24, 20, 600, T.ink3, 'left');
        drawText(ctx, 'LIFE, IN ONE PAGE', W - PAD, y + 24, 18, 400, T.ink3, 'right');

        drawText(ctx, nameText, PAD, y + 118, nameSize, 700, T.ink, 'left');

        var ly = y + 158;
        var ageX = PAD;
        if (lifeText) {
          drawText(ctx, lifeText, PAD, ly, 30, 500, T.ink2, 'left');
          var lw = textWidth(lifeText, 30, 500);
          drawText(ctx, '·', PAD + lw + 16, ly, 28, 400, T.ink3, 'left');
          ageX = PAD + lw + 44;
        }
        drawText(ctx, ageText, ageX, ly, 30, 600, T.ink, 'left');
        if (gender) {
          var aw = textWidth(ageText, 30, 600);
          drawText(ctx, '·', ageX + aw + 16, ly, 28, 400, T.ink3, 'left');
          drawText(ctx, gender, ageX + aw + 42, ly, 22, 400, T.ink3, 'left');
        }

        var ry = y + 192;
        if (snap.reason) {
          drawText(ctx, ellipsis(snap.reason, INNER, 23, 400), PAD, ry, 23, 400, T.ink3, 'left');
        }

        if (hasChips) {
          var cx = PAD;
          var cy = y + 214;
          for (var i = 0; i < chips.length; i++) {
            var c = chips[i];
            var label = ellipsis(c.text, 300, 20, c.primary ? 600 : 400);
            var tw = textWidth(label, 20, c.primary ? 600 : 400);
            var cw = tw + 36;
            if (cx + cw > W - PAD) break;
            roundRect(ctx, cx, cy, cw, 42, 21);
            ctx.fillStyle = c.primary ? T.accent : T.chip;
            ctx.fill();
            if (!c.primary) {
              ctx.strokeStyle = T.line;
              ctx.lineWidth = 1;
              ctx.stroke();
            }
            drawText(ctx, label, cx + cw / 2, cy + 27, 20, c.primary ? 600 : 400,
              c.primary ? T.onAccent : T.chipText, 'center');
            cx += cw + 12;
          }
        }
      }
    };
  }

  function sectionBlock(index, title, meta, T) {
    return {
      h: 84,
      keepNext: true,
      draw: function (ctx, y) {
        var cy = y + 28;
        drawText(ctx, index, PAD, cy, 22, 600, T.accent, 'left');
        ctx.strokeStyle = T.line;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(PAD + 34, cy - 7);
        ctx.lineTo(PAD + 76, cy - 7);
        ctx.stroke();
        drawText(ctx, title, PAD + 94, cy, 30, 600, T.ink, 'left');
        if (meta) drawText(ctx, meta, W - PAD, cy, 20, 400, T.ink3, 'right');
      }
    };
  }

  function nodeBlock(node, T) {
    var title = ellipsis(node.title, W - PAD - (PAD + 154), 33, 500);
    return {
      h: 84,
      draw: function (ctx, y) {
        var cy = y + 38;
        var xLine = PAD + 118;
        ctx.strokeStyle = T.line;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(xLine, y);
        ctx.lineTo(xLine, y + 84);
        ctx.stroke();

        drawText(ctx, node.age + ' 岁', PAD + 94, cy + 3, 25, 600, T.ink2, 'right');

        var cross = node.tier === 'crossroad';
        ctx.beginPath();
        ctx.arc(xLine, cy, cross ? 7 : 5, 0, Math.PI * 2);
        ctx.fillStyle = cross ? T.accent : node.tier === 'echo' ? T.gold : T.ink3;
        ctx.fill();
        if (cross) {
          ctx.beginPath();
          ctx.arc(xLine, cy, 12, 0, Math.PI * 2);
          ctx.strokeStyle = T.accent;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        drawText(ctx, title, PAD + 154, cy + 3, 33, 500, T.ink, 'left');
      }
    };
  }

  function subLabelBlock(title, meta, T) {
    return {
      h: 56,
      keepNext: true,
      draw: function (ctx, y) {
        drawText(ctx, title, PAD, y + 34, 22, 600, T.ink3, 'left');
        if (meta) drawText(ctx, meta, W - PAD, y + 34, 19, 400, T.ink3, 'right');
        ctx.strokeStyle = T.line;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PAD + (textWidth(title, 22, 600) + 20), y + 28);
        ctx.lineTo(W - PAD, y + 28);
        ctx.stroke();
      }
    };
  }

  function personCell(ctx, p, x, y, cellW, T) {
    var r = 44;
    var cx = x + r + 2;
    var cy = y + 52;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (p.alive) {
      ctx.fillStyle = T.chip;
      ctx.fill();
      var img = games[portraitKey(p)];
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, 22, 4, 106, 106, cx - r, cy - r, r * 2, r * 2);
        ctx.restore();
      } else {
        var ch = String(p.name || '?').charAt(0);
        drawText(ctx, ch, cx, cy + 12, 32, 600, T.ink3, 'center');
      }
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = T.line;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = T.deadCircle;
      ctx.fill();
      var ch2 = String(p.name || '?').charAt(0);
      drawText(ctx, ch2, cx, cy + 12, 32, 600, T.deadText, 'center');
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = T.line;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();

    var tx = x + r * 2 + 22;
    var maxW = cellW - (r * 2 + 34);
    var nameColor = p.alive ? T.ink : T.ink3;
    drawText(ctx, ellipsis(p.name, maxW, 28, 600), tx, y + 42, 28, 600, nameColor, 'left');

    var meta;
    var rolePart = p.role && p.role !== p.name ? p.role : '';
    if (p.alive) {
      meta = (rolePart ? rolePart + ' · ' : '') + (p.age ? p.age + ' 岁' : '');
    } else {
      meta = (rolePart ? rolePart + ' · ' : '') +
        (p.birthYear && p.deathYear ? p.birthYear + '—' + p.deathYear : '已故');
    }
    drawText(ctx, ellipsis(meta, maxW, 21, 400), tx, y + 78, 21, 400, T.ink3, 'left');
  }

  function personRowBlock(left, right, T) {
    return {
      h: 146,
      draw: function (ctx, y) {
        var cellW = (INNER - 24) / 2;
        personCell(ctx, left, PAD, y, cellW, T);
        if (right) personCell(ctx, right, PAD + cellW + 24, y, cellW, T);
      }
    };
  }

  function noteBlock(text, T) {
    return {
      h: 64,
      draw: function (ctx, y) {
        drawText(ctx, text, PAD, y + 34, 22, 400, T.ink3, 'left');
      }
    };
  }

  function quoteBlock(snap, T) {
    var size = 40;
    var lh = 62;
    var maxW = INNER - 48;
    var text = '“' + snap.quote + '”';
    var lines = wrap(text, maxW, size, 500, 4);
    var h = 30 + Math.max(1, lines.length) * lh + (snap.quoteBy ? 40 : 12);
    return {
      h: h,
      draw: function (ctx, y) {
        var by = y + 28;
        for (var i = 0; i < lines.length; i++) {
          drawText(ctx, lines[i], PAD + 24, by + i * lh, size, 500, T.ink, 'left');
        }
        if (snap.quoteBy) {
          drawText(ctx, '—— ' + snap.quoteBy, W - PAD, by + lines.length * lh + 6, 21, 400, T.ink3, 'right');
        }
      }
    };
  }

  function infoBlock(label, value, T) {
    var lines = wrap(value, INNER, 27, 500, 2);
    var h = 30 + Math.max(1, lines.length) * 39 + 24;
    return {
      h: h,
      draw: function (ctx, y) {
        drawText(ctx, label, PAD, y + 22, 20, 600, T.ink3, 'left');
        var by = y + 64;
        for (var i = 0; i < lines.length; i++) {
          drawText(ctx, lines[i], PAD, by + i * 39, 27, 500, T.ink, 'left');
        }
      }
    };
  }

  function footerBlock(snap, T) {
    return {
      h: 112,
      draw: function (ctx, y) {
        ctx.strokeStyle = T.line;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PAD, y + 8);
        ctx.lineTo(W - PAD, y + 8);
        ctx.stroke();

        var by = y + 68;
        if (snap.seedCode) {
          drawText(ctx, '种子码', PAD, y + 38, 19, 400, T.ink3, 'left');
          drawText(ctx, ellipsis(snap.seedCode, 420, 26, 600), PAD, by, 26, 600, T.ink, 'left');
        }
        drawText(ctx, snap.gameName + ' · ' + snap.date, W - PAD, by, 21, 400, T.ink3, 'right');
        if (!snap.seedCode) {
          drawText(ctx, 'LIFE SIMULATOR', PAD, by, 19, 400, T.ink3, 'left');
        }
      }
    };
  }

  function buildBlocks(snap, T) {
    var blocks = [];
    blocks.push(headerBlock(snap, T));

    var idx = 1;
    var nodeMeta = snap.nodes.length
      ? snap.nodes[0].age + ' — ' + snap.nodes[snap.nodes.length - 1].age + ' 岁'
      : '';
    blocks.push(sectionBlock(('0' + idx).slice(-2), '关键节点', nodeMeta, T));
    idx++;
    if (snap.nodes.length) {
      snap.nodes.forEach(function (n) { blocks.push(nodeBlock(n, T)); });
    } else {
      blocks.push(noteBlock('这一生没有留下可叙述的节点。', T));
    }

    blocks.push(sectionBlock(('0' + idx).slice(-2), '人物', '', T));
    idx++;
    if (snap.alive.length) {
      blocks.push(subLabelBlock('还在的人', snap.alive.length + ' 人', T));
      for (var a = 0; a < snap.alive.length; a += 2) {
        blocks.push(personRowBlock(snap.alive[a], snap.alive[a + 1], T));
      }
    }
    if (snap.dead.length) {
      blocks.push(subLabelBlock('已经走了的人', snap.dead.length + ' 人', T));
      for (var d = 0; d < snap.dead.length; d += 2) {
        blocks.push(personRowBlock(snap.dead[d], snap.dead[d + 1], T));
      }
    }
    if (!snap.alive.length && !snap.dead.length) {
      blocks.push(noteBlock('这一世，身边没有留下什么人。', T));
    }

    blocks.push(sectionBlock(('0' + idx).slice(-2), '最后', '', T));
    blocks.push(quoteBlock(snap, T));
    blocks.push(infoBlock('遗物', snap.relic, T));
    blocks.push(infoBlock('没做完的那件事', snap.undone, T));
    blocks.push(footerBlock(snap, T));
    return blocks;
  }

  /* ---------------- 分页 + 绘制 ---------------- */
  function paintPage(pageBlocks, height, pageIndex, pageCount, T) {
    var canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = height;
    var ctx = canvas.getContext('2d');

    ctx.fillStyle = T.bg;
    ctx.fillRect(0, 0, W, height);

    roundRect(ctx, FRAME, FRAME, W - FRAME * 2, height - FRAME * 2, 22);
    ctx.fillStyle = T.card;
    ctx.fill();
    ctx.strokeStyle = T.line;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = T.accent;
    ctx.fillRect(PAD, 56, 56, 5);

    var y = CONTENT_TOP;
    for (var i = 0; i < pageBlocks.length; i++) {
      pageBlocks[i].draw(ctx, y);
      y += pageBlocks[i].h;
    }

    if (pageCount > 1) {
      drawText(ctx, (pageIndex + 1) + ' / ' + pageCount, W / 2, height - 48, 20, 500, T.ink3, 'center');
    }
    return canvas;
  }

  function pageLimit(opts) {
    var v = opts && opts.maxHeight ? num(opts.maxHeight, MAX_H) : MAX_H;
    return clamp(v, 900, MAX_H);
  }

  function composePages(snap, T, limit) {
    var blocks = buildBlocks(snap, T);
    var pages = [];
    var cur = [];
    var y = CONTENT_TOP;
    var maxH = clamp(limit || MAX_H, 900, MAX_H);
    var limitY = maxH - BOTTOM;

    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      var need = b.h;
      if (b.keepNext && blocks[i + 1]) need += Math.min(blocks[i + 1].h, 220);
      if (cur.length && y + need > limitY) {
        pages.push({ blocks: cur, end: y });
        cur = [];
        y = CONTENT_TOP;
      }
      cur.push(b);
      y += b.h;
    }
    if (cur.length) pages.push({ blocks: cur, end: y });

    var count = pages.length;
    return pages.map(function (p, i) {
      var h = Math.min(maxH, p.end + BOTTOM);
      return paintPage(p.blocks, h, i, count, T);
    });
  }

  function canvasToBlob(canvas) {
    return new Promise(function (resolve) {
      if (canvas.toBlob) {
        canvas.toBlob(function (blob) {
          if (blob) return resolve(blob);
          canvas.toDataURL('image/png');
          resolve(fallbackBlob(canvas));
        }, 'image/png');
      } else {
        resolve(fallbackBlob(canvas));
      }
    });
  }

  function fallbackBlob(canvas) {
    try {
      var url = canvas.toDataURL('image/png');
      var parts = url.split(',');
      var bin = atob(parts[1]);
      var arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: 'image/png' });
    } catch (e) {
      return null;
    }
  }

  function downloadBlob(blob, filename) {
    var a = document.createElement('a');
    var url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2500);
  }

  function savePages(pages, filename) {
    var base = safeName(filename || ('人生长图_' + formatDate())) || '人生长图';
    base = base.replace(/\.png$/i, '');
    var i = 0;
    return new Promise(function (resolve) {
      function next() {
        if (i >= pages.length) return resolve();
        var file = pages.length > 1 ? base + '_' + (i + 1) + '.png' : base + '.png';
        var page = pages[i];
        i++;
        canvasToBlob(page).then(function (blob) {
          if (blob) downloadBlob(blob, file);
          setTimeout(next, 420);
        }).catch(function () {
          setTimeout(next, 420);
        });
      }
      next();
    });
  }

  /* ---------------- 对外接口 ---------------- */
  CARD.WIDTH = W;
  CARD.MAX_HEIGHT = MAX_H;
  CARD.THEMES = THEMES;

  /* 同步渲染：返回 canvas；若传入 ctx，则把第一页绘制到 ctx.canvas */
  CARD.render = function (ctx, opts) {
    var snap = snapshot(opts);
    var T = resolveTheme(opts, snap);
    var pages = composePages(snap, T, pageLimit(opts));
    CARD.lastSnapshot = snap;
    CARD.lastPages = pages;

    var target = pages[0];
    if (ctx && ctx.canvas) {
      var c = ctx.canvas;
      c.width = target.width;
      c.height = target.height;
      c.getContext('2d').drawImage(target, 0, 0);
      target = c;
    }

    /* SVG 头像异步载入后原地重绘；版式高度不依赖图片，尺寸不变 */
    ensurePortraits(snap).then(function () {
      var repaint = composePages(snap, resolveTheme(opts, snap), pageLimit(opts));
      CARD.lastPages = repaint;
      if (ctx && ctx.canvas) {
        var live = ctx.canvas;
        live.width = repaint[0].width;
        live.height = repaint[0].height;
        live.getContext('2d').drawImage(repaint[0], 0, 0);
      }
    });

    return target;
  };

  /* 下载：载入头像后逐页 toBlob；超过 16000px 时输出 _1 / _2 多张 */
  CARD.download = function (filename, opts) {
    var snap;
    try {
      snap = snapshot(opts);
    } catch (e) {
      return Promise.reject(e);
    }
    var T = resolveTheme(opts, snap);
    return ensurePortraits(snap).then(function () {
      var pages = composePages(snap, T, pageLimit(opts));
      CARD.lastSnapshot = snap;
      CARD.lastPages = pages;
      return savePages(pages, filename).then(function () {
        return pages;
      });
    });
  };

  /* 便于调试：直接拿到同步页（不等待头像） */
  CARD.build = function (opts) {
    var snap = snapshot(opts);
    return composePages(snap, resolveTheme(opts, snap), pageLimit(opts));
  };
})();
