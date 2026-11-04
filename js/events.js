/* =========================================================
   events.js — 事件库
   事件字段：
     id, type(forced|causal|random), stage, age(数字或[起,止]),
     cond(g), weight, repeatable, title, text, opts[]
   选项：
     label, hint, req(g), reqText,
     fx（标准效果）, gamble{p, win, lose, winText, loseText}
   ========================================================= */
(function () {
  'use strict';
  var LS = window.LS;

  function ev(o) { o.opts = o.opts || []; return o; }
  function o(label, fx, extra) {
    var r = { label: label, fx: fx || {} };
    if (extra) for (var k in extra) r[k] = extra[k];
    return r;
  }
  function gamble(label, p, win, lose, winText, loseText, hint) {
    return {
      label: label, hint: hint || '',
      gamble: { p: p, win: win, lose: lose, winText: winText, loseText: loseText }
    };
  }
  function hasEdu(n) { return function (g) { return g.edu.level >= n; }; }
  function npcAlive(role) { return function (g) { var n = LS.getNpc(g, role); return !!(n && n.alive); }; }
  function hasChild(g) { return g.family.childrenIds.length > 0; }
  function hasJob(g) { return !!g.job.id; }
  function married(g) { return g.family.marriage.status === '已婚'; }
  function parentSick(g) {
    var n = LS.getNpc(g, '父亲');
    if (!n || !n.alive) n = LS.getNpc(g, '母亲');
    return !!(n && n.alive && n.age > 62 && n.health < 45);
  }

  var E = [];
  function add(list) { for (var i = 0; i < list.length; i++) E.push(list[i]); }

  /* =========================================================
     一、阶段强制事件
     ========================================================= */

  /* ---------------- 婴幼儿 0–3 ---------------- */
  add([
    ev({
      id: 'f_birth', type: 'forced', stage: '婴幼儿', age: 0, prio: 100,
      title: '出生',
      text: '县妇幼保健院的走廊里，父亲在缴费窗口和产房门口之间来回跑。母亲疼了十几个小时，医生把风险一条条说清楚，最后问了一句：要不要上无痛。窗外是 2005 年冬天灰白的天，走廊尽头有人在吃泡面。',
      opts: [
        o('听医生的，顺其自然', { at: { health: 3, happiness: 2 }, money: { cash: -1500 }, npc: { '母亲': { favor: 3 } }, tag: '出生时一切顺利' }),
        o('加钱上无痛，让母亲少受罪', { at: { health: 5 }, money: { cash: -6000 }, npc: { '母亲': { favor: 8 }, '父亲': { favor: -2 } }, tag: '家里为出生多花了一笔钱' }, { hint: '一笔不算小的开销' }),
        o('回老家找接生婆，省下住院费', { at: { health: -6, happiness: -2 }, money: { cash: 1000 }, npc: { '母亲': { health: -6 } }, tag: '出生在老家，条件是差了些' }, { hint: '省钱，但风险不小' })
      ]
    }),
    ev({
      id: 'f_vaccine', type: 'forced', stage: '婴幼儿', age: 1, prio: 90,
      title: '第一针自费疫苗',
      text: '镇上的防疫站排起长队，免费疫苗登记台前挤满了抱孩子的家长。隔壁窗口在推一种自费肺炎疫苗，一针两百多，护士说“有条件就打”。母亲翻了翻钱包，又看了看你。',
      opts: [
        o('只打免费的，够用就行', { money: { cash: -200 }, at: { health: 1 }, tag: '只打了免费疫苗' }),
        o('咬牙打自费疫苗', { money: { cash: -2400 }, at: { health: 4 }, npc: { '母亲': { favor: 3 } }, tag: '母亲坚持打了自费疫苗' }, { hint: '一笔额外的支出' }),
        o('听邻居说疫苗伤身体，先不打', { at: { health: -5 }, set: { anti_vaccine: true }, tag: '信了邻居的话，漏了疫苗' })
      ]
    }),
    ev({
      id: 'f_toddler', type: 'forced', stage: '婴幼儿', age: 2, prio: 85,
      title: '谁来带你',
      text: '母亲的产假早就结束了。厂里催她回去上班，幼儿园只收三岁以上的孩子。奶奶从乡下来了，带着一袋自家磨的面粉，说“我来带，你们去挣钱”。父亲没说话，只看母亲。',
      opts: [
        o('母亲辞职，在家带你到三岁', { money: { cash: -9000 }, at: { happiness: 5 }, npc: { '母亲': { favor: 8 } }, tag: '母亲为你辞职两年' }, { hint: '家里少一份收入' }),
        o('交给奶奶带，父母都去上班', { at: { happiness: 1, health: -2 }, money: { cash: 4000 }, npc: { '母亲': { favor: -4 } }, tag: '童年大部分时间由奶奶照看' }),
        o('送私人托儿所', { money: { cash: -7000 }, at: { charm: 3, knowledge: 1, health: -2 }, tag: '两岁就进了托儿所' }, { hint: '花钱换时间' })
      ]
    }),
    ev({
      id: 'f_kindergarten', type: 'forced', stage: '婴幼儿', age: 3, prio: 95,
      title: '幼儿园报名',
      text: '县里最好的公办幼儿园要提前一年排队，名额早就满了。民办园在新区，一个月三百八，教室有空调和钢琴。父亲把两张招生简章摊在饭桌上，母亲说“三岁看老，别省这个钱”。',
      opts: [
        o('进普通民办园', { money: { cash: -5000 }, at: { knowledge: 2, charm: 2 }, tag: '上了普通民办幼儿园' }, { hint: '一笔固定支出' }),
        o('托关系进公办园', { money: { cash: -9000 }, at: { knowledge: 3, reputation: 2 }, npc: { '父亲': { favor: 3 } }, tag: '托关系进了公办幼儿园' }),
        o('再在家待一年，省下学费', { at: { knowledge: -2, happiness: 3 }, money: { cash: 2000 }, tag: '晚一年才上幼儿园' })
      ]
    }),
    ev({
      id: 'f_rural_dad', type: 'forced', stage: '婴幼儿', age: 2, prio: 70,
      cond: function (g) { return g.birthplace === '农村'; },
      title: '父亲要去南方打工',
      text: '同村几个男人约好去广东的工地，包工头说一天八十，管住不管吃。父亲把行李卷成筒状，蹲在门槛上抽烟。母亲抱着你站在院里，问你跟不跟着去。',
      opts: [
        o('跟着去城里，租间民房借读', { money: { cash: -6000 }, at: { knowledge: 3, happiness: -2 }, npc: { '父亲': { favor: 4 } }, set: { moved_city: true }, tag: '很小就跟着父母去了城里' }, { hint: '城里开销大' }),
        o('留在村里，由奶奶照看', { at: { happiness: -5, health: 2 }, npc: { '父亲': { favor: -3 }, '母亲': { favor: -4 } }, set: { left_behind: true }, tag: '成了留守儿童' }),
        o('劝父亲留在县城打零工', { money: { cash: -4000 }, at: { happiness: 2 }, npc: { '父亲': { favor: 5, health: -3 } }, tag: '父亲留在了县城' })
      ]
    }),
    ev({
      id: 'f_earlyclass', type: 'forced', stage: '婴幼儿', age: 1, prio: 60,
      cond: function (g) { return g.background === '中产' || g.background === '富裕'; },
      title: '早教班',
      text: '市里新开了一家早教中心，宣传单上说“零到三岁是关键期”。一节课一百二，一次买一百节。母亲和小区里几个妈妈约着去试听，回来时眼神有点发热。',
      opts: [
        o('报名，不能输在起跑线', { money: { cash: -18000 }, at: { knowledge: 4, charm: 2, happiness: -2, stress: 2 }, tag: '一岁就上了早教班' }, { hint: '一笔不小的开支' }),
        o('自己在家教，省下这笔钱', { at: { knowledge: 2, happiness: 2 }, npc: { '母亲': { favor: 4 } }, tag: '父母自己在家做早教' }),
        o('不折腾，让孩子自然长大', { at: { happiness: 4 }, money: { cash: 5000 }, tag: '没有报早教班' })
      ]
    })
  ]);

  /* ---------------- 童年 4–12 ---------------- */
  add([
    ev({
      id: 'f_primary', type: 'forced', stage: '童年', age: 6, prio: 100,
      title: '小学报名',
      text: '九月，学区里的公办小学只隔一条街。校门口贴着分班名单，家长挤在铁栅栏前找自己孩子的名字。另一所民办小学在城东，学费一学期六千，校车接送，英语从一年级开。',
      opts: [
        o('按学区上公办小学', { edu: 1, money: { cash: -1200 }, at: { knowledge: 3, happiness: 1 }, tag: '进入学区公办小学' }),
        o('花钱上民办小学', { edu: 1, money: { cash: -12000 }, at: { knowledge: 6, charm: 2, stress: 2 }, npc: { '父亲': { favor: 2 } }, tag: '上了城东的民办小学' }, { hint: '学费不低' }),
        o('去城里借读，住校', { edu: 1, money: { cash: -6000 }, at: { knowledge: 5, happiness: -4 }, npc: { '母亲': { favor: -3 } }, tag: '六岁就离家住校' })
      ]
    }),
    ev({
      id: 'f_grade2', type: 'forced', stage: '童年', age: 8, prio: 90,
      title: '第一次期末排名',
      text: '期末成绩贴在教室后墙，你排在班里中游。班主任在家访时说，脑子不笨，就是坐不住。母亲把成绩单折好放进抽屉，父亲问了一句“补课多少钱”。',
      opts: [
        o('报周末补习班', { money: { cash: -6500 }, at: { knowledge: 5, happiness: -3, stress: 3 }, tag: '小学开始补课' }, { hint: '周末被占满' }),
        o('父母轮流盯着写作业', { at: { knowledge: 4, happiness: -2 }, npc: { '母亲': { favor: 3 }, '父亲': { favor: 2 } }, tag: '父母亲自盯作业' }),
        o('顺其自然，先把童年过完', { at: { knowledge: 1, happiness: 4 }, tag: '小学没有补课' })
      ]
    }),
    ev({
      id: 'f_hobby', type: 'forced', stage: '童年', age: 9, prio: 85,
      title: '兴趣班',
      text: '少年宫秋季招生，钢琴、奥数、书法、乒乓球各占一个周末半天。母亲说学一门乐器以后有用，父亲觉得奥数更实在。你自己其实更想去楼下的乒乓球班。',
      opts: [
        o('学钢琴', { money: { cash: -8000 }, at: { charm: 4, happiness: 2 }, tag: '学了几年钢琴' }, { hint: '琴和学费都要钱' }),
        o('学奥数', { money: { cash: -5000 }, at: { knowledge: 4, finance: 2, stress: 2 }, tag: '小学学了奥数' }),
        o('打乒乓球，不报学科班', { at: { health: 3, happiness: 4, charm: 2 }, money: { cash: -1500 }, tag: '童年有一项喜欢的运动' })
      ]
    }),
    ev({
      id: 'f_fight', type: 'forced', stage: '童年', age: 10, prio: 85,
      title: '被高年级同学堵在楼道',
      text: '放学后，两个高年级男生把你堵在楼梯拐角，要你把新买的作业本给他们“抄几天”。楼道里没有老师，只有远处传来的扫地声。你的手心出了汗。',
      opts: [
        o('告诉班主任', { npc: { '老师': { favor: 4 } }, at: { happiness: 1, reputation: 3 }, rep: { school: 4 }, tag: '把校园冲突交给了老师' }, { hint: '事情会闹到家长那里' }),
        o('当场打回去', { at: { health: -4, happiness: 2, reputation: -2, stress: 3 }, rep: { school: -3 }, set: { tough_kid: true }, tag: '小学时和同学动过手' }),
        o('忍下来，把作业本给他们', { at: { happiness: -6, stress: 5, charm: -2 }, set: { bully_victim: true }, tag: '小学时被同学欺负过' }, { hint: '心里会留下东西' })
      ]
    }),
    ev({
      id: 'f_family_money', type: 'forced', stage: '童年', age: 11, prio: 75,
      title: '家里钱紧了',
      text: '父亲所在的厂子效益不好，工资拖了两个月。母亲把存折翻出来算了一遍，还差下学期的伙食费。饭桌上没有人说话，只有电扇在头顶吱呀吱呀地转。',
      opts: [
        o('把攒的压岁钱拿出来', { money: { cash: -1500 }, at: { happiness: -2 }, npc: { '母亲': { favor: 5 } }, tag: '拿出压岁钱补贴家用' }),
        o('周末去镇上帮工', { money: { cash: 1800 }, at: { health: -3, knowledge: -2, happiness: -1 }, tag: '十一岁开始打零工' }),
        o('申请学校助学金', { money: { cash: 2500 }, at: { happiness: -4, reputation: -2 }, rep: { school: -2 }, tag: '领过学校助学金' })
      ]
    }),
    ev({
      id: 'f_middle_school', type: 'forced', stage: '童年', age: 12, prio: 100,
      title: '小升初',
      text: '县一中初中部今年改成摇号加面谈，名额两千人抢八百个。另一条路是去新区的私立初中，学费一年两万。班主任说你的成绩“冲一冲有希望”，母亲把这句话记在了心里。',
      opts: [
        o('报冲刺班，拼一拼县一中', { edu: 2, money: { cash: -8000 }, at: { knowledge: 6, stress: 4, happiness: -3 }, tag: '为小升初拼了一把' }, { hint: '花钱也花精力' }),
        o('托关系进私立初中', { edu: 2, money: { cash: -20000 }, at: { knowledge: 4, reputation: 3 }, npc: { '父亲': { favor: 2 } }, tag: '花钱进了私立初中' }),
        o('就近入学，不折腾', { edu: 2, at: { happiness: 3, knowledge: 1 }, rep: { school: -2 }, tag: '读了家门口的初中' })
      ]
    })
  ]);

  /* ---------------- 少年 13–18 ---------------- */
  add([
    ev({
      id: 'f_boarding', type: 'forced', stage: '少年', age: 13, prio: 90,
      title: '初中住校',
      text: '镇上的初中离村二十里，冬天六点半就要出门。学校有宿舍，八个人一间，一学期住宿费三百。母亲算了算每天接送的车费，说住校“省事，也省得你分心”。',
      opts: [
        o('住校，周末回家', { money: { cash: -3000 }, at: { knowledge: 4, happiness: -4, health: -2 }, npc: { '母亲': { favor: -2 } }, tag: '初中开始住校' }),
        o('每天骑车往返', { at: { health: -3, knowledge: 2, happiness: 1 }, npc: { '父亲': { favor: 3 } }, tag: '初中每天骑车上学' }),
        o('在学校旁租房，母亲陪读', { money: { cash: -15000 }, at: { knowledge: 6, happiness: 3, stress: 2 }, npc: { '母亲': { favor: 6 } }, tag: '母亲陪读了三年' }, { hint: '房租和陪读成本' })
      ]
    }),
    ev({
      id: 'f_firstlove', type: 'forced', stage: '少年', age: 14, prio: 85,
      title: '同桌',
      text: '同桌学习好，字也写得整齐。你们在自习课上传纸条，被值日老师看见过一次。班主任没有点名，只在班会上说“有些心思，现在还不合适”。你盯着课本，一页也没看进去。',
      opts: [
        o('表白，哪怕被拒绝', { at: { charm: 4, happiness: 6, stress: 3, knowledge: -3 }, set: { firstlove: true }, tag: '十四岁第一次表白' }),
        o('把话咽回去，先读书', { at: { knowledge: 4, happiness: -3 }, tag: '把喜欢藏了起来' }),
        o('保持暧昧，一起进步', { at: { knowledge: 2, happiness: 3, charm: 2 }, set: { firstlove: true }, tag: '和同桌暧昧了两年' })
      ]
    }),
    ev({
      id: 'f_zhongkao', type: 'forced', stage: '少年', age: 15, prio: 100,
      title: '中考',
      text: '中考在六月，考场设在县一中。考前一周，母亲每天煮两个鸡蛋，父亲把家里的老风扇搬到你书桌前。分数线贴在教育局门口，普通高中和职高之间，只隔着一张纸。',
      opts: [
        gamble('全力冲刺普通高中', function (g) { return LS.clamp(0.18 + g.attrs.knowledge / 150 + (LS.BACKGROUNDS[g.background].eduBonus || 0), 0.12, 0.92); },
          { edu: 3, at: { knowledge: 4, happiness: 8, stress: 5 }, set: { highschool: true }, tag: '考上了普通高中' },
          { edu: 3, at: { happiness: -8, stress: 4 }, set: { vocational: true }, tag: '中考失利，去了中职' },
          '分数够了，进了县一中。', '差了几分，被调剂到中职。', '成绩和运气共同决定'),
        o('直接报中职，学门技术', { edu: 3, at: { finance: 4, knowledge: 2, happiness: 1 }, set: { vocational: true }, money: { cash: 2000 }, tag: '主动选择读中职' }),
        o('花钱读私立高中', { edu: 3, money: { cash: -28000 }, at: { knowledge: 3, stress: 4 }, set: { highschool: true }, tag: '花钱进了私立高中' }, { hint: '一笔大开销' }),
        o('辍学跟亲戚去打工', { edu: 2, money: { cash: 5000 }, at: { health: -3, finance: 2, happiness: -4 }, set: { dropped_out: true }, tag: '十五岁离开学校' }, { hint: '提前进入社会' })
      ]
    }),
    ev({
      id: 'f_stream', type: 'forced', stage: '少年', age: 16, prio: 90,
      cond: function (g) { return !!g.marks.highschool; },
      title: '文理分科',
      text: '高一期末，班主任发下文理分科表。理科班老师说“就业面宽”，文科班老师说“你作文有灵气”。母亲倾向于理科，父亲没意见。表格必须在周五之前交。',
      opts: [
        o('选理科', { at: { knowledge: 5, finance: 2, stress: 2 }, set: { science: true }, tag: '高中选了理科' }),
        o('选文科', { at: { knowledge: 3, charm: 3, happiness: 2 }, set: { arts: true }, tag: '高中选了文科' }),
        o('走艺考路线', { money: { cash: -30000 }, at: { charm: 6, knowledge: -2, stress: 4 }, set: { art_student: true }, tag: '高中转去学艺术' }, { hint: '培训费很高' })
      ]
    }),
    ev({
      id: 'f_sprint', type: 'forced', stage: '少年', age: 17, prio: 90,
      cond: function (g) { return !!g.marks.highschool; },
      title: '高三',
      text: '高三的教室后面挂着倒计时牌，数字每天少一个。晚自习到十点半，走廊里全是背单词的声音。母亲问要不要报个一对一，父亲说“最后一搏，别留遗憾”。',
      opts: [
        o('报一对一冲刺', { money: { cash: -20000 }, at: { knowledge: 6, stress: 6, health: -3 }, tag: '高三花大钱补课' }, { hint: '费用高，压力也大' }),
        o('自己熬夜刷题', { at: { knowledge: 5, health: -6, stress: 5 }, flag: { event: 'c_sleep', delay: 9, mark: 'sleep_debt', note: '高中长期熬夜' }, tag: '高三靠熬夜硬撑' }),
        o('规律作息，保住身体', { at: { knowledge: 2, health: 2, happiness: 2, stress: -3 }, tag: '高三没有拼命熬夜' })
      ]
    }),
    ev({
      id: 'f_gaokao', type: 'forced', stage: '少年', age: 18, prio: 100,
      cond: function (g) { return !!g.marks.highschool; },
      title: '高考',
      text: '高考两天，考场外拉起了警戒线。父亲请了假，蹲在树荫下给你扇扇子。最后一科结束，人群像潮水一样涌向校门。分数出来那晚，全家守着电脑刷查询页面。',
      opts: [
        gamble('冲一冲名校', function (g) { return LS.clamp(0.1 + g.attrs.knowledge / 130 + (LS.BACKGROUNDS[g.background].eduBonus || 0) * 0.8, 0.08, 0.86); },
          { edu: 5, at: { knowledge: 6, happiness: 12, reputation: 8, stress: 4 }, rep: { school: 8, society: 4 }, set: { top_university: true }, tag: '高考冲进了名校' },
          { edu: 4, at: { happiness: -8, stress: 5 }, set: { wrong_major: true }, tag: '高考失利，读了专科' },
          '分数够了，录取通知书寄到家里。', '差了十几分，滑到专科批次。', '高风险，高回报'),
        gamble('稳妥填志愿，保证有学上', function (g) { return LS.clamp(0.45 + g.attrs.knowledge / 180, 0.35, 0.93); },
          { edu: 5, at: { knowledge: 3, happiness: 6 }, rep: { school: 3 }, tag: '稳妥上了本科' },
          { edu: 4, at: { happiness: -4 }, tag: '稳妥起见读了专科' },
          '稳稳当当，进了本科。', '还是滑到了专科。', '更稳，但上限有限'),
        o('复读一年，再给自己一次机会', { money: { cash: -10000 }, at: { knowledge: 4, stress: 8, happiness: -4 }, set: { retake: true }, tag: '选择复读一年' }, { hint: '再耗一年，压力不小' }),
        o('不读了，直接去打工', { edu: 3, money: { cash: 6000 }, at: { finance: 3, health: -3, happiness: -3 }, set: { dropped_out: true }, tag: '高中毕业就进了社会' })
      ]
    }),
    ev({
      id: 'f_voc', type: 'forced', stage: '少年', age: 18, prio: 95,
      cond: function (g) { return !g.marks.highschool; },
      title: '中职毕业',
      text: '三年中职读完，学校组织了一场招聘会。来的企业大多是本地工厂、汽修店和物流公司，起薪一千八到两千五。班主任说，想继续读可以考高职，但家里不一定拿得出学费。',
      opts: [
        o('考高职，继续读书', { edu: 4, money: { cash: -7000 }, at: { knowledge: 4, happiness: 3 }, tag: '中职升入高职' }, { hint: '还要再读三年' }),
        o('进本地工厂', { money: { cash: 2000 }, at: { finance: 3, health: -2 }, job: { id: 'gig', level: 1 }, tag: '中职毕业进厂上班' }),
        o('跟师傅学手艺', { money: { cash: 1000 }, at: { finance: 5, health: -1, charm: 2 }, job: { id: 'gig', level: 0 }, set: { craftsman: true }, tag: '跟师傅学了门手艺' })
      ]
    })
  ]);

  /* ---------------- 青年 19–30 ---------------- */
  add([
    ev({
      id: 'f_uni19', type: 'forced', stage: '青年', age: 19, prio: 95,
      cond: function (g) { return g.edu.level >= 4; },
      title: '大学第一年',
      text: '大学宿舍六人间，上下铺，楼道里永远有人在打电话。开学第一周，社团招新摆满了操场。辅导员说，大学和高中不一样，没人再逼你学。你忽然有了一种空落落的感觉。',
      opts: [
        o('扎进社团，认识更多人', { at: { charm: 5, happiness: 4, knowledge: -2, reputation: 3 }, rep: { school: 4 }, tag: '大学把时间花在社团' }),
        o('死磕专业课', { at: { knowledge: 6, stress: 3, happiness: -2 }, rep: { school: 5 }, tag: '大学一心读书' }),
        o('找兼职，先经济独立', { money: { cash: 8000 }, at: { knowledge: -1, health: -3, finance: 3, happiness: 1 }, tag: '大学开始做兼职' }, { hint: '时间被切碎' })
      ]
    }),
    ev({
      id: 'f_retake19', type: 'forced', stage: '青年', age: 19, prio: 96,
      cond: function (g) { return !!g.marks.retake; },
      title: '复读班的第二次高考',
      text: '复读班在县高中旧楼里，教室里坐满了不甘心的人。墙上贴着上一届的分数，有人用红笔圈出自己的目标。第二次走进高考考场时，你比去年安静了很多。',
      opts: [
        gamble('再拼一次', function (g) { return LS.clamp(0.28 + g.attrs.knowledge / 140, 0.2, 0.9); },
          { edu: 5, at: { knowledge: 4, happiness: 10, reputation: 5 }, rep: { school: 5 }, tag: '复读一年考上了本科' },
          { edu: 4, at: { happiness: -8, stress: 4 }, tag: '复读一年仍只上了专科' },
          '这一年的苦没有白吃。', '分数涨了，但批次没变。', '再来一次的机会'),
        o('接受专科录取，不耗了', { edu: 4, at: { happiness: -3, stress: -3 }, tag: '放弃复读，去读专科' }),
        o('彻底放弃升学，去找工作', { edu: 3, job: { id: 'gig', level: 0 }, at: { finance: 2, happiness: -2 }, tag: '放弃升学直接工作' })
      ]
    }),
    ev({
      id: 'f_junior21', type: 'forced', stage: '青年', age: 21, prio: 85,
      cond: function (g) { return g.edu.level >= 4; },
      title: '大三的选择',
      text: '大三下学期，班里分成几拨人：一拨准备考研，一拨刷行测申论，一拨投实习简历。宿舍夜里聊到两点，谁也说不出哪条路一定对。窗外是学校新修的人工湖。',
      opts: [
        o('准备考研', { money: { cash: -3000 }, at: { knowledge: 5, stress: 5 }, set: { pursue_master: true }, tag: '大三决定考研' }),
        o('去企业实习', { money: { cash: 3000 }, at: { finance: 3, reputation: 3 }, rep: { industry: 3 }, tag: '大三去企业实习' }),
        o('备考公务员', { at: { knowledge: 3, stress: 4 }, set: { exam_civil: true }, tag: '大三开始备考公务员' })
      ]
    }),
    ev({
      id: 'f_graduate22', type: 'forced', stage: '青年', age: 22, prio: 100,
      cond: function (g) { return g.edu.level >= 4; },
      title: '毕业季',
      text: '毕业照拍完，宿舍开始清空。有人拿到了大厂 offer，有人还在等面试通知。辅导员在群里发了一条就业率统计，要求每个人尽快确认去向。母亲打电话来问“定了没有”。',
      opts: [
        gamble('考研冲刺', function (g) { return LS.clamp(0.18 + g.attrs.knowledge / 160 + (g.marks.pursue_master ? 0.12 : 0), 0.12, 0.85); },
          { eduUp: true, at: { knowledge: 5, happiness: 8 }, set: { master: true }, tag: '考上了硕士研究生' },
          { at: { happiness: -7, stress: 5 }, job: { id: 'sales', level: 0 }, tag: '考研失败，先找了份销售工作' },
          '录取通知书来了。', '差了几名，调剂也没成。', '看学识，也看运气'),
        gamble('考公务员', function (g) { return LS.clamp(0.1 + g.attrs.knowledge / 220 + (g.marks.exam_civil ? 0.1 : 0), 0.08, 0.7); },
          { job: { id: 'civil', level: 0 }, at: { happiness: 7, stress: 2, reputation: 4 }, rep: { society: 5 }, tag: '考上了公务员' },
          { job: { id: 'sales', level: 0 }, at: { happiness: -6, stress: 4 }, tag: '考公失败，去了民企做销售' },
          '笔试面试都过了。', '面试差了一点，只能先就业。', '稳定，但录取率很低'),
        o('去大城市进企业', { job: { id: 'engineer', level: 0 }, money: { cash: -3000 }, at: { stress: 4, finance: 3 }, tag: '毕业去了大城市做技术' }, { hint: '起点高，压力也高' }),
        o('回老家找份安稳工作', { job: { id: 'stateowned', level: 0 }, at: { happiness: 3, stress: -2 }, npc: { '母亲': { favor: 4 } }, tag: '毕业回到老家' })
      ]
    }),
    ev({
      id: 'f_firstjob', type: 'forced', stage: '青年', age: 23, prio: 90,
      cond: function (g) { return !!g.job.id; },
      title: '第一份工作',
      text: '入职第一周，工位在靠窗的角落，电脑是上一任留下的。带你的老同事说，先把杂活干明白。下班时天已经黑了，你站在写字楼下，忽然意识到明天还要再来一遍。',
      opts: [
        o('抢着干活，表现积极', { at: { finance: 4, stress: 6, health: -3, reputation: 4 }, rep: { industry: 5 }, tag: '第一份工作拼得很凶' }, { hint: '用身体换成长' }),
        o('准点下班，守住生活', { at: { happiness: 4, stress: -2 }, rep: { industry: -2 }, tag: '第一份工作坚持准点下班' }),
        o('边干边考证，准备跳槽', { at: { knowledge: 3, finance: 2, stress: 2 }, money: { cash: -2000 }, tag: '工作之余一直在考证' })
      ]
    }),
    ev({
      id: 'f_rent25', type: 'forced', stage: '青年', age: 25, prio: 80,
      cond: hasJob,
      title: '房租到期',
      text: '房东在微信上发来消息，下个月起房租涨三百。你算了算通勤时间、押金和搬家成本。公司附近的一居室要三千五，远郊合租一千二，母亲在电话里说“不行就先搬回来”。',
      opts: [
        o('搬到远郊合租', { money: { cash: -6000 }, at: { happiness: -3, stress: 2, health: -1 }, tag: '搬到远郊合租' }, { hint: '通勤时间变长' }),
        o('租公司附近的一居室', { money: { cash: -20000 }, at: { happiness: 4, stress: -3 }, tag: '租了公司附近的一居室' }, { hint: '开销明显增加' }),
        o('搬回父母家住', { money: { cash: 5000 }, at: { happiness: -2, stress: -3 }, npc: { '母亲': { favor: 3 } }, tag: '搬回父母家住' })
      ]
    }),
    ev({
      id: 'f_love27', type: 'forced', stage: '青年', age: 27, prio: 85,
      cond: function (g) { return !married(g) && g.family.marriage.status !== '离异'; },
      title: '婚恋这件事',
      text: '同学群里开始有人晒婚纱照，母亲转发相亲文章的频率越来越高。你并不排斥结婚，但也说不上多想。周末的咖啡馆里，邻桌在讨论彩礼和房子，声音不大，却句句听得清。',
      opts: [
        gamble('认真谈一段恋爱', function (g) { return LS.clamp(0.3 + g.attrs.charm / 180 + (LS.hasTalent(g, 'beauty') ? 0.08 : 0), 0.22, 0.86); },
          { marry: true, at: { happiness: 10, stress: -4, charm: 3 }, tag: '二十七岁结了婚' },
          { at: { happiness: -5, stress: 3 }, tag: '谈了一段，最后没成' },
          '领证那天，两家人在饭店吃了顿饭。', '相处了半年，还是分开了。', '感情有不确定性'),
        gamble('接受家里安排的相亲', function (g) { return LS.clamp(0.4 + g.money.cash / 400000 + g.attrs.charm / 300, 0.28, 0.85); },
          { marry: true, money: { cash: -8000 }, at: { happiness: 6, stress: -2 }, tag: '通过相亲结了婚' },
          { money: { cash: -5000 }, at: { happiness: -4, stress: 3 }, tag: '相亲几次都没成' },
          '条件谈拢了，婚事定了下来。', '见了几面，觉得不合适。', '条件摆在桌面上'),
        o('先不结婚，把日子过好', { at: { happiness: 3, stress: -2, finance: 2 }, money: { cash: 5000 }, set: { single_by_choice: true }, tag: '决定先不结婚' })
      ]
    }),
    ev({
      id: 'f_house29', type: 'forced', stage: '青年', age: 29, prio: 85,
      cond: hasJob,
      title: '要不要买房',
      text: '中介带看了三套房：市区老破小，六十平，总价高但学区好；远郊新房，九十平，通勤一个半小时；还有一套继续租着。销售说“再等就更买不起了”，银行经理在算首付和月供。',
      opts: [
        o('买市区老破小', { house: { factor: 1, down: 0.3 }, at: { happiness: 3, stress: 8 }, tag: '在市区买了套老破小' }, { hint: '首付和月供都不轻' }),
        o('买远郊新房', { house: { factor: 0.72, down: 0.28 }, at: { happiness: 5, stress: 6, health: -2 }, flag: { event: 'c_sedentary', delay: 3, mark: 'commute', note: '远郊通勤每天三小时' }, tag: '在远郊买了新房' }, { hint: '通勤时间很长' }),
        o('继续租房，不背房贷', { money: { cash: 10000 }, at: { happiness: 2, stress: -4 }, set: { rent_for_life: true }, tag: '决定长期租房' })
      ]
    }),
    ev({
      id: 'f_child30', type: 'forced', stage: '青年', age: 30, prio: 90,
      cond: married,
      title: '要不要孩子',
      text: '婚后两年，双方父母开始频繁提起孩子。妻子/丈夫把体检报告放在桌上，说身体没问题，只是还没想好。你们算过一笔账：产检、月嫂、奶粉、幼儿园，数字一项项加起来。',
      opts: [
        o('要一个孩子', { child: true, money: { cash: -25000 }, at: { happiness: 8, stress: 6, health: -2 }, flag: { event: 'c_sleep', delay: 2, mark: 'infant', note: '夜里带孩子，长期缺觉' }, tag: '三十岁有了孩子' }, { hint: '经济和精力都要让位' }),
        o('再等两年', { at: { happiness: 2, stress: -2 }, money: { cash: 8000 }, set: { delay_child: true }, tag: '把孩子的事往后推了推' }),
        o('决定丁克', { at: { happiness: 3, stress: -3 }, money: { cash: 10000 }, set: { dink: true }, tag: '和伴侣决定不要孩子' })
      ]
    }),
    ev({
      id: 'f_child33', type: 'forced', stage: '中年', age: 33, prio: 88,
      cond: function (g) { return married(g) && g.family.childrenIds.length === 0 && !g.marks.dink; },
      title: '再拖就高龄了',
      text: '体检查出几项指标不太好，医生提醒你们如果要孩子，最好别再拖。双方父母不再催，只是每次打电话都问身体怎么样。你们坐在沙发上，把最坏的情况也讨论了一遍。',
      opts: [
        o('开始备孕', { child: true, money: { cash: -30000 }, at: { happiness: 6, health: -3, stress: 5 }, tag: '三十三岁开始要孩子' }, { hint: '身体和积蓄都要付出' }),
        o('先调理身体，顺其自然', { money: { cash: -8000 }, at: { health: 4, happiness: 2 }, tag: '决定先调理身体再考虑孩子' }),
        o('彻底放弃生育', { at: { happiness: 3, stress: -4 }, set: { dink: true }, tag: '三十三岁决定不再考虑生育' })
      ]
    }),
    ev({
      id: 'f_single30', type: 'forced', stage: '青年', age: 30, prio: 80,
      cond: function (g) { return !married(g); },
      title: '三十岁的催婚',
      text: '过年回家，饭桌上亲戚轮番劝你“别挑了”。母亲把相亲对象的条件念了一遍，父亲在旁边补一句“成家立业，先成家”。你放下筷子，忽然不知道该从哪句解释起。',
      opts: [
        gamble('认真见几个，试着定下来', function (g) { return LS.clamp(0.35 + g.attrs.charm / 200 + g.money.cash / 500000, 0.25, 0.82); },
          { marry: true, money: { cash: -12000 }, at: { happiness: 7, stress: -3 }, tag: '三十岁相了亲，结了婚' },
          { at: { happiness: -4, stress: 2 }, tag: '见了几个，还是没成' },
          '有一个聊得来，慢慢走到了谈婚论嫁。', '条件都不错，就是没感觉。', '现实条件下的选择'),
        o('继续单着，把话说清楚', { at: { happiness: 4, stress: -3, charm: 2 }, npc: { '母亲': { favor: -5 } }, set: { single_by_choice: true }, tag: '顶住压力，选择单身' }),
        o('把重心放在工作上', { at: { finance: 4, stress: 5, happiness: -1 }, rep: { industry: 4 }, tag: '三十岁把重心放在工作' })
      ]
    })
  ]);

  /* ---------------- 中年 31–55 ---------------- */
  add([
    ev({
      id: 'f_promote32', type: 'forced', stage: '中年', age: 32, prio: 90,
      cond: hasJob,
      title: '第一次晋升窗口',
      text: '部门主管的位置空了出来，科里符合条件的有三个人。领导在会上说“看综合表现”，下班后又单独找你聊了十分钟。隔壁工位的老同事已经开始请人吃饭。',
      opts: [
        gamble('主动争取这个位置', function (g) { return LS.clamp(0.25 + g.attrs.knowledge / 260 + LS.repTotal(g) / 500, 0.18, 0.85); },
          { promote: true, at: { finance: 5, stress: 5, reputation: 6 }, rep: { industry: 8 }, tag: '三十二岁第一次升职' },
          { at: { stress: 7, happiness: -4, reputation: -2 }, rep: { industry: -2 }, tag: '晋升竞争失败' },
          '任命文件下来了，你搬进了靠里的办公室。', '位置给了别人，你还得继续配合。', '职场里没有白争的机会'),
        o('跳槽去同行，换个环境', { salaryPct: 0.22, quitJob: true, job: { id: 'engineer', level: 1 }, at: { stress: 4, reputation: -3 }, money: { cash: 5000 }, tag: '三十二岁跳槽' }, { hint: '收入可能涨，但要重新开始' }),
        o('维持现状，不争不抢', { at: { happiness: 3, stress: -3 }, tag: '放弃了第一次晋升机会' })
      ]
    }),
    ev({
      id: 'f_crisis35', type: 'forced', stage: '中年', age: 35, prio: 95,
      cond: hasJob,
      title: '三十五岁',
      text: '公司开始“优化”，HR 约谈了名单上的人。你的绩效不算差，但工资比新人高。领导话说得很客气：公司也不容易，你考虑一下。办公室里大家的键盘声都轻了。',
      opts: [
        o('拿 N+1 走人，先歇一段', { quitJob: true, severance: true, at: { happiness: -3, stress: 3, health: 2 }, tag: '三十五岁被优化，拿了赔偿' }, { hint: '收入中断' }),
        o('留下来扛，降薪也认', { salaryPct: -0.15, at: { stress: 8, health: -4, happiness: -4 }, rep: { industry: 3 }, flag: { event: 'c_sleep', delay: 2, mark: 'overwork', note: '降薪后长期加班' }, tag: '三十五岁降薪保住了工作' }),
        o('借机转行，学门新技能', { quitJob: true, money: { cash: -15000 }, at: { knowledge: 4, stress: 5, happiness: 1 }, job: { id: 'freelance', level: 0 }, tag: '三十五岁转行做了自由职业' })
      ]
    }),
    ev({
      id: 'f_child_school38', type: 'forced', stage: '中年', age: 38, prio: 85,
      cond: hasChild,
      title: '孩子的学区',
      text: '孩子要上小学，对口的学校一般。中介发来一套学区房信息，总价比现在住的房子贵一倍。妻子/丈夫说“咬咬牙”，你算完月供，发现要搭进去未来十年。',
      opts: [
        o('换学区房，背更重的贷款', { house: { factor: 1.35, down: 0.4 }, at: { happiness: 3, stress: 10, health: -2 }, npc: { '子女': { favor: 8 } }, tag: '为了孩子换了学区房' }, { hint: '债务压力陡增' }),
        o('报补习班，不换房', { money: { cash: -30000 }, at: { stress: 5, happiness: -2 }, npc: { '子女': { favor: 4 } }, tag: '给孩子报了补习班' }),
        o('就近入学，接受普通', { at: { happiness: 3, stress: -3 }, npc: { '子女': { favor: -4 } }, tag: '让孩子就近上了普通小学' })
      ]
    }),
    ev({
      id: 'f_parent_sick42', type: 'forced', stage: '中年', age: 42, prio: 95,
      cond: function (g) {
        var f = LS.getNpc(g, '父亲'), m = LS.getNpc(g, '母亲');
        return (f && f.alive && f.age > 58) || (m && m.alive && m.age > 55);
      },
      title: '父母住院',
      text: '父亲在菜市场门口晕倒，被邻居送进县医院。检查结果不太好，医生建议做进一步治疗，费用先交五万。母亲在走廊里抹眼泪，问你这钱能不能拿出来。',
      opts: [
        o('出钱治疗，别拖', { money: { cash: -60000 }, at: { happiness: -2, stress: 6 }, npc: { '父亲': { health: 12, favor: 10 }, '母亲': { favor: 6 } }, tag: '为父亲的治疗掏了钱' }, { hint: '一笔大额支出' }),
        o('请长假陪护', { money: { cash: -15000 }, at: { health: -4, stress: 8, happiness: -2 }, npc: { '父亲': { favor: 12 }, '母亲': { favor: 8 } }, tag: '请假在医院陪护' }),
        o('让亲戚先照应，自己出一点', { money: { cash: -10000 }, at: { happiness: -5 }, npc: { '父亲': { favor: -8 }, '母亲': { favor: -6 } }, tag: '父母住院时没能到场' })
      ]
    }),
    ev({
      id: 'f_ceiling46', type: 'forced', stage: '中年', age: 46, prio: 80,
      cond: hasJob,
      title: '天花板',
      text: '同一批进公司的人，有的升了，有的走了。你还在原来的位置上，工资每年涨一点，事情越来越熟，也越来越没意思。一个老同学发来消息，说他那边有个项目，问你有没有兴趣。',
      opts: [
        o('辞职创业，赌一把', { quitJob: true, job: { id: 'startup', level: 0 }, money: { cash: -50000 }, at: { stress: 12, happiness: 3 }, set: { entrepreneur: true }, tag: '四十六岁辞职创业' }, { hint: '收入归零，压力陡增' }),
        o('读个在职 MBA', { money: { cash: -60000 }, at: { knowledge: 5, reputation: 6, stress: 5 }, rep: { industry: 5 }, flag: { event: 'c_back', delay: 2, mark: 'mba', note: '边工作边读 MBA，久坐少动' }, tag: '读了在职 MBA' }, { hint: '学费贵，周末也没了' }),
        o('守着现在的位置', { at: { happiness: 4, stress: -4 }, money: { cash: 8000 }, tag: '接受了自己的天花板' })
      ]
    }),
    ev({
      id: 'f_checkup50', type: 'forced', stage: '中年', age: 50, prio: 90,
      title: '体检报告',
      text: '单位体检报告出来，几项指标标了箭头。医生建议复查，说“这个年纪很常见，但别拖”。你把报告折起来放进包里，晚上吃饭时没提这件事。',
      opts: [
        o('去大医院复查', { money: { cash: -6000 }, at: { health: 5, stress: 2 }, set: { health_checked: true }, tag: '五十岁做了详细复查' }),
        o('调整作息，戒烟少酒', { at: { health: 7, happiness: -2, stress: -3 }, money: { cash: -2000 }, tag: '五十岁开始认真养生' }),
        o('先拖着，忙完这阵再说', { at: { health: -7, stress: 5 }, flag: { event: 'c_health_check', delay: 3, mark: 'ignore_health', note: '体检异常一直没复查' }, tag: '体检异常拖了几年' }, { hint: '风险在往后累积' })
      ]
    }),
    ev({
      id: 'f_retire_plan54', type: 'forced', stage: '中年', age: 54, prio: 80,
      cond: hasJob,
      title: '退休规划',
      text: '单位开始统计退休意向。人事说，按现在的缴费年限，退休金大概够基本生活，想过得体面还得自己有积蓄。银行客户经理推荐了一款商业养老保险。',
      opts: [
        o('买商业养老保险', { money: { cash: -120000 }, at: { stress: -4, happiness: 4 }, set: { pension: true }, tag: '五十四岁买了商业养老保险' }, { hint: '一次性投入很大' }),
        o('继续攒钱，不乱花', { at: { happiness: -3, stress: 2 }, money: { cash: 20000 }, tag: '为退休继续攒钱' }),
        o('提前内退，回老家生活', { retire: true, money: { cash: -20000 }, at: { stress: -8, happiness: 3, health: 2 }, npc: { '母亲': { favor: 4 } }, tag: '五十四岁提前内退' })
      ]
    })
  ]);

  /* ---------------- 中老年 56–75 ---------------- */
  add([
    ev({
      id: 'f_retire56', type: 'forced', stage: '中老年', age: 56, prio: 100,
      cond: hasJob,
      title: '退休',
      text: '人事把退休手续清单发给你，需要跑六个窗口。办公室的年轻人帮你复印材料，说“以后常回来看看”。最后一次打卡下班，你在门口站了一会儿。',
      opts: [
        o('按时退休，把位置让出来', { retire: true, at: { stress: -8, happiness: 5, health: 2 }, tag: '五十六岁正式退休' }),
        o('接受返聘，继续干活', { salaryPct: -0.4, at: { stress: 3, happiness: -2 }, money: { cash: 10000 }, tag: '退休后被单位返聘' }, { hint: '收入减半，事情照旧' }),
        o('内退回家帮子女', { retire: true, at: { happiness: 3, health: -2 }, npc: { '子女': { favor: 5 } }, tag: '提前回家帮子女' })
      ]
    }),
    ev({
      id: 'f_grandchild60', type: 'forced', stage: '中老年', age: 60, prio: 85,
      cond: hasChild,
      title: '孙辈',
      text: '孩子抱着婴儿回家，说月嫂太贵，想请你们搭把手。夜里孩子哭，妻子/丈夫起身去冲奶粉。你看着客厅里多出来的婴儿床，觉得房子一下小了。',
      opts: [
        o('帮着带，累点也值', { at: { health: -4, stress: 4, happiness: 4 }, money: { cash: -6000 }, npc: { '子女': { favor: 8 } }, tag: '六十岁开始帮着带孙辈' }),
        o('出钱请月嫂，不亲自带', { money: { cash: -30000 }, at: { happiness: 2, stress: -2 }, npc: { '子女': { favor: 4 } }, tag: '出钱请月嫂，没有亲自带孙辈' }, { hint: '花钱换清静' }),
        o('继续过自己的日子', { at: { happiness: 6, health: 2 }, npc: { '子女': { favor: -5 } }, tag: '没有接手带孙辈' })
      ]
    }),
    ev({
      id: 'f_chronic63', type: 'forced', stage: '中老年', age: 63, prio: 90,
      title: '慢性病',
      text: '社区医院建档，血压和血糖都偏高。医生开了长期吃的药，叮嘱少盐少油、每天走路。药盒上印着很小的字，妻子/丈夫把它贴在冰箱门上。',
      opts: [
        o('按医嘱规律服药', { money: { cash: -6000 }, at: { health: 4, stress: -2 }, set: { chronic_med: true }, tag: '开始规律服用降压药' }),
        o('听偏方，吃保健品', { money: { cash: -12000 }, at: { health: -4, happiness: 1 }, flag: { event: 'c_quack', delay: 3, mark: 'quack_medicine', note: '长期吃来路不明的保健品' }, tag: '信了偏方和保健品' }),
        o('不吃了，靠自己扛', { at: { health: -5, stress: 3 }, set: { ignore_chronic: true }, tag: '没把慢性病当回事' })
      ]
    }),
    ev({
      id: 'f_reunion66', type: 'forced', stage: '中老年', age: 66, prio: 70,
      title: '老同事聚会',
      text: '退休群里组织聚会，地点在以前常去的那家家常菜馆。有人已经搬去外地，有人身体不好来不了。组织者在群里问谁能帮忙订桌，AA 制，人均一百。',
      opts: [
        o('去，见一面少一面', { money: { cash: -1000 }, at: { happiness: 5, reputation: 2 }, rep: { society: 3 }, tag: '参加老同事聚会' }),
        o('不去，在家清静', { at: { happiness: -2 }, tag: '推掉了老同事聚会' }),
        o('主动牵头组织', { money: { cash: -4000 }, at: { happiness: 4, reputation: 5 }, rep: { society: 6 }, tag: '牵头组织了老同事聚会' })
      ]
    }),
    ev({
      id: 'f_house70', type: 'forced', stage: '中老年', age: 70, prio: 80,
      title: '房子的事',
      text: '子女在饭桌上提起过户，说早晚要办，趁现在身体好把手续走完。你想起这套房是三十多岁时买的，贷款还了十几年。房产证放在柜子最里面，边角已经有点发黄。',
      opts: [
        o('提前过户给子女', { houseTransfer: true, at: { happiness: 2, stress: -3 }, npc: { '子女': { favor: 10 } }, tag: '把房子提前过户给了子女' }, { hint: '名下资产会减少' }),
        o('立一份遗嘱，写明安排', { money: { cash: -2000 }, at: { stress: -4 }, set: { will: true }, tag: '七十岁立了遗嘱' }),
        o('房子先留着自己住', { at: { happiness: 2 }, npc: { '子女': { favor: -5 } }, tag: '没有提前把房子给子女' })
      ]
    }),
    ev({
      id: 'f_elderly74', type: 'forced', stage: '中老年', age: 74, prio: 80,
      title: '养老方式',
      text: '腿脚不如从前，楼道的台阶变得很高。社区在推广居家养老服务，一小时四十；附近的养老院有床位，押金十万。子女说“听你的”，你知道他们也有自己的难处。',
      opts: [
        o('居家养老，靠子女搭把手', { at: { happiness: 3, stress: -3 }, npc: { '子女': { favor: 3 } }, money: { cash: -5000 }, tag: '选择居家养老' }),
        o('卖掉房子，住养老院', { houseSell: true, at: { happiness: -3, health: 3, stress: -4 }, set: { nursing_home: true }, tag: '卖房住进养老院' }, { hint: '一笔一次性收入，也是一次告别' }),
        o('请住家护工', { money: { cash: -50000 }, at: { health: 3, happiness: -1 }, tag: '请了住家护工' }, { hint: '长期开销' })
      ]
    })
  ]);

  /* ---------------- 晚年 76+ ---------------- */
  add([
    ev({
      id: 'f_alone76', type: 'forced', stage: '晚年', age: 76, prio: 90,
      title: '独居',
      text: '一个人住的第三年，早晨起来先摸一下手机，确认自己还记得怎么解锁。社区网格员每周打一次电话，问有没有事。窗台上的绿萝长得很高，你舍不得剪。',
      opts: [
        o('搬去和子女同住', { at: { happiness: 5, stress: -4, health: 2 }, npc: { '子女': { favor: 4 } }, tag: '搬去和子女同住' }),
        o('独居，请钟点工', { money: { cash: -20000 }, at: { happiness: -1, health: 2 }, tag: '独居但请了钟点工' }),
        o('住进养老机构', { money: { cash: -80000 }, at: { happiness: -3, health: 4 }, set: { nursing_home: true }, tag: '七十六岁住进养老机构' }, { hint: '费用不低' })
      ]
    }),
    ev({
      id: 'f_oldfriend79', type: 'forced', stage: '晚年', age: 79, prio: 80,
      title: '老友走了',
      text: '电话是对方儿子打来的，说你认识的那个老伙计前一天夜里走了，葬礼定在后天。你翻了翻通讯录，发现能一起回忆年轻时的人，又少了一个。',
      opts: [
        o('去送最后一程', { at: { health: -2, happiness: -5, reputation: 2 }, rep: { society: 3 }, money: { cash: -2000 }, tag: '去参加了老友的葬礼' }),
        o('随了礼，人不去', { money: { cash: -2000 }, at: { happiness: -3 }, tag: '老友葬礼只随了礼' }),
        o('不闻不问，怕触景生情', { at: { happiness: -2, reputation: -2 }, tag: '没有去送老友' })
      ]
    }),
    ev({
      id: 'f_bigill82', type: 'forced', stage: '晚年', age: 82, prio: 95,
      title: '一场大病',
      text: '夜里胸口疼，送到医院后直接进了抢救室。医生把家属叫到走廊，讲了两种方案：积极治疗，费用高，受罪；保守治疗，稳一点，但可能反复。',
      opts: [
        o('积极治疗，能治就治', { money: { cash: -120000 }, at: { health: 10, stress: 6, happiness: -2 }, tag: '八十二岁做了一场大手术' }, { hint: '费用很大' }),
        o('保守治疗，少受罪', { money: { cash: -30000 }, at: { health: 2, happiness: -2 }, tag: '选择了保守治疗' }),
        o('放弃治疗，回家养着', { at: { health: -14, happiness: 3, stress: -3 }, fatal: 0.22, tag: '放弃了大病治疗' }, { hint: '风险很高' })
      ]
    }),
    ev({
      id: 'f_disable85', type: 'forced', stage: '晚年', age: 85, prio: 90,
      title: '需要人照顾',
      text: '摔了一跤之后，走路要扶墙。医生说是骨质疏松加上肌肉萎缩，恢复得慢慢来。子女请了假回来商量：请护工，还是搬去护理院。',
      opts: [
        o('请护工在家照顾', { money: { cash: -70000 }, at: { health: 2, happiness: 1 }, tag: '八十五岁开始请护工' }, { hint: '长期支出' }),
        o('靠子女轮流照顾', { at: { happiness: 2, stress: 3 }, npc: { '子女': { favor: -5, health: -3 } }, tag: '靠子女轮流照顾' }),
        o('卖房住护理院', { houseSell: true, at: { health: 4, happiness: -2 }, set: { nursing_home: true }, tag: '卖房住进护理院' }, { hint: '要处理房产' })
      ]
    }),
    ev({
      id: 'f_will88', type: 'forced', stage: '晚年', age: 88, prio: 85,
      title: '遗嘱',
      text: '律师说，像你这个年纪，早点把话说清楚比较好。子女坐在客厅里，没有人主动提钱。你把存折、房产证和一个旧铁盒找出来，摆在桌上。',
      opts: [
        o('立正式遗嘱，按法律办', { money: { cash: -3000 }, at: { stress: -5 }, set: { will: true }, tag: '八十八岁立了正式遗嘱' }),
        o('口头交代，信得过子女', { at: { happiness: 2 }, npc: { '子女': { favor: 4 } }, tag: '只做了口头交代' }),
        o('不立，走了再说', { at: { stress: 2, happiness: -2 }, set: { no_will: true }, tag: '没有安排身后事' })
      ]
    }),
    ev({
      id: 'f_birthday90', type: 'forced', stage: '晚年', age: 90, prio: 95,
      title: '九十岁生日',
      text: '子女订了一个小蛋糕，插着数字蜡烛。来的人不多，有几个老邻居和孙辈。有人问长寿的秘诀，你笑了笑，说哪有什么秘诀，就是一天一天过。',
      opts: [
        o('和家人一起吃顿饭', { money: { cash: -5000 }, at: { happiness: 8, stress: -4 }, tag: '九十岁和家人一起过了生日' }),
        o('安静地过，不折腾', { at: { happiness: 4, stress: -2 }, tag: '九十岁安静地过了生日' }),
        o('趁还记得，讲讲以前的事', { at: { happiness: 6, reputation: 3 }, rep: { society: 4 }, tag: '九十岁给后辈讲了自己的故事' })
      ]
    })
  ]);

  /* =========================================================
     二、因果条件事件（延迟爆发 + 条件触发）
     ========================================================= */

  function spouseOf(g) {
    return g.family.marriage.spouseId ? LS.getNpc(g, g.family.marriage.spouseId) : null;
  }
  function anyNpcLow(g) {
    for (var i = 0; i < g.npcs.length; i++) {
      var n = g.npcs[i];
      if (n.alive && n.favor < 18) return true;
    }
    return false;
  }
  function childInAge(g, a, b) {
    for (var i = 0; i < g.family.childrenIds.length; i++) {
      var c = LS.getNpc(g, g.family.childrenIds[i]);
      if (c && c.alive && c.age >= a && c.age <= b) return true;
    }
    return false;
  }
  function firstChild(g) {
    for (var i = 0; i < g.family.childrenIds.length; i++) {
      var c = LS.getNpc(g, g.family.childrenIds[i]);
      if (c && c.alive) return c;
    }
    return null;
  }

  add([
    ev({
      id: 'c_sleep', type: 'causal', prio: 95,
      cond: function (g) { return g.age >= 24; },
      title: '熬夜的账',
      text: '这几年你习惯了凌晨一点以后睡。最近体检，肝功能有几项异常，血压也偏高。医生问作息，你说“工作没办法”。他把笔放下，看了你一眼，没再多说。',
      opts: [
        o('认真复查，调整作息', { money: { cash: -8000 }, at: { health: 4, stress: 2, happiness: 1 }, set: { fixed_sleep: true }, tag: '为长期熬夜做了复查' }, { hint: '要花时间也要花钱' }),
        o('买点护肝片，继续熬', { money: { cash: -3000 }, at: { health: -6, stress: 3 }, flag: { event: 'c_liver', delay: 6, mark: 'liver_issue', note: '长期熬夜加乱吃药' }, tag: '继续熬夜，靠保健品撑着' }),
        o('换一份少加班的工作', { job: { id: 'stateowned', level: 0 }, salaryPct: -0.1, at: { health: 5, stress: -6, happiness: 3 }, tag: '为了身体换了份清闲工作' }, { hint: '收入会下降' })
      ]
    }),
    ev({
      id: 'c_wrongmajor', type: 'causal', prio: 96,
      cond: function (g) { return g.age >= 26; },
      title: '专业的天花板',
      text: '工作几年后，你发现当年填志愿时的选择一直在收利息。同届的人有的进了核心岗位，你的简历总在某个环节被卡住。招聘要求上写着“相关专业”，这四个字像一道看不见的墙。',
      opts: [
        o('在职考研，换专业', { money: { cash: -40000 }, at: { knowledge: 5, stress: 8, happiness: -2 }, set: { change_major: true }, tag: '为了换赛道去读了在职研究生' }, { hint: '时间和钱都要投进去' }),
        o('考证转岗，从基层做起', { money: { cash: -8000 }, at: { finance: 4, stress: 4, happiness: 1 }, rep: { industry: 3 }, tag: '靠证书转了岗' }),
        o('接受现实，在现有岗位深耕', { at: { happiness: 2, stress: -3 }, rep: { industry: 4 }, tag: '接受了专业带来的限制' })
      ]
    }),
    ev({
      id: 'c_promise', type: 'causal', prio: 94,
      cond: function (g) { return g.age >= 25; },
      title: '人脉断裂',
      text: '几年前你向朋友借了一笔钱，说好半年还，后来一直拖。今天对方在微信上发来一段很客气的话，最后一句是“我也有难处”。你想了半天，不知道该怎么回。',
      opts: [
        o('把钱还上，再请人吃顿饭', { money: { cash: -12000 }, at: { stress: -3, happiness: 2, reputation: 3 }, rep: { society: 4 }, tag: '把欠朋友的钱还清了' }, { hint: '一次性支出' }),
        o('再拖一拖，等手头宽裕', { at: { stress: 6, happiness: -3, reputation: -4 }, rep: { society: -6 }, tag: '欠朋友的钱一直没还' }),
        o('装作没看见，删掉对话', { at: { stress: 4, happiness: -5, reputation: -6 }, rep: { society: -8 }, npc: { '朋友': { favor: -20 } }, tag: '因为借钱断了朋友' })
      ]
    }),
    ev({
      id: 'c_smoke', type: 'causal', prio: 90,
      cond: function (g) { return g.age >= 30; },
      title: '肺结节',
      text: '单位体检查出肺部有个小结节，医生说不一定有事，但建议三个月后复查。你想起这些年抽掉的烟，还有办公室里永远散不掉的二手烟。',
      opts: [
        o('戒烟，按时复查', { at: { health: 5, stress: 2 }, money: { cash: -3000 }, set: { quit_smoke: true }, tag: '因为肺结节戒了烟' }),
        o('少抽点，应该没事', { at: { health: -4, stress: 2 }, flag: { event: 'c_lung', delay: 5, mark: 'lung_risk', note: '肺结节没有规律复查' }, tag: '肺结节没有认真复查' }),
        o('直接做手术切掉', { money: { cash: -50000 }, at: { health: 3, stress: 6, happiness: -3 }, tag: '为肺结节做了手术' }, { hint: '一笔大支出' })
      ]
    }),
    ev({
      id: 'c_drink', type: 'causal', prio: 88,
      cond: function (g) { return g.age >= 28; },
      title: '脂肪肝',
      text: '体检报告上写着“中度脂肪肝”，医生问一周喝几次酒。你想起这些年陪客户、陪领导、陪朋友的饭局，白酒一杯接一杯，最后都变成了报告上的数字。',
      opts: [
        o('戒酒，控制饮食', { at: { health: 6, happiness: -2, stress: -3 }, money: { cash: -2000 }, set: { quit_drink: true }, tag: '戒了酒，开始控制饮食' }),
        o('应酬推不掉，少喝一点', { at: { health: -4, stress: 3 }, money: { cash: 3000 }, tag: '为了应酬继续喝酒' }),
        o('干脆换一份不用应酬的工作', { job: { id: 'stateowned', level: 0 }, salaryPct: -0.08, at: { health: 4, stress: -4 }, tag: '换了份不用陪酒的工作' })
      ]
    }),
    ev({
      id: 'c_sedentary', type: 'causal', prio: 86,
      cond: function (g) { return g.age >= 28; },
      title: '腰不行了',
      text: '连续加班三个月后，你在工位上站不起来。医院拍片说是腰椎间盘突出，建议卧床休息，别再久坐。你想到项目节点，想到请假要扣的钱。',
      opts: [
        o('请假休养，先把腰治好', { money: { cash: -12000 }, at: { health: 5, stress: -4, happiness: 1 }, tag: '为腰椎请了长假' }, { hint: '收入会受影响' }),
        o('买个人体工学椅，硬扛', { money: { cash: -4000 }, at: { health: -3, stress: 3 }, flag: { event: 'c_back', delay: 4, mark: 'back_issue', note: '腰椎问题一直没好' }, tag: '腰疼一直硬扛' }),
        o('开始游泳和拉伸', { money: { cash: -3000 }, at: { health: 4, happiness: 2, stress: -2 }, tag: '靠运动缓解了腰椎问题' })
      ]
    }),
    ev({
      id: 'c_bully', type: 'causal', prio: 84,
      cond: function (g) { return g.age >= 18; },
      title: '人多的时候会紧张',
      text: '部门聚餐，轮到你敬酒，你忽然说不出话。那种被堵在楼道里的感觉又回来了。同事以为你只是内向，只有你知道，有些东西从小学一直带到了现在。',
      opts: [
        o('找心理咨询，认真处理', { money: { cash: -10000 }, at: { happiness: 5, stress: -5, charm: 3 }, set: { therapy: true }, tag: '为少年时的阴影做了心理咨询' }, { hint: '要花钱，也要面对' }),
        o('逼自己多社交', { at: { charm: 4, stress: 4, happiness: 1 }, rep: { society: 2 }, tag: '强迫自己多参加社交' }),
        o('减少社交，过自己的日子', { at: { happiness: 2, stress: -3, charm: -2 }, tag: '选择减少不必要的社交' })
      ]
    }),
    ev({
      id: 'c_leftbehind', type: 'causal', prio: 84,
      cond: function (g) { return g.age >= 20; },
      title: '和父母的距离',
      text: '母亲在电话里问你什么时候回家，你说最近忙。其实不是没时间，是不知道回去该聊什么。小时候被留在村里那几年，像一层看不见的膜，隔在你们中间。',
      opts: [
        o('请年假回去住几天', { money: { cash: -5000 }, at: { happiness: 4, stress: -4 }, npc: { '母亲': { favor: 10 }, '父亲': { favor: 6 } }, tag: '专门回老家陪了父母' }),
        o('寄点钱回去，人还是不回', { money: { cash: -8000 }, at: { happiness: -2 }, npc: { '母亲': { favor: 2 } }, tag: '给父母寄钱但很少回家' }),
        o('保持距离，各自安好', { at: { happiness: 1, stress: -2 }, npc: { '母亲': { favor: -8 }, '父亲': { favor: -6 } }, tag: '和父母一直保持着距离' })
      ]
    }),
    ev({
      id: 'c_stock', type: 'causal', prio: 85,
      cond: function (g) { return g.age >= 25; },
      title: '账户里的亏损',
      text: '你当年跟风买的股票已经跌去一半。群里有人说“补仓摊低成本”，也有人说“割肉离场”。你盯着手机上的曲线，想起那笔钱本来打算用来做什么。',
      opts: [
        o('割肉止损，认亏', { at: { stress: 2, happiness: -2, finance: 2 }, moneyPct: { assets: -0.35 }, set: { stopped_loss: true }, tag: '把亏损的股票卖了' }),
        o('补仓，等它涨回来', { money: { cash: -20000 }, at: { stress: 5, happiness: -2 }, flag: { event: 'c_stock2', delay: 4, mark: 'stock_debt', note: '不断补仓股票' }, tag: '在下跌中不断补仓' }, { hint: '可能越陷越深' }),
        o('卸载软件，不看了', { at: { stress: -2, happiness: 1 }, tag: '把股票软件卸载了' })
      ]
    }),
    ev({
      id: 'c_housegain', type: 'causal', prio: 82,
      cond: function (g) { return g.house.owned; },
      title: '房子涨了',
      text: '中介打电话来，说你那套房现在的挂牌价比买时高了不少，问要不要出手。妻子/丈夫算了一笔账，说卖了可以换套小的，剩下的钱做点别的。',
      opts: [
        o('卖掉，落袋为安', { houseSell: true, at: { stress: -3, happiness: 3 }, money: { cash: 20000 }, tag: '把升值的房子卖了' }, { hint: '一笔大额现金' }),
        o('继续持有，自住', { at: { happiness: 2, stress: 1 }, tag: '没有卖房，继续自住' }),
        o('抵押贷款，做别的投资', { money: { debt: 150000, cash: 150000 }, at: { stress: 7, finance: 3 }, flag: { event: 'c_leverage', delay: 4, mark: 'leveraged', note: '抵押房产加杠杆' }, tag: '把房子抵押了去做投资' }, { hint: '杠杆会放大风险' })
      ]
    }),
    ev({
      id: 'c_startupfail', type: 'causal', prio: 96,
      cond: function (g) { return g.stats.startupFail > 0; },
      title: '创业留下的债',
      text: '项目关了，办公室退租，合伙人各奔东西。供应商的货款还欠着，员工工资结了一半。手机里每天都有催款消息，你把号码一个个拉黑，又一个个放出来。',
      opts: [
        o('打工慢慢还债', { quitJob: true, job: { id: 'sales', level: 0 }, money: { cash: 10000 }, at: { stress: 6, happiness: -4 }, tag: '创业失败后打工还债' }),
        o('和债权人协商分期', { at: { stress: 3, happiness: -2, reputation: 2 }, rep: { society: 3 }, tag: '和债权人谈了分期还款' }),
        o('换个城市，重新开始', { money: { cash: -20000 }, at: { stress: 4, happiness: -3, health: -2 }, npc: { '母亲': { favor: -6 } }, tag: '创业失败后离开了原来的城市' })
      ]
    }),
    ev({
      id: 'c_mentor_return', type: 'causal', prio: 80,
      cond: function (g) { return g.age >= 30; },
      title: '当年帮过你的人',
      text: '一个很久没联系的前辈发来消息，说他现在有个项目，想找个信得过的人搭把手。你想起当年刚入行时，是他带你跑的第一个客户。',
      opts: [
        o('答应下来，认真做', { at: { finance: 5, stress: 4, reputation: 4 }, rep: { industry: 6 }, money: { cash: 30000 }, tag: '答应了前辈的合作邀请' }, { hint: '要投入精力' }),
        o('请他吃饭，暂时不参与', { money: { cash: -3000 }, at: { happiness: 2, reputation: 2 }, rep: { society: 2 }, tag: '婉拒了前辈的合作，但保持了联系' }),
        o('装作没空，不再往来', { at: { happiness: -1, reputation: -2 }, rep: { industry: -3 }, tag: '和当年的贵人断了联系' })
      ]
    }),
    ev({
      id: 'c_debtcollect', type: 'causal', prio: 98, urgent: true,
      cond: function (g) { return g.money.debt > 80000; },
      title: '催收电话',
      text: '银行的催收电话从每周一次变成每天一次。短信里写着逾期记录会影响征信，语气客气但不容商量。你翻遍账户，发现能动用的钱只够还一部分。',
      opts: [
        o('先还最低，保住征信', { money: { cash: -30000, debt: -25000 }, at: { stress: 4, happiness: -3 }, tag: '为了保住征信先还了一部分' }),
        o('和银行协商延期', { at: { stress: -3, happiness: -1 }, rep: { society: -2 }, set: { debt_rescheduled: true }, tag: '和银行谈了延期还款' }),
        o('找亲友周转', { money: { cash: 30000, debt: 20000 }, npc: { '母亲': { favor: -8 }, '朋友': { favor: -5 } }, at: { stress: 2, happiness: -2 }, tag: '向亲友借钱周转' })
      ]
    }),
    ev({
      id: 'c_hospital', type: 'causal', prio: 99, urgent: true,
      cond: function (g) { return g.attrs.health < 30; },
      title: '住院',
      text: '身体终于撑不住了。你在会议上眼前一黑，醒来时已经在医院。医生要求住院观察，押金先交一万。工作群还在跳消息，你把手机扣在床头柜上。',
      opts: [
        o('住院治疗，工作先放一边', { money: { cash: -20000 }, at: { health: 12, stress: -6, happiness: -2 }, tag: '因为身体垮了住进医院' }, { hint: '一大笔医疗费' }),
        o('住两天就出院，回去上班', { money: { cash: -6000 }, at: { health: 3, stress: 6 }, rep: { industry: 2 }, tag: '住院没住满就回去上班' }),
        o('请长假，彻底休养', { quitJob: true, money: { cash: -10000 }, at: { health: 15, stress: -10, happiness: 3 }, tag: '辞了工作回家休养' }, { hint: '收入中断' })
      ]
    }),
    ev({
      id: 'c_breakdown', type: 'causal', prio: 99, urgent: true,
      cond: function (g) { return g.attrs.stress > 85; },
      title: '撑不住了',
      text: '你开始整夜睡不着，白天靠咖啡硬撑。开会时听不进别人说话，回家路上会突然想哭。心理热线打了三次没接通，你在楼道里坐了很久。',
      opts: [
        o('去看医生，接受治疗', { money: { cash: -12000 }, at: { stress: -20, happiness: 8, health: 3 }, set: { therapy: true }, tag: '压力过大后去看了医生' }, { hint: '需要花钱，也需要时间' }),
        o('请一段长假，离开工作', { money: { cash: -15000 }, at: { stress: -15, happiness: 5, health: 2 }, rep: { industry: -3 }, tag: '压力过大时请了长假' }),
        o('硬扛，觉得熬过去就好', { at: { stress: 5, happiness: -8, health: -8 }, flag: { event: 'c_depression', delay: 2, mark: 'mental_issue', note: '长期硬扛心理压力' }, tag: '压力大到极限仍然硬扛' })
      ]
    }),
    ev({
      id: 'c_depression', type: 'causal', prio: 98, urgent: true,
      cond: function (g) { return g.attrs.happiness < 22; },
      title: '高兴不起来',
      text: '没有什么特别的事发生，但你对什么都提不起兴趣。饭照吃，班照上，话越来越少。朋友约你出去，你编了个理由推掉。夜里醒着的时候，觉得时间过得很慢。',
      opts: [
        o('正视它，去看心理门诊', { money: { cash: -15000 }, at: { happiness: 12, stress: -10, health: 3 }, set: { therapy: true }, tag: '情绪跌到谷底后接受了治疗' }),
        o('跟信任的人聊聊', { at: { happiness: 6, stress: -6 }, npc: { '朋友': { favor: 6 }, '母亲': { favor: 4 } }, tag: '情绪低落时找了人倾诉' }),
        o('不说，自己熬着', { at: { happiness: -5, health: -4, stress: 4 }, flag: { event: 'c_depression2', delay: 3, mark: 'deep_depression', note: '长期抑郁没有干预' }, tag: '一直没对任何人说自己不好' })
      ]
    }),
    ev({
      id: 'c_marriage_crisis', type: 'causal', prio: 96, urgent: true,
      cond: function (g) { var s = spouseOf(g); return married(g) && s && s.alive && s.favor < 28; },
      title: '婚姻里的沉默',
      text: '你们已经很久没有认真说过话了。饭桌上各看各的手机，孩子的事说两句就吵。对方提出“要不分开一段时间”，你一时分不清是气话还是决定。',
      opts: [
        gamble('坐下来好好谈', function (g) { return LS.clamp(0.35 + g.attrs.charm / 220 + g.attrs.happiness / 300, 0.25, 0.8); },
          { npc: { '配偶': { favor: 15 } }, at: { happiness: 6, stress: -6 }, tag: '婚姻危机被谈开了' },
          { npc: { '配偶': { favor: -5 } }, at: { happiness: -5, stress: 5 }, tag: '婚姻危机没有谈拢' },
          '话说开了，两个人都退了一步。', '越谈越僵，最后不欢而散。', '沟通不一定有结果'),
        o('先分居，冷静一段时间', { money: { cash: -20000 }, at: { happiness: -6, stress: 4 }, npc: { '配偶': { favor: -8 } }, tag: '和配偶分居了一段时间' }),
        o('同意离婚，把话说清楚', { divorce: true, money: { cash: -50000 }, at: { happiness: -10, stress: 8 }, tag: '婚姻走到了离婚' }, { hint: '财产和关系都要分割' })
      ]
    }),
    ev({
      id: 'c_parent_sick', type: 'causal', prio: 95,
      cond: parentSick,
      title: '父母的身体',
      text: '母亲打电话来，声音压得很低，说父亲最近吃不下饭，让她别告诉你。你追问了几句，她才说已经去过镇上的诊所，医生建议去市里查。',
      opts: [
        o('马上接来大医院检查', { money: { cash: -30000 }, at: { stress: 5 }, npc: { '父亲': { health: 10, favor: 8 }, '母亲': { favor: 6 } }, tag: '把父母接到大医院检查' }),
        o('先寄钱，让老家亲戚陪着去', { money: { cash: -12000 }, at: { happiness: -3 }, npc: { '父亲': { favor: 3 }, '母亲': { favor: 2 } }, tag: '给父母寄钱看病' }),
        o('等忙完这阵再回去', { at: { happiness: -5, stress: 4 }, npc: { '父亲': { favor: -10 }, '母亲': { favor: -8 } }, tag: '父母生病时没能及时回去' })
      ]
    }),
    ev({
      id: 'c_child_rebel', type: 'causal', prio: 92,
      cond: function (g) { return childInAge(g, 12, 18) && (firstChild(g) ? firstChild(g).favor < 35 : false); },
      title: '孩子不听话了',
      text: '孩子把房门关得很响，说“你根本不懂”。你站在门外，想起自己当年也是这样对父母说话的。成绩单在桌上，几门课都亮了红灯。',
      opts: [
        o('放下架子，认真聊一次', { at: { happiness: 3, stress: 2 }, npc: { '子女': { favor: 12 } }, tag: '和孩子认真谈了一次' }),
        o('报更贵的补习班，用成绩说话', { money: { cash: -25000 }, at: { stress: 5, happiness: -2 }, npc: { '子女': { favor: -6 } }, tag: '用补习班解决孩子的问题' }, { hint: '花钱不一定有效' }),
        o('先不管，让他自己撞南墙', { at: { happiness: -3 }, npc: { '子女': { favor: -10 } }, tag: '对孩子的叛逆选择了放手' })
      ]
    }),
    ev({
      id: 'c_conflict', type: 'causal', prio: 90,
      cond: anyNpcLow,
      title: '关系降到冰点',
      text: '你和一个人的关系已经很久没有缓和了。见面时客气得像陌生人，背后却都有一肚子话。共同的朋友传话说，对方觉得你“变了”。',
      opts: [
        o('主动低头，把话说开', { at: { stress: -3, happiness: 2, charm: 2 }, npc: { '朋友': { favor: 12 }, '同事': { favor: 8 } }, tag: '主动修复了一段破裂的关系' }),
        o('各过各的，不再往来', { at: { stress: -2, happiness: 1, reputation: -2 }, rep: { society: -2 }, tag: '和一段关系彻底断了' }),
        o('找中间人调解', { money: { cash: -3000 }, at: { stress: -1, happiness: 1 }, npc: { '朋友': { favor: 6 } }, tag: '托人调解了关系矛盾' })
      ]
    }),
    ev({
      id: 'c_public', type: 'causal', prio: 86,
      cond: function (g) { return LS.repTotal(g) > 65; },
      title: '被议论',
      text: '你在本地行业里有了点名气，随之而来的是各种说法。有人把你几年前的一段话截图发到群里，配上“看看这人”。朋友问你要不要回应，你盯着屏幕想了很久。',
      opts: [
        o('公开回应，把事实说清楚', { at: { stress: 5, reputation: 2 }, rep: { society: 3, industry: 2 }, tag: '面对议论选择了公开回应' }),
        o('不回应，让时间过去', { at: { stress: 2, happiness: -2 }, rep: { society: -2 }, tag: '面对议论选择了沉默' }),
        o('找关系把帖子压下去', { money: { cash: -20000 }, at: { stress: 3, reputation: -4 }, rep: { society: -5 }, tag: '托关系处理了负面议论' }, { hint: '花钱，也可能留下把柄' })
      ]
    }),
    ev({
      id: 'c_headhunt', type: 'causal', prio: 88,
      cond: function (g) { return g.age >= 30 && g.age <= 48 && g.attrs.knowledge > 80 && hasJob(g); },
      title: '猎头的电话',
      text: '一个陌生号码打进来，对方说在行业内看过你的项目，问你有没有兴趣换个平台。开出的薪资比现在高四成，但要去另一个城市，试用期六个月。',
      opts: [
        o('接受，去更大的平台', { job: { id: 'engineer', level: 2 }, money: { cash: 10000 }, at: { stress: 5, happiness: 3, reputation: 4 }, rep: { industry: 6 }, tag: '接受猎头邀请换了平台' }, { hint: '要离开熟悉的环境' }),
        o('拿这个 offer 和现单位谈涨薪', { salaryPct: 0.18, at: { stress: 3, reputation: 2 }, rep: { industry: 2 }, tag: '用猎头 offer 谈成了涨薪' }),
        o('拒绝，稳定更重要', { at: { happiness: 2, stress: -2 }, tag: '拒绝了猎头的邀请' })
      ]
    }),
    ev({
      id: 'c_layoff35', type: 'causal', prio: 93,
      cond: function (g) { return g.age >= 33 && g.age <= 48 && g.edu.level <= 3 && hasJob(g); },
      title: '学历的门槛',
      text: '公司换了新的人力系统，晋升和调岗都开始卡学历。你的经验足够，但表格里“本科及以上”那一栏始终填不上。领导说“再等等”，你知道等的意思。',
      opts: [
        o('报成人本科，把学历补上', { money: { cash: -15000 }, at: { knowledge: 3, stress: 4, happiness: 1 }, eduUp: true, tag: '报了成人本科补学历' }, { hint: '边工作边读书' }),
        o('靠经验找不卡学历的公司', { quitJob: true, job: { id: 'sales', level: 1 }, at: { stress: 4, finance: 1 }, tag: '因为学历换了家公司' }),
        o('留在原岗位，接受不再晋升', { at: { happiness: -3, stress: -2 }, tag: '因为学历放弃了晋升' })
      ]
    }),
    ev({
      id: 'c_job_hunt', type: 'causal', prio: 92, repeatable: true, cooldown: 2,
      cond: function (g) { return !g.job.id && !g.marks.retired && g.age >= 21 && g.age <= 52; },
      title: '找工作',
      text: '招聘软件上的岗位大多已读不回。你把简历里的项目经历改得更具体，又投了十几家。下午有一场群面，等候区坐满了和你年纪差不多的人，没人说话，都在看手机。',
      opts: [
        gamble('认真准备，冲一冲大公司', function (g) {
          return LS.clamp(0.16 + g.attrs.knowledge / 190 + g.edu.level * 0.035 + LS.repTotal(g) / 900, 0.08, 0.8);
        },
          { job: { id: 'engineer', level: 1 }, at: { stress: 5, finance: 3, happiness: 4 }, tag: '进了大公司做技术' },
          { job: { id: 'sales', level: 0 }, at: { stress: 3, happiness: -3 }, tag: '大公司没进，先做了销售' },
          '终面过了，薪资比预期低一点。', '二面之后就没有消息了。', '学历和项目都算数'),
        gamble('考公考编，再试一次', function (g) {
          return LS.clamp(0.08 + g.attrs.knowledge / 230 + (g.marks.exam_civil ? 0.08 : 0), 0.05, 0.62);
        },
          { job: { id: 'civil', level: 0 }, at: { happiness: 6, stress: -2, reputation: 3 }, rep: { society: 4 }, tag: '考上了编制' },
          { at: { happiness: -5, stress: 4 }, tag: '又没考上，继续找别的工作' },
          '公示名单里有你的名字。', '笔试过了，面试还是差一点。', '稳定，但门槛高'),
        o('先做零工，边干边找', { job: { id: 'gig', level: 0 }, money: { cash: 4000 }, at: { health: -3, stress: 2 }, tag: '先做零工过渡' }),
        o('托熟人内推', { at: { stress: 2, happiness: 2 }, npc: { '朋友': { favor: -3 }, '同学': { favor: -3 } }, job: { id: 'stateowned', level: 0 }, tag: '托熟人内推进了国企' }, { hint: '会欠下人情' })
      ]
    }),
    ev({
      id: 'c_unemployed', type: 'causal', prio: 96, urgent: true, repeatable: true, cooldown: 3,
      cond: function (g) { return g.age >= 23 && g.age <= 55 && !g.job.id && (g.money.cash < 20000 || g.money.debt > 30000); },
      title: '待业的日子',
      text: '简历投出去几十份，回音越来越少。房租快到期，社保断缴的提醒也来了。你开始怀疑是不是简历写得不对，又改了一遍，还是没人看。',
      opts: [
        o('先干零工，把现金流接上', { job: { id: 'gig', level: 0 }, money: { cash: 5000 }, at: { health: -4, stress: 3, happiness: -2 }, tag: '待业期间先做零工' }),
        o('降低要求，去小公司', { job: { id: 'sales', level: 0 }, at: { stress: 3, happiness: -1 }, tag: '降低要求去了小公司' }),
        o('借钱撑一段时间，继续找', { money: { cash: 15000, debt: 15000 }, at: { stress: 6, happiness: -4 }, tag: '待业时靠借钱撑着' }, { hint: '负债会增加' })
      ]
    }),
    ev({
      id: 'c_civil_tempt', type: 'causal', prio: 90,
      cond: function (g) { return g.job.id === 'civil' && g.age >= 35; },
      title: '一份“心意”',
      text: '有人把一张卡塞进你的抽屉，说是“过节的心意”，事情不大，签个字就行。你把抽屉关上，手心有点出汗。办公室里没有人看见，但你知道这件事不会只有一次。',
      opts: [
        o('退回去，把话说清楚', { at: { stress: 3, reputation: 3 }, rep: { society: 4 }, tag: '退回了不该收的东西' }),
        o('收下，帮他办这件小事', { money: { cash: 20000 }, at: { stress: 6, happiness: -3, reputation: -2 }, flag: { event: 'c_corruption', delay: 5, mark: 'took_bribe', note: '收过一次不该收的钱' }, tag: '收下了一笔不该收的钱' }, { hint: '风险会延迟到来' }),
        o('装作没看见，把卡留在原处', { at: { stress: 2, reputation: 1 }, tag: '对抽屉里的卡装作没看见' })
      ]
    }),
    ev({
      id: 'c_teacher_tutor', type: 'causal', prio: 86,
      cond: function (g) { return g.job.id === 'teacher'; },
      title: '补课的诱惑',
      text: '家长在微信上问能不能“单独辅导”，一小时两百，现金结算。学校刚开过会，明令禁止有偿补课。你算了一笔账，这笔钱抵得上大半个月工资。',
      opts: [
        o('不补，守住规矩', { at: { happiness: 1, reputation: 3 }, rep: { school: 3, society: 2 }, tag: '拒绝了有偿补课' }),
        o('偷偷补几个学生', { money: { cash: 30000 }, at: { stress: 5, health: -2, reputation: -2 }, flag: { event: 'c_tutor_exposed', delay: 4, mark: 'illegal_tutor', note: '违规有偿补课' }, tag: '私下给学生补了课' }, { hint: '收入不少，但有风险' }),
        o('辞去公职，去培训机构', { quitJob: true, job: { id: 'teacher', level: 1 }, salaryPct: 0.3, at: { stress: 3, happiness: 2 }, tag: '离开公办学校去了培训机构' })
      ]
    }),
    ev({
      id: 'c_doctor_dispute', type: 'causal', prio: 88,
      cond: function (g) { return g.job.id === 'doctor'; },
      title: '医患纠纷',
      text: '一位病人的家属在办公室拍了桌子，说治疗方案有问题，要求赔偿。病历和知情同意书都在，但对方不听解释。科室主任让你先回避，医务科介入了调查。',
      opts: [
        o('配合调查，走正规流程', { at: { stress: 6, happiness: -3, reputation: 2 }, rep: { industry: 3 }, tag: '经历了一次医患纠纷' }),
        o('私下赔钱了事', { money: { cash: -30000 }, at: { stress: -2, reputation: -3 }, rep: { society: -2 }, tag: '私下赔钱解决了医患纠纷' }, { hint: '花钱换太平' }),
        o('心累了，考虑转行', { quitJob: true, job: { id: 'sales', level: 0 }, at: { happiness: -4, stress: 2 }, tag: '因为医患纠纷离开了临床' })
      ]
    }),
    ev({
      id: 'c_freelance_dry', type: 'causal', prio: 90,
      cond: function (g) { return g.job.id === 'freelance' && g.age >= 30; },
      title: '接不到单了',
      text: '连续两个月没有新项目，老客户的预算也砍了。你在几个平台上刷新消息，报价一降再降。社保要自己交，房租不会等你。自由职业的自由，忽然变得很贵。',
      opts: [
        o('降价接单，先活下来', { money: { cash: 20000 }, at: { stress: 6, health: -3, happiness: -3 }, tag: '自由职业接不到单，降价求生' }),
        o('转型做培训/内容', { money: { cash: -5000 }, at: { knowledge: 4, reputation: 4, stress: 3 }, rep: { industry: 4 }, tag: '自由职业转型做内容和培训' }),
        o('回去上班，图个稳定', { job: { id: 'stateowned', level: 0 }, at: { stress: -3, happiness: 2 }, tag: '自由职业做不下去，回去上班' })
      ]
    }),
    ev({
      id: 'c_startup_tension', type: 'causal', prio: 92,
      cond: function (g) { return g.job.id === 'startup'; },
      title: '合伙人分歧',
      text: '公司账上的钱只够三个月。你想继续投入，合伙人想止损退出。会议从下午开到晚上，白板上写满了数字，谁也没说服谁。最后有人说了一句“要不散了吧”。',
      opts: [
        o('借钱继续撑', { money: { cash: 50000, debt: 80000 }, at: { stress: 10, happiness: -2 }, flag: { event: 'c_startupfail2', delay: 2, mark: 'startup_strain', note: '创业公司资金链紧张' }, tag: '创业公司资金紧张，借钱硬撑' }, { hint: '债务风险' }),
        o('卖掉股份，及时退出', { money: { cash: 40000 }, at: { stress: -4, happiness: 2 }, quitJob: true, job: { id: 'stateowned', level: 0 }, statsStartupFail: true, tag: '在创业分歧中卖掉了股份' }),
        o('和合伙人拆伙，各做各的', { money: { cash: -20000 }, at: { stress: 6, happiness: -2 }, rep: { industry: -3 }, tag: '和创业合伙人拆了伙' })
      ]
    }),
    ev({
      id: 'c_child_gaokao', type: 'causal', prio: 96,
      cond: function (g) { return childInAge(g, 17, 19); },
      title: '孩子高考',
      text: '孩子高考那两天，你在考场外站了很久。太阳很大，家长们都拎着水和小板凳。你想起自己当年高考时的样子，忽然觉得时间过得比想象中快。',
      opts: [
        o('全力支持，补课钱不省', { money: { cash: -25000 }, at: { stress: 4, happiness: 2 }, npc: { '子女': { favor: 10 } }, tag: '孩子高考时全力支持' }, { hint: '一笔教育投入' }),
        o('不给压力，正常发挥就好', { at: { happiness: 4, stress: -2 }, npc: { '子女': { favor: 6 } }, tag: '孩子高考时没有施加压力' }),
        o('把希望压在他身上，话说重了', { at: { stress: 5, happiness: -3 }, npc: { '子女': { favor: -10 } }, tag: '孩子高考时说了重话' })
      ]
    }),
    ev({
      id: 'c_childless_old', type: 'causal', prio: 88,
      cond: function (g) { return g.age >= 65 && g.family.childrenIds.length === 0; },
      title: '没有子女的晚年',
      text: '社区登记紧急联系人，你在表格前停了很久。最后填了外甥的电话，又划掉，改成自己的。工作人员抬头看了你一眼，什么也没问。',
      opts: [
        o('提前安排机构养老', { money: { cash: -50000 }, at: { stress: -4, happiness: 1 }, set: { nursing_home: true }, tag: '提前为自己的养老做了安排' }),
        o('多和侄辈、朋友走动', { money: { cash: -5000 }, at: { happiness: 5, stress: -3 }, npc: { '朋友': { favor: 8 } }, tag: '晚年靠朋友和侄辈走动' }),
        o('顺其自然，过一天算一天', { at: { happiness: 2, stress: 2 }, tag: '对晚年没有做太多安排' })
      ]
    }),
    ev({
      id: 'c_bankrupt', type: 'causal', prio: 99, urgent: true, repeatable: true, cooldown: 5,
      cond: function (g) { return g.money.debt > 120000 && g.money.cash < 8000; },
      title: '债务压顶',
      text: '所有账户加起来不够还这个月的利息。催收电话打到了单位，也打给了你的家人。你坐在银行大厅的塑料椅上，看着叫号屏幕，第一次认真考虑“破产”这两个字。',
      opts: [
        o('和所有债权人谈重组', { at: { stress: 4, happiness: -4 }, rep: { society: -3 }, moneyPct: { debt: -0.35 }, set: { debt_restructure: true }, tag: '和债权人谈了债务重组' }),
        o('卖房还债', { houseSell: true, at: { stress: -6, happiness: -6 }, tag: '卖房还债' }, { hint: '要失去住所' }),
        o('向父母开口', { money: { cash: 50000, debt: -60000 }, npc: { '母亲': { favor: -15 }, '父亲': { favor: -12 } }, at: { happiness: -5, stress: 3 }, tag: '走投无路时向父母开了口' })
      ]
    }),
    ev({
      id: 'c_relative_borrow', type: 'causal', prio: 84,
      cond: function (g) { return g.age >= 30 && g.money.cash > 300000; },
      title: '亲戚来借钱',
      text: '表弟提着水果上门，坐下先聊了半小时家常，最后说想借二十万周转，半年就还。你想起他前几年做过几次生意，都没成。母亲在旁边打圆场，说“都是一家人”。',
      opts: [
        o('借，写个借条', { money: { cash: -200000 }, at: { stress: 3, happiness: -1 }, npc: { '母亲': { favor: 4 } }, flag: { event: 'c_promise', delay: 4, mark: 'lent_relative', note: '借给亲戚一笔钱' }, tag: '借给亲戚二十万' }, { hint: '一笔大额支出' }),
        o('借一小部分，说明难处', { money: { cash: -30000 }, at: { stress: 1, happiness: 1 }, npc: { '母亲': { favor: 1 } }, tag: '只借给亲戚一小部分' }),
        o('婉拒，建议他去银行贷款', { at: { happiness: -2, reputation: -1 }, npc: { '母亲': { favor: -4 } }, tag: '婉拒了亲戚的借钱请求' })
      ]
    }),
    ev({
      id: 'c_oldlove', type: 'causal', prio: 80,
      cond: function (g) { return g.age >= 40 && g.age <= 58 && !!g.marks.firstlove; },
      title: '旧人重逢',
      text: '同学群里有人发了聚会的照片，你在角落里看见了当年那个同桌。有人私信问你，要不要单独约出来喝杯茶。你看着通讯录里的名字，想了很久。',
      opts: [
        o('见一面，把当年的话说完', { at: { happiness: 5, stress: 3 }, set: { met_oldlove: true }, tag: '中年时又见了当年的同桌' }, { hint: '可能会影响现在的关系' }),
        o('只回一句“都挺好的”', { at: { happiness: 1, stress: -1 }, tag: '和当年的同桌只寒暄了一句' }),
        o('不回复，把页面关掉', { at: { happiness: -2, stress: -1 }, tag: '没有回复旧人的消息' })
      ]
    }),
    ev({
      id: 'c_health_check', type: 'causal', prio: 93,
      cond: function (g) { return g.age >= 45 && g.attrs.health < 58; },
      title: '该复查了',
      text: '几年前体检的异常指标一直没管。最近爬两层楼就喘，夜里偶尔心慌。社区卫生站打电话来提醒建档，你才发现上一次体检已经是好几年前。',
      opts: [
        o('做一次全面检查', { money: { cash: -10000 }, at: { health: 4, stress: 2 }, set: { health_checked: true }, tag: '中年做了一次全面体检' }),
        o('先改生活习惯', { at: { health: 5, stress: -2, happiness: -1 }, tag: '开始控制饮食和运动' }),
        o('继续拖，反正没大感觉', { at: { health: -6, stress: 3 }, flag: { event: 'c_hospital', delay: 3, mark: 'delay_treatment', note: '身体问题一直拖着' }, tag: '身体不舒服一直拖着没查' })
      ]
    }),
    ev({
      id: 'c_gig_injury', type: 'causal', prio: 92,
      cond: function (g) { return g.job.id === 'gig'; },
      title: '工伤',
      text: '在工地上被掉下来的钢管砸到脚，去医院拍片说是骨裂。包工头给了两千块，说“先回家养着，好了再来”。你没有合同，也没有社保。',
      opts: [
        o('自己掏钱治，认倒霉', { money: { cash: -8000 }, at: { health: 3, happiness: -4, stress: 4 }, tag: '工伤后自己掏钱治疗' }),
        o('找包工头讨说法', { at: { stress: 6, happiness: -2, reputation: 2 }, rep: { society: 2 }, money: { cash: 3000 }, tag: '为工伤和包工头理论' }),
        o('换一份更安全的活', { job: { id: 'sales', level: 0 }, at: { health: 2, happiness: 1, stress: -2 }, tag: '工伤后换了份工作' })
      ]
    }),
    ev({
      id: 'c_inflation_pressure', type: 'causal', prio: 88,
      cond: function (g) { return g.age >= 55 && g.money.cash < 30000; },
      title: '钱不经花了',
      text: '去一趟菜市场，同样的东西比去年贵了不少。退休金涨了一点，但水电、药费、人情往来都在涨。你把想买的东西放回货架，假装只是忘了。',
      opts: [
        o('记账，压缩开支', { at: { happiness: -2, stress: -2 }, money: { cash: 5000 }, tag: '年纪大了开始精打细算' }),
        o('找点零活补贴家用', { money: { cash: 12000 }, at: { health: -4, stress: 3 }, tag: '上了年纪还在打零工' }),
        o('向子女开口', { money: { cash: 15000 }, at: { happiness: -4 }, npc: { '子女': { favor: -4 } }, tag: '晚年向子女要过钱' })
      ]
    }),
    ev({
      id: 'c_depression2', type: 'causal', prio: 97, urgent: true,
      cond: function (g) { return g.attrs.happiness < 18; },
      title: '看不见底',
      text: '情况没有变好。你开始回避所有需要说话的场合，连最亲近的人也觉得远。有一天你在阳台上站了很久，风很冷，楼下有人喊孩子回家吃饭。',
      opts: [
        o('住院接受系统治疗', { money: { cash: -30000 }, at: { happiness: 14, stress: -12, health: 4 }, set: { therapy: true }, tag: '情绪问题严重时住了院' }, { hint: '需要一笔费用' }),
        o('搬到亲人附近，让人陪着', { money: { cash: -10000 }, at: { happiness: 7, stress: -6 }, npc: { '母亲': { favor: 5 } }, tag: '情绪最差的时候搬去和亲人住' }),
        o('谁都不说，继续撑着', { at: { happiness: -4, health: -3, stress: 3 }, tag: '情绪问题一直一个人扛' })
      ]
    }),
    ev({
      id: 'c_liver', type: 'causal', prio: 95,
      cond: function (g) { return g.age >= 32; },
      title: '肝的警告',
      text: '转氨酶高得离谱，医生要求立刻停掉所有保健品，住院观察。你想起那些凌晨两点的夜、酒桌上的杯子，还有抽屉里越吃越多的护肝片。',
      opts: [
        o('住院，彻底停下来', { money: { cash: -25000 }, at: { health: 10, stress: -6 }, quitJob: true, tag: '因为肝指标住院并停了工作' }, { hint: '收入会中断' }),
        o('吃药控制，工作照旧', { money: { cash: -6000 }, at: { health: -3, stress: 5 }, tag: '肝指标异常但工作照旧' }),
        o('辞职休养半年', { quitJob: true, money: { cash: -15000 }, at: { health: 12, stress: -10, happiness: 2 }, tag: '为养肝辞职休养了半年' })
      ]
    }),
    ev({
      id: 'c_lung', type: 'causal', prio: 94,
      cond: function (g) { return g.age >= 35; },
      title: '复查结果',
      text: '拖了几年的肺结节这次变大了。医生建议做进一步检查，语气比上次严肃。你在医院走廊里坐了一会儿，给家里人打了个电话，只说“没什么大事”。',
      opts: [
        o('马上住院检查', { money: { cash: -40000 }, at: { health: 6, stress: 6, happiness: -4 }, tag: '肺结节变大后住院检查' }, { hint: '费用不小' }),
        o('先观察，定期复查', { money: { cash: -8000 }, at: { health: -2, stress: 3 }, tag: '肺结节选择继续观察' }),
        o('不查了，听天由命', { at: { health: -10, stress: 4, happiness: -3 }, fatal: 0.08, tag: '放弃了对肺结节的检查' })
      ]
    }),
    ev({
      id: 'c_back', type: 'causal', prio: 90,
      cond: function (g) { return g.age >= 30; },
      title: '腰突复发',
      text: '一个弯腰的动作，腰像被电了一下。你扶着桌子站了很久才缓过来。医生说这次比上次严重，建议手术，也可以保守治疗，但不能再久坐。',
      opts: [
        o('做手术，一次性解决', { money: { cash: -30000 }, at: { health: 8, stress: 4, happiness: -2 }, tag: '为腰椎做了手术' }, { hint: '一笔医疗支出' }),
        o('保守治疗，改变工作方式', { money: { cash: -8000 }, at: { health: 3, stress: -3, happiness: 1 }, tag: '腰椎问题改为保守治疗' }),
        o('忍一忍，贴膏药', { at: { health: -5, stress: 2 }, tag: '腰疼一直靠膏药撑着' })
      ]
    }),
    ev({
      id: 'c_stock2', type: 'causal', prio: 92,
      cond: function (g) { return g.age >= 28; },
      title: '越补越亏',
      text: '补仓的钱又被套住了。账户里的数字让你不敢打开软件，但每天还是会点进去看。妻子/丈夫问起这笔钱，你说“再等等就回本”。',
      opts: [
        o('全部清仓，认亏离场', { at: { stress: -4, happiness: -2, finance: 3 }, moneyPct: { assets: -0.4 }, set: { stopped_loss: true }, tag: '最终清仓离开了股市' }),
        o('继续等，不服气', { at: { stress: 6, happiness: -4 }, money: { cash: -10000 }, tag: '股票越套越深，仍不肯离场' }),
        o('把账户交给家人管', { at: { stress: -3, happiness: 1 }, npc: { '配偶': { favor: 3 } }, tag: '把股票账户交给家人管理' })
      ]
    }),
    ev({
      id: 'c_quack', type: 'causal', prio: 93,
      cond: function (g) { return g.age >= 55; },
      title: '保健品',
      text: '小区里来了个“健康讲座”，送鸡蛋和面条，讲课的人穿白大褂，说他们的产品能“调理三高”。你去了三次，最后花八千八买了一个疗程。',
      opts: [
        o('停了，去正规医院开药', { money: { cash: -5000 }, at: { health: 4, stress: -2, happiness: -1 }, tag: '停掉保健品，改去正规医院' }),
        o('继续吃，感觉有效', { money: { cash: -12000 }, at: { health: -4, happiness: 2 }, tag: '继续买保健品' }),
        o('让子女帮忙看看成分', { at: { happiness: 2, stress: -1 }, npc: { '子女': { favor: 3 } }, tag: '让子女帮忙鉴别保健品' })
      ]
    }),
    ev({
      id: 'c_corruption', type: 'causal', prio: 98, urgent: true,
      cond: function (g) { return !!g.marks.took_bribe; },
      title: '调查来了',
      text: '单位开始核查几年前的几个项目，有人被叫去谈话。你想起那张卡和签过的字，细节像潮水一样涌回来。手机响的时候，你会先看一眼来电号码。',
      opts: [
        o('主动说明情况，退赃', { money: { cash: -30000 }, at: { stress: 10, happiness: -6, reputation: -5 }, rep: { society: -8 }, quitJob: true, tag: '主动交代并退回了那笔钱' }),
        o('找人打听，想办法压下去', { money: { cash: -40000 }, at: { stress: 8, happiness: -4 }, flag: { event: 'c_corruption2', delay: 2, mark: 'coverup', note: '试图掩盖收钱的事' }, tag: '试图托关系掩盖问题' }, { hint: '可能越陷越深' }),
        o('什么都不做，等着', { at: { stress: 12, happiness: -8 }, rep: { society: -4 }, tag: '问题发酵时选择了沉默等待' })
      ]
    }),
    ev({
      id: 'c_corruption2', type: 'causal', prio: 99, urgent: true,
      cond: function (g) { return !!g.marks.coverup; },
      title: '纸包不住火',
      text: '调查组找上门，谈话从上午持续到下午。你曾经托的人先一步撇清了关系。走出办公楼时，天已经黑了，门口有同事在假装打电话。',
      opts: [
        o('如实交代，争取从轻', { at: { stress: 8, happiness: -8, reputation: -8 }, rep: { society: -10 }, quitJob: true, tag: '最终如实交代了问题' }),
        o('继续否认', { at: { stress: 10, happiness: -5, reputation: -10 }, rep: { society: -12 }, quitJob: true, tag: '在调查中一直否认' }),
        o('辞职离开这个城市', { quitJob: true, money: { cash: -20000 }, at: { stress: 6, happiness: -4, health: -3 }, npc: { '母亲': { favor: -5 } }, tag: '出了问题后离开原来的城市' })
      ]
    }),
    ev({
      id: 'c_tutor_exposed', type: 'causal', prio: 95,
      cond: function (g) { return !!g.marks.illegal_tutor; },
      title: '补课被举报',
      text: '家长群里有人把补课记录发给了教育局。学校找你谈话，要求写检查，退回收取的费用。你坐在办公室里，看着窗外来接孩子的家长，觉得很累。',
      opts: [
        o('认罚，退回补课费', { money: { cash: -20000 }, at: { stress: 5, happiness: -4, reputation: -3 }, rep: { school: -4 }, tag: '补课被举报后退回了费用' }),
        o('和学校争取，保住岗位', { at: { stress: 8, happiness: -3 }, rep: { school: -6 }, tag: '补课被举报后仍想保住岗位' }),
        o('辞职，去民办机构', { quitJob: true, job: { id: 'teacher', level: 1 }, salaryPct: 0.15, at: { stress: 2, happiness: 1 }, tag: '补课被举报后辞职去了民办机构' })
      ]
    }),
    ev({
      id: 'c_startupfail2', type: 'causal', prio: 97,
      cond: function (g) { return !!g.marks.startup_strain; },
      title: '资金链断了',
      text: '员工工资发不出来，办公室房东来催租，供应商停止发货。你把最后一点钱转进公司账户，还是差一大截。合伙人说，到此为止吧。',
      opts: [
        o('宣布关停，遣散员工', { quitJob: true, job: { id: 'sales', level: 0 }, money: { cash: -20000 }, at: { stress: 8, happiness: -8 }, statsStartupFail: true, tag: '创业公司资金链断裂后关停' }),
        o('再借一笔，最后一搏', { money: { cash: 80000, debt: 100000 }, at: { stress: 12, happiness: -3 }, flag: { event: 'c_bankrupt', delay: 2, mark: 'desperate_loan', note: '创业失败前又借了一大笔钱' }, tag: '创业资金链断裂后仍借钱硬撑' }, { hint: '负债会迅速扩大' }),
        o('把公司低价转让', { quitJob: true, job: { id: 'stateowned', level: 0 }, money: { cash: 30000 }, at: { stress: -4, happiness: -6 }, statsStartupFail: true, tag: '创业失败后把公司低价转让' })
      ]
    }),
    ev({
      id: 'c_promise2', type: 'causal', prio: 94,
      cond: function (g) { return !!g.marks.lent_relative; },
      title: '借出去的钱',
      text: '半年早就过去了，表弟没有提还钱的事。你在家族群里看见他换了新手机，又发了一张自驾游的照片。母亲说“再等等”，你知道这笔钱大概率回不来了。',
      opts: [
        o('直接开口要', { money: { cash: 100000 }, at: { stress: 4, happiness: -3 }, npc: { '母亲': { favor: -3 } }, tag: '开口向亲戚要回了部分借款' }),
        o('算了，当买个教训', { at: { stress: 1, happiness: -4 }, npc: { '母亲': { favor: 2 } }, tag: '借给亲戚的钱最终没要回来' }),
        o('在家族群里把话说开', { at: { stress: 5, happiness: -2, reputation: -2 }, npc: { '母亲': { favor: -8 } }, tag: '因为借钱在家族群里翻了脸' })
      ]
    }),
    ev({
      id: 'c_leverage', type: 'causal', prio: 93,
      cond: function (g) { return !!g.marks.leveraged; },
      title: '抵押贷款到期',
      text: '那笔用房子抵押出来的钱，投的项目没有起色。银行通知续贷需要重新评估，利率也涨了。你算了一下，如果现在卖房，剩下的钱还够不够租房。',
      opts: [
        o('卖房还贷，轻装上阵', { houseSell: true, at: { stress: -8, happiness: -5 }, tag: '卖房还清了抵押贷款' }, { hint: '要失去房子' }),
        o('再撑一年，等项目回款', { at: { stress: 8, happiness: -4 }, flag: { event: 'c_bankrupt', delay: 2, mark: 'leverage_risk', note: '抵押贷款越滚越大' }, tag: '抵押贷款到期后继续硬撑' }),
        o('找家人帮忙周转', { money: { cash: 30000, debt: -20000 }, npc: { '母亲': { favor: -10 } }, at: { happiness: -4, stress: 3 }, tag: '抵押贷款到期时向家人求助' })
      ]
    }),
    ev({
      id: 'c_child_late', type: 'causal', prio: 87, repeatable: true, cooldown: 3,
      cond: function (g) { return married(g) && g.family.childrenIds.length === 0 && !g.marks.dink && g.age >= 34 && g.age <= 42; },
      title: '还要不要孩子',
      text: '同龄人的孩子已经上小学，你们的家里还是很安静。双方父母不再明说，只是把亲戚家小孩的视频转过来。医院的检查单上，几项指标被圈了出来，医生建议尽快决定。',
      opts: [
        gamble('试试看，怀不上再说', function (g) { return LS.clamp(0.28 + g.attrs.health / 260 - (g.age - 34) * 0.02, 0.12, 0.6); },
          { child: true, money: { cash: -40000 }, at: { happiness: 8, health: -4, stress: 6 }, tag: '三十多岁才要上孩子' },
          { money: { cash: -20000 }, at: { happiness: -6, health: -2, stress: 5 }, tag: '想要孩子，一直没怀上' },
          '折腾了一年多，终于有了消息。', '检查做了一轮又一轮，还是没有结果。', '身体不等人'),
        o('先做全面检查，听医生的', { money: { cash: -12000 }, at: { health: 3, stress: 2 }, tag: '为生育做了一次全面检查' }),
        o('不折腾了，两个人过', { at: { happiness: 4, stress: -3 }, set: { dink: true }, npc: { '配偶': { favor: 4 } }, tag: '决定两个人过下去' })
      ]
    }),
    ev({
      id: 'c_late_love', type: 'causal', prio: 79, repeatable: true, cooldown: 4,
      cond: function (g) { return !married(g) && g.age >= 31 && g.age <= 48 && !g.marks.single_by_choice; },
      title: '朋友介绍的人',
      text: '同事说你该见一个人，条件普通，离过一次婚，工作稳定。周末约在商场四楼的餐厅，对方比照片上瘦，说话不急。吃完饭各自回家，手机里多了一个不会再主动亮起的对话框。',
      opts: [
        gamble('认真相处，往结婚走', function (g) { return LS.clamp(0.4 + g.attrs.charm / 220 + LS.repTotal(g) / 600, 0.25, 0.85); },
          { marry: true, money: { cash: -15000 }, at: { happiness: 6, stress: -3 }, tag: '三十多岁经人介绍结了婚' },
          { at: { happiness: -3, stress: 2 }, tag: '相处了几个月，还是没走到一起' },
          '半年后领了证，酒席办得很小。', '见了双方父母，最后还是算了。', '年纪越大，试错成本越高'),
        o('先做朋友，不急着定', { at: { happiness: 2, stress: -1, charm: 1 }, tag: '和介绍的人先从朋友做起' }),
        o('算了，一个人也挺好', { at: { happiness: 2, stress: -2 }, set: { single_by_choice: true }, tag: '决定不再相亲' })
      ]
    }),
    ev({
      id: 'c_depression3', type: 'causal', prio: 99, urgent: true,
      cond: function (g) { return !!g.marks.deep_depression; },
      title: '长期低落',
      text: '这种状态已经持续了几年。你习惯了在人群里假装正常，回家后一个人坐着。体检医生说，长期情绪问题也在消耗身体。你点了点头，没有反驳。',
      opts: [
        o('开始规律治疗', { money: { cash: -20000 }, at: { happiness: 10, stress: -8, health: 4 }, set: { therapy: true }, tag: '终于开始规律治疗情绪问题' }),
        o('换个环境生活', { money: { cash: -20000 }, at: { happiness: 6, stress: -5 }, npc: { '母亲': { favor: -3 } }, tag: '为了情绪换了个城市生活' }),
        o('继续维持现状', { at: { happiness: -3, health: -3 }, tag: '长期低落的状态没有改变' })
      ]
    })
  ]);

  /* =========================================================
     三、随机权重事件
     ========================================================= */

  /* ---------------- 婴幼儿 0–3 ---------------- */
  add([
    ev({
      id: 'r_night_cry', type: 'random', stage: '婴幼儿', weight: 2, repeatable: true,
      title: '夜里哭了整宿',
      text: '你已经连续几个晚上睡不安稳，一放下就哭。母亲抱着你在屋里来回走，父亲第二天还要早起上班。天快亮的时候，楼下有人敲暖气管，提醒安静一点。',
      opts: [
        o('父母轮流抱着哄', { at: { happiness: 3, health: -1 }, npc: { '母亲': { favor: 2 }, '父亲': { favor: 1 } }, tag: '婴儿期父母几乎没睡好觉' }),
        o('让他哭一会儿，自己睡', { at: { health: -2, happiness: -1 }, npc: { '母亲': { favor: -2 } }, tag: '父母试过让你自己哭到睡着' }),
        o('抱去医院看急诊', { money: { cash: -800 }, at: { health: 2 }, tag: '因为夜哭跑了一趟医院' })
      ]
    }),
    ev({
      id: 'r_first_steps', type: 'random', stage: '婴幼儿', weight: 2,
      title: '学走路',
      text: '客厅的茶几角被父亲用旧毛巾包了起来。你扶着沙发挪步，走两步就坐下。母亲蹲在三米外拍手，父亲举着一台旧数码相机在旁边录。你犹豫了很久，还是松开了手。',
      opts: [
        o('跌跌撞撞走过去', { at: { health: 2, happiness: 3 }, npc: { '母亲': { favor: 3 } }, tag: '学步时摔了但自己爬起来' }),
        o('一直扶着沙发不肯松手', { at: { health: 1, happiness: 1 }, tag: '学步比同龄人慢一点' })
      ]
    }),
    ev({
      id: 'r_grandma_candy', type: 'random', stage: '婴幼儿', weight: 2,
      title: '奶奶口袋里的糖',
      text: '奶奶从集市回来，口袋里总揣着几颗水果糖。母亲说孩子太小不能吃，奶奶说就一颗。糖纸是透明的，里面裹着橘红色的一小团，你伸手去够。',
      opts: [
        o('吃了一颗', { at: { happiness: 3, health: -2 }, npc: { '母亲': { favor: -1 } }, tag: '小时候常吃奶奶给的糖' }),
        o('母亲拦下来，没吃', { at: { health: 1 }, npc: { '母亲': { favor: 2 } }, tag: '母亲管得比较严' })
      ]
    }),
    ev({
      id: 'r_neighbor_toy', type: 'random', stage: '婴幼儿', weight: 2,
      title: '被抢走的玩具',
      text: '邻居家的孩子比你大半岁，看上了你手里的塑料小汽车。他直接伸手拿走，你愣了两秒，张嘴就哭。他母亲在旁边说“哥哥让着弟弟”，你母亲没接话。',
      opts: [
        o('母亲替你要回来', { at: { happiness: 2, charm: -1 }, npc: { '母亲': { favor: 2 } }, tag: '小时候母亲会替你出头' }),
        o('算了，再买一个', { money: { cash: -30 }, at: { happiness: 1 }, tag: '从小就被教育不要争' }),
        o('自己抢回来', { at: { charm: 2, happiness: 2 }, tag: '很小就学会自己争东西' })
      ]
    })
  ]);

  /* ---------------- 童年 4–12 ---------------- */
  add([
    ev({
      id: 'r_village_school', type: 'random', stage: '童年', weight: 3,
      cond: function (g) { return g.birthplace === '农村'; },
      title: '村小撤并',
      text: '开学前一个星期，村里通知教学点要撤并，学生统一去镇上中心校。校车一天两趟，早上六点半在村口等。父亲算了一下，一年车费加午饭，比在村里读书多出不少。',
      opts: [
        o('坐校车去镇上读', { money: { cash: -1200 }, at: { knowledge: 3, health: -2 }, tag: '村小撤并后去镇上读书' }, { hint: '每年多一笔开销' }),
        o('让母亲每天骑摩托接送', { at: { knowledge: 2, happiness: 2 }, npc: { '母亲': { health: -2, favor: 2 } }, tag: '母亲每天骑车接送上放学' }),
        o('借住在镇上亲戚家', { at: { knowledge: 2, happiness: -3 }, npc: { '母亲': { favor: -3 } }, tag: '为了上学寄住在亲戚家' })
      ]
    }),
    ev({
      id: 'r_teacher_praise', type: 'random', stage: '童年', weight: 3,
      title: '被老师念了作文',
      text: '语文老师把你的作文当范文在班上念，念到一半停下来，说这个比喻写得好。下课有同学围过来问你怎么想的。你其实只是写了村口那条河，和你奶奶家院子里的枣树。',
      opts: [
        o('从此更愿意写东西', { at: { knowledge: 4, happiness: 4 }, rep: { school: 3 }, tag: '小学时作文被老师当范文' }),
        o('觉得很不好意思，低头不说话', { at: { knowledge: 2, happiness: 1 }, tag: '被表扬时会不好意思' }),
        o('回家讲给母亲听', { at: { happiness: 3 }, npc: { '母亲': { favor: 4 } }, tag: '把老师的表扬讲给母亲听' })
      ]
    }),
    ev({
      id: 'r_flu', type: 'random', stage: '童年', weight: 3, repeatable: true,
      title: '一场重流感',
      text: '班上一半人请假。你烧到三十九度，村卫生室挂了两天水不见好。母亲不放心，打车去了县医院，医生说是流感合并支气管炎，要住院观察两天。',
      opts: [
        o('住院治疗', { money: { cash: -6000 }, at: { health: 4, happiness: -2 }, npc: { '母亲': { favor: 3 } }, tag: '童年因流感住过院' }, { hint: '一笔医药费' }),
        o('在卫生室继续挂水', { money: { cash: -1200 }, at: { health: -3 }, tag: '为了省钱没去县医院' }),
        o('硬扛，多喝水', { at: { health: -6 }, tag: '小时候生病常硬扛' })
      ]
    }),
    ev({
      id: 'r_bike', type: 'random', stage: '童年', weight: 3,
      title: '一辆自行车',
      text: '同班同学陆续骑上了带横梁的自行车。你那辆是表哥淘汰下来的，刹车有点松，链条三天两头掉。父亲说还能骑，母亲说要不换一辆。',
      opts: [
        o('换一辆新的', { money: { cash: -900 }, at: { happiness: 5, charm: 2 }, tag: '十岁有了第一辆新自行车' }, { hint: '家里要出一笔钱' }),
        o('修一修继续骑', { money: { cash: -80 }, at: { happiness: -1, health: 1 }, tag: '旧自行车修修补补骑了几年' }),
        o('自己攒零花钱换零件', { at: { finance: 3, happiness: 2 }, tag: '自己攒钱修好了自行车' })
      ]
    }),
    ev({
      id: 'r_hobby_class', type: 'random', stage: '童年', weight: 3,
      cond: function (g) { return g.background !== '贫困'; },
      title: '兴趣班传单',
      text: '商场门口在发兴趣班传单，钢琴、绘画、跆拳道，体验课九块九。母亲翻来覆去看那张纸，问你到底喜欢哪个。你其实只对那架能弹出声音的琴好奇。',
      opts: [
        o('报钢琴班', { money: { cash: -6000 }, at: { charm: 4, knowledge: 2, happiness: 3 }, tag: '童年学过两年钢琴' }, { hint: '学费按年交' }),
        o('报绘画班', { money: { cash: -3000 }, at: { charm: 4, happiness: 3 }, tag: '童年学过画画' }),
        o('不报，把钱省下来', { money: { cash: 200 }, at: { happiness: -1, knowledge: 1 }, tag: '童年没有上过兴趣班' })
      ]
    }),
    ev({
      id: 'r_bully_scene', type: 'random', stage: '童年', weight: 2,
      title: '走廊上的推搡',
      text: '课间，几个高年级学生在走廊上围住一个戴眼镜的男生，把他的作业本扔在地上踩。周围有人笑，也有人装作没看见。你站在教室门口，离得很近。',
      opts: [
        o('去告诉老师', { rep: { school: 3 }, at: { happiness: 2, stress: 2 }, set: { stood_up: true }, tag: '小学时曾为被欺负的同学出头' }),
        o('把作业本捡起来还给他', { at: { charm: 3, happiness: 3 }, npc: { '同学': { favor: 8 } }, tag: '帮被欺负的同学捡过作业本' }),
        o('走开，不想惹麻烦', { at: { happiness: -2, stress: 1 }, tag: '小时候选择对欺负视而不见' })
      ]
    }),
    ev({
      id: 'r_lottery', type: 'random', stage: '童年', weight: 2,
      title: '小卖部的抽奖',
      text: '小卖部进了一批卡片，五毛钱抽一张，集齐七张能换一个遥控车。你已经抽了十几张，差最后一张。老板说最后一张不好出，要看运气。',
      opts: [
        o('再抽十张', { money: { cash: -50 }, at: { happiness: 2, finance: -1 }, gamble: { p: 0.35, win: { at: { happiness: 6 }, tag: '集齐卡片换了遥控车' }, lose: { at: { happiness: -2 }, tag: '抽奖花光了零花钱' }, winText: '终于集齐了，你抱着遥控车回家。', loseText: '还是差一张，钱花完了。' } }),
        o('收手，把卡片收起来', { at: { finance: 2, happiness: -1 }, tag: '小时候学会及时收手' })
      ]
    }),
    ev({
      id: 'r_parent_quarrel', type: 'random', stage: '童年', weight: 3,
      cond: function (g) { return LS.npcAlive(g, '父亲') && LS.npcAlive(g, '母亲'); },
      title: '饭桌上的沉默',
      text: '父亲这个月奖金少了，母亲埋怨他总替别人顶班。两个人从厨房说到客厅，声音越来越大，最后父亲摔了筷子出门。你坐在房间里，作业本上一个字也没写。',
      opts: [
        o('出去劝他们', { at: { stress: 4, happiness: -3, charm: 2 }, npc: { '父亲': { favor: 2 }, '母亲': { favor: 2 } }, tag: '小时候试图劝父母别吵' }),
        o('关上门装作听不见', { at: { happiness: -4, stress: 3 }, tag: '父母吵架时你学会装听不见' }),
        o('给母亲倒杯水', { at: { happiness: 1 }, npc: { '母亲': { favor: 6 } }, tag: '父母吵架后你给母亲倒过水' })
      ]
    }),
    ev({
      id: 'r_summer_job', type: 'random', stage: '童年', weight: 2,
      cond: function (g) { return g.age >= 10 && g.background !== '富裕'; },
      title: '暑假的第一份零工',
      text: '镇上冷库招人分拣蔬菜，一天五十，早六点到下午两点。母亲不同意，说你还小。父亲说去见识一下也好。你自己有点想去，又怕累。',
      opts: [
        o('去干一个暑假', { money: { cash: 900 }, at: { health: -3, finance: 4, happiness: -1 }, tag: '十岁出头就打过暑假零工' }, { hint: '能挣钱，但很累' }),
        o('不去，在家写作业', { at: { knowledge: 3, happiness: 2 }, tag: '童年暑假大多在家度过' }),
        o('去两天就回来了', { money: { cash: 100 }, at: { health: -1, happiness: -2 }, tag: '第一次打工没坚持下来' })
      ]
    }),
    ev({
      id: 'r_move_school', type: 'random', stage: '童年', weight: 2,
      title: '转学',
      text: '父亲换了工作，家里要搬到另一个区。新学校离住处四站公交，班上同学大多已经认识好几年。报到那天，班主任让你在讲台上自我介绍，你只说了名字。',
      opts: [
        o('主动和同桌搭话', { at: { charm: 3, happiness: 2 }, npc: { '同学': { favor: 6 } }, tag: '转学后主动认识了新同学' }),
        o('安静读书，不主动社交', { at: { knowledge: 3, happiness: -2, charm: -1 }, tag: '转学后变得沉默' }),
        o('周末回老学校找朋友', { money: { cash: -100 }, at: { happiness: 3, knowledge: -1 }, tag: '转学后仍常回老学校' })
      ]
    }),
    ev({
      id: 'r_grandpa_visit', type: 'random', stage: '童年', weight: 2,
      cond: function (g) { return g.birthplace !== '一线城市'; },
      title: '外公来住了一个月',
      text: '外公从老家来城里看你们，带了一袋花生和一坛腌菜。他不太会用煤气灶，也不习惯电梯，每天坐在阳台上看楼下的人。母亲白天上班，让你多陪陪他。',
      opts: [
        o('每天陪他在小区里走走', { at: { happiness: 4, charm: 2 }, npc: { '母亲': { favor: 4 } }, tag: '童年陪外公散步的那段日子' }),
        o('不太习惯，躲进房间看电视', { at: { happiness: -1 }, tag: '小时候不太会跟长辈相处' }),
        o('跟他学做腌菜', { at: { knowledge: 2, happiness: 3, health: -1 }, tag: '跟外公学过做腌菜' })
      ]
    })
  ]);

  /* ---------------- 少年 13–18 ---------------- */
  add([
    ev({
      id: 'r_crush', type: 'random', stage: '少年', weight: 3,
      title: '后排的女生',
      text: '她坐在你后排，借过你一次橡皮，后来每次考完试都会问你最后一道题。你开始在意外套的拉链有没有拉好，也在意自己说话会不会太冲。这件事你没跟任何人说。',
      opts: [
        o('写一封信给她', { at: { charm: 3, happiness: 4, stress: 2, knowledge: -2 }, gamble: { p: 0.45, win: { at: { happiness: 8, charm: 4 }, npc: { '同学': { favor: 8 } }, tag: '高中时有过一段青涩的恋爱' }, lose: { at: { happiness: -5, charm: 1 }, tag: '高中时表白被拒绝了' }, winText: '她回了信，字写得很小。', loseText: '她说现在只想学习。' } }),
        o('把心思压下去，专心学习', { at: { knowledge: 5, happiness: -2, stress: 2 }, tag: '高中时把喜欢压在心里' }),
        o('装作什么都没发生', { at: { happiness: -1 }, tag: '少年时习惯把情绪藏起来' })
      ]
    }),
    ev({
      id: 'r_internet_cafe', type: 'random', stage: '少年', weight: 3, repeatable: true,
      title: '网吧的深夜',
      text: '周五放学，几个同学约去网吧，说包夜只要十五块。老板认识其中一个，不用查身份证。你作业写了一半，母亲以为你在同学家补习。',
      opts: [
        o('去，玩到天亮', { money: { cash: -15 }, at: { happiness: 6, health: -4, knowledge: -3, stress: -2 }, npc: { '母亲': { favor: -3 } }, tag: '高中时偷偷去网吧包过夜' }, { hint: '被发现的风险' }),
        o('去两个小时就回家', { money: { cash: -5 }, at: { happiness: 3, health: -1 }, tag: '偶尔去网吧但不敢久留' }),
        o('不去，留在教室写作业', { at: { knowledge: 5, happiness: -3, stress: 2 }, tag: '高中时很少跟同学出去玩' })
      ]
    }),
    ev({
      id: 'r_teacher_extra', type: 'random', stage: '少年', weight: 3,
      title: '老师留你补课',
      text: '数学老师把你和另外四个人留下来，说你们几个基础还行，就是不肯下功夫。他每周三晚自习后免费补一小时，条件是下次月考必须进年级前八十。',
      opts: [
        o('留下来认真补', { at: { knowledge: 8, stress: 4, happiness: -1 }, rep: { school: 3 }, tag: '高中时被数学老师单独补过课' }),
        o('找借口不去', { at: { knowledge: -2, happiness: 1, stress: -2 }, rep: { school: -2 }, tag: '高中时躲掉了老师的补课' }),
        o('去两次，后来坚持不住', { at: { knowledge: 2, stress: 1 }, tag: '补课坚持了没多久' })
      ]
    }),
    ev({
      id: 'r_sports_meet', type: 'random', stage: '少年', weight: 2,
      title: '运动会报名表',
      text: '班主任拿着运动会报名表，八百米还差一个人。体育委员说你平时跑得还行，问你要不要上。你想起上次体测跑完扶着膝盖喘了十分钟。',
      opts: [
        o('报名，练了两周', { at: { health: 4, charm: 3, stress: -2 }, rep: { school: 2 }, gamble: { p: 0.5, win: { at: { happiness: 6 }, rep: { school: 3 }, tag: '校运会八百米进了前三' }, lose: { at: { happiness: 1, health: -2 }, tag: '校运会跑了最后一名' }, winText: '你冲过终点时，班上一片喊声。', loseText: '你最后一个跑完，但走回了看台。' } }),
        o('推给别的同学', { at: { happiness: -1 }, tag: '高中时尽量不出风头' })
      ]
    }),
    ev({
      id: 'r_exam_cheat', type: 'random', stage: '少年', weight: 2,
      title: '月考的小抄',
      text: '月考座位按成绩排，你旁边的人把公式抄在了橡皮上。监考老师来回走，他低声说“帮我挡一下”。你想起这次成绩要开家长会。',
      opts: [
        o('帮他挡，自己不作弊', { at: { stress: 3, happiness: -1 }, npc: { '同学': { favor: 5 } }, tag: '帮同学挡过监考老师' }),
        o('也抄一点', { at: { knowledge: -2, stress: 4, happiness: 2 }, gamble: { p: 0.6, win: { at: { knowledge: 1 }, tag: '月考作弊没被发现' }, lose: { rep: { school: -8 }, at: { happiness: -6, stress: 5 }, tag: '月考作弊被老师抓住' }, winText: '成绩上去了，你心里却不踏实。', loseText: '老师收了你的卷子，叫了家长。' } }),
        o('举手告诉老师', { rep: { school: 4 }, at: { happiness: -2 }, npc: { '同学': { favor: -15 } }, tag: '月考时举报了同学作弊' })
      ]
    }),
    ev({
      id: 'r_first_phone', type: 'random', stage: '少年', weight: 3,
      title: '第一部手机',
      text: '父母讨论了很久，最后同意给你买一部手机，条件是成绩不能掉。手机店里的直板机四百多，带摄像头的要贵一百。父亲说能打电话发短信就够了。',
      opts: [
        o('买带摄像头的', { money: { cash: -560 }, at: { happiness: 5, charm: 2 }, tag: '第一部手机带摄像头' }, { hint: '多花一百块' }),
        o('买最便宜的', { money: { cash: -420 }, at: { happiness: 2 }, tag: '第一部手机是最便宜的直板机' }),
        o('不要手机，把钱省下', { money: { cash: 0 }, at: { happiness: -3, knowledge: 2 }, tag: '高中时一直没买手机' })
      ]
    }),
    ev({
      id: 'r_holiday_work', type: 'random', stage: '少年', weight: 2,
      cond: function (g) { return g.age >= 16; },
      title: '寒假短工',
      text: '超市年前缺人，招临时理货员，一天八十，干到大年二十九。母亲说耽误学习，父亲说去挣点钱也好。你自己算了算，干十天能买双像样的球鞋。',
      opts: [
        o('去干十天', { money: { cash: 800 }, at: { finance: 4, health: -2, knowledge: -2 }, tag: '高中寒假在超市打过短工' }),
        o('在家复习', { at: { knowledge: 5, stress: 2 }, tag: '寒假用来补课复习' }),
        o('干三天，剩下的时间学习', { money: { cash: 240 }, at: { finance: 2, knowledge: 3, health: -1 }, tag: '寒假打了几天短工' })
      ]
    }),
    ev({
      id: 'r_friend_borrow', type: 'random', stage: '少年', weight: 2,
      title: '同学借钱',
      text: '同桌说家里出了点事，想借两百，下个月还。你自己口袋里也只有母亲给的三百块生活费。他平时对你不错，但你也听说过他跟别人借过钱没还。',
      opts: [
        o('借给他', { money: { cash: -200 }, npc: { '同学': { favor: 10 } }, at: { happiness: 2 }, gamble: { p: 0.55, win: { money: { cash: 200 }, tag: '同学按时还了钱' }, lose: { at: { happiness: -3, finance: -2 }, tag: '借给同学的钱没要回来' }, winText: '下个月他把钱还了，还请你喝了瓶汽水。', loseText: '他再也没提这两百块。' } }),
        o('只借五十', { money: { cash: -50 }, npc: { '同学': { favor: 4 } }, tag: '只借给同学一点钱' }),
        o('说自己也紧张', { npc: { '同学': { favor: -6 } }, at: { happiness: -1 }, tag: '拒绝了同学的借钱请求' })
      ]
    }),
    ev({
      id: 'r_peer_smoke', type: 'random', stage: '少年', weight: 2,
      title: '厕所里的烟',
      text: '晚自习课间，两个同学在厕所里抽烟，见你进来，其中一个递过来一根，说“试试，不呛”。窗外是学校新装的监控，摄像头正对着走廊。',
      opts: [
        o('接过来抽一口', { at: { health: -3, happiness: 2, stress: -2 }, set: { smoker: true }, flag: { event: 'c_smoke', delay: 8, mark: 'smoke_years', note: '少年时开始抽烟' }, tag: '高中时学会了抽烟' }, { hint: '这个习惯会跟你很多年' }),
        o('摆手拒绝', { at: { health: 1, happiness: -1 }, npc: { '同学': { favor: -3 } }, tag: '高中时拒绝了同学递的烟' }),
        o('劝他们别在厕所抽', { rep: { school: 2 }, npc: { '同学': { favor: -5 } }, at: { happiness: -1 }, tag: '因为劝同学别抽烟被孤立过' })
      ]
    }),
    ev({
      id: 'r_art_exam', type: 'random', stage: '少年', weight: 2,
      cond: function (g) { return LS.hasTalent(g, 'art') && g.age >= 16; },
      title: '画室老师的建议',
      text: '画室老师说你的色彩感觉不错，建议走艺考，文化课要求低一些，但集训费一年要三万多。你回家把这件事说了，父亲先问的是“以后能干什么”。',
      opts: [
        o('走艺考', { money: { cash: -32000 }, at: { charm: 6, happiness: 4, knowledge: -2 }, set: { art_path: true }, tag: '选择了艺考这条路' }, { hint: '集训费用很高' }),
        o('放弃，专心文化课', { at: { knowledge: 4, happiness: -3 }, npc: { '老师': { favor: -2 } }, tag: '放弃了艺考' }),
        o('先问清楚就业再决定', { at: { knowledge: 2, happiness: 1 }, tag: '为艺考认真查过就业情况' })
      ]
    }),
    ev({
      id: 'r_rumor', type: 'random', stage: '少年', weight: 2,
      title: '班上的传言',
      text: '有人在班级群里说你向老师打小报告。消息传了两天，几个原本一起吃饭的同学开始躲着你。你想解释，又觉得越解释越像。',
      opts: [
        o('在群里把话说清楚', { at: { stress: 3, happiness: -2, charm: 2 }, rep: { school: 2 }, tag: '高中时在班级群里澄清过传言' }),
        o('不解释，随他们说', { at: { happiness: -4, stress: 2 }, tag: '高中时被同学孤立过一阵' }),
        o('找当事人单独谈', { at: { charm: 3, happiness: 1 }, npc: { '同学': { favor: 6 } }, tag: '主动找传话的同学谈过' })
      ]
    }),
    ev({
      id: 'r_study_abroad', type: 'random', stage: '少年', weight: 2,
      cond: function (g) { return g.background === '富裕' && g.age >= 16; },
      title: '出国读高中的机会',
      text: '中介来家里讲了两次，说以你的成绩可以申请海外高中，一年学费加生活费四十万左右。母亲觉得见世面重要，父亲说国内高考也不是不能走。',
      opts: [
        o('出国读高中', { money: { cash: -400000 }, at: { knowledge: 6, charm: 5, happiness: 2 }, set: { overseas_study: true }, edu: 3, tag: '高中阶段出国读书' }, { hint: '一笔很大的支出' }),
        o('留在国内高考', { at: { knowledge: 3, happiness: 1 }, tag: '放弃了出国读高中的机会' })
      ]
    })
  ]);

  /* ---------------- 青年 19–30 ---------------- */
  add([
    ev({
      id: 'r_roommate', type: 'random', stage: '青年', weight: 3,
      cond: function (g) { return g.age <= 23; },
      title: '室友的作息',
      text: '室友每天凌晨两点还在打游戏，耳机漏音，键盘敲得很响。你提过两次，他嘴上答应，第二天照旧。你早上八点有课，已经连续一周没睡好。',
      opts: [
        o('再认真谈一次', { at: { stress: 2, charm: 2 }, npc: { '同学': { favor: 2 } }, tag: '大学时和室友认真谈过作息' }),
        o('找辅导员协调换宿舍', { at: { stress: 3, happiness: -1 }, npc: { '同学': { favor: -4 } }, tag: '因为室友作息换过宿舍' }),
        o('买耳塞忍着', { money: { cash: -30 }, at: { health: -2, happiness: -2 }, tag: '大学时靠耳塞熬过室友的噪音' })
      ]
    }),
    ev({
      id: 'r_club', type: 'random', stage: '青年', weight: 3,
      cond: function (g) { return g.age <= 23 && g.edu.level >= 4; },
      title: '社团招新',
      text: '操场边摆了一排桌子，辩论队、乐队、志愿者协会都在招人。辩论队学长说每周要开两次会，比赛季基本没有周末。你有点想试试，又担心耽误专业课。',
      opts: [
        o('进辩论队', { at: { knowledge: 3, charm: 5, stress: 3 }, rep: { school: 4 }, npc: { '同学': { favor: 6 } }, tag: '大学时加入了辩论队' }),
        o('进志愿者协会', { at: { charm: 3, happiness: 3, knowledge: 1 }, rep: { school: 2 }, tag: '大学时做了一年志愿者' }),
        o('不进社团，专心读书', { at: { knowledge: 5, happiness: -1 }, tag: '大学时没有参加社团' })
      ]
    }),
    ev({
      id: 'r_internship', type: 'random', stage: '青年', weight: 3,
      cond: function (g) { return g.age >= 20 && g.edu.level >= 4; },
      title: '实习机会',
      text: '学姐转发了一条实习信息，公司在市中心，一天一百二，不包吃住，干得好有机会留用。课表上有两门专业课冲突，老师说请假可以，但期末要补考。',
      opts: [
        o('去实习，课自己补', { money: { cash: 3000 }, at: { knowledge: 2, stress: 4, finance: 3 }, npc: { '同事': { favor: 6 } }, set: { interned: true }, tag: '大学时翘课去实习' }, { hint: '可能影响成绩' }),
        o('放弃实习，保住绩点', { at: { knowledge: 5, happiness: -1 }, tag: '大学时放弃了实习机会' }),
        o('跟公司谈远程', { at: { knowledge: 3, finance: 2, stress: 2 }, gamble: { p: 0.5, win: { money: { cash: 4000 }, tag: '谈成了远程实习' }, lose: { at: { happiness: -2 }, tag: '远程实习没谈成' }, winText: '对方同意你每周去三天。', loseText: '对方说岗位必须坐班。' } })
      ]
    }),
    ev({
      id: 'r_certificate', type: 'random', stage: '青年', weight: 3,
      title: '考证',
      text: '同事说行业里认一个资格证，报名费加培训两千多，考下来每月能多几百块。你翻了翻考试大纲，发现自己有一半内容没接触过。',
      opts: [
        o('报班系统学', { money: { cash: -2600 }, at: { knowledge: 5, stress: 3 }, gamble: { p: 0.62, win: { at: { finance: 4, happiness: 4 }, rep: { industry: 4 }, tag: '考下了一个职业资格证' }, lose: { at: { happiness: -3 }, tag: '资格证考了一次没过' }, winText: '成绩出来，你过了。', loseText: '差了几分，明年再报。' } }, { hint: '培训费不便宜' }),
        o('自学，买本书看看', { money: { cash: -120 }, at: { knowledge: 3, stress: 2 }, gamble: { p: 0.35, win: { at: { finance: 3 }, rep: { industry: 3 }, tag: '自学考下了资格证' }, lose: { at: { happiness: -1 }, tag: '自学考证没坚持下来' }, winText: '你居然一次考过了。', loseText: '书翻了一半就搁下了。' } }),
        o('不考，先把手上的活做好', { at: { knowledge: 1, stress: -1 }, tag: '没有跟风去考证' })
      ]
    }),
    ev({
      id: 'r_blind_date', type: 'random', stage: '青年', weight: 3, repeatable: true,
      cond: function (g) { return g.age >= 24 && g.family.marriage.status === '未婚'; },
      title: '一次相亲',
      text: '介绍人是母亲同事，对方在事业单位上班，照片看着端正。见面约在商场四楼的餐厅，人均八十。你提前到了十分钟，反复看菜单，想着一会儿聊什么。',
      opts: [
        o('认真聊，试着接触', { money: { cash: -180 }, at: { charm: 2, happiness: 2, stress: 2 }, gamble: { p: 0.42, win: { at: { happiness: 6 }, npc: { '恋人': { favor: 12 } }, tag: '相亲认识了一个聊得来的人' }, lose: { at: { happiness: -3 }, tag: '相亲之后没有下文' }, winText: '吃完饭她主动加了你微信。', loseText: '饭后各自回家，再没联系。' } }),
        o('礼貌吃完，不再联系', { money: { cash: -180 }, at: { happiness: -1 }, tag: '相亲只是走个过场' }),
        o('临时推掉', { at: { happiness: -2 }, npc: { '母亲': { favor: -4 } }, tag: '推掉过家里安排的相亲' })
      ]
    }),
    ev({
      id: 'r_rent_hike', type: 'random', stage: '青年', weight: 3, repeatable: true,
      cond: function (g) { return g.age >= 22 && !g.house.owned; },
      title: '房东要涨租',
      text: '房东在微信上发来消息，说周边都涨了，下个月起每月加三百。合同还有四个月到期，你算了算工资涨幅，发现基本等于白干。',
      opts: [
        o('接受涨租', { money: { cash: -1200 }, at: { stress: 3, happiness: -2 }, tag: '租房时被房东涨过租' }),
        o('搬家找更便宜的', { money: { cash: -2000 }, at: { stress: 4, health: -2 }, tag: '为了省房租搬过家' }, { hint: '押金和搬家费' }),
        o('跟房东谈，续签一年不涨', { at: { stress: 1, happiness: 2, charm: 2 }, gamble: { p: 0.45, win: { tag: '谈成了不涨租' }, lose: { money: { cash: -1000 }, at: { happiness: -2 }, tag: '和房东谈崩了' }, winText: '房东同意原价续一年。', loseText: '房东说那就到期搬走。' } })
      ]
    }),
    ev({
      id: 'r_telecom_scam', type: 'random', stage: '青年', weight: 2,
      title: '客服来电',
      text: '一个自称平台客服的电话，说你开通了会员，不取消每月扣六百。对方能报出你的姓名和订单，让你下载一个软件做“取消操作”。你正好在等地铁，信号不好。',
      opts: [
        o('按对方说的操作', { at: { stress: 5, happiness: -4 }, gamble: { p: 0.25, win: { at: { finance: 2 }, tag: '识破了诈骗电话' }, lose: { money: { cash: -18000 }, tag: '被电信诈骗骗走了一笔钱' }, winText: '你中途觉得不对，挂了电话。', loseText: '卡里的钱被转走了大半。' } }, { hint: '风险很高' }),
        o('挂掉，打官方客服核实', { at: { stress: 1, knowledge: 2 }, tag: '接到诈骗电话时选择了核实' }),
        o('直接报警', { at: { stress: 2, happiness: 1 }, rep: { society: 2 }, tag: '遇到诈骗电话报了警' })
      ]
    }),
    ev({
      id: 'r_side_business', type: 'random', stage: '青年', weight: 3,
      cond: function (g) { return g.age >= 22 && !!g.job.id; },
      title: '副业的想法',
      text: '同事下班后做代购，一个月能多挣两千。你算了算自己的时间，晚上和周末挤一挤，也许能腾出十几个小时。但主业最近正忙。',
      opts: [
        o('做起来，先投一笔', { money: { cash: -6000 }, at: { stress: 5, health: -3 }, gamble: { p: 0.5, win: { money: { cash: 18000 }, at: { finance: 5, happiness: 3 }, tag: '副业做起来了' }, lose: { money: { cash: -3000 }, at: { happiness: -3 }, tag: '副业亏了钱' }, winText: '第三个月开始回本。', loseText: '货压在手里，慢慢清仓。' } }, { hint: '要投入资金和精力' }),
        o('只做轻量的，不压货', { at: { finance: 3, stress: 2, health: -1 }, tag: '做过一段时间轻量副业' }),
        o('不做，保住主业状态', { at: { stress: -2, happiness: 1 }, tag: '没有做副业' })
      ]
    }),
    ev({
      id: 'r_overtime', type: 'random', stage: '青年', weight: 3, repeatable: true,
      cond: function (g) { return !!g.job.id; },
      title: '连续第三周加班',
      text: '项目上线前，组里连续加班。晚上十点办公室还坐着一半人，领导点了外卖，说再坚持一周。你手上还有一份报告没写完，周末原本约了朋友。',
      opts: [
        o('接着熬', { money: { cash: 1500 }, at: { health: -5, stress: 5, finance: 2 }, rep: { industry: 3 }, flag: { event: 'c_sleep', delay: 12, mark: 'chronic_overtime', note: '青年时期长期加班' }, tag: '青年时期长期加班' }, { hint: '身体会记账' }),
        o('按时下班，报告明天写', { at: { health: 2, stress: -3 }, rep: { industry: -2 }, npc: { '上司': { favor: -4 } }, tag: '拒绝过一次无意义的加班' }),
        o('跟领导谈调休', { at: { stress: 2, charm: 2 }, gamble: { p: 0.5, win: { at: { happiness: 3, health: 1 }, tag: '争取到了调休' }, lose: { rep: { industry: -2 }, at: { happiness: -2 }, tag: '谈调休被领导记了一笔' }, winText: '领导同意下周补一天假。', loseText: '领导说项目期特殊，以后再说。' } })
      ]
    }),
    ev({
      id: 'r_travel', type: 'random', stage: '青年', weight: 2,
      cond: function (g) { return g.money.cash > 5000; },
      title: '一次说走就走',
      text: '朋友抢到了特价机票，问你要不要一起去西南。往返一千二，住青旅，五天。你今年还没休过假，银行卡里有一点余钱。你翻了翻排班表，勉强能调出三天。',
      opts: [
        o('去，趁年轻', { money: { cash: -3500 }, at: { happiness: 8, stress: -5, knowledge: 2 }, npc: { '朋友': { favor: 6 } }, tag: '年轻时有过一次说走就走的旅行' }, { hint: '一笔旅行开销' }),
        o('不去，把钱存着', { money: { cash: 500 }, at: { happiness: -2, stress: 1 }, tag: '年轻时把钱看得比较紧' }),
        o('改成周边短途', { money: { cash: -800 }, at: { happiness: 4, stress: -2 }, tag: '用短途旅行代替远行' })
      ]
    }),
    ev({
      id: 'r_friend_wedding', type: 'random', stage: '青年', weight: 3,
      title: '同学的婚礼',
      text: '大学同学结婚，酒店在城郊，随礼行情六百起。你和他不算特别熟，但同一个群里的人都去。婚礼定在周六，你那天可能要加班。',
      opts: [
        o('请假去，随六百', { money: { cash: -600 }, at: { happiness: 3, stress: 1 }, npc: { '同学': { favor: 6 } }, tag: '参加过大学同学的婚礼' }),
        o('人不去，红包到', { money: { cash: -600 }, at: { happiness: 1 }, npc: { '同学': { favor: 2 } }, tag: '没去参加同学婚礼但随了礼' }),
        o('装不知道', { at: { happiness: -2 }, npc: { '同学': { favor: -8 } }, tag: '躲过一次同学婚礼' })
      ]
    }),
    ev({
      id: 'r_health_warning', type: 'random', stage: '青年', weight: 3,
      cond: function (g) { return g.age >= 25; },
      title: '体检报告上的箭头',
      text: '公司组织体检，报告上血脂和尿酸都标了向上的箭头。医生说你这个年纪不该这样，问是不是常喝酒、常熬夜、很少运动。你想起上周连吃了四顿外卖。',
      opts: [
        o('开始跑步，控制饮食', { at: { health: 6, stress: -2, happiness: 1 }, set: { exercise: true }, tag: '二十多岁开始规律运动' }),
        o('先不管，忙过这阵再说', { at: { health: -4, stress: 2 }, flag: { event: 'c_health_check', delay: 10, mark: 'ignored_checkup', note: '青年时期体检异常没有复查' }, tag: '体检异常拖了几年没管' }, { hint: '问题会留到后面' }),
        o('去大医院复查', { money: { cash: -1500 }, at: { health: 3, stress: 1 }, tag: '体检异常后去做了复查' })
      ]
    }),
    ev({
      id: 'r_old_classmate', type: 'random', stage: '青年', weight: 2,
      title: '老同学的消息',
      text: '高中同学突然发来消息，说在做一款产品，想找你合伙，前期不用出钱，出时间就行。你翻了翻他的朋友圈，最近半年都在发创业相关的内容。',
      opts: [
        o('答应，先兼职试试', { at: { stress: 4, knowledge: 2, finance: 2 }, npc: { '同学': { favor: 8 } }, gamble: { p: 0.45, win: { money: { cash: 12000 }, at: { finance: 4, happiness: 3 }, tag: '跟老同学合伙赚到第一笔钱' }, lose: { at: { happiness: -4, stress: 3 }, tag: '跟老同学合伙的项目黄了' }, winText: '产品上线后有了第一批付费用户。', loseText: '做了半年，项目停了。' } }),
        o('婉拒，专心本职工作', { at: { stress: -1, happiness: 1 }, npc: { '同学': { favor: -3 } }, tag: '拒绝了老同学的合伙邀请' })
      ]
    })
  ]);

  /* ---------------- 中年 31–55 ---------------- */
  add([
    ev({
      id: 'r_child_sick', type: 'random', stage: '中年', weight: 3, repeatable: true,
      cond: function (g) { return hasChild(g); },
      title: '孩子半夜发烧',
      text: '孩子半夜烧到三十九度五，吃了退烧药两个小时没降下来。妻子说去医院，你看了眼时间，凌晨一点。急诊挂号排队，走廊里全是抱孩子的家长。',
      opts: [
        o('马上去急诊', { money: { cash: -1200 }, at: { health: -1, stress: 4 }, npc: { '子女': { favor: 5 }, '配偶': { favor: 4 } }, tag: '孩子半夜发烧跑过急诊' }),
        o('先物理降温，观察', { at: { stress: 3, health: -1 }, gamble: { p: 0.6, win: { tag: '孩子退烧了没去医院' }, lose: { money: { cash: -3000 }, at: { stress: 4 }, tag: '孩子高烧拖成了肺炎' }, winText: '天亮前体温降下来了。', loseText: '第二天拍片，医生说肺炎，要住院。' } }),
        o('让配偶带孩子去', { at: { stress: 1, happiness: -2 }, npc: { '配偶': { favor: -8 } }, tag: '孩子生病时你没有一起去医院' })
      ]
    }),
    ev({
      id: 'r_parent_birthday', type: 'random', stage: '中年', weight: 3,
      cond: function (g) { return LS.npcAlive(g, '父亲') || LS.npcAlive(g, '母亲'); },
      title: '父亲的生日',
      text: '母亲打电话来，说父亲下周三过生日，让他别声张。父亲在旁边说不用办，浪费钱。你查了下高铁票，回去一趟来回六百，请一天假要扣工资。',
      opts: [
        o('请一天假回去', { money: { cash: -600 }, at: { happiness: 5 }, npc: { '父亲': { favor: 10 }, '母亲': { favor: 6 } }, tag: '父亲生日特意请假回了趟家' }),
        o('转两百块，视频里说生日快乐', { money: { cash: -200 }, at: { happiness: 1 }, npc: { '父亲': { favor: 2 } }, tag: '父亲生日只转了个红包' }),
        o('忙，改天再回', { at: { happiness: -3 }, npc: { '父亲': { favor: -5 } }, tag: '错过了一次父亲的生日' })
      ]
    }),
    ev({
      id: 'r_car', type: 'random', stage: '中年', weight: 2,
      cond: function (g) { return g.money.cash > 80000 && !g.marks.has_car; },
      title: '要不要买车',
      text: '孩子上学要接送，周末出门也不方便。你看中一辆十万出头的国产车，落地十二万，贷款两年免息。小区车位一个月三百，油费和保险另算。',
      opts: [
        o('贷款买', { money: { cash: -50000, debt: 70000 }, at: { happiness: 3, stress: 5 }, set: { has_car: true }, tag: '贷款买了家里第一辆车' }, { hint: '每月要还车贷' }),
        o('全款买便宜点的', { money: { cash: -80000 }, at: { happiness: 4, stress: 2 }, set: { has_car: true }, tag: '全款买了辆代步车' }),
        o('不买，继续坐公交', { at: { health: -1, stress: 1, finance: 3 }, tag: '中年时一直没买车' })
      ]
    }),
    ev({
      id: 'r_mid_checkup', type: 'random', stage: '中年', weight: 3, repeatable: true,
      cond: function (g) { return g.age >= 38; },
      title: '单位体检',
      text: '体检套餐分三档，基础的三百，含胃肠镜的一千八。同事说四十岁以后该查一次，你想起父亲那个年纪查出了高血压，最后还是选了基础套餐。',
      opts: [
        o('加钱做全面检查', { money: { cash: -1800 }, at: { health: 3, happiness: 2 }, tag: '中年时做过一次全面体检' }, { hint: '一笔检查费' }),
        o('做基础套餐', { money: { cash: -300 }, at: { health: 1 }, tag: '中年体检只做了基础项目' }),
        o('不查了，单位每年都查', { at: { health: -2 }, flag: { event: 'c_health_check', delay: 6, mark: 'skipped_checkup', note: '中年时期长期不做深入体检' }, tag: '中年时回避了深入体检' })
      ]
    }),
    ev({
      id: 'r_friend_invest', type: 'random', stage: '中年', weight: 3,
      cond: function (g) { return g.money.cash > 30000; },
      title: '朋友拉你投资',
      text: '朋友说他在做一个餐饮项目，商场负一层，主打快餐，差三十万启动资金。他说自己投了二十万，让你投十万占两成。你去看过那个铺位，人流量确实不错。',
      opts: [
        o('投十万', { money: { cash: -100000 }, at: { stress: 5 }, gamble: { p: 0.42, win: { money: { cash: 260000 }, at: { finance: 6, happiness: 4 }, tag: '跟朋友投资餐饮赚了钱' }, lose: { money: { cash: 0 }, at: { happiness: -8, stress: 4 }, tag: '跟朋友投资餐饮亏了本' }, winText: '第二年分红回了本，还多赚了一些。', loseText: '店开了十个月就转了，钱没回来。' } }, { hint: '可能亏掉本金' }),
        o('不投钱，帮忙看看方案', { at: { happiness: 1, knowledge: 2 }, npc: { '朋友': { favor: 3 } }, tag: '没有参与朋友的投资项目' }),
        o('直接拒绝', { npc: { '朋友': { favor: -6 } }, tag: '拒绝了朋友的投资邀请' })
      ]
    }),
    ev({
      id: 'r_rival', type: 'random', stage: '中年', weight: 3,
      cond: function (g) { return !!g.job.id; },
      title: '同组的竞争',
      text: '部门要提一个副职，你和另一个同事都在名单里。他最近常跟领导一起吃饭，还把一份你参与的方案单独汇报了。会上领导问你有没有补充。',
      opts: [
        o('当场补充自己的贡献', { at: { stress: 4, charm: 2 }, rep: { industry: 4 }, gamble: { p: 0.55, win: { at: { finance: 4, happiness: 3 }, rep: { industry: 4 }, tag: '在部门竞争中拿到了副职' }, lose: { at: { happiness: -4, stress: 3 }, npc: { '同事': { favor: -8 } }, tag: '部门竞争失败' }, winText: '领导点了头，让你会后留下。', loseText: '位置给了对方，你被安排去带新人。' } }),
        o('私下找领导谈', { at: { stress: 5, charm: 1 }, gamble: { p: 0.45, win: { at: { finance: 3 }, rep: { industry: 3 }, tag: '私下沟通后争取到了机会' }, lose: { at: { happiness: -3 }, npc: { '上司': { favor: -3 } }, tag: '私下找领导谈没有效果' }, winText: '领导说会考虑你的想法。', loseText: '领导说这次先这样，明年再看。' } }),
        o('不争，做好手上的事', { at: { stress: -2, happiness: 1 }, rep: { industry: -2 }, tag: '放弃了部门内的晋升竞争' })
      ]
    }),
    ev({
      id: 'r_school_district', type: 'random', stage: '中年', weight: 3,
      cond: function (g) { return hasChild(g) && g.age <= 45; },
      title: '学区与摇号',
      text: '孩子明年上小学，片区对口的学校一般。同事说可以买另一片区的老破小，总价高但能落户，读完再卖。你算了一下，首付要再凑六十万。',
      opts: [
        o('咬牙换学区房', { house: { factor: 1.3, down: 0.4 }, at: { stress: 9, happiness: 2 }, npc: { '子女': { favor: 8 } }, tag: '为了孩子上学换了学区房' }, { hint: '债务压力很大' }),
        o('就近入学', { at: { happiness: 1, finance: 2 }, tag: '孩子就近上了普通小学' }),
        o('报民办，交学费', { money: { cash: -30000 }, at: { stress: 3 }, npc: { '子女': { favor: 5 } }, tag: '孩子上了民办小学' }, { hint: '每年一笔学费' })
      ]
    }),
    ev({
      id: 'r_borrow_money', type: 'random', stage: '中年', weight: 3,
      cond: function (g) { return g.money.cash > 20000; },
      title: '亲戚开口借钱',
      text: '表姐打电话来，说孩子要做手术，还差五万，问你能不能周转一下，年底还。你知道她家这些年一直不太宽裕，也知道年底往往还不上。',
      opts: [
        o('借五万', { money: { cash: -50000 }, npc: { '母亲': { favor: 6 } }, at: { stress: 2 }, flag: { event: 'c_promise2', delay: 3, mark: 'lent_relative', note: '中年时借给亲戚五万' }, tag: '借给亲戚五万块钱' }, { hint: '大概率要不回来' }),
        o('借一万，说只能帮这么多', { money: { cash: -10000 }, npc: { '母亲': { favor: 3 } }, tag: '只借给亲戚一小部分钱' }),
        o('说自己也紧张', { npc: { '母亲': { favor: -5 } }, at: { happiness: -2 }, tag: '拒绝了亲戚的借钱请求' })
      ]
    }),
    ev({
      id: 'r_renovate', type: 'random', stage: '中年', weight: 2,
      cond: function (g) { return g.house.owned; },
      title: '旧房翻新',
      text: '住了十几年的房子，水管开始渗，墙皮也起了。装修队报价八万，说厨房和卫生间一起做，工期两个月。你们得先租房子过渡。',
      opts: [
        o('彻底翻新', { money: { cash: -80000 }, at: { happiness: 5, stress: 4 }, tag: '中年时把旧房彻底翻新了一次' }, { hint: '一大笔支出' }),
        o('只修漏水的地方', { money: { cash: -8000 }, at: { happiness: 1 }, tag: '旧房只做了简单维修' }),
        o('先不动，能住就行', { at: { health: -1, happiness: -2 }, tag: '一直住在没翻新的旧房里' })
      ]
    }),
    ev({
      id: 'r_marriage_flat', type: 'random', stage: '中年', weight: 3,
      cond: function (g) { return married(g); },
      title: '很久没好好说话',
      text: '你和配偶已经很久没有单独吃过饭。晚上各自看手机，孩子睡了，客厅只剩电视的声音。今天她忽然问，你最近是不是有什么心事。',
      opts: [
        o('放下手机，认真聊一晚', { at: { happiness: 5, stress: -3 }, npc: { '配偶': { favor: 10 } }, tag: '中年时和配偶认真谈过一次' }),
        o('说没事，太累了', { at: { happiness: -2, stress: 1 }, npc: { '配偶': { favor: -6 } }, flag: { event: 'c_marriage_crisis', delay: 5, mark: 'marriage_distant', note: '中年时夫妻长期缺乏沟通' }, tag: '夫妻之间渐渐没话说' }),
        o('提议周末出去吃顿饭', { money: { cash: -300 }, at: { happiness: 3 }, npc: { '配偶': { favor: 6 } }, tag: '中年时偶尔和配偶出去吃饭' })
      ]
    }),
    ev({
      id: 'r_layoff_rumor', type: 'random', stage: '中年', weight: 3, repeatable: true,
      cond: function (g) { return !!g.job.id && g.age >= 33; },
      title: '裁员传闻',
      text: '公司群里在传下个月要优化一批人，名单按部门下指标。你所在的组去年业绩一般，领导最近开会时脸色不太好。有人已经开始改简历。',
      opts: [
        o('提前准备，更新简历', { at: { stress: 3, knowledge: 2 }, set: { prepared_job_hunt: true }, tag: '裁员传闻时提前准备了简历' }),
        o('主动找领导表态', { at: { stress: 4, charm: 2 }, gamble: { p: 0.5, win: { npc: { '上司': { favor: 8 } }, tag: '裁员前得到了领导的表态' }, lose: { at: { happiness: -3 }, tag: '找领导表态没有得到回应' }, winText: '领导说你的位置暂时稳。', loseText: '领导只说等通知。' } }),
        o('照常上班，不掺和', { at: { stress: -1 }, gamble: { p: 0.55, win: { tag: '裁员没有轮到' }, lose: { at: { stress: 8, happiness: -6 }, flag: { event: 'c_unemployed', delay: 1, mark: 'layoff_mid', note: '中年被裁员' }, tag: '中年时被公司裁员' }, winText: '名单下来，没有你。', loseText: 'HR 找你谈话，赔偿是 N+1。' } })
      ]
    }),
    ev({
      id: 'r_teeth', type: 'random', stage: '中年', weight: 2,
      title: '牙疼',
      text: '右边一颗牙疼了半个月，吃硬的就不行。牙科诊所拍片后说要做根管，加牙冠一颗三千多。医生说再拖下去可能要拔。你算了算这个月的开销，有点犹豫。',
      opts: [
        o('做根管和牙冠', { money: { cash: -3500 }, at: { health: 3, happiness: 2 }, tag: '中年时花钱做了根管治疗' }),
        o('先开点药撑着', { money: { cash: -200 }, at: { health: -2, happiness: -1 }, tag: '牙疼一直拖着没治' }),
        o('直接拔掉', { money: { cash: -800 }, at: { health: 1, happiness: -2 }, tag: '牙疼最后拔了牙' })
      ]
    }),
    ev({
      id: 'r_old_friend_call', type: 'random', stage: '中年', weight: 2,
      title: '多年不见的朋友',
      text: '一个十几年没联系的朋友突然打电话，寒暄了几句，问你最近怎么样。他说自己换了城市，孩子也上初中了。你们聊了四十分钟，最后说改天聚。',
      opts: [
        o('约个时间真的见面', { money: { cash: -200 }, at: { happiness: 4 }, npc: { '朋友': { favor: 10 } }, tag: '中年时和多年不见的朋友重新联系' }),
        o('客气几句，没下文', { at: { happiness: 1 }, npc: { '朋友': { favor: 2 } }, tag: '和旧朋友只是客气寒暄' }),
        o('聊完就放下了', { at: { happiness: -1 }, tag: '中年以后朋友越来越少' })
      ]
    })
  ]);

  /* ---------------- 中老年 56–75 ---------------- */
  add([
    ev({
      id: 'r_retire_rhythm', type: 'random', stage: '中老年', weight: 3,
      cond: function (g) { return g.age <= 62; },
      title: '退休后的第一个月',
      text: '不用打卡的第一个月，你每天六点还是准时醒。阳台上晒着洗好的衣服，电视里放着早间新闻。你忽然不知道上午该干什么，翻了翻手机，通讯录里一半人还在上班。',
      opts: [
        o('报个老年大学', { money: { cash: -1200 }, at: { happiness: 6, knowledge: 3, stress: -4 }, npc: { '朋友': { favor: 6 } }, tag: '退休后报了老年大学' }),
        o('每天去公园走走', { at: { health: 4, happiness: 3, stress: -3 }, tag: '退休后养成了逛公园的习惯' }),
        o('在家看电视，哪儿也不去', { at: { health: -3, happiness: -3 }, tag: '退休后生活变得封闭' })
      ]
    }),
    ev({
      id: 'r_square_dance', type: 'random', stage: '中老年', weight: 3,
      title: '楼下的广场舞',
      text: '小区广场每晚七点开始放音乐，跳的人不少。邻居阿姨拉你一起，说活动活动筋骨。你担心自己跟不上，也担心楼上住户嫌吵。',
      opts: [
        o('去跳，站后排', { at: { health: 4, happiness: 5, stress: -3 }, npc: { '朋友': { favor: 6 } }, tag: '退休后开始跳广场舞' }),
        o('不跳，在旁边看', { at: { happiness: 1, health: 1 }, tag: '常在广场边看别人跳舞' }),
        o('嫌吵，关窗待在家', { at: { happiness: -2, health: -2 }, tag: '对广场舞一直很排斥' })
      ]
    }),
    ev({
      id: 'r_grandchild', type: 'random', stage: '中老年', weight: 3,
      cond: function (g) { return hasChild(g) && g.age <= 72; },
      title: '帮忙带孙辈',
      text: '子女打电话来，说两口子工作忙，想让孩子周末过来住。孩子三岁，正是闹的时候。你身体还行，但腰最近不太好。你和老伴商量了一晚上，也没拿定主意。',
      opts: [
        o('答应，每周带两天', { at: { health: -5, happiness: 5, stress: 3 }, npc: { '子女': { favor: 10 } }, tag: '退休后帮忙带孙辈' }, { hint: '很耗精力' }),
        o('只偶尔带，不能长期', { at: { health: -1, happiness: 3 }, npc: { '子女': { favor: 3 } }, tag: '只偶尔帮子女带孩子' }),
        o('说自己身体吃不消', { at: { happiness: -2 }, npc: { '子女': { favor: -8 } }, tag: '拒绝了长期帮子女带孩子' })
      ]
    }),
    ev({
      id: 'r_bp', type: 'random', stage: '中老年', weight: 3, repeatable: true,
      title: '血压偏高',
      text: '社区义诊量了血压，一百五十八。医生让你少盐少油，规律吃药，别自己停。你觉得没什么感觉，邻居说吃药伤肾，他就不吃。',
      opts: [
        o('按医生说的吃药', { money: { cash: -1200 }, at: { health: 4, stress: -1 }, set: { on_bp_med: true }, tag: '中老年开始规律服用降压药' }),
        o('先控制饮食，观察一段', { at: { health: 1, stress: 1 }, gamble: { p: 0.55, win: { at: { health: 2 }, tag: '靠饮食控制住了血压' }, lose: { at: { health: -5 }, tag: '血压没控制住' }, winText: '复查时降了一点。', loseText: '还是高，医生让你必须吃药。' } }),
        o('听邻居的，不吃药', { at: { health: -5 }, flag: { event: 'c_hospital', delay: 6, mark: 'bp_untreated', note: '高血压长期不治疗' }, tag: '高血压一直没吃药' }, { hint: '风险会累积' })
      ]
    }),
    ev({
      id: 'r_old_travel', type: 'random', stage: '中老年', weight: 2,
      cond: function (g) { return g.money.cash > 20000 && g.attrs.health >= 45; },
      title: '老年旅行团',
      text: '旅行社在小区门口摆摊，云南六日游，一千九百八，含购物点。老伴想去，说辛苦一辈子该出去看看。你担心行程太赶，身体受不了。',
      opts: [
        o('报名，出去走走', { money: { cash: -4000 }, at: { happiness: 8, stress: -3, health: -2 }, npc: { '配偶': { favor: 8 } }, tag: '和老伴参加过一次老年旅行团' }, { hint: '行程比较赶' }),
        o('自己去，不跟团', { money: { cash: -6000 }, at: { happiness: 6, health: -1 }, tag: '自己规划了一次旅行' }),
        o('不去了，省点钱', { at: { happiness: -2 }, npc: { '配偶': { favor: -4 } }, tag: '放弃了退休后出去旅行的机会' })
      ]
    }),
    ev({
      id: 'r_old_class_reunion', type: 'random', stage: '中老年', weight: 2,
      title: '同学会',
      text: '老同学在群里组织三十年聚会，AA 制，每人三百。有人发了毕业照，你一眼认出自己站在最后一排。群里有人问你现在做什么，你没急着回。',
      opts: [
        o('去，见见老朋友', { money: { cash: -300 }, at: { happiness: 5 }, npc: { '同学': { favor: 8 } }, tag: '参加过三十年同学会' }),
        o('不去，在群里发个红包', { money: { cash: -200 }, at: { happiness: 1 }, tag: '没参加同学会但在群里发了红包' }),
        o('退群，不想应酬', { at: { happiness: -2 }, npc: { '同学': { favor: -6 } }, tag: '退出了老同学群' })
      ]
    }),
    ev({
      id: 'r_health_product', type: 'random', stage: '中老年', weight: 3,
      title: '保健品讲座',
      text: '社区活动室在办免费健康讲座，听完发鸡蛋。讲课的人说他们的产品能软化血管，一个疗程三千八。台下不少老人当场买了。',
      opts: [
        o('买一个疗程', { money: { cash: -3800 }, at: { health: -3, happiness: 2 }, tag: '买过保健品' }),
        o('只领鸡蛋，不买', { at: { happiness: 1, health: -1 }, tag: '听过保健品讲座但没有买' }),
        o('劝旁边老人别买', { at: { stress: 2, happiness: 3 }, rep: { society: 3 }, npc: { '朋友': { favor: 4 } }, tag: '在保健品讲座上劝住了别人' })
      ]
    }),
    ev({
      id: 'r_house_repair_old', type: 'random', stage: '中老年', weight: 2,
      cond: function (g) { return g.house.owned; },
      title: '老房子的电梯',
      text: '小区要加装电梯，一楼二楼不同意，说挡光又吵。六楼七楼最积极。你家在四楼，居委会来征求意见，说费用按楼层分摊。楼里为这事已经吵了两个月。',
      opts: [
        o('同意，出分摊费', { money: { cash: -20000 }, at: { health: 3, happiness: 3 }, tag: '同意老楼加装电梯并出了钱' }, { hint: '一笔不小的分摊' }),
        o('不同意，觉得太贵', { at: { health: -1, happiness: -1 }, npc: { '朋友': { favor: -5 } }, tag: '反对老楼加装电梯' }),
        o('看邻居怎么定', { at: { happiness: 1 }, tag: '对加装电梯没有明确态度' })
      ]
    }),
    ev({
      id: 'r_community_volunteer', type: 'random', stage: '中老年', weight: 2,
      title: '社区值守',
      text: '小区招志愿者，每天在门口值两个小时班，登记外来车辆。居委会说没有报酬，年底发点米面油。你时间不少，就是怕跟人起冲突。',
      opts: [
        o('报名，每周值三天', { at: { happiness: 4, stress: 2, health: -1 }, rep: { society: 6 }, npc: { '朋友': { favor: 5 } }, tag: '退休后在社区做志愿者' }),
        o('偶尔去帮个忙', { at: { happiness: 2 }, rep: { society: 2 }, tag: '偶尔参加社区志愿活动' }),
        o('不去，在家清静', { at: { happiness: -1 }, tag: '很少参加社区活动' })
      ]
    }),
    ev({
      id: 'r_old_neighbor', type: 'random', stage: '中老年', weight: 2,
      title: '对门的老两口',
      text: '对门住着一对老夫妻，儿女在外地。这周老爷子住院，老太太一个人上下楼不方便。她敲门问你，能不能帮忙买点菜。你想起自己以后也会有这一天。',
      opts: [
        o('每周帮她买两次菜', { money: { cash: -300 }, at: { happiness: 5 }, rep: { society: 4 }, npc: { '朋友': { favor: 8 } }, tag: '常年帮对门老人买菜' }),
        o('帮这一次，后面再说', { at: { happiness: 2 }, tag: '帮过邻居一次小忙' }),
        o('说自己也不方便', { at: { happiness: -2 }, tag: '拒绝了邻居的求助' })
      ]
    })
  ]);

  /* ---------------- 晚年 76+ ---------------- */
  add([
    ev({
      id: 'r_fall', type: 'random', stage: '晚年', weight: 3, repeatable: true,
      title: '浴室里滑了一下',
      text: '早上洗澡时地面有点滑，你扶了一下墙才没摔倒，但膝盖还是扭了一下。坐在马桶盖上缓了十分钟，才慢慢站起来。家里没有装扶手。',
      opts: [
        o('去医院检查', { money: { cash: -2000 }, at: { health: 2, stress: 2 }, tag: '晚年摔过一次去了医院' }),
        o('自己揉揉，没跟子女说', { at: { health: -3, happiness: -2 }, gamble: { p: 0.6, win: { tag: '摔了一下没大碍' }, lose: { at: { health: -8 }, set: { mobility_issue: true }, tag: '摔倒后行动不便' }, winText: '几天后能正常走路了。', loseText: '膝盖一直肿，后来走路要靠拐杖。' } }),
        o('让子女来装扶手', { money: { cash: -800 }, at: { happiness: 3, health: 2 }, npc: { '子女': { favor: 3 } }, tag: '家里装了防滑扶手' })
      ]
    }),
    ev({
      id: 'r_caregiver', type: 'random', stage: '晚年', weight: 3,
      cond: function (g) { return g.money.cash > 30000 || hasChild(g); },
      title: '要不要请护工',
      text: '你一个人做饭越来越吃力，洗澡也怕出事。家政公司报价，住家护工一个月六千，白班四千。子女说可以分摊，你舍不得这个钱。',
      opts: [
        o('请住家护工', { money: { cash: -72000 }, at: { health: 5, happiness: 3, stress: -5 }, tag: '晚年请了住家护工' }, { hint: '每年七万多' }),
        o('请白班，晚上自己来', { money: { cash: -48000 }, at: { health: 2, happiness: 2 }, tag: '晚年请了白班护工' }),
        o('不请，能省则省', { at: { health: -4, happiness: -2 }, tag: '晚年没有请护工' })
      ]
    }),
    ev({
      id: 'r_hearing', type: 'random', stage: '晚年', weight: 2,
      title: '听不清了',
      text: '电视音量越开越大，子女跟你说话要提高声音。去医院测了听力，医生说中度下降，建议配助听器，一对八千。你觉得贵，也怕戴上显老。',
      opts: [
        o('配助听器', { money: { cash: -8000 }, at: { happiness: 5, charm: 2 }, tag: '晚年配了助听器' }),
        o('先配一只', { money: { cash: -4000 }, at: { happiness: 2 }, tag: '只配了一只助听器' }),
        o('不配，让别人说大声点', { at: { happiness: -3, charm: -2 }, tag: '晚年听力下降但没有配助听器' })
      ]
    }),
    ev({
      id: 'r_old_photo', type: 'random', stage: '晚年', weight: 2,
      title: '旧相册',
      text: '收拾柜子翻出一本相册，里面有你二十多岁时的照片，还有父母年轻时的样子。你坐在床边看了很久，想起很多已经不在的人。',
      opts: [
        o('把照片拍下来发给子女', { at: { happiness: 4 }, npc: { '子女': { favor: 4 } }, tag: '晚年把老照片整理给了子女' }),
        o('一个人慢慢看完', { at: { happiness: 1, stress: -2 }, tag: '晚年常一个人翻旧相册' }),
        o('合上，不想看了', { at: { happiness: -2 }, tag: '晚年不太愿意回忆过去' })
      ]
    }),
    ev({
      id: 'r_balcony_garden', type: 'random', stage: '晚年', weight: 2,
      title: '阳台上的花',
      text: '阳台那盆君子兰养了七八年，今年第一次抽花箭。你每天早晚各看一次，怕水多了烂根，又怕太阳太晒。楼下邻居说开花的时候告诉他一声。',
      opts: [
        o('认真养，等它开', { at: { happiness: 5, health: 1 }, tag: '晚年养了一盆开花的君子兰' }),
        o('送一半给邻居', { at: { happiness: 3 }, npc: { '朋友': { favor: 5 } }, tag: '把花分给了邻居' }),
        o('懒得管了', { at: { happiness: -1 }, tag: '晚年没什么心思养花' })
      ]
    }),
    ev({
      id: 'r_birthday_old', type: 'random', stage: '晚年', weight: 2, repeatable: true,
      title: '又一个生日',
      text: '子女订了个小蛋糕，孙辈在视频里唱生日歌。蜡烛插了太多根，你吹的时候有点喘。吃完蛋糕，大家在客厅说话，你靠在小沙发上，觉得有点累。',
      opts: [
        o('撑到大家走', { at: { health: -1, happiness: 4 }, npc: { '子女': { favor: 5 } }, tag: '晚年生日时家里人来齐了' }),
        o('提前回房间休息', { at: { health: 1, happiness: 1 }, tag: '晚年生日提前回了房间' }),
        o('让他们别每年折腾', { at: { happiness: -2 }, npc: { '子女': { favor: -3 } }, tag: '晚年不太愿意过生日' })
      ]
    }),
    ev({
      id: 'r_hospital_visit', type: 'random', stage: '晚年', weight: 3, repeatable: true,
      title: '又要住院',
      text: '这半年第三次因为胸闷住院。病房里换了几拨人，护士已经认识你。医生说这次要观察一周，做造影看看血管情况。走廊里也摆着加床，消毒水味很重。',
      opts: [
        o('听医生的，做造影', { money: { cash: -12000 }, at: { health: 5, stress: 3 }, tag: '晚年做过心脏造影' }, { hint: '检查费用不低' }),
        o('保守治疗，先出院', { at: { health: -5 }, gamble: { p: 0.6, win: { tag: '保守治疗稳住了病情' }, lose: { at: { health: -10 }, tag: '出院后病情反复' }, winText: '住了五天，症状缓解。', loseText: '回家两周又进了急诊。' } }),
        o('签字放弃进一步检查', { at: { health: -8, happiness: -3 }, tag: '晚年放弃了进一步检查' })
      ]
    })
  ]);

  /* =========================================================
     四、兜底日常事件（无可触发事件时使用）
     ========================================================= */
  add([
    ev({
      id: 'd_baby', type: 'daily', stage: '婴幼儿', weight: 1, repeatable: true,
      title: '平静的一年',
      text: '这一年没有发生什么大事。你学会了几个新词，个子长高了一截，家里添了几件新衣服。母亲把你抱在腿上，说时间过得真快。',
      opts: [
        o('按部就班长大', { at: { health: 2, happiness: 2 }, tag: '婴幼儿时期平淡而安稳' }),
        o('多带出门见人', { at: { charm: 3, happiness: 1 }, tag: '婴幼儿时期常被带出门见人' })
      ]
    }),
    ev({
      id: 'd_child', type: 'daily', stage: '童年', weight: 1, repeatable: true,
      title: '普通的一年',
      text: '这一年和往年差不多。上学、写作业、周末看电视，门口那棵树的叶子落了又长。你换了个高一点的年级，认识了两个新同学。',
      opts: [
        o('继续读书', { at: { knowledge: 2, happiness: 1 }, tag: '童年波澜不惊地过去了一年' }),
        o('报个便宜的兴趣班', { money: { cash: -2000 }, at: { knowledge: 2, happiness: 1, stress: 1 }, tag: '童年时报过兴趣班' })
      ]
    }),
    ev({
      id: 'd_teen', type: 'daily', stage: '少年', weight: 1, repeatable: true,
      title: '没什么特别的一年',
      text: '这一年没什么可说的。成绩在班里不上不下，作业比去年多，周末越来越少。你偶尔会想起小时候的暑假，但很快又要准备下一次考试。',
      opts: [
        o('把日子过下去', { at: { knowledge: 1, stress: 1 }, tag: '少年时期平淡的一年' }),
        o('周末去补课', { money: { cash: -3000 }, at: { knowledge: 3, health: -1, stress: 2 }, tag: '少年时周末长期补课' })
      ]
    }),
    ev({
      id: 'd_youth', type: 'daily', stage: '青年', weight: 1, repeatable: true,
      title: '又一年过去了',
      text: '这一年过得很快。工作或学习照旧，工资涨了一点，房租也涨了一点。你偶尔和朋友吃顿饭，更多时候是下班回家，看会儿手机就睡了。',
      opts: [
        o('照常生活', { at: { stress: 1, finance: 1 }, tag: '青年时期按部就班的一年' }),
        o('下班后接点私活', { money: { cash: 4000 }, at: { health: -1, finance: 2, stress: 2 }, tag: '青年时长期接私活补贴收入' })
      ]
    }),
    ev({
      id: 'd_mid', type: 'daily', stage: '中年', weight: 1, repeatable: true,
      title: '平稳的一年',
      text: '这一年家里没出什么大事。工作照旧，孩子的成绩起起伏伏，父母身体还撑得住。你和配偶偶尔为钱的事争两句，第二天也就过去了。',
      opts: [
        o('把家撑住', { at: { stress: 1, happiness: 1 }, tag: '中年时期平稳的一年' }),
        o('抽时间锻炼', { at: { health: 4, stress: -2, happiness: 1 }, tag: '中年时开始规律锻炼' })
      ]
    }),
    ev({
      id: 'd_senior', type: 'daily', stage: '中老年', weight: 1, repeatable: true,
      title: '慢慢的一年',
      text: '这一年节奏慢了下来。早上买菜，中午做饭，下午在小区里走走。老朋友有的搬走了，有的身体不好。你开始习惯一个人待着。',
      opts: [
        o('安静地过', { at: { health: -1, happiness: 1 }, tag: '中老年时期安静的一年' }),
        o('去社区活动室坐坐', { at: { happiness: 3, charm: 1 }, tag: '中老年时常去社区活动室' })
      ]
    }),
    ev({
      id: 'd_elder', type: 'daily', stage: '晚年', weight: 1, repeatable: true,
      title: '又熬过一年',
      text: '这一年身体又差了一点。走路慢，睡觉浅，吃饭也没什么胃口。子女偶尔来看你，坐一会儿就走。你把每天要吃的药分在小盒子里。',
      opts: [
        o('继续熬着', { at: { health: -2, happiness: -1 }, tag: '晚年又平静地熬过了一年' }),
        o('请个钟点工帮忙', { money: { cash: -9000 }, at: { health: 2, happiness: 2 }, tag: '晚年请了钟点工照料日常' })
      ]
    })
  ]);

  LS.EVENTS = E;
  LS.EVENT_INDEX = {};
  for (var i = 0; i < E.length; i++) LS.EVENT_INDEX[E[i].id] = E[i];

})();

