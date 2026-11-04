/* =========================================================
   social.js — 社交关系系统（亲密度 / 人情账 / 记忆锚点 / 圈子 / 配额）
   ========================================================= */
(function () {
  'use strict';
  var LS = window.LS;

  var SOCIAL = LS.SOCIAL = {
    /* 主动社交动作：耗时/花钱/伤身，一年只有 1-2 次 */
    ACTIONS: {
      '陪': { label: '陪一陪', money: 0, health: 0, stress: -4, intimacy: 6, favor: 0, text: '你抽了半天时间陪{{name}}聊了聊' },
      '送礼': { label: '送份礼', money: 500, health: 0, stress: 0, intimacy: 5, favor: 1, text: '你给{{name}}带了一份不轻不重的礼' },
      '帮忙': { label: '搭把手', money: 0, health: -2, stress: 3, intimacy: 9, favor: 1, text: '你放下自己的事，去帮{{name}}搭了把手' },
      '借钱': { label: '借一笔', money: -2000, health: 0, stress: 2, intimacy: 4, favor: 2, text: '你借给{{name}}两千块，没催' },
      '介绍': { label: '牵个线', money: 0, health: 0, stress: 1, intimacy: 5, favor: 1, text: '你把{{name}}介绍给了另一个圈子的人' }
    },
    /* 人情账兑现概率：favor 1..5，叠加圈子声望 */
    payoffTable: [
      { favor: 1, p: 0.08 }, { favor: 2, p: 0.15 }, { favor: 3, p: 0.25 },
      { favor: 4, p: 0.38 }, { favor: 5, p: 0.55 }
    ],
    revengeTable: [
      { favor: -1, p: 0.06 }, { favor: -2, p: 0.12 }, { favor: -3, p: 0.22 },
      { favor: -4, p: 0.35 }, { favor: -5, p: 0.50 }
    ],
    circleResource: {
      '亲属圈': '借钱/照护', '同学圈': '内推/打听', '发小圈': '借钱/入伙',
      '同事圈': '内推/顶班', '行业圈': '门路/客户', '兴趣圈': '介绍对象/搭子'
    }
  };

  SOCIAL.payoffChance = function (favor, rep) {
    var f = Math.abs(Number(favor) || 0);
    var p = 0;
    for (var i = 0; i < SOCIAL.payoffTable.length; i++) {
      if (f >= SOCIAL.payoffTable[i].favor) p = SOCIAL.payoffTable[i].p;
    }
    if (f >= 5) p = 0.55;
    return LS.clamp(p + ((Number(rep) || 50) - 50) / 100 * 0.12, 0.02, 0.75);
  };
  SOCIAL.revengeChance = function (favor) {
    var f = Math.abs(Number(favor) || 0);
    var p = 0;
    for (var i = 0; i < SOCIAL.revengeTable.length; i++) {
      if (f >= Math.abs(SOCIAL.revengeTable[i].favor)) p = SOCIAL.revengeTable[i].p;
    }
    return LS.clamp(p, 0.02, 0.65);
  };
  SOCIAL.askChance = function (g, npc, kind) {
    var circleRep = LS.circleRep(g, npc.circle);
    var base = 0.45 * circleRep / 100 + 0.55 * (Number(npc.intimacy) || 0) / 100;
    if (kind === 'borrow') base -= 0.10;
    if (kind === 'refer') base -= 0.05;
    if (npc.favor > 0) base += npc.favor * 0.03;
    if (npc.favor < 0) base += npc.favor * 0.05;
    return LS.clamp(base, 0.05, 0.92);
  };

  /* 每年重置社交配额 */
  SOCIAL.beginYear = function (g) {
    if (!g.socialQuota) g.socialQuota = { year: g.year, used: 0, max: 1 };
    if (g.socialQuota.year !== g.year) {
      g.socialQuota.year = g.year;
      g.socialQuota.used = 0;
      g.socialQuota.max = 1 + ((Number(g.attrs.charm) || 0) >= 60 ? 1 : 0);
    }
    return g.socialQuota;
  };
  SOCIAL.quota = function (g) {
    SOCIAL.beginYear(g);
    return { used: g.socialQuota.used, max: g.socialQuota.max, left: Math.max(0, g.socialQuota.max - g.socialQuota.used) };
  };

  /* 亲密度衰减：连续 3 年无互动 -2（亲属 -1）；人情账不衰减 */
  SOCIAL.decay = function (g) {
    (g.npcs || []).forEach(function (n) {
      if (!n.alive) return;
      var last = n.lastContactYear === null || n.lastContactYear === undefined ? g.year : n.lastContactYear;
      if (g.year - last >= 3) {
        var drop = n.circle === '亲属圈' ? 1 : 2;
        if (g.age < 18) drop = 1;
        n.intimacy = LS.clamp((Number(n.intimacy) || 0) - drop, 0, 100);
        n.relation = LS.relationOf(n);
      }
    });
  };

  /* 互动：记录最近联系年份 + 锚点 */
  SOCIAL.touch = function (g, npc, kind, text, dIntimacy, dFavor) {
    if (!npc) return null;
    npc.lastContactYear = g.year;
    if (typeof dIntimacy === 'number' || typeof dFavor === 'number') {
      if (dIntimacy) npc.intimacy = LS.clamp((Number(npc.intimacy) || 0) + dIntimacy, 0, 100);
      if (dFavor) npc.favor = LS.clamp((Number(npc.favor) || 0) + dFavor, -5, 5);
    }
    var rec = LS.addAnchor(g, npc, kind || 'contact', text || ('你和' + npc.name + '见了一面'), 0, 0);
    npc.relation = LS.relationOf(npc);
    return rec;
  };

  /* 善缘：记入 kindnessLog，10-20 年后可兑现 */
  SOCIAL.kindness = function (g, npc, kind, text, opt) {
    if (!npc) return null;
    opt = opt || {};
    SOCIAL.touch(g, npc, kind, text, opt.intimacy === undefined ? 8 : opt.intimacy, opt.favor === undefined ? 1 : opt.favor);
    var rec = {
      id: 'k' + (g.kindnessLog.length + 1),
      year: g.year,
      age: g.age,
      npcId: npc.id,
      npcName: npc.name,
      circle: npc.circle,
      kind: kind || 'help',
      text: String(text || ''),
      choiceId: (g._ctxChoice && g._ctxChoice.key) || '',
      favor: Number(npc.favor) || 0,
      amount: opt.amount || 0,
      resolved: false,
      dueFrom: g.year + 10,
      dueTo: g.year + 20
    };
    g.kindnessLog.push(rec);
    LS.circleRep(g, npc.circle, 2);
    return rec;
  };

  /* 负锚点：记入 revengeLog，10-20 年后可能报复 */
  SOCIAL.wrong = function (g, npc, kind, text, opt) {
    if (!npc) return null;
    opt = opt || {};
    SOCIAL.touch(g, npc, kind, text, opt.intimacy === undefined ? -12 : opt.intimacy, opt.favor === undefined ? -2 : opt.favor);
    var rec = {
      id: 'r' + (g.revengeLog.length + 1),
      year: g.year,
      age: g.age,
      npcId: npc.id,
      npcName: npc.name,
      circle: npc.circle,
      kind: kind || 'offend',
      text: String(text || ''),
      choiceId: (g._ctxChoice && g._ctxChoice.key) || '',
      favor: Number(npc.favor) || 0,
      resolved: false,
      dueFrom: g.year + 10,
      dueTo: g.year + 20
    };
    g.revengeLog.push(rec);
    LS.circleRep(g, npc.circle, -2);
    return rec;
  };

  /* 圈子联动：得罪/冷落一个人，同圈其他人也跟着降温 */
  SOCIAL.spread = function (g, npc, delta, reason) {
    if (!npc) return [];
    var circle = npc.circle;
    var half = Math.round((Number(delta) || 0) / 2);
    var changed = [];
    (g.npcs || []).forEach(function (n) {
      if (n === npc || !n.alive || n.circle !== circle) return;
      var before = Number(n.intimacy) || 0;
      n.intimacy = LS.clamp(before + half, 0, 100);
      n.relation = LS.relationOf(n);
      changed.push({ id: n.id, role: n.role, before: before, after: n.intimacy });
    });
    LS.circleRep(g, circle, delta < 0 ? -3 : 2);
    if (g.blockerLog) g.blockerLog.push({ year: g.year, age: g.age, kind: 'circle-spread', circle: circle, reason: reason || '', changes: changed });
    return changed;
  };

  /* 主动社交动作：消耗年度配额，超额付代价 */
  SOCIAL.act = function (g, npcId, kind) {
    var npc = LS.getNpc(g, npcId);
    if (!npc) return { ok: false, msg: '找不到这个人' };
    var spec = SOCIAL.ACTIONS[kind];
    if (!spec) return { ok: false, msg: '未知的社交动作' };
    SOCIAL.beginYear(g);
    var over = g.socialQuota.used >= g.socialQuota.max;
    var costMsg = [];
    if (over) {
      g.attrs.stress = LS.clamp((Number(g.attrs.stress) || 0) + 8, 0, 100);
      g.money.cash = Math.round(g.money.cash - 500);
      costMsg.push('超出名额：花了 500 元、压力 +8');
    }
    g.socialQuota.used += 1;
    if (spec.money) {
      g.money.cash = Math.round(g.money.cash + spec.money * (spec.money < 0 ? 1 : -1));
      costMsg.push((spec.money > 0 ? '花费 ' : '借出 ') + Math.abs(spec.money) + ' 元');
    }
    if (spec.health) {
      g.attrs.health = LS.clamp((Number(g.attrs.health) || 0) + spec.health, 1, 100);
      costMsg.push('健康 ' + spec.health);
    }
    if (spec.stress) g.attrs.stress = LS.clamp((Number(g.attrs.stress) || 0) + spec.stress, 0, 100);
    var text = spec.text.replace(/\{\{name\}\}/g, npc.name);
    SOCIAL.touch(g, npc, kind === '借钱' ? 'lend' : 'social', text, spec.intimacy, spec.favor);
    if (kind === '借钱') {
      SOCIAL.kindness(g, npc, 'lend', text, { amount: 2000, intimacy: 0, favor: 1 });
    } else if (kind === '帮忙') {
      SOCIAL.kindness(g, npc, 'help', text, { intimacy: 0, favor: 1 });
    }
    LS.addMemory(g, text + (costMsg.length ? '（' + costMsg.join('，') + '）' : ''), 'social');
    return {
      ok: true,
      over: over,
      quota: SOCIAL.quota(g),
      npc: { id: npc.id, name: npc.name, intimacy: npc.intimacy, favor: npc.favor, relation: npc.relation },
      msg: text + (costMsg.length ? '（' + costMsg.join('，') + '）' : '')
    };
  };

  /* 到期善缘/报复：引擎每年最多取 1 条 */
  SOCIAL.dueKindness = function (g) {
    var out = [];
    (g.kindnessLog || []).forEach(function (rec) {
      if (rec.resolved) return;
      var age = g.year - rec.year;
      if (age < 10 || age > 20) return;
      var npc = LS.getNpc(g, rec.npcId);
      var rep = npc ? LS.circleRep(g, npc.circle) : 50;
      if (LS.chance(SOCIAL.payoffChance(rec.favor, rep))) out.push(rec);
    });
    return out;
  };
  SOCIAL.dueRevenge = function (g) {
    var out = [];
    (g.revengeLog || []).forEach(function (rec) {
      if (rec.resolved) return;
      var age = g.year - rec.year;
      if (age < 10 || age > 20) return;
      if (LS.chance(SOCIAL.revengeChance(rec.favor))) out.push(rec);
    });
    return out;
  };
  SOCIAL.markPayoff = function (g, rec, eventId, type, text) {
    rec.resolved = true;
    g.payoffLog.push({
      year: g.year, sourceYear: rec.year, npcId: rec.npcId, npcName: rec.npcName,
      eventId: eventId, type: type, sourceText: rec.text, text: text
    });
  };
  SOCIAL.markRevenge = function (g, rec, eventId, type, text) {
    rec.resolved = true;
    g.revengeLog.forEach(function (r) { if (r === rec) r.resolved = true; });
    g.revengeLog.push({
      year: g.year, sourceYear: rec.year, npcId: rec.npcId, npcName: rec.npcName,
      eventId: eventId, type: type, sourceText: rec.text, text: text, replay: true
    });
  };

  /* 关系生命周期节点：相遇→升温→考验→疏远/重聚 */
  SOCIAL.arc = function (g, npc, stage) {
    if (!npc) return;
    npc.arcStage = stage;
    if (!g.npcArc[npc.id]) g.npcArc[npc.id] = { nodes: [] };
    g.npcArc[npc.id].stage = stage;
  };

  /* v3.2：对外别名，engine/ui 统一走 LS.social */
  LS.social = SOCIAL;
})();
