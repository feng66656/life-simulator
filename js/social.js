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
      eventId: g.currentId || '',
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
      eventId: g.currentId || '',
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

  /* ================= v3.5 NPC 独立命运 ================= */
  var FATE_JOBS = {
    low: ['流水线工人', '快递员', '餐馆帮厨', '保安', '出租车司机'],
    mid: ['公司职员', '小学老师', '护士', '个体户', '技术员', '销售'],
    high: ['工程师', '医生', '律师', '部门经理', '大学教师', '创业者']
  };
  var FATE_SURNAME = ['李', '王', '张', '刘', '陈', '杨', '赵', '周', '吴', '徐'];

  SOCIAL.initFate = function (npc) {
    if (!npc || npc.fate) return npc && npc.fate;
    var age = Number(npc.age) || 30;
    var role = npc.role || '朋友';
    var edu = age >= 22 ? 3 : (age >= 18 ? 2 : (age >= 12 ? 1 : 0));
    var job = null, income = 0;
    if (/父亲|母亲|爸|妈/.test(role)) { job = /母亲|妈/.test(role) ? '会计' : '工厂班长'; income = 5200; edu = 2; }
    else if (role === '上司') { job = '部门经理'; income = 12000; edu = 4; }
    else if (role === '配偶') { job = '公司职员'; income = 6000; edu = 3; }
    else if (role === '子女') { job = age >= 22 ? '公司职员' : null; income = age >= 22 ? 5000 : 0; edu = Math.min(4, Math.max(0, Math.floor((age - 6) / 5))); }
    else if (role === '发小' || role === '同学' || role === '朋友') { job = age >= 22 ? '公司职员' : null; income = age >= 22 ? 5500 : 0; }
    npc.fate = {
      edu: edu, job: job, jobLevel: job ? 1 : 0, income: income,
      debt: 0, married: /父亲|母亲|配偶/.test(role) || false, spouse: '',
      children: role === '子女' ? 0 : (/父亲|母亲/.test(role) ? 1 : 0),
      city: '本市', business: false, bankrupt: false,
      tags: [], retired: false, lastTickYear: null
    };
    return npc.fate;
  };

  SOCIAL.ensureFate = function (g) {
    (g.npcs || []).forEach(function (n) {
      SOCIAL.initFate(n);
      if (!n.fateLog) n.fateLog = [];
    });
  };

  SOCIAL.logFate = function (g, npc, type, text, cause, eventId) {
    if (!npc) return;
    npc.fateLog = npc.fateLog || [];
    npc.fateLog.push({
      year: g ? g.year : null, age: g ? g.age : null,
      npcAge: npc.age, type: type, text: String(text || ''),
      cause: cause || 'self', eventId: eventId || ''
    });
    if (npc.fateLog.length > 26) npc.fateLog.shift();
  };

  /* 主角对 NPC 的可见影响（验收流水用） */
  SOCIAL.npcImpact = function (g, npc, type, text, eventId) {
    if (!npc) return;
    SOCIAL.logFate(g, npc, type, text, 'player', eventId);
    g.npcImpactLog = g.npcImpactLog || [];
    g.npcImpactLog.push({ year: g.year, age: g.age, npcId: npc.id, npcRole: npc.role, type: type, text: text, eventId: eventId || '' });
    if (g.npcImpactLog.length > 120) g.npcImpactLog.shift();
  };

  SOCIAL.attitude = function (npc) {
    var it = Number(npc.intimacy) || 0, f = Number(npc.favor) || 0;
    if (it >= 62 || f >= 2) return f <= -2 ? '不满' : '支持';
    if (it >= 38) return '中立';
    return f <= -2 || it < 22 ? '不满' : '中立';
  };

  /* 年度命运推进：每人每年最多 1–2 条，避免刷屏 */
  SOCIAL.tickFate = function (g, npc) {
    if (!npc || !npc.alive) return;
    var f = SOCIAL.initFate(npc);
    f.lastTickYear = g.year;
    var age = npc.age;
    var r = Math.random;

    /* 升学 */
    if (age === 6 || age === 12 || age === 18) {
      f.edu = Math.min(6, f.edu + 1);
      SOCIAL.logFate(g, npc, 'edu', npc.name + '升入新的学校（' + ['小学', '初中', '高中', '大学', '研究生'][Math.min(4, f.edu - 1)] + '）', 'self');
    }
    /* 就业 */
    if (age >= 22 && !f.job && !f.retired) {
      if (r() < 0.35) {
        var pool = f.edu >= 4 ? FATE_JOBS.high : (f.edu >= 2 ? FATE_JOBS.mid : FATE_JOBS.low);
        f.job = pool[Math.floor(r() * pool.length)];
        f.income = 3500 + f.edu * 900 + Math.floor(r() * 1500);
        f.jobLevel = 1;
        SOCIAL.logFate(g, npc, 'job', npc.name + '进了' + f.city + '一家单位，做' + f.job, 'self');
      }
    }
    /* 升职 */
    if (f.job && !f.retired && age >= 24 && r() < 0.10 + (npc.note && /能干|要强/.test(npc.note) ? 0.05 : 0)) {
      f.jobLevel = Math.min(5, f.jobLevel + 1);
      f.income = Math.round(f.income * 1.15);
      f.tags = (f.tags || []).filter(function (t) { return t !== '失业'; });
      SOCIAL.logFate(g, npc, 'promote', npc.name + '升了一级，收入涨到每月约 ' + f.income + ' 元', 'self');
    }
    /* 结婚 */
    if (!f.married && age >= 24 && age <= 40 && r() < 0.11) {
      f.married = true;
      f.spouse = FATE_SURNAME[Math.floor(r() * FATE_SURNAME.length)] + '姓伴侣';
      SOCIAL.logFate(g, npc, 'marry', npc.name + '结婚了，对象是' + f.spouse, 'self');
    }
    /* 生子 */
    if (f.married && age >= 26 && age <= 42 && (f.children || 0) < 2 && r() < 0.14) {
      f.children = (f.children || 0) + 1;
      SOCIAL.logFate(g, npc, 'child', npc.name + '有了第' + f.children + '个孩子', 'self');
    }
    /* 生病 */
    var illP = 0.012 + age / 1100 + (npc.health < 50 ? 0.05 : 0);
    if (r() < illP) {
      var loss = 6 + Math.floor(r() * 14);
      npc.health = LS.clamp(npc.health - loss, 1, 100);
      var severe = npc.health < 28;
      if (severe) f.tags = [].concat(f.tags || [], ['重病']).filter(function (v, i, a) { return a.indexOf(v) === i; });
      SOCIAL.logFate(g, npc, severe ? 'critical' : 'ill', npc.name + (severe ? '查出重病，住进了医院' : '大病一场，休养了一阵'), 'self');
      g.npcFlags = g.npcFlags || {};
      g.npcFlags[npc.id + ':重病'] = g.year;
      /* 亲密的人重病：主角被牵动 */
      if (severe && Number(npc.intimacy) >= 55) {
        g.attrs.happiness = LS.clamp((Number(g.attrs.happiness) || 0) - 5, 0, 100);
        g.attrs.stress = LS.clamp((Number(g.attrs.stress) || 0) + 4, 0, 100);
        g.npcPulse = { year: g.year, tone: 'sorrow', text: '听说' + npc.name + '病重，你心里一直悬着。' };
        SOCIAL.npcImpact(g, npc, 'ill', '你因' + npc.name + '重病而心神不宁', 'fate');
      }
    }
    /* 失业 / 负债 */
    if (f.job && !f.retired && age >= 28 && age <= 58 && r() < 0.022 + (f.debt > 0 ? 0.03 : 0)) {
      f.debt = Math.round(f.debt + f.income * 4);
      f.tags = [].concat(f.tags || [], ['失业', '负债']).filter(function (v, i, a) { return a.indexOf(v) === i; });
      f.job = null; f.jobLevel = 0; f.income = 0;
      SOCIAL.logFate(g, npc, 'losejob', npc.name + '被裁了，欠下约 ' + f.debt + ' 元', 'self');
    }
    /* 创业（发小/同学优先） */
    if ((npc.role === '发小' || npc.role === '同学' || npc.role === '朋友') && !f.business && age >= 26 && age <= 45) {
      var lendBoost = (g.kindnessLog || []).some(function (k) { return k.npcId === npc.id && k.kind === 'lend' && !k.resolved; });
      if (r() < (lendBoost ? 0.05 : 0.022)) {
        f.business = true;
        f.job = '创业';
        f.income = 3000;
        SOCIAL.logFate(g, npc, 'startup', npc.name + '辞了职，拉了个小摊子开始创业', 'self');
      }
    }
    /* 创业成败 */
    if (f.business && age >= 28 && r() < 0.12) {
      if (r() < 0.55) {
        f.income = Math.round(f.income * 2.4 + 4000);
        f.tags = (f.tags || []).filter(function (t) { return t !== '创业失败'; });
        SOCIAL.logFate(g, npc, 'success', npc.name + '的小生意做起来了，月入约 ' + f.income + ' 元', 'self');
      } else {
        f.business = false; f.job = null; f.income = 0;
        f.debt = Math.round(f.debt + 60000);
        f.tags = [].concat(f.tags || [], ['创业失败', '负债']).filter(function (v, i, a) { return a.indexOf(v) === i; });
        SOCIAL.logFate(g, npc, 'fail', npc.name + '的生意黄了，背上约 ' + f.debt + ' 元债', 'self');
      }
    }
    /* 退休 */
    if (age >= 60 && !f.retired) {
      f.retired = true;
      f.job = '退休';
      f.income = Math.round((f.income || 4000) * 0.45);
      SOCIAL.logFate(g, npc, 'retire', npc.name + '退休了，日子慢了下来', 'self');
    }
  };

  SOCIAL.tickAll = function (g) {
    SOCIAL.ensureFate(g);
    /* 未入册的父母：童年/少年自动补位，保证家人环 */
    if (!LS.getNpc(g, '父亲') && g.age <= 22) LS.addNpc(g, '父亲', { age: g.age + 26, intimacy: 72, circle: '亲属圈', note: '话不多，手很巧' });
    if (!LS.getNpc(g, '母亲') && g.age <= 22) LS.addNpc(g, '母亲', { age: g.age + 24, intimacy: 78, circle: '亲属圈', note: '爱唠叨，记性极好' });
    (g.npcs || []).forEach(function (n) {
      if (n.alive) SOCIAL.tickFate(g, n);
      else if (n.fateLog && !n.fateLog.some(function (l) { return l.type === 'death'; })) {
        SOCIAL.logFate(g, n, 'death', n.name + '于' + (n.deathYear || g.year) + '年离世', 'self');
      }
    });
  };

  /* 关系网：性质 / 档位 / 活跃上限 */
  SOCIAL.natureOf = function (npc) {
    if (!npc) return 'friend';
    if (npc.favor <= -3) return 'enemy';
    if (/配偶|恋人/.test(npc.role) || npc.isSpouse) return 'love';
    if (npc.circle === '亲属圈' || npc.isChild) return 'family';
    if (/同事|上司|客户|合伙人|老板/.test(npc.role) || npc.circle === '同事圈' || npc.circle === '行业圈') return 'interest';
    return 'friend';
  };
  SOCIAL.ringOf = function (npc) {
    var nat = SOCIAL.natureOf(npc);
    if (nat === 'family' || nat === 'love') return 1;
    if (nat === 'interest') return 3;
    return 2;
  };
  SOCIAL.netNpcs = function (g, cap) {
    var live = (g.npcs || []).filter(function (n) { return n.alive; });
    var dead = (g.npcs || []).filter(function (n) { return !n.alive; }).slice(-6);
    live.sort(function (a, b) { return Number(b.intimacy) - Number(a.intimacy); });
    return { live: live.slice(0, cap || 18), dead: dead };
  };

  /* v3.2：对外别名，engine/ui 统一走 LS.social */
  LS.social = SOCIAL;
})();
