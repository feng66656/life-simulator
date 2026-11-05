/* =========================================================
   events_career.js — v3.7 职业路径专属事件（96 条）
   依赖：js/careers.js 必须先加载（提供 LS.CAREER.PATHS）
   结构：每条路径 8 条事件 = 道德 3 + 冲突 3 + 突发 2
   选项原则：每个选项都有真实代价，不存在“两边都赢”
   ========================================================= */
(function () {
  'use strict';
  var L = window.LS = window.LS || {};
  var C = L.CAREER;
  if (!C) {
    if (window.console && console.warn) console.warn('[CAREER] careers.js 未加载，职业事件跳过');
    return;
  }

  L.EVENTS = L.EVENTS || [];
  L.EVENT_INDEX = L.EVENT_INDEX || {};

  function O(label, hint, fx, career) {
    fx = fx || {};
    /* 旗标同时写进 fx.set：即使引擎未接入 CAREER.applyChoice，结局判定也能生效 */
    if (career && career.flags && career.flags.length) {
      fx.set = fx.set || {};
      for (var i = 0; i < career.flags.length; i++) {
        var f = career.flags[i];
        if (f && fx.set[f] === undefined) fx.set[f] = true;
      }
    }
    var o = { label: label, hint: hint || '', fx: fx };
    if (career) o.career = career;
    return o;
  }
  function B(points, flag) { return { points: -Math.abs(points), flags: [flag] }; }
  function G(points, flag) { return { points: Math.abs(points), flags: [flag] }; }
  function N(points) { return { points: points || 0, flags: [] }; }

  function E(s) {
    var id = 'car_' + s.path + '_' + s.n;
    var lo = s.ageMin;
    var hi = s.ageMax === undefined ? 58 : s.ageMax;
    var ev = {
      id: id, type: 'career', layer: 'career', family: 'career_' + s.path,
      path: s.path, n: s.n, kind: s.kind, cat: 'work', tier: 'echo',
      prio: 68, weight: 6, stage: null,
      ageMin: lo, ageMax: hi, age: [lo, hi],
      title: s.title, text: s.text, opts: s.opts,
      cond: function (g) {
        var c = C.init(g);
        return !!(c && c.path === s.path);
      }
    };
    L.EVENTS.push(ev);
    L.EVENT_INDEX[id] = ev;
    var p = C.PATHS[s.path];
    if (p) {
      p.events.push(id);
      p.eventCount = p.events.length;
    }
    return ev;
  }

  /* =========================================================
     医生 doctor：26 岁进科，事件从规培期铺到主任期
     ========================================================= */

  E({
    path: 'doctor', n: 1, kind: '道德', ageMin: 26,
    title: '牛皮纸信封',
    text: '腊月二十七，市二院普外科只剩两个值班医生。3 床的老太太术前把你拉到消防通道，塞来一个牛皮纸信封：“大夫，明天您主刀，这是一点心意。”信封里是两沓现金，走廊尽头护士站的灯还亮着。',
    opts: [
      O('收下，明天多照看', '代价：一旦被举报，执业证和名声一起赔进去', {
        money: { cash: 12000 }, at: { stress: 3, happiness: -1 },
        set: { c_bribe: true }, npc: { '患者': { favor: 2 } }
      }, B(2, 'c_bribe')),
      O('原样退回，按排班手术', '代价：得罪家属，术前谈话会被反复刁难', {
        at: { reputation: 4, stress: 2 }
      }, G(2, 'c_clean')),
      O('交给护士长登记上交', '代价：家属觉得你不近人情，主任也会问一句“为什么闹到护士长那里”', {
        at: { reputation: 3, stress: 3 }, rep: { industry: 3, society: 4 },
        set: { c_clean: true }, npc: { '上司': { favor: -2 } }
      }, G(2, 'c_clean'))
    ]
  });

  E({
    path: 'doctor', n: 2, kind: '道德', ageMin: 29,
    title: '老同学的加号',
    text: '门诊叫到第 41 号，门口挤进来一个穿夹克的男人，自称是你高中同学。他说家里老人腹痛三天，没挂上号，想让你“加个号，先看一眼”。外面候诊椅上还有二十多个人，有人已经举着手机在拍。',
    opts: [
      O('给他加号，先看', '代价：外面的人会记住你破坏了秩序', {
        at: { stress: 2, reputation: -2 }, rep: { industry: -1, society: -2 },
        npc: { '朋友': { favor: 3 } }
      }, N(-1)),
      O('拒绝加号，按顺序排队', '代价：同学当场翻脸，以后不再来往', {
        at: { reputation: 3, stress: 2 }, npc: { '朋友': { favor: -4 } }
      }, G(1, 'c_clean')),
      O('让他挂急诊，按急诊流程走', '代价：多花两个小时，你还得替急诊同事解释', {
        at: { stress: 4, health: -1 }, rep: { industry: 2, society: 2 }
      }, N(1))
    ]
  });

  E({
    path: 'doctor', n: 3, kind: '道德', ageMin: 32,
    title: '药企的署名',
    text: '一家器械公司的医学部找到你，拿来一篇写好的综述，只要你挂第一作者，稿费三万，数据他们“已经处理干净”。你知道那组随访数据缺了三分之一的病例。',
    opts: [
      O('署名，拿钱', '代价：文章出问题，第一作者先被查', {
        money: { cash: 30000 }, rep: { industry: 2 }, at: { stress: 2 },
        set: { c_fraud: true }
      }, B(2, 'c_fraud')),
      O('拒绝署名', '代价：公司转去找别人，科室也少了一条“合作资源”', {
        at: { reputation: 3, stress: 1 }, rep: { industry: 2 }
      }, G(2, 'c_clean')),
      O('只挂致谢，不挂作者', '代价：公司不满意，主任觉得你不会做人', {
        rep: { industry: 1 }, at: { stress: 2 }, npc: { '上司': { favor: -1 } }
      }, N(1))
    ]
  });

  E({
    path: 'doctor', n: 4, kind: '冲突', ageMin: 35,
    title: '灵堂堵门',
    text: '术后第三天，病人突发肺栓塞，抢救没回来。家属把灵堂设到科室门口，白布横幅写着“还我亲人”。保安拦在电梯口，主任在电话里说“你先别出面”。',
    opts: [
      O('赔钱私了，尽快平息', '代价：钱从科室奖金里扣，等于默认了过错', {
        money: { cash: -20000 }, at: { stress: 6, reputation: -3 },
        set: { c_coverup: true }
      }, B(1, 'c_coverup')),
      O('报警并申请医疗鉴定', '代价：停职配合调查三个月，收入归零', {
        at: { stress: 8, health: -3 }, rep: { industry: 4, society: 3 },
        set: { c_hero: true }
      }, G(2, 'c_hero')),
      O('躲到值班室，让保安处理', '代价：视频上网后，你成了“不敢露面的大夫”', {
        at: { reputation: -5, stress: 5, happiness: -4 }, set: { c_coverup: true }
      }, B(2, 'c_coverup'))
    ]
  });

  E({
    path: 'doctor', n: 5, kind: '冲突', ageMin: 38,
    title: '补签的术前记录',
    text: '一台胆囊手术出了并发症。主任把你叫进办公室，桌上摊着术前记录：“这里少一个签字，你补一下，时间往前写两天。不然全院都要写检查。”',
    opts: [
      O('照主任说的补签', '代价：真出事，签字的人是你', {
        at: { stress: 5 }, rep: { industry: 2 }, salaryPct: 0.05,
        set: { c_coverup: true }, npc: { '上司': { favor: 3 } }
      }, B(2, 'c_coverup')),
      O('拒绝补签，如实上报', '代价：主任从此把你放在冷板凳上', {
        at: { reputation: 4, stress: 6 }, rep: { industry: 4, society: 2 },
        set: { c_hero: true }, npc: { '上司': { favor: -4 } }
      }, G(3, 'c_hero')),
      O('把记录封存，交给医务科', '代价：两边都不信任你', {
        at: { stress: 7, reputation: 1 }, rep: { industry: 2 },
        npc: { '上司': { favor: -2 } }
      }, N(1))
    ]
  });

  E({
    path: 'doctor', n: 6, kind: '冲突', ageMin: 42,
    title: '匿名举报信',
    text: '纪检部门收到一封匿名信，说你长期收受器械代表回扣。你知道信里有一半是夸大，但去年那顿海鲜宴确实吃了。调查组让你这周交情况说明。',
    opts: [
      O('如实说明，退回不该拿的', '代价：退钱、写检查，年内晋升冻结', {
        money: { cash: -30000 }, at: { stress: 5, reputation: -2 },
        rep: { industry: 2 }, set: { c_clean: true }
      }, G(2, 'c_clean')),
      O('找关系把信压下去', '代价：欠下的人情比钱更难还', {
        money: { cash: -20000 }, at: { stress: 6 },
        set: { c_bribe: true }, npc: { '上司': { favor: 2 } }
      }, B(2, 'c_bribe')),
      O('反诉举报人诽谤', '代价：调查拖上半年，门诊量腰斩', {
        at: { stress: 8, health: -4, reputation: -1 }, set: { c_lawsuit: true }
      }, B(1, 'c_lawsuit'))
    ]
  });

  E({
    path: 'doctor', n: 7, kind: '突发', ageMin: 46,
    title: '第三个夜班',
    text: '你已经连续值了两个夜班，第三个夜班刚过十二点，急诊送来一个脾破裂的车祸伤员，后面还跟着两个腹痛病人。护士说：“主任电话关机，今晚只有你。”',
    opts: [
      O('全部收下，硬撑到天亮', '代价：手在抖，任何一个判断失误都可能是人命', {
        at: { health: -8, stress: 8 }, rep: { industry: 3, society: 4 },
        set: { c_hero: true }
      }, G(2, 'c_hero')),
      O('叫二线，自己先处理最重的', '代价：二线来了会记你一笔，科室排班也更难看', {
        at: { health: -3, stress: 3 }, rep: { industry: -2 }, npc: { '上司': { favor: -2 } }
      }, N(0)),
      O('把一个病人转去兄弟医院', '代价：家属投诉，转运途中风险算在你头上', {
        at: { stress: 4 }, rep: { industry: -2, society: -3 },
        gamble: {
          p: 0.7,
          win: { at: { stress: 1 } },
          lose: { at: { reputation: -5, stress: 6 }, set: { c_coverup: true } },
          winText: '病人平安转院，家属虽然不满，最终没有闹。',
          loseText: '转运途中病情恶化，家属把责任算在你“推病人”上。'
        }
      }, N(-1))
    ]
  });

  E({
    path: 'doctor', n: 8, kind: '突发', ageMin: 50,
    title: '无影灯灭了',
    text: '一台胃癌根治做到一半，手术室突然跳闸，备用电源要三十秒才切进来。血还在渗，麻醉机的电池警报在响。台上的人都在等你说一句话。',
    opts: [
      O('用手捏球囊维持通气，等电来', '代价：三十秒像三十分钟，手臂会酸到发抖', {
        at: { health: -6, stress: 7 }, rep: { industry: 5, society: 5 },
        set: { c_hero: true }
      }, G(3, 'c_hero')),
      O('暂停手术，等电源恢复', '代价：台上多开一分钟，感染和失血风险就多一分', {
        at: { stress: 8 }, rep: { industry: -2 },
        gamble: {
          p: 0.6,
          win: { at: { stress: 2 } },
          lose: { at: { reputation: -6, stress: 8 }, set: { c_coverup: true } },
          winText: '电源及时恢复，病人挺了过来，但术后恢复比预期慢。',
          loseText: '恢复供电太晚，病人出现不可逆的脑损伤。'
        }
      }, N(-1)),
      O('事后把跳闸记录压下来', '代价：设备科不追，家属迟早会追', {
        at: { stress: 5, reputation: -3 }, set: { c_coverup: true }
      }, B(2, 'c_coverup'))
    ]
  });

  /* =========================================================
     警察 police
     ========================================================= */

  E({
    path: 'police', n: 1, kind: '道德', ageMin: 23,
    title: '老同学的车钥匙',
    text: '凌晨一点，城西路口查酒驾。你拦下一辆黑色轿车，车窗摇下来，是高中同桌，满身酒气。他压低声音：“兄弟，就这一次，我明天还要送孩子上学。”执法记录仪的红灯亮着。',
    opts: [
      O('放他走，当没看见', '代价：记录仪和路口监控都在，出事就是徇私枉法', {
        at: { stress: 5, reputation: -2 }, set: { c_coverup: true },
        npc: { '朋友': { favor: 4 } }
      }, B(2, 'c_coverup')),
      O('依法扣车、抽血', '代价：同学当场骂你，往后同学群把你踢出去', {
        at: { reputation: 4, stress: 3 }, rep: { society: 4, industry: 2 },
        set: { c_clean: true }, npc: { '朋友': { favor: -4 } }
      }, G(2, 'c_clean')),
      O('让他叫代驾，车先扣下', '代价：不算完，明天还得面对说情电话', {
        at: { stress: 3 }, rep: { society: 1 },
        set: { c_coverup: true }, npc: { '朋友': { favor: 1 } }
      }, N(-1))
    ]
  });

  E({
    path: 'police', n: 2, kind: '道德', ageMin: 26,
    title: '没人认领的现金',
    text: '端掉一个地下赌场，桌上散着五万多现金，没人承认是自己的。收队时老民警把一沓塞进你包里：“办案经费，大家都这么办。”车里还有两个人看着你。',
    opts: [
      O('全部上交，登记入册', '代价：老民警觉得你不懂事，以后出警没人愿意带你', {
        at: { reputation: 3, stress: 2 }, rep: { society: 3, industry: 3 },
        set: { c_clean: true }, npc: { '同事': { favor: -3 } }
      }, G(2, 'c_clean')),
      O('收下，跟着分', '代价：这笔钱没有账，随时可能变成你的罪证', {
        money: { cash: 25000 }, at: { stress: 4 },
        set: { c_bribe: true }, npc: { '同事': { favor: 3 } }
      }, B(2, 'c_bribe')),
      O('只留一部分当加班费', '代价：不上不下，谁都防着你', {
        money: { cash: 8000 }, at: { stress: 3 }, set: { c_bribe: true }
      }, B(1, 'c_bribe'))
    ]
  });

  E({
    path: 'police', n: 3, kind: '道德', ageMin: 30,
    title: '袭警报告',
    text: '夜宵摊冲突，所里一个老民警把摊主按在地上打，围观的人拍了视频。所长让你写情况说明，定性成“摊主袭警”。你亲眼看见摊主没有还手。',
    opts: [
      O('按所长的意思写', '代价：视频一旦流出去，写报告的人也要被追责', {
        at: { stress: 5 }, rep: { industry: 2 }, set: { c_coverup: true },
        npc: { '上司': { favor: 3 } }
      }, B(2, 'c_coverup')),
      O('如实写，附上视频', '代价：老民警被停职，你在所里被孤立', {
        at: { reputation: 4, stress: 7 }, rep: { society: 5, industry: 2 },
        set: { c_hero: true }, npc: { '同事': { favor: -4 } }
      }, G(3, 'c_hero')),
      O('写成“双方肢体冲突”，模糊过去', '代价：两边都不满意，调查组还会来问第二遍', {
        at: { stress: 4 }, rep: { industry: -1 }
      }, N(0))
    ]
  });

  E({
    path: 'police', n: 4, kind: '冲突', ageMin: 34,
    title: '堵在路口的人群',
    text: '拆迁纠纷，三十多人堵住主干道，老人坐在路中间。上级要求“半小时内恢复通行”，人群里有人喊“警察打人了”。你手里只有一条警戒带。',
    opts: [
      O('强制清场', '代价：只要有人受伤，视频就会剪成你的脸', {
        at: { stress: 8, reputation: -2 }, rep: { society: -3, industry: 3 },
        gamble: {
          p: 0.6,
          win: { rep: { industry: 4 } },
          lose: { at: { reputation: -8 }, set: { c_violence: true } },
          winText: '人群被劝离，通行恢复，上级在会上表扬了你。',
          loseText: '推搡中一名老人摔倒骨折，舆论全部指向你。'
        }
      }, N(1)),
      O('谈判拖延，等街道办来人', '代价：上级记你“执行力不强”', {
        at: { stress: 5 }, rep: { society: 4, industry: -3 }
      }, G(1, 'c_hero')),
      O('站到一边，让协管顶前面', '代价：出事时，现场负责人还是你', {
        at: { stress: 4, reputation: -2 }, set: { c_coverup: true }
      }, B(1, 'c_coverup'))
    ]
  });

  E({
    path: 'police', n: 5, kind: '冲突', ageMin: 38,
    title: '十五秒的视频',
    text: '你在市场整治中推了一个摊贩，摊车翻了，水果滚了一地。十五秒的视频上了本地热搜，标题是“城管式执法”。督察组进驻所里，让你写经过。',
    opts: [
      O('公开道歉，接受处分', '代价：记过一次，两年内不能评优', {
        at: { reputation: 2, stress: 5 }, rep: { society: 4 },
        set: { c_clean: true }
      }, G(1, 'c_clean')),
      O('坚持对方先动手', '代价：完整视频一旦公布，性质就变了', {
        at: { stress: 6, reputation: -2 }, set: { c_coverup: true },
        gamble: {
          p: 0.45,
          win: { rep: { industry: 2 } },
          lose: { at: { reputation: -8 }, set: { c_coverup: true } },
          winText: '另一个角度的视频证明摊贩先动手，你免于处分。',
          loseText: '完整视频显示你先推人，处分升级。'
        }
      }, N(-1)),
      O('找人删视频', '代价：删帖本身会留下新的把柄', {
        money: { cash: -10000 }, at: { stress: 5 }, set: { c_bribe: true }
      }, B(2, 'c_bribe'))
    ]
  });

  E({
    path: 'police', n: 6, kind: '冲突', ageMin: 42,
    title: '不实的出警记录',
    text: '一起入室盗窃没破案，所长让你把出警时间往前改半小时，好对上考核节点。“就是改个时间，没人会查。”记录一旦改，责任就从值班组转到你身上。',
    opts: [
      O('改记录，替所里兜住', '代价：以后所有时间线都以你为准，出事第一个查你', {
        at: { stress: 5 }, rep: { industry: 2 }, set: { c_coverup: true },
        npc: { '上司': { favor: 3 } }
      }, B(2, 'c_coverup')),
      O('拒绝改，按实际时间报', '代价：所长在会上点名批评你“不顾大局”', {
        at: { reputation: 3, stress: 5 }, rep: { industry: 3, society: 2 },
        set: { c_hero: true }, npc: { '上司': { favor: -3 } }
      }, G(2, 'c_hero')),
      O('把记录交给督察备案', '代价：所里从此没人敢跟你交底', {
        at: { stress: 7 }, rep: { industry: 2 }, set: { c_hero: true },
        npc: { '同事': { favor: -3 } }
      }, G(2, 'c_hero'))
    ]
  });

  E({
    path: 'police', n: 7, kind: '突发', ageMin: 46,
    title: '巷子里的刀',
    text: '夜巡到老菜场后面的巷子，两个人影拦住一个外卖员，其中一人手里有刀。增援最快七分钟，巷子只有一米五宽，你身后是刚入职的辅警。',
    opts: [
      O('拔枪警告，正面控制', '代价：近距离对峙，任何动作都可能走火', {
        at: { stress: 9, health: -4 }, rep: { society: 5, industry: 4 },
        set: { c_hero: true },
        gamble: {
          p: 0.65,
          win: { at: { reputation: 3 } },
          lose: { at: { health: -14 }, set: { c_injury: true } },
          winText: '两人弃刀逃跑，外卖员只受了轻伤。',
          loseText: '夺刀时你的小臂被划开，缝了十四针。'
        }
      }, G(3, 'c_hero')),
      O('后退呼叫增援，保持距离', '代价：外卖员可能在你等待的七分钟里出事', {
        at: { stress: 6, reputation: -2 }, rep: { society: -2 },
        gamble: {
          p: 0.7,
          win: { at: { stress: 1 } },
          lose: { at: { reputation: -6, happiness: -5 }, set: { c_coverup: true } },
          winText: '增援赶到，嫌疑人被控制，外卖员没有大碍。',
          loseText: '你等待时，外卖员被捅伤，家属质问你为什么不上前。'
        }
      }, N(-1)),
      O('让辅警盯住，自己绕后堵截', '代价：把新人留在危险位置，出事你要负责', {
        at: { stress: 7 }, rep: { industry: 2 },
        gamble: {
          p: 0.55,
          win: { rep: { industry: 3 }, at: { reputation: 2 } },
          lose: { at: { reputation: -7 }, set: { c_coverup: true } },
          winText: '你从后巷堵住一人，另一人逃跑，外卖员获救。',
          loseText: '辅警被推倒撞到墙角，头部受伤，家属追责。'
        }
      }, N(0))
    ]
  });

  E({
    path: 'police', n: 8, kind: '突发', ageMin: 50,
    title: '摩托车的尾灯',
    text: '凌晨追捕一辆无牌摩托，嫌疑人后座还带着一袋赃物。前方是十字路口，红灯刚亮，摩托没有减速。你的车速已经到七十。',
    opts: [
      O('继续追，别让他进小巷', '代价：十字路口任何一辆车都可能成为终点', {
        at: { stress: 9 }, rep: { industry: 4 },
        gamble: {
          p: 0.55,
          win: { rep: { industry: 4 }, at: { reputation: 3 } },
          lose: { at: { health: -12 }, set: { c_injury: true } },
          winText: '摩托在路口被逼停，人赃并获。',
          loseText: '你的车撞上横向车辆，安全气囊弹出，肋骨断了两根。'
        }
      }, G(2, 'c_hero')),
      O('减速放弃，记下车牌', '代价：嫌疑人跑了，案子可能永远破不了', {
        at: { reputation: -2, stress: 3 }, rep: { industry: -2 }
      }, N(0)),
      O('呼叫前方卡口拦截', '代价：卡口来不及布控，只能赌运气', {
        at: { stress: 4 }, rep: { industry: 1 },
        gamble: {
          p: 0.5,
          win: { rep: { industry: 3 } },
          lose: { at: { reputation: -3 } },
          winText: '卡口在下一个路口截住了摩托。',
          loseText: '嫌疑人拐进城中村，线索断了。'
        }
      }, N(0))
    ]
  });

  /* =========================================================
     教师 teacher
     ========================================================= */

  E({
    path: 'teacher', n: 1, kind: '道德', ageMin: 23,
    title: '座位与购物卡',
    text: '开学第二周，家长在办公室门口等你，手里拎着一个纸袋：“孩子近视，想调第三排。这是一点心意，您别嫌少。”纸袋里是两张一千元的购物卡。',
    opts: [
      O('收下，给孩子调座', '代价：班里其他家长很快会知道', {
        money: { cash: 2000 }, at: { stress: 2, reputation: -2 },
        set: { c_bribe: true }
      }, B(2, 'c_bribe')),
      O('退回购物卡，按身高排座', '代价：家长在家长群里阴阳怪气半个月', {
        at: { reputation: 3, stress: 3 }, rep: { school: 3 },
        set: { c_clean: true }
      }, G(2, 'c_clean')),
      O('交到学校纪检，登记说明', '代价：家长觉得被羞辱，孩子也可能被同学议论', {
        at: { stress: 4 }, rep: { school: 4, society: 2 },
        set: { c_clean: true }
      }, G(2, 'c_clean'))
    ]
  });

  E({
    path: 'teacher', n: 2, kind: '道德', ageMin: 26,
    title: '五十九分',
    text: '期末阅卷，同年级老师把一张 59 分的卷子递给你：“这孩子要是再不及格，家长能闹到教育局。你改一分，没人看得出来。”卷面上主观题的红笔还没干。',
    opts: [
      O('改成 60，卖个人情', '代价：成绩单是正式档案，改分就是造假', {
        at: { stress: 2, reputation: -1 }, set: { c_fraud: true },
        npc: { '同事': { favor: 2 } }
      }, B(2, 'c_fraud')),
      O('不改，让学生补考', '代价：多出一套补考卷，周末还得监考', {
        at: { health: -2, stress: 3 }, rep: { school: 3 },
        set: { c_clean: true }, npc: { '同事': { favor: -2 } }
      }, G(2, 'c_clean')),
      O('把卷子交给年级组长', '代价：同事认定你打小报告', {
        at: { stress: 4, reputation: 2 }, npc: { '同事': { favor: -4 } }
      }, G(1, 'c_clean'))
    ]
  });

  E({
    path: 'teacher', n: 3, kind: '道德', ageMin: 30,
    title: '三百块一小时',
    text: '家长在微信上问：“老师，孩子作文总丢分，您周末能不能单独辅导？三百一小时，现金。”你算了一下，带五个学生，一个周末就能顶半个月工资。',
    opts: [
      O('接，先带三个学生', '代价：有偿补课被查实，评优和编制都保不住', {
        money: { cash: 20000 }, at: { stress: 3 }, set: { c_bribe: true }
      }, B(2, 'c_bribe')),
      O('拒绝，推荐正规机构', '代价：家长觉得你不给面子，孩子也可能转班', {
        at: { reputation: 2, stress: 1 }, rep: { school: 1 },
        set: { c_clean: true }
      }, G(1, 'c_clean')),
      O('免费给两个后进生补', '代价：周末没了，身体先扛不住', {
        at: { health: -4, stress: 4, happiness: 2 }, rep: { school: 4 },
        set: { c_hero: true }
      }, G(2, 'c_hero'))
    ]
  });

  E({
    path: 'teacher', n: 4, kind: '冲突', ageMin: 34,
    title: '校长室里的家长',
    text: '你让三个没交作业的学生在走廊罚站十分钟。其中一个孩子的家长冲进校长室，拍着桌子说这是“变相体罚”，要你当面道歉，否则就发到网上。',
    opts: [
      O('当面道歉，承认方式不当', '代价：班里其他学生会觉得罚站不再算数', {
        at: { reputation: -2, stress: 4 }, rep: { school: -1, society: 2 }
      }, N(1)),
      O('坚持是正常教育管理', '代价：校长要写说明，你会被记为“不会处理家校关系”', {
        at: { stress: 5 }, rep: { school: 2, industry: 1 },
        set: { c_clean: true }
      }, G(1, 'c_clean')),
      O('申请调整班级，避开这个家长', '代价：换班意味着重新磨合，评优也轮不到你', {
        at: { stress: 4, happiness: -2 }, rep: { school: -2 }
      }, N(-1))
    ]
  });

  E({
    path: 'teacher', n: 5, kind: '冲突', ageMin: 38,
    title: '天台上的学生',
    text: '月考成绩出来，初三（7）班一个女生从年级前十掉到四十名。晚自习时她不在座位上，有人看见她往教学楼天台走。你跑到楼梯口，看到她站在栏杆外侧。',
    opts: [
      O('慢慢靠近，跟她说话', '代价：任何一句话说错，都是一辈子的阴影', {
        at: { stress: 9, health: -3 }, rep: { school: 5, society: 5 },
        set: { c_hero: true },
        gamble: {
          p: 0.8,
          win: { at: { happiness: 3 } },
          lose: { at: { happiness: -10, stress: 10 }, set: { c_injury: true } },
          winText: '她哭着翻回栏杆内侧，你把她带回了办公室。',
          loseText: '她情绪失控，你没能拉住，现场成了全校的噩梦。'
        }
      }, G(3, 'c_hero')),
      O('报警并通知家长，等专业救援', '代价：家长赶到前，每一分钟都算在你头上', {
        at: { stress: 7 }, rep: { school: 2 },
        gamble: {
          p: 0.75,
          win: { at: { stress: 1 } },
          lose: { at: { reputation: -8, happiness: -8 }, set: { c_coverup: true } },
          winText: '消防及时赶到，把人救了下来。',
          loseText: '救援到场太晚，家长质问学校为什么没人上去。'
        }
      }, N(0)),
      O('先封锁消息，让班主任处理', '代价：耽误的每一分钟都不可逆', {
        at: { stress: 5, reputation: -3 }, set: { c_coverup: true }
      }, B(2, 'c_coverup'))
    ]
  });

  E({
    path: 'teacher', n: 6, kind: '冲突', ageMin: 42,
    title: '被删掉的课件',
    text: '评优前一周，你做了两个月的公开课课件在共享盘里不见了。管理员记录显示，最后一次打开的人是同组的老教师。他的侄子也在评优名单里。',
    opts: [
      O('熬夜重做一份', '代价：连熬三晚，公开课状态肯定受影响', {
        at: { health: -6, stress: 6 }, rep: { school: 2 },
        set: { c_hero: true }
      }, G(2, 'c_hero')),
      O('向教务处举报', '代价：没有直接证据，同组从此把你当外人', {
        at: { stress: 6 }, rep: { school: 1 }, set: { c_lawsuit: true },
        npc: { '同事': { favor: -4 } }
      }, N(-1)),
      O('忍下来，用旧课件参评', '代价：评优基本没戏', {
        at: { happiness: -4, reputation: -2 }, rep: { school: -2 }
      }, N(-1))
    ]
  });

  E({
    path: 'teacher', n: 7, kind: '突发', ageMin: 46,
    title: '公开课黑屏',
    text: '市级公开课，后排坐满评委。导入视频刚播三十秒，投影仪突然黑屏，教室里的电脑也死机了。你手里只有一支粉笔，台下还有四十个学生和十二个老师。',
    opts: [
      O('脱稿讲，用板书撑完整节课', '代价：节奏会乱，后面准备的活动全废', {
        at: { stress: 7, health: -2 }, rep: { school: 4, industry: 3 },
        set: { c_hero: true }
      }, G(2, 'c_hero')),
      O('提前结束，申请改期', '代价：评委不会再来第二次', {
        at: { stress: 5, reputation: -3 }, rep: { school: -3 }
      }, B(1, 'c_coverup')),
      O('当场说是设备老化，不是自己的问题', '代价：评委只记住你推卸责任', {
        at: { reputation: -2, stress: 3 }, rep: { school: -1 }
      }, N(-1))
    ]
  });

  E({
    path: 'teacher', n: 8, kind: '突发', ageMin: 50,
    title: '少了一个人',
    text: '晚自习点名，班里少了一个男生。同学说他下午被隔壁班的人叫走，可能去了网吧。家长电话已经打到你手机上，声音在发抖。',
    opts: [
      O('立刻骑车沿街找', '代价：夜里找人的风险，全落在你身上', {
        at: { health: -5, stress: 7 }, rep: { school: 3, society: 3 },
        set: { c_hero: true },
        gamble: {
          p: 0.8,
          win: { at: { happiness: 2 } },
          lose: { at: { health: -6, stress: 4 }, set: { c_injury: true } },
          winText: '你在第三家网吧找到了他，把他送回了家。',
          loseText: '你骑车摔进路边施工坑，孩子最后是警察找到的。'
        }
      }, G(2, 'c_hero')),
      O('通知家长和学校，等消息', '代价：家长会觉得你什么都不做', {
        at: { stress: 4, reputation: -2 }, rep: { school: -1 }
      }, N(-1)),
      O('让班长带同学去附近找', '代价：学生出事的责任还是你的', {
        at: { stress: 5 }, set: { c_coverup: true }
      }, B(1, 'c_coverup'))
    ]
  });

  /* =========================================================
     科研 research
     ========================================================= */

  E({
    path: 'research', n: 1, kind: '道德', ageMin: 26,
    title: '不显著的结果',
    text: '材料所 302 实验室，你跑了六个月的实验，p 值停在 0.08。导师看完数据，把椅子转过来：“把异常值剔掉两组，再加一个亚组分析，就能显著。审稿人不会去查原始数据。”',
    opts: [
      O('按导师说的处理数据', '代价：原始记录还在服务器里，随时能被翻出来', {
        at: { stress: 3 }, rep: { industry: 2 }, set: { c_fraud: true }
      }, B(2, 'c_fraud')),
      O('保留完整数据，如实投稿', '代价：论文被拒，导师把资源转给同门', {
        at: { stress: 5, reputation: 2 }, rep: { industry: 1 },
        set: { c_clean: true }, npc: { '上司': { favor: -3 } }
      }, G(2, 'c_clean')),
      O('补做一批实验再决定', '代价：再熬三个月，补助不变', {
        at: { health: -4, stress: 5 }, money: { cash: -5000 },
        set: { c_hero: true }
      }, G(1, 'c_hero'))
    ]
  });

  E({
    path: 'research', n: 2, kind: '道德', ageMin: 29,
    title: '第七作者',
    text: '导师把你挂到一篇你没参与多少的论文上，位置是第七作者。他说这是“团队资源”，评职称时能凑数。你知道真正做实验的那个博士生，连致谢都没进。',
    opts: [
      O('接受署名', '代价：答辩时被问到实验细节，你答不上来', {
        at: { stress: 2 }, rep: { industry: 3 }, set: { c_fraud: true }
      }, B(1, 'c_fraud')),
      O('要求撤名', '代价：导师觉得你不识抬举，下一批项目没你的份', {
        at: { stress: 4, reputation: 2 }, rep: { industry: 1 },
        set: { c_clean: true }, npc: { '上司': { favor: -3 } }
      }, G(2, 'c_clean')),
      O('要求把博士生补进作者名单', '代价：得罪导师，也可能得罪排在前面的作者', {
        at: { stress: 5 }, rep: { industry: 2 },
        set: { c_hero: true }, npc: { '同事': { favor: -2 } }
      }, G(2, 'c_hero'))
    ]
  });

  E({
    path: 'research', n: 3, kind: '道德', ageMin: 32,
    title: '课题组的账',
    text: '课题经费还剩二十万，年底要清零。导师让你把一笔钱做成“测试费”转到合作公司，再以劳务形式发给大家。财务说流程上过得去，但你知道那家公司是导师亲戚开的。',
    opts: [
      O('照办，把钱发下去', '代价：账目经不起审计，经手人写的是你', {
        money: { cash: 8000 }, at: { stress: 4 }, set: { c_fraud: true }
      }, B(2, 'c_fraud')),
      O('拒绝经手，建议按规定结转', '代价：全组的年终劳务没了，你成众矢之的', {
        at: { stress: 5, reputation: 2 }, rep: { industry: 2 },
        set: { c_clean: true }, npc: { '同事': { favor: -3 } }
      }, G(2, 'c_clean')),
      O('把账目备份后匿名举报', '代价：一旦查起来，你在组里待不下去', {
        at: { stress: 8 }, rep: { industry: 3, society: 3 },
        set: { c_hero: true }, gamble: {
          p: 0.6,
          win: { at: { reputation: 2 } },
          lose: { at: { reputation: -6 }, set: { c_fired: true } },
          winText: '审计进驻，导师被处理，你换了一个组。',
          loseText: '举报信被转回所里，你被提前“劝退”。'
        }
      }, G(3, 'c_hero'))
    ]
  });

  E({
    path: 'research', n: 4, kind: '冲突', ageMin: 35,
    title: '抢发的论文',
    text: '你做了两年的方向，昨晚被隔壁高校的团队先发在预印本平台。方法几乎一样，只差一个关键指标。你的论文还在修改，导师在群里只发了一句：“怎么办？”',
    opts: [
      O('改投低一档期刊，先占住成果', '代价：两年工作只能换一篇小文章', {
        at: { stress: 4, reputation: -1 }, rep: { industry: 1 }
      }, N(-1)),
      O('补关键实验，冲顶刊', '代价：再熬半年，期间没有产出', {
        at: { health: -6, stress: 7 }, rep: { industry: 3 },
        set: { c_hero: true }
      }, G(2, 'c_hero')),
      O('联系对方，争取共同署名', '代价：一作没了，以后申请基金要排在别人后面', {
        at: { stress: 3 }, rep: { industry: 2 }
      }, N(0))
    ]
  });

  E({
    path: 'research', n: 5, kind: '冲突', ageMin: 38,
    title: '横向项目的三年',
    text: '导师接了企业横向项目，让你停下博士论文，先去写结题报告。企业催得紧，导师说“毕业不急，这个项目做完给你挂二作”。你已经第三年没有一作论文。',
    opts: [
      O('忍下来，先把项目做完', '代价：毕业延期，青年基金申请年龄不等人', {
        at: { health: -5, stress: 7 }, money: { cash: 6000 },
        npc: { '上司': { favor: 3 } }
      }, N(-1)),
      O('摊牌，要求先保毕业', '代价：导师可能断掉你的实验资源', {
        at: { stress: 6, reputation: 1 }, rep: { industry: 2 },
        set: { c_clean: true }, npc: { '上司': { favor: -4 } }
      }, G(2, 'c_clean')),
      O('联合同门向学院反映', '代价：事情闹大，你在这个圈子里会被贴上“刺头”', {
        at: { stress: 8 }, rep: { industry: 2, society: 2 },
        set: { c_hero: true }, gamble: {
          p: 0.5,
          win: { rep: { industry: 3 } },
          lose: { at: { reputation: -5 }, set: { c_fired: true } },
          winText: '学院介入，导师被要求整改，你换组继续读。',
          loseText: '学院把事压下来，导师提前让你结业走人。'
        }
      }, G(2, 'c_hero'))
    ]
  });

  E({
    path: 'research', n: 6, kind: '冲突', ageMin: 42,
    title: '重复发表的举报',
    text: '期刊编辑部转来一封举报信，说你把同一批数据拆成三篇文章发表。其中两篇确实重叠了对照组。编辑部要求你一周内解释，否则启动撤稿程序。',
    opts: [
      O('主动撤掉重复的一篇', '代价：撤稿记录永久挂在网上，职称评审要解释', {
        at: { reputation: -3, stress: 5 }, rep: { industry: -1 },
        set: { c_clean: true }
      }, G(1, 'c_clean')),
      O('坚称是不同研究', '代价：一旦认定学术不端，整个课题组受牵连', {
        at: { stress: 7 }, set: { c_fraud: true },
        gamble: {
          p: 0.4,
          win: { at: { stress: 2 } },
          lose: { at: { reputation: -8 }, set: { c_fired: true } },
          winText: '编辑部接受了你的解释，只要求加勘误。',
          loseText: '调查认定重复发表，三篇文章全部撤稿。'
        }
      }, B(2, 'c_fraud')),
      O('找关系让编辑部压下来', '代价：欠下的人情，比撤稿更难处理', {
        money: { cash: -20000 }, at: { stress: 4 }, set: { c_bribe: true }
      }, B(1, 'c_bribe'))
    ]
  });

  E({
    path: 'research', n: 7, kind: '突发', ageMin: 46,
    title: '溅进眼睛的试剂',
    text: '晚上十点，通风橱的挡板没拉到位，一瓶氢氟酸在配液时溅出来，几滴进了你的护目镜边缘。眼睛开始刺痛，实验室只剩你一个人。',
    opts: [
      O('立刻冲水十五分钟并就医', '代价：实验中断，样本报废，导师会问损失', {
        at: { health: -3, stress: 3 }, money: { cash: -3000 },
        set: { c_clean: true }
      }, G(1, 'c_clean')),
      O('冲一下，忍到明天再说', '代价：氢氟酸灼伤可能造成永久损伤', {
        at: { health: -10, stress: 5 }, set: { c_coverup: true },
        gamble: {
          p: 0.5,
          win: { at: { health: 3 } },
          lose: { at: { health: -6 }, set: { c_injury: true } },
          winText: '第二天检查只是轻度灼伤，视力没有受影响。',
          loseText: '角膜留下瘢痕，视力永久下降。'
        }
      }, B(2, 'c_coverup')),
      O('先上报，再处理伤口', '代价：实验室被停用整顿一个月，全组进度归零', {
        at: { stress: 6, health: -2 }, rep: { industry: 3, society: 2 },
        set: { c_hero: true }, npc: { '同事': { favor: -3 } }
      }, G(2, 'c_hero'))
    ]
  });

  E({
    path: 'research', n: 8, kind: '突发', ageMin: 50,
    title: '培养箱起火',
    text: '凌晨两点，细胞房的烟感报警。你赶到时，培养箱后面已经冒起黑烟，里面是你三年的细胞株，隔壁还放着别人的样本。走廊的灭火器在十米外。',
    opts: [
      O('先灭火，尽量保住样本', '代价：吸入烟尘，也可能被烧伤', {
        at: { health: -6, stress: 7 }, rep: { industry: 4, society: 3 },
        set: { c_hero: true }
      }, G(3, 'c_hero')),
      O('撤离并按响警铃', '代价：整层样本报废，几年的工作归零', {
        at: { stress: 5, happiness: -6 }, rep: { industry: 2 }
      }, G(1, 'c_clean')),
      O('先抢出数据硬盘再灭火', '代价：火势会在这几十秒里扩大', {
        at: { health: -4, stress: 6 }, rep: { industry: 3 },
        gamble: {
          p: 0.6,
          win: { at: { reputation: 1 } },
          lose: { at: { health: -8, reputation: -3 }, set: { c_injury: true } },
          winText: '你抢出硬盘并扑灭明火，损失被控制在两台设备。',
          loseText: '火势引燃隔壁样本柜，整层实验室停摆半年。'
        }
      }, N(1))
    ]
  });

  /* =========================================================
     出租车司机 taxi
     ========================================================= */

  E({
    path: 'taxi', n: 1, kind: '道德', ageMin: 22,
    title: '导航上的岔路',
    text: '南站拉到一个外地乘客，去老城区一家宾馆。导航显示直走十二公里，你知道绕高架能多跑八公里，多收二十多块。乘客正低头回消息，完全没看路。',
    opts: [
      O('按导航走，不绕路', '代价：少赚二十块，今天份子钱还差一截', {
        at: { reputation: 2 }, set: { c_clean: true }
      }, G(1, 'c_clean')),
      O('绕高架，多赚一笔', '代价：乘客发现后投诉，平台扣分', {
        money: { cash: 30 }, at: { reputation: -2 },
        set: { c_bribe: true }, gamble: {
          p: 0.6,
          win: { at: { stress: 1 } },
          lose: { at: { reputation: -4 }, money: { cash: -200 } },
          winText: '乘客没发现，你多赚了二十多块。',
          loseText: '乘客认出路线，投诉到平台，你被扣了服务分。'
        }
      }, B(1, 'c_bribe')),
      O('先说明堵车，让他自己选', '代价：可能被换到另一辆车', {
        at: { stress: 1 }, rep: { society: 2 }
      }, N(1))
    ]
  });

  E({
    path: 'taxi', n: 2, kind: '道德', ageMin: 25,
    title: '后座的黑钱包',
    text: '收车擦座套时，你在后座缝里摸到一个黑色钱包，里面有八千现金、一张身份证和几张银行卡。失主应该是刚才去医院的乘客，车已经开出去二十分钟。',
    opts: [
      O('交到公司失物招领', '代价：要填表、等失主，少跑两小时车', {
        at: { reputation: 3 }, rep: { society: 3 },
        set: { c_clean: true }
      }, G(2, 'c_clean')),
      O('抽走现金，钱包扔掉', '代价：身份证在包里，警察很快能查到车', {
        money: { cash: 8000 }, at: { stress: 4 },
        set: { c_bribe: true }, gamble: {
          p: 0.55,
          win: { at: { happiness: 1 } },
          lose: { at: { reputation: -7, stress: 5 }, set: { c_jail: true } },
          winText: '没人找来，这笔钱成了你半个月的份子钱。',
          loseText: '失主报警，车队调出监控，你被带进派出所。'
        }
      }, B(2, 'c_bribe')),
      O('按身份证地址送回去', '代价：空驶十几公里，还可能被当成小偷', {
        at: { stress: 2, reputation: 2 }, rep: { society: 3 },
        set: { c_hero: true }
      }, G(2, 'c_hero'))
    ]
  });

  E({
    path: 'taxi', n: 3, kind: '道德', ageMin: 28,
    title: '轮椅上的老人',
    text: '医院门口，一个坐轮椅的老人招手，要去三公里外的康复中心。轮椅折叠后很占后备箱，上下车至少耽误十分钟，这个点正是晚高峰。',
    opts: [
      O('停车，帮他把轮椅搬上去', '代价：少接两单，腰还得再闪一次', {
        at: { health: -2, stress: 2 }, rep: { society: 3, industry: 2 },
        set: { c_hero: true }
      }, G(2, 'c_hero')),
      O('摆手拒载，往前开', '代价：老人可能要在路边等很久', {
        at: { reputation: -2 }, rep: { society: -2 }
      }, N(-1)),
      O('拉，但要加二十块搬运费', '代价：被投诉“趁人之危”，平台可能罚款', {
        money: { cash: 20 }, at: { reputation: -1, stress: 1 },
        set: { c_bribe: true }
      }, B(1, 'c_bribe'))
    ]
  });

  E({
    path: 'taxi', n: 4, kind: '冲突', ageMin: 32,
    title: '没电的手机',
    text: '到了目的地，计价器显示 68 元。乘客掏手机，屏幕黑的：“真没电了，我上楼拿现金，你等我两分钟。”他指的小区没有门禁，楼栋在后面，巷子很深。',
    opts: [
      O('让他上楼取钱，自己等', '代价：他可能从后门走掉，你白等半小时', {
        at: { stress: 2 }, gamble: {
          p: 0.6,
          win: { money: { cash: 68 } },
          lose: { money: { cash: -68 }, at: { reputation: -1 } },
          winText: '乘客真的拿了现金下来，还多给了十块。',
          loseText: '等了二十分钟，人没下来，你连楼栋都记不清。'
        }
      }, N(0)),
      O('报警，让警察来处理', '代价：出警要等，后面几单全耽误', {
        at: { stress: 3, reputation: 1 }, rep: { society: 2 }
      }, N(0)),
      O('扣下他的包，不付钱不放人', '代价：拉扯起来，你先动手就说不清', {
        at: { stress: 3 }, set: { c_violence: true }, gamble: {
          p: 0.5,
          win: { money: { cash: 68 } },
          lose: { at: { reputation: -5 }, money: { cash: -500 } },
          winText: '乘客怕事，扫码付了钱。',
          loseText: '双方扭打，乘客报警，你赔了医药费。'
        }
      }, B(1, 'c_violence'))
    ]
  });

  E({
    path: 'taxi', n: 5, kind: '冲突', ageMin: 36,
    title: '被围住的车',
    text: '机场到达层，三个网约车司机堵住你的车，说你“插队抢单”。其中一人拍着引擎盖，让你下来。后面排队的出租车按喇叭，保安在远处看着。',
    opts: [
      O('下车理论，据理力争', '代价：对方人多，动起手来你吃亏', {
        at: { stress: 6 }, rep: { industry: 2, society: 1 },
        gamble: {
          p: 0.5,
          win: { at: { reputation: 2 } },
          lose: { at: { health: -6 }, set: { c_injury: true } },
          winText: '保安过来拉开，你据理力争，围观的人站在你这边。',
          loseText: '对方先动手，你的眼角被打裂。'
        }
      }, N(1)),
      O('锁车门，倒车离开', '代价：被拍视频说“心虚逃逸”', {
        at: { stress: 3, reputation: -2 }, rep: { industry: -1 }
      }, N(0)),
      O('报警并叫车队的人来', '代价：今天下午基本别想跑了', {
        at: { stress: 4 }, rep: { industry: 2, society: 2 }
      }, G(1, 'c_clean'))
    ]
  });

  E({
    path: 'taxi', n: 6, kind: '冲突', ageMin: 40,
    title: '涨上去的份子钱',
    text: '车队通知，下个月起份子钱从每天 180 涨到 220。理由是“保险和维修成本上涨”。十几个司机在群里骂，但没人敢第一个去找队长。',
    opts: [
      O('接受，继续跑', '代价：一个月少赚一千二，等于白干四天', {
        money: { cash: -8000 }, at: { stress: 3 }
      }, N(0)),
      O('联合几个司机去谈', '代价：谈崩了，队长可能不给你好班次', {
        at: { stress: 6 }, rep: { industry: 3 },
        set: { c_lawsuit: true }, gamble: {
          p: 0.5,
          win: { money: { cash: -2000 } },
          lose: { at: { reputation: -4 }, money: { cash: -12000 } },
          winText: '队长让步，份子钱只涨到 200。',
          loseText: '队长把你们几个排到最差的班次，收入反而更低。'
        }
      }, G(1, 'c_hero')),
      O('退车，去跑网约车', '代价：押金要扣一部分，新车贷还得接着还', {
        money: { cash: -10000 }, at: { stress: 5 }, set: { c_quit_taxi: true }
      }, N(0))
    ]
  });

  E({
    path: 'taxi', n: 7, kind: '突发', ageMin: 44,
    title: '后座的刀',
    text: '深夜从火车站拉到一个男人，说去城郊。开了二十分钟，他从怀里抽出一把折叠刀，抵住你的座椅靠背：“把钱和手机都拿出来，继续开。”路边是一片没灯的仓库区。',
    opts: [
      O('把现金和手机都给他', '代价：今天白干，还可能被逼着继续开', {
        money: { cash: -2000 }, at: { stress: 8, happiness: -5 }
      }, N(0)),
      O('急刹开门跳车', '代价：跳车可能摔伤，车也可能被抢走', {
        at: { stress: 9 }, gamble: {
          p: 0.6,
          win: { at: { health: -2 }, reputation: 2 },
          lose: { at: { health: -10 }, set: { c_injury: true } },
          winText: '你跳车滚进路边草丛，嫌疑人开车跑了，人没事。',
          loseText: '你跳车时头撞上路沿，车也被抢走。'
        }
      }, G(1, 'c_hero')),
      O('假装配合，把车开到派出所门口', '代价：要赌他不敢在派出所附近动手', {
        at: { stress: 9 }, rep: { society: 4, industry: 3 },
        set: { c_hero: true }, gamble: {
          p: 0.55,
          win: { at: { reputation: 3 } },
          lose: { at: { health: -8 }, money: { cash: -3000 }, set: { c_injury: true } },
          winText: '你在派出所门口急停呼救，值班民警冲了出来。',
          loseText: '嫌疑人识破路线，刺伤你的肩膀后逃走。'
        }
      }, G(3, 'c_hero'))
    ]
  });

  E({
    path: 'taxi', n: 8, kind: '突发', ageMin: 48,
    title: '桥下的积水',
    text: '暴雨夜，桥下积水已经没过半个轮胎。乘客赶着去医院，说“冲过去就到了”。前面的水面看不到底，后面还有车在按喇叭。',
    opts: [
      O('掉头绕路，多跑十公里', '代价：乘客嫌慢，可能拒付绕路费', {
        at: { stress: 3 }, money: { cash: 15 }, rep: { society: 2 }
      }, G(1, 'c_clean')),
      O('踩油门冲过去', '代价：熄火进水，发动机大修至少五千', {
        at: { stress: 6 }, gamble: {
          p: 0.55,
          win: { at: { reputation: 1 } },
          lose: { money: { cash: -6000 }, set: { c_debt: true } },
          winText: '车冲过积水，乘客按时到了医院。',
          loseText: '车在积水中间熄火，拖车和维修花掉半个月流水。'
        }
      }, N(0)),
      O('让乘客下车，自己等救援', '代价：乘客投诉，今晚也跑不成了', {
        at: { reputation: -2, stress: 3 }, money: { cash: -200 }
      }, N(-1))
    ]
  });

  /* =========================================================
     厨师 chef
     ========================================================= */

  E({
    path: 'chef', n: 1, kind: '道德', ageMin: 20,
    title: '那桶回锅油',
    text: '老城区福临门酒楼晚市前，老板指着后厨角落一桶颜色发深的油：“滤一滤还能用，今天三十桌，新油来不及。”你闻了一下，已经有明显的哈喇味。',
    opts: [
      O('照老板说的用', '代价：客人吃坏肚子，第一个被查的是掌勺', {
        at: { stress: 2, reputation: -1 }, set: { c_fraud: true },
        money: { cash: 500 }
      }, B(2, 'c_fraud')),
      O('整桶倒掉，换新油', '代价：老板扣你半个月工资', {
        money: { cash: -1500 }, at: { reputation: 3, stress: 2 },
        rep: { industry: 2 }, set: { c_clean: true }
      }, G(2, 'c_clean')),
      O('自己掏钱买一桶新油', '代价：一桶油四百，今天白干', {
        money: { cash: -400 }, at: { stress: 1 },
        set: { c_hero: true }, rep: { industry: 1 }
      }, G(1, 'c_hero'))
    ]
  });

  E({
    path: 'chef', n: 2, kind: '道德', ageMin: 23,
    title: '少二两牛肉',
    text: '老板把你叫到库房，指着电子秤：“牛肉涨到四十一斤，每份少二两，客人吃不出来。一个月能省三千。”外面的点菜单还写着“足量 200 克”。',
    opts: [
      O('照做，每份少二两', '代价：老客吃出来一次，口碑就没了', {
        money: { cash: 300 }, at: { reputation: -2 }, set: { c_fraud: true }
      }, B(2, 'c_fraud')),
      O('不改分量，去跟老板算成本', '代价：老板觉得你多事，排班给你最累的档口', {
        at: { stress: 3 }, rep: { industry: 1 }, set: { c_clean: true },
        npc: { '上司': { favor: -2 } }
      }, G(1, 'c_clean')),
      O('不改，但提醒熟客最近分量可能不稳', '代价：老板知道后，你在店里待不下去', {
        at: { stress: 5 }, rep: { society: 2 },
        set: { c_hero: true }, gamble: {
          p: 0.5,
          win: { at: { reputation: 2 } },
          lose: { at: { reputation: -3 }, set: { c_fired: true } },
          winText: '熟客理解你，老板也没发现。',
          loseText: '熟客转头告诉老板，你被当场辞退。'
        }
      }, G(2, 'c_hero'))
    ]
  });

  E({
    path: 'chef', n: 3, kind: '道德', ageMin: 27,
    title: '带走配方',
    text: '同行新开的川菜馆挖你，工资翻倍，条件是“把福临门的红油配方和供货渠道带过来”。你在这家店干了五年，配方是你跟着老师傅一点点试出来的。',
    opts: [
      O('带配方跳槽', '代价：老板若追责，行业里没人再敢用你', {
        money: { cash: 20000 }, at: { stress: 4 },
        set: { c_fraud: true }, gamble: {
          p: 0.6,
          win: { at: { happiness: 1 } },
          lose: { at: { reputation: -6 }, set: { c_lawsuit: true } },
          winText: '新店生意起来，没人追究配方来源。',
          loseText: '老板起诉你侵犯商业秘密，新店把你推出来顶。'
        }
      }, B(2, 'c_fraud')),
      O('拒绝，留在原店', '代价：翻倍工资没了，老板也未必留你', {
        at: { stress: 3, happiness: -2 }, rep: { industry: 2 },
        set: { c_clean: true }
      }, G(2, 'c_clean')),
      O('只教对方基础做法', '代价：两边都不满意，口碑变得暧昧', {
        at: { stress: 2 }, rep: { industry: 1 }
      }, N(0))
    ]
  });

  E({
    path: 'chef', n: 4, kind: '冲突', ageMin: 31,
    title: '后厨的两把勺',
    text: '晚市最忙的时候，砧板和小弟因为一份配菜吵起来，小弟把菜刀拍在案板上，砧板抄起炒勺。前厅还有四十桌在等菜，厨师长今天休息。',
    opts: [
      O('冲上去拉开两人', '代价：可能被误伤，今天的菜也全乱', {
        at: { health: -3, stress: 5 }, rep: { industry: 2, society: 2 },
        set: { c_hero: true }
      }, G(2, 'c_hero')),
      O('让人去叫厨师长，自己先顶菜', '代价：等厨师长来，两人可能已经打完了', {
        at: { stress: 6, health: -2 }, rep: { industry: 2 }
      }, N(1)),
      O('当没看见，先把自己档口出齐', '代价：出了血，店里所有人都记得你没管', {
        at: { reputation: -2, stress: 3 }, set: { c_coverup: true }
      }, B(1, 'c_coverup'))
    ]
  });

  E({
    path: 'chef', n: 5, kind: '冲突', ageMin: 35,
    title: '欠了三个月的工资',
    text: '老板说资金周转不开，工资再缓一个月。你已经被缓了三次，后厨六个兄弟都在等你的话。供货商今天来堵门，冰柜里的货只够两天。',
    opts: [
      O('带头停工，要求先结工资', '代价：老板可能直接关店，一分钱都拿不到', {
        at: { stress: 7 }, rep: { industry: 3 }, set: { c_lawsuit: true },
        gamble: {
          p: 0.5,
          win: { money: { cash: 12000 } },
          lose: { money: { cash: -8000 }, set: { c_debt: true } },
          winText: '老板借钱结了工资，你们留下继续干。',
          loseText: '老板连夜关店跑路，三个月工资打了水漂。'
        }
      }, G(1, 'c_hero')),
      O('继续干，等老板缓过来', '代价：越欠越多，走的时候更难要', {
        money: { cash: -3000 }, at: { stress: 5, happiness: -3 }
      }, N(-1)),
      O('带着两个徒弟跳槽', '代价：新店也在观望，工资未必更高', {
        money: { cash: 3000 }, at: { stress: 2 }, rep: { industry: 1 }
      }, N(0))
    ]
  });

  E({
    path: 'chef', n: 6, kind: '冲突', ageMin: 39,
    title: '一桌人的呕吐',
    text: '午市刚过，一桌六个人返回店里，说吃完后上吐下泻，要求赔医药费并报警。剩下的菜还在后厨，其中一道凉菜的砧板生熟没分开。',
    opts: [
      O('先赔钱私了，把事压下来', '代价：一旦是群体性食物中毒，私了也压不住', {
        money: { cash: -10000 }, at: { stress: 5, reputation: -2 },
        set: { c_coverup: true }
      }, B(1, 'c_coverup')),
      O('配合调查，封存所有留样', '代价：停业整顿，店里至少半个月没流水', {
        at: { stress: 6 }, rep: { industry: 3, society: 3 },
        set: { c_clean: true }, money: { cash: -3000 }
      }, G(2, 'c_clean')),
      O('把剩菜倒掉，说他们是在别处吃坏的', '代价：监控和留样都在，撒谎会被戳穿', {
        at: { stress: 5 }, set: { c_coverup: true }, gamble: {
          p: 0.4,
          win: { money: { cash: -2000 } },
          lose: { at: { reputation: -7 }, money: { cash: -20000 }, set: { c_jail: true } },
          winText: '对方拿不出证据，最后只赔了医药费。',
          loseText: '市场监管调出监控，认定你销毁证据，罚款并停业。'
        }
      }, B(2, 'c_coverup'))
    ]
  });

  E({
    path: 'chef', n: 7, kind: '突发', ageMin: 43,
    title: '晚市停电',
    text: '周五晚市，三十桌客人，整条街突然停电。燃气灶还能用，但排风、冷柜和收银全停了。前厅经理问你：“还能不能出菜？”',
    opts: [
      O('开应急灯，用燃气灶继续出菜', '代价：油烟排不出去，后厨很快待不住人', {
        at: { health: -4, stress: 6 }, rep: { industry: 3, society: 3 },
        set: { c_hero: true }
      }, G(2, 'c_hero')),
      O('停菜，给客人免单或改期', '代价：今晚损失至少一万五，老板会记在你头上', {
        money: { cash: -15000 }, at: { stress: 3, reputation: 1 }
      }, G(1, 'c_clean')),
      O('只出凉菜和预制菜', '代价：口碑受损，客人觉得你糊弄', {
        at: { reputation: -2, stress: 2 }, money: { cash: -2000 }
      }, N(-1))
    ]
  });

  E({
    path: 'chef', n: 8, kind: '突发', ageMin: 47,
    title: '抽油烟机上的火',
    text: '一口油锅起火，火苗窜上抽油烟机，管道里的油垢被点着。厨房里还有四个学徒，灭火毯挂在门后，燃气总阀在灶台下面。',
    opts: [
      O('先关燃气阀，再用灭火毯压火', '代价：手臂会被火舌扫到', {
        at: { health: -6, stress: 8 }, rep: { industry: 4, society: 3 },
        set: { c_hero: true }
      }, G(3, 'c_hero')),
      O('喊所有人撤出去，等消防', '代价：厨房烧毁，店至少停业三个月', {
        at: { stress: 5, happiness: -4 }, rep: { industry: 1 }
      }, N(0)),
      O('用水泼', '代价：油火遇水会炸开，火势更大', {
        at: { health: -10, stress: 6 }, set: { c_injury: true }, gamble: {
          p: 0.35,
          win: { at: { reputation: 1 } },
          lose: { at: { health: -8, reputation: -5 }, set: { c_coverup: true } },
          winText: '水泼下去火没有扩大，你侥幸把火扑灭。',
          loseText: '油火炸开，你的脸和手臂被烧伤，厨房烧了一半。'
        }
      }, B(2, 'c_injury'))
    ]
  });

  /* =========================================================
     小店老板 shop
     ========================================================= */

  E({
    path: 'shop', n: 1, kind: '道德', ageMin: 22,
    title: '十八块的洗衣液',
    text: '供货商老赵把一箱洗衣液搬进店：“进价十八，正品卖四十二。条码扫不出来，但没人查。”你店里最便宜的牌子也要三十九，街坊买回去给孩子洗校服。',
    opts: [
      O('进货，摆在最里面', '代价：假货出问题，招牌上的电话第一个被打', {
        money: { cash: 3000 }, at: { stress: 2 }, set: { c_fraud: true }
      }, B(2, 'c_fraud')),
      O('原箱退回', '代价：老赵断你的货，旺季少赚一笔', {
        money: { cash: -500 }, at: { reputation: 3 }, rep: { society: 2 },
        set: { c_clean: true }
      }, G(2, 'c_clean')),
      O('只卖给工地，不卖给街坊', '代价：工地用出问题，照样找得到你', {
        money: { cash: 1500 }, at: { stress: 2 }, set: { c_fraud: true }
      }, B(1, 'c_fraud'))
    ]
  });

  E({
    path: 'shop', n: 2, kind: '道德', ageMin: 25,
    title: '记在账上的烟',
    text: '隔壁修车铺的老王拿了两条烟、一箱奶，说月底一起结。月底你翻账本，他已经欠了一千八。他坐在门口喝茶，像什么都没发生。',
    opts: [
      O('继续赊，抹不开面子', '代价：欠账越滚越大，年底可能变成坏账', {
        money: { cash: -1800 }, at: { stress: 3 }, npc: { '朋友': { favor: 2 } }
      }, N(-1)),
      O('当面把账本摊开要钱', '代价：十几年的街坊情分到此为止', {
        money: { cash: 1800 }, at: { stress: 3, reputation: -1 },
        npc: { '朋友': { favor: -3 } }
      }, N(1)),
      O('让他写欠条，约定还款日', '代价：他嘴上答应，心里记你一笔', {
        money: { cash: 900 }, at: { stress: 1 }, rep: { society: 1 },
        npc: { '朋友': { favor: -1 } }
      }, G(1, 'c_clean'))
    ]
  });

  E({
    path: 'shop', n: 3, kind: '道德', ageMin: 29,
    title: '少报三万营业额',
    text: '税务所来核定额，会计压低声音：“熟客都不要发票，少报三万，一年能省六千多。这条街都这么干。”桌上摊着上个月的流水，实际数字比申报多了整整三成。',
    opts: [
      O('按会计说的少报', '代价：查账时补税加滞纳金，可能还要罚', {
        money: { cash: 6000 }, at: { stress: 3 }, set: { c_fraud: true }
      }, B(2, 'c_fraud')),
      O('如实申报，一分不少', '代价：一年多掏六千，街坊笑你死脑筋', {
        money: { cash: -6000 }, at: { reputation: 2 }, rep: { society: 2 },
        set: { c_clean: true }
      }, G(2, 'c_clean')),
      O('把无票收入单独记账，留个底', '代价：账目更麻烦，税还是得补', {
        money: { cash: -3000 }, at: { stress: 2 }, rep: { society: 1 }
      }, N(1))
    ]
  });

  E({
    path: 'shop', n: 4, kind: '冲突', ageMin: 33,
    title: '房东的涨租通知',
    text: '房东把一张打印好的通知拍在收银台上：下季度房租从六千涨到七千八，理由是“隔壁奶茶店出价更高”。你的租约还有八个月到期。',
    opts: [
      O('接受涨租，继续开', '代价：一年多支出一万八，等于白干两个月', {
        money: { cash: -18000 }, at: { stress: 3 }
      }, N(0)),
      O('跟房东谈，签三年长约换涨幅', '代价：把自己绑在这间店三年，想走更难', {
        at: { stress: 4 }, rep: { society: 1 }, gamble: {
          p: 0.55,
          win: { money: { cash: -6000 } },
          lose: { money: { cash: -20000 }, at: { reputation: -2 } },
          winText: '房东同意只涨到六千六，但要求签三年。',
          loseText: '房东不肯让步，你既没谈成，也错过了搬店时机。'
        }
      }, N(0)),
      O('搬到街尾更便宜的门面', '代价：装修和设备搬迁至少三万，老客会丢一半', {
        money: { cash: -30000 }, at: { stress: 5 }, rep: { society: -2 }
      }, N(-1))
    ]
  });

  E({
    path: 'shop', n: 5, kind: '冲突', ageMin: 37,
    title: '隔壁的举报电话',
    text: '市场监管所来查，说有人举报你卖过期食品。货架最里面确实有两箱临期奶，是上个月忘了下架的。隔壁新开的便利店老板站在门口看热闹。',
    opts: [
      O('配合检查，认罚整改', '代价：罚款五千，还要在门口贴整改公示', {
        money: { cash: -5000 }, at: { reputation: -2, stress: 3 },
        set: { c_clean: true }
      }, G(1, 'c_clean')),
      O('找熟人把事压下去', '代价：欠下人情，以后检查只会更勤', {
        money: { cash: -3000 }, at: { stress: 2 }, set: { c_bribe: true }
      }, B(1, 'c_bribe')),
      O('怀疑是隔壁举报，找人去他店里闹', '代价：监控一拍，理亏的成了你', {
        at: { stress: 4 }, set: { c_violence: true }, gamble: {
          p: 0.4,
          win: { at: { reputation: 1 } },
          lose: { money: { cash: -8000 }, at: { reputation: -6 }, set: { c_jail: true } },
          winText: '对方没敢报警，事情不了了之。',
          loseText: '对方报警，你因寻衅滋事被拘留五天。'
        }
      }, B(2, 'c_violence'))
    ]
  });

  E({
    path: 'shop', n: 6, kind: '冲突', ageMin: 41,
    title: '包工头的三万块',
    text: '工地包工头老周拿走了三万的货，记账时说“甲方年底结了就给你”。年底你打电话，他换号了；去工地找，大门锁着，保安说“周老板早走了”。',
    opts: [
      O('去他家堵人', '代价：堵不到人，还可能被当成闹事的', {
        at: { stress: 5 }, set: { c_violence: true }, gamble: {
          p: 0.5,
          win: { money: { cash: 30000 } },
          lose: { at: { reputation: -4, health: -3 }, set: { c_jail: true } },
          winText: '你在他家楼下堵到了人，他当场转了账。',
          loseText: '双方争执，邻居报警，你被带走问话。'
        }
      }, N(0)),
      O('起诉，走法律程序', '代价：律师费五千，执行还要等半年', {
        money: { cash: -5000 }, at: { stress: 5 }, set: { c_lawsuit: true }
      }, G(1, 'c_clean')),
      O('认亏，把账划掉', '代价：三万现金缺口，进货都成问题', {
        money: { cash: -30000 }, at: { stress: 4, happiness: -3 },
        set: { c_debt: true }
      }, B(1, 'c_debt'))
    ]
  });

  E({
    path: 'shop', n: 7, kind: '突发', ageMin: 45,
    title: '水漫过门槛',
    text: '凌晨暴雨，街面排水口堵了，水从卷帘门缝里灌进来。仓库里堆着刚到的两百箱货，最底下一层已经开始泡水。电闸还在门口。',
    opts: [
      O('先断电，再抢搬货物', '代价：泡水的货救不回来，今天也开不了门', {
        at: { health: -4, stress: 5 }, money: { cash: -3000 },
        set: { c_hero: true }
      }, G(2, 'c_hero')),
      O('直接冲进去抢货', '代价：水里有电，可能出事', {
        money: { cash: -1000 }, at: { stress: 6 }, set: { c_injury: true }, gamble: {
          p: 0.6,
          win: { at: { health: -2 } },
          lose: { at: { health: -12 }, set: { c_injury: true } },
          winText: '你抢回了大半货物，只损失了几箱。',
          loseText: '你踩到漏电的插座，被电倒在地。'
        }
      }, N(0)),
      O('等水退，拍照片找保险', '代价：保险理赔慢，错过旺季补货', {
        money: { cash: -5000 }, at: { stress: 3 }
      }, N(-1))
    ]
  });

  E({
    path: 'shop', n: 8, kind: '突发', ageMin: 49,
    title: '被撬开的卷帘门',
    text: '早上六点到店，卷帘门锁被撬，收银台抽屉开着，昨天没存的两千现金和几条烟不见了。后窗也开着，小偷可能还没走远。',
    opts: [
      O('顺着巷子追出去', '代价：对方可能带刀，追上去就是赌命', {
        at: { stress: 6 }, gamble: {
          p: 0.45,
          win: { money: { cash: 1500 }, at: { reputation: 2 } },
          lose: { at: { health: -8 }, set: { c_injury: true } },
          winText: '你在巷口堵住了人，追回了大部分现金。',
          loseText: '对方回身推你，你的后脑磕在台阶上。'
        }
      }, G(1, 'c_hero')),
      O('报警，保护现场', '代价：钱大概率追不回来，还得等笔录', {
        at: { stress: 2 }, rep: { society: 1 }, money: { cash: -2000 }
      }, G(1, 'c_clean')),
      O('先装监控和报警器', '代价：花两千，但今晚还得提心吊胆', {
        money: { cash: -2000 }, at: { stress: 2 }
      }, N(0))
    ]
  });

  /* =========================================================
     创业 startup
     ========================================================= */

  E({
    path: 'startup', n: 1, kind: '道德', ageMin: 24,
    title: 'BP 上的八千日活',
    text: '投资人做尽调，你的后台真实日活是 800，商业计划书写着 8000。对方指着截图问：“这个曲线怎么这么平？”会议室里还有你的两个合伙人。',
    opts: [
      O('咬死数据是真的', '代价：尽调一查后台日志，全穿帮', {
        at: { stress: 5 }, rep: { industry: 2 }, set: { c_fraud: true }, gamble: {
          p: 0.4,
          win: { money: { cash: 500000 }, at: { reputation: 2 } },
          lose: { at: { reputation: -8 }, set: { c_fired: true } },
          winText: '投资人信了，五百万天使轮到账。',
          loseText: '尽调发现后台数据对不上，投资终止，消息传遍圈子。'
        }
      }, B(2, 'c_fraud')),
      O('如实说 800，解释增长逻辑', '代价：这轮融资大概率黄了', {
        at: { stress: 4, reputation: 2 }, rep: { industry: 2 },
        set: { c_clean: true }
      }, G(2, 'c_clean')),
      O('说 8000 是“注册用户”，日活另算', '代价：文字游戏能拖一时，下一轮还要面对', {
        at: { stress: 3 }, rep: { industry: 1 }
      }, N(0))
    ]
  });

  E({
    path: 'startup', n: 2, kind: '道德', ageMin: 27,
    title: '只够发一半的工资',
    text: '账上还剩 18 万，这个月工资要 32 万。供应商的货款也拖了两个月。财务问你：“先发谁？”办公室里二十个人都在等这条消息。',
    opts: [
      O('先发员工，供应商继续拖', '代价：供应商断供，项目下周就得停', {
        money: { cash: -180000 }, at: { stress: 6 }, rep: { industry: 2, society: 2 },
        set: { c_hero: true }, npc: { '同事': { favor: 3 } }
      }, G(2, 'c_hero')),
      O('先还供应商，员工工资发一半', '代价：核心员工当场提离职', {
        money: { cash: -120000 }, at: { stress: 6, reputation: -3 },
        rep: { industry: 1 }, npc: { '同事': { favor: -4 } }
      }, N(-1)),
      O('拖到月底，先稳住所有人', '代价：员工不是傻子，拖一次就没人再信', {
        at: { stress: 7, reputation: -2 }, set: { c_coverup: true }
      }, B(1, 'c_coverup'))
    ]
  });

  E({
    path: 'startup', n: 3, kind: '道德', ageMin: 30,
    title: '大厂带来的源码',
    text: '你从大厂挖来一个技术负责人，他入职第一天就打开一个压缩包：“这是他们那套推荐系统的源码，改改就能用，能省三个月。”你的项目正卡在这个模块上。',
    opts: [
      O('直接用', '代价：代码指纹一查就查到，官司赔不起', {
        at: { stress: 3 }, rep: { industry: 3 }, set: { c_fraud: true },
        gamble: {
          p: 0.55,
          win: { at: { stress: -2 } },
          lose: { money: { cash: -300000 }, set: { c_lawsuit: true } },
          winText: '项目按期上线，没人追究代码来源。',
          loseText: '大厂法务发函，项目下架，赔偿三百万。'
        }
      }, B(2, 'c_fraud')),
      O('封存压缩包，自己重写', '代价：上线推迟三个月，可能错过窗口期', {
        at: { health: -5, stress: 6 }, rep: { industry: 2 },
        set: { c_clean: true }
      }, G(2, 'c_clean')),
      O('只参考架构思路，不复制代码', '代价：边界模糊，团队里有人觉得你胆小', {
        at: { stress: 3 }, rep: { industry: 1 }
      }, N(0))
    ]
  });

  E({
    path: 'startup', n: 4, kind: '冲突', ageMin: 34,
    title: '合伙人要分家',
    text: '合伙人把一份离职协议放在你桌上，要带走运营团队和两个大客户。“股份我可以不要，人和客户我得带走。”他手里还有公司后台的管理员权限。',
    opts: [
      O('花钱买断他的股份', '代价：账上现金被抽走一半，下个月工资又悬了', {
        money: { cash: -200000 }, at: { stress: 6 }
      }, N(0)),
      O('对簿公堂，冻结权限', '代价：官司打一年，公司半年内别想融资', {
        money: { cash: -50000 }, at: { stress: 8, health: -4 },
        set: { c_lawsuit: true }, gamble: {
          p: 0.5,
          win: { rep: { industry: 2 } },
          lose: { money: { cash: -100000 }, at: { reputation: -4 } },
          winText: '法院支持你的诉求，合伙人净身出户。',
          loseText: '官司拖垮现金流，公司被迫裁员一半。'
        }
      }, G(1, 'c_clean')),
      O('各做各的，把业务拆开', '代价：客户被分走，公司规模缩水', {
        money: { cash: -80000 }, at: { stress: 4 }, rep: { industry: -2 }
      }, N(-1))
    ]
  });

  E({
    path: 'startup', n: 5, kind: '冲突', ageMin: 38,
    title: '投资人撤资',
    text: '下一轮谈了三轮，投资人突然发来消息：“大环境不好，这轮先不投了。”账上现金只够两个月，你已经把房子抵押出去。',
    opts: [
      O('裁员一半，砍掉不赚钱的业务', '代价：团队士气崩了，剩下的核心也可能走', {
        money: { cash: -60000 }, at: { stress: 7, reputation: -3 },
        rep: { industry: 1 }, npc: { '同事': { favor: -4 } }
      }, N(0)),
      O('降薪，自己再垫十万', '代价：个人存款见底，失败就一起沉', {
        money: { cash: -100000 }, at: { stress: 8, health: -4 },
        set: { c_hero: true }, npc: { '同事': { favor: 3 } }
      }, G(2, 'c_hero')),
      O('借高利贷撑过这轮', '代价：利息滚起来，失败就是无底洞', {
        money: { cash: 200000, debt: 260000 }, at: { stress: 9 },
        set: { c_debt: true }
      }, B(2, 'c_debt'))
    ]
  });

  E({
    path: 'startup', n: 6, kind: '冲突', ageMin: 42,
    title: '仲裁与坏账',
    text: '同一天收到两份通知：大客户赖掉三十万尾款，两个被裁员工申请劳动仲裁。律师说两件事都得处理，但账上的钱只够应付一件。',
    opts: [
      O('先打客户官司，员工仲裁往后拖', '代价：仲裁败诉要加付赔偿金，口碑也烂了', {
        money: { cash: -20000 }, at: { stress: 7, reputation: -2 },
        set: { c_lawsuit: true }
      }, N(-1)),
      O('先赔员工，客户欠款认亏', '代价：三十万坏账直接压垮现金流', {
        money: { cash: -300000 }, at: { stress: 7, happiness: -4 },
        set: { c_debt: true }
      }, G(1, 'c_clean')),
      O('两边都私了，压低金额', '代价：客户觉得你好欺负，员工也觉得你不可信', {
        money: { cash: -150000 }, at: { stress: 6 }, set: { c_coverup: true }
      }, N(0))
    ]
  });

  E({
    path: 'startup', n: 7, kind: '突发', ageMin: 46,
    title: '凌晨的报警短信',
    text: '凌晨两点，监控系统连发十七条报警：主数据库磁盘写满，订单服务全挂。明天是月度大促，后台还有三十万预付款用户。',
    opts: [
      O('通宵抢修，先恢复服务', '代价：连续工作二十小时，判断力在下降', {
        at: { health: -7, stress: 8 }, rep: { industry: 4 },
        set: { c_hero: true }
      }, G(2, 'c_hero')),
      O('先发公告，承认故障并赔付', '代价：赔付至少五万，品牌受损', {
        money: { cash: -50000 }, at: { stress: 5, reputation: -2 },
        set: { c_clean: true }
      }, G(1, 'c_clean')),
      O('把锅甩给云服务商', '代价：日志一查就知道是你们自己的代码', {
        at: { stress: 4 }, set: { c_coverup: true }, gamble: {
          p: 0.4,
          win: { at: { reputation: 1 } },
          lose: { at: { reputation: -6 }, money: { cash: -100000 } },
          winText: '云服务商确实有部分责任，赔偿谈下来了。',
          loseText: '云服务商公布日志，客户集体退款。'
        }
      }, B(1, 'c_coverup'))
    ]
  });

  E({
    path: 'startup', n: 8, kind: '突发', ageMin: 50,
    title: '一纸新规',
    text: '行业监管新规落地，你们的主营业务被列入许可管理，现有模式三个月内必须整改。账上刚有点起色，团队四十个人等着你决定方向。',
    opts: [
      O('砍掉旧业务，全力转型', '代价：前期投入打水漂，转型失败就全没了', {
        money: { cash: -200000 }, at: { stress: 9 }, gamble: {
          p: 0.45,
          win: { money: { cash: 300000 } },
          lose: { money: { cash: -200000 }, set: { c_debt: true } },
          winText: '新业务拿到许可，半年后扭亏。',
          loseText: '转型方向选错，公司现金流断裂。'
        }
      }, G(1, 'c_hero')),
      O('搬去监管宽松的地区继续做', '代价：灰色地带越走越窄，随时被查', {
        money: { cash: -100000 }, at: { stress: 7 }, set: { c_fraud: true },
        gamble: {
          p: 0.5,
          win: { at: { stress: -2 } },
          lose: { money: { cash: -200000 }, set: { c_jail: true } },
          winText: '新地区暂时没人管，业务继续跑。',
          loseText: '跨省协查，公司被立案，你被限制出境。'
        }
      }, B(2, 'c_fraud')),
      O('关停公司，遣散团队', '代价：几年投入归零，个人还要背债', {
        money: { cash: -150000 }, at: { stress: 6, happiness: -5 },
        set: { c_debt: true }
      }, N(-1))
    ]
  });

  /* =========================================================
     工程师 engineer
     ========================================================= */

  E({
    path: 'engineer', n: 1, kind: '道德', ageMin: 23,
    title: '试块强度不够',
    text: '主体结构验收前，实验室报告显示混凝土试块强度差了 8%。项目经理把报告折起来：“复检来不及，工期压着，你签个字，后面我兜。”你是现场技术员。',
    opts: [
      O('签字放行', '代价：楼是你签的字，出事跑不掉', {
        at: { stress: 4 }, rep: { industry: 2 }, salaryPct: 0.05,
        set: { c_coverup: true }, npc: { '上司': { favor: 3 } }
      }, B(2, 'c_coverup')),
      O('拒签，要求复检', '代价：工期延误，项目经理把你调离', {
        at: { reputation: 3, stress: 5 }, rep: { industry: 3 },
        set: { c_hero: true }, npc: { '上司': { favor: -3 } }
      }, G(2, 'c_hero')),
      O('签，但把复检报告附在后面', '代价：两边都不满意，你成了“留证据的人”', {
        at: { stress: 4 }, rep: { industry: 1 }, set: { c_clean: true }
      }, N(1))
    ]
  });

  E({
    path: 'engineer', n: 2, kind: '道德', ageMin: 26,
    title: '指定品牌',
    text: '钢材供应商把你约到工地外的小饭馆，推来一个信封：“五万，只要你在采购单上把品牌写死。”同规格的另一个品牌每吨便宜三百，质量报告看起来也不差。',
    opts: [
      O('收钱，指定品牌', '代价：材料出问题，采购单上是你的签名', {
        money: { cash: 50000 }, at: { stress: 4 }, set: { c_bribe: true }
      }, B(2, 'c_bribe')),
      O('拒绝，按质量比价', '代价：供应商转头找你的领导，你被换掉', {
        at: { reputation: 3 }, rep: { industry: 3 }, set: { c_clean: true }
      }, G(2, 'c_clean')),
      O('把两家报告交给监理', '代价：事情公开，供应商和领导都记你', {
        at: { stress: 4 }, rep: { industry: 2 }, set: { c_hero: true }
      }, G(2, 'c_hero'))
    ]
  });

  E({
    path: 'engineer', n: 3, kind: '道德', ageMin: 30,
    title: '桥墩上的裂缝',
    text: '例行检查，你在 3 号桥墩侧面发现一条两毫米宽的裂缝，方向是斜的。上报就要停工检测，工期至少拖一个月；不上报，汛期一到谁也不知道会发生什么。',
    opts: [
      O('立即上报，申请停工检测', '代价：停工损失算在项目部，你的年终奖没了', {
        at: { stress: 5, reputation: 3 }, rep: { industry: 4, society: 3 },
        set: { c_hero: true }, money: { cash: -5000 }
      }, G(3, 'c_hero')),
      O('自己带人做表面修补', '代价：掩盖了结构问题，汛期风险更大', {
        money: { cash: -2000 }, at: { stress: 4 }, set: { c_coverup: true },
        gamble: {
          p: 0.5,
          win: { at: { reputation: 1 } },
          lose: { at: { reputation: -8 }, set: { c_jail: true } },
          winText: '修补后观测了三个月，裂缝没有扩展。',
          loseText: '汛期裂缝扩大，桥墩被迫拆除重建。'
        }
      }, B(2, 'c_coverup')),
      O('先记录，等汛期过了再说', '代价：记录留着，责任也留着', {
        at: { stress: 5 }, rep: { industry: 1 }
      }, N(-1))
    ]
  });

  E({
    path: 'engineer', n: 4, kind: '冲突', ageMin: 34,
    title: '村口的路',
    text: '工地要修临时便道，占了村口一块菜地。十几个村民扛着锄头堵在挖掘机前，分包队的工人也不让，双方从骂到推搡，只差动手。',
    opts: [
      O('站出来谈判，先停工', '代价：工期拖一天罚两万，项目部不会替你说话', {
        at: { stress: 6 }, rep: { society: 3, industry: 2 },
        set: { c_hero: true }, money: { cash: -4000 }
      }, G(2, 'c_hero')),
      O('叫保安清场', '代价：一旦有人受伤，就是群体事件', {
        at: { stress: 7 }, set: { c_violence: true }, gamble: {
          p: 0.5,
          win: { at: { reputation: -2 } },
          lose: { at: { reputation: -8 }, set: { c_jail: true } },
          winText: '保安把人架走，便道当天通了。',
          loseText: '推搡中老人摔倒，项目被勒令停工。'
        }
      }, B(2, 'c_violence')),
      O('报警，让警察维持秩序', '代价：警察来了也只能劝，工期照样拖', {
        at: { stress: 3 }, rep: { society: 1 }
      }, N(0))
    ]
  });

  E({
    path: 'engineer', n: 5, kind: '冲突', ageMin: 38,
    title: '事故报告上的名字',
    text: '工地发生脚手架坍塌，两人受伤。项目经理把事故报告推给你：“技术负责人写你，你是现场签字的人。”实际方案是项目经理改的，你提过异议。',
    opts: [
      O('签字，替项目兜住', '代价：事故责任落到你头上，执业资格可能被吊', {
        at: { stress: 7 }, rep: { industry: 1 }, salaryPct: 0.08,
        set: { c_coverup: true }, npc: { '上司': { favor: 3 } }
      }, B(2, 'c_coverup')),
      O('拒绝签字，把异议写进报告', '代价：项目经理翻脸，你在公司待不下去', {
        at: { stress: 7, reputation: 3 }, rep: { industry: 3 },
        set: { c_hero: true }, npc: { '上司': { favor: -4 } }
      }, G(3, 'c_hero')),
      O('签，但私下留一份修改记录', '代价：留着证据，也留着被孤立的理由', {
        at: { stress: 6 }, rep: { industry: 1 }, set: { c_clean: true }
      }, N(1))
    ]
  });

  E({
    path: 'engineer', n: 6, kind: '冲突', ageMin: 42,
    title: '资质挂靠',
    text: '公司用你的注册证挂靠在外省一个项目，你从没去过现场。现在那个项目被举报质量不合格，住建部门要求注册工程师到场说明。',
    opts: [
      O('配合调查，承认挂靠', '代价：罚款、暂停执业，证书可能被吊销', {
        money: { cash: -20000 }, at: { stress: 6, reputation: -2 },
        rep: { industry: -2 }, set: { c_clean: true }
      }, G(1, 'c_clean')),
      O('找关系把记录抹掉', '代价：抹记录的人随时可能反咬一口', {
        money: { cash: -30000 }, at: { stress: 5 }, set: { c_bribe: true }
      }, B(2, 'c_bribe')),
      O('退出项目，辞掉挂靠', '代价：少一笔挂靠费，公司也可能给你穿小鞋', {
        money: { cash: -10000 }, at: { stress: 4 }, set: { c_debt: true }
      }, N(0))
    ]
  });

  E({
    path: 'engineer', n: 7, kind: '突发', ageMin: 46,
    title: '基坑塌了',
    text: '下午四点，深基坑东侧突然塌方，两个正在绑钢筋的工人被埋。现场一片混乱，挖机司机不敢动，围观的人越来越多。',
    opts: [
      O('跳下去组织救援', '代价：二次塌方随时可能把你也埋进去', {
        at: { health: -8, stress: 9 }, rep: { industry: 5, society: 5 },
        set: { c_hero: true }
      }, G(3, 'c_hero')),
      O('封锁现场，等消防和专业救援', '代价：等待的每一分钟都是人命', {
        at: { stress: 8 }, rep: { industry: 2 },
        gamble: {
          p: 0.65,
          win: { at: { stress: 1 } },
          lose: { at: { reputation: -6 }, set: { c_coverup: true } },
          winText: '消防十分钟后赶到，两人被救出，一人重伤。',
          loseText: '救援到场时，一人已经没有了呼吸。'
        }
      }, N(0)),
      O('先让人把监控硬盘拿走', '代价：这一步会被所有人看见', {
        at: { stress: 6 }, set: { c_coverup: true }, gamble: {
          p: 0.4,
          win: { at: { reputation: -1 } },
          lose: { at: { reputation: -9 }, set: { c_jail: true } },
          winText: '监控被提前取走，事故原因查不清。',
          loseText: '有人拍到你搬硬盘，毁灭证据罪加一等。'
        }
      }, B(2, 'c_coverup'))
    ]
  });

  E({
    path: 'engineer', n: 8, kind: '突发', ageMin: 50,
    title: '标高错了三十公分',
    text: '主体已经施工到三层，你复核图纸时发现地下室标高错了三十公分。返工要凿掉两层，损失至少二十万；不改，整栋楼的管线都会撞在一起。',
    opts: [
      O('立即停工，上报返工', '代价：项目部损失二十万，你被记大过', {
        money: { cash: -10000 }, at: { stress: 8, reputation: 2 },
        rep: { industry: 3 }, set: { c_clean: true }
      }, G(1, 'c_clean')),
      O('将错就错，改后续管线', '代价：后期使用和维护都会出问题', {
        at: { stress: 6 }, set: { c_coverup: true }, gamble: {
          p: 0.45,
          win: { at: { reputation: 1 } },
          lose: { money: { cash: -200000 }, set: { c_jail: true } },
          winText: '管线改道勉强通过验收。',
          loseText: '竣工验收时被发现，整栋楼返工，项目停工。'
        }
      }, B(2, 'c_coverup')),
      O('只改图纸，不返工，做局部加固', '代价：加固费用照样不低，责任还在', {
        money: { cash: -8000 }, at: { stress: 5 }, set: { c_coverup: true }
      }, B(1, 'c_coverup'))
    ]
  });

  /* =========================================================
     公务员 civil
     ========================================================= */

  E({
    path: 'civil', n: 1, kind: '道德', ageMin: 23,
    title: '中秋的购物卡',
    text: '一家做工程的企业老板来办事，临走把两张卡压在文件下面：“过节了，给家里买点水果。”每张面值一万。办公室门开着，走廊里有人经过。',
    opts: [
      O('收下，放进抽屉', '代价：这张卡没有记录，但送卡的人有', {
        money: { cash: 20000 }, at: { stress: 3 }, set: { c_bribe: true }
      }, B(2, 'c_bribe')),
      O('当场退回', '代价：事情办不成，对方还会说你“装清高”', {
        at: { reputation: 3 }, rep: { society: 3 }, set: { c_clean: true }
      }, G(2, 'c_clean')),
      O('交到纪检，登记说明', '代价：得罪企业，也被同事视为异类', {
        at: { stress: 4 }, rep: { society: 4, industry: 2 },
        set: { c_clean: true }, npc: { '同事': { favor: -2 } }
      }, G(2, 'c_clean'))
    ]
  });

  E({
    path: 'civil', n: 2, kind: '道德', ageMin: 26,
    title: '老同学的许可',
    text: '老同学开了一家培训机构，消防验收差两项，他拿着材料找你：“就这一次，你打个招呼，后面我补。”这个许可不在你的权限内，但你有熟人。',
    opts: [
      O('打电话打招呼', '代价：一旦出事，第一个被追责的是你', {
        at: { stress: 4 }, rep: { society: 2 }, set: { c_coverup: true },
        npc: { '朋友': { favor: 3 } }
      }, B(2, 'c_coverup')),
      O('拒绝，让他补齐材料', '代价：老同学翻脸，同学群里传你“当官不认人”', {
        at: { reputation: 2 }, rep: { society: 2 }, set: { c_clean: true },
        npc: { '朋友': { favor: -4 } }
      }, G(2, 'c_clean')),
      O('不打招呼，但给他列一份整改清单', '代价：花时间，还落个“不肯通融”的名声', {
        at: { stress: 2 }, rep: { society: 1 }
      }, N(1))
    ]
  });

  E({
    path: 'civil', n: 3, kind: '道德', ageMin: 30,
    title: '再好看一点',
    text: '季度报表出来，领导把材料推回来：“就业数据再好看一点，口径调一调，别太难看。”你负责统计，知道调口径意味着把灵活就业全部算进去。',
    opts: [
      O('按领导意思调口径', '代价：数字好看，基层真实情况被盖住', {
        at: { stress: 3 }, rep: { industry: 2 }, set: { c_fraud: true },
        npc: { '上司': { favor: 3 } }
      }, B(2, 'c_fraud')),
      O('坚持原口径，附上说明', '代价：领导在会上不点名批评你', {
        at: { stress: 5, reputation: 2 }, rep: { industry: 2, society: 3 },
        set: { c_hero: true }, npc: { '上司': { favor: -3 } }
      }, G(2, 'c_hero')),
      O('两个口径都报，让领导自己选', '代价：材料变厚，谁都不满意', {
        at: { stress: 3 }, rep: { industry: 1 }
      }, N(0))
    ]
  });

  E({
    path: 'civil', n: 4, kind: '冲突', ageMin: 34,
    title: '门口的三十个人',
    text: '周一早上，三十多个村民堵在单位门口，举着“还我征地款”的纸牌。领导在楼上开会，让你先下去“把人劝回去”。人群里有人认识你。',
    opts: [
      O('下去认真登记诉求', '代价：领导觉得你把事情搞大，村民也不一定信', {
        at: { stress: 6 }, rep: { society: 4, industry: 1 },
        set: { c_hero: true }, npc: { '上司': { favor: -2 } }
      }, G(2, 'c_hero')),
      O('让保安把人驱散', '代价：有人拍视频，舆情会比你想象的大', {
        at: { stress: 6 }, set: { c_violence: true }, gamble: {
          p: 0.5,
          win: { at: { reputation: -1 } },
          lose: { at: { reputation: -8 }, set: { c_jail: true } },
          winText: '人群被劝离，门口恢复秩序。',
          loseText: '推搡中有人受伤，视频上了热搜。'
        }
      }, B(2, 'c_violence')),
      O('拖着，等领导散会再说', '代价：人越聚越多，最后还是要你处理', {
        at: { stress: 4 }, set: { c_coverup: true }
      }, B(1, 'c_coverup'))
    ]
  });

  E({
    path: 'civil', n: 5, kind: '冲突', ageMin: 38,
    title: '报告上的经办人',
    text: '一个扶贫项目被审计出资金去向不明。领导把你叫到办公室：“报告上经办人写你，你年轻，扛一下，后面我给你补。”你只是按他的批示走的流程。',
    opts: [
      O('签字扛下来', '代价：处分进档案，几年内别想提拔', {
        at: { stress: 7, reputation: -3 }, rep: { industry: 1 },
        set: { c_coverup: true }, npc: { '上司': { favor: 3 } }
      }, B(2, 'c_coverup')),
      O('拒绝，把批示原件交上去', '代价：领导倒台，你在单位也被划成“那一派”', {
        at: { stress: 8 }, rep: { industry: 3, society: 3 },
        set: { c_hero: true }, npc: { '上司': { favor: -5 } }
      }, G(3, 'c_hero')),
      O('写一份模糊的说明，不写自己名字', '代价：审计还会找你第二遍', {
        at: { stress: 5 }, set: { c_coverup: true }
      }, N(-1))
    ]
  });

  E({
    path: 'civil', n: 6, kind: '冲突', ageMin: 42,
    title: '一条烟的旧账',
    text: '同科室的同事被纪检带走，第二天有人来找你谈话。对方提起三年前你收过他一条烟，价值不到一千。你几乎忘了这件事，但谈话记录写得很清楚。',
    opts: [
      O('如实说明，主动退赔', '代价：诫勉谈话，年度考核受影响', {
        money: { cash: -1000 }, at: { stress: 5, reputation: -1 },
        rep: { industry: 1 }, set: { c_clean: true }
      }, G(1, 'c_clean')),
      O('否认，说对方记错了', '代价：谈话记录和送礼人都在，否认只会更糟', {
        at: { stress: 7 }, set: { c_coverup: true }, gamble: {
          p: 0.4,
          win: { at: { stress: 1 } },
          lose: { at: { reputation: -6 }, set: { c_fired: true } },
          winText: '调查没找到更多证据，事情暂时过去。',
          loseText: '送礼人拿出转账记录，你被认定对抗审查。'
        }
      }, B(2, 'c_coverup')),
      O('找关系把记录压下来', '代价：关系越用越薄，下次没人接你电话', {
        money: { cash: -5000 }, at: { stress: 4 }, set: { c_bribe: true }
      }, B(1, 'c_bribe'))
    ]
  });

  E({
    path: 'civil', n: 7, kind: '突发', ageMin: 46,
    title: '凌晨的管涌',
    text: '凌晨三点，暴雨，河堤巡查员打电话说背水坡出现管涌，水带着泥沙往外冒。镇上的应急预案要求“先上报，等指令”，但水势不等人。',
    opts: [
      O('先组织群众转移，同时上报', '代价：擅自行动，事后可能被追责', {
        at: { health: -6, stress: 8 }, rep: { society: 5, industry: 2 },
        set: { c_hero: true }, gamble: {
          p: 0.7,
          win: { at: { reputation: 3 } },
          lose: { at: { reputation: -4 } },
          winText: '群众及时转移，堤坝保住了。',
          loseText: '转移过程混乱，有人摔伤，上级认定你处置不当。'
        }
      }, G(3, 'c_hero')),
      O('严格等指令，先守在堤上', '代价：指令层层上报，可能错过最佳处置时间', {
        at: { stress: 7, health: -3 }, rep: { industry: 2 },
        gamble: {
          p: 0.6,
          win: { at: { stress: 1 } },
          lose: { at: { reputation: -8 }, set: { c_coverup: true } },
          winText: '指令及时下来，抢险队赶到控制了管涌。',
          loseText: '等待期间管涌扩大，下游两个村被淹。'
        }
      }, N(0)),
      O('先拍照留痕，证明自己上报过', '代价：照片留下了，责任也留下了', {
        at: { stress: 5, reputation: -2 }, set: { c_coverup: true }
      }, B(1, 'c_coverup'))
    ]
  });

  E({
    path: 'civil', n: 8, kind: '突发', ageMin: 50,
    title: '被截图的一句话',
    text: '你在协调会上说了一句“群众也要讲道理”，被人截成十五秒视频发上网。标题是“官员训斥群众”。转发已经过万，单位让你两小时内回应。',
    opts: [
      O('完整回应，公布会议记录', '代价：越解释越有人骂，但事实能站住', {
        at: { stress: 7, reputation: 2 }, rep: { society: 3 },
        set: { c_clean: true }
      }, G(1, 'c_clean')),
      O('找人删帖压热度', '代价：删帖记录会被截图，二次舆情更大', {
        money: { cash: -10000 }, at: { stress: 6 }, set: { c_bribe: true },
        gamble: {
          p: 0.45,
          win: { at: { reputation: 1 } },
          lose: { at: { reputation: -8 }, set: { c_fired: true } },
          winText: '热度被压下去，事情慢慢过去。',
          loseText: '删帖操作被曝光，舆情反噬，单位被约谈。'
        }
      }, B(2, 'c_bribe')),
      O('沉默，等风头过去', '代价：沉默会被当成默认', {
        at: { stress: 5, reputation: -3 }, rep: { society: -2 }
      }, N(-1))
    ]
  });

  /* =========================================================
     混混 gang
     ========================================================= */

  E({
    path: 'gang', n: 1, kind: '道德', ageMin: 18,
    title: '烧烤摊的保护费',
    text: '夜市新开了一家烧烤摊，老板是外地人。老大让你去收“管理费”，一个月八百，不给就掀桌子。老板正在给客人上串，抬头看见你身后的两个人。',
    opts: [
      O('按规矩收，不给就掀摊', '代价：一旦动手，派出所就有你的名字', {
        money: { cash: 800 }, at: { stress: 3 }, set: { c_violence: true },
        gamble: {
          p: 0.6,
          win: { at: { reputation: 1 } },
          lose: { at: { reputation: -5 }, set: { c_jail: true } },
          winText: '老板乖乖交了钱，老大夸你会办事。',
          loseText: '老板报警，你被拘留十五天。'
        }
      }, B(2, 'c_violence')),
      O('只谈，不动手', '代价：老大嫌你办事不力，下次不带你了', {
        money: { cash: 400 }, at: { stress: 4 }, rep: { society: 1 },
        npc: { '上司': { favor: -2 } }
      }, N(0)),
      O('放过这家，回去说没收到', '代价：老大迟早会知道，你的话不再算数', {
        at: { stress: 5, reputation: -2 }, npc: { '上司': { favor: -3 } }
      }, G(1, 'c_clean'))
    ]
  });

  E({
    path: 'gang', n: 2, kind: '道德', ageMin: 21,
    title: '替小弟顶罪',
    text: '小弟在酒吧把人打成轻伤，对方家里要报警。老大把你叫到车里：“你去顶一下，伤害案判不了几年。出来给你五十万，家里我照看。”后视镜里，小弟低着头。',
    opts: [
      O('去顶罪', '代价：案底跟你一辈子，出来未必还有位置', {
        money: { cash: 50000 }, at: { stress: 8, happiness: -5 },
        set: { c_jail: true }
      }, B(3, 'c_jail')),
      O('拒绝，让小弟自己去', '代价：小弟记恨你，老大觉得你不忠', {
        at: { stress: 6, reputation: -3 }, set: { c_fired: true },
        npc: { '同事': { favor: -4 } }
      }, N(0)),
      O('连夜跑路，换个城市', '代价：钱没拿到，旧关系全断', {
        money: { cash: -5000 }, at: { stress: 7 }, set: { c_debt: true }
      }, N(-1))
    ]
  });

  E({
    path: 'gang', n: 3, kind: '道德', ageMin: 25,
    title: '警察给的机会',
    text: '一个便衣在茶楼找到你，把一张照片推过来：“你老大下周三要接一批货。你给我们消息，以前的事一笔勾销。”照片上是你手下的一个小弟，被按在车门上，脸贴着玻璃。',
    opts: [
      O('供出老大的时间地点', '代价：道上再没有你的立足之地', {
        at: { stress: 8, reputation: -5 }, rep: { society: 3 },
        set: { c_hero: true }, gamble: {
          p: 0.7,
          win: { at: { reputation: -2 } },
          lose: { at: { reputation: -4 }, set: { c_jail: true } },
          winText: '警方收网成功，你拿到一笔线人费，离开本地。',
          loseText: '老大提前得到消息，你被堵在出租屋里。'
        }
      }, G(2, 'c_hero')),
      O('什么都不说，转身走', '代价：警察盯上你，老大也开始怀疑', {
        at: { stress: 7 }, set: { c_coverup: true }
      }, N(0)),
      O('给假消息，两边拖', '代价：两边都不是傻子，迟早穿帮', {
        at: { stress: 9 }, gamble: {
          p: 0.4,
          win: { at: { stress: -2 } },
          lose: { at: { reputation: -6 }, set: { c_jail: true } },
          winText: '假消息拖住了警方，老大也没起疑。',
          loseText: '警方和老大同时发现你在撒谎，两边都容不下你。'
        }
      }, B(1, 'c_coverup'))
    ]
  });

  E({
    path: 'gang', n: 4, kind: '冲突', ageMin: 29,
    title: '被砸的场子',
    text: '对方堂口带了十几个人，把你看着的台球厅砸了，还留下话：“这条街以后归我们。”老大在外地，电话里只说：“你自己看着办。”',
    opts: [
      O('带人打回去', '代价：刀棍无眼，进医院或进局子都是你', {
        at: { health: -8, stress: 9 }, set: { c_violence: true },
        gamble: {
          p: 0.5,
          win: { rep: { industry: 4 }, at: { reputation: 3 } },
          lose: { at: { health: -14 }, set: { c_jail: true } },
          winText: '你带人把对方赶出这条街，名声起来了。',
          loseText: '混战中你被砍伤，还被警察带走。'
        }
      }, G(2, 'c_violence')),
      O('报警，让警察处理', '代价：道上说你“靠警察”，再没人跟你', {
        at: { reputation: -4, stress: 3 }, rep: { society: 2 }
      }, N(0)),
      O('谈判，让出一条街', '代价：地盘缩水，老大回来要算账', {
        money: { cash: -20000 }, at: { stress: 5 }, rep: { industry: -2 }
      }, N(-1))
    ]
  });

  E({
    path: 'gang', n: 5, kind: '冲突', ageMin: 33,
    title: '老大让收的死人债',
    text: '一个欠了赌债的人跳楼了，家属还在办丧事。老大让你去“把账收回来”，说“人死了账不能死”。灵堂里坐着一屋子人，桌上摆着遗像。',
    opts: [
      O('去灵堂要账', '代价：这事传出去，你在本地就臭了', {
        money: { cash: 15000 }, at: { stress: 7, reputation: -4 },
        set: { c_violence: true }, npc: { '上司': { favor: 3 } }
      }, B(2, 'c_violence')),
      O('回去说收不到', '代价：老大当众骂你，位置保不住', {
        at: { stress: 5, reputation: -2 }, npc: { '上司': { favor: -3 } }
      }, G(1, 'c_clean')),
      O('自己垫钱交差', '代价：一万五打水漂，还落个软弱的印象', {
        money: { cash: -15000 }, at: { stress: 3 }, set: { c_debt: true }
      }, N(0))
    ]
  });

  E({
    path: 'gang', n: 6, kind: '冲突', ageMin: 37,
    title: '收网的晚上',
    text: '晚上十点，你收到消息：警方统一行动，老大和几个头目已经被带走。你手机里有三条未读消息，其中一条是便衣发的：“今晚别出门。”',
    opts: [
      O('连夜跑路', '代价：身份证和银行卡一用就暴露，钱越跑越少', {
        money: { cash: -30000 }, at: { stress: 9 }, set: { c_debt: true },
        gamble: {
          p: 0.45,
          win: { at: { stress: -3 } },
          lose: { at: { reputation: -4 }, set: { c_jail: true } },
          winText: '你逃到外省，换了个名字生活。',
          loseText: '在高速口被拦下，直接押回本地。'
        }
      }, N(0)),
      O('留下自首，争取从轻', '代价：案底留下，几年自由没了', {
        at: { stress: 7, reputation: -3 }, set: { c_jail: true }
      }, G(1, 'c_clean')),
      O('躲到乡下，等风声过去', '代价：没有收入，旧账越积越多', {
        money: { cash: -20000 }, at: { stress: 8 }, set: { c_coverup: true }
      }, N(-1))
    ]
  });

  E({
    path: 'gang', n: 7, kind: '突发', ageMin: 41,
    title: '夜市上的刀',
    text: '你在夜市被两个不认识的人堵住，其中一人从袖子里抽出刀。周围都是桌子，退路只有身后的一条巷子。对方说：“有人让我带句话。”',
    opts: [
      O('转身跑进巷子', '代价：巷子可能是死路，奔跑时背后全是破绽', {
        at: { stress: 9 }, gamble: {
          p: 0.55,
          win: { at: { health: -2 }, reputation: 1 },
          lose: { at: { health: -12 }, set: { c_injury: true } },
          winText: '你熟悉地形，翻墙甩掉了对方。',
          loseText: '你在巷口被追上，后背挨了一刀。'
        }
      }, N(0)),
      O('抄起板凳正面硬拼', '代价：赢了进派出所，输了进医院', {
        at: { health: -8, stress: 9 }, set: { c_violence: true }, gamble: {
          p: 0.5,
          win: { rep: { society: 2 }, at: { reputation: 2 } },
          lose: { at: { health: -15 }, set: { c_jail: true } },
          winText: '你把两人打退，围观的人记住了你。',
          loseText: '你被刀划开手臂，还被警察带走。'
        }
      }, G(1, 'c_violence')),
      O('抱头蹲下，任他们发泄', '代价：可能被打残，但不会出人命', {
        at: { health: -6, reputation: -3, stress: 7 }
      }, N(-1))
    ]
  });

  E({
    path: 'gang', n: 8, kind: '突发', ageMin: 45,
    title: '带走货款的小弟',
    text: '你最信任的小弟带着五万货款失联，手机停机，出租屋也退了。有人说在邻市见过他，正在跟另一帮人吃饭。',
    opts: [
      O('带人追到邻市', '代价：跨市动手，风险翻倍', {
        at: { stress: 8 }, set: { c_violence: true }, gamble: {
          p: 0.5,
          win: { money: { cash: 50000 } },
          lose: { at: { health: -8 }, set: { c_jail: true } },
          winText: '你在饭桌上堵住他，把钱拿了回来。',
          loseText: '对方一帮人围上来，你被打断两根肋骨。'
        }
      }, N(0)),
      O('认亏，把这事压下去', '代价：五万现金缺口，小弟还会拿你当软柿子', {
        money: { cash: -50000 }, at: { stress: 4, reputation: -2 },
        set: { c_debt: true }
      }, B(1, 'c_debt')),
      O('报警，说货款被侵占', '代价：道上从此没人再替你办事', {
        at: { reputation: -4, stress: 3 }, rep: { society: 1 }
      }, G(1, 'c_clean'))
    ]
  });

  /* =========================================================
     技工 mechanic
     ========================================================= */

  E({
    path: 'mechanic', n: 1, kind: '道德', ageMin: 19,
    title: '拆车件',
    text: '客户的车要换变速箱，老板从仓库拖出一台拆车件：“装这个，进价三千，收他八千。客户看不出来。”原厂新件进价六千五，利润只有一千。',
    opts: [
      O('装拆车件，按新件收费', '代价：变速箱再出问题，返工算你的', {
        money: { cash: 2000 }, at: { stress: 2 }, set: { c_fraud: true }
      }, B(2, 'c_fraud')),
      O('拒绝，要求用新件', '代价：老板扣你工时，还把你调去洗车', {
        money: { cash: -500 }, at: { reputation: 2 }, rep: { industry: 1 },
        set: { c_clean: true }, npc: { '上司': { favor: -2 } }
      }, G(2, 'c_clean')),
      O('装拆车件，但告诉客户实情', '代价：客户可能转头就走，老板当场翻脸', {
        at: { stress: 4 }, rep: { society: 2 }, set: { c_hero: true }
      }, G(2, 'c_hero'))
    ]
  });

  E({
    path: 'mechanic', n: 2, kind: '道德', ageMin: 22,
    title: '多加半小时',
    text: '老板把保养工单推给你：“每单工时加 0.5 小时，客户看不出来。一个月多做二十单，多收四千。”墙上的价目表写着“按实际工时结算”。',
    opts: [
      O('照做，每单加半小时', '代价：懂行的客户对一次账，店里就麻烦', {
        money: { cash: 3000 }, at: { stress: 2 }, set: { c_fraud: true }
      }, B(2, 'c_fraud')),
      O('不改工单', '代价：老板觉得你不配合，奖金没了', {
        money: { cash: -1000 }, at: { reputation: 2 }, set: { c_clean: true }
      }, G(1, 'c_clean')),
      O('提醒客户看工单', '代价：老板知道后，你在这家店待不下去', {
        at: { stress: 4 }, rep: { society: 2 }, set: { c_hero: true },
        gamble: {
          p: 0.5,
          win: { at: { reputation: 2 } },
          lose: { at: { reputation: -2 }, set: { c_fired: true } },
          winText: '客户当面核对，老板没敢发作。',
          loseText: '老板找了个由头，把你辞退。'
        }
      }, G(2, 'c_hero'))
    ]
  });

  E({
    path: 'mechanic', n: 3, kind: '道德', ageMin: 26,
    title: '三元催化',
    text: '同事把客户车上的原厂三元催化拆下来，换上一个旧件，说“原厂的能卖两千”。他让你帮忙望风，车库门口就有客户在等车。',
    opts: [
      O('帮忙望风，分一份', '代价：客户验车时发现，监控也在', {
        money: { cash: 1000 }, at: { stress: 3 }, set: { c_fraud: true }
      }, B(2, 'c_fraud')),
      O('阻止他，把件装回去', '代价：同事翻脸，以后处处给你使绊子', {
        at: { stress: 4 }, rep: { industry: 2 }, set: { c_clean: true },
        npc: { '同事': { favor: -3 } }
      }, G(2, 'c_clean')),
      O('直接告诉客户', '代价：店里被查，老板和同事都恨你', {
        at: { stress: 6 }, rep: { society: 3 }, set: { c_hero: true },
        gamble: {
          p: 0.6,
          win: { at: { reputation: 2 } },
          lose: { at: { reputation: -3 }, set: { c_fired: true } },
          winText: '客户当场报警，老板被罚款，你换了一家店。',
          loseText: '老板先下手，把你开除并扣了工资。'
        }
      }, G(3, 'c_hero'))
    ]
  });

  E({
    path: 'mechanic', n: 4, kind: '冲突', ageMin: 30,
    title: '师傅不教的活',
    text: '老师傅把最脏最累的活都派给你，发动机大修的活却从不让你碰。你干了两年，还在换机油。他带的另一个徒弟已经能独立拆变速箱。',
    opts: [
      O('忍着，继续打下手', '代价：再耗两年，手艺还是半吊子', {
        at: { health: -4, stress: 4, happiness: -3 }, rep: { industry: 1 }
      }, N(-1)),
      O('送礼，请师傅吃饭', '代价：花两千，也未必换来真本事', {
        money: { cash: -2000 }, at: { stress: 1 }, npc: { '上司': { favor: 2 } }
      }, B(1, 'c_bribe')),
      O('私下拆报废件练手，晚上偷学', '代价：白天更累，弄坏件还得赔', {
        at: { health: -5, stress: 5 }, money: { cash: -500 },
        set: { c_hero: true }, rep: { industry: 2 }
      }, G(2, 'c_hero'))
    ]
  });

  E({
    path: 'mechanic', n: 5, kind: '冲突', ageMin: 34,
    title: '第二天失灵的刹车',
    text: '你刚保养完的车，第二天车主带着三个人堵在店门口，说刹车踩下去发软，差点追尾。车举起来一看，刹车油管接头有渗油。',
    opts: [
      O('立刻返工，赔礼道歉', '代价：工时白干，还得搭一桶刹车油', {
        money: { cash: -800 }, at: { stress: 3, reputation: 1 },
        set: { c_clean: true }
      }, G(1, 'c_clean')),
      O('推给配件质量，让客户找供货商', '代价：客户把车堵在门口，生意全停', {
        at: { stress: 5, reputation: -3 }, set: { c_coverup: true },
        gamble: {
          p: 0.5,
          win: { at: { stress: 1 } },
          lose: { at: { reputation: -5 }, money: { cash: -5000 } },
          winText: '供货商认了质量问题，赔了新件。',
          loseText: '客户投诉到市场监管，店里被停业整顿。'
        }
      }, B(2, 'c_coverup')),
      O('私了，给两千块让他别声张', '代价：他可能还会回来，也可能带人来', {
        money: { cash: -2000 }, at: { stress: 2 }, set: { c_coverup: true }
      }, B(1, 'c_coverup'))
    ]
  });

  E({
    path: 'mechanic', n: 6, kind: '冲突', ageMin: 38,
    title: '二十块的补胎',
    text: '隔壁新开的修理铺把补胎压到二十块，你这边收四十。一个月下来，补胎的客户几乎全跑了，师傅说“再这样下去，工资都发不出”。',
    opts: [
      O('跟着降价，先留住人', '代价：补胎不赚钱，等于白干', {
        money: { cash: -3000 }, at: { stress: 3 }
      }, N(0)),
      O('不降价，改做发动机和电路', '代价：要买设备、花时间学，短期更亏', {
        money: { cash: -15000 }, at: { stress: 5 }, gamble: {
          p: 0.55,
          win: { rep: { industry: 2 }, money: { cash: 8000 } },
          lose: { money: { cash: -10000 }, at: { reputation: -2 } },
          winText: '高端维修的口碑起来，客单价翻倍。',
          loseText: '新设备吃灰，老客户也没回来。'
        }
      }, G(1, 'c_hero')),
      O('联合附近几家店一起涨价', '代价：有人不守规矩，你先当恶人', {
        at: { stress: 4 }, set: { c_lawsuit: true }
      }, N(-1))
    ]
  });

  E({
    path: 'mechanic', n: 7, kind: '突发', ageMin: 42,
    title: '冲床没有护罩',
    text: '车间赶货，冲床的护罩被拆了，说“影响上料速度”。学徒小刘连续上了十二个小时，一走神，右手被卷进模具。机器还在转。',
    opts: [
      O('立刻拍急停，救人', '代价：手可能保不住，你还得面对家属', {
        at: { health: -4, stress: 9 }, rep: { industry: 4, society: 4 },
        set: { c_hero: true }
      }, G(3, 'c_hero')),
      O('先关电源，再叫救护车', '代价：多耽误几十秒，伤情可能更重', {
        at: { stress: 7 }, rep: { industry: 2 },
        gamble: {
          p: 0.6,
          win: { at: { stress: 1 } },
          lose: { at: { reputation: -5 }, set: { c_coverup: true } },
          winText: '小刘的手保住了，但落下残疾。',
          loseText: '耽误太久，小刘右手截肢。'
        }
      }, N(0)),
      O('先让车间主任来处理，自己躲开', '代价：监控拍到你离开，责任全落你头上', {
        at: { stress: 6 }, set: { c_coverup: true }, gamble: {
          p: 0.4,
          win: { at: { reputation: -1 } },
          lose: { at: { reputation: -8 }, set: { c_jail: true } },
          winText: '主任把事压下来，赔钱了事。',
          loseText: '家属调监控，你因延误救治被追责。'
        }
      }, B(2, 'c_coverup'))
    ]
  });

  E({
    path: 'mechanic', n: 8, kind: '突发', ageMin: 46,
    title: '三千件的急单',
    text: '客户下了三千件急单，要求五天交货。机床已经连轴转了两天，主轴温度报警，师傅说“再这么干，机器要报废”。客户在电话里催第三次。',
    opts: [
      O('停机检修，延期交货', '代价：违约金两万，客户可能不再下单', {
        money: { cash: -20000 }, at: { stress: 4, reputation: 1 },
        set: { c_clean: true }
      }, G(1, 'c_clean')),
      O('继续干，坏了再说', '代价：主轴烧毁，维修费可能比违约金还高', {
        money: { cash: 10000 }, at: { health: -6, stress: 7 },
        gamble: {
          p: 0.5,
          win: { at: { reputation: 2 } },
          lose: { money: { cash: -30000 }, set: { c_debt: true } },
          winText: '机器撑到交货，客户追加了下一单。',
          loseText: '第四天主轴烧死，维修停产半个月。'
        }
      }, N(0)),
      O('偷偷降速，少做一点', '代价：数量不够，客户验货时对不上', {
        at: { stress: 5 }, set: { c_fraud: true }, gamble: {
          p: 0.5,
          win: { money: { cash: 5000 } },
          lose: { money: { cash: -15000 }, at: { reputation: -4 } },
          winText: '客户没细数，蒙混过关。',
          loseText: '验货少了两百件，整批退回。'
        }
      }, B(2, 'c_fraud'))
    ]
  });

})();
