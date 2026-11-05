/* =========================================================
   ui.js — 界面渲染与交互（全部鼠标操作）
   ========================================================= */
(function () {
  'use strict';
  var LS = window.LS;
  var game = null;
  var selTalents = [];
  var alloc = {};
  var bases = {};
  var useLegacy = true;
  var DEBUG_MODE = /debug/i.test(location.hash + location.search);
  var reduceMotion = false;
  var lastMoodTier = null;
  var originPick = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /* 图标表由 icons.js 统一提供；未载入时按 fallback 降级，避免整块 UI 报错 */
  function icon(group, key, fallback) {
    return (LS.icon ? LS.icon(group, key, fallback) : '') || fallback || '';
  }
  function emojiSpan(group, key, cls, fallback) {
    var ch = icon(group, key, fallback);
    return ch ? '<span class="emoji ' + (cls || '') + '" aria-hidden="true">' + esc(ch) + '</span>' : '';
  }
  function show(screenId) {
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) screens[i].classList.remove('active');
    $(screenId).classList.add('active');
  }

  /* ---------------- 弹层 ---------------- */
  function openModal(title, html) {
    $('modalTitle').textContent = title;
    $('modalBody').innerHTML = html;
    $('modal').hidden = false;
  }
  function closeModal() {
    $('modal').hidden = true;
    $('modalBody').innerHTML = '';
  }

  /* =========================================================
     欢迎页
     ========================================================= */
  function bindWelcome() {
    $('btnNew').addEventListener('click', function () {
      resetCreate();
      show('screen-create');
    });
    $('btnLoadWelcome').addEventListener('click', function () { openSaveModal('load'); });
    $('btnExit').addEventListener('click', function () { $('exitScreen').hidden = false; });
    $('btnExitBack').addEventListener('click', function () {
      $('exitScreen').hidden = true;
      show('screen-welcome');
    });
    $('modalClose').addEventListener('click', closeModal);
    $('modal').addEventListener('click', function (e) { if (e.target === $('modal')) closeModal(); });
  }

  /* =========================================================
     角色创建
     ========================================================= */
  function fillSelects() {
    var bp = $('inBirthplace');
    bp.innerHTML = '';
    Object.keys(LS.BIRTHPLACES).forEach(function (k) {
      var o = document.createElement('option');
      o.value = k;
      o.textContent = k;
      bp.appendChild(o);
    });
    bp.value = '小城';

    var bg = $('inBackground');
    bg.innerHTML = '';
    Object.keys(LS.BACKGROUNDS).forEach(function (k) {
      var o = document.createElement('option');
      o.value = k;
      o.textContent = k;
      bg.appendChild(o);
    });
    bg.value = '普通工薪';
  }

  /* =========================================================
     v3.4 开局天赋抽卡：两轮 5 选 1，每轮可整轮重抽一次
     ========================================================= */
  var GACHA_ROUNDS = 2;
  var GACHA_CARDS = 5;
  var gacha = { round: 0, cards: [[], []], picks: [null, null], rerolled: [false, false] };

  function grnd() { return LS.rand ? LS.rand() : Math.random(); }
  function talentOf(id) { return LS.talent ? LS.talent(id) : null; }
  function gachaPicked() {
    return gacha.picks.filter(function (x) { return !!x; });
  }
  function rarityLabel(r) {
    return r === 'legend' ? '传说' : (r === 'rare' ? '稀有' : '普通');
  }
  function rarClass(r) {
    return 'rar-' + (r === 'legend' ? 'legend' : (r === 'rare' ? 'rare' : 'common'));
  }
  function rarityOfRoll(r) {
    if (r < 0.05) return 'legend';
    if (r < 0.30) return 'rare';
    return 'normal';
  }
  /* 单轮候选：普通为主、稀有次之、传说约 5%；同轮不重复，且避开已抽中的天赋 */
  function drawRound(index, exclude) {
    var taken = gacha.picks.filter(function (x) { return !!x; });
    taken = taken.concat(exclude || []);
    var pool = (LS.TALENTS || []).filter(function (t) {
      return taken.indexOf(t.id) < 0;
    });
    var used = {};
    var out = [];
    for (var i = 0; i < GACHA_CARDS; i++) {
      var rarity = rarityOfRoll(grnd());
      var list = (LS.talentsByRarity ? LS.talentsByRarity(rarity) : pool.filter(function (t) {
        return (t.rarity || 'normal') === rarity;
      })).filter(function (t) {
        return taken.indexOf(t.id) < 0 && !used[t.id];
      });
      if (!list.length) {
        list = pool.filter(function (t) { return !used[t.id]; });
      }
      if (!list.length) break;
      var t = list[Math.floor(grnd() * list.length)];
      used[t.id] = true;
      out.push(t.id);
    }
    gacha.cards[index] = out;
  }

  function resetGacha() {
    gacha = { round: 0, cards: [[], []], picks: [null, null], rerolled: [false, false] };
    drawRound(0);
    syncGacha();
  }

  function syncGacha() {
    selTalents = gacha.picks.filter(function (x) { return !!x; });
  }

  function gachaCardHtml(t) {
    var rar = t.rarity || 'normal';
    var picked = gacha.picks.indexOf(t.id) >= 0;
    return '<button type="button" class="gacha-card ' + rarClass(rar) + (picked ? ' picked' : '') + '"' +
      ' data-talent-id="' + esc(t.id) + '" aria-pressed="' + (picked ? 'true' : 'false') + '">' +
      '<span class="g-emoji emoji" aria-hidden="true">' + esc(t.emoji || '✨') + '</span>' +
      '<span class="g-name">' + esc(t.name) + '</span>' +
      '<span class="g-desc">' + esc(t.desc || '') + '</span>' +
      '<span class="g-rar">' + esc(icon('rarity', rar, '🟢')) + ' ' + esc(rarityLabel(rar)) + '</span>' +
      '</button>';
  }

  function gachaSlotHtml(id, index) {
    var t = id ? talentOf(id) : null;
    if (!t) {
      return '<div class="gacha-slot empty gp-empty"><span class="slot-empty">第 ' + (index + 1) + ' 轮待抽</span></div>';
    }
    return '<div class="gacha-slot filled ' + rarClass(t.rarity || 'normal') + '">' +
      '<span class="slot-emoji emoji" aria-hidden="true">' + esc(t.emoji || '✨') + '</span>' +
      '<span class="slot-name">' + esc(t.name) + '</span>' +
      '<span class="slot-rar">' + esc(rarityLabel(t.rarity || 'normal')) + '</span></div>';
  }

  function renderGacha() {
    var done = gachaPicked().length >= GACHA_ROUNDS;
    var round = done ? GACHA_ROUNDS - 1 : Math.min(gacha.round, GACHA_ROUNDS - 1);
    var cardsEl = $('gachaCards');
    if (cardsEl) {
      cardsEl.innerHTML = (gacha.cards[round] || []).map(function (id) {
        var t = talentOf(id);
        return t ? gachaCardHtml(t) : '';
      }).join('');
      var btns = cardsEl.querySelectorAll('[data-talent-id]');
      for (var i = 0; i < btns.length; i++) {
        (function (btn) {
          btn.addEventListener('click', function () { pickGacha(btn.dataset.talentId); });
        })(btns[i]);
      }
    }
    var roundEl = $('gachaRound');
    if (roundEl) {
      roundEl.textContent = done
        ? '两轮已抽满 · 天赋已确定'
        : '第 ' + (round + 1) + ' / ' + GACHA_ROUNDS + ' 轮 · 从 ' + (gacha.cards[round] || []).length + ' 张里选 1 张';
    }
    var pickedEl = $('gachaPicked');
    if (pickedEl) {
      pickedEl.innerHTML = gachaSlotHtml(gacha.picks[0], 0) + gachaSlotHtml(gacha.picks[1], 1);
    }
    var rerollBtn = $('btnReroll');
    if (rerollBtn) {
      var canReroll = !done && !gacha.rerolled[round];
      rerollBtn.disabled = !canReroll;
      rerollBtn.textContent = gacha.rerolled[round] ? '本轮已重抽' : '重抽本轮';
    }
    var countEl = $('talentCount');
    if (countEl) countEl.textContent = String(gachaPicked().length);
    updateTalentNote(done);
  }

  function pickGacha(id) {
    var round = gacha.round;
    if (round >= GACHA_ROUNDS) return;
    if (gacha.picks[round]) return;
    if ((gacha.cards[round] || []).indexOf(id) < 0) return;
    gacha.picks[round] = id;
    if (round < GACHA_ROUNDS - 1) {
      gacha.round = round + 1;
      if (!gacha.cards[gacha.round] || !gacha.cards[gacha.round].length) drawRound(gacha.round);
    } else {
      gacha.round = GACHA_ROUNDS;
    }
    syncGacha();
    renderGacha();
    recomputeBase();
    updateTalentNote();
  }

  function rerollGacha() {
    var round = gacha.round;
    if (round >= GACHA_ROUNDS || gacha.rerolled[round]) return;
    var old = (gacha.cards[round] || []).slice();
    gacha.picks[round] = null;
    gacha.rerolled[round] = true;
    drawRound(round, old);
    syncGacha();
    renderGacha();
    recomputeBase();
    updateTalentNote();
  }

  function randomizeGacha() {
    gacha = { round: 0, cards: [[], []], picks: [null, null], rerolled: [false, false] };
    drawRound(0);
    if (gacha.cards[0].length) gacha.picks[0] = gacha.cards[0][Math.floor(grnd() * gacha.cards[0].length)];
    gacha.round = 1;
    drawRound(1);
    if (gacha.cards[1].length) gacha.picks[1] = gacha.cards[1][Math.floor(grnd() * gacha.cards[1].length)];
    gacha.round = GACHA_ROUNDS;
    syncGacha();
  }

  /* 保留同名入口：测试脚本与旧调用都走这里 */
  function fillTalents() {
    if ($('talentGacha') && (!gacha.cards[0] || !gacha.cards[0].length)) resetGacha();
    renderGacha();
  }

  function updateTalentNote(done) {
    var count = gachaPicked().length;
    var text;
    if (count === 0) {
      text = '第 1 轮：从 5 张候选里选 1 张。每轮可以整轮重抽一次。';
    } else if (count === 1) {
      text = '已抽中「' + (talentOf(gacha.picks[0]) || {}).name + '」。第 2 轮再选 1 张，天赋才会生效。';
    } else {
      var names = gachaPicked().map(function (id) { return (talentOf(id) || {}).name; });
      text = '已抽满：「' + names.join('」「') + '」。天赋会改变基数、事件权重与后续判定。';
    }
    var note = $('gachaNote');
    if (note) { note.textContent = text; note.style.color = count < GACHA_ROUNDS ? 'var(--ink-3)' : ''; }
    var legacyNote = $('noteTalents');
    if (legacyNote) { legacyNote.textContent = text; legacyNote.style.color = ''; }
    var countEl = $('talentCount');
    if (countEl) countEl.textContent = String(count);
    var startBtn = $('btnStartGame');
    if (startBtn && $('talentGacha')) startBtn.disabled = count < GACHA_ROUNDS;
    var roundEl = $('gachaRound');
    if (done && roundEl) roundEl.textContent = '两轮已抽满 · 天赋已确定';
  }

  function recomputeBase() {
    var talents = selTalents.slice();
    bases = LS.baseAttrs($('inBirthplace').value, $('inBackground').value, talents);
    ['knowledge', 'health', 'finance', 'charm', 'happiness', 'reputation'].forEach(function (k) {
      if (alloc[k] === undefined || alloc[k] < bases[k]) alloc[k] = bases[k];
      if (alloc[k] > 100) alloc[k] = 100;
    });
    renderSliders();
    updatePoints();
  }

  function renderSliders() {
    var labels = { knowledge: '学识', health: '健康', finance: '财富相关', charm: '魅力', happiness: '幸福感', reputation: '声望' };
    var wrap = $('attrSliders');
    wrap.innerHTML = '';
    Object.keys(labels).forEach(function (k) {
      var row = document.createElement('div');
      row.className = 'slider-row';
      row.innerHTML = '<div class="slider-head"><label>' + labels[k] + '</label><b id="v-' + k + '">' + Math.round(alloc[k]) + '</b></div>' +
        '<input id="s-' + k + '" type="range" min="' + Math.round(bases[k]) + '" max="100" step="1" value="' + Math.round(alloc[k]) + '">' +
        '<div class="slider-base">基数 ' + Math.round(bases[k]) + '</div>';
      wrap.appendChild(row);
      var input = row.querySelector('input');
      input.addEventListener('input', function () {
        setAlloc(k, Number(input.value));
      });
    });
  }

  function usedPoints() {
    var used = 0;
    for (var k in alloc) used += Math.max(0, Math.round(alloc[k]) - Math.round(bases[k]));
    return used;
  }

  function setAlloc(k, v) {
    var others = 0;
    for (var key in alloc) if (key !== k) others += Math.max(0, Math.round(alloc[key]) - Math.round(bases[key]));
    var max = Math.max(Math.round(bases[k]), Math.min(100, Math.round(bases[k]) + LS.FREE_POINTS - others));
    var val = Math.min(v, max);
    alloc[k] = val;
    var slider = $('s-' + k);
    if (slider) slider.value = val;
    $('v-' + k).textContent = Math.round(val);
    updatePoints();
  }

  function updatePoints() {
    var left = LS.FREE_POINTS - usedPoints();
    $('pointsLeft').textContent = left;
    $('pointsLeft').style.color = left < 0 ? 'var(--danger)' : 'var(--accent)';
    var total = 0;
    for (var k in alloc) total += Math.round(alloc[k]);
    $('attrTotal').textContent = total;
    $('attrHint').textContent = left > 0
      ? '还剩 ' + left + ' 点可分配。拖动滑块微调，每 1 点消耗 1 个剩余点数。'
      : (left === 0 ? '点数已分配完。属性不是越高越好，后面每一年都要为它们付代价。' : '分配超额，请调低一些。');
    $('attrHint').style.color = left < 0 ? 'var(--danger)' : '';
  }

  function updateFieldNotes() {
    var bp = LS.BIRTHPLACES[$('inBirthplace').value];
    var bg = LS.BACKGROUNDS[$('inBackground').value];
    $('noteBirthplace').textContent = bp.desc;
    $('noteBackground').textContent = bg.desc + '（初始现金约 ' + LS.fmtMoney(bg.cash * bp.cashMul) + '，固定资产约 ' + LS.fmtMoney(bg.assets * bp.assetMul) + '）';
  }

  /* 传承开关：只用按钮切换，不引入输入框 */
  function updateLegacyNote() {
    var btn = $('btnLegacy');
    var note = $('noteLegacy');
    if (!btn || !note) return;
    var leg = LS.legacyRead();
    btn.textContent = useLegacy ? '继承前世：已启用' : '继承前世（可选）';
    if (!leg.runs) {
      note.textContent = '还没有可继承的上一世。完成一次人生后，这里会出现可继承的声望与现金。';
      return;
    }
    var rep = Math.min(15, Math.round(leg.reputation || 0));
    var cash = Math.min(5000, Math.round(leg.cash || 0));
    note.textContent = '可继承：声望 +' + rep + ' · 现金 ' + LS.fmtMoney(cash) +
      (leg.source ? '（来自上一世「' + leg.source + '」）' : '') +
      (useLegacy ? '。开局时会自动带入。' : '。当前选择不继承；引擎实际开局仍会读取上一世传承，此按钮仅记录意愿。');
  }

  function resetCreate() {
    resetGacha();
    useLegacy = true;
    $('inName').value = '';
    $('inGender').value = '男';
    rollOrigin();
    bases = LS.baseAttrs($('inBirthplace').value, $('inBackground').value, []);
    alloc = {};
    for (var k in bases) alloc[k] = bases[k];
    fillTalents();
    updateTalentNote();
    recomputeBase();
    updateFieldNotes();
    updateLegacyNote();
    paintPrequelQuotes();
  }

  /* v3.5：开局与创建页各随机一句金句（同一句不会在同一局重复） */
  function paintPrequelQuotes() {
    if (!LS.V35) return;
    var wq = $('welcomeQuote');
    if (wq) wq.innerHTML = LS.V35.quoteHtml(null);
    var cq = $('createQuote');
    if (cq) cq.innerHTML = LS.V35.quoteHtml(null);
  }

  function randomCharacter() {
    var keys = Object.keys(LS.BIRTHPLACES);
    var bgs = Object.keys(LS.BACKGROUNDS);
    $('inName').value = LS.randomName(LS.chance(0.5) ? '女' : '男');
    $('inGender').value = LS.pick(['男', '女', '其他']);
    $('inBirthplace').value = LS.pick(keys);
    $('inBackground').value = LS.pick(bgs);
    randomizeGacha();
    fillTalents();
    updateTalentNote();
    rollOrigin();
    bases = LS.baseAttrs($('inBirthplace').value, $('inBackground').value, selTalents);
    alloc = {};
    for (var k in bases) alloc[k] = bases[k];
    var left = LS.FREE_POINTS;
    var weights = { knowledge: 3, health: 2, finance: 2, charm: 2, happiness: 2, reputation: 1 };
    var kk = Object.keys(weights);
    while (left > 0) {
      var pick = kk[Math.floor(LS.rand() * kk.length)];
      if (alloc[pick] >= 100) { kk = kk.filter(function (x) { return alloc[x] < 100; }); if (!kk.length) break; continue; }
      alloc[pick] += 1;
      left -= 1;
    }
    renderSliders();
    updatePoints();
    updateFieldNotes();
    var legacyNote = $('noteTalents');
    if (legacyNote) legacyNote.style.color = '';
  }

  /* v3.6 出身抽签：界面只给 3 项，隐秘身世始终显示 ? */
  function rollOrigin() {
    if (!LS.ORIGIN) return;
    var r = LS.ORIGIN.roll();
    var bgMap = { '贫困': '贫困', '普通': '普通工薪', '小康': '中产', '富裕': '富裕', '单亲': '普通工薪', '重组家庭': '普通工薪', '无父无母': '贫困', '被收养': '普通工薪' };
    var locMap = { '城市': '二线城市', '县城': '小城', '乡镇': '小城', '农村': '农村' };
    originPick = { klass: r.klass, locale: r.locale, secretId: r.secretId };
    var oc = $('originClass'), ol = $('originLocale'), os = $('originSecret');
    if (oc) oc.textContent = r.klass;
    if (ol) ol.textContent = r.locale;
    if (os) os.textContent = '?';
    if ($('inBackground') && bgMap[r.klass]) $('inBackground').value = bgMap[r.klass];
    if ($('inBirthplace') && locMap[r.locale]) $('inBirthplace').value = locMap[r.locale];
  }

  function applyRolledOrigin() {
    rollOrigin();
    bases = LS.baseAttrs($('inBirthplace').value, $('inBackground').value, selTalents);
    alloc = {};
    for (var k in bases) alloc[k] = bases[k];
    renderSliders();
    updatePoints();
    updateFieldNotes();
  }

  function bindCreate() {
    $('inBirthplace').addEventListener('change', function () { recomputeBase(); updateFieldNotes(); });
    $('inBackground').addEventListener('change', function () { recomputeBase(); updateFieldNotes(); });
    $('btnResetAlloc').addEventListener('click', function () {
      alloc = {};
      for (var k in bases) alloc[k] = bases[k];
      renderSliders();
      updatePoints();
    });
    $('btnRandomChar').addEventListener('click', randomCharacter);
    var rollBtn = $('btnRollOrigin');
    if (rollBtn) rollBtn.addEventListener('click', applyRolledOrigin);
    var legBtn = $('btnLegacy');
    if (legBtn) legBtn.addEventListener('click', function () {
      useLegacy = !useLegacy;
      updateLegacyNote();
    });
    $('btnCreateBack').addEventListener('click', function () { show('screen-welcome'); });
    var rerollBtn = $('btnReroll');
    if (rerollBtn) rerollBtn.addEventListener('click', rerollGacha);
    $('btnStartGame').addEventListener('click', function () {
      var name = $('inName').value.trim();
      if (!name) {
        openModal('还差一步', '<p class="empty-note">请先给角色起一个名字。名字最多 12 个字。</p>');
        $('inName').focus();
        return;
      }
      if (usedPoints() > LS.FREE_POINTS) {
        openModal('属性分配超额', '<p class="empty-note">剩余点数不能为负，请调低某些属性后再开始。</p>');
        return;
      }
      var picked = gachaPicked();
      if (picked.length < GACHA_ROUNDS) {
        var note = $('gachaNote');
        if (note) {
          note.textContent = '还要抽满两轮天赋才能开始：第 ' + (picked.length + 1) + ' 轮还没选。';
          note.style.color = 'var(--danger)';
        }
        return;
      }
      var attrs = {};
      for (var k in alloc) attrs[k] = Math.round(alloc[k]);
      var cfg = {
        name: name,
        gender: $('inGender').value,
        birthplace: $('inBirthplace').value,
        background: $('inBackground').value,
        talents: picked.slice(0, GACHA_ROUNDS),
        attrs: attrs,
        useLegacy: useLegacy,
        origin: originPick,
        seed: (Date.now() % 2147483647) || 1
      };
      try {
        game = LS.engine.start(cfg);
      } catch (e) {
        openModal('无法开始', '<p class="empty-note">' + esc(e.message || '创建失败') + '</p>');
        return;
      }
      game.reduceMotion = !!reduceMotion;
      syncReduceMotion();
      closeModal();
      show('screen-game');
      LS.save.autoSave(game);
      renderGame();
    });
  }

  /* =========================================================
     主界面
     ========================================================= */
  /* 阶段序号 / 阶段名，形如“阶段 3/7 · 少年” */
  function stageBarText() {
    if (!game) return '';
    return '阶段 ' + LS.stageIndexOf(game.age) + '/7 · ' + LS.stageOf(game.age);
  }

  /* v3.4 七属性：图标 + 数值 + 迷你条；<40 警戒 / <25 危险 / <10 闪烁，压力反向 */
  var ATTR_META = {
    knowledge: { label: '学识' },
    health: { label: '健康' },
    finance: { label: '财力' },
    charm: { label: '魅力' },
    happiness: { label: '幸福' },
    reputation: { label: '声望' },
    stress: { label: '压力' }
  };

  function warnLevel(v, invert) {
    v = Number(v) || 0;
    if (invert) {
      if (v > 90) return 'crit';
      if (v > 75) return 'danger';
      if (v > 65) return 'warn';
      return '';
    }
    if (v < 10) return 'crit';
    if (v < 25) return 'danger';
    if (v < 40) return 'warn';
    return '';
  }

  function attrBarChip(key, val) {
    var m = ATTR_META[key] || { label: key };
    var v = Math.round(LS.clamp(Number(val) || 0, 0, 100));
    var lv = warnLevel(v, key === 'stress');
    return '<div class="sb-chip attr-chip ' + esc(key) + (key === 'stress' ? ' stress' : '') +
      (lv ? ' ' + lv : '') + '" data-k="' + esc(key) + '" title="' + esc(m.label + ' ' + v) + '">' +
      '<div class="attr-top">' +
      '<span class="ico" aria-hidden="true">' + esc(icon('attr', key, '·')) + '</span>' +
      '<span class="lbl">' + esc(m.label) + '</span>' +
      '<span class="val">' + v + '</span></div>' +
      '<div class="attr-bar"><i style="width:' + v + '%"></i></div></div>';
  }

  function chips() {
    if (!game) return '';
    var a = game.attrs;
    return [
      attrBarChip('knowledge', a.knowledge),
      attrBarChip('health', a.health),
      attrBarChip('finance', a.finance),
      attrBarChip('charm', a.charm),
      attrBarChip('happiness', a.happiness),
      attrBarChip('reputation', LS.repTotal(game)),
      attrBarChip('stress', a.stress)
    ].join('');
  }

  /* v3.4 非阻断暗角：健康 <50 灰 / 幸福 <40 暖灰 / 压力 >65 冷灰，取最严重一档 */
  function moodTierOf(a) {
    if (!a) return null;
    var list = [];
    var h = Number(a.health) || 0;
    var hap = Number(a.happiness) || 0;
    var st = Number(a.stress) || 0;
    if (h < 50) list.push({ tier: 'health', gap: 50 - h });
    if (hap < 40) list.push({ tier: 'happy', gap: 40 - hap });
    if (st > 65) list.push({ tier: 'stress', gap: st - 65 });
    if (!list.length) return null;
    list.sort(function (x, y) { return y.gap - x.gap; });
    return list[0].tier;
  }

  var MOOD_HINT = {
    health: '身体在报警：健康已低于 50，别再把休息往后拖。',
    happy: '情绪长期偏低：幸福感不到 40，找个人说说话。',
    stress: '压力已经过高：超过 65，再硬撑会先垮掉身体。'
  };

  function paintMood() {
    var v = $('moodVignette');
    var hint = $('moodHint');
    if (!v) return;
    var tier = game ? moodTierOf(game.attrs) : null;
    v.style.pointerEvents = 'none';
    v.style.opacity = tier ? '0.85' : '0';
    v.setAttribute('aria-hidden', 'true');
    if (tier !== lastMoodTier) {
      v.className = 'mood-vignette' + (tier ? ' mood-' + tier : '');
      void v.offsetWidth;
      /* 一次性呼吸：只在档位切换时触发，减少动效时不播 */
      if (tier && !reduceMotion && v.animate) {
        try {
          v.animate([{ opacity: 0 }, { opacity: 0.92 }, { opacity: 0.85 }],
            { duration: 800, easing: 'ease-out' });
        } catch (e) { /* 老浏览器忽略 */ }
      }
      lastMoodTier = tier;
    }
    if (hint) {
      hint.textContent = tier ? MOOD_HINT[tier] : '';
      hint.hidden = !tier;
    }
  }

  function clearMood() {
    lastMoodTier = null;
    var v = $('moodVignette');
    if (v) { v.className = 'mood-vignette'; v.style.opacity = '0'; }
    var hint = $('moodHint');
    if (hint) { hint.textContent = ''; hint.hidden = true; }
  }

  /* v3.4 减少动效：只切 body class，功能完全不变 */
  function systemReduceMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }
  function syncReduceMotion() {
    document.body.classList.toggle('reduce-motion', !!reduceMotion);
    var btn = $('btnReduceMotion');
    if (btn) {
      btn.textContent = reduceMotion ? '动效已关' : '减少动效';
      btn.setAttribute('aria-pressed', reduceMotion ? 'true' : 'false');
    }
    if (game) game.reduceMotion = !!reduceMotion;
  }
  function bindReduceMotion() {
    var btn = $('btnReduceMotion');
    if (!btn) return;
    btn.addEventListener('click', function () {
      reduceMotion = !reduceMotion;
      syncReduceMotion();
      if (game) LS.save.autoSave(game);
    });
  }

  /* 现金与固定资产：放在左侧信息区，避免挤占六属性进度条 */
  function paintSbMoney() {
    if (!game) return;
    var left = document.querySelector('.sb-left');
    if (!left) return;
    var box = $('sbMoney');
    if (!box) {
      box = document.createElement('div');
      box.id = 'sbMoney';
      box.className = 'sb-money';
      left.appendChild(box);
    }
    box.innerHTML = '<span>现金 ' + esc(LS.fmtMoney(game.money.cash)) + '</span><i></i><span>固定资产 ' + esc(LS.fmtMoney(game.money.assets)) + '</span>';
  }

  var EVENT_LABEL = { forced: '命运节点', causal: '因果回响', random: '日常际遇', daily: '平静一年' };

  /* ---------------- v2 遮罩：阶段过场 / 命运岔路口 / 重大结果播报 ---------------- */
  function overlayHost() { return $('v2Overlay'); }
  /* 遮罩打开时隐藏右下角常驻按钮，避免与弹层内容压叠 */
  function setCornerHidden(hidden) {
    var c = $('cornerActions');
    if (c) c.hidden = !!hidden;
  }
  function closeOverlay() {
    var h = overlayHost();
    h.hidden = true;
    h.className = 'v2-overlay';
    h.innerHTML = '';
    h.scrollTop = 0;
    if (h.style) {
      h.style.removeProperty('--stage');
      h.style.removeProperty('--stage-bg');
    }
    h.removeAttribute('data-stage');
    setCornerHidden(false);
  }
  function openOverlay(kind, html) {
    var h = overlayHost();
    h.className = 'v2-overlay show ' + kind;
    h.innerHTML = html;
    h.hidden = false;
    h.scrollTop = 0;
    setCornerHidden(true);
  }

  /* ---------------- v3.2 阻断弹窗控制：一回合最多一个遮罩 ---------------- */
  function blockerTaken() {
    if (!game) return false;
    var list = game.blockerLog || [];
    for (var i = list.length - 1; i >= 0; i--) {
      if (list[i] && list[i].turn === game.turn) return true;
    }
    return false;
  }
  function markBlocker(kind) {
    if (!game) return;
    game.blockerLog = game.blockerLog || [];
    game.blockerLog.push({
      turn: game.turn, year: game.year, age: game.age, kind: kind
    });
    if (game.blockerLog.length > 200) game.blockerLog.shift();
    game.blockedTurn = game.turn;
  }
  /* 事件文本模板：events_v32b.js 提供 LS.renderTemplate，缺失时安全降级 */
  function tpl(str) {
    var s = (str === undefined || str === null) ? '' : String(str);
    if (!game || !LS.renderTemplate) return s;
    try {
      var out = LS.renderTemplate(s, game);
      return (out === undefined || out === null) ? s : String(out);
    } catch (e) { return s; }
  }

  /* 结果分发：总结卡 → 阶段过场 → 播报 → 事件渲染，最后兜底 */
  function handleResult(r) {
    if (!r || !r.ok) {
      openModal('无法推进', '<p class="empty-note">' + esc((r && r.error) || '发生未知错误') + '</p>');
      return;
    }
    if (r.dead) { renderEnd(); return; }
    if (r.paused === 'summary') {
      if (game.pendingStage) { showStageOverlay(game.pendingStage, false, r.summary || game.stageSummary); return; }
      showStageSummary(r.summary || game.stageSummary);
      return;
    }
    if (r.paused === 'stage') { showStageOverlay(r.stage || game.pendingStage, false, r.summary || game.stageSummary); return; }
    if (r.paused === 'broadcast') { showBroadcast(r.broadcast); return; }
    if (r.event) { renderGame(); return; }

    /* 没有事件也没死：再取一次事件；仍为空则按待确认的总结/过场继续分发 */
    if (!game.death.dead) {
      var e2 = LS.engine.nextEvent(game);
      if (e2) { renderGame(); return; }
      if (game.pendingSummary) {
        if (game.pendingStage) { showStageOverlay(game.pendingStage, false, game.stageSummary); return; }
        showStageSummary(game.stageSummary);
        return;
      }
      if (game.pendingStage) { showStageOverlay(game.pendingStage); return; }
    }
    renderGame();
  }

  /* 过场遮罩期间冻结主循环表面：清空选项，避免遮罩下仍残留可点选项 */
  function pauseStorySurface() {
    var o = $('options');
    if (o) { o.innerHTML = ''; o.className = 'options'; }
    if ($('sourceBar')) $('sourceBar').hidden = true;
    if ($('evArt')) $('evArt').hidden = true;
    if ($('annotationBar')) $('annotationBar').hidden = true;
  }

  /* 前情回顾：只从 eventLog 取该阶段之前的 3 条真实结果 */
  function recapLines(mark) {
    if (!game) return [];
    var cut = mark ? mark.age : (game.age || 0);
    var out = [];
    var list = (game.eventLog || []).filter(function (x) { return Number(x.age) < cut; });
    list = list.slice(-3);
    for (var i = 0; i < list.length; i++) {
      var t = String(list[i].resultText || list[i].title || '').replace(/^【[^】]*】/, '');
      if (!t) continue;
      out.push({ age: list[i].age, text: t.length > 42 ? t.slice(0, 42) + '…' : t });
    }
    return out;
  }

  /* 该阶段之前的命运岔路：只从 eventLog 取，最多 4 条 */
  function keyChoicesBefore(mark) {
    if (!game) return [];
    var cut = mark ? mark.age : 999;
    return (game.eventLog || []).filter(function (x) {
      return x.tier === 'crossroad' && x.choiceId && Number(x.age) < cut;
    }).map(function (x) {
      return { key: x.choiceId, id: x.eventId, age: x.age, year: x.year, title: x.title, label: x.choiceLabel };
    }).slice(-4);
  }

  /* 点击前情中的关键抉择：只展示 eventLog 里真实存在的选择与回响 */
  function openChoiceRecap(c) {
    if (!c) return;
    var key = c.key || (c.id + '@' + c.age);
    var src = null, echo = null;
    (game.eventLog || []).forEach(function (x) {
      if (!src && x.choiceId === key) src = x;
      if (!echo && x.tier === 'echo' && x.echoOf === key) echo = x;
    });
    var result = '';
    if (src && src.resultText) {
      result = '当时的结果：' + src.resultText;
    } else {
      result = '这一世没有留下记录。';
    }
    if (echo) {
      result += ' 后来（' + echo.year + ' 年 · ' + echo.age + ' 岁）有了回响：' + (echo.title || '一件相关的事') + '。';
    }
    openModal('那一次选择',
      '<div class="recap-modal">' +
      '<div class="kv"><span>时间</span><span>' + c.year + ' 年 · ' + c.age + ' 岁</span></div>' +
      '<div class="kv"><span>所在事件</span><span>' + esc(c.title || '—') + '</span></div>' +
      '<div class="recap-choice">当时你选择了「' + esc(c.label) + '」</div>' +
      '<p class="recap-result">' + esc(result) + '</p>' +
      '</div>');
  }

  /* 人物图容错：art.js 若抛错则回退到内置简笔头像，不阻塞过场 */
  function fallbackPersonArt(gender, key) {
    var old = key === 'elder' || key === 'late';
    var baby = key === 'infant' || key === 'child';
    var hair = old ? '#d9d2c5' : '#4a423a';
    var cloth = baby ? '#ddd6c6' : '#6f7d78';
    var headR = baby ? 32 : 28;
    var headY = baby ? 72 : 78;
    return '<svg viewBox="0 0 150 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="人物">' +
      '<rect width="150" height="210" fill="#f7f4ec"/>' +
      '<ellipse cx="75" cy="196" rx="44" ry="8" fill="#e3dbcb"/>' +
      '<path d="M75 ' + (headY + headR + 10) + ' C45 ' + (headY + headR + 20) + ' 36 172 34 196 L116 196 C114 172 105 ' + (headY + headR + 20) + ' 75 ' + (headY + headR + 10) + ' Z" fill="' + cloth + '" opacity="0.94"/>' +
      '<rect x="69" y="' + (headY + headR - 14) + '" width="12" height="20" rx="5" fill="#e8d3bc"/>' +
      '<ellipse cx="75" cy="' + headY + '" rx="' + headR + '" ry="' + Math.round(headR * 1.18) + '" fill="#ead3bb"/>' +
      '<path d="M' + (75 - headR) + ' ' + (headY - 6) + ' C' + (75 - headR) + ' ' + (headY - headR - 12) + ' ' + (75 + headR) + ' ' + (headY - headR - 12) + ' ' + (75 + headR) + ' ' + (headY - 6) + ' C' + (75 + headR - 8) + ' ' + (headY - headR + 2) + ' ' + (75 - headR + 8) + ' ' + (headY - headR + 2) + ' ' + (75 - headR) + ' ' + (headY - 6) + ' Z" fill="' + hair + '" opacity="0.9"/>' +
      '<ellipse cx="64" cy="' + (headY + 2) + '" rx="6" ry="4" fill="#3b332c"/>' +
      '<ellipse cx="86" cy="' + (headY + 2) + '" rx="6" ry="4" fill="#3b332c"/>' +
      '<path d="M67 ' + (headY + 18) + ' q8 4 16 0" stroke="#a07a63" stroke-width="1" fill="none" opacity="0.7"/>' +
      '</svg>';
  }
  function safePersonArt(gender, key) {
    try {
      var svg = LS.artPerson(gender, key);
      if (svg) return svg;
    } catch (e) { /* 兼容 art.js 的绘制异常 */ }
    return fallbackPersonArt(gender, key);
  }

  /* 同回合已有遮罩时，静默消化未确认的过场/总结，避免连环弹窗 */
  function clearStaleBlockers() {
    if (!game) return;
    if (game.pendingStage) {
      game.stageSeen = game.stageSeen || {};
      game.stageSeen[game.pendingStage] = true;
      game.pendingStage = null;
    }
    game.pendingSummary = false;
    LS.save.autoSave(game);
    renderGame();
  }

  /* 阶段过场内嵌阶段总结：一次遮罩完成过场 + 汇总 */
  function stageSummaryInline(s) {
    if (!s) return '';
    var lines = (s.lines || []).slice(0, 3).map(function (t) {
      return '<p class="summary-line">' + esc(t) + '</p>';
    }).join('');
    var changes = (s.changes || []).map(function (c) {
      return '<div class="summary-chg"><span class="chg-label">' + esc(c.label || '') + '</span>' +
        deltaHtml(c.kind, c.delta) + '</div>';
    }).join('');
    var impacts = (s.impacts || []).slice(0, 2).map(function (x) {
      return '<div class="impact-row"><div class="impact-head"><span class="impact-label">' +
        esc(x.label || x.type || '影响') + '</span></div>' +
        '<div class="impact-note">' + esc(x.note || '') + '</div></div>';
    }).join('');
    return '<div class="stage-summary-inline">' +
      '<div class="recap-sub">这一段的结果</div>' +
      (lines || '<div class="recap-empty">这一段没有留下可叙述的事。</div>') +
      '<div class="recap-sub">关键变化</div><div class="summary-changes">' +
      (changes || '<div class="recap-empty">没有明显的数值变化。</div>') + '</div>' +
      (impacts ? '<div class="recap-sub">留下的影响</div><div class="summary-impacts">' + impacts + '</div>' : '') +
      '</div>';
  }

  function showStageOverlay(key, debug, summary) {
    var m = LS.stageMark(key);
    if (!m) { closeOverlay(); if (!debug) renderGame(); return; }
    var sum = summary || (game && game.pendingSummary ? game.stageSummary : null);
    /* v3.2 单回合只允许一个遮罩：本回合已有遮罩则静默消化 */
    if (game && !debug) {
      if (blockerTaken()) { clearStaleBlockers(); return; }
      markBlocker('stage');
    } else if (game) {
      markBlocker('stage');
    }
    pauseStorySurface();
    var art = LS.artPortrait(game.gender, m.art || key, '', game.seed) || safePersonArt(game.gender, m.art || key);
    var lines = recapLines(m);
    var choices = keyChoicesBefore(m);
    var recapHtml =
      '<div class="stage-recap">' +
      '<div class="recap-label">前情回顾</div>' +
      (lines.length
        ? '<div class="recap-lines">' + lines.map(function (x) {
          return '<div class="recap-line"><span class="recap-age">' + x.age + ' 岁</span><span>' + esc(x.text) + '</span></div>';
        }).join('') + '</div>'
        : '<div class="recap-empty">此前还没有值得单独记下的事。</div>') +
      (choices.length
        ? '<div class="recap-sub">关键抉择</div><div class="recap-chips">' + choices.map(function (c, i) {
          return '<button type="button" class="recap-chip" data-ci="' + i + '">' + c.age + ' 岁 · ' + esc(c.label) + '</button>';
        }).join('') + '</div>'
        : '') +
      '</div>';
    openOverlay('stage-overlay',
      '<div class="stage-mask">' +
      '<div class="stage-card stage-card-wide">' +
      '<div class="stage-kicker">人生阶段 · ' + esc(m.label) + ' · ' + m.age + ' 岁</div>' +
      '<div class="stage-body">' +
      '<div class="stage-left"><div class="stage-art">' + art + '</div></div>' +
      '<div class="stage-right">' +
      '<h2 class="stage-title">' + emojiSpan('stage', m.label, 'stage-emoji') + esc(m.title) + '</h2>' +
      '<p class="stage-desc">' + esc(m.desc) + '</p>' +
      (LS.V35 ? '<div class="life-quote stage-quote">' + LS.V35.quoteHtml(game) + '</div>' : '') +
      recapHtml +
      stageSummaryInline(sum) +
      '<button type="button" class="btn primary stage-continue" id="btnStageContinue">继续人生</button>' +
      '</div></div></div></div>');
    /* 阶段主色：--stage 驱动 .stage-overlay；优先新 token，回落旧 --st-* */
    var stageKey = m.key || key;
    var host = overlayHost();
    if (host.style) {
      host.style.setProperty('--stage', 'var(--stage-' + stageKey + ', var(--st-' + stageKey + '))');
      host.style.setProperty('--stage-bg', 'var(--stage-' + stageKey + '-bg, var(--st-' + stageKey + '-bg))');
    }
    host.setAttribute('data-stage', stageKey);
    var chipsInCard = overlayHost().querySelectorAll('[data-ci]');
    for (var i = 0; i < chipsInCard.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          openChoiceRecap(choices[Number(btn.dataset.ci)]);
        });
      })(chipsInCard[i]);
    }
    $('btnStageContinue').addEventListener('click', function () {
      closeOverlay();
      if (debug) { renderGame(); return; }
      var r = LS.engine.continueAfter(game, 'stage');
      LS.save.autoSave(game);
      handleResult(r);
    });
    if (!debug) LS.save.autoSave(game);
  }

  /* 变化数值：正数柔和绿，负数橙红；标签类变化用中性色 */
  function deltaHtml(kind, delta) {
    if (typeof delta === 'number' && isFinite(delta)) {
      if (!delta) return '<span class="delta-new">0</span>';
      var cls = delta > 0 ? 'delta-up' : 'delta-down';
      var sign = delta > 0 ? '+' : '';
      var txt = (kind === 'money') ? (sign + LS.fmtMoney(delta)) : (sign + delta);
      if (kind === 'money' && delta < 0) txt = LS.fmtMoney(delta);
      return '<span class="' + cls + '">' + esc(txt) + '</span>';
    }
    return '<span class="delta-new">' + esc(delta == null ? '—' : delta) + '</span>';
  }

  /* 阶段总结卡：跨阶段时暂停，确认后继续 */
  function showStageSummary(s) {
    if (!s) { renderGame(); return; }
    if (game) {
      if (blockerTaken()) {
        game.pendingSummary = false;
        LS.save.autoSave(game);
        renderGame();
        return;
      }
      markBlocker('summary');
    }
    pauseStorySurface();
    var rng = LS.stageRange(s.fromStage) || [0, s.atAge || 0];
    var a = rng[0];
    var b = (s.atAge === undefined || s.atAge === null) ? rng[1] : s.atAge;
    /* 跨阶段时 atAge 已是新阶段第一年，回退一年得到旧阶段的结束年龄 */
    if (s.toStage && s.toStage !== s.fromStage && b > a) b = Math.min(b - 1, rng[1]);
    var lines = (s.lines || []).map(function (t) {
      return '<p class="summary-line">' + esc(t) + '</p>';
    }).join('');
    var changes = (s.changes || []).map(function (c) {
      return '<div class="summary-chg"><span class="chg-label">' + esc(c.label || '') + '</span>' +
        deltaHtml(c.kind, c.delta) + '</div>';
    }).join('');
    var impacts = (s.impacts || []).map(function (x) {
      return '<div class="impact-row"><div class="impact-head"><span class="impact-label">' + esc(x.label || x.type || '影响') + '</span>' +
        '<span class="impact-tag">已写入后续事件</span></div>' +
        '<div class="impact-note">' + esc(x.note || '') + '</div></div>';
    }).join('');
    openOverlay('summary-overlay',
      '<div class="summary-mask"><div class="summary-card">' +
      '<div class="summary-kicker">阶段结算 · ' + esc(s.fromStage) + ' → ' + esc(s.toStage) + '</div>' +
      '<h2 class="summary-title">【' + esc(s.fromStage) + '】结束 · 年龄 ' + esc(a) + '–' + esc(b) + '</h2>' +
      (lines ? '<div class="summary-lines">' + lines + '</div>' : '') +
      '<div class="summary-sub">关键变化</div><div class="summary-changes">' +
      (changes || '<div class="empty-note">这一段没有明显的数值变化。</div>') + '</div>' +
      '<div class="summary-sub">本阶段留下的影响</div><div class="summary-impacts">' +
      (impacts || '<div class="empty-note">这一段没有留下会被后续事件读取的影响。</div>') + '</div>' +
      '<div class="summary-foot"><button type="button" class="btn primary summary-continue" id="btnSummaryContinue">继续</button></div>' +
      '</div></div>');
    $('btnSummaryContinue').addEventListener('click', function () {
      closeOverlay();
      var r = LS.engine.continueAfter(game, 'summary');
      LS.save.autoSave(game);
      handleResult(r);
    });
    LS.save.autoSave(game);
  }

  function showCrossGate(e, key) {
    game.crossSeen = game.crossSeen || {};
    game.crossSeen[key] = true;
    markBlocker('cross');
    LS.save.autoSave(game);
    pauseStorySurface();
    var artKey = sceneKeyOf(e);
    var art = artKey ? (LS.artScene(artKey) || LS.artEvent(artKey)) : '';
    openOverlay('cross-overlay',
      '<div class="cross-mask"><div class="cross-card">' +
      '<div class="cross-kicker"><span class="tier-icon">⑂</span> 命运岔路</div>' +
      '<h2 class="cross-title">' + esc(e.title) + '</h2>' +
      '<div class="cross-art">' + art + '</div>' +
      '<p class="cross-text">这一步之后，很多年才会有回声。眼前能看清的，只是岔路本身。</p>' +
      '<button type="button" class="btn primary cross-continue" id="btnCrossGo">继续</button>' +
      '</div></div>');
    $('btnCrossGo').addEventListener('click', function () {
      closeOverlay();
      paintEvent(game.current);
    });
  }

  /* 播报情绪归类：乐事 / 哀事 / 中性；tone 优先，标题关键词兜底 */
  function bcToneClass(b) {
    var tone = String((b && b.tone) || '').toLowerCase();
    if (/red|sorrow|bad|cry|loss/.test(tone)) return 'sorrow';
    if (/gold|green|joy|good|win|happy/.test(tone)) return 'joy';
    var title = String((b && b.title) || '');
    if (/去世|离世|病逝|丧|死亡|失业|离婚|分手|失败|亏损|被骗|入狱|失明|截肢/.test(title)) return 'sorrow';
    if (/结婚|出生|降生|考上|录取|升职|成功|中奖|买房|退休|团圆|康复|获奖/.test(title)) return 'joy';
    return 'neutral';
  }

  function showBroadcast(b, debug) {
    if (!b) return;
    /* v3.2 单回合只允许一个遮罩：已有遮罩则跳过播报，直接推进 */
    if (game && !debug) {
      if (blockerTaken()) {
        var rs = LS.engine.continueAfter(game);
        LS.save.autoSave(game);
        handleResult(rs);
        return;
      }
      markBlocker('broadcast');
    }
    var art = (LS.artHas && LS.artHas(b.art)) ? '<div class="bc-art">' + (LS.artScene(b.art) || LS.artEvent(b.art)) + '</div>' : '';
    var chg = b.changes
      ? '<div class="bc-changes"><span class="bc-chg-label">实际变化</span>' + changeTone(b.changes) + '</div>'
      : '<div class="bc-changes muted">本回合没有产生可记录的数值变动。</div>';
    var merged = (b.merged && b.merged.length)
      ? '<div class="bc-merged">同回合同时发生：' + esc(b.merged.join('、')) + '（已合并播报）</div>' : '';
    openOverlay('bc-overlay',
      '<div class="bc-mask"><div class="bc-card broadcast ' + bcToneClass(b) + ' tone-' + esc(b.tone || 'gold') + '">' +
      '<div class="bc-kicker">重大结果播报</div>' +
      '<h2 class="bc-title">' + emojiSpan('bc', bcToneClass(b), 'bc-emoji') + '【' + esc(b.title) + '】</h2>' +
      art +
      '<p class="bc-text">' + esc(b.text) + '</p>' +
      chg + merged +
      '<div class="bc-time">' + esc(((b.year || game.year) + ' 年 · ' + (b.age || game.age) + ' 岁')) + '</div>' +
      '<button type="button" class="btn primary bc-ok" id="btnBcOk">我知道了</button>' +
      '</div></div>');
    $('btnBcOk').addEventListener('click', function () {
      closeOverlay();
      if (debug) { renderGame(); return; }
      var r = LS.engine.continueAfter(game);
      LS.save.autoSave(game);
      handleResult(r);
    });
  }

  /* 属性变化高亮：增益柔和绿，损耗与负债/压力橙红 */
  function changeTone(text) {
    return String(text == null ? '' : text).split(/([，；·])/).map(function (part) {
      if (/^[，；·]$/.test(part)) return part;
      var bad = /负债|压力|债务|支出|费用/.test(part);
      var m = part.match(/([+\-])(\d[\d,]*(?:\.\d+)?)/);
      if (!m) return esc(part);
      var isGain = m[1] === '+';
      var cls = (bad ? !isGain : isGain) ? 'chg-up' : 'chg-down';
      var token = m[1] + m[2];
      return esc(part).replace(esc(token), '<span class="' + cls + '">' + esc(token) + '</span>');
    }).join('');
  }

  function annotationFor(e) {
    var t = e.tier || 'daily';
    if (t === 'crossroad') {
      return { cls: 'tier-crossroad', text: '命运岔路 · 这一步会埋下多年后的伏笔，结局不会提前说明。' };
    }
    if (t === 'echo') {
      var info = game.echoInfo;
      if (info && info.kind === 'risk') {
        return { cls: 'tier-echo', text: '长期隐患 · ' + (LS.RISK_LABEL[info.riskKey] || '健康透支') + ' 已累积约 ' + (info.years || 1) + ' 年，今天到了兑现的时候。' };
      }
      var years = info ? (info.years || 1) : 1;
      return { cls: 'tier-echo', text: '因果回响 · ' + years + ' 年前的一个选择，在今天有了结果。' };
    }
    return null;
  }

  /* ---------- v3.1 正文强调：首句加重、数值与关键词高亮 ---------- */
  var HILITE_KEYS = /(父亲|母亲|父母|家人|伴侣|妻|夫|孩子|儿子|女儿|子女|婚姻|结婚|离婚|生子|房贷|买房|房子|存款|工资|债|失业|辞职|入职|升职|创业|生意|公司|单位|同事|上司|领导|贵人|朋友|健康|生病|手术|住院|毕业|升学|考试|退休|搬家|老家|城市)/g;
  var NUM_RE = /([+\-＋－]\s*\d+(?:\.\d+)?\s*(?:%|万|元|岁|年|个月|天|次|小时|分|倍)?)|(\d+(?:\.\d+)?\s*(?:%|万|元|岁|年|个月|天|次|小时|分|倍))/g;

  function markKeys(txt) {
    if (!txt) return '';
    var out = '', last = 0, m;
    HILITE_KEYS.lastIndex = 0;
    while ((m = HILITE_KEYS.exec(txt))) {
      out += esc(txt.slice(last, m.index)) + '<em class="hl-key">' + esc(m[0]) + '</em>';
      last = HILITE_KEYS.lastIndex;
    }
    return out + esc(txt.slice(last));
  }

  function emphasisHtml(raw) {
    var t = String(raw || '');
    if (!t) return '';
    var sentences = t.match(/[^。！？\n]+[。！？\n]?/g) || [t];
    var out = '';
    for (var i = 0; i < sentences.length; i++) {
      var s = sentences[i], body = '', last = 0, m;
      NUM_RE.lastIndex = 0;
      while ((m = NUM_RE.exec(s))) {
        body += markKeys(s.slice(last, m.index));
        var num = (m[1] || m[2] || '').trim();
        var dir = '';
        if (/^[+\-＋－]/.test(num)) dir = (num.charAt(0) === '-' || num.charAt(0) === '－') ? ' down' : ' up';
        body += '<em class="hl-num' + dir + '">' + esc(num) + '</em>';
        last = NUM_RE.lastIndex;
      }
      body += markKeys(s.slice(last));
      out += i === 0 ? '<span class="lead">' + body + '</span>' : body;
    }
    return out;
  }

  /* ---------- v3.1 旧日记片段：引用当年原文，缺原文时明确降级 ---------- */
  function shortQuote(raw) {
    var s = String(raw || '').replace(/\s+/g, ' ').trim();
    var m = s.match(/^.{0,72}?(?:[。！？；]|$)/);
    var q = (m ? m[0] : s).replace(/[。！？；]$/, '');
    return s.length > q.length ? q + '…' : q;
  }

  function sourceHtml(e) {
    var info = game.echoInfo;
    if (!info) {
      return '<div class="diary-clip diary-flat"><div class="diary-head">旧页 · 来路不明</div>' +
        '<div class="diary-scene">长期的生活方式与未处理的压力，到了不得不结算的时候。</div></div>';
    }
    var years = info.years || 1;
    var fromYear = game.year - years;
    var fromAge = info.fromAge == null ? Math.max(0, game.age - years) : info.fromAge;
    if (info.kind === 'risk') {
      return '<div class="diary-clip diary-risk">' +
        '<div class="diary-head">旧页 · 健康账本 · 始于 ' + fromYear + ' 年 · ' + fromAge + ' 岁</div>' +
        '<div class="diary-scene">「' + esc(LS.RISK_LABEL[info.riskKey] || '健康透支') + '」已累积约 ' + years + ' 年，今天到了兑现的时候。</div></div>';
    }
    var head = '<div class="diary-head">旧页 · ' + fromYear + ' 年 · ' + fromAge + ' 岁' +
      (info.sourceTitle ? ' · ' + esc(info.sourceTitle) : '') + '</div>';
    var scene = info.sourceText
      ? '<div class="diary-scene">「' + esc(shortQuote(info.sourceText)) + '」</div>'
      : '<div class="diary-missing">旧存档没有留下当年的原句，只记得那个选择。</div>';
    var choice = info.choiceLabel
      ? '<div class="diary-choice">当时你选了「<b>' + esc(info.choiceLabel) + '</b>」</div>'
      : '';
    return '<div class="diary-clip">' + head + scene + choice + '</div>';
  }

  /* ---------- v3.1 人生档案条 ---------- */
  var UNIT_BY_JOB = {
    civil: '机关单位', engineer: '技术公司', doctor: '医院', teacher: '学校',
    stateowned: '国有企业', sales: '销售公司', freelance: '自由职业',
    startup: '自己的公司', gig: '劳务市场'
  };

  function archiveData(g) {
    if (!g) return null;
    var home = '租房';
    if (g.house && g.house.owned) home = (g.house.mortgage > 0 && !g.house.mortgagePaid) ? '按揭房' : '自有';
    else if (g.age < 22) home = '老小区';

    var jobTxt = '待业';
    if (g.job && g.job.id) {
      jobTxt = (g.job.title || LS.jobName(g.job.id)) + ' · ' + (UNIT_BY_JOB[g.job.id] || LS.jobName(g.job.id));
    }

    var married = g.family && g.family.marriage && g.family.marriage.status === '已婚';
    var kids = (g.family && g.family.childrenIds) ? g.family.childrenIds.length : 0;
    var fam = married ? '已婚' : (g.age < 22 ? '未婚 · 与父母同住' : '未婚');
    if (kids > 0) fam += ' · ' + kids + ' 个子女';
    var dad = LS.getNpc && LS.getNpc(g, '父亲');
    var mom = LS.getNpc && LS.getNpc(g, '母亲');
    var pa = [];
    if (dad) pa.push(dad.alive === false ? '父已故' : '父健在');
    if (mom) pa.push(mom.alive === false ? '母已故' : '母健在');
    if (pa.length) fam += ' · ' + pa.join(' / ');

    return {
      city: g.birthplace || '—',
      home: home,
      job: jobTxt,
      family: fam
    };
  }

  function paintArchive() {
    var el = $('lifeArchive');
    if (!el || !game) return;
    var d = archiveData(game);
    if (!d) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML =
      '<span class="la-label">人生档案</span>' +
      '<span class="la-item la-city"><i>城市</i>' + esc(d.city) + '</span>' +
      '<span class="la-item la-home"><i>住所</i>' + esc(d.home) + '</span>' +
      '<span class="la-item la-job"><i>职业</i>' + esc(d.job) + '</span>' +
      '<span class="la-item la-family"><i>家庭</i>' + esc(d.family) + '</span>';
  }

  /* ---------------- v3.2 社交行动条 ---------------- */
  var socialTargetId = null;
  var relOpenCircles = null;

  function npcStageKey(n) {
    var a = Number(n && n.age);
    if (!isFinite(a)) a = 30;
    if (a <= 3) return 'infant';
    if (a <= 12) return 'child';
    if (a <= 18) return 'teen';
    if (a <= 30) return 'youth';
    if (a <= 55) return 'midlife';
    if (a <= 75) return 'elder';
    return 'late';
  }

  function avatarHtml(n) {
    var art = '';
    try { art = (LS.artPortrait && n) ? LS.artPortrait(n.gender || '其他', npcStageKey(n), '', game && game.seed) : ''; } catch (e) { art = ''; }
    if (art) return '<span class="npc-avatar">' + art + '</span>';
    var ch = String((n && (n.name || n.role)) || '?').charAt(0);
    return '<span class="npc-avatar letter">' + esc(ch) + '</span>';
  }

  function socialTarget() {
    if (!game || !game.npcs) return null;
    var list = game.npcs.filter(function (n) { return n && n.alive; });
    if (!list.length) return null;
    if (socialTargetId) {
      for (var i = 0; i < list.length; i++) if (list[i].id === socialTargetId) return list[i];
    }
    list.sort(function (a, b) {
      var ia = Number(a.intimacy) || 0, ib = Number(b.intimacy) || 0;
      if (ia !== ib) return ib - ia;
      var la = Number(a.lastContactYear), lb = Number(b.lastContactYear);
      if (isNaN(la)) la = -99;
      if (isNaN(lb)) lb = -99;
      return lb - la;
    });
    return list[0];
  }

  function socialApi() {
    /* 实际实现在 social.js 里挂到 LS.SOCIAL；兼容 LS.social 别名 */
    return LS.social || LS.SOCIAL || null;
  }

  function paintSocialBar() {
    var el = $('socialBar');
    if (!el || !game) return;
    var api = socialApi();
    var q = (api && api.quota) ? api.quota(game) : { used: 0, max: 1, left: 1 };
    var npc = socialTarget();
    var over = q.left <= 0;
    var acts = (LS.SOCIAL && LS.SOCIAL.ACTIONS) || {};
    var keys = ['陪', '送礼', '帮忙', '借钱', '介绍'].filter(function (k) { return !!acts[k]; });
    var btns = keys.map(function (k) {
      return '<button type="button" class="mini-act' + (over ? ' over' : '') + '" data-sa="' + esc(k) + '">' +
        esc(acts[k].label || k) + '</button>';
    }).join('');
    el.innerHTML =
      '<div class="social-head">' +
      '<span class="social-chip"><i>社交名额</i> 已用 ' + q.used + ' / ' + q.max + '</span>' +
      (npc
        ? '<span class="social-target">对象：' + esc(npc.name) + '（' + esc(npc.relation || LS.relationOf(npc)) + '）</span>'
        : '<span class="social-target muted">暂时没有可走动的人</span>') +
      '<button type="button" class="mini-act pick" id="btnSocialTarget">换人</button>' +
      '</div>' +
      '<div class="social-actions">' + btns + '</div>' +
      (over ? '<div class="social-tip">今年已用尽，硬做要付出时间/金钱/健康的代价。</div>' : '');
    var pick = $('btnSocialTarget');
    if (pick) pick.addEventListener('click', openSocialTargetPicker);
    var btnsEl = el.querySelectorAll('[data-sa]');
    for (var i = 0; i < btnsEl.length; i++) {
      (function (b) {
        b.addEventListener('click', function () { doSocialAct(b.dataset.sa); });
      })(btnsEl[i]);
    }
  }

  function doSocialAct(key) {
    if (!game || game.death.dead) return;
    var npc = socialTarget();
    if (!npc) { showToast('身边暂时没有可以走动的人。'); return; }
    var api = socialApi();
    if (!api || !api.act) { showToast('社交系统未载入。'); return; }
    /* 兼容旧存档：npcArc 条目可能只带 stage 而没有 nodes，社交动作会写锚点 */
    game.npcArc = game.npcArc || {};
    game.npcArc[npc.id] = game.npcArc[npc.id] || { nodes: [] };
    if (!game.npcArc[npc.id].nodes) game.npcArc[npc.id].nodes = [];
    var r = api.act(game, npc.id, key);
    if (!r || !r.ok) { showToast((r && r.msg) || '社交没有成功。'); return; }
    LS.save.autoSave(game);
    showToast(r.msg);
    renderGame();
  }

  function openSocialTargetPicker() {
    if (!game) return;
    var list = (game.npcs || []).filter(function (n) { return n && n.alive; });
    list.sort(function (a, b) { return (Number(b.intimacy) || 0) - (Number(a.intimacy) || 0); });
    var cur = socialTarget();
    if (!list.length) {
      openModal('选择社交对象', '<div class="empty-note">身边暂时没有可以走动的人。</div>');
      return;
    }
    openModal('选择社交对象',
      '<div class="target-list">' + list.map(function (n) {
        var on = cur && cur.id === n.id;
        var rel = n.relation || LS.relationOf(n);
        return '<button type="button" class="target-row' + (on ? ' on' : '') + '" data-tid="' + esc(n.id) + '">' +
          avatarHtml(n) +
          '<span class="target-name">' + esc(n.name) + '</span>' +
          '<span class="target-rel">' + esc(rel) + '</span>' +
          '<span class="target-int">' + Math.round(LS.clamp(Number(n.intimacy) || 0, 0, 100)) + '</span></button>';
      }).join('') + '</div>');
    var rows = $('modalBody').querySelectorAll('[data-tid]');
    for (var i = 0; i < rows.length; i++) {
      (function (b) {
        b.addEventListener('click', function () {
          socialTargetId = b.dataset.tid;
          closeModal();
          paintSocialBar();
        });
      })(rows[i]);
    }
  }

  /* ---------------- v3.2 人物卡关系面板 ---------------- */
  var REL_CLS = {
    '陌生': 'rel-stage-0', '相识': 'rel-stage-1', '熟络': 'rel-stage-2', '亲近': 'rel-stage-3',
    '至亲': 'rel-stage-4', '疏远': 'rel-stage-5', '决裂': 'rel-stage-6'
  };
  var REL_DEFAULT_OPEN = 2;

  function npcRelationOf(n) {
    return n.relation || (LS.relationOf ? LS.relationOf(n) : '陌生');
  }
  function relStageCls(n) {
    return REL_CLS[npcRelationOf(n)] || 'rel-stage-0';
  }
  function favorText(f) {
    f = Number(f) || 0;
    if (f > 0) return { cls: 'favor-pos', text: '他欠你' };
    if (f < 0) return { cls: 'favor-neg', text: '你欠他' };
    return { cls: 'favor-zero', text: '人情两清' };
  }
  function lastAnchorOf(n) {
    var a = (n.anchors || [])[n.anchors.length - 1];
    if (a && a.text) return a;
    var arc = (game && game.npcArc && game.npcArc[n.id] && game.npcArc[n.id].nodes) || [];
    return arc.length ? arc[arc.length - 1] : null;
  }

  function relRow(n) {
    var rel = npcRelationOf(n);
    var fv = favorText(n.favor);
    var intimacy = Math.round(LS.clamp(Number(n.intimacy) || 0, 0, 100));
    var a = lastAnchorOf(n);
    var anchor = a ? String(a.text) : '还没有留下值得记住的事。';
    if (anchor.length > 34) anchor = anchor.slice(0, 34) + '…';
    return '<button type="button" class="rel-row ' + relStageCls(n) + '" data-nid="' + esc(n.id) + '">' +
      avatarHtml(n) +
      '<span class="rel-main">' +
      '<span class="rel-name">' + esc(n.name || n.role) + '<i class="rel-role">' + esc(n.role || '') + '</i></span>' +
      '<span class="rel-line"><span class="rel-stage">' + esc(rel) + '</span>' +
      '<span class="rel-favor ' + fv.cls + '">' + fv.text + '</span>' +
      '<span class="rel-int">' + intimacy + '</span></span>' +
      '<span class="rel-bar"><i style="width:' + intimacy + '%"></i></span>' +
      '<span class="rel-anchor">' + esc(anchor) + '</span>' +
      '</span></button>';
  }

  function openRelationModal() {
    if (!game) return;
    var alive = (game.npcs || []).filter(function (n) { return n && n.alive; });
    if (!alive.length) {
      openModal('人物关系', '<div class="empty-note">身边暂时没有还在联系的人。</div>');
      return;
    }
    if (!relOpenCircles) {
      relOpenCircles = {};
      for (var d = 0; d < Math.min(REL_DEFAULT_OPEN, LS.CIRCLES.length); d++) relOpenCircles[LS.CIRCLES[d]] = true;
    }
    var cap = window.innerHeight <= 800 ? 4 : 5;
    var shown = 0;
    var html = '';
    for (var gi = 0; gi < LS.CIRCLES.length; gi++) {
      var circle = LS.CIRCLES[gi];
      var list = alive.filter(function (n) { return (n.circle || LS.circleOf(n.role)) === circle; });
      list.sort(function (a, b) { return (Number(b.intimacy) || 0) - (Number(a.intimacy) || 0); });
      var open = !!relOpenCircles[circle];
      var rowsHtml = '';
      var more = 0;
      if (open) {
        for (var i = 0; i < list.length; i++) {
          if (shown >= cap) { more++; continue; }
          shown++;
          rowsHtml += relRow(list[i]);
        }
      } else {
        more = list.length;
      }
      html += '<div class="rel-group' + (open ? ' open' : '') + '">' +
        '<button type="button" class="rel-group-head" data-gcircle="' + esc(circle) + '">' +
        '<span class="rel-group-name">' + esc(circle) + '</span>' +
        '<span class="rel-group-rep">声望 ' + Math.round(LS.circleRep(game, circle)) + '</span>' +
        '<span class="rel-group-count">' + list.length + ' 人</span>' +
        '<span class="rel-group-arrow">' + (open ? '▾' : '▸') + '</span></button>' +
        '<div class="rel-group-body">' +
        (open
          ? (rowsHtml || '<div class="recap-empty">这个圈子里还没有人。</div>') +
            (more ? '<div class="rel-more">还有 ' + more + ' 人</div>' : '')
          : (more ? '<div class="rel-more">还有 ' + more + ' 人</div>' : '')) +
        '</div></div>';
    }
    var dots = (LS.LINES && LS.LINES.grayDots) ? LS.LINES.grayDots(game) : [];
    var grayHtml = '';
    if (dots.length) {
      grayHtml = '<div class="rel-gray">' + dots.map(function (d) {
        return '<span class="rel-gray-dot" title="未解开的线索"><i>?</i>' + esc(d.type) + '</span>';
      }).join('') + '</div>';
    }
    openModal('人物关系 · ' + alive.length + ' 人', grayHtml + '<div class="rel-list">' + html + '</div>');
    var body = $('modalBody');
    var rows = body.querySelectorAll('[data-nid]');
    for (var r = 0; r < rows.length; r++) {
      (function (btn) {
        btn.addEventListener('click', function () { openNpcHistory(btn.dataset.nid); });
      })(rows[r]);
    }
    var heads = body.querySelectorAll('[data-gcircle]');
    for (var h = 0; h < heads.length; h++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var c = btn.dataset.gcircle;
          relOpenCircles[c] = !relOpenCircles[c];
          openRelationModal();
        });
      })(heads[h]);
    }
  }

  function openNpcHistory(npcId) {
    if (!game) return;
    var n = null;
    for (var i = 0; i < (game.npcs || []).length; i++) {
      if (game.npcs[i].id === npcId) { n = game.npcs[i]; break; }
    }
    if (!n) return;
    var nodes = [];
    var arc = (game.npcArc && game.npcArc[n.id] && game.npcArc[n.id].nodes) || [];
    for (var j = 0; j < arc.length; j++) {
      if (arc[j] && arc[j].text) nodes.push({ year: arc[j].year, kind: arc[j].kind, text: arc[j].text });
    }
    for (var k = 0; k < (n.anchors || []).length; k++) {
      var a = n.anchors[k];
      if (a && a.text) nodes.push({ year: a.year, kind: a.kind, text: a.text });
    }
    var merged = [], seen = {};
    nodes.sort(function (x, y) { return (Number(x.year) || 0) - (Number(y.year) || 0); });
    for (var m = 0; m < nodes.length; m++) {
      var key = String(nodes[m].year) + '|' + String(nodes[m].text);
      if (seen[key]) continue;
      seen[key] = true;
      merged.push(nodes[m]);
    }
    var rel = npcRelationOf(n);
    var fv = favorText(n.favor);
    var timeline = merged.length
      ? '<div class="rel-timeline">' + merged.map(function (x) {
        return '<div class="rel-tl-item"><div class="rel-tl-year">' + esc(x.year) + ' 年</div>' +
          '<div class="rel-tl-text">' + esc(x.text) + '</div></div>';
      }).join('') + '</div>'
      : '<div class="empty-note">还没有留下可追溯的记录。</div>';
    var np = (game.promises || []).filter(function (p) {
      return (p.npcId && p.npcId === n.id) || (p.npcRole && p.npcRole === n.role);
    });
    var promiseBlock = np.length
      ? '<div class="npc-promises"><div class="npc-promise-head">与你有关的承诺</div>' + promiseRowsHtml(np) + '</div>'
      : '';
    openModal(n.name + ' · 关系履历',
      '<div class="npc-his-head">' + avatarHtml(n) +
      '<span class="npc-his-info"><b>' + esc(n.name) + '</b>' +
      '<span class="rel-stage ' + relStageCls(n) + '">' + esc(rel) + '</span>' +
      '<span class="rel-favor ' + fv.cls + '">' + fv.text + '</span>' +
      '<span class="rel-int">亲密度 ' + Math.round(LS.clamp(Number(n.intimacy) || 0, 0, 100)) + '</span></span></div>' +
      '<button type="button" class="btn tiny" id="btnBackRelation">返回人物卡</button>' +
      promiseBlock + timeline);
    var back = $('btnBackRelation');
    if (back) back.addEventListener('click', openRelationModal);
    var pbtns = $('modalBody').querySelectorAll('[data-pid]');
    for (var pb = 0; pb < pbtns.length; pb++) {
      (function (btn) {
        btn.addEventListener('click', function () { openPromiseLedger(btn.dataset.pid); });
      })(pbtns[pb]);
    }
  }

  /* 结局页“还在你身边的人”：按锚点写一句评价，不显示数字 */
  function endSurvivorsHtml() {
    var SURV_LINE = {
      '至亲': '一直站在你这边，从没走远。',
      '亲近': '这些年常来常往，说话不用绕弯。',
      '熟络': '偶尔见面，还能说上几句真话。',
      '相识': '见面点头，各自过各自的日子。',
      '疏远': '后来慢慢就不联系了。',
      '决裂': '到底没能和解。',
      '陌生': '只是彼此认得。'
    };
    var list = (game.npcs || []).filter(function (n) {
      return n && n.alive && (Number(n.intimacy) || 0) >= 45;
    });
    list.sort(function (a, b) { return (Number(b.intimacy) || 0) - (Number(a.intimacy) || 0); });
    list = list.slice(0, 8);
    if (!list.length) return '<div class="empty-note">最后，身边没有留下什么人。</div>';
    return list.map(function (n) {
      var rel = npcRelationOf(n);
      var a = lastAnchorOf(n);
      var quote = a && a.text
        ? String(a.text).replace(/[0-9０-９]/g, '').replace(/^\s*年/, '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '')
        : '';
      if (!quote) quote = SURV_LINE[rel] || '你们之间，只剩下一些旧事可说。';
      return '<div class="survivor-row"><span class="sv-name">' + esc(n.name || n.role) + '</span>' +
        '<span class="sv-role">' + esc(n.role || '') + '</span>' +
        '<span class="sv-stage">' + esc(rel) + '</span>' +
        '<span class="sv-quote">' + esc(quote) + '</span></div>';
    }).join('');
  }

  /* ---------- v3.1 在场者头像与关系温度 ---------- */
  function relationTier(n) {
    var f = Number(n.favor);
    if (isNaN(f)) f = 50;
    if (f >= 75) return { cls: 'kinship', label: '至亲' };
    if (f >= 50) return { cls: 'close', label: '亲密' };
    if (f >= 25) return { cls: 'known', label: '相识' };
    return { cls: 'stranger', label: '陌生' };
  }

  function castOf(e) {
    if (!game) return [];
    var text = [e && e.title, e && e.text].join(' ') + ' ' +
      ((e && (e.options || e.opts)) || []).map(function (o) { return o.label || ''; }).join(' ');
    var out = [];
    (game.npcs || []).forEach(function (n) {
      if (n.role !== '父亲' && n.role !== '母亲' && n.role !== '配偶' && n.role !== '子女') return;
      if (n.role === '子女' && out.filter(function (x) { return x.npc.role === '子女'; }).length >= 1) return;
      var key = n.role;
      var hit = false;
      if (n.role === '父亲') hit = /父|爸/.test(text);
      else if (n.role === '母亲') hit = /母|妈/.test(text);
      else if (n.role === '配偶') hit = /配偶|伴侣|妻|夫|老婆|老公|爱人|婚/.test(text);
      else hit = /孩子|儿子|女儿|子女|娃|上学|出生/.test(text) || (n.name && text.indexOf(n.name) >= 0);
      out.push({ npc: n, present: hit });
    });
    if (!out.length) return out;
    var jobMention = /同事|公司|单位|会议|项目|加班|办公/.test(text);
    if (game.job && game.job.id && jobMention) {
      out.push({
        npc: { name: /上司|领导|老板|主管/.test(text) ? '上司' : '同事', role: '同事', gender: '其他', age: game.age, favor: 50, alive: true },
        present: true, extra: true
      });
    }
    out.sort(function (a, b) { return (b.present ? 1 : 0) - (a.present ? 1 : 0); });
    var cap = (window.innerHeight <= 740) ? 4 : 5;
    return out.slice(0, cap);
  }

  function paintCast(e) {
    var el = $('evCast');
    if (!el) return;
    var list = castOf(e);
    if (!list.length) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = '<div class="cast-title">在场者</div>' + list.map(function (c) {
      var n = c.npc;
      var stage = LS.stageOf ? LS.stageOf(n.age) : 'midlife';
      var art = LS.artPortrait(n.gender || '其他', stage, '', game && game.seed);
      if (!art) art = LS.artPortrait(n.gender || '其他', 'youth', '', game && game.seed);
      var tier = relationTier(n);
      var short = n.role === '父亲' ? '父' : n.role === '母亲' ? '母' : n.role === '配偶' ? '伴侣' : n.role === '子女' ? '孩子' : (n.name || n.role);
      var dead = n.alive === false;
      var life = '';
      if (dead && n.deathYear && n.age) {
        life = '<span class="cast-life">' + (n.deathYear - Math.round(n.age)) + '–' + n.deathYear + '</span>';
      }
      var cls = 'cast-item rel-' + tier.cls + (c.present ? ' present' : ' absent') + (dead ? ' dead' : '');
      return '<div class="' + cls + '" title="' + esc(short + ' · ' + tier.label) + '">' +
        '<div class="cast-avatar">' + art + '</div>' +
        '<div class="cast-name">' + esc(short) + '</div>' +
        '<div class="cast-rel">' + (dead ? '已故' : tier.label) + '</div>' + life + '</div>';
    }).join('');
  }

  /* 事件 → 场景插图：优先显式 art 键，其次按标题/正文语义匹配 */
  function sceneKeyOf(e) {
    if (e && e.art && LS.artHas(e.art)) return e.art;
    /* v3.3：固定映射表优先，保证同一事件永远配同一张图 */
    if (LS.sceneKeyForEvent) {
      var mapped = LS.sceneKeyForEvent(e);
      if (mapped && LS.artHas(mapped)) return mapped;
    }
    var t = ((e && e.id) || '') + ' ' + ((e && e.title) || '') + ' ' + ((e && e.text) || '');
    if (/结婚|婚礼|求婚|领证|嫁|娶/.test(t)) return 'wedding';
    if (/生子|怀孕|产房|要孩子|生孩子|二胎|出生/.test(t)) return 'nursery';
    if (/买房|首付|房贷|有了自己的房/.test(t)) return 'house';
    if (/搬家|搬走|退租|离开这座/.test(t)) return 'emptyHome';
    if (/手术|住院|重病|癌症|病危|生病|体检/.test(t)) return 'clinic';
    if (/去世|离世|葬礼|丧|临终|走了/.test(t)) return 'grave';
    if (/创业|开店|生意|自己当老板/.test(t)) return 'money';
    if (/失业|裁员|被裁|下岗|辞退/.test(t)) return 'emptyDesk';
    if (/入职|升职|录用|Offer|offer|上班|跳槽/.test(t)) return 'office';
    if (/毕业|高考|考研|升学|录取|大学/.test(t)) return 'exam';
    if (/求职|面试|招聘|找工作/.test(t)) return 'jobfair';
    if (/钱|债|存款|工资|收入|奖金/.test(t)) return 'money';
    if (/特长|天赋|爱好|梦想|灵感/.test(t)) return 'spark';
    return '';
  }

  /* 平淡年合并提示：事件正文上方一行弱化文字 */
  function paintQuietNote(e) {
    var note = (e && e.quietNote) || (game && game.quietNote) || '';
    var panel = $('storyPanel');
    var text = $('storyText');
    if (!panel || !text) return;
    var el = $('quietNote');
    if (!el) {
      el = document.createElement('div');
      el.id = 'quietNote';
      el.className = 'quiet-note';
      var host = text.parentNode || panel;
      host.insertBefore(el, text);
    }
    if (note) {
      var t = String(note)
        .replace(/^这\s*\d+\s*年/, '这几年')
        .replace(/^又过了\s*\d+\s*年/, '这几年')
        .replace(/^平淡的\s*\d+\s*年/, '这几年');
      el.hidden = false;
      el.textContent = /^这几年/.test(t) ? t : '这几年，' + t;
    } else {
      el.hidden = true;
      el.textContent = '';
    }
  }

  var RISK_META = {
    low: { cls: 'low', text: '低' },
    mid: { cls: 'mid', text: '中' },
    high: { cls: 'high', text: '高' }
  };

  /* ---------- v3.4 事件档位展示：回响再分负面 / 馈赠 ---------- */
  function echoIsGift(e) {
    var kind = String((e && e.kind) || (game && game.echoInfo && game.echoInfo.kind) || '').toLowerCase();
    if (/gift|good|joy|win|reward|bless|positive/.test(kind)) return true;
    if (/risk|neg|bad|loss|ill|debt/.test(kind)) return false;
    var title = String((e && e.title) || '');
    if (/馈赠|回报|好事|如愿|善意|礼物|相助|团圆|中奖|升职|康复|录取/.test(title)) return true;
    if (/恶化|复发|透支|病|丧|失去|失败|拖累|债务/.test(title)) return false;
    return false;
  }

  function eventTierInfo(e) {
    var t = LS.tierOf(e);
    if (e && e.tier === 'echo') {
      var gift = echoIsGift(e);
      return gift
        ? { cls: 'tier-echo tier-echo-gift', label: '回响·馈赠', iconKey: 'echo' }
        : { cls: 'tier-echo tier-echo-neg', label: '回响·负面', iconKey: 'echo' };
    }
    if (e && e.tier === 'crossroad') {
      return { cls: 'tier-crossroad tier-cross', label: '岔路', iconKey: 'crossroad' };
    }
    return { cls: 'tier-daily', label: '日常', iconKey: 'daily' };
  }

  /* ---------- v3.4 选项行首 emoji：按 tone / 文案 / 结果倾向 ---------- */
  function optionEmoji(opt, e) {
    var o = opt || {};
    var s = String((o.label || '') + ' ' + (o.hint || '') + ' ' + (o.tag || ''));
    if (o.tone === 'risk' || o.gamble) return '⚠️';
    if (/风险|冒险|赌|透支|硬撑|冲动/.test(s)) return '⚠️';
    if (o.money) return '💰';
    if (/钱|工资|存款|薪|奖金|买|投资|债|亏|赚|首付|彩票|中奖/.test(s)) return '💰';
    if (o.at && o.at.health) return '❤️';
    if (/病|医|手术|体检|药|健康|住院|受伤|失眠/.test(s)) return '🩺';
    if (/睡|休息|运动|锻炼|康复|散步/.test(s)) return '❤️';
    if (o.at && o.at.knowledge) return '📘';
    if (/考|学|读|书|论文|升学|毕业|课|作业/.test(s)) return '📘';
    if (/工作|上班|加班|辞职|跳槽|求职|面试|创业|项目|领导|同事|裁员/.test(s)) return '💼';
    if (/孩子|父母|家人|结婚|婚|妻|夫|伴侣|家庭|回家|亲戚/.test(s)) return '🏠';
    if (/陪|安慰|道歉|和解|照顾|探望|表白|情书|喜欢|拥抱|写信/.test(s)) return '💗';
    if (/等|再|推迟|以后|忍|拖|搁置/.test(s)) return '⏳';
    return '·';
  }

  function paintEvent(e) {
    var t = LS.tierOf(e);
    var ti = eventTierInfo(e);
    var et = $('eventType');
    et.innerHTML = emojiSpan('tier', ti.iconKey, 'tier-emoji', t.icon) + esc(ti.label);
    et.className = 'event-type tier-tag ' + ti.cls;
    $('turnNo').textContent = '第 ' + game.turn + ' 回合 · ' + LS.stageLabel(game.stage);
    var titleEmoji = icon('event', LS.iconCatOf ? LS.iconCatOf(e) : 'cross', '');
    $('eventTitle').innerHTML = (titleEmoji ? '<span class="emoji ev-title-emoji" aria-hidden="true">' + esc(titleEmoji) + '</span> ' : '') +
      esc(tpl(e.title));
    $('eventTitle').className = 'tier-title ' + ti.cls;
    var rawText = tpl(LS.V35 ? LS.V35.textOf(game, e) : e.text);
    var bodyEmoji = '';
    if (LS.iconCatOf) {
      var bodyCat = LS.iconCatOf({ text: rawText });
      var cand = icon('event', bodyCat, '');
      if (cand && cand !== titleEmoji) bodyEmoji = cand;
    }
    $('storyText').innerHTML = (bodyEmoji
      ? '<span class="emoji story-emoji" aria-hidden="true">' + esc(bodyEmoji) + '</span> ' : '') +
      emphasisHtml(rawText);
    paintQuietNote(e);
    var sp = $('storyPanel');
    sp.className = 'story ev-card ' + ti.cls;
    void sp.offsetWidth;
    sp.classList.add('ev-fade');

    var lo = game.lastOutcome;
    if (lo && lo.text) {
      $('lastOutcome').hidden = false;
      $('lastOutcome').innerHTML = '<b>上一年：' + esc(lo.title) + '</b>　' + changeTone(lo.text);
      $('lastOutcome').className = 'outcome ' + (lo.tier === 'echo' ? 'tier-echo' : (lo.tier === 'crossroad' ? 'tier-crossroad' : ''));
    } else {
      $('lastOutcome').hidden = true;
      $('lastOutcome').innerHTML = '';
    }

    /* 插图：按事件语义匹配场景（结婚/生子/失业/买房/重病/毕业等），无匹配则不显示 */
    var artKey = sceneKeyOf(e);
    if (artKey && LS.artHas(artKey)) {
      $('evArt').hidden = false;
      $('evArt').innerHTML = LS.artScene(artKey) || LS.artEvent(artKey);
      $('evArt').className = 'ev-art ' + t.cls;
    } else {
      $('evArt').hidden = true;
      $('evArt').innerHTML = '';
    }
    paintCast(e);
    paintArchive();

    /* 溯源条：只有因果回响必须有 */
    var sb = $('sourceBar');
    if (e.tier === 'echo') {
      sb.hidden = false;
      sb.innerHTML = sourceHtml(e);
      sb.className = 'source-bar tier-echo';
      /* 轻微高亮：先移除再添加，保证每回合都能触发一次 */
      sb.classList.remove('flash');
      void sb.offsetWidth;
      sb.classList.add('flash');
    } else {
      sb.hidden = true;
      sb.innerHTML = '';
      sb.className = 'source-bar';
    }

    /* 状态栏下方动态批注：仅因果回响/命运岔路 */
    var anno = annotationFor(e);
    if (anno) {
      $('annotationBar').hidden = false;
      $('annotationBar').className = 'annotation-bar ' + anno.cls;
      $('annotationBar').textContent = anno.text;
    } else {
      $('annotationBar').hidden = true;
      $('annotationBar').className = 'annotation-bar';
      $('annotationBar').textContent = '';
    }

    var opts = $('options');
    opts.innerHTML = '';
    opts.className = 'options ' + ti.cls;
    var shown = [];
    e.opts.forEach(function (opt, i) {
      if (LS.V35 && LS.V35.optOk && !LS.V35.optOk(game, opt)) return;
      shown.push({ opt: opt, i: i });
    });
    /* v3.5：过滤后至少保留一个选项；全部被过滤才回退全量，
       避免把已故/不存在亲属的选项又放回界面。 */
    if (!shown.length) {
      shown = e.opts.map(function (opt, i) { return { opt: opt, i: i }; });
    }
    shown.forEach(function (pair, k) {
      var opt = pair.opt, i = pair.i;
      var b = document.createElement('button');
      b.type = 'button';
      var toneCls = '';
      if (e.tier === 'crossroad') toneCls = ' tone-' + (opt.tone || (opt.gamble ? 'risk' : 'safe'));
      else if (e.tier === 'echo') toneCls = ' echo-opt';
      b.className = 'opt-btn opt-in' + toneCls + (opt.fuzzy ? ' opt-fuzzy' : '');
      b.style.animationDelay = (k * 70) + 'ms';
      var rk = opt.risk && RISK_META[opt.risk];
      var hardWarn = (Number(game.attrs.happiness) < 40 && LS.isHardOpt && LS.isHardOpt(opt))
        ? '<span class="opt-warn">心情低落，这类事更难撑下来</span>' : '';
      b.innerHTML = '<span class="emoji opt-emoji" aria-hidden="true">' + esc(optionEmoji(opt, e)) + '</span>' +
        '<span class="opt-main" style="flex:1 1 0;min-width:0">' +
        (rk ? '<span class="risk-badge ' + rk.cls + '">' + rk.text + '</span>' : '') +
        esc(tpl(opt.label)) + (opt.hint ? '<span class="opt-cost' + (opt.fuzzy ? ' opt-fuzzy-hint' : '') + '">' + esc(tpl(opt.hint)) + '</span>' : '') +
        hardWarn + '</span>' +
        '<span class="opt-arrow">›</span>';
      b.addEventListener('click', function () { onChoose(i); });
      opts.appendChild(b);
    });

    $('storyPanel').scrollTop = 0;
    paintMood();
    if (DEBUG_MODE) buildDebugPanel();
  }

  function renderGame() {
    if (!game) return;
    if (game.death.dead) { renderEnd(); return; }

    $('sbTime').textContent = game.year + ' 年';
    $('sbAge').textContent = game.age + ' 岁';
    $('sbStage').textContent = stageBarText();
    $('sbAttrs').innerHTML = chips();
    paintMood();
    paintSbMoney();
    paintArchive();
    paintSocialBar();

    /* 未确认的阶段总结与阶段过场合并为一次遮罩 */
    if (game.pendingSummary) {
      if (game.pendingStage) { showStageOverlay(game.pendingStage, false, game.stageSummary); return; }
      showStageSummary(game.stageSummary);
      return;
    }

    /* 未确认的阶段过场优先，暂停一切事件推进 */
    if (game.pendingStage) { showStageOverlay(game.pendingStage); return; }

    if (!game.current) LS.engine.nextEvent(game);

    var e = game.current;
    if (!e) {
      var calmEmoji = icon('event', 'daily', '🍃');
      $('eventTitle').innerHTML = '<span class="emoji ev-title-emoji" aria-hidden="true">' + esc(calmEmoji) + '</span> 这一年无事发生';
      $('storyText').textContent = '没有新的节点，也没有意外。日子按原来的样子继续。';
      $('eventType').innerHTML = emojiSpan('tier', 'daily', 'tier-emoji', '🍃') + '日常';
      $('eventType').className = 'event-type tier-tag tier-daily';
      $('eventTitle').className = 'tier-title tier-daily';
      $('turnNo').textContent = '第 ' + game.turn + ' 回合';
      $('options').innerHTML = '';
      $('options').className = 'options';
      $('sourceBar').hidden = true;
      $('evArt').hidden = true;
      $('evCast').hidden = true;
      $('evCast').innerHTML = '';
      $('annotationBar').hidden = true;
      $('storyPanel').className = 'story ev-card tier-daily';
      paintQuietNote(null);
      paintMood();
      return;
    }

    /* 命运岔路：先遮罩过场，首次展示后标记，点“继续”才进入选择 */
    if (e.tier === 'crossroad') {
      var key = game.crossGate || (e.id + '@' + game.age);
      game.crossGate = key;
      if (!(game.crossSeen || {})[key]) {
        /* v3.2：18 岁前或本回合已有遮罩时，不弹遮罩，降级为普通岔路 */
        var gateOff = (game.age <= 18) || (game.blockedTurn === game.turn) || blockerTaken();
        if (gateOff) {
          game.crossSeen = game.crossSeen || {};
          game.crossSeen[key] = true;
        } else {
          paintEvent(e);           /* 先让标题/标签与过场内容一致，再清空选项并遮罩 */
          showCrossGate(e, key);
          return;
        }
      }
    }

    paintEvent(e);
  }

  /* 选项区上方浮字：按 changes 字符串拆条，1.6 秒淡出，不阻塞点击 */
  function showDeltaFloat(text) {
    if (!text) return;
    var wrap = $('optionsWrap');
    if (!wrap) return;
    var parts = String(text).split(/[，,、]/);
    var items = '';
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].replace(/[（）()]/g, '').replace(/^\s+|\s+$/g, '');
      if (!p) continue;
      var m = p.match(/([+\-])\s*(\d[\d,]*(?:\.\d+)?)/);
      if (!m) continue;
      var plus = m[1] === '+';
      var bad = /负债|债务|压力|支出|费用|亏损/.test(p);
      var up = bad ? !plus : plus;
      items += '<span class="delta-item ' + (up ? 'up' : 'down') + '">' + esc(p) + '</span>';
    }
    if (!items) return;
    var el = document.createElement('div');
    el.className = 'delta-float';
    el.innerHTML = items;
    wrap.appendChild(el);
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 1700);
  }

  function onChoose(index) {
    if (!game || game.death.dead) return;
    var buttons = $('options').querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) buttons[i].disabled = true;

    var r = LS.engine.resolve(game, index);
    if (!r.ok) {
      openModal('无法推进', '<p class="empty-note">' + esc(r.error || '发生未知错误') + '</p>');
      return;
    }
    showDeltaFloat(r.changes);
    LS.save.autoSave(game);
    handleResult(r);
  }

  function openDetail() {
    if (!game) return;
    var a = game.attrs;
    var stressCause = [];
    if (game.job.id) stressCause.push('岗位压力（' + LS.jobName(game.job.id) + '）');
    if (game.money.debt > 0) stressCause.push('负债 ' + LS.fmtMoney(game.money.debt));
    if (game.family.childrenIds.length) stressCause.push('养育子女');
    if (game.family.marriage.status === '已婚') stressCause.push('家庭相处');
    if (!stressCause.length) stressCause.push('生活基本平稳');

    var npcRows = game.npcs.map(function (n) {
      return '<div class="npc-row"><span class="npc-role">' + esc(n.role) + '</span>' +
        '<span class="npc-meta">' + esc(n.name) + ' · ' + (n.alive ? n.age + ' 岁 · 健康 ' + Math.round(n.health) : '已故') + '</span>' +
        '<span class="npc-favor">好感 ' + (n.alive ? Math.round(n.favor) : '—') + '</span></div>';
    }).join('');

    var html =
      '<div class="detail-grid">' +
      '<div class="detail-block"><h4>六项属性</h4>' +
      barRow('学识', a.knowledge, '') + barRow('健康', a.health, a.health < 35 ? 'danger' : '') +
      barRow('财富相关', a.finance, '') + barRow('魅力', a.charm, '') +
      barRow('幸福感', a.happiness, a.happiness < 35 ? 'danger' : '') +
      barRow('声望', LS.repTotal(game), '') +
      '</div>' +
      '<div class="detail-block"><h4>压力（隐藏值）</h4>' +
      barRow('压力', a.stress, a.stress > 70 ? 'danger' : (a.stress > 50 ? 'warn' : '')) +
      '<div class="kv"><span>主要来源</span><span>' + esc(stressCause.join('、')) + '</span></div>' +
      '<div class="kv"><span>现金</span><span>' + esc(LS.fmtMoney(game.money.cash)) + '</span></div>' +
      '<div class="kv"><span>固定资产</span><span>' + esc(LS.fmtMoney(game.money.assets)) + '</span></div>' +
      '<div class="kv"><span>负债</span><span>' + esc(LS.fmtMoney(game.money.debt)) + '</span></div>' +
      '<div class="kv"><span>净资产</span><span>' + esc(LS.fmtMoney(LS.netWorth(game))) + '</span></div>' +
      '</div>' +
      '<div class="detail-block"><h4>学历与职业</h4>' +
      '<div class="kv"><span>学历</span><span>' + esc(LS.eduName(game.edu.level)) + '</span></div>' +
      '<div class="kv"><span>岗位</span><span>' + esc(game.job.id ? LS.jobName(game.job.id) + ' · ' + game.job.title : (game.marks.retired ? '已退休' : '待业')) + '</span></div>' +
      '<div class="kv"><span>岗位标签</span><span>' + (game.job.tags ? esc('薪资 ' + game.job.tags.payBand + ' · 加班 ' + game.job.tags.overtime + ' · 健康消耗 ' + game.job.tags.healthCost + ' · 晋升 ' + game.job.tags.promo + ' · 行业 ' + game.job.tags.cycle) : '—') + '</span></div>' +
      '<div class="kv"><span>现年薪</span><span>' + esc(game.job.salary ? LS.fmtMoney(game.job.salary) : '—') + '</span></div>' +
      '<div class="kv"><span>婚育</span><span>' + esc(game.family.marriage.status + ' · ' + game.family.childrenIds.length + ' 个孩子') + '</span></div>' +
      '<div class="kv"><span>住房</span><span>' + esc(game.house.owned ? '自有住房 ' + LS.fmtMoney(game.house.value) : '无房') + '</span></div>' +
      '</div>' +
      '<div class="detail-block"><h4>隐性健康隐患</h4>' + riskRows() + '</div>' +
      '<div class="detail-block"><h4>人际关系</h4>' + (npcRows || '<div class="empty-note">暂无记录</div>') + '</div>' +
      '</div>';
    openModal('人生详情 · ' + game.name, html);
  }

  function riskRows() {
    var r = game.risks || {};
    var rows = LS.RISK_KEYS.map(function (k) {
      var v = LS.clamp(Math.round(r[k] || 0), 0, 100);
      return barRow(LS.RISK_LABEL[k], v, v >= 82 ? 'danger' : (v >= 55 ? 'warn' : ''));
    }).join('');
    var origin = game.riskOrigin || {};
    var extra = LS.RISK_KEYS.map(function (k) {
      return origin[k] ? '<div class="kv"><span>' + esc(LS.RISK_LABEL[k]) + '</span><span>' + esc(origin[k].age + ' 岁起 · 已 ' + (game.age - origin[k].age) + ' 年') + '</span></div>' : '';
    }).join('');
    return rows + (extra ? '<div class="risk-origin">' + extra + '</div>' : '') +
      '<div class="field-note" style="margin-top:6px">隐患需要多回合持续累积才会触发；休息、运动、复查、体检可逐步降低。</div>';
  }

  function barRow(label, value, cls) {
    var v = LS.clamp(Math.round(value), 0, 100);
    return '<div class="kv"><span>' + esc(label) + '</span><span>' + Math.round(value) + '</span></div>' +
      '<div class="bar ' + (cls || '') + '"><i style="width:' + v + '%"></i></div>';
  }

  function memoirTimeline() {
    /* v3.3：只读 eventLog，唯一事实源；不做去重、排序、补全 */
    var items = LS.memoirEntries(game);
    if (items.length && items[0].legacy) {
      return '<div class="empty-note">这一世没有留下记录。</div>';
    }
    if (!items.length) return '<div class="empty-note">这一世没有留下记录。</div>';
    return '<div class="timeline">' + items.map(function (m) {
      var badge = m.tier === 'echo' ? '<span class="tl-badge echo">因果回响</span>'
        : (m.tier === 'crossroad' ? '<span class="tl-badge cross">命运岔路</span>' : '');
      return '<div class="tl-item ' + (m.tier === 'daily' ? '' : 'tl-' + m.tier) + '"' +
        ' data-eid="' + esc(m.eventId || '') + '" data-cid="' + esc(m.choiceId || '') + '">' +
        '<div class="tl-year">' + m.year + ' 年 · ' + m.age + ' 岁' + badge + '</div>' +
        '<div class="tl-text">' + esc(m.text) + '</div></div>';
    }).join('') + '</div>';
  }

  function memoirChain() {
    /* v3.3：因果链只从 eventLog 取；回响必须能指回一条真实 choiceId，否则降级 */
    var log = (game && game.eventLog) || [];
    var hasChoice = {};
    log.forEach(function (x) { if (x.choiceId) hasChoice[x.choiceId] = true; });
    var choices = log.filter(function (x) { return x.tier === 'crossroad' && x.choiceId; });
    var echoes = log.filter(function (x) {
      return x.tier === 'echo' && x.echoOf && hasChoice[x.echoOf];
    });
    var degraded = log.filter(function (x) {
      return x.tier === 'echo' && !(x.echoOf && hasChoice[x.echoOf]);
    });
    if (!choices.length && !echoes.length && !degraded.length) {
      return '<div class="empty-note">这一世还没有可串联的因果链。</div>';
    }
    var blocks = choices.map(function (c) {
      var kids = echoes.filter(function (x) { return x.echoOf === c.choiceId; });
      var nodes = '';
      kids.forEach(function (x) {
        nodes += '<div class="chain-link"></div><div class="chain-node chain-echo" data-eid="' + esc(x.eventId) + '" data-cid="' + esc(x.choiceId || '') + '">' +
          '<span class="chain-badge">因果回响</span><b>' + x.age + ' 岁 · ' + esc(x.title) + '</b>' +
          '<span class="chain-meta">' + x.year + ' 年 · 源选择「' + esc(c.choiceLabel || '') + '」</span></div>';
      });
      if (!nodes) nodes = '<div class="chain-link"></div><div class="chain-empty">这条岔路在这一世还没有形成回响。</div>';
      return '<div class="chain-block"><div class="chain-node chain-choice" data-eid="' + esc(c.eventId) + '" data-cid="' + esc(c.choiceId) + '">' +
        '<span class="chain-badge cross">命运岔路</span><b>' + c.age + ' 岁 · ' + esc(c.title) + '</b>' +
        '<span class="chain-meta">你选择了「' + esc(c.choiceLabel) + '」</span></div>' + nodes + '</div>';
    }).join('');
    var degradedHtml = degraded.length
      ? '<div class="chain-block"><div class="chain-node chain-choice"><span class="chain-badge echo">无法指回源选择</span><b>这一世没有留下记录</b></div>' +
      degraded.map(function (x) {
        return '<div class="chain-link dotted"></div><div class="chain-node chain-wait" data-eid="' + esc(x.eventId) + '" data-cid="">' +
          '<span class="chain-badge wait">降级</span><b>' + x.age + ' 岁 · 这一世没有留下记录</b>' +
          '<span class="chain-meta">' + x.year + ' 年 · 无法指回源选择，不生成回响文案</span></div>';
      }).join('') + '</div>'
      : '';
    return '<div class="chain-legend">每一段链条都来自 eventLog 中真实存在的 choiceId；指不回的条目只显示“这一世没有留下记录”。</div>' +
      blocks + degradedHtml;
  }

  function openMemoir(tab) {
    if (!game) return;
    var want = tab === 'chain' ? 'chain' : 'time';
    var html = '<div class="memoir-tabs">' +
      '<button type="button" class="memoir-tab' + (want === 'time' ? ' on' : '') + '" data-mt="time">时间线视图</button>' +
      '<button type="button" class="memoir-tab' + (want === 'chain' ? ' on' : '') + '" data-mt="chain">因果链视图</button>' +
      '</div><div id="memoirBody" class="memoir-body">' + (want === 'chain' ? memoirChain() : memoirTimeline()) + '</div>';
    openModal('人生回忆录 · ' + game.name, html);
    var body = $('modalBody');
    body.querySelectorAll('[data-mt]').forEach(function (b) {
      b.addEventListener('click', function () {
        body.querySelectorAll('[data-mt]').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        $('memoirBody').innerHTML = b.dataset.mt === 'chain' ? memoirChain() : memoirTimeline();
      });
    });
  }

  /* =========================================================
     存读档
     ========================================================= */
  function slotHtml(mode) {
    var rows = '';
    for (var i = 1; i <= LS.save.SLOT_COUNT; i++) {
      var meta = LS.save.slotInfo(i);
      var info;
      if (!meta) info = '<div class="slot-name">空槽位 ' + i + '</div><div class="slot-meta">还没有存档</div>';
      else if (meta.broken) info = '<div class="slot-name">槽位 ' + i + '</div><div class="slot-meta">存档损坏</div>';
      else info = '<div class="slot-name">' + esc(meta.name) + ' · ' + esc(meta.age) + ' 岁</div><div class="slot-meta">' + esc(meta.year) + ' 年 · ' + esc(meta.stage) + ' · ' + esc(meta.edu) + ' · ' + esc(meta.job) + (meta.dead ? ' · 已结算' : '') + ' · ' + esc((meta.savedAt || '').slice(0, 19).replace('T', ' ')) + '</div>';
      var actions = '';
      if (mode === 'save') {
        actions += '<button class="btn tiny" data-save="' + i + '">' + (meta ? '覆盖' : '保存') + '</button>';
        if (meta) actions += '<button class="btn tiny" data-load="' + i + '">读取</button>';
      } else if (meta) {
        actions += '<button class="btn tiny" data-load="' + i + '">读取</button>';
      }
      rows += '<div class="slot ' + (!meta ? 'empty' : '') + '"><div class="slot-info">' + info + '</div><div class="slot-actions">' + actions + '</div></div>';
    }

    var autoMeta = LS.save.autoInfo();
    var autoInfo = autoMeta && !autoMeta.broken
      ? '<div class="slot-name">自动存档 · ' + esc(autoMeta.name) + ' · ' + esc(autoMeta.age) + ' 岁</div><div class="slot-meta">' + esc(autoMeta.year) + ' 年 · ' + esc(autoMeta.stage) + ' · ' + esc((autoMeta.savedAt || '').slice(0, 19).replace('T', ' ')) + '</div>'
      : '<div class="slot-name">自动存档</div><div class="slot-meta">还没有自动存档</div>';
    rows += '<div class="slot ' + (!autoMeta ? 'empty' : '') + '"><div class="slot-info">' + autoInfo + '</div><div class="slot-actions">' +
      (autoMeta && !autoMeta.broken ? '<button class="btn tiny" data-auto="1">读取</button>' : '') + '</div></div>';

    var tools = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;border-top:1px solid var(--line);padding-top:12px;">' +
      (game ? '<button class="btn tiny" id="btnExportSave">导出当前存档 JSON</button>' : '') +
      '<button class="btn tiny" id="btnImportSave">导入 JSON 存档</button>' +
      '</div>' +
      (LS.save.available ? '' : '<div class="field-note" style="color:var(--danger)">当前浏览器禁用了 localStorage，存档只能靠导出 JSON 兜底。</div>');

    return rows + tools;
  }

  function openSaveModal(mode) {
    if (mode === 'save' && !game) return;
    openModal(mode === 'save' ? '存档' : '读档', slotHtml(mode));

    var body = $('modalBody');
    body.querySelectorAll('[data-save]').forEach(function (b) {
      b.addEventListener('click', function () {
        var r = LS.save.saveSlot(game, Number(b.dataset.save));
        if (!r.ok) openModal('保存失败', '<div class="empty-note">' + esc(r.error) + '</div>');
        else openSaveModal('save');
      });
    });
    body.querySelectorAll('[data-load]').forEach(function (b) {
      b.addEventListener('click', function () {
        var r = LS.save.loadSlot(Number(b.dataset.load));
        if (!r.ok) { openModal('读取失败', '<div class="empty-note">' + esc(r.error) + '</div>'); return; }
        applyLoaded(r.game);
      });
    });
    body.querySelectorAll('[data-auto]').forEach(function (b) {
      b.addEventListener('click', function () {
        var r = LS.save.loadAuto();
        if (!r.ok) { openModal('读取失败', '<div class="empty-note">' + esc(r.error) + '</div>'); return; }
        applyLoaded(r.game);
      });
    });
    var ex = $('btnExportSave');
    if (ex) ex.addEventListener('click', function () {
      var r = LS.save.download(game);
      if (!r.ok) openModal('导出失败', '<div class="empty-note">' + esc(r.error) + '</div>');
    });
    var im = $('btnImportSave');
    if (im) im.addEventListener('click', function () { $('importFile').click(); });
  }

  /* 读档后恢复未确认的过场/播报：只展示一次，确认后正常推进 */
  function takePending() {
    var list = game.pendingBroadcasts || [];
    if (!list.length) return null;
    list.sort(function (a, b) { return (b.prio || 0) - (a.prio || 0); });
    var top = list[0];
    var rest = list.slice(1);
    if (rest.length) top.merged = rest.map(function (x) { return x.title; });
    game.pendingBroadcasts = rest;
    return top;
  }

  function applyLoaded(g) {
    game = g;
    if (!Array.isArray(game.talents)) game.talents = [];
    if (typeof game.reduceMotion === 'boolean') reduceMotion = game.reduceMotion;
    syncReduceMotion();
    closeModal();
    closeOverlay();
    show('screen-game');
    if (game.death.dead) {
      if (!game.summary) LS.engine.finish(game, game.death.reason || '身体机能衰竭');
      renderEnd();
      return;
    }
    if (game.pendingSummary || game.pendingStage) {
      $('sbTime').textContent = game.year + ' 年';
      $('sbAge').textContent = game.age + ' 岁';
      $('sbStage').textContent = stageBarText();
      $('sbAttrs').innerHTML = chips();
      paintMood();
      paintSbMoney();
      if (game.pendingStage) showStageOverlay(game.pendingStage, false, game.stageSummary);
      else showStageSummary(game.stageSummary);
      return;
    }
    var b = takePending();
    if (b) {
      $('sbTime').textContent = game.year + ' 年';
      $('sbAge').textContent = game.age + ' 岁';
      $('sbStage').textContent = stageBarText();
      $('sbAttrs').innerHTML = chips();
      paintMood();
      paintSbMoney();
      showBroadcast(b);
      return;
    }
    if (!game.current) LS.engine.nextEvent(game);
    renderGame();
    LS.save.autoSave(game);
  }

  /* 轻量 toast：社交动作等操作后的短提示 */
  function showToast(text) {
    if (!text) return;
    var t = $('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.className = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = text;
    t.classList.remove('show');
    void t.offsetWidth;
    t.classList.add('show');
    if (showToast._timer) clearTimeout(showToast._timer);
    showToast._timer = setTimeout(function () { t.classList.remove('show'); }, 2800);
  }

  /* v3.6 承诺清单：三类（答应 / 人情 / 缺席），可翻旧账 */
  var PROMISE_TYPE = {
    promise: { icon: '🤝', label: '答应过的事' },
    debt: { icon: '🪙', label: '欠下的人情' },
    absence: { icon: '🕯️', label: '缺席的场合' }
  };
  function promiseRowsHtml(list) {
    if (!list.length) return '<div class="empty-note">还没有留下承诺。你答应过别人的事，会记在这里。</div>';
    return '<div class="promise-list">' + list.map(function (p) {
      var t = PROMISE_TYPE[p.type] || PROMISE_TYPE.promise;
      var st = { open: '未兑现', kept: '已兑现', broken: '已失约' }[p.status] || '未兑现';
      return '<div class="promise-row ' + esc(p.status) + '">' +
        '<span class="promise-icon">' + t.icon + '</span>' +
        '<span class="promise-main"><b>' + esc(p.text) + '</b>' +
        '<span class="promise-meta">' + t.label + ' · ' + p.madeYear + ' 年许下 · 约定 ' + p.dueYear + ' 年 · ' + st + '</span></span>' +
        '<button type="button" class="btn tiny" data-pid="' + esc(p.id) + '">翻旧账</button>' +
        '</div>';
    }).join('') + '</div>';
  }

  function openPromises() {
    if (!game || !LS.PROMISE) return;
    var list = (game.promises || []).slice();
    list.sort(function (x, y) {
      var rank = { open: 0, broken: 1, kept: 2 };
      var d = (rank[x.status] === undefined ? 0 : rank[x.status]) - (rank[y.status] === undefined ? 0 : rank[y.status]);
      return d || (Number(x.dueYear) || 0) - (Number(y.dueYear) || 0);
    });
    openModal('承诺清单 · ' + LS.PROMISE.open(game).length + ' 件未兑现', promiseRowsHtml(list));
    var body = $('modalBody');
    var btns = body.querySelectorAll('[data-pid]');
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () { openPromiseLedger(btn.dataset.pid); });
      })(btns[i]);
    }
  }

  function openPromiseLedger(pid) {
    if (!game) return;
    var p = null;
    (game.promises || []).forEach(function (x) { if (x.id === pid) p = x; });
    if (!p) return;
    var logs = (game.eventLog || []).filter(function (x) { return x && x.promiseId === pid; });
    var rows = logs.map(function (x) {
      return '<div class="promise-log"><span class="promise-log-year">' + esc(x.year) + ' 年</span>' +
        '<span class="promise-log-title">' + esc(x.title || '') + '</span>' +
        '<span class="promise-log-text">' + esc(x.resultText || '') + '</span></div>';
    }).join('');
    openModal('翻旧账 · ' + p.text,
      '<div class="promise-ledger-head">' +
      '<span class="promise-meta">' + p.madeYear + ' 年许下 · 约定 ' + p.dueYear + ' 年 · ' +
      ({ open: '未兑现', kept: '已兑现', broken: '已失约' }[p.status] || '未兑现') + '</span></div>' +
      (rows ? '<div class="promise-ledger">' + rows + '</div>' : '<div class="empty-note">这条承诺还没有在流水里留下记录。</div>'));
  }

  function bindGame() {
    $('btnDetail').addEventListener('click', openDetail);
    var promiseBtn = $('btnPromises');
    if (promiseBtn) promiseBtn.addEventListener('click', openPromises);
    var relBtn = $('btnRelation');
    if (relBtn) relBtn.addEventListener('click', openRelationModal);
    $('btnSave').addEventListener('click', function () { openSaveModal('save'); });
    $('btnLoad').addEventListener('click', function () { openSaveModal('load'); });
    $('btnMemoir').addEventListener('click', function () { openMemoir('time'); });
    $('importFile').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      LS.save.importFile(f, function (r) {
        e.target.value = '';
        if (!r.ok) { openModal('导入失败', '<div class="empty-note">' + esc(r.error) + '</div>'); return; }
        applyLoaded(r.game);
      });
    });
  }

  /* =========================================================
     结算页
     ========================================================= */
  function chartSvg(history) {
    if (!history || history.length < 2) return '<div class="empty-note">数据不足以绘制曲线。</div>';
    var W = 920, H = 300, L = 44, R = 18, T = 18, B = 34;
    var maxAge = Math.max(10, history[history.length - 1].age);
    var x = function (age) { return L + (age / maxAge) * (W - L - R); };
    var y = function (v) { return T + (1 - LS.clamp(v, 0, 100) / 100) * (H - T - B); };
    var g = '';
    [0, 25, 50, 75, 100].forEach(function (v) {
      g += '<line x1="' + L + '" y1="' + y(v) + '" x2="' + (W - R) + '" y2="' + y(v) + '" stroke="#e2dbcd" stroke-width="1"/>';
      g += '<text x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="11" fill="#787a80">' + v + '</text>';
    });
    var step = maxAge <= 40 ? 10 : (maxAge <= 80 ? 10 : 20);
    for (var a = 0; a <= maxAge; a += step) {
      g += '<text x="' + x(a) + '" y="' + (H - 12) + '" text-anchor="middle" font-size="11" fill="#787a80">' + a + '</text>';
    }
    g += '<line x1="' + L + '" y1="' + T + '" x2="' + L + '" y2="' + (H - B) + '" stroke="#bfb6a5" stroke-width="1"/>';
    g += '<line x1="' + L + '" y1="' + (H - B) + '" x2="' + (W - R) + '" y2="' + (H - B) + '" stroke="#bfb6a5" stroke-width="1"/>';
    g += '<text x="' + (W / 2) + '" y="' + (H - 2) + '" text-anchor="middle" font-size="11" fill="#787a80">年龄</text>';

    var series = [
      { key: 'knowledge', color: '#2f514b', name: '学识' },
      { key: 'health', color: '#9c4a34', name: '健康' },
      { key: 'happiness', color: '#b0893e', name: '幸福感' },
      { key: 'reputation', color: '#4c5b7a', name: '声望' }
    ];
    series.forEach(function (s) {
      var pts = history.map(function (h) { return x(h.age) + ',' + y(h[s.key]); }).join(' ');
      g += '<polyline points="' + pts + '" fill="none" stroke="' + s.color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
      var last = history[history.length - 1];
      g += '<circle cx="' + x(last.age) + '" cy="' + y(last[s.key]) + '" r="3.2" fill="' + s.color + '"/>';
    });
    return '<div class="chart-box"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="一生属性变化曲线">' + g + '</svg>' +
      '<div class="chart-legend">' + series.map(function (s) {
        return '<span><i style="background:' + s.color + '"></i>' + s.name + '</span>';
      }).join('') + '</div></div>';
  }

  /* 六维雷达图：纯内联 SVG，六边形网格 + 数据多边形 + 轴标签 */
  function radarSvg(radar) {
    radar = radar || {};
    var AXES = [
      { k: 'wealth', label: '财富' },
      { k: 'career', label: '事业' },
      { k: 'family', label: '家庭' },
      { k: 'health', label: '健康' },
      { k: 'reputation', label: '声望' },
      { k: 'happiness', label: '幸福感' }
    ];
    var W = 380, H = 336, cx = 190, cy = 168, R = 112;
    function pt(i, r) {
      var ang = -Math.PI / 2 + i * Math.PI / 3;
      return [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r];
    }
    var g = '';
    [20, 40, 60, 80, 100].forEach(function (rv) {
      var ring = [];
      for (var i = 0; i < 6; i++) {
        var p = pt(i, R * rv / 100);
        ring.push(p[0].toFixed(1) + ',' + p[1].toFixed(1));
      }
      g += '<polygon points="' + ring.join(' ') + '" fill="none" stroke="#e2dbcd" stroke-width="1"/>';
    });
    for (var i = 0; i < 6; i++) {
      var e = pt(i, R);
      g += '<line x1="' + cx + '" y1="' + cy + '" x2="' + e[0].toFixed(1) + '" y2="' + e[1].toFixed(1) + '" stroke="#e2dbcd" stroke-width="1"/>';
    }
    var dataPts = [], dataDots = '';
    AXES.forEach(function (a, i) {
      var v = LS.clamp(Number(radar[a.k]) || 0, 0, 100);
      var p = pt(i, R * v / 100);
      dataPts.push(p[0].toFixed(1) + ',' + p[1].toFixed(1));
      dataDots += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3" fill="#9c4a34"/>';
    });
    g += '<polygon points="' + dataPts.join(' ') + '" fill="rgba(156,74,52,0.16)" stroke="#9c4a34" stroke-width="2" stroke-linejoin="round"/>' + dataDots;
    AXES.forEach(function (a, i) {
      var ang = -Math.PI / 2 + i * Math.PI / 3;
      var lx = cx + Math.cos(ang) * (R + 26);
      var ly = cy + Math.sin(ang) * (R + 26) + 4;
      var anchor = Math.cos(ang) > 0.3 ? 'start' : (Math.cos(ang) < -0.3 ? 'end' : 'middle');
      g += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="' + anchor + '" font-size="13" fill="#5f6470">' + a.label + '</text>';
    });
    return '<div class="radar-card"><svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="人生六维雷达图">' + g + '</svg></div>';
  }

  /* 分享卡用的 Canvas 雷达，尺寸与配色与页面一致 */
  function drawCanvasRadar(ctx, radar, cx, cy, R) {
    radar = radar || {};
    var AXES = ['wealth', 'career', 'family', 'health', 'reputation', 'happiness'];
    var LABELS = ['财富', '事业', '家庭', '健康', '声望', '幸福感'];
    var i, j, ang, p;
    function pt(idx, r) {
      var a = -Math.PI / 2 + idx * Math.PI / 3;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    }
    ctx.strokeStyle = '#ded6c6';
    ctx.lineWidth = 2;
    for (i = 1; i <= 5; i++) {
      ctx.beginPath();
      for (j = 0; j < 6; j++) {
        p = pt(j, R * i / 5);
        if (j === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
      }
      ctx.closePath();
      ctx.stroke();
    }
    for (i = 0; i < 6; i++) {
      p = pt(i, R);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(p[0], p[1]);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(156,74,52,0.16)';
    ctx.strokeStyle = '#9c4a34';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (i = 0; i < 6; i++) {
      p = pt(i, R * LS.clamp(Number(radar[AXES[i]]) || 0, 0, 100) / 100);
      if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#5f6470';
    ctx.font = '26px "Songti SC", "SimSun", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (i = 0; i < 6; i++) {
      ang = -Math.PI / 2 + i * Math.PI / 3;
      p = [cx + Math.cos(ang) * (R + 40), cy + Math.sin(ang) * (R + 40)];
      ctx.fillText(LABELS[i], p[0], p[1]);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  function wrapCanvasLines(ctx, text, maxW) {
    var out = [], line = '';
    var chars = String(text || '').split('');
    for (var i = 0; i < chars.length; i++) {
      var test = line + chars[i];
      if (ctx.measureText(test).width > maxW && line) {
        out.push(line);
        line = chars[i];
      } else {
        line = test;
      }
    }
    if (line) out.push(line);
    return out;
  }

  /* 导出分享卡：1080×1920 纯前端 Canvas，不联网、无跨域 */
  function exportShareCard() {
    var s = game && game.summary;
    if (!s) {
      openModal('还不能导出', '<p class="empty-note">人生结束后才能生成分享卡。</p>');
      return;
    }
    try {
      var c = document.createElement('canvas');
      c.width = 1080;
      c.height = 1920;
      var ctx = c.getContext('2d');
      var paper = '#f3efe6', ink = '#26282c', ink2 = '#5f6470', accent = '#9c4a34';

      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, 1080, 1920);
      ctx.strokeStyle = '#ded6c6';
      ctx.lineWidth = 3;
      ctx.strokeRect(56, 56, 968, 1808);

      ctx.fillStyle = ink2;
      ctx.font = '22px "Songti SC", "SimSun", serif';
      ctx.fillText('LIFE SIMULATOR · 人生模拟器', 100, 140);

      ctx.fillStyle = ink;
      ctx.font = '900 66px "Songti SC", "SimSun", serif';
      ctx.fillText(String(s.name), 100, 250);

      ctx.fillStyle = ink2;
      ctx.font = '28px "Songti SC", "SimSun", serif';
      ctx.fillText(s.birthYear + ' — ' + s.deathYear + '　·　' + s.age + ' 岁　·　' + String(s.reason || ''), 100, 300);

      ctx.strokeStyle = '#ded6c6';
      ctx.beginPath();
      ctx.moveTo(100, 340);
      ctx.lineTo(980, 340);
      ctx.stroke();

      drawCanvasRadar(ctx, s.radar, 540, 730, 250);

      var tags = (s.tags || []).slice(0, 6);
      var tx = 100, ty = 1094;
      ctx.font = '28px "Songti SC", "SimSun", serif';
      for (var i = 0; i < tags.length; i++) {
        var label = String(tags[i]);
        var w = ctx.measureText(label).width + 40;
        if (tx + w > 980) { tx = 100; ty += 62; }
        ctx.fillStyle = '#eae3d5';
        ctx.fillRect(tx, ty - 34, w, 48);
        ctx.fillStyle = accent;
        ctx.fillText(label, tx + 20, ty);
        tx += w + 14;
      }

      ctx.fillStyle = ink;
      ctx.font = '30px "Songti SC", "SimSun", serif';
      var lines = wrapCanvasLines(ctx, s.epitaph || s.evaluation || '', 840).slice(0, 6);
      for (var li = 0; li < lines.length; li++) {
        ctx.fillText(lines[li], 100, 1250 + li * 48);
      }

      ctx.strokeStyle = '#c9bfae';
      ctx.lineWidth = 2;
      ctx.strokeRect(88, 1540, 904, 168);
      ctx.fillStyle = accent;
      ctx.font = '30px "Songti SC", "SimSun", serif';
      var quote = (s.tags && s.tags.length) ? (s.tags.slice(0, 2).join(' · ') + '，这一生就这样走完了。') : '一生平凡，也算认真活过。';
      var qlines = wrapCanvasLines(ctx, quote, 820).slice(0, 2);
      for (var qi = 0; qi < qlines.length; qi++) {
        ctx.fillText(qlines[qi], 108, 1600 + qi * 44);
      }

      ctx.fillStyle = ink2;
      ctx.font = '22px "Songti SC", "SimSun", serif';
      ctx.fillText('随机种子 ' + s.seed + ' · 本地离线生成，不联网', 100, 1810);

      var url = c.toDataURL('image/png');
      var a = document.createElement('a');
      a.href = url;
      a.download = '人生分享卡_' + String(s.name).replace(/[\\/:*?"<>|]/g, '') + '.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('分享卡已生成，请查看下载目录。');
    } catch (err) {
      openModal('导出失败', '<p class="empty-note">当前浏览器无法生成图片：' + esc(String(err && err.message || err)) + '</p>');
    }
  }

  /* v3.1 人生履历卡：1080×1350，紧凑可截图分享 */
  function exportResumeCard() {
    var s = game && game.summary;
    if (!s) {
      openModal('还不能导出', '<p class="empty-note">人生结束后才能生成履历卡。</p>');
      return;
    }
    try {
      var c = document.createElement('canvas');
      c.width = 1080;
      c.height = 1350;
      var ctx = c.getContext('2d');
      var paper = '#f3efe6', ink = '#26282c', ink2 = '#5f6470', accent = '#9c4a34', ochre = '#a8894f';

      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, 1080, 1350);
      ctx.strokeStyle = '#ded6c6';
      ctx.lineWidth = 3;
      ctx.strokeRect(52, 52, 976, 1246);

      ctx.fillStyle = ochre;
      ctx.fillRect(52, 52, 976, 10);

      ctx.fillStyle = ink2;
      ctx.font = '20px "Songti SC", "SimSun", serif';
      ctx.fillText('LIFE RECORD · 人生履历卡', 92, 118);

      ctx.fillStyle = ink;
      ctx.font = '900 64px "Songti SC", "SimSun", serif';
      ctx.fillText(String(s.name), 92, 200);

      ctx.fillStyle = ink2;
      ctx.font = '26px "Songti SC", "SimSun", serif';
      ctx.fillText(s.birthYear + ' — ' + s.deathYear + '　·　' + s.age + ' 岁　·　' + String(s.reason || ''), 92, 246);

      ctx.strokeStyle = '#ded6c6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(92, 278);
      ctx.lineTo(988, 278);
      ctx.stroke();

      drawCanvasRadar(ctx, s.radar, 320, 600, 185);

      ctx.fillStyle = ink;
      ctx.font = '26px "Songti SC", "SimSun", serif';
      ctx.fillText('三个关键抉择', 620, 400);
      var log = (game.choiceLog || []).slice();
      var picks = log.filter(function (x) { return x.tier === 'crossroad'; });
      if (picks.length < 3) picks = picks.concat(log.filter(function (x) { return x.tier !== 'crossroad'; }));
      picks = picks.slice(0, 3);
      var y = 452;
      for (var i = 0; i < picks.length; i++) {
        ctx.fillStyle = accent;
        ctx.font = '22px "Songti SC", "SimSun", serif';
        ctx.fillText((picks[i].age != null ? picks[i].age + ' 岁' : '') + ' · ' + String(picks[i].title || ''), 620, y);
        ctx.fillStyle = ink;
        ctx.font = '24px "Songti SC", "SimSun", serif';
        var lab = wrapCanvasLines(ctx, '「' + String(picks[i].label || '') + '」', 350).slice(0, 2);
        for (var j = 0; j < lab.length; j++) ctx.fillText(lab[j], 620, y + 38 + j * 34);
        y += 38 + lab.length * 34 + 24;
      }
      if (!picks.length) {
        ctx.fillStyle = ink2;
        ctx.font = '24px "Songti SC", "SimSun", serif';
        ctx.fillText('这一生没有留下明确的关键抉择。', 620, 452);
      }

      ctx.strokeStyle = '#c9bfae';
      ctx.lineWidth = 2;
      ctx.strokeRect(92, 1010, 896, 190);
      ctx.fillStyle = accent;
      ctx.font = '24px "Songti SC", "SimSun", serif';
      ctx.fillText('墓志铭', 116, 1052);
      ctx.fillStyle = ink;
      ctx.font = '30px "Songti SC", "SimSun", serif';
      var ep = wrapCanvasLines(ctx, s.epitaph || s.evaluation || '', 840).slice(0, 4);
      for (var k = 0; k < ep.length; k++) ctx.fillText(ep[k], 116, 1100 + k * 42);

      ctx.fillStyle = ink2;
      ctx.font = '20px "Songti SC", "SimSun", serif';
      ctx.fillText('随机种子 ' + s.seed + ' · 本地离线生成，不联网', 92, 1256);

      var url = c.toDataURL('image/png');
      var a = document.createElement('a');
      a.href = url;
      a.download = '人生履历卡_' + String(s.name).replace(/[\\/:*?"<>|]/g, '') + '.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('履历卡已生成，请查看下载目录。');
    } catch (err) {
      openModal('导出失败', '<p class="empty-note">当前浏览器无法生成图片：' + esc(String(err && err.message || err)) + '</p>');
    }
  }

  /* 成就与图鉴：全部成就 + 已收集结局/彩蛋 */
  function openCodex() {
    var store = LS.achRead() || {};
    var ids = store.ids || [];
    var achRows = (LS.ACHIEVEMENTS || []).map(function (a) {
      var got = ids.indexOf(a.id) >= 0;
      return '<div class="ach ' + (got ? '' : 'miss') + '"><b>' + esc(a.name) + '</b><span>' + esc(a.desc || '') + '</span>' +
        '<em class="ach-state">' + (got ? '已解锁' : '未解锁') + '</em></div>';
    }).join('') || '<div class="empty-note">暂无成就数据。</div>';
    var endings = store.endings || [];
    var eggs = store.eggs || [];
    var endHtml = endings.length
      ? endings.map(function (x) { return '<span class="codex-chip">' + esc(x) + '</span>'; }).join('')
      : '<span class="empty-note">还没有收集到结局。</span>';
    var eggHtml = eggs.length
      ? eggs.map(function (x) { return '<span class="codex-chip egg">' + esc(x) + '</span>'; }).join('')
      : '<span class="empty-note">还没有发现彩蛋。</span>';
    openModal('成就与图鉴',
      '<div class="codex">' +
      '<div class="codex-sub">成就 · ' + ids.length + ' / ' + (LS.ACHIEVEMENTS || []).length + '</div>' +
      '<div class="ach-grid">' + achRows + '</div>' +
      '<div class="codex-sub">已收集结局 · ' + endings.length + '</div><div class="codex-chips">' + endHtml + '</div>' +
      '<div class="codex-sub">已发现彩蛋 · ' + eggs.length + '</div><div class="codex-chips">' + eggHtml + '</div>' +
      '</div>');
  }

  function renderEnd() {
    clearMood();
    var s = game.summary || LS.engine.finish(game, game.death.reason || '身体机能衰竭');
    var ach = s.achievements || [];
    var got = s.gotAchievements || [];

    var cards = [
      { k: '寿命', v: s.age + ' 岁', x: s.birthYear + '–' + s.deathYear },
      { k: '学历', v: s.edu, x: '累计工作 ' + s.jobYears + ' 年' },
      { k: '净资产', v: LS.fmtMoney(s.netWorth), x: '现金 ' + LS.fmtMoney(s.cash) + ' · 负债 ' + LS.fmtMoney(s.debt), small: true },
      { k: '成就', v: got.length + ' 项', x: '共 ' + ach.length + ' 项可达成' }
    ];

    var eduLines = s.eduPath.map(function (p) { return '<div class="kv"><span>' + p.age + ' 岁</span><span>' + esc(p.text) + '</span></div>'; }).join('');
    var jobLines = s.jobHistory.length
      ? s.jobHistory.map(function (j) { return '<div class="kv"><span>' + j.age + ' 岁</span><span>' + esc(j.text) + '</span></div>'; }).join('')
      : '<div class="empty-note">没有正式的职业记录。</div>';
    var childLines = s.children.length
      ? s.children.map(function (c) { return '<div class="kv"><span>' + esc(c.name) + '</span><span>' + (c.alive ? c.age + ' 岁' : '已故') + '</span></div>'; }).join('')
      : '<div class="kv"><span>子女</span><span>无</span></div>';

    var timeline = s.memories.length
      ? '<div class="timeline">' + s.memories.map(function (m) {
        return '<div class="tl-item"><div class="tl-year">' + m.year + ' 年 · ' + m.age + ' 岁</div><div class="tl-text">' + esc(m.text) + '</div></div>';
      }).join('') + '</div>'
      : '<div class="empty-note">没有留下可叙述的记忆。</div>';

    var achHtml = ach.map(function (a) {
      return '<div class="ach ' + (a.got ? '' : 'miss') + '"><b>' + esc(a.name) + '</b><span>' + esc(a.desc) + '</span></div>';
    }).join('');

    var tags = s.tags || [];
    var tagsHtml = tags.length
      ? '<div class="tag-row">' + tags.map(function (t) { return '<span class="tag-chip">' + esc(t) + '</span>'; }).join('') + '</div>'
      : '<div class="empty-note">这一生没有留下明确的标签。</div>';
    var survivors = s.survivors || [];
    var survHtml = game
      ? endSurvivorsHtml()
      : (survivors.length
        ? survivors.map(function (p) {
          return '<div class="survivor-row"><span class="sv-name">' + esc(p.name || '——') + '</span>' +
            '<span class="sv-role">' + esc(p.role || '') + '</span><span class="sv-stage">' + esc(p.stage || '') + '</span></div>';
        }).join('')
        : '<div class="empty-note">最后，身边没有留下什么人。</div>');
    var legacy = s.legacyOut || {};
    var legacyHtml = (Number(legacy.reputation) || Number(legacy.cash))
      ? '<div class="legacy-note">传承 · 这一世留下：声望 +' + esc(legacy.reputation || 0) + ' · 现金 +' + esc(LS.fmtMoney(legacy.cash || 0)) +
        '<span class="legacy-tip">下一局开局自动带入</span></div>'
      : '<div class="legacy-note muted">传承 · 这一世没有留下可被继承的声望或现金。</div>';

    var letter = (LS.V36 && LS.V36.letter) ? LS.V36.letter(game, s) : null;
    var letterHtml = '';
    if (letter) {
      letterHtml =
        '<div class="end-letter">' +
        '<div class="letter-salute">' + esc(letter.salute) + '</div>' +
        letter.paragraphs.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') +
        '<div class="letter-sign">' + esc(letter.sign) +
        '<span class="letter-quote">' + esc(letter.quote.t) + '<i>—— ' + esc(letter.quote.a) + '</i></span>' +
        '</div></div>' +
        '<div class="letter-stats">' + letter.stats.map(function (st) {
          return '<div class="letter-stat"><div class="k">' + esc(st.k) + '</div><div class="v">' + esc(st.v) + '</div></div>';
        }).join('') + '</div>';
    } else {
      letterHtml = '<div class="end-cards">' + cards.slice(0, 3).map(function (c) {
        return '<div class="end-card"><div class="k">' + c.k + '</div><div class="v">' + esc(c.v) + '</div></div>';
      }).join('') + '</div>';
    }

    var html =
      '<div class="end-head">' +
      '<div class="end-kicker">人生结算 · LIFE SUMMARY</div>' +
      '<div class="end-title">' + esc(s.name) + '　' + s.age + ' 岁</div>' +
      '<div class="end-sub">' + s.birthYear + ' 年 — ' + s.deathYear + ' 年　·　' + esc(s.reason) + '　·　出生于' + esc(game.birthplace) + '，' + esc(game.background) + '家庭　·　随机种子 ' + s.seed + '</div>' +
      '</div>' +

      letterHtml +

      '<div class="end-section"><h3>留下的标签</h3>' +
      tagsHtml +
      '<div class="epitaph">' + esc(s.epitaph || s.evaluation || '') + '</div>' +
      legacyHtml + '</div>' +

      '<div class="end-section"><h3>人生大事记</h3>' +
      '<div class="memoir-open"><div class="memory-actions">' +
      '<button type="button" class="btn tiny" id="btnEndMemoirTime">回忆录 · 时间线</button>' +
      '<button type="button" class="btn tiny" id="btnEndMemoirChain">回忆录 · 因果链</button>' +
      '</div><div class="end-note">两种视角阅读这一生，所有记忆都已经留在里面。</div></div>' +
      timeline + '</div>' +

      '<div class="end-section"><h3>成就</h3><div class="ach-grid">' + achHtml + '</div></div>' +

      '<div class="end-section"><h3>评价</h3><div class="evaluation">' + esc(s.evaluation) + '</div></div>' +

      '<div class="end-actions">' +
      '<button class="btn share-btn" id="btnShareCard">导出分享卡</button>' +
      '<button class="btn" id="btnResumeCard">人生履历卡</button>' +
      '<button class="btn" id="btnCodex">成就图鉴</button>' +
      '<button class="btn" id="btnEndLoad">读取存档</button>' +
      '<button class="btn primary" id="btnEndNew">开启新人生</button>' +
      '<button class="btn ghost" id="btnEndExit">退出游戏</button>' +
      '</div>';

    $('endWrap').innerHTML = html;
    show('screen-end');
    $('endWrap').scrollTop = 0;

    $('btnEndLoad').addEventListener('click', function () { openSaveModal('load'); });
    $('btnEndNew').addEventListener('click', function () {
      game = null;
      resetCreate();
      show('screen-create');
    });
    $('btnEndExit').addEventListener('click', function () { $('exitScreen').hidden = false; });
    $('btnShareCard').addEventListener('click', exportShareCard);
    $('btnResumeCard').addEventListener('click', exportResumeCard);
    $('btnCodex').addEventListener('click', openCodex);
    $('btnEndMemoirTime').addEventListener('click', function () { openMemoir('time'); });
    $('btnEndMemoirChain').addEventListener('click', function () { openMemoir('chain'); });
  }

  function debugHunt() {
    if (!game) return;
    closeOverlay();
    game.job.id = null; game.job.title = ''; game.job.salary = 0;
    game.flags.needJob = true; game.flags.unemployed = true;
    game.current = null; game.crossGate = null;
    LS.engine.nextEvent(game);
    LS.save.autoSave(game);
    renderGame();
  }

  function buildDebugPanel() {
    var panel = $('debugPanel'), body = $('debugBody');
    if (!panel || !body || !game) return;
    if (body.dataset.bound) { panel.hidden = false; return; }
    body.dataset.bound = '1';
    var keys = Object.keys(LS.BC_META || {});
    var bc = keys.map(function (k) {
      var m = LS.BC_META[k];
      return '<button type="button" data-bc="' + k + '">【' + esc(m.title) + '】</button>';
    }).join('');
    body.innerHTML =
      '<div class="debug-group"><div class="debug-label">七张阶段过场（点【继续人生】前主循环暂停）</div>' +
      ['infant', 'child', 'teen', 'youth', 'midlife', 'elder', 'late'].map(function (k) {
        var m = LS.stageMark(k);
        return '<button type="button" data-stage="' + k + '">' + esc(m.title) + '</button>';
      }).join('') + '</div>' +
      '<div class="debug-group"><div class="debug-label">v3 新界面预览</div>' +
      '<button type="button" data-act="summary">阶段总结卡</button>' +
      '<button type="button" data-act="radar">六维雷达图</button>' +
      '<button type="button" data-act="share">导出分享卡</button></div>' +
      '<div class="debug-group"><div class="debug-label">其他</div>' +
      '<button type="button" data-act="hunt">触发求职岔路</button>' +
      '<button type="button" data-act="memoir">打开因果链回忆录</button></div>' +
      '<div class="debug-group"><div class="debug-label">重大结果播报（' + keys.length + ' 类）</div><div class="debug-bc">' + bc + '</div></div>';
    panel.hidden = false;
    body.addEventListener('click', function (ev) {
      var t = ev.target.closest('button');
      if (!t) return;
      if (t.dataset.bc) {
        var meta = LS.BC_META[t.dataset.bc];
        showBroadcast({
          key: t.dataset.bc, title: meta.title, text: meta.text, art: meta.art, tone: meta.tone,
          changes: '调试演示 · 本弹窗不写入存档，数值不代表实际状态'
        }, true);
      } else if (t.dataset.stage) {
        showStageOverlay(t.dataset.stage, true);
      } else if (t.dataset.act === 'summary') {
        showStageSummary(game.stageSummary || debugStageSummary());
      } else if (t.dataset.act === 'radar') {
        openModal('六维雷达图预览', radarSvg((game.summary && game.summary.radar) || debugRadar()));
      } else if (t.dataset.act === 'share') {
        exportShareCard();
      } else if (t.dataset.act === 'hunt') {
        debugHunt();
      } else if (t.dataset.act === 'memoir') {
        openMemoir('chain');
      }
    });
  }

  /* 调试预览用的假阶段总结与雷达数据，不写入存档 */
  function debugStageSummary() {
    return {
      fromStage: '少年', toStage: '青年', atAge: 19, title: '少年结束',
      lines: [
        '从变声的夏天，到第一次认真想将来，少年结束得比想象中快。',
        '把时间压在书本上，学识从 58 抬到 76；做过 3 次要紧的决定。',
        '留下的东西：净资产 12.0 万，身边还有 2 位可以说话的人。'
      ],
      changes: [
        { kind: 'attr', label: '学识', delta: 18 },
        { kind: 'attr', label: '健康', delta: -6 },
        { kind: 'money', label: '现金', delta: -12000 },
        { kind: 'tag', label: '人脉', delta: '新增' }
      ],
      impacts: [
        { type: 'risk', key: 'insomnia', label: '长期熬夜', note: '阶段结束时长期熬夜已累积到 46，会在青年期继续扣健康。', age: 19, stage: '少年' },
        { type: 'relation', key: 'mother', label: '与母亲的关系', note: '好感停在 62，之后的一次重大选择会读取它。', age: 19, stage: '少年' }
      ]
    };
  }
  function debugRadar() {
    var r = (game && game.summary && game.summary.radar) || {};
    if (!r.wealth && !r.career) return { wealth: 62, career: 48, family: 70, health: 55, reputation: 40, happiness: 66 };
    return r;
  }

  /* =========================================================
     初始化
     ========================================================= */
  function init() {
    reduceMotion = systemReduceMotion();
    syncReduceMotion();
    bindReduceMotion();
    fillSelects();
    bindWelcome();
    bindCreate();
    bindGame();
    resetCreate();
    LS.fillTalents = fillTalents;
    // 暴露给测试脚本使用
    LS.ui = {
      getGame: function () { return game; },
      setGame: function (g) {
        game = g;
        if (!Array.isArray(game.talents)) game.talents = [];
        if (typeof game.reduceMotion === 'boolean') reduceMotion = game.reduceMotion;
        syncReduceMotion();
        show('screen-game');
        renderGame();
      },
      render: renderGame,
      fillTalents: fillTalents,
      renderEnd: renderEnd,
      openDetail: openDetail,
      openRelationModal: openRelationModal,
      openMemoir: openMemoir,
      handleResult: handleResult,
      showStage: showStageOverlay,
      showSummary: showStageSummary,
      showBroadcast: showBroadcast,
      showCrossGate: showCrossGate,
      radarSvg: radarSvg,
      exportShareCard: exportShareCard,
      exportResumeCard: exportResumeCard,
      openCodex: openCodex,
      __testSceneKey: sceneKeyOf,
      applyLoaded: applyLoaded,
      closeOverlay: closeOverlay,
      previewEvent: function (id, echoInfo) {
        if (!game) return false;
        var ev = LS.EVENT_INDEX[id];
        if (!ev && id === 'jobhunt') ev = LS.engine.buildJobHuntEvent(game);
        if (!ev) return false;
        game.echoInfo = echoInfo || null;
        game.current = ev;
        if ($('sbTime')) {
          $('sbTime').textContent = game.year + ' 年';
          $('sbAge').textContent = game.age + ' 岁';
          $('sbStage').textContent = stageBarText();
          $('sbAttrs').innerHTML = chips();
        }
        if (ev.tier === 'crossroad') {
          game.crossGate = ev.id + '@' + game.age;
          game.crossSeen = game.crossSeen || {};
          game.crossSeen[game.crossGate] = true;
        }
        paintEvent(ev);
        return true;
      },
      debugPanel: buildDebugPanel
    };
    if (/debug/i.test(location.hash + location.search)) buildDebugPanel();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
