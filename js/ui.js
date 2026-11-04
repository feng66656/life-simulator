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

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
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

  function fillTalents() {
    var grid = $('talentGrid');
    grid.innerHTML = '';
    LS.TALENTS.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'talent' + (selTalents.indexOf(t.id) >= 0 ? ' on' : '');
      b.dataset.id = t.id;
      b.innerHTML = '<span class="t-name">' + esc(t.name) + '<span class="t-tag">' + esc(t.tag) + '</span></span>' +
        '<span class="t-desc">' + esc(t.desc) + '</span>';
      b.addEventListener('click', function () {
        var i = selTalents.indexOf(t.id);
        if (i >= 0) selTalents.splice(i, 1);
        else {
          if (selTalents.length >= 2) {
            $('noteTalents').textContent = '最多只能选 2 个天赋。先取消一个再选。';
            $('noteTalents').style.color = 'var(--danger)';
            return;
          }
          selTalents.push(t.id);
          $('noteTalents').style.color = '';
        }
        fillTalents();
        recomputeBase();
        updateTalentNote();
      });
      grid.appendChild(b);
    });
  }

  function updateTalentNote() {
    $('talentCount').textContent = selTalents.length;
    if (selTalents.length === 0) {
      $('noteTalents').textContent = '不选也可以。背景与出生地仍会决定你的起点。';
    } else {
      var names = selTalents.map(function (id) { return LS.talent(id).name; });
      $('noteTalents').textContent = '已选：' + names.join('、') + '。天赋会改变基数、事件权重与后续判定。';
    }
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
    selTalents = [];
    useLegacy = true;
    $('inName').value = '';
    $('inGender').value = '男';
    $('inBirthplace').value = '小城';
    $('inBackground').value = '普通工薪';
    $('noteTalents').textContent = '';
    bases = LS.baseAttrs('小城', '普通工薪', []);
    alloc = {};
    for (var k in bases) alloc[k] = bases[k];
    fillTalents();
    updateTalentNote();
    recomputeBase();
    updateFieldNotes();
    updateLegacyNote();
  }

  function randomCharacter() {
    var keys = Object.keys(LS.BIRTHPLACES);
    var bgs = Object.keys(LS.BACKGROUNDS);
    $('inName').value = LS.randomName(LS.chance(0.5) ? '女' : '男');
    $('inGender').value = LS.pick(['男', '女', '其他']);
    $('inBirthplace').value = LS.pick(keys);
    $('inBackground').value = LS.pick(bgs);
    selTalents = [];
    var pool = LS.TALENTS.map(function (t) { return t.id; });
    var n = LS.chance(0.75) ? 2 : (LS.chance(0.6) ? 1 : 0);
    while (selTalents.length < n && pool.length) {
      var idx = Math.floor(LS.rand() * pool.length);
      selTalents.push(pool.splice(idx, 1)[0]);
    }
    fillTalents();
    updateTalentNote();
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
    $('noteTalents').style.color = '';
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
    var legBtn = $('btnLegacy');
    if (legBtn) legBtn.addEventListener('click', function () {
      useLegacy = !useLegacy;
      updateLegacyNote();
    });
    $('btnCreateBack').addEventListener('click', function () { show('screen-welcome'); });
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
      var attrs = {};
      for (var k in alloc) attrs[k] = Math.round(alloc[k]);
      var cfg = {
        name: name,
        gender: $('inGender').value,
        birthplace: $('inBirthplace').value,
        background: $('inBackground').value,
        talents: selTalents.slice(),
        attrs: attrs,
        useLegacy: useLegacy,
        seed: (Date.now() % 2147483647) || 1
      };
      try {
        game = LS.engine.start(cfg);
      } catch (e) {
        openModal('无法开始', '<p class="empty-note">' + esc(e.message || '创建失败') + '</p>');
        return;
      }
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

  /* 五星按 20 一档 */
  function starsOf(v) {
    var n = Math.floor(LS.clamp(Number(v) || 0, 0, 100) / 20);
    var s = '';
    for (var i = 0; i < 5; i++) s += (i < n ? '★' : '☆');
    return s;
  }

  /* 幸福感/压力只给区间描述，精确值留在详情面板 */
  function moodOf(v, kind) {
    v = Number(v) || 0;
    if (kind === 'stress') {
      if (v <= 25) return { cls: 'calm', word: '轻松' };
      if (v <= 45) return { cls: 'ok', word: '尚可' };
      if (v <= 65) return { cls: 'warn', word: '紧绷' };
      return { cls: 'bad', word: '高压' };
    }
    if (v >= 70) return { cls: 'good', word: '很好' };
    if (v >= 50) return { cls: 'ok', word: '尚可' };
    if (v >= 35) return { cls: 'warn', word: '平淡' };
    return { cls: 'bad', word: '低落' };
  }

  function attrBarChip(label, val, lowCls) {
    var v = Math.round(LS.clamp(Number(val) || 0, 0, 100));
    return '<div class="sb-chip attr-chip ' + (lowCls || '') + '">' +
      '<div class="attr-top"><span class="lbl">' + esc(label) + '</span><span class="val">' + v + '</span></div>' +
      '<div class="attr-bar"><i style="width:' + v + '%"></i></div>' +
      '<div class="attr-stars">' + starsOf(v) + '</div></div>';
  }

  function chips() {
    var a = game.attrs;
    var hap = moodOf(a.happiness, 'happy');
    var pres = moodOf(a.stress, 'stress');
    return [
      attrBarChip('学识', a.knowledge),
      attrBarChip('健康', a.health, a.health < 35 ? 'low' : ''),
      attrBarChip('财力', a.finance),
      attrBarChip('魅力', a.charm),
      '<div class="sb-chip mood-chip"><div class="attr-top"><span class="lbl">幸福感</span>' +
        '<span class="mood-line"><i class="mood-dot ' + hap.cls + '"></i>' + hap.word + '</span></div>' +
        '<div class="attr-bar"><i style="width:' + Math.round(LS.clamp(a.happiness, 0, 100)) + '%"></i></div></div>',
      attrBarChip('声望', LS.repTotal(game)),
      '<div class="sb-chip mood-chip"><div class="attr-top"><span class="lbl">压力</span>' +
        '<span class="mood-line"><i class="mood-dot ' + pres.cls + '"></i>' + pres.word + '</span></div></div>'
    ].join('');
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

  /* 结果分发：总结卡 → 阶段过场 → 播报 → 事件渲染，最后兜底 */
  function handleResult(r) {
    if (!r || !r.ok) {
      openModal('无法推进', '<p class="empty-note">' + esc((r && r.error) || '发生未知错误') + '</p>');
      return;
    }
    if (r.dead) { renderEnd(); return; }
    if (r.paused === 'summary') { showStageSummary(r.summary || game.stageSummary); return; }
    if (r.paused === 'stage') { showStageOverlay(r.stage || game.pendingStage); return; }
    if (r.paused === 'broadcast') { showBroadcast(r.broadcast); return; }
    if (r.event) { renderGame(); return; }

    /* 没有事件也没死：再取一次事件；仍为空则按待确认的总结/过场继续分发 */
    if (!game.death.dead) {
      var e2 = LS.engine.nextEvent(game);
      if (e2) { renderGame(); return; }
      if (game.pendingSummary) { showStageSummary(game.stageSummary); return; }
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

  /* 前情回顾：该阶段之前的 3 行记忆（截断到 42 字） */
  function recapLines(mark) {
    if (!game) return [];
    var cut = mark ? mark.age : (game.age || 0);
    var out = [];
    var list = (game.memories || []).filter(function (x) { return Number(x.age) < cut; });
    list = list.slice(-3);
    for (var i = 0; i < list.length; i++) {
      var t = String(list[i].text || '').replace(/^【[^】]*】/, '');
      if (!t) continue;
      out.push({ age: list[i].age, text: t.length > 42 ? t.slice(0, 42) + '…' : t });
    }
    return out;
  }

  /* 该阶段之前的关键抉择：优先岔路，最多 4 条 */
  function keyChoicesBefore(mark) {
    if (!game) return [];
    var cut = mark ? mark.age : 999;
    var list = (game.choiceLog || []).filter(function (c) { return Number(c.age) < cut; });
    var cross = list.filter(function (c) { return c.tier === 'crossroad'; });
    var use = (cross.length ? cross : list).slice(-4);
    return use;
  }

  /* 点击前情中的关键抉择：弹出当时的选择与后续回响 */
  function openChoiceRecap(c) {
    if (!c) return;
    var key = c.key || (c.id + '@' + c.age);
    var echo = null, wait = null;
    (game.echoLog || []).forEach(function (x) { if (!echo && x.choiceId === key) echo = x; });
    (game.pending || []).forEach(function (p) { if (!wait && p.choiceId === key) wait = p; });
    var result = '';
    if (echo) {
      result = '后来有了回响：' + echo.year + ' 年 · ' + echo.age + ' 岁，' + (echo.eventTitle || '一件相关的事') +
        '（' + (echo.delay || 1) + ' 年后落地）';
    } else if (wait) {
      result = '这一步已经埋下伏笔：预计 ' + wait.dueAge + ' 岁兑现。' + (wait.note ? '（' + wait.note + '）' : '');
    } else {
      result = '当时的结果已经散在往后的日子里，还没有单独的回响记录。';
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

  function showStageOverlay(key, debug) {
    var m = LS.stageMark(key);
    if (!m) { closeOverlay(); if (!debug) renderGame(); return; }
    pauseStorySurface();
    var art = safePersonArt(game.gender, m.art || key);
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
      '<h2 class="stage-title">' + esc(m.title) + '</h2>' +
      '<p class="stage-desc">' + esc(m.desc) + '</p>' +
      recapHtml +
      '<button type="button" class="btn primary stage-continue" id="btnStageContinue">继续人生</button>' +
      '</div></div></div></div>');
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
    LS.save.autoSave(game);
    pauseStorySurface();
    var art = LS.artHas(e.art) ? LS.artEvent(e.art) : LS.artEvent('jobfair');
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

  function showBroadcast(b, debug) {
    if (!b) return;
    var art = (LS.artHas && LS.artHas(b.art)) ? '<div class="bc-art">' + LS.artEvent(b.art) + '</div>' : '';
    var chg = b.changes
      ? '<div class="bc-changes"><span class="bc-chg-label">实际变化</span>' + changeTone(b.changes) + '</div>'
      : '<div class="bc-changes muted">本回合没有产生可记录的数值变动。</div>';
    var merged = (b.merged && b.merged.length)
      ? '<div class="bc-merged">同回合同时发生：' + esc(b.merged.join('、')) + '（已合并播报）</div>' : '';
    openOverlay('bc-overlay',
      '<div class="bc-mask"><div class="bc-card tone-' + esc(b.tone || 'gold') + '">' +
      '<div class="bc-kicker">重大结果播报</div>' +
      '<h2 class="bc-title">【' + esc(b.title) + '】</h2>' +
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

  function sourceHtml(e) {
    var info = game.echoInfo;
    if (!info) {
      return '<b>此前</b> · 源自更早的境况：长期的生活方式或未被处理的压力累积到了这一步。';
    }
    var years = info.years || 1;
    var when = (game.year - years) + ' 年 · ' + (info.fromAge || 0) + ' 岁';
    if (info.kind === 'risk') {
      return '<b>长期隐患</b> · ' + esc(LS.RISK_LABEL[info.riskKey] || '健康透支') + '，已累积约 ' + years + ' 年（始于 ' + when + '）。';
    }
    var what = info.choiceLabel
      ? '当时你选择了「' + info.choiceLabel + '」'
      : (info.oneLiner || '当时做了一个影响很久的决定');
    return '<b>' + years + ' 年前</b> · ' + esc(when) + '：' + esc(what) +
      (info.sourceTitle ? '（' + esc(info.sourceTitle) + '）' : '');
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
      panel.insertBefore(el, text);
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

  function paintEvent(e) {
    var t = LS.tierOf(e);
    var et = $('eventType');
    et.innerHTML = '<span class="tier-icon">' + esc(t.icon) + '</span>' + esc(t.label);
    et.className = 'event-type ' + t.cls;
    $('turnNo').textContent = '第 ' + game.turn + ' 回合 · ' + LS.stageLabel(game.stage);
    $('eventTitle').textContent = e.title;
    $('eventTitle').className = 'tier-title ' + t.cls;
    $('storyText').textContent = e.text;
    paintQuietNote(e);
    var sp = $('storyPanel');
    sp.className = 'story ' + t.cls;
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

    /* 插图：日常不配；因果回响按需；命运岔路必配 */
    var showArt = e.tier === 'echo' || e.tier === 'crossroad';
    var artKey = e.art || (e.tier === 'crossroad' ? 'jobfair' : (e.tier === 'echo' ? 'clinic' : ''));
    if (showArt && artKey && LS.artHas(artKey)) {
      $('evArt').hidden = false;
      $('evArt').innerHTML = LS.artEvent(artKey);
      $('evArt').className = 'ev-art ' + t.cls;
    } else {
      $('evArt').hidden = true;
      $('evArt').innerHTML = '';
    }

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
    opts.className = 'options ' + t.cls;
    e.opts.forEach(function (opt, i) {
      var b = document.createElement('button');
      b.type = 'button';
      var toneCls = '';
      if (e.tier === 'crossroad') toneCls = ' tone-' + (opt.tone || (opt.gamble ? 'risk' : 'safe'));
      else if (e.tier === 'echo') toneCls = ' echo-opt';
      b.className = 'opt-btn opt-in' + toneCls;
      b.style.animationDelay = (i * 70) + 'ms';
      var rk = opt.risk && RISK_META[opt.risk];
      b.innerHTML = (rk ? '<span class="risk-badge ' + rk.cls + '">' + rk.text + '</span>' : '') +
        esc(opt.label) + (opt.hint ? '<span class="opt-cost">' + esc(opt.hint) + '</span>' : '') + '<span class="opt-arrow">›</span>';
      b.addEventListener('click', function () { onChoose(i); });
      opts.appendChild(b);
    });

    $('storyPanel').scrollTop = 0;
    if (DEBUG_MODE) buildDebugPanel();
  }

  function renderGame() {
    if (!game) return;
    if (game.death.dead) { renderEnd(); return; }

    $('sbTime').textContent = game.year + ' 年';
    $('sbAge').textContent = game.age + ' 岁';
    $('sbStage').textContent = stageBarText();
    $('sbAttrs').innerHTML = chips();
    paintSbMoney();

    /* 未确认的阶段总结优先于阶段过场 */
    if (game.pendingSummary) { showStageSummary(game.stageSummary); return; }

    /* 未确认的阶段过场优先，暂停一切事件推进 */
    if (game.pendingStage) { showStageOverlay(game.pendingStage); return; }

    if (!game.current) LS.engine.nextEvent(game);

    var e = game.current;
    if (!e) {
      $('eventTitle').textContent = '这一年无事发生';
      $('storyText').textContent = '没有新的节点，也没有意外。日子按原来的样子继续。';
      $('eventType').innerHTML = '平静一年';
      $('eventType').className = 'event-type tier-daily';
      $('eventTitle').className = 'tier-title tier-daily';
      $('turnNo').textContent = '第 ' + game.turn + ' 回合';
      $('options').innerHTML = '';
      $('options').className = 'options';
      $('sourceBar').hidden = true;
      $('evArt').hidden = true;
      $('annotationBar').hidden = true;
      $('storyPanel').className = 'story tier-daily';
      paintQuietNote(null);
      return;
    }

    /* 命运岔路：先遮罩过场，首次展示后标记，点“继续”才进入选择 */
    if (e.tier === 'crossroad') {
      var key = game.crossGate || (e.id + '@' + game.age);
      game.crossGate = key;
      if (!(game.crossSeen || {})[key]) {
        paintEvent(e);           /* 先让标题/标签与过场内容一致，再清空选项并遮罩 */
        showCrossGate(e, key);
        return;
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
    var items = [];
    (game.memories || []).forEach(function (m) {
      var tier = m.kind === 'echo' ? 'echo' : (m.kind === 'causal' ? 'echo' : (m.kind === 'crossroad' ? 'crossroad' : 'daily'));
      items.push({ age: m.age, year: m.year, tier: tier, text: m.text });
    });
    (game.choiceLog || []).forEach(function (c) {
      if (c.tier === 'crossroad') {
        items.push({ age: c.age, year: c.year, tier: 'crossroad', text: '命运岔路：' + c.title + '。你选择了「' + c.label + '」。' });
      }
    });
    (game.echoLog || []).forEach(function (x) {
      items.push({
        age: x.age, year: x.year, tier: 'echo',
        text: '因果回响：' + x.eventTitle + '（源自 ' + (x.delay || 1) + ' 年前' +
          (x.choiceLabel ? '的选择「' + x.choiceLabel + '」' : '的长期境况') + '）。'
      });
    });
    var seen = {};
    items = items.filter(function (it) {
      var k = it.age + '|' + it.text;
      if (seen[k]) return false;
      seen[k] = true;
      return true;
    });
    items.sort(function (a, b) { return a.age - b.age || a.year - b.year; });
    if (!items.length) return '<div class="empty-note">还没有值得记下的事。</div>';
    return '<div class="timeline">' + items.map(function (m) {
      var badge = m.tier === 'echo' ? '<span class="tl-badge echo">因果回响</span>'
        : (m.tier === 'crossroad' ? '<span class="tl-badge cross">命运岔路</span>' : '');
      return '<div class="tl-item ' + (m.tier === 'daily' ? '' : 'tl-' + m.tier) + '">' +
        '<div class="tl-year">' + m.year + ' 年 · ' + m.age + ' 岁' + badge + '</div>' +
        '<div class="tl-text">' + esc(m.text) + '</div></div>';
    }).join('') + '</div>';
  }

  function memoirChain() {
    var choices = (game.choiceLog || []).filter(function (c) { return c.tier === 'crossroad'; });
    var echoes = game.echoLog || [];
    var pending = game.pending || [];
    if (!choices.length && !echoes.length) {
      return '<div class="empty-note">还没有可串联的因果链。做出命运岔路的选择后，这里会自动把后续回响接起来。</div>';
    }
    choices.sort(function (a, b) { return a.age - b.age; });
    var used = {};
    var blocks = choices.map(function (c) {
      var key = c.key || (c.id + '@' + c.age);
      var kids = echoes.filter(function (x) { if (x.choiceId === key) { used[x.eventId + '@' + x.age] = true; return true; } return false; });
      var waits = pending.filter(function (p) { return p.choiceId === key; });
      var nodes = '';
      kids.forEach(function (x) {
        nodes += '<div class="chain-link"></div><div class="chain-node chain-echo">' +
          '<span class="chain-badge">因果回响</span><b>' + x.age + ' 岁 · ' + esc(x.eventTitle) + '</b>' +
          '<span class="chain-meta">' + (x.delay || 1) + ' 年后落地 · ' + x.year + ' 年</span></div>';
      });
      waits.forEach(function (p) {
        nodes += '<div class="chain-link dotted"></div><div class="chain-node chain-wait">' +
          '<span class="chain-badge wait">伏笔</span><b>预计 ' + p.dueAge + ' 岁兑现</b>' +
          '<span class="chain-meta">' + esc(p.note || '已埋下，尚未触发') + '</span></div>';
      });
      if (!nodes) nodes = '<div class="chain-link"></div><div class="chain-empty">这条岔路在这段人生里还没有形成明确的回响。</div>';
      return '<div class="chain-block"><div class="chain-node chain-choice">' +
        '<span class="chain-badge cross">命运岔路</span><b>' + c.age + ' 岁 · ' + esc(c.title) + '</b>' +
        '<span class="chain-meta">你选择了「' + esc(c.label) + '」</span></div>' + nodes + '</div>';
    }).join('');

    var others = echoes.filter(function (x) { return !used[x.eventId + '@' + x.age]; });
    var otherHtml = others.length
      ? '<div class="chain-block"><div class="chain-node chain-choice"><span class="chain-badge echo">其他回响</span><b>无明确岔路来源的因果回响</b></div>' +
      others.map(function (x) {
        return '<div class="chain-link"></div><div class="chain-node chain-echo">' +
          '<span class="chain-badge">因果回响</span><b>' + x.age + ' 岁 · ' + esc(x.eventTitle) + '</b>' +
          '<span class="chain-meta">源自 ' + (x.delay || 1) + ' 年前' + (x.choiceLabel ? '「' + esc(x.choiceLabel) + '」' : '的长期境况') + ' · ' + x.year + ' 年</span></div>';
      }).join('') + '</div>'
      : '';
    return '<div class="chain-legend">每一段链条都来自真实的 choiceId 与年份匹配，不是文案拼接。</div>' +
      blocks + otherHtml;
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
    closeModal();
    closeOverlay();
    show('screen-game');
    if (game.death.dead) {
      if (!game.summary) LS.engine.finish(game, game.death.reason || '身体机能衰竭');
      renderEnd();
      return;
    }
    if (game.pendingSummary) {
      $('sbTime').textContent = game.year + ' 年';
      $('sbAge').textContent = game.age + ' 岁';
      $('sbStage').textContent = stageBarText();
      $('sbAttrs').innerHTML = chips();
      paintSbMoney();
      showStageSummary(game.stageSummary);
      return;
    }
    if (game.pendingStage) {
      $('sbTime').textContent = game.year + ' 年';
      $('sbAge').textContent = game.age + ' 岁';
      $('sbStage').textContent = stageBarText();
      $('sbAttrs').innerHTML = chips();
      paintSbMoney();
      showStageOverlay(game.pendingStage);
      return;
    }
    var b = takePending();
    if (b) {
      $('sbTime').textContent = game.year + ' 年';
      $('sbAge').textContent = game.age + ' 岁';
      $('sbStage').textContent = stageBarText();
      $('sbAttrs').innerHTML = chips();
      paintSbMoney();
      showBroadcast(b);
      return;
    }
    if (!game.current) LS.engine.nextEvent(game);
    renderGame();
    LS.save.autoSave(game);
  }

  /* 轻量 toast：跳过平淡年等操作后的短提示 */
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

  /* 右下角常驻：跳过平淡年（纯点击，最多 8 年） */
  function skipQuietYears() {
    if (!game || game.death.dead) return;
    var h = overlayHost();
    if (h && !h.hidden) return;
    var r = LS.engine.skipQuiet(game);
    if (r && r.years > 0) {
      LS.save.autoSave(game);
      if (r.note) showToast(r.note);
      renderGame();
    } else {
      showToast('这一年没有可以跳过的平淡日子。');
    }
  }

  function bindGame() {
    $('btnDetail').addEventListener('click', openDetail);
    $('btnSave').addEventListener('click', function () { openSaveModal('save'); });
    $('btnLoad').addEventListener('click', function () { openSaveModal('load'); });
    $('btnMemoir').addEventListener('click', function () { openMemoir('time'); });
    var skip = $('btnSkipQuiet');
    if (skip) skip.addEventListener('click', skipQuietYears);
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
    var survHtml = survivors.length
      ? survivors.map(function (p) {
        return '<div class="survivor-row"><span class="sv-name">' + esc(p.name || '——') + '</span>' +
          '<span class="sv-role">' + esc(p.role || '') + '</span><span class="sv-stage">' + esc(p.stage || '') + '</span></div>';
      }).join('')
      : '<div class="empty-note">最后，身边没有留下什么人。</div>';
    var legacy = s.legacyOut || {};
    var legacyHtml = (Number(legacy.reputation) || Number(legacy.cash))
      ? '<div class="legacy-note">传承 · 这一世留下：声望 +' + esc(legacy.reputation || 0) + ' · 现金 +' + esc(LS.fmtMoney(legacy.cash || 0)) +
        '<span class="legacy-tip">下一局开局自动带入</span></div>'
      : '<div class="legacy-note muted">传承 · 这一世没有留下可被继承的声望或现金。</div>';

    var html =
      '<div class="end-head">' +
      '<div class="end-kicker">人生结算 · LIFE SUMMARY</div>' +
      '<div class="end-title">' + esc(s.name) + '　' + s.age + ' 岁</div>' +
      '<div class="end-sub">' + s.birthYear + ' 年 — ' + s.deathYear + ' 年　·　' + esc(s.reason) + '　·　出生于' + esc(game.birthplace) + '，' + esc(game.background) + '家庭　·　随机种子 ' + s.seed + '</div>' +
      '</div>' +
      '<div class="end-cards">' + cards.map(function (c) {
        return '<div class="end-card"><div class="k">' + c.k + '</div><div class="v ' + (c.small ? 'small' : '') + '">' + esc(c.v) + '</div><div class="x">' + esc(c.x) + '</div></div>';
      }).join('') + '</div>' +

      '<div class="end-section"><h3>人生六维</h3>' +
      '<div class="end-v3-grid">' +
      radarSvg(s.radar) +
      '<div class="end-v3-side">' +
      tagsHtml +
      '<div class="epitaph">' + esc(s.epitaph || s.evaluation || '') + '</div>' +
      legacyHtml +
      '</div></div></div>' +

      '<div class="end-section"><h3>谁还在你身边</h3><div class="survivor-list">' + survHtml + '</div></div>' +

      '<div class="end-section"><h3>一生属性变化</h3>' + chartSvg(s.history) + '</div>' +

      '<div class="end-section"><h3>人生大事记</h3>' +
      '<div class="memoir-open"><div class="memory-actions">' +
      '<button type="button" class="btn tiny" id="btnEndMemoirTime">回忆录 · 时间线</button>' +
      '<button type="button" class="btn tiny" id="btnEndMemoirChain">回忆录 · 因果链</button>' +
      '</div><div class="end-note">两种视角阅读这一生，所有记忆都已经留在里面。</div></div>' +
      timeline + '</div>' +

      '<div class="end-section"><h3>履历汇总</h3>' +
      '<div class="detail-grid">' +
      '<div class="detail-block"><h4>教育</h4>' + (eduLines || '<div class="empty-note">未入学</div>') + '</div>' +
      '<div class="detail-block"><h4>职业变迁</h4>' + jobLines + '</div>' +
      '<div class="detail-block"><h4>婚姻与子女</h4>' +
      '<div class="kv"><span>婚姻</span><span>' + esc(s.marriage.status) + (s.marriage.spouseName ? ' · ' + esc(s.marriage.spouseName) : '') + '</span></div>' +
      '<div class="kv"><span>婚龄</span><span>' + s.marriage.years + ' 年</span></div>' +
      childLines + '</div>' +
      '<div class="detail-block"><h4>资产负债终值</h4>' +
      '<div class="kv"><span>现金</span><span>' + esc(LS.fmtMoney(s.cash)) + '</span></div>' +
      '<div class="kv"><span>固定资产</span><span>' + esc(LS.fmtMoney(s.assets)) + '</span></div>' +
      '<div class="kv"><span>负债</span><span>' + esc(LS.fmtMoney(s.debt)) + '</span></div>' +
      '<div class="kv"><span>净资产</span><span>' + esc(LS.fmtMoney(s.netWorth)) + '</span></div>' +
      '</div></div></div>' +

      '<div class="end-section"><h3>成就</h3><div class="ach-grid">' + achHtml + '</div></div>' +

      '<div class="end-section"><h3>评价</h3><div class="evaluation">' + esc(s.evaluation) + '</div></div>' +

      '<div class="end-actions">' +
      '<button class="btn share-btn" id="btnShareCard">导出分享卡</button>' +
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
    fillSelects();
    bindWelcome();
    bindCreate();
    bindGame();
    resetCreate();
    // 暴露给测试脚本使用
    LS.ui = {
      getGame: function () { return game; },
      setGame: function (g) { game = g; show('screen-game'); renderGame(); },
      render: renderGame,
      renderEnd: renderEnd,
      openDetail: openDetail,
      openMemoir: openMemoir,
      handleResult: handleResult,
      showStage: showStageOverlay,
      showSummary: showStageSummary,
      showBroadcast: showBroadcast,
      radarSvg: radarSvg,
      exportShareCard: exportShareCard,
      openCodex: openCodex,
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
