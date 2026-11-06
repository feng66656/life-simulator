/* 三条标杆弧线：全库写作样板
 * 结构沿用 events 的字段，另加弧线元信息：
 *   owner: { line, node }   所属弧线与节点序号（同一 node 可有互斥分支，node 号相同）
 *   intensity: 1..5        强度（1–2 为日常，3 为转折，4–5 为重锤）
 *   payoffWindow: [lo,hi]  该节点结果可兑现的年龄窗口
 *   carry: '锚物件'         本节点首句必须回指上一节点的 seal
 *   seal: '锚物件'          本节点留下的、下一节点要回指的东西
 *   delayReveal: {delay, target}  选完不揭晓，若干年后由 pending 推送
 *   contrastEcho: true     该节点是"玩家没选的那条路"的侧面回声
 * 不修改任何既有文件，仅向 LS.EVENTS 追加。
 */
(function () {
  'use strict';

  var L = window.LS = window.LS || {};
  var EV = L.EVENTS = L.EVENTS || [];
  var IDX = L.EVENT_INDEX = L.EVENT_INDEX || {};

  /* v3.9：主干弧只许“晚到”，不许“跳过”。
     节点按 pending 的 dueAge 顺序取，正常年份照常触发；被升学/分流回合挤掉时
     允许顺延。宽限给到 20 年：弧内节点的 delay 最长 6 年，再叠加一次被挤，
     窗口仍然托得住，避免「晚到一点就被 cond 判死、整条弧跳节」。 */
  var LATE = 20;
  function A(lo, hi) {
    return function (g) { return !!g && g.age >= lo && g.age <= hi + LATE; };
  }
  /* 年龄 + 标记（标记由上一节点的选项写入 g.marks） */
  function AF(lo, hi, mark) {
    return function (g) {
      return !!g && g.age >= lo && g.age <= hi + LATE && !!(g.marks && g.marks[mark]);
    };
  }
  /* 年龄 + 指定标记为空（用于并列互斥分支） */
  function ANF(lo, hi, mark) {
    return function (g) {
      return !!g && g.age >= lo && g.age <= hi + LATE && !(g.marks && g.marks[mark]);
    };
  }

  /* 三条弧的线定义：供 lines 面板显示，不进随机池 */
  var ARCS = L.ARCS = L.ARCS || {};
  ARCS.lines = [
    { id: 'A', title: '那笔没借出去的钱', nodes: 9, span: [22, 52], theme: '家庭 · 道德' },
    { id: 'B', title: '第三台手术', nodes: 8, span: [26, 45], theme: '职业 · 压力' },
    { id: 'C', title: '母亲的那本存折', nodes: 10, span: [12, 42], theme: '情感 · 代际沉默' },
    { id: 'D', title: '城东派出所', nodes: 13, span: [22, 58], theme: '职业 · 家庭 · 道德' }
  ];

  var LINE = [];
  function add(e) { LINE.push(e); }

  /* ============================================================
   * 弧一《那笔没借出去的钱》 22 → 52 岁，9 个节点，12 条事件
   * ============================================================ */

  add({
    id: 'arcA_1', owner: { line: 'A', node: 1 }, intensity: 4,
    stage: null, type: 'random', tier: 'crossroad', layer: 'chain',
    line: 'A', beat: '起', weight: 0, ageMin: 22, ageMax: 22, prio: 68,
    payoffWindow: [24, 52], seal: '两瓶酒',
    title: '门槛上的两瓶酒',
    text: '李江坐在你家门槛上，脚边一只塑料袋，里面两瓶酒，瓶口的红绳还没解。他说要借两万，声音比平时低半度。你手里只有两万三，是攒了三年准备换房的钱。他把袋子往你脚边推了推，没抬头。',
    cond: A(22, 22),
    opts: [
      { label: '把两万都给他', hint: '自己留三千', tone: 'risk', fx: {
        at: { happiness: 2, stress: 1 },
        npc: { '发小': { intimacy: 3 } },
        set: { arcA_full: true, arcA_part: true },
        flag: [{ event: 'arcA_2a', delay: 1 }]
      } },
      { label: '说手里紧，一分没借', hint: '门关上之后', tone: 'cold', fx: {
        at: { stress: 2 },
        npc: { '发小': { favor: -2 } },
        set: { arcA_none: true },
        flag: [{ event: 'arcA_2b', delay: 1 }]
      } },
      { label: '借一半，一万', hint: '两头都不踏实', tone: 'safe', fx: {
        at: { stress: 1 },
        npc: { '发小': { intimacy: 1 } },
        set: { arcA_half: true, arcA_part: true },
        flag: [{ event: 'arcA_2c', delay: 1 }]
      } }
    ]
  });

  add({
    id: 'arcA_2a', owner: { line: 'A', node: 2 }, intensity: 3,
    stage: null, type: 'random', tier: 'crossroad', layer: 'chain',
    line: 'A', beat: '承', weight: 0, ageMin: 23, ageMax: 23, prio: 68,
    payoffWindow: [25, 50], carry: '两瓶酒', seal: '他写的借条',
    delayReveal: { delay: 2, target: 'arcA_3a' },
    title: '借条上的日期',
    text: '那两瓶酒你没退，摆在门后，红绳一直没解。李江写了借条，用圆珠笔，纸是从他烟盒里撕下来的，日期写成"本月十六"，没写年份。他说年底还。年底他没来，腊月二十九你在集上远远看见他，他先拐进了卖鞭炮的棚子。',
    cond: AF(23, 23, 'arcA_full'),
    opts: [
      { label: '托人捎句话，不提钱', tone: 'safe', fx: {
        at: { stress: 1 }, npc: { '发小': { intimacy: 1 } },
        flag: [{ event: 'arcA_3a', delay: 2 }]
      } },
      { label: '把借条夹进户口本', tone: 'cold', fx: {
        at: { stress: 2 }, set: { arcA_note_kept: true },
        flag: [{ event: 'arcA_3a', delay: 2 }]
      } },
      { label: '去他家门口站了一会儿，又走了', tone: 'risk', fx: {
        at: { happiness: -1, stress: 1 },
        flag: [{ event: 'arcA_3a', delay: 2 }]
      } }
    ]
  });

  add({
    id: 'arcA_2b', owner: { line: 'A', node: 2 }, intensity: 3,
    stage: null, type: 'random', tier: 'crossroad', layer: 'chain',
    line: 'A', beat: '承', weight: 0, ageMin: 23, ageMax: 23, prio: 68,
    payoffWindow: [25, 50], carry: '两瓶酒', seal: '门后的塑料袋',
    delayReveal: { delay: 3, target: 'arcA_3b' },
    title: '退回去的袋子',
    text: '两瓶酒你拎回了他家，放在他堂屋桌上，说这个不用。他送你到巷口，路灯底下有一摊水，亮得像谁把月亮搁地上了。他一路上都在说他不怪你，说了四遍。他走回去时踩进那摊水，月亮碎了一下，又拼回去。那只塑料袋他留着，后来装过一回钉子，袋底坠出一个尖。你换房那年，房没换成。',
    cond: AF(23, 23, 'arcA_none'),
    opts: [
      { label: '把这事从心里划掉', tone: 'cold', fx: {
        at: { stress: 1 }, set: { arcA_cut: true },
        flag: [{ event: 'arcA_3b', delay: 3 }]
      } },
      { label: '每次见他都先低头', tone: 'risk', fx: {
        at: { happiness: -1, stress: 1 }, npc: { '发小': { favor: -1 } },
        flag: [{ event: 'arcA_3b', delay: 3 }]
      } }
    ]
  });

  add({
    id: 'arcA_2c', owner: { line: 'A', node: 2 }, intensity: 3,
    stage: null, type: 'random', tier: 'crossroad', layer: 'chain',
    line: 'A', beat: '承', weight: 0, ageMin: 23, ageMax: 23, prio: 68,
    payoffWindow: [25, 50], carry: '两瓶酒', seal: '一张一万块的借条',
    delayReveal: { delay: 2, target: 'arcA_3c' },
    title: '一万块的借条',
    text: '两瓶酒你退回去一瓶，另一瓶他没肯拿回去，留在门后。借条上写一万，他问剩下的能不能再宽两个月，你说行。他走的时候把那瓶酒的瓶盖拧开喝了半瓶，剩下半瓶放在窗台上，第二天还在那儿，落了灰。',
    cond: AF(23, 23, 'arcA_half'),
    opts: [
      { label: '把剩下的半瓶倒掉', tone: 'cold', fx: {
        at: { stress: 1 }, flag: [{ event: 'arcA_3c', delay: 2 }]
      } },
      { label: '留着，等他来喝', tone: 'safe', fx: {
        at: { happiness: 1 }, npc: { '发小': { intimacy: 1 } },
        flag: [{ event: 'arcA_3c', delay: 2 }]
      } }
    ]
  });

  add({
    id: 'arcA_3a', owner: { line: 'A', node: 3 }, intensity: 3,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'A', beat: '转', weight: 0, ageMin: 25, ageMax: 25, prio: 68,
    payoffWindow: [26, 50], carry: '他写的借条', seal: '一沓散钱',
    delayReveal: { delay: 4, target: 'arcA_4' },
    title: '还回来的散钱',
    text: '他写的借条上那个"本月十六"过了两年。李江来还钱，用一个饼干盒装着，里面全散票，五十的、二十的，还有几张压得很平的一块。他一沓一沓数，数到一半忘了数到哪，又从头数。少了三百。他说回头补。',
    cond: AF(25, 25, 'arcA_full'),
    opts: [
      { label: '说不用补了', tone: 'safe', fx: {
        at: { happiness: 1 }, npc: { '发小': { intimacy: 2 } },
        flag: [{ event: 'arcA_4', delay: 4 }]
      } },
      { label: '说出来，少了三百', tone: 'cold', fx: {
        at: { stress: 2 }, npc: { '发小': { favor: -1 } },
        flag: [{ event: 'arcA_4', delay: 4 }]
      } }
    ]
  });

  add({
    id: 'arcA_3b', owner: { line: 'A', node: 3 }, intensity: 5,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'A', beat: '转', weight: 0, ageMin: 26, ageMax: 26, prio: 68,
    payoffWindow: [26, 50], carry: '门后的塑料袋', seal: '儿科病房的门',
    delayReveal: { delay: 3, target: 'arcA_4' },
    title: '听说是给孩子治病',
    text: '门后的塑料袋后来装过一回钉子，袋底坠出一个尖。你再见李江是在镇卫生院的走廊上，他闺女查出心脏上有个洞，要送省城。护士念到他名字，你在走廊尽头站住。他抱着孩子从你旁边走过去，孩子睡着了，脸朝着他的胸口，他脚步放得很轻。你下意识摸了摸口袋里那个红包，终究没递出去。',
    cond: AF(26, 26, 'arcA_none'),
    opts: [
      { label: '跟上去，把红包塞给他', tone: 'safe', fx: {
        at: { happiness: 1, stress: 2 }, money: { cash: -3000 },
        npc: { '发小': { intimacy: 2 } },
        flag: [{ event: 'arcA_4', delay: 3 }]
      } },
      { label: '在走廊尽头站着，直到他走远', tone: 'risk', fx: {
        at: { happiness: -1, stress: 3 }, set: { arcA_saw_child: true },
        flag: [{ event: 'arcA_4', delay: 3 }]
      } }
    ]
  });

  add({
    id: 'arcA_3c', owner: { line: 'A', node: 3 }, intensity: 3,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'A', beat: '转', weight: 0, ageMin: 25, ageMax: 25, prio: 68,
    payoffWindow: [26, 50], carry: '一张一万块的借条', seal: '一只空酒瓶',
    title: '宽的两个月',
    text: '一张一万块的借条，李江分了四次还，最长的一次隔了七个月。最后一次他把钱放在窗台上，压在那只空酒瓶底下。你不在家，他留了张字条，写着"清了"。酒瓶你没扔，摆在窗台，太阳照进来，瓶底有一道裂纹。',
    cond: AF(25, 25, 'arcA_half'),
    opts: [
      { label: '把字条收进抽屉', tone: 'cold', fx: {
        at: { happiness: -1 }, flag: [{ event: 'arcA_4', delay: 4 }]
      } },
      { label: '拎着酒瓶去他家喝一次', tone: 'safe', fx: {
        at: { happiness: 2 }, npc: { '发小': { intimacy: 1 } },
        flag: [{ event: 'arcA_4', delay: 4 }]
      } }
    ]
  });

  add({
    id: 'arcA_4', owner: { line: 'A', node: 4 }, intensity: 3,
    stage: null, type: 'random', tier: 'crossroad', layer: 'chain',
    line: 'A', beat: '承', weight: 0, ageMin: 29, ageMax: 29, prio: 68,
    payoffWindow: [30, 50], carry: '李江', seal: '礼单',
    delayReveal: { delay: 2, target: 'arcA_5a' },
    title: '他母亲住院那年',
    text: '李江的母亲住院，你在病房外的长椅上坐了半个下午，手里的礼单写了两遍，一遍写八十，一遍写二百，最后交上去的是二百那张。护士来换药，问你是不是家属，你点了下头。他母亲喝粥，勺子碰着碗沿，声音和你小时候在谁家听过的一样。李江没提钱。',
    cond: A(29, 29),
    opts: [
      { label: '坐着，直到护士来赶人', tone: 'safe', fx: {
        at: { happiness: 1, stress: 1 }, npc: { '发小': { intimacy: 2 } },
        flag: [{ event: 'arcA_5a', delay: 2 }]
      } },
      { label: '把钱交给护士站就走', tone: 'cold', fx: {
        at: { stress: 2 }, money: { cash: -200 },
        flag: [{ event: 'arcA_5b', delay: 2 }]
      } }
    ]
  });

  add({
    id: 'arcA_5a', owner: { line: 'A', node: 5 }, intensity: 2,
    stage: null, type: 'random', tier: 'crossroad', layer: 'chain',
    line: 'A', beat: '承', weight: 0, ageMin: 31, ageMax: 31, prio: 68,
    payoffWindow: [32, 50], carry: '礼单', seal: '你的名字',
    title: '婚礼坐哪一桌',
    text: '礼单上你的名字写在第三页。李江结婚那天，他把你往里间引，主桌第二把椅子，你坐下了，面前摆着一碟瓜子和一包没拆的红塔山。他敬酒敬到你，杯子压低了一寸，喝完才说那句"那年的事我记着"。',
    cond: A(31, 31),
    opts: [
      { label: '把烟拆了，分给整桌', tone: 'safe', fx: {
        at: { happiness: 2 }, npc: { '发小': { intimacy: 2 } },
        flag: [{ event: 'arcA_6', delay: 5 }]
      } },
      { label: '烟收进兜里带回家', tone: 'cold', fx: {
        at: { happiness: -1, stress: 1 },
        flag: [{ event: 'arcA_6', delay: 5 }]
      } }
    ]
  });

  add({
    id: 'arcA_5b', owner: { line: 'A', node: 5 }, intensity: 2,
    stage: null, type: 'random', tier: 'crossroad', layer: 'chain',
    line: 'A', beat: '承', weight: 0, ageMin: 31, ageMax: 31, prio: 68,
    payoffWindow: [32, 50], carry: '礼单', seal: '你的名字',
    title: '婚礼上的位置',
    text: '李江结婚那天，你到了，站在门口看随礼簿，礼单上翻到你的名字，笔尖上那一点墨还没干。他把你安排在靠门的那桌，桌上都是他厂里的同事。他过来敬酒，杯子举得很高，喝完拍了拍你的肩，说你能来就好。',
    cond: A(31, 31),
    opts: [
      { label: '坐到最后一道菜', tone: 'safe', fx: {
        at: { happiness: 1, stress: 1 }, npc: { '发小': { intimacy: 1 } },
        flag: [{ event: 'arcA_6', delay: 5 }]
      } },
      { label: '上个礼就走', tone: 'cold', fx: {
        at: { happiness: -1 }, money: { cash: -200 },
        flag: [{ event: 'arcA_6', delay: 5 }]
      } }
    ]
  });

  add({
    id: 'arcA_6', owner: { line: 'A', node: 6 }, intensity: 3, contrastEcho: true,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'A', beat: '转', weight: 0, ageMin: 36, ageMax: 36, prio: 68,
    payoffWindow: [37, 50], carry: '你的名字', seal: '张宝来的桑塔纳',
    title: '张宝来的车',
    text: '礼单上你的名字下面，是张宝来的名字。他也在那年借了李江五千，一分没催。他后来开了个建材铺，开一辆旧桑塔纳，车后座常年堆着水泥袋。酒桌上听人说，李江逢人就讲宝来够朋友。宝来只是笑，说那五千早烂在账上了。',
    cond: A(36, 36),
    opts: [
      { label: '问宝来那五千怎么烂的', tone: 'risk', fx: {
        at: { stress: 1 }, set: { arcA_asked_bao: true },
        flag: [{ event: 'arcA_7', delay: 4 }]
      } },
      { label: '不再往下问', tone: 'cold', fx: {
        at: { happiness: -1 }, flag: [{ event: 'arcA_7', delay: 4 }]
      } }
    ]
  });

  add({
    id: 'arcA_7', owner: { line: 'A', node: 7 }, intensity: 1,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'A', beat: '承', weight: 0, ageMin: 40, ageMax: 40, prio: 68,
    payoffWindow: [41, 50], carry: '张宝来的桑塔纳', seal: '装葱的塑料袋',
    title: '菜市场的一把葱',
    text: '张宝来的桑塔纳后来常停在菜市场口，你在那儿碰见李江的老婆，她蹲在摊子前挑豆角，指甲缝里有泥。她认出你，站起来，把手里那把葱塞给你，说自家地里拔的。你推了两下，还是接了。回家路上葱根上的土掉在塑料袋里，沙沙地响。',
    cond: A(40, 40),
    opts: [
      { label: '第二天送一袋米过去', tone: 'safe', fx: {
        at: { happiness: 2 }, money: { cash: -80 },
        npc: { '发小': { intimacy: 1 } },
        flag: [{ event: 'arcA_8', delay: 6 }]
      } },
      { label: '把葱吃了，什么也没说', tone: 'cold', fx: {
        at: { happiness: -1 }, flag: [{ event: 'arcA_8', delay: 6 }]
      } }
    ]
  });

  add({
    id: 'arcA_8', owner: { line: 'A', node: 8 }, intensity: 3,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'A', beat: '转', weight: 0, ageMin: 46, ageMax: 46, prio: 68,
    payoffWindow: [47, 52], carry: '装葱的塑料袋', seal: '信封',
    delayReveal: { delay: 6, target: 'arcA_9' },
    title: '他儿子送来一个信封',
    text: '装葱的塑料袋你留着装垃圾，袋底磨出一个洞。李江的儿子考上大学，来家里一趟，站在门口不肯进来，手里一个牛皮纸信封，边角磨圆了。那孩子说，是他爸让他送的，说完就跑。信封上没写字，你捏了捏，里面像是一张卡，又像是一张叠了几折的纸。',
    cond: A(46, 46),
    opts: [
      { label: '当面拆，守着孩子拆', tone: 'risk', fx: {
        at: { happiness: 1, stress: 1 }, set: { arcA_opened: true },
        flag: [{ event: 'arcA_9', delay: 6 }]
      } },
      { label: '塞进抽屉，先不拆', tone: 'cold', fx: {
        at: { stress: 2 }, set: { arcA_unopened: true },
        flag: [{ event: 'arcA_9', delay: 6 }]
      } }
    ]
  });

  add({
    id: 'arcA_9', owner: { line: 'A', node: 9 }, intensity: 4,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'A', beat: '合', weight: 0, ageMin: 52, ageMax: 52, prio: 68,
    payoffWindow: [52, 52], carry: '信封', seal: '床头的一张纸',
    title: '两万三现在能买什么',
    text: '信封还在抽屉里。心脏搭桥的第三天，你能坐起来了，床头放着一张纸，是护士给你算的账。你算的不是账。你在算两万三：那年能换半间房，现在能买一台旧冰箱，和一次住院的自费部分。点滴一滴一滴往下走，走得不快不慢，像在替你数。算完，你把纸折起来，压到枕头底下。',
    cond: A(52, 52),
    opts: [
      { label: '让护工把信封拿来', tone: 'risk', fx: { at: { happiness: 1, stress: 2 } },
        result: '护工把信封拿来了。你拆开，里面是一张银行卡和一张纸条，纸条上写着密码，六位，是他的生日。' },
      { label: '闭眼，把账算完', tone: 'cold', fx: { at: { happiness: -1 } },
        result: '你闭上眼，把两万三算完。病房的灯亮着，护士进来换了一次药，没叫你。' }
    ]
  });

  /* ============================================================
   * 弧二《第三台手术》 26 → 45 岁，8 个节点，10 条事件
   * ============================================================ */

  add({
    id: 'arcB_1', owner: { line: 'B', node: 1 }, intensity: 4,
    stage: null, type: 'random', tier: 'crossroad', layer: 'chain',
    line: 'B', beat: '起', weight: 0, ageMin: 26, ageMax: 26, prio: 68,
    payoffWindow: [26, 45], seal: '四点二十',
    delayReveal: { delay: 1, target: 'arcB_3t' },
    title: '第三台',
    text: '凌晨四点二十，第三台是阑尾炎，二十一岁的小伙子，疼得把床单拧成一股绳。你刷手的时候手指有点抖，刷到第三遍才觉出来。器械盘推过来，巡回护士陈桂英说慢一点，不差这三秒。她把灯往下压了压，光落在切口上。',
    cond: A(26, 26),
    opts: [
      { label: '跟陈桂英说，我手在抖', hint: '她会去叫人', tone: 'risk', fx: {
        at: { stress: 1 },
        set: { arcB_told: true },
        flag: [{ event: 'arcB_3t', delay: 1 }]
      }, result: '陈桂英把手套放下，去走廊打电话。二线在那头说十分钟到，背景里有穿衣的窸窣声。' },
      { label: '让陈桂英打电话叫二线', hint: '今晚的台子就让出去', tone: 'safe', fx: {
        at: { stress: 2, happiness: -1 },
        set: { arcB_called: true },
        flag: [{ event: 'arcB_3c', delay: 1 }]
      }, result: '陈桂英把器械盘盖回去，动作很轻。她没问为什么，只问你要不要把水重洗一遍。' },
      { label: '不说，自己缝完', hint: '只差最后一层', tone: 'cold', fx: {
        at: { stress: 3 },
        set: { arcB_held: true },
        flag: [{ event: 'arcB_3h', delay: 1 }]
      }, result: '你把最后一层缝完，剪线时线头留得比平时长。病人醒了，说疼，你说是正常的。' }
    ]
  });

  add({
    id: 'arcB_3t', owner: { line: 'B', node: 2 }, intensity: 3,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'B', beat: '转', weight: 0, ageMin: 27, ageMax: 27, prio: 68,
    payoffWindow: [28, 45], carry: '四点二十', seal: '一份手写的报告',
    delayReveal: { delay: 2, target: 'arcB_4' },
    title: '晨会上念了三遍',
    text: '钟还是四点二十，你把它记成了四点二十一。那天你说了，陈桂英去叫了人，二线在十分钟后到。病人没事。你写了份情况报告，主任在晨会上念，念了三遍"知道喊人"，第三遍底下有人笑。你从此上台前要洗到肘上三寸。',
    cond: AF(27, 27, 'arcB_told'),
    opts: [
      { label: '把这份报告留一份在抽屉', tone: 'cold', fx: {
        at: { stress: 1 }, set: { arcB_report: true },
        flag: [{ event: 'arcB_4', delay: 2 }]
      }, result: '报告夹进抽屉，和另外两份叠在一起。你后来搬了三次家，抽屉里的东西一样没少。' },
      { label: '散会后去跟主任说，别再念了', tone: 'risk', fx: {
        at: { happiness: 1, stress: 2 },
        flag: [{ event: 'arcB_4', delay: 2 }]
      }, result: '主任把报告翻过去，说念是给别人听的。你回办公室，把洗手那条规矩又添了一行。' }
    ]
  });

  add({
    id: 'arcB_3c', owner: { line: 'B', node: 2 }, intensity: 3,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'B', beat: '转', weight: 0, ageMin: 27, ageMax: 27, prio: 68,
    payoffWindow: [28, 45], carry: '四点二十', seal: '叠了三遍的手术衣',
    delayReveal: { delay: 2, target: 'arcB_4' },
    title: '更衣室的二十分钟',
    text: '钟还是四点二十。陈桂英去走廊打电话，二线来得比你预想的快，进门看了你一眼，只说一句"你去歇着"，就把手伸进手套。你在更衣室坐了二十分钟，把那件手术衣叠了三遍，叠成一个方块，又拆开。回值班室时，走廊的灯灭了一半。',
    cond: AF(27, 27, 'arcB_called'),
    opts: [
      { label: '把那一晚记进本子里', tone: 'cold', fx: {
        at: { stress: 1 }, set: { arcB_note: true },
        flag: [{ event: 'arcB_4', delay: 2 }]
      }, result: '本子第一页写着日期和台次，字很小。写完你合上，塞进白大褂口袋，第二天洗衣服忘了掏。' },
      { label: '第二天照常上台', tone: 'safe', fx: {
        at: { stress: -1 }, flag: [{ event: 'arcB_4', delay: 2 }]
      }, result: '第二天你照样刷手，照样上台。那一晚没人再提，走廊的灯也修好了。' }
    ]
  });

  add({
    id: 'arcB_3h', owner: { line: 'B', node: 2 }, intensity: 5,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'B', beat: '转', weight: 0, ageMin: 27, ageMax: 27, prio: 68,
    payoffWindow: [28, 45], carry: '四点二十', seal: '一袋苹果',
    delayReveal: { delay: 2, target: 'arcB_4' },
    title: '吸收热',
    text: '钟还是四点二十，陈桂英把器械盘推到你手边。最后一层你缝得比平时慢，手停了一下，针尖差了那么一寸，你补了一针，补完自己也知道补得不对。病人第三天发烧，查了三天，单子上写"吸收热"。出院那天家属送来一袋苹果。值班室的护士换班时看见那袋苹果，问你吃不吃。你把苹果放在值班室，没吃，放到烂。',
    cond: AF(27, 27, 'arcB_held'),
    opts: [
      { label: '把苹果扔了，把这事记住', tone: 'cold', fx: {
        at: { happiness: -2, stress: 3 }, set: { arcB_apple: true },
        flag: [{ event: 'arcB_4', delay: 2 }]
      }, result: '苹果倒进垃圾桶，袋子系了两道。之后一年，你缝完最后一层都要停两秒，等手自己停稳。' },
      { label: '把苹果分给护士站', tone: 'safe', fx: {
        at: { happiness: -1, stress: 1 },
        flag: [{ event: 'arcB_4', delay: 2 }]
      }, result: '护士们拿走了。陈桂英拿了一个，咬一口说甜。你没吃。' }
    ]
  });

  add({
    id: 'arcB_4', owner: { line: 'B', node: 3 }, intensity: 1,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'B', beat: '承', weight: 0, ageMin: 29, ageMax: 29, prio: 68,
    payoffWindow: [30, 45], carry: '陈桂英', seal: '那碗面',
    delayReveal: { delay: 3, target: 'arcB_5' },
    title: '食堂的一碗面',
    text: '陈桂英端着碗过来坐在你对面，食堂的面永远是那一锅汤，上面浮着两片白菜。她儿子今年中考，数学只考了六十一。她说这话的时候在挑面里的葱花，挑得很干净，一根都没剩。',
    cond: A(29, 29),
    opts: [
      { label: '说六十一也能上技校', tone: 'safe', fx: {
        at: { happiness: 1 },
        flag: [{ event: 'arcB_5', delay: 3 }]
      }, result: '她把葱花挑完，说技校也要钱。面汤凉了，她一口没剩。' },
      { label: '把碗里的白菜夹给她', tone: 'cold', fx: {
        at: { happiness: 1, stress: -1 },
        flag: [{ event: 'arcB_5', delay: 3 }]
      }, result: '她把白菜夹回你碗里，说她不吃这个。两个人就把面吃完了。' }
    ]
  });

  add({
    id: 'arcB_5', owner: { line: 'B', node: 4 }, intensity: 2, contrastEcho: true,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'B', beat: '转', weight: 0, ageMin: 32, ageMax: 32, prio: 68,
    payoffWindow: [33, 45], carry: '那碗面', seal: '考核表',
    delayReveal: { delay: 3, target: 'arcB_6' },
    title: '周喊喊',
    text: '那碗面吃完，你路过走廊尽头，看见门上贴着周喊喊的考核表。当年叫了二线的老周，现在科里都叫他周喊喊，一晚上能喊三次。可他带的组一年没有一例并发症，照片下面是"零差错"三个字。',
    cond: A(32, 32),
    opts: [
      { label: '路过时多看那张表一眼', tone: 'cold', fx: {
        at: { happiness: -1, stress: 1 }, set: { arcB_saw_zhou: true },
        flag: [{ event: 'arcB_6', delay: 3 }]
      }, result: '照片上的老周比现在年轻，头发还多。你在门口站了一会儿，有人推车过来，你让开了。' },
      { label: '去他办公室坐一会儿', tone: 'safe', fx: {
        at: { happiness: 2 }, set: { arcB_saw_zhou: true },
        flag: [{ event: 'arcB_6', delay: 3 }]
      }, result: '他给你倒了半杯茶，茶叶浮在上面。他说他也怕，怕了十年。你们没再说手术。' }
    ]
  });

  add({
    id: 'arcB_6', owner: { line: 'B', node: 5 }, intensity: 1,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'B', beat: '承', weight: 0, ageMin: 35, ageMax: 35, prio: 68,
    payoffWindow: [36, 45], carry: '考核表', seal: '客厅那只坏灯泡',
    delayReveal: { delay: 3, target: 'arcB_7' },
    title: '客厅的灯泡',
    text: '考核表你只在走廊尽头看过一眼。客厅的灯泡闪了三天，你值完班回来，踩着凳子换。凳子是当初搬家带来的那张，一条腿短，垫着一本黄页。灯泡拧上去，亮了一下又灭了，你拧第二遍才坐实。楼下有人放电视，声音开得很大。',
    cond: A(35, 35),
    opts: [
      { label: '换完把凳子收进储物间', tone: 'safe', fx: {
        at: { happiness: 1 }, flag: [{ event: 'arcB_7', delay: 3 }]
      }, result: '凳子收回储物间，黄页还在那条短腿底下压着。灯亮着，你坐着看了半小时电视，没看进去。' },
      { label: '不换，摸黑坐一会儿', tone: 'cold', fx: {
        at: { happiness: -1 }, flag: [{ event: 'arcB_7', delay: 3 }]
      }, result: '你坐在黑里，听见楼上有人走动。灯泡后来是你老婆换的，她说你连个灯泡都换不好。' }
    ]
  });

  add({
    id: 'arcB_7', owner: { line: 'B', node: 6 }, intensity: 3,
    stage: null, type: 'random', tier: 'crossroad', layer: 'chain',
    line: 'B', beat: '承', weight: 0, ageMin: 38, ageMax: 38, prio: 68,
    payoffWindow: [39, 45], carry: '客厅那只坏灯泡', seal: '耳朵上夹着的笔',
    delayReveal: { delay: 3, target: 'arcB_8' },
    title: '耳朵上夹着笔',
    text: '客厅那只坏灯泡换好以后，科里给你分了个住院医，姓何，二十五岁，习惯把笔夹在右耳上，一低头就掉。他第一次上台，你站在对面，看他打结，结打得比当年你打的还紧。下台他问你，老师，连值三个班手会抖吗。你说会。',
    cond: A(38, 38),
    opts: [
      { label: '把当年那台手术讲给他听', tone: 'risk', fx: {
        at: { stress: 2, happiness: 1 }, set: { arcB_told_he: true },
        flag: [{ event: 'arcB_8', delay: 3 }]
      }, result: '他听完问，后来那个病人怎么样。你说出院了。他把笔从耳朵上取下来，握在手里。' },
      { label: '说会抖，别的没提', tone: 'cold', fx: {
        at: { stress: 1 }, set: { arcB_told_part: true },
        flag: [{ event: 'arcB_8', delay: 3 }]
      }, result: '他点点头，说他也抖。你说抖了就慢一点。他笑了一下，又把笔夹回耳朵上。' }
    ]
  });

  add({
    id: 'arcB_8', owner: { line: 'B', node: 7 }, intensity: 4,
    stage: null, type: 'random', tier: 'crossroad', layer: 'chain',
    line: 'B', beat: '转', weight: 0, ageMin: 41, ageMax: 41, prio: 68,
    payoffWindow: [42, 45], carry: '耳朵上夹着的笔', seal: '值班室的门',
    delayReveal: { delay: 4, target: 'arcB_9' },
    title: '第四台',
    text: '耳朵上夹着的笔，凌晨还别在他右耳上。他连值了三个班，第四台是胆囊，刷手刷得比你慢。你站在操作间的玻璃后面，监护仪的数字一下一下地跳，像有人拿指头敲桌面。器械盘的声音停了两次。他出来时笔攥在手心，笔帽上有牙印。他说，老师，我做完了，我手一直在抖。',
    cond: A(41, 41),
    opts: [
      { label: '告诉他，今晚这台我不该让你上', tone: 'risk', fx: {
        at: { happiness: 1, stress: 2 }, set: { arcB_he_told: true },
        flag: [{ event: 'arcB_9', delay: 4 }]
      }, result: '他站在那儿没动，说他知道。走廊里有护士推车过去，轮子压到地上的水，声音很长。' },
      { label: '说做完了就好，去睡', tone: 'cold', fx: {
        at: { happiness: -1, stress: 2 }, set: { arcB_he_silent: true },
        flag: [{ event: 'arcB_9', delay: 4 }]
      }, result: '他嗯了一声，回值班室。第二天照常上台，笔还夹在耳朵上，什么都没问。' }
    ]
  });

  add({
    id: 'arcB_9', owner: { line: 'B', node: 8 }, intensity: 3,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'B', beat: '合', weight: 0, ageMin: 45, ageMax: 45, prio: 68,
    payoffWindow: [45, 45], carry: '值班室的门', seal: '一只没洗的碗',
    title: '没接的那个电话',
    text: '值班室的门关着，四十五岁那年你不再上台，改做门诊。有天夜里何医生打电话来，手机在桌上震了七下，一下一下，像有人在门外用指节敲门，敲到第七下停了。你没接。第二天他把一只碗放在你办公桌上，是他老婆煮的汤，碗沿有个豁口。他说昨晚那台他喊了人，声音很大。',
    cond: A(45, 45),
    opts: [
      { label: '把碗洗干净还给他', tone: 'safe', fx: { at: { happiness: 1 } },
        result: '碗洗得很干净，豁口那儿你用布擦了两遍。他接过去，说这碗本来就不成套。' },
      { label: '把碗留在桌上，不洗', tone: 'cold', fx: { at: { happiness: -1 } },
        result: '碗在桌上放了三天，汤在最底下结了一层。第四天保洁收走了。' }
    ]
  });

  /* ============================================================
   * 弧三《母亲的那本存折》 12 → 42 岁，10 个节点，14 条事件
   * 主干归属：情感（不是家庭）。家庭主干已被弧一占用。
   * 弧一管"对外的人情账"，弧三管"你和母亲之间那层纸捅不捅破"；
   * 存折只是那层纸后面的答案，不是这条弧的主题。身世与楼下老人留在支线。
   * ============================================================ */

  add({
    id: 'arcC_1', owner: { line: 'C', node: 1 }, intensity: 4,
    stage: null, type: 'random', tier: 'crossroad', layer: 'chain',
    line: 'C', beat: '起', weight: 0, ageMin: 12, ageMax: 12, prio: 68,
    payoffWindow: [13, 42], seal: '压在最底下的那本存折',
    requiresAlive: ['母亲'],
    delayReveal: { delay: 1, target: 'arcC_2a' },
    title: '缝纫机抽屉最底下',
    text: '母亲去地里摘棉花，你翻缝纫机抽屉找一团红线。抽屉最底下压着一本存折，用旧报纸包着，报纸边上是去年的日期。户名写着"李素云"，不是赵家的姓，也不是母亲的名字。你把报纸按原样折回去，折了三道。',
    cond: A(12, 12),
    opts: [
      { label: '拿着存折去地里问母亲', hint: '她在地头摘棉花', tone: 'risk', fx: {
        at: { stress: 1 },
        set: { arcC_ask: true },
        flag: [{ event: 'arcC_2a', delay: 1 }]
      }, result: '你把存折揣在怀里走到地头。母亲直起腰，手上的棉花壳扎着指头。她看了一眼存折，说回家再说。' },
      { label: '按原样折回去，装作没看见', hint: '三道纸缝要对齐', tone: 'safe', fx: {
        at: { happiness: -1 },
        set: { arcC_quiet: true },
        flag: [{ event: 'arcC_2b', delay: 1 }]
      }, result: '你把报纸折回三道，抽屉推回去，红线也没拿。那天晚上母亲回来，先去看了一眼抽屉。' },
      { label: '把户名和账号抄在作业本最后一页', hint: '抄完描了一遍', tone: 'cold', fx: {
        at: { stress: 1 },
        set: { arcC_copy: true },
        flag: [{ event: 'arcC_2c', delay: 1 }]
      }, result: '你抄得很慢，有一个数字描了两遍。作业本塞进书包最底下，和一张没及格的卷子压在一起。' }
    ]
  });

  add({
    id: 'arcC_2a', owner: { line: 'C', node: 2 }, intensity: 3,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'C', beat: '承', weight: 0, ageMin: 13, ageMax: 13, prio: 68,
    payoffWindow: [16, 42], carry: '压在最底下的那本存折',
    seal: '缝纫机上那把铜锁',
    requiresAlive: ['母亲'],
    delayReveal: { delay: 3, target: 'arcC_3' },
    title: '回家再说',
    text: '压在最底下的那本存折，母亲那晚没有拿出来。她只说那是给一个人存的钱，存了有些年头，等你再大些就懂。第二天缝纫机上多了一把铜锁，钥匙用红线拴着，挂在她的裤腰上。',
    cond: AF(13, 13, 'arcC_ask'),
    opts: [
      { label: '不再问，等她说的那天', tone: 'safe', fx: {
        at: { happiness: 1 }, flag: [{ event: 'arcC_3', delay: 3 }]
      }, result: '你没再问。锁挂在她腰上，走路时碰着裤缝，有一点响。' },
      { label: '夜里起来，试那把锁', tone: 'risk', fx: {
        at: { stress: 2 }, set: { arcC_tried: true },
        flag: [{ event: 'arcC_3', delay: 3 }]
      }, result: '锁没开。你在缝纫机前蹲了一会儿，听见隔壁屋里她翻身的动静。' }
    ]
  });

  add({
    id: 'arcC_2b', owner: { line: 'C', node: 2 }, intensity: 3,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'C', beat: '承', weight: 0, ageMin: 13, ageMax: 13, prio: 68,
    payoffWindow: [16, 42], carry: '压在最底下的那本存折',
    seal: '缝纫机上那把铜锁',
    requiresAlive: ['母亲'],
    delayReveal: { delay: 3, target: 'arcC_3' },
    title: '抽屉推回去之后',
    text: '压在最底下的那本存折，你没再看见。母亲也没提，只是从那以后，她开抽屉前会先看一眼门口。半个月后缝纫机上多了一把铜锁，钥匙拴在她裤腰上，你从此进那间屋都觉得窄。',
    cond: AF(13, 13, 'arcC_quiet'),
    opts: [
      { label: '把这件事忘掉', tone: 'cold', fx: {
        at: { stress: 1 }, flag: [{ event: 'arcC_3', delay: 3 }]
      }, result: '你后来确实想不起存折放在第几层报纸里。只是每次听见钥匙响，会停一下。' },
      { label: '找机会把锁撬开', tone: 'risk', fx: {
        at: { stress: 2 }, set: { arcC_pry: true },
        flag: [{ event: 'arcC_3', delay: 3 }]
      }, result: '你找了根铁丝，捅了两下，锁眼里留下几道白痕。母亲回来什么也没说，把锁换了。' }
    ]
  });

  add({
    id: 'arcC_2c', owner: { line: 'C', node: 2 }, intensity: 3,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'C', beat: '承', weight: 0, ageMin: 13, ageMax: 13, prio: 68,
    payoffWindow: [16, 42], carry: '压在最底下的那本存折',
    seal: '缝纫机上那把铜锁',
    requiresAlive: ['母亲'],
    delayReveal: { delay: 3, target: 'arcC_3' },
    title: '作业本最后一页',
    text: '压在最底下的那本存折，你抄下的那串数字在作业本最后一页，后来本子被当废纸卖了。缝纫机上多了一把铜锁，钥匙拴在母亲裤腰上。她换锁那天没看你，你不知道她知不知道你抄过。',
    cond: AF(13, 13, 'arcC_copy'),
    opts: [
      { label: '去废品站找那个本子', tone: 'risk', fx: {
        at: { happiness: -1, stress: 1 }, set: { arcC_lost_book: true },
        flag: [{ event: 'arcC_3', delay: 3 }]
      }, result: '废品站在镇西头，纸堆得比人高。你翻了半个下午，老板说昨天那车已经拉走了。' },
      { label: '算了，把数字背下来', tone: 'cold', fx: {
        at: { stress: 1 }, flag: [{ event: 'arcC_3', delay: 3 }]
      }, result: '你把那串数字背下来，睡前默一遍。有一年你发现背的顺序全乱了。' }
    ]
  });

  add({
    id: 'arcC_3', owner: { line: 'C', node: 3 }, intensity: 1,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'C', beat: '承', weight: 0, ageMin: 16, ageMax: 16, prio: 68,
    payoffWindow: [17, 42], carry: '缝纫机上那把铜锁', seal: '缝纫机的踏板',
    requiresAlive: ['母亲'],
    delayReveal: { delay: 2, target: 'arcC_4' },
    title: '袖口放了两寸',
    text: '缝纫机上那把铜锁，锁孔里积了一层灰。母亲踩踏板给你改校服，袖口放了两寸，说还能再穿两年。你半夜起来喝水，听见她在灯下开锁，咔的一声，很轻，像怕惊醒谁。第二天锁还锁着。',
    cond: A(16, 16),
    opts: [
      { label: '装作没听见，回屋躺下', tone: 'safe', fx: {
        at: { stress: 1 }, flag: [{ event: 'arcC_4', delay: 2 }]
      }, result: '你装作没听见，回屋躺下。她的灯亮到很晚，你在黑里数她开锁的次数。' },
      { label: '站在门后看她数', tone: 'risk', fx: {
        at: { happiness: -1 }, flag: [{ event: 'arcC_4', delay: 2 }]
      }, result: '你站在门后，看她把存折摊在膝盖上，用手指一行一行地划。她没回头，说回去睡。' }
    ]
  });

  add({
    id: 'arcC_4', owner: { line: 'C', node: 4 }, intensity: 3,
    stage: null, type: 'random', tier: 'crossroad', layer: 'chain',
    line: 'C', beat: '转', weight: 0, ageMin: 18, ageMax: 18, prio: 68,
    payoffWindow: [20, 42], carry: '缝纫机的踏板', seal: '二姨落下的半包瓜子',
    requiresAlive: ['母亲'],
    delayReveal: { delay: 3, target: 'arcC_5' },
    title: '二姨的瓜子',
    text: '缝纫机的踏板，你踩了两年，那天二姨来，坐在缝纫机边上嗑瓜子，壳在桌上堆成一小堆。她说你妈这个人，嘴比锁还紧。你问她李素云是谁，她嗑瓜子的手停了一下，问你从哪儿听来的。',
    cond: A(18, 18),
    opts: [
      { label: '说在存折上看见的', tone: 'risk', fx: {
        at: { stress: 2 }, set: { arcC_met_yi: true },
        flag: [{ event: 'arcC_5', delay: 3 }]
      }, result: '二姨把瓜子壳往桌角推了推，说你妈十六岁才回的孙家，别的让她自己讲。' },
      { label: '说听人瞎讲的', tone: 'cold', fx: {
        at: { happiness: -1 }, flag: [{ event: 'arcC_5', delay: 3 }]
      }, result: '二姨哦了一声，继续嗑瓜子。壳堆得更高了，她走的时候没收拾。' }
    ]
  });

  add({
    id: 'arcC_5', owner: { line: 'C', node: 5 }, intensity: 2,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'C', beat: '承', weight: 0, ageMin: 21, ageMax: 21, prio: 68,
    payoffWindow: [24, 42], carry: '二姨落下的半包瓜子', seal: '那罐咸菜',
    requiresAlive: ['母亲'],
    title: '车站的一罐咸菜',
    text: '二姨落下的半包瓜子，你走那天顺手塞进了行李。母亲送你到镇上的车站，往包里塞了一罐咸菜，罐口用塑料布扎着。车开的时候她站在原地，手在围裙上擦了两下，没挥手。',
    cond: A(21, 21),
    opts: [
      { label: '车开前下车抱她一下', tone: 'safe', fx: {
        at: { happiness: 2 }, npc: { '母亲': { intimacy: 2 } },
        flag: [{ event: 'arcC_6', delay: 3 }]
      }, result: '车还没开，你下去抱了她一下。她身上有灶灰味，手在你背上拍了两下，很轻。' },
      { label: '坐着没动，看她变小', tone: 'cold', fx: {
        at: { happiness: -1 }, flag: [{ event: 'arcC_6', delay: 3 }]
      }, result: '你坐着没动。车拐过路口，她还站在原地，围裙被风吹起来一角。' }
    ]
  });

  add({
    id: 'arcC_6', owner: { line: 'C', node: 6 }, intensity: 1,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'C', beat: '承', weight: 0, ageMin: 24, ageMax: 24, prio: 68,
    payoffWindow: [27, 42], carry: '那罐咸菜', seal: '裤腰上那把钥匙',
    requiresAlive: ['母亲'],
    title: '翻过来的领子',
    text: '那罐咸菜你吃了半年，罐子后来装钉子。母亲来你租的房子住了三天，把你的旧衬衫领子翻过来补，针脚比头发密。你才看见那把小铜钥匙还拴在她裤腰上，红线褪成了粉色。',
    cond: A(24, 24),
    opts: [
      { label: '带她去楼下吃一碗面', tone: 'safe', fx: {
        at: { happiness: 2 }, npc: { '母亲': { intimacy: 2 } },
        flag: [{ event: 'arcC_7', delay: 3 }]
      }, result: '楼下那家面馆的桌子是折叠的，她吃得很慢，把汤都喝完了。' },
      { label: '加班到很晚，回来她已经睡了', tone: 'cold', fx: {
        at: { happiness: -1, stress: 1 }, flag: [{ event: 'arcC_7', delay: 3 }]
      }, result: '你回来时她已经睡了，衬衫叠在椅背上，领子补好了，针脚在灯下看得见。' }
    ]
  });

  add({
    id: 'arcC_7', owner: { line: 'C', node: 7 }, intensity: 3,
    stage: null, type: 'random', tier: 'crossroad', layer: 'chain',
    line: 'C', beat: '承', weight: 0, ageMin: 27, ageMax: 27, prio: 68,
    payoffWindow: [31, 42], carry: '裤腰上那把钥匙', seal: '蓝布包',
    requiresAlive: ['母亲'],
    delayReveal: { delay: 4, target: 'arcC_8' },
    title: '等我不在了再给你',
    text: '裤腰上那把钥匙，婚礼前一天她解下来了。红线在裤腰上磨出的那道印子，半天没消。她坐在新房的床沿，两只手放在膝盖上，说有个东西，等她不在了再给你。你说现在就说。她摇头，从箱底摸出一个蓝布包，压在被子底下，拍了三下，被面陷下去一块，很久没有弹回来。',
    cond: A(27, 27),
    opts: [
      { label: '追问布包里是什么', tone: 'risk', fx: {
        at: { stress: 2 }, set: { arcC_asked_bag: true },
        flag: [{ event: 'arcC_8', delay: 4 }]
      }, result: '她按住布包，说等她走了再看。你把手收回来，被子上的三下印子还在。' },
      { label: '说那你留着，别给我', tone: 'cold', fx: {
        at: { happiness: -1 }, set: { arcC_refused_bag: true },
        flag: [{ event: 'arcC_8', delay: 4 }]
      }, result: '她说那就等。布包她塞回箱底，钥匙第二天又拴回裤腰上。' }
    ]
  });

  add({
    id: 'arcC_8', owner: { line: 'C', node: 8 }, intensity: 2, contrastEcho: true,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'C', beat: '转', weight: 0, ageMin: 31, ageMax: 31, prio: 68,
    payoffWindow: [36, 42], carry: '蓝布包', seal: '灶台上那只缺口的搪瓷缸',
    requiresAlive: ['母亲'],
    title: '灶上的两个蛋',
    text: '那个蓝布包她带回了老家，压在箱子最底下。你回去给她换窗户，她在灶上煮面，面里卧两个蛋，一个给你，一个说明天再吃。她讲二姨年轻时问过她妈一句话，半个月没敢回家。',
    cond: A(31, 31),
    opts: [
      { label: '问她当年问过外婆什么', tone: 'risk', fx: {
        at: { stress: 2, happiness: 1 }, set: { arcC_asked_grandma: true },
        flag: [{ event: 'arcC_9', delay: 5 }]
      }, result: '你问她，当年问过外婆什么。她把碗放下，说问了一句不该问的，你外婆半年没给她好脸。' },
      { label: '把面吃完，不提', tone: 'safe', fx: {
        at: { happiness: 1 }, flag: [{ event: 'arcC_9', delay: 5 }]
      }, result: '你把面吃完，蛋留在碗底。她收拾碗的时候，把那个蛋又拨回你碗里。' }
    ]
  });

  add({
    id: 'arcC_9', owner: { line: 'C', node: 9 }, intensity: 4,
    stage: null, type: 'random', tier: 'crossroad', layer: 'chain',
    line: 'C', beat: '转', weight: 0, ageMin: 36, ageMax: 36, prio: 68,
    payoffWindow: [42, 42], carry: '灶台上那只缺口的搪瓷缸', seal: '抽屉里的存折',
    requiresAlive: ['母亲'],
    title: '抽屉开了一次',
    text: '灶台上那只缺口的搪瓷缸，被她带去了医院，装牙刷和假牙。她摔了一跤，半边身子不能动，说话漏风。她把钥匙从裤腰上解下来给你，指了指家里那个抽屉。你回去打开，存折还在，最后一笔存款是上个月的五十块。',
    cond: A(36, 36),
    opts: [
      { label: '拿着存折回医院，问她李素云是谁', tone: 'risk', fx: {
        at: { happiness: 1, stress: 3 }, set: { arcC_asked_final: true },
        flag: [{ event: 'arcC_10a', delay: 6 }, { event: 'arcC_10b', delay: 6 }, { event: 'arcC_10c', delay: 6 }]
      }, result: '她听懂了，眼睛看着天花板，说是她十六岁前的名字。她在李家住到十六，户口上写李素云，回孙家那年才改的名。她说这些的时候手背上的针头动了一下。' },
      { label: '把存折放回去，锁上', tone: 'cold', fx: {
        at: { happiness: -2, stress: 2 }, set: { arcC_closed: true },
        flag: [{ event: 'arcC_10a', delay: 6 }, { event: 'arcC_10b', delay: 6 }, { event: 'arcC_10c', delay: 6 }]
      }, result: '你把存折放回去，锁上，钥匙揣进兜里。回医院的路上你买了两斤橘子，她吃了两瓣。' }
    ]
  });

  add({
    id: 'arcC_10a', owner: { line: 'C', node: 10 }, intensity: 4,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'C', beat: '合', weight: 0, ageMin: 42, ageMax: 42, prio: 68,
    payoffWindow: [42, 42], carry: '抽屉里的存折', seal: '夹在存折里的一张照片',
    title: '改过的户名',
    text: '抽屉里的存折，是她走后第三天你才敢翻的。户名那一栏被划掉了，划得不重，像怕划疼纸；旁边用钢笔写了你的名字，笔画抖，最后一笔拖长了一截，停在纸外面。改户日期是她摔倒前一个月。最后一笔存款还是五十块。存折里夹着一张你十二岁的照片，边角被谁的手摸得起了毛。',
    cond: AF(42, 42, 'arcC_ask'),
    opts: [
      { label: '去银行把钱取出来', tone: 'safe', fx: { at: { happiness: 1, stress: 1 } },
        result: '柜员看了死亡证明和公证书，手续齐了。钱取出来是一万八千六百，你数了两遍，全是五十的。' },
      { label: '把存折留在抽屉里', tone: 'cold', fx: { at: { happiness: -1 } },
        result: '你把存折放回抽屉，报纸按原样折了三道。那张照片留在里面，没拿出来。' }
    ]
  });

  add({
    id: 'arcC_10b', owner: { line: 'C', node: 10 }, intensity: 4,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'C', beat: '合', weight: 0, ageMin: 42, ageMax: 42, prio: 68,
    payoffWindow: [42, 42], carry: '抽屉里的存折', seal: '按原样折了三道的报纸',
    title: '三十一年，每月五十',
    text: '抽屉里的存折，是她走后第三天你才敢翻的。户名还是李素云，最后一笔存款是她摔倒前那个月，五十块。你从头翻到尾，三十一年，每一页都写着五十，没有一笔取过。你把存折合上，报纸按原样折了三道。',
    cond: AF(42, 42, 'arcC_quiet'),
    opts: [
      { label: '拿去银行，问能不能取', tone: 'risk', fx: { at: { stress: 2 } },
        result: '柜员说户名不是你，要公证，要证明她是你母亲。你拿着一沓材料站在窗口前，后面的人催了两遍。' },
      { label: '原样放回去，锁上', tone: 'cold', fx: { at: { happiness: -1 } },
        result: '锁咔的一声。钥匙你挂在裤腰上，走路时碰着裤缝，有一点响。' }
    ]
  });

  add({
    id: 'arcC_10c', owner: { line: 'C', node: 10 }, intensity: 4,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'C', beat: '合', weight: 0, ageMin: 42, ageMax: 42, prio: 68,
    payoffWindow: [42, 42], carry: '抽屉里的存折', seal: '院墙根下的一堆纸灰',
    title: '抄在作业本上的数字',
    text: '抽屉里的存折，是她走后第三天你才敢翻的。你十二岁抄在作业本最后一页的那串数字，和上面一个不差，连你当年描错又补上的那个也一模一样。最后一笔存款是五十块，日期在她摔倒前那个月。你算了三十一年，一共一万八千六百。',
    cond: AF(42, 42, 'arcC_copy'),
    opts: [
      { label: '去银行，用她的名字取', tone: 'risk', fx: { at: { stress: 2 } },
        result: '你说本人来不了。柜员抬头看了你一眼，把材料推回来，说下一个。' },
      { label: '把存折和那页纸一起烧了', tone: 'cold', fx: { at: { happiness: -1 } },
        result: '你在院墙根下点了火，纸边先卷起来，那串数字最后才烧着。' }
    ]
  });

  /* ============================================================
   * 弧四《城东派出所》 22 → 58 岁，13 个节点，22 条事件
   * 主干归属：职业（家庭是代价，好友是道德重量）。
   * 与弧二分工：弧二写"手艺与责任"，弧四写"身份被借走之后"；
   * 三个位置压在同一个节点上——收据背面那串警号。
   * ============================================================ */

  add({
    id: 'arcD_1', owner: { line: 'D', node: 1 }, intensity: 3,
    stage: null, type: 'random', tier: 'crossroad', layer: 'chain',
    line: 'D', beat: '起', weight: 0, ageMin: 22, ageMax: 22, prio: 68,
    payoffWindow: [24, 58], seal: '一块旧警号牌',
    title: '报到那天落小雨',
    text: '报到那天落小雨，城东派出所的院子里积了半指深的水。老周把你领上二楼，桌上搁着一只掉了漆的搪瓷缸，他说这缸子跟了他十九年。他从抽屉里摸出一块旧警号牌，边角磨得发亮，说这个你带着，别丢。楼下有人喊，他先把烟按灭，说走，先把人找着。',
    cond: A(22, 22),
    opts: [
      { label: '把警号牌别在胸前，跟他下楼', tone: 'safe', fx: {
        at: { stress: 1 }, npc: { '老周': { intimacy: 1 } },
        flag: [{ event: 'arcD_2', delay: 2 }]
      }, result: '牌子别得有点歪，老周伸手替你扶正，说歪着难看。' },
      { label: '把警号牌揣进兜里，先没别', tone: 'cold', fx: {
        at: { stress: 1 }, set: { arcD_badge_pocket: true },
        flag: [{ event: 'arcD_2', delay: 2 }]
      }, result: '那块牌子在兜里硌了一路，等你想起它，已经跟钥匙混在一块。' }
    ]
  });

  add({
    id: 'arcD_2', owner: { line: 'D', node: 2 }, intensity: 3,
    stage: null, type: 'random', tier: 'crossroad', layer: 'chain',
    line: 'D', beat: '承', weight: 0, ageMin: 24, ageMax: 24, prio: 68,
    payoffWindow: [26, 58], carry: '一块旧警号牌', seal: '一份没动的炒面',
    delayReveal: { delay: 2, target: 'arcD_3' },
    title: '夜市的两只煤炉',
    text: '一块旧警号牌别在胸前，夏天贴在衬衫上，印出一个方印。夜市两家为一只煤炉动手，地上撒着半盆辣椒油，一个男人的眉毛烧掉一截。你把他们分开，登记身份证，写一半笔没水了。收摊时那家女人塞来一份炒面，塑料盒还烫手，你拎回所里，放到第二天，没动。',
    cond: A(24, 24),
    opts: [
      { label: '趁热吃了，跟她说声谢', tone: 'safe', fx: {
        at: { happiness: 1 }, flag: [{ event: 'arcD_3', delay: 2 }]
      }, result: '面坨了也吃完了，女人第二天见你，笑得像换了个人。' },
      { label: '原样拎回去，说所里有规定', tone: 'cold', fx: {
        at: { stress: 1 }, set: { arcD_refused: true },
        flag: [{ event: 'arcD_3', delay: 2 }]
      }, result: '她把盒子接回去，盖好，没再说话。' }
    ]
  });

  add({
    id: 'arcD_3', owner: { line: 'D', node: 3 }, intensity: 2,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'D', beat: '承', weight: 0, ageMin: 26, ageMax: 26, prio: 68,
    payoffWindow: [28, 58], carry: '一份没动的炒面', seal: '两包红双喜',
    delayReveal: { delay: 2, target: 'arcD_4' },
    title: '修车棚后头',
    text: '一份没动的炒面在冰箱里放到发酸，你扔了。修车棚后头有人聚着打牌，赌注是一包烟。你蹲在棚外听了半钟头，听见有人提到阿勇的名字。灯忽然灭了，几个人翻墙走了，墙上留着一只胶鞋印。你没追。第二天阿勇在你家门把手上挂了两包红双喜。',
    cond: A(26, 26),
    opts: [
      { label: '把烟送回去，问他昨晚在不在棚子里', tone: 'risk', fx: {
        at: { stress: 2 }, npc: { '阿勇': { intimacy: -1 } },
        set: { arcD_first_ask: true },
        flag: [{ event: 'arcD_4', delay: 2 }]
      }, result: '他说不在，眼睛看着你手里的烟，说这点小事你还当真。' },
      { label: '收下烟，没问', tone: 'cold', fx: {
        at: { stress: 1 }, npc: { '阿勇': { intimacy: 1 } },
        flag: [{ event: 'arcD_4', delay: 2 }]
      }, result: '烟你抽了一包，另一包放到过年，纸都黄了。' }
    ]
  });

  add({
    id: 'arcD_4', owner: { line: 'D', node: 4 }, intensity: 2,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'D', beat: '承', weight: 0, ageMin: 28, ageMax: 28, prio: 68,
    payoffWindow: [30, 58], carry: '两包红双喜', seal: '次卧那床被子',
    delayReveal: { delay: 2, target: 'arcD_5' },
    title: '次卧的床垫',
    text: '两包红双喜有一包还没拆，你放在电视柜上。秀兰把次卧的床垫搬到阳台上晒，说这床以后就你睡。你连值了三个夜班，回家时她已经在厂里上早班，锅里温着粥，桌上压着一张纸条，写着米在柜子里。你在次卧睡了半个月，被子一直没叠。',
    cond: A(28, 28),
    opts: [
      { label: '把被子叠好，回主卧睡', tone: 'safe', fx: {
        at: { happiness: 1, stress: 1 }, npc: { '秀兰': { intimacy: 2 } },
        flag: [{ event: 'arcD_5', delay: 2 }]
      }, result: '她那天回来得晚，进主卧看了一眼，把灯关了，没说什么。' },
      { label: '就那么摊着，睡到天亮', tone: 'cold', fx: {
        at: { happiness: -1, stress: 1 }, npc: { '秀兰': { intimacy: -1 } },
        set: { arcD_coldbed: true },
        flag: [{ event: 'arcD_5', delay: 2 }]
      }, result: '被子摊了半个月，她回来一次，站在门口看了一会儿，把门带上了。' }
    ]
  });

  add({
    id: 'arcD_5', owner: { line: 'D', node: 5 }, intensity: 2,
    stage: null, type: 'random', tier: 'crossroad', layer: 'chain',
    line: 'D', beat: '转', weight: 0, ageMin: 30, ageMax: 30, prio: 68,
    payoffWindow: [33, 58], carry: '次卧那床被子', seal: '一张暂住证复印件',
    delayReveal: { delay: 3, target: 'arcD_6' },
    title: '日志里的十七次',
    text: '次卧那床被子你终于叠了，叠好了。阿勇在城东开了家便民代办店，玻璃门上贴价目表：暂住证、代缴罚款、代跑手续。你去找他喝茶，看见桌角压着一本硬皮日志，翻开一页，十七个名字，后面都写着你的警号。把本子合上时，他端茶进来。桌上另压着一张暂住证复印件，地址是他店里。',
    cond: A(30, 30),
    opts: [
      { label: '问他这本子记的是什么', tone: 'risk', fx: {
        at: { stress: 2 }, npc: { '阿勇': { intimacy: -1 } },
        set: { arcD_second_ask: true },
        flag: [{ event: 'arcD_6', delay: 3 }]
      }, result: '他说帮人跑腿要留底，怕人家回头不认账。茶有点烫，你没喝。' },
      { label: '把本子放回原处，装作没看见', tone: 'cold', fx: {
        at: { stress: 2 }, npc: { '阿勇': { intimacy: 1 } },
        flag: [{ event: 'arcD_6', delay: 3 }]
      }, result: '茶你喝了，走的时候他说以后有事找他，一句话的事。' }
    ]
  });

  add({
    id: 'arcD_6', owner: { line: 'D', node: 6 }, intensity: 4,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'D', beat: '转', weight: 0, ageMin: 33, ageMax: 33, prio: 68,
    payoffWindow: [36, 58], carry: '一张暂住证复印件', seal: '那辆白色面包',
    delayReveal: { delay: 3, target: 'arcD_7' }, contrastEcho: true,
    title: '停车场里的白面包',
    text: '一张暂住证复印件后来出现在一份案卷里，地址还是那间店。夜里十一点，你在商场的地下车库看见一辆白色面包，后门开着，有人往下搬纸箱。阿勇站在车边点钱。你坐在车里没下去，那辆车倒出车位，尾灯在柱上晃。小郑上个月把亲戚的事直接报了，亲戚跟他断了，他自己申请调去了分局。',
    cond: A(33, 33),
    opts: [
      { label: '下车，叫他一声', tone: 'risk', fx: {
        at: { stress: 3 }, npc: { '阿勇': { intimacy: 1 } },
        flag: [{ event: 'arcD_7', delay: 3 }]
      }, result: '他回头，看见是你，先把手里那沓钱塞进后兜，才笑着走过来。' },
      { label: '坐在车里，等他走', tone: 'cold', fx: {
        at: { happiness: -1, stress: 2 },
        flag: [{ event: 'arcD_7', delay: 3 }]
      }, result: '车走了，车库只剩你的车。你把火熄了，坐了很久才发动。' }
    ]
  });

  add({
    id: 'arcD_7', owner: { line: 'D', node: 7 }, intensity: 5,
    stage: null, type: 'random', tier: 'crossroad', layer: 'chain',
    line: 'D', beat: '转', weight: 0, ageMin: 36, ageMax: 36, prio: 68,
    payoffWindow: [38, 58], carry: '那辆白色面包', seal: '那张收据',
    title: '收据背面',
    text: '那辆白色面包又停在派出所后巷，是你值班时看见的。阿勇来找你，说帮人办个加急的证，借你的警号在系统里点一下，就一下。他没坐，站在门口，手里捏着一张收据。你接过来看，背面用圆珠笔写着一串数字，是你的警号，还有一处地址，是城南那间仓库。他看你把收据翻过来，没出声。',
    cond: A(36, 36),
    opts: [
      { label: '把收据抽出来，当晚交给所长', tone: 'risk', fx: {
        at: { stress: 3 }, npc: { '阿勇': { favor: -3 } },
        set: { arcD_report: true },
        flag: [{ event: 'arcD_8r', delay: 2 }]
      }, result: '所长把收据压在台历上，压了三天。第四天他把城南那个地址抄在纸上，推给你，说这个你自己去看。' },
      { label: '把收据推回去，说我没看见', tone: 'cold', fx: {
        at: { stress: 2 }, npc: { '阿勇': { intimacy: 3 } },
        set: { arcD_cover: true },
        flag: [{ event: 'arcD_8c', delay: 2 }]
      }, result: '他把收据折好收回兜里，说哥，这份情我记着。走的时候他替你带上了门，门轴响了一声。' },
      { label: '收据揣进兜里，先不动', tone: 'risk', fx: {
        at: { stress: 4 }, npc: { '阿勇': { intimacy: 1 } },
        set: { arcD_delay: true },
        flag: [{ event: 'arcD_8d', delay: 2 }]
      }, result: '收据在制服内兜里放了三天。洗衣服时秀兰摸出来，问这是什么，你说所里的单子。' }
    ]
  });

  add({
    id: 'arcD_8r', owner: { line: 'D', node: 8 }, intensity: 4,
    stage: null, type: 'random', tier: 'crossroad', layer: 'chain',
    line: 'D', beat: '转', weight: 0, ageMin: 38, ageMax: 38, prio: 68,
    payoffWindow: [41, 58], carry: '那张收据', seal: '一份谈话记录',
    title: '交上去的收据',
    text: '那张收据交上去之后，城南的仓库封了，阿勇被带走那天穿的是拖鞋。所长让你做谈话记录，问了四个钟头，你坐在他对面，一笔一笔写。他说的每一句你都记，只有一句没记：他说那十七个人里，有六个是他自己的亲戚。你写完把笔帽扣上，手心里全是汗。',
    cond: AF(38, 38, 'arcD_report'),
    opts: [
      { label: '把没记的那句补进去', tone: 'safe', fx: {
        at: { stress: 2 }, set: { arcD_record_full: true },
        flag: [{ event: 'arcD_9r', delay: 3 }]
      }, result: '补在最后一行，字写得比前面小。所长看完没说什么，把纸抽走了。' },
      { label: '就那样交上去', tone: 'cold', fx: {
        at: { stress: 1, happiness: -1 }, npc: { '阿勇': { favor: -2 } },
        flag: [{ event: 'arcD_9r', delay: 3 }]
      }, result: '记录交上去，没人问那一句。你回家路上买了包烟，抽了半根就掐了。' }
    ]
  });

  add({
    id: 'arcD_8c', owner: { line: 'D', node: 8 }, intensity: 4,
    stage: null, type: 'random', tier: 'crossroad', layer: 'chain',
    line: 'D', beat: '转', weight: 0, ageMin: 38, ageMax: 38, prio: 68,
    payoffWindow: [41, 58], carry: '那张收据', seal: '那张银行卡',
    title: '抽屉里的收据',
    text: '那张收据你没交，折成四折，压在驾驶证的夹层里。半个月后阿勇把一张银行卡塞进你家信箱，卡上没有名字，用橡皮筋捆着一张纸条，写着六个数字。你去取款机查了一次，余额够你还三年房贷。你把卡揣起来，回家时秀兰正在拖地，拖把拧得很干。',
    cond: AF(38, 38, 'arcD_cover'),
    opts: [
      { label: '把卡收进抽屉，谁都不说', tone: 'cold', fx: {
        at: { happiness: -1, stress: 2 }, money: { cash: 3000 },
        set: { arcD_card_taken: true },
        flag: [{ event: 'arcD_9c', delay: 3 }]
      }, result: '抽屉里有条旧围巾，你把卡塞在围巾底下。每次开抽屉都能看见那截围巾的角。' },
      { label: '把卡退回去，扔进他店里', tone: 'risk', fx: {
        at: { stress: 3 }, npc: { '阿勇': { intimacy: -2 } },
        set: { arcD_card_back: true },
        flag: [{ event: 'arcD_9c', delay: 3 }]
      }, result: '他追出门把卡又塞回你兜里，说哥，你别寒碜我。卡最后还是在你兜里。' }
    ]
  });

  add({
    id: 'arcD_8d', owner: { line: 'D', node: 8 }, intensity: 4,
    stage: null, type: 'random', tier: 'crossroad', layer: 'chain',
    line: 'D', beat: '转', weight: 0, ageMin: 38, ageMax: 38, prio: 68,
    payoffWindow: [41, 58], carry: '那张收据', seal: '那只没送出去的信封',
    title: '兜里的收据',
    text: '那张收据在你兜里洗过一回，边角软了。你写过一封举报信，写完改了三个地方，抄了一遍，装进信封，信封上没写收信人。你把它放在值班室的抽屉里，抽屉里还有一副旧手套。每次夜班你都会拉开看一眼，看完再合上。',
    cond: AF(38, 38, 'arcD_delay'),
    opts: [
      { label: '把信交到分局，绕过所里', tone: 'risk', fx: {
        at: { stress: 3, happiness: -1 }, set: { arcD_delay_report: true },
        flag: [{ event: 'arcD_9d', delay: 3 }]
      }, result: '分局的人收下信，登记了你的名字，说回去等。你回去以后，所里的人看你的眼神变了。' },
      { label: '把信封撕了，纸留着', tone: 'cold', fx: {
        at: { stress: 1 }, set: { arcD_delay_burn: true },
        flag: [{ event: 'arcD_9d', delay: 3 }]
      }, result: '信封撕成四条，纸你留在抽屉里，折成原来的样子，只是没有封口。' }
    ]
  });

  add({
    id: 'arcD_9r', owner: { line: 'D', node: 9 }, intensity: 4,
    stage: null, type: 'random', tier: 'crossroad', layer: 'chain',
    line: 'D', beat: '转', weight: 0, ageMin: 41, ageMax: 41, prio: 68,
    payoffWindow: [44, 58], carry: '一份谈话记录', seal: '阿勇的判决书',
    title: '判了三年零六个月',
    text: '一份谈话记录后来调走了，你没留底。案子拖了一年多，阿勇判了三年零六个月，判决书送到所里，是让你签收的。你把纸摊在桌上，看见他的名字印在被告那一栏，后面跟着一串数字，是他那间店的营业执照号。秀兰在同一天给你打了三个电话，你都没接。',
    cond: AF(41, 41, 'arcD_report'),
    opts: [
      { label: '请两天假，回家把话说完', tone: 'safe', fx: {
        at: { stress: 1 }, npc: { '秀兰': { intimacy: 2 } },
        set: { arcD_keep_go: true },
        flag: [{ event: 'arcD_10r_keep', delay: 3 }]
      }, result: '假条递上去，所长压了半天才签。你到家时她坐在床沿，鞋都没脱。' },
      { label: '不回去，先把材料整理完', tone: 'cold', fx: {
        at: { stress: 2, happiness: -1 }, npc: { '秀兰': { intimacy: -2 } },
        set: { arcD_split_go: true },
        flag: [{ event: 'arcD_10r_split', delay: 3 }]
      }, result: '材料整理到半夜，你趴在桌上睡着了。醒来时手机没电，屏幕黑着。' }
    ]
  });

  add({
    id: 'arcD_9c', owner: { line: 'D', node: 9 }, intensity: 4,
    stage: null, type: 'random', tier: 'crossroad', layer: 'chain',
    line: 'D', beat: '转', weight: 0, ageMin: 41, ageMax: 41, prio: 68,
    payoffWindow: [44, 58], carry: '那张银行卡', seal: '阿勇店里的卷帘门',
    title: '便民服务的牌子',
    text: '那张银行卡里的钱你没动，每个月查一次余额，数字没变。城南仓库的案子往上查，查到代办店，阿勇被带走那天，店里的卷帘门拉到一半，门上贴的价目表还在。你站在街对面，看见有人从门底下钻出来，把门口的塑料凳踢倒了。当天下午所长叫你去谈话，问了一个钟头。',
    cond: AF(41, 41, 'arcD_cover'),
    opts: [
      { label: '把卡里的钱取出来，补上他欠的', tone: 'risk', fx: {
        at: { stress: 3 }, money: { cash: -3000 },
        set: { arcD_paid_back: true },
        flag: [{ event: 'arcD_10c', delay: 3 }]
      }, result: '取了三万，柜台问你做什么用，你说还账。钱打过去，对方的账户已经冻结。' },
      { label: '把卡剪了，扔进河里', tone: 'cold', fx: {
        at: { happiness: -1, stress: 1 },
        flag: [{ event: 'arcD_10c', delay: 3 }]
      }, result: '卡剪成两半，你走到桥上扔了，一半落进水里，一半挂在栏杆上。' }
    ]
  });

  add({
    id: 'arcD_9d', owner: { line: 'D', node: 9 }, intensity: 4,
    stage: null, type: 'random', tier: 'crossroad', layer: 'chain',
    line: 'D', beat: '转', weight: 0, ageMin: 41, ageMax: 41, prio: 68,
    payoffWindow: [44, 58], carry: '那只没送出去的信封', seal: '一份调离通知',
    title: '白天关着门',
    text: '那只没送出去的信封还在值班室抽屉里，纸已经发脆。分局的信批下来了，不是立案，是一张调离通知，把你调去城西的警务室，离家二十七公里。走那天没人送你，你自己把抽屉里的东西倒进一个纸箱，旧手套、半包烟、那只信封。',
    cond: AF(41, 41, 'arcD_delay'),
    opts: [
      { label: '把信封带走，锁进新柜子', tone: 'cold', fx: {
        at: { stress: 2 }, set: { arcD_delay_kept: true },
        flag: [{ event: 'arcD_10d', delay: 3 }]
      }, result: '新柜子只有一个抽屉有锁，钥匙是铜的，你挂在裤腰上。' },
      { label: '把信封留在原抽屉里', tone: 'risk', fx: {
        at: { happiness: -1, stress: 2 },
        flag: [{ event: 'arcD_10d', delay: 3 }]
      }, result: '临走你把抽屉拉开又关上，信封留在最底下，压着那副旧手套。' }
    ]
  });

  add({
    id: 'arcD_10r_keep', owner: { line: 'D', node: 10 }, intensity: 3,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'D', beat: '承', weight: 0, ageMin: 44, ageMax: 44, prio: 68,
    payoffWindow: [48, 58], carry: '阿勇的判决书', seal: '阿勇的判决书',
    title: '门开着的那间次卧',
    text: '阿勇的判决书你带回了家，压在饭桌的玻璃板下面。秀兰没问案子，只问你盐放哪了。那天晚上你们把话说了半宿，从次卧那床被子说到孩子上学。她说她不是要你换个活法，是要你回家的时候能说句话。第二天她把次卧的门开着，没关。',
    cond: AF(44, 44, 'arcD_keep_go'),
    opts: [
      { label: '把判决书收进抽屉，桌子空出来', tone: 'safe', fx: {
        at: { happiness: 2, stress: -2 }, npc: { '秀兰': { intimacy: 3 } },
        set: { arcD_married: true },
        flag: [{ event: 'arcD_11r', delay: 4 }]
      }, result: '玻璃板下面空了一块，她放了一张孩子的奖状进去。' },
      { label: '判决书就压在玻璃板下，不挪', tone: 'cold', fx: {
        at: { happiness: -1 }, npc: { '秀兰': { intimacy: 1 } },
        flag: [{ event: 'arcD_11r', delay: 4 }]
      }, result: '她做饭的时候会看见那几个字，看了几天，不再问。' }
    ]
  });

  add({
    id: 'arcD_10r_split', owner: { line: 'D', node: 10 }, intensity: 4,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'D', beat: '承', weight: 0, ageMin: 44, ageMax: 44, prio: 68,
    payoffWindow: [48, 58], carry: '阿勇的判决书', seal: '阿勇的判决书',
    title: '民政局的走廊',
    text: '阿勇的判决书在抽屉里放了半年。秀兰提离婚那天，你刚从局里回来，鞋还没换。她说家里像个值班室，你回来只是换件衣服。你们去了民政局，走廊很长，她在前面走，红本换成了两个绿本。出来时她把那床蓝格子被套叠好，放在门口的台阶上，说这个你留着。',
    cond: AF(44, 44, 'arcD_split_go'),
    opts: [
      { label: '把被套抱回去，洗干净', tone: 'safe', fx: {
        at: { happiness: -1, stress: 1 },
        set: { arcD_divorced: true, arcD_bedding: true },
        flag: [{ event: 'arcD_11r', delay: 4 }]
      }, result: '被套洗了两遍，晾在阳台上，风一吹就鼓起来，像有人还在里头。' },
      { label: '被套留在台阶上，没拿', tone: 'cold', fx: {
        at: { happiness: -2, stress: 1 }, set: { arcD_divorced: true },
        flag: [{ event: 'arcD_11r', delay: 4 }]
      }, result: '你走出去半条街，回头看了一眼，台阶上已经空了。' }
    ]
  });

  add({
    id: 'arcD_10c', owner: { line: 'D', node: 10 }, intensity: 4,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'D', beat: '承', weight: 0, ageMin: 44, ageMax: 44, prio: 68,
    payoffWindow: [48, 58], carry: '阿勇店里的卷帘门', seal: '一份停职通知',
    title: '门口的封条',
    text: '阿勇店里的卷帘门后来再没拉起来，门上贴了封条，风把价目表吹掉一角。案子查到你头上，是那张银行卡的流水，虽然钱没动，户名是你。所里让你停职配合调查，一份停职通知送到家，秀兰签的字。她把通知书放在鞋柜上，说这个月房贷你自己想办法。',
    cond: AF(44, 44, 'arcD_cover'),
    opts: [
      { label: '把知道的都说出来', tone: 'risk', fx: {
        at: { stress: 3 }, set: { arcD_told_all: true },
        flag: [{ event: 'arcD_11c', delay: 4 }]
      }, result: '你说了三个钟头，说到那张收据，说到后巷那辆面包。记录的人换了两次。' },
      { label: '只说卡的事，别的不提', tone: 'cold', fx: {
        at: { happiness: -2, stress: 2 },
        flag: [{ event: 'arcD_11c', delay: 4 }]
      }, result: '问到第三遍，你还是那几句话。出来时天黑了，你在台阶上坐了很久。' }
    ]
  });

  add({
    id: 'arcD_10d', owner: { line: 'D', node: 10 }, intensity: 3,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'D', beat: '承', weight: 0, ageMin: 44, ageMax: 44, prio: 68,
    payoffWindow: [48, 58], carry: '一份调离通知', seal: '那封抄了两遍的信',
    title: '没人信的那句话',
    text: '一份调离通知你压在箱底，新警务室只有两张桌子，一个协警。分局那边没有回话，所里的人也不再问你阿勇的事。你把那封信重新抄了一遍，这次写了收信人，还是没寄。秀兰来看过你一次，站在门口，说你现在两头都不是人。',
    cond: AF(44, 44, 'arcD_delay'),
    opts: [
      { label: '再寄一次，这次直接寄到市局', tone: 'risk', fx: {
        at: { stress: 3, happiness: -1 }, set: { arcD_last_try: true },
        flag: [{ event: 'arcD_11d', delay: 4 }]
      }, result: '信寄出去，回执你留着。一个月后市局来电话，问了十分钟。' },
      { label: '把信锁起来，不再想这事', tone: 'cold', fx: {
        at: { stress: 1, happiness: -1 },
        flag: [{ event: 'arcD_11d', delay: 4 }]
      }, result: '信锁进铁皮柜，钥匙和手铐挂在一起。' }
    ]
  });

  add({
    id: 'arcD_11r', owner: { line: 'D', node: 11 }, intensity: 4,
    stage: null, type: 'random', tier: 'crossroad', layer: 'chain',
    line: 'D', beat: '承', weight: 0, ageMin: 48, ageMax: 48, prio: 68,
    payoffWindow: [53, 58], carry: '阿勇的判决书', seal: '一份复职通知',
    title: '复职通知',
    text: '阿勇的判决书压在玻璃板下压了四年，纸边发黄。四十八岁那年，案子结了尾，所里给你一份复职通知，警衔补了一级。所长在会上念了你的名字，念完让大家都鼓掌。散会后你回到办公桌，把玻璃板掀起来，把判决书抽出来，放进抽屉，锁上。',
    cond: AF(48, 48, 'arcD_report'),
    opts: [
      { label: '给秀兰打个电话，说晚上回去吃饭', tone: 'safe', fx: {
        at: { happiness: 2 }, npc: { '秀兰': { intimacy: 2 } },
        flag: [{ event: 'arcD_12r', delay: 5 }]
      }, result: '她在电话那头顿了一下，说菜已经买了，你回来的话就多做一个。' },
      { label: '把通知塞进抽屉，照常值班', tone: 'cold', fx: {
        at: { stress: 1, happiness: -1 },
        flag: [{ event: 'arcD_12r', delay: 5 }]
      }, result: '通知和判决书放在一起，两个纸边都一样黄。' }
    ]
  });

  add({
    id: 'arcD_11c', owner: { line: 'D', node: 11 }, intensity: 4,
    stage: null, type: 'random', tier: 'crossroad', layer: 'chain',
    line: 'D', beat: '承', weight: 0, ageMin: 48, ageMax: 48, prio: 68,
    payoffWindow: [53, 58], carry: '一份停职通知', seal: '一份开除决定',
    title: '开除决定',
    text: '一份停职通知在鞋柜上放了半年，边角被你拿起来看过无数次，起了毛。调查结束那天，所里给你一份开除决定，理由写了三条，第一条是隐瞒。你签字的时候手没有抖，签完把笔放回笔筒，笔筒是老周的搪瓷缸。走出大门，门卫室的人没抬头。',
    cond: AF(48, 48, 'arcD_cover'),
    opts: [
      { label: '回家，把决定给秀兰看', tone: 'risk', fx: {
        at: { happiness: -2, stress: 2 }, npc: { '秀兰': { intimacy: -1 } },
        flag: [{ event: 'arcD_12c', delay: 5 }]
      }, result: '她看完放在桌上，说知道了，然后进厨房把火关小。' },
      { label: '把决定折起来，谁也不给看', tone: 'cold', fx: {
        at: { stress: 2, happiness: -1 },
        flag: [{ event: 'arcD_12c', delay: 5 }]
      }, result: '纸折成四折，塞进内衣口袋，贴着胸口，走路时能听见响。' }
    ]
  });

  add({
    id: 'arcD_11d', owner: { line: 'D', node: 11 }, intensity: 4,
    stage: null, type: 'random', tier: 'crossroad', layer: 'chain',
    line: 'D', beat: '承', weight: 0, ageMin: 48, ageMax: 48, prio: 68,
    payoffWindow: [53, 58], carry: '那封抄了两遍的信', seal: '一份提前离岗表',
    title: '提前离岗表',
    text: '那封抄了两遍的信最后寄出去了，回执夹在钱包里，字迹被磨淡。市局来了两个人，问了一下午，最后说你反映的情况属实，但程序上你拖了太久。四十八岁那年，单位让你签一份提前离岗表，签完照发基本工资。你签字那天，秀兰没来，也没打电话。',
    cond: AF(48, 48, 'arcD_delay'),
    opts: [
      { label: '签完字，把回执也交上去', tone: 'safe', fx: {
        at: { happiness: 1, stress: -1 },
        flag: [{ event: 'arcD_12d', delay: 5 }]
      }, result: '回执交上去，办事的人看了一眼，说这个你留着也行。你还是交了。' },
      { label: '签字，回执留着', tone: 'cold', fx: {
        at: { stress: 1 },
        flag: [{ event: 'arcD_12d', delay: 5 }]
      }, result: '回执留在钱包里，和一张过期的超市会员卡夹在一起。' }
    ]
  });

  add({
    id: 'arcD_12r', owner: { line: 'D', node: 12 }, intensity: 3,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'D', beat: '合', weight: 0, ageMin: 53, ageMax: 53, prio: 68,
    payoffWindow: [58, 58], carry: '一份复职通知', seal: '老周的那块旧警号牌',
    title: '最后一次点名',
    text: '一份复职通知你在抽屉里放了五年，纸都软了。五十三岁那年你办了退休，所里开了一个短会，年轻人在楼下集合点名，念到你的名字时停了一下。散会后你把办公桌清空，抽屉最里面是那块旧警号牌，老周给你的，边角还是亮的。你没交回去，装进上衣口袋。',
    cond: AF(53, 53, 'arcD_report'),
    opts: [
      { label: '把警号牌交给新来的小民警', tone: 'safe', fx: {
        at: { happiness: 1 }, set: { arcD_badge_given: true },
        flag: [{ event: 'arcD_13', delay: 5 }]
      }, result: '小民警接过去，翻来覆去看，问这是哪一年的。你说不知道，戴着别丢就行。' },
      { label: '把警号牌带回家，放进抽屉', tone: 'cold', fx: {
        at: { stress: 1 },
        flag: [{ event: 'arcD_13', delay: 5 }]
      }, result: '回家你把它放进五斗柜最上面那格，和户口本放在一起。' }
    ]
  });

  add({
    id: 'arcD_12c', owner: { line: 'D', node: 12 }, intensity: 3,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'D', beat: '合', weight: 0, ageMin: 53, ageMax: 53, prio: 68,
    payoffWindow: [58, 58], carry: '一份开除决定', seal: '老周的那块旧警号牌',
    title: '没有仪式',
    text: '一份开除决定折了五年，折痕处已经透光。五十三岁那年你在小区门口看车棚，一个月一千八。所里改制，清退旧物，通知你去领一个纸箱，里面是你的杯子、两本笔记、还有那块旧警号牌，老周当年给你的。没有仪式，门卫把箱子递出来，让你在单子上签字。',
    cond: AF(53, 53, 'arcD_cover'),
    opts: [
      { label: '把警号牌留在箱子里，一起扔了', tone: 'cold', fx: {
        at: { happiness: -1, stress: 1 },
        flag: [{ event: 'arcD_13', delay: 5 }]
      }, result: '箱子扔进垃圾站，你在原地站了一会儿，听见里面有东西响了一下。' },
      { label: '把警号牌挑出来，装进兜里', tone: 'safe', fx: {
        at: { happiness: 1 },
        flag: [{ event: 'arcD_13', delay: 5 }]
      }, result: '牌子在兜里贴着大腿，走一路都是凉的，到家才有点热。' }
    ]
  });

  add({
    id: 'arcD_12d', owner: { line: 'D', node: 12 }, intensity: 3,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'D', beat: '合', weight: 0, ageMin: 53, ageMax: 53, prio: 68,
    payoffWindow: [58, 58], carry: '一份提前离岗表', seal: '老周的那块旧警号牌',
    title: '仓库的钥匙',
    text: '一份提前离岗表压在箱底五年，纸上的字淡了。五十三岁那年你在街道的仓库看门，钥匙一大串，最旧的那把开不了任何锁。整理旧物时你翻出那块旧警号牌，老周给你的，铜边磨得发白。你把它挂在钥匙串上，走路时和别的钥匙碰在一起，响。',
    cond: AF(53, 53, 'arcD_delay'),
    opts: [
      { label: '把牌子取下来，放回箱子里', tone: 'cold', fx: {
        at: { happiness: -1 },
        flag: [{ event: 'arcD_13', delay: 5 }]
      }, result: '箱子合上，你听见牌子在里面碰了一下，很轻。' },
      { label: '就让它在钥匙串上挂着', tone: 'safe', fx: {
        at: { happiness: 1, stress: -1 },
        flag: [{ event: 'arcD_13', delay: 5 }]
      }, result: '后来每次开门，你都先摸到它，凉的那一块，比钥匙好认。' }
    ]
  });

  add({
    id: 'arcD_13', owner: { line: 'D', node: 13 }, intensity: 2,
    stage: null, type: 'random', tier: 'echo', layer: 'chain',
    line: 'D', beat: '合', weight: 0, ageMin: 58, ageMax: 58, prio: 68,
    payoffWindow: [58, 58], carry: '老周的那块旧警号牌',
    title: '城东的旧街',
    text: '老周的那块旧警号牌，五十八岁那年你忽然想起它。冬天你去城东旧街买酱油，路过派出所的后巷，巷口那家修车棚拆了，地上还留着半块水泥台。你站住，想起二十六岁那年蹲在棚外，听人提到阿勇的名字，墙上一只胶鞋印。风从巷子口出来，你把衣领竖起来，酱油瓶在手里拎得很稳。',
    cond: A(58, 58),
    opts: [
      { label: '走进巷子，走到头再出来', tone: 'safe', fx: {
        at: { happiness: 1, stress: -1 }
      }, result: '巷子比记忆里短，走到头是一堵新砌的墙，墙根下堆着几袋水泥。' },
      { label: '在巷口站一会儿，转身走', tone: 'cold', fx: {
        at: { happiness: -1 }
      }, result: '你站了不到一分钟，酱油瓶在手里拎着，瓶身有水，手是湿的。' }
    ]
  });

  var i;
  var ARC_SEL = { A: 1, B: 1, C: 1 };
  for (i = 0; i < LINE.length; i++) {
    if (LINE[i] && LINE[i].id && !IDX[LINE[i].id]) IDX[LINE[i].id] = LINE[i];
    /* 主干弧只许“晚到”，不许“跳过”：年龄上限同步放宽 LATE，
       否则分流年把本节挤掉后，年龄闸门会把整条弧判死。 */
    if (LINE[i] && LINE[i].line && ARC_SEL[LINE[i].line] && typeof LINE[i].ageMax === 'number') {
      LINE[i].ageMax = LINE[i].ageMax + LATE;
    }
    /* v3.9 承接可见：carry 是上一节留下的那件东西，必须在正文里看得见。
       作者已写进绝大多数正文；少数没写的，这里用物件名补一个短句，不改情节。 */
    if (LINE[i] && LINE[i].carry && String(LINE[i].text || '').indexOf(LINE[i].carry) < 0) {
      LINE[i].text = LINE[i].carry + '还在原处。' + LINE[i].text;
    }
  }
  EV.push.apply(EV, LINE);
  L.ARC_EVENTS = LINE;

  /* ---------- 运行时接线：一局抽两条主干，按节点顺序推到收束 ---------- */
  ARCS.map = { A: 'family', B: 'career', C: 'emotion', D: 'career' };
  /* 本轮只跑三篇主干：A 家庭 / B 职业 / C 情感。弧四 D 保留定义但不抽。 */
  ARCS.selectable = ['A', 'B', 'C'];
  ARCS.isArc = function (id) { return !!id && !!ARCS.map[id]; };
  ARCS.starter = { A: 'arcA_1', B: 'arcB_1', C: 'arcC_1', D: 'arcD_1' };
  ARCS.final = {};
  ARCS.nodes = {};

  (function () {
    for (var k = 0; k < LINE.length; k++) {
      var e = LINE[k];
      if (!e || !e.line || !ARCS.map[e.line]) continue;
      var nd = (e.owner && e.owner.node) || 0;
      var ns = ARCS.nodes[e.line] || (ARCS.nodes[e.line] = {});
      if (!ns[nd]) ns[nd] = [];
      ns[nd].push(e.id);
      if (!ARCS.final[e.line] || nd > ARCS.final[e.line]) ARCS.final[e.line] = nd;
    }
  })();

  /* 给两条抽中的弧各塞入第一节；之后靠 fx.flag 的 pending 链往前走 */
  ARCS.seed = function (g) {
    if (!g) return g;
    if (!Array.isArray(g.pending)) g.pending = [];
    var sel = Array.isArray(g.selectedLines) ? g.selectedLines : [];
    for (var s = 0; s < sel.length; s++) {
      var lid = sel[s];
      if (!ARCS.isArc(lid)) continue;
      var sid = ARCS.starter[lid];
      var ev = sid && IDX[sid];
      if (!ev || (g.fired && g.fired.indexOf(sid) >= 0)) continue;
      var has = false;
      for (var p = 0; p < g.pending.length; p++) {
        if (g.pending[p] && g.pending[p].event === sid) { has = true; break; }
      }
      if (!has) g.pending.push({ event: sid, dueAge: Number(ev.ageMin) || Number(g.age) || 0, line: lid, arc: true });
    }
    return g;
  };

  /* 一点审计辅助：弧进度、是否停半路、carry 是否可见 */
  ARCS.progress = function (g) {
    var out = {};
    var sel = Array.isArray(g && g.selectedLines) ? g.selectedLines : [];
    for (var s = 0; s < sel.length; s++) {
      var lid = sel[s];
      if (!ARCS.isArc(lid)) continue;
      var nodes = ARCS.nodes[lid] || {};
      var maxNode = 0, firedNodes = 0, lastAge = -1, order = true;
      var firedIds = [], missingCarry = [];
      var ids = [];
      for (var n in nodes) if (nodes.hasOwnProperty(n)) ids.push(n);
      ids.sort(function (a, b) { return Number(a) - Number(b); });
      for (var q = 0; q < ids.length; q++) {
        var nodeN = Number(ids[q]);
        var list = nodes[ids[q]];
        var firedHere = 0, ageHere = -1;
        for (var r = 0; r < list.length; r++) {
          if (g.fired && g.fired.indexOf(list[r]) >= 0) {
            firedHere++;
            firedIds.push(list[r]);
            var ev = IDX[list[r]];
            if (ev) {
              ageHere = Math.max(ageHere, Number(ev.ageMin) || 0);
              /* 承接可见：上一节留下的物件必须在本节正文里出现 */
              if (ev.carry && String(ev.text || '').indexOf(ev.carry) < 0) missingCarry.push(ev.id);
            }
          }
        }
        if (firedHere) {
          firedNodes++;
          if (nodeN > maxNode) maxNode = nodeN;
          if (ageHere < lastAge) order = false;
          if (ageHere > lastAge) lastAge = ageHere;
        }
      }
      /* 收束节点的最早可触发年龄：审计用来区分「弧断了」和「人先死了」 */
      var endAge = 999;
      var flist = (ARCS.final[lid] && nodes[ARCS.final[lid]]) || [];
      for (var t = 0; t < flist.length; t++) {
        var fe = IDX[flist[t]];
        if (fe && typeof fe.ageMin === 'number') endAge = Math.min(endAge, fe.ageMin);
      }
      out[lid] = {
        final: ARCS.final[lid] || 0,
        endAge: endAge === 999 ? 0 : endAge,
        maxNode: maxNode,
        firedNodes: firedNodes,
        reachedEnd: !!(ARCS.final[lid] && maxNode >= ARCS.final[lid]),
        orderOk: order,
        firedIds: firedIds,
        missingCarry: missingCarry
      };
    }
    return out;
  };
})();
