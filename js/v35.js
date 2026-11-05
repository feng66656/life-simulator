/* v3.5 第一批：亲属状态守卫、开局主题去重、开局金句
 * 设计原则：所有涉及父母/配偶/子女/兄弟姊妹/朋友的事件，绑定关系槽并校验状态。
 *          已故父母不出“共同生活”事件；无子女不出子女/孙辈事件。
 * 载入顺序：lines.js 之后、engine.js 之前。
 */
(function () {
  var L = window.LS = window.LS || {};
  var V = L.V35 = L.V35 || {};
  var STAGE_IDX = { '婴幼儿': 0, '童年': 1, '少年': 2, '青年': 3, '中年': 4, '中老年': 5, '晚年': 6 };

  /* =========================================================
     1. 关系状态查询
     ========================================================= */
  function npcOf(g, key) {
    return (L.getNpc && g) ? L.getNpc(g, key) : null;
  }
  function alive(g, key) {
    var n = npcOf(g, key);
    return !!(n && n.alive);
  }

  V.childIds = function (g) {
    return (g && g.family && g.family.childrenIds) ? g.family.childrenIds : [];
  };
  /* 是否有过子女（含已故），用于“孩子的东西/照片”类回忆 */
  V.hasChildren = function (g) {
    return V.childIds(g).length > 0 || !!(g && g.stats && g.stats.childrenEver);
  };
  /* 是否有在世子女子女，用于“带孩子/回去看孩子”类共同生活事件 */
  V.hasLivingChild = function (g) {
    var ids = V.childIds(g), i, c;
    for (i = 0; i < ids.length; i++) {
      c = npcOf(g, ids[i]);
      if (c && c.alive) return true;
    }
    return false;
  };
  V.married = function (g) {
    var f = g && g.family;
    return !!(f && f.marriage && f.marriage.status === '已婚' && f.marriage.spouseId);
  };
  V.spouseAlive = function (g) {
    if (!V.married(g)) return false;
    return !!npcOf(g, g.family.marriage.spouseId) && npcOf(g, g.family.marriage.spouseId).alive;
  };
  V.siblingOk = function (g) {
    var s = g && g.sibling;
    if (!s || !s.has) return false;
    var roles = [s.role, '哥哥', '姐姐', '弟弟', '妹妹'];
    for (var i = 0; i < roles.length; i++) {
      var n = roles[i] ? npcOf(g, roles[i]) : null;
      if (n) return !!n.alive;
    }
    return true; /* 有手足设定但尚未建 NPC：放行 */
  };
  /* 朋友：若已建 NPC，则须在世且关系未断；未建则视为泛称，放行 */
  V.friendOk = function (g) {
    var n = npcOf(g, '发小') || npcOf(g, '朋友');
    if (!n) return true;
    if (!n.alive) return false;
    if (typeof n.favor === 'number' && n.favor <= 5) return false;
    return true;
  };

  /* =========================================================
     2. 守卫判定（引擎 condOk 统一调用）
     ========================================================= */
  V.pass = function (g, e) {
    if (!g || !e) return true;
    if (e._guardExempt === 'daily') return true;
    var i;
    if (e.aliveGuard) {
      for (i = 0; i < e.aliveGuard.length; i++) {
        var role = e.aliveGuard[i];
        if (role === '子女' || role === 'child') {
          if (!V.hasLivingChild(g)) return false;
        } else if (role === '配偶' || role === 'spouse') {
          if (!V.spouseAlive(g)) return false;
        } else if (!alive(g, role)) {
          return false;
        }
      }
    }
    if (e.hasChildrenGuard && !V.hasChildren(g)) return false;
    if (e.childAliveGuard && !V.hasLivingChild(g)) return false;
    if (e.childlessGuard && V.hasChildren(g)) return false;
    if (e.spouseGuard && !V.spouseAlive(g)) return false;
    if (e.siblingGuard && !V.siblingOk(g)) return false;
    if (e.friendGuard && !V.friendOk(g)) return false;
    return true;
  };

  /* =========================================================
     3. 选项可用性（渲染时过滤；引擎索引保持对应）
     ========================================================= */
  V.optOk = function (g, opt) {
    if (!opt || !g) return true;
    if (opt.onlyChildless && V.hasChildren(g)) return false;
    if (opt.onlyChild && !V.hasLivingChild(g)) return false;
    if (opt.req) {
      try { if (!opt.req(g)) return false; } catch (x) {}
    }
    /* npc 效果可能在 opt.npc，也可能在 opt.fx.npc / outcomes[].fx.npc。
       已故或不存在的关系不提供该选项，避免选项效果凭空造出一个亲属。 */
    function npcBad(npcs) {
      if (!npcs) return false;
      for (var k in npcs) {
        if (k === '子女' || k === '孩子') {
          if (!V.hasLivingChild(g)) return true;
        } else if (k === '父亲' || k === '母亲') {
          if (!alive(g, k)) return true;
        } else if (k === '配偶' || k === '妻子' || k === '丈夫') {
          if (!V.spouseAlive(g)) return true;
        }
      }
      return false;
    }
    if (npcBad(opt.npc)) return false;
    if (opt.fx && npcBad(opt.fx.npc)) return false;
    var os = opt.outcomes || [], i;
    for (i = 0; i < os.length; i++) {
      if (os[i].fx && npcBad(os[i].fx.npc)) return false;
    }
    return true;
  };

  /* =========================================================
     4. 文本识别与自动挂守卫
     ========================================================= */
  function textOf(e) {
    var s = (e.title || '') + ' ' + (e.text || '');
    var os = e.opts || [], i;
    for (i = 0; i < os.length; i++) {
      s += ' ' + (os[i].label || '') + ' ' + (os[i].hint || '');
    }
    return s;
  }
  function titleOf(e) {
    var s = e.title || '';
    var os = e.opts || [], i;
    for (i = 0; i < os.length; i++) s += ' ' + (os[i].label || '');
    return s;
  }
  function stageNo(e) {
    return STAGE_IDX[e.stage] == null ? -1 : STAGE_IDX[e.stage];
  }

  var REFLECT = /上坟|扫墓|坟前|坟头|坟|遗物|遗照|相册|旧照片|老照片|照片里|梦里|梦见|忌日|去世|离世|过世|生前|回忆|百天|走的那年|走了以后|走了之后|已经不在了/;
  var PARENT = /父亲|母亲|爸爸|妈妈|爸妈|父母|老爸|老妈/;
  var CHILD = /子女|儿女|儿子|女儿|孙辈|孙子|孙女|带孩子|接孩子|给孩子|孩子|小孩/;
  var CHILD_STRONG = /子女|儿女|儿子|女儿|孙辈|孙子|孙女|带孩子|接孩子|给孩子/;
  var OTHER_KID = /(别人|邻居|对方|朋友|老友|同事|同学|他|她|街坊)家?的?孩子|放学的孩子|一群孩子|远处的孩子|小区的孩子|村口的孩子/;
  var SPOUSE = /老伴|配偶|妻子|丈夫|老婆|老公/;
  var SIBLING = /哥哥|弟弟|姐姐|妹妹/;
  var FRIEND = /发小|朋友|好友/;

  function addGuard(e, field, vals) {
    if (!e[field]) e[field] = [];
    for (var i = 0; i < vals.length; i++) {
      if (e[field].indexOf(vals[i]) < 0) e[field].push(vals[i]);
    }
  }

  function annotate(e) {
    if (!e || e._guardDone) return;
    e._guardDone = true;
    var s = textOf(e);
    var headline = titleOf(e);
    var st = stageNo(e);

    /* NPC 生成事件：直接绑定 npcRole */
    if (e.npcRole) {
      if (e.npcRole === '父亲' || e.npcRole === '母亲') addGuard(e, 'aliveGuard', [e.npcRole]);
      else if (e.npcRole === '子女') e.childAliveGuard = true;
      else if (e.npcRole === '配偶') e.spouseGuard = true;
      else addGuard(e, 'aliveGuard', [e.npcRole]);
    }

    /* 真正的日常兜底事件（type='daily'）永不设硬性守卫，保证随机池不空；
       注意：tier='daily' 只是分层标签，几乎所有随机事件都会被标成 daily，
       不能用它来豁免，否则守卫会整体失效。 */
    if (e.type === 'daily') {
      e._guardExempt = 'daily';
      e.familyExempt = e.familyExempt || 'daily';
      return;
    }

    /* 子女 / 孙辈：中年及以后出现即视为主角的孩子 */
    if (CHILD.test(s) && !OTHER_KID.test(s)) {
      if (st >= 4 || (st >= 3 && CHILD_STRONG.test(s))) {
        if (/孙辈|孙子|孙女|带孩子|接孩子|给孩子/.test(s)) e.childAliveGuard = true;
        else e.hasChildrenGuard = true;
      }
    }
    /* 明确“没有子女”的独居线，反过来守卫 */
    if (/没有子女|无儿无女|没有孩子|膝下无子/.test(s)) {
      e.childlessGuard = true;
      delete e.hasChildrenGuard;
    }

    /* 强制主线事件若只在正文顺带提到亲属（标题/选项不含），不做硬性拦截，
       避免把必经的人生节点错误过滤；记为 forced-incidental 供静态检查识别。 */
    var forcedIncidental = (e.type === 'forced') &&
      !PARENT.test(headline) && !SPOUSE.test(headline) &&
      !SIBLING.test(headline) && !FRIEND.test(headline);
    if (forcedIncidental) e.familyExempt = e.familyExempt || 'forced-incidental';

    /* 父母：共同生活类必须都活着；追忆类放行 */
    if (PARENT.test(s) && !REFLECT.test(s) && !forcedIncidental) {
      var roles = [];
      if (/父亲|爸爸|老爸|父母|爸妈/.test(s)) roles.push('父亲');
      if (/母亲|妈妈|老妈|父母|爸妈/.test(s)) roles.push('母亲');
      addGuard(e, 'aliveGuard', roles);
    } else if (PARENT.test(s) && REFLECT.test(s)) {
      e.familyExempt = e.familyExempt || 'reflection';
    }

    /* 配偶：未婚/丧偶/离异不出 */
    if (SPOUSE.test(s) && !REFLECT.test(s) && !forcedIncidental) {
      e.spouseGuard = true;
    }

    /* 兄弟姊妹：独生不出 */
    if (SIBLING.test(s) && !REFLECT.test(s) && !forcedIncidental) {
      e.siblingGuard = true;
    }

    /* 朋友：关系断裂或已故不出 */
    if (FRIEND.test(s) && !forcedIncidental) {
      e.friendGuard = true;
    }
  }

  V.apply = function () {
    var list = L.EVENTS || [];
    for (var i = 0; i < list.length; i++) annotate(list[i]);
    return list.length;
  };

  /* =========================================================
     5. 主题去重：同一局前 5 个事件不重复主题；开局不连出医疗
     ========================================================= */
  var THEME_RULES = [
    [/疫苗|接种|发烧|体温|医院|诊所|看病|复查|手术|吃药|吃药|体检|慢性|病|受伤|骨折/, '医疗'],
    [/幼儿园|入园|托班|学前|学前班/, '幼儿园'],
    [/玩具|积木|娃娃|皮球|小汽车|拨浪鼓/, '玩具'],
    [/走丢|走散|找不到|报警|迷路/, '走失'],
    [/生日|蛋糕|过年|春节|压岁钱|红包|庙会|庙|元宵|中秋|端午|春联|鞭炮/, '节庆'],
    [/猫|狗|宠物|小鸟|兔子/, '宠物'],
    [/搬家|新家|房子|屋子|搬家|租房/, '家'],
    [/邻居|隔壁|巷子|串门|敲门|街坊/, '邻里'],
    [/学步|走路|翻身|开口|叫|词|牙|长高|抓周|第一步/, '成长'],
    [/学校|老师|同学|高考|考试|升学|补课|课堂/, '学校'],
    [/工作|加班|公司|老板|升职|裁员|同事|创业|签|项目|客户/, '工作'],
    [/父亲|母亲|父母|爸爸|妈妈|奶奶|爷爷|外婆|外公|哥哥|姐姐|弟弟|妹妹/, '家庭']
  ];

  V.themeOf = function (e) {
    if (!e) return '';
    if (e.theme) return e.theme;
    var s = (e.title || '') + ' ' + (e.text || '').slice(0, 120);
    for (var i = 0; i < THEME_RULES.length; i++) {
      if (THEME_RULES[i][0].test(s)) return THEME_RULES[i][1];
    }
    return '日常';
  };

  V.markTheme = function (g, e) {
    if (!g || !e) return;
    var th = V.themeOf(e);
    if (!g.themeSeen) g.themeSeen = [];
    if (th && g.themeSeen.indexOf(th) < 0) g.themeSeen.push(th);
    g.lastTheme = th || g.lastTheme;
    if (!g.stats) g.stats = {};
    g.stats.eventsShown = (g.stats.eventsShown || 0) + 1;
  };

  /* 权重压制：开局前 5 个事件不重复主题；前 8 个事件不连出医疗 */
  V.weightFactor = function (g, e) {
    if (!g || !e) return 1;
    var shown = (g.stats && g.stats.eventsShown) || 0;
    var th = V.themeOf(e);
    if (shown < 5 && g.themeSeen && g.themeSeen.indexOf(th) >= 0) return 0.02;
    if (shown < 8 && g.lastTheme === '医疗' && th === '医疗') return 0.05;
    return 1;
  };

  /* =========================================================
     6. 开局金句（中外各半，带作者；同局不重复）
     ========================================================= */
  V.QUOTES = [
    ['人生天地之间，若白驹之过隙，忽然而已。', '庄子'],
    ['知其不可而为之。', '孔子'],
    ['路漫漫其修远兮，吾将上下而求索。', '屈原'],
    ['悲莫悲兮生别离，乐莫乐兮新相知。', '屈原'],
    ['悟已往之不谏，知来者之可追。', '陶渊明'],
    ['盛年不重来，一日难再晨。', '陶渊明'],
    ['人生如逆旅，我亦是行人。', '苏轼'],
    ['回首向来萧瑟处，归去，也无风雨也无晴。', '苏轼'],
    ['人生代代无穷已，江月年年望相似。', '张若虚'],
    ['弃我去者，昨日之日不可留。', '李白'],
    ['冠盖满京华，斯人独憔悴。', '杜甫'],
    ['此情可待成追忆，只是当时已惘然。', '李商隐'],
    ['夕阳无限好，只是近黄昏。', '李商隐'],
    ['人生若只如初见，何事秋风悲画扇。', '纳兰性德'],
    ['人生最苦痛的是梦醒了无路可走。', '鲁迅'],
    ['从来如此，便对么？', '鲁迅'],
    ['生命是一袭华美的袍，爬满了蚤子。', '张爱玲'],
    ['人的一切痛苦，本质上都是对自己无能的愤怒。', '王小波'],
    ['我活在世上，无非想要明白些道理，遇见些有趣的事。', '王小波'],
    ['命运不是运气，而是选择。', '佚名'],
    ['时间不会治愈一切，它只是把疼的地方磨成了茧。', '佚名'],
    ['所谓坚持，不过是无路可退时，又多走了一步。', '佚名'],
    ['我们都在阴沟里，但仍有人仰望星空。', '奥斯卡·王尔德'],
    ['生活中只有两种悲剧：一是得不到想要的，二是得到了。', '奥斯卡·王尔德'],
    ['一个人知道自己为什么而活，就可以忍受任何一种生活。', '尼采'],
    ['与恶龙缠斗过久，自身亦成为恶龙。', '尼采'],
    ['那些杀不死我的，使我更强大。', '尼采'],
    ['每一个不曾起舞的日子，都是对生命的辜负。', '尼采'],
    ['人是一根会思想的苇草。', '帕斯卡'],
    ['世界上只有两样东西能震撼心灵：头顶的星空和心中的道德律。', '康德'],
    ['人是生而自由的，却无往不在枷锁之中。', '卢梭'],
    ['未经省察的人生不值得过。', '苏格拉底'],
    ['人不能两次踏进同一条河流。', '赫拉克利特'],
    ['性格决定命运。', '赫拉克利特'],
    ['人类的全部智慧就包含在两个词里：等待和希望。', '大仲马'],
    ['幸福的家庭都是相似的，不幸的家庭各有各的不幸。', '托尔斯泰'],
    ['生活总是让我们遍体鳞伤，但到后来，那些受伤的地方会变成最强壮的地方。', '海明威'],
    ['一个人可以被毁灭，但不能被打败。', '海明威'],
    ['凡是过往，皆为序章。', '莎士比亚'],
    ['全世界是一个舞台，所有的男男女女不过是一些演员。', '莎士比亚'],
    ['时间会刺破青春的华美精致。', '莎士比亚'],
    ['世界以痛吻我，要我报之以歌。', '泰戈尔'],
    ['天空没有翅膀的痕迹，而我已飞过。', '泰戈尔'],
    ['生活在别处。', '兰波'],
    ['死亡不是生命的终点，遗忘才是。', '《寻梦环游记》'],
    ['人最宝贵的是生命，生命属于人只有一次。', '奥斯特洛夫斯基'],
    ['即使在最黑暗的夜里，也要记得给自己留一盏灯。', '佚名']
  ];

  V.quote = function (g) {
    var pool = V.QUOTES, used = (g && g._quoteSeen) || [], idx, tries = 0;
    do {
      idx = Math.floor(Math.random() * pool.length);
      tries++;
    } while (used.indexOf(idx) >= 0 && tries < 80);
    if (g) {
      if (!g._quoteSeen) g._quoteSeen = [];
      if (g._quoteSeen.indexOf(idx) < 0) g._quoteSeen.push(idx);
    }
    return { text: pool[idx][0], author: pool[idx][1], idx: idx };
  };
  V.quoteHtml = function (g) {
    var q = V.quote(g);
    return '<span class="lq-text">“' + q.text + '”</span><span class="lq-author">—— ' + q.author + '</span>';
  };

  /* =========================================================
     7. 无子女：主线旧年事件的替代文本与选项
     ========================================================= */
  V.textOf = function (g, e) {
    if (!e) return '';
    if (e.textAlt && !V.hasLivingChild(g) && !V.hasChildren(g)) return e.textAlt;
    return e.text;
  };

  var ALT_TEXT = {
    f_house70: '七十岁这年，你把房产证从抽屉最底下翻出来。纸边已经磨白，上面只有你自己的名字。楼下中介的广告换了三轮，你还没想好这套房子最后要交给谁。',
    f_elderly74: '七十四岁，你开始认真考虑最后住在哪里。家里的楼梯越来越陡，社区新开的照料中心离得不远。晚上你坐在床边数药盒，听见楼下有人推着轮椅回来。',
    f_alone76: '七十六岁，屋里只剩你一个人的脚步声。你把每天要做的事写在日历背面：买菜、吃药、给花浇水。傍晚楼道里有邻居经过，你听了听，又坐回去。',
    f_disable85: '八十五岁，你摔在浴室门口，躺了很久才够到电话。救护车来的时候，你看着天花板的灯，第一次意识到这间屋子太大。',
    f_will88: '八十八岁，你坐在桌前写遗嘱。写到“留给谁”那一栏停住，笔尖在纸上洇开一个小点。窗外的树影挪了半寸，你还没落笔。',
    f_birthday90: '九十岁生日这天，屋里没有蛋糕，也没有人唱生日歌。你自己下了一碗面，坐在窗边，把电视的声音调小了一点。'
  };

  V.applyAlt = function () {
    for (var id in ALT_TEXT) {
      var e = (L.EVENT_INDEX && L.EVENT_INDEX[id]) || null;
      if (e) {
        e.textAlt = ALT_TEXT[id];
        /* 这些事件本身写了独居版正文，不再按“有子女”整条过滤；
           涉及子女的选项由 optOk 单独隐藏。 */
        e.hasChildrenGuard = false;
        e.childAliveGuard = false;
      }
    }
    /* f_house70 在无子女时只剩“立遗嘱”一个选项，补一条独居选项 */
    var house = L.EVENT_INDEX && L.EVENT_INDEX.f_house70;
    if (house && house.opts && house.opts.length < 4) {
      house.opts.push({
        label: '房子先留着，自己住到不能住为止',
        hint: '不提前安排，也不麻烦任何人',
        tone: 'calm',
        onlyChildless: true,
        outcomes: [
          { w: 70, text: '你把房产证放回抽屉，心里反而踏实了些。' , fx: { at: { happiness: 1, stress: -1 } } },
          { w: 30, text: '夜里楼上漏水，你一个人爬上去敲了三次门。', fx: { at: { health: -1, stress: 1 } } }
        ]
      });
    }
  };

  /* =========================================================
     8. 0–6 岁补充事件（抓周/邻里/幼儿园/走失/节庆/宠物…）
     ========================================================= */
  function pushEvent(e) {
    if (L.EVENT_INDEX && L.EVENT_INDEX[e.id]) return;
    L.EVENTS.push(e);
    if (L.EVENT_INDEX) L.EVENT_INDEX[e.id] = e;
  }
  function O(label, hint, tone, outcomes) {
    return { label: label, hint: hint || '', tone: tone || '', outcomes: outcomes || [] };
  }
  function R(text, fx) { return { w: 100, text: text, fx: fx || {} }; }
  function W2(w, text, fx) { return { w: w, text: text, fx: fx || {} }; }

  function newEvents() {
    pushEvent({
      id: 'v35o_zhouzhua', type: 'random', stage: '婴幼儿', tier: 'daily', weight: 1.3,
      family: 'v35o_zhouzhua', theme: '成长', title: '抓周',
      text: '一周岁这天，桌上摆了算盘、书、印章和一只拨浪鼓。你爬过去，一屋子人都不出声，等着看你抓什么。',
      opts: [
        O('伸手抓那本书', '母亲轻轻“哎”了一声', 'calm', [
          W2(65, '你把书抱在怀里啃了一口，满屋子都笑了。母亲说，这孩子以后爱读书。', { at: { knowledge: 2, charm: 1 }, npc: { '母亲': { intimacy: 4 } } }),
          W2(35, '你抓了两下就丢开，转头去够桌上的糖。', { at: { happiness: 1 }, npc: { '父亲': { intimacy: 2 } } })
        ]),
        O('绕过所有东西，抓了拨浪鼓', '只有它一直在响', 'bold', [
          W2(70, '你把拨浪鼓摇得满屋都是声音，谁说话都听不清。父亲笑着说，是个热闹性子。', { at: { charm: 2, happiness: 1 }, npc: { '父亲': { intimacy: 3 } } }),
          W2(30, '鼓面被你拍裂了，你愣住，随即哭了起来。', { at: { happiness: -1 } })
        ])
      ]
    });
    pushEvent({
      id: 'v35o_neighbor_knock', type: 'random', stage: '婴幼儿', tier: 'daily', weight: 1.25,
      family: 'v35o_neighbor_knock', theme: '邻里', title: '邻居家小孩来敲门',
      text: '隔壁家的孩子趴在门口，手里攥着半块饼干，问你要不要一起去巷口看蚂蚁搬家。母亲在身后看着你，没有替你回答。',
      opts: [
        O('跟着跑出去', '饼干掰了一半给你', 'bold', [
          W2(70, '你们蹲在墙根看了一下午，回家时膝盖全是土。那半块饼干你一直记到很大。', { at: { happiness: 2, health: 1 }, npc: { '邻居家的孩子': { intimacy: 5 } } }),
          W2(30, '蚂蚁没看成，你被巷口的石子绊了一跤，哭着被抱回家。', { at: { health: -1, happiness: -1 } })
        ]),
        O('躲在母亲身后摇头', '你有点怕生', 'calm', [
          W2(75, '那孩子在门口站了一会儿，把饼干放在门槛上走了。你等门关上才去捡。', { at: { happiness: 1, charm: -1 }, npc: { '母亲': { intimacy: 2 } } }),
          W2(25, '母亲蹲下来问你怕什么，你答不上来。', { at: { stress: 1 } })
        ])
      ]
    });
    pushEvent({
      id: 'v35o_kg_first', type: 'random', stage: '婴幼儿', tier: 'daily', weight: 1.25,
      family: 'v35o_kg_first', theme: '幼儿园', title: '幼儿园第一天',
      text: '幼儿园的门口有一道铁栅栏。母亲把你交给老师，说下班就来接。你抓着她的衣角，看着她的鞋跟一步步退出门外。',
      opts: [
        O('松开手，跟老师进去', '你忍住了没哭', 'calm', [
          W2(70, '上午你一直坐在小椅子上不说话，午睡时却睡得很沉。放学时母亲真的在门口。', { at: { knowledge: 1, stress: 1 }, npc: { '母亲': { intimacy: 3 } } }),
          W2(30, '你憋到下午，终于因为一块橡皮哭了一场。', { at: { stress: 2, happiness: -1 } })
        ]),
        O('追出去抱住母亲的腿', '门已经关了', 'bold', [
          W2(60, '老师把你抱回去，你哭了很久。第二天你就不肯再去了。', { at: { happiness: -2, stress: 2 }, npc: { '母亲': { intimacy: 2 } } }),
          W2(40, '母亲请了半天假，在教室外的窗边站到中午。后来你慢慢习惯了。', { at: { happiness: 1 }, npc: { '母亲': { intimacy: 6 } } })
        ])
      ]
    });
    pushEvent({
      id: 'v35o_mall_lost', type: 'random', stage: '婴幼儿', tier: 'daily', weight: 1.2,
      family: 'v35o_mall_lost', theme: '走失', title: '商场里走丢',
      text: '人很多，你松开了母亲的手，去看电梯口那个转动的广告牌。等你回头，四周全是陌生人的裤腿。',
      opts: [
        O('站在原地大声喊', '眼泪先掉下来', 'bold', [
          W2(70, '一个售货员把你抱到服务台，广播响了三遍，母亲跑过来时头发都乱了。', { at: { stress: 2, happiness: 1 }, npc: { '母亲': { intimacy: 6 } } }),
          W2(30, '你喊到嗓子发哑，才被一个保洁阿姨发现。', { at: { health: -1, stress: 3 } })
        ]),
        O('自己沿着来时的路往回走', '你记住了那家卖糖的柜台', 'calm', [
          W2(55, '你居然真的走回了入口，母亲正在那里跟保安说话，转身看见你，蹲下来抱住你。', { at: { knowledge: 1, happiness: 2 }, npc: { '母亲': { intimacy: 5 } } }),
          W2(45, '你走错了楼层，越走越陌生，最后在楼梯口哭累了。', { at: { stress: 3, health: -1 } })
        ])
      ]
    });
    pushEvent({
      id: 'v35o_grandpa_tales', type: 'random', stage: '童年', tier: 'daily', weight: 1.2,
      family: 'v35o_grandpa_tales', theme: '家庭', title: '爷爷讲古',
      text: '夏天的傍晚，爷爷坐在竹椅上讲他年轻时的事。讲到最后，他总会停一下，像是想起另一个人。你问后来呢，他说，后来就散了。',
      opts: [
        O('追着问“散了是什么意思”', '你还没学会不问', 'bold', [
          W2(65, '爷爷看着院子里的灯，说人这一辈子，聚散都由不得自己。你听不太懂，但记住了他的表情。', { at: { knowledge: 2, happiness: 1 } }),
          W2(35, '他摆摆手说小孩子别问，起身去收衣服。', { at: { knowledge: 1 } })
        ]),
        O('安静听完，靠在他膝边睡着', '晚风里有蚊香味', 'calm', [
          W2(75, '醒来时你已经躺在屋里，身上盖着爷爷的外套。', { at: { happiness: 2, stress: -1 }, npc: { '爷爷': { intimacy: 4 } } }),
          W2(25, '你睡得不安稳，梦里全是打仗的声音。', { at: { stress: 1 } })
        ])
      ]
    });
    pushEvent({
      id: 'v35o_move_house', type: 'random', stage: '童年', tier: 'daily', weight: 1.2,
      family: 'v35o_move_house', theme: '家', title: '家里搬家',
      text: '家具都被搬空以后，屋里露出墙上贴画留下的浅色印子。你站在门口不肯进去，说那不是我们家了。',
      opts: [
        O('把旧门上的一颗钉子带走', '你偷偷揣进兜里', 'calm', [
          W2(70, '很多年后你还留着那颗钉子，放在装奖状的那个铁盒里。', { at: { happiness: 1 }, tag: '搬走时带走了一颗旧门钉' }),
          W2(30, '钉子在半路掉了，你找了很久也没找到。', { at: { happiness: -1 } })
        ]),
        O('在新家的阳台上重新种一盆花', '母亲说重新开始', 'bold', [
          W2(70, '花活了，你也慢慢把新家叫成了家。', { at: { happiness: 2, stress: -1 }, npc: { '母亲': { intimacy: 3 } } }),
          W2(30, '花没活过那个冬天，你把它埋进了楼下的土里。', { at: { happiness: -1 } })
        ])
      ]
    });
    pushEvent({
      id: 'v35o_parents_quarrel', type: 'random', stage: '童年', tier: 'daily', weight: 1.2,
      family: 'v35o_parents_quarrel', theme: '家庭', title: '父母吵架',
      text: '夜里你被客厅的声音吵醒。他们在争一件你听不太懂的事，声音压得很低，却一句比一句重。门缝里透出一条光。',
      opts: [
        O('推开门站在他们中间', '你光着脚', 'bold', [
          W2(60, '两个人同时住了口。母亲先过来把你抱回房间，说明天还要上学。', { at: { health: -1, stress: 1 }, npc: { '母亲': { intimacy: 4 }, '父亲': { intimacy: 1 } } }),
          W2(40, '父亲转身出了门，摔门的声响了你很多年。', { at: { happiness: -3, stress: 3 }, npc: { '父亲': { intimacy: -6 } } })
        ]),
        O('把被子蒙过头，装作没醒', '你听见了自己的心跳', 'calm', [
          W2(55, '第二天桌上还是照常摆着早饭，谁也没提昨晚。', { at: { stress: 2, happiness: -1 } }),
          W2(45, '你在被子里把他们的每一句话都记住了，很多年都没忘。', { at: { knowledge: 1, stress: 2 }, tag: '很小就学会了听门缝里的声音' })
        ])
      ]
    });
    pushEvent({
      id: 'v35o_newyear_money', type: 'random', stage: '童年', tier: 'daily', weight: 1.2,
      family: 'v35o_newyear_money', theme: '节庆', title: '压岁钱藏在哪里',
      text: '过年，父亲把一张崭新的票子塞进你枕头底下。你摸黑捏着它，想了半宿：是交给母亲，还是自己藏起来。',
      opts: [
        O('自己藏进铁盒里', '你谁也没告诉', 'bold', [
          W2(60, '那点钱你攒了两年，最后买了一辆二手小自行车。骑回家的路上风很大。', { at: { money: 30, happiness: 3 } }),
          W2(40, '母亲洗床单时翻出了铁盒，钱被收走，说替你存着。', { at: { money: 5, happiness: -2, stress: 1 }, npc: { '母亲': { intimacy: -2 } } })
        ]),
        O('第二天早上交给母亲', '她愣了一下才接过去', 'calm', [
          W2(70, '母亲摸了摸你的头，说这孩子懂事。后来你才知道那钱补了家里的电费。', { at: { happiness: -1, charm: 1 }, npc: { '母亲': { intimacy: 5 } } }),
          W2(30, '她收下后什么也没说，你反而有点失落。', { at: { happiness: -1 }, npc: { '母亲': { intimacy: 2 } } })
        ])
      ]
    });
    pushEvent({
      id: 'v35o_temple_fair', type: 'random', stage: '童年', tier: 'daily', weight: 1.2,
      family: 'v35o_temple_fair', theme: '节庆', title: '庙会看戏',
      text: '庙会的戏台搭在祠堂前，台下全是长凳。父亲把你架在肩上，锣鼓一响，你的耳朵嗡嗡的，眼前只有一片晃动的红。',
      opts: [
        O('看到散场才肯下来', '你的脖子都僵了', 'bold', [
          W2(70, '回家的路上你一直学戏里的腔调，父亲笑了一路。', { at: { happiness: 3, charm: 1 }, npc: { '父亲': { intimacy: 4 } } }),
          W2(30, '你在父亲肩上睡着了，散场时被抱回去，戏一句也没记住。', { at: { happiness: 1, health: 1 } })
        ]),
        O('看到一半就闹着要买糖人', '戏台上正唱到最要紧处', 'calm', [
          W2(65, '父亲叹了口气，还是挤出去给你买了。回来时戏已经散了。', { at: { money: -5, happiness: 2 }, npc: { '父亲': { intimacy: 2 } } }),
          W2(35, '他不肯，你哭到散场，最后什么也没买。', { at: { happiness: -2, stress: 1 }, npc: { '父亲': { intimacy: -2 } } })
        ])
      ]
    });
    pushEvent({
      id: 'v35o_open_air_cinema', type: 'random', stage: '童年', tier: 'daily', weight: 1.2,
      family: 'v35o_open_air_cinema', theme: '节庆', title: '露天电影',
      text: '打谷场上拉起了白布，放映机嗡嗡地转。你挤在最前面，幕布背面也坐满了人，风一吹，画面就跟着皱一下。',
      opts: [
        O('挤到幕布背面去看', '那边人也很多', 'bold', [
          W2(70, '你发现背面的人都是反的，笑得停不下来，电影演了什么倒忘了。', { at: { happiness: 2, charm: 1 } }),
          W2(30, '放映机突然卡住，全场起哄，你被挤得差点摔倒。', { at: { health: -1, stress: 1 } })
        ]),
        O('靠着母亲坐在长凳上', '她给你扇扇子', 'calm', [
          W2(75, '电影很长，你在她肩上睡了半场。醒来时星星已经出来了。', { at: { happiness: 3, stress: -1 }, npc: { '母亲': { intimacy: 4 } } }),
          W2(25, '蚊子太多，你被咬了一腿的包，回家一路挠。', { at: { health: -1 } })
        ])
      ]
    });
    pushEvent({
      id: 'v35o_found_cat', type: 'random', stage: '童年', tier: 'daily', weight: 1.2,
      family: 'v35o_found_cat', theme: '宠物', title: '捡到一只猫',
      text: '放学路上，你在垃圾桶后面听见一声很细的叫。是一只灰扑扑的小猫，瘦得能看见肋骨。它没有跑，只是抬头看你。',
      opts: [
        O('把它揣进书包带回家', '母亲一定会骂', 'bold', [
          W2(65, '母亲骂了两句，还是找了个纸箱。那只猫在你家住了十一年。', { at: { happiness: 3, money: -20 }, tag: '捡回家的那只猫陪了你十一年', npc: { '母亲': { intimacy: 3 } } }),
          W2(35, '母亲坚决不让进门。你把它养在楼道里，喂了半个多月，后来它不见了。', { at: { happiness: -2, stress: 1 } })
        ]),
        O('把书包里的饼干掰给它', '你没有带走它', 'calm', [
          W2(70, '第二天它还在原地。第三天不见了。你路过时总会多看一眼那个垃圾桶。', { at: { happiness: 1, charm: 1 } }),
          W2(30, '它跟着你走了半条街，最后在巷口停下，看着你拐弯。', { at: { happiness: -1 } })
        ])
      ]
    });
  }

  /* =========================================================
     9. 权重与收尾
     ========================================================= */
  function tuneWeights() {
    for (var i = 0; i < L.EVENTS.length; i++) {
      var e = L.EVENTS[i];
      if (/v33_inf_vaccine_/.test(e.id)) e.weight = 0.8;
      if (/v33_inf_fever_/.test(e.id)) e.weight = 0.9;
    }
  }

  /* 开局不再被“出生→疫苗”两连医疗锁死：疫苗从强制事件降为低权重随机，
     出生事件单列 theme='出生'，让前几个回合能轮到其他主题。 */
  function tuneOpening() {
    var idx = L.EVENT_INDEX || {};
    var vac = idx.f_vaccine;
    if (vac) {
      vac.type = 'random';
      vac.tier = 'daily';
      vac.age = undefined;
      vac.prio = 0;
      vac.weight = 1.1;
      vac.theme = '医疗';
      if (!vac.cond) {
        vac.cond = function (g) { return g.age >= 1 && g.age <= 6; };
      }
    }
    var birth = idx.v32_birth_middle;
    if (birth) birth.theme = '出生';
  }

  newEvents();
  tuneWeights();
  tuneOpening();
  V.apply();
  V.applyAlt();
  if (L.EVENT_INDEX) {
    for (var j = 0; j < L.EVENTS.length; j++) {
      if (!L.EVENT_INDEX[L.EVENTS[j].id]) L.EVENT_INDEX[L.EVENTS[j].id] = L.EVENTS[j];
    }
  }
  L.V35 = V;
})();
