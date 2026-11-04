/* =========================================================
   engine.js — 回合推进、事件选择、效果结算、死亡与总结
   ========================================================= */
(function () {
  'use strict';
  var LS = window.LS;

  var ATTR_KEYS = ['knowledge', 'health', 'finance', 'charm', 'happiness', 'reputation', 'stress'];
  var HEALTH_LIMIT = 0;
  var MAX_TURNS = 130;

  var ATTR_LABEL = { knowledge: '学识', health: '健康', finance: '财力', charm: '魅力', happiness: '幸福感', stress: '压力' };

  /* v3：阶段选择密度。数值越低，平淡年越多；由长跑统计调参，不做硬截断 */
  var PACE = {
    '婴幼儿': 0.04, '童年': 0.06, '少年': 0.09, '青年': 0.17,
    '中年': 0.18, '中老年': 0.09, '晚年': 0.05
  };
  LS.PACE = PACE;

  /* v3：时代背景；事件库若提供 LS.ERAS 则沿用，否则内置三个 */
  if (!LS.ERAS) {
    LS.ERAS = [
      { name: '平稳年代', from: 0, to: 24, mods: { random: 1.0, hunt: 1.0 } },
      { name: '扩张年代', from: 25, to: 49, mods: { random: 1.18, hunt: 1.10 } },
      { name: '收缩年代', from: 50, to: 120, mods: { random: 0.92, hunt: 0.92 } }
    ];
  }

  var LAYER_OF_TYPE = { forced: 'main', causal: 'chain', random: 'random', daily: 'random' };
  function layerOf(e) {
    if (e && e.layer) return e.layer;
    if (e && e.tier === 'crossroad') return 'branch';
    return LAYER_OF_TYPE[e && e.type] || 'random';
  }

  function num0(v) { v = Number(v); return isFinite(v) ? v : 0; }

  function attrValue(g, key) {
    if (!g) return 0;
    if (key === 'reputation' || key === 'rep') return LS.repTotal(g);
    if (key === 'net' || key === 'netWorth') return LS.netWorth(g);
    if (key === 'cash') return num0(g.money && g.money.cash);
    if (key === 'debt') return num0(g.money && g.money.debt);
    if (key === 'age') return num0(g.age);
    return num0(g.attrs && g.attrs[key]);
  }

  function clampAttrs(g) {
    g.attrs.knowledge = LS.clamp(g.attrs.knowledge, 1, 100);
    g.attrs.health = LS.clamp(g.attrs.health, 0, 100);
    g.attrs.finance = LS.clamp(g.attrs.finance, 1, 100);
    g.attrs.charm = LS.clamp(g.attrs.charm, 1, 100);
    g.attrs.happiness = LS.clamp(g.attrs.happiness, 0, 100);
    g.attrs.stress = LS.clamp(g.attrs.stress, 0, 100);
    g.rep.school = LS.clamp(g.rep.school, 0, 100);
    g.rep.industry = LS.clamp(g.rep.industry, 0, 100);
    g.rep.society = LS.clamp(g.rep.society, 0, 100);
  }

  function moneyRound(g) {
    g.money.cash = Math.round(g.money.cash);
    g.money.assets = Math.round(g.money.assets);
    g.money.debt = Math.round(g.money.debt);
  }

  function talentMul(g, key) {
    var m = 1;
    for (var i = 0; i < g.talents.length; i++) {
      var t = LS.talent(g.talents[i]);
      if (!t) continue;
      if (key === 'health' && t.healthMul) m *= t.healthMul;
      if (key === 'income' && t.incomeMul) m *= t.incomeMul;
      if (key === 'favor' && t.favorGain) m *= t.favorGain;
      if (key === 'death' && t.deathMul) m *= t.deathMul;
    }
    return m;
  }

  function luckOf(g) {
    var v = 0;
    for (var i = 0; i < g.talents.length; i++) {
      var t = LS.talent(g.talents[i]);
      if (t && t.luck) v += t.luck;
    }
    return v;
  }

  function getNpcLoose(g, role) {
    var n = LS.getNpc(g, role);
    if (n) return n;
    if (role === '配偶') return null;
    if (role === '子女') {
      for (var i = 0; i < g.family.childrenIds.length; i++) {
        var c = LS.getNpc(g, g.family.childrenIds[i]);
        if (c) return c;
      }
      return null;
    }
    if (role === '恋人' && g.family.marriage.status === '未婚') {
      return LS.ensureNpc(g, '恋人', { age: g.age + LS.randInt(-2, 2), favor: 55, health: 82, gender: g.gender === '男' ? '女' : '男', note: '交往对象' });
    }
    if (role === '父亲' || role === '母亲') return null;
    var ageMap = { '老师': 42, '同学': g.age, '同事': g.age + LS.randInt(-3, 5), '上司': g.age + LS.randInt(6, 14), '朋友': g.age, '贵人': g.age + LS.randInt(10, 20) };
    return LS.addNpc(g, role, {
      age: LS.clamp(ageMap[role] || 35, 16, 90),
      health: role === '上司' ? 76 : 80,
      favor: role === '贵人' ? 58 : 52,
      gender: LS.chance(0.5) ? '男' : '女',
      note: role === '贵人' ? '在关键时候帮过你的人' : ''
    });
  }

  /* ---------------- 数值与资产 ---------------- */
  function addAttrs(g, at) {
    if (!at) return;
    for (var k in at) {
      var v = at[k] || 0;
      if (k === 'reputation') {
        g.rep.school += v * 0.5;
        g.rep.industry += v * 0.5;
        g.rep.society += v * 0.5;
      } else if (g.attrs[k] !== undefined) {
        g.attrs[k] += v;
      }
    }
    clampAttrs(g);
  }

  function addRep(g, rep) {
    if (!rep) return;
    for (var k in rep) if (g.rep[k] !== undefined) g.rep[k] += rep[k] || 0;
    clampAttrs(g);
  }

  function addMoney(g, money) {
    if (!money) return;
    if (money.cash) g.money.cash += money.cash;
    if (money.assets) g.money.assets += money.assets;
    if (money.debt) g.money.debt += money.debt;
    if (g.money.debt < 0) g.money.debt = 0;
    /* 资产里的房产份额不能被花掉：动用超出金融资产的部分转为负债 */
    var hv = g.house.owned ? g.house.value : 0;
    if (g.money.assets < hv) {
      g.money.debt += hv - g.money.assets;
      g.money.assets = hv;
    } else if (g.money.assets < 0) {
      g.money.debt += -g.money.assets;
      g.money.assets = 0;
    }
    moneyRound(g);
    if (money.cash && Math.abs(money.cash) >= 200000) {
      bcPush(g, money.cash > 0 ? 'big_gain' : 'big_loss', null, {
        changes: moneyDeltaText(g, money.cash)
      });
    }
  }

  function addMoneyPct(g, pct) {
    if (!pct) return;
    if (pct.assets) {
      /* 百分比只作用于金融资产，房子不参与股票/理财的涨跌 */
      var hv = g.house.owned ? g.house.value : 0;
      var base = Math.max(0, g.money.assets - hv);
      if (base > 0) g.money.assets += base * pct.assets;
    }
    if (pct.cash) g.money.cash += g.money.cash * pct.cash;
    if (pct.debt) {
      /* 只对消费性负债打折，房贷另行处理 */
      var houseDebt = g.house.owned ? g.house.mortgage : 0;
      var cons = Math.max(0, g.money.debt - houseDebt);
      var cut = Math.round(cons * Math.min(0.9, Math.abs(pct.debt)));
      g.money.debt = Math.max(0, g.money.debt - cut);
    }
    moneyRound(g);
  }

  function addNpcFx(g, map) {
    if (!map) return;
    for (var role in map) {
      var n = getNpcLoose(g, role);
      if (!n) continue;
      var fx = map[role] || {};
      if (fx.favor) {
        var f = fx.favor;
        if (f > 0) f *= talentMul(g, 'favor');
        n.favor = LS.clamp(n.favor + f, 0, 100);
      }
      if (fx.health) n.health = LS.clamp(n.health + fx.health, 0, 100);
      if (fx.alive === false) n.alive = false;
    }
  }

  /* =========================================================
     v2：重大结果播报（独立弹窗，优先级/节流/合并）
     ========================================================= */
  var BC_META = {
    job_found:   { title: '找到工作', prio: 70, art: 'office', tone: 'gold', text: '你通过面试，拿到了这份工作。尽管岗位并不完美，但它终于让你有了稳定收入。' },
    job_lost:    { title: '失业', prio: 76, art: 'emptyDesk', tone: 'red', text: '你失去了工作。收入中断，压力迅速上升，接下来必须重新面对求职与生存问题。' },
    marriage:    { title: '结婚', prio: 80, art: 'wedding', tone: 'gold', text: '你与伴侣完成了婚姻登记，正式组建家庭。从此，人生多了一层更重的责任与联结。' },
    divorce:     { title: '离婚', prio: 74, art: 'emptyHome', tone: 'red', text: '婚姻关系解除。共同生活的部分被拆开，情绪、住处与财务都需要重新安排。' },
    breakup:     { title: '分手', prio: 62, art: 'emptyHome', tone: 'red', text: '这段关系停在了这里。你们退回各自的生活，短期内情绪会明显低落。' },
    child:       { title: '孩子出生', prio: 82, art: 'nursery', tone: 'gold', text: '孩子降生，家庭结构改变。你开始体验新的身份，也开始为另一个生命负责。' },
    widowed:     { title: '丧偶', prio: 96, art: 'grave', tone: 'red', text: '伴侣离世，生活出现巨大空缺。这种损失不只影响情绪，也会改变你此后的人生节奏。' },
    parent_death:{ title: '父母离世', prio: 90, art: 'grave', tone: 'red', text: '父母中的一位离开了。你失去了一个始终在背后的人，也失去了一层与过去的连接。' },
    child_adult: { title: '子女成年', prio: 58, art: 'home', tone: 'gold', text: '孩子成年了，开始独立安排自己的生活。你肩上的担子轻了一些，家里的声音也少了一些。' },
    house:       { title: '买房', prio: 72, art: 'house', tone: 'gold', text: '房产过户完成。你有了一个真正属于自己的住处，也多了一份长期还款责任。' },
    startup_ok:  { title: '创业成功', prio: 86, art: 'office', tone: 'gold', text: '项目跑通了，收入开始覆盖成本。你的公司活了下来，但管理的责任也随之变大。' },
    startup_fail:{ title: '创业失败', prio: 78, art: 'emptyDesk', tone: 'red', text: '项目停摆，投入的资金大多无法收回。债务与失败感同时压了下来。' },
    illness:     { title: '重大疾病确诊', prio: 92, art: 'clinic', tone: 'red', text: '检查结果确认了疾病。接下来要面对治疗、费用和被打乱的生活安排。' },
    surgery_ok:  { title: '手术成功', prio: 88, art: 'clinic', tone: 'gold', text: '手术顺利完成。风险暂时过去，但恢复期仍需要时间与照顾。' },
    surgery_risk:{ title: '手术风险', prio: 90, art: 'clinic', tone: 'red', text: '手术出现了并发症。情况比预期更复杂，后续治疗与费用都要重新估算。' },
    gaokao:      { title: '高考结果', prio: 76, art: 'exam', tone: 'purple', text: '高考成绩公布，你的分数决定了接下来能选择的学校层次。' },
    kaoyan:      { title: '考研结果', prio: 74, art: 'exam', tone: 'purple', text: '研究生考试结果公布，这一年备考的成果有了结论。' },
    promote:     { title: '升职', prio: 66, art: 'office', tone: 'gold', text: '职位上调，薪资随之提高，责任与加班也会一起增加。' },
    retire:      { title: '退休', prio: 64, art: 'home', tone: 'purple', text: '你办完了退休手续。工资停止，养老金开始，生活节奏整体慢了下来。' },
    big_gain:    { title: '获得大额财富', prio: 70, art: 'money', tone: 'gold', text: '一笔大额收入到账，家庭财务状况明显改善。' },
    big_loss:    { title: '失去大额财富', prio: 80, art: 'money', tone: 'red', text: '一笔大额支出或损失发生，家庭财务明显收紧。' },
    milestone80: { title: '天赋觉醒 · 80', prio: 90, art: 'spark', tone: 'good', text: '有一项能力走到了很少人到达的位置。你自己未必察觉，但周围的人已经改口，遇事先想到你。' },
    milestone90: { title: '天赋觉醒 · 90', prio: 94, art: 'spark', tone: 'good', text: '这项能力已经越过了绝大多数人的上限。它带来机会，也带来别人难以理解的要求与孤独。' }
  };
  LS.BC_META = BC_META;

  function bcPush(g, key, text, extra) {
    var meta = BC_META[key];
    if (!meta) return null;
    if (!g.pendingBroadcasts) g.pendingBroadcasts = [];
    /* 同一回合的同类结果合并，避免叠加弹窗 */
    for (var i = 0; i < g.pendingBroadcasts.length; i++) {
      var old = g.pendingBroadcasts[i];
      if (old.key === key && old.turn === g.turn) {
        if (text && text !== old.text) old.text = old.text + ' ' + text;
        if (extra && extra.changes) old.changes = [old.changes, extra.changes].filter(Boolean).join('；');
        return old;
      }
    }
    var item = {
      key: key,
      title: (extra && extra.title) || meta.title,
      text: text || meta.text,
      art: (extra && extra.art) || meta.art,
      tone: (extra && extra.tone) || meta.tone,
      prio: (extra && extra.prio) || meta.prio,
      changes: (extra && extra.changes) || '',
      merged: [],
      turn: g.turn,
      age: g.age,
      year: g.year
    };
    g.pendingBroadcasts.push(item);
    if (!g.memoryBroadcasts) g.memoryBroadcasts = [];
    return item;
  }

  function pickBroadcast(g) {
    var list = g.pendingBroadcasts || [];
    if (!list.length) return null;
    list.sort(function (a, b) { return (b.prio || 0) - (a.prio || 0); });
    var top = list[0];
    var rest = list.slice(1);
    /* 连续两回合都弹过时，只有极高优先级结果才继续弹 */
    var ages = (g.broadcastAges || []).filter(function (t) { return g.turn - t >= 1 && g.turn - t <= 2; });
    var tight = ages.length >= 2;
    /* 连续两回合播报后，低优先级结果不丢，留在队列里等下一回合 */
    if (tight && (top.prio || 0) < 88) return null;
    g.pendingBroadcasts = [];
    if (rest.length) top.merged = rest.map(function (x) { return x.title; });
    g.lastBroadcastTurn = g.turn;
    g.broadcastAges = (g.broadcastAges || []).concat([g.turn]).slice(-4);
    return top;
  }

  function moneyDeltaText(g, delta) {
    return '现金 ' + (delta > 0 ? '+' : '') + LS.fmtMoney(delta);
  }

  function jobTagsOf(id) {
    var jd = LS.JOBS[id];
    if (!jd) return null;
    return {
      pay: jd.base >= 90000 ? '高' : (jd.base >= 60000 ? '中' : '低'),
      overtime: jd.stress >= 62 ? '高' : (jd.stress >= 40 ? '中' : '低'),
      health: jd.healthDrain >= 1.1 ? '高' : (jd.healthDrain >= 0.5 ? '中' : '低'),
      promote: jd.growth >= 1.06 ? '较快' : (jd.growth >= 1.02 ? '一般' : '缓慢'),
      cycle: /sales|startup|freelance|gig/.test(id) ? '波动' : '平稳'
    };
  }
  LS.jobTagsOf = jobTagsOf;

  function setJob(g, spec) {
    if (!spec) return;
    var id = typeof spec === 'string' ? spec : spec.id;
    var level = typeof spec === 'string' ? 0 : (spec.level || 0);
    if (!LS.JOBS[id]) return;
    if (g.job.id !== id) {
      g.job.history.push({ year: g.year, age: g.age, text: '进入' + LS.JOBS[id].name + '岗位' });
    }
    g.job.id = id;
    g.job.level = LS.clamp(level, 0, LS.JOBS[id].path.length - 1);
    g.job.title = LS.jobTitle(id, g.job.level);
    g.job.salary = typeof spec === 'object' && spec.salary ? spec.salary : LS.jobSalary(id, g.job.level);
    g.job.years = 0;
    g.job.tags = jobTagsOf(id);
    g.marks.retired = false;
    g.pension = 0;
    g.flags = g.flags || {};
    g.flags.unemployed = false;
    g.flags.needJob = false;
    bcPush(g, 'job_found', null, {
      changes: '岗位：' + LS.JOBS[id].name + ' · ' + g.job.title + ' · 年薪 ' + LS.fmtMoney(g.job.salary) +
        '；标签：加班' + (g.job.tags ? g.job.tags.overtime : '—') + ' · 健康消耗' + (g.job.tags ? g.job.tags.health : '—')
    });
  }

  function clearJob(g, reason) {
    if (!g.job.id) return;
    var oldId = g.job.id;
    var oldSalary = g.job.salary;
    g.job.history.push({ year: g.year, age: g.age, text: '离开' + LS.JOBS[oldId].name + '岗位' + (reason ? '（' + reason + '）' : '') });
    g.job.id = null;
    g.job.level = 0;
    g.job.title = '待业';
    g.job.salary = 0;
    g.job.years = 0;
    g.job.tags = null;
    g.flags = g.flags || {};
    if (reason === '退休') {
      bcPush(g, 'retire', null, { changes: '工资停止 · 养老金 ' + LS.fmtMoney(g.pension || 0) });
      return;
    }
    if (reason === '主动离开') return;
    g.flags.needJob = true;
    g.flags.unemployed = true;
    bcPush(g, 'job_lost', null, {
      changes: '岗位：' + LS.JOBS[oldId].name + ' · 年薪 -' + LS.fmtMoney(oldSalary) + ' · 压力上升'
    });
  }

  function eduSet(g, level) {
    level = LS.clamp(level, 0, 7);
    if (level <= g.edu.level) return;
    g.edu.level = level;
    g.edu.path.push({ year: g.year, age: g.age, text: '学历达到' + LS.eduName(level) });
    g.marks['edu_' + level] = true;
  }

  function buyHouse(g, spec) {
    /* 已有住房时按“换房”处理：先按当前市值卖出，再买新房，避免多套房贷叠加 */
    if (g.house.owned) {
      var proceeds = Math.round(g.house.value - g.house.mortgage);
      g.money.cash += proceeds;
      g.money.assets -= g.house.value;
      g.money.debt = Math.max(0, g.money.debt - g.house.mortgage);
      g.house.owned = false;
      g.house.value = 0;
      g.house.mortgage = 0;
      if (proceeds < 0) g.money.debt += -proceeds;
    }
    var baseMap = { '农村': 260000, '小城': 430000, '二线城市': 820000, '一线城市': 1850000, '海外小城': 1300000 };
    var base = baseMap[g.birthplace] || 430000;
    var price = Math.round(base * (spec.factor || 1) / 10000) * 10000;
    var wantDown = Math.round(price * (spec.down || 0.3));
    /* 首付最多动用六成现金，留出一年的月供与应急钱，避免刚买完就断供 */
    var down = Math.min(wantDown, Math.max(0, Math.round(g.money.cash * 0.6)));
    var mortgage = price - down;
    g.money.cash -= down;
    g.money.assets += price;
    g.money.debt += mortgage;
    g.house.owned = true;
    g.house.value = price;
    g.house.mortgage = mortgage;
    g.house.buyYear = g.year;
    g.house.mortgagePaid = false;
    moneyRound(g);
    g.marks.bought_house = true;
    bcPush(g, 'house', null, {
      changes: '房产 ' + LS.fmtMoney(price) + ' · 首付 -' + LS.fmtMoney(down) + ' · 房贷 ' + LS.fmtMoney(mortgage)
    });
  }

  function sellHouse(g) {
    if (!g.house.owned) return 0;
    var value = g.house.value;
    var mortgage = g.house.mortgage;
    g.money.cash += value - mortgage;
    g.money.assets -= value;
    g.money.debt -= mortgage;
    g.house.owned = false;
    g.house.value = 0;
    g.house.mortgage = 0;
    g.house.mortgagePaid = true;
    moneyRound(g);
    g.marks.sold_house = true;
    return value;
  }

  function transferHouse(g) {
    if (!g.house.owned) return;
    g.money.assets -= g.house.value;
    g.money.debt -= g.house.mortgage;
    g.house.owned = false;
    g.house.value = 0;
    g.house.mortgage = 0;
    g.house.mortgagePaid = true;
    g.marks.transferred_house = true;
    moneyRound(g);
  }

  function marry(g) {
    if (g.family.marriage.status === '已婚') return;
    var lover = LS.getNpc(g, '恋人');
    var spouse;
    if (lover && lover.alive) {
      lover.role = '配偶';
      lover.note = '与你结婚的人';
      lover.favor = LS.clamp(lover.favor + 10, 0, 100);
      spouse = lover;
    } else {
      spouse = LS.addNpc(g, '配偶', {
        name: LS.randomSpouseName(g.gender),
        gender: g.gender === '男' ? '女' : '男',
        age: LS.clamp(g.age + LS.randInt(-3, 3), 18, 60),
        health: LS.clamp(80 - Math.max(0, g.age - 35), 45, 92),
        favor: LS.clamp(62 + LS.randInt(0, 12), 0, 100),
        isSpouse: true,
        note: '与你结婚的人'
      });
      spouse.id = 'spouse';
    }
    g.family.marriage.status = '已婚';
    g.family.marriage.spouseId = spouse.id;
    g.family.marriage.year = g.year;
    g.stats.marriedYears = 0;
    g.marks.married = true;
    g.attrs.happiness = LS.clamp(g.attrs.happiness + 6, 0, 100);
    g.attrs.stress = LS.clamp(g.attrs.stress + 4, 0, 100);
    bcPush(g, 'marriage', null, {
      changes: '婚姻关系建立 · 幸福感 +6 · 压力 +4 · 配偶好感 ' + Math.round(spouse.favor)
    });
  }

  function divorce(g) {
    if (g.family.marriage.status !== '已婚') return;
    var n = g.family.marriage.spouseId ? LS.getNpc(g, g.family.marriage.spouseId) : null;
    if (n) {
      n.role = '前配偶';
      n.favor = LS.clamp(n.favor - 20, 0, 100);
    }
    g.family.marriage.status = '离异';
    g.family.marriage.spouseId = null;
    g.marks.divorced = true;
    g.attrs.happiness = LS.clamp(g.attrs.happiness - 10, 0, 100);
    g.attrs.stress = LS.clamp(g.attrs.stress + 8, 0, 100);
    bcPush(g, 'divorce', null, { changes: '婚姻解除 · 幸福感 -10 · 压力 +8' });
  }

  function haveChild(g) {
    var c = LS.addNpc(g, '子女', {
      name: LS.randomName(LS.chance(0.5) ? '男' : '女'),
      gender: LS.chance(0.5) ? '男' : '女',
      age: 0,
      health: 88,
      favor: 78,
      isChild: true,
      lifespan: 78 + LS.randInt(0, 20),
      note: '你的孩子'
    });
    g.family.childrenIds.push(c.id);
    g.stats.childrenEver = (g.stats.childrenEver || 0) + 1;
    g.marks.has_child = true;
    g.attrs.happiness = LS.clamp(g.attrs.happiness + 8, 0, 100);
    g.attrs.stress = LS.clamp(g.attrs.stress + 6, 0, 100);
    bcPush(g, 'child', null, { changes: '子女 +1 · 幸福感 +8 · 压力 +6 · 养育支出开始' });
  }

  /* ---------------- 效果应用 ---------------- */
  function applyFx(g, fx, report) {
    if (!fx) return;
    if (fx.at) { addAttrs(g, fx.at); report.attrs = true; }
    if (fx.rep) { addRep(g, fx.rep); report.rep = true; }
    if (fx.money) { addMoney(g, fx.money); report.money = true; }
    if (fx.moneyPct) { addMoneyPct(g, fx.moneyPct); report.money = true; }
    if (fx.npc) { addNpcFx(g, fx.npc); report.npc = true; }
    if (fx.set) {
      for (var k in fx.set) if (fx.set[k]) g.marks[k] = true;
    }
    if (fx.unset) {
      for (var uk in fx.unset) if (fx.unset[uk]) g.marks[uk] = false;
    }
    if (fx.needJob) {
      g.flags = g.flags || {};
      g.flags.needJob = true;
      g.flags.unemployed = !g.job.id;
    }
    if (fx.flag) {
      var flags = Array.isArray(fx.flag) ? fx.flag : [fx.flag];
      flags.forEach(function (f) {
        if (!f || !f.event) return;
        var ctx = g._ctxChoice || null;
        g.pending.push({
          event: f.event,
          dueAge: (g.age || 0) + (f.delay || 1),
          mark: f.mark || '',
          note: f.note || '',
          choiceId: ctx ? ctx.key : '',
          choiceAge: ctx ? ctx.age : null,
          choiceTitle: ctx ? ctx.title : '',
          choiceLabel: ctx ? ctx.label : ''
        });
      });
    }
    if (fx.edu !== undefined) eduSet(g, fx.edu);
    if (fx.eduUp) eduSet(g, g.edu.level + 1);
    if (fx.job) setJob(g, fx.job);
    if (fx.quitJob) clearJob(g, '主动离开');
    if (fx.promote) {
      var jd = LS.JOBS[g.job.id];
      if (jd) {
        g.job.level = LS.clamp(g.job.level + 1, 0, jd.path.length - 1);
        g.job.title = LS.jobTitle(g.job.id, g.job.level);
        if (g.job.salary) g.job.salary = Math.round(g.job.salary * 1.12);
        g.stats.promotions = (g.stats.promotions || 0) + 1;
        bcPush(g, 'promote', null, { changes: '职级：' + g.job.title + ' · 年薪 ' + LS.fmtMoney(g.job.salary) });
      }
    }
    if (fx.salaryPct) {
      if (g.job.salary) g.job.salary = Math.round(g.job.salary * (1 + fx.salaryPct));
    }
    if (fx.severance) {
      var years = g.job.years || 1;
      g.money.cash += Math.round((g.job.salary || 40000) * (years + 1) / 12 * 1.2);
    }
    if (fx.marry) marry(g);
    if (fx.child) haveChild(g);
    if (fx.divorce) divorce(g);
    if (fx.retire) {
      if (g.job.salary) g.pension = Math.round(g.job.salary * 0.45);
      clearJob(g, '退休');
      g.marks.retired = true;
    }
    if (fx.house) buyHouse(g, fx.house);
    if (fx.houseSell) sellHouse(g);
    if (fx.houseTransfer) transferHouse(g);
    if (fx.statsStartupFail) {
      g.stats.startupFail = (g.stats.startupFail || 0) + 1;
      g.marks.startup_failed = true;
      bcPush(g, 'startup_fail', null, {
        changes: '创业尝试失败 · 负债 ' + LS.fmtMoney(g.money.debt) + ' · 压力 +' + Math.round(g.attrs.stress)
      });
    }
    if (fx.statsStartupSuccess) {
      g.stats.startupSuccess = (g.stats.startupSuccess || 0) + 1;
      g.marks.startup_success = true;
      bcPush(g, 'startup_ok', null, {
        changes: '公司存活 · 净资产 ' + LS.fmtMoney(LS.netWorth(g))
      });
    }
    /* v2：事件可直接声明播报与隐患调整 */
    if (fx.bc) {
      var bcList = Array.isArray(fx.bc) ? fx.bc : [fx.bc];
      bcList.forEach(function (b) {
        if (!b || !b.key) return;
        bcPush(g, b.key, b.text || null, b);
      });
    }
    if (fx.risk) {
      LS.RISK_KEYS.forEach(function (k) {
        if (fx.risk[k]) {
          g.risks = g.risks || {};
          g.risks[k] = LS.clamp((g.risks[k] || 0) + fx.risk[k], 0, 100);
        }
      });
    }
    if (fx.healthNeg) {
      g.stats.healthNegAge = g.age;
      g.stats.healthNegCount = (g.stats.healthNegCount || 0) + 1;
    }
    if (fx.fatal) {
      var p = fx.fatal * talentMul(g, 'death');
      if (LS.chance(p)) g.forceDeath = true;
    }
    if (fx.tag) LS.addMemory(g, fx.tag, 'choice');
  }

  function describeChanges(g, before) {
    var parts = [];
    var labels = { knowledge: '学识', health: '健康', finance: '财力', charm: '魅力', happiness: '幸福感' };
    ATTR_KEYS.forEach(function (k) {
      if (!labels[k]) return;
      var d = Math.round(g.attrs[k] - before.attrs[k]);
      if (d) parts.push(labels[k] + (d > 0 ? ' +' : ' ') + d);
    });
    var repD = Math.round(LS.repTotal(g) - before.rep);
    if (repD) parts.push('声望' + (repD > 0 ? ' +' : ' ') + repD);
    var cashD = Math.round(g.money.cash - before.cash);
    if (cashD) parts.push('现金' + (cashD > 0 ? ' +' : ' ') + LS.fmtMoney(cashD));
    var assetD = Math.round(g.money.assets - before.assets);
    if (assetD) parts.push('资产' + (assetD > 0 ? ' +' : ' ') + LS.fmtMoney(assetD));
    var debtD = Math.round(g.money.debt - before.debt);
    if (debtD) parts.push('负债' + (debtD > 0 ? ' +' : ' ') + LS.fmtMoney(debtD));
    return parts.join('，');
  }

  function snapshotBefore(g) {
    return {
      attrs: {
        knowledge: g.attrs.knowledge, health: g.attrs.health, finance: g.attrs.finance,
        charm: g.attrs.charm, happiness: g.attrs.happiness, stress: g.attrs.stress
      },
      rep: LS.repTotal(g),
      cash: g.money.cash, assets: g.money.assets, debt: g.money.debt
    };
  }

  /* =========================================================
     v3：阶段影响真实落账 + 阶段总结卡
     ========================================================= */
  function dif(a, b) { return Math.round(num0(b) - num0(a)); }

  function writeStageImpact(g, fromStage) {
    var out = [];
    g.marks = g.marks || {};
    g.flags = g.flags || {};
    if (!Array.isArray(g.stageImpact)) g.stageImpact = [];
    g.stageImpactRuns = num0(g.stageImpactRuns) + 1;

    /* 1. 隐患：任一风险 ≥ 35，写入印记并再加重一次 */
    var bestKey = '', bestVal = -1;
    LS.RISK_KEYS.forEach(function (k) {
      var v = num0((g.risks || {})[k]);
      if (v >= 35 && v > bestVal) { bestVal = v; bestKey = k; }
    });
    if (bestKey) {
      g.risks = g.risks || {};
      g.marks['隐患_' + bestKey] = true;
      g.risks[bestKey] = LS.clamp(num0(g.risks[bestKey]) + 3, 0, 100);
      out.push({
        type: 'risk', key: bestKey, label: LS.RISK_LABEL[bestKey],
        age: g.age, stage: fromStage,
        note: '阶段结束时' + LS.RISK_LABEL[bestKey] + '已累积到 ' + Math.round(bestVal)
      });
    }
    /* 2. 负债 */
    if (num0(g.money.debt) > 0) {
      g.marks['负债缠身'] = true;
      out.push({
        type: 'debt', key: 'debt', label: '负债', age: g.age, stage: fromStage,
        note: '账上还背着 ' + LS.fmtMoney(g.money.debt) + '，利息要跟着日子一起还'
      });
    }
    /* 3. 人脉：声望够高或被提携过 */
    if (LS.repTotal(g) >= 55 || num0(g.flags.mentorCount) > 0) {
      g.flags.connections = num0(g.flags.connections) + 1;
      g.marks['人脉_' + fromStage] = true;
      out.push({
        type: 'connection', key: fromStage, label: '人脉', age: g.age, stage: fromStage,
        note: '这一段攒下的关系留了下来，往后遇事有人可以开口'
      });
    }
    /* 4. 情绪低落 */
    if (num0(g.attrs.happiness) <= 35) {
      g.marks['心里有结'] = true;
      out.push({
        type: 'tag', key: '心里有结', label: '心里有结', age: g.age, stage: fromStage,
        note: '有件没解开的事一直搁着，幸福感停在 ' + Math.round(num0(g.attrs.happiness))
      });
    }
    /* 5. 家庭牵绊 */
    if (g.family.marriage.status === '已婚' || g.family.childrenIds.length > 0) {
      g.marks['家庭牵绊'] = true;
      out.push({
        type: 'memory', key: '家庭牵绊', label: '家庭', age: g.age, stage: fromStage,
        note: (g.family.childrenIds.length ? '家里有 ' + g.family.childrenIds.length + ' 个孩子' : '身边还有伴侣') +
          '，你的时间不再只属于自己'
      });
    }
    /* 6. 兜底：至少留下一条阶段印记 */
    if (!out.length) {
      var mk = fromStage + '印记';
      g.marks[mk] = true;
      out.push({
        type: 'tag', key: mk, label: fromStage, age: g.age, stage: fromStage,
        note: fromStage + '这一段没有留下明显的账，只留下一点改不掉的习惯'
      });
    }
    for (var i = 0; i < out.length; i++) {
      g.stageImpact.push(out[i]);
      if (g.stageImpact.length > 200) g.stageImpact = g.stageImpact.slice(-200);
      LS.addMemory(g, '阶段总结：' + out[i].note, 'stage');
    }
    return out;
  }

  /* 供应事件 cond 读取：某条阶段影响是否已经生效且过了一段时间 */
  function stageImpactActive(g, type, key) {
    var list = (g && g.stageImpact) || [];
    var keys = key === undefined || key === null ? null : (Object.prototype.toString.call(key) === '[object Array]' ? key : [key]);
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (!it) continue;
      if (type && it.type !== type) continue;
      if (keys && keys.indexOf(it.key) < 0) continue;
      if (num0(g.age) >= num0(it.age) + 2) return true;
    }
    return false;
  }

  var SUMMARY_TITLES = [
    '最初那几年，你只学会了被照顾',
    '童年走完，世界还没变复杂',
    '少年结束，你已经学会把话咽回去',
    '青年过完，路才刚铺开',
    '中年这一段，账单和责任一起压下来',
    '中老年过去，日子开始变轻',
    '晚年将尽，能记清的事反而更少'
  ];
  var STAGE_OPENERS = [
    '从被抱着、被喂着，到自己会走会跑，婴幼儿这几年只学会了几件小事。',
    '从第一次背书包，到一个人走熟那条上学的路，童年就这样过完了。',
    '从变声的夏天，到第一次认真想将来，少年结束得比想象中快。',
    '从第一份工资，到第一次发现身体也会抗议，青年就这么过去了。',
    '从账单开始摞起来，到学会把很多话咽回去，中年这一段走完了。',
    '从孩子离家，到同龄人的名字一个个变少，中老年的日子过去了。',
    '从脚步慢下来，到许多名字开始记不清，这段路已经接近尽头。'
  ];

  function buildStageSummary(g, fromStage, toStage, impacts) {
    var now = LS.stageSnapshot(g);
    var start = g.stageStart || now;
    var sa = start.attrs || {};
    var startAge = num0(start.age);
    var endAge = num0(now.age);
    var sIdx = Math.max(1, LS.STAGES.indexOf(fromStage) + 1);
    var mark = LS.stageMarkByStage(toStage);
    var lines = [];
    var changes = [];

    /* 开口：每个阶段用不同句式，同一局里不重复 */
    lines.push(STAGE_OPENERS[sIdx - 1] || ('从' + fromStage + '走到' + toStage + '，这一段就这样过去了。'));

    /* 做了什么：按真实属性涨幅、抉择次数与履历归纳 */
    var kD = dif(sa.knowledge, now.attrs.knowledge);
    var fD = dif(sa.finance, now.attrs.finance);
    var cD = dif(sa.charm, now.attrs.charm);
    var hD = dif(sa.happiness, now.attrs.happiness);
    var hpD = dif(sa.health, now.attrs.health);
    var stD = dif(sa.stress, now.attrs.stress);
    var repD = dif(start.rep, now.rep);
    var cashD = dif(start.cash, now.cash);
    var assetD = dif(start.assets, now.assets);
    var debtD = dif(start.debt, now.debt);

    var vv = (sIdx - 1) % 3;
    var did = [];
    var knowGot = num0(now.attrs.knowledge), knowOld = num0(sa.knowledge);
    if (kD >= 4) {
      did.push([
        '把时间压在书本上，学识从 ' + knowOld + ' 抬到 ' + knowGot,
        '书桌前的那些年头没有白费，学识从 ' + knowOld + ' 走到 ' + knowGot,
        '靠自学和考试一点点往上走，学识到了 ' + knowGot
      ][vv]);
    } else if (kD <= -4) {
      did.push('书读得少了，学识退回到 ' + knowGot);
    }
    if (fD >= 5) {
      did.push([
        '开始算得清收支，财力涨到 ' + num0(now.attrs.finance),
        '对钱的事不再糊涂，财力到了 ' + num0(now.attrs.finance),
        '手里逐渐有了余钱，财力升到 ' + num0(now.attrs.finance)
      ][vv]);
    }
    if (cD >= 5) {
      did.push([
        '比从前更会跟人打交道，魅力到了 ' + num0(now.attrs.charm),
        '在人前不再局促，魅力涨到 ' + num0(now.attrs.charm),
        '学会了看人说话，魅力到了 ' + num0(now.attrs.charm)
      ][vv]);
    }
    if (hD >= 6) {
      did.push(['有过一段真正松快的日子', '这几年的笑是真的', '有过几段不用硬撑的时光'][vv]);
    }
    if (hpD >= 5) {
      did.push(['身体养回来了些', '体力比进这一段时好', '身上的小毛病少了些'][vv]);
    }
    var cCount = 0;
    for (var ci = 0; ci < (g.choiceLog || []).length; ci++) {
      var ch = g.choiceLog[ci];
      if (ch && num0(ch.age) >= startAge && num0(ch.age) <= endAge) cCount++;
    }
    if (cCount >= 3) did.push('做过 ' + cCount + ' 次要紧的决定');
    var lastJob = '';
    for (var hi = 0; hi < g.job.history.length; hi++) {
      var hh = g.job.history[hi];
      if (hh && num0(hh.age) >= startAge && num0(hh.age) <= endAge) lastJob = hh.text;
    }
    if (lastJob) did.push(lastJob);
    if (!did.length) did.push('这一段没有太大的起伏，日子按原来的样子往下走');
    lines.push(did.slice(0, 3).join('；') + '。');

    /* 代价：真实的亏损、负债、压力与隐患 */
    var cost = [];
    if (hpD <= -6) cost.push('身体亏了 ' + Math.abs(hpD) + ' 点');
    if (stD >= 8) cost.push('压力一路加到 ' + num0(now.attrs.stress));
    if (debtD > 0) cost.push('负债多了 ' + LS.fmtMoney(debtD));
    else if (cashD <= -20000) cost.push('现金少了 ' + LS.fmtMoney(-cashD));
    if (hD <= -6) cost.push('心情比刚进这一阶段时低');
    if (assetD < 0) cost.push('资产缩水 ' + LS.fmtMoney(-assetD));
    var maxRisk = 0, maxRiskKey = '';
    LS.RISK_KEYS.forEach(function (k) {
      var v = num0((g.risks || {})[k]);
      if (v > maxRisk) { maxRisk = v; maxRiskKey = k; }
    });
    if (maxRisk >= 35) cost.push('隐患“' + LS.RISK_LABEL[maxRiskKey] + '”积到 ' + Math.round(maxRisk));
    var noCost = [
      '代价不算重，只是时间被用掉了。',
      '没吃什么大亏，日子把时间收走了。',
      '账面上没有损失，代价藏在看不见的地方。',
      '谈不上吃亏，只是把几年交给了日常。',
      '这一段的代价很小，小到当时没察觉。',
      '没赔什么钱，只赔了些精神。',
      '损失不重，重的是那些没做成的事。'
    ];
    if (cost.length) lines.push('代价也记在账上：' + cost.slice(0, 3).join('，') + '。');
    else lines.push(noCost[(sIdx - 1) % noCost.length]);

    /* 留下了什么：钱、名、关系、孩子、房子 */
    var left = [];
    var net = LS.netWorth(g);
    if (net > 0) left.push('净资产 ' + LS.fmtMoney(net));
    else if (net < 0) left.push('净资产为负 ' + LS.fmtMoney(net));
    if (repD >= 5) left.push('声望涨了 ' + repD + ' 点');
    else if (now.rep >= 55) left.push('在外头有些名声');
    if (g.family.marriage.status === '已婚') left.push('婚姻还在，已经 ' + num0(g.stats.marriedYears) + ' 年');
    else if (g.family.marriage.status === '离异') left.push('婚姻中途散了');
    else if (g.family.marriage.status === '丧偶') left.push('伴侣先走了一步');
    if (g.family.childrenIds.length) left.push('孩子 ' + g.family.childrenIds.length + ' 个');
    if (g.house.owned) left.push('一套自己的房子');
    if (!left.length) left.push('没有攒下什么，只留下一段经历');
    var leftPre = ['留下的东西：', '到最后留在手里的：', '这一段攒下的：', '能带走的只有：',
      '清算这一段，剩下：', '回头看，值钱的只有：', '手里剩下的：'];
    lines.push(leftPre[(sIdx - 1) % leftPre.length] + left.slice(0, 4).join('，') + '。');

    /* 关系变化：与 stageStart 里的 NPC 好感对比 */
    var relBits = [];
    var relNow = now.npcs || [];
    var relOld = start.npcs || [];
    for (var ni = 0; ni < relOld.length; ni++) {
      var o = relOld[ni];
      var n2 = null;
      for (var nj = 0; nj < relNow.length; nj++) if (relNow[nj].id === o.id) { n2 = relNow[nj]; break; }
      if (!n2) continue;
      var fd = num0(n2.favor) - num0(o.favor);
      if (fd >= 12 && o.role !== '父亲' && o.role !== '母亲') relBits.push('和' + o.role + '走近了');
      else if (fd <= -12) relBits.push('和' + o.role + '疏远了');
    }
    if (relBits.length) lines.push(relBits.slice(0, 2).join('，') + '，这些关系也留在了这一段里。');

    var maxLines = (fromStage === '婴幼儿' || fromStage === '童年') ? 3 : 5;
    if (lines.length > maxLines) lines = lines.slice(0, maxLines);
    if (lines.length < 2) lines.push('这一段很短，短到还没来得及留下什么。');

    /* changes：真实差值 */
    [['knowledge', '学识'], ['health', '健康'], ['finance', '财力'], ['charm', '魅力'], ['happiness', '幸福感'], ['stress', '压力']].forEach(function (p) {
      var d = dif(sa[p[0]], now.attrs[p[0]]);
      if (d) changes.push({ kind: 'attr', label: p[1], delta: d });
    });
    if (repD) changes.push({ kind: 'attr', label: '声望', delta: repD });
    if (cashD) changes.push({ kind: 'money', label: '现金', delta: cashD });
    if (assetD) changes.push({ kind: 'money', label: '资产', delta: assetD });
    if (debtD) changes.push({ kind: 'money', label: '负债', delta: debtD });
    var oldTags = start.tags || [];
    for (var ti = 0; ti < (now.tags || []).length; ti++) {
      if (oldTags.indexOf(now.tags[ti]) < 0) changes.push({ kind: 'tag', label: now.tags[ti], delta: '新增' });
    }
    if (changes.length > 10) changes = changes.slice(0, 10);

    var useImpacts = impacts;
    if (!useImpacts) {
      useImpacts = (g.stageImpact || []).filter(function (x) {
        return x && x.stage === fromStage && num0(x.age) === endAge;
      });
    }

    return {
      fromStage: fromStage,
      toStage: toStage,
      key: mark ? mark.key : LS.stageKeyOf(endAge),
      title: SUMMARY_TITLES[sIdx - 1] || ('回望' + fromStage),
      atAge: endAge,
      lines: lines,
      changes: changes,
      impacts: useImpacts || []
    };
  }

  /* ---------------- 事件筛选 ---------------- */
  function condOk(g, e) {
    if (!e) return false;
    if (!e.cond) return true;
    try { return !!e.cond(g); } catch (err) { return false; }
  }

  function isPendingFuture(g, id) {
    for (var i = 0; i < g.pending.length; i++) {
      if (g.pending[i].event === id && g.pending[i].dueAge > g.age) return true;
    }
    return false;
  }

  function isFired(g, e) {
    if (e.repeatable) {
      var cd = e.cooldown || 2;
      var last = g.fireAge && g.fireAge[e.id];
      if (last === undefined) return false;
      return (g.age - last) < cd;
    }
    return g.fired.indexOf(e.id) >= 0;
  }

  function pickWeighted(list, g) {
    var total = 0;
    var weights = [];
    /* v3：跨局/本局冷却都让重复事件降权，而不是直接剔除 */
    var globalCD = (LS.eventCDRead ? LS.eventCDRead() : {}) || {};
    var epochMul = (g.epoch && g.epoch.mods && num0(g.epoch.mods.random)) || 1;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      var w = Math.max(0.05, e.weight || 1);
      var pos = /机会|表扬|旅行|朋友|婚礼|涨|爱好|花|志愿|同学会|红包|升职|分红/.test(e.title || '');
      var neg = /病|流感|摔|裁员|骗|吵|疼|亏|住院|诈骗|债|失|冲突|危机/.test(e.title || '');
      if (pos) w *= 1 + luckOf(g) * 4 + LS.repTotal(g) / 100 * 0.2;
      if (neg) w *= 1 - luckOf(g) * 2.5;
      var cdA = globalCD[e.id];
      if (cdA) w *= 1 / (1 + num0(cdA.runs) * 0.3);
      var cdB = g.eventCD && g.eventCD[e.id];
      if (cdB) w *= 1 / (1 + num0(cdB.runs) * 0.3);
      w *= epochMul;
      if (w < 0.02) w = 0.02;
      total += w;
      weights.push(w);
    }
    if (total <= 0) return list[Math.floor(LS.rand() * list.length)] || null;
    var r = LS.rand() * total;
    for (var j = 0; j < list.length; j++) {
      r -= weights[j];
      if (r <= 0) return list[j];
    }
    return list[list.length - 1];
  }

  /* ---------------- v2：求职命运岔路 ---------------- */
  function needHunt(g) {
    if (g.death.dead || g.job.id || g.marks.retired) return false;
    if (g.edu.inSchool) return false;
    if (g.age < 19 || g.age >= 60) return false;
    return true;
  }

  function huntChance(g, strategy) {
    var s = 0.12;
    s += (g.edu.level || 0) * 0.052;
    s += (g.attrs.knowledge - 40) * 0.0038;
    s += LS.repTotal(g) * 0.0012;
    s += (g.attrs.charm - 40) * 0.0018;
    s += Math.min(0.12, (g.job.huntTries || 0) * 0.035);
    if (g.marks.has_cert) s += 0.05;
    if (g.marks.job_referral) s += 0.04;
    if (strategy === 'safe') s += 0.12;
    if (strategy === 'up') s -= 0.14;
    if (strategy === 'low') s += 0.20;
    if (strategy === 'referral') s += 0.15;
    /* v3：时代背景影响求职概率 */
    if (g.epoch && g.epoch.mods && num0(g.epoch.mods.hunt)) s *= num0(g.epoch.mods.hunt);
    return LS.clamp(s, 0.12, 0.9);
  }

  function huntPool(g, strategy) {
    var map = {
      safe: ['civil', 'stateowned', 'teacher'],
      up: ['engineer', 'doctor', 'sales', 'startup'],
      low: ['gig', 'sales', 'freelance', 'stateowned'],
      referral: ['stateowned', 'engineer', 'sales', 'teacher']
    };
    var list = (map[strategy] || map.safe).filter(function (id) {
      var jd = LS.JOBS[id];
      return jd && (jd.minEdu || 0) <= g.edu.level;
    });
    if (!list.length) list = ['gig'];
    return list;
  }

  function huntReason(g, strategy) {
    var parts = [];
    parts.push('学历' + LS.eduName(g.edu.level));
    if (g.attrs.knowledge >= 65) parts.push('学识扎实（' + Math.round(g.attrs.knowledge) + '）');
    else if (g.attrs.knowledge < 40) parts.push('学识偏弱（' + Math.round(g.attrs.knowledge) + '）');
    if (LS.repTotal(g) >= 55) parts.push('社会声望帮了忙');
    else if (LS.repTotal(g) <= 25) parts.push('缺少能背书的名声');
    if (g.marks.has_cert) parts.push('持有相关证书');
    if (g.marks.job_referral) parts.push('有熟人内推');
    if (strategy === 'referral') parts.push('这次动用了人情');
    if (strategy === 'low') parts.push('你主动降低了薪资预期');
    if (strategy === 'up') parts.push('目标岗位竞争激烈');
    if ((g.job.huntTries || 0) > 1) parts.push('前几次面试积累了经验');
    if (g.job.history.length > 1) parts.push('过往履历被参考');
    return parts.join('、');
  }

  function resolveHunt(g, strategy) {
    g.job.huntTries = (g.job.huntTries || 0) + 1;
    var p = huntChance(g, strategy);
    var win = LS.chance(p);
    var reason = huntReason(g, strategy);
    if (strategy === 'referral') {
      g.rep.society = LS.clamp(g.rep.society - 5, 0, 100);
      g.flags.referralUsed = true;
    }
    if (strategy === 'low') g.attrs.happiness = LS.clamp(g.attrs.happiness - 3, 0, 100);
    if (strategy === 'up') g.attrs.stress = LS.clamp(g.attrs.stress + 3, 0, 100);

    if (!win) {
      g.flags.unemployed = true;
      g.flags.needJob = true;
      g.stats.huntFail = (g.stats.huntFail || 0) + 1;
      g.attrs.stress = LS.clamp(g.attrs.stress + 6, 0, 100);
      g.attrs.happiness = LS.clamp(g.attrs.happiness - 4, 0, 100);
      g.money.cash -= 3000;
      g.attrs.knowledge = LS.clamp(g.attrs.knowledge + 1, 0, 100);
      g.job.lastHunt = { age: g.age, ok: false, strategy: strategy, chance: p, reason: reason };
      LS.addMemory(g, '求职失败（' + reason + '），进入待业状态。', 'echo');
      return '面试没有通过。判断依据：' + reason + '。你进入待业，存款继续消耗，压力上升，下一年还得再试一次。';
    }

    var pool = huntPool(g, strategy);
    var id = LS.pick(pool);
    var mul = strategy === 'up' ? 1.32 : (strategy === 'low' ? 0.72 : (strategy === 'referral' ? 1.08 : 1.0));
    var salary = Math.round((LS.jobSalary(id, 0) * mul * (0.86 + g.attrs.knowledge / 320)) / 1000) * 1000;
    setJob(g, { id: id, salary: salary });
    var tags = g.job.tags || {};
    g.job.lastHunt = { age: g.age, ok: true, strategy: strategy, chance: p, reason: reason, job: id };
    LS.addMemory(g, '求职成功，进入' + LS.JOBS[id].name + '岗位（' + reason + '）。', 'echo');
    return '面试通过。判断依据：' + reason + '。你拿到了' + LS.JOBS[id].name + '的录用通知，年薪 ' +
      LS.fmtMoney(salary) + '；这份工作加班强度' + (tags.overtime || '—') + '、健康消耗' + (tags.health || '—') + '。';
  }

  function buildJobHuntEvent(g) {
    var tries = g.job.huntTries || 0;
    var major = g.attrs.knowledge >= 60 ? '理工 / 研究型'
      : (g.attrs.finance >= 55 ? '商科 / 管理型'
        : (g.attrs.charm >= 55 ? '文史 / 沟通型' : '通用型'));
    var pct = function (p) { return Math.round(p * 100) + '%'; };
    var pSafe = huntChance(g, 'safe'), pUp = huntChance(g, 'up'), pLow = huntChance(g, 'low');
    var pRef = huntChance(g, 'referral');
    var chips =
      '手里的筹码：学历 ' + LS.eduName(g.edu.level) +
      ' · 学识 ' + g.attrs.knowledge +
      ' · 专业倾向 ' + major +
      ' · 声望 ' + LS.repTotal(g) +
      ' · 人脉 ' + (g.flags && g.flags.referralUsed ? '已消耗一次内推' : '尚可动用') +
      ' · 证书 ' + (g.marks.has_cert ? '有' : '无') +
      ' · 已求职 ' + tries + ' 次。';
    var text = (tries === 0
      ? '毕业之后，工作不会自己找上门。招聘软件上挂着上百个岗位，真正愿意给你面试机会的却不多。你的学历、学识、声望与过往经历，共同决定了能碰到哪一档门槛。'
      : '又是一年。存款在减少，简历上的空档越来越显眼。招聘市场没有变好，你只能调整策略，再赌一次。') +
      '\n\n' + chips;
    var opts = [
      { label: '稳妥求职：国企、事业单位与本地稳定岗位', hint: '成功率约 ' + pct(pSafe) + ' · 薪资中等 · 加班少', tone: 'safe',
        apply: function (g2) { return resolveHunt(g2, 'safe'); } },
      { label: '向上冲：大厂与高薪岗位', hint: '成功率约 ' + pct(pUp) + ' · 起薪高 · 加班与健康消耗大', tone: 'risk',
        apply: function (g2) { return resolveHunt(g2, 'up'); } },
      { label: '先降预期：先有收入，再谈发展', hint: '成功率约 ' + pct(pLow) + ' · 薪资偏低 · 幸福感 -3', tone: 'switch',
        apply: function (g2) { return resolveHunt(g2, 'low'); } }
    ];
    if (LS.repTotal(g) >= 40) {
      opts.push({ label: '托熟人内推', hint: '成功率约 ' + pct(pRef) + ' · 消耗人脉（社会声望 -5）', tone: 'switch',
        apply: function (g2) { return resolveHunt(g2, 'referral'); } });
    }
    return {
      id: 'jobhunt',
      type: 'forced',
      tier: 'crossroad',
      stage: g.stage,
      prio: 95,
      repeatable: true,
      cooldown: 1,
      art: 'jobfair',
      title: '命运岔路：求职',
      text: text,
      hunt: { chance: { safe: pSafe, up: pUp, low: pLow, referral: pRef }, major: major },
      opts: opts,
      isDynamic: true
    };
  }

  /* ---------------- v2：健康隐患与负面事件门禁 ---------------- */
  function riskBlocked(g, e) {
    if (!e || !e.healthNeg) return false;
    if (g.attrs.health > 75) return true;
    /* 同一角色连续 3 回合内禁止连续触发健康负面事件 */
    if (g.age - (g.stats.healthNegAge === undefined ? -99 : g.stats.healthNegAge) < 3) return true;
    return false;
  }

  function markHealthNeg(g) {
    g.stats.healthNegAge = g.age;
    g.stats.healthNegCount = (g.stats.healthNegCount || 0) + 1;
    g.healthNegLog = g.healthNegLog || [];
    g.healthNegLog.push(g.age);
  }

  function pickRiskKey(g) {
    var best = 'highStress', v = -1;
    LS.RISK_KEYS.forEach(function (k) {
      var x = (g.risks && g.risks[k]) || 0;
      if (x > v) { v = x; best = k; }
    });
    return best;
  }

  function riskActive(g, e) {
    if (e.riskKey) return ((g.risks && g.risks[e.riskKey]) || 0) >= (e.riskMin || 20);
    return LS.RISK_KEYS.some(function (k) { return ((g.risks && g.risks[k]) || 0) >= 25; });
  }
  /* ---- v3：事件去重、时代、关键年与平淡年 ---- */
  function seenBefore(g, e) {
    if (!e) return true;
    if (e.repeatable) return false;
    if (layerOf(e) === 'chain') return false;
    return (g.eventSeen || []).indexOf(e.id) >= 0;
  }

  function maybeNewEpoch(g) {
    var list = LS.ERAS || [];
    if (!list.length) return;
    var age = num0(g.age);
    var cur = g.epoch || { name: '', mods: {}, until: null };
    if (cur.until !== null && cur.until !== undefined && age < cur.until) return;
    var pick = null;
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (age >= num0(it.from) && age <= num0(it.to)) { pick = it; break; }
    }
    if (!pick) return;
    var until = pick.to === undefined ? null : num0(pick.to) + 1;
    if (cur.name === pick.name && cur.until === until) return;
    g.epoch = { name: pick.name, mods: pick.mods || {}, until: until };
    LS.addMemory(g, '时代换成了' + pick.name + '，日子的算法跟着变了。', 'era');
  }

  function ageMatch(e, age) {
    if (!e) return false;
    if (typeof e.age === 'number') return e.age === age;
    if (Object.prototype.toString.call(e.age) === '[object Array]') return age >= e.age[0] && age <= e.age[1];
    return false;
  }

  /* 关键年：强制剧情、到期回响、命运岔路、时代切换、高权重随机事件 */
  function hasKeyEvent(g, nextAge) {
    var E = LS.EVENTS || [];
    var stage = LS.stageOf(nextAge);
    var i, e;
    for (i = 0; i < E.length; i++) {
      e = E[i];
      if (!e || e.type !== 'forced') continue;
      if (!ageMatch(e, nextAge)) continue;
      if (e.stage && e.stage !== stage) continue;
      if (isFired(g, e) || isPendingFuture(g, e.id)) continue;
      if (!condOk(g, e)) continue;
      return true;
    }
    for (i = 0; i < g.pending.length; i++) {
      if (g.pending[i] && num0(g.pending[i].dueAge) <= nextAge) return true;
    }
    for (i = 0; i < E.length; i++) {
      e = E[i];
      if (!e || e.tier !== 'crossroad') continue;
      if (e.stage && e.stage !== stage) continue;
      if (!ageMatch(e, nextAge)) continue;
      if (isFired(g, e) || seenBefore(g, e)) continue;
      if (!condOk(g, e)) continue;
      return true;
    }
    if (g.epoch && g.epoch.until !== null && g.epoch.until !== undefined && nextAge >= g.epoch.until) return true;
    for (i = 0; i < E.length; i++) {
      e = E[i];
      if (!e || e.type !== 'random') continue;
      if (e.stage !== stage) continue;
      var w = e.weight === undefined ? 1 : num0(e.weight);
      if (w < 4) continue;
      if (isFired(g, e) || seenBefore(g, e)) continue;
      if (!condOk(g, e)) continue;
      return true;
    }
    return false;
  }

  function paceOf(age) {
    var p = PACE[LS.stageOf(age)];
    return p === undefined ? 0.2 : p;
  }

  /* 静默推进一年：与 advance 同口径，但不处理阶段过场（由调用方保证不跨阶段） */
  function quietStep(g) {
    if (g.death.dead) return false;
    if (g.turn >= MAX_TURNS || g.age >= 110) {
      finish(g, '自然寿终');
      return false;
    }
    g.age += 1;
    g.year += 1;
    g.turn += 1;
    g.stage = LS.stageOf(g.age);
    tickEconomy(g);
    tickHealth(g);
    tickNpcs(g);
    clampAttrs(g);
    LS.snapshot(g);
    var reason = deathReason(g);
    if (reason) { finish(g, reason); return false; }
    return true;
  }

  var QUIET_LINES = [
    '这 {n} 年没什么值得记的：{job}，家里也没什么变化。',
    '{fromAge} 岁到 {age} 岁，日子像一条平直的线，{job}。',
    '又过了 {n} 年，{fam}，你把时间花在重复的小事上。',
    '这几年安静得几乎没有声音，{job}，{fam}。',
    '没有哪一年值得单独拿出来说，{job}，{fam}。',
    '{age} 岁这一年回头看，前面的 {n} 年只是把同一天过了几遍。',
    '平淡的 {n} 年，{job}；好在没有出事。'
  ];
  var QUIET_STAGE = {
    '婴幼儿': ['还不会记事，日子只有吃、睡和被人抱着。', '大人们在忙，你只是慢慢长大。'],
    '童年': ['上学、放学、写作业，一年和另一年几乎一样。', '成绩单发下来，日子又接着往下过。'],
    '少年': ['课本、考试和没说出口的话，把日子填满了。', '没什么大事，只是又长高了一点。'],
    '青年': ['工作、通勤、月底算账，一年很快就用完了。', '忙起来的时候，连周末是什么时候都记不清。'],
    '中年': ['账单、家里的事和身体的小毛病，把时间分完了。', '该做的事一件接一件，没有停下来的机会。'],
    '中老年': ['日子慢下来，买菜、做饭、在小区里走走。', '熟人见面的次数变少，季节倒记得更清楚。'],
    '晚年': ['吃药、量血压、等子女的电话，一天就这样过去。', '路走得慢，日子也跟着慢了。']
  };

  function jobPhrase(g) {
    if (g.marks && g.marks.retired) return '退休后每天按固定时间起床';
    if (g.job && g.job.id) return '工作还是' + LS.jobTitle(g.job.id, g.job.level) + '，忙的时候顾不上别的';
    if (g.edu && g.edu.inSchool) return '还留在学校里，课程一门接一门';
    return '没有固定工作，靠零活和积蓄撑着';
  }

  function famPhrase(g) {
    if (g.family.childrenIds.length) return '家里有孩子要照看';
    if (g.family.marriage.status === '已婚') return '和伴侣两个人过着';
    if (g.age >= 30) return '一个人住，来往的人不多';
    return '还跟着父母生活';
  }

  function makeQuietNote(g, years) {
    var stage = g.stage;
    var pool = QUIET_LINES.slice();
    var extra = QUIET_STAGE[stage] || [];
    for (var i = 0; i < extra.length; i++) pool.push(extra[i]);
    var seen = g.quietNoteSeen || [];
    var avail = [];
    for (var j = 0; j < pool.length; j++) if (seen.indexOf(pool[j]) < 0) avail.push(pool[j]);
    if (!avail.length) {
      g.quietNoteSeen = [];
      avail = pool.slice();
    }
    var tpl = avail[Math.floor(LS.rand() * avail.length)] || pool[0];
    var note = tpl
      .replace(/\{n\}/g, String(years))
      .replace(/\{age\}/g, String(g.age))
      .replace(/\{fromAge\}/g, String(Math.max(0, g.age - years)))
      .replace(/\{job\}/g, jobPhrase(g))
      .replace(/\{fam\}/g, famPhrase(g))
      .replace(/\{stage\}/g, stage);
    g.quietNoteSeen.push(tpl);
    if (g.quietNoteSeen.length > 40) g.quietNoteSeen = g.quietNoteSeen.slice(-40);
    g.quietYears = num0(g.quietYears) + years;
    g.quietNote = note;
    return note;
  }

  function attachQuiet(e, note) {
    if (!e || !note) return e;
    var out = {};
    for (var k in e) out[k] = e[k];
    out.quietNote = note;
    return out;
  }

  /* UI 直接调用：从当前状态推进到下一个关键节点前，最多 8 年 */
  function skipQuiet(g) {
    if (!g || g.death.dead || g.current) return { years: 0, note: (g && g.quietNote) || '' };
    var years = 0;
    while (years < 8 && !g.death.dead) {
      if (hasKeyEvent(g, g.age)) break;
      var nextAge = g.age + 1;
      if (g.turn >= MAX_TURNS || nextAge >= 110) break;
      if (LS.stageOf(nextAge) !== g.stage) break;
      if (!quietStep(g)) break;
      years++;
    }
    var note = '';
    if (years > 0) note = makeQuietNote(g, years);
    return { years: years, note: note };
  }

  function selectEvent(g) {
    var E = LS.EVENTS;
    maybeNewEpoch(g);

    /* 0. 待业/毕业：进入独立的求职命运岔路（同岁有强制剧情时先走剧情） */
    if (needHunt(g)) {
      var hasForced = E.some(function (x) {
        return x.type === 'forced' && x.age === g.age && condOk(g, x) && !isFired(g, x);
      });
      if (!hasForced) {
        var lastHunt = g.job.lastHunt;
        var huntedThisAge = lastHunt && lastHunt.age === g.age;
        /* 求职失败后的隔年，留出待业衍生事件的位置，再回到求职 */
        if (lastHunt && !lastHunt.ok && !huntedThisAge && LS.chance(0.35)) {
          /* fall through：让 causal 选择器决定是否出现“待业的日子” */
        } else if (!huntedThisAge) {
          return buildJobHuntEvent(g);
        } else {
          /* 本岁已投过一次，回到常规事件 */
        }
      }
    }

    /* 1. 阶段强制事件 */
    var forced = [];
    for (var i = 0; i < E.length; i++) {
      var f = E[i];
      if (f.type === 'forced' && f.age === g.age && condOk(g, f) && g.fired.indexOf(f.id) < 0) forced.push(f);
    }
    if (forced.length) {
      forced.sort(function (a, b) { return (b.prio || 0) - (a.prio || 0); });
      return forced[0];
    }

    /* 2. 到期的因果标记 */
    var due = [];
    for (var p = 0; p < g.pending.length; p++) {
      var item = g.pending[p];
      if (item.dueAge > g.age) continue;
      var pe = LS.EVENT_INDEX[item.event];
      if (pe && riskBlocked(g, pe)) continue;
      due.push({ item: item, ev: pe, prio: pe ? (pe.prio || 60) : 0 });
    }
    if (due.length) {
      due.sort(function (a, b) { return b.prio - a.prio; });
      var chosen = due[0];
      var idx = g.pending.indexOf(chosen.item);
      if (idx >= 0) g.pending.splice(idx, 1);
      if (chosen.item.mark) g.marks[chosen.item.mark] = true;
      if (chosen.item.note) LS.addMemory(g, chosen.item.note + '，事情在这一年有了结果。', 'causal');
      if (chosen.ev && condOk(g, chosen.ev)) {
        var fromAge = chosen.item.choiceAge;
        if (fromAge === null || fromAge === undefined) fromAge = Math.max(0, g.age - (chosen.item.delay || 1));
        g.echoInfo = {
          kind: 'echo',
          fromAge: fromAge,
          years: Math.max(1, g.age - fromAge),
          sourceTitle: chosen.item.choiceTitle || '',
          choiceLabel: chosen.item.choiceLabel || '',
          choiceId: chosen.item.choiceId || '',
          note: chosen.item.note || '',
          riskKey: chosen.item.riskKey || (chosen.ev && chosen.ev.riskKey) || '',
          oneLiner: (chosen.item.choiceLabel ? '当时你选择了「' + chosen.item.choiceLabel + '」' : (chosen.item.note || '此前的选择'))
        };
        /* v2：真实记录“伏笔落地”，因果链视图据此串联，不靠文案硬凑 */
        g.echoLog = g.echoLog || [];
        g.echoLog.push({
          choiceId: chosen.item.choiceId || '',
          choiceAge: fromAge,
          choiceTitle: chosen.item.choiceTitle || '',
          choiceLabel: chosen.item.choiceLabel || '',
          eventId: chosen.ev.id,
          eventTitle: chosen.ev.title,
          age: g.age,
          year: g.year,
          delay: Math.max(1, g.age - fromAge),
          note: chosen.item.note || ''
        });
        if (g.echoLog.length > 120) g.echoLog = g.echoLog.slice(-120);
        return chosen.ev;
      }
    }

    /* 3. 因果条件事件（按一定概率插入，避免压掉随机事件） */
    var causal = [];
    for (var c = 0; c < E.length; c++) {
      var ce = E[c];
      if (ce.type !== 'causal') continue;
      if (ce.stage && ce.stage !== g.stage) continue;
      if (!condOk(g, ce)) continue;
      if (riskBlocked(g, ce)) continue;
      if (ce.healthNeg && !riskActive(g, ce)) continue;
      if (isFired(g, ce)) continue;
      if (isPendingFuture(g, ce.id)) continue;
      causal.push(ce);
    }
    if (causal.length) {
      /* v3：只有真正的健康急症才无条件插队；其余按概率，避免高优先级的普适因果事件饿死随机层 */
      var urgent = causal.some(function (x) { return x.healthNeg && num0(g.attrs.health) < 45; });
      /* 多年事件链优先：链上事件一旦满足条件，给更高的落点概率，避免被普适因果事件挤掉 */
      var chainPool = [];
      for (var cc = 0; cc < causal.length; cc++) {
        if (causal[cc].layer === 'chain') chainPool.push(causal[cc]);
      }
      if (urgent || LS.chance(0.45)) {
        var picked = pickWeighted((chainPool.length && LS.chance(0.55)) ? chainPool : causal, g);
        if (picked) {
          if (picked.healthNeg || picked.riskKey) {
            var rk = picked.riskKey || pickRiskKey(g);
            var org = (g.riskOrigin || {})[rk] || null;
            g.echoInfo = {
              kind: 'risk',
              fromAge: org ? org.age : Math.max(0, g.age - 2),
              years: org ? Math.max(1, g.age - org.age) : 2,
              sourceTitle: org ? org.title : '长期的生活习惯',
              choiceLabel: org ? org.label : '',
              choiceId: '',
              riskKey: rk,
              note: LS.RISK_LABEL[rk] || '',
              oneLiner: (LS.RISK_LABEL[rk] || '长期隐患')
            };
          } else if (picked.tier === 'echo' && !g.echoInfo) {
            g.echoInfo = { kind: 'echo', fromAge: Math.max(0, g.age - 1), years: 1, sourceTitle: '', choiceLabel: '', oneLiner: '此前的经历' };
          }
          if (picked.tier === 'echo') {
            g.echoLog = g.echoLog || [];
            g.echoLog.push({
              choiceId: '',
              choiceAge: g.echoInfo.fromAge,
              choiceTitle: g.echoInfo.sourceTitle || '',
              choiceLabel: g.echoInfo.choiceLabel || '',
              eventId: picked.id,
              eventTitle: picked.title,
              age: g.age,
              year: g.year,
              delay: g.echoInfo.years || 1,
              note: g.echoInfo.note || ''
            });
            if (g.echoLog.length > 120) g.echoLog = g.echoLog.slice(-120);
          }
          return picked;
        }
      }
    }

    /* 3b. 时代层：只在少数年份出现，却会改写后续若干年的环境；先于支线判定，保证能被看到 */
    var era = [];
    for (var ei = 0; ei < E.length; ei++) {
      var ee = E[ei];
      if (ee.type !== 'era' && layerOf(ee) !== 'era') continue;
      if (ee.stage && ee.stage !== g.stage) continue;
      if (!condOk(g, ee)) continue;
      if (isFired(g, ee)) continue;
      if (isPendingFuture(g, ee.id)) continue;
      era.push(ee);
    }
    if (era.length && LS.chance(0.55)) {
      var ePick = pickWeighted(era, g);
      if (ePick) return ePick;
    }

    /* 3c. 分支剧情层：条件满足时按权重插入，替代当年的随机事件而非额外增加回合 */
    var branch = [];
    for (var bi = 0; bi < E.length; bi++) {
      var be = E[bi];
      if (be.type !== 'branch' && layerOf(be) !== 'branch') continue;
      if (be.stage && be.stage !== g.stage) continue;
      if (!condOk(g, be)) continue;
      if (riskBlocked(g, be)) continue;
      if (isFired(g, be)) continue;
      if (isPendingFuture(g, be.id)) continue;
      branch.push(be);
    }
    if (branch.length) {
      var urgentB = branch.some(function (x) { return (x.prio || 0) >= 85; });
      if (urgentB || LS.chance(0.30)) {
        var bPick = pickWeighted(branch, g);
        if (bPick) return bPick;
      }
    }

    /* 4. 随机权重事件（健康负面一律不在此池，见因果链路） */
    var random = [];
    for (var r = 0; r < E.length; r++) {
      var re = E[r];
      if (re.type !== 'random') continue;
      if (re.stage !== g.stage) continue;
      if (re.healthNeg) continue;
      if (!condOk(g, re)) continue;
      if (isFired(g, re)) continue;
      if (seenBefore(g, re)) continue;
      random.push(re);
    }
    if (random.length) {
      var rp = pickWeighted(random, g);
      if (rp) return rp;
    }

    /* 5. 兜底日常 */
    for (var d = 0; d < E.length; d++) {
      var de = E[d];
      if (de.type === 'daily' && de.stage === g.stage) return de;
    }
    return null;
  }

  /* ---------------- 年度演化 ---------------- */
  function healthLoss(g) {
    var age = g.age;
    var loss;
    if (age <= 3) loss = 0.6;
    else if (age <= 12) loss = 0.5;
    else if (age <= 18) loss = 0.8;
    else if (age <= 30) loss = 1.0;
    else if (age <= 40) loss = 1.4;
    else if (age <= 55) loss = 2.0;
    else if (age <= 70) loss = 3.4;
    else if (age <= 85) loss = 5.2;
    else loss = 7.0;

    if (g.job.id) {
      var jd = LS.JOBS[g.job.id];
      loss += (jd.healthDrain || 0) * 0.9;
      var jt = g.job.tags || {};
      if (jt.overtime === '高') loss += 0.5;
    }
    /* 隐性隐患长期消耗 */
    var maxRisk = 0;
    LS.RISK_KEYS.forEach(function (k) { maxRisk = Math.max(maxRisk, (g.risks && g.risks[k]) || 0); });
    loss += maxRisk / 100 * 1.6;
    if (age >= 45) loss += (age - 45) * 0.08;

    /* 慢性病与旧账 */
    if (g.marks.bp_untreated) loss += 1.8;
    if (g.marks.liver_bad) loss += 1.5;
    if (g.marks.lung_issue) loss += 1.4;
    if (g.marks.back_pain) loss += 0.9;
    if (g.marks.chronic_overtime) loss += 0.5;
    if (g.marks.smoke_years) loss += 0.6;
    if (g.marks.on_bp_med) loss -= 0.6;
    if (g.marks.exercise) loss -= 0.7;
    if (g.marks.mobility_issue) loss += 1.0;

    if (g.attrs.stress >= 75) loss += 1.3;
    else if (g.attrs.stress >= 55) loss += 0.6;
    if (g.attrs.happiness >= 70) loss -= 0.9;
    if (g.attrs.happiness < 30) loss += 0.8;
    if (g.attrs.health < 40) loss += 0.8;

    loss *= talentMul(g, 'health');
    loss *= 1 - LS.clamp((g.attrs.knowledge - 50) / 100, 0, 0.2) * 0.12;
    return Math.max(0.2, loss);
  }

  function tickEconomy(g) {
    var jd = g.job.id ? LS.JOBS[g.job.id] : null;
    var minor = g.age < 18;

    if (jd) {
      g.job.years = (g.job.years || 0) + 1;
      g.stats.jobYears[g.job.id] = (g.stats.jobYears[g.job.id] || 0) + 1;
      g.job.salary = Math.round(g.job.salary * (jd.growth || 1.02));
      g.money.cash += Math.round(g.job.salary * talentMul(g, 'income'));
    } else if (g.marks.retired) {
      g.pension = Math.round((g.pension || 26000) * 1.02);
      g.money.cash += g.pension;
    } else if (!minor && g.age < 60) {
      /* 待业不等于零收入：零工、临时活、家里接济，勉强够糊口；但仍在消耗存款 */
      g.money.cash += 20000;
      g.attrs.stress = LS.clamp(g.attrs.stress + 2, 0, 100);
    }

    /* 未成年由家庭承担生活与教育开支，个人账户不产生生活费与负债 */
    if (minor) {
      if (g.money.cash < 0) g.money.cash = 0;
      moneyRound(g);
      return;
    }

    var living = LS.cityLiving(g);
    if (jd) {
      g.money.cash -= living;
      if (!g.house.owned) g.money.cash -= Math.round(living * 0.38);
    } else {
      /* 待业或退休后开支压缩：合租、少外食、不添置东西 */
      var tight = g.marks.retired ? 0.55 : (g.money.cash <= 0 ? 0.45 : 0.63);
      g.money.cash -= Math.round(living * tight);
      if (!g.house.owned) g.money.cash -= Math.round(living * 0.08);
    }
    var childCost = 0;
    for (var i = 0; i < g.family.childrenIds.length; i++) {
      var c = LS.getNpc(g, g.family.childrenIds[i]);
      if (c && c.alive && c.age <= 22) childCost += 7000 + c.age * 900;
    }
    g.money.cash -= childCost;
    if (g.marks.has_car) g.money.cash -= 12000;

    /* 房贷：等额本息近似；短期周转不灵记欠供，连续三年才断供法拍 */
    if (g.house.owned && g.house.mortgage > 0) {
      var annual = Math.round(g.house.mortgage * 0.062);
      if (g.money.cash >= annual) {
        g.money.cash -= annual;
        var principal = Math.round(annual * 0.62);
        g.house.mortgage = Math.max(0, g.house.mortgage - principal);
        g.money.debt = Math.max(0, g.money.debt - principal);
        g.stats.missedMortgage = 0;
        if (g.house.mortgage <= 0) {
          g.house.mortgagePaid = true;
          g.marks.mortgage_paid = true;
        }
      } else {
        var paidNow = Math.max(0, Math.round(g.money.cash * 0.7));
        g.money.cash -= paidNow;
        var shortfallMortgage = annual - paidNow;
        var principal2 = Math.round(paidNow * 0.62);
        g.house.mortgage = Math.max(0, g.house.mortgage - principal2);
        g.money.debt = Math.max(0, g.money.debt - principal2) + shortfallMortgage;
        g.stats.missedMortgage = (g.stats.missedMortgage || 0) + 1;
        g.attrs.stress += 3;
        g.marks.mortgage_late = true;
        if (g.stats.missedMortgage >= 3) {
          var auction = Math.round(g.house.value * 0.85);
          var leftover = Math.max(0, g.house.mortgage - auction);
          g.money.cash += Math.max(0, auction - g.house.mortgage);
          g.money.debt = Math.max(0, g.money.debt - g.house.mortgage) + leftover;
          g.money.assets -= g.house.value;
          g.house.owned = false;
          g.house.value = 0;
          g.house.mortgage = 0;
          g.marks.foreclosed = true;
          g.stats.missedMortgage = 0;
          g.attrs.stress += 8;
          g.attrs.happiness -= 8;
          LS.addMemory(g, '房子断供', '连续欠供，房子被银行折价处置');
        }
      }
    }

    /* 负债计息：只对消费性负债计息，房贷利息已包含在年供中 */
    var mortgageDebt = g.house.owned ? g.house.mortgage : 0;
    var consumerDebt = Math.max(0, g.money.debt - mortgageDebt);
    if (consumerDebt > 0) {
      /* 有收入时按消费贷利率计息；长期无收入且无现金时银行停息挂账，避免无限复利 */
      var rate;
      if (g.marks.debt_restructure) rate = 1.012;
      else if (jd) rate = 1.045;
      else if (g.money.cash > 5000) rate = 1.03;
      else rate = 1.0;
      g.money.debt = mortgageDebt + Math.round(consumerDebt * rate);
      g.attrs.stress += LS.clamp(consumerDebt / 160000, 0, 2.5);
      if (consumerDebt > 200000) g.marks.bad_credit = true;
      if (consumerDebt > 600000 && g.age - (g.stats.lastWriteOffAge || -99) > 8) {
        /* 长期以贷养贷仍滚到六十万以上：走个人债务清理，核销一部分，代价是征信与压力 */
        g.money.debt = mortgageDebt + Math.round(consumerDebt * 0.5);
        g.marks.write_off = true;
        g.stats.lastWriteOffAge = g.age;
        g.attrs.stress += 6;
        g.attrs.happiness -= 4;
        LS.addMemory(g, '债务核销', '银行与法院走了个人债务清理，欠款被核销一部分，征信彻底花了');
      }
    }

    /* 持有金融资产时优先偿还高息消费负债，避免“一边欠债一边存钱” */
    var cons2 = Math.max(0, g.money.debt - (g.house.owned ? g.house.mortgage : 0));
    var liquid2 = g.money.assets - (g.house.owned ? g.house.value : 0);
    if (cons2 > 20000 && liquid2 > 0) {
      var repay = Math.min(liquid2, cons2);
      g.money.assets -= repay;
      g.money.debt -= repay;
      moneyRound(g);
    }
    /* 有现金时按月供自动偿还消费负债 */
    var cons3 = Math.max(0, g.money.debt - (g.house.owned ? g.house.mortgage : 0));
    if (cons3 > 0 && g.money.cash > 10000) {
      var repay2 = Math.min(cons3, Math.round(g.money.cash * 0.3));
      g.money.cash -= repay2;
      g.money.debt -= repay2;
      moneyRound(g);
    }

    /* 现金通胀与资产行情 */
    if (g.money.cash > 0) g.money.cash *= 0.976;
    var nonHouse = g.money.assets - (g.house.owned ? g.house.value : 0);
    if (nonHouse > 0) {
      var market = -0.07 + LS.rand() * 0.19;
      var d = nonHouse * market;
      g.money.assets += d;
      if (market > 0.09) g.marks.good_market = true;
      if (market < -0.04) g.marks.bad_market = true;
    }
    if (g.house.owned) {
      var hv = g.house.value * (-0.06 + LS.rand() * 0.15);
      g.house.value = Math.max(0, Math.round(g.house.value + hv));
      g.money.assets += hv;
    }

    moneyRound(g);
    if (g.money.cash < 0) {
      /* 先变卖可变现资产填窟窿，不足部分才转为负债 */
      var shortfall = -g.money.cash;
      var liquid = g.money.assets - (g.house.owned ? g.house.value : 0);
      if (liquid > 0) {
        var sold = Math.min(liquid, shortfall);
        g.money.assets -= sold;
        g.money.cash += sold;
        g.marks.sold_assets = true;
      }
      if (g.money.cash < 0) {
        g.money.debt += -g.money.cash;
        g.money.cash = 0;
        g.attrs.stress += 2;
        g.marks.in_debt = true;
      }
      moneyRound(g);
    }
  }

  /* v2：隐性隐患逐年累积，到阈值才生成因果回响（不随机刷病） */
  function triggerRisk(g, evId, threshold, delay) {
    var key = pickRiskKey(g);
    var v = (g.risks && g.risks[key]) || 0;
    if (v < threshold) return;
    if (g.pending.some(function (p) { return p.event === evId && p.riskKey === key; })) return;
    if (evId === 'v2_risk_chronic' && g.marks['risk_chronic_' + key]) return;
    if (evId !== 'v2_risk_chronic' && g.marks['risk_' + evId + '_' + key]) return;
    g.pending.push({
      event: evId,
      dueAge: g.age + delay,
      mark: evId === 'v2_risk_chronic' ? 'risk_chronic_' + key : 'risk_' + evId + '_' + key,
      note: LS.RISK_LABEL[key],
      riskKey: key,
      delay: delay
    });
  }

  function tickRisks(g) {
    if (g.death.dead) return;
    if (!g.risks) g.risks = { lateNight: 0, highStress: 0, noExercise: 0, badDiet: 0 };
    if (!g.riskOrigin) g.riskOrigin = {};
    var tags = g.job.tags || {};
    var d = {
      lateNight: (g.attrs.stress >= 55 ? 2.2 : 0.3) + (tags.overtime === '高' ? 1.4 : 0),
      highStress: (g.attrs.stress >= 65 ? 2.6 : (g.attrs.stress >= 45 ? 0.9 : -1.0)),
      noExercise: (g.marks.exercise ? -2.4 : (g.age >= 25 ? 1.8 : 0.4)),
      badDiet: (g.attrs.stress >= 70 ? 2.0 : 0.5) + (g.money.cash < 8000 ? 0.6 : 0)
    };
    if (g.marks.healthy_diet) d.badDiet -= 2.2;
    if (g.marks.regular_checkup) d.highStress -= 0.5;
    LS.RISK_KEYS.forEach(function (k) {
      var prev = g.risks[k] || 0;
      g.risks[k] = LS.clamp(prev + (d[k] || 0), 0, 100);
      if (g.risks[k] >= 20 && !g.riskOrigin[k]) {
        g.riskOrigin[k] = {
          age: g.age, year: g.year,
          title: '长期的生活方式', label: LS.RISK_LABEL[k]
        };
      }
    });
    triggerRisk(g, 'v2_risk_warn', 30, 1);
    triggerRisk(g, 'v2_risk_light', 55, 2);
    triggerRisk(g, 'v2_risk_chronic', 82, 3);
  }

  function tickHealth(g) {
    tickRisks(g);
    var loss = healthLoss(g);
    g.attrs.health -= loss;

    /* 身体自愈：年轻时恢复快，慢性病会拖慢恢复 */
    var chronic = g.marks.bp_untreated || g.marks.liver_bad || g.marks.lung_issue || g.marks.mobility_issue;
    var recover = 0;
    if (g.age <= 35) recover = 2.2;
    else if (g.age <= 55) recover = 1.7;
    else if (g.age <= 70) recover = 0.9;
    else if (g.age <= 80) recover = 0.3;
    if (chronic) recover *= 0.35;
    if (g.attrs.happiness >= 60) recover += 0.4;
    if (g.marks.exercise) recover += 0.6;
    if (g.attrs.health < 92) g.attrs.health = Math.min(92, g.attrs.health + recover);
    if (g.attrs.health > 100) g.attrs.health = 100;

    var stressDrift = 0;
    if (g.job.id) stressDrift += (LS.JOBS[g.job.id].stress || 0) * 0.7;
    if (g.money.debt > 0) stressDrift += LS.clamp(g.money.debt / 120000, 0, 3);
    if (g.family.childrenIds.length) stressDrift += 0.8;
    if (g.attrs.happiness >= 68) stressDrift -= 1.6;
    if (g.attrs.happiness < 32) stressDrift += 1.3;
    g.attrs.stress += stressDrift - 1.5;
    /* 人对长期压力有适应性，压力越高回落越快 */
    if (g.attrs.stress > 55) g.attrs.stress -= (g.attrs.stress - 55) * 0.08;
    g.attrs.stress = LS.clamp(g.attrs.stress, 0, 100);

    /* 幸福感缓慢回归，受压力与关系影响 */
    var hp = 1.1;
    if (g.attrs.stress > 70) hp -= 1.1;
    else if (g.attrs.stress > 50) hp -= 0.3;
    if (g.attrs.happiness < 20) hp += 0.7;
    if (g.money.debt > 200000) hp -= 1.2;
    if (g.family.marriage.status === '已婚') {
      var sp = LS.getNpc(g, g.family.marriage.spouseId);
      if (sp && sp.alive) hp += sp.favor >= 60 ? 1.2 : -1.4;
      g.stats.marriedYears = (g.stats.marriedYears || 0) + 1;
    }
    if (g.family.childrenIds.length) {
      var happyKid = g.family.childrenIds.some(function (id) {
        var k = LS.getNpc(g, id); return k && k.alive && k.favor >= 60;
      });
      if (happyKid) hp += 0.5;
    }
    if (g.attrs.health < 35) hp -= 1.0;
    g.attrs.happiness += hp;
    g.attrs.happiness = LS.clamp(g.attrs.happiness, 0, 100);

    if (g.age >= 40 && g.age <= 50 && g.attrs.stress > 85) g.stats.peakStressMidlife = true;

    if (g.age >= 18 && g.attrs.happiness < 26 && !g.marks.depression_warned) {
      g.marks.depression_warned = true;
      g.pending.push({ event: 'c_depression', dueAge: g.age + 1, mark: 'depression', note: '长期情绪低落' });
    }
  }

  function tickNpcs(g) {
    if (!g.npcArc) g.npcArc = {};
    for (var i = 0; i < g.npcs.length; i++) {
      var n = g.npcs[i];
      if (!n.alive) continue;
      /* v3：NPC 关系弧线，关系降级时留档（不改变原有死亡播报） */
      var arcOld = (g.npcArc[n.id] || {}).stage || null;
      var arcNow = LS.relationStageOf(n.favor, arcOld);
      if (arcOld && arcOld !== arcNow && (arcOld === '亲密' || arcOld === '熟悉') &&
          (arcNow === '疏离' || arcNow === '决裂')) {
        LS.addMemory(g, '这一年，你和' + n.name + '（' + n.role + '）的关系淡成了' + arcNow + '。', 'rel');
      }
      g.npcArc[n.id] = { stage: arcNow, lastAge: g.age };
      n.age += 1;
      var decline = n.age > 70 ? 3.4 : n.age > 55 ? 2.0 : 0.9;
      if (n.isChild && n.age < 18) decline = 0;
      n.health -= decline + LS.rand() * 0.8;
      /* 子女成年：达到 18 岁当年播报一次，与死亡分支无关 */
      if (n.isChild && n.age === 18 && !n.adultMarked) {
        n.adultMarked = true;
        bcPush(g, 'child_adult', null, { changes: n.name + '成年 · 家庭抚养支出下降 · 幸福感 +3' });
        g.attrs.happiness = LS.clamp(g.attrs.happiness + 3, 0, 100);
      }
      if (n.health <= 0 || n.age > n.lifespan) {
        n.health = 0;
        n.alive = false;
        n.deathYear = g.year;
        g.npcArc[n.id] = { stage: arcNow, lastAge: g.age, dead: true };
        var drop = 0;
        if (n.role === '父亲' || n.role === '母亲') drop = 16;
        else if (n.role === '配偶') drop = 20;
        else if (n.role === '子女') drop = 22;
        else if (n.role === '朋友' || n.role === '同学') drop = 4;
        g.attrs.happiness -= drop;
        g.attrs.stress += Math.round(drop * 0.35);
        clampAttrs(g);
        LS.addMemory(g, n.name + '（' + n.role + '）在' + g.year + '年离世。', 'death');
        if (n.role === '配偶') {
          g.family.marriage.status = '丧偶';
          g.marks.widowed = true;
          bcPush(g, 'widowed', null, { changes: '婚姻状态：丧偶 · 幸福感 -' + drop + ' · 压力 +' + Math.round(drop * 0.35) });
        }
        if (n.role === '父亲' || n.role === '母亲') {
          bcPush(g, 'parent_death', null, { changes: n.role + '离世 · 幸福感 -' + drop + ' · 压力 +' + Math.round(drop * 0.35) });
        }
        if (n.role === '父亲') g.marks.father_dead = true;
        if (n.role === '母亲') g.marks.mother_dead = true;
      }
    }
  }

  /* ---------------- 死亡与总结 ---------------- */
  function deathReason(g) {
    if (g.forceDeath) return '一场突发的意外';
    if (g.attrs.health <= HEALTH_LIMIT) {
      if (g.marks.bp_untreated) return '高血压引发的并发症';
      if (g.marks.liver_bad) return '肝功能衰竭';
      if (g.marks.lung_issue) return '肺部疾病';
      return '身体机能衰竭';
    }
    if (g.age >= g.maxAge) return '自然寿终';
    if (g.age >= 100) return '自然寿终';
    return null;
  }

  function totalJobYearsOf(g) {
    var t = 0;
    for (var k in (g.stats.jobYears || {})) t += num0(g.stats.jobYears[k]);
    return t;
  }

  /* v3：六维雷达（0–100，任何情况下都不产生 NaN） */
  function radarOf(g) {
    if (!g) return { wealth: 0, career: 0, family: 0, health: 0, reputation: 0, happiness: 0 };
    var net = num0(LS.netWorth(g));
    var wealth = net <= 0 ? 0 : Math.round(Math.min(100, 100 * Math.pow(net / 5000000, 0.42)));
    if (!isFinite(wealth)) wealth = 0;

    var tj = totalJobYearsOf(g);
    var career = Math.round(Math.min(100,
      Math.min(50, tj * 1.7) +
      Math.min(28, num0(g.stats.promotions) * 6) +
      (g.job && g.job.id ? 12 : 0) +
      (num0(g.edu.level) >= 5 ? 10 : 0)));

    var fam = 0;
    if (g.family.marriage.status === '已婚') {
      fam += 42 + Math.min(20, num0(g.stats.marriedYears));
      var sp = g.family.marriage.spouseId ? LS.getNpc(g, g.family.marriage.spouseId) : null;
      if (sp && sp.alive) fam += Math.round(LS.clamp((num0(sp.favor) - 50) / 3, -10, 15));
    } else if (g.family.marriage.status === '丧偶') fam += 28;
    else if (g.family.marriage.status === '离异') fam += 10;
    fam += Math.min(35, g.family.childrenIds.length * 12);
    fam = Math.round(LS.clamp(fam, 0, 100));

    var health = Math.round(LS.clamp(num0(g.attrs.health), 0, 100));
    var rep = Math.round(LS.clamp(num0(LS.repTotal(g)), 0, 100));
    var happy = Math.round(LS.clamp(num0(g.attrs.happiness), 0, 100));
    return {
      wealth: wealth, career: career, family: fam,
      health: health, reputation: rep, happiness: happy
    };
  }

  /* v3：人生标签组合，至少两条 */
  function tagComboOf(g) {
    var tags = [];
    function has(t) { if (tags.indexOf(t) < 0) tags.push(t); }
    var net = num0(LS.netWorth(g));
    if (net >= 5000000) has('事业有成');
    else if (net >= 500000) has('小有积蓄');
    else if (net < 0) has('背债而行');
    var tj = totalJobYearsOf(g);
    if (tj >= 25) has('长期稳定');
    if (num0(g.stats.promotions) >= 2) has('步步高升');
    if (num0(g.edu.level) >= 6) has('书香出身');
    if (num0(g.stats.childrenEver) >= 2) has('儿女成群');
    if (g.family.marriage.status === '已婚' && num0(g.stats.marriedYears) >= 20) has('白头偕老');
    else if (g.family.childrenIds.length === 0 && num0(g.age) >= 45 &&
      g.family.marriage.status !== '已婚') has('家庭疏离');
    if (num0(g.attrs.health) <= 40) has('身体透支');
    if (num0(g.money.debt) > 0) has('负债缠身');
    if (LS.repTotal(g) >= 60) has('有些名望');
    if (num0(g.attrs.happiness) >= 70) has('内心丰盈');
    else if (num0(g.attrs.happiness) <= 35) has('心里有结');
    if (num0(g.stats.startupFail) > 0 || (g.marks && g.marks.startup_success)) has('商海沉浮');
    var risks = (g.stageImpact || []).filter(function (x) { return x && x.type === 'risk'; }).length;
    if (risks >= 2) has('带伤前行');
    if (tags.length < 2) has('平常一生');
    if (tags.length < 2) has('低调度日');
    return tags.slice(0, 10);
  }

  /* v3：文学化墓志铭，60–120 字，按一生真实数据分支 */
  function epitaphOf(g) {
    var age = num0(g.death && g.death.age) || num0(g.age);
    var who = g.gender === '女' ? '她' : '他';
    var tj = totalJobYearsOf(g);
    var kids = g.family.childrenIds.length;
    var my = num0(g.stats.marriedYears);
    var net = LS.netWorth(g);
    var seed = num0(g.seed) + age * 7 + kids * 13 + tj * 5 + num0(g.stats.promotions) * 3;

    var open = [
      who + '这一生没有太大的响动，像一条涨落很小的河。',
      who + '把日子过成了一份按时交出的报表，不好看，但一直在交。',
      who + '不算幸运，也谈不上倒霉，只是把该走的路都走了一遍。',
      who + '的一生像慢火，急不起来，也没有真正熄过。',
      who + '在很多事情上低了头，只在一两件事上没有松手。',
      who + '走到最后，行李比出发时还轻。'
    ];
    var mids = [];
    if (tj >= 25) mids.push('在岗位上耗了 ' + tj + ' 年，把稳定看得比体面重要');
    else if (tj >= 6) mids.push('换过几份活计，加起来做了 ' + tj + ' 年');
    else mids.push('正经上班的日子不多，靠零活和别人的帮衬过来');
    if (kids >= 2) mids.push('把 ' + kids + ' 个孩子拉扯大，代价是自己的一些年头');
    else if (kids === 1) mids.push('把一个孩子养大，剩下的精力多半给了工作');
    if (my >= 20) mids.push('婚姻维持了 ' + my + ' 年，争吵和和好都成了习惯');
    else if (g.family.marriage.status === '离异') mids.push('婚姻中途散了，之后一个人过了很久');
    else if (g.family.marriage.status === '丧偶') mids.push('伴侣先走了一步，剩下的日子变得很静');
    if (net >= 1000000) mids.push('攒下过一笔像样的家底，也为此错过些别的东西');
    else if (net < 0) mids.push('到老还欠着钱，利息比记性更准时');
    if (num0(g.stats.promotions) >= 2) mids.push('被提拔过 ' + num0(g.stats.promotions) + ' 次，也替别人背过责任');
    var maxRisk = 0;
    LS.RISK_KEYS.forEach(function (k) { maxRisk = Math.max(maxRisk, num0((g.risks || {})[k])); });
    if (maxRisk >= 50) mids.push('身体被熬夜和压力一点点磨薄，' + who + '自己清楚是从哪一年开始的');
    if (num0(g.attrs.happiness) <= 38) mids.push('很少真正开心过，笑多半是给场合看的');

    var close = [
      '到最后，能被人记住的只剩几件小事：一句口头禅、一道常做的菜。',
      '名字会被时间磨淡，' + who + '留下的习惯还在别人身上继续。',
      '这一生说不上圆满，但也不是空白，该疼的地方都疼过了。',
      '后来的人提起' + who + '，多半只会说一句：那是个能扛事的人。',
      '碑上能刻的字不多，够用的其实也就这几个。'
    ];
    var midPick = [];
    if (mids.length) {
      var i1 = seed % mids.length;
      midPick.push(mids[i1]);
      if (mids.length > 1) {
        var i2 = (seed + 3) % mids.length;
        if (i2 !== i1) midPick.push(mids[i2]);
      }
    }
    var text = open[seed % open.length] + midPick.join('；') + (midPick.length ? '。' : '') + close[(seed + 2) % close.length];
    if (text.length < 60) text += '认识' + who + '的人渐渐少了，' + who + '也不再多解释什么。';
    if (text.length > 120) {
      var cut = text.slice(0, 118);
      var p = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('；'), cut.lastIndexOf('，'));
      if (p > 60) cut = cut.slice(0, p + 1);
      text = cut;
    }
    return text;
  }

  function finish(g, reason) {
    if (g.death.dead) return g.summary;
    g.death.dead = true;
    g.death.reason = reason || '身体机能衰竭';
    g.death.year = g.year;
    g.death.age = g.age;
    g.current = null;

    var ach = LS.computeAchievements(g);
    var got = ach.filter(function (a) { return a.got; });
    var spouse = g.family.marriage.spouseId ? LS.getNpc(g, g.family.marriage.spouseId) : LS.getNpc(g, '前配偶');
    var kids = g.family.childrenIds.map(function (id) {
      var k = LS.getNpc(g, id);
      return k ? { name: k.name, age: (k.age || 0), alive: k.alive } : null;
    }).filter(Boolean);

    var totalJobYears = 0;
    for (var jk in g.stats.jobYears) totalJobYears += g.stats.jobYears[jk];

    var evaluation = buildEvaluation(g, got, totalJobYears);

    /* v3：雷达、标签、墓志铭、身边人、轻量传承 */
    var radar = radarOf(g);
    var tags = tagComboOf(g);
    var epitaph = epitaphOf(g);
    var survivors = [];
    for (var si = 0; si < g.npcs.length; si++) {
      var sn = g.npcs[si];
      if (!sn.alive) continue;
      var sarc = (g.npcArc || {})[sn.id] || {};
      survivors.push({ role: sn.role, name: sn.name, stage: LS.relationStageOf(sn.favor, sarc.stage) });
    }
    var legacyOut = {
      reputation: Math.round(LS.clamp(LS.repTotal(g) * 0.16, 0, 15)),
      cash: Math.round(LS.clamp(num0(g.money.cash) * 0.01, 0, 5000))
    };

    /* v3：晚年总结作为结局前奏 */
    var finalStageSummary = null;
    if (LS.stageOf(g.death.age) === '晚年' && typeof buildStageSummary === 'function') {
      var fim = writeStageImpact(g, '晚年');
      finalStageSummary = buildStageSummary(g, '晚年', '晚年', fim);
      g.stageSummary = finalStageSummary;
    }

    g.summary = {
      name: g.name,
      gender: g.gender,
      birthYear: g.birthYear,
      deathYear: g.death.year,
      age: g.death.age,
      reason: g.death.reason,
      edu: LS.eduName(g.edu.level),
      eduPath: g.edu.path.slice(),
      jobHistory: g.job.history.slice(),
      jobYears: totalJobYears,
      jobYearsByType: JSON.parse(JSON.stringify(g.stats.jobYears)),
      marriage: {
        status: g.family.marriage.status,
        spouseName: spouse ? spouse.name : '',
        spouseAlive: spouse ? spouse.alive : false,
        years: g.stats.marriedYears || 0
      },
      children: kids,
      netWorth: LS.netWorth(g),
      cash: Math.round(g.money.cash),
      assets: Math.round(g.money.assets),
      debt: Math.round(g.money.debt),
      achievements: ach,
      gotAchievements: got,
      memories: g.memories.slice(),
      history: g.history.slice(),
      evaluation: evaluation,
      pendingLeft: g.pending.length,
      seed: g.seed,
      radar: radar,
      tags: tags,
      epitaph: epitaph,
      survivors: survivors,
      legacyOut: legacyOut,
      finalStageSummary: finalStageSummary,
      achievementsV3: []
    };
    g.currentId = null;

    /* v3：成就、结局与彩蛋并入跨局档案 */
    var store = LS.achRead ? LS.achRead() : { ids: [], endings: [], eggs: [] };
    var gotIds = got.map(function (a) { return a.id; });
    var newIds = gotIds.filter(function (id) { return store.ids.indexOf(id) < 0; });
    var allIds = store.ids.slice();
    for (var ai = 0; ai < newIds.length; ai++) allIds.push(newIds[ai]);
    var endings = store.endings.slice();
    for (var tg = 0; tg < tags.length; tg++) if (endings.indexOf(tags[tg]) < 0) endings.push(tags[tg]);
    var eggs = store.eggs.slice();
    for (var mk in (g.marks || {})) {
      if (g.marks[mk] && /^(egg|彩蛋)/.test(mk) && eggs.indexOf(mk) < 0) eggs.push(mk);
    }
    if (LS.achWrite) LS.achWrite({ ids: allIds, endings: endings, eggs: eggs });
    g.achievementsV3 = newIds;
    g.summary.achievementsV3 = newIds;

    /* v3：轻量传承写回上一世档案 */
    g.legacyOut = legacyOut;
    if (LS.legacyWrite) {
      var prevLeg = LS.legacyRead ? LS.legacyRead() : { runs: 0 };
      LS.legacyWrite({
        reputation: legacyOut.reputation,
        cash: legacyOut.cash,
        source: g.name,
        runs: num0(prevLeg.runs) + 1
      });
    }

    /* v3：本局事件冷却合并写回 */
    if (LS.eventCDWrite) {
      var gcd = (LS.eventCDRead ? LS.eventCDRead() : {}) || {};
      for (var cid in (g.eventCD || {})) {
        var add = g.eventCD[cid] || {};
        var old = gcd[cid] || {};
        gcd[cid] = { lastAge: add.lastAge, runs: num0(old.runs) + num0(add.runs) };
      }
      LS.eventCDWrite(gcd);
    }
    return g.summary;
  }

  function buildEvaluation(g, achievements, totalJobYears) {
    var s = [];
    s.push(g.name + '活到 ' + g.age + ' 岁，' + (g.gender === '女' ? '她' : '他') + '的' + LS.eduName(g.edu.level) + '学历停在' + LS.eduName(g.edu.level) + '，一生累计工作约 ' + totalJobYears + ' 年。');

    var high = [];
    if (g.stats.maxNet >= 1000000) high.push('净资产一度超过百万');
    if (g.edu.level >= 6) high.push('把书读到了' + LS.eduName(g.edu.level));
    if ((g.stats.marriedYears || 0) >= 25) high.push('婚姻维持了二十多年');
    if (g.stats.childrenEver > 0) high.push('把' + g.stats.childrenEver + '个孩子养大');
    if ((g.stats.promotions || 0) >= 2) high.push('在岗位上被提拔过' + g.stats.promotions + '次');
    if (LS.repTotal(g) >= 60) high.push('在行业和熟人圈里有些名声');
    if (high.length) s.push('值得记下的是：' + high.join('，') + '。');
    else s.push('履历上没有特别亮眼的地方，日子大多是一年年按时过下来的。');

    var low = [];
    if (g.attrs.happiness < 42) low.push('长年不算开心');
    if (g.death.age < 65) low.push('走得太早，很多事没来得及安排');
    if (g.money.debt > 0) low.push('去世时还背着' + LS.fmtMoney(g.money.debt) + '的债');
    if (g.family.childrenIds.length === 0) low.push('没有留下子女');
    if (g.stats.startupFail > 0) low.push('创业失败过一次');
    if (g.family.marriage.status === '离异') low.push('婚姻中途散了');
    if (low.length) s.push('也有没能圆满的地方：' + low.join('，') + '。');
    else s.push('家庭与身体都还算完整，这在漫长的一生里并不容易。');

    if (achievements.length) s.push('被记下的标签有：' + achievements.map(function (a) { return a.name; }).join('、') + '。');
    s.push('这些数字不能说明一个人的全部。' + (g.death.age >= 80 ? '活得久本身，就是一种运气。' : '有些选择在当时看是对的，回头看未必。'));
    return s.join('');
  }

  /* ---------------- 对外接口 ---------------- */
  function prepEvent(g, e) {
    var out = {};
    for (var k in e) out[k] = e[k];
    if (e.dynText || (e.text && e.text.indexOf('{{') >= 0)) {
      var riskKey = (g.echoInfo && g.echoInfo.riskKey) || pickRiskKey(g);
      var riskLabel = LS.RISK_LABEL[riskKey] || '长期隐患';
      if (out.dynText) out.text = out.dynText(g);
      if (out.title && out.title.indexOf('{{') >= 0) out.title = out.title.replace(/\{\{risk\}\}/g, riskLabel);
      if (out.text) out.text = out.text.replace(/\{\{risk\}\}/g, riskLabel);
      out.riskKey = out.riskKey || riskKey;
    }
    /* v3：选项条件过滤 + 风险标注（不改事件库本体） */
    var src = e.opts || [];
    var opts = [];
    for (var oi = 0; oi < src.length; oi++) {
      if (optCondOk(g, src[oi] && src[oi].cond)) opts.push(src[oi]);
    }
    if (!opts.length && src.length) opts = [src[0]];
    out.opts = opts.map(function (o) {
      var c = {};
      for (var kk in o) c[kk] = o[kk];
      c.risk = deriveOptRisk(o);
      return c;
    });
    return out;
  }

  function optCondOk(g, cond) {
    if (!cond) return true;
    if (typeof cond === 'function') {
      try { return !!cond(g); } catch (err) { return false; }
    }
    if (typeof cond === 'object') {
      var key = cond.attr || cond.key;
      if (!key) return true;
      var v = attrValue(g, key);
      if (cond.min !== undefined && v < Number(cond.min)) return false;
      if (cond.max !== undefined && v > Number(cond.max)) return false;
    }
    return true;
  }

  function deriveOptRisk(opt) {
    if (opt && opt.risk) return opt.risk;
    if (opt && opt.tone === 'risk') return 'high';
    if (opt && opt.tone === 'safe') return 'low';
    return 'mid';
  }

  /* v3：非关键强制事件自动结算，避免童年/日常年份每年都停下来选 */
  function autoResolvable(e) {
    if (!e) return false;
    if (e.type === 'forced' && (e.tier || 'daily') === 'daily' && num0(e.prio) < 88) return true;
    return false;
  }
  function pickDefaultIndex(e) {
    var opts = (e && e.opts) || [];
    for (var i = 0; i < opts.length; i++) {
      if (opts[i].tone === 'safe') return i;
    }
    return 0;
  }

  function nextEvent(g) {
    if (g.death.dead) return null;
    g.current = null;
    g.currentId = null;
    g.quietNote = '';

    var guard = 0;
    var skippedTotal = 0;
    while (guard++ < 24 && !g.death.dead) {
      /* v3：平淡年合并——当前年不是关键年、且不跨阶段时静默推进，最多连续 6 年 */
      var skipped = 0;
      while (!g.death.dead && skipped < 6) {
        if (hasKeyEvent(g, g.age)) break;
        if (LS.chance(paceOf(g.age))) break;
        var nextAge = g.age + 1;
        if (g.turn >= MAX_TURNS || nextAge >= 110) break;
        if (LS.stageOf(nextAge) !== g.stage) break;
        if (!quietStep(g)) break;
        skipped++;
      }
      skippedTotal += skipped;
      if (g.death.dead) return null;

      var e = selectEvent(g);
      if (!e) return null;
      e = prepEvent(g, e);

      if (autoResolvable(e)) {
        g.current = e;
        g.currentId = e.id;
        g.currentTier = e.tier || 'daily';
        g._auto = true;
        var ar = choose(g, pickDefaultIndex(e));
        g._auto = false;
        if (ar && ar.dead) return null;
        var ad = advance(g);
        if (!ad || ad.dead) return null;
        if (g.pendingSummary || g.pendingStage) return null;
        continue;
      }

      var note = skippedTotal > 0 ? makeQuietNote(g, skippedTotal) : '';
      if (note) e = attachQuiet(e, note);

      g.currentId = e.id;
    g.current = e;
    g.currentTier = e.tier || 'daily';
    if (e.tier === 'crossroad') {
      g.stats.crossroadsSeen = (g.stats.crossroadsSeen || 0) + 1;
      if (!g.crossSeen) g.crossSeen = {};
      g.crossGate = e.id + '@' + g.turn;
    } else if (e.tier === 'echo') {
      g.stats.echoesSeen = (g.stats.echoesSeen || 0) + 1;
    }
    /* 只有因果回响保留溯源信息，其余档位一律清空，避免溯源条串档 */
    if (e.tier !== 'echo') g.echoInfo = null;
    if (e.healthNeg) markHealthNeg(g);
    if (!g.fireAge) g.fireAge = {};
    g.fireAge[e.id] = g.age;
    if (g.fired.indexOf(e.id) < 0 && !e.repeatable) g.fired.push(e.id);

    /* v3：去重记录（每日/随机/支线）与冷却统计 */
    var layer = layerOf(e);
    if (layer === 'random' || layer === 'branch' || layer === 'era') {
      if (!g.eventSeen) g.eventSeen = [];
      if (g.eventSeen.indexOf(e.id) < 0) g.eventSeen.push(e.id);
      if (g.eventSeen.length > 240) g.eventSeen = g.eventSeen.slice(-240);
    }
    g.eventCD = g.eventCD || {};
    var oldCd = g.eventCD[e.id] || {};
    g.eventCD[e.id] = { lastAge: g.age, runs: num0(oldCd.runs) + 1 };

    g.lastEventId = e.id;
    return e;
    }
  }

  function choose(g, index) {
    if (!g.current || g.death.dead) return { ok: false, error: '当前没有可执行的事件' };
    var opt = g.current.opts[index];
    if (!opt) return { ok: false, error: '选项不存在' };

    var before = snapshotBefore(g);
    var baseBefore = { attrs: JSON.parse(JSON.stringify(g.attrs)), rep: LS.repTotal(g) };
    var report = {};
    var text = '';
    var ev = g.current;
    var ctx = {
      key: (ev.id || 'ev') + '@' + g.age,
      id: ev.id,
      age: g.age,
      year: g.year,
      title: ev.title,
      label: opt.label,
      tier: ev.tier || 'daily',
      tags: opt.tags || []
    };
    g._ctxChoice = ctx;
    g.crossSeen = g.crossSeen || {};
    if (g.crossGate) g.crossSeen[g.crossGate] = true;

    applyFx(g, opt.fx, report);
    if (typeof opt.apply === 'function') {
      var applied = opt.apply(g, report);
      if (applied) text = applied;
    }
    if (!text && opt.gamble) {
      var pv = typeof opt.gamble.p === 'function' ? opt.gamble.p(g) : opt.gamble.p;
      var win = LS.chance(LS.clamp((isFinite(pv) ? pv : 0.5) + luckOf(g) * 0.12, 0.03, 0.97));
      if (win) {
        applyFx(g, opt.gamble.win, report);
        text = opt.gamble.winText || '';
      } else {
        applyFx(g, opt.gamble.lose, report);
        text = opt.gamble.loseText || '';
      }
    }
    g._ctxChoice = null;

    clampAttrs(g);
    moneyRound(g);

    /* v3：决策点计数——同一年同一事件只计一次，避免重复点击灌水 */
    var decKey = (ctx.id || '') + '@' + g.age + '#' + g.turn;
    if (!g._auto && (!g._decCounted || g._decCounted !== decKey)) {
      g.decisionCount = num0(g.decisionCount) + 1;
      g._decCounted = decKey;
    }
    checkMilestones(g);

    /* v2：记录真实选择，供因果链视图使用（带延迟回响的选项也要留源，含自动结算的日常事件） */
    if (ctx.tier === 'crossroad' || (ctx.tags.length) || (opt.fx && opt.fx.flag)) {
      g.choiceLog = g.choiceLog || [];
      g.choiceLog.push(ctx);
      if (g.choiceLog.length > 120) g.choiceLog = g.choiceLog.slice(-120);
    }

    var changes = describeChanges(g, baseBefore);
    var outcome = text ? text + (changes ? '（' + changes + '）' : '') : (changes ? changes : '日子照旧。');
    g.lastOutcome = { text: outcome, title: ev.title, year: g.year, age: g.age, tier: ev.tier || 'daily' };
    /* 回忆录只收录选项自带的记忆标签，避免每个日常选择都灌进去 */

    g.current = null;
    g.currentId = null;
    LS.snapshot(g);

    var reason = deathReason(g);
    if (reason) {
      finish(g, reason);
      return { ok: true, outcome: outcome, changes: changes, dead: true, summary: g.summary };
    }
    return { ok: true, outcome: outcome, changes: changes, dead: false };
  }

  var MILESTONE_ITEMS = [
    { key: 'knowledge', label: '学识' }, { key: 'health', label: '健康' },
    { key: 'finance', label: '财力' }, { key: 'charm', label: '魅力' },
    { key: 'happiness', label: '幸福感' }, { key: 'reputation', label: '声望' }
  ];

  function checkMilestones(g) {
    g.milestones = g.milestones || {};
    for (var i = 0; i < MILESTONE_ITEMS.length; i++) {
      var m = MILESTONE_ITEMS[i];
      var v = m.key === 'reputation' ? LS.repTotal(g) : num0(g.attrs[m.key]);
      var bars = [80, 90];
      for (var j = 0; j < bars.length; j++) {
        var bar = bars[j];
        var mk = m.key + '_' + bar;
        if (v < bar || g.milestones[mk]) continue;
        g.milestones[mk] = true;
        bcPush(g, bar === 90 ? 'milestone90' : 'milestone80', null, {
          title: '天赋觉醒 · ' + m.label + ' ' + bar,
          changes: m.label + ' 跨过 ' + bar
        });
      }
    }
  }

  function advance(g) {
    if (g.death.dead) return { dead: true, reason: g.death.reason };
    if (g.turn >= MAX_TURNS || g.age >= 110) {
      finish(g, '自然寿终');
      return { dead: true, reason: g.death.reason };
    }
    var fromStage = g.stage;
    g.age += 1;
    g.year += 1;
    g.turn += 1;
    var toStage = LS.stageOf(g.age);
    g.stage = toStage;

    tickEconomy(g);
    tickHealth(g);
    tickNpcs(g);
    clampAttrs(g);
    LS.snapshot(g);

    var reason = deathReason(g);
    if (reason) {
      finish(g, reason);
      return { dead: true, reason: reason };
    }

    /* v3：阶段跨越——先落“长期影响”，再生成总结卡，最后才排过场 */
    if (toStage !== fromStage) {
      var impacts = writeStageImpact(g, fromStage);
      g.stageSummary = buildStageSummary(g, fromStage, toStage, impacts);
      g.pendingSummary = true;
      g.stageStart = LS.stageSnapshot(g);
      g.lastSummaryAt = g.age;
    }

    /* 阶段过场：每个阶段只触发一次 */
    var sk = LS.stageKeyOf(g.age);
    if (sk && !(g.stageSeen || {})[sk]) {
      g.pendingStage = sk;
    }
    return { dead: false };
  }

  function resolve(g, index) {
    var r = choose(g, index);
    if (!r.ok) return r;
    if (r.dead) return { ok: true, dead: true, summary: g.summary, outcome: r.outcome, changes: r.changes, event: null };
    var a = advance(g);
    if (a.dead) return { ok: true, dead: true, summary: g.summary, outcome: r.outcome, changes: r.changes, event: null };

    /* v3 暂停优先级：死亡 → 阶段总结卡 → 阶段过场 → 播报 → 下一事件 */
    if (g.pendingSummary) {
      return { ok: true, dead: false, outcome: r.outcome, changes: r.changes, paused: 'summary', summary: g.stageSummary, event: null };
    }
    if (g.pendingStage) {
      return { ok: true, dead: false, outcome: r.outcome, changes: r.changes, paused: 'stage', stage: g.pendingStage, event: null };
    }
    var b = pickBroadcast(g);
    if (b) {
      return { ok: true, dead: false, outcome: r.outcome, changes: r.changes, paused: 'broadcast', broadcast: b, event: null };
    }
    var e = nextEvent(g);
    if (g.death.dead) {
      return { ok: true, dead: true, summary: g.summary, outcome: r.outcome, changes: r.changes, event: null };
    }
    if (g.pendingSummary) {
      return { ok: true, dead: false, outcome: r.outcome, changes: r.changes, paused: 'summary', summary: g.stageSummary, event: null };
    }
    if (g.pendingStage) {
      return { ok: true, dead: false, outcome: r.outcome, changes: r.changes, paused: 'stage', stage: g.pendingStage, event: null };
    }
    return { ok: true, dead: false, outcome: r.outcome, changes: r.changes, event: e };
  }

  function consumeStage(g) {
    if (!g.pendingStage) return false;
    g.stageSeen = g.stageSeen || {};
    g.stageSeen[g.pendingStage] = true;
    var mk = LS.stageMark(g.pendingStage);
    LS.addMemory(g, '进入' + (mk ? mk.label : g.pendingStage) + '阶段。', 'stage');
    g.pendingStage = null;
    return true;
  }

  /* 过场/总结/播报确认后继续推进；兼容旧的 continueAfter(g) 调用 */
  function continueAfter(g, kind) {
    if (g.death.dead) return { ok: true, dead: true, summary: g.summary, event: null };

    if (kind === 'summary' || (!kind && g.pendingSummary)) {
      g.pendingSummary = false;
      if (g.pendingStage) {
        return { ok: true, dead: false, paused: 'stage', stage: g.pendingStage, event: null };
      }
    }
    if (kind === 'stage' || (!kind && g.pendingStage)) {
      consumeStage(g);
    }
    var b = pickBroadcast(g);
    if (b) return { ok: true, dead: false, paused: 'broadcast', broadcast: b, event: null };
    var e = nextEvent(g);
    if (g.death.dead) return { ok: true, dead: true, summary: g.summary, event: null };
    if (g.pendingSummary) return { ok: true, dead: false, paused: 'summary', summary: g.stageSummary, event: null };
    if (g.pendingStage) return { ok: true, dead: false, paused: 'stage', stage: g.pendingStage, event: null };
    return { ok: true, dead: false, event: e };
  }


  function start(cfg) {
    var g = LS.createGame(cfg);

    /* v3：婴幼儿阶段先展示进入过场，再由 UI 继续推进 */
    g.stageSeen = g.stageSeen || {};
    var sk0 = LS.stageKeyOf(0);
    if (sk0 && !g.stageSeen[sk0]) g.pendingStage = sk0;

    /* v3：上一世的轻量传承（声望 0–15、现金 0–5000） */
    var leg = LS.legacyRead ? LS.legacyRead() : null;
    if (leg && num0(leg.runs) > 0) {
      var repB = Math.round(LS.clamp(num0(leg.reputation), 0, 15));
      var cashB = Math.round(LS.clamp(num0(leg.cash), 0, 5000));
      if (repB) g.rep.society = LS.clamp(num0(g.rep.society) + repB, 0, 100);
      if (cashB) g.money.cash += cashB;
      g.legacy = { reputation: repB, cash: cashB, source: leg.source || '' };
      if (repB || cashB) LS.addMemory(g, '上一世留下的名声和一点钱，先摆在了你面前。', 'legacy');
    }
    nextEvent(g);
    return g;
  }

  function autoRun(g, steps, picker) {
    var n = 0;
    var guard = 0;
    while (!g.death.dead && n < (steps || 80) && guard < 400) {
      guard++;
      if (g.pendingSummary || g.pendingStage) {
        var pr = continueAfter(g);
        if (!pr.ok || pr.dead) break;
        continue;
      }
      if (!g.current) {
        var e = nextEvent(g);
        if (!e) {
          if (g.pendingSummary || g.pendingStage) continue;
          break;
        }
      }
      var count = g.current.opts.length;
      var idx = picker ? picker(g, count) : Math.floor(LS.rand() * count);
      var r = resolve(g, idx);
      if (!r.ok) break;
      while (r.paused) {
        r = continueAfter(g);
        if (!r.ok || r.dead) break;
      }
      n++;
    }
    return {
      turns: n,
      dead: g.death.dead,
      age: g.age,
      reason: g.death.reason,
      memoryCount: g.memories.length,
      historyCount: g.history.length,
      pending: g.pending.length,
      json: null
    };
  }

  function sanityCheck(g) {
    var errs = [];
    if (!g || !g.attrs) { errs.push('缺少角色数据'); return errs; }
    ['knowledge', 'health', 'finance', 'charm', 'happiness', 'stress'].forEach(function (k) {
      if (!isFinite(g.attrs[k]) || isNaN(g.attrs[k])) errs.push('属性 ' + k + ' 非法');
      if (g.attrs[k] < 0 || g.attrs[k] > 100) errs.push('属性 ' + k + ' 越界: ' + g.attrs[k]);
    });
    ['cash', 'assets', 'debt'].forEach(function (k) {
      if (!isFinite(g.money[k]) || isNaN(g.money[k])) errs.push('资金 ' + k + ' 非法');
    });
    if (g.attrs.health < 0) errs.push('健康为负: ' + g.attrs.health);
    if (!isFinite(LS.repTotal(g)) || isNaN(LS.repTotal(g))) errs.push('声望非法');
    if (g.decisionCount !== undefined && (!isFinite(g.decisionCount) || isNaN(g.decisionCount))) {
      errs.push('决策点计数非法');
    }
    var rad = (g.summary && g.summary.radar) || null;
    if (rad) {
      ['wealth', 'career', 'family', 'health', 'reputation', 'happiness'].forEach(function (k) {
        if (!isFinite(rad[k]) || isNaN(rad[k])) errs.push('雷达 ' + k + ' 非法');
      });
    }
    if (!g.death.dead && g.attrs.health <= 0) errs.push('健康归零但未结算');
    if (!g.death.dead && g.age > 110) errs.push('年龄越界但未结算');
    return errs;
  }

  LS.engine = {
    start: start,
    nextEvent: nextEvent,
    choose: choose,
    advance: advance,
    resolve: resolve,
    finish: finish,
    autoRun: autoRun,
    sanityCheck: sanityCheck,
    selectEvent: selectEvent,
    deathReason: deathReason,
    applyFx: applyFx,
    continueAfter: continueAfter,
    pickBroadcast: pickBroadcast,
    bcPush: bcPush,
    buildJobHuntEvent: buildJobHuntEvent,
    resolveHunt: resolveHunt,
    tickRisks: tickRisks,
    riskBlocked: riskBlocked,
    needHunt: needHunt,
    setJob: setJob,
    clearJob: clearJob,
    jobTagsOf: jobTagsOf,
    /* v3 新增 */
    writeStageImpact: writeStageImpact,
    buildStageSummary: buildStageSummary,
    stageImpactActive: stageImpactActive,
    skipQuiet: skipQuiet,
    hasKeyEvent: hasKeyEvent,
    quietStep: quietStep,
    epitaphOf: epitaphOf,
    radarOf: radarOf,
    tagComboOf: tagComboOf,
    optCondOk: optCondOk,
    layerOf: layerOf,
    PACE: PACE
  };
  LS.PACE = PACE;

})();

