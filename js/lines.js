/* =========================================================
   v3.6 九条人生线 + 身世调查 + 承诺清单
   依赖：state.js / social.js / events*.js（EVENT_INDEX 已建）
   设计事实源：.trae/specs/upgrade-life-sim-v3/storylines-8.md
   ========================================================= */
(function () {
  'use strict';
  var L = window.LS = window.LS || {};
  var EV = L.EVENTS = L.EVENTS || [];
  var IDX = L.EVENT_INDEX = L.EVENT_INDEX || {};

  /* 后加载的事件（v35 / 本文件）补进索引，pending 才能按 id 取到 */
  for (var zi = 0; zi < EV.length; zi++) {
    if (EV[zi] && EV[zi].id && !IDX[EV[zi].id]) IDX[EV[zi].id] = EV[zi];
  }

  function clamp(v, a, b) { return L.clamp ? L.clamp(v, a, b) : Math.max(a, Math.min(b, v)); }
  function chance(p) { return L.chance ? L.chance(p) : Math.random() < p; }
  function randInt(a, b) { return L.randInt ? L.randInt(a, b) : a + Math.floor(Math.random() * (b - a + 1)); }

  /* ---------------- 属性 / 钱 / NPC 小工具 ---------------- */
  function a(g, o) {
    if (!o) return;
    for (var k in o) {
      if (!o.hasOwnProperty(k)) continue;
      if (g.attrs[k] === undefined) continue;
      var floor = (k === 'stress') ? 0 : 1;
      g.attrs[k] = clamp(Math.round(g.attrs[k] + o[k]), floor, 100);
    }
  }
  function m(g, o) {
    if (!o) return;
    if (o.cash) g.money.cash = Math.round(g.money.cash + o.cash);
    if (o.assets) g.money.assets = Math.round(g.money.assets + o.assets);
    if (o.debt) g.money.debt = Math.max(0, Math.round((g.money.debt || 0) + o.debt));
  }
  function npcTouch(g, role, opt) {
    if (!role || !L.getNpc) return null;
    var n = L.getNpc(g, role);
    if (!n && L.ensureNpc) n = L.ensureNpc(g, role, { name: role });
    if (!n) return null;
    if (opt) {
      if (opt.intimacy) n.intimacy = clamp((Number(n.intimacy) || 0) + opt.intimacy, 0, 100);
      if (opt.favor) n.favor = clamp((Number(n.favor) || 0) + opt.favor, -5, 5);
      if (opt.health) n.state && (n.state.health = clamp((Number(n.state.health) || 60) + opt.health, 0, 100));
      if (opt.alive === false) { n.alive = false; n.deathYear = g.year; }
    }
    n.relation = L.relationOf ? L.relationOf(n) : n.relation;
    return n;
  }
  function anchor(g, role, text) {
    var n = npcTouch(g, role);
    if (n && L.addAnchor) L.addAnchor(g, n, 'line', text, 0, 0);
  }
  function partner(g) {
    if (g.family && g.family.marriage && g.family.marriage.spouseId) {
      var sp = L.getNpc(g, g.family.marriage.spouseId);
      if (sp) return sp;
    }
    var n = L.getNpc(g, '配偶') || L.getNpc(g, '伴侣');
    if (n) return n;
    return null;
  }
  function partnerFallback(g) {
    var p = partner(g);
    if (p) return p;
    var best = null;
    (g.npcs || []).forEach(function (n) {
      if (!n.alive) return;
      if (n.gender && n.gender === g.gender) return;
      if ((Number(n.intimacy) || 0) < 55) return;
      if (!best || (Number(n.intimacy) || 0) > (Number(best.intimacy) || 0)) best = n;
    });
    return best;
  }

  /* 行动点：每年 2 点，排查类选项消耗 */
  function resetAP(g) {
    if (!g.lineAP || g.lineAP.year !== g.year) g.lineAP = { year: g.year, used: 0, max: 2 };
  }
  function spendAP(g, n) {
    resetAP(g);
    n = n || 1;
    if (g.lineAP.used + n > g.lineAP.max) return false;
    g.lineAP.used += n;
    return true;
  }

  /* =========================================================
     一、出身抽签（家庭阶层 / 地域 / 隐秘身世卡）
     ========================================================= */
  var CLASSES = ['贫困', '普通', '小康', '富裕', '单亲', '重组家庭', '无父无母', '被收养'];
  var LOCALES = ['城市', '县城', '乡镇', '农村'];
  var SECRETS = [
    {
      id: 's1', name: '医院抱错',
      signs: [
        '学校体检抽血，护士看着化验单又看了你一眼，说血型和你父母的对不上。',
        '远房姨婆喝多了，拍着你的肩说，你小时候跟隔壁床那个孩子换了都不会有人知道。',
        '旧相册最底下压着一张婴儿照，手腕上的手环编号被指甲刮掉了一半。'
      ],
      full: '当年同一间产房里有两个男婴，护士交接时把两个孩子的手环系错了。你的亲生父母姓周，住在邻市。养父母其实早已隐约知道，只是一直不敢说。',
      partial: '档案里确实有一条改过的记录。医院只承认当年的交接有疏漏，再往下问，所有人就都闭了嘴。你知道自己不是在这个家长大的，却没能找到另一个家。',
      fake: '你顺着一条错线查了两年，最后发现对方只是同名同姓。被误认的一家人被你搅得不得安宁，母亲也因此住进了医院。'
    },
    {
      id: 's2', name: '私生子',
      signs: [
        '父亲的“出差”总在同一个城市，每月固定三天，连过年也不改。',
        '一个陌生女人来家里找过父亲，站在楼道里没进门，母亲把门关得很轻。',
        '家谱翻到父亲那一页，堂叔用笔划掉了一个名字，又什么也没说。'
      ],
      full: '父亲在另一座城市还有一段婚姻，那边有一个比你小两岁的孩子。那个女人等了他二十多年，最后只等到一封没有寄出的信。',
      partial: '父亲确实另有一个家庭。但那个孩子并不存在，或者早就夭折了。母亲知道一切，她替你挡了三十年的问话。',
      fake: '所谓“另一个家”只是父亲替同事供养的一户人家。你查到最后，发现自己恨错了人，也伤错了母亲。'
    },
    {
      id: 's3', name: '被收养',
      signs: [
        '家里找不出你的出生证明，只有一张手写的、字迹很陌生的接种卡。',
        '邻居家的小孩问你，你亲妈呢。母亲在厨房里把锅铲停了一下。',
        '每次有人问“你长得像谁”，养父母都会换一个话题。'
      ],
      full: '你三个月大时被现在的父母从福利院抱回。亲生母亲当年十九岁，签了放弃抚养的纸，临走前把你抱了很久。她还活着，一直记得你的生日。',
      partial: '你是被收养的。但福利院的档案缺了一页，没人说得清你从哪里来。养父母只反复说一句：你是我们亲生的。',
      fake: '你查到的那位并不是你的生母，只是当年同院的一个护工。你的追问让一个无辜的老人被邻里议论了半年。'
    },
    {
      id: 's4', name: '双胞胎分离',
      signs: [
        '旧相册里有一张被剪成两半的照片，另一半是一个和你一模一样的婴儿。',
        '母亲说梦话时喊过一个不是你的小名，第二天却说不记得。',
        '接生婆的后人提起，当年那间屋里明明听见了两声哭。'
      ],
      full: '你有一个双胞胎兄弟，出生时因家里养不起被送走。他比你晚出生七分钟，现在在南方做水电工，一直以为自己是被遗弃的。',
      partial: '你确实有过一个同胞。档案里没写是男是女，也没有活下来的记录。你只能确定，这世上曾经有过另一个你。',
      fake: '那张双人照是同院另一对双胞胎的。你认错了人，也把一个陌生人平静的生活搅出了一道口子。'
    },
    {
      id: 's5', name: '父亲并非生父',
      signs: [
        '母亲婚前的照片里总站着一个穿白衬衫的男人，脸被剪掉了。',
        '父亲的体检血型和你矛盾，他看完报告只说了一句，机器也会错。',
        '舅舅喝醉时说，你妈当年不容易，你能长这么大不容易。'
      ],
      full: '你的生父是母亲婚前的恋人，他在你出生前就出了事故。现在的父亲知道一切，还是把你抱回了家，户口本上写下自己的姓。',
      partial: '父亲不是你的生父。母亲只肯说“他早就不在了”，再多一个字都不肯讲。你得到了答案的一半，另一半随她进了土。',
      fake: '你怀疑的那位只是母亲当年的同事。你拿着照片去问，他愣了很久，说那会儿他还在外地。'
    },
    {
      id: 's6', name: '家族旧案',
      signs: [
        '父亲半夜接到一个陌生电话，挂掉后在阳台上站到天亮。',
        '旧报纸上有一则很小的通缉启事，名字和父亲只差一个字。',
        '柜子最上层有一个从不让人碰的铁盒，锁早就锈住了。'
      ],
      full: '三十年前那桩案子，真正动手的人跑了，父亲替他顶了名。那个名字至今还在旧卷宗里。你查到这里，等于把父亲的后半生重新翻了一遍。',
      partial: '父亲确实替人背过一件事。但卷宗缺页，你只知道他替谁背，不知道他背了什么。',
      fake: '你把一个同名的远亲当成了当事人。那位老人已经八十多岁，被你问得在电话里哭了。'
    },
    {
      id: 's7', name: '弃婴',
      signs: [
        '你襁褓里那件小衣服的针脚，和家里所有人的都不一样。',
        '老邻居说漏了嘴：那年冬天，你是在门口被捡到的。',
        '你身份证上的生日，和母亲每年给你过的生日差了几天。'
      ],
      full: '你是在一个冬天的清晨被放在养父母家门口的。襁褓里塞着一张车票和半张写着“对不起”的纸。把你放下的人，是亲生母亲，她那年不到二十岁。',
      partial: '你确实是被人放在门口的。但那半张纸早就丢了，养父母只记得上面有一个外地的地名。',
      fake: '你顺着车票查到一户人家，对方却拿出完整的出生记录。那张车票只是当年有人在那个城市打过工。'
    },
    {
      id: 's8', name: '侨胞外迁后代',
      signs: [
        '家里的旧木箱底压着几封外文信，邮戳上的年份比你父亲还大。',
        '一个自称表舅的人从海外寄来照片，背面写着你家原来的姓。',
        '父亲说过一句：我们本来不姓这个，后来改了。'
      ],
      full: '你的曾祖那一辈从海外迁回，后来因为一场运动改了姓。海外还有一支亲族，一直在找这个姓氏的后人。他们寄来的信，你父亲一封都没回。',
      partial: '家里确实改过姓，也确实有海外亲族。但那边的联系方式早就断了，你只知道有过那么一群人。',
      fake: '你联系上的“亲族”是一个同姓的商会。对方很热情，最后只是想让你入会。'
    }
  ];
  function secretById(id) {
    for (var i = 0; i < SECRETS.length; i++) if (SECRETS[i].id === id) return SECRETS[i];
    return SECRETS[0];
  }

  L.ORIGIN = {
    CLASSES: CLASSES,
    LOCALES: LOCALES,
    SECRETS: SECRETS,
    roll: function () {
      return {
        klass: CLASSES[randInt(0, CLASSES.length - 1)],
        locale: LOCALES[randInt(0, LOCALES.length - 1)],
        secretId: SECRETS[randInt(0, SECRETS.length - 1)].id
      };
    },
    /* 只给界面看的安全描述：隐秘身世永远不提前揭示 */
    publicView: function (g) {
      if (!g || !g.origin) return null;
      return {
        klass: g.origin.klass,
        locale: g.origin.locale,
        secret: g.origin.revealed ? g.origin.name : '?',
        revealed: !!g.origin.revealed
      };
    }
  };

  /* =========================================================
     二、承诺清单（promise / debt / absence）
     每条状态变更都写入 eventLog，回忆录可直接翻旧账
     ========================================================= */
  function pushLog(g, o) {
    if (!L.pushEventLog) return 0;
    return L.pushEventLog(g, {
      turn: g.turn, age: g.age, year: g.year, stage: g.stage,
      tier: 'sys', eventId: o.eventId, title: o.title, source: o.source || 'promise',
      auto: false, resultText: o.text, promiseId: o.promiseId || ''
    });
  }

  L.PROMISE = {
    add: function (g, o) {
      if (!g.promises) g.promises = [];
      var p = {
        id: 'pr' + ((g.promiseSeq = (g.promiseSeq || 0) + 1)),
        npcId: o.npcId || '', npcRole: o.npcRole || '',
        type: o.type || 'promise',
        text: o.text || '',
        madeYear: g.year, dueYear: o.dueYear || (g.year + 3),
        status: 'open', consequence: o.consequence || '',
        lineId: o.lineId || '', queued: false, resolvedYear: null
      };
      g.promises.push(p);
      pushLog(g, {
        eventId: 'promise_add_' + p.id, title: '许下承诺',
        text: g.year + '年你答应了' + (o.who || o.npcRole || '一个人') + '：' + p.text,
        promiseId: p.id
      });
      return p;
    },
    list: function (g, filter) {
      var out = g.promises || [];
      if (!filter) return out.slice();
      return out.filter(function (p) { return p.status === filter; });
    },
    open: function (g) {
      return (g.promises || []).filter(function (p) { return p.status === 'open'; });
    },
    resolve: function (g, p, status, note) {
      if (!p || p.status !== 'open') return;
      p.status = status;
      p.resolvedYear = g.year;
      var kept = status === 'kept';
      var npc = p.npcId ? L.getNpc(g, p.npcId) : (p.npcRole ? L.getNpc(g, p.npcRole) : null);
      if (npc) {
        npc.intimacy = clamp((Number(npc.intimacy) || 0) + (kept ? 8 : -12), 0, 100);
        npc.favor = clamp((Number(npc.favor) || 0) + (kept ? 1 : -2), -5, 5);
        if (L.addAnchor) L.addAnchor(g, npc, kept ? 'promise-kept' : 'promise-broken',
          kept ? ('你兑现了对' + npc.name + '的承诺') : ('你失信于' + npc.name), 0, 0);
      }
      if (!kept) {
        a(g, { happiness: -4, stress: 5 });
        m(g, { cash: -2000 });
        g.identityTag = g.identityTag || '失信的人';
      }
      pushLog(g, {
        eventId: 'promise_' + status + '_' + p.id,
        title: kept ? '承诺兑现' : '承诺失约',
        text: (note || (p.madeYear + '年你答应了' + (p.npcRole || '一个人') + '「' + p.text + '」')) + (kept ? '，你做到了。' : '，你没能做到。'),
        promiseId: p.id, source: 'promise'
      });
      if (L.echoLog) {
        L.echoLog.push({
          year: g.year, age: g.age, lineId: p.lineId,
          text: (kept ? p.madeYear + '年你兑现了答应' + (p.npcRole || '') + '的事：' : p.madeYear + '年你失信了，答应' + (p.npcRole || '') + '的事没做到：') + p.text,
          sourceTitle: kept ? '承诺兑现' : '承诺失约', sourceYear: p.madeYear
        });
      }
      return p;
    },
    /* 到期 → 生成一张真正的“翻旧账”事件，强制执行 */
    tick: function (g) {
      /* 12 岁前不渲染承诺到期：避免幼儿「兑现修水管」类超龄动作 */
      if (g.age < 12) return;
      var due = (g.promises || []).filter(function (p) {
        return p.status === 'open' && !p.queued && g.year >= p.dueYear;
      });
      if (!due.length) return;
      var p = due[0];
      p.queued = true;
      var id = 'promise_due_' + p.id;
      if (!IDX[id]) {
        (function (pp) {
          IDX[id] = {
            id: id, type: 'random', stage: null, tier: 'crossroad', layer: 'chain', weight: 0,
            family: id, prio: 68,
            title: '该兑现的一句话',
            text: pp.madeYear + '年你答应了' + (pp.npcRole || '一个人') + '：' + pp.text + '。' + g.year + '年，期限到了。' +
              (pp.consequence ? '（' + pp.consequence + '）' : ''),
            opts: [
              {
                label: '兑现它', hint: '亲密度 +8 · 压力 +2', tone: 'safe',
                apply: function (g2) {
                  L.PROMISE.resolve(g2, pp, 'kept');
                  a(g2, { stress: 2, happiness: 3 });
                  return '你把这件事办了，心里松了一块。';
                }
              },
              {
                label: '装糊涂', hint: '失信 · 幸福感 -4 · 压力 +5', tone: 'risk',
                apply: function (g2) {
                  L.PROMISE.resolve(g2, pp, 'broken', '你假装忘了');
                  return '你没有提，对方也没有再问。';
                }
              },
              {
                label: '当面说明做不到', hint: '亲密度 -6 · 压力 +3', tone: 'switch',
                apply: function (g2) {
                  L.PROMISE.resolve(g2, pp, 'broken', '你当面说明了难处');
                  a(g2, { stress: 3, happiness: -1 });
                  if (pp.npcRole) npcTouch(g2, pp.npcRole, { intimacy: 4 });
                  return '你把难处说清楚，对方沉默了很久。';
                }
              }
            ],
            cond: function (g2) { return pp.status === 'open'; }
          };
        })(p);
      }
      L.LINES.push(g, id, 0, '你答应过的事到期了', true);
    }
  };

  /* =========================================================
     三、九条线状态机
     ========================================================= */
  var DEFS = [
    { id: 'l1', name: '那封没寄出的信', type: '情感暗线', window: [20, 28], start: 'st_l1_1' },
    { id: 'l2', name: '父亲的账本', type: '家庭暗线', window: [20, 30], start: 'st_l2_1' },
    { id: 'l5', name: '同桌的坠落', type: '友情线', window: [12, 18], start: 'st_l5_1' },
    { id: 'l3', name: '风口上的猪', type: '事业线', window: [20, 34], start: 'st_l3_1' },
    { id: 'l4', name: '楼下的老人', type: '温情线', window: [21, 38], start: 'st_l4_1' },
    { id: 'l6', name: '体检报告上的那个箭头', type: '健康线', window: [26, 42], start: 'st_l6_1' },
    { id: 'l8', name: '深夜的一条消息', type: '诱惑线', window: [24, 52], start: 'st_l8_1' },
    { id: 'l7', name: '老宅拆迁', type: '财富线', window: [28, 52], start: 'st_l7_1' },
    { id: 'l9', name: '被换掉的孩子', type: '身世线', window: null, start: null }
  ];

  function defOf(id) {
    for (var i = 0; i < DEFS.length; i++) if (DEFS[i].id === id) return DEFS[i];
    return null;
  }

  function lineState(g, id) {
    if (!g.lines) g.lines = {};
    if (!g.lines[id]) {
      g.lines[id] = {
        node: 0, points: 0, revealed: false, started: false,
        startedYear: null, lastYear: null, dropped: false, truth: null,
        result: null, moral: 0, extra: {}
      };
    }
    return g.lines[id];
  }

  /* ---------- v3.7 隐藏线收敛：一局只开 1–2 条 ---------- */
  var LINE_IDS = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'l9'];
  /* v3.7：本轮只有完成 5 段弧线（≥4 节点、跨度 ≥10 年）的线可被抽中 */
  var SELECTABLE = ['l1', 'l2', 'l6', 'l9'];

  /* 独立伪随机：只吃 seed，不动 LS.RNG，老档/老测试的随机序列保持原样 */
  function seedRng(seed) {
    var s = ((Number(seed) || 1) ^ 0x9e3779b9) >>> 0;
    if (!s) s = 1;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function lineWeight(g, id) {
    var w = 8;
    var klass = (g.origin && g.origin.klass) || '';
    var loc = (g.origin && g.origin.locale) || '';
    var bp = g.birthplace || '';
    var sec = (g.origin && g.origin.secretId) || '';
    var health = Number(g.attrs && g.attrs.health);
    if (isNaN(health)) health = 60;
    var finance = Number(g.attrs && g.attrs.finance);
    if (isNaN(finance)) finance = 40;
    if (id === 'l1') {
      w = 12;
    } else if (id === 'l2') {
      w = 9;
      if (klass === '贫困') w = 28;
      else if (klass === '工人' || klass === '农民') w = 16;
    } else if (id === 'l3') {
      w = 9;
      if (finance >= 55) w *= 1.5;
    } else if (id === 'l4') {
      w = 8;
      if (loc === '城市' || loc === '县城') w = 20;
      if (/一线|二线/.test(bp)) w *= 1.2;
    } else if (id === 'l5') {
      w = 8;
      if (klass === '贫困' || klass === '工人') w *= 1.3;
    } else if (id === 'l6') {
      w = 7;
      if (health < 55) w = 22;
      else if (health < 68) w = 13;
    } else if (id === 'l7') {
      w = 6;
      if (loc === '农村' || loc === '乡镇') w *= 2.2;
      else if (loc === '县城') w *= 1.4;
    } else if (id === 'l8') {
      w = 10;
      if (klass === '富裕' || klass === '中产') w *= 1.3;
    } else if (id === 'l9') {
      w = 3;
      if (sec === 's1' || sec === 's3' || sec === 's2') w = 15;
      if (klass === '被收养') w *= 2;
    }
    return Math.max(0.5, w);
  }

  /* 加权抽 1–2 条：60% 一条，40% 两条 */
  function selectLines(g) {
    var rnd = seedRng((g.seed || 1) + 7717);
    var count = rnd() < 0.6 ? 1 : 2;
    var pool = [], i;
    for (i = 0; i < SELECTABLE.length; i++) pool.push(SELECTABLE[i]);
    var chosen = [];
    for (var c = 0; c < count && pool.length; c++) {
      var total = 0, ws = [], id;
      for (i = 0; i < pool.length; i++) {
        var w = lineWeight(g, pool[i]);
        ws.push(w); total += w;
      }
      var r = rnd() * total, idx = pool.length - 1;
      for (i = 0; i < pool.length; i++) {
        r -= ws[i];
        if (r <= 0) { idx = i; break; }
      }
      id = pool[idx];
      chosen.push(id);
      pool.splice(idx, 1);
    }
    return chosen;
  }

  function markSelected(g) {
    var sel = Array.isArray(g.selectedLines) ? g.selectedLines : [];
    for (var i = 0; i < DEFS.length; i++) {
      var st = lineState(g, DEFS[i].id);
      st.selected = sel.indexOf(DEFS[i].id) >= 0;
    }
  }

  function matchLine(g, tag) {
    if (!tag) return true;
    var sel = g && g.selectedLines;
    if (!Array.isArray(sel) || !sel.length) return true;
    var parts = String(tag).split('+');
    for (var i = 0; i < parts.length; i++) {
      if (sel.indexOf(parts[i]) < 0) return false;
    }
    return true;
  }

  function isSelected(g, id) {
    var sel = g && g.selectedLines;
    if (!Array.isArray(sel) || !sel.length) return false;
    return sel.indexOf(id) >= 0;
  }

  /* 旧档兼容：没有 selectedLines 时按当前进度推断，绝不删已开的线 */
  function ensureSelected(g) {
    if (!g) return g;
    var valid = [], i;
    if (Array.isArray(g.selectedLines)) {
      for (i = 0; i < g.selectedLines.length && valid.length < 2; i++) {
        var sid = g.selectedLines[i];
        if (LINE_IDS.indexOf(sid) >= 0 && valid.indexOf(sid) < 0) valid.push(sid);
      }
    }
    if (valid.length >= 1) {
      g.selectedLines = valid;
      markSelected(g);
      return g;
    }
    /* 找出已 started 的线，优先推进更深的，最多保留 2 条 */
    var started = [];
    for (i = 0; i < DEFS.length; i++) {
      var st = lineState(g, DEFS[i].id);
      if (st.started) started.push({ id: DEFS[i].id, node: Number(st.node) || 0 });
    }
    started.sort(function (x, y) {
      if (y.node !== x.node) return y.node - x.node;
      return LINE_IDS.indexOf(x.id) - LINE_IDS.indexOf(y.id);
    });
    if (started.length >= 1) {
      var keep = [];
      for (i = 0; i < started.length && keep.length < 2; i++) keep.push(started[i].id);
      g.selectedLines = keep;
    } else {
      var picked = selectLines(g);
      /* 旧档（已推进过回合）只补 1 条，新建档按 60/40 抽 1–2 条（新档 turn=1、日志只有出生一条） */
      var advanced = (Number(g.turn) > 1) || ((g.eventLog || []).length > 1);
      g.selectedLines = advanced ? picked.slice(0, 1) : picked;
    }
    markSelected(g);
    return g;
  }

  L.LINES = {
    DEFS: DEFS,
    select: selectLines,
    match: matchLine,
    selected: isSelected,
    ensureSelected: ensureSelected,
    init: function (g) {
      if (!g) return g;
      if (!g.lines) g.lines = {};
      for (var i = 0; i < DEFS.length; i++) lineState(g, DEFS[i].id);
      if (!g.origin) {
        var r = L.ORIGIN.roll();
        g.origin = {
          klass: r.klass, locale: r.locale, secretId: r.secretId,
          name: secretById(r.secretId).name, revealed: false,
          points: 0, pressure: 0, clueCount: 0, signsSeen: [], wrong: false,
          truth: null
        };
      }
      if (!Array.isArray(g.clues)) g.clues = [];
      if (!Array.isArray(g.promises)) g.promises = [];
      ensureSelected(g);
      resetAP(g);
      return g;
    },
    state: function (g, id) { return lineState(g, id); },
    at: function (g, id, n) {
      var st = lineState(g, id);
      if (!st.selected) return false;
      return st.started && st.node >= (n - 1);
    },
    set: function (g, id, n) {
      var st = lineState(g, id);
      st.node = Math.max(st.node, n);
      st.started = true;
      if (!st.startedYear) st.startedYear = g.year;
      st.lastYear = g.year;
      return st;
    },
    drop: function (g, id) {
      var st = lineState(g, id);
      st.dropped = true;
      st.lastYear = g.year;
      return st;
    },
    reveal: function (g, id, tier) {
      var st = lineState(g, id);
      st.revealed = true;
      st.truth = tier || 'partial';
      if (g.origin) {
        g.origin.revealed = true;
        g.origin.truth = st.truth;
      }
      return st;
    },
    canSpend: spendAP,
    spend: spendAP,
    /* 把后续节点压入 pending，带「当年选择」来源 */
    push: function (g, evId, delay, note, urgent) {
      if (!Array.isArray(g.pending)) g.pending = [];
      var ev = IDX[evId];
      /* v3.7：未选中的线不推 pending，事件永不进入可选池 */
      if (ev && ev.line && !matchLine(g, ev.line)) return;
      /* 同一节点不重复排队：多条征兆/分支可能指向同一后续，重复会挤掉别的线 */
      for (var i = 0; i < g.pending.length; i++) {
        if (g.pending[i].event === evId) return;
      }
      /* v3.7：链节点间隔 2–4 年；0 表示“当年就要答复”（开场/撞车/承诺到期） */
      var raw = Number(delay) || 0;
      var d = raw > 0 ? Math.max(2, Math.min(4, raw)) : 0;
      var c = g._ctxChoice;
      g.pending.push({
        event: evId,
        dueAge: g.age + d,
        urgent: !!urgent,
        note: note || '',
        choiceId: c ? c.key : '',
        choiceAge: c ? c.age : g.age,
        choiceTitle: c ? c.title : '',
        choiceLabel: c ? c.label : '',
        choiceScene: c ? String(c.scene || '').slice(0, 200) : ''
      });
    },
    status: function (g) {
      var out = [];
      for (var i = 0; i < DEFS.length; i++) {
        var st = lineState(g, DEFS[i].id);
        out.push({
          id: DEFS[i].id, name: DEFS[i].name, type: DEFS[i].type,
          node: st.node, points: st.points, revealed: st.revealed,
          started: st.started, dropped: st.dropped, truth: st.truth,
          selected: !!st.selected, result: st.result || null
        });
      }
      return out;
    },
    /* 未揭晓暗线 → 关系网灰点数据（只有本局抽中的线才留灰点） */
    grayDots: function (g) {
      var out = [];
      for (var i = 0; i < DEFS.length; i++) {
        var d = DEFS[i], st = lineState(g, d.id);
        if (!st.selected) continue;
        if (st.revealed || d.id === 'l9' && g.origin && g.origin.revealed) continue;
        if (!st.started && !(d.id === 'l9' && (g.origin && (g.origin.signsSeen || []).length))) continue;
        out.push({ id: d.id, label: '?', name: d.name, type: d.type });
      }
      if (isSelected(g, 'l9') && g.origin && !g.origin.revealed && (g.origin.signsSeen || []).length) {
        var has = false;
        for (var j = 0; j < out.length; j++) if (out[j].id === 'l9') has = true;
        if (!has) out.push({ id: 'l9', label: '?', name: '未解的出身', type: '身世线' });
      }
      return out;
    }
  };

  function lineTick(g) {
    L.LINES.init(g);
    resetAP(g);
    /* v3.7：未选中的线既不推进也不排队，先把旧档里残留的 pending 清掉 */
    prunePending(g);
    /* 1) 启动窗口：只给本局抽中的线开线，到年份必开 */
    var pendingIds = {};
    (g.pending || []).forEach(function (p) { pendingIds[p.event] = true; });
    var sel = g.selectedLines || [];
    for (var i = 0; i < DEFS.length; i++) {
      var d = DEFS[i];
      if (!d.start) continue;
      if (sel.indexOf(d.id) < 0) continue;
      var st = lineState(g, d.id);
      if (st.started || st.dropped) continue;
      if (g.age < d.window[0] || g.age > d.window[1]) continue;
      if (pendingIds[d.start]) continue;
      st.started = true;
      st.startedYear = g.year;
      L.LINES.push(g, d.start, 0, d.name + '开始了');
      pendingIds[d.start] = true;
    }
    /* 2) 身世征兆与调查排期（只在本局抽中 l9 时启动） */
    originTick(g);
    /* 3) 线索卡：每年最多 1 张 */
    clueTick(g);
    /* 4) 交叉撞车 */
    collisionTick(g);
    /* 5) 承诺到期翻旧账 */
    L.PROMISE.tick(g);
  }

  function prunePending(g) {
    if (!Array.isArray(g.pending)) g.pending = [];
    for (var i = g.pending.length - 1; i >= 0; i--) {
      var it = g.pending[i];
      var ev = it && IDX[it.event];
      if (ev && ev.line && !matchLine(g, ev.line)) g.pending.splice(i, 1);
    }
  }
  L.LINES.tick = lineTick;
  L.LINES.tickAll = lineTick;

  /* =========================================================
     四、身世：征兆 → 调查 → 真相分档 → 后果
     ========================================================= */
  var SIGN_AGES = [8, 14, 22];

  function originTick(g) {
    var o = g.origin;
    if (!o || o.revealed) return;
    /* v3.7：l9 未抽中时，身世征兆一条也不出现 */
    if (!isSelected(g, 'l9')) return;
    /* 调查已经开始后不再补征兆，避免征兆插进调查节点之间打乱节奏 */
    if (!(g.lines.l9 && g.lines.l9.node >= 2)) {
    /* 成年后才有精力查出身：避开 6–19 岁的升学强制事件年 */
    var signAges = [20, 28, 36];
    for (var si = 0; si < signAges.length; si++) {
      var sid = 'origin_sign_' + o.secretId + '_' + (si + 1);
      if (o.signsSeen.indexOf(si + 1) >= 0) continue;
      if (g.age < signAges[si] || g.age > signAges[si] + 3) continue;
      var pids = (g.pending || []).map(function (p) { return p.event; });
      if (pids.indexOf(sid) >= 0) continue;
      var peek = IDX[sid];
      /* 不保证每条征兆都出现：多数局能看到 2–3 次；第一次保证出现，线才开得起来 */
      if (!peek) continue;
      if (!chance(si === 0 ? 1 : 0.8)) continue;
      o.signsSeen.push(si + 1);
      L.LINES.push(g, sid, 0, '一件对不上的旧事');
    }
    }
    /* 压下去的压力晚年爆开 */
    if (g.age >= 58 && !o.revealed && o.pressure >= 3 && !o.burst) {
      o.burst = true;
      L.LINES.push(g, 'origin_burst', 0, '压了半辈子的身世之谜');
    }
  }

  function makeSignEvent(sec, idx, ageMin, ageMax) {
    var id = 'origin_sign_' + sec.id + '_' + (idx + 1);
    IDX[id] = {
      id: id, type: 'random', stage: null, tier: 'echo', layer: 'chain', line: 'l9', beat: '起',
      weight: 0, family: id, prio: 68, ageMin: ageMin, ageMax: ageMax,
      title: '对不上的一件小事',
      text: sec.signs[idx] + ' 这件事很小，却在你心里留了一根刺。',
      opts: [
        {
          label: '追查下去', hint: '消耗 1 行动点 · 进入调查', tone: 'risk',
          apply: function (g) {
            /* v3.7：已抽中的线必须能开起来，行动点不足也要把节点排上 */
            var ok = spendAP(g, 1);
            g.origin.points += 1;
            var was = (g.lines.l9 && g.lines.l9.node) || 0;
            L.LINES.set(g, 'l9', was >= 2 ? was : 1);
            a(g, { stress: 3, happiness: -2 });
            if (was < 2) L.LINES.push(g, 'origin_inv_1', 2, '你开始查自己的来路');
            return ok ? '你把这件事记进本子，决定弄明白。' : '这一年你腾不出手，但还是把这件事记进了本子。';
          }
        },
        {
          label: '压下去，不问', hint: '压力累积 · 晚年可能爆开', tone: 'cold',
          apply: function (g) {
            g.origin.pressure += 2;
            a(g, { stress: 4, happiness: -2 });
            return '你告诉自己，有些答案不知道更好。';
          }
        },
        {
          label: '装作没听见', hint: '线索留存 · 不推进', tone: 'switch',
          apply: function (g) {
            g.origin.clueCount += 1;
            if (!g.clues) g.clues = [];
            g.clues.push({ year: g.year, age: g.age, lineId: 'l9', text: sec.signs[idx] });
            return '你笑了一下，把话岔开。';
          }
        }
      ],
      cond: function (g) {
        if (!isSelected(g, 'l9')) return false;
        return !!g.origin && g.origin.secretId === sec.id && !g.origin.revealed;
      }
    };
  }

  function originTruth(g) {
    var p = g.origin.points || 0;
    if (g.origin.wrong && p < 5) return 'fake';
    if (p >= 7 && !g.origin.wrong) return 'full';
    return 'partial';
  }

  function revealText(g, tier) {
    var sec = secretById(g.origin.secretId);
    if (tier === 'full') return sec.full;
    if (tier === 'partial') return sec.partial;
    return sec.fake;
  }

  function ensureNpcRole(g, role, name) {
    var n = L.getNpc(g, role);
    if (n) return n;
    return L.ensureNpc(g, role, { name: name || role, age: g.age + randInt(-3, 3) });
  }

  /* 调查链：4–6 节点，中断留尾巴 */
  IDX.origin_inv_1 = {
    id: 'origin_inv_1', type: 'random', stage: null, tier: 'crossroad', layer: 'chain', line: 'l9', beat: '承', weight: 0, ageMin: 30, ageMax: 80, prio: 72,
    title: '翻旧物',
    text: '你把家里的旧箱子全拖了出来。樟脑味很重，最底下那只铁盒的锁已经锈住。',
    opts: [
      { label: '撬开它', hint: '消耗 1 行动点', tone: 'risk', apply: function (g) {
        if (!spendAP(g, 1)) {
          L.LINES.set(g, 'l9', 2);
          L.LINES.push(g, 'origin_inv_2', 2, '这年没腾出手，只记下了盒子');
          a(g, { stress: 2 });
          return '你找了半天工具，最后还是没撬开。';
        }
        g.origin.points += 2;
        L.LINES.set(g, 'l9', 2);
        L.LINES.push(g, 'origin_inv_2', 2, '你撬开了那只铁盒');
        a(g, { stress: 4 });
        return '锁开了，里面是一叠发黄的纸和一张合影。';
      }},
      { label: '先放回去', hint: '线索保留', tone: 'switch', apply: function (g) {
        L.LINES.set(g, 'l9', 2);
        a(g, { stress: 1 });
        L.LINES.push(g, 'origin_inv_2', 3, '你把铁盒放了回去');
        return '你把盒子推回原处，却记住了那个锁的形状。';
      }},
      { label: '算了', hint: '中断 · 留一条尾巴', tone: 'cold', apply: function (g) {
        L.LINES.drop(g, 'l9');
        a(g, { stress: -2, happiness: 1 });
        L.LINES.push(g, 'origin_tail', 5, '你把盒子推回了柜子最里面');
        return '你把箱子一只只推回去，像什么都没发生过。';
      }}
    ],
    cond: function (g) { return g.lines.l9.node >= 1 && !g.origin.revealed; }
  };

  IDX.origin_inv_2 = {
    id: 'origin_inv_2', type: 'random', stage: null, tier: 'crossroad', layer: 'chain', line: 'l9', beat: '承', weight: 0, ageMin: 32, ageMax: 80, prio: 72,
    title: '问长辈',
    text: '你回了一趟老家，坐在堂屋里，问起自己小时候的事。屋子里的钟走得比平时慢。',
    opts: [
      { label: '问得细一点', hint: '消耗 1 行动点 · 可能被搪塞', tone: 'risk', apply: function (g) {
        if (!spendAP(g, 1)) {
          L.LINES.set(g, 'l9', 3);
          L.LINES.push(g, 'origin_inv_3', 2, '没时间细问，只能先去查档案');
          return '长辈摆摆手，说陈年旧事没什么好讲的。';
        }
        g.origin.points += 1;
        var got = chance(0.64 + (g.attrs.charm || 0) / 300);
        if (got) {
          g.origin.points += 1;
          a(g, { stress: 3 });
          L.LINES.set(g, 'l9', 3);
          L.LINES.push(g, 'origin_inv_3', 2, '长辈说漏了嘴');
          return '长辈说漏了一句，又立刻收住。你把这句记住了。';
        }
        a(g, { stress: 5, happiness: -2 });
        L.LINES.set(g, 'l9', 3);
        L.LINES.push(g, 'origin_inv_3', 2, '长辈不肯再往下说');
        return '长辈把茶碗放下，说你再问就别进这个门。';
      }},
      { label: '先不提，陪他们吃饭', hint: '亲密度上升 · 线索延后', tone: 'safe', apply: function (g) {
        npcTouch(g, '母亲', { intimacy: 6 });
        npcTouch(g, '父亲', { intimacy: 4 });
        L.LINES.set(g, 'l9', 2);
        L.LINES.push(g, 'origin_inv_3', 3, '你把问题咽了回去，改去查档案');
        a(g, { happiness: 3, stress: -2 });
        return '饭桌上谁都没提，母亲给你夹了两次菜。';
      }},
      { label: '追问到他们发火', hint: '亲情受损 · 但会拿到线索', tone: 'cold', apply: function (g) {
        g.origin.points += 2;
        npcTouch(g, '母亲', { intimacy: -10 });
        npcTouch(g, '父亲', { intimacy: -12 });
        a(g, { stress: 6, happiness: -4 });
        L.LINES.set(g, 'l9', 3);
        L.LINES.push(g, 'origin_inv_3', 1, '家里吵了一架');
        return '父亲拍了桌子，母亲在里屋哭。你拿到了一个名字。';
      }}
    ],
    cond: function (g) { return g.lines.l9.node >= 2 && !g.origin.revealed; }
  };

  IDX.origin_inv_3 = {
    id: 'origin_inv_3', type: 'random', stage: null, tier: 'crossroad', layer: 'chain', line: 'l9', beat: '转', weight: 0, ageMin: 34, ageMax: 80, prio: 72,
    title: '查档案',
    text: '你请了假，去当年那家医院和街道办。档案室的灯管一闪一闪，管理员让你填了三张表。',
    opts: [
      { label: '花钱托人查到底', hint: '花费 3000 · 可能查错人', tone: 'risk', apply: function (g) {
        m(g, { cash: -3000 });
        g.origin.points += 2;
        var wrong = chance(0.3);
        g.origin.wrong = wrong;
        if (wrong) {
          var innocent = ensureNpcRole(g, '被误认的家庭', '一户陌生人');
          if (innocent) { innocent.intimacy = clamp((innocent.intimacy || 50) - 20, 0, 100); innocent.alive = innocent.alive; }
          a(g, { stress: 7, happiness: -5 });
          L.LINES.set(g, 'l9', 4);
          L.LINES.push(g, 'origin_inv_4', 2, '你查到了一个名字，却可能是错的');
          return '你拿到一份复印件，上面的名字让你一夜没睡。你不知道这份东西是真是假。';
        }
        L.LINES.set(g, 'l9', 4);
        L.LINES.push(g, 'origin_inv_4', 2, '档案里有一条改过的记录');
        return '管理员从柜子底下抽出一份旧卷，指着一处涂改过的名字。';
      }},
      { label: '只查公开档案', hint: '免费 · 慢', tone: 'switch', apply: function (g) {
        g.origin.points += 1;
        L.LINES.set(g, 'l9', 4);
        L.LINES.push(g, 'origin_inv_4', 3, '你只查到一点边角');
        return '能公开的部分只有几行，关键的页码都缺着。';
      }},
      { label: '到此为止', hint: '中断 · 留尾巴', tone: 'cold', apply: function (g) {
        L.LINES.drop(g, 'l9');
        a(g, { stress: -3, happiness: 1 });
        L.LINES.push(g, 'origin_tail', 4, '你在档案室门口站了很久，转身走了');
        return '你把表格揉成一团，扔进走廊尽头的垃圾桶。';
      }}
    ],
    cond: function (g) { return g.lines.l9.node >= 3 && !g.origin.revealed; }
  };

  IDX.origin_inv_4 = {
    id: 'origin_inv_4', type: 'random', stage: null, tier: 'crossroad', layer: 'chain', line: 'l9', beat: '转', weight: 0, ageMin: 36, ageMax: 80, prio: 72,
    title: '对质',
    text: '所有线索最后都指向一个必须当面问清楚的人。你把那几张纸装进包里，站在门口。',
    opts: [
      { label: '当面问清楚', hint: '消耗 1 行动点 · 真相分档', tone: 'risk', apply: function (g) {
        spendAP(g, 1);
        var tier = originTruth(g);
        L.LINES.set(g, 'l9', 5);
        L.LINES.reveal(g, 'l9', tier);
        if (tier === 'full') {
          a(g, { stress: 8, happiness: 6, reputation: 2 });
          g.identityTag = '被换掉的孩子';
          m(g, { debt: 0 });
        } else if (tier === 'partial') {
          a(g, { stress: 6, happiness: -2 });
          g.identityTag = '有一半来路的人';
          npcTouch(g, '母亲', { intimacy: -6 });
        } else {
          a(g, { stress: 9, happiness: -8 });
          g.identityTag = '查错了人的孩子';
          var w = ensureNpcRole(g, '被误认的家庭', '一户陌生人');
          if (w) w.intimacy = clamp((w.intimacy || 50) - 25, 0, 100);
        }
        L.LINES.push(g, 'origin_inv_5', 1, '真相被说出口的那一天');
        return revealText(g, tier);
      }},
      { label: '把纸收起来，先不见', hint: '压力下降 · 线索封存', tone: 'switch', apply: function (g) {
        g.origin.pressure += 2;
        L.LINES.set(g, 'l9', 4);
        a(g, { stress: 2, happiness: -2 });
        L.LINES.push(g, 'origin_tail', 4, '你把包放在门口，没有敲门');
        return '你在楼道里站了十分钟，听见里面有电视声，最后下了楼。';
      }},
      { label: '只远远看一眼', hint: '不揭晓 · 心结留下', tone: 'cold', apply: function (g) {
        L.LINES.set(g, 'l9', 5);
        L.LINES.reveal(g, 'l9', 'partial');
        g.identityTag = '远远看过的人';
        a(g, { stress: 4, happiness: -3 });
        L.LINES.push(g, 'origin_tail', 3, '你只在街对面看了她一眼');
        return '你隔着一条街看见她，没走过去。';
      }}
    ],
    cond: function (g) { return g.lines.l9.node >= 4 && !g.origin.revealed; }
  };

  IDX.origin_inv_5 = {
    id: 'origin_inv_5', type: 'random', stage: null, tier: 'crossroad', layer: 'chain', line: 'l9', beat: '合', weight: 0, ageMin: 38, ageMax: 80, prio: 72,
    title: '认还是不认',
    text: '真相摆上桌以后，另一个问题才刚开始：那边的家，你要不要走进去。',
    opts: [
      { label: '认下来，两边都走', hint: '家庭重排 · 幸福感波动', tone: 'risk', apply: function (g) {
        L.LINES.set(g, 'l9', 6);
        g.lines.l9.result = 'good';
        npcTouch(g, '母亲', { intimacy: -16 });
        var n = ensureNpcRole(g, '亲生家庭', '那边的家人');
        if (n) n.intimacy = clamp(45 + (g.origin.truth === 'full' ? 20 : 0), 0, 100);
        a(g, { happiness: 6, stress: 8, reputation: 3 });
        L.PROMISE.add(g, {
          npcRole: '母亲', type: 'promise', who: '养母',
          text: '不管查到什么，这个家还是你的家',
          dueYear: g.year + 4, consequence: '血缘与养育之间要选一次',
          lineId: 'l9'
        });
        pushNode(g, 'origin_echo', 3, '两边的门你都进得去了');
        return '你在那边的饭桌上叫了一声称呼，回来又给养母打了电话。两个家都还在，只是你要跑得勤一些。';
      }},
      { label: '只认血缘，不认养育', hint: '亲情断裂', tone: 'cold', apply: function (g) {
        L.LINES.set(g, 'l9', 6);
        g.lines.l9.result = 'bad';
        npcTouch(g, '母亲', { intimacy: -30 });
        npcTouch(g, '父亲', { intimacy: -26 });
        a(g, { happiness: -4, stress: 9 });
        g.identityTag = '迟来的儿子';
        L.PROMISE.add(g, {
          npcRole: '母亲', type: 'absence', who: '养母',
          text: '你走的时候没有回头',
          dueYear: g.year + 6, consequence: '养育之恩变成一笔旧账', lineId: 'l9'
        });
        pushNode(g, 'origin_echo', 3, '你把钥匙留在了桌上');
        return '你把钥匙放在桌上，说以后不常回来了。养母追到楼道口，只看见电梯门合上。';
      }},
      { label: '不认，只把事放下', hint: '心结封存 · 压力下降', tone: 'switch', apply: function (g) {
        L.LINES.set(g, 'l9', 6);
        g.lines.l9.result = 'bitter';
        a(g, { stress: -4, happiness: 2 });
        L.PROMISE.add(g, {
          npcRole: '亲生家庭', type: 'promise', who: '那边的人',
          text: '这件事到我这里为止，不再往下查',
          dueYear: g.year + 8, consequence: '对方可能等了你很多年', lineId: 'l9'
        });
        pushNode(g, 'origin_echo', 3, '你说，知道了就够了');
        return '你说，知道了就够了。那扇门你没有再敲，回来的路走得很慢。';
      }}
    ],
    cond: function (g) { return g.lines.l9.node >= 5 && g.origin.revealed; }
  };

  IDX.origin_echo = {
    id: 'origin_echo', type: 'random', stage: null, tier: 'echo', layer: 'chain', line: 'l9', beat: '余波',
    weight: 0, family: 'origin_echo', ageMin: 42, ageMax: 95, prio: 74,
    title: '户口本最后一页',
    text: '清明那天，你带着户口本最后一页的复印件去了城郊的墓园。守墓的老人替你点了一支香，说：这里埋的人，姓和你一样。',
    opts: [{ label: '把复印件烧掉，磕一个头', hint: '压力 -3 · 幸福感 +1', tone: 'switch', apply: function (g) {
      a(g, { stress: -3, happiness: 1 });
      return g.year + ' 年清明，纸灰被风吹起来，落回你自己的鞋面上。你盯着户口本最后一页上那个被划掉的名字，第一次没有移开眼睛。';
    }}],
    cond: function (g) { return g.lines.l9.node >= 6; }
  };

  /* 余波节点统一从这条入口排进 pending */
  function pushNode(g, evId, delay, note) {
    L.LINES.push(g, evId, delay, note, true);
  }

  IDX.origin_tail = {
    id: 'origin_tail', type: 'random', stage: null, tier: 'echo', layer: 'chain', line: 'l9', beat: '余波', weight: 0, family: 'origin_tail', ageMin: 55, ageMax: 90, prio: 74,
    title: '没有问出口的那句话',
    text: '很多年以后，你偶尔还会想起那只铁盒。它一直在柜子最里面，锁已经彻底锈死了。',
    opts: [{ label: '把日子过下去', hint: '', tone: 'switch', apply: function (g) {
      a(g, { stress: -2, happiness: 1 });
      return '你没有再打开它。';
    }}],
    cond: function (g) { return true; }
  };

  IDX.origin_burst = {
    id: 'origin_burst', type: 'random', stage: null, tier: 'crossroad', layer: 'chain', line: 'l9', beat: '转', weight: 0, ageMin: 55, ageMax: 90, prio: 70,
    title: '压了半辈子的身世之谜',
    text: '你退休后整理旧物，那只铁盒从柜顶掉下来，锁自己开了。里面的纸已经脆得发白。',
    opts: [
      { label: '打开看', hint: '晚年认知冲击', tone: 'risk', apply: function (g) {
        var tier = originTruth(g);
        L.LINES.reveal(g, 'l9', tier === 'full' ? 'partial' : tier);
        L.LINES.set(g, 'l9', 5);
        a(g, { stress: 8, happiness: tier === 'partial' ? -6 : -9 });
        g.identityTag = '晚年才知道的人';
        return '你戴着老花镜读完，手一直抖。' + revealText(g, tier);
      }},
      { label: '重新锁上', hint: '带着它进土', tone: 'cold', apply: function (g) {
        a(g, { stress: -3, happiness: 2 });
        L.PROMISE.add(g, {
          npcRole: '父亲', type: 'promise', who: '父亲',
          text: '这件事我不问了',
          dueYear: g.year + 3, consequence: '你答应过不再追问', lineId: 'l9'
        });
        return '你找了把新锁，把盒子重新扣上。';
      }}
    ],
    cond: function (g) { return !!g.origin && !g.origin.revealed; }
  };

  /* =========================================================
     五、八条主线事件
     ========================================================= */
  function node(id, lineId, n, title, text, opts, ageMin, ageMax, tier, prio, beat) {
    IDX[id] = {
      id: id, type: 'random', stage: null, tier: tier || 'crossroad',
      layer: 'chain', weight: 0, family: id, prio: prio || 73, line: lineId,
      title: title, text: text, opts: opts, ageMin: ageMin, ageMax: ageMax,
      beat: beat || '', n: n,
      cond: function (g) { return L.LINES.at(g, lineId, n); }
    };
  }
  function tail(id, lineId, title, text, fn, ageMin, ageMax) {
    IDX[id] = {
      id: id, type: 'random', stage: null, tier: 'echo', layer: 'chain',
      weight: 0, family: id, prio: 74, title: title, text: text, line: lineId,
      ageMin: ageMin, ageMax: ageMax, beat: '余波',
      opts: [{ label: '把这件事收进回忆里', hint: '', tone: 'switch', apply: fn || function (g) {
        a(g, { stress: -1, happiness: 1 });
        return '日子继续往前。';
      }}],
      cond: function (g) { return true; }
    };
  }

  /* ---------- 1《那封没寄出的信》：起 → 承 → 承 → 转 → 合 → 余波 ---------- */
  node('st_l1_1', 'l1', 1, '没贴邮票的信',
    '父亲的书房，晚上九点。他还在楼下和邻居说话，母亲在厨房洗碗。你借着找作业本的名义拉开最下面那层抽屉，摸到一只牛皮纸信封：没有邮票，收信人是一个你没听过的女人名字，字是父亲的。', [
      { label: '按原样压回去，记住名字', hint: '记住这个名字 · 压力 +2', tone: 'switch', apply: function (g) {
        L.LINES.set(g, 'l1', 2); g.lines.l1.points += 1;
        a(g, { stress: 2 });
        pushNode(g, 'st_l1_2', 3, '你记住了信封上的名字');
        return '你把信封按原样压回去，连角度都摆正了。那个名字你在心里默念了三遍。';
      }},
      { label: '拿到厨房问母亲', hint: '母亲回避 · 幸福感 -3', tone: 'risk', apply: function (g) {
        L.LINES.set(g, 'l1', 2); g.lines.l1.points += 2;
        npcTouch(g, '母亲', { intimacy: -8 });
        a(g, { happiness: -3, stress: 4 });
        pushNode(g, 'st_l1_2', 3, '母亲说那是一个很久以前的同事');
        return '母亲看了一眼就把信封压回抽屉，说是个旧同事。那天的碗她洗了很久。';
      }},
      { label: '拿到楼下直接问父亲', hint: '父亲沉默 · 亲密度 -10', tone: 'cold', apply: function (g) {
        L.LINES.set(g, 'l1', 2); g.lines.l1.points += 1;
        npcTouch(g, '父亲', { intimacy: -10 });
        a(g, { stress: 3, happiness: -2 });
        pushNode(g, 'st_l1_2', 3, '父亲接过信封，一句话也没说');
        return '父亲接过信封，捏在手里看了很久，只说了一句：放回去。';
      }}
    ], 8, 18, 'crossroad', 73, '起');

  node('st_l1_2', 'l1', 2, '半张烧过的纸',
    '搬家那年，你在纸箱最底下又摸到那只信封。封口被拆开过，里面只剩半张纸，边角有烧过的痕迹。父亲那天加班，母亲在医院陪外婆，家里只有你一个人蹲在阳台上。', [
      { label: '读完剩下的半张', hint: '消耗 1 行动点 · 压力 +4', tone: 'risk', apply: function (g) {
        spendAP(g, 1);
        L.LINES.set(g, 'l1', 3); g.lines.l1.points += 2;
        a(g, { stress: 4, happiness: -2 });
        pushNode(g, 'st_l1_3', 2, '你读完了那半张信');
        return '纸上只剩一句话：那年冬天我没敢去看你。落款日期比你出生早两年。';
      }},
      { label: '打车去医院问母亲', hint: '花费 200 · 母亲亲密度 -10', tone: 'cold', apply: function (g) {
        m(g, { cash: -200 });
        L.LINES.set(g, 'l1', 3); g.lines.l1.points += 1;
        npcTouch(g, '母亲', { intimacy: -10 });
        a(g, { stress: 4, happiness: -3 });
        pushNode(g, 'st_l1_3', 2, '母亲让你别再翻那只信封');
        return '母亲在走廊长椅上听完，把外套披在你肩上，说：别翻了，那不是给你的。';
      }},
      { label: '重新封好，放回纸箱', hint: '压力 +2 · 幸福感 +1', tone: 'switch', apply: function (g) {
        L.LINES.set(g, 'l1', 3);
        a(g, { stress: 2, happiness: 1 });
        pushNode(g, 'st_l1_3', 2, '你把信封重新粘好');
        return '你找了张新胶纸把封口粘上，放回纸箱最底层，压上两本旧课本。';
      }}
    ], 10, 30, 'crossroad', 73, '承');

  node('st_l1_3', 'l1', 3, '地址上的人',
    '信上的地址在邻市一条老街。你按门牌找过去，开门的是一个抱着孩子的年轻女人，说这房子她租了三年。楼下修鞋的老人还记得，二十年前那户人家搬走时，只有一个女人带着一个男孩。', [
      { label: '花两千请老人打听', hint: '花费 2000 · 得到旧地址', tone: 'risk', apply: function (g) {
        m(g, { cash: -2000 }); spendAP(g, 1);
        L.LINES.set(g, 'l1', 4); g.lines.l1.points += 2;
        a(g, { stress: 2 });
        pushNode(g, 'st_l1_4', 3, '老人翻出一个压在鞋盒底下的地址');
        return '老人收下钱，从鞋盒底下翻出一张写着你父亲名字的旧收据，背面是一行地址。';
      }},
      { label: '在楼下站到天黑', hint: '压力 +3 · 幸福感 -2', tone: 'switch', apply: function (g) {
        L.LINES.set(g, 'l1', 4);
        a(g, { stress: 3, happiness: -2 });
        pushNode(g, 'st_l1_4', 3, '你在老街站到路灯亮起');
        return '你在楼下站到路灯亮起。楼上有人开窗收衣服，不是你等的人。';
      }},
      { label: '把信寄到老地址，不留回邮', hint: '压力 -2 · 幸福感 +1', tone: 'safe', apply: function (g) {
        L.LINES.set(g, 'l1', 4);
        a(g, { stress: -2, happiness: 1 });
        pushNode(g, 'st_l1_4', 3, '你把信投进了老街的邮筒');
        return '你贴上邮票，把信投进老街口的邮筒。信封上没有写你的地址。';
      }}
    ], 12, 34, 'crossroad', 73, '承');

  node('st_l1_4', 'l1', 4, '开门的人',
    '门开了一条缝，一个四十出头的男人把信封翻来覆去看了三遍。他说这是他母亲的字，然后抬头问你：你父亲是不是姓陈？客厅的电视还开着，桌上摆着两副碗筷。', [
      { label: '坐下来听完整个下午', hint: '揭晓真相 · 压力 +7', tone: 'risk', apply: function (g) {
        L.LINES.set(g, 'l1', 5);
        L.LINES.reveal(g, 'l1', 'full');
        a(g, { happiness: 5, stress: 7, reputation: 2 });
        L.PROMISE.add(g, {
          npcRole: '父亲', type: 'promise', who: '父亲',
          text: '这个下午的事不告诉母亲',
          dueYear: g.year + 5, consequence: '秘密压在你一个人身上', lineId: 'l1'
        });
        pushNode(g, 'st_l1_5', 2, '你坐下来听完了一个下午');
        return '他母亲叫许素云。父亲年轻时和她订过婚，后来娶了你母亲，那只信封写了二十年，一封也没寄出去。';
      }},
      { label: '只问一句：她还在吗', hint: '得到一半真相 · 压力 +5', tone: 'safe', apply: function (g) {
        L.LINES.set(g, 'l1', 5);
        L.LINES.reveal(g, 'l1', 'partial');
        a(g, { stress: 5, happiness: -2 });
        pushNode(g, 'st_l1_5', 2, '你只问了一句话');
        return '他说：去年冬天走的。走之前还在整理一叠信，收信人全是你父亲的名字。';
      }},
      { label: '把信留下，转身下楼', hint: '压力 +4 · 幸福感 -4', tone: 'cold', apply: function (g) {
        L.LINES.set(g, 'l1', 5);
        L.LINES.reveal(g, 'l1', 'partial');
        a(g, { stress: 4, happiness: -4 });
        pushNode(g, 'st_l1_5', 2, '你把信留在了他家门口');
        return '你把信封放在鞋柜上，说了一句打扰了，转身下楼。他在门口站了很久。';
      }}
    ], 14, 38, 'crossroad', 73, '转');

  node('st_l1_5', 'l1', 5, '母亲早就看过',
    '你回家的那天，母亲把碗放下，说：那封信我三十年前就看过。她说她也写过一封，没敢寄，压在自己的嫁妆箱底。两个女人隔着一座城，替同一个男人守了半辈子。', [
      { label: '两家的信都收好，带母亲去见他', hint: '压力 -2 · 幸福感 +6', tone: 'safe', apply: function (g) {
        L.LINES.set(g, 'l1', 6); g.lines.l1.result = 'good';
        npcTouch(g, '母亲', { intimacy: 6 });
        npcTouch(g, '父亲', { intimacy: 4 });
        a(g, { happiness: 6, stress: -2, reputation: 2 });
        pushNode(g, 'st_l1_tail', 3, '母亲和那个男人在茶馆坐了一下午');
        return '秋天，母亲和许素云的儿子在茶馆坐了一下午。回来的路上她说：你爸这辈子没欠过谁，就欠了这封信。';
      }},
      { label: '把信和那半张纸一起烧掉', hint: '幸福感 -4 · 母亲亲密度 -6', tone: 'cold', apply: function (g) {
        L.LINES.set(g, 'l1', 6); g.lines.l1.result = 'bad';
        npcTouch(g, '母亲', { intimacy: -6 });
        a(g, { happiness: -4, stress: 3 });
        pushNode(g, 'st_l1_tail', 3, '信封在铁桶里烧成了一小团灰');
        return '你在楼下的铁桶里烧了那只信封。母亲站在阳台上看着，什么也没问。那年之后，父亲的书房你很少进去。';
      }},
      { label: '用父亲的笔迹抄一遍，寄出去', hint: '压力 +4 · 幸福感 +2', tone: 'risk', apply: function (g) {
        L.LINES.set(g, 'l1', 6); g.lines.l1.result = 'bitter';
        npcTouch(g, '母亲', { intimacy: -3 });
        a(g, { stress: 4, happiness: 2 });
        pushNode(g, 'st_l1_tail', 3, '信寄出去了，回信两年后才到');
        return '你照着父亲的字迹抄了一遍，贴上邮票寄出。两年后回信只有一行字：他早该寄。母亲看完，把信折好放回了原来的抽屉。';
      }}
    ], 16, 42, 'crossroad', 73, '合');

  tail('st_l1_tail', 'l1', '书柜最上层的十七封信',
    '很多年以后，你在父亲的书柜最上层找到那叠信，一共十七封，收信人都是许素云。',
    function (g) {
      a(g, { stress: -1, happiness: 1 });
      return g.year + ' 年清明，你母亲站在书柜前，说：留着吧，他写的时候我都在。';
    }, 18, 90);

  /* ---------- 2《父亲的账本》：起 → 承 → 承 → 转 → 合 → 余波 ---------- */
  node('st_l2_1', 'l2', 1, '挂历纸包着的记账簿',
    '夜里十一点，父亲还在楼下跟人打电话，声音压得很低。你替他找电费单，拉开中间那层抽屉，摸到一本用挂历纸包着的记账簿：记的不是收入，是一笔笔还款。最后一页只有一行字：还欠三万二。', [
      { label: '记住几个名字，原样放回', hint: '压力 +3 · 线索 +1', tone: 'switch', apply: function (g) {
        L.LINES.set(g, 'l2', 2); g.lines.l2.moral += 1;
        a(g, { stress: 3 });
        pushNode(g, 'st_l2_2', 3, '你记住了账本上的名字');
        return '你把那几个名字在心里念了两遍，账本按原样放回，抽屉关得很轻。';
      }},
      { label: '拿下楼问父亲', hint: '父亲发火 · 亲密度 -12', tone: 'risk', apply: function (g) {
        L.LINES.set(g, 'l2', 2); g.lines.l2.moral += 2;
        npcTouch(g, '父亲', { intimacy: -12 });
        a(g, { stress: 4, happiness: -2 });
        pushNode(g, 'st_l2_2', 3, '父亲说那是年轻时欠下的');
        return '父亲一把把账本夺过去，说小孩别管大人的债，然后一个人坐到院子里的台阶上。';
      }},
      { label: '抄下最后三笔数字', hint: '知识 +2 · 压力 +2', tone: 'safe', apply: function (g) {
        L.LINES.set(g, 'l2', 2);
        a(g, { knowledge: 2, stress: 2 });
        pushNode(g, 'st_l2_2', 3, '你抄下了最后三笔数字');
        return '你把最后三笔的日期和金额抄在作业本背面，又撕下来夹进课本。';
      }}
    ], 8, 18, 'crossroad', 73, '起');

  node('st_l2_2', 'l2', 2, '门口的两个男人',
    '半年后，两个男人站在家门口。父亲不在，母亲让你别开门。他们隔着防盗门说，你父亲欠的钱拖得太久，下周三之前要见到钱。你口袋里只有刚发的两千块工资。', [
      { label: '先给两千，写下欠条', hint: '花费 2000 · 压力 +3', tone: 'risk', apply: function (g) {
        m(g, { cash: -2000 });
        L.LINES.set(g, 'l2', 3); npcTouch(g, '父亲', { intimacy: 4 });
        a(g, { stress: 3 });
        pushNode(g, 'st_l2_3', 2, '你先垫上了两千');
        return '你把两千块从门缝递出去，在收条上签了字，下周三这个日子从此压在你心上。';
      }},
      { label: '打电话把父亲叫回来', hint: '父亲亲密度 -8 · 压力 +4', tone: 'switch', apply: function (g) {
        L.LINES.set(g, 'l2', 3); g.lines.l2.moral += 1;
        npcTouch(g, '父亲', { intimacy: -8 });
        a(g, { stress: 4, happiness: -2 });
        pushNode(g, 'st_l2_3', 2, '父亲回来后和他们站在楼道里说了很久');
        return '父亲赶回来，在楼道里和他们说了四十分钟。门关上的时候，他谁也没看。';
      }},
      { label: '站在门口说不清楚', hint: '压力 +5 · 幸福感 -2', tone: 'cold', apply: function (g) {
        L.LINES.set(g, 'l2', 3);
        a(g, { stress: 5, happiness: -2 });
        pushNode(g, 'st_l2_3', 2, '你隔着门说自己不知道');
        return '你隔着门说自己不知道这件事。他们走的时候踢了一脚楼道里的鞋柜。';
      }}
    ], 10, 28, 'crossroad', 73, '承');

  node('st_l2_3', 'l2', 3, '借条上的签名',
    '你在账本最后一页的夹层里抽出一张借条，纸边已经发脆。借款人的签名是母亲的名字，日期在你出生前一年。父亲这十九年一笔一笔还的，是母亲年轻时替娘家借下的钱。', [
      { label: '拿着借条去问母亲', hint: '母亲亲密度 -6 · 真相更近', tone: 'risk', apply: function (g) {
        L.LINES.set(g, 'l2', 4); g.lines.l2.points += 2;
        npcTouch(g, '母亲', { intimacy: -6 });
        a(g, { stress: 4, happiness: -2 });
        pushNode(g, 'st_l2_4', 3, '母亲第一次跟你提起那笔钱');
        return '母亲把借条接过去，看了很久，说：那是我借的，你爸替我还了十九年。';
      }},
      { label: '放回去，当没看见', hint: '压力 +3 · 什么都不说', tone: 'switch', apply: function (g) {
        L.LINES.set(g, 'l2', 4);
        a(g, { stress: 3 });
        pushNode(g, 'st_l2_4', 3, '你把借条塞回原处');
        return '你把借条塞回夹层，账本合上，像什么也没发生过。';
      }},
      { label: '去银行查当年的流水', hint: '花费 500 · 消耗 1 行动点', tone: 'safe', apply: function (g) {
        m(g, { cash: -500 }); spendAP(g, 1);
        L.LINES.set(g, 'l2', 4); g.lines.l2.points += 2;
        a(g, { knowledge: 2, stress: 2 });
        pushNode(g, 'st_l2_4', 3, '你在流水里看到了十九年的汇款');
        return '柜台打印出的流水有四页，每个月十五号，一笔三百，一笔不落。';
      }}
    ], 12, 34, 'crossroad', 73, '承');

  node('st_l2_4', 'l2', 4, '押金三万',
    '父亲在工地上晕倒，住院押金三万。同一天，债主把电话打到你的手机上，说人跑了债不能跑。母亲坐在医院走廊的长椅上，第一次把实话说完：那笔钱是她年轻时替娘家借的，父亲替她还了十九年。', [
      { label: '在借条上签自己的名字', hint: '负债 20000 · 父亲亲密度 +8', tone: 'risk', apply: function (g) {
        m(g, { debt: 20000 });
        L.LINES.set(g, 'l2', 5); npcTouch(g, '父亲', { intimacy: 8 });
        a(g, { stress: 6, happiness: -2 });
        pushNode(g, 'st_l2_5', 2, '你把那笔债接到了自己名下');
        return '你在借条背面签了自己的名字，护士来催押金，你把卡递过去，余额只剩三位数。';
      }},
      { label: '跟债主谈，把利息砍掉', hint: '消耗 1 行动点 · 按魅力判定', tone: 'risk', apply: function (g) {
        spendAP(g, 1);
        L.LINES.set(g, 'l2', 5);
        if (chance(0.45 + (g.attrs.charm || 0) / 250)) {
          m(g, { debt: 8000 });
          a(g, { stress: 3, happiness: 2, reputation: 2 });
          pushNode(g, 'st_l2_5', 2, '你把利息砍掉了一半');
          return '你把利息砍掉一半，分期写进新协议。对方说看你是个讲理的。';
        }
        m(g, { debt: 26000 });
        a(g, { stress: 7 });
        pushNode(g, 'st_l2_5', 2, '对方不吃这一套');
        return '对方不吃这一套，利滚利又加了一笔。你在医院楼梯间坐了很久。';
      }},
      { label: '只付押金，让母亲自己处理', hint: '花费 3000 · 母亲亲密度 -12', tone: 'cold', apply: function (g) {
        m(g, { cash: -3000 });
        L.LINES.set(g, 'l2', 5); npcTouch(g, '母亲', { intimacy: -12 });
        a(g, { happiness: -3, stress: 2 });
        pushNode(g, 'st_l2_5', 2, '你把押金交了，剩下的没再问');
        return '你交了三万押金，把收据放在母亲手里，说剩下的事你处理不了。';
      }}
    ], 14, 38, 'crossroad', 73, '转');

  node('st_l2_5', 'l2', 5, '账本上的新名字',
    '父亲出院后把账本收进上衣口袋，谁也没再提。最后一页添了一行新字，是你的名字。母亲把饭菜端上桌，说了一句：这本账该有个头了。', [
      { label: '把剩下的一次还清，烧掉账本', hint: '花费 20000 · 幸福感 +6', tone: 'safe', apply: function (g) {
        m(g, { cash: -20000, debt: -20000 });
        L.LINES.set(g, 'l2', 6); g.lines.l2.result = 'good';
        npcTouch(g, '父亲', { intimacy: 10 });
        a(g, { happiness: 6, stress: -4, reputation: 2 });
        pushNode(g, 'st_l2_tail', 3, '最后一笔钱转过去了');
        return '冬至那天，你把最后一笔钱转过去，父亲在灶台边看你烧了那本挂历纸包着的账本。他说：这下你妈能睡个好觉了。';
      }},
      { label: '把账本锁进抽屉，先顾自己的日子', hint: '父亲亲密度 -14 · 幸福感 -3', tone: 'cold', apply: function (g) {
        L.LINES.set(g, 'l2', 6); g.lines.l2.result = 'bad';
        npcTouch(g, '父亲', { intimacy: -14 });
        a(g, { happiness: -3, stress: 4 });
        pushNode(g, 'st_l2_tail', 3, '你搬去了另一个城市');
        return '你把账本锁进抽屉，搬去了另一个城市。父亲一个人又还了四年，直到还不动为止。他走那年，抽屉里的账本还在。';
      }},
      { label: '复印一份，和父亲按月还', hint: '花费 8000 · 父亲亲密度 +5', tone: 'switch', apply: function (g) {
        m(g, { cash: -8000, debt: -8000 });
        L.LINES.set(g, 'l2', 6); g.lines.l2.result = 'bitter';
        npcTouch(g, '父亲', { intimacy: 5 });
        a(g, { stress: 2, happiness: 2 });
        pushNode(g, 'st_l2_tail', 3, '你和父亲每月十五号去银行');
        return '你和父亲每月十五号去银行，一次还三百。他走在前面，步子越来越慢。钱还完那天，他把账本给你，说留着吧，别学我。';
      }}
    ], 16, 42, 'crossroad', 73, '合');

  tail('st_l2_tail', 'l2', '最后一页被划掉了',
    '很多年以后，你在老屋的抽屉里翻出那本账本，最后一页的数字被父亲用铅笔划掉了。',
    function (g) {
      a(g, { stress: -1, happiness: 1 });
      return g.year + ' 年清明，你在老屋收拾父亲的旧衣服，母亲站在门口说：他临走前还在算这笔账。';
    }, 18, 90);

  /* ---------- 3《风口上的猪》 ---------- */
  node('st_l3_1', 'l3', 1, '拉你入伙的人',
    '老朋友约你吃饭，说现在风口正好：他出资源，你出人，一起干一票。桌上有份打印好的计划书。', [
      { label: '先了解清楚', hint: '稳妥', tone: 'safe', apply: function (g) {
        L.LINES.set(g, 'l3', 2); a(g, { knowledge: 3, stress: 2 });
        L.LINES.push(g, 'st_l3_2', 1, '你花了几个晚上看计划书');
        return '你把计划书带回家，逐页做了标记。';
      }},
      { label: '当场投一笔钱', hint: '花费 20000 · 风险高', tone: 'risk', apply: function (g) {
        m(g, { cash: -20000 }); L.LINES.set(g, 'l3', 2);
        g.lines.l3.extra.invested = true;
        a(g, { stress: 4, happiness: 2 });
        L.LINES.push(g, 'st_l3_2', 1, '你当场转了一笔钱');
        return '你当场转了钱，他举起杯子说就等你这句话。';
      }},
      { label: '婉拒，安稳过日子', hint: '小富即安', tone: 'cold', apply: function (g) {
        L.LINES.drop(g, 'l3');
        g.lines.l3.result = 'small';
        a(g, { stress: -3, happiness: 3 });
        L.LINES.push(g, 'st_l3_tail', 6, '你没有上那趟车');
        return '你说自己不是做生意的料，他笑笑，没再劝。';
      }}
    ], 20, 40);

  node('st_l3_2', 'l3', 2, '辞不辞职',
    '项目要全身心投入。辞职意味着断了退路，不辞只能做半个合伙人。家里人都在等你的决定。', [
      { label: '辞职，all in', hint: '压力 +8 · 成败放大', tone: 'risk', apply: function (g) {
        L.LINES.set(g, 'l3', 3); g.flags.l3_allin = true;
        a(g, { stress: 8, happiness: 3 });
        if (g.job) g.job.quitYear = g.year;
        L.LINES.push(g, 'st_l3_3', 1, '你递了辞职信');
        return '你把辞职信放在上司桌上，没等批复就走了。';
      }},
      { label: '兼职试水', hint: '健康 -3 · 留退路', tone: 'switch', apply: function (g) {
        L.LINES.set(g, 'l3', 3);
        a(g, { health: -3, stress: 5, knowledge: 2 });
        L.LINES.push(g, 'st_l3_3', 1, '你白天上班，晚上做项目');
        return '你白天上班，晚上在出租屋里改方案。';
      }},
      { label: '不辞，只出主意', hint: '小富即安', tone: 'cold', apply: function (g) {
        L.LINES.drop(g, 'l3');
        g.lines.l3.result = 'small';
        a(g, { stress: -2, happiness: 2 });
        L.LINES.push(g, 'st_l3_tail', 6, '你留在了原来的位置上');
        return '你留在了原来的工位，偶尔帮他们看一眼方案。';
      }}
    ], 22, 42);

  node('st_l3_3', 'l3', 3, '第一年',
    '第一年的账出来了。要么小成，要么血本无归。你在办公室里等到凌晨，屏幕上的数字终于不再跳。', [
      { label: '押上能押的', hint: '按意志与运气判定', tone: 'risk', apply: function (g) {
        L.LINES.set(g, 'l3', 4);
        var p = 0.42 + (g.attrs.knowledge || 0) / 300 + (g.flags.l3_allin ? 0.08 : 0);
        if (chance(p)) {
          g.lines.l3.result = 'good';
          m(g, { cash: 30000 }); a(g, { happiness: 6, stress: 4, reputation: 3 });
          return '第一年居然跑正了。你们在楼道里抱了一下。';
        }
        g.lines.l3.result = 'bad';
        m(g, { debt: 30000 }); a(g, { happiness: -8, stress: 8 });
        return '第一年血本无归。账上只剩三位数。';
      }},
      { label: '留一手，及时收', hint: '保本 · 错过爆发', tone: 'safe', apply: function (g) {
        L.LINES.set(g, 'l3', 4);
        g.lines.l3.result = 'small';
        m(g, { cash: 5000 });
        a(g, { stress: -2, happiness: 1 });
        return '你抽回了一半本钱，剩下的事交给时间。';
      }}
    ], 24, 44);

  node('st_l3_4', 'l3', 4, '第三年',
    '第三年，行业忽然起风。有人一夜之间融到了钱，也有人被一纸政策按在地上。你的电话响个不停。', [
      { label: '融资扩张', hint: '成功则被收购 · 家庭疏离', tone: 'risk', apply: function (g) {
        L.LINES.set(g, 'l3', 5);
        if (g.lines.l3.result === 'good' && chance(0.62 + (g.attrs.knowledge || 0) / 400)) {
          g.lines.l3.result = 'success';
          m(g, { cash: 180000, assets: 300000 });
          a(g, { reputation: 8, stress: 9, happiness: 4 });
          npcTouch(g, '合伙人', { intimacy: -20 });
          npcTouch(g, '配偶', { intimacy: -15 });
          if (!L.getNpc(g, '合伙人')) ensureNpcRole(g, '合伙人', '合伙人老周');
          L.PROMISE.add(g, { npcRole: '配偶', type: 'absence', who: '家里人', text: '这一年的年夜饭你又没回来', dueYear: g.year + 2, consequence: '家庭疏离', lineId: 'l3' });
          return '公司被一家大厂收购，你签完字，合伙人却在会议室里拍了桌子。';
        }
        g.lines.l3.result = 'fail';
        m(g, { debt: 60000 }); a(g, { stress: 10, happiness: -8, reputation: -4 });
        return '扩张到一半，政策收紧，账上的钱只够发两个月工资。';
      }},
      { label: '守住现金，慢慢做', hint: '小成 · 风险低', tone: 'safe', apply: function (g) {
        L.LINES.set(g, 'l3', 5);
        if (g.lines.l3.result !== 'bad') {
          g.lines.l3.result = 'small';
          m(g, { cash: 40000 });
          a(g, { happiness: 3, stress: -3 });
          return '你没有追风口，生意不大，却活了下来。';
        }
        m(g, { debt: 10000 }); a(g, { stress: 4, happiness: -2 });
        return '你把能关的都关了，只留下一个最小的摊子。';
      }},
      { label: '退出，回去打工', hint: '结束这条线', tone: 'cold', apply: function (g) {
        L.LINES.drop(g, 'l3');
        g.lines.l3.result = g.lines.l3.result === 'bad' ? 'fail' : 'small';
        a(g, { stress: -6, happiness: 2 });
        L.LINES.push(g, 'st_l3_tail', 5, '你把工牌重新挂回了脖子上');
        return '你把公司转了出去，重新开始投简历。';
      }}
    ], 26, 46);
  tail('st_l3_tail', 'l3', '风口过去以后',
    '后来那个行业又起了几次风。你在新闻里看见熟悉的名字，给老朋友发了条消息，没提当年的事。', function (g) {
      if (g.lines.l3.result === 'fail') { m(g, { debt: -5000 }); a(g, { stress: -3 }); return '债还了一部分，日子慢慢回到正轨。'; }
      a(g, { happiness: 1 });
      return '你没有再上那趟车，也没有后悔。';
    }, 55, 90);

  /* ---------- 4《楼下的老人》 ---------- */
  node('st_l4_1', 'l4', 1, '楼下的老人',
    '楼下住着一位独居老人。每次见她，她都一个人拎着很沉的菜。今天她在楼梯口歇了两次。', [
      { label: '帮她拎上去', hint: '消耗 1 行动点 · 结识', tone: 'safe', apply: function (g) {
        spendAP(g, 1);
        L.LINES.set(g, 'l4', 2);
        ensureNpcRole(g, '邻居老人', '楼下的老人');
        npcTouch(g, '邻居老人', { intimacy: 18 });
        a(g, { happiness: 3, stress: -2, health: -1 });
        L.LINES.push(g, 'st_l4_2', 2, '你帮老人把菜拎上了楼');
        return '你帮她把菜拎上五楼。她非要塞给你两个橘子。';
      }},
      { label: '点个头就走', hint: '', tone: 'switch', apply: function (g) {
        L.LINES.set(g, 'l4', 2);
        a(g, { stress: 1 });
        L.LINES.push(g, 'st_l4_2', 3, '你只是点了个头');
        return '你点了下头，脚步没停。';
      }},
      { label: '绕开走', hint: '后来会想起', tone: 'cold', apply: function (g) {
        L.LINES.set(g, 'l4', 2);
        a(g, { happiness: -1 });
        L.LINES.push(g, 'st_l4_2', 3, '你从另一侧楼梯上去了');
        return '你从另一侧的楼梯上去，没和她打招呼。';
      }}
    ], 22, 45);

  node('st_l4_2', 'l4', 2, '她讲的那些年',
    '老人留你坐一会儿。她说起年轻时在纺织厂，说起一个再也没回来的人。她讲得很慢。', [
      { label: '坐下来听完', hint: '消耗 1 行动点 · 承诺每周来', tone: 'safe', apply: function (g) {
        spendAP(g, 1);
        L.LINES.set(g, 'l4', 3);
        ensureNpcRole(g, '邻居老人', '楼下的老人');
        npcTouch(g, '邻居老人', { intimacy: 20 });
        a(g, { happiness: 4, stress: -3 });
        L.PROMISE.add(g, {
          npcRole: '邻居老人', type: 'promise', who: '楼下的老人',
          text: '每周上来看你一次',
          dueYear: g.year + 2, consequence: '她一直记着这句话', lineId: 'l4'
        });
        L.LINES.push(g, 'st_l4_3', 3, '你答应每周都来');
        return '你答应每周上来一次。她笑的时候，眼角的褶子很深。';
      }},
      { label: '听一半，找个理由走', hint: '关系普通', tone: 'switch', apply: function (g) {
        L.LINES.set(g, 'l4', 3);
        npcTouch(g, '邻居老人', { intimacy: 6 });
        a(g, { happiness: 1 });
        L.LINES.push(g, 'st_l4_3', 3, '你听了一半就走了');
        return '你听完一半，说还要接孩子，起身走了。';
      }},
      { label: '打断她，问有没有需要帮忙的', hint: '', tone: 'cold', apply: function (g) {
        L.LINES.set(g, 'l4', 3);
        npcTouch(g, '邻居老人', { intimacy: -2 });
        a(g, { stress: 1 });
        L.LINES.push(g, 'st_l4_3', 3, '你打断了她');
        return '你问她有没有要修的电器，她说没有。';
      }}
    ], 24, 46);

  node('st_l4_3', 'l4', 3, '那个冬天',
    '入冬以后，楼下那扇窗连着几天没亮灯。你敲门，没人应。物业说，老人被送去了医院。', [
      { label: '去医院守着', hint: '消耗 1 行动点 · 见最后一面', tone: 'safe', apply: function (g) {
        spendAP(g, 1);
        L.LINES.set(g, 'l4', 4);
        g.lines.l4.extra.final = true;
        npcTouch(g, '邻居老人', { health: -20 });
        a(g, { happiness: -2, stress: 3 });
        L.LINES.push(g, 'st_l4_4', 1, '你守在她床边');
        return '你守了两天。她醒过来一次，问你吃饭没有。';
      }},
      { label: '托物业帮忙，自己没去', hint: '遗憾', tone: 'switch', apply: function (g) {
        L.LINES.set(g, 'l4', 4);
        a(g, { happiness: -2, stress: 2 });
        L.LINES.push(g, 'st_l4_4', 2, '你托物业带了点东西过去');
        return '你买了水果托物业带过去，自己没上楼。';
      }},
      { label: '当作不知道', hint: '断掉这条线', tone: 'cold', apply: function (g) {
        L.LINES.drop(g, 'l4');
        a(g, { happiness: -3, stress: 3 });
        L.LINES.push(g, 'st_l4_tail', 3, '那扇窗一直没再亮');
        return '你每次经过都低着头。';
      }}
    ], 26, 48);

  node('st_l4_4', 'l4', 4, '留下的东西',
    '老人走了。她的子女从外地赶回来，在楼道里清出一只旧木箱，说里面有给你的东西。', [
      { label: '收下遗物', hint: '得到书与信 · 可能走红', tone: 'safe', apply: function (g) {
        L.LINES.set(g, 'l4', 5);
        g.lines.l4.extra.relic = true;
        a(g, { happiness: 4, stress: -2, knowledge: 3 });
        if (g.clues) g.clues.push({ year: g.year, age: g.age, lineId: 'l4', text: '老人留下的一封信，署名不是她的名字' });
        var famous = chance(0.3 + (g.attrs.charm || 0) / 500);
        if (famous) {
          a(g, { reputation: 6, happiness: 5 });
          m(g, { cash: 8000 });
          g.lines.l4.extra.fame = true;
          return '你把她的故事写了下来，发在网上，意外地火了。';
        }
        return '箱子里是一本旧书和一封信。信里提到一个你没听过的名字。';
      }},
      { label: '只拿那本书', hint: '', tone: 'switch', apply: function (g) {
        L.LINES.set(g, 'l4', 5);
        a(g, { happiness: 2, knowledge: 2 });
        return '你只拿了那本旧书，其余让她的子女带走。';
      }},
      { label: '什么都不要', hint: '轻装 · 心结', tone: 'cold', apply: function (g) {
        L.LINES.set(g, 'l4', 5);
        a(g, { happiness: -1, stress: -2 });
        return '你说东西都留给家里人吧。';
      }}
    ], 28, 50);
  tail('st_l4_tail', 'l4', '那扇没亮的窗',
    '再后来那间屋子住进了别人。你偶尔还会想起她说话的速度。', null, 55, 90);

  /* ---------- 5《同桌的坠落》 ---------- */
  node('st_l5_1', 'l5', 1, '同桌开始逃课',
    '同桌的座位空了三天。有人说他跟着校门口那伙人混，晚上在台球厅。他让你别告诉老师。', [
      { label: '劝他回来上课', hint: '友情上升', tone: 'safe', apply: function (g) {
        L.LINES.set(g, 'l5', 2);
        ensureNpcRole(g, '同桌', '同桌');
        npcTouch(g, '同桌', { intimacy: 10 });
        a(g, { stress: 2, happiness: 1 });
        L.LINES.push(g, 'st_l5_2', 1, '你劝了他一节课');
        return '你劝了他一节课，他嘴上答应，第二天还是没来。';
      }},
      { label: '帮他打掩护', hint: '风险 · 被拉拢', tone: 'risk', apply: function (g) {
        L.LINES.set(g, 'l5', 2); g.lines.l5.moral -= 1;
        ensureNpcRole(g, '同桌', '同桌');
        npcTouch(g, '同桌', { intimacy: 14 });
        a(g, { stress: 3, reputation: -2 });
        L.LINES.push(g, 'st_l5_2', 1, '你替他答了到');
        return '你替他答了两次到，老师看了你一眼。';
      }},
      { label: '告诉老师', hint: '他被记过 · 关系破裂', tone: 'cold', apply: function (g) {
        L.LINES.set(g, 'l5', 2); g.lines.l5.moral += 2;
        ensureNpcRole(g, '同桌', '同桌');
        npcTouch(g, '同桌', { intimacy: -20 });
        a(g, { reputation: 2, stress: 2 });
        L.LINES.push(g, 'st_l5_2', 1, '你去了老师办公室');
        return '老师把他从台球厅拎了回来。他看你的眼神变了。';
      }}
    ], 12, 18);

  node('st_l5_2', 'l5', 2, '他让你选一边',
    '同桌把你拉到楼梯拐角，说兄弟们晚上有事，让你一起去，只站场子，不动手。', [
      { label: '去，但只看不动手', hint: '风险 · 可能被拖下水', tone: 'risk', apply: function (g) {
        L.LINES.set(g, 'l5', 3); g.lines.l5.moral -= 1;
        ensureNpcRole(g, '同桌', '同桌');
        npcTouch(g, '同桌', { intimacy: 12 });
        a(g, { stress: 5 });
        L.LINES.push(g, 'st_l5_3', 2, '你去了那个晚上');
        return '你站在墙边，看见有人从口袋里掏出了东西。';
      }},
      { label: '拒绝，拉他回来', hint: '友情考验', tone: 'safe', apply: function (g) {
        L.LINES.set(g, 'l5', 3);
        ensureNpcRole(g, '同桌', '同桌');
        npcTouch(g, '同桌', { intimacy: -4 });
        a(g, { stress: 3, happiness: -1 });
        L.LINES.push(g, 'st_l5_3', 2, '你把他拽回了教室');
        return '你把他拽回教室，他甩开你的手，但没再去。';
      }},
      { label: '转身走，不再来往', hint: '中断 · 留尾巴', tone: 'cold', apply: function (g) {
        L.LINES.drop(g, 'l5');
        a(g, { stress: -2, happiness: -2 });
        L.LINES.push(g, 'st_l5_tail', 4, '你换了座位');
        return '你申请换了座位，再没和他说过话。';
      }}
    ], 13, 18);

  node('st_l5_3', 'l5', 3, '他出事了',
    '那年冬天，同桌出事了。电话打到你这里时，你正在准备一场很重要的考试。', [
      { label: '放下一切去拉他', hint: '按运气判定 · 可能被拖下水', tone: 'risk', apply: function (g) {
        L.LINES.set(g, 'l5', 4); g.lines.l5.points += 2;
        ensureNpcRole(g, '同桌', '同桌');
        if (chance(0.5 + (g.attrs.charm || 0) / 300)) {
          g.lines.l5.extra.saved = true;
          npcTouch(g, '同桌', { intimacy: 25 });
          a(g, { happiness: 4, stress: 4, reputation: 3 });
          return '你赶到的时候还来得及。他后来跟人说，是你把他拉回来的。';
        }
        g.lines.l5.extra.dragged = true;
        npcTouch(g, '同桌', { intimacy: 10 });
        a(g, { stress: 9, happiness: -5, reputation: -5 });
        m(g, { cash: -6000 });
        return '你去了，却把自己也卷了进去。事情比你想的复杂得多。';
      }},
      { label: '保持距离', hint: '安全 · 遗憾', tone: 'switch', apply: function (g) {
        L.LINES.set(g, 'l5', 4);
        ensureNpcRole(g, '同桌', '同桌');
        npcTouch(g, '同桌', { intimacy: -10 });
        a(g, { stress: 2, happiness: -3 });
        return '你没有去。后来听说事情闹得很大。';
      }},
      { label: '跟着他走', hint: '歧路人生', tone: 'cold', apply: function (g) {
        L.LINES.set(g, 'l5', 4); g.lines.l5.moral -= 2;
        g.identityTag = '走过歧路的人';
        ensureNpcRole(g, '同桌', '同桌');
        npcTouch(g, '同桌', { intimacy: 18 });
        a(g, { reputation: -8, stress: 6, happiness: -2 });
        return '你替他跑了一趟，从此有些路就不好回头了。';
      }},
      { label: '告发', hint: '短期被恨 · 长期可能救了他', tone: 'safe', apply: function (g) {
        L.LINES.set(g, 'l5', 4); g.lines.l5.points += 2;
        ensureNpcRole(g, '同桌', '同桌');
        npcTouch(g, '同桌', { intimacy: -30 });
        a(g, { reputation: 4, stress: 5, happiness: -2 });
        L.PROMISE.add(g, { npcRole: '同桌', type: 'absence', who: '同桌', text: '你报了警，没有提前告诉他', dueYear: g.year + 8, consequence: '他记了很多年', lineId: 'l5' });
        return '你报了警。警察来的时候，他看了你一眼，什么都没说。';
      }}
    ], 15, 20);

  node('st_l5_4', 'l5', 4, '很多年以后的重逢',
    '很多年后，你在一个很普通的地方遇见他。他变了，也没全变。', [
      { label: '坐下来喝一杯', hint: '和解或翻旧账', tone: 'safe', apply: function (g) {
        L.LINES.set(g, 'l5', 5);
        ensureNpcRole(g, '同桌', '同桌');
        if (g.lines.l5.extra.saved || g.lines.l5.moral >= 1) {
          npcTouch(g, '同桌', { intimacy: 12 });
          a(g, { happiness: 4, stress: -2 });
          return '他说那年你替他扛下的处分，多亏你。你们喝到很晚。';
        }
        npcTouch(g, '同桌', { intimacy: -6 });
        a(g, { happiness: -2, stress: 2 });
        return '他喝了两杯就说起当年，话里有刺。';
      }},
      { label: '远远点个头', hint: '', tone: 'switch', apply: function (g) {
        L.LINES.set(g, 'l5', 5);
        a(g, { stress: -1 });
        return '你和他点了个头，各自走开。';
      }}
    ], 26, 45);
  tail('st_l5_tail', 'l5', '换掉的座位',
    '那张课桌后来换了好几任主人。你偶尔会梦见楼梯拐角那盏灯。', null, 55, 90);

  /* ---------- 6《体检报告上的那个箭头》：起 → 承 → 承 → 转 → 合 → 余波 ---------- */
  node('st_l6_1', 'l6', 1, '报告单上的箭头',
    '体检中心三楼的走廊，上午十点。同事在电梯口等你，手机在口袋里震个不停。报告单上有一项被画了一个向上的箭头，医生用笔点了点那行数字：三个月后来复查。你把报告折成四折，塞进西装内袋。', [
      { label: '当天就约复查', hint: '花费 800 · 早发现', tone: 'safe', apply: function (g) {
        m(g, { cash: -800 });
        L.LINES.set(g, 'l6', 2);
        pushNode(g, 'st_l6_2', 3, '你在导诊台约了下周的号');
        return '你在导诊台约了下周的号，把那张纸重新展开，压平，夹进工作证。';
      }},
      { label: '先拖着，忙完这阵', hint: '健康 -6 · 压力 +3', tone: 'switch', apply: function (g) {
        a(g, { health: -6, stress: 3 });
        L.LINES.set(g, 'l6', 2);
        pushNode(g, 'st_l6_2', 3, '你把报告压进了抽屉');
        return '你把报告压进办公桌最下面那格抽屉，上面盖了一叠报销单。';
      }},
      { label: '换一家医院再查', hint: '花费 1500 · 换一个说法', tone: 'risk', apply: function (g) {
        m(g, { cash: -1500 });
        L.LINES.set(g, 'l6', 2);
        pushNode(g, 'st_l6_2', 3, '你挂了下周另一家医院的号');
        return '第二家医院的医生看片子时眉头皱了一下，说再做一个，别省这个钱。';
      }}
    ], 26, 45, 'crossroad', 73, '起');

  node('st_l6_2', 'l6', 2, '周四下午的号',
    '复查排在周四下午。你请了半天假，扣两百块全勤；检查费三千，医保报一半。你在走廊里给领导发消息，说下午回不去，指尖在屏幕上停了很久。医生把片子推过来，说需要进一步检查，也可能只是虚惊一场。', [
      { label: '安排进一步检查', hint: '花费 3000 · 压力 +8', tone: 'risk', apply: function (g) {
        m(g, { cash: -3000 });
        L.LINES.set(g, 'l6', 3);
        if (chance(0.5)) {
          g.lines.l6.extra.serious = true;
          a(g, { health: -8, stress: 8 });
          pushNode(g, 'st_l6_3', 2, '进一步检查的结果不算好');
          return '结果不算好，需要尽快处理。你在走廊尽头坐到天黑，手机里还有十一个未接来电。';
        }
        a(g, { health: 2, stress: 3, happiness: 2 });
        pushNode(g, 'st_l6_3', 2, '结果是良性的');
        return '结果是良性的。你走出医院，觉得下午的阳光有点刺眼。';
      }},
      { label: '保守治疗，先观察', hint: '不确定 · 可能延误', tone: 'switch', apply: function (g) {
        L.LINES.set(g, 'l6', 3);
        if (chance(0.45)) {
          g.lines.l6.extra.serious = true;
          a(g, { health: -12, stress: 5 });
          pushNode(g, 'st_l6_3', 2, '半年后症状加重');
          return '半年后症状加重，你半夜挂急诊，才又回到这家医院。';
        }
        a(g, { health: 1, stress: -2, happiness: 1 });
        pushNode(g, 'st_l6_3', 2, '你按医嘱调整作息');
        return '你按医嘱调整作息，三个月后指标慢慢稳住了。';
      }},
      { label: '不做检查，先回去开会', hint: '健康 -10 · 压力 +6', tone: 'cold', apply: function (g) {
        L.LINES.set(g, 'l6', 3);
        g.lines.l6.extra.serious = true;
        a(g, { health: -10, stress: 6, happiness: -3 });
        pushNode(g, 'st_l6_3', 2, '你把报告塞回口袋，回去开会');
        return '你把报告塞回西装内袋，回去开了一个很长的会，散会时已经十点半。';
      }}
    ], 28, 48, 'crossroad', 73, '承');

  node('st_l6_3', 'l6', 3, '夜里三点',
    '半年过去。你开始夜里三点醒，枕头上有一小片汗。陪你复诊的同事把报告摊在餐桌上，说：你打算拖到什么时候。餐桌上还摆着上周的挂号单，边角已经卷了。', [
      { label: '请假住院，把工作交出去', hint: '花费 5000 · 健康 +6', tone: 'safe', apply: function (g) {
        m(g, { cash: -5000 });
        L.LINES.set(g, 'l6', 4);
        a(g, { health: 6, stress: -3 });
        pushNode(g, 'st_l6_4', 3, '你请了长假，住进了医院');
        return '你请了长假，把电脑交给同事，住院单压在床头柜上。头一晚你睡了六个小时。';
      }},
      { label: '一边治疗一边上班', hint: '健康 -6 · 压力 +6', tone: 'risk', apply: function (g) {
        L.LINES.set(g, 'l6', 4);
        a(g, { health: -6, stress: 6 });
        pushNode(g, 'st_l6_4', 3, '你白天上班，晚上去医院');
        return '你白天上班，晚上去医院输液，左手背上贴了一星期的胶布。';
      }},
      { label: '换中医，慢慢调', hint: '花费 2000 · 换一条路', tone: 'switch', apply: function (g) {
        m(g, { cash: -2000 });
        L.LINES.set(g, 'l6', 4);
        a(g, { stress: 2 });
        pushNode(g, 'st_l6_4', 3, '你换了一家中医院');
        return '你换了一家中医院，医生给你开了三十副药，药味在阳台上晾了一整月。';
      }}
    ], 30, 50, 'crossroad', 73, '承');

  node('st_l6_4', 'l6', 4, '两张片子并排放',
    '结果出来了。医生把两张片子并排放在灯箱上，指着左边那张说：第一家拍漏了一处，这个位置半年前就该处理。你盯着那个箭头看了很久，才发现它的方向一直是同一个。', [
      { label: '立刻手术，能签的字都签了', hint: '花费 20000 · 健康 +4', tone: 'risk', apply: function (g) {
        m(g, { cash: -20000 });
        L.LINES.set(g, 'l6', 5);
        a(g, { health: 4, stress: 5 });
        pushNode(g, 'st_l6_5', 2, '你在手术同意书上签了字');
        return '你在三张同意书上一笔一划签了自己的名字，护士把你推进去的时候，走廊的灯还亮着。';
      }},
      { label: '先做穿刺，等结果', hint: '花费 6000 · 多等一个月', tone: 'switch', apply: function (g) {
        m(g, { cash: -6000 });
        L.LINES.set(g, 'l6', 5);
        a(g, { stress: 3 });
        pushNode(g, 'st_l6_5', 2, '你决定先做穿刺');
        return '你决定先做穿刺，等结果的那一个月，你把手机屏保换成了日历。';
      }},
      { label: '不做了，出院回家', hint: '健康 -14 · 幸福感 -5', tone: 'cold', apply: function (g) {
        L.LINES.set(g, 'l6', 5);
        a(g, { health: -14, happiness: -5, stress: 4 });
        pushNode(g, 'st_l6_5', 2, '你办了出院手续');
        return '你办了出院手续，把没拆封的病号服叠好放在床尾，护士站的人都没有拦你。';
      }}
    ], 32, 52, 'crossroad', 73, '转');

  node('st_l6_5', 'l6', 5, '箭头消失了吗',
    '治疗结束后的第一个复查日。你把三张报告按时间顺序排在桌上，那个箭头在最后一张上变了样子。同事发消息问你结果，你打了半天字，又都删掉。', [
      { label: '认真治完，按时复查', hint: '健康 +8 · 幸福感 +5', tone: 'safe', apply: function (g) {
        L.LINES.set(g, 'l6', 6); g.lines.l6.result = 'good';
        a(g, { health: 8, stress: -4, happiness: 5 });
        pushNode(g, 'st_l6_tail', 3, '复查单上的箭头消失了');
        return g.year + ' 年春天，复查单上那一行指标回到了参考范围。你把三张旧报告叠在一起，扔进了碎纸机。同事说：你这半年像换了个人。';
      }},
      { label: '指标压住了，但药不能停', hint: '健康 -2 · 苦乐参半', tone: 'switch', apply: function (g) {
        L.LINES.set(g, 'l6', 6); g.lines.l6.result = 'bitter';
        a(g, { health: -2, stress: 2, happiness: 2 });
        pushNode(g, 'st_l6_tail', 3, '药盒按星期分好，摆在餐桌上');
        return '指标压住了，药要一直吃。药盒按星期分好，一格一格摆在餐桌上，你从此记住了每一次复查的日期。';
      }},
      { label: '提前退休，把日子慢下来', hint: '健康 -6 · 幸福感 -2', tone: 'cold', apply: function (g) {
        L.LINES.set(g, 'l6', 6); g.lines.l6.result = 'bad';
        a(g, { health: -6, happiness: -2, stress: -3 });
        if (g.job) g.job.retired = true;
        pushNode(g, 'st_l6_tail', 3, '你四十九岁那年提前退了休');
        return '刀口愈合得慢，第二年又做了一次。你四十九岁提前退了休，每天下午去公园走两圈，走一百米就要坐下来歇一会儿。';
      }}
    ], 34, 55, 'crossroad', 73, '合');

  tail('st_l6_tail', 'l6', '取号机前的队伍',
    '很多年以后，你还是每年去那家医院。取号机前排着长队，报告单上的箭头换成了另一个指标。',
    function (g) {
      a(g, { health: -2, stress: -1 });
      return g.year + ' 年秋天，护士抬头叫你的名字，把报告递出来，说：还是老样子，按时来就行。';
    }, 36, 90);

  /* ---------- 7《老宅拆迁》 ---------- */
  node('st_l7_1', 'l7', 1, '拆迁通知',
    '老家那面墙上喷了一个白色的“拆”字。补偿方案贴在村委会门口，按人头也按面积。', [
      { label: '回去研究方案', hint: '理智', tone: 'safe', apply: function (g) {
        L.LINES.set(g, 'l7', 2); a(g, { knowledge: 2, stress: 3 });
        L.LINES.push(g, 'st_l7_2', 2, '你把补偿方案算了三遍');
        return '你把方案拍了照，在纸上算了三遍。';
      }},
      { label: '先跟亲戚通个气', hint: '人情优先', tone: 'switch', apply: function (g) {
        L.LINES.set(g, 'l7', 2);
        a(g, { stress: 2, happiness: 1 });
        L.LINES.push(g, 'st_l7_2', 2, '你给几个亲戚打了电话');
        return '电话打了一圈，每个人都说“按规矩来”，语气却不一样。';
      }},
      { label: '直接说要争', hint: '冲突前置', tone: 'risk', apply: function (g) {
        L.LINES.set(g, 'l7', 2); g.lines.l7.moral -= 1;
        a(g, { stress: 4, reputation: -2 });
        L.LINES.push(g, 'st_l7_2', 2, '你在家族群里放了话');
        return '你在家族群里说，该我们的一分不能少。';
      }}
    ], 28, 55);

  node('st_l7_2', 'l7', 2, '亲戚的算盘',
    '方案里的面积和户口对不上。有人提议把你家那一份并到老人名下，说这样“大家都能多拿”。', [
      { label: '力争到底', hint: '多拿钱 · 亲情破裂', tone: 'risk', apply: function (g) {
        L.LINES.set(g, 'l7', 3); g.lines.l7.moral -= 2;
        a(g, { stress: 6, reputation: -3 });
        npcTouch(g, '父亲', { intimacy: -3 });
        L.LINES.push(g, 'st_l7_3', 2, '你请了律师');
        return '你请了律师，把该说的话在桌上说了一遍。';
      }},
      { label: '让一步', hint: '少拿钱 · 晚年亲情回报', tone: 'safe', apply: function (g) {
        L.LINES.set(g, 'l7', 3); g.lines.l7.moral += 2;
        npcTouch(g, '父亲', { intimacy: 8 });
        a(g, { stress: -2, happiness: 3 });
        L.LINES.push(g, 'st_l7_3', 2, '你在协议上先签了字');
        return '你说按老人说的办，少一点就少一点。';
      }},
      { label: '调解', hint: '按魅力判定 · 可能两全', tone: 'switch', apply: function (g) {
        L.LINES.set(g, 'l7', 3);
        if (chance(0.4 + (g.attrs.charm || 0) / 250)) {
          g.lines.l7.extra.balanced = true;
          m(g, { cash: 30000 });
          a(g, { happiness: 3, reputation: 4, stress: 2 });
          return '你把两家人拉到一张桌上，最后各退半步，居然谈成了。';
        }
        a(g, { stress: 6, happiness: -2, reputation: -2 });
        return '你两头劝，最后两头都觉得你偏心。';
      }},
      { label: '放弃，不争了', hint: '解锁看淡金钱', tone: 'cold', apply: function (g) {
        L.LINES.drop(g, 'l7', 4);
        g.lines.l7.result = 'letgo';
        g.flags.lookDownMoney = true;
        a(g, { stress: -6, happiness: 5 });
        return '你说这钱不要了，老宅留着照片就行。';
      }}
    ], 30, 58);

  node('st_l7_3', 'l7', 3, '签字那天',
    '签字那天下了小雨。协议摊在桌上，每个人都在看别人先落笔。', [
      { label: '按谈好的签', hint: '按此前立场结算', tone: 'safe', apply: function (g) {
        L.LINES.set(g, 'l7', 4);
        var got = 80000 + (g.lines.l7.moral > 0 ? 20000 : (g.lines.l7.moral < 0 ? -10000 : 0));
        m(g, { cash: got });
        if (g.lines.l7.moral < 0) npcTouch(g, '父亲', { intimacy: -12 });
        if (g.lines.l7.moral > 0) npcTouch(g, '父亲', { intimacy: 10 });
        a(g, { happiness: g.lines.l7.moral > 0 ? 3 : -3, stress: -3 });
        g.lines.l7.result = 'signed';
        return '你落笔的时候，窗外正好有一辆车开过。';
      }},
      { label: '临时加条件', hint: '可能谈崩', tone: 'risk', apply: function (g) {
        L.LINES.set(g, 'l7', 4);
        if (chance(0.4)) {
          m(g, { cash: 120000 });
          a(g, { stress: 5, reputation: -3 });
          npcTouch(g, '父亲', { intimacy: -16 });
          return '你把条件加了上去，对方居然答应了。饭桌上再没人说话。';
        }
        m(g, { cash: 40000 });
        a(g, { stress: 8, happiness: -4 });
        return '谈到最后谈崩了，补偿拖了两年才下来。';
      }}
    ], 32, 60);
  tail('st_l7_tail', 'l7', '老宅不在了',
    '推土机来的那天你没去看。后来那里盖起了一排一模一样的楼。', function (g) {
      if (g.flags.lookDownMoney) { a(g, { happiness: 2, stress: -2 }); return '你没有觉得少了什么。'; }
      a(g, { happiness: -1 });
      return '你偶尔会想起院子里那棵树。';
    }, 55, 90);

  /* ---------- 8《深夜的一条消息》 ---------- */
  node('st_l8_1', 'l8', 1, '深夜的一条消息',
    '夜里十二点，手机亮了一下。一个不该在这个时候出现的名字，发来一句：还没睡吗？', [
      { label: '回一句', hint: '关系可能升温 · 风险', tone: 'risk', apply: function (g) {
        L.LINES.set(g, 'l8', 2); g.lines.l8.extra.warm = true;
        a(g, { stress: 3, happiness: 2 });
        L.LINES.push(g, 'st_l8_2', 1, '你回了一句“还没”');
        return '你回了三个字，对方很快又发来一条。';
      }},
      { label: '不回，第二天再说', hint: '保持距离', tone: 'switch', apply: function (g) {
        L.LINES.set(g, 'l8', 2);
        a(g, { stress: 2 });
        L.LINES.push(g, 'st_l8_2', 2, '你把手机扣在了桌上');
        return '你把手机扣在桌上，很久没睡着。';
      }},
      { label: '直接拉黑', hint: '及时止损', tone: 'safe', apply: function (g) {
        L.LINES.set(g, 'l8', 2); g.flags.l8_block = true;
        a(g, { stress: -2, happiness: 1 });
        L.LINES.push(g, 'st_l8_2', 4, '你拉黑了那个名字');
        return '你点了拉黑，心里空了一下，又觉得踏实。';
      }}
    ], 24, 45);

  node('st_l8_2', 'l8', 2, '消息越来越密',
    '那之后，消息越来越密。对方开始说一些只有你们两个人听得懂的话。', [
      { label: '继续聊，只见面不越界', hint: '暧昧 · 压力上升', tone: 'risk', apply: function (g) {
        L.LINES.set(g, 'l8', 3);
        a(g, { stress: 6, happiness: 3 });
        L.LINES.push(g, 'st_l8_3', 2, '你们见了一面');
        return '你们在咖啡馆坐了两个小时，谁都没提各自的家。';
      }},
      { label: '明确说不合适', hint: '止损 · 信任可能回升', tone: 'safe', apply: function (g) {
        L.LINES.set(g, 'l8', 3); g.flags.l8_stop = true;
        var p = partnerFallback(g);
        if (p) npcTouch(g, p.role, { intimacy: 6 });
        a(g, { stress: -3, happiness: 2 });
        L.LINES.push(g, 'st_l8_4', 3, '你把话说清楚了');
        return '你回了一条很长的消息，然后删掉了对话框。';
      }},
      { label: '断联，但不说', hint: '隐瞒 · 压力留下', tone: 'switch', apply: function (g) {
        L.LINES.set(g, 'l8', 3);
        a(g, { stress: 5, happiness: -2 });
        L.LINES.push(g, 'st_l8_4', 2, '你不再回复');
        return '你把对方设成了消息免打扰，也没告诉任何人。';
      }}
    ], 26, 47);

  node('st_l8_3', 'l8', 3, '越界之后',
    '事情还是走到了那一步。回家的路上你一直在想，钥匙插进锁孔时该怎么开口。', [
      { label: '主动坦白', hint: '高风险高回报 · 按伴侣性格判定', tone: 'risk', apply: function (g) {
        L.LINES.set(g, 'l8', 4);
        var p = partnerFallback(g);
        var tolerant = p && (Number(p.intimacy) || 0) >= 70;
        if (tolerant && chance(0.55 + (g.attrs.charm || 0) / 300)) {
          if (p) npcTouch(g, p.role, { intimacy: 8 });
          a(g, { stress: 5, happiness: 3 });
          g.lines.l8.result = 'honest-ok';
          return '你把事情说了。她沉默了很久，最后说，以后别再这样。';
        }
        if (p) npcTouch(g, p.role, { intimacy: -25 });
        a(g, { stress: 9, happiness: -8, reputation: -3 });
        g.lines.l8.result = 'honest-bad';
        return '你说了，她听完就开始收拾东西。那晚家里很安静。';
      }},
      { label: '瞒着', hint: '被发现概率高', tone: 'cold', apply: function (g) {
        L.LINES.set(g, 'l8', 4);
        if (chance(0.55)) {
          var pp = partnerFallback(g);
          if (pp) npcTouch(g, pp.role, { intimacy: -30 });
          a(g, { stress: 8, happiness: -7 });
          g.lines.l8.result = 'caught';
          return '她翻到了那条没删干净的消息。';
        }
        a(g, { stress: 7, happiness: -4 });
        g.lines.l8.result = 'hidden';
        return '你把所有记录都清了。日子照常过，但你开始怕手机响。';
      }},
      { label: '立刻断掉', hint: '压力下降 · 婚姻保全', tone: 'safe', apply: function (g) {
        L.LINES.set(g, 'l8', 4);
        var p2 = partnerFallback(g);
        if (p2) npcTouch(g, p2.role, { intimacy: 4 });
        a(g, { stress: 4, happiness: 1 });
        g.lines.l8.result = 'cut';
        return '你换了号码，删掉了所有联系方式。';
      }}
    ], 28, 49);

  node('st_l8_4', 'l8', 4, '日子还要过下去',
    '这件事最后有了一个结果。有人留下，有人离开，也有人什么都没发生。', [
      { label: '把心收回来', hint: '', tone: 'safe', apply: function (g) {
        L.LINES.set(g, 'l8', 5);
        var p = partnerFallback(g);
        if (p) npcTouch(g, p.role, { intimacy: 8 });
        a(g, { stress: -4, happiness: 4 });
        g.lines.l8.result = g.lines.l8.result || 'calm';
        return '你把手机里的东西清干净，回家吃了一次完整的晚饭。';
      }},
      { label: '顺其自然', hint: '留下裂缝', tone: 'switch', apply: function (g) {
        L.LINES.set(g, 'l8', 5);
        a(g, { happiness: -2, stress: 2 });
        return '你没有承诺什么，也没有再提。';
      }}
    ], 30, 52);
  tail('st_l8_tail', 'l8', '删掉的对话框',
    '后来你换了手机。有些名字不会再出现在通讯录里。', null, 55, 90);

  /* ---------- v35 链节点锁序补丁：上一个节点没发生，后一个不随机起跳 ---------- */
  (function () {
    for (var i = 0; i < EV.length; i++) {
      var e = EV[i];
      if (!e || !e.id || e.id.indexOf('v35_ch_') < 0) continue;
      if (!e.chainStep || e.chainStep <= 1) continue;
      (function (ev) {
        var prev = ev.id.replace(/_(\d+)$/, function (s, n) { return '_' + (Number(n) - 1); });
        ev.cond = function (g) { return !!(g.fireAge && g.fireAge[prev]); };
      })(e);
    }
  })();

  /* =========================================================
     六、交叉撞车点（≥6）
     ========================================================= */
  var COLLISIONS = [
    {
      id: 'col_health_empire', line: 'l6+l3', check: function (g) {
        return g.lines.l3.node >= 2 && g.lines.l6.node >= 2 && (g.attrs.health || 0) < 65;
      },
      ageMin: 26, ageMax: 60,
      title: '扩张还是去医院',
      text: '项目正到关键处，体检报告也到了复查日期。同一天，两个电话都打了进来。',
      opts: [
        { label: '先去扩张', hint: '事业 + · 健康 -', tone: 'risk', apply: function (g) {
          L.LINES.set(g, 'l3', 4); a(g, { health: -10, stress: 8, reputation: 3 });
          L.LINES.push(g, 'st_l6_2', 1, '你把复查往后推了');
          return '你把复查推到了下个月。项目往前走了，你也第一次在办公室晕了一下。';
        }},
        { label: '先去医院', hint: '健康 + · 事业让位', tone: 'safe', apply: function (g) {
          L.LINES.set(g, 'l6', 3); a(g, { health: 4, stress: -2 });
          L.LINES.push(g, 'st_l3_4', 2, '你让合伙人先去谈');
          return '你去了医院。合伙人替你顶了那场谈判，回来后脸色不太好。';
        }},
        { label: '陪家人一天', hint: '幸福感 +', tone: 'switch', apply: function (g) {
          a(g, { happiness: 6, stress: -4, health: 1 });
          if (partnerFallback(g)) npcTouch(g, partnerFallback(g).role, { intimacy: 8 });
          return '你谁也没见，回家做了一顿饭。两边都耽搁了一天。';
        }}
      ]
    },
    {
      id: 'col_ledger_demolition', line: 'l2+l7', check: function (g) {
        return g.lines.l2.node >= 3 && g.lines.l7.node >= 2 && (g.lines.l2.moral <= 0 || g.flags.l2_evidence);
      },
      ageMin: 30, ageMax: 60,
      title: '债主找上了拆迁办',
      text: '拆迁款还没到账，债主先找上了门。他说老宅那笔补偿里，有他的一份。',
      opts: [
        { label: '从补偿里还', hint: '花钱了事', tone: 'safe', apply: function (g) {
          m(g, { cash: -30000, debt: -30000 }); a(g, { stress: -2, happiness: 1 });
          L.LINES.set(g, 'l2', 4);
          return '你从补偿款里划了三万过去，对方写了收条。';
        }},
        { label: '让律师出面', hint: '消耗 1 行动点', tone: 'risk', apply: function (g) {
          spendAP(g, 1);
          if (chance(0.5)) { a(g, { stress: -2, reputation: 2 }); m(g, { debt: -10000 }); return '律师把不合理的部分挡了回去。'; }
          m(g, { debt: 15000 }); a(g, { stress: 6 }); return '官司拖了一年，利息又涨了。';
        }},
        { label: '不认，先拖着', hint: '压力 +', tone: 'cold', apply: function (g) {
          a(g, { stress: 5, happiness: -3 }); L.LINES.push(g, 'st_l7_2', 2, '你让债主再等等');
          return '你说钱还没下来，让他再等等。';
        }}
      ]
    },
    {
      id: 'col_friend_startup', line: 'l5+l3', check: function (g) {
        return g.lines.l5.node >= 2 && g.lines.l3.node >= 2;
      },
      ageMin: 18, ageMax: 45,
      title: '他要来你的公司',
      text: '同桌找到你，说想进你的项目。他说当年你拉过他一把，这次换他帮你。',
      opts: [
        { label: '让他进来', hint: '人情 + · 风险', tone: 'risk', apply: function (g) {
          ensureNpcRole(g, '同桌', '同桌');
          npcTouch(g, '同桌', { intimacy: 14 });
          a(g, { stress: 5 });
          if (chance(0.45)) { a(g, { reputation: -3 }); return '他进来后帮了忙，也带来了一些不该带的人。'; }
          a(g, { reputation: 3, happiness: 3 }); return '他做事很拼，把最难的活接了过去。';
        }},
        { label: '给他一笔钱，别进公司', hint: '花钱保全', tone: 'switch', apply: function (g) {
          m(g, { cash: -5000 }); ensureNpcRole(g, '同桌', '同桌');
          npcTouch(g, '同桌', { intimacy: -4 });
          a(g, { happiness: -1 });
          return '你给了他五千，让他先缓一缓。他收下了，没再提进公司的事。';
        }},
        { label: '拒绝', hint: '关系下降', tone: 'cold', apply: function (g) {
          ensureNpcRole(g, '同桌', '同桌');
          npcTouch(g, '同桌', { intimacy: -16 });
          a(g, { stress: -2 });
          return '你说公司现在不方便。他笑了一下，走了。';
        }}
      ]
    },
    {
      id: 'col_letter_affair', line: 'l1+l8', check: function (g) {
        return g.lines.l1.revealed && g.lines.l8.node >= 2;
      },
      ageMin: 24, ageMax: 50,
      title: '两封信，一个人',
      text: '你查到的那个名字，和深夜发来消息的人，居然是同一个姓。',
      opts: [
        { label: '把两件事分开处理', hint: '', tone: 'switch', apply: function (g) {
          a(g, { stress: 4 }); return '你决定不在这个晚上把两件事连起来想。';
        }},
        { label: '问对方认不认识', hint: '可能揭开更多', tone: 'risk', apply: function (g) {
          a(g, { stress: 6, happiness: -2 });
          if (g.origin) g.origin.points += 1;
          return '你发了消息问。对方隔了很久才回：那是我舅舅。';
        }},
        { label: '彻底断掉暧昧', hint: '止损', tone: 'safe', apply: function (g) {
          g.flags.l8_block = true; a(g, { stress: -2, happiness: 1 });
          L.LINES.set(g, 'l8', 3);
          return '你同时删掉了那个对话框。';
        }}
      ]
    },
    {
      id: 'col_countdown_empire', line: 'l6+l3', check: function (g) {
        return g.lines.l6.extra.serious && g.lines.l3.node >= 3 && (g.attrs.health || 0) < 50;
      },
      ageMin: 28, ageMax: 60,
      title: '身体先按了暂停',
      text: '医生要求你立刻住院。同一天，合伙人说融资方要见创始人本人。',
      opts: [
        { label: '住院', hint: '健康优先', tone: 'safe', apply: function (g) {
          L.LINES.set(g, 'l6', 4); a(g, { health: 6, stress: -4, happiness: 2 });
          L.LINES.push(g, 'st_l3_4', 2, '你把融资的事交给了合伙人');
          return '你住进了医院。融资的事，合伙人说他来顶。';
        }},
        { label: '去见融资方', hint: '事业优先', tone: 'risk', apply: function (g) {
          a(g, { health: -12, stress: 9 }); L.LINES.set(g, 'l3', 4);
          return '你拔了针去见投资人。回来的时候，病房的灯还亮着。';
        }},
        { label: '让家人来签字', hint: '家庭上场', tone: 'switch', apply: function (g) {
          var p = partnerFallback(g);
          if (p) npcTouch(g, p.role, { intimacy: 6 });
          a(g, { happiness: 2, health: -3 });
          return '你让家里人替你签了字，自己先去了公司。';
        }}
      ]
    },
    {
      id: 'col_oldman_demolition', line: 'l4+l7', check: function (g) {
        return g.lines.l4.node >= 3 && g.lines.l7.node >= 2;
      },
      ageMin: 30, ageMax: 60,
      title: '老人留下的那间房',
      text: '老人留下的那间屋子也在拆迁范围内。她的子女说，老人曾提过把房子留给你。',
      opts: [
        { label: '接受', hint: '一笔钱 · 人情争议', tone: 'risk', apply: function (g) {
          m(g, { cash: 60000 }); a(g, { happiness: 2, reputation: -3 });
          return '你收下了那间房，也收下了邻里的一些议论。';
        }},
        { label: '让给她的子女', hint: '心安', tone: 'safe', apply: function (g) {
          a(g, { happiness: 5, stress: -3, reputation: 4 });
          return '你在协议上写了放弃。她的女儿给你鞠了一躬。';
        }},
        { label: '折中，拿一半', hint: '', tone: 'switch', apply: function (g) {
          m(g, { cash: 30000 }); a(g, { happiness: 2, stress: 1 });
          return '你们各拿一半，谁都没再说什么。';
        }}
      ]
    },
    {
      id: 'col_origin_demolition', line: 'l9+l7', check: function (g) {
        return g.origin && g.origin.revealed && g.lines.l7.node >= 2;
      },
      ageMin: 30, ageMax: 65,
      title: '户口本上多了一个名字',
      text: '血缘的事刚落地，拆迁办又打来电话：你家的户口，和另一户人对上了。',
      opts: [
        { label: '按血缘认份额', hint: '钱与亲情撕开', tone: 'risk', apply: function (g) {
          m(g, { cash: 50000 }); a(g, { happiness: -3, stress: 6, reputation: -2 });
          return '你多拿了一份，也把两家人推到了对面。';
        }},
        { label: '不争这一份', hint: '血亲关系缓和', tone: 'safe', apply: function (g) {
          a(g, { happiness: 4, stress: -2 });
          var n = ensureNpcRole(g, '亲生家庭', '那边的家人');
          if (n) npcTouch(g, n.role, { intimacy: 12 });
          return '你签了放弃声明，那边的家人第一次主动给你打了电话。';
        }}
      ]
    }
  ];
  COLLISIONS.forEach(function (c) {
    IDX[c.id] = {
      id: c.id, type: 'random', stage: null, tier: 'crossroad', layer: 'chain',
      weight: 0, family: c.id, prio: 72, title: c.title, text: c.text, line: c.line,
      ageMin: c.ageMin, ageMax: c.ageMax,
      opts: c.opts, cond: function (g) { return true; }
    };
  });
  function collisionTick(g) {
    if (!g.colSeen) g.colSeen = {};
    for (var i = 0; i < COLLISIONS.length; i++) {
      var c = COLLISIONS[i];
      /* 撞车涉及多条线：只要有一条没抽中，这辆车就不发 */
      if (!matchLine(g, c.line)) continue;
      if (g.colSeen[c.id]) continue;
      if (!c.check(g)) continue;
      var pids = (g.pending || []).map(function (p) { return p.event; });
      if (pids.indexOf(c.id) >= 0) continue;
      g.colSeen[c.id] = true;
      L.LINES.push(g, c.id, 0, '两条线撞在了一起', true);
    }
  }

  /* =========================================================
     七、线索卡：每年 0–1 条
     ========================================================= */
  var CLUE_POOL = [
    { lineId: 'l9', cond: function (g) { return !g.origin.revealed; }, text: '旧照片背面写着另一个城市的地址，字迹和家里的都不一样。' },
    { lineId: 'l9', cond: function (g) { return !g.origin.revealed; }, text: '老邻居提起，你小时候有一阵子被送去别处住过几个月。' },
    { lineId: 'l2', cond: function (g) { return g.lines.l2.node > 0; }, text: '账本夹层里有一张借条，借款人签名只剩下半个。' },
    { lineId: 'l1', cond: function (g) { return g.lines.l1.node > 0; }, text: '旧书里掉出一张合影，站在父亲旁边的人被剪掉了脸。' },
    { lineId: 'l3', cond: function (g) { return g.lines.l3.node > 0; }, text: '财报里那个反复出现的供应商，名字和你朋友的公司很像。' },
    { lineId: 'l4', cond: function (g) { return g.lines.l4.node > 0; }, text: '楼下那扇窗三天没亮灯，门口堆着两袋没拆的米。' },
    { lineId: 'l5', cond: function (g) { return g.lines.l5.node > 0; }, text: '同学群里有人发了一张旧合照，角落里少了个人。' },
    { lineId: 'l7', cond: function (g) { return g.lines.l7.node > 0; }, text: '拆迁办的人多问了一句：你家户口本上真的就这些人？' },
    { lineId: 'l8', cond: function (g) { return g.lines.l8.node > 0; }, text: '半夜手机屏幕亮了一下，是一条没有备注的号码。' }
  ];

  function clueTick(g) {
    if (g.age < 8) return;
    if (g.lastClueAge !== undefined && g.lastClueAge === g.age) return;
    if (!chance(0.1)) return;
    var pool = CLUE_POOL.filter(function (c) {
      return isSelected(g, c.lineId) && c.cond(g);
    });
    if (!pool.length) return;
    var pick = pool[randInt(0, pool.length - 1)];
    var seq = (g.clueSeq = (g.clueSeq || 0) + 1);
    var id = 'line_clue_' + seq;
    IDX[id] = {
      id: id, type: 'random', stage: null, tier: 'echo', layer: 'chain',
      weight: 0, family: 'line_clue', prio: 74,
      title: '一条没对上的线索',
      text: pick.text,
      opts: [
        { label: '去查一查', hint: '消耗 1 行动点', tone: 'risk', apply: function (g2) {
          if (!spendAP(g2, 1)) return '你这年抽不出时间，线索先夹进了本子。';
          if (!g2.clues) g2.clues = [];
          g2.clues.push({ year: g2.year, age: g2.age, lineId: pick.lineId, text: pick.text });
          var st = lineState(g2, pick.lineId);
          st.points += 1;
          if (pick.lineId === 'l9') g2.origin.points += 1;
          a(g2, { stress: 2 });
          return '你顺着这条线索问了几个人，记下了两个名字。';
        }},
        { label: '记下来，以后再说', hint: '', tone: 'switch', apply: function (g2) {
          if (!g2.clues) g2.clues = [];
          g2.clues.push({ year: g2.year, age: g2.age, lineId: pick.lineId, text: pick.text });
          return '你把这句话记在手机备忘录里。';
        }},
        { label: '当作没看见', hint: '', tone: 'cold', apply: function (g2) {
          a(g2, { stress: 1 });
          return '你划走了那条消息。';
        }}
      ],
      cond: function () { return true; }
    };
    g.lastClueAge = g.age;
    L.LINES.push(g, id, 0, '一条线索出现了');
  }

  /* =========================================================
     八、生成身世征兆事件
     ========================================================= */
  SECRETS.forEach(function (sec) {
    for (var i = 0; i < 3; i++) {
      /* 征兆跟随 SIGN_AGES 出现；带婴儿照的征兆从 3 岁起，兼顾正文里的“婴儿”语义 */
      var lo = SIGN_AGES[i], hi = SIGN_AGES[i] + 3;
      if ((sec.id === 's1' && i === 2) || (sec.id === 's4' && i === 0)) lo = 3;
      makeSignEvent(sec, i, lo, hi);
    }
  });

  /* 暴露给测试 / UI */
  L.LINES.originTruth = function (g) { return g.origin ? g.origin.truth : null; };
  L.LINES.collisions = COLLISIONS.map(function (c) { return { id: c.id, line: c.line, title: c.title }; });
  L.LINES.secret = function (g) { return secretById(g.origin.secretId); };

  /* v3.7：选中线的链节点必须能走完，不因亲属已故的文本过滤而断链 */
  Object.keys(IDX).forEach(function (id) {
    if (/^(st_l\d_|origin_)/.test(id)) IDX[id]._deceasedOk = true;
  });
})();