/* =========================================================
   v2：事件三档分级（可审计）+ 隐患/求职/升学新事件
   ========================================================= */
(function () {
  var LS = window.LS;
  var E = LS.EVENTS;

  /* 健康负面事件清单：只作为隐患延迟回响，不再无条件随机发生 */
  var HEALTH_NEG = {
    c_hospital: { riskKey: '', riskMin: 30 },
    c_liver: { riskKey: 'badDiet', riskMin: 45 },
    c_lung: { riskKey: 'lateNight', riskMin: 45 },
    c_back: { riskKey: 'noExercise', riskMin: 45 },
    r_health_warning: { riskKey: '', riskMin: 30 },
    r_bp: { riskKey: 'highStress', riskMin: 45 },
    f_chronic63: { riskKey: '', riskMin: 60 },
    f_bigill82: { riskKey: '', riskMin: 70 }
  };

  /* 仅重大人生分岔标记为“命运岔路”，其余强制节点仍是日常推进 */
  var CROSSROAD_IDS = {
    f_love27: 1, f_house29: 1, f_child30: 1, f_child33: 1, f_graduate22: 1,
    f_crisis35: 1, f_ceiling46: 1, f_retire: 1, f_gaokao: 1, f_retake19: 1,
    f_family_money: 1, f_parent_sick42: 1, v2_exam_path: 1
  };

  E.forEach(function (e) {
    if (!e.tier) {
      if (e.type === 'causal') e.tier = 'echo';
      else if (e.type === 'forced') e.tier = CROSSROAD_IDS[e.id] ? 'crossroad' : 'daily';
      else e.tier = 'daily';
    }
    if (CROSSROAD_IDS[e.id]) e.tier = 'crossroad';
    var hn = HEALTH_NEG[e.id];
    if (hn) {
      e.healthNeg = true;
      e.riskKey = hn.riskKey;
      e.riskMin = hn.riskMin;
      e.tier = 'echo';
      e.type = 'causal';
      /* 重病/慢性病不再由年龄强制触发，改由隐患阈值延迟生成 */
      if (e.id === 'f_chronic63' || e.id === 'f_bigill82') {
        e.age = undefined;
        e.prio = Math.max(e.prio || 0, 85);
      }
    }
    if (e.tier === 'echo' && !e.art) e.art = 'clinic';
    (e.opts || []).forEach(function (o) {
      if (!o.tone) {
        if (o.gamble) o.tone = 'risk';
        else if (e.tier === 'crossroad' && /不|独身|单身|换|转|离开|放弃|创业/.test(o.label)) o.tone = 'switch';
        else if (/稳|保守|继续|维持|观望/.test(o.label)) o.tone = 'safe';
        else if (/转|换|离开|创业|赌|冲/.test(o.label)) o.tone = 'switch';
        else if (e.tier === 'crossroad' && /买|投入|贷|拼/.test(o.label)) o.tone = 'risk';
        else o.tone = 'safe';
      }
      var fl = o.fx && o.fx.flag;
      if (fl) {
        var arr = Array.isArray(fl) ? fl : [fl];
        o.tags = arr.map(function (x) { return x.event; });
      }
      if (!o.tags) o.tags = [];
    });
  });

  /* ---------------- 健康隐患三档回响 ---------------- */
  function add(ev) { E.push(ev); }

  add({
    id: 'v2_risk_warn', type: 'causal', tier: 'echo', stage: '青年', age: 0,
    prio: 72, repeatable: false, art: 'clinic', weight: 1,
    title: '体检报告上的几行小字',
    dynText: function (g) {
      var k = (g.echoInfo && g.echoInfo.riskKey) || 'highStress';
      return '体检报告上出现几项不太好看的指标，医生把原因归结为{{risk}}。他说这还不算病，但如果再这样下去，几年后就会变成麻烦，现在调整还来得及。';
    },
    cond: function (g) { return g.age >= 18; },
    opts: [
      { label: '开始调整：早睡、运动、规律吃饭', hint: '隐患明显下降 · 花一点钱', tone: 'safe',
        fx: { risk: { lateNight: -12, highStress: -10, noExercise: -12, badDiet: -12 }, money: { cash: -2500 }, at: { health: 3, happiness: 2 }, set: { regular_checkup: true } } },
      { label: '预约一次复查，听医生的安排', hint: '隐患小幅下降 · 花钱较多', tone: 'safe',
        fx: { risk: { lateNight: -6, highStress: -6, noExercise: -6, badDiet: -6 }, money: { cash: -6000 }, at: { health: 2 }, set: { regular_checkup: true } } },
      { label: '先放着，忙完这阵再说', hint: '隐患继续累积 · 压力上升', tone: 'risk',
        fx: { risk: { lateNight: 6, highStress: 6 }, at: { stress: 3 }, tag: '体检预警被搁置' } }
    ]
  });

  add({
    id: 'v2_risk_light', type: 'causal', tier: 'echo', stage: '青年', age: 0,
    prio: 66, repeatable: false, art: 'clinic', healthNeg: true, weight: 1,
    title: '身体开始给出信号',
    dynText: function (g) {
      return '{{risk}}积累了一段时间，身体开始给出信号：睡不解乏、白天发沉，偶尔头晕。检查结果是轻度问题，医生说可逆，但需要真正停下来调整，而不是靠忍。';
    },
    cond: function (g) { return g.age >= 22; },
    opts: [
      { label: '请一段假，认真休息与调理', hint: '健康回升 · 隐患下降 · 收入受影响', tone: 'safe',
        fx: { risk: { lateNight: -18, highStress: -18, noExercise: -14, badDiet: -14 }, at: { health: 5, stress: -8, happiness: 3 }, money: { cash: -12000 }, set: { exercise: true } } },
      { label: '吃药顶着，工作不能停', hint: '短期稳住 · 隐患继续累积', tone: 'risk',
        fx: { risk: { highStress: 8, lateNight: 6 }, at: { health: -3, stress: 5 }, healthNeg: true, tag: '轻症靠药物硬顶' } }
    ]
  });

  add({
    id: 'v2_risk_chronic', type: 'causal', tier: 'echo', stage: '中年', age: 0,
    prio: 90, repeatable: false, art: 'clinic', healthNeg: true, weight: 1,
    title: '长期隐患有了明确诊断',
    dynText: function (g) {
      return '拖了几年，{{risk}}带来的问题终于明确：医生给出了慢性病的诊断，并说明这与长期的生活方式直接相关。治疗可以控制，但不可能当作没发生过。';
    },
    cond: function (g) { return g.age >= 30; },
    opts: [
      { label: '接受系统治疗，调整生活节奏', hint: '控制病情 · 花钱较多 · 压力下降', tone: 'safe',
        fx: { risk: { lateNight: -30, highStress: -25, noExercise: -25, badDiet: -30 }, money: { cash: -45000 }, at: { health: -2, stress: -6 }, set: { on_med: true, regular_checkup: true },
          bc: { key: 'illness', text: '检查确认了慢性病。你开始接受系统治疗，病情得到控制，但生活节奏必须长期调整。', changes: '慢性病确诊 · 医疗支出 -4.5 万 · 隐患大幅下降' } } },
      { label: '只拿点药，继续原来的生活', hint: '病情反复 · 风险持续', tone: 'risk',
        fx: { risk: { lateNight: 6, highStress: 8 }, at: { health: -8, stress: 6 }, healthNeg: true, tag: '慢性病未系统治疗' } }
    ]
  });

  /* ---------------- 主动体检 ---------------- */
  add({
    id: 'v2_checkup', type: 'random', tier: 'daily', stage: '青年', age: 0,
    prio: 55, repeatable: true, cooldown: 4, weight: 1,
    title: '一次主动体检',
    text: '单位组织了体检，你也可以自己去医院做一套更细的检查。花一笔钱，把身体里那些还没显形的问题提前看清楚，总比等它发作要好。',
    cond: function (g) { return g.age >= 25; },
    opts: [
      { label: '花钱做一次全面体检', hint: '提前发现隐患 · 支出 3000', tone: 'safe',
        fx: { money: { cash: -3000 }, at: { health: 2 }, set: { regular_checkup: true },
          risk: { lateNight: -5, highStress: -5, noExercise: -5, badDiet: -5 }, tag: '主动做了一次全面体检' } },
      { label: '只做单位的基础项目', hint: '省钱 · 只能看到大概', tone: 'safe',
        fx: { at: { health: 1 }, tag: '参加了单位基础体检' } },
      { label: '不去，身体自己知道', hint: '省下体检费 · 隐患继续累积', tone: 'risk',
        fx: { risk: { lateNight: 2, highStress: 2 }, at: { stress: 1 } } }
    ]
  });

  /* ---------------- 待业衍生 ---------------- */
  add({
    id: 'v2_unemployed', type: 'causal', tier: 'echo', stage: '青年', age: 0,
    prio: 62, repeatable: true, cooldown: 2, weight: 1,
    title: '待业的日子',
    text: '没有工作的第二年，存款明显变薄。家里人开始问你要不要先回去住，朋友也不再主动约你。你一边投简历，一边开始怀疑是不是该把要求再降一点。',
    cond: function (g) { return g.age >= 19 && !g.job.id && g.flags && g.flags.unemployed; },
    opts: [
      { label: '搬回家住，省下房租', hint: '省钱 · 父母好感下降 · 压力上升', tone: 'switch',
        fx: { money: { cash: 6000 }, at: { stress: 5, happiness: -3 }, npc: { 父亲: { favor: -6 }, 母亲: { favor: -6 } }, tag: '待业期间搬回父母家' } },
      { label: '降低预期，先接一份零工', hint: '有收入 · 履历不再空白', tone: 'safe',
        fx: { job: 'gig', at: { stress: -3, happiness: -1 }, tag: '待业后先做零工过渡' } },
      { label: '继续集中投简历，不将就', hint: '花钱 · 压力上升', tone: 'risk',
        fx: { money: { cash: -4000 }, at: { stress: 6, knowledge: 2 }, needJob: true } }
    ]
  });

  /* ---------------- 考研 / 考公：升学命运岔路 ---------------- */
  add({
    id: 'v2_exam_path', type: 'forced', tier: 'crossroad', age: 22, stage: '青年',
    prio: 88, repeatable: false, art: 'exam',
    title: '命运岔路：继续读书，还是先挣钱',
    text: '毕业就在眼前。考研、考公、直接找工作，三条路都有人走，也都没有保证。家里希望你再读几年，招聘网站上的岗位又要求工作经验。你必须先选一条。',
    cond: function (g) { return g.edu.level >= 4 && !g.marks.exam_path; },
    opts: [
      { label: '准备考研，把学历再往上推一层', hint: '成功率取决于学识 · 备考消耗金钱与精力', tone: 'risk',
        fx: { set: { exam_path: true, prep_kaoyan: true }, money: { cash: -5000 }, at: { stress: 8, happiness: -2 },
          flag: { event: 'v2_exam_result', delay: 1, mark: 'exam_done', note: '考研备考' } } },
      { label: '报考公务员，换一条稳定路径', hint: '录取率低 · 上岸后稳定', tone: 'switch',
        fx: { set: { exam_path: true, prep_gong: true }, money: { cash: -4000 }, at: { stress: 7 },
          flag: { event: 'v2_exam_result', delay: 1, mark: 'exam_done', note: '考公备考' } } },
      { label: '不考了，直接进入求职市场', hint: '立刻进入求职流程 · 早一年积累经验', tone: 'safe',
        fx: { set: { exam_path: true }, needJob: true, at: { happiness: 2 } } }
    ]
  });

  add({
    id: 'v2_exam_result', type: 'causal', tier: 'echo', stage: '青年', age: 0,
    prio: 78, repeatable: false, art: 'exam', weight: 1,
    title: '备考的结果',
    text: '成绩出来了。这一年你把大部分时间放在书桌上，结果只有两种：上岸，或者回到招聘市场重新开始。',
    opts: [
      { label: '看结果', tone: 'safe', tags: ['exam_result'],
        gamble: {
          p: function (g) { return LS.clamp(0.22 + g.attrs.knowledge * 0.006 + (g.edu.level >= 5 ? 0.1 : 0), 0.18, 0.86); },
          winText: '你上岸了。录取通知到手，接下来是新的学习或岗位安排。',
          win: { unset: { prep_kaoyan: true, prep_gong: true }, bc: { key: 'kaoyan', text: '考试结果公布，你成功上岸。之前的备考投入有了回报。', changes: '录取成功 · 学历/岗位提升' } },
          loseText: '你没有上岸。分数不够，或者岗位太挤。备考的这一年无法收回，只能进入求职。',
          lose: { unset: { prep_kaoyan: true, prep_gong: true }, needJob: true, at: { happiness: -6, stress: 6 }, bc: { key: 'kaoyan', text: '考试结果公布，你没有上岸。备考投入没有换来结果，接下来必须进入求职市场。', changes: '落榜 · 进入求职流程 · 压力 +6' } }
        } }
    ]
  });

  /* ---------------- 职场标签回响 ---------------- */
  add({
    id: 'v2_work_overload', type: 'causal', tier: 'echo', stage: '青年', age: 0,
    prio: 64, repeatable: true, cooldown: 3, weight: 1, art: 'office',
    title: '加班成了默认选项',
    text: '这份工作的加班强度一直很高。项目排期压下来，你连续几周在办公室待到末班车时间。领导说辛苦一下，等这阵过去就好，但你知道下一阵很快会来。',
    cond: function (g) { return g.age >= 23 && g.job.id && g.job.tags && g.job.tags.overtime === '高'; },
    opts: [
      { label: '继续扛，先把项目做完', hint: '收入与评价上升 · 健康与隐患恶化', tone: 'risk',
        fx: { at: { stress: 6, health: -3 }, rep: { industry: 3 }, risk: { lateNight: 8, highStress: 8 }, tag: '长期高强度加班' } },
      { label: '和领导谈边界，减少加班', hint: '压力下降 · 晋升变慢', tone: 'safe',
        fx: { at: { stress: -6, health: 2 }, rep: { industry: -2 }, risk: { lateNight: -6 }, tag: '主动与领导谈工作边界' } },
      { label: '开始看外面的机会', hint: '耗费精力 · 打开换岗可能', tone: 'switch',
        fx: { at: { stress: 2, knowledge: 2 }, money: { cash: -2000 }, quitJob: true, needJob: true, tag: '考虑离开当前岗位' } }
    ]
  });

  /* 毕业/离职不再自动分配工作：强制剧情的“入职”改为进入求职流程 */
  E.forEach(function (e) {
    if (e.type !== 'forced') return;
    (e.opts || []).forEach(function (o) {
      if (o.fx && o.fx.job) {
        delete o.fx.job;
        o.fx.needJob = true;
      }
    });
    if (e.id === 'f_graduate22') {
      if (e.opts[2]) e.opts[2].label = '去大城市闯一闯（进入求职流程）';
      if (e.opts[3]) e.opts[3].label = '回老家发展（进入求职流程）';
    }
    if (e.id === 'f_voc') {
      if (e.opts[1]) { e.opts[1].label = '先进本地工厂做临时工'; e.opts[1].hint = '有收入 · 之后仍需正式求职'; }
      if (e.opts[2]) { e.opts[2].label = '跟师傅学手艺，边干边找机会'; }
    }
  });

  /* 重建索引 */
  LS.EVENT_INDEX = {};
  for (var i = 0; i < E.length; i++) LS.EVENT_INDEX[E[i].id] = E[i];
})();
