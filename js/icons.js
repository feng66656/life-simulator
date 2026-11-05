/* v3.4 统一图标 / emoji 映射表（全项目唯一来源）
   约束：同一分组内不重复；所有 emoji 容器必须走系统 emoji 字体栈。 */
(function () {
  var L = window.LS = window.LS || {};

  L.ICON = {
    stage: {
      '婴幼儿': '🍼', '童年': '🎒', '少年': '📐', '青年': '🎓',
      '中年': '🏢', '中老年': '🍵', '晚年': '🕯️'
    },
    attr: {
      knowledge: '📘', health: '❤️', finance: '💰', charm: '✨',
      happiness: '☀️', reputation: '🏅', stress: '🌡️'
    },
    tier: { daily: '🍃', echo: '🧵', crossroad: '🧭', broadcast: '📣' },
    bc: { joy: '🎉', sorrow: '🕯️', neutral: '📜' },
    event: {
      study: '📘', health: '🩺', money: '💰', work: '💼', family: '🏠',
      love: '💗', art: '🎨', travel: '🚌', joy: '🎉', risk: '⚠️',
      gift: '🎁', sports: '🏃', grief: '🕯️', cross: '🧭'
    },
    rarity: { normal: '🟢', rare: '🔷', legend: '🟡' }
  };

  L.icon = function (group, key, fallback) {
    var m = L.ICON[group] || {};
    return m[key] || fallback || '';
  };

  /* 关键词分类：同一分类同时供卡片 emoji 与天赋事件权重使用 */
  var RULES = [
    ['grief', /去世|葬礼|丧|临终|离世|悼|遗像/],
    ['health', /病|医|体检|手术|住院|康复|药|诊室|疫苗|发烧|受伤/],
    ['study', /考|学|书|课|毕业|升学|自习|作业|考试|论文|录取/],
    ['sports', /运动|球|跑|健身|游泳|比赛|训练/],
    ['money', /钱|工资|存款|债|买房|房贷|投资|理财|彩票|中奖|涨薪/],
    ['work', /工作|入职|裁员|加班|同事|上司|老板|创业|跳槽|面试|项目|出差/],
    ['love', /恋|表白|相亲|约会|异地|分手|伴侣|暗恋|结婚|婚礼|情书/],
    ['family', /父母|父亲|母亲|爸|妈|家人|孩子|儿子|女儿|家庭|亲戚|兄弟|姐妹|接送/],
    ['art', /画|音乐|写作|诗|演出|艺术|唱歌|舞台|小说|摄影/],
    ['travel', /旅|搬|出行|回家|火车|车站|机场|远方|异乡|转学/],
    ['joy', /喜|中奖|升职|庆|聚会|团圆|诞生|出生|获奖/],
    ['risk', /风险|骗|事故|冲突|罚|危险|偷|赌|打架|诈骗|透支/],
    ['gift', /礼物|红包|馈赠|帮|借|送|请客|人情|捐助/],
    ['cross', /抉择|决定|选择|路口|分岔|前途/]
  ];

  L.iconCatOf = function (e) {
    if (!e) return 'cross';
    if (e.cat && L.ICON.event[e.cat]) return e.cat;
    var s = String((e.id || '') + ' ' + (e.title || '') + ' ' + (e.text || '') + ' ' + (e.tag || ''));
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i][1].test(s)) return RULES[i][0];
    }
    return 'cross';
  };

  L.iconRarity = function (r) { return (L.ICON.rarity && L.ICON.rarity[r]) || '🟢'; };
  L.emojiHtml = function (group, key, fallback) {
    var ch = L.icon(group, key, fallback);
    return ch ? '<i class="emoji" aria-hidden="true">' + ch + '</i>' : '';
  };
})();
