/* =========================================================
   job_gates.js — v3.8 四个分流点的就业选项表
   15 岁（中考）/ 18 岁（高考）/ 22 岁（本科毕业）/ 25 岁（硕士毕业）
   说明：
     1) 只声明 LS.JOB_GATES，不修改 index.html 与任何既有文件；
     2) 每个选项落到“具体单位 + 具体岗位 + 第一年处境”；
     3) 每个选项都有取舍：高收入配高健康消耗或高压，轻松配低收入或没前途；
     4) track 为八方向覆盖标签，lineHint 指向 LS.CAREER.PATHS 的主干线。
   ========================================================= */
(function () {
  'use strict';
  var L = window.LS = window.LS || {};
  var G = L.JOB_GATES = L.JOB_GATES || {};

  G.VERSION = '3.8.0-job-gates-1';

  /* ---------------- 学历门槛：字符串 → LS.EDU 数值 ---------------- */
  G.EDU = {
    none: 0, primary: 1, middle: 2, highschool: 3, vocational: 3,
    college: 4, bachelor: 5, master: 6, phd: 7
  };

  /* ---------------- 八方向覆盖标签 ---------------- */
  G.TRACKS = {
    public: '公职（警察 / 公务员 / 教师）',
    medical: '医疗（医生 / 护士）',
    engineering: '工程（设计院 / 施工单位 / 制造厂）',
    research: '科研（考研 / 研究所）',
    business: '商业（销售 / 开店 / 创业）',
    craft: '手艺（厨师 / 技工 / 司机）',
    labor: '体力（外卖 / 工地 / 工厂）',
    outside: '体制外（参军 / 出国 / 待业）'
  };

  /* ---------------- 选项构造：统一字段，缺省补 0 ---------------- */
  function opt(o) {
    return {
      id: o.id,
      label: o.label,
      career: o.career || null,
      gate: o.gate,
      /* 真正落岗的年龄：15/18 岁选的是“读书方向”，不能立刻发这份工资 */
      enterAge: o.enterAge || (o.gate === 15 ? 18 : o.gate),
      track: o.track,
      place: o.place,
      title: o.title,
      income: Number(o.income) || 0,
      healthCost: Number(o.healthCost) || 0,
      stress: Number(o.stress) || 0,
      lineHint: o.lineHint || [],
      firstYear: o.firstYear,
      requires: o.requires || {},
      note: o.note || ''
    };
  }

  function gate(o) {
    var list = [];
    for (var i = 0; i < o.options.length; i++) {
      var it = o.options[i];
      it.gate = o.gate;
      list.push(opt(it));
    }
    o.options = list;
    return o;
  }

  /* =========================================================
     15 岁 · 中考分流：轴是“读不读书”
     ========================================================= */
  G.GATES = [];

  G.GATES.push(gate({
    gate: 15,
    age: 15,
    name: '初中毕业 · 中考',
    axis: '读不读书',
    note: '分数条决定你去哪一栋楼；这一选基本锁死 18 岁的所有可能。',
    options: [
      {
        id: 'g15_key_high',
        label: '进县一中理科实验班，住八人间，第一次月考排到年级 180 名',
        career: null, track: 'research',
        place: '县一中 理科实验班', title: '高一新生',
        income: 0, healthCost: 2, stress: 7,
        lineHint: ['doctor', 'research', 'engineer'],
        firstYear: '早自习 5:50 起床，晚上 10:20 熄灯；择校费 2 万，一个月回一次家',
        requires: { edu: 'middle', score: 'high' },
        note: '上限最高，但这两年半只有卷子，没有别的'
      },
      {
        id: 'g15_normal_high',
        label: '按片区进普高平行班，全校去年一本上线 11 人',
        career: null, track: 'public',
        place: '片区第三中学 高一（7）班', title: '高一新生',
        income: 0, healthCost: 1, stress: 3,
        lineHint: ['teacher', 'civil'],
        firstYear: '作业能抄就抄，晚自习看小说；班主任说你们这届“能出三个本科就烧高香”',
        requires: { edu: 'middle' },
        note: '轻松，但高考天花板肉眼可见'
      },
      {
        id: 'g15_health_voc',
        label: '读市卫生学校护理中专，第三年进县医院实习，端治疗盘',
        career: null, track: 'medical',
        place: '市卫生学校 护理（3+2）', title: '护理中专生',
        income: 600, healthCost: 3, stress: 5,
        lineHint: ['doctor'],
        firstYear: '背解剖图谱背到凌晨，实习第一个月给病人换床单，被家属喊“小姑娘”',
        requires: { edu: 'middle' },
        note: '三年后有编制考试资格，但夜班从 20 岁开始'
      },
      {
        id: 'g15_police_voc',
        label: '考省警校中专班，毕业定向到城郊派出所当辅警',
        career: 'police', track: 'public',
        place: '省警校 中专班', title: '警校学员',
        income: 900, healthCost: 4, stress: 5,
        lineHint: ['police'],
        firstYear: '每天 5 公里加俯卧撑，被子叠成豆腐块；毕业先当两年辅警，月薪 3000',
        requires: { edu: 'middle', score: 'mid' },
        note: '编制要考，辅警不是民警'
      },
      {
        id: 'g15_mechanic_voc',
        label: '进技校汽修专业，两年后去 4S 店当学徒，师傅让先擦三个月车',
        career: 'mechanic', track: 'craft',
        place: '市技工学校 汽修（2+1）', title: '汽修学徒',
        income: 500, healthCost: 3, stress: 3,
        lineHint: ['mechanic'],
        firstYear: '手上永远是机油，冬天洗车冻得开裂；师傅不教拆发动机，只让递扳手',
        requires: { edu: 'middle' },
        note: '手艺吃饭，前三年钱少，出师后不愁活'
      },
      {
        id: 'g15_chef_voc',
        label: '读烹饪中专，毕业进酒楼打荷，一天切 40 斤葱姜',
        career: 'chef', track: 'craft',
        place: '烹饪学校 中式烹调班', title: '打荷',
        income: 500, healthCost: 4, stress: 4,
        lineHint: ['chef'],
        firstYear: '灶台前站 10 小时，右手虎口贴创可贴；师傅姓刘，第一句是“刀要自己磨”',
        requires: { edu: 'middle' },
        note: '入行快，但前五年都在给别人配菜'
      },
      {
        id: 'g15_build_voc',
        label: '读建筑工程学校施工中专，毕业去工地放线，一天走两万步',
        career: null, track: 'engineering',
        place: '市建筑工程学校 施工专业', title: '施工中专生',
        income: 600, healthCost: 4, stress: 4,
        lineHint: ['engineer'],
        firstYear: '第三年进工地实习，跟着工长放线；安全帽带子勒得下巴发红，中午蹲在钢筋堆上吃饭',
        requires: { edu: 'middle' },
        note: '比坐办公室苦，但工地不看学历看能不能扛'
      },
      {
        id: 'g15_econ_voc',
        label: '读中专会计电算化，毕业去小公司做出纳，月薪 2800',
        career: null, track: 'business',
        place: '财经中专 会计电算化', title: '出纳',
        income: 2800, healthCost: 1, stress: 3,
        lineHint: ['shop', 'startup'],
        firstYear: '账做不平自己垫钱；老板让你用私人卡走一笔货款，你犹豫了一晚上',
        requires: { edu: 'middle' },
        note: '坐办公室，但天花板低，随时可能被亲戚顶掉'
      },
      {
        id: 'g15_apprentice',
        label: '跟表哥去装修队当小工，第一天扛水泥上六楼',
        career: null, track: 'labor',
        place: '城南建材市场 装修队', title: '小工',
        income: 1500, healthCost: 7, stress: 5,
        lineHint: ['mechanic'],
        firstYear: '一天 120 元，管两顿饭；粉尘吸到咳嗽，晚上睡在工棚的木板床上',
        requires: { edu: 'middle' },
        note: '来钱快，但二十年后腰和肺都要还债'
      },
      {
        id: 'g15_family_shop',
        label: '回家帮父母看小卖部，每天 6 点拉卷帘门',
        career: 'shop', track: 'business',
        place: '镇上 家庭小卖部', title: '看店',
        income: 800, healthCost: 2, stress: 2,
        lineHint: ['shop'],
        firstYear: '一天卖三百块，赊账记在烟盒背面；一年到头没有周末，同学聚会你去不了',
        requires: { edu: 'middle' },
        note: '不累，但十八岁就看到了五十岁'
      },
      {
        id: 'g15_gang',
        label: '跟台球厅的刀哥看场，第一晚就被人拿酒瓶砸了后脑',
        career: 'gang', track: 'outside',
        place: '老车站 台球厅', title: '看场小弟',
        income: 2000, healthCost: 5, stress: 7,
        lineHint: ['gang'],
        firstYear: '钱按次给，一次 200；派出所来查过一次，刀哥让你说是“帮忙看店的朋友”',
        requires: { edu: 'middle' },
        note: '来钱最快，也最容易进去'
      }
    ]
  }));

  /* =========================================================
     18 岁 · 高考分流：轴是“学历分岔”
     ========================================================= */
  G.GATES.push(gate({
    gate: 18,
    age: 18,
    name: '高中毕业 · 高考',
    axis: '学历分岔',
    note: '专业决定你 22 岁能站在哪个门口；复读和打工是两条不归路。',
    options: [
      {
        id: 'g18_med',
        label: '报临床医学本科（五年制），第一次解剖课摸标本手抖',
        career: 'doctor', track: 'medical',
        place: '省医科大学 临床医学', title: '医学本科生',
        income: 0, healthCost: 2, stress: 6,
        lineHint: ['doctor'],
        firstYear: '学费一年 6000，同届 120 人；寒假在医院见习，站了一整天没座位',
        requires: { edu: 'highschool', score: 'high' },
        note: '25 岁才挣钱，但四十岁以后最稳'
      },
      {
        id: 'g18_police',
        label: '考公安院校侦查学，每天 5 公里，政审查三代',
        career: 'police', track: 'public',
        place: '省警察学院 侦查学', title: '警校生',
        income: 0, healthCost: 5, stress: 5,
        lineHint: ['police'],
        firstYear: '体能测试卡掉一半人；宿舍 6 人，晚上 10 点熄灯，手机统一收走',
        requires: { edu: 'highschool', score: 'mid', body: 'high' },
        note: '毕业走公安联考，入警率高，但一辈子在体制内排队'
      },
      {
        id: 'g18_teacher',
        label: '读师范大学汉语言文学，毕业考县城中学编制，一个岗 80 人抢',
        career: 'teacher', track: 'public',
        place: '省师范大学 汉语言文学', title: '师范生',
        income: 0, healthCost: 1, stress: 3,
        lineHint: ['teacher'],
        firstYear: '三笔字练到手腕酸；大三开始刷教资题，室友都在准备考研',
        requires: { edu: 'highschool', score: 'mid' },
        note: '寒暑假是真的，工资也是真的不高'
      },
      {
        id: 'g18_civil_eng',
        label: '读土木工程本科，大三开始画图，毕业跟项目全国跑',
        career: 'engineer', track: 'engineering',
        place: '省理工大学 土木工程', title: '土木本科生',
        income: 0, healthCost: 3, stress: 5,
        lineHint: ['engineer'],
        firstYear: 'CAD 画到凌晨，力学挂过一次；实习在工地晒脱一层皮，住活动板房',
        requires: { edu: 'highschool', score: 'mid' },
        note: '不愁就业，但常年不在家'
      },
      {
        id: 'g18_cs',
        label: '读计算机本科，大三进外包公司写接口，实习 996',
        career: 'engineer', track: 'engineering',
        place: '省理工大学 计算机科学与技术', title: '计算机本科生',
        income: 0, healthCost: 2, stress: 6,
        lineHint: ['engineer', 'startup'],
        firstYear: '宿舍熄灯后还在改 bug；第一次上线把测试库删了，组长替你背锅',
        requires: { edu: 'highschool', score: 'high' },
        note: '起薪高，三十五岁是道坎'
      },
      {
        id: 'g18_physics',
        label: '进物理学基地班冲保研，班里一半人准备读博',
        career: 'research', track: 'research',
        place: '省大学 物理学基地班', title: '基地班学生',
        income: 0, healthCost: 2, stress: 7,
        lineHint: ['research'],
        firstYear: '四大力学压得喘不过气；跟着老师进实验室，第一年只负责洗瓶子',
        requires: { edu: 'highschool', score: 'high' },
        note: '不读研基本等于转行，读下去是漫长的清贫'
      },
      {
        id: 'g18_finance',
        label: '读金融学本科，毕业进银行做柜员，拉存款指标压得喘不过气',
        career: null, track: 'business',
        place: '财经大学 金融学', title: '金融本科生',
        income: 0, healthCost: 2, stress: 6,
        lineHint: ['startup', 'shop'],
        firstYear: '大四实习站柜台，一天叫 120 个号；亲戚的存款都被你拉了一遍',
        requires: { edu: 'highschool', score: 'mid' },
        note: '体面，但前三年靠家里的人脉'
      },
      {
        id: 'g18_chef_school',
        label: '进烹饪学校两年制班，毕业去酒楼打荷，月薪 3500',
        career: 'chef', track: 'craft',
        place: '烹饪学校 两年制大厨班', title: '打荷',
        income: 3500, healthCost: 4, stress: 4,
        lineHint: ['chef'],
        firstYear: '学费 3 万；第一年练刀工，萝卜切了三百斤，手指缝了四针',
        requires: { edu: 'highschool' },
        note: '出师快，但酒店后厨的等级比学历还硬'
      },
      {
        id: 'g18_mechanic_college',
        label: '读机电大专汽修方向，毕业进修理厂，先换一年机油',
        career: 'mechanic', track: 'craft',
        place: '职业技术学院 机电一体化', title: '汽修工',
        income: 4000, healthCost: 3, stress: 3,
        lineHint: ['mechanic'],
        firstYear: '工装永远洗不干净；师傅让你站在旁边看，看了三个月才让上手',
        requires: { edu: 'highschool' },
        note: '饿不死，也很难发财'
      },
      {
        id: 'g18_repeat',
        label: '复读一年，多花 2 万和 365 天，第二年未必考得更好',
        career: null, track: 'public',
        place: '县一中 复读班', title: '复读生',
        income: 0, healthCost: 3, stress: 8,
        lineHint: ['doctor', 'research', 'civil'],
        firstYear: '教室后墙贴着每个人的目标分数；第二次模考比去年还低 12 分',
        requires: { edu: 'highschool' },
        note: '可能是翻盘，也可能是再输一次'
      },
      {
        id: 'g18_army',
        label: '参军入伍，去新疆某部，两年义务兵津贴一月 1000',
        career: null, track: 'outside',
        place: '新疆某部 新兵连', title: '义务兵',
        income: 1000, healthCost: 8, stress: 5,
        lineHint: ['police', 'mechanic'],
        firstYear: '零下二十度站岗，五公里越野跑到吐；退伍有一笔安置费，也有一身旧伤',
        requires: { edu: 'highschool', body: 'high' },
        note: '能改造人，也能耽误两年'
      },
      {
        id: 'g18_work',
        label: '不读了，直接去快递分拣中心上夜班，一月 3500',
        career: null, track: 'labor',
        place: '快递分拨中心 夜班分拣', title: '分拣工',
        income: 3500, healthCost: 8, stress: 6,
        lineHint: ['taxi', 'chef', 'mechanic'],
        firstYear: '晚 8 点到早 6 点，一小时搬 400 件；腰椎疼到贴膏药，不敢跟家里说',
        requires: { edu: 'highschool' },
        note: '十八岁开始挣钱，三十岁开始还债'
      }
    ]
  }));

  /* =========================================================
     22 岁 · 本科毕业：最厚的一层，12 个具体去向
     ========================================================= */
  G.GATES.push(gate({
    gate: 22,
    age: 22,
    name: '本科毕业 · 第一次择业',
    axis: '编制 / 手艺 / 学历',
    note: '这是人生里选项最多的一次；每一条都能走，但每条都要先付一笔。',
    options: [
      {
        id: 'g22_doctor',
        label: '去市二院普外科当住院医，第一年跟台、换药、值夜班',
        career: 'doctor', track: 'medical',
        place: '市第二人民医院 普外科', title: '住院医师',
        income: 6000, healthCost: 6, stress: 9,
        lineHint: ['doctor'],
        firstYear: '跟台、换药、值夜班，第一年没有处方权；一台手术站六小时，下台手抖',
        requires: { edu: 'bachelor', major: 'medicine' },
        note: '熬十年才值钱，前三年靠家里贴'
      },
      {
        id: 'g22_police',
        label: '考进城东派出所，跟着老周出现场，一周三个夜班',
        career: 'police', track: 'public',
        place: '城东派出所 刑侦组', title: '见习民警',
        income: 5200, healthCost: 6, stress: 8,
        lineHint: ['police'],
        firstYear: '凌晨两点的入室盗窃，楼道灯坏了，你打手电跟在老周后面；笔录做到天亮',
        requires: { edu: 'bachelor', body: 'high' },
        note: '编制稳，但每次出警都可能回不来'
      },
      {
        id: 'g22_teacher',
        label: '进市一中当高一数学代课老师，带两个班 96 本作业',
        career: 'teacher', track: 'public',
        place: '市第一中学 高一年级组', title: '代课教师',
        income: 4800, healthCost: 2, stress: 6,
        lineHint: ['teacher'],
        firstYear: '备课到 12 点，两个班 96 本作业；代课没有编制，一年后能不能留下看考核',
        requires: { edu: 'bachelor', major: 'education' },
        note: '假期多，前三年最不稳定'
      },
      {
        id: 'g22_civil',
        label: '考进区财政局当科员，第一天学着写情况汇报',
        career: 'civil', track: 'public',
        place: '区财政局 综合科', title: '科员',
        income: 5500, healthCost: 1, stress: 4,
        lineHint: ['civil'],
        firstYear: '材料改到第五稿，科长姓王；每天提前二十分钟到，给办公室烧水',
        requires: { edu: 'bachelor', exam: 'civil' },
        note: '稳定到一眼望到头，涨薪按工龄'
      },
      {
        id: 'g22_design',
        label: '进省建筑设计院画结构图，甲方一句话推翻第八版',
        career: 'engineer', track: 'engineering',
        place: '省建筑设计院 结构所', title: '结构绘图员',
        income: 7000, healthCost: 4, stress: 7,
        lineHint: ['engineer'],
        firstYear: 'CAD 改到凌晨两点，院审被退了三次；注册证要考四年',
        requires: { edu: 'bachelor', major: 'engineering' },
        note: '坐办公室，但颈椎和眼睛先坏'
      },
      {
        id: 'g22_site',
        label: '进三建做现场技术员，住工地活动板房，夏天 40 度',
        career: 'engineer', track: 'engineering',
        place: '省第三建筑公司 城西项目部', title: '现场技术员',
        income: 8000, healthCost: 7, stress: 8,
        lineHint: ['engineer'],
        firstYear: '住活动板房，洗澡靠水桶；放线、旁站、写施工日志，一个月休两天',
        requires: { edu: 'bachelor', major: 'engineering' },
        note: '钱比设计院多，人比设计院糙'
      },
      {
        id: 'g22_factory',
        label: '回县机械厂当工艺员，三班倒，跟着老师傅看图纸',
        career: 'engineer', track: 'engineering',
        place: '县机械制造厂 工艺科', title: '工艺员',
        income: 6500, healthCost: 5, stress: 6,
        lineHint: ['engineer'],
        firstYear: '三班倒，夜班从 12 点到 8 点；车间噪音 90 分贝，说话靠吼',
        requires: { edu: 'bachelor', major: 'engineering' },
        note: '离家近、开销小，但技术更新慢'
      },
      {
        id: 'g22_research_ra',
        label: '留在高校实验室当科研助理，洗瓶子跑胶，边干边准备考研',
        career: 'research', track: 'research',
        place: '省大学 材料实验室', title: '科研助理',
        income: 4000, healthCost: 3, stress: 6,
        lineHint: ['research'],
        firstYear: '一周跑三次电泳，给师兄打杂到晚上十点；合同一年一签，没有编制',
        requires: { edu: 'bachelor', major: 'science' },
        note: '离科研最近，也最穷'
      },
      {
        id: 'g22_shop',
        label: '在大学城开奶茶店，加盟费 12 万，前三个月每天睡 5 小时',
        career: 'shop', track: 'business',
        place: '大学城 商业街 12 号铺', title: '奶茶店主',
        income: 7000, healthCost: 5, stress: 8,
        lineHint: ['shop', 'startup'],
        firstYear: '房租押三付一，雇两个学生兼职；寒暑假客流腰斩，靠外卖平台撑着',
        requires: { edu: 'bachelor', money: 120000 },
        note: '上限高，也可能一年赔光'
      },
      {
        id: 'g22_chef',
        label: '进连锁酒楼后厨打荷，一天切 40 斤葱姜，手腕贴膏药',
        career: 'chef', track: 'craft',
        place: '聚福楼 后厨', title: '打荷',
        income: 4500, healthCost: 6, stress: 7,
        lineHint: ['chef'],
        firstYear: '下午 4 点上灶，凌晨 1 点收工；师傅姓刘，骂人不用脏字',
        requires: { edu: 'bachelor' },
        note: '本科文凭在后厨不值钱，手艺才值钱'
      },
      {
        id: 'g22_labor',
        label: '跑外卖，一天 40 单，闯红灯被罚过两次',
        career: null, track: 'labor',
        place: '美团 城东站点', title: '骑手',
        income: 6000, healthCost: 9, stress: 7,
        lineHint: ['taxi'],
        firstYear: '电动车租金一月 600，超时一单扣 50；雨天摔过一次，膝盖留疤',
        requires: { edu: 'bachelor' },
        note: '当天结算，但没有社保和明天'
      },
      {
        id: 'g22_wait',
        label: '待业在家，投了 60 份简历没回音，白天去图书馆准备二战考研',
        career: null, track: 'outside',
        place: '老家 县图书馆自习室', title: '待业',
        income: 0, healthCost: 2, stress: 7,
        lineHint: ['research'],
        firstYear: '父母每天问一次“找到没有”；同学群里的入职照你不敢点开',
        requires: { edu: 'bachelor' },
        note: '保留了再选一次的机会，也消耗了家里的耐心'
      }
    ]
  }));

  /* =========================================================
     25 岁 · 硕士毕业：6–8 个，学历开始兑现也開始贬值
     ========================================================= */
  G.GATES.push(gate({
    gate: 25,
    age: 25,
    name: '硕士毕业 · 第二次择业',
    axis: '兑现学历',
    note: '硕士不再是稀缺品；这一选决定你是进编制、进实验室，还是把文凭收进抽屉。',
    options: [
      {
        id: 'g25_hospital',
        label: '进县人民医院内科当住院医，一周两个夜班，病历写到凌晨',
        career: 'doctor', track: 'medical',
        place: '县人民医院 内科', title: '住院医师',
        income: 8000, healthCost: 6, stress: 8,
        lineHint: ['doctor'],
        firstYear: '一周两个夜班，管 12 张床；病历系统卡到崩溃，写到凌晨一点',
        requires: { edu: 'master', major: 'medicine' },
        note: '县级医院稳，但科研和晋升都慢'
      },
      {
        id: 'g25_civil',
        label: '考省直机关定向选调生，下派乡镇挂职两年',
        career: 'civil', track: 'public',
        place: '省直机关 定向选调', title: '选调生',
        income: 7000, healthCost: 2, stress: 5,
        lineHint: ['civil'],
        firstYear: '住镇政府宿舍，白天跟着分管副镇长跑村；材料写到半夜，周末常被叫回',
        requires: { edu: 'master', exam: 'civil' },
        note: '起点比普通公务员高，但两年基层躲不掉'
      },
      {
        id: 'g25_university',
        label: '进省属高校当讲师，三年内要发两篇核心否则走人',
        career: 'teacher', track: 'research',
        place: '省属高校 材料学院', title: '讲师（非升即走）',
        income: 8500, healthCost: 4, stress: 9,
        lineHint: ['teacher', 'research'],
        firstYear: '一周 12 节课，剩下的时间全在写本子；教研室主任说“三年考核，不留情面”',
        requires: { edu: 'master', paper: 'yes' },
        note: '假期体面，考核要命'
      },
      {
        id: 'g25_rnd',
        label: '进新能源企业研发部当工程师，项目节点前连轴转',
        career: 'engineer', track: 'engineering',
        place: '新能源科技公司 电芯研发部', title: '研发工程师',
        income: 14000, healthCost: 6, stress: 9,
        lineHint: ['engineer'],
        firstYear: '一周六天，节点前通宵；实验室无尘服穿一天，头发一把把掉',
        requires: { edu: 'master', major: 'engineering' },
        note: '钱最多，命最薄'
      },
      {
        id: 'g25_business',
        label: '去连锁餐饮当区域经理，管 8 家店，每月巡店 20 天',
        career: 'shop', track: 'business',
        place: '连锁餐饮 华东区域', title: '区域经理',
        income: 12000, healthCost: 5, stress: 8,
        lineHint: ['shop', 'startup'],
        firstYear: '一个月 20 天在高铁和门店间；店长离职你得自己顶班，凌晨盘点到两点',
        requires: { edu: 'master' },
        note: '不看专业，看能不能扛指标'
      },
      {
        id: 'g25_voc',
        label: '去职校当汽修实训教师，第一堂课扳手被学生藏起来',
        career: 'mechanic', track: 'craft',
        place: '市职业技术学院 汽修实训中心', title: '实训教师',
        income: 7000, healthCost: 3, stress: 4,
        lineHint: ['mechanic', 'teacher'],
        firstYear: '学生一半是混日子的，上课先收手机；寒暑假要带队参加技能大赛',
        requires: { edu: 'master' },
        note: '清闲，但上升空间有限'
      },
      {
        id: 'g25_gig',
        label: '把硕士文凭收进抽屉，跑网约车，一天 12 小时',
        career: 'taxi', track: 'labor',
        place: '城东 网约车车队', title: '网约车司机',
        income: 7000, healthCost: 8, stress: 6,
        lineHint: ['taxi'],
        firstYear: '车租一天 160，跑够 12 小时才回本；乘客问“硕士怎么来开车”，你笑笑',
        requires: { edu: 'master' },
        note: '自由，但专业彻底断了'
      },
      {
        id: 'g25_phd',
        label: '申请海外全奖博士，五年起步，前两年只有助研津贴',
        career: 'research', track: 'outside',
        place: '海外某大学 博士项目', title: '博士生',
        income: 9000, healthCost: 4, stress: 8,
        lineHint: ['research'],
        firstYear: '实验室 12 小时，导师一周见一次；过年回不了家，房租吃掉一半津贴',
        requires: { edu: 'master', paper: 'yes', english: 'high' },
        note: '上限最高，也最孤独'
      }
    ]
  }));

  /* =========================================================
     查询 API
     ========================================================= */
  G.byGate = function (age) {
    for (var i = 0; i < G.GATES.length; i++) {
      if (G.GATES[i].gate === Number(age) || G.GATES[i].age === Number(age)) return G.GATES[i];
    }
    return null;
  };

  G.get = function (age, id) {
    var gd = G.byGate(age);
    if (!gd) return null;
    for (var i = 0; i < gd.options.length; i++) {
      if (gd.options[i].id === id) return gd.options[i];
    }
    return null;
  };

  G.count = function (age) {
    var gd = G.byGate(age);
    return gd ? gd.options.length : 0;
  };

  G.coverTracks = function (age) {
    var gd = G.byGate(age);
    var out = {};
    if (!gd) return out;
    for (var i = 0; i < gd.options.length; i++) out[gd.options[i].track] = true;
    return out;
  };

  G.eduLevel = function (g) {
    if (!g) return 0;
    if (g.edu && g.edu.level !== undefined) return Number(g.edu.level) || 0;
    if (g.eduLevel !== undefined) return Number(g.eduLevel) || 0;
    return 0;
  };

  G.needEdu = function (g, o) {
    var req = (o && o.requires) || {};
    var need = G.EDU[req.edu];
    if (need === undefined) return true;
    return G.eduLevel(g) >= need;
  };

  /* 主干线的第一段收入从几岁开始：早于这个年龄不能真正 enter，否则会套用退休段收入 */
  G.startAge = function (pathId) {
    var p = L.CAREER && L.CAREER.PATHS && L.CAREER.PATHS[pathId];
    if (p && p.income && p.income.length) return Number(p.income[0].from) || 22;
    return 22;
  };

  /* 供主路直接落地的轻量入口：只写职业字段，不碰引擎状态 */
  G.pick = function (g, o) {
    if (!g || !o) return null;
    g.career = g.career || {};
    g.career.path = o.career || null;
    g.career.track = o.track || null;
    g.career.place = o.place || null;
    g.career.title = o.title || null;
    g.career.gate = o.gate || null;
    g.career.gateId = o.id || null;
    if (o.career) {
      var start = Math.max(G.startAge(o.career), Number(o.enterAge) || 0);
      if (g.age >= start && L.CAREER && L.CAREER.enter) {
        L.CAREER.enter(g, o.career, { track: o.track, since: g.age });
        /* v3.9：入职要先落到 g.job，否则 C.due 会因为“没工作”把入职事件挡掉 */
        var p = L.CAREER.PATHS && L.CAREER.PATHS[o.career];
        if (p && p.jobId) {
          g.job = g.job || {};
          if (!g.job.id) {
            if (L.engine && L.engine.setJob) {
              L.engine.setJob(g, { id: p.jobId, level: 0 });
            } else if (L.JOBS && L.JOBS[p.jobId]) {
              g.job.id = p.jobId;
              g.job.level = 0;
              g.job.title = o.title || '';
              g.job.salary = L.JOBS[p.jobId].base || 0;
              g.job.years = 0;
            }
          }
        }
        g.career.planned = null;
      } else {
        g.career.planned = { path: o.career, from: start };
      }
    }
    if (L.CAREER && L.CAREER.init) L.CAREER.init(g);
    return o;
  };
})();
