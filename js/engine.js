/* =========================================================
   engine.js — 回合推进、事件选择、效果结算、死亡与总结
   ========================================================= */
(function () {
  'use strict';
  var LS = window.LS;

  var ATTR_KEYS = ['knowledge', 'health', 'finance', 'charm', 'happiness', 'reputation', 'stress'];
  var HEALTH_LIMIT = 0;
  var MAX_TURNS = 200;

  /* v3.9：归属补全——每条事件要么挂在某条线的某个节点上，要么显式标 daily。
     已有 owner 的不动；链节点按 chainKey/chainStep 自动生成归属。 */
  function normalizeOwners() {
    var markToEvent = {};
    (LS.EVENTS || []).forEach(function (e) {
      (e && e.opts || []).forEach(function (o) {
        var set = o && o.fx && o.fx.set;
        if (!set) return;
        for (var k in set) {
          if (k.charAt(0) === 'c' && !markToEvent[k]) markToEvent[k] = e.id;
        }
      });
    });
    (LS.EVENTS || []).forEach(function (e) {
      if (!e) return;
      /* 童年库的 pending 回响：用源事件留下的 *_armed 标记找回源事件 id */
      if (e.tier === 'echo' && !e.echoParent && markToEvent[e.id + '_armed']) {
        e.echoParent = markToEvent[e.id + '_armed'];
      }
      /* 上学类条目只在「求学」骨架下可用，避免没上过学却出现教室 */
      if (!e.arch && /教室|老师|同学|作业|考试|课本|黑板|书包|班主任|同桌|校门口|班主任/.test(String(e.title || '') + String(e.text || ''))) {
        e.arch = ['school'];
      }
      if (e.owner && e.owner.line) return;
      if (e.chainKey && e.chainStep) {
        e.owner = { line: (LS.LINE_ALIAS[e.chainKey] || e.chainKey), node: e.chainStep };
        e.ownerLayer = 'line';
        return;
      }
      if (e.chainKey && e.chainTail) {
        e.owner = { line: (LS.LINE_ALIAS[e.chainKey] || e.chainKey), node: 4 };
        e.ownerLayer = 'line';
        return;
      }
      /* ownerLayer 只用于归属审计与配额，不参与调度（调度仍看 layer/tier） */
      if (e.layer) e.ownerLayer = e.layer;
      else if (e.tier === 'echo') e.ownerLayer = 'echo';
      else if (e.type === 'causal' || e.tier === 'causal') e.ownerLayer = 'causal';
      else if (e.careerOnboard || e.career) e.ownerLayer = 'career';
      else e.ownerLayer = 'daily';
    });
  }
  normalizeOwners();


  /* v3.8：非自然终局包的年度预算在引擎侧统一调参（只动 annualBudget），
     并按包内文档的归一化规则把 baseChance 重新归一到该预算。
     引擎按“回合年龄”掷骰，31–55 段实际只有 12 个不同年龄，故该段预算按 12 次回合折算。 */
  var V38_BUDGET = {
    '0-6': 0.01300, '7-12': 0.02400, '13-18': 0.03400,
    '19-30': 0.03800, '31-55': 0.04500, '56+': 0.00389
  };
  function tuneV38() {
    var V = LS.V38;
    if (!V || !V.CONFIG || !Array.isArray(V.ENDINGS)) return;
    var tune = LS.V38_TUNE || {};
    var budgets = tune.budget || V38_BUDGET;
    V.CONFIG.annualBudget = V.CONFIG.annualBudget || {};
    var baseLim = 0.03;
    var minBase = 0.00001;
    for (var band in budgets) {
      if (budgets[band] === undefined) continue;
      V.CONFIG.annualBudget[band] = budgets[band];
      var sum = 0;
      var i, e;
      for (i = 0; i < V.ENDINGS.length; i++) {
        e = V.ENDINGS[i];
        if (e.band === band) sum += num0(e.baseChance);
      }
      var k = (sum > 0) ? (budgets[band] / sum) : 1;
      for (i = 0; i < V.ENDINGS.length; i++) {
        e = V.ENDINGS[i];
        if (e.band !== band) continue;
        e.baseChance = Math.min(baseLim, Math.max(minBase, num0(e.baseChance) * k));
        var boostLim = 0.08 - e.baseChance;
        if (num0(e.riskBoost) > boostLim) e.riskBoost = boostLim;
      }
    }
  }
  tuneV38();

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

  var LAYER_OF_TYPE = { forced: 'main', causal: 'chain', random: 'random', daily: 'random', dilemma: 'dilemma' };
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
      if (fx.intimacy) {
        n.intimacy = LS.clamp((Number(n.intimacy) || 0) + Number(fx.intimacy), 0, 100);
      }
      if (fx.favor) {
        var f = Number(fx.favor) || 0;
        /* 兼容旧事件：|favor|>5 视为 0-100 亲密度增量 */
        if (Math.abs(f) > 5) n.intimacy = LS.clamp((Number(n.intimacy) || 0) + f, 0, 100);
        else n.favor = LS.clamp((Number(n.favor) || 0) + f, -5, 5);
      }
      if (fx.health) n.health = LS.clamp((Number(n.health) || 0) + fx.health, 0, 100);
      if (fx.alive === false) n.alive = false;
      if (fx.state) n.state = { job: fx.state.job || n.state.job, health: fx.state.health === undefined ? n.state.health : fx.state.health, status: fx.state.status || null };
      if (fx.anchor) {
        LS.addAnchor(g, n, fx.anchor.kind || 'event', fx.anchor.text || '', 0, 0);
      } else if (fx.favor || fx.intimacy) {
        n.lastContactYear = g.year;
      }
      n.relation = LS.relationOf(n);
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

  /* ---------------- v3.10：童年碎事合并 ---------------- */
  /* 童年原本是「三句一个事件」，读起来是流水账。这里在选中一条童年短节时，
     把它同族的 1–2 条未触发碎事并进同一节，再落一个有物件的收尾，
     正文撑到 100–150 字，同时减少童年回合数（故事推进更快）。 */
  var CHILD_CLOSERS = [
    '这些事后来没人再提起，只有门槛上那道被鞋底磨出的凹痕一直留着。',
    '多年后你才明白，那天大人脸上的为难，和灶台上那口没刷的锅是一回事。',
    '你记住的不是道理，是那盏灯、那只碗，还有大人压低声音时屋里的安静。',
    '那件小事很快被新的日子盖过去，只有墙角那只旧木箱还锁着那时的东西。',
    '后来你走得很远，可一闻到柴火味，就会想起那些没头没尾的下午。',
    '这些细碎的事没有人替你记，只有你自己还记得那只缺角的碗放在哪。'
  ];
  var CHILD_LINKS = ['那阵子，', '再后来，', '还有一回，'];
  function mergeChildhood(g, e) {
    if (!e) return e;
    if (e.stage !== '童年' && (!g || g.stage !== '童年')) return e;
    var txt = String(e.text || '');
    /* 已够长的童年正文也可能超过 150；先按标点裁回 100–150，再决定要不要并 */
    if (txt.length > 150) {
      var c0 = Math.max(txt.lastIndexOf('。', 150), txt.lastIndexOf('；', 150), txt.lastIndexOf('，', 150));
      txt = c0 >= 100 ? txt.slice(0, c0 + 1) : txt.slice(0, 150);
      e.text = txt;
      return e;
    }
    if (txt.length >= 100) return e;
    /* 童年阶段出场的弧线节点/时代锚点不是童年碎事（stage 为 null），同族池为空；
       只补一句收尾把它撑过 100 字，不硬塞无关碎事 */
    if (e.stage !== '童年') {
      var h2 = 0, k2;
      for (k2 = 0; k2 < String(e.id || '').length; k2++) h2 = (h2 * 31 + String(e.id).charCodeAt(k2)) % 997;
      e.text = txt + CHILD_CLOSERS[h2 % CHILD_CLOSERS.length];
      return e;
    }
    var pre = String(e.id || '').replace(/[^_]+$/, '');
    var seen = g.eventSeen || (g.eventSeen = []);
    var same = [], other = [], i, c;
    for (i = 0; i < LS.EVENTS.length; i++) {
      c = LS.EVENTS[i];
      if (!c || c.id === e.id || c.stage !== '童年') continue;
      if (seen.indexOf(c.id) >= 0) continue;
      if (!c.text || c.text.length < 10 || c.text.length > 48) continue;
      if (pre.length >= 4 && String(c.id).indexOf(pre) === 0) same.push(c);
      else other.push(c);
    }
    /* 同族碎事先并；同族不够时用其它童年碎事补。最多并 4 条，尽量凑到 105 字，
       候选耗尽仍不足 100 的保留原样（审计会点名具体 id） */
    var body = txt, n = 0;
    while (body.length < 105 && n < 4 && (same.length || other.length)) {
      var from = same.length ? same : other;
      var idx = Math.floor(LS.rand() * from.length);
      c = from.splice(idx, 1)[0];
      if (!c) {
        if (!from.length) continue;
        continue;
      }
      body += (n < CHILD_LINKS.length ? CHILD_LINKS[n] : '还有一回，') + c.text;
      seen.push(c.id);
      n++;
    }
    var h = 0, k;
    for (k = 0; k < e.id.length; k++) h = (h * 31 + e.id.charCodeAt(k)) % 997;
    body += CHILD_CLOSERS[h % CHILD_CLOSERS.length];
    /* 目标 100–150 字：超了在最近的句号/分号处收住，不硬切半句 */
    if (body.length > 150) {
      var cut = Math.max(body.lastIndexOf('。', 150), body.lastIndexOf('；', 150), body.lastIndexOf('，', 150));
      body = cut >= 100 ? body.slice(0, cut + 1) : body.slice(0, 150);
    }
    e.text = body;
    return e;
  }

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
    /* v3.2：入职后出现上司，进入同事圈 */
    var boss = LS.ensureNpc(g, '上司', {
      id: 'boss', name: LS.randomName('男'), age: g.age + LS.randInt(6, 14),
      gender: LS.chance(0.35) ? '女' : '男', intimacy: 46, circle: '同事圈',
      state: { job: LS.JOBS[id].name + '主管', health: 80, status: null },
      anchors: [{ year: g.year, kind: 'meet', text: '你入职' + LS.JOBS[id].name + '，成了他的下属' }]
    });
    boss.state.job = LS.JOBS[id].name + '主管';
    bcPush(g, 'job_found', null, {
      changes: '岗位：' + LS.JOBS[id].name + ' · ' + g.job.title + ' · 年薪 ' + LS.fmtMoney(g.job.salary) +
        '；标签：加班' + (g.job.tags ? g.job.tags.overtime : '—') + ' · 健康消耗' + (g.job.tags ? g.job.tags.health : '—')
    });
    /* v3.10：岗位一落地就启用职业弧——没登记路径的（求职上岸/中途换岗）在这里补登记，
       随后先出“入职”这一节，再按 order 推进。抽没抽中职业主干都一样推进。 */
    if (LS.CAREER && LS.CAREER.inferFromJob && LS.CAREER.init) {
      var cp = LS.CAREER.inferFromJob(g);
      if (cp) {
        var cs = LS.CAREER.init(g);
        if (!cs.path || cs.path !== cp) LS.CAREER.enter(g, cp, { since: g.age, job: true });
        else if (!cs.jobId) cs.jobId = LS.CAREER.PATHS[cp].jobId;
      }
    }
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
          choiceLabel: ctx ? ctx.label : '',
          choiceScene: ctx ? (ctx.scene || '') : ''
        });
      });
    }
    if (fx.edu !== undefined) eduSet(g, fx.edu);
    /* v3.9 后果图：解锁/锁定事件组；lock 永久不可逆，存档保留 */
    g.unlocked = g.unlocked || {};
    g.locked = g.locked || {};
    var ult = fx.unlock ? (Array.isArray(fx.unlock) ? fx.unlock : [fx.unlock]) : [];
    ult.forEach(function (k) { if (k) g.unlocked[k] = g.age; });
    var lck = fx.lock ? (Array.isArray(fx.lock) ? fx.lock : [fx.lock]) : [];
    lck.forEach(function (k) { if (k) g.locked[k] = g.age; });
    /* 延迟后果：year 年后把一条事件塞回池子（不是数值动画，是文本） */
    if (fx.later) {
      var laters = Array.isArray(fx.later) ? fx.later : [fx.later];
      laters.forEach(function (l) {
        if (!l || !l.event) return;
        var lctx = g._ctxChoice || null;
        g.pending.push({
          event: l.event,
          dueAge: (g.age || 0) + (l.at || 3),
          choiceId: lctx ? lctx.key : '',
          choiceAge: lctx ? lctx.age : null,
          choiceTitle: lctx ? lctx.title : '',
          choiceLabel: lctx ? lctx.label : '',
          choiceScene: lctx ? (lctx.scene || '') : ''
        });
      });
    }
    /* v3.2：路径分化 */
    if (fx.track) {
      g.track = fx.track;
      g.trackSince = g.year;
      g.trackLevel = (g.trackLevel || 0) + (fx.trackLevel || 1);
      LS.addMemory(g, '你选择了' + (LS.TRACK_LABELS[fx.track] || fx.track) + '这条路。', 'track');
    }
    /* v3.2：善缘 / 亏欠（写入可追溯记录） */
    if (fx.kindness) {
      var klist = Array.isArray(fx.kindness) ? fx.kindness : [fx.kindness];
      klist.forEach(function (k) {
        var kn = getNpcLoose(g, k.role || k.id || '');
        if (kn && LS.social) LS.social.kindness(g, kn, k.kind || 'help', k.text || '', k);
      });
    }
    if (fx.wrong) {
      var wlist = Array.isArray(fx.wrong) ? fx.wrong : [fx.wrong];
      wlist.forEach(function (w) {
        var wn = getNpcLoose(g, w.role || w.id || '');
        if (wn && LS.social) LS.social.wrong(g, wn, w.kind || 'offend', w.text || '', w);
      });
    }
    /* v3.2 echo：善缘兑现 / 报复落地，只标记原记录，避免同一笔账反复触发 */
    if (fx.payoff) {
      var pSpec = fx.payoff;
      var pId = typeof pSpec === 'string' ? pSpec : (pSpec && pSpec.id);
      var pRec = null;
      (g.kindnessLog || []).forEach(function (r) {
        if (!pRec && r && !r.resolved && r.id === pId) pRec = r;
      });
      if (pRec && LS.social && LS.social.markPayoff) {
        g.payoffLog = g.payoffLog || [];
        LS.social.markPayoff(g, pRec, g.lastEventId || '', (pSpec && pSpec.type) || 'payoff', (pSpec && pSpec.text) || '');
      }
    }
    if (fx.revengeDone) {
      var rSpec = fx.revengeDone;
      var rId = typeof rSpec === 'string' ? rSpec : (rSpec && rSpec.id);
      var rRec = null;
      (g.revengeLog || []).forEach(function (r) {
        if (!rRec && r && !r.resolved && r.id === rId) rRec = r;
      });
      if (rRec && LS.social && LS.social.markRevenge) {
        g.revengeLog = g.revengeLog || [];
        LS.social.markRevenge(g, rRec, g.lastEventId || '', (rSpec && rSpec.type) || 'revenge', (rSpec && rSpec.text) || '');
      }
    }
    if (fx.ensureNpc) {
      var en = fx.ensureNpc;
      var elist = Array.isArray(en) ? en : [en];
      elist.forEach(function (spec) {
        LS.ensureNpc(g, spec.role || '朋友', spec);
        if (spec.anchor) {
          var nn = LS.getNpc(g, spec.id || spec.role);
          if (nn) LS.addAnchor(g, nn, 'meet', spec.anchor, 0, 0);
        }
      });
    }
    if (fx.trackNpc) {
      for (var tr in fx.trackNpc) {
        var tn = getNpcLoose(g, tr);
        if (tn && LS.social) LS.social.arc(g, tn, fx.trackNpc[tr]);
      }
    }
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

    /* v3.9：阶段总结必须交代三件事：走了几回合、开了几条链、哪条没走完 */
    var plan = (g.stagePlan && g.stagePlan.stage === fromStage) ? g.stagePlan : null;
    var undone = (plan && plan.undone && plan.undone.length) ? plan.undone.slice() : unresolvedChainList(g);
    var undoneTitles = [];
    for (var ui = 0; ui < undone.length; ui++) undoneTitles.push(undone[ui].title || undone[ui].event || '那条线');
    var planTurns = plan ? num0(plan.played) : 0;
    var planBudget = plan ? num0(plan.budget) : 0;
    var opened = chainsOpenedIn(g, plan ? plan.startAge : startAge, plan ? plan.endAge : endAge, undone);
    if (plan) {
      var tail;
      if (plan.skipped) {
        tail = '你在第 ' + planTurns + ' 回合提前离开了这一段，话没说完' +
          (undoneTitles.length ? '：与「' + undoneTitles[0] + '」的那条线断在原地' : '：有些名字还没等到下文') + '。';
      } else if (undoneTitles.length) {
        tail = '这一段走了 ' + planTurns + ' 回合，开了 ' + opened + ' 条链；「' + undoneTitles[0] + '」没能等到下文。';
      } else {
        tail = '这一段走了 ' + planTurns + ' 回合，开了 ' + opened + ' 条链，都走到了头。';
      }
      lines.push(tail);
    }

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
      impacts: useImpacts || [],
      skip: !!(plan && plan.skipped),
      flex: {
        turns: planTurns, budget: planBudget,
        baseBudget: plan ? num0(plan.baseBudget) : 0,
        chainsOpened: opened,
        undone: undoneTitles,
        endAge: plan ? num0(plan.endAge) : endAge,
        skipped: !!(plan && plan.skipped)
      }
    };
  }

  /* ---------------- 事件筛选 ---------------- */
  function condOk(g, e) {
    if (!e) return false;
    /* v3.7：未抽中的隐藏线事件一律不进可选池（含撞车/身世/线索） */
    if (e.line && LS.LINES && LS.LINES.match && !LS.LINES.match(g, e.line)) return false;
    /* v3.9：主干弧模式下，旧链线（exam/romance/...）与九条支线全部静默。
       只有抽中的 A/B/C 弧可以出场；日常事件照旧，但让位给弧节点。 */
    if (LS.ARCS && LS.ARCS.lines && LS.ARCS.lines.length) {
      if (!e.line) {
        var lid = LS.lineIdOf ? LS.lineIdOf(e) : '';
        if (lid && LS.LINES && LS.LINES.match && !LS.LINES.match(g, lid)) return false;
      }
    }
    /* v3.9：主干弧节点的 cond 仍然要判（它负责在 C 线末尾 10a/10b/10c
       三个收束变体里只放行与玩家选择匹配的那一个）；判不过时由 takeDueChain
       走「弧救援」：跳过本节点、顺延到它的后继，保证整条弧不中断。 */
    if (e.cond) {
      try { if (!e.cond(g)) return false; } catch (err) { return false; }
    }
    /* v3.10：在职禁弹备考/求职类事件。考研/复读/招聘会只能在失业待业的分支里
       作为并列选项出现（见 buildJobHuntEvent），不许作为独立事件再弹一次。 */
    if (g.job && g.job.id && e.type !== 'career' && !e.ignoreJobGate) {
      /* dueFork 跳过后事件仍可能被 forced 槽重新捞起，这里按 id 兜底 */
      var gateId = String(e.id || '');
      if (gateId === 'v2_exam_path' || gateId === 'v37_fork_grad' ||
          gateId === 'v37_fork_postgrad') return false;
      var jobSig = String(e.id || '') + ' ' + String(e.title || '');
      if (/考研|复读|二战|招聘会|投简历|校招|宣讲会|调剂|投档/.test(jobSig)) return false;
    }
    /* v3.5：亲属状态守卫（父母/配偶/子女/手足/朋友） */
    if (LS.V35 && LS.V35.pass && !LS.V35.pass(g, e)) return false;
    return true;
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
      /* v3.4：天赋按“事件类别”真实加/减权，不只是一次性属性 */
      if (LS.talentBiasOf) w *= LS.talentBiasOf(g, LS.iconCatOf ? LS.iconCatOf(e) : 'cross', g.age);
      var cdA = globalCD[e.id];
      if (cdA) w *= 1 / (1 + num0(cdA.runs) * 1.5);
      var cdB = g.eventCD && g.eventCD[e.id];
      if (cdB) w *= 1 / (1 + num0(cdB.runs) * 0.3);
      w *= epochMul;
      /* v3.5：开局主题去重与“不连出医疗”通过降权实现，避免随机池被清空 */
      if (LS.V35 && LS.V35.weightFactor) w *= LS.V35.weightFactor(g, e);
      /* v3.7：中年上下半年按主题加权（H1 工作/钱/外部，H2 家庭/身体/关系） */
      if (LS.V37 && LS.V37.weightOf) w *= LS.V37.weightOf(g, e);
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
    /* v3.2：心情太低，面试更难撑住 */
    var hap = num0(g.attrs.happiness);
    if (hap < 40) s -= (hap < 25 ? 0.15 : 0.08);
    /* v3.2：时代背景影响求职概率 */
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
    var base = (g.track && TRACK_POOLS[g.track] && TRACK_POOLS[g.track][strategy]) || map[strategy] || map.safe;
    var list = base.filter(function (id) {
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
    var major = g.track && LS.TRACK_LABELS[g.track] ? LS.TRACK_LABELS[g.track]
      : (g.attrs.knowledge >= 60 ? '理工 / 研究型'
        : (g.attrs.finance >= 55 ? '商科 / 管理型'
          : (g.attrs.charm >= 55 ? '文史 / 沟通型' : '通用型')));
    var pct = function (p) { return Math.round(p * 100) + '%'; };
    var pSafe = huntChance(g, 'safe'), pUp = huntChance(g, 'up'), pLow = huntChance(g, 'low');
    var pRef = huntChance(g, 'referral');
    var chips =
      '手里的筹码：学历 ' + LS.eduName(g.edu.level) +
      ' · 学识 ' + g.attrs.knowledge +
      ' · 方向 ' + major +
      ' · 声望 ' + LS.repTotal(g) +
      ' · 人脉 ' + (g.flags && g.flags.referralUsed ? '已消耗一次内推' : '尚可动用') +
      ' · 证书 ' + (g.marks.has_cert ? '有' : '无') +
      ' · 已求职 ' + tries + ' 次。';
    /* v3.10：正文必须点名选项里出现的岗位/简历，避免选项凭空引用正文没提过的名词 */
    var poolNames = [];
    var nameSeen = {};
    var addPoolNames = function (strategy) {
      var ids = huntPool(g, strategy);
      for (var pi = 0; pi < ids.length; pi++) {
        var nm = LS.JOBS[ids[pi]] ? LS.JOBS[ids[pi]].name : ids[pi];
        if (!nameSeen[nm]) { nameSeen[nm] = 1; poolNames.push(nm); }
      }
    };
    addPoolNames('safe');
    addPoolNames('up');
    addPoolNames('low');
    if (LS.repTotal(g) >= 40) addPoolNames('referral');
    var nameLine = poolNames.slice(0, 12).join('、');
    var text = (tries === 0
      ? '毕业之后，工作不会自己找上门。招聘软件上挂着上百个岗位：' + nameLine + '。你投出去的简历大多没有回音，真正愿意给你面试机会的却不多。你的学历、学识、声望与过往经历，共同决定了能碰到哪一档门槛。'
      : '又是一年。存款在减少，简历上的空档越来越显眼。招聘市场还是那几行岗位：' + nameLine + '。你只能调整策略，再赌一次。') +
      '\n\n' + chips;
    /* v3.2：选项文案按当前路径的实际岗位池生成，避免四条路线共用同一套选项 */
    var poolLabel = function (strategy, n) {
      var ids = huntPool(g, strategy);
      var names = ids.slice(0, n).map(function (id) { return LS.JOBS[id] ? LS.JOBS[id].name : id; });
      return names.join('、') + (ids.length > n ? ' 等' : '');
    };
    var opts = [
      { label: '稳妥求职：' + poolLabel('safe', 3), hint: '成功率约 ' + pct(pSafe) + ' · 薪资中等 · 加班少', tone: 'safe',
        apply: function (g2) { return resolveHunt(g2, 'safe'); } },
      { label: '向上冲：' + poolLabel('up', 3), hint: '成功率约 ' + pct(pUp) + ' · 起薪高 · 加班与健康消耗大', tone: 'risk',
        apply: function (g2) { return resolveHunt(g2, 'up'); } },
      { label: '先降预期：' + poolLabel('low', 2), hint: '成功率约 ' + pct(pLow) + ' · 薪资偏低 · 幸福感 -3', tone: 'switch',
        apply: function (g2) { return resolveHunt(g2, 'low'); } }
    ];
    if (LS.repTotal(g) >= 40) {
      opts.push({ label: '托熟人内推：' + poolLabel('referral', 2), hint: '成功率约 ' + pct(pRef) + ' · 消耗人脉（社会声望 -5）', tone: 'switch',
        apply: function (g2) { return resolveHunt(g2, 'referral'); } });
    }
    /* v3.10：考研/考公只在待业这里出现，和「再找工作」并排；在职时不允许单独弹。
       选项必须回指正文里的「空档」「岗位」，不能凭空冒出一个抽象的「去考试」。 */
    opts.push({
      label: '考研：把简历上空档的两年改成学籍', hint: '学费 3 万元 · 学历 +1 · 两年后再回来投简历', tone: 'switch',
      apply: function (g2) {
        g2.edu.level = Math.min(6, Number(g2.edu.level || 5) + 1);
        g2.attrs.knowledge = LS.clamp((g2.attrs.knowledge || 0) + 4, 0, 100);
        g2.attrs.stress = LS.clamp((g2.attrs.stress || 0) + 6, 0, 100);
        g2.money.cash = Math.max(0, g2.money.cash - 30000);
        g2.job.huntTries = (g2.job.huntTries || 0) + 1;
        g2.job.lastHunt = { age: g2.age, ok: false, strategy: 'kaoyan' };
        g2.marks = g2.marks || {};
        g2.marks.fork22_kaoyan = true;
        g2.flags.needJob = true;
        return '你把招聘软件卸了，报名、交费、搬进合租房。两年后学历那一栏确实好看了一些，空档也变成了「在读」。';
      }
    });
    opts.push({
      label: '考公：报街道办那个岗位', hint: '备考半年 · 上岸率约三成 · 稳定但晋升慢', tone: 'safe',
      apply: function (g2) {
        g2.job.huntTries = (g2.job.huntTries || 0) + 1;
        var ok = LS.chance((g2.attrs.knowledge || 0) >= 60 ? 0.38 : 0.24);
        if (ok) {
          setJob(g2, 'civil');
          g2.marks = g2.marks || {};
          g2.marks.fork22_work = true;
          return '笔试过线，面试那天你穿了唯一一件白衬衫。录取通知贴在公示栏上，名字在倒数第三行。';
        }
        g2.job.lastHunt = { age: g2.age, ok: false, strategy: 'civil' };
        g2.flags.needJob = true;
        return '成绩出来差了四分。街道办的岗位只招一个，你连面试名单都没进，只能把资料收进纸箱。';
      }
    });
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
    if (e.family && g.eventFamilies && g.eventFamilies[e.family]) return true;
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

  /* v3.8：年龄判定收敛——这里只做转发，真正的规则全在 LS.eventAgeGuard 一处 */
  function ageMatch(e, age) {
    return !!(LS.eventAgeGuard && LS.eventAgeGuard(e, age));
  }

  /* 关键年：强制剧情、到期回响、命运岔路、时代切换、高权重随机事件 */
  function hasKeyEvent(g, nextAge) {
    var E = LS.EVENTS || [];
    var stage = LS.stageOf(nextAge);
    var i, e;
    /* v3.7：时代锚点年份不能静默跳过，否则 v36 的六个年份会缺 */
    if (LS.V36 && LS.V36.ERA_ANCHORS) {
      var nextYear = g.year + (nextAge - g.age);
      var eraFired = g.eraFired || {};
      for (i = 0; i < LS.V36.ERA_ANCHORS.length; i++) {
        if (LS.V36.ERA_ANCHORS[i].year === nextYear && !eraFired[nextYear]) return true;
      }
    }
    for (i = 0; i < E.length; i++) {
      e = E[i];
      if (!e || e.type !== 'forced') continue;
      if (!ageMatch(e, nextAge)) continue;
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

  /* UI 直接调用：从当前状态推进到下一个关键节点前（v3.2 已删除“跳过平淡年”） */

  /* v3.7：隐藏线节点优先于强制剧情年，否则一条线会被升学/工作节点整年挤掉 */
  /* v3.9 弧救援：主干弧节点若因亲属离世 / 分支 mark 对不上而永远 condOk=false，
     整条弧会卡死在 pending 里。此时跳过该节点，按它的默认选项把后继节点顺延进 pending，
     保证弧从第一节一路走到最后一节。 */
  function arcNodeFlags(e) {
    var out = [], seen = {}, i, j;
    if (!e || !e.opts) return out;
    for (i = 0; i < e.opts.length; i++) {
      var fl = e.opts[i].fx && e.opts[i].fx.flag;
      if (!fl || !fl.length) continue;
      /* 多选项分别指向不同后继时，取第一个选项的后继，保持单线推进 */
      for (j = 0; j < fl.length; j++) {
        if (!fl[j] || !fl[j].event || seen[fl[j].event]) continue;
        seen[fl[j].event] = 1;
        out.push(fl[j]);
      }
      break;
    }
    return out;
  }

  function arcRescue(g, e, why) {
    var fl = arcNodeFlags(e), i;
    for (i = 0; i < fl.length; i++) {
      var next = LS.EVENT_INDEX[fl[i].event];
      if (!next || !next.line) continue;
      if (g.fired && g.fired.indexOf(fl[i].event) >= 0) continue;
      g.pending.push({ event: fl[i].event, dueAge: g.age + (fl[i].delay || 1) });
    }
    g.arcSkipped = g.arcSkipped || [];
    g.arcSkipped.push({ id: e.id, age: g.age, why: why || 'cond' });
  }

  function takeDueChain(g) {
    if (!Array.isArray(g.pending) || !LS.LINES || !LS.LINES.match) return null;
    var best = null, bestIdx = -1;
    for (var i = 0; i < g.pending.length; i++) {
      var item = g.pending[i];
      if (!item || item.dueAge > g.age) continue;
      var pe = LS.EVENT_INDEX[item.event];
      if (!pe || !pe.line) continue;
      if (!LS.LINES.match(g, pe.line)) continue;
      if (g.fired && g.fired.indexOf(pe.id) >= 0) continue;
      if (!condOk(g, pe)) {
        if (LS.ARCS && LS.ARCS.isArc && LS.ARCS.isArc(pe.line)) {
          g.pending.splice(i, 1); i--;
          arcRescue(g, pe, 'cond');
        }
        continue;
      }
      if (!best || item.dueAge < best.dueAge) { best = item; bestIdx = i; }
    }
    if (!best) return null;
    g.pending.splice(bestIdx, 1);
    return LS.EVENT_INDEX[best.event];
  }

  /* =========================================================
     v3.8 事件分桶 + 槽位配额
     每回合先定槽位，再在槽内抽；一回合仍然只产出 1 个事件。
     事件按 stage 归桶，避免“扫全表时 stage 不匹配就静默丢弃”。
     ========================================================= */
  var SLOT_ORDER = ['main', 'side', 'relation', 'career', 'dilemma', 'causal', 'forced', 'daily'];
  var SLOT_QUOTA = { main: 0.15, side: 0.40, relation: 0.18, career: 0.10, dilemma: 0.07, causal: 0.14, forced: 0.07, daily: 0.16 };
  var EV_BUCKETS = null;
  var EV_BUCKETS_LEN = -1;

  function slotOfEvent(e) {
    if (!e) return 'daily';
    if (e.type === 'career' || e.layer === 'career') return 'career';
    if (e.type === 'forced') return 'forced';
    if (e.type === 'causal') return 'causal';
    if (e.layer === 'npc' || e.npcEvent || e.npcRole) return 'relation';
    if (e.type === 'era' || e.layer === 'era') return 'main';
    if (e.type === 'branch' || e.layer === 'branch') return 'daily';
    if (e.type === 'random' || e.type === 'daily') {
      if (e.tier === 'crossroad') return 'main';
      if (e.tier === 'echo') return 'relation';
      if (e.family) return 'side';
      return 'daily';
    }
    return 'daily';
  }

  function newSlotBucket() {
    return { main: [], side: [], relation: [], causal: [], forced: [], daily: [] };
  }

  function buildEventBuckets() {
    var E = LS.EVENTS || [];
    if (EV_BUCKETS && EV_BUCKETS_LEN === E.length) return EV_BUCKETS;
    var b = { byStage: {}, all: newSlotBucket() };
    var stages = LS.STAGES || [];
    var i, s;
    for (s = 0; s < stages.length; s++) b.byStage[stages[s]] = newSlotBucket();
    for (i = 0; i < E.length; i++) {
      var e = E[i];
      if (!e || !e.id) continue;
      /* 隐藏线节点只走 pending 管线，避免被随机层抽到后乱序 */
      if (e.line) continue;
      /* 时代事件只走 eraAnchor，避免槽位抽到无年份的旧事件 */
      if (e.type === 'era' || e.layer === 'era') continue;
      var slot = slotOfEvent(e);
      if (!slot || slot === 'career') continue; /* 职业事件只走 LS.CAREER.due */
      var bucket = (e.stage && b.byStage[e.stage]) ? b.byStage[e.stage] : b.all;
      if (bucket[slot]) bucket[slot].push(e);
    }
    EV_BUCKETS = b;
    EV_BUCKETS_LEN = E.length;
    return b;
  }

  /* v3.8：越界丢弃审计——不是静默丢，记进 g.ageLeaks 供回归统计
     （eventId / 触发年龄 / 应然区间 / 应然阶段） */
  function noteAgeLeak(g, e) {
    if (!g) return;
    if (!g.ageLeaks) g.ageLeaks = [];
    if (!g.ageBlocked) g.ageBlocked = {};
    var id = (e && e.id) || '?';
    var key = String(id) + '@' + g.age;
    if (g.ageBlocked[key]) return;
    g.ageBlocked[key] = true;
    var r = LS.eventAgeRange(e);
    g.ageLeaks.push({
      turn: g.turn, age: g.age, year: g.year, stage: g.stage,
      eventId: id, title: (e && e.title) || '',
      ageMin: r[0], ageMax: r[1], stageNeed: (e && e.stage) || ''
    });
  }
  function ageBlocked(g, e) {
    if (!e || !e.id || !g.ageBlocked) return false;
    return !!g.ageBlocked[String(e.id) + '@' + g.age];
  }

  /* v3.8：线已关却仍被抽到——记一条，不进回忆录 */
  function noteLineDrop(g, e, lineId) {
    if (!g) return;
    if (!g.lineDrops) g.lineDrops = [];
    if (!g.lineBlocked) g.lineBlocked = {};
    var key = String((e && e.id) || '?') + '@' + g.age + '@' + lineId;
    if (g.lineBlocked[key]) return;
    g.lineBlocked[key] = true;
    g.lineDrops.push({
      turn: g.turn, age: g.age, year: g.year, line: lineId,
      eventId: (e && e.id) || '', title: (e && e.title) || ''
    });
  }
  function lineBlocked(g, e) {
    var lid = LS.lineIdOf ? LS.lineIdOf(e) : '';
    if (!lid) return false;
    var key = String((e && e.id) || '') + '@' + g.age + '@' + lid;
    return !!(g.lineBlocked && g.lineBlocked[key]);
  }

  /* v3.9：本局骨架闸门——只放行 activeLines 里的线，其余线彻底不进池 */
  function archetypeOpen(g, e) {
    var lid = LS.lineIdOf ? LS.lineIdOf(e) : '';
    if (!lid) return true;
    var act = g.activeLines;
    if (!act || !act.length) return true;
    return act.indexOf(lid) >= 0;
  }

  /* v3.9：节点顺序闸门——N 只能接在 N-1 之后，尾巴接在第 3 节之后 */
  function chainStepFired(g, key, step) {
    var idx = LS.CHAIN_INDEX;
    if (!idx) {
      idx = LS.CHAIN_INDEX = {};
      (LS.EVENTS || []).forEach(function (x) {
        if (x.chainKey && x.chainStep) idx[x.chainKey + '#' + x.chainStep] = x.id;
      });
    }
    var id = idx[key + '#' + step];
    return !!id && g.fired.indexOf(id) >= 0;
  }

  function chainReady(g, e) {
    if (!e || !e.chainKey) return true;
    if (e.chainStep && e.chainStep > 1) return chainStepFired(g, e.chainKey, e.chainStep - 1);
    if (e.chainTail) return chainStepFired(g, e.chainKey, 3);
    return true;
  }

  function noteNodeBlock(g, e, kind) {
    if (!g) return;
    if (!g.nodeBlocks) g.nodeBlocks = [];
    if (g.nodeBlocks.length > 200) return;
    g.nodeBlocks.push({ age: g.age, turn: g.turn, eventId: (e && e.id) || '', kind: kind });
  }

  function slotUsable(g, e, slot) {
    if (!e || !e.id) return false;
    if (isFired(g, e)) return false;
    if (isPendingFuture(g, e.id)) return false;
    /* v3.9：daily 不抢主干槽位，且单局上限 25 条。
       主干弧在跑时放宽到 60 条——弧节点横跨到晚年，日常封顶过早会把剩下几十年直接判死。 */
    var dailyCap = (LS.ARCS && LS.ARCS.lines && LS.ARCS.lines.length) ? 140 : 25;
    if (slot !== 'forced' && (e.ownerLayer || 'daily') === 'daily' && (g.dailyCount || 0) >= dailyCap) return false;
    /* v3.8：所有槽位统一过年龄闸门，散落的年龄判断全部收进 LS.eventAgeGuard */
    if (!ageMatch(e, g.age)) return false;
    if (ageBlocked(g, e)) return false;
    var lid = LS.lineIdOf ? LS.lineIdOf(e) : '';
    if (lid && LS.lineOpen && !LS.lineOpen(g, lid)) return false;
    if (lineBlocked(g, e)) return false;
    /* v3.9：被永久 lock 的事件组不再进池（不可逆，存档也保留） */
    if (e.group && g.locked && g.locked[e.group]) return false;
    if (e.needsUnlock && (!g.unlocked || !g.unlocked[e.needsUnlock])) return false;
    if (!archetypeOpen(g, e)) return false;
    if (!chainReady(g, e)) return false;
    if (e.arch && e.arch.indexOf('school') >= 0 &&
      (g.activeLines || []).indexOf('exam') < 0) return false;
    /* v3.9：回响必须有源事件已经在案，指不回去的“假回响”一律不进池
       入职事件虽然挂在 echo 档，但它本身就是源，不受此限 */
    if (e.tier === 'echo' && !e.careerOnboard) {
      var src = e.echoParent || e.echoOf || e._echoParent || '';
      if (!src || g.fired.indexOf(src) < 0) return false;
    }
    if ((slot === 'relation' || slot === 'side' || slot === 'daily') && seenBefore(g, e)) return false;
    if (slot !== 'forced' && riskBlocked(g, e)) return false;
    if ((slot === 'main' || slot === 'side' || slot === 'relation' || slot === 'daily') && e.healthNeg) return false;
    if (slot === 'causal' && e.healthNeg && !riskActive(g, e)) return false;
    return condOk(g, e);
  }

  function preferFresh(list, slot) {
    if (!list.length || slot === 'forced') return list;
    var gcd = (LS.eventCDRead ? LS.eventCDRead() : {}) || {};
    var fresh = [], i;
    for (i = 0; i < list.length; i++) {
      var cd = gcd[list[i].id];
      if (!cd || num0(cd.runs) === 0) fresh.push(list[i]);
    }
    /* 跨局优先抽从未出现过的；某阶段池抽干后才允许重复 */
    return fresh.length ? fresh : list;
  }

  function slotPool(g, slot) {
    var b = buildEventBuckets();
    var st = b.byStage[g.stage] || { main: [], side: [], relation: [], causal: [], forced: [], daily: [] };
    var stageList = (st && st[slot]) || [];
    var allList = b.all[slot] || [];
    var out = [], i;
    for (i = 0; i < stageList.length; i++) {
      if (slotUsable(g, stageList[i], slot)) out.push(stageList[i]);
    }
    for (i = 0; i < allList.length; i++) {
      if (slotUsable(g, allList[i], slot)) out.push(allList[i]);
    }
    return preferFresh(out, slot);
  }

  function slotState(g) {
    if (!g.slotState || typeof g.slotState !== 'object') g.slotState = { last: {} };
    if (!g.slotState.last) g.slotState.last = {};
    return g.slotState;
  }

  function noteSlot(g, slot) {
    slotState(g).last[slot] = num0(g.turn);
  }

  function pendingDueList(g) {
    if (!Array.isArray(g.pending)) return [];
    var due = [];
    for (var p = 0; p < g.pending.length; p++) {
      var item = g.pending[p];
      if (!item || num0(item.dueAge) > g.age) continue;
      var pe = LS.EVENT_INDEX[item.event];
      if (pe && riskBlocked(g, pe)) continue;
      due.push({ item: item, ev: pe, prio: pe ? (pe.prio || 60) : 0 });
    }
    return due;
  }

  function hasDuePending(g) {
    return pendingDueList(g).length > 0;
  }

  function takePendingDue(g, urgentOnly) {
    var due = pendingDueList(g);
    if (!due.length) return null;
    /* v3.6：先到期的先兑现（FIFO），撞车/承诺到期这类“必须答复”的插队 */
    due.sort(function (a, b) {
      var ua = a.item.urgent ? 1 : 0, ub = b.item.urgent ? 1 : 0;
      if (ub !== ua) return ub - ua;
      var da = a.item.dueAge || 0, db = b.item.dueAge || 0;
      if (da !== db) return da - db;
      return (b.prio || 0) - (a.prio || 0);
    });
    if (urgentOnly && !due[0].item.urgent) return null;
    var chosen = due[0];
    var idx = g.pending.indexOf(chosen.item);
    if (idx >= 0) g.pending.splice(idx, 1);
    if (chosen.item.mark) g.marks[chosen.item.mark] = true;
    if (chosen.item.note) LS.addMemory(g, chosen.item.note + '，事情在这一年有了结果。', 'causal');
    if (!chosen.ev || !condOk(g, chosen.ev)) return null;
    var fromAge = chosen.item.choiceAge;
    if (fromAge === null || fromAge === undefined) fromAge = Math.max(0, g.age - (chosen.item.delay || 1));
    g.echoInfo = {
      kind: 'echo',
      fromAge: fromAge,
      years: Math.max(1, g.age - fromAge),
      sourceTitle: chosen.item.choiceTitle || '',
      choiceLabel: chosen.item.choiceLabel || '',
      choiceId: chosen.item.choiceId || '',
      parentChoiceId: chosen.item.choiceId || '',
      sourceEventId: chosen.item.sourceEventId || (chosen.ev && chosen.ev.echoParent) || '',
      sourceText: chosen.item.choiceScene || '',
      note: chosen.item.note || '',
      riskKey: chosen.item.riskKey || (chosen.ev && chosen.ev.riskKey) || '',
      oneLiner: (chosen.item.choiceLabel ? '当时你选择了「' + chosen.item.choiceLabel + '」' : (chosen.item.note || '此前的选择'))
    };
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

  function pickCausal(g, pool) {
    if (!pool || !pool.length) return null;
    /* 多年事件链优先：链上事件一旦满足条件，给更高落点概率 */
    var chainPool = [];
    for (var cc = 0; cc < pool.length; cc++) {
      if (pool[cc].layer === 'chain') chainPool.push(pool[cc]);
    }
    var picked = pickWeighted((chainPool.length && LS.chance(0.55)) ? chainPool : pool, g);
    if (!picked) return null;
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
        parentChoiceId: '',
        riskKey: rk,
        note: LS.RISK_LABEL[rk] || '',
        oneLiner: (LS.RISK_LABEL[rk] || '长期隐患')
      };
    } else if (picked.tier === 'echo' && !g.echoInfo) {
      g.echoInfo = { kind: 'echo', fromAge: Math.max(0, g.age - 1), years: 1, sourceTitle: '', choiceLabel: '', parentChoiceId: '', oneLiner: '此前的经历' };
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

  function dilemmaHandicap(g) {
    if (!LS.V36 || !LS.V36.DILEMMAS) return true;
    if (g.stage !== '青年' && g.stage !== '中年') return true;
    if (num0(g.dilemmaCount) >= 8) return true;
    if (g.turn - num0(g.lastDilemmaTurn) < 4) return true;
    for (var uq = 0; uq < g.pending.length; uq++) {
      var pu = g.pending[uq];
      if (pu.urgent && num0(pu.dueAge) <= g.age) return true;
    }
    return false;
  }

  function dilemmaAvailable(g) {
    return !dilemmaHandicap(g);
  }

  function takeDilemma(g) {
    if (dilemmaHandicap(g)) return null;
    var pool = [];
    for (var di = 0; di < LS.V36.DILEMMAS.length; di++) {
      var de = LS.V36.DILEMMAS[di];
      if (de.stage && de.stage.indexOf(g.stage) < 0) continue;
      if (!condOk(g, de)) continue;
      if (isFired(g, de)) continue;
      if (isPendingFuture(g, de.id)) continue;
      if (seenBefore(g, de)) continue;
      pool.push(de);
    }
    if (!pool.length) return null;
    var picked = pickWeighted(pool, g);
    if (picked) {
      g.lastDilemmaTurn = g.turn;
      g.dilemmaCount = num0(g.dilemmaCount) + 1;
    }
    return picked;
  }

  function freshCountOf(list) {
    if (!list || !list.length) return 0;
    var gcd = (LS.eventCDRead ? LS.eventCDRead() : {}) || {};
    var n = 0;
    for (var i = 0; i < list.length; i++) {
      var cd = gcd[list[i].id];
      if (!cd || num0(cd.runs) === 0) n++;
    }
    return n;
  }

  function buildSlotPools(g) {
    var plan = { pools: {}, fresh: {}, due: false, dilemma: false, careerEv: null };
    for (var i = 0; i < SLOT_ORDER.length; i++) {
      var sl = SLOT_ORDER[i];
      plan.pools[sl] = (sl === 'dilemma' || sl === 'career') ? [] : slotPool(g, sl);
      plan.fresh[sl] = (sl === 'dilemma' || sl === 'career' || sl === 'forced')
        ? true : (freshCountOf(plan.pools[sl]) > 0);
    }
    plan.due = hasDuePending(g);
    plan.dilemma = dilemmaAvailable(g);
    /* 职业事件同样走槽位，不再无条件抢占回合；due 内部自带冷却 */
    if (LS.CAREER && LS.CAREER.due) plan.careerEv = LS.CAREER.due(g);
    /* v3.10：主干弧不再封杀职业组——抽中职业弧只是加厚，没抽中也要有基础职业推进。
       弧节点仍由 takeDueChain 先占回合，职业事件只填剩余的空位。 */
    return plan;
  }

  function slotAvailable(plan, slot) {
    if (slot === 'causal') return plan.due || (plan.pools.causal && plan.pools.causal.length > 0);
    if (slot === 'dilemma') return plan.dilemma;
    if (slot === 'career') return !!plan.careerEv;
    return !!(plan.pools[slot] && plan.pools[slot].length);
  }

  function chooseSlot(g, plan) {
    var S = slotState(g);
    var best = '', bestScore = -1;
    for (var i = 0; i < SLOT_ORDER.length; i++) {
      var slot = SLOT_ORDER[i];
      if (!slotAvailable(plan, slot)) continue;
      var last = S.last[slot];
      if (last === undefined) last = -40;
      var gap = num0(g.turn) - last;
      if (gap < 0) gap = 0;
      var quota = SLOT_QUOTA[slot] || 0.1;
      /* v3.9：中年每回合跨好几年，职业链的可出牌次数被压缩，给 career 槽补偿权重 */
      if (slot === 'career' && LS.V37 && LS.V37.isDouble(g.age)) quota *= 2.2;
      /* v3.9：回合变稀后两难与职业一样容易被挤掉，同样给一点补偿 */
      if (slot === 'dilemma') quota *= 2.0;
      var score = (gap + 0.5) * quota;
      /* 槽内已无跨局新事件时降权，把回合让给仍有新鲜事件的槽，避免重复消耗 */
      if (!plan.fresh[slot]) score *= 0.15;
      if (score > bestScore) { best = slot; bestScore = score; }
    }
    return best;
  }

  function topForcedFrom(pool) {
    var best = null;
    for (var i = 0; i < pool.length; i++) {
      if (!best || num0(pool[i].prio) > num0(best.prio)) best = pool[i];
    }
    return best;
  }

  function topForced(g, minPrio) {
    var pool = slotPool(g, 'forced');
    var best = null;
    for (var i = 0; i < pool.length; i++) {
      if (num0(pool[i].prio) < minPrio) continue;
      if (!best || num0(pool[i].prio) > num0(best.prio)) best = pool[i];
    }
    return best;
  }

  function drawSlot(g, slot, plan) {
    var ev = null;
    if (slot === 'causal') {
      ev = takePendingDue(g, false);
      if (!ev) ev = pickCausal(g, plan.pools.causal);
    } else if (slot === 'forced') {
      ev = topForcedFrom(plan.pools.forced);
    } else if (slot === 'dilemma') {
      ev = takeDilemma(g);
    } else if (slot === 'career') {
      ev = plan.careerEv;
    } else {
      ev = pickWeighted(plan.pools[slot], g);
    }
    if (ev) noteSlot(g, slot);
    return ev;
  }

  function selectEvent(g) {
    var E = LS.EVENTS;
    maybeNewEpoch(g);

    /* v3.6.1：到寿死亡事件优先于一切 */
    if (LS.V35 && LS.V35.dueDeath) {
      var dEv = LS.V35.dueDeath(g);
      if (dEv) return dEv;
    }

    /* v3.8：非自然终局 / 刑满释放优先（同一年只掷一次，服刑期内返回 null） */
    if (LS.V38 && LS.V38.due) {
      var v38Ev = LS.V38.due(g);
      if (v38Ev) return v38Ev;
    }

    /* v3.7 P4：中考/高考/大学毕业/研究生毕业四个分流点，强制优先于普通事件与隐藏线 */
    if (LS.V37 && LS.V37.dueFork) {
      var forkEv = LS.V37.dueFork(g);
      if (forkEv) return forkEv;
    }

    /* v3.10：在岗即启用职业主序列。放在死亡/刑满/分流之后，时代锚点与隐藏线之前，
       保证任意连续 3 个展示回合内至少 1 条职业事件（阈值 2 = 两条职业事件之间最多
       夹 2 条叙事）。order 主序列永远优先；只有 due 返回 null（下一条未到龄/序列
       已空）时才用缓冲事件填空档，反过来会把 order 事件饿死。C.due 只推进未触发的
       新事件、入职只发生一次，不会重复出场。 */
    if (LS.CAREER && LS.CAREER.due) {
      var careerHard = LS.CAREER.due(g);
      if (!careerHard && LS.CAREER.buffer) careerHard = LS.CAREER.buffer(g);
      if (careerHard) {
        var cst = LS.CAREER.init(g);
        var cLast = cst.lastTurn === undefined ? -99 : cst.lastTurn;
        if (g.turn - cLast >= 2) return careerHard;
      }
    }

    /* v3.7 P4.0：为时代锚点预留的追加回合，直接返回锚点事件 */
    if (g.eraPending && LS.V36 && LS.V36.eraAnchor) {
      g.eraPending = false;
      var holdEra = LS.V36.eraAnchor(g);
      if (holdEra) return holdEra;
    }

    /* v3.7：抽中的隐藏线节点优先于日常/随机，且迟到最多一年，不被整年挤掉 */
    var chainEv = takeDueChain(g);
    if (chainEv) return chainEv;

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

    /* 1. 强制槽硬点：出生/升学/毕业等 key 年份（同回合最多 1 条），
       其余 forced 进入槽位调度，避免 events.js 的 forced 独占回合。 */
    var hardForced = topForced(g, 95);
    if (hardForced) return hardForced;

    /* v3.7 P4.0：时代锚点独立成事件；正文本身讲该年的事，绝不做无关事件的背景行 */
    if (LS.V36 && LS.V36.eraAnchor) {
      var eraEv = LS.V36.eraAnchor(g);
      if (eraEv) return eraEv;
    }

    /* 3e. v3.6 两难层：已并入槽位调度（dilemma 槽），不再在层序里独占回合 */

    /* 2. 到期的因果标记：只有 urgent（撞车/承诺到期）享有回合硬优先；
       其余到期回响进入 causal 槽，由槽位配额决定何时落点。 */
    /* v3.7：旧档/并发残留里属于未抽中线的 pending，直接丢弃 */
    if (LS.LINES && LS.LINES.match) {
      for (var pq = g.pending.length - 1; pq >= 0; pq--) {
        var pit = g.pending[pq];
        var pev0 = pit && LS.EVENT_INDEX[pit.event];
        if (pev0 && pev0.line && !LS.LINES.match(g, pev0.line)) g.pending.splice(pq, 1);
      }
    }
    var urgentEv = takePendingDue(g, true);
    if (urgentEv) return urgentEv;

    /* 2b. 善缘兑现 / 报复返场（10-20 年后，按人情账概率） */
    if (LS.social) {
      var dueK = LS.social.dueKindness(g);
      if (dueK.length) {
        var kev = LS.buildEchoEvent ? LS.buildEchoEvent(g, dueK[0], 'kind') : null;
        if (kev) {
          kev._echoParent = kev._echoParent || dueK[0].eventId || '';
          if (!g.echoInfo) {
            g.echoInfo = {
              kind: 'echo', fromAge: dueK[0].age, years: Math.max(1, g.age - dueK[0].age),
              sourceTitle: dueK[0].text || '', choiceLabel: '', parentChoiceId: dueK[0].choiceId || '',
              oneLiner: '当年帮过的人'
            };
          }
          return kev;
        }
      }
      var dueR = LS.social.dueRevenge(g);
      if (dueR.length) {
        var rev = LS.buildEchoEvent ? LS.buildEchoEvent(g, dueR[0], 'revenge') : null;
        if (rev) {
          rev._echoParent = rev._echoParent || dueR[0].eventId || '';
          if (!g.echoInfo) {
            g.echoInfo = {
              kind: 'echo', fromAge: dueR[0].age, years: Math.max(1, g.age - dueR[0].age),
              sourceTitle: dueR[0].text || '', choiceLabel: '', parentChoiceId: dueR[0].choiceId || '',
              oneLiner: '当年得罪过的人'
            };
          }
          return rev;
        }
      }
    }

    /* 3. 槽位调度：先定槽位（按配额轮转），再在槽内抽；
       随机层因此不再排在十几层之后被饿死。 */
    var plan = buildSlotPools(g);
    for (var attempt = 0; attempt < SLOT_ORDER.length; attempt++) {
      var slot = chooseSlot(g, plan);
      if (!slot) break;
      var slotEv = drawSlot(g, slot, plan);
      if (slotEv) return slotEv;
      /* 该槽本轮被抢空：标记不可用后顺延到次优槽 */
      plan.pools[slot] = [];
      if (slot === 'causal') plan.due = false;
    }

    /* 4. 兜底日常（走与槽位完全相同的闸门：年龄 / 线锁 / 归属 / daily 配额） */
    var fallback = slotPool(g, 'daily');
    if (fallback.length) return fallback[Math.floor(LS.rand() * fallback.length)];
    return null;
  }

  /* ---------------- 年度演化 ---------------- */
  function healthLoss(g) {
    var age = g.age;
    /* v3.7 P4：整体下调自然衰减（旧值 0.6/0.5/0.8/1.0/1.4/2.0/3.4/5.2/7.0）。
       健康管理得当的局能撑到 80+；不管健康的人仍会被慢性病/隐患拖到 50–60 岁。 */
    var loss;
    if (age <= 3) loss = 0.5;
    else if (age <= 12) loss = 0.4;
    else if (age <= 18) loss = 0.6;
    else if (age <= 30) loss = 0.8;
    else if (age <= 40) loss = 1.0;
    else if (age <= 55) loss = 1.3;
    else if (age <= 70) loss = 1.9;
    else if (age <= 85) loss = 2.8;
    else loss = 4.0;

    if (g.job.id) {
      var jd = LS.JOBS[g.job.id];
      loss += (jd.healthDrain || 0) * 0.7;
      var jt = g.job.tags || {};
      if (jt.overtime === '高') loss += 0.4;
    }
    /* 隐性隐患长期消耗 */
    var maxRisk = 0;
    LS.RISK_KEYS.forEach(function (k) { maxRisk = Math.max(maxRisk, (g.risks && g.risks[k]) || 0); });
    loss += maxRisk / 100 * 1.1;
    /* 旧值 0.08/年过陡，45 岁后天然加速累积过快；改为温和的 0.025 */
    if (age >= 45) loss += (age - 45) * 0.025;

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

    if (g.attrs.stress >= 75) loss += 0.9;
    else if (g.attrs.stress >= 55) loss += 0.5;
    if (g.attrs.happiness >= 70) loss -= 0.9;
    if (g.attrs.happiness < 30) loss += 0.6;
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

    /* v3.7 P4：职业路径年收入，每年只在跨年结算时入账一次（H1→H2 不走 tickEconomy） */
    if (LS.CAREER && LS.CAREER.applyIncome) LS.CAREER.applyIncome(g);

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
    /* v3.7 P4：45 岁做一次长期生活方式结算，长期熬夜/高压累积折寿 4–8 年 */
    if (g.age === 45 && LS.applyLifestyleLifespan) LS.applyLifestyleLifespan(g);
    var loss = healthLoss(g);
    g.attrs.health -= loss;

    /* 身体自愈：年轻时恢复快，慢性病会拖慢恢复 */
    var chronic = g.marks.bp_untreated || g.marks.liver_bad || g.marks.lung_issue || g.marks.mobility_issue;
    var recover = 0;
    if (g.age <= 35) recover = 2.5;
    else if (g.age <= 55) recover = 4.2;
    else if (g.age <= 70) recover = 6.5;
    else if (g.age <= 80) recover = 5.2;
    else if (g.age <= 90) recover = 3.5;
    if (chronic) recover *= 0.5;
    if (g.attrs.happiness >= 60) recover += 0.4;
    if (g.marks.exercise) recover += 0.7;
    /* v3.7 P4：健康管理的平台期——高健康且压力可控时额外回补，让人能稳定活到 80+ */
    if (g.attrs.health >= 78 && g.attrs.stress < 55) recover += 0.45;
    if (g.attrs.health < 92) g.attrs.health = Math.min(92, g.attrs.health + recover);
    if (g.attrs.health > 100) g.attrs.health = 100;

    var stressDrift = 0;
    if (g.job.id) stressDrift += (LS.JOBS[g.job.id].stress || 0) * 0.7;
    if (g.money.debt > 0) stressDrift += LS.clamp(g.money.debt / 120000, 0, 3);
    if (g.family.childrenIds.length) stressDrift += 0.8;
    if (g.attrs.happiness >= 68) stressDrift -= 1.6;
    if (g.attrs.happiness < 32) stressDrift += 0.7;
    g.attrs.stress += stressDrift - 1.5;
    /* 人对长期压力有适应性，压力越高回落越快 */
    if (g.attrs.stress > 55) g.attrs.stress -= (g.attrs.stress - 55) * 0.15;
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
      var arcNow = LS.relationStageOf(n.intimacy, arcOld);
      if (arcOld && arcOld !== arcNow && (arcOld === '亲近' || arcOld === '熟络') &&
          (arcNow === '疏远' || arcNow === '决裂')) {
        LS.addMemory(g, '这一年，你和' + n.name + '（' + n.role + '）的关系淡成了' + arcNow + '。', 'rel');
      }
      var arcRec = g.npcArc[n.id] || { nodes: [] };
      if (!arcRec.nodes) arcRec.nodes = [];
      arcRec.stage = arcNow;
      arcRec.lastAge = g.age;
      g.npcArc[n.id] = arcRec;
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
      /* v3.6.1 hotfix：到点必死（deathYear 由寿数推算），不再只靠 age > lifespan 的概率式判定 */
      var dueDeath = !!(n.deathYear && g.year >= n.deathYear);
      if (n.health <= 0 || n.age > n.lifespan || dueDeath) {
        n.health = 0;
        n.alive = false;
        n.deathYear = g.year;
        /* 父母/配偶死亡必须有一场死亡事件（谁在身边、你当时在哪），先排队，下一回合强制出 */
        if (n.role === '父亲' || n.role === '母亲' || n.role === '配偶') {
          g.deathQueue = g.deathQueue || [];
          g.deathQueue.push({
            id: n.id, role: n.role, name: n.name, year: g.year,
            cause: n.health <= 0 ? '久病之后，身体撑不住了'
              : (n.age >= 85 ? '在睡梦里走的，很安静'
              : (n.role === '父亲' ? '肺上的老毛病反复，最后没能熬过这个冬天'
              : (n.role === '母亲' ? '一次摔倒后再没站起来' : '年老体衰')))
          });
        }
        g.npcArc[n.id] = { stage: arcNow, lastAge: g.age, dead: true, nodes: (g.npcArc[n.id] || {}).nodes || [] };
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
    if (g.v38Death && g.v38Death.cause) return g.v38Death.cause;
    if (g.forceDeath) return '一场突发的意外';
    if (g.attrs.health <= HEALTH_LIMIT) {
      if (g.marks.bp_untreated) return '高血压引发的并发症';
      if (g.marks.liver_bad) return '肝功能衰竭';
      if (g.marks.lung_issue) return '肺部疾病';
      return '身体机能衰竭';
    }
    if (g.age >= Math.min(Number(g.maxAge) || 100, 95)) return '自然寿终';
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

  function v38UndoneOf(g) {
    var un = unresolvedChainList(g);
    if (!un.length) return '';
    var u = un[0];
    return '「' + (u.title || u.event || '那条线') + '」停在半路';
  }

  function finish(g, reason, info) {
    if (g.death.dead) return g.summary;
    /* v3.8：非自然终局包写下的明细在这里并入早终 UI，不改 ui.js */
    if (g.v38Death && (!info || info.kind !== 'natural')) {
      var vd = g.v38Death;
      info = info || {};
      info.kind = 'early';
      if (!info.cause) info.cause = vd.cause || reason;
      if (!info.tag) info.tag = vd.tag || '';
      if (!info.sceneLast) info.sceneLast = (vd.settle || []).join('');
      if (!info.whoWasThere) info.whoWasThere = (vd.present || []).slice();
      if (!info.relics) info.relics = vd.relic ? [vd.relic] : [];
      if (!info.lastWords) info.lastWords = vd.lastWords || '';
      if (!info.undone) info.undone = v38UndoneOf(g);
    }
    var early = !!(info && info.kind === 'early');
    g.death.dead = true;
    g.death.kind = early ? 'early' : 'natural';
    g.death.reason = (early ? (info.cause || reason) : reason) || '身体机能衰竭';
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
    if (!early && LS.stageOf(g.death.age) === '晚年' && typeof buildStageSummary === 'function') {
      var fim = writeStageImpact(g, '晚年');
      finalStageSummary = buildStageSummary(g, '晚年', '晚年', fim);
      g.stageSummary = finalStageSummary;
    }

    /* v3.7 P4：职业结局标签（状元/沉沦/普通），旧档无 career 字段时安全降级 */
    var careerEnd = '';
    var careerPathId = null;
    if (LS.CAREER) {
      if (LS.CAREER.init) LS.CAREER.init(g);
      careerEnd = (LS.CAREER.endLabel ? LS.CAREER.endLabel(g) : '') || '';
      careerPathId = (g.career && g.career.path) || null;
    }

    /* v3.10：结局点名没来得及了结的钩子，保证“开了头”的东西都有交代 */
    var undoneText = (info && info.undone) || '';
    if (!undoneText && g.hookLog && g.hookLog.length) {
      var un = [];
      for (var hi = 0; hi < g.hookLog.length; hi++) {
        var hh = g.hookLog[hi];
        if (!hh || hh.usedAt || hh.settled) continue;
        hh.settled = true;
        if (hh.noun && un.indexOf(hh.noun) < 0) un.push(hh.noun);
      }
      if (un.length) undoneText = '没来得及了结的：' + un.slice(-3).join('、');
    }
    g.summary = {
      name: g.name,
      gender: g.gender,
      birthYear: g.birthYear,
      deathYear: g.death.year,
      age: g.death.age,
      reason: g.death.reason,
      kind: early ? 'early' : 'natural',
      endingTag: (info && info.tag) || '',
      sceneLast: (info && info.sceneLast) || '',
      whoWasThere: (info && info.whoWasThere) || [],
      relics: (info && info.relics) || [],
      lastWords: (info && info.lastWords) || '',
      undone: undoneText,
      careerEnd: careerEnd,
      careerPath: careerPathId,
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

  /* ---------------- v3.10 节尾钩子 → 下节回指 ----------------
     每节落地后从正文里挑一个具体物件/单据留下，下一节开头先回指它；
     没被回指、也没在结局点名的钩子才算 dangling。 */
  /* 钩子只认“具体的人/物”，不做量词瞎猜，避免出现「上回留下的月三百八」这类假钩子 */
  var HOOK_OBJ = /(缴费单|收据|收条|发票|账单|欠条|借条|合同|通知书|录取通知|病历|诊断书|药单|处方|车票|火车票|工资条|工牌|钥匙|照片|相片|请柬|罚单|传票|卷宗|档案|名单|账本|日记|奖状|证书|简历|名片|手机|戒指|手表|自行车|木箱|房产证|存折|银行卡|押金条|红包|礼金|离婚证|户口本|保单|体检报告|化验单|药盒|轮椅|拐杖|骨灰盒|墓碑|店面|摊位|三轮车|工具箱|扳手|菜刀|锅铲|那只碗|旧碗|信封|信纸|那封信|一封信)/;
  var HOOK_PERSON = /(父亲|母亲|爸爸|妈妈|爷爷|奶奶|姥姥|姥爷|舅舅|姨妈|姑姑|叔叔|哥哥|姐姐|弟弟|妹妹|班主任|同桌|发小|邻居|老板|师傅|同事|客户|医生|护士|警察|房东|工头|同学|室友)/;
  function hookOf(text) {
    var t = String(text || '');
    var m = HOOK_OBJ.exec(t);
    if (m) return { noun: m[1], kind: 'obj' };
    m = HOOK_PERSON.exec(t);
    if (m) return { noun: m[1], kind: 'person' };
    return null;
  }
  function hookBridge(hk) {
    var i = num0(hk.seq) % 3;
    if (hk.kind === 'person') {
      if (i === 1) return '上次' + hk.noun + '说的那件事，还没个结果。';
      if (i === 2) return hk.noun + '那边，你一直没给个准话。';
      return '上回' + hk.noun + '留下的那句话，还悬着。';
    }
    if (i === 1) return '上次的' + hk.noun + '，你还没处置。';
    if (i === 2) return '你还没忘了' + hk.noun + '那一档子事。';
    return '上回留下的' + hk.noun + '，还搁在那儿没动。';
  }
  function noteHook(g, ev, text) {
    /* 求职决定当回合就给出结果（入职或继续待业），不留下跨节钩子：
       它没有“下一节要交代”的悬念，硬留会变成收不掉的短线索 */
    if (ev && /^jobhunt$/.test(String(ev.id || ''))) return;
    var hk = hookOf(text);
    if (!hk) hk = hookOf(ev && ev.text);
    if (!hk) return;
    if (!g.hookLog) g.hookLog = [];
    hk.id = (ev && ev.id) || '';
    hk.age = g.age;
    hk.turn = g.turn;
    hk.seq = g.hookLog.length;
    /* 距上一节超过 5 年仍未回指的，记为短线，结局要点名 */
    var prev = g.hook;
    if (prev && !prev.usedAt && num0(g.age) - num0(prev.age) > 5) prev.settled = false;
    g.hookLog.push(hk);
    if (g.hookLog.length > 80) g.hookLog = g.hookLog.slice(-80);
    g.hook = hk;
  }

  /* v3.10 审计探针：给出当前回合最靠前的候选与落选原因，用于回答
     “职业/偶发事件为什么不出”——不是猜测，是逐条闸门的判定结果。 */
  LS.debugCandidates = function (g, n) {
    var E = LS.EVENTS || [], out = [];
    var c = (LS.CAREER && LS.CAREER.init) ? LS.CAREER.init(g) : null;
    var hasJob = !!(g.job && g.job.id);
    for (var i = 0; i < E.length; i++) {
      var e = E[i];
      if (!e || !e.id) continue;
      var stg = e.stage || '';
      if (stg && stg !== g.stage) continue;
      var rg = LS.eventAgeRange(e);
      if (num0(g.age) < num0(rg[0]) - 2 || num0(g.age) > num0(rg[1]) + 2) continue;
      var reason = '';
      if (g.fired && g.fired.indexOf(e.id) >= 0) reason = '已触发';
      else if (!ageMatch(e, g.age)) reason = '不在阶段/年龄区间';
      else if (e.type === 'career' || e.careerOnboard || (e.path && e.order)) {
        if (!hasJob) reason = '职业未启用（无岗）';
        else if (!c || !c.path) reason = '职业未启用（无路径）';
        else if (!c.onboarded) reason = '等待入职事件';
        else if (e.cond) { try { if (!e.cond(g)) reason = '条件不满足（非本职业）'; } catch (x0) { reason = '条件不满足'; } }
      } else {
        if (e.line && LS.LINES && LS.LINES.match && !LS.LINES.match(g, e.line)) reason = '主线未抽中';
        else if (!archetypeOpen(g, e)) reason = '主线未抽中';
        else if (!chainReady(g, e)) reason = 'order 未轮到';
        else if (e.cond) { try { if (!e.cond(g)) reason = '条件不满足'; } catch (x1) { reason = '条件不满足'; } }
        else if (e.tier === 'echo' && !e.careerOnboard) {
          var src = e.echoParent || e.echoOf || e._echoParent || '';
          if (!src || g.fired.indexOf(src) < 0) reason = '回响源不在案';
        }
      }
      if (!reason) reason = '在池';
      out.push({
        id: e.id, title: e.title || '', type: e.type || '', order: e.order,
        reason: reason, inPool: reason === '在池'
      });
    }
    out.sort(function (a, b) {
      if (a.inPool !== b.inPool) return a.inPool ? -1 : 1;
      var ca = (a.type === 'career' || /^car_/.test(a.id)) ? 0 : 1;
      var cb = (b.type === 'career' || /^car_/.test(b.id)) ? 0 : 1;
      if (ca !== cb) return ca - cb;
      return num0(a.order) - num0(b.order);
    });
    return out.slice(0, n || 5);
  };

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
    /* v3.10：本节开头回指上一节留下的钩子（同一事件不自我回指，超过 5 年不再硬贴）。
       正文本来就已经提到该名词，也算完成回指，必须记 usedAt，否则审计会误判悬空。 */
    var hk = g.hook;
    if (hk && hk.noun && (!e.id || e.id !== hk.id)) {
      var hkBody = String(out.text || '');
      var hkFresh = num0(g.age) - num0(hk.age) <= 5;
      if (hkBody.indexOf(hk.noun) < 0 && hkFresh) {
        out.text = hookBridge(hk) + hkBody;
        hkBody = out.text;
      }
      if (hkFresh && hkBody.indexOf(hk.noun) >= 0) {
        hk.usedAt = g.age;
        hk.usedTurn = g.turn;
      }
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

  /* v3.3：回响的父选择必须能指回一条真实 choiceId；指不回就不写 */
  /* v3.8：echoOf 一律指向**源事件 id**（回忆录按 eventLog 的 eventId 校验存在性），
     不再回落到 choiceId——那会造出“来源对不上”的假回响。 */
  function echoParentOf(g, e) {
    if (!e || e.tier !== 'echo') return null;
    var pid = e._echoParent || e.echoParent ||
      (g.echoInfo && (g.echoInfo.sourceEventId || g.echoInfo.echoOf)) || '';
    return pid || null;
  }

  function nextEvent(g) {
    if (g.death.dead) return null;
    g.current = null;
    g.echoInfo = null;
    g.currentId = null;
    g.quietNote = '';

    var guard = 0;
    var skippedTotal = 0;
    while (guard++ < 24 && !g.death.dead) {
      /* v3：平淡年合并——当前年不是关键年、且不跨阶段时静默推进，最多连续 6 年 */
      /* v3.7：中年每年两回合，不做跨年平淡合并，避免吞掉 H2 */
      var skipped = 0;
      while (!g.death.dead && skipped < 6) {
        if (LS.V37 && LS.V37.isDouble(g.age)) break;
        /* v3.9：阶段内年龄已按回合预算排好，不再额外静默跳年 */
        if (g.stagePlan) break;
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
      /* v3.8：出场前唯一闸门——槽位、兜底、动态回响都从这里过；越界丢弃并记审计 */
      if (!ageMatch(e, g.age)) {
        noteAgeLeak(g, e);
        continue;
      }
      /* v3.8：线闸门——线关了（如已入职还挂备考线）一律不出，丢弃并计数 */
      var lid = LS.lineIdOf ? LS.lineIdOf(e) : '';
      if (lid && LS.lineOpen && !LS.lineOpen(g, lid)) {
        noteLineDrop(g, e, lid);
        continue;
      }
      /* v3.9：回响必须有在案的源事件；指不回去的不出，也不写假 echoOf。
         主干弧节点自带走线（由 pending 与上一节承接），本身就是源，不受此限 */
      var arcEv = !!(e.line && LS.ARCS && LS.ARCS.isArc && LS.ARCS.isArc(e.line));
      /* v3.10：职业组事件自带入职源（career.onboarded），不需要 echoOf 回响源；
         之前它们被这条闸门整批挡掉，189 条职业事件一局都没出过 */
      var careerEvFlag = e.type === 'career' || e.careerOnboard;
      if (e.tier === 'echo' && !careerEvFlag && !arcEv) {
        var ep = echoParentOf(g, e);
        if (!ep || g.fired.indexOf(ep) < 0) {
          noteNodeBlock(g, e, 'echo');
          if (!g.ageBlocked) g.ageBlocked = {};
          g.ageBlocked[String(e.id) + '@' + g.age] = true;
          continue;
        }
      }
      if (e.stage === '童年' || g.stage === '童年') e = mergeChildhood(g, e);
      e = prepEvent(g, e);
      if (LS.V36 && LS.V36.attachOverlays) e = LS.V36.attachOverlays(g, e);
      /* v3.10：职业事件真正出场时才写冷却，保证节奏不被空探测推后 */
      if (careerEvFlag && LS.CAREER && LS.CAREER.init) LS.CAREER.init(g).lastTurn = g.turn;

      if (autoResolvable(e) && !e.eraNote &&
          !(LS.V37 && LS.V37.isDouble(g.age) && (e.opts || []).length)) {
        g.current = e;
        g.currentId = e.id;
        g.currentTier = e.tier || 'daily';
        g.currentLogSeq = LS.pushEventLog(g, {
          turn: g.turn, age: g.age, year: g.year, stage: g.stage, tier: e.tier || 'daily',
          eventId: e.id, title: e.title, source: layerOf(e), auto: true,
          careerOnboard: !!e.careerOnboard,
          echoOf: echoParentOf(g, e)
        });
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
    if (LS.V35 && LS.V35.markTheme) LS.V35.markTheme(g, e);
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
    /* v3.9：daily 层配额——主干节点优先，日常只补位且一局不超过 25 条 */
    if ((e.ownerLayer || 'daily') === 'daily') {
      g.dailyCount = (g.dailyCount || 0) + 1;
      if (!e.owner) g.sharedCount = (g.sharedCount || 0) + 1;
    }

    /* v3：去重记录（每日/随机/支线）与冷却统计 */
    var layer = layerOf(e);
    if (layer === 'random' || layer === 'branch' || layer === 'era' || layer === 'npc' || layer === 'echo') {
      if (!g.eventSeen) g.eventSeen = [];
      if (g.eventSeen.indexOf(e.id) < 0) g.eventSeen.push(e.id);
      if (g.eventSeen.length > 240) g.eventSeen = g.eventSeen.slice(-240);
    }
    g.eventCD = g.eventCD || {};
    var oldCd = g.eventCD[e.id] || {};
    g.eventCD[e.id] = { lastAge: g.age, runs: num0(oldCd.runs) + 1 };

    g.lastEventId = e.id;
    /* v3.3：唯一事实源 eventLog（自动结算与手动事件都写；回忆录只读它） */
    g.currentLogSeq = LS.pushEventLog(g, {
      turn: g.turn, age: g.age, year: g.year, stage: g.stage, tier: e.tier || 'daily',
      eventId: e.id, title: e.title, source: layer, auto: false,
      careerOnboard: !!e.careerOnboard,
      echoOf: echoParentOf(g, e)
    });
    /* v3.2：事件流水保留用于统计，但不再作为回忆录来源 */
    g.eventRunLog = g.eventRunLog || [];
    g.eventRunLog.push({ turn: g.turn, age: g.age, year: g.year, stage: g.stage, eventId: e.id, title: e.title, layer: layer, family: e.family || '' });
    if (g.eventRunLog.length > 300) g.eventRunLog.shift();
    if (e.family) {
      g.eventFamilies = g.eventFamilies || {};
      g.eventFamilies[e.family] = true;
    }
    if (layer === 'npc') g.npcInitiated.push({ id: e.id, npcId: e.npcId || '', age: g.age, year: g.year });
    return e;
    }
  }

  function choose(g, index) {
    if (!g.current || g.death.dead) return { ok: false, error: '当前没有可执行的事件' };
    var opt = g.current.opts[index];
    if (!opt) return { ok: false, error: '选项不存在' };

    var before = snapshotBefore(g);
    /* v3.7：记录选择前的亲密关系，供 H1 年度账本比对 */
    var npcBefore = {};
    (g.npcs || []).forEach(function (n) {
      if (n && n.id) npcBefore[n.id] = num0(n.intimacy);
    });
    var baseBefore = { attrs: JSON.parse(JSON.stringify(g.attrs)), rep: LS.repTotal(g) };
    var report = {};
    var text = '';
    var declared = [];
    var outcomeLabel = '';
    var ev = g.current;
    var ctx = {
      key: (ev.id || 'ev') + '@' + g.age,
      id: ev.id,
      age: g.age,
      year: g.year,
      title: ev.title,
      label: opt.label,
      tier: ev.tier || 'daily',
      tags: opt.tags || [],
      scene: ev.text || ''
    };
    g._ctxChoice = ctx;
    g.crossSeen = g.crossSeen || {};
    if (g.crossGate) g.crossSeen[g.crossGate] = true;

    /* v3.5：在场者意见结算（采纳/忽视 → 真金白银的差异 + 亲密度/人情账） */
    var adv = null;
    g._adviceP = 0;
    if (LS.advisorResolve) adv = LS.advisorResolve(g, ev, index);
    if (adv) {
      if (adv.fx) applyFx(g, adv.fx, report);
      g._adviceP = num0(adv.pDelta);
      g.lastAdvice = { lines: adv.lines || [], eventId: ev.id, age: g.age };
    } else {
      g.lastAdvice = null;
    }

    applyFx(g, opt.fx, report);
    if (typeof opt.apply === 'function') {
      var applied = opt.apply(g, report);
      if (applied) text = applied;
    }
    if (!text && opt.outcomes && opt.outcomes.length) {
      var total = 0;
      var hap = num0(g.attrs.happiness);
      var hard = isHardOpt(opt);
      var weights = opt.outcomes.map(function (o, i) {
        var w = Math.max(0, Number(o.w) || 0);
        if (hard && hap < 40 && i === 0) w = w * (hap < 25 ? 0.70 : 0.85);
        if (i === 0 && g._adviceP) w = w * LS.clamp(1 + g._adviceP * 2.2, 0.6, 1.6);
        total += w;
        return w;
      });
      declared = opt.outcomes.map(function (o) { return o.text || o.label || ''; });
      var roll = LS.rand() * total;
      var pick = 0;
      for (var oi = 0; oi < weights.length; oi++) {
        roll -= weights[oi];
        if (roll <= 0) { pick = oi; break; }
      }
      var oc = opt.outcomes[pick];
      applyFx(g, oc.fx, report);
      text = oc.text || oc.label || '';
      outcomeLabel = oc.label || '';
      ctx.outcome = oc.label || '';
      g.outcomeLog.push({
        year: g.year, age: g.age, eventId: ctx.id, eventTitle: ev.title, opt: opt.label, choiceId: ctx.key,
        outcome: oc.label, idx: pick, weights: weights, declared: declared, resultText: text
      });
      if (g.outcomeLog.length > 200) g.outcomeLog.shift();
    }
    if (!text && opt.gamble) {
      var pv = typeof opt.gamble.p === 'function' ? opt.gamble.p(g) : opt.gamble.p;
      var pAdj = LS.clamp((isFinite(pv) ? pv : 0.5) + luckOf(g) * 0.12 + num0(g._adviceP), 0.03, 0.97);
      if (isHardOpt(opt) && num0(g.attrs.happiness) < 40) {
        pAdj = LS.clamp(pAdj - (num0(g.attrs.happiness) < 25 ? 0.18 : 0.10), 0.03, 0.97);
        ctx.hapPenalty = true;
      }
      declared = [opt.gamble.winText || '', opt.gamble.loseText || ''];
      var win = LS.chance(pAdj);
      if (win) {
        applyFx(g, opt.gamble.win, report);
        text = opt.gamble.winText || '';
        outcomeLabel = '成功';
      } else {
        applyFx(g, opt.gamble.lose, report);
        text = opt.gamble.loseText || '';
        outcomeLabel = '失败';
      }
      g.outcomeLog.push({
        year: g.year, age: g.age, eventId: ctx.id, eventTitle: ev.title, opt: opt.label, choiceId: ctx.key,
        outcome: outcomeLabel, p: pAdj, declared: declared, resultText: text
      });
      if (g.outcomeLog.length > 200) g.outcomeLog.shift();
    }
    /* v3.7 P4：职业路径记分/旗标 + 分流点入行，必须在所有 fx 结算之后 */
    if (LS.CAREER && LS.CAREER.applyChoice) LS.CAREER.applyChoice(g, ev, opt);
    if (LS.V37 && LS.V37.applyFork && opt && opt.fork) LS.V37.applyFork(g, ev, opt);

    /* v3.8：职业落定 → 关闭备考/求职/创业线（各写一条收尾句），并记下这条线的开场 */
    var jobNow = (g.job && g.job.id) ? g.job.id : '';
    if (jobNow && jobNow !== g._jobSnapshot) {
      g._jobSnapshot = jobNow;
      if (LS.closeLinesOnJob) LS.closeLinesOnJob(g, 'employed');
    }
    var lineNow = LS.lineIdOf ? LS.lineIdOf(ev) : '';
    if (lineNow && LS.lineStart) LS.lineStart(g, lineNow);

    /* v3.6：两难记账、放弃方降亲密、承诺与多年回响 */
    if (LS.V36 && LS.V36.onChoice) LS.V36.onChoice(g, ev, opt, outcomeLabel);
    g._ctxChoice = null;

    clampAttrs(g);
    moneyRound(g);
    /* v3.7：中年上半年选择若付出明显代价/收益，记入年度账本，下半年出后果卡 */
    if (LS.V37 && LS.V37.onChoice) {
      LS.V37.onChoice(g, ev, opt, {
        health: before.attrs.health,
        cash: before.cash,
        intimacy: npcBefore
      });
    }
    var decKey = (ctx.id || '') + '@' + g.age + '#' + g.turn;
    if (!g._auto && (!g._decCounted || g._decCounted !== decKey)) {
      g.decisionCount = num0(g.decisionCount) + 1;
      g._decCounted = decKey;
    }

    /* v2：记录真实选择，供因果链逻辑使用（回忆录不再读它） */
    if (ctx.tier === 'crossroad' || (ctx.tags.length) || (opt.fx && opt.fx.flag)) {
      g.choiceLog = g.choiceLog || [];
      g.choiceLog.push(ctx);
      if (g.choiceLog.length > 120) g.choiceLog = g.choiceLog.slice(-120);
    }

    var changes = describeChanges(g, baseBefore);
    var outcome = text ? text + (changes ? '（' + changes + '）' : '') : (changes ? changes : '日子照旧。');

    /* v3.3：回填唯一事实源；lastOutcome 只记录玩家手动选择，自动结算不得覆盖 */
    var logEntry = LS.eventLogEntry(g, g.currentLogSeq);
    if (logEntry) {
      logEntry.choiceId = ctx.key;
      logEntry.choiceIndex = index;
      logEntry.choiceLabel = opt.label || '';
      logEntry.outcomeLabel = outcomeLabel;
      logEntry.resultText = text || '';
      logEntry.declared = declared.slice();
      logEntry.changes = changes;
    }
    if (!g._auto) {
      g.lastOutcome = {
        text: outcome, title: ev.title, year: g.year, age: g.age, tier: ev.tier || 'daily',
        eventId: ev.id, choiceId: ctx.key, logSeq: g.currentLogSeq, choiceLabel: opt.label
      };
    }

    /* v3.10：本节落地后留一个钩子，供下一节开头回指 */
    noteHook(g, ev, text);
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

  /* v3.2：困难/毅力类选项（低心情时更难成） */
  function isHardOpt(opt) {
    if (!opt) return false;
    if (opt.hard) return true;
    if (opt.tags && opt.tags.indexOf('hard') >= 0) return true;
    var s = (opt.label || '') + ' ' + (opt.hint || '');
    return /毅力|咬牙|硬撑|熬夜|坚持|拼|赌|风险|创业|考试|面试|借/.test(s);
  }
  LS.isHardOpt = isHardOpt;

  /* v3.2：路径分化职业池 */
  var TRACK_POOLS = {
    science: { safe: ['civil', 'stateowned', 'researcher'], up: ['engineer', 'researcher', 'doctor', 'startup'], low: ['gig', 'stateowned', 'sales'], referral: ['stateowned', 'engineer', 'researcher'] },
    arts:    { safe: ['teacher', 'admin', 'stateowned'], up: ['media', 'legal', 'startup', 'sales'], low: ['gig', 'admin', 'sales'], referral: ['teacher', 'stateowned', 'media'] },
    art:     { safe: ['designer', 'freelance', 'teacher'], up: ['designer', 'freelance', 'startup'], low: ['gig', 'freelance', 'designer'], referral: ['designer', 'freelance', 'teacher'] },
    sports:  { safe: ['coach', 'security', 'stateowned'], up: ['coach', 'soldier', 'startup'], low: ['gig', 'security', 'sales'], referral: ['coach', 'stateowned', 'soldier'] }
  };
  LS.TRACK_POOLS = TRACK_POOLS;
  LS.TRACK_LABELS = {
    science: '理科（工程/科研/技术）', arts: '文科（传媒/法务/行政/教育）',
    art: '艺术（设计/艺术圈/自由职业）', sports: '体育（体校/参军/教练/安保）'
  };

  /* v3.2：关键社交角色在对应年龄自动入场，保证 NPC 主动事件有目标 */
  function ensureSocialNpcs(g) {
    if (!g || !g.npcs || !LS.addNpc) return;
    if (g.age >= 6 && !LS.getNpc(g, '发小')) {
      var fn = LS.randomName('男');
      LS.addNpc(g, '发小', {
        id: 'faxiao', name: fn, age: g.age + LS.randInt(-1, 1),
        intimacy: 64, circle: '发小圈', note: '从小在一条巷子里长大',
        anchors: [{ year: g.year, kind: 'meet', text: '你们在巷口一起玩到天黑' }]
      });
      LS.addMemory(g, '你认识了发小' + fn + '。', 'rel');
    }
    if (g.age >= 7 && !LS.getNpc(g, '同学')) {
      var cn = LS.randomName(LS.chance(0.5) ? '男' : '女');
      LS.addNpc(g, '同学', {
        id: 'classmate', name: cn, age: g.age + LS.randInt(-1, 1),
        intimacy: 54, circle: '同学圈', note: '小学同班',
        anchors: [{ year: g.year, kind: 'meet', text: '你们成了同桌' }]
      });
    }
  }

  /* ---------------- v3.9：弹性阶段制 ---------------- */
  var STAGE_TURN_RULE = { base: 6, min: 3, max: 12, chainBonus: 2 };
  LS.STAGE_TURN_RULE = STAGE_TURN_RULE;

  /* 晚年阶段以实际寿数为终点，其余阶段用状态表里的结束年龄 */
  function stageEndAgeOf(g, stage) {
    var rng = LS.stageRange(stage);
    var end = num0(rng[1]);
    if (stage === '晚年') {
      var cap = num0(g && g.maxAge);
      if (cap >= num0(rng[0]) && cap < end) end = cap;
    }
    return end;
  }

  function isChainEvent(e) {
    if (!e) return false;
    if (e.layer === 'chain' || e.line) return true;
    if (e.type === 'causal' && !e.riskKey) return true;
    return false;
  }

  /* 未走完的链：pending 里尚未到期/尚未触发的链式后续事件，按 family 去重 */
  function chainPendingItems(g) {
    var out = [];
    var p = (g && g.pending) || [];
    for (var i = 0; i < p.length; i++) {
      var it = p[i];
      if (!it || !it.event) continue;
      var e = LS.EVENT_INDEX ? LS.EVENT_INDEX[it.event] : null;
      if (!isChainEvent(e)) continue;
      if (g.fired && !e.repeatable && g.fired.indexOf(e.id) >= 0) continue;
      out.push({
        item: it, event: e, dueAge: num0(it.dueAge),
        title: e.title || e.id,
        family: e.family || e.line || e.id
      });
    }
    return out;
  }

  function unresolvedChainList(g) {
    var raw = chainPendingItems(g);
    var out = [], seen = {};
    for (var i = 0; i < raw.length; i++) {
      var x = raw[i];
      if (seen[x.family]) continue;
      seen[x.family] = true;
      out.push({ event: x.event.id, title: x.title, family: x.family, dueAge: x.dueAge });
    }
    return out;
  }

  function chainBonusOf(g) {
    var n = unresolvedChainList(g).length;
    return Math.min(STAGE_TURN_RULE.max - STAGE_TURN_RULE.base, n * STAGE_TURN_RULE.chainBonus);
  }

  /* 阶段内必须踩到的年龄：强制事件、时代锚点、分流点、阶段终点 */
  function criticalAgesFor(g, stage, fromAge, endAge, includeFrom) {
    var set = {}, list = [];
    function add(a) {
      var n = Math.round(num0(a));
      if (!isFinite(n)) return;
      if (n < fromAge || n > endAge) return;
      if (n === fromAge && !includeFrom) return;
      if (set[n]) return;
      set[n] = true;
      list.push(n);
    }
    var evs = LS.EVENTS || [];
    for (var i = 0; i < evs.length; i++) {
      var e = evs[i];
      if (!e || e.type !== 'forced' || typeof e.age !== 'number') continue;
      if (e.stage && e.stage !== stage) continue;
      add(e.age);
    }
    if (LS.V36 && LS.V36.ERA_ANCHORS) {
      for (var k = 0; k < LS.V36.ERA_ANCHORS.length; k++) {
        add(LS.V36.ERA_ANCHORS[k].year - num0(g.birthYear));
      }
    }
    if (LS.V37 && LS.V37.FORK_AGE) {
      for (var key in LS.V37.FORK_AGE) {
        if (Object.prototype.hasOwnProperty.call(LS.V37.FORK_AGE, key)) add(Number(key));
      }
    }
    add(endAge);
    list.sort(function (a, b) { return a - b; });
    return list;
  }

  /* 在 [fromAge, endAge] 内排出 budget 个回合年龄：关键年龄必踩，其余均匀填空 */
  function buildAgeList(g, stage, fromAge, endAge, budget, includeFrom) {
    var req = criticalAgesFor(g, stage, fromAge, endAge, includeFrom);
    if (!req.length) req = [endAge];
    if (req[req.length - 1] !== endAge) {
      req.push(endAge);
      req.sort(function (a, b) { return a - b; });
    }
    if (req.length > budget) req = req.slice(req.length - budget);
    var extras = budget - req.length;
    var gaps = [];
    var prev = fromAge;
    for (var i = 0; i < req.length; i++) {
      var lo = prev + 1, hi = req[i] - 1;
      if (hi >= lo) gaps.push({ lo: lo, hi: hi, span: hi - lo + 1 });
      prev = req[i];
    }
    var out = req.slice();
    var totalSpan = 0;
    for (var j = 0; j < gaps.length; j++) totalSpan += gaps[j].span;
    if (extras > 0) {
      if (!totalSpan) {
        /* 关键年龄已经铺满整段，多出来的回合落在中段同一年 */
        var mid = req[Math.floor(req.length / 2)];
        for (var m = 0; m < extras; m++) out.push(mid);
      } else {
        var used = 0;
        for (var q = 0; q < gaps.length; q++) {
          var take = (q === gaps.length - 1) ? (extras - used)
            : Math.round(extras * gaps[q].span / totalSpan);
          if (take > gaps[q].span) take = gaps[q].span;
          if (take > extras - used) take = extras - used;
          if (take < 0) take = 0;
          var step = gaps[q].span / (take + 1);
          for (var t = 0; t < take; t++) {
            var a = gaps[q].lo + Math.floor(step * (t + 1));
            if (a > gaps[q].hi) a = gaps[q].hi;
            out.push(a);
          }
          used += take;
        }
        /* 浮点分配少算时补在中段 */
        var mid2 = req[Math.floor(req.length / 2)];
        while (used < extras) { out.push(mid2); used++; }
      }
    }
    out.sort(function (a, b) { return a - b; });
    return out;
  }

  function makeStagePlan(g, stage) {
    if (!stage) stage = LS.stageOf(g.age);
    var start = num0(g.age);
    var end = stageEndAgeOf(g, stage);
    var req = criticalAgesFor(g, stage, start, end, true);
    var baseBudget = Math.min(STAGE_TURN_RULE.max,
      Math.max(STAGE_TURN_RULE.base, req.length));
    var budget = Math.min(STAGE_TURN_RULE.max,
      Math.max(STAGE_TURN_RULE.min, baseBudget + chainBonusOf(g)));
    var plan = {
      stage: stage, startAge: start, endAge: end,
      baseBudget: baseBudget, budget: budget,
      played: 0, lastAge: start,
      ages: buildAgeList(g, stage, start, end, budget, true),
      chainsAtStart: unresolvedChainList(g).length,
      skipped: false, undone: [], skippedAtAge: null
    };
    g.stagePlan = plan;
    /* 第一个回合不一定从阶段起点开始（中间的空年安静走过） */
    var first = plan.ages.length ? plan.ages[0] : start;
    if (first > g.age) jumpYears(g, first - g.age);
    plan.lastAge = g.age;
    return plan;
  }

  function ensureStagePlan(g) {
    if (!g.stagePlan || !g.stagePlan.stage || g.stagePlan.stage !== g.stage) {
      makeStagePlan(g, g.stage);
    }
    return g.stagePlan;
  }

  /* 一口气走过 delta 年：逐年的经济/健康/NPC/人生线 tick 全部照跑 */
  function jumpYears(g, delta) {
    delta = num0(delta);
    if (delta <= 0) return 0;
    for (var i = 0; i < delta; i++) {
      g.age += 1;
      g.year += 1;
      g.turn += 1;
      g.stage = LS.stageOf(g.age);
      tickEconomy(g);
      tickHealth(g);
      tickNpcs(g);
      ensureSocialNpcs(g);
      clampAttrs(g);
      LS.snapshot(g);
      if (LS.social) {
        LS.social.beginYear(g);
        LS.social.decay(g);
        if (LS.social.tickAll) LS.social.tickAll(g);
      }
      if (LS.LINES && LS.LINES.tick) LS.LINES.tick(g);
      if (LS.V36 && LS.V36.tick) LS.V36.tick(g);
      if (num0(g.maxAge) && g.age >= num0(g.maxAge)) break;
    }
    return delta;
  }

  /* 本阶段开了几条链：阶段内触发过的链式事件 + 还悬着的链 */
  function chainsOpenedIn(g, startAge, endAge, undone) {
    var fams = {}, i;
    var log = (g && g.eventLog) || [];
    for (i = 0; i < log.length; i++) {
      var x = log[i];
      if (num0(x.age) < num0(startAge) || num0(x.age) > num0(endAge)) continue;
      var e = LS.EVENT_INDEX ? LS.EVENT_INDEX[x.eventId] : null;
      if (!isChainEvent(e)) continue;
      fams[e.family || e.line || e.id] = true;
    }
    for (i = 0; i < undone.length; i++) fams[undone[i].family] = true;
    return Object.keys(fams).length;
  }

  function recordStageTurn(g, plan, stage, bySkip) {
    var undone = (plan && plan.undone) || [];
    var titles = [];
    for (var i = 0; i < undone.length; i++) titles.push(undone[i].title || undone[i].event || '那条线');
    g.stageTurnLog = g.stageTurnLog || [];
    g.stageTurnLog.push({
      stage: stage,
      turns: num0(plan && plan.played),
      budget: num0(plan && plan.budget),
      baseBudget: num0(plan && plan.baseBudget),
      startAge: num0(plan && plan.startAge),
      endAge: num0(plan && plan.endAge),
      atAge: num0(g.age),
      chainsOpened: chainsOpenedIn(g, num0(plan && plan.startAge), num0(plan && plan.endAge), undone),
      undone: titles,
      skip: !!bySkip
    });
  }

  function regretSentence(g) {
    var sk = (g && g.stageSkips) || [];
    var bits = [];
    for (var i = 0; i < sk.length; i++) {
      var rec = sk[i];
      var u = (rec.undone && rec.undone.length) ? rec.undone[0] : null;
      bits.push('那一年你走了，话没说完：' +
        (u ? '和「' + (u.title || u.event || '那条线') + '」的那条线停在 ' + num0(rec.age) + ' 岁'
          : '有些名字没等到下文'));
    }
    if (!sk.length) {
      var un = unresolvedChainList(g);
      if (un.length) bits.push('到最后，有些话还是没说完：「' + (un[0].title || un[0].event) + '」停在半路');
    }
    return bits.length ? bits.slice(0, 2).join('；') + '。' : '';
  }

  function advance(g) {
    if (g.death.dead) return { dead: true, reason: g.death.reason };

    /* v3.8：结局包的服刑线——选择时已推进 years-1 年，这里补齐最后一年，
       保证 sentence.years 真实推进年龄；出狱回合由 selectEvent 里的 V38.due 优先返回 release */
    var v38P = g.v38 && g.v38.prison;
    if (v38P && v38P.active && v38P.pendingRelease &&
        num0(g.age) < num0(v38P.releaseAge) &&
        g.v38JailDone !== v38P.releaseAge) {
      g.v38JailDone = v38P.releaseAge;
      g.current = null;
      g.currentId = null;
      g.turn += 1;
      g.age += 1;
      g.year += 1;
      g.half = 'H1';
      g.stage = LS.stageOf(g.age);
      if (LS.snapshot) LS.snapshot(g);
      return { dead: false, jailed: true, released: true };
    }

    /* v3.8：每回合先让结局包判定（早终 / 服刑），数据由 endings_v38.js 注册 */
    if (LS.ENDGAME && LS.ENDGAME.due && !g.jailHold) {
      var endInfo = null;
      try {
        endInfo = LS.ENDGAME.due({ game: g, age: g.age, year: g.year, stage: g.stage });
      } catch (err) { endInfo = null; }
      if (endInfo && endInfo.jailYears) {
        LS.ENDGAME.sentence(g, endInfo.jailYears, endInfo);
        return { jailed: true, years: endInfo.jailYears };
      }
      if (endInfo && (endInfo.cause || endInfo.kind === 'early')) {
        var endSum = LS.ENDGAME.finish(g, endInfo);
        return { dead: true, early: true, reason: endSum.reason };
      }
    }

    /* 服刑期：一年一回合推进，出狱后恢复 */
    if (g.flags && g.flags.jailed) {
      g.jailHold = true;
      g.current = null;
      g.currentId = null;
      if (g.year >= (g.jailUntilYear || g.year)) {
        g.flags.jailed = false;
        g.jailHold = false;
        if (LS.addMemory) LS.addMemory(g, (g.jailYears || 1) + ' 年刑期结束，你从大门走出来。', 'jail');
        return { dead: false, released: true };
      }
      g.turn += 1;
      g.age += 1;
      g.year += 1;
      g.half = 'H1';
      return { dead: false, jailed: true };
    }
    /* v3.7 P4.0：时代锚点年份若已被同龄强制事件占用，当年追加一回合，让锚点独立成事件 */
    if (LS.V36 && LS.V36.eraDue && LS.V36.eraDue(g) && !g.eraPending &&
        !(g.current && String(g.current.id).indexOf('v36_era_') === 0) &&
        !g.pendingStage && !g.pendingSummary) {
      g.eraHold = true;
      g.eraPending = true;
      g.turn += 1;
      g.current = null;
      g.currentId = null;
      return { dead: false, eraHold: true };
    }
    g.eraHold = false;
    g.eraPending = false;
    /* v3.7：分流点被同年死亡等强制事件挤占时，当年追加一回合补上，避免整段路径丢失 */
    if (LS.V37 && LS.V37.FORK_AGE && LS.EVENT_INDEX) {
      var dueForkId = LS.V37.FORK_AGE[g.age];
      /* v3.10：在职时 22/25 的毕业去向已被 dueFork 主动跳过（fork_skipped_employed）。
         此时不能再为它空转追加回合，否则年龄永远停在 22/25，职业 order 序列全部卡死、
         缓冲事件被无限重复。只有 dueFork 真能给出事件时才补回合。 */
      var forkPending = false;
      if (dueForkId && LS.V37.dueFork) {
        try { forkPending = !!LS.V37.dueFork(g); } catch (errFork) { forkPending = false; }
      }
      if (dueForkId && LS.EVENT_INDEX[dueForkId] && forkPending &&
          !(g.fired && g.fired.indexOf(dueForkId) >= 0) &&
          !(g.current && g.current.id === dueForkId) &&
          !g.pendingStage && !g.pendingSummary) {
        g.forkHold = true;
        g.turn += 1;
        g.current = null;
        g.currentId = null;
        return { dead: false, forkHold: true };
      }
    }
    g.forkHold = false;
    /* v3.7：中年 H1 → H2 只加回合，不加年龄/年份，不跑年度 tick */
    if (LS.V37 && LS.V37.isDouble(g.age) && LS.V37.halfOf(g) === 'H1') {
      g.turn += 1;
      g.half = 'H2';
      return { dead: false, half: true };
    }
    if (g.turn >= MAX_TURNS || g.age >= 110) {
      finish(g, '自然寿终');
      return { dead: true, reason: g.death.reason };
    }
    var fromStage = g.stage;
    /* v3.9：阶段内按预算走回合，年龄在两回合之间均匀推进 */
    var plan = ensureStagePlan(g);
    plan.played = num0(plan.played) + 1;
    /* 中途新开的链会把预算往上抬，最多 12 回合 */
    var want = Math.min(STAGE_TURN_RULE.max, num0(plan.baseBudget) + chainBonusOf(g));
    if (want > plan.budget) {
      plan.budget = want;
      plan.ages = plan.ages.slice(0, plan.played)
        .concat(buildAgeList(g, plan.stage, plan.lastAge, plan.endAge, plan.budget - plan.played, false));
    }
    var endStage = plan.played >= plan.budget;
    var target = endStage ? (plan.endAge + 1) : plan.ages[plan.played];
    if (target === undefined || target === null || target < g.age) target = plan.endAge;
    if (target <= g.age) {
      g.turn += 1; /* 同一年里的追加回合 */
    } else {
      jumpYears(g, target - g.age);
    }
    plan.lastAge = g.age;
    var toStage = LS.stageOf(g.age);
    g.stage = toStage;

    var reason = deathReason(g);
    if (reason) {
      finish(g, reason);
      return { dead: true, reason: reason };
    }
    /* 晚年以寿数为终点，走满预算即自然收束 */
    if (endStage && toStage === fromStage) {
      finish(g, '自然寿终');
      return { dead: true, reason: g.death.reason };
    }

    /* v3：阶段跨越——先落“长期影响”，再生成总结卡，最后才排过场 */
    if (toStage !== fromStage) {
      LS.pushEventLog(g, {
        turn: g.turn, age: g.age, year: g.year, stage: toStage, tier: 'sys',
        eventId: 'sys_stage_' + (LS.stageKeyOf(g.age) || g.age), title: '进入' + toStage,
        source: 'sys', resultText: '这一年的门槛：' + toStage
      });
      var impacts = writeStageImpact(g, fromStage);
      g.stageSummary = buildStageSummary(g, fromStage, toStage, impacts);
      g.pendingSummary = true;
      /* v3.7：阶段总结与年终小结同年撞车时合并，避免同回合两张卡 */
      if (g.pendingYearSummary) {
        g.stageSummary.yearSummary = g.pendingYearSummary;
        g.pendingYearSummary = null;
      }
      g.stageStart = LS.stageSnapshot(g);
      g.lastSummaryAt = g.age;
      recordStageTurn(g, plan, fromStage, false);
      makeStagePlan(g, toStage);
      var reason2 = deathReason(g);
      if (reason2) {
        finish(g, reason2);
        return { dead: true, reason: reason2 };
      }
    }

    /* 阶段过场：每个阶段只触发一次 */
    var sk = LS.stageKeyOf(g.age);
    if (sk && !(g.stageSeen || {})[sk]) {
      g.pendingStage = sk;
    }
    /* v3.7：跨年结束，回到 H1，清空年度账本并刷新年度起点快照 */
    g.half = 'H1';
    g.halfLedger = [];
    g.pendingConsequence = null;
    if (LS.V37 && LS.V37.snapYear) g.yearStartSnap = LS.V37.snapYear(g);
    return { dead: false };
  }

  function resolve(g, index) {
    var r = choose(g, index);
    if (!r.ok) return r;
    if (r.dead) return { ok: true, dead: true, summary: g.summary, outcome: r.outcome, changes: r.changes, event: null };

    /* v3.7：中年下半年结算——先出后果卡，再出年终小结，最后才跨年 */
    if (LS.V37 && LS.V37.isDouble(g.age) && LS.V37.halfOf(g) === 'H2') {
      var ledger = LS.V37.ledgerForYear(g);
      if (ledger) {
        g.pendingConsequence = ledger;
        g.blockedTurn = g.turn;
        return {
          ok: true, dead: false, outcome: r.outcome, changes: r.changes,
          paused: 'consequence', consequence: LS.V37.consequenceOf(g, ledger), type: 'forced', event: null
        };
      }
      var ys = LS.V37.buildYearSummary(g);
      if (ys) {
        g.pendingYearSummary = ys;
        g.blockedTurn = g.turn;
        return {
          ok: true, dead: false, outcome: r.outcome, changes: r.changes,
          paused: 'yearEnd', yearSummary: ys, event: null
        };
      }
    }

    var a = advance(g);
    if (a.dead) return { ok: true, dead: true, summary: g.summary, outcome: r.outcome, changes: r.changes, event: null };

    /* v3.2 暂停优先级：死亡 → 阶段过场（内嵌阶段总结）→ 播报 → 下一事件；每回合最多 1 个阻断 */
    if (g.pendingStage) {
      g.blockedTurn = g.turn;
      return { ok: true, dead: false, outcome: r.outcome, changes: r.changes, paused: 'stage', stage: g.pendingStage, summary: g.stageSummary, event: null };
    }
    if (g.pendingSummary) {
      g.pendingSummary = false;
      g.blockedTurn = g.turn;
      return { ok: true, dead: false, outcome: r.outcome, changes: r.changes, paused: 'summary', summary: g.stageSummary, event: null };
    }
    var b = (g.blockedTurn === g.turn) ? null : pickBroadcast(g);
    if (b) {
      g.blockedTurn = g.turn;
      return { ok: true, dead: false, outcome: r.outcome, changes: r.changes, paused: 'broadcast', broadcast: b, event: null };
    }
    var e = nextEvent(g);
    if (g.death.dead) {
      return { ok: true, dead: true, summary: g.summary, outcome: r.outcome, changes: r.changes, event: null };
    }
    if (g.pendingStage) {
      g.blockedTurn = g.turn;
      return { ok: true, dead: false, outcome: r.outcome, changes: r.changes, paused: 'stage', stage: g.pendingStage, summary: g.stageSummary, event: null };
    }
    if (g.pendingSummary) g.pendingSummary = false;
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

    /* v3.7：下半年的后果卡确认后，再出该年的年终小结 */
    if (kind === 'consequence' || (!kind && g.pendingConsequence)) {
      g.pendingConsequence = null;
      g.halfLedger = [];
      if (LS.V37 && LS.V37.isDouble(g.age) && LS.V37.halfOf(g) === 'H2') {
        var ys = LS.V37.buildYearSummary(g);
        if (ys) {
          g.pendingYearSummary = ys;
          g.blockedTurn = g.turn;
          return { ok: true, dead: false, paused: 'yearEnd', yearSummary: ys, event: null };
        }
      }
    }

    /* v3.7：年终小结确认后才跨年（H2 不提前加年龄/年份） */
    if (kind === 'yearEnd' || (!kind && g.pendingYearSummary)) {
      g.pendingYearSummary = null;
      g.halfLedger = [];
      var ay = advance(g);
      if (ay.dead) return { ok: true, dead: true, summary: g.summary, event: null };
      if (g.pendingStage) {
        g.blockedTurn = g.turn;
        return { ok: true, dead: false, paused: 'stage', stage: g.pendingStage, summary: g.stageSummary, event: null };
      }
      if (g.pendingSummary) {
        g.pendingSummary = false;
        g.blockedTurn = g.turn;
        return { ok: true, dead: false, paused: 'summary', summary: g.stageSummary, event: null };
      }
      var yb = (g.blockedTurn === g.turn) ? null : pickBroadcast(g);
      if (yb) {
        g.blockedTurn = g.turn;
        return { ok: true, dead: false, paused: 'broadcast', broadcast: yb, event: null };
      }
      var ye = nextEvent(g);
      if (g.death.dead) return { ok: true, dead: true, summary: g.summary, event: null };
      if (g.pendingStage) {
        g.blockedTurn = g.turn;
        return { ok: true, dead: false, paused: 'stage', stage: g.pendingStage, summary: g.stageSummary, event: null };
      }
      if (g.pendingSummary) g.pendingSummary = false;
      return { ok: true, dead: false, event: ye };
    }

    if (kind === 'summary' || (!kind && g.pendingSummary)) {
      g.pendingSummary = false;
      if (g.pendingStage) consumeStage(g);
      g.pendingSummary = false;
    }
    if (kind === 'stage' || (!kind && g.pendingStage)) {
      consumeStage(g);
      g.pendingSummary = false;
    }
    var b = (g.blockedTurn === g.turn) ? null : pickBroadcast(g);
    if (b) {
      g.blockedTurn = g.turn;
      return { ok: true, dead: false, paused: 'broadcast', broadcast: b, event: null };
    }
    var e = nextEvent(g);
    if (g.death.dead) return { ok: true, dead: true, summary: g.summary, event: null };
    if (g.pendingStage) {
      g.blockedTurn = g.turn;
      return { ok: true, dead: false, paused: 'stage', stage: g.pendingStage, summary: g.stageSummary, event: null };
    }
    if (g.pendingSummary) g.pendingSummary = false;
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
    /* v3.9：进入第一个阶段前先排好回合预算与年龄阶梯 */
    makeStagePlan(g, g.stage);
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

  /* =========================================================
     v3.8 早终（ENDGAME）：引擎只负责收口，结局数据由 js/endings_v38.js 注册
     ========================================================= */
  LS.ENDGAME = LS.ENDGAME || {};

  LS.ENDGAME.finish = function (g, info) {
    info = info || {};
    if (info.kind !== 'natural') info.kind = 'early';
    return finish(g, info.cause || g.death.reason, info);
  };

  /* 服刑：不是终点，按年推进，出狱后继续 */
  LS.ENDGAME.sentence = function (g, years, info) {
    years = Math.max(1, Math.round(years || 2));
    g.flags = g.flags || {};
    g.flags.jailed = true;
    g.jailYears = years;
    g.jailUntilYear = g.year + years;
    if (LS.addMemory) LS.addMemory(g, (info && info.scene) || ('你被带走，判了 ' + years + ' 年。'), 'jail');
    return { jailed: true, years: years, untilYear: g.jailUntilYear };
  };

  /* v3.9：跳过本阶段——立即收尾，未走完的链计入总结与结局信 */
  function skipStage(g) {
    if (!g || g.death.dead) return { ok: false, error: '这一生已经结束。' };
    if (!g.stagePlan || g.stagePlan.stage !== g.stage) makeStagePlan(g, g.stage);
    var plan = g.stagePlan;
    var fromStage = plan.stage;
    var undone = unresolvedChainList(g);
    var turns = num0(plan.played);
    plan.skipped = true;
    plan.undone = undone;
    plan.skippedAtAge = g.age;

    g.stageSkips = g.stageSkips || [];
    g.stageSkips.push({
      stage: fromStage, age: num0(g.age), turns: turns, budget: num0(plan.budget),
      undone: undone.map(function (u) { return { event: u.event, title: u.title, dueAge: u.dueAge }; })
    });
    g.skippedChains = g.skippedChains || [];
    for (var i = 0; i < undone.length; i++) {
      g.skippedChains.push({
        stage: fromStage, age: num0(g.age), event: undone[i].event,
        title: undone[i].title, family: undone[i].family, dueAge: undone[i].dueAge
      });
    }

    /* 提前离开，没等到下文的链不再在后面的阶段里冒出来 */
    var kill = chainPendingItems(g);
    if (kill.length) {
      var drop = [];
      for (var k = 0; k < kill.length; k++) drop.push(kill[k].item);
      g.pending = (g.pending || []).filter(function (it) { return drop.indexOf(it) < 0; });
    }

    /* 时间照常走到阶段终点，再跨进下一阶段 */
    var target = plan.endAge + 1;
    if (target > g.age) jumpYears(g, target - g.age);
    g.stage = LS.stageOf(g.age);

    var impacts = writeStageImpact(g, fromStage);
    g.stageSummary = buildStageSummary(g, fromStage, fromStage, impacts);
    g.stageSummary.skip = true;
    g.stageSummary.flex.endAge = plan.endAge;
    g.pendingSummary = true;
    g.lastSummaryAt = g.age;
    g.stageStart = LS.stageSnapshot(g);
    recordStageTurn(g, plan, fromStage, true);

    g.half = 'H1';
    g.halfLedger = [];
    g.pendingConsequence = null;
    if (LS.V37 && LS.V37.snapYear) g.yearStartSnap = LS.V37.snapYear(g);
    var sk = LS.stageKeyOf(g.age);
    if (sk && !(g.stageSeen || {})[sk]) g.pendingStage = sk;

    var reason = deathReason(g);
    if (reason) {
      finish(g, reason);
      return { ok: true, dead: true, turns: turns, undone: undone, summary: g.summary };
    }
    makeStagePlan(g, g.stage);
    var reason2 = deathReason(g);
    if (reason2) {
      finish(g, reason2);
      return { ok: true, dead: true, turns: turns, undone: undone, summary: g.summary };
    }
    return { ok: true, turns: turns, undone: undone, summary: g.stageSummary };
  }

  function letterWithRegret(g, letter) {
    var txt = regretSentence(g);
    if (!txt) return letter;
    if (letter && Array.isArray(letter.paragraphs)) letter.paragraphs.push(txt);
    else if (letter) letter.regret = txt;
    return letter;
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
    hasKeyEvent: hasKeyEvent,
    quietStep: quietStep,
    epitaphOf: epitaphOf,
    radarOf: radarOf,
    tagComboOf: tagComboOf,
    optCondOk: optCondOk,
    layerOf: layerOf,
    PACE: PACE,
    /* v3.9 弹性阶段制 */
    skipStage: skipStage,
    letterWithRegret: letterWithRegret,
    regretText: regretSentence,
    stagePlanOf: function (g) { return (g && g.stagePlan) || null; },
    unresolvedChains: unresolvedChainList,
    stageEndAgeOf: stageEndAgeOf
  };
  LS.PACE = PACE;

})();

