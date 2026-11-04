/* =========================================================
   state.js — 常量、角色生成、派生计算、成就定义
   ========================================================= */
(function () {
  'use strict';
  var LS = window.LS = window.LS || {};

  LS.VERSION = '3.3.0';
  LS.START_YEAR = 2005;
  LS.FREE_POINTS = 30;
  LS.SAVE_PREFIX = 'lifesim_v1_';
  LS.SLOT_COUNT = 5;

  /* ---------------- v3 跨局数据（localStorage 不可用时降级到模块内存） ---------------- */
  LS.LEGACY_KEY = 'lifesim_legacy_v3';
  LS.ACH_KEY = 'lifesim_ach_v3';
  LS.EVENT_CD_KEY = 'lifesim_eventcd_v3';

  var v3Mem = {};
  function v3get(key) {
    var txt = null;
    try {
      if (window.localStorage) txt = window.localStorage.getItem(key);
    } catch (e) { /* 隐私模式 / file:// 下可能被禁用 */ }
    if (!txt) txt = v3Mem[key] || null;
    if (!txt) return null;
    try { return JSON.parse(txt); } catch (e) { return null; }
  }
  function v3set(key, obj) {
    var txt;
    try { txt = JSON.stringify(obj || {}); } catch (e) { txt = '{}'; }
    try {
      if (window.localStorage) { window.localStorage.setItem(key, txt); return; }
    } catch (e) { /* 写入失败时降级到内存 */ }
    v3Mem[key] = txt;
  }

  LS.legacyRead = function () {
    var o = v3get(LS.LEGACY_KEY) || {};
    return {
      reputation: Number(o.reputation) || 0,
      cash: Number(o.cash) || 0,
      source: o.source === undefined ? null : o.source,
      runs: Number(o.runs) || 0
    };
  };
  LS.legacyWrite = function (o) {
    o = o || {};
    v3set(LS.LEGACY_KEY, {
      reputation: Number(o.reputation) || 0,
      cash: Number(o.cash) || 0,
      source: o.source === undefined ? null : o.source,
      runs: Number(o.runs) || 0
    });
  };
  LS.achRead = function () {
    var o = v3get(LS.ACH_KEY) || {};
    return {
      ids: Array.isArray(o.ids) ? o.ids : [],
      endings: Array.isArray(o.endings) ? o.endings : [],
      eggs: Array.isArray(o.eggs) ? o.eggs : []
    };
  };
  LS.achWrite = function (o) {
    o = o || {};
    v3set(LS.ACH_KEY, {
      ids: Array.isArray(o.ids) ? o.ids : [],
      endings: Array.isArray(o.endings) ? o.endings : [],
      eggs: Array.isArray(o.eggs) ? o.eggs : []
    });
  };
  LS.eventCDRead = function () {
    var o = v3get(LS.EVENT_CD_KEY);
    return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {};
  };
  LS.eventCDWrite = function (o) { v3set(LS.EVENT_CD_KEY, o || {}); };

  /* ---------------- 随机数：可存档的 mulberry32 ---------------- */
  LS.RNG = {
    state: 1,
    reset: function (seed) {
      this.state = (seed >>> 0) || 1;
    },
    next: function () {
      var a = this.state = (this.state + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
  };
  LS.rand = function () { return LS.RNG.next(); };
  LS.randInt = function (min, max) { return min + Math.floor(LS.rand() * (max - min + 1)); };
  LS.pick = function (arr) { return arr[Math.floor(LS.rand() * arr.length)]; };
  LS.chance = function (p) { return LS.rand() < p; };
  LS.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  LS.round1 = function (v) { return Math.round(v * 10) / 10; };
  LS.sum = function (arr) { return arr.reduce(function (a, b) { return a + b; }, 0); };

  /* ---------------- 阶段 ---------------- */
  LS.STAGES = ['婴幼儿', '童年', '少年', '青年', '中年', '中老年', '晚年'];
  LS.stageOf = function (age) {
    if (age <= 3) return '婴幼儿';
    if (age <= 12) return '童年';
    if (age <= 18) return '少年';
    if (age <= 30) return '青年';
    if (age <= 55) return '中年';
    if (age <= 75) return '中老年';
    return '晚年';
  };
  LS.stageRange = function (stage) {
    var map = {
      '婴幼儿': [0, 3], '童年': [4, 12], '少年': [13, 18], '青年': [19, 30],
      '中年': [31, 55], '中老年': [56, 75], '晚年': [76, 120]
    };
    return map[stage] || [0, 120];
  };

  /* ---------------- 教育 ---------------- */
  /* 事件三档：daily 普通日常 / echo 因果回响 / crossroad 命运岔路 */
  LS.TIERS = {
    daily: { key: 'daily', label: '日常', cls: 'tier-daily', icon: '·', art: false },
    echo: { key: 'echo', label: '因果回响', cls: 'tier-echo', icon: '↻', art: true },
    crossroad: { key: 'crossroad', label: '命运岔路', cls: 'tier-crossroad', icon: '⑂', art: true }
  };
  LS.tierOf = function (e) { return LS.TIERS[e && e.tier] || LS.TIERS.daily; };

  /* v3 阶段命名：状态栏显示七个阶段真名，不再把“中老年”显示成“老年” */
  LS.stageLabel = function (s) { return s; };

  /* 人生阶段过场：0 婴幼儿 / 4 童年 / 13 少年 / 19 青年 / 31 中年 / 56 中老年 / 76 晚年 */
  LS.STAGE_MARKS = [
    { age: 0, key: 'infant', label: '婴幼儿', title: '婴幼儿：最初的几年',
      desc: '你还不会说话，世界由气味、光线和一双双抱你的手组成。你学会走路之前，先学会了被照顾。',
      art: 'infant' },
    { age: 4, key: 'child', label: '童年', title: '童年：世界还很新鲜',
      desc: '上学、放学、被叫家长，日子在一条固定路线里重复。你开始记住一些大人的表情，却还说不清那是什么意思。',
      art: 'child' },
    { age: 13, key: 'teen', label: '少年', title: '少年：开始有了心事',
      desc: '身体先于想法变化，你开始在意别人的目光。成绩单、走廊里的笑声和没说出口的话，一起堆积起来。',
      art: 'teen' },
    { age: 19, key: 'youth', label: '青年', title: '青年：世界刚刚展开',
      desc: '你终于要为一些事自己拿主意了。世界比想象大，也比想象贵，而时间第一次显得不够用。',
      art: 'youth' },
    { age: 31, key: 'midlife', label: '中年', title: '中年：责任逐渐沉重',
      desc: '账单、家人与身体同时伸手。你开始学会在很多事情上低头，也开始分清哪些东西不能丢。',
      art: 'midlife' },
    { age: 56, key: 'elder', label: '中老年', title: '老年：岁月开始沉淀',
      desc: '你不再那么急着证明什么。旧朋友渐渐少，慢下来的日子里，能记清的事反而更少。',
      art: 'elder' },
    { age: 76, key: 'late', label: '晚年', title: '晚年：日子慢了下来',
      desc: '同龄人一个个变少，日历翻得比记忆快。你把常走的那条路走得很慢，遇到熟人要停下来想一想名字。',
      art: 'late' }
  ];
  LS.stageKeyOf = function (age) {
    for (var i = 0; i < LS.STAGE_MARKS.length; i++) {
      if (LS.STAGE_MARKS[i].age === age) return LS.STAGE_MARKS[i].key;
    }
    return null;
  };
  LS.stageMark = function (key) {
    for (var i = 0; i < LS.STAGE_MARKS.length; i++) {
      if (LS.STAGE_MARKS[i].key === key) return LS.STAGE_MARKS[i];
    }
    return null;
  };
  /* 阶段序号（1..7），与状态栏七格对应 */
  LS.stageIndexOf = function (age) {
    return LS.STAGES.indexOf(LS.stageOf(age)) + 1;
  };
  /* 按阶段名找过场配置，用于总结卡标题 */
  LS.stageMarkByStage = function (stage) {
    for (var i = 0; i < LS.STAGE_MARKS.length; i++) {
      if (LS.STAGE_MARKS[i].label === stage) return LS.STAGE_MARKS[i];
    }
    return null;
  };

  /* ---------------- NPC 关系档位（亲密度 + 人情账 + 锚点） ---------------- */
  LS.RELATION_STAGES = ['陌生', '相识', '熟络', '亲近', '至亲', '疏远', '决裂'];
  LS.CIRCLES = ['亲属圈', '同学圈', '发小圈', '同事圈', '行业圈', '兴趣圈'];
  LS.circleOf = function (role) {
    var r = String(role || '');
    if (/父|母|爸|妈|哥|姐|弟|妹|子|女|配偶|爱人|妻|夫|舅|姨|叔|伯/.test(r)) return '亲属圈';
    if (/上司|老板|同事|下属/.test(r)) return '同事圈';
    if (/发小/.test(r)) return '发小圈';
    if (/同学/.test(r)) return '同学圈';
    if (/客户|合作|同行|导师|恩人|仇人/.test(r)) return '行业圈';
    if (/朋友|球友|牌友|书友|邻居/.test(r)) return '兴趣圈';
    return '兴趣圈';
  };
  /* 档位：决裂/疏远优先；否则由亲密度决定，人情账只做微调 */
  LS.relationOf = function (npcOrIntimacy, favor, prev) {
    var n = (npcOrIntimacy && typeof npcOrIntimacy === 'object') ? npcOrIntimacy : null;
    var v = n ? Number(n.intimacy) : Number(npcOrIntimacy);
    var f = n ? Number(n.favor) : Number(favor);
    if (isNaN(v)) v = 50;
    if (isNaN(f)) f = 0;
    var p = (n && n.relation) || prev || '陌生';
    var betray = !!(n && n.anchors && n.anchors.some(function (a) { return a && /背叛|决裂|举报|坑/.test(a.kind || ''); }));
    if (betray || v <= 8 || f <= -5) return '决裂';
    if (v < 30 || f <= -3) return '疏远';
    if (v >= 88) return '至亲';
    if (v >= 74) return '亲近';
    if (v >= 58) return '熟络';
    if (v >= 38) return '相识';
    if (p === '至亲' && v >= 70) return '至亲';
    return '陌生';
  };
  LS.relationStageOf = function (value, prev) {
    /* 兼容旧调用：旧代码传 0-100 的 favor 值 */
    return LS.relationOf(Number(value), 0, prev);
  };
  LS.circleRep = function (g, circle, delta) {
    if (!g) return 50;
    g.circles = g.circles || {};
    var c = g.circles[circle] || (g.circles[circle] = { rep: 50 });
    if (delta !== undefined) c.rep = LS.clamp((Number(c.rep) || 50) + Number(delta || 0), 0, 100);
    return LS.clamp(Number(c.rep) || 50, 0, 100);
  };

  /* 隐性健康隐患 */
  LS.RISK_KEYS = ['lateNight', 'highStress', 'noExercise', 'badDiet'];
  LS.RISK_LABEL = {
    lateNight: '长期熬夜', highStress: '长期高压', noExercise: '缺乏运动', badDiet: '饮食失衡'
  };

  LS.EDU = ['未入学', '小学', '初中', '高中/中职', '专科', '本科', '硕士', '博士'];
  LS.eduName = function (n) { return LS.EDU[LS.clamp(n, 0, LS.EDU.length - 1)]; };

  /* ---------------- 出生地 ---------------- */
  LS.BIRTHPLACES = {
    '农村': {
      label: '农村',
      desc: '村庄或乡镇，熟人社会，教育资源薄，人情往来密。',
      cashMul: 0.45, assetMul: 0.35,
      mods: { knowledge: -5, health: 3, charm: -2, finance: -4, happiness: 1, reputation: -3 },
      living: 9000, eduWeight: 0.45, stress: 0
    },
    '小城': {
      label: '小城',
      desc: '地级市或县城，生活成本低，机会有限但稳定。',
      cashMul: 0.8, assetMul: 0.7,
      mods: { knowledge: 0, health: 0, charm: 0, finance: 0, happiness: 0, reputation: 0 },
      living: 15000, eduWeight: 0.65, stress: 0
    },
    '二线城市': {
      label: '二线城市',
      desc: '省会或强地级市，有像样的大学与产业，房价不低。',
      cashMul: 1.15, assetMul: 1.15,
      mods: { knowledge: 3, health: 0, charm: 2, finance: 2, happiness: 0, reputation: 2 },
      living: 24000, eduWeight: 0.85, stress: 1
    },
    '一线城市': {
      label: '一线城市',
      desc: '北上广深，眼界与资源最集中，竞争和房价也最狠。',
      cashMul: 1.45, assetMul: 1.6,
      mods: { knowledge: 6, health: -1, charm: 4, finance: 3, happiness: -1, reputation: 5 },
      living: 42000, eduWeight: 1.0, stress: 5
    },
    '海外小城': {
      label: '海外小城',
      desc: '华人聚居的海外小城，语言与身份是另一道门槛。',
      cashMul: 1.2, assetMul: 1.1,
      mods: { knowledge: 5, health: 1, charm: 4, finance: 1, happiness: 0, reputation: 4 },
      living: 38000, eduWeight: 0.9, stress: 3
    }
  };

  /* ---------------- 家庭背景 ---------------- */
  LS.BACKGROUNDS = {
    '贫困': {
      label: '贫困',
      desc: '父母打零工或务农，家里几乎没有积蓄，一场病就能击穿。',
      cash: 2000, assets: 5000, fatherFavor: 52, motherFavor: 60,
      parentHealth: -8, eduBonus: -0.15, stress: 6,
      base: { knowledge: 38, health: 57, finance: 22, charm: 44, happiness: 48, reputation: 18 }
    },
    '普通工薪': {
      label: '普通工薪',
      desc: '父母在厂里或单位上班，有房贷，日子过得紧但稳定。',
      cash: 16000, assets: 70000, fatherFavor: 65, motherFavor: 70,
      parentHealth: 0, eduBonus: 0, stress: 2,
      base: { knowledge: 49, health: 62, finance: 38, charm: 50, happiness: 57, reputation: 30 }
    },
    '中产': {
      label: '中产',
      desc: '父母有稳定职业和一套房，重视教育，也背着自己的房贷。',
      cash: 65000, assets: 330000, fatherFavor: 72, motherFavor: 75,
      parentHealth: 3, eduBonus: 0.12, stress: 0,
      base: { knowledge: 58, health: 65, finance: 52, charm: 55, happiness: 62, reputation: 41 }
    },
    '富裕': {
      label: '富裕',
      desc: '家里有产业或多套房产，资源充足，但期待与规矩也更多。',
      cash: 320000, assets: 1600000, fatherFavor: 74, motherFavor: 76,
      parentHealth: 5, eduBonus: 0.22, stress: -2,
      base: { knowledge: 64, health: 66, finance: 67, charm: 59, happiness: 66, reputation: 55 }
    }
  };

  /* ---------------- 天赋（≥8，含正向与双面） ---------------- */
  LS.TALENTS = [
    {
      id: 'memory', name: '过目不忘', tag: '学习',
      desc: '记性好，读书省力。代价是更容易被“你应该更优秀”绑架。',
      mods: { knowledge: 10, happiness: -1 },
      eduBonus: 0.14, stress: 2
    },
    {
      id: 'sickly', name: '体弱多病', tag: '双面',
      desc: '从小跑医院，身体底子薄；但对人情冷暖更敏感。',
      mods: { health: -14, happiness: 2, charm: 2 },
      healthMul: 1.25, medEvents: 1
    },
    {
      id: 'social', name: '社交达人', tag: '关系',
      desc: '自来熟，饭桌上能把陌生人变成熟人。',
      mods: { charm: 9, happiness: 2 },
      favorGain: 1.45, stress: -1
    },
    {
      id: 'lucky', name: '幸运儿', tag: '运气',
      desc: '大事未必顺，小事常能躲过去。',
      mods: { happiness: 3 },
      luck: 0.08
    },
    {
      id: 'ambitious', name: '野心勃勃', tag: '双面',
      desc: '你很难接受“就这样吧”，但焦虑也跟着你。',
      mods: { finance: 5, happiness: -2 },
      incomeMul: 1.1, stress: 7
    },
    {
      id: 'beauty', name: '天生丽质', tag: '外貌',
      desc: '外貌带来善意，也带来不必要的麻烦。',
      mods: { charm: 12, happiness: 1 },
      favorGain: 1.12
    },
    {
      id: 'steady', name: '心大手稳', tag: '双面',
      desc: '不太容易慌，也不太容易兴奋。',
      mods: { health: 3, happiness: 1 },
      stress: -8, healthMul: 0.94
    },
    {
      id: 'hardbone', name: '命硬', tag: '体质',
      desc: '别人扛不过去的，你往往能扛过去。',
      mods: { health: 5 },
      healthMul: 0.86, deathMul: 0.85
    },
    {
      id: 'math', name: '数理脑袋', tag: '学习',
      desc: '对数字和结构天然敏感，适合技术路线。',
      mods: { knowledge: 8, finance: 4 },
      eduBonus: 0.08
    },
    {
      id: 'art', name: '艺术细胞', tag: '审美',
      desc: '对色彩、声音和情绪敏锐，但变现常常慢半拍。',
      mods: { charm: 6, happiness: 3, knowledge: 1 },
      artBonus: 0.2
    }
  ];

  /* ---------------- 职业 ---------------- */
  LS.JOBS = {
    civil: {
      name: '公务员', minEdu: 3, base: 78000, growth: 1.032,
      stress: 1.6, healthDrain: 0.35, repCap: { industry: 45, society: 86 },
      path: ['科员', '副科长', '科长', '副处长', '处长'], rep: { school: 0.15, industry: 0.3, society: 0.9 }
    },
    engineer: {
      name: '工程师', minEdu: 4, base: 96000, growth: 1.04,
      stress: 3.2, healthDrain: 0.60, repCap: { industry: 88, society: 55 },
      path: ['助理工程师', '工程师', '高级工程师', '技术主管', '技术总监'], rep: { school: 0.2, industry: 0.85, society: 0.25 }
    },
    doctor: {
      name: '医生', minEdu: 5, base: 108000, growth: 1.035,
      stress: 4.0, healthDrain: 0.70, repCap: { industry: 90, society: 78 },
      path: ['住院医师', '主治医师', '副主任医师', '主任医师', '科室主任'], rep: { school: 0.3, industry: 0.9, society: 0.6 }
    },
    teacher: {
      name: '教师', minEdu: 4, base: 82000, growth: 1.03,
      stress: 2.8, healthDrain: 0.50, repCap: { industry: 72, society: 82 },
      path: ['新教师', '一级教师', '高级教师', '学科组长', '副校长'], rep: { school: 0.5, industry: 0.55, society: 0.75 }
    },
    stateowned: {
      name: '国企职员', minEdu: 4, base: 88000, growth: 1.028,
      stress: 1.8, healthDrain: 0.40, repCap: { industry: 60, society: 62 },
      path: ['职员', '主管', '部门副经理', '部门经理', '副总'], rep: { school: 0.2, industry: 0.5, society: 0.45 }
    },
    sales: {
      name: '销售', minEdu: 2, base: 68000, growth: 1.036,
      stress: 3.6, healthDrain: 0.70, repCap: { industry: 65, society: 50 },
      path: ['销售专员', '销售主管', '区域经理', '大区总监', '销售副总'], rep: { school: 0.1, industry: 0.55, society: 0.35 }
    },
    freelance: {
      name: '自由职业', minEdu: 3, base: 58000, growth: 1.045,
      stress: 2.4, healthDrain: 0.60, repCap: { industry: 75, society: 52 },
      path: ['接单新人', '小有名气', '稳定合作', '工作室主理人', '行业前辈'], rep: { school: 0.05, industry: 0.6, society: 0.4 }
    },
    startup: {
      name: '创业者', minEdu: 3, base: 30000, growth: 1.09,
      stress: 4.6, healthDrain: 1.10, repCap: { industry: 92, society: 70 },
      path: ['初创合伙人', '项目负责人', '公司老板', '多店经营', '行业人物'], rep: { school: 0.1, industry: 0.8, society: 0.55 }
    },
    gig: {
      name: '零工', minEdu: 1, base: 46000, growth: 1.02,
      stress: 3.2, healthDrain: 0.90, repCap: { industry: 30, society: 25 },
      path: ['日结零工', '固定临时工', '小包工头', '劳务队头', '小老板'], rep: { school: 0.02, industry: 0.2, society: 0.15 }
    },
    /* v3.2：路径分化新增岗位 */
    researcher: {
      name: '科研人员', minEdu: 5, base: 102000, growth: 1.035,
      stress: 3.0, healthDrain: 0.55, repCap: { industry: 92, society: 50 },
      path: ['科研助理', '助理研究员', '副研究员', '研究员', '首席科学家'], rep: { school: 0.6, industry: 0.9, society: 0.3 }
    },
    designer: {
      name: '设计师', minEdu: 3, base: 74000, growth: 1.045,
      stress: 2.8, healthDrain: 0.65, repCap: { industry: 78, society: 45 },
      path: ['设计助理', '设计师', '资深设计师', '设计主管', '创意总监'], rep: { school: 0.2, industry: 0.7, society: 0.3 }
    },
    media: {
      name: '传媒从业者', minEdu: 3, base: 70000, growth: 1.04,
      stress: 3.2, healthDrain: 0.60, repCap: { industry: 70, society: 62 },
      path: ['实习编辑', '记者/编辑', '资深编辑', '主编', '内容总监'], rep: { school: 0.3, industry: 0.65, society: 0.5 }
    },
    legal: {
      name: '法务', minEdu: 4, base: 92000, growth: 1.035,
      stress: 3.4, healthDrain: 0.55, repCap: { industry: 80, society: 65 },
      path: ['法务助理', '法务专员', '法务经理', '法务总监', '首席法务'], rep: { school: 0.4, industry: 0.75, society: 0.55 }
    },
    admin: {
      name: '行政', minEdu: 3, base: 66000, growth: 1.028,
      stress: 2.0, healthDrain: 0.35, repCap: { industry: 55, society: 58 },
      path: ['行政专员', '行政主管', '办公室主任', '行政经理', '行政总监'], rep: { school: 0.2, industry: 0.45, society: 0.55 }
    },
    coach: {
      name: '教练', minEdu: 2, base: 62000, growth: 1.03,
      stress: 2.2, healthDrain: 0.45, repCap: { industry: 55, society: 50 },
      path: ['助教', '青训教练', '主教练', '训练主管', '体育总监'], rep: { school: 0.1, industry: 0.5, society: 0.4 }
    },
    soldier: {
      name: '军人', minEdu: 2, base: 68000, growth: 1.025,
      stress: 3.0, healthDrain: 0.50, repCap: { industry: 45, society: 70 },
      path: ['战士', '班长', '排长', '连长', '营长'], rep: { school: 0.1, industry: 0.3, society: 0.75 }
    },
    security: {
      name: '安保', minEdu: 1, base: 48000, growth: 1.02,
      stress: 2.6, healthDrain: 0.60, repCap: { industry: 30, society: 30 },
      path: ['保安', '安保班长', '安保主管', '安保经理', '安保顾问'], rep: { school: 0.02, industry: 0.25, society: 0.2 }
    }
  };
  LS.jobName = function (id) { return id && LS.JOBS[id] ? LS.JOBS[id].name : '无固定职业'; };
  LS.jobTitle = function (id, level) {
    if (!id || !LS.JOBS[id]) return '待业';
    var j = LS.JOBS[id];
    return j.path[LS.clamp(level || 0, 0, j.path.length - 1)];
  };
  LS.jobSalary = function (id, level) {
    if (!id || !LS.JOBS[id]) return 0;
    var j = LS.JOBS[id];
    return Math.round(j.base * (0.78 + 0.22 * (level || 0)) / 100) * 100;
  };

  /* ---------------- 名字池 ---------------- */
  LS.SURNAMES = ['陈', '林', '王', '李', '张', '刘', '周', '吴', '徐', '孙', '马', '朱', '胡', '郭', '何', '高', '罗', '郑', '梁', '谢'];
  LS.GIVEN_M = ['立', '强', '伟', '磊', '军', '涛', '斌', '鹏', '宇', '浩', '晨', '峰', '健', '博', '宁', '川', '明', '诚', '航', '昇'];
  LS.GIVEN_F = ['静', '敏', '丽', '娟', '宁', '颖', '雪', '琳', '倩', '婷', '悦', '雯', '佳', '冉', '瑶', '悦', '菲', '澜', '澜', '昕'];
  LS.randomName = function (gender) {
    var s = LS.pick(LS.SURNAMES);
    var g = (gender === '女') ? LS.pick(LS.GIVEN_F) : LS.pick(LS.GIVEN_M);
    if (LS.chance(0.22)) g += (gender === '女') ? LS.pick(LS.GIVEN_F) : LS.pick(LS.GIVEN_M);
    return s + g;
  };
  LS.randomSpouseName = function (gender) {
    var target = (gender === '男') ? '女' : '男';
    return LS.randomName(target);
  };

  /* ---------------- 派生值 ---------------- */
  LS.repTotal = function (g) {
    var r = g.rep || { school: 0, industry: 0, society: 0 };
    return Math.round((r.school * 0.8 + r.industry * 1.15 + r.society * 1.35) / 3.3);
  };
  LS.netWorth = function (g) {
    return Math.round((g.money.cash || 0) + (g.money.assets || 0) - (g.money.debt || 0));
  };
  LS.fmtMoney = function (n) {
    n = Math.round(n || 0);
    var sign = n < 0 ? '-' : '';
    var a = Math.abs(n);
    if (a >= 100000000) return sign + (a / 100000000).toFixed(2) + ' 亿';
    if (a >= 10000) {
      var w = a / 10000;
      if (w >= 100) return sign + Math.round(w).toLocaleString('zh-CN') + ' 万';
      return sign + (Math.round(w * 10) / 10).toFixed(1) + ' 万';
    }
    return sign + a.toLocaleString('zh-CN');
  };
  LS.fmtDelta = function (n) {
    if (!n) return '';
    return (n > 0 ? '+' : '') + LS.fmtMoney(n);
  };
  LS.cityLiving = function (g) {
    var p = LS.BIRTHPLACES[g.birthplace] || LS.BIRTHPLACES['小城'];
    var inflation = Math.pow(1.024, Math.max(0, g.age - 18));
    return Math.round(p.living * inflation);
  };
  LS.hasTalent = function (g, id) { return !!(g.talents && g.talents.indexOf(id) >= 0); };
  LS.talent = function (id) {
    for (var i = 0; i < LS.TALENTS.length; i++) if (LS.TALENTS[i].id === id) return LS.TALENTS[i];
    return null;
  };
  LS.hasMark = function (g, id) { return !!(g.marks && g.marks[id]); };

  /* ---------------- 角色生成 ---------------- */
  LS.baseAttrs = function (birthplace, background, talents) {
    var b = LS.BACKGROUNDS[background] ? LS.BACKGROUNDS[background].base : LS.BACKGROUNDS['普通工薪'].base;
    var bp = LS.BIRTHPLACES[birthplace] || LS.BIRTHPLACES['小城'];
    var attrs = {
      knowledge: b.knowledge + (bp.mods.knowledge || 0),
      health: b.health + (bp.mods.health || 0),
      finance: b.finance + (bp.mods.finance || 0),
      charm: b.charm + (bp.mods.charm || 0),
      happiness: b.happiness + (bp.mods.happiness || 0),
      reputation: b.reputation + (bp.mods.reputation || 0)
    };
    (talents || []).forEach(function (id) {
      var t = LS.talent(id);
      if (!t || !t.mods) return;
      for (var k in t.mods) if (attrs[k] !== undefined) attrs[k] += t.mods[k];
    });
    for (var key in attrs) attrs[key] = LS.clamp(attrs[key], 1, 95);
    return attrs;
  };

  LS.createGame = function (cfg) {
    if (!cfg || !cfg.name) throw new Error('缺少角色姓名');
    var seed = cfg.seed || ((Date.now() % 2147483647) || 1);
    LS.RNG.reset(seed);

    var bg = LS.BACKGROUNDS[cfg.background] || LS.BACKGROUNDS['普通工薪'];
    var bp = LS.BIRTHPLACES[cfg.birthplace] || LS.BIRTHPLACES['小城'];
    var base = LS.baseAttrs(cfg.birthplace, cfg.background, cfg.talents);
    var finalAttrs = cfg.attrs || base;
    ['knowledge', 'health', 'finance', 'charm', 'happiness', 'reputation'].forEach(function (k) {
      var raw = finalAttrs[k];
      if (raw === undefined || isNaN(raw)) raw = (k === 'reputation') ? 30 : 50;
      finalAttrs[k] = LS.clamp(Math.round(raw), 1, 100);
    });

    var stress = 18 + (bp.stress || 0) + (bg.stress || 0);
    (cfg.talents || []).forEach(function (id) {
      var t = LS.talent(id);
      if (t && t.stress) stress += t.stress;
    });
    stress = LS.clamp(stress, 0, 100);

    var fatherAge = LS.randInt(27, 38);
    var motherAge = LS.randInt(25, 36);

    var g = {
      v: LS.VERSION,
      seed: seed,
      rngState: LS.RNG.state,
      birthYear: LS.START_YEAR,
      year: LS.START_YEAR,
      age: 0,
      stage: '婴幼儿',
      turn: 1,
      name: String(cfg.name).trim().slice(0, 12),
      gender: cfg.gender || '男',
      birthplace: cfg.birthplace || '小城',
      background: cfg.background || '普通工薪',
      talents: (cfg.talents || []).slice(0, 2),
      attrs: {
        knowledge: finalAttrs.knowledge,
        health: finalAttrs.health,
        finance: finalAttrs.finance,
        charm: finalAttrs.charm,
        happiness: finalAttrs.happiness,
        stress: stress
      },
      rep: {
        school: LS.clamp(finalAttrs.reputation, 0, 100),
        industry: LS.clamp(Math.round(finalAttrs.reputation * 0.75), 0, 100),
        society: LS.clamp(Math.round(finalAttrs.reputation * 0.85), 0, 100)
      },
      money: {
        cash: Math.round(bg.cash * (bp.cashMul || 1)),
        assets: Math.round(bg.assets * (bp.assetMul || 1)),
        debt: 0
      },
      edu: {
        level: 0,
        path: [{ year: LS.START_YEAR, age: 0, text: '出生' }],
        inSchool: false
      },
      job: {
        id: null, level: 0, title: '待业', salary: 0, years: 0, history: [],
        tags: null, huntTries: 0, lastHunt: null
      },
      family: {
        marriage: { status: '未婚', spouseId: null, year: null },
        childrenIds: []
      },
      house: { owned: false, value: 0, mortgage: 0, mortgagePaid: false, buyYear: null },
      npcs: [],
      pending: [],
      /* v2：隐性健康隐患、选择日志、阶段过场与播报队列 */
      risks: { lateNight: 0, highStress: 0, noExercise: 0, badDiet: 0 },
      riskOrigin: {},
      choiceLog: [],
      echoLog: [],
      healthNegLog: [],
      stageSeen: {},
      pendingStage: null,
      pendingBroadcasts: [],
      lastBroadcastTurn: -99,
      broadcastAges: [],
      echoInfo: null,
      crossSeen: {},
      flags: {},
      marks: {},
      memories: [],
      /* v3.3：唯一事实源——实际发生过的事件流水（回忆录只读这份） */
      eventLog: [],
      eventSeq: 0,
      eventLogLegacy: false,
      fired: [],
      history: [],
      stats: {
        jobYears: {},
        marriedYears: 0,
        startupSuccess: 0,
        startupFail: 0,
        maxNet: 0,
        minNet: 0,
        maxAssets: 0,
        minHealth: 100,
        childrenEver: 0,
        loansTaken: 0,
        promotions: 0,
        healthNegAge: -99,
        healthNegCount: 0,
        huntFail: 0,
        echoesSeen: 0,
        crossroadsSeen: 0
      },
      maxAge: 72 + LS.randInt(0, 20),
      current: null,
      lastOutcome: null,
      death: { dead: false, reason: '', year: null, age: null },
      summary: null,
      /* v3：抉择计数、事件池记忆、平淡年、阶段总结、时代背景、NPC 弧线、跨局传承 */
      decisionCount: 0,
      eventSeen: [],
      eventCD: {},
      quietYears: 0,
      quietNote: '',
      quietNoteSeen: [],
      stageSummary: null,
      pendingSummary: false,
      stageImpact: [],
      stageImpactRuns: 0,
      recap: [],
      epoch: { name: '平稳年代', mods: {}, until: null },
      npcArc: {},
      npcInitiated: [],
      kindnessLog: [],
      payoffLog: [],
      revengeLog: [],
      outcomeLog: [],
      eventFamilies: {},
      blockedTurn: -99,
      blockerLog: [],
      track: null,
      sibling: { has: false, role: null, name: null, ageGap: 0 },
      circles: {
        '亲属圈': { rep: 50 }, '同学圈': { rep: 50 }, '发小圈': { rep: 50 },
        '同事圈': { rep: 50 }, '行业圈': { rep: 50 }, '兴趣圈': { rep: 50 }
      },
      socialQuota: { year: LS.START_YEAR, used: 0, max: 1 },
      legacy: { reputation: 0, cash: 0, source: null },
      achievementsV3: [],
      lastSummaryAt: -99
    };

    g.npcs.push(LS.makeNPC('父亲', {
      id: 'father', age: fatherAge, health: LS.clamp(68 + bg.parentHealth, 30, 95),
      intimacy: bg.fatherFavor, note: '家里的顶梁柱', gender: '男',
      anchors: [{ year: LS.START_YEAR, kind: 'birth', text: '你出生那天，他在医院走廊守了一夜' }]
    }));
    g.npcs.push(LS.makeNPC('母亲', {
      id: 'mother', age: motherAge, health: LS.clamp(72 + bg.parentHealth, 30, 96),
      intimacy: bg.motherFavor, note: '操持家务的人', gender: '女',
      anchors: [{ year: LS.START_YEAR, kind: 'birth', text: '你出生那天，她把你抱在怀里' }]
    }));

    /* 兄弟姐妹：贫困/农村更容易有；开局只生成哥哥/姐姐，弟弟/妹妹由童年事件加入 */
    var sibChance = ({ '贫困': 0.52, '普通工薪': 0.36, '中产': 0.28, '富裕': 0.40 })[g.background] || 0.36;
    if (LS.chance(sibChance)) {
      var sibRole = LS.chance(0.5) ? '哥哥' : '姐姐';
      var sibAge = LS.randInt(2, 6);
      var sibGender = sibRole === '哥哥' ? '男' : '女';
      var sibName = LS.randomName(sibGender);
      g.sibling = { has: true, role: sibRole, name: sibName, ageGap: sibAge, id: 'sibling' };
      g.npcs.push(LS.makeNPC(sibRole, {
        id: 'sibling', name: sibName, age: sibAge, gender: sibGender,
        intimacy: 58, circle: '亲属圈', note: '和你一起长大的' + sibRole,
        anchors: [{ year: LS.START_YEAR + sibAge, kind: 'birth', text: sibRole + '比你大 ' + sibAge + ' 岁' }]
      }));
    }
    g.socialQuota.max = 1 + (g.attrs.charm >= 60 ? 1 : 0);

    var birthText = '出生在' + g.birthplace + '的一个' + g.background + '家庭。父亲 ' + fatherAge + ' 岁，母亲 ' + motherAge + ' 岁。';
    LS.addMemory(g, birthText, 'birth');
    LS.pushEventLog(g, {
      turn: g.turn, age: g.age, year: g.year, stage: g.stage,
      tier: 'sys', eventId: 'sys_birth', title: '出生', source: 'sys',
      resultText: birthText
    });
    LS.snapshot(g);
    g.stageStart = LS.stageSnapshot(g);
    g.rngState = LS.RNG.state;
    return g;
  };

  /* ---------------- NPC ---------------- */
  LS.NPC_LIFESPAN = function () { return 66 + LS.randInt(0, 24); };
  LS.makeNPC = function (role, opt) {
    opt = opt || {};
    var circle = opt.circle || LS.circleOf(role);
    var intimacy = opt.intimacy !== undefined ? Number(opt.intimacy)
      : (opt.favor !== undefined ? Number(opt.favor) : 50);
    /* 旧调用把 favor 当 0-100 亲密度；新调用用 intimacy + favor(人情账) */
    var ledger = (opt.intimacy !== undefined && opt.favor !== undefined) ? Number(opt.favor) : 0;
    if (isNaN(intimacy)) intimacy = 50;
    if (isNaN(ledger)) ledger = 0;
    intimacy = LS.clamp(intimacy, 0, 100);
    ledger = LS.clamp(ledger, -5, 5);
    var npc = {
      id: opt.id || ('npc_' + role + '_' + Math.floor(Math.random() * 100000)),
      role: role,
      name: opt.name || role,
      gender: opt.gender || '男',
      age: opt.age === undefined ? 30 : opt.age,
      health: opt.health === undefined ? 75 : opt.health,
      circle: circle,
      intimacy: intimacy,
      favor: ledger,
      relation: opt.relation || LS.relationOf(intimacy, ledger),
      anchors: opt.anchors || [],
      state: opt.state || { job: opt.job || null, health: opt.health === undefined ? 75 : opt.health, status: opt.status || null },
      alive: opt.alive === undefined ? true : opt.alive,
      note: opt.note || '',
      deathYear: null,
      lifespan: opt.lifespan || LS.NPC_LIFESPAN(),
      isChild: !!opt.isChild,
      isSpouse: !!opt.isSpouse,
      lastContactYear: opt.lastContactYear === undefined ? null : opt.lastContactYear,
      arcStage: opt.arcStage || '相遇'
    };
    return npc;
  };
  /* 记忆锚点：1-3 条，超出时挤掉最旧的一条 */
  LS.addAnchor = function (g, npc, kind, text, dIntimacy, dFavor) {
    if (!npc) return null;
    npc.anchors = npc.anchors || [];
    var rec = { year: (g && g.year) || LS.START_YEAR, kind: kind || 'meet', text: String(text || '') };
    npc.anchors.push(rec);
    if (npc.anchors.length > 3) npc.anchors.shift();
    if (dIntimacy) npc.intimacy = LS.clamp((Number(npc.intimacy) || 0) + Number(dIntimacy), 0, 100);
    if (dFavor) npc.favor = LS.clamp((Number(npc.favor) || 0) + Number(dFavor), -5, 5);
    npc.relation = LS.relationOf(npc);
    if (g) {
      g.npcArc = g.npcArc || {};
      var arc = g.npcArc[npc.id] || { nodes: [] };
      if (!arc.nodes) arc.nodes = [];
      arc.nodes.push({ year: rec.year, age: g.age, kind: rec.kind, text: rec.text });
      g.npcArc[npc.id] = arc;
    }
    return rec;
  };

  LS.getNpc = function (g, key) {
    if (!g || !g.npcs) return null;
    for (var i = 0; i < g.npcs.length; i++) {
      if (g.npcs[i].id === key || g.npcs[i].role === key) return g.npcs[i];
    }
    return null;
  };
  LS.npcAlive = function (g, key) {
    var n = LS.getNpc(g, key);
    return !!(n && n.alive);
  };

  LS.addNpc = function (g, role, opt) {
    var n = LS.makeNPC(role, opt || {});
    g.npcs.push(n);
    return n;
  };

  LS.ensureNpc = function (g, role, opt) {
    var n = LS.getNpc(g, role);
    if (n) return n;
    return LS.addNpc(g, role, opt || {});
  };

  LS.addMemory = function (g, text, kind) {
    if (!text) return;
    var body = String(text);
    if (kind === 'choice' && body.indexOf('【') !== 0) body = '【' + g.age + ' 岁】' + body;
    g.memories.push({
      year: g.year,
      age: g.age,
      text: body,
      kind: kind || 'choice'
    });
  };

  /* v3.3：eventLog 是“实际发生”的唯一事实源，只允许引擎在事件触发/结算时写入 */
  LS.pushEventLog = function (g, entry) {
    if (!g) return 0;
    var e = entry || {};
    g.eventLog = g.eventLog || [];
    g.eventSeq = Number(g.eventSeq) || 0;
    g.eventSeq += 1;
    var rec = {
      seq: g.eventSeq,
      turn: Number(e.turn === undefined ? g.turn : e.turn),
      age: Number(e.age === undefined ? g.age : e.age),
      year: Number(e.year === undefined ? g.year : e.year),
      stage: e.stage || g.stage || '',
      tier: e.tier || 'daily',
      eventId: e.eventId || ('sys_' + g.eventSeq),
      title: e.title || '',
      source: e.source || 'sys',
      auto: !!e.auto,
      choiceId: e.choiceId || null,
      choiceIndex: e.choiceIndex === undefined ? null : e.choiceIndex,
      choiceLabel: e.choiceLabel || '',
      outcomeLabel: e.outcomeLabel || '',
      resultText: e.resultText || '',
      declared: e.declared || [],
      changes: e.changes || '',
      echoOf: e.echoOf || null
    };
    g.eventLog.push(rec);
    if (g.eventLog.length > 1000) g.eventLog.shift();
    return rec.seq;
  };

  LS.eventLogEntry = function (g, seq) {
    if (!g || !g.eventLog || !seq) return null;
    for (var i = g.eventLog.length - 1; i >= 0; i--) {
      if (g.eventLog[i].seq === seq) return g.eventLog[i];
    }
    return null;
  };

  /* v3.3：回忆录唯一读取入口——禁止读 memories/choiceLog/echoLog，禁止补全 */
  LS.memoirEntries = function (g) {
    var out = [];
    if (!g) return out;
    var log = g.eventLog || [];
    if (!log.length) {
      if (g.eventLogLegacy) out.push({ legacy: true, text: '这一世没有留下记录' });
      return out;
    }
    var hasChoice = {};
    log.forEach(function (x) { if (x.choiceId) hasChoice[x.choiceId] = true; });
    log.forEach(function (x) {
      var tier = x.tier || 'daily';
      var text;
      var linked = false;
      if (tier === 'sys') {
        text = x.resultText || x.title;
      } else if (tier === 'echo') {
        linked = !!(x.echoOf && hasChoice[x.echoOf]);
        text = linked ? ('因果回响：' + (x.title || '') + (x.resultText ? '。' + x.resultText : '')) : '这一世没有留下记录（无法指回源选择）';
        if (!linked) tier = 'legacy';
      } else if (tier === 'crossroad') {
        text = '命运岔路：' + (x.title || '') + (x.choiceLabel ? '。你选择了「' + x.choiceLabel + '」' : '') + (x.resultText ? '。' + x.resultText : '');
      } else {
        text = (x.title ? x.title + '：' : '') + (x.resultText || (x.auto ? '日子照旧。' : ''));
      }
      out.push({
        seq: x.seq, eventId: x.eventId, choiceId: x.choiceId || null,
        age: x.age, year: x.year, tier: tier, title: x.title || '',
        text: text, echoOf: x.echoOf || null, legacy: false
      });
    });
    return out;
  };

  LS.snapshot = function (g) {
    var snap = {
      age: g.age,
      year: g.year,
      knowledge: Math.round(g.attrs.knowledge),
      health: Math.round(g.attrs.health),
      happiness: Math.round(g.attrs.happiness),
      reputation: LS.repTotal(g),
      net: LS.netWorth(g),
      cash: Math.round(g.money.cash),
      assets: Math.round(g.money.assets),
      debt: Math.round(g.money.debt)
    };
    var last = g.history[g.history.length - 1];
    if (last && last.age === g.age) g.history[g.history.length - 1] = snap;
    else g.history.push(snap);
    if (g.stats) {
      g.stats.maxNet = Math.max(g.stats.maxNet, LS.netWorth(g));
      g.stats.minNet = Math.min(g.stats.minNet, LS.netWorth(g));
      g.stats.maxAssets = Math.max(g.stats.maxAssets, g.money.assets);
      g.stats.minHealth = Math.min(g.stats.minHealth, g.attrs.health);
    }
  };

  /* v3：阶段快照，用于阶段总结卡与跨阶段对比 */
  LS.stageSnapshot = function (g) {
    var a = (g && g.attrs) || {};
    var m = (g && g.money) || {};
    var tags = [];
    if (g && g.marks) {
      for (var k in g.marks) if (g.marks[k]) tags.push(k);
    }
    var num = function (v) { return Math.round(Number(v) || 0); };
    return {
      age: num(g && g.age),
      attrs: {
        knowledge: num(a.knowledge),
        health: num(a.health),
        finance: num(a.finance),
        charm: num(a.charm),
        happiness: num(a.happiness),
        stress: num(a.stress)
      },
      rep: num(g ? LS.repTotal(g) : 0),
      cash: num(m.cash),
      assets: num(m.assets),
      debt: num(m.debt),
      tags: tags,
      npcs: ((g && g.npcs) || []).map(function (n) {
        return { id: n.id, role: n.role, alive: !!n.alive, intimacy: num(n.intimacy), favor: num(n.favor), relation: n.relation, circle: n.circle };
      })
    };
  };

  /* ---------------- 成就 ---------------- */
  LS.ACHIEVEMENTS = [
    {
      id: 'rags', name: '白手起家', desc: '出身贫困，最终净资产超过 100 万',
      cond: function (g) { return g.background === '贫困' && LS.netWorth(g) >= 1000000; }
    },
    {
      id: 'longlife', name: '长寿老人', desc: '活到 90 岁及以上',
      cond: function (g) { return g.age >= 90; }
    },
    {
      id: 'academic', name: '学术之巅', desc: '取得博士学位且学识 ≥ 85',
      cond: function (g) { return g.edu.level >= 7 && g.attrs.knowledge >= 85; }
    },
    {
      id: 'love', name: '一生挚爱', desc: '婚姻持续 30 年以上，配偶好感 ≥ 80',
      cond: function (g) {
        var n = g.family.marriage.spouseId ? LS.getNpc(g, g.family.marriage.spouseId) : null;
        return g.stats.marriedYears >= 30 && n && (n.intimacy >= 80 || n.relation === '至亲');
      }
    },
    {
      id: 'lonely', name: '孤独终老', desc: '离世时无配偶、无子女，也没有好感 ≥ 60 的朋友',
      cond: function (g) {
        var spouse = g.family.marriage.spouseId ? LS.getNpc(g, g.family.marriage.spouseId) : null;
        var hasFriend = g.npcs.some(function (n) {
          return n.alive && (n.role === '朋友' || n.role === '同学' || n.role === '同事') && n.intimacy >= 60;
        });
        return (!spouse || !spouse.alive) && g.family.childrenIds.length === 0 && !hasFriend;
      }
    },
    {
      id: 'ironrice', name: '铁饭碗', desc: '公务员岗位累计满 25 年',
      cond: function (g) { return (g.stats.jobYears.civil || 0) >= 25; }
    },
    {
      id: 'peach', name: '桃李满园', desc: '教师岗位累计满 20 年',
      cond: function (g) { return (g.stats.jobYears.teacher || 0) >= 20; }
    },
    {
      id: 'housefree', name: '房奴上岸', desc: '买过房，并把房贷还清',
      cond: function (g) { return g.house.owned && g.house.mortgagePaid; }
    },
    {
      id: 'roller', name: '大起大落', desc: '一生净资产曾超过 100 万，也曾为负',
      cond: function (g) { return g.stats.maxNet >= 1000000 && g.stats.minNet < 0; }
    },
    {
      id: 'startup', name: '商海沉浮', desc: '创业成功与失败各至少一次',
      cond: function (g) { return g.stats.startupSuccess > 0 && g.stats.startupFail > 0; }
    },
    {
      id: 'survivor', name: '逆风翻盘', desc: '健康曾跌破 20，最终活过 75 岁',
      cond: function (g) { return g.stats.minHealth < 20 && g.age >= 75; }
    },
    {
      id: 'dink', name: '丁克到底', desc: '终身无子女，且活过 80 岁',
      cond: function (g) { return g.stats.childrenEver === 0 && g.age >= 80; }
    },
    {
      id: 'debtfree', name: '无债一身轻', desc: '50 岁后负债清零且净资产为正',
      cond: function (g) { return g.age >= 50 && g.money.debt === 0 && LS.netWorth(g) > 0; }
    },
    {
      id: 'poorScholar', name: '寒门贵子', desc: '出身贫困，取得硕士及以上学历',
      cond: function (g) { return g.background === '贫困' && g.edu.level >= 6; }
    },
    {
      id: 'midcrisis', name: '中年渡劫', desc: '40–50 岁间压力曾超过 85，仍活到 70 岁',
      cond: function (g) { return g.age >= 70 && g.stats.peakStressMidlife === true; }
    },
    /* ---- v3 追加：只用 g 上已有字段判定 ---- */
    {
      id: 'v3_warm', name: '灯火可亲', desc: '60 岁以后，仍有至少两位好感 ≥ 65 的亲友活着',
      cond: function (g) {
        if (!g.npcs || g.age < 60) return false;
        var n = 0;
        for (var i = 0; i < g.npcs.length; i++) {
          var x = g.npcs[i];
          if (x && x.alive && x.intimacy >= 65) n++;
        }
        return n >= 2;
      }
    },
    {
      id: 'v3_tycoon', name: '富甲一方', desc: '净资产达到 500 万',
      cond: function (g) { return LS.netWorth(g) >= 5000000; }
    },
    {
      id: 'v3_quiet', name: '平常一生', desc: '活到 80 岁，从未创业，也从未负债',
      cond: function (g) {
        if (g.age < 80) return false;
        var everStartup = (g.stats.startupSuccess || 0) > 0 || (g.stats.startupFail || 0) > 0 ||
          !!(g.marks && (g.marks.startup_success || g.marks.startup_failed)) ||
          !!(g.job && g.job.id === 'startup');
        var hist = (g.job && g.job.history) || [];
        for (var i = 0; i < hist.length; i++) {
          if (hist[i] && /创业/.test(String(hist[i].text || ''))) everStartup = true;
        }
        if (g.flags && (g.flags.startup || g.flags.startupEver || g.flags.entrepreneur)) everStartup = true;
        var everDebt = !!(g.money && g.money.debt > 0) || (g.stats.loansTaken || 0) > 0 ||
          !!(g.house && g.house.mortgage > 0) || (g.stats.minNet || 0) < 0;
        if (g.flags && (g.flags.loan || g.flags.debt || g.flags.inDebt)) everDebt = true;
        return !everStartup && !everDebt;
      }
    },
    {
      id: 'v3_scar', name: '带伤前行', desc: '留下至少两道健康隐患，仍活过 70 岁',
      cond: function (g) {
        if (g.age < 70) return false;
        var list = g.stageImpact || [];
        var n = 0;
        for (var i = 0; i < list.length; i++) {
          if (list[i] && list[i].type === 'risk') n++;
        }
        return n >= 2;
      }
    },
    {
      id: 'v3_mentor', name: '桃李/提携', desc: '一生至少提携过两个人',
      cond: function (g) { return !!(g.flags && g.flags.mentorCount >= 2); }
    },
    {
      id: 'v3_rootless', name: '无根之城', desc: '一生搬家或换城至少两次',
      cond: function (g) {
        var n = 0;
        if (g.marks) {
          for (var k in g.marks) {
            if (g.marks[k] && /move|moved|city|relocat|搬家|换城/.test(k)) n++;
          }
        }
        var mv = g.flags ? (Number(g.flags.moved) || 0) : 0;
        return n >= 2 || mv >= 2;
      }
    }
  ];

  LS.computeAchievements = function (g) {
    return LS.ACHIEVEMENTS.map(function (a) {
      var ok = false;
      try { ok = !!a.cond(g); } catch (e) { ok = false; }
      return { id: a.id, name: a.name, desc: a.desc, got: ok };
    });
  };

})();

