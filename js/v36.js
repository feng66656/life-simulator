/* v3.6.0 — 两难 / 结局信 / 承诺自动生成 / 老地方 / 时代锚点
   纯 ES5，无构建，挂载 window.LS.V36 */
(function () {
  'use strict';
  var L = window.LS = window.LS || {};
  var V = L.V36 = L.V36 || {};

  var START_YEAR = L.START_YEAR || 2005;
  V.START_YEAR = START_YEAR;

  function n(v, d) { var x = Number(v); return isFinite(x) ? x : (d || 0); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function npcOf(g, role) { return L.getNpc ? L.getNpc(g, role) : null; }

  V.hasChildren = function (g) {
    if (L.V35 && typeof L.V35.hasChildren === 'function') return L.V35.hasChildren(g);
    var ids = (g.family && g.family.childrenIds) || [];
    for (var i = 0; i < ids.length; i++) {
      var c = L.getNpc(g, ids[i]);
      if (c && c.alive) return true;
    }
    return false;
  };

  V.spouseAlive = function (g) {
    var f = g.family || {};
    var m = f.marriage || {};
    if (m.status !== '已婚' || !m.spouseId) return false;
    var s = L.getNpc(g, m.spouseId);
    return !!(s && s.alive);
  };

  V.roleAlive = function (g, role) {
    if (role === '子女') return V.hasChildren(g);
    if (role === '配偶') return V.spouseAlive(g);
    if (role === '父母') return V.roleAlive(g, '父亲') || V.roleAlive(g, '母亲');
    var x = npcOf(g, role);
    return !!(x && x.alive);
  };

  /* 角色可用：明确已故 → false；尚未入场 → true（事件负责让他出场） */
  V.open = function (g, roles) {
    roles = roles || [];
    for (var i = 0; i < roles.length; i++) {
      var r = roles[i];
      if (r === '子女') { if (V.hasChildren(g)) return true; continue; }
      if (r === '配偶') { if (V.spouseAlive(g)) return true; continue; }
      if (r === '父母') { if (V.roleAlive(g, '父母')) return true; continue; }
      var x = npcOf(g, r);
      if (x) { if (x.alive) return true; } else { return true; }
    }
    return false;
  };

  /* ---------------- 两难选项构造 ---------------- */
  function o(label, hint, role, tag, drop, cost, outText, fx, echoText, promiseText) {
    var negative = 0;
    if (cost) {
      for (var k in cost) if (n(cost[k]) < 0) negative += 1;
    }
    return {
      label: label, hint: hint, fuzzy: true,
      tone: negative >= 2 ? 'risk' : 'mid',
      dilemma: {
        abandon: { role: role, tag: tag, drop: drop },
        cost: cost || {},
        promise: { who: role, text: promiseText || label, dueYears: 2, consequence: tag },
        /* v3.8：回响正文只能由作者写（echoText）；没写就不回响，绝不套通用句 */
        echo: echoText ? { afterYears: 5 + (n(drop) % 4), text: echoText } : null
      },
      outcomes: [{ w: 1, label: '', text: outText, fx: fx || {} }]
    };
  }

  function D(id, title, text, stages, need, a, b, extra) {
    extra = extra || {};
    var ev = {
      id: id, type: 'dilemma', stage: stages, tier: 'crossroad', theme: '两难',
      weight: n(extra.weight, 8), family: id, title: title, text: text,
      cond: function (g) {
        if (!V.open(g, need)) return false;
        if (extra.minAge && g.age < extra.minAge) return false;
        if (extra.cond && !extra.cond(g)) return false;
        return true;
      },
      opts: [a, b]
    };
    /* 两难事件的年龄下限要显式落在事件对象上，选择器与审计都读它 */
    if (extra.minAge) ev.ageMin = extra.minAge;
    return ev;
  }

  var YOUTH = ['青年', '中年'];
  var MID = ['中年'];

  /* =========================================================
     一、32 条两难（8 类 × 4）
     ========================================================= */
  V.DILEMMAS = [
    /* 1. 好友出事 vs 事业扩张 */
    D('dil_friend_car', '电话在路演前响', '路演还有四十分钟，PPT 在投影上滚。手机震了三次，是发小的号码。接起来，那边是护士：他骑电动车被撞了，人在急诊，家属签字栏空着。你握着手机，听见会议室里有人在等你进去。', YOUTH, ['发小'],
      o('先去医院', '听说情况不太好', '发小', '缺席', 16, { relation: 0, career: -9, money: -800, health: -2 },
        '你冲到医院，签了字，陪到凌晨。路演黄了，合伙人只发来一句“知道了”。', { at: { stress: 8, happiness: -2 }, money: { cash: -800 } },
        '他出院后请你吃了顿饭，说“那天只有你来了”。你想起会议室那扇门，还是有点疼。'),
      o('把会开完', '应该没事吧', '发小', '失望', 15, { relation: -15, career: 6, money: 3000, health: 0 },
        '你讲完了那一页，掌声很响。散会后你赶到医院，他已经被推进了手术室，走廊上只有他女朋友。', { at: { stress: 6, happiness: -4 }, money: { cash: 3000 } },
        '后来他不再给你打电话。你偶尔刷到他发的内容，才知道他恢复得不错。')),

    D('dil_friend_layoff', '内推名额只有一个', '发小被裁员，第四个月了。他坐在你家沙发上，手指抠着易拉罐的拉环，说“你那边不是缺人吗”。你公司确实缺人，但那个岗位你答应过给领导的侄子。', YOUTH, ['发小'],
      o('把名额给他', '那人看着挺靠谱', '发小', '失望', 10, { relation: 0, career: -8, money: -2000, fame: -2 },
        '你替他争取，领导在会上看了你一眼。名额给了发小，你的年终评语里多了一句“顾私人关系”。', { at: { stress: 6, happiness: 2 } },
        '他干得不错。只是领导再没把重要项目交给你。'),
      o('按原计划给关系户', '听说那边已经定人', '发小', '记恨', 18, { relation: -18, career: 4, money: 0, health: 0 },
        '你请发小吃了顿贵的饭，说“这次真没办法”。他点点头，把没喝完的酒推给你，起身走了。', { at: { stress: 4, happiness: -3 }, money: { cash: -600 } },
        '半年后他去了外地。你们的朋友圈互相点赞，却再没说过话。')),

    D('dil_friend_father', '同一天的两场告别', '发小父亲走的那天，你在另一个城市签年度大单。机票改签要损失一笔，签约方只等你到下午三点。发小发来一条语音，背景是哀乐，他没说话，只叹了口气。', YOUTH, ['发小'],
      o('改签回去', '应该来得及', '发小', '缺席', 12, { relation: 0, career: -7, money: -3500, health: -1 },
        '你赶到时灵堂还没撤。发小看见你，眼圈红了，什么也没说，只往旁边挪了挪，给你让了个位置。', { money: { cash: -3500 }, at: { stress: 5, happiness: 1 } },
        '多年后他父亲忌日，他还会给你发一条“今年我自己去”。'),
      o('留下来签约', '那边催得很紧', '发小', '记恨', 17, { relation: -17, career: 7, money: 5000, fame: 1 },
        '合同签了，庆功宴上的酒很烈。你给发小转了两千块钱，备注“路上用”。他没收。', { money: { cash: 5000 }, at: { stress: 6, happiness: -5 } },
        '他后来逢人就说“他忙，能理解”，语气平得让你难受。')),

    D('dil_friend_venture', '融资前夜的老账', '发小被合伙人架空，想让你出面作证。你正在谈一轮融资，投资人最忌讳创始人跟人打官司。发小说“就一句话的事”，可你知道那句话会把你的名字写进庭审记录。', YOUTH, ['发小'],
      o('出面作证', '那人看着挺靠谱', '发小', '缺席', 10, { relation: 0, career: -10, money: -5000, fame: -3 },
        '你去了。融资拖了半年，投资人换了口径。发小赢了官司，抱着你哭，说欠你一条命。', { at: { stress: 9, happiness: 2 }, money: { cash: -5000 } },
        '你的名字留在了那份判决书里。多年后有人搜到你，先看到的是那场官司。'),
      o('说公司不方便', '听说案子挺复杂', '发小', '失望', 14, { relation: -14, career: 6, money: 2000, fame: 2 },
        '你说“我不能掺和”。他沉默了几秒，说“懂了”，然后挂了。融资顺利到账，你却在庆功宴上喝不下去。', { money: { cash: 2000 }, at: { stress: 4, happiness: -3 } },
        '他后来赢了，也没再提这事。只是你们的聊天停在“懂了”那两个字。')),

    /* 2. 母亲住院 vs 出差签约 */
    D('dil_mom_hospital', '病房里的监护仪', '母亲住院的第三天，你接到通知：明天上午的签约必须本人到场，对方是跟了两年的大客户。夜里病房的监护仪一直响，母亲睡得不安稳，手背上的留置针青了一片。', YOUTH, ['母亲'],
      o('留在医院', '听说指标不太好', '母亲', '缺席', 14, { relation: 0, career: -8, money: -3000, health: -3 },
        '你守到天亮，母亲醒来第一句是“你怎么还在”。签约改期，客户转给了竞争对手。', { at: { stress: 8, happiness: 0, health: -3 }, money: { cash: -3000 } },
        '母亲出院后逢人说你孝顺。你却在算那笔丢掉的提成。'),
      o('去签约', '应该没事的', '母亲', '失望', 16, { relation: -16, career: 8, money: 6000, health: -1 },
        '你签完字就往医院赶，母亲已经做完检查，正一个人坐在走廊的塑料椅上等电梯。', { at: { stress: 7, happiness: -4 }, money: { cash: 6000 } },
        '她说“你忙你的”，语气客气得像邻居。')),

    D('dil_mom_surgery', '手术同意书', '母亲的手术排在周四，医生说要家属签字。同一天，你在外地参加招标答辩，这个项目决定你今年能不能升。周四早上，医院打来电话，说“家属还没到”。', MID, ['母亲'],
      o('回去签字', '听说风险不大', '母亲', '缺席', 13, { relation: 0, career: -11, money: -4000, health: -4 },
        '你赶到时手术刚开始。你在门外坐了四个小时，手机里全是未接来电。标没了，职位也悬了。', { at: { stress: 12, health: -4 }, money: { cash: -4000 } },
        '母亲醒来第一句是“谁签的字”，你说“我”。她点点头，没再问。'),
      o('让舅舅代签', '应该没事的', '母亲', '失望', 15, { relation: -15, career: 7, money: 5000, health: 0 },
        '答辩很顺。你下台时看到舅舅的消息：“手术做完了，你妈问你在哪。”你在洗手间站了很久。', { at: { stress: 7, happiness: -3 }, money: { cash: 5000 } },
        '母亲后来没提这事，但每次你说“忙”，她都会停一下。')),

    D('dil_mom_fall', '楼梯上的那一声', '母亲在楼梯上摔了一跤，髋骨裂了。你刚接到外派通知，下个月去外地两年，待遇翻倍。医生说康复至少要半年，护工可以请，但夜里她只认家里人的声音。', MID, ['母亲'],
      o('放弃外派', '听说恢复得很慢', '母亲', '缺席', 12, { relation: 0, career: -14, money: -9000, health: -3 },
        '你回了外派的邮件，说家里走不开。母亲康复得不错，你却在同事的升职名单里看见了自己的空缺。', { at: { stress: 10, happiness: 2, health: -3 }, money: { cash: -9000 } },
        '多年后母亲还能自己走路。你说不清这算值得还是不算。'),
      o('请护工后外派', '应该能照顾好', '母亲', '失望', 17, { relation: -17, career: 10, money: 15000, health: 0 },
        '护工很 professional，母亲也很配合。视频里她总说“挺好”，镜头却总对着天花板。', { at: { stress: 6, happiness: -4 }, money: { cash: 15000 } },
        '你回来时她已经不太认得你的脚步声了。')),

    D('dil_mom_chemo', '第六次化疗', '母亲第六次化疗，反应比前几次都重。同一天下午是你的晋升答辩，准备了三个月。病房里她吐完靠在枕头上，说“你去吧，我没事”，手却一直抓着你的袖口。', MID, ['母亲'],
      o('陪她做完这一轮', '听说这次最难受', '母亲', '缺席', 15, { relation: 0, career: -12, money: -6000, health: -5 },
        '你留下来，给她擦脸、换衣服、叫护士。答辩改成了书面材料，评审说“下次吧”。', { at: { stress: 11, health: -5, happiness: 1 }, money: { cash: -6000 } },
        '母亲挺过来了。她说“你那天没走，我记着”。'),
      o('去答辩', '那边应该能理解', '母亲', '失望', 18, { relation: -18, career: 12, money: 8000, health: -2 },
        '你答得很漂亮，评审全票通过。回到病房时，母亲已经睡了，床头柜上是没动过的粥。', { at: { stress: 9, happiness: -5 }, money: { cash: 8000 } },
        '她后来跟病友说“我儿子有出息”。你听见了，没敢进去。')),

    /* 3. 伴侣需要你 vs 老板加班 */
    D('dil_partner_fever', '凌晨两点的体温计', '伴侣发烧到三十九度，蜷在被子里发抖。你手机上是老板的语音：明早八点提案，今晚必须改完。窗外在下雨，家里没有退烧药。', ['青年', '中年'], ['配偶'],
      o('留下来照顾', '应该只是感冒', '配偶', '缺席', 12, { relation: 0, career: -7, money: -1200, health: -2 },
        '你跑了三条街买药，回来时伴侣已经烧得说胡话。提案你熬到四点才发过去，老板只回了“收到”。', { at: { stress: 9, health: -2 }, money: { cash: -1200 } },
        '伴侣退烧后给你煮了面。老板在年终会上说“有些人不够拼”。'),
      o('回公司改稿', '听说甲方很难缠', '配偶', '失望', 16, { relation: -16, career: 6, money: 3000, health: -2 },
        '你走的时候伴侣背对着你，没说话。提案过了，老板拍了拍你的肩。凌晨回家，桌上只有一只空杯子。', { at: { stress: 7, health: -2 }, money: { cash: 3000 } },
        '伴侣后来病好了，只是再发烧时，不再给你打电话。'), { minAge: 20 }),

    D('dil_partner_surgery', '候诊区的两把椅子', '伴侣做一个小手术，医生说“很快，半小时”。同一时间，老板在群里点名要你参加客户饭局。伴侣说“你去吧，我能行”，可护士叫号时，候诊区只有两把椅子。', MID, ['配偶'],
      o('陪她/他做完', '听说只是小手术', '配偶', '缺席', 11, { relation: 0, career: -6, money: -900, health: -1 },
        '你在候诊区坐了两个小时。饭局上老板发了张合影，没你的位置。伴侣醒来第一眼看见你，笑了。', { at: { stress: 5, happiness: 3 }, money: { cash: -900 } },
        '那年年底你少了一个项目。伴侣却记住了候诊区那两把椅子。'),
      o('去饭局', '应该很快就结束', '配偶', '失望', 17, { relation: -17, career: 7, money: 4000, health: -1 },
        '你敬了一圈酒，回来时伴侣已经自己打车到家。她/他说“没事，小手术”，把药放在桌上，没看你。', { at: { stress: 6, happiness: -4 }, money: { cash: 4000 } },
        '后来每次她/他一个人去医院，你都想问，又没问。')),

    D('dil_partner_postpartum', '半夜的哭声', '孩子出生第三个月，伴侣整夜整夜睡不着，抱着孩子在客厅走来走去。你第二天要上线一个大版本。凌晨三点，她/他轻声说“你能不能抱一会儿”，声音像在求人。', MID, ['配偶', '子女'],
      o('接过孩子', '听说产后都这样', '配偶', '缺席', 13, { relation: 0, career: -8, money: -2000, health: -4 },
        '你抱着孩子在阳台上走到天亮。版本上线推迟了一天，领导在群里问“怎么回事”。', { at: { stress: 10, health: -4, happiness: 1 }, money: { cash: -2000 } },
        '伴侣后来好了。她/他说那几个月只记得你怀里很暖。'),
      o('去准备上线', '应该能撑过去', '配偶', '记恨', 19, { relation: -19, career: 9, money: 5000, health: -2 },
        '版本顺利上线，你升了一级。回家时伴侣坐在没开灯的客厅里，孩子在哭，她/他没有动。', { at: { stress: 8, happiness: -6 }, money: { cash: 5000 } },
        '这件事她/他后来提了很多次，每次都在吵架的时候。')),

    D('dil_partner_parents', '两家人一张桌子', '伴侣的父母第一次上门，定在周六中午。老板临时通知周六陪重要客户打高尔夫，说“这个关系你必须去”。你在两种饭桌之间，谁都在等你。', MID, ['配偶'],
      o('留下招待', '听说老人家很在意', '配偶', '缺席', 10, { relation: 0, career: -7, money: -1500, health: -1 },
        '你做了六个菜，陪老人聊了一下午。客户那边换了你同事去，单子成了别人的。', { money: { cash: -1500 }, at: { stress: 4, happiness: 3 } },
        '伴侣父母回去后说“这孩子实在”。老板后来提了一句“关键时候不在”。'),
      o('去打高尔夫', '听说那客户很关键', '配偶', '失望', 15, { relation: -15, career: 8, money: 6000, health: -1 },
        '你赢了球，也赢了合同。伴侣一个人招待父母，饭后她/他妈妈问“他是不是不太喜欢我们家”。', { money: { cash: 6000 }, at: { stress: 5, happiness: -4 } },
        '伴侣没跟你吵，只是后来再没提过让父母来。')),

    /* 4. 发小借钱 vs 家里买房 */
    D('dil_loan_house', '首付与借条', '发小开口借八万，说母亲要做心脏支架。同一个月，你和伴侣看中了那套小两居，首付差八万。中介催着交定金，发小的电话在同一个下午打进来。', YOUTH, ['发小'],
      o('先借给发小', '他说救命用', '发小', '缺席', 12, { relation: 0, money: -80000, career: 0, health: -2 },
        '你转了钱。房子被别人定了，伴侣三天没跟你说话。发小母亲的支架做成了。', { money: { cash: -80000 }, at: { stress: 8, happiness: -2 } },
        '两年后发小还了钱，房价已经涨了一大截。你没怪他，只是偶尔算那笔账。'),
      o('先交首付', '听说病没那么急', '发小', '记恨', 18, { relation: -18, money: 0, career: 0, health: 0 },
        '你交了定金，给发小转了两千，说“先应急”。他回了句“不用了”，把你删了。', { at: { stress: 6, happiness: -4 }, money: { cash: -2000 } },
        '你搬进新房那天，听说他母亲的手术拖了两个月。'), { minAge: 20 }),

    D('dil_loan_business', '他要开第二家店', '发小想盘下隔壁店面，差十二万，说“这次肯定成”。你手里刚好有十二万，是准备给孩子换学区房的首付。他坐在你店里，眼睛发亮，像二十年前说要一起去远方。', MID, ['发小'],
      o('借给他', '那人看着挺靠谱', '发小', '缺席', 13, { relation: 0, money: -120000, career: -2, health: -2 },
        '他开了第二家店，前半年亏，后半年慢慢起色。你的学区房拖了三年。', { money: { cash: -120000 }, at: { stress: 6, happiness: 1 } },
        '他后来把钱还了，还多给了一万。你收下时，心里像欠了什么。'),
      o('留着换学区房', '听说那行不好做', '发小', '失望', 16, { relation: -16, money: 0, career: 2, health: 0 },
        '你说“这钱动不了”。他笑了一下，说“理解”，后来再没提开店的事。', { at: { stress: 4, happiness: -3 } },
        '孩子进了好学校。你偶尔路过那条街，那家店面一直空着。')),

    D('dil_loan_gambling', '他欠了不该欠的钱', '发小欠了赌债，追债的人堵在他家门口。他跪在你面前，说“最后一次”。你知道这次借出去，大概率回不来；不借，他可能真的走投无路。', MID, ['发小'],
      o('替他还一部分', '听说不给会出事', '发小', '缺席', 14, { relation: 0, money: -60000, career: 0, health: -4 },
        '你替他还了六万，剩下的让他自己谈。他戒了半年，又复赌。你不再接他电话。', { money: { cash: -60000 }, at: { stress: 10, health: -4 } },
        '他后来去外地打工了。你们的关系停在那六万块上。'),
      o('一分不借', '听说他欠得不少', '发小', '记恨', 20, { relation: -20, money: 0, career: 0, health: 0 },
        '你说了狠话，让他自己去承担。他红着眼走了，门摔得很响。', { at: { stress: 7, happiness: -5 } },
        '三年后他戒了赌，结了婚。请客那天，唯独没请你。')),

    D('dil_loan_wedding', '彩礼与首付', '发小要结婚，女方家要彩礼，他差五万。你和伴侣刚凑够首付，差一点就能签字。发小在电话里说“就这一次，婚后我慢慢还”。', YOUTH, ['发小'],
      o('借五万', '听说女方催得紧', '发小', '缺席', 11, { relation: 0, money: -50000, career: 0, health: -1 },
        '他结了婚，婚礼上给你留了主桌。你的首付又拖了一年，伴侣嘴上没说，看房时却总走快几步。', { money: { cash: -50000 }, at: { stress: 5, happiness: 2 } },
        '他婚后第二年才还清。你收钱那天，他已经有了孩子。'),
      o('留着首付', '听说婚礼可以简办', '发小', '失望', 15, { relation: -15, money: 0, career: 0, health: 0 },
        '你说“真挪不开”。他婚礼还是办了，只是酒席少了几桌。你随了份子，坐在角落里。', { at: { stress: 3, happiness: -2 }, money: { cash: -1000 } },
        '他敬酒时绕过了你那一桌。你当成没看见。'), { minAge: 20 }),

    /* 5. 孩子升学 vs 晋升外派 */
    D('dil_kid_school', '升学宴与调令', '孩子中考出分，刚好够上重点线，要交一笔择校费。同一天，公司发文：晋升名单有你，但要去外地驻场两年。孩子妈妈说“你去吧，家里我来”，孩子却在你书房门口站了很久。', MID, ['子女'],
      o('放弃外派陪读', '听说重点班很关键', '子女', '缺席', 12, { relation: 0, career: -15, money: -20000, health: -2 },
        '你留下来，交了择校费，每天接送。孩子成绩稳住了，你的名字从晋升名单里消失。', { money: { cash: -20000 }, at: { stress: 7, happiness: 3 } },
        '孩子高考完那天说“爸/妈，谢谢你没走”。你笑了笑，没说话。'),
      o('接受外派', '听说那边机会难得', '子女', '失望', 17, { relation: -17, career: 14, money: 20000, health: -1 },
        '你去了外地。孩子进了普通班，成绩起起伏伏。视频里他/她总说“挺好的”，镜头对着墙。', { money: { cash: 20000 }, at: { stress: 6, happiness: -5 } },
        '孩子后来考得一般。填志愿那天，他/她没问你。')),

    D('dil_kid_exam', '高考前的一通电话', '孩子高考前一周，你接到外派通知，去总部做一年项目，回来就是部门负责人。孩子妈妈/爸爸说“这时候你别走”，孩子却说“你走吧，我能行”。', MID, ['子女'],
      o('留下陪考', '听说孩子压力很大', '子女', '缺席', 10, { relation: 0, career: -13, money: -6000, health: -2 },
        '你请了假，每天做饭、接送、陪他/她散步。项目给了别人，回来时岗位已经变了。', { at: { stress: 8, happiness: 2 }, money: { cash: -6000 } },
        '孩子考得不错。查分那晚，他/她第一个抱住的是你。'),
      o('去总部', '听说孩子很独立', '子女', '失望', 16, { relation: -16, career: 12, money: 15000, health: 0 },
        '你在总部开会时，孩子正在考场。成绩出来那天，你只收到一条短信：“还行。”', { money: { cash: 15000 }, at: { stress: 5, happiness: -4 } },
        '孩子上大学那年说“我高考那年你不在”，语气很轻。'), { minAge: 37 }),

    D('dil_kid_transfer', '转学与升职', '孩子被重点学校录取，但要搬到城另一头陪读。你刚拿到升职机会，新岗位需要你常驻公司。搬家那天，孩子在旧书桌上刻了一行小字。', MID, ['子女'],
      o('搬家陪读', '听说那学校很好', '子女', '缺席', 11, { relation: 0, career: -12, money: -30000, health: -3 },
        '你们搬了。每天通勤两个小时，你瘦了一圈。孩子成绩上去了，你的升职没了。', { money: { cash: -30000 }, at: { stress: 9, health: -3, happiness: 2 } },
        '孩子毕业那天，把那行小字指给你看：“谢谢你来。”'),
      o('留在原校', '听说孩子能适应', '子女', '失望', 15, { relation: -15, career: 11, money: 8000, health: 0 },
        '你升了职，孩子留在原校。他/她成绩没掉，只是放学后总一个人坐在操场边。', { money: { cash: 8000 }, at: { stress: 5, happiness: -3 } },
        '后来孩子说“其实我那时候挺想去的”。你没法回答。')),

    D('dil_kid_sick', '发烧与出差', '孩子半夜发烧到四十度，伴侣出差在外。你明早的航班去谈一个拖了半年的单子。退烧药吃了两次没退，孩子缩在你怀里说“别走”。', MID, ['子女'],
      o('退票守夜', '听说烧得厉害', '子女', '缺席', 12, { relation: 0, career: -9, money: -4000, health: -3 },
        '你退了票，抱着孩子坐到天亮。单子丢了，客户跟别人签了。孩子退烧后，睡得很沉。', { money: { cash: -4000 }, at: { stress: 8, health: -3, happiness: 2 } },
        '伴侣回来后说“幸好你在”。你想起那张机票，心里空了一下。'),
      o('赶早班机', '听说孩子退了烧', '子女', '失望', 16, { relation: -16, career: 9, money: 6000, health: 0 },
        '你把孩子托给邻居，赶上了飞机。单子谈成了，回家时孩子已经活蹦乱跳，只是不太理你。', { money: { cash: 6000 }, at: { stress: 6, happiness: -4 } },
        '孩子后来生病，第一句总是“别告诉爸/妈”。')),

    /* 6. 朋友求伪证 vs 前途 */
    D('dil_witness', '一份签了字的证明', '老同学出了事故，对方要赔一大笔。他求你写一份“当时不在场”的证明。你刚考上编制，政审还没结束。他在电话里说“就一张纸”，声音发抖。', YOUTH, ['同学'],
      o('帮他写', '听说事情不大', '同学', '缺席', 13, { relation: 0, career: -12, money: -3000, fame: -6 },
        '你写了。事故私了了，你的政审却被举报，拖了半年。他后来请你吃饭，你没什么胃口。', { at: { stress: 10, happiness: -3 }, money: { cash: -3000 } },
        '那张纸后来被翻出来，你解释了三年。'),
      o('拒绝', '听说这事很严重', '同学', '记恨', 17, { relation: -17, career: 8, fame: 2, money: 0 },
        '你说“我不能”。他沉默了很久，说“行，我记住了”。你顺利入职，他赔了钱，搬走了。', { at: { stress: 5, happiness: -4 } },
        '多年后同学聚会，他来了，没跟你碰杯。')),

    D('dil_cover', '顶包的那一晚', '同事酒驾撞了护栏，求你来现场顶一下，说“你还没结婚，我还有孩子”。你刚被提名优秀员工，这件事一旦沾上，前途就悬了。', YOUTH, ['同事'],
      o('替他顶', '听说没撞到人', '同事', '缺席', 14, { relation: 0, career: -15, money: -5000, fame: -8 },
        '你顶了，扣分罚款，单位通报。他保住了工作，见你时总低着头。', { money: { cash: -5000 }, at: { stress: 11, happiness: -4 } },
        '你后来再没被提名过。他升了，偶尔请你喝酒。'),
      o('劝他自首', '听说交警查得严', '同事', '记恨', 18, { relation: -18, career: 6, fame: 3, money: 0 },
        '你陪他去自首，他丢了工作，老婆跟他离了。他走前说“你满意了”。', { at: { stress: 8, happiness: -5 } },
        '几年后他重新站起来，唯独不接你的电话。')),

    D('dil_sign', '验收单上的空格', '你负责的项目验收，数据差一点。老同学是甲方代表，私下说“签了吧，补个报告就行”。签了，你能拿到尾款；不签，项目重做，团队半年白干。', MID, ['同学'],
      o('签字放行', '听说数据差一点', '同学', '失望', 12, { relation: 0, career: 6, money: 8000, fame: -6 },
        '你签了。尾款到账，团队发了奖金。三个月后出了小事故，调查报告里有你的名字。', { money: { cash: 8000 }, at: { stress: 9, happiness: -3 } },
        '老同学替你压下了大部分责任。你欠他一次，一直没还。'),
      o('打回重做', '听说那边催得紧', '同学', '记恨', 16, { relation: -16, career: -8, money: -6000, fame: 4 },
        '你打回了。团队骂了你半个月，甲方扣了款。老同学在会上没帮你说话。', { money: { cash: -6000 }, at: { stress: 10, happiness: -2 } },
        '项目后来得了奖，老同学却再没跟你吃过饭。')),

    D('dil_report', '举报信写不写', '你发现朋友的公司用过期原料。他刚给你介绍了一个大客户，还说“年底分红有你一份”。举报，他的厂子可能关门；不举报，那些货已经发出去了。', MID, ['朋友'],
      o('匿名举报', '听说那批货有问题', '朋友', '记恨', 19, { relation: -19, career: 3, fame: 5, money: -10000 },
        '你写了举报信。厂子被查，他被罚得倾家荡产。客户那边也知道了，合作黄了。', { money: { cash: -10000 }, at: { stress: 10, happiness: -2 } },
        '他后来查到了是你。你们在街上遇见，他看了你一眼，走了。'),
      o('装作不知道', '听说吃不死人', '朋友', '失望', 13, { relation: 0, career: 5, money: 12000, fame: -5 },
        '货发出去了，没出事。分红到账，你请全家吃了顿好的。夜里却总睡不踏实。', { money: { cash: 12000 }, at: { stress: 7, happiness: -4 } },
        '后来那家厂子越做越大。你每次路过，都绕开走。')),

    /* 7. 合伙人分家 vs 员工生计 */
    D('dil_partner_split', '分家那天的账本', '合伙人要撤资，带走一半客户。账上只够发三个月工资。你可以跟他打官司拖住客户，也可以放他走、裁掉一半人保住公司。会议室里，员工在等结果。', MID, ['合伙人'],
      o('打官司留住客户', '听说官司能赢', '合伙人', '记恨', 18, { relation: -18, career: -9, money: -30000, fame: 3 },
        '你起诉了。客户观望，订单停了一半，员工还是走了一批。官司赢了，公司也只剩半条命。', { money: { cash: -30000 }, at: { stress: 12, happiness: -5 } },
        '合伙人后来去了对手公司，逢人就说你狠。'),
      o('放他走、裁人保公司', '听说账上撑不住', '合伙人', '失望', 12, { relation: -12, career: 6, money: 10000, fame: -4 },
        '你放他走了，裁掉一半人，公司活了下来。被裁的员工里，有人跟了你五年。', { money: { cash: 10000 }, at: { stress: 10, happiness: -4 } },
        '公司后来做大了。你偶尔还会想起那些离开的人。')),

    D('dil_partner_debt', '他挪了公司的钱', '合伙人挪了公司一笔钱去填自己的窟窿，被你发现。报警，他坐牢，公司也会被查；私了，他补钱，但员工都知道账上少了钱。', MID, ['合伙人'],
      o('报警', '听说数额不小', '合伙人', '记恨', 20, { relation: -20, career: -6, money: -20000, fame: 2 },
        '你报了警。他被带走那天，公司账户被冻结，员工工资拖了两个月。', { money: { cash: -20000 }, at: { stress: 12, happiness: -4 } },
        '他家里人再没跟你来往。你赢了理，输了很多人。'),
      o('私了让他补钱', '听说他能凑上', '合伙人', '失望', 14, { relation: -14, career: 5, money: 15000, fame: -3 },
        '他补了钱，继续留在公司。员工嘴上不说，眼神却变了。你开始一个人管所有账。', { money: { cash: 15000 }, at: { stress: 9, happiness: -3 } },
        '两年后他又挪了一次，这次你没再犹豫。')),

    D('dil_partner_poach', '他带走了整个团队', '合伙人私下接触你的核心团队，承诺双倍工资。你手里有一个大项目正在收尾，走一半人就交不了货。他给你发消息：“要么分家，要么散伙。”', MID, ['合伙人'],
      o('分家让项目停摆', '听说他早有准备', '合伙人', '失望', 13, { relation: -13, career: -10, money: -25000, fame: -2 },
        '你分了家，项目延期，赔了违约金。团队留下的人拿着半薪撑了半年。', { money: { cash: -25000 }, at: { stress: 11, happiness: -3 } },
        '他带走的团队后来也没做成。你们谁都没赢。'),
      o('加钱留人', '听说他们摇摆不定', '合伙人', '记恨', 15, { relation: -15, career: 6, money: -40000, fame: 2 },
        '你咬牙加了薪，项目交付了。合伙人走了，带走两个没留住的人。', { money: { cash: -40000 }, at: { stress: 9, happiness: -2 } },
        '公司活下来了。你后来算账，那笔加薪救了命，也掏空了你。')),

    D('dil_partner_family', '他家里出事了', '合伙人父亲重病，他想撤股回家。你刚谈下一个大单，前期全压在这上面。放他走，资金链断；不放，他可能连父亲最后一面都见不到。', MID, ['合伙人'],
      o('放他走', '听说他父亲不太行了', '合伙人', '缺席', 11, { relation: 0, career: -12, money: -35000, fame: 3 },
        '你放他走了，自己借了一笔钱补上缺口。他父亲走的那天，他在老家，赶上了。', { money: { cash: -35000 }, at: { stress: 11, happiness: 2 } },
        '他回来后抱着你哭了很久。公司却缓了三年才缓过来。'),
      o('让他再撑一个季度', '听说还有时间', '合伙人', '记恨', 19, { relation: -19, career: 7, money: 20000, fame: -4 },
        '他撑了一个季度，单子成了，他父亲也走了。葬礼那天，他在电话里只说了一句“忙完了”。', { money: { cash: 20000 }, at: { stress: 9, happiness: -6 } },
        '他后来退了股。你们再没合作过。')),

    /* 8. 照顾老人 vs 出国机会 */
    D('dil_abroad_offer', '签证与病历', '父亲查出病，需要人陪着跑医院。同一周，你拿到出国进修的名额，三年一次，错过就没有。父亲说“你去，我这把老骨头死不了”。', YOUTH, ['父亲'],
      o('留下照顾', '听说病情不稳定', '父亲', '缺席', 12, { relation: 0, career: -16, money: -15000, health: -4 },
        '你留下了。每天挂号、拿药、陪床。名额给了别人，那人回来升了两级。', { money: { cash: -15000 }, at: { stress: 11, health: -4, happiness: 1 } },
        '父亲多活了六年。你偶尔会想，如果去了会怎样。'),
      o('出国', '听说父亲能撑住', '父亲', '失望', 18, { relation: -18, career: 15, money: 25000, health: 0 },
        '你走了。父亲在电话里总说“好着呢”。你回国那天，他已经住进了重症。', { money: { cash: 25000 }, at: { stress: 7, happiness: -6 } },
        '他最后清醒时问“你什么时候回来”。你在飞机上。')),

    D('dil_abroad_study', '录取通知书', '你拿到国外学校的录取，学费要掏空家里。母亲刚做完手术，需要复查。她帮你把通知书抚平，说“去吧，别管我”。', YOUTH, ['母亲'],
      o('放弃留学', '听说复查不能拖', '母亲', '缺席', 13, { relation: 0, career: -14, money: -8000, health: -3 },
        '你把通知书收进抽屉，陪母亲复查。她恢复得好，你却总在夜里翻那个抽屉。', { money: { cash: -8000 }, at: { stress: 9, health: -3, happiness: 2 } },
        '母亲后来知道了，说“是我拖累你”。你说不是，她没信。'),
      o('出国读书', '听说复查很顺利', '母亲', '失望', 17, { relation: -17, career: 13, money: -60000, health: -1 },
        '你走了。母亲复查结果不太好，是邻居陪着去的。你在视频里看见她瘦了。', { money: { cash: -60000 }, at: { stress: 8, happiness: -5 } },
        '你毕业回国，母亲已经不太出门了。')),

    D('dil_abroad_job', '海外岗位与老屋', '公司给你一个海外岗位，年薪翻三倍。父亲一个人住在老屋，腿脚一年不如一年。他说“我不用你管”，可你看见他把你小时候的照片摆在了床头。', MID, ['父亲'],
      o('留在本地', '听说父亲身体还行', '父亲', '缺席', 11, { relation: 0, career: -12, money: -20000, health: -2 },
        '你留了下来，换了个钱少但离家近的工作。父亲每天傍晚在门口等你，像接孩子放学。', { money: { cash: -20000 }, at: { stress: 6, happiness: 3 } },
        '你少赚了很多。老屋的灯每晚都亮着。'),
      o('去海外', '听说那边发展好', '父亲', '失望', 17, { relation: -17, career: 16, money: 40000, health: 0 },
        '你去了。三年后回来，老屋的门锁换了，父亲住进了养老院。他看见你，先问“你谁”。', { money: { cash: 40000 }, at: { stress: 8, happiness: -6 } },
        '你把他接回家，他已经不认得那盏灯。')),

    D('dil_abroad_family', '一家人的机票', '你拿到移民资格，能带全家走。父母年纪大了，不愿意离开老家。走，可能几年见不到；留，孩子的教育和你的职业都卡在这里。', MID, ['父母'],
      o('留下', '听说老人离不开故土', '父母', '缺席', 10, { relation: 0, career: -13, money: -25000, health: -2 },
        '你留下了。孩子上了本地学校，父母每天能看见孙子/孙女。你的职业停在了原地。', { money: { cash: -25000 }, at: { stress: 8, happiness: 2 } },
        '孩子十岁那年问你“我们为什么没走”，你说“因为家在这儿”。'),
      o('带小家走', '听说那边机会多', '父母', '失望', 18, { relation: -18, career: 14, money: 30000, health: -1 },
        '你带着伴侣和孩子走了。父母站在门口，一直挥到手看不见。', { money: { cash: 30000 }, at: { stress: 7, happiness: -5 } },
        '父亲走的那年，你因为签证没能回来。视频里，灵堂很白。'))
  ];

  V.DILEMMA_CATS = {
    friend_career: ['dil_friend_car', 'dil_friend_layoff', 'dil_friend_father', 'dil_friend_venture'],
    mother_contract: ['dil_mom_hospital', 'dil_mom_surgery', 'dil_mom_fall', 'dil_mom_chemo'],
    partner_overtime: ['dil_partner_fever', 'dil_partner_surgery', 'dil_partner_postpartum', 'dil_partner_parents'],
    loan_house: ['dil_loan_house', 'dil_loan_business', 'dil_loan_gambling', 'dil_loan_wedding'],
    kid_promotion: ['dil_kid_school', 'dil_kid_exam', 'dil_kid_transfer', 'dil_kid_sick'],
    witness_future: ['dil_witness', 'dil_cover', 'dil_sign', 'dil_report'],
    partner_split_staff: ['dil_partner_split', 'dil_partner_debt', 'dil_partner_poach', 'dil_partner_family'],
    elder_abroad: ['dil_abroad_offer', 'dil_abroad_study', 'dil_abroad_job', 'dil_abroad_family']
  };

  /* =========================================================
     二、两难结算：降亲密 / 标签 / 承诺 / 多年回响
     ========================================================= */
  V.onChoice = function (g, ev, opt, outcomeLabel) {
    if (!g || !ev || !opt) return;
    var dm = opt.dilemma;
    if (dm) {
      var role = dm.abandon && dm.abandon.role;
      var drop = n(dm.abandon && dm.abandon.drop, 12);
      if (role) {
        var npc = npcOf(g, role);
        if (npc) {
          npc.intimacy = clamp(n( npc.intimacy, 50) - drop, 0, 100);
          npc.favor = clamp(n(npc.favor, 0) - 2, -5, 5);
          if (L.addAnchor) L.addAnchor(g, npc, 'abandoned', '你放弃了' + npc.name, 0, 0);
        }
        L.addMemory(g, '你放弃了' + role + '，留下「' + (dm.abandon.tag || '失望') + '」。', 'choice');
        g.tags = g.tags || [];
        g.tags.push(dm.abandon.tag || '失望');
      }
      var made = null;
      if (dm.promise) {
        made = V.addPromise(g, {
          npcRole: role, who: dm.promise.who || role,
          text: dm.promise.text, dueYears: dm.promise.dueYears || 2,
          consequence: dm.promise.consequence || (dm.abandon && dm.abandon.tag) || '失望'
        });
      }
      if (dm.echo) {
        g.echoQueue = g.echoQueue || [];
        g.echoQueue.push({
          dueYear: g.year + n(dm.echo.afterYears, 6),
          text: dm.echo.text,
          title: dm.echo.title || '',
          fromEventId: ev.id,
          role: role,
          fromAge: g.age,
          fromYear: g.year,
          fromTitle: ev.title,
          fromChoice: opt.label,
          fired: false
        });
      }
      g.dilemmaLog = g.dilemmaLog || [];
      g.dilemmaLog.push({
        id: ev.id, year: g.year, age: g.age, choice: opt.label,
        abandon: role || '', tag: (dm.abandon && dm.abandon.tag) || '',
        promiseId: made ? made.id : ''
      });
      if (g.dilemmaLog.length > 40) g.dilemmaLog = g.dilemmaLog.slice(-40);
    }
    /* 「答应」类选项 → 自动生成一条真实承诺 */
    var tagText = opt.fx && opt.fx.tag ? String(opt.fx.tag) : '';
    if (tagText && tagText.indexOf('答应') >= 0) {
      var r = '';
      if (opt.fx.npc) for (var k in opt.fx.npc) { r = k; break; }
      if (!r && ev.npcRole) r = ev.npcRole;
      if (r) V.addPromise(g, { npcRole: r, who: r, text: (opt.label || ''), dueYears: 2, consequence: '答应过的事' });
    }
  };

  V.addPromise = function (g, o) {
    if (!g || !o) return null;
    if (!L.PROMISE || !L.PROMISE.add) return null;
    g.promises = g.promises || [];
    var text = o.text || '';
    for (var i = 0; i < g.promises.length; i++) {
      var p = g.promises[i];
      if (p.status === 'open' && p.npcRole === o.npcRole && p.text === text) return p;
    }
    return L.PROMISE.add(g, {
      npcRole: o.npcRole || '', who: o.who || o.npcRole || '',
      type: 'absence', text: text,
      dueYear: g.year + n(o.dueYears, 2),
      consequence: o.consequence || '答应过的事'
    });
  };

  /* =========================================================
     三、承诺自动生成
     ========================================================= */
  V.PROMISE_SEED = [
    { role: '母亲', text: '这个月回家吃顿饭', due: 2 },
    { role: '母亲', text: '陪她去一趟菜市场', due: 1 },
    { role: '父亲', text: '帮他修一下院里的水管', due: 2 },
    { role: '父亲', text: '过年回去住两天', due: 2 },
    { role: '配偶', text: '周末一起去看场电影', due: 1 },
    { role: '配偶', text: '今年带她/他出去走走', due: 2 },
    { role: '子女', text: '下班去接他/她一次', due: 1 },
    { role: '子女', text: '陪他/她写完这本作业', due: 1 },
    { role: '发小', text: '把那顿欠着的酒补上', due: 2 },
    { role: '发小', text: '帮他搬一次家', due: 2 },
    { role: '同学', text: '参加一次同学聚会', due: 2 },
    { role: '同桌', text: '把借的那本书还回去', due: 1 },
    { role: '同事', text: '帮他顶一次班', due: 1 },
    { role: '邻居老人', text: '帮她带一袋米上楼', due: 1 },
    { role: '合伙人', text: '把今年的账当面算清', due: 2 }
  ];

  V.ensurePromises = function (g) {
    if (!g) return;
    g.promises = g.promises || [];
    if (g.promises.length >= 3) return;
    for (var i = 0; i < V.PROMISE_SEED.length; i++) {
      var s = V.PROMISE_SEED[i];
      if (!V.roleAlive(g, s.role)) continue;
      var dup = false;
      for (var j = 0; j < g.promises.length; j++) {
        if (g.promises[j].text === s.text) { dup = true; break; }
      }
      if (dup) continue;
      V.addPromise(g, {
        npcRole: s.role, who: s.role, text: s.text,
        dueYears: s.due, consequence: '你答应过'
      });
      return;
    }
    /* 兜底：没有具体角色时，只记一条自我目标，不生成无对象的 NPC 承诺 */
    if (g.promises.length < 3) {
      g.selfGoals = g.selfGoals || [];
      if (g.selfGoals.indexOf('今年把身体检查做了') < 0) {
        g.selfGoals.push('今年把身体检查做了');
        L.addMemory(g, '你给自己定了个目标：今年把身体检查做了。', 'promise');
      }
    }
  };

  /* =========================================================
     四、老地方
     ========================================================= */
  V.PLACES = [
    {
      id: 'old_threshold', name: '老屋门槛', roles: ['父亲', '母亲'], theme: '老地方',
      aliveText: '你路过老屋，门槛被踩得发亮。门虚掩着，里面有人咳嗽了一声，又停了。你在门槛上站了一会儿，没进去。',
      deadText: '老屋还在，门槛还在。只是门锁生了锈，院里没人扫，风把落叶堆在门槛上。你抬脚跨过去，又收回来。'
    },
    {
      id: 'school_shop', name: '校门口小卖部', roles: ['发小', '同桌'], theme: '老地方',
      aliveText: '校门口的小卖部还开着，老板娘认出了你，赊账本翻到很旧的一页。发小/同桌的名字还在上面，后面画了个圈。',
      deadText: '校门口的小卖部换了招牌，旧冰柜堆在墙边。你想起那个总在门口等你的身影，现在门口只有一辆落灰的自行车。'
    },
    {
      id: 'mother_market', name: '母亲常去的菜市场', roles: ['母亲'], theme: '老地方',
      aliveText: '你陪母亲去菜市场，她在同一个摊位前挑了半天，摊主说“还是老样子”。你拎着袋子跟在后面，像小时候。',
      deadText: '菜市场还在，那个摊位还在。摊主问你“你妈怎么没来”，你说“她不来了”。对方哦了一声，把秤放回去。'
    },
    {
      id: 'factory_gate', name: '旧工厂门口', roles: ['父亲'], theme: '老地方',
      aliveText: '旧工厂门口的下班铃还是那个调子。父亲站在门卫室旁边，和几个老工友抽烟，看见你，把烟掐了。',
      deadText: '旧工厂的铁门锁着，门卫室空了。你父亲当年站的位置，现在长了一丛草。下班铃早就拆了，再没人按。'
    },
    {
      id: 'river_bank', name: '江边堤岸', roles: ['发小', '配偶'], theme: '老地方',
      aliveText: '江边堤岸的风还是那么大。你们坐在水泥台阶上，谁也没说话。远处有人在放风筝，线断了一根。',
      deadText: '江边堤岸修过了，栏杆是新的。你一个人坐在台阶上，旁边空着一个位置。风把塑料袋吹到脚边，又吹走。'
    }
  ];

  /* 事件主题：与老地方主题白名单比对，避免“校园事件配工厂门口”式的背景掺水 */
  V.overlayTheme = function (e) {
    var t = ((e && e.title) || '') + ' ' + String((e && e.text) || '').split('\n\n')[0];
    if (/房|钱|债|贷|工资|加班|升职|创业|投资|合同|项目|账/.test(t)) return 'money';
    if (/父|母|妻|夫|子|女|家|婚|丧|生日|病/.test(t)) return 'family';
    if (/学校|老师|同学|考|毕业|课|班|同桌/.test(t)) return 'school';
    if (/医院|手术|体检|药|病/.test(t)) return 'health';
    if (/恋|约会|相亲|表白|暗恋/.test(t)) return 'love';
    if (/工作|公司|同事|领导|面试|部门|单位/.test(t)) return 'work';
    return 'other';
  };
  var PLACE_THEME_FIT = {
    old_threshold: 'family', school_shop: 'school',
    mother_market: 'family', factory_gate: 'family'
  };
  V.placeFits = function (p, g, e) {
    if (!e) return true;
    var theme = V.overlayTheme(e);
    var want = PLACE_THEME_FIT[p.id];
    if (!want) return true; /* 江边堤岸可出现在多数人生场景 */
    if (p.id === 'school_shop' && g.age < 6) return false;
    return theme === want;
  };

  /* 老地方：作为“叠加叙事”挂在当年事件正文后，不单独占用回合 */
  V.rollPlace = function (g, e) {
    if (!g) return null;
    if (g.placeYear === g.year) return null;
    if (!L.chance(0.15)) return null;
    g.placeLog = g.placeLog || [];
    var pool = [];
    for (var i = 0; i < V.PLACES.length; i++) {
      var p = V.PLACES[i];
      if (!V.placeFits(p, g, e)) continue;
      var recent = false;
      for (var j = 0; j < g.placeLog.length; j++) {
        if (g.placeLog[j].id === p.id && g.year - g.placeLog[j].year < 4) { recent = true; break; }
      }
      if (!recent) pool.push(p);
    }
    if (!pool.length) return null; /* 没有契合主题的老地方就跳过这段背景 */
    var picked = pool[Math.floor(L.rand() * pool.length)] || pool[0];
    var someAlive = false;
    for (var r = 0; r < picked.roles.length; r++) if (V.roleAlive(g, picked.roles[r])) { someAlive = true; break; }
    g.placeYear = g.year;
    g.placeLog.push({ id: picked.id, year: g.year, empty: !someAlive });
    if (g.placeLog.length > 30) g.placeLog = g.placeLog.slice(-30);
    return { id: picked.id, name: picked.name, empty: !someAlive, text: someAlive ? picked.aliveText : picked.deadText };
  };

  /* 时代锚点只作为独立事件出现（V.eraAnchor），不再并入任何事件的正文 */
  V.attachOverlays = function (g, e) {
    if (!g || !e) return e;
    /* v3.10：童年每节正文控制在 100–150 字；并节/收尾偶尔溢出时按标点裁回 */
    if ((g.stage === '童年' || e.stage === '童年') && String(e.text || '').length > 150) {
      var t0 = String(e.text);
      var cut0 = Math.max(t0.lastIndexOf('。', 149), t0.lastIndexOf('；', 149), t0.lastIndexOf('，', 149));
      e.text = cut0 >= 100 ? t0.slice(0, cut0 + 1) : t0.slice(0, 150);
    }
    /* 童年不挂“多年后路过老地方”的成年回望，避免把一节的字数顶过 150；
       rollPlace 仍照常调用，保持随机序列与投骰结果不变 */
    var pl = V.rollPlace(g, e);
    if (g.age <= 12) return e;
    if (pl) {
      e.placeNote = pl;
      e.text = (e.text || '') + '\n\n【' + (pl.empty ? pl.name + '（空了）' : pl.name) + '】' + pl.text;
      L.addMemory(g, '你' + (pl.empty ? '路过' : '去了') + pl.name + '。' + (pl.empty ? '那里还在，但空了。' : ''), 'place');
    }
    return e;
  };

  /* =========================================================
     五、时代锚点（2005 出生）
     ========================================================= */
  V.ERA_ANCHORS = [
    {
      year: 2008, title: '2008 年 · 地震与奥运', theme: '时代',
      text: '2008 年。电视里先是汶川，后来是奥运。大人们在院子里支起电视机，一边看一边抹眼睛。你太小，只记得红旗和很多很多人。',
      opts: [
        { label: '跟着大人看', hint: '你还不太懂', tone: 'safe', fx: { at: { happiness: 2, knowledge: 1 } },
          apply: function () { return '你坐在大人腿上，看见很多人哭，也看见很多人笑。那一年你第一次知道，世界会同时发生两件事。'; } },
        { label: '跑出去疯玩', hint: '院子里没人管', tone: 'mid', fx: { at: { happiness: 3, health: 1 } },
          apply: function () { return '你和小伙伴在巷子里跑，电视的声音从各家窗户里飘出来。'; } }
      ]
    },
    {
      year: 2013, title: '2013 年 · 微信开始普及', theme: '时代',
      text: '2013 年。大人们开始对着手机说话，说完还要按一下“发送”。家里的座机响得越来越少，母亲的手机里第一次出现了“群”。',
      opts: [
        { label: '抢着玩手机', hint: '听说能发语音', tone: 'mid', fx: { at: { knowledge: 2, happiness: 1 } },
          apply: function () { return '你对着手机喊了一声，屏幕上跳出一个绿色气泡。你觉得很神奇。'; } },
        { label: '继续看电视', hint: '看不懂大人在笑什么', tone: 'safe', fx: { at: { happiness: 1 } },
          apply: function () { return '你坐在电视机前，听见身后父母在群里抢红包，笑得很大声。'; } }
      ]
    },
    {
      year: 2019, title: '2019 年末 · 最后一个平常的冬天', theme: '时代',
      text: '2019 年末。街上还很热闹，没人戴口罩。你记得那年冬天特别冷，母亲买了很多菜，说“多囤点，过年嘛”。',
      opts: [
        { label: '和家人一起囤年货', hint: '听说要涨价', tone: 'safe', fx: { at: { happiness: 2 }, money: { cash: -800 } },
          apply: function () { return '你们拎着大包小包回家，冰箱塞得关不上。那时候谁也没想到，这个冬天会那么长。'; } },
        { label: '跟朋友出去玩', hint: '听说有个新开的店', tone: 'mid', fx: { at: { happiness: 3, stress: -1 } },
          apply: function () { return '你们在商场里逛到关门，拍了很多照片。后来再看那些照片，背景里没有一个人戴口罩。'; } }
      ]
    },
    {
      year: 2020, title: '2020 年 · 一切按下暂停', theme: '时代',
      text: '2020 年。开学通知一拖再拖，小区门口搭起了棚子。你每天量体温，出门要戴口罩，空气里有消毒水的味道。',
      opts: [
        { label: '在家上网课', hint: '听说要很久', tone: 'safe', fx: { at: { knowledge: 2, happiness: -1 } },
          apply: function (g) {
            return g.age >= 17 ? '高考延期了。你在家做题，窗外的树从光秃秃到长满叶子。' : '你在家上网课，屏幕那头的老师声音总是断断续续。';
          } },
        { label: '偷偷跑出去玩', hint: '听说外面没人', tone: 'risk', fx: { at: { happiness: 2, health: -2 } },
          apply: function () { return '你和朋友在空荡荡的街上骑自行车。那段时间，整座城市像被按了静音。'; } }
      ]
    },
    {
      year: 2022, title: '2022 年 · 就业寒冬', theme: '时代',
      text: '2022 年。招聘会上的人比岗位多，学长们说“先就业再择业”。你投出去的简历，很多连“已读”都没有。',
      opts: [
        { label: '继续投简历', hint: '听说今年特别难', tone: 'risk', fx: { at: { stress: 3, knowledge: 1 } },
          apply: function () { return '你投了上百份，面试了七八家。有人问你“能不能接受降薪”，你点了头。'; } },
        { label: '先考个证/缓一缓', hint: '听说还有机会', tone: 'safe', fx: { at: { knowledge: 2, stress: 1 } },
          apply: function () { return '你决定再等等。图书馆里坐满了和你一样的人。'; } }
      ]
    },
    {
      year: 2023, title: '2023 年 · 消费降级', theme: '时代',
      text: '2023 年。奶茶店开始卖九块九，商场里“清仓”的牌子挂了半年。朋友聚会从餐厅改到家里，大家说“自己做饭划算”。',
      opts: [
        { label: '开始记账', hint: '听说钱要省着花', tone: 'safe', fx: { at: { finance: 2, happiness: -1 } },
          apply: function () { return '你第一次认真记下每一笔支出，发现很多钱花得不明不白。'; } },
        { label: '照常花', hint: '听说以后会好', tone: 'risk', fx: { at: { happiness: 2 }, money: { cash: -3000 } },
          apply: function () { return '你还是去了那家喜欢的店。店里人不多，老板说“再撑撑”。'; } }
      ]
    }
  ];

  /* 只查当年是否还有未展示的时代锚点（不写 eraFired） */
  V.eraDue = function (g) {
    if (!g || !V.ERA_ANCHORS) return false;
    var f = g.eraFired || {};
    for (var i = 0; i < V.ERA_ANCHORS.length; i++) {
      if (V.ERA_ANCHORS[i].year === g.year && !f[V.ERA_ANCHORS[i].year]) return true;
    }
    return false;
  };

  V.eraAnchor = function (g) {
    if (!g) return null;
    g.eraFired = g.eraFired || {};
    for (var i = 0; i < V.ERA_ANCHORS.length; i++) {
      var a = V.ERA_ANCHORS[i];
      if (g.year !== a.year) continue;
      if (g.eraFired[a.year]) continue;
      g.eraFired[a.year] = true;
      var opts = [];
      for (var j = 0; j < a.opts.length; j++) {
        var src = a.opts[j];
        opts.push({
          label: src.label, hint: (src.hint || '') + ' · ' + a.year, tone: src.tone || 'mid',
          fx: src.fx || {}, apply: src.apply
        });
      }
      return {
        id: 'v36_era_' + a.year, type: 'random', stage: g.stage, tier: 'daily', layer: 'era',
        weight: 0, family: 'v36_era', prio: 92, theme: a.theme,
        title: a.title, text: a.text, opts: opts,
        /* eraNote 仅作「必须展示、不得平淡合并」的标记，不拼进任何事件正文 */
        eraNote: { year: a.year, title: a.title, text: a.text }
      };
    }
    return null;
  };

  /* =========================================================
     六、每年结算：回响到期 + 承诺补足
     ========================================================= */
  V.tick = function (g) {
    if (!g) return;
    g.echoQueue = g.echoQueue || [];
    for (var i = 0; i < g.echoQueue.length; i++) {
      var e = g.echoQueue[i];
      if (e.fired || g.year < e.dueYear) continue;
      e.fired = true;
      var id = 'v36_echo_' + i + '_' + e.dueYear;
      if (!L.EVENT_INDEX[id]) {
        (function (ee) {
          /* v3.8：回响事件只负责把作者写好的那段话送回来；正文、标题都来自源事件，
             系统不再拼任何通用句，也不再给“承认/沉默”这类模板选项。 */
          L.EVENT_INDEX[id] = {
            id: id, type: 'random', stage: null, tier: 'echo', layer: 'chain',
            weight: 0, family: 'v36_echo', prio: 70,
            echoParent: ee.fromEventId || '',
            title: ee.fromTitle || '',
            text: ee.text || '',
            opts: [
              {
                label: '记下这件事', hint: '有些事不会真的过去', tone: 'switch',
                outcomes: [{ w: 1, label: '', text: ee.text || '', fx: {} }],
                apply: function (g2) {
                  L.addMemory(g2, ee.text || '', 'echo');
                  return '';
                }
              }
            ],
            cond: function () { return true; }
          };
        })(e);
      }
      g.pending.push({
        event: id, dueAge: g.age, choiceId: '', choiceAge: e.fromAge || g.age,
        sourceEventId: e.fromEventId || '',
        choiceTitle: e.fromTitle || '', choiceLabel: e.fromChoice || '',
        choiceScene: (e.fromYear ? e.fromYear + '年' : '') + '，' + (e.role || '对方') + '记得「' + (e.fromTitle || '') + '」'
      });
    }
    g.echoQueue = g.echoQueue.filter(function (x) { return !x.fired; });
    /* 0–15 岁不补承诺种子：避免「2 岁答应帮父亲修水管」这类超龄承诺 */
    if (g.age >= 16) V.ensurePromises(g);
  };

  /* =========================================================
     七、结局信
     ========================================================= */
  V.LETTER_WORDS = [
    '别把灯关了。',
    '我想再回老屋看看。',
    '那年的事，我不怪你了。',
    '你们吃吧，我不饿。',
    '别哭，我又不是没活过。',
    '路远，别送了。'
  ];

  V.QUOTES = [
    { t: '命运不是运气，而是选择。', a: '古希腊箴言' },
    { t: '我们都在阴沟里，但仍有人仰望星空。', a: '奥斯卡·王尔德' },
    { t: '人生的意义不在于活了多少年，而在于记住了多少年。', a: '加西亚·马尔克斯' },
    { t: '你要做一个不动声色的大人了。', a: '村上春树' },
    { t: '所有的告别里，我最喜欢明天见。', a: '佚名' },
    { t: '时间不会治愈一切，它只是让你习惯。', a: '佚名' }
  ];
  V.letterQuote = function (g) {
    var i = n(g && g.turn, 0) % V.QUOTES.length;
    return V.QUOTES[i];
  };

  V.letter = function (g, s) {
    g = g || {};
    s = s || g.summary || {};
    var npcs = (g.npcs || []).slice();
    var alive = npcs.filter(function (x) { return x && x.alive; }).sort(function (a, b) { return n(b.intimacy) - n(a.intimacy); });
    var dead = npcs.filter(function (x) { return x && !x.alive; }).sort(function (a, b) { return n(b.intimacy) - n(a.intimacy); });

    var comeNames = [];
    for (var i = 0; i < alive.length && comeNames.length < 3; i++) {
      if (n(alive[i].intimacy, 0) >= 45) comeNames.push(alive[i].name);
    }

    var absentNames = [];
    var dl = g.dilemmaLog || [];
    for (var j = 0; j < dl.length; j++) {
      if (dl[j].abandon && absentNames.indexOf(dl[j].abandon) < 0) absentNames.push(dl[j].abandon);
    }
    for (var k = 0; k < dead.length && absentNames.length < 4; k++) {
      if (n(dead[k].intimacy, 0) >= 60 && absentNames.indexOf(dead[k].role) < 0) absentNames.push(dead[k].role);
    }
    if ((g.promises || []).some(function (p) { return p.status === 'broken'; }) && absentNames.length < 4) {
      absentNames.push('那个你失信过的人');
    }

    var p1 = comeNames.length
      ? '来送你的人不多：' + comeNames.join('、') + '。他们站在礼宾厅门口，谁也没先说话。'
      : alive.length
        ? '来送你的人不多。' + alive[0].name + '来了，站在最前面，替你把帽子扶正。'
        : '来送你的人不多，只有礼宾厅的两个师傅和楼下卖早点的大姐。她放下一个热豆浆，说“趁热”。';

    var p2 = absentNames.length
      ? '没来的有' + absentNames.join('、') + '。有些是先走了一步，有些是你当年没去。'
      : '该来的都来了。没来的人，你也已经不怪他们了。';

    var heir = '';
    var p3 = '';
    if (V.hasChildren(g)) {
      var ids = (g.family && g.family.childrenIds) || [];
      for (var c = 0; c < ids.length; c++) {
        var ch = L.getNpc(g, ids[c]);
        if (ch && ch.alive) { heir = ch.name; break; }
      }
      heir = heir || '孩子';
      p3 = '存折、房本和那台旧收音机，留给了' + heir + '。相册最上面那张，是你年轻时站在江边的照片。';
    } else if (V.spouseAlive(g)) {
      var sp = L.getNpc(g, g.family.marriage.spouseId);
      p3 = '房子、存款和所有照片，留给了' + (sp ? sp.name : '伴侣') + '。她/他说，先不收拾，等过完年再说。';
    } else {
      var sib = g.sibling && g.sibling.has ? g.sibling.name : '';
      p3 = sib
        ? '东西留给了' + sib + '。他/她挑走了那只旧箱子，剩下的捐了。'
        : '没有子女，也没有留下遗嘱。东西被社区收走，旧相册没人要，最后扔了。';
    }

    var words = (g.death && g.death.lastWords) || V.LETTER_WORDS[n(g.turn, 0) % V.LETTER_WORDS.length];
    var p4 = '最后一句话是：' + words + ' 说完，你把手松开了。';

    var dAge = (g.death && typeof g.death.age === 'number' && isFinite(g.death.age)) ? g.death.age : n(g.age);
    var dYear = (g.death && typeof g.death.year === 'number' && isFinite(g.death.year)) ? g.death.year : n(g.year, START_YEAR);
    var stats = [];
    stats.push({ k: '活到', v: dAge + ' 岁' });
    var money = g.money || {};
    var net = n(money.cash) + n(money.assets) - n(money.debt);
    stats.push({ k: '留下', v: net >= 0 ? ('约 ' + Math.round(net / 10000) + ' 万元') : '一笔没还完的债' });
    if (alive.length) stats.push({ k: '最亲的人', v: alive[0].role + ' ' + alive[0].name });
    else if (V.hasChildren(g)) stats.push({ k: '最亲的人', v: '孩子' });
    else stats.push({ k: '最亲的人', v: '没有' });

    var q = V.letterQuote(g);
    return {
      salute: '致 ' + (g.name || '你') + '：',
      paragraphs: [p1, p2, p3, p4],
      stats: stats,
      quote: q,
      sign: dYear + ' 年冬'
    };
  };

  /* 静态自检辅助 */
  V.kinWords = ['父母', '爸妈', '母亲', '父亲', '儿子', '女儿', '孩子', '子女', '孙子', '孙女', '伴侣', '配偶', '发小', '兄弟', '姐妹'];
  V.stats = function () {
    return { dilemmas: V.DILEMMAS.length, places: V.PLACES.length, eras: V.ERA_ANCHORS.length, promises: V.PROMISE_SEED.length };
  };
})();
