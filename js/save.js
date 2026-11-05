/* =========================================================
   save.js — localStorage 5 槽位 + 自动存档 + JSON 导入导出
   ========================================================= */
(function () {
  'use strict';
  var LS = window.LS;

  function storage() {
    try {
      if (window.localStorage) {
        var k = '__lifesim_test__';
        window.localStorage.setItem(k, '1');
        window.localStorage.removeItem(k);
        return window.localStorage;
      }
    } catch (e) { /* file:// 下部分浏览器会禁用 */ }
    return null;
  }

  var store = storage();
  var memory = {};
  LS.save = {
    available: !!store,
    SLOT_COUNT: LS.SLOT_COUNT || 5
  };

  function slotKey(n) { return LS.SAVE_PREFIX + 'slot' + n; }
  function autoKey() { return LS.SAVE_PREFIX + 'auto'; }

  function rawGet(key) {
    if (store) return store.getItem(key);
    return memory[key] || null;
  }
  function rawSet(key, val) {
    if (store) store.setItem(key, val);
    else memory[key] = val;
  }
  function rawRemove(key) {
    if (store) store.removeItem(key);
    else delete memory[key];
  }

  function cloneGame(g) {
    g.rngState = LS.RNG.state;
    var copy = {};
    for (var k in g) {
      if (k === 'current') continue;
      copy[k] = g[k];
    }
    copy.current = null;
    return copy;
  }

  function metaOf(g) {
    return {
      name: g.name,
      gender: g.gender,
      age: g.age,
      year: g.year,
      stage: g.stage,
      turn: g.turn,
      dead: !!(g.death && g.death.dead),
      birthplace: g.birthplace,
      background: g.background,
      edu: LS.eduName(g.edu.level),
      job: g.job.id ? LS.JOBS[g.job.id].name : '待业',
      savedAt: new Date().toISOString()
    };
  }

  function serialize(g) {
    var payload = {
      v: LS.VERSION,
      savedAt: new Date().toISOString(),
      meta: metaOf(g),
      game: cloneGame(g)
    };
    return JSON.stringify(payload);
  }

  /* v2 存档迁移：v1 存档没有隐患/日志/过场/播报字段，补默认值并修复旧 NaN 声望 */
  function migrate(g) {
    var ATTRS = ['knowledge', 'health', 'finance', 'charm', 'happiness', 'reputation'];
    ATTRS.forEach(function (k) {
      if (g.attrs[k] === undefined || isNaN(g.attrs[k])) g.attrs[k] = (k === 'reputation') ? 30 : 50;
      g.attrs[k] = LS.clamp(Math.round(g.attrs[k]), 1, 100);
    });
    if (g.attrs.stress === undefined || isNaN(g.attrs.stress)) g.attrs.stress = 40;
    g.attrs.stress = LS.clamp(Math.round(g.attrs.stress), 0, 100);
    if (!g.risks) g.risks = {};
    LS.RISK_KEYS.forEach(function (k) {
      if (g.risks[k] === undefined || isNaN(g.risks[k])) g.risks[k] = 0;
    });
    if (!g.riskOrigin) g.riskOrigin = {};
    if (!Array.isArray(g.choiceLog)) g.choiceLog = [];
    if (!Array.isArray(g.echoLog)) g.echoLog = [];
    if (!Array.isArray(g.healthNegLog)) g.healthNegLog = [];
    if (!g.stageSeen) g.stageSeen = {};
    /* v3：v2 存档只有 youth/midlife/elder 三个 key，infant/child/teen/late 保持未设置，过场才会触发 */
    if (g.pendingStage === undefined) g.pendingStage = null;
    if (!Array.isArray(g.pendingBroadcasts)) g.pendingBroadcasts = [];
    if (g.lastBroadcastTurn === undefined) g.lastBroadcastTurn = -99;
    if (!Array.isArray(g.broadcastAges)) g.broadcastAges = [];
    if (g.echoInfo === undefined) g.echoInfo = null;
    if (!g.crossSeen) g.crossSeen = {};
    if (g.crossGate === undefined) g.crossGate = null;
    if (!g.flags) g.flags = {};
    if (!g.currentTier) g.currentTier = (g.current && g.current.tier) || 'daily';
    if (!g.job) g.job = {};
    if (!Array.isArray(g.job.history)) g.job.history = [];
    if (g.job.huntTries === undefined) g.job.huntTries = 0;
    if (g.job.lastHunt === undefined) g.job.lastHunt = null;
    if (!g.job.tags && g.job.id && LS.engine && LS.engine.jobTagsOf) g.job.tags = LS.engine.jobTagsOf(g.job.id);
    if (!g.stats) g.stats = {};
    ['healthNegAge', 'healthNegCount', 'huntFail', 'echoesSeen', 'crossroadsSeen'].forEach(function (k) {
      if (g.stats[k] === undefined) g.stats[k] = (k === 'healthNegAge') ? -99 : 0;
    });
    /* v3 存档迁移：抉择计数、事件池、平淡年、阶段总结、时代、NPC 弧线与跨局传承 */
    if (g.decisionCount === undefined || isNaN(g.decisionCount)) g.decisionCount = 0;
    if (!Array.isArray(g.eventSeen)) g.eventSeen = [];
    if (!g.eventCD || typeof g.eventCD !== 'object' || Array.isArray(g.eventCD)) g.eventCD = {};
    if (g.quietYears === undefined || isNaN(g.quietYears)) g.quietYears = 0;
    if (typeof g.quietNote !== 'string') g.quietNote = '';
    if (!Array.isArray(g.quietNoteSeen)) g.quietNoteSeen = [];
    if (g.stageSummary === undefined) g.stageSummary = null;
    if (g.pendingSummary === undefined) g.pendingSummary = false;
    if (!Array.isArray(g.stageImpact)) g.stageImpact = [];
    if (g.stageImpactRuns === undefined || isNaN(g.stageImpactRuns)) g.stageImpactRuns = 0;
    if (!Array.isArray(g.recap)) g.recap = [];
    if (!g.epoch || typeof g.epoch !== 'object' || Array.isArray(g.epoch)) {
      g.epoch = { name: '平稳年代', mods: {}, until: null };
    } else {
      if (!g.epoch.name) g.epoch.name = '平稳年代';
      if (!g.epoch.mods || typeof g.epoch.mods !== 'object') g.epoch.mods = {};
      if (g.epoch.until === undefined) g.epoch.until = null;
    }
    if (!g.npcArc || typeof g.npcArc !== 'object' || Array.isArray(g.npcArc)) g.npcArc = {};
    if (!Array.isArray(g.npcInitiated)) g.npcInitiated = [];
    if (!g.legacy || typeof g.legacy !== 'object' || Array.isArray(g.legacy)) {
      g.legacy = { reputation: 0, cash: 0, source: null };
    } else {
      if (g.legacy.reputation === undefined || isNaN(g.legacy.reputation)) g.legacy.reputation = 0;
      if (g.legacy.cash === undefined || isNaN(g.legacy.cash)) g.legacy.cash = 0;
      if (g.legacy.source === undefined) g.legacy.source = null;
    }
    /* v3.2：善缘/报复/多结局/社交/分轨/阻断 */
    if (!Array.isArray(g.kindnessLog)) g.kindnessLog = [];
    if (!Array.isArray(g.payoffLog)) g.payoffLog = [];
    if (!Array.isArray(g.revengeLog)) g.revengeLog = [];
    if (!Array.isArray(g.outcomeLog)) g.outcomeLog = [];
    if (!g.eventFamilies || typeof g.eventFamilies !== 'object' || Array.isArray(g.eventFamilies)) g.eventFamilies = {};
    if (g.blockedTurn === undefined || isNaN(g.blockedTurn)) g.blockedTurn = -99;
    if (!Array.isArray(g.blockerLog)) g.blockerLog = [];
    if (g.track === undefined) g.track = null;
    if (!g.sibling || typeof g.sibling !== 'object') g.sibling = { has: false, role: null, name: null, ageGap: 0 };
    if (!g.circles || typeof g.circles !== 'object') g.circles = {};
    LS.CIRCLES.forEach(function (c) {
      if (!g.circles[c] || isNaN(g.circles[c].rep)) g.circles[c] = { rep: 50 };
    });
    if (!g.socialQuota || typeof g.socialQuota !== 'object') {
      g.socialQuota = { year: g.year, used: 0, max: 1 };
    }
    if (g.socialQuota.max === undefined) g.socialQuota.max = 1;
    if (g.socialQuota.used === undefined) g.socialQuota.used = 0;
    /* 旧档 NPC：favor 曾是 0-100 亲密度，迁移为 intimacy；人情账归零 */
    (g.npcs || []).forEach(function (n) {
      if (n.intimacy === undefined || isNaN(n.intimacy)) {
        if (Math.abs(Number(n.favor) || 0) > 10) {
          n.intimacy = LS.clamp(Number(n.favor), 0, 100);
          n.favor = 0;
        } else {
          n.intimacy = LS.clamp(50 + (Number(n.favor) || 0) * 6, 0, 100);
        }
      }
      n.favor = LS.clamp(Number(n.favor) || 0, -5, 5);
      if (!Array.isArray(n.anchors)) n.anchors = [];
      if (!n.state) n.state = { job: null, health: n.health === undefined ? 75 : n.health, status: null };
      if (!n.circle) n.circle = LS.circleOf(n.role);
      if (n.lastContactYear === undefined) n.lastContactYear = null;
      if (!n.arcStage) n.arcStage = '相遇';
      n.relation = LS.relationOf(n);
    });
    if (g.milestones) delete g.milestones;
    /* v3.3：eventLog 为唯一事实源；旧档没有这份日志时明确降级，绝不根据 memories 补造 */
    if (!Array.isArray(g.eventLog)) {
      g.eventLog = [];
      g.eventLogLegacy = true;
    }
    if (g.eventSeq === undefined || isNaN(g.eventSeq)) {
      var maxSeq = 0;
      g.eventLog.forEach(function (x) { if (Number(x && x.seq) > maxSeq) maxSeq = Number(x.seq); });
      g.eventSeq = maxSeq;
    }
    if (g.eventLog.length === 0 && g.eventLogLegacy === undefined) g.eventLogLegacy = true;
    if (!Array.isArray(g.achievementsV3)) g.achievementsV3 = [];
    if (g.lastSummaryAt === undefined || isNaN(g.lastSummaryAt)) g.lastSummaryAt = -99;
    if (!g.stageStart && LS.stageSnapshot) g.stageStart = LS.stageSnapshot(g);
    /* v3.6：九条线 / 身世 / 承诺 / 线索（旧档补空状态，不补造剧情） */
    if (LS.LINES && LS.LINES.init) LS.LINES.init(g);
    if (!Array.isArray(g.clues)) g.clues = [];
    if (!Array.isArray(g.promises)) g.promises = [];
    if (!g.colSeen) g.colSeen = {};
    if (!g.lineAP) g.lineAP = { year: g.year, used: 0, max: 2 };
    g.migratedTo = LS.VERSION;
    return g;
  }
  LS.save.migrate = migrate;

  function revive(text) {
    if (!text) return null;
    var obj = JSON.parse(text);
    var g = obj.game || obj;
    if (!g || !g.attrs || !g.money || !g.npcs) throw new Error('存档内容不完整');
    if (!Array.isArray(g.npcs) || !Array.isArray(g.memories) || !Array.isArray(g.pending)) {
      throw new Error('存档结构不正确');
    }
    g.current = null;
    if (g.currentId && LS.EVENT_INDEX[g.currentId]) g.current = LS.EVENT_INDEX[g.currentId];
    if (g.rngState === undefined) g.rngState = g.seed || 1;
    LS.RNG.state = g.rngState >>> 0;
    return migrate(g);
  }

  LS.save.saveSlot = function (g, slot) {
    try {
      rawSet(slotKey(slot), serialize(g));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message || '写入失败' };
    }
  };

  LS.save.loadSlot = function (slot) {
    try {
      var txt = rawGet(slotKey(slot));
      if (!txt) return { ok: false, error: '该槽位没有存档' };
      return { ok: true, game: revive(txt) };
    } catch (e) {
      return { ok: false, error: '存档损坏：' + (e.message || '') };
    }
  };

  LS.save.autoSave = function (g) {
    try {
      rawSet(autoKey(), serialize(g));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message || '自动存档失败' };
    }
  };

  LS.save.loadAuto = function () {
    try {
      var txt = rawGet(autoKey());
      if (!txt) return { ok: false, error: '没有自动存档' };
      return { ok: true, game: revive(txt) };
    } catch (e) {
      return { ok: false, error: '自动存档损坏：' + (e.message || '') };
    }
  };

  LS.save.slotInfo = function (slot) {
    try {
      var txt = rawGet(slotKey(slot));
      if (!txt) return null;
      var obj = JSON.parse(txt);
      return obj.meta || null;
    } catch (e) {
      return { broken: true };
    }
  };

  LS.save.autoInfo = function () {
    try {
      var txt = rawGet(autoKey());
      if (!txt) return null;
      var obj = JSON.parse(txt);
      return obj.meta || null;
    } catch (e) {
      return { broken: true };
    }
  };

  LS.save.list = function () {
    var out = [];
    for (var i = 1; i <= LS.save.SLOT_COUNT; i++) {
      out.push({ slot: i, meta: LS.save.slotInfo(i) });
    }
    return out;
  };

  LS.save.clearSlot = function (slot) {
    rawRemove(slotKey(slot));
  };

  LS.save.exportText = function (g) {
    return serialize(g);
  };

  LS.save.download = function (g) {
    try {
      var txt = serialize(g);
      var blob = new Blob([txt], { type: 'application/json;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      var stamp = new Date();
      var pad = function (n) { return (n < 10 ? '0' : '') + n; };
      a.href = url;
      a.download = 'lifesim_' + g.year + '_' +
        stamp.getFullYear() + pad(stamp.getMonth() + 1) + pad(stamp.getDate()) +
        pad(stamp.getHours()) + pad(stamp.getMinutes()) + '.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 120);
      return { ok: true, size: txt.length };
    } catch (e) {
      return { ok: false, error: e.message || '导出失败' };
    }
  };

  LS.save.importText = function (text) {
    try {
      var g = revive(text);
      return { ok: true, game: g };
    } catch (e) {
      return { ok: false, error: '导入失败：' + (e.message || '') };
    }
  };

  LS.save.importFile = function (file, cb) {
    if (!file) { cb({ ok: false, error: '没有选择文件' }); return; }
    var reader = new FileReader();
    reader.onload = function () {
      cb(LS.save.importText(String(reader.result || '')));
    };
    reader.onerror = function () { cb({ ok: false, error: '文件读取失败' }); };
    reader.readAsText(file, 'utf-8');
  };

  LS.save.sizeOf = function (g) {
    return serialize(g).length;
  };
})();
