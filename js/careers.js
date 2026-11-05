/* =========================================================
   careers.js — v3.7 职业路径数据与运行时接口
   12 条路径：医生 / 警察 / 教师 / 科研 / 出租车 / 厨师 /
             小店老板 / 创业 / 工程师 / 公务员 / 混混 / 技工
   说明：
     1) 本文件只声明 LS.CAREER，不修改任何既有文件；
     2) 职业技能事件在 js/events_career.js 中注册到 LS.EVENTS；
     3) 引擎接入点见 docs/career_schema.md。
   ========================================================= */
(function () {
  'use strict';
  var L = window.LS = window.LS || {};
  var C = L.CAREER = L.CAREER || {};

  C.VERSION = '3.7.0-career-1';
  C.PATHS = {};
  C.ORDER = [];

  /* ---------------- 职业旗标：统一前缀 c_，避免与普通事件标记冲突 ---------------- */
  C.BAD_FLAGS = ['c_bribe', 'c_fraud', 'c_coverup', 'c_violence', 'c_lawsuit',
    'c_fired', 'c_debt', 'c_jail', 'c_injury'];
  C.GOOD_FLAGS = ['c_hero', 'c_clean', 'c_master'];

  function flagOn(g, name) {
    if (!g) return false;
    var c = g.career || {};
    return !!(c.flags && c.flags[name]) || !!(g.marks && g.marks[name]);
  }
  C.hasFlag = flagOn;

  function countFlags(g, names) {
    var n = 0;
    for (var i = 0; i < names.length; i++) if (flagOn(g, names[i])) n += 1;
    return n;
  }
  C.countFlags = countFlags;

  C.badCount = function (g) { return countFlags(g, C.BAD_FLAGS); };
  C.goodCount = function (g) { return countFlags(g, C.GOOD_FLAGS); };
  C.cleanRecord = function (g) { return C.badCount(g) === 0; };

  /* ---------------- 新增岗位：只在 LS.JOBS 缺失时注册，幂等 ---------------- */
  C.JOB_EXT = {
    police: {
      name: '警察', minEdu: 3, base: 72000, growth: 1.030,
      stress: 3.6, healthDrain: 0.80, repCap: { industry: 70, society: 82 },
      path: ['见习民警', '警员', '副所长', '所长', '分局副局长'],
      rep: { school: 0.1, industry: 0.5, society: 0.8 }
    },
    taxi: {
      name: '出租车司机', minEdu: 1, base: 52000, growth: 1.020,
      stress: 3.0, healthDrain: 0.90, repCap: { industry: 35, society: 40 },
      path: ['替班司机', '单车司机', '车队司机', '车队队长', '车队老板'],
      rep: { school: 0.02, industry: 0.3, society: 0.25 }
    },
    chef: {
      name: '厨师', minEdu: 1, base: 56000, growth: 1.035,
      stress: 3.2, healthDrain: 0.80, repCap: { industry: 55, society: 55 },
      path: ['打荷', '砧板', '炒锅', '厨师长', '行政总厨'],
      rep: { school: 0.02, industry: 0.55, society: 0.4 }
    },
    shop: {
      name: '小店老板', minEdu: 2, base: 60000, growth: 1.040,
      stress: 3.4, healthDrain: 0.70, repCap: { industry: 40, society: 50 },
      path: ['摆摊', '小店主', '社区店主', '连锁店主', '区域老板'],
      rep: { school: 0.02, industry: 0.35, society: 0.35 }
    },
    gang: {
      name: '混混', minEdu: 0, base: 45000, growth: 1.050,
      stress: 3.8, healthDrain: 1.00, repCap: { industry: 20, society: 15 },
      path: ['小弟', '看场', '小头目', '堂口大哥', '洗白老板'],
      rep: { school: 0.0, industry: 0.15, society: 0.1 }
    },
    mechanic: {
      name: '技工', minEdu: 2, base: 62000, growth: 1.030,
      stress: 2.4, healthDrain: 0.70, repCap: { industry: 60, society: 55 },
      path: ['学徒', '技工', '高级技工', '技师', '高级技师'],
      rep: { school: 0.02, industry: 0.55, society: 0.35 }
    }
  };

  C.ensureJobs = function () {
    if (!L.JOBS) return;
    for (var id in C.JOB_EXT) {
      if (!L.JOBS[id]) L.JOBS[id] = C.JOB_EXT[id];
    }
  };

  /* ---------------- 路径声明 ---------------- */
  function path(o) {
    o.events = o.events || [];
    o.eventCount = 0;
    C.PATHS[o.id] = o;
    C.ORDER.push(o.id);
    return o;
  }

  /* 收入段：monthly 为“月均职业加成”，applyIncome 按年换算 */
  function inc(a, b, monthly, note) { return { from: a, to: b, monthly: monthly, note: note }; }

  /* =========================================================
     1. 医生
     ========================================================= */
  path({
    id: 'doctor', name: '医生', jobId: 'doctor', cat: 'work', tier: 'echo',
    summary: '五年本科、三年规培，前十年拿命换资历，四十岁以后才真正值钱。',
    entryRoutes: [
      { fork: 'zhongkao', age: 15, route: '重点高中（理科）', note: '择校费 2 万，三年后只能拼高考，医学不收职校生。' },
      { fork: 'gaokao', age: 18, route: '临床医学本科', note: '五年制，学费与生活费合计约 12 万；同龄人 22 岁挣钱，你还在上课。' },
      { fork: 'grad', age: 22, route: '专硕 + 规培', note: '三年，月补贴 3000–5000，几乎没有休息日；不读研则只能去县医院。' },
      { fork: 'postgrad', age: 25, route: '三甲医院编制 / 县医院', note: '三甲要论文和关系，县医院稳定但收入天花板低。' }
    ],
    income: [
      inc(22, 30, 3000, '规培与住院医，夜班费按次算，扣完房租所剩无几'),
      inc(31, 40, 18000, '主治医师，门诊量上来，绩效开始像样'),
      inc(41, 55, 45000, '副高/主任医师，专家号与手术提成拉开差距'),
      inc(56, 120, 20000, '退休返聘或门诊坐诊，收入回落但稳定')
    ],
    pressure: {
      level: 5, stress: 4.0, healthDrain: 0.70,
      risks: ['夜班', '医闹', '职业暴露', '颈椎与胃病'],
      text: '36 小时连轴转是常态；一台手术站八小时，下台后手抖得端不住水杯。'
    },
    promote: ['住院医师', '主治医师', '副主任医师', '主任医师', '科室主任'],
    top: {
      label: '名医', desc: '一号难求，外地病人带着片子来找你；你的名字挂在科室介绍的第一行。',
      cond: function (g) {
        return g.job.level >= 3 && g.rep.industry >= 72 && C.goodCount(g) >= 1 && C.badCount(g) <= 1;
      }
    },
    bottom: {
      label: '吊销执照', desc: '一纸处分下来，执业证被收回；你再也进不了手术室。',
      cond: function (g) { return flagOn(g, 'c_malpractice') || flagOn(g, 'c_jail') || C.badCount(g) >= 3; }
    }
  });

  /* =========================================================
     2. 警察
     ========================================================= */
  path({
    id: 'police', name: '警察', jobId: 'police', cat: 'work', tier: 'echo',
    summary: '编制稳定、社会地位不低，但每一次出警都可能回不来。',
    entryRoutes: [
      { fork: 'zhongkao', age: 15, route: '普高 / 警校中专', note: '警校中专免学费，但 18 岁就定向基层，晋升慢。' },
      { fork: 'gaokao', age: 18, route: '公安院校本科', note: '政审、体能、视力三道门槛；四年学费约 3 万，毕业参加公安联考。' },
      { fork: 'grad', age: 22, route: '公安联考 / 社招', note: '联考录取率高于社招；社招要体测和政审，可能空等一年。' },
      { fork: 'postgrad', age: 25, route: '市局 / 省厅技术岗', note: '学历是加分项，但一线经验不足，下去蹲点会被老民警看轻。' }
    ],
    income: [
      inc(22, 30, 5000, '见习与基层民警，工资加值班补贴，公积金尚可'),
      inc(31, 40, 12000, '警长/副所长，绩效与辖区考核挂钩'),
      inc(41, 55, 18000, '所长/分局中层，收入稳定，风险也集中'),
      inc(56, 120, 10000, '退休或转岗，养老金按职级算')
    ],
    pressure: {
      level: 5, stress: 3.6, healthDrain: 0.80,
      risks: ['夜巡', '暴力抗法', '追捕车祸', '长期高压'],
      text: '手机 24 小时开机，半夜一个电话就得走；腰椎和胃是同事间的共同话题。'
    },
    promote: ['见习民警', '警员', '副所长', '所长', '分局副局长'],
    top: {
      label: '警界模范', desc: '胸前的奖章排成一排，市局把你的案子做成培训教材。',
      cond: function (g) {
        return g.job.level >= 3 && g.rep.society >= 72 && C.goodCount(g) >= 1 && C.badCount(g) <= 1;
      }
    },
    bottom: {
      label: '开除 / 入狱', desc: '警服被收走，案卷里多了一份处分决定；严重的那一种，直接换了囚服。',
      cond: function (g) { return flagOn(g, 'c_jail') || flagOn(g, 'c_coverup') || C.badCount(g) >= 3; }
    }
  });

  /* =========================================================
     3. 教师
     ========================================================= */
  path({
    id: 'teacher', name: '教师', jobId: 'teacher', cat: 'work', tier: 'echo',
    summary: '寒暑假是外人看见的，成绩排名和家長群是每天要面对的。',
    entryRoutes: [
      { fork: 'zhongkao', age: 15, route: '重点高中', note: '想进师范，先得有一张能看的高考成绩单。' },
      { fork: 'gaokao', age: 18, route: '师范本科 / 定向师范', note: '定向师范免学费，但要在乡镇学校服务 6 年，违约要赔钱。' },
      { fork: 'grad', age: 22, route: '教师资格 + 考编', note: '编制考试一年一次，备考期没有收入；民办学校随时能进，但没保障。' },
      { fork: 'postgrad', age: 25, route: '重点中学 / 教研岗', note: '硕士能进重点中学，起薪高两千，但带班压力一样不少。' }
    ],
    income: [
      inc(22, 30, 4000, '新教师，工资条干净，绩效要等学期末'),
      inc(31, 40, 9000, '一级教师，带班与补课收入开始补上缺口'),
      inc(41, 55, 13000, '高级教师/学科组长，评优与校外讲座带来额外收入'),
      inc(56, 120, 9000, '退休返聘或机构代课，按课时结算')
    ],
    pressure: {
      level: 4, stress: 2.8, healthDrain: 0.50,
      risks: ['家长投诉', '成绩排名', '咽喉炎', '长期站立'],
      text: '早上六点半到校，晚上十点还在家长群回复“老师，孩子今天怎么了”。'
    },
    promote: ['新教师', '一级教师', '高级教师', '学科组长', '副校长'],
    top: {
      label: '特级教师', desc: '公开课视频被全市转发，家长托关系想把孩子塞进你的班。',
      cond: function (g) {
        return g.job.level >= 3 && g.rep.school >= 70 && C.goodCount(g) >= 2 && C.badCount(g) <= 1;
      }
    },
    bottom: {
      label: '被开除', desc: '通报贴在校门口，你收拾办公桌时，没有学生来送。',
      cond: function (g) { return flagOn(g, 'c_fired') || flagOn(g, 'c_fraud') || C.badCount(g) >= 3; }
    }
  });

  /* =========================================================
     4. 科研
     ========================================================= */
  path({
    id: 'research', name: '科研', jobId: 'researcher', cat: 'work', tier: 'echo',
    summary: '前十年在实验室里熬，三十五岁后要么拿到帽子，要么被“非升即走”送走。',
    entryRoutes: [
      { fork: 'zhongkao', age: 15, route: '重点高中（竞赛班）', note: '竞赛奖能换自主招生资格，但要把大量时间押在一条路上。' },
      { fork: 'gaokao', age: 18, route: '理科本科', note: '四年学费约 2.4 万；本科只是入场券，不读研几乎没有科研岗。' },
      { fork: 'grad', age: 22, route: '直博 / 学硕', note: '五到六年，补助每月 2000–4000；延毕是常态，论文是硬通货。' },
      { fork: 'postgrad', age: 25, route: '博士后 / 院所助理研究员', note: '非升即走，六年内评不上副高就得走人。' }
    ],
    income: [
      inc(22, 30, 2000, '博士生/科研助理，补助低，靠导师项目发一点劳务'),
      inc(31, 40, 15000, '助理研究员/副高，拿到青年基金后收入明显改善'),
      inc(41, 55, 30000, '研究员/首席，项目提成与评审费拉开差距'),
      inc(56, 120, 15000, '退休返聘、评审专家，收入回落但仍有话语权')
    ],
    pressure: {
      level: 5, stress: 3.0, healthDrain: 0.55,
      risks: ['论文压力', '实验事故', '化学暴露', '长期熬夜'],
      text: '实验做到凌晨两点，培养箱的灯比家里的灯更常见；一篇论文被拒三次，学期就过去了。'
    },
    promote: ['科研助理', '助理研究员', '副研究员', '研究员', '首席科学家'],
    top: {
      label: '院士', desc: '你的名字出现在学部名单上，实验室门口挂上了以你命名的牌子。',
      cond: function (g) {
        return g.job.level >= 4 && g.rep.industry >= 85 && C.goodCount(g) >= 2 && C.badCount(g) === 0;
      }
    },
    bottom: {
      label: '学术不端除名', desc: '撤稿通知贴在官网首页，项目被收回，学生被转给别的导师。',
      cond: function (g) { return flagOn(g, 'c_fraud') || flagOn(g, 'c_coverup') || C.badCount(g) >= 3; }
    }
  });

  /* =========================================================
     5. 出租车司机
     ========================================================= */
  path({
    id: 'taxi', name: '出租车司机', jobId: 'taxi', cat: 'work', tier: 'echo',
    summary: '车轮上的生计：份子钱、油钱、平台抽成，一天不跑就一天没有收入。',
    entryRoutes: [
      { fork: 'zhongkao', age: 15, route: '辍学 / 职校', note: '早三年入行，能多攒一辆车的本钱；代价是学历止步。' },
      { fork: 'gaokao', age: 18, route: '直接打工 / 大专', note: '跑车不需要文凭，但大专毕业还能留一条转行的后路。' },
      { fork: 'grad', age: 22, route: '租车 / 挂靠车队', note: '押金 1–2 万，份子钱每天 150–260，先欠着车队的钱上路。' },
      { fork: 'postgrad', age: 25, route: '网约车 / 自有车', note: '自有车自由，但折旧、保险和维修全自己扛。' }
    ],
    income: [
      inc(22, 30, 8000, '一天跑 12 小时，流水好看，扣掉份子钱和油钱剩这些'),
      inc(31, 40, 12000, '熟客与机场单稳定，收入到顶'),
      inc(41, 55, 9000, '腰和颈椎先撑不住，出车时间被迫缩短'),
      inc(56, 120, 4000, '转做包车或替班，收入只够日常')
    ],
    pressure: {
      level: 4, stress: 3.0, healthDrain: 0.90,
      risks: ['久坐', '夜班', '抢劫', '交通事故'],
      text: '一天坐十二个小时，腰椎间盘突出是职业病；深夜拉到偏僻地方，手心会出汗。'
    },
    promote: ['替班司机', '单车司机', '车队司机', '车队队长', '车队老板'],
    top: {
      label: '车队老板', desc: '你不再亲自跑车，十几把钥匙挂在墙上，每月只负责对账和修车。',
      cond: function (g) {
        return (g.job.level >= 3 && g.money.assets >= 400000 && C.badCount(g) <= 2) ||
          (g.money.assets >= 900000 && C.badCount(g) <= 2);
      }
    },
    bottom: {
      label: '车祸负债', desc: '一次追尾，保险不够赔，车卖了还欠着钱；方向盘再也握不稳。',
      cond: function (g) { return flagOn(g, 'c_debt') || flagOn(g, 'c_injury') || flagOn(g, 'c_jail'); }
    }
  });

  /* =========================================================
     6. 厨师
     ========================================================= */
  path({
    id: 'chef', name: '厨师', jobId: 'chef', cat: 'work', tier: 'echo',
    summary: '灶台前站出来的手艺，工资涨得慢，油烟和烫伤先到。',
    entryRoutes: [
      { fork: 'zhongkao', age: 15, route: '职校厨师班', note: '学费 1 万，两年出师，18 岁进后厨先从打荷做起。' },
      { fork: 'gaokao', age: 18, route: '烹饪大专', note: '三年学费约 3 万，能进酒店冷菜间，起点比职校高半级。' },
      { fork: 'grad', age: 22, route: '酒店后厨 / 社会餐厅', note: '酒店规矩多、晋升慢；社会餐厅给钱快，但随时可能关门。' },
      { fork: 'postgrad', age: 25, route: '行政总厨助理 / 自开店', note: '没本钱就先给大厨打下手，配方和进货渠道都要自己记。' }
    ],
    income: [
      inc(22, 30, 6000, '打荷、砧板，包吃住，工资低但手艺在长'),
      inc(31, 40, 14000, '炒锅/厨师长，能独当一面，开始有提成'),
      inc(41, 55, 20000, '行政总厨或合伙开店，收入跟餐厅流水挂钩'),
      inc(56, 120, 10000, '退到二线做顾问或小馆子，收入回落')
    ],
    pressure: {
      level: 4, stress: 3.2, healthDrain: 0.80,
      risks: ['烫伤', '油烟', '静脉曲张', '旺季连轴转'],
      text: '夏天灶台前五十度，汗顺着下巴滴进领口；手上旧烫伤叠着新烫伤。'
    },
    promote: ['打荷', '砧板', '炒锅', '厨师长', '行政总厨'],
    top: {
      label: '五星主厨', desc: '餐厅挂你的名字，预约排到两个月后；你尝一口汤就知道火候差了几秒。',
      cond: function (g) {
        return g.job.level >= 3 && g.rep.industry >= 65 && C.goodCount(g) >= 1 && C.badCount(g) <= 1;
      }
    },
    bottom: {
      label: '餐厅倒闭', desc: '卷帘门拉下来，供货商堵在门口要账，你的名字被贴在同行群里。',
      cond: function (g) { return flagOn(g, 'c_debt') || flagOn(g, 'c_fraud') || C.badCount(g) >= 3; }
    }
  });

  /* =========================================================
     7. 小店老板
     ========================================================= */
  path({
    id: 'shop', name: '小店老板', jobId: 'shop', cat: 'work', tier: 'echo',
    summary: '一间门面养活一家人，房租、赊账和检查，哪一样都能把流水抽干。',
    entryRoutes: [
      { fork: 'zhongkao', age: 15, route: '辍学打工攒本钱', note: '三四年攒下 5–8 万，够盘一间小门面；没有退路。' },
      { fork: 'gaokao', age: 18, route: '大专商科 / 直接开店', note: '大专学点账目和进货，但学费会吃掉第一笔本钱。' },
      { fork: 'grad', age: 22, route: '社区小店 / 加盟', note: '加盟费 3–10 万，品牌方抽成，选址错了半年就撑不住。' },
      { fork: 'postgrad', age: 25, route: '连锁 / 电商', note: '有学历能做线上和供应链，但启动资金至少 20 万。' }
    ],
    income: [
      inc(22, 30, 7000, '刚开店，流水扣掉房租水电，剩的和打工差不多'),
      inc(31, 40, 20000, '熟客稳定，烟酒与日用周转起来，开始有净利'),
      inc(41, 55, 18000, '房租上涨、社区团购分流，利润被两头挤'),
      inc(56, 120, 8000, '转租或守着老店，收入只够养老')
    ],
    pressure: {
      level: 4, stress: 3.4, healthDrain: 0.70,
      risks: ['房租上涨', '赊账', '检查罚款', '长期守店'],
      text: '早上六点开门，晚上十一点关门；一年三百六十天，只有春节敢歇两天。'
    },
    promote: ['摆摊', '小店主', '社区店主', '连锁店主', '区域老板'],
    top: {
      label: '连锁老板', desc: '招牌换成了统一的样式，仓库里堆着自己的货，店长们等你签字。',
      cond: function (g) {
        return (g.job.level >= 3 && g.money.assets >= 500000 && C.badCount(g) <= 2) ||
          (g.money.assets >= 1200000 && C.badCount(g) <= 2);
      }
    },
    bottom: {
      label: '破产', desc: '货架清空，房东收走钥匙，你在卷帘门上贴了一张“转让”。',
      cond: function (g) { return flagOn(g, 'c_debt') || flagOn(g, 'c_fraud') || C.badCount(g) >= 3; }
    }
  });

  /* =========================================================
     8. 创业
     ========================================================= */
  path({
    id: 'startup', name: '创业', jobId: 'startup', cat: 'work', tier: 'echo',
    volatile: true,
    summary: '前三年几乎没有收入，活下来的少数人，才有资格谈回报。',
    entryRoutes: [
      { fork: 'zhongkao', age: 15, route: '普高 / 辍学', note: '没有学历也能做生意，但融资和招人时会被反复盘问。' },
      { fork: 'gaokao', age: 18, route: '本科 / 直接打工', note: '本科能进大厂攒资源和第一桶金；直接打工则更早接触生意。' },
      { fork: 'grad', age: 22, route: '进企业 / 直接创业', note: '进企业稳，创业投入 10 万起，大概率两年内亏完。' },
      { fork: 'postgrad', age: 25, route: '技术创业 / 加入初创团队', note: '技术入股能省现金，但股份兑现要等很久。' }
    ],
    income: [
      inc(22, 30, 0, '只有支出没有工资，靠积蓄和父母周转'),
      inc(31, 40, 30000, '公司跑通后给自己开工资，波动极大（±70%）'),
      inc(41, 55, 60000, '规模化或上市前，收入与公司估值绑定（±70%）'),
      inc(56, 120, 20000, '退居股东或顾问，分红不稳定')
    ],
    pressure: {
      level: 5, stress: 4.6, healthDrain: 1.10,
      risks: ['现金流断裂', '合伙人反目', '政策变化', '长期失眠'],
      text: '发工资前一天盯着账户余额，手机一响就以为是催款；睡到凌晨三点会突然坐起来算账。'
    },
    promote: ['初创合伙人', '项目负责人', '公司老板', '多店经营', '行业人物'],
    top: {
      label: '公司上市', desc: '敲钟那天你站在台上，想起第一次发不出工资的下午。',
      cond: function (g) {
        return (g.money.assets >= 3000000 && C.badCount(g) <= 2) ||
          (g.job.level >= 3 && g.rep.industry >= 80 && C.badCount(g) <= 2);
      }
    },
    bottom: {
      label: '破产负债', desc: '公司注销，员工散了，催收电话比客户电话多。',
      cond: function (g) { return flagOn(g, 'c_debt') || flagOn(g, 'c_jail') || C.badCount(g) >= 3; }
    }
  });

  /* =========================================================
     9. 工程师
     ========================================================= */
  path({
    id: 'engineer', name: '工程师', jobId: 'engineer', cat: 'work', tier: 'echo',
    summary: '图纸、工地、验收单，签字的那一刻，责任就落在你头上。',
    entryRoutes: [
      { fork: 'zhongkao', age: 15, route: '重点高中（理科）', note: '理科基础决定能不能进土木、机电这类专业。' },
      { fork: 'gaokao', age: 18, route: '工科本科', note: '四年学费约 2.8 万；毕业先去工地做技术员，住活动板房。' },
      { fork: 'grad', age: 22, route: '设计院 / 施工单位', note: '设计院画图，施工单位跑现场；前者体面，后者钱多但离家。' },
      { fork: 'postgrad', age: 25, route: '硕士研发 / 技术管理', note: '硕士进研究院起薪高，但项目出了问题一样要签字担责。' }
    ],
    income: [
      inc(22, 30, 10000, '技术员/助理工程师，驻外补贴撑着收入'),
      inc(31, 40, 25000, '工程师/项目技术负责人，绩效与工期挂钩'),
      inc(41, 55, 28000, '高工/技术总监，收入到顶，责任也到顶'),
      inc(56, 120, 12000, '转做顾问或审图，按项目结算')
    ],
    pressure: {
      level: 5, stress: 3.2, healthDrain: 0.60,
      risks: ['工地事故', '验收责任', '长期驻外', '背锅'],
      text: '工期压到极限时，所有人都在催你签字；出了事，第一个被问的是“谁验收的”。'
    },
    promote: ['助理工程师', '工程师', '高级工程师', '技术主管', '技术总监'],
    top: {
      label: '总工', desc: '项目图上签着你的名字，年轻技术员拿着图纸在会议室等你拍板。',
      cond: function (g) {
        return g.job.level >= 3 && g.rep.industry >= 72 && C.goodCount(g) >= 1 && C.badCount(g) <= 1;
      }
    },
    bottom: {
      label: '项目事故坐牢', desc: '塌方事故调查报告出来，签字栏里的名字被红笔圈住。',
      cond: function (g) { return flagOn(g, 'c_coverup') || flagOn(g, 'c_jail') || C.badCount(g) >= 3; }
    }
  });

  /* =========================================================
     10. 公务员
     ========================================================= */
  path({
    id: 'civil', name: '公务员', jobId: 'civil', cat: 'work', tier: 'echo',
    summary: '稳定、体面、按部就班；代价是收入上限清楚，责任却常常说不清。',
    entryRoutes: [
      { fork: 'zhongkao', age: 15, route: '普高', note: '考公不看高中出身，但没有本科连报名资格都没有。' },
      { fork: 'gaokao', age: 18, route: '本科（法学/中文/财会）', note: '专业决定岗位选择面；冷门专业只能报“三不限”。' },
      { fork: 'grad', age: 22, route: '国考 / 省考', note: '备考一到两年没有收入，热门岗位几百人抢一个。' },
      { fork: 'postgrad', age: 25, route: '选调生 / 事业单位', note: '选调起点高，但要去基层蹲两年，回城名额有限。' }
    ],
    income: [
      inc(22, 30, 5000, '科员，工资不高但公积金和社保齐全'),
      inc(31, 40, 11000, '副科长/科长，绩效与岗位责任同步上升'),
      inc(41, 55, 16000, '副处长/处长，收入稳定，隐性压力最大'),
      inc(56, 120, 10000, '退休或转二线，养老金按职级')
    ],
    pressure: {
      level: 4, stress: 2.6, healthDrain: 0.40,
      risks: ['问责', '舆情', '加班值守', '站队'],
      text: '材料改到第八稿，领导只说一句“再打磨打磨”；手机在周末响，通常没有好事。'
    },
    promote: ['科员', '副科长', '科长', '副处长', '处长'],
    top: {
      label: '局长', desc: '你在主席台第二排坐下，文件上的“同意”后面跟着你的签名。',
      cond: function (g) {
        return g.job.level >= 3 && g.rep.society >= 75 && C.goodCount(g) >= 1 && C.badCount(g) <= 1;
      }
    },
    bottom: {
      label: '处分开除', desc: '纪委的人走进办公室，你的电脑和笔记本一起被装进纸箱。',
      cond: function (g) { return flagOn(g, 'c_fraud') || flagOn(g, 'c_fired') || C.badCount(g) >= 3; }
    }
  });

  /* =========================================================
     11. 混混
     ========================================================= */
  path({
    id: 'gang', name: '混混', jobId: 'gang', cat: 'work', tier: 'echo',
    summary: '来钱快，代价是随时可能进去；能洗白的只是极少数。',
    entryRoutes: [
      { fork: 'zhongkao', age: 15, route: '辍学 / 混社会', note: '15 岁离开学校，先给人看场，一天一百，管烟管饭。' },
      { fork: 'gaokao', age: 18, route: '落榜 / 跟大哥', note: '没有学历和手艺，只剩人情与胆子可以押。' },
      { fork: 'grad', age: 22, route: '看场 / 收账', note: '替人收账抽成，来钱快；出了事第一个被推出去。' },
      { fork: 'postgrad', age: 25, route: '洗白做正经生意', note: '需要一笔干净的本钱和可靠的白手套，失败就前功尽弃。' }
    ],
    income: [
      inc(22, 30, 15000, '看场、收账、抽成，现金来得快，也花得快'),
      inc(31, 40, 25000, '小头目，有固定地盘和手下，开销同样大'),
      inc(41, 55, -10000, '打点、赔偿、养小弟，收入开始倒挂'),
      inc(56, 120, -8000, '没有退休金，靠旧关系接济')
    ],
    pressure: {
      level: 5, stress: 3.8, healthDrain: 1.00,
      risks: ['刀伤', '火并', '警方收网', '牢狱'],
      text: '手机里存着几个不愿再联系的名字；听到警笛会下意识摸口袋。'
    },
    promote: ['小弟', '看场', '小头目', '堂口大哥', '洗白老板'],
    top: {
      label: '洗白企业家', desc: '你穿着西装剪彩，旧兄弟在人群外面站着，没人再提从前。',
      cond: function (g) {
        return (g.money.assets >= 800000 && C.badCount(g) <= 3 && C.goodCount(g) >= 1) ||
          (g.job.level >= 4 && g.rep.society >= 55);
      }
    },
    bottom: {
      label: '坐牢', desc: '手铐扣上时，你想起第一次收保护费的那条巷子。',
      cond: function (g) { return flagOn(g, 'c_jail') || flagOn(g, 'c_violence') || C.badCount(g) >= 3; }
    }
  });

  /* =========================================================
     12. 技工
     ========================================================= */
  path({
    id: 'mechanic', name: '技工', jobId: 'mechanic', cat: 'work', tier: 'echo',
    summary: '手上功夫越老越值钱，但机器不认人，一次走神就可能是工伤。',
    entryRoutes: [
      { fork: 'zhongkao', age: 15, route: '职校技工班', note: '免学费，三年出师，18 岁进厂；学历止步中专。' },
      { fork: 'gaokao', age: 18, route: '机电大专', note: '学费每年 5 千，能进正规厂做设备维护，起点更高。' },
      { fork: 'grad', age: 22, route: '工厂技术员 / 汽修', note: '工厂稳定但倒班；汽修自由，旺季能翻倍。' },
      { fork: 'postgrad', age: 25, route: '高级技师 / 技术专家', note: '需要多年工龄和证书，考试通过率不高。' }
    ],
    income: [
      inc(22, 30, 6000, '学徒/初级技工，计件与加班撑着收入'),
      inc(31, 40, 13000, '高级技工，能带徒弟、接私活'),
      inc(41, 55, 17000, '技师/技术骨干，收入到顶'),
      inc(56, 120, 9000, '返聘或开小修理铺，按单收费')
    ],
    pressure: {
      level: 3, stress: 2.4, healthDrain: 0.70,
      risks: ['机械伤害', '粉尘', '噪声', '赶工'],
      text: '车床转起来时不能分神；师傅说，手指头少一根，才知道安全规程不是写给领导看的。'
    },
    promote: ['学徒', '技工', '高级技工', '技师', '高级技师'],
    top: {
      label: '大国工匠', desc: '你打磨的零件装进了国家重点设备，电视镜头扫过你的工位。',
      cond: function (g) {
        return g.job.level >= 3 && g.rep.industry >= 65 && C.goodCount(g) >= 1 && C.badCount(g) <= 1;
      }
    },
    bottom: {
      label: '工伤致残', desc: '机器没有停，手先停了；赔偿单上的数字，换不回原来的手。',
      cond: function (g) { return flagOn(g, 'c_injury') || flagOn(g, 'c_fraud') || C.badCount(g) >= 3; }
    }
  });

  /* =========================================================
     运行时：状态、入职、收入、事件抽取、结局
     ========================================================= */

  C.get = function (id) { return C.PATHS[id] || null; };

  C.init = function (g) {
    if (!g) return null;
    if (!g.career || typeof g.career !== 'object') {
      g.career = {
        path: null, track: null, points: 0, flags: {}, fired: [],
        lastTurn: -99, ending: null, choices: [], incomeLog: []
      };
    }
    var c = g.career;
    c.path = c.path || null;
    c.track = c.track || null;
    c.points = Number(c.points) || 0;
    c.flags = c.flags || {};
    c.fired = c.fired || [];
    c.choices = c.choices || [];
    c.incomeLog = c.incomeLog || [];
    if (c.lastTurn === undefined) c.lastTurn = -99;
    if (!c.path && g.job && g.job.id) c.path = C.inferFromJob(g);
    return c;
  };

  C.pathOf = function (g) {
    var c = C.init(g);
    return (c && c.path && C.PATHS[c.path]) || null;
  };

  C.enter = function (g, pathId, opt) {
    var p = C.PATHS[pathId];
    if (!p || !g) return null;
    var c = C.init(g);
    c.path = pathId;
    c.track = (opt && opt.track) || c.track || null;
    if (opt && opt.since !== undefined) c.since = opt.since;
    else if (!c.since) c.since = g.age;
    if (opt && opt.job && L.JOBS && L.JOBS[p.jobId]) c.jobId = p.jobId;
    return p;
  };

  C.inferFromJob = function (g) {
    if (!g || !g.job) return null;
    var id = g.job.id;
    var direct = {
      doctor: 'doctor', police: 'police', teacher: 'teacher', researcher: 'research',
      taxi: 'taxi', chef: 'chef', shop: 'shop', startup: 'startup',
      engineer: 'engineer', civil: 'civil', gang: 'gang', mechanic: 'mechanic'
    };
    if (id && direct[id]) return direct[id];
    var name = (g.job.title || '') + ' ' + (L.jobName ? L.jobName(id) : '');
    if (/医生|医师|护士/.test(name)) return 'doctor';
    if (/警察|公安|民警/.test(name)) return 'police';
    if (/教师|老师|教授/.test(name)) return 'teacher';
    if (/科研|研究员|博士/.test(name)) return 'research';
    if (/出租|司机|网约|车队/.test(name)) return 'taxi';
    if (/厨师|主厨|后厨/.test(name)) return 'chef';
    if (/店主|个体|小老板|连锁/.test(name)) return 'shop';
    if (/创业|公司|老板/.test(name)) return 'startup';
    if (/工程师|技术员|总工/.test(name)) return 'engineer';
    if (/公务员|科员|处长|局长/.test(name)) return 'civil';
    if (/混混|看场|收账/.test(name)) return 'gang';
    if (/技工|钳工|电工|焊工|技师/.test(name)) return 'mechanic';
    return null;
  };

  C.segmentOf = function (g, p) {
    if (!p) return null;
    var age = g.age || 0;
    for (var i = 0; i < p.income.length; i++) {
      var s = p.income[i];
      if (age >= s.from && age <= s.to) return s;
    }
    return p.income[p.income.length - 1];
  };

  /* 创业收入波动：用年份+回合的确定函数，避免消耗 RNG 状态导致存档漂移 */
  function volatileMul(g, p) {
    if (!p || !p.volatile) return 1;
    var seed = ((g.year || 0) * 37 + (g.turn || 0) * 11) % 100;
    var wave = (seed / 100) * 1.4 - 0.7;
    return 1 + wave;
  }

  C.incomeOf = function (g) {
    var p = C.pathOf(g);
    if (!p || !g.job || !g.job.id) return 0;
    if (g.marks && g.marks.retired) return 0;
    var seg = C.segmentOf(g, p);
    if (!seg) return 0;
    var monthly = seg.monthly * volatileMul(g, p);
    return Math.round(monthly * 12);
  };

  C.applyIncome = function (g, scale) {
    if (g && g.career) C.init(g);
    var yearly = C.incomeOf(g);
    if (!yearly) return 0;
    var s = (scale === undefined || scale === null) ? 1 : Number(scale);
    if (!isFinite(s)) s = 1;
    var add = Math.round(yearly * s);
    g.money.cash += add;
    if (g.money.cash < 0) g.money.cash = 0;
    var c = C.init(g);
    c.incomeLog.push({ turn: g.turn, age: g.age, amount: add });
    if (c.incomeLog.length > 80) c.incomeLog = c.incomeLog.slice(-80);
    return add;
  };

  C.due = function (g) {
    var c = C.init(g);
    if (!c || !c.path) return null;
    var p = C.PATHS[c.path];
    if (!p) return null;
    if (!g || g.death.dead || (g.marks && g.marks.retired)) return null;
    if (g.age < 22 || g.age > 58) return null;
    if (!g.job || !g.job.id) return null;
    if (g.turn - (c.lastTurn === undefined ? -99 : c.lastTurn) < 2) return null;
    var fired = g.fired || [];
    var index = L.EVENT_INDEX || {};
    for (var i = 0; i < p.events.length; i++) {
      var id = p.events[i];
      var ev = index[id];
      if (!ev) continue;
      if (fired.indexOf(id) >= 0) continue;
      var lo = ev.ageMin === undefined ? 22 : ev.ageMin;
      var hi = ev.ageMax === undefined ? 58 : ev.ageMax;
      if (g.age < lo || g.age > hi) continue;
      c.lastTurn = g.turn;
      c.pending = id;
      return ev;
    }
    return null;
  };

  C.applyChoice = function (g, ev, opt) {
    if (!g || !opt) return null;
    var c = C.init(g);
    var data = opt.career || {};
    var pts = Number(data.points) || 0;
    c.points = Math.max(-12, Math.min(12, c.points + pts));
    var flags = data.flags || [];
    for (var i = 0; i < flags.length; i++) {
      if (!flags[i]) continue;
      c.flags[flags[i]] = true;
      g.marks = g.marks || {};
      g.marks[flags[i]] = true;
    }
    if (ev && ev.id) {
      c.choices.push({
        id: ev.id, path: ev.path, kind: ev.kind, label: opt.label,
        points: pts, turn: g.turn, age: g.age
      });
      if (c.choices.length > 40) c.choices = c.choices.slice(-40);
    }
    return c;
  };

  C.endInfo = function (g) {
    var p = C.pathOf(g);
    if (!p) return { key: 'none', label: '无固定职业', text: '这一生没有走进哪一条职业路径。' };
    var topOk = false, botOk = false;
    try { topOk = !!(p.top && p.top.cond && p.top.cond(g)); } catch (e) { topOk = false; }
    try { botOk = !!(p.bottom && p.bottom.cond && p.bottom.cond(g)); } catch (e) { botOk = false; }
    var out;
    if (topOk) out = { key: 'top', label: p.top.label, text: p.top.desc };
    else if (botOk) out = { key: 'bottom', label: p.bottom.label, text: p.bottom.desc };
    else out = { key: 'normal', label: '普通收场', text: '没有大起，也没有大落；你把这份工做到了退休。' };
    if (g.career) g.career.endInfo = out;
    return out;
  };

  C.endLabel = function (g) {
    var info = C.endInfo(g);
    if (g && g.death) g.death.careerEnd = info.label;
    if (g && g.career) g.career.ending = info.label;
    return info.label;
  };

  C.stats = function () {
    var rows = [];
    for (var i = 0; i < C.ORDER.length; i++) {
      var p = C.PATHS[C.ORDER[i]];
      rows.push({ id: p.id, name: p.name, events: p.events.length, jobId: p.jobId });
    }
    return rows;
  };

  C.ensureJobs();
})();
