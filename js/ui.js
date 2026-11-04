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

  function resetCreate() {
    selTalents = [];
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
  function chips() {
    var a = game.attrs;
    return [
      { k: '学识', v: Math.round(a.knowledge) },
      { k: '健康', v: Math.round(a.health) },
      { k: '现金', v: LS.fmtMoney(game.money.cash), cls: 'cash' },
      { k: '固定资产', v: LS.fmtMoney(game.money.assets), cls: 'asset' },
      { k: '幸福感', v: Math.round(a.happiness) },
      { k: '声望', v: LS.repTotal(game) }
    ].map(function (x) {
      return '<div class="sb-chip ' + (x.cls || '') + '"><span class="lbl">' + x.k + '</span><span class="val">' + esc(x.v) + '</span></div>';
    }).join('');
  }

  var EVENT_LABEL = { forced: '命运节点', causal: '因果回响', random: '日常际遇', daily: '平静一年' };

  /* ---------------- v2 遮罩：阶段过场 / 命运岔路口 / 重大结果播报 ---------------- */
  function overlayHost() { return $('v2Overlay'); }
  function closeOverlay() {
    var h = overlayHost();
    h.hidden = true;
    h.className = 'v2-overlay';
    h.innerHTML = '';
    h.scrollTop = 0;
  }
  function openOverlay(kind, html) {
    var h = overlayHost();
    h.className = 'v2-overlay show ' + kind;
    h.innerHTML = html;
    h.hidden = false;
    h.scrollTop = 0;
  }

  function handleResult(r) {
    if (!r || !r.ok) {
      openModal('无法推进', '<p class="empty-note">' + esc((r && r.error) || '发生未知错误') + '</p>');
      return;
    }
    if (r.dead) { renderEnd(); return; }
    if (r.paused === 'stage') { showStageOverlay(r.stage); return; }
    if (r.paused === 'broadcast') { showBroadcast(r.broadcast); return; }
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

  function showStageOverlay(key, debug) {
    var m = LS.stageMark(key);
    if (!m) { closeOverlay(); if (!debug) renderGame(); return; }
    pauseStorySurface();
    var art = LS.artPerson(game.gender, key);
    openOverlay('stage-overlay',
      '<div class="stage-mask">' +
      '<div class="stage-card">' +
      '<div class="stage-kicker">人生阶段 · ' + esc(m.label) + ' · ' + m.age + ' 岁</div>' +
      '<div class="stage-art">' + art + '</div>' +
      '<h2 class="stage-title">' + esc(m.title) + '</h2>' +
      '<p class="stage-desc">' + esc(m.desc) + '</p>' +
      '<button type="button" class="btn primary stage-continue" id="btnStageContinue">继续人生</button>' +
      '</div></div>');
    $('btnStageContinue').addEventListener('click', function () {
      closeOverlay();
      if (debug) { renderGame(); return; }
      var r = LS.engine.continueAfter(game);
      LS.save.autoSave(game);
      handleResult(r);
    });
    if (!debug) LS.save.autoSave(game);
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

  function paintEvent(e) {
    var t = LS.tierOf(e);
    var et = $('eventType');
    et.innerHTML = '<span class="tier-icon">' + esc(t.icon) + '</span>' + esc(t.label);
    et.className = 'event-type ' + t.cls;
    $('turnNo').textContent = '第 ' + game.turn + ' 回合 · ' + LS.stageLabel(game.stage);
    $('eventTitle').textContent = e.title;
    $('eventTitle').className = 'tier-title ' + t.cls;
    $('storyText').textContent = e.text;
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
      b.innerHTML = esc(opt.label) + (opt.hint ? '<span class="opt-cost">' + esc(opt.hint) + '</span>' : '') + '<span class="opt-arrow">›</span>';
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
    $('sbStage').textContent = LS.stageLabel(game.stage);
    $('sbAttrs').innerHTML = chips();

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

  function onChoose(index) {
    if (!game || game.death.dead) return;
    var buttons = $('options').querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) buttons[i].disabled = true;

    var r = LS.engine.resolve(game, index);
    if (!r.ok) {
      openModal('无法推进', '<p class="empty-note">' + esc(r.error || '发生未知错误') + '</p>');
      return;
    }
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

  function openMemoir() {
    if (!game) return;
    var html = '<div class="memoir-tabs">' +
      '<button type="button" class="memoir-tab on" data-mt="time">时间线视图</button>' +
      '<button type="button" class="memoir-tab" data-mt="chain">因果链视图</button>' +
      '</div><div id="memoirBody" class="memoir-body">' + memoirTimeline() + '</div>';
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
    if (game.pendingStage) {
      $('sbTime').textContent = game.year + ' 年';
      $('sbAge').textContent = game.age + ' 岁';
      $('sbStage').textContent = LS.stageLabel(game.stage);
      $('sbAttrs').innerHTML = chips();
      showStageOverlay(game.pendingStage);
      return;
    }
    var b = takePending();
    if (b) {
      $('sbTime').textContent = game.year + ' 年';
      $('sbAge').textContent = game.age + ' 岁';
      $('sbStage').textContent = LS.stageLabel(game.stage);
      $('sbAttrs').innerHTML = chips();
      showBroadcast(b);
      return;
    }
    if (!game.current) LS.engine.nextEvent(game);
    renderGame();
    LS.save.autoSave(game);
  }

  function bindGame() {
    $('btnDetail').addEventListener('click', openDetail);
    $('btnSave').addEventListener('click', function () { openSaveModal('save'); });
    $('btnLoad').addEventListener('click', function () { openSaveModal('load'); });
    $('btnMemoir').addEventListener('click', openMemoir);
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

    var html =
      '<div class="end-head">' +
      '<div class="end-kicker">人生结算 · LIFE SUMMARY</div>' +
      '<div class="end-title">' + esc(s.name) + '　' + s.age + ' 岁</div>' +
      '<div class="end-sub">' + s.birthYear + ' 年 — ' + s.deathYear + ' 年　·　' + esc(s.reason) + '　·　出生于' + esc(game.birthplace) + '，' + esc(game.background) + '家庭　·　随机种子 ' + s.seed + '</div>' +
      '</div>' +
      '<div class="end-cards">' + cards.map(function (c) {
        return '<div class="end-card"><div class="k">' + c.k + '</div><div class="v ' + (c.small ? 'small' : '') + '">' + esc(c.v) + '</div><div class="x">' + esc(c.x) + '</div></div>';
      }).join('') + '</div>' +

      '<div class="end-section"><h3>一生属性变化</h3>' + chartSvg(s.history) + '</div>' +

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

      '<div class="end-section"><h3>人生时间轴</h3>' + timeline + '</div>' +

      '<div class="end-actions">' +
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
      '<div class="debug-group"><div class="debug-label">阶段过场（点【继续人生】前主循环暂停）</div>' +
      ['youth', 'midlife', 'elder'].map(function (k) {
        var m = LS.stageMark(k);
        return '<button type="button" data-stage="' + k + '">' + esc(m.title) + '</button>';
      }).join('') + '</div>' +
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
      } else if (t.dataset.act === 'hunt') {
        debugHunt();
      } else if (t.dataset.act === 'memoir') {
        openMemoir();
        setTimeout(function () {
          var b = $('modalBody').querySelector('[data-mt="chain"]');
          if (b) b.click();
        }, 0);
      }
    });
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
      showBroadcast: showBroadcast,
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
          $('sbStage').textContent = LS.stageLabel(game.stage);
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
