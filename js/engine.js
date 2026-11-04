/* =========================================================
   engine.js — 回合推进、事件选择、效果结算、死亡与总结
   ========================================================= */
(function () {
  'use strict';
  var LS = window.LS;

  var ATTR_KEYS = ['knowledge', 'health', 'finance', 'charm', 'happiness', 'reputation', 'stress'];
  var HEALTH_LIMIT = 0;
  var MAX_TURNS = 130;

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
    big_loss:    { title: '失去大额财富', prio: 80, art: 'money', tone: 'red', text: '一笔大额支出或损失发生，家庭财务明显收紧。' }
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
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      var w = Math.max(0.05, e.weight || 1);
      var pos = /机会|表扬|旅行|朋友|婚礼|涨|爱好|花|志愿|同学会|红包|升职|分红/.test(e.title || '');
      var neg = /病|流感|摔|裁员|骗|吵|疼|亏|住院|诈骗|债|失|冲突|危机/.test(e.title || '');
      if (pos) w *= 1 + luckOf(g) * 4 + LS.repTotal(g) / 100 * 0.2;
      if (neg) w *= 1 - luckOf(g) * 2.5;
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
    return LS.clamp(s, 0.15, 0.88);
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
  function selectEvent(g) {
    var E = LS.EVENTS;

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
      var urgent = causal.some(function (x) { return (x.prio || 0) >= 80; });
      if (urgent || LS.chance(0.55)) {
        var picked = pickWeighted(causal, g);
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

    /* 4. 随机权重事件（健康负面一律不在此池，见因果链路） */
    var random = [];
    for (var r = 0; r < E.length; r++) {
      var re = E[r];
      if (re.type !== 'random') continue;
      if (re.stage !== g.stage) continue;
      if (re.healthNeg) continue;
      if (!condOk(g, re)) continue;
      if (isFired(g, re)) continue;
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
    for (var i = 0; i < g.npcs.length; i++) {
      var n = g.npcs[i];
      if (!n.alive) continue;
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
      seed: g.seed
    };
    g.currentId = null;
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
    var out = e;
    if (e.dynText || (e.text && e.text.indexOf('{{') >= 0)) {
      out = {};
      for (var k in e) out[k] = e[k];
      var riskKey = (g.echoInfo && g.echoInfo.riskKey) || pickRiskKey(g);
      var riskLabel = LS.RISK_LABEL[riskKey] || '长期隐患';
      if (out.dynText) out.text = out.dynText(g);
      if (out.title && out.title.indexOf('{{') >= 0) out.title = out.title.replace(/\{\{risk\}\}/g, riskLabel);
      if (out.text) out.text = out.text.replace(/\{\{risk\}\}/g, riskLabel);
      out.riskKey = out.riskKey || riskKey;
    }
    return out;
  }

  function nextEvent(g) {
    if (g.death.dead) return null;
    var e = selectEvent(g);
    if (!e) return null;
    e = prepEvent(g, e);
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
    g.lastEventId = e.id;
    return e;
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

    /* v2：记录真实选择，供因果链视图使用 */
    if (ctx.tier === 'crossroad' || (ctx.tags.length)) {
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

  function advance(g) {
    if (g.death.dead) return { dead: true, reason: g.death.reason };
    if (g.turn >= MAX_TURNS || g.age >= 110) {
      finish(g, '自然寿终');
      return { dead: true, reason: g.death.reason };
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
    if (reason) {
      finish(g, reason);
      return { dead: true, reason: reason };
    }

    /* v2：进入 19/31/56 岁的阶段过场，暂停主循环 */
    var sk = LS.stageKeyOf(g.age);
    if (sk && !(g.stageSeen || {})[sk]) {
      g.pendingStage = sk;
    }
    return { dead: false };
  }

  function resolve(g, index) {
    var r = choose(g, index);
    if (!r.ok) return r;
    if (r.dead) return { ok: true, dead: true, summary: g.summary, outcome: r.outcome, event: null };
    var a = advance(g);
    if (a.dead) return { ok: true, dead: true, summary: g.summary, outcome: r.outcome, event: null };

    if (g.pendingStage) {
      return { ok: true, dead: false, outcome: r.outcome, paused: 'stage', stage: g.pendingStage, event: null };
    }
    var b = pickBroadcast(g);
    if (b) {
      return { ok: true, dead: false, outcome: r.outcome, paused: 'broadcast', broadcast: b, event: null };
    }
    var e = nextEvent(g);
    return { ok: true, dead: false, outcome: r.outcome, event: e };
  }

  /* 过场/播报确认后继续推进 */
  function continueAfter(g) {
    if (g.death.dead) return { ok: true, dead: true, summary: g.summary, event: null };
    if (g.pendingStage) {
      g.stageSeen = g.stageSeen || {};
      g.stageSeen[g.pendingStage] = true;
      LS.addMemory(g, '进入' + LS.stageMark(g.pendingStage).label + '阶段。', 'stage');
      g.pendingStage = null;
    }
    var b = pickBroadcast(g);
    if (b) return { ok: true, dead: false, paused: 'broadcast', broadcast: b, event: null };
    var e = nextEvent(g);
    return { ok: true, dead: false, event: e };
  }


  function start(cfg) {
    var g = LS.createGame(cfg);
    nextEvent(g);
    return g;
  }

  function autoRun(g, steps, picker) {
    var n = 0;
    var guard = 0;
    while (!g.death.dead && n < (steps || 80) && guard < 400) {
      guard++;
      if (!g.current) {
        var e = nextEvent(g);
        if (!e) break;
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
    jobTagsOf: jobTagsOf
  };

})();
