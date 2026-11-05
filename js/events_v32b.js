/* =========================================================
   events_v32b.js — v3.2 社交事件（NPC 主动层）+ 跨年回响
   只追加事件，不改动 events.js / social.js / state.js
   ========================================================= */
(function () {
  'use strict';
  var LS = window.LS;
  if (!LS) return;
  /* engine.js 里用的是 LS.social，social.js 把对象挂在 LS.SOCIAL 上 */
  if (!LS.social && LS.SOCIAL) LS.social = LS.SOCIAL;

  var E = LS.EVENTS;
  if (!E) { E = []; LS.EVENTS = E; }

  var lastG = null;

  /* ---------------- 小工具 ---------------- */
  function C(fn) {
    return function (g) {
      lastG = g;
      var ok = false;
      try { ok = !!fn(g); } catch (e) { ok = false; }
      return ok;
    };
  }
  function A(a, b, fn) {
    return C(function (g) {
      if (!g) return false;
      var age = Number(g.age) || 0;
      if (age < a || age > b) return false;
      return fn ? !!fn(g) : true;
    });
  }
  function o(label, fx, extra) {
    var r = { label: label, fx: fx || {} };
    if (extra) for (var k in extra) r[k] = extra[k];
    return r;
  }
  function W(text, fx, w, label) {
    return { w: w === undefined ? 60 : w, text: text, label: label || '', fx: fx || {} };
  }
  function o2(label, fx, a, b, extra) {
    var r = o(label, fx, extra);
    r.outcomes = [a, b];
    return r;
  }
  function o3(label, fx, a, b, c, extra) {
    var r = o(label, fx, extra);
    r.outcomes = [a, b, c];
    return r;
  }
  function NX(key, patch) { var m = {}; m[key] = patch; return m; }
  function npc(g, key) { return LS.getNpc(g, key); }
  function alive(g, key) { var n = npc(g, key); return !!(n && n.alive); }
  function fam(g) { return (g && g.family) || {}; }
  function marriage(g) { return fam(g).marriage || {}; }
  function married(g) { return !!(marriage(g).status === '已婚'); }
  function firstChild(g) {
    var ids = fam(g).childrenIds || [];
    for (var i = 0; i < ids.length; i++) {
      var n = LS.getNpc(g, ids[i]);
      if (n && n.alive) return n;
    }
    return null;
  }
  function spouse(g) {
    var m = marriage(g);
    return m.spouseId ? LS.getNpc(g, m.spouseId) : null;
  }
  function sib(g, roles) {
    var s = g && g.sibling;
    if (!s || !s.has) return null;
    if (roles && roles.indexOf(s.role) < 0) return null;
    var n = LS.getNpc(g, 'sibling') || (s.name ? LS.getNpc(g, s.name) : null);
    return (n && n.alive) ? n : null;
  }
  function parentAlive(g) { return alive(g, '父亲') || alive(g, '母亲'); }
  function parentDead(g) {
    var f = npc(g, '父亲'), m = npc(g, '母亲');
    return !!((f && !f.alive) || (m && !m.alive));
  }
  function negNpc(g) {
    var list = (g && g.npcs) || [];
    for (var i = 0; i < list.length; i++) {
      var n = list[i];
      if (n && n.alive && Number(n.favor) <= -2) return n;
    }
    return null;
  }
  function hasJob(g) { return !!(g && g.job && g.job.id); }
  function bossOf(g) { return npc(g, 'boss') || npc(g, '上司'); }

  /* 常用的 NPC 补位配置：旧档没有该角色时由选项创建 */
  var EN = {
    faxiao: { role: '发小', id: 'faxiao', age: 30, circle: '发小圈', intimacy: 52, name: '发小', note: '从小一起长大的人', anchor: '小时候你和他蹲在巷口分过一包辣条' },
    tongxue: { role: '同学', id: 'classmate', age: 30, circle: '同学圈', intimacy: 50, note: '读书时坐得不远的同学', anchor: '你们当年在同一间教室里抄过作业' },
    friend: { role: '朋友', id: 'friend', age: 30, circle: '兴趣圈', intimacy: 54, note: '一起玩得来的朋友', anchor: '你们在球场上认识，后来常一起吃饭' },
    lover: { role: '恋人', id: 'lover', age: 28, circle: '兴趣圈', intimacy: 56, note: '正在交往的人', anchor: '你们从一次加班后的夜宵开始熟起来' },
    client: { role: '客户', id: 'client', age: 40, circle: '行业圈', intimacy: 48, note: '合作过的客户', anchor: '第一单业务是你陪他跑了三趟才谈下来的' },
    mentor: { role: '恩人', id: 'mentor', age: 50, circle: '行业圈', intimacy: 58, favor: 2, note: '在关键时候拉过你一把的人', anchor: '你最难的时候，他替你说过一句话' },
    enemy: { role: '仇人', id: 'enemy', age: 40, circle: '行业圈', intimacy: 24, favor: -2, note: '和你结过怨的人', anchor: '你们因为一件事撕破了脸' },
    junior: { role: '下属', id: 'junior', age: 26, circle: '同事圈', intimacy: 50, note: '跟着你做事的人', anchor: '他刚入职时是你带的' },
    colleague: { role: '同事', id: 'colleague', age: 32, circle: '同事圈', intimacy: 50, note: '同一个办公室的人', anchor: '你们一起加过班、顶过班' },
    boss: { role: '上司', id: 'boss', age: 44, circle: '同事圈', intimacy: 48, note: '管着你的人', anchor: '你入职那天，他把你领进了工位' }
  };

  /* 事件模板文本：{{track}} / {{npc:角色}} / {{anchor:角色}} */
  LS.renderTemplate = function (str, g) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/\{\{\s*([^{}]+?)\s*\}\}/g, function (raw, key) {
      var k = String(key).replace(/\s+/g, '');
      if (k === 'track') {
        var labs = LS.TRACK_LABELS || {};
        return g && g.track && labs[g.track] ? labs[g.track] : '还没定方向';
      }
      if (k.indexOf('npc:') === 0) {
        var role = k.slice(4);
        var n = g ? LS.getNpc(g, role) : null;
        return (n && n.name) ? n.name : role;
      }
      if (k.indexOf('anchor:') === 0) {
        var r2 = k.slice(7);
        var m = g ? LS.getNpc(g, r2) : null;
        if (!m || !m.anchors || !m.anchors.length) return '';
        var a = m.anchors[m.anchors.length - 1];
        return (a && a.text) ? String(a.text) : '';
      }
      return raw;
    });
  };
  function T(tpl) {
    return {
      enumerable: true, configurable: true,
      get: function () { return LS.renderTemplate(tpl, lastG); }
    };
  }

  function add(e) {
    if (e.tier === undefined) e.tier = 'daily';
    if (e.weight === undefined) e.weight = 2;
    if (e.type === undefined) e.type = 'random';
    E.push(e);
  }

  /* =========================================================
     一、日常社交事件（layer: random）
     ========================================================= */

  /* ---- 童年 / 少年 ---- */
  add({
    id: 'v32_soc_faxiao_play', type: 'random', layer: 'random', stage: '童年', age: [0, 0],
    weight: 3, art: 'home', cond: A(7, 11),
    title: '发小喊你出去玩',
    text: '放学铃一响，发小已经把书包甩到肩上，站在校门口等你。河滩上新修了水泥渠，他说能摸到鱼。你想起母亲说过今天要检查作业。',
    opts: [
      o2('跟他去河滩上疯一下', { ensureNpc: EN.faxiao, at: { happiness: 4, stress: -2 }, tag: '小时候和发小在河滩上玩过一下午' },
        W('你们摸了两条小鱼，回家挨了一顿骂，但那一年的夏天记得特别清楚。', { npc: { '发小': { intimacy: 8, anchor: { kind: 'play', text: '你们在河滩上摸鱼，一起被家长骂' } } } }),
        W('他在渠边滑了一跤，膝盖磕破，你扶他回家，自己却被母亲拎着耳朵。', { at: { health: -2 }, npc: { '发小': { intimacy: 4 } } }, 40)),
      o2('先回去写作业，改天再玩', { ensureNpc: EN.faxiao, at: { knowledge: 3, stress: 2 }, tag: '小时候拒绝了发小的邀约' },
        W('他嘟囔了一句“没意思”，第二天还是来找你了。', { npc: { '发小': { intimacy: 2 } } }),
        W('他后来跟别人玩得更近，你有一阵子放学只能自己走。', { npc: { '发小': { intimacy: -4 } }, at: { happiness: -2 } }, 40)),
      o2('叫他来家里一起写', { ensureNpc: EN.faxiao, at: { knowledge: 2, happiness: 1 }, tag: '小时候带发小回家写过作业' },
        W('两个人趴在桌上写到天黑，他的字还是很难看，但作业都交了。', { npc: { '发小': { intimacy: 6, anchor: { kind: 'study', text: '他第一次在你家写完了作业' } } } }),
        W('他把墨水弄到了你的本子上，你们为了这事吵了一架。', { npc: { '发小': { intimacy: -2, favor: -1 } }, at: { stress: 2 } }, 40))
    ]
  });

  add({
    id: 'v32_soc_tongxue_cheat', type: 'random', layer: 'random', stage: '童年',
    ageMin: 9, weight: 2, art: 'exam', cond: A(9, 12),
    title: '同桌想抄你的答案',
    text: '随堂测验，同桌把卷子往你这边挪了挪，用笔尖点了点最后一道大题。监考的老师正在讲台后面改作业，教室里只有翻纸的声音。',
    opts: [
      o2('把卷子往他那边挪一点', { ensureNpc: EN.tongxue, at: { stress: 3, happiness: -1 }, tag: '小学时给同桌抄过答案' },
        W('他抄完冲你挤了挤眼。成绩出来，他第一次及格，请你吃了一根冰棍。', { npc: { '同学': { intimacy: 7, favor: 1 } } }),
        W('老师看出了两张卷子的错处一模一样，把你们一起叫到了办公室。', { rep: { school: -3 }, npc: { '同学': { intimacy: 2 } } }, 40)),
      o2('用手挡住，不给他看', { ensureNpc: EN.tongxue, rep: { school: 2 }, tag: '小学时拒绝给同桌抄答案' },
        W('他下课后没理你，但期末还是来问你题。', { npc: { '同学': { intimacy: 1 } } }),
        W('他跟别人说你小气，那一学期你们没再说过话。', { npc: { '同学': { intimacy: -6, favor: -1 } }, at: { happiness: -2 } }, 40)),
      o2('把最后一道题的思路小声讲给他', { ensureNpc: EN.tongxue, at: { knowledge: 2, charm: 2 }, tag: '小学时给同桌讲过题' },
        W('他听懂了，自己把答案写了出来。后来他常来问你题。', { npc: { '同学': { intimacy: 6, anchor: { kind: 'help', text: '你第一次给他讲懂了数学题' } } } }),
        W('你们讲话被老师听见，两个人都被罚站了一节课。', { rep: { school: -2 }, npc: { '同学': { intimacy: 3 } } }, 40))
    ]
  });

  add({
    id: 'v32_soc_sibling_share', type: 'random', layer: 'random', stage: '童年',
    weight: 3, art: 'home', cond: A(6, 12, function (g) { return !!sib(g); }),
    title: '和{{npc:sibling}}抢一样东西',
    text: '家里只买了一份零食。{{npc:sibling}}先拿到了手，说“我是大的/我小，要让着我”。母亲在厨房里喊，让你们别吵。',
    opts: [
      o2('让给他，自己去喝口水', { at: { happiness: -1, charm: 2 }, tag: '小时候总让着兄弟姐妹' },
        W('他把零食分了一半塞回你手里，说下次一起攒钱买。', { npc: { 'sibling': { intimacy: 6 } } }),
        W('他吃得很香，你在旁边看着，心里记了一笔。', { npc: { 'sibling': { intimacy: -3 } } }, 40)),
      o2('跟他争，谁抢到算谁的', { at: { health: -1, stress: 2, happiness: 2 }, tag: '小时候和兄弟姐妹抢过东西' },
        W('你们打成一团，最后母亲把零食收走，谁也没吃成，但晚上又偷偷和好了。', { npc: { 'sibling': { intimacy: 3 } } }),
        W('你抓破了他的手背，他哭了一晚上，母亲让你道了歉。', { npc: { 'sibling': { intimacy: -5, favor: -1 } }, at: { happiness: -2 } }, 40)),
      o2('提议一人一半，拿刀切开', { at: { charm: 3, knowledge: 1 }, tag: '小时候学会了和兄弟姐妹讲条件' },
        W('你切得很匀，他挑不出毛病，从此家里分东西都找你。', { npc: { 'sibling': { intimacy: 5, anchor: { kind: 'share', text: '你第一次把零食切得两边一样大' } } } }),
        W('你切歪了，他拿了大的一半，还笑你手笨。', { npc: { 'sibling': { intimacy: 1 } }, at: { happiness: 1 } }, 40))
    ]
  });

  add({
    id: 'v32_soc_parent_meeting', type: 'random', layer: 'random', stage: '童年',
    weight: 2, art: 'home', cond: A(8, 12, parentAlive),
    title: '家长会点名',
    text: '家长会结束，班主任把母亲留了下来，说你上课爱走神，但脑子不笨。母亲出来时手里攥着成绩单，脸上看不出情绪。',
    opts: [
      o2('主动认错，说以后会改', { at: { happiness: -1, knowledge: 3 }, npc: { '母亲': { intimacy: 4 } }, tag: '家长会后主动向母亲认错' },
        W('母亲没骂你，只把成绩单折好，说“知道就行”。', { npc: { '母亲': { intimacy: 6, anchor: { kind: 'promise', text: '你在家长会后答应母亲会改' } } } }),
        W('她嘴上说信你，之后每晚都来查作业。', { npc: { '母亲': { intimacy: 2 } }, at: { stress: 2 } }, 40)),
      o2('顶回去，说老师偏心', { at: { happiness: 2, stress: 3 }, npc: { '母亲': { intimacy: -5 } }, tag: '小时候顶撞过母亲' },
        W('母亲愣了一下，最后说“那你自己争气”。她没再提这事。', { npc: { '母亲': { intimacy: -1 } }, at: { happiness: 2 } }),
        W('她把筷子拍在桌上，饭桌上半天没人说话。', { npc: { '母亲': { intimacy: -8, favor: -1 } }, at: { happiness: -3 } }, 40)),
      o2('不作声，回房间把错题抄一遍', { at: { knowledge: 4, stress: 2 }, tag: '家长会后默默抄过错题' },
        W('母亲半夜起来，看见你屋里还亮着灯，给你端了杯热水。', { npc: { '母亲': { intimacy: 5 } } }),
        W('你抄到一半睡着了，第二天还是被老师点名。', { at: { happiness: -1, health: -1 } }, 40))
    ]
  });

  add({
    id: 'v32_soc_neighbor_ball', type: 'random', layer: 'random', stage: '童年',
    weight: 2, art: 'home', cond: A(7, 12),
    title: '巷子里的球赛',
    text: '巷子里的孩子凑了五六个人，拿两个书包当球门。一个高个子喊你名字，让你来守门。你其实更想去旁边看人下棋。',
    opts: [
      o2('去守门，踢到天黑', { ensureNpc: EN.friend, at: { health: 3, happiness: 4, stress: -2 }, tag: '童年在巷子里踢过球' },
        W('你扑出了两个球，散场时有人说明天还来。', { npc: { '朋友': { intimacy: 7, anchor: { kind: 'play', text: '你在巷子里的球赛上扑出过两个球' } } } }),
        W('球砸在脸上，鼻子出了血，大家散得很快。', { at: { health: -2 }, npc: { '朋友': { intimacy: 3 } } }, 40)),
      o2('推掉，去看下棋', { ensureNpc: EN.friend, at: { knowledge: 2, happiness: 1 }, tag: '小时候更喜欢看人下棋' },
        W('下棋的老人教了你一个残局，你记了很多年。', { at: { knowledge: 3 }, npc: { '朋友': { intimacy: -1 } } }),
        W('他们踢得很热闹，你在旁边看了一会儿，觉得自己像个外人。', { at: { happiness: -2 }, npc: { '朋友': { intimacy: -3 } } }, 40)),
      o2('去当裁判，谁也不得罪', { ensureNpc: EN.friend, at: { charm: 3, happiness: 1 }, tag: '小时候在球场上当过裁判' },
        W('你吹得还算公道，两边都没闹起来。', { npc: { '朋友': { intimacy: 5 } } }),
        W('一个争议球你判错了，两边都冲你嚷。', { at: { stress: 2 }, npc: { '朋友': { intimacy: -2 } } }, 40))
    ]
  });

  add({
    id: 'v32_soc_tongxue_competition', type: 'random', layer: 'random', stage: '少年',
    weight: 3, art: 'exam', cond: A(13, 16, function (g) { return alive(g, '同学'); }),
    title: '和{{npc:同学}}争一个名次',
    text: '月考排名贴在走廊，你和同学只差两分。他站在榜单前看了很久，回头冲你笑了一下，说下次不会让你。',
    opts: [
      o2('陪他一起加练，互相出题', { at: { knowledge: 5, stress: 3 }, npc: { '同学': { intimacy: 5 } }, tag: '少年时和同学一起刷题' },
        W('你们把彼此的错题都过了一遍，下一次两个人都进了前十。', { npc: { '同学': { intimacy: 8, anchor: { kind: 'study', text: '你们为了名次一起熬过晚自习' } } }, at: { knowledge: 2 } }),
        W('他留了一手，你也没把压轴题拿出来，两个人都不太痛快。', { npc: { '同学': { intimacy: 2, favor: -1 } }, at: { stress: 2 } }, 40)),
      o2('自己闷头学，不跟他来往', { at: { knowledge: 4, happiness: -2, stress: 2 }, npc: { '同学': { intimacy: -4 } }, tag: '少年时为了名次和同学疏远' },
        W('下一次你高了他五分，他主动来恭喜你。', { npc: { '同学': { intimacy: 2 } }, rep: { school: 3 } }),
        W('你们座位调开了，走廊里碰见也只是点个头。', { npc: { '同学': { intimacy: -8 } }, at: { happiness: -2 } }, 40)),
      o2('把复习资料整份给他', { at: { knowledge: 2, charm: 3 }, npc: { '同学': { intimacy: 7 } }, tag: '少年时把复习资料分给过同学' },
        W('他靠你的资料补上了短板，后来也把笔记借给你。', { npc: { '同学': { intimacy: 9, anchor: { kind: 'help', text: '你把整份复习资料给过他' } } } }),
        W('他成绩上来了，却在老师面前说资料是自己整理的。', { npc: { '同学': { favor: -2 }, at: { happiness: -3 } } }, 35))
    ]
  });

  add({
    id: 'v32_soc_friend_secret', type: 'random', layer: 'random', stage: '少年',
    weight: 2, art: 'home', cond: A(14, 18),
    title: '发小把秘密告诉了你',
    text: '晚自习后，发小把你拉到操场边，说他家里出了事，让你千万别跟别人讲。风很大，他说话时一直看着地面。',
    opts: [
      o2('答应发小，一个字都不说', { ensureNpc: EN.faxiao, npc: { '发小': { intimacy: 0 } }, at: { happiness: 3, stress: 1 }, tag: '少年时替发小守住过秘密' },
        W('很多年后他还记得那天晚上，说你是唯一没拿这事当谈资的人。', { npc: { '发小': { intimacy: 9, anchor: { kind: 'secret', text: '你把他的秘密守了很多年' } } } }),
        W('你无意中说漏了半句，话传回他耳朵里，他很久没理你。', { npc: { '发小': { intimacy: -7, favor: -1 } }, at: { happiness: -2 } }, 35)),
      o2('劝发小告诉老师或家里人', { ensureNpc: EN.faxiao, npc: { '发小': { intimacy: 0 } }, at: { charm: 3, happiness: 1 }, tag: '少年时劝发小向家里求助' },
        W('他照做了，事情没有变好，但至少不再一个人扛。', { npc: { '发小': { intimacy: 6 } } }),
        W('他觉得你不懂，甩下一句“算了”就走了。', { npc: { '发小': { intimacy: -4 } }, at: { happiness: -1 } }, 40)),
      o2('装作没听见，不想惹事', { ensureNpc: EN.faxiao, npc: { '发小': { intimacy: 0 } }, at: { stress: 2 }, tag: '少年时装作没听见发小的秘密' },
        W('他没再提过，你们的关系也没变，只是中间隔了一层。', { npc: { '发小': { intimacy: 2 } } }),
        W('后来他出了事，你总觉得自己当时应该说点什么。', { npc: { '发小': { intimacy: -3 } }, at: { happiness: -4 } }, 40))
    ]
  });

  add({
    id: 'v32_soc_sibling_exam', type: 'random', layer: 'random', stage: '少年',
    weight: 2, art: 'exam', cond: A(14, 18, function (g) { return !!sib(g); }),
    title: '{{npc:sibling}}的成绩单',
    text: '{{npc:sibling}}这次考砸了，把成绩单塞在书包最底下。母亲问起来，他看了你一眼，那一眼像是在求你别说。',
    opts: [
      o2('帮他遮掩过去', { at: { stress: 2 }, npc: { 'sibling': { intimacy: 6 } }, tag: '少年时帮兄弟姐妹瞒过成绩' },
        W('母亲没发现，他晚上偷偷把一半零花钱塞给你。', { npc: { 'sibling': { intimacy: 8, favor: 1 } } }),
        W('母亲还是从老师那里知道了，连你一起骂了一顿。', { npc: { 'sibling': { intimacy: 3 } }, at: { happiness: -1 } }, 40)),
      o2('让他自己说，你陪着', { at: { charm: 3, happiness: 1 }, npc: { 'sibling': { intimacy: 4 } }, tag: '少年时陪兄弟姐妹一起面对家长' },
        W('他结结巴巴说完，母亲发完火，转头给他找了补课老师。', { npc: { 'sibling': { intimacy: 6, anchor: { kind: 'help', text: '你陪着他说出了那张成绩单' } } } }),
        W('他觉得你出卖了他，一个星期没跟你讲话。', { npc: { 'sibling': { intimacy: -4 } }, at: { happiness: -2 } }, 35)),
      o2('把自己的笔记给他补', { at: { knowledge: 2, stress: 2 }, npc: { 'sibling': { intimacy: 5 } }, tag: '少年时给兄弟姐妹补过课' },
        W('他期末追上来不少，母亲以为是补课老师的功劳。', { npc: { 'sibling': { intimacy: 5 } } }),
        W('他根本没看，笔记原样还给你，边角都没折。', { npc: { 'sibling': { intimacy: -2 } }, at: { happiness: -1 } }, 40))
    ]
  });

  add({
    id: 'v32_soc_parent_phone', type: 'random', layer: 'random', stage: '少年',
    weight: 2, art: 'home', cond: A(14, 18, parentAlive),
    title: '父母翻你的手机',
    text: '你回家时，母亲正拿着你的手机，父亲站在旁边。屏幕上停着一条没删干净的聊天记录。他们问你这是谁。',
    opts: [
      o2('坦白，把话说清楚', { at: { stress: 3, happiness: -2, charm: 2 }, npc: { '母亲': { intimacy: 3 }, '父亲': { intimacy: 2 } }, tag: '少年时向父母坦白过聊天记录' },
        W('父亲听完只说了一句“别耽误学习”，母亲把手机还给了你。', { npc: { '母亲': { intimacy: 5, anchor: { kind: 'talk', text: '你们第一次把手机的事摊开谈' } } } }),
        W('他们还是把手机收走了，说等你考完再还。', { npc: { '母亲': { intimacy: -4 } }, at: { happiness: -3 } }, 45)),
      o2('抢过手机，摔门进房间', { at: { stress: 4, happiness: -3 }, npc: { '母亲': { intimacy: -8 }, '父亲': { intimacy: -4 } }, tag: '少年时为了手机和父母吵翻' },
        W('第二天父亲来敲门，把手机放在桌上，什么也没说。', { npc: { '父亲': { intimacy: 2 } }, at: { happiness: -1 } }),
        W('他们断了你一个月的零花钱，家里的气氛冷了很久。', { npc: { '母亲': { intimacy: -10 } }, at: { happiness: -4 } }, 45)),
      o2('说是同学的手机，借来查题', { at: { charm: 2, stress: 2 }, npc: { '母亲': { intimacy: -2 } }, tag: '少年时对父母撒过关于手机的谎' },
        W('母亲半信半疑，最后还是还给了你。', { npc: { '母亲': { intimacy: 1 } } }),
        W('她给那个同学家里打了电话，你的谎当场被戳穿。', { npc: { '母亲': { intimacy: -7, favor: -1 } }, at: { happiness: -3 } }, 45))
    ]
  });

  /* ---- 青年 ---- */
  add({
    id: 'v32_soc_lover_first', type: 'random', layer: 'random', stage: '青年',
    weight: 3, art: 'wedding', cond: A(18, 26, function (g) { return !married(g); }),
    title: '一次没话找话的约会',
    text: '下班后你们在商场门口碰头，谁也不说想去哪。她/他低头看手机，你数着路过的公交车。第一顿饭吃得很快，走出店门时天已经黑了。',
    opts: [
      o2('认真安排下一次约会', { ensureNpc: EN.lover, money: { cash: -600 }, at: { happiness: 4, stress: 1 }, tag: '年轻时认真谈过一场恋爱' },
        W('第二次见面你们聊到商场打烊，回去的路上她/他主动牵了你的手。', { npc: { '恋人': { intimacy: 9, anchor: { kind: 'date', text: '你们在商场打烊后第一次牵手' } } } }),
        W('你订的餐厅不合口味，整顿饭都有些尴尬，之后联系慢了下来。', { npc: { '恋人': { intimacy: 1 } }, at: { happiness: -2 } }, 40)),
      o2('直说最近工作忙，慢慢来', { ensureNpc: EN.lover, at: { stress: -2, happiness: 1 }, tag: '年轻时把恋爱放慢过' },
        W('她/他说理解，之后每周还是会发来一条消息。', { npc: { '恋人': { intimacy: 3 } } }),
        W('慢慢地消息变成了节日问候，最后连节日也忘了。', { npc: { '恋人': { intimacy: -6 } }, at: { happiness: -2 } }, 40)),
      o2('把话题引到工作和未来', { ensureNpc: EN.lover, at: { knowledge: 2, finance: 2 }, tag: '年轻时约会时聊过职业规划' },
        W('她/他觉得你踏实，开始认真考虑你们的关系。', { npc: { '恋人': { intimacy: 7, favor: 1 } } }),
        W('她/他说第一次约会就聊这些太累了，后来没再出来。', { npc: { '恋人': { intimacy: -5 } }, at: { happiness: -1 } }, 40))
    ]
  });

  add({
    id: 'v32_soc_friend_city', type: 'random', layer: 'random', stage: '青年',
    weight: 3, art: 'home', cond: A(20, 30),
    title: '朋友要来你的城市',
    text: '朋友在电话里说，他下周要来你这边找工作，能不能先在你那儿挤几天。你住的地方不大，沙发也不算宽。',
    opts: [
      o2('让他来住，挤一挤', { ensureNpc: EN.friend, money: { cash: -400 }, at: { happiness: 3, stress: 3 }, tag: '年轻时收留过找工作的朋友' },
        W('他住了半个月，找到工作后搬走，走前把冰箱塞满了。', { npc: { '朋友': { intimacy: 9, favor: 1, anchor: { kind: 'help', text: '他初到这座城市时在你家沙发上住过' } } } }),
        W('他住了两个月还没找到工作，你们开始为水电费别扭。', { npc: { '朋友': { intimacy: -2 } }, at: { stress: 4 } }, 40)),
      o2('帮他订两天旅馆，钱你出一半', { ensureNpc: EN.friend, money: { cash: -800 }, at: { charm: 2 }, tag: '年轻时帮朋友订过旅馆' },
        W('他面试很顺利，说这份工作有你一半功劳。', { npc: { '朋友': { intimacy: 6, favor: 1 } } }),
        W('他觉得你在跟他客气，话里话外有点生分。', { npc: { '朋友': { intimacy: -2 } } }, 40)),
      o2('说自己也不方便，给个房源链接', { ensureNpc: EN.friend, at: { stress: -1 }, tag: '年轻时拒绝过朋友的借住' },
        W('他自己找了合租房，后来还约你吃饭。', { npc: { '朋友': { intimacy: 1 } } }),
        W('他没再来找你，朋友圈也慢慢看不到了。', { npc: { '朋友': { intimacy: -6, favor: -1 } }, at: { happiness: -2 } }, 40))
    ]
  });

  add({
    id: 'v32_soc_tongxue_refer', type: 'random', layer: 'random', stage: '青年',
    weight: 2, art: 'jobfair', cond: A(22, 28, function (g) { return alive(g, '同学'); }),
    title: '向{{npc:同学}}打听一个岗位',
    text: '你听说同学在一家不错的公司，正好在招人。你在聊天框里打了几行字，删了又写，最后还是发出去了。',
    opts: [
      o2('直接开口请他内推', { at: { stress: 2 }, npc: { '同学': { intimacy: 3 } }, tag: '年轻时请同学内推过工作' },
        W('他把你的简历递了上去，还帮你说了几句好话。', { npc: { '同学': { intimacy: 8, favor: 1 } }, money: { cash: 3000 }, at: { happiness: 3, finance: 2 } }),
        W('他说名额已经定了，让你下次再看。你听不出是真是假。', { npc: { '同学': { intimacy: -2 } }, at: { happiness: -2 } }, 40)),
      o2('先请他吃饭，席间再提', { money: { cash: -900 }, at: { charm: 2, stress: 1 }, npc: { '同学': { intimacy: 4 } }, tag: '年轻时请同学吃饭托过事' },
        W('饭桌上他答应得很爽快，第二天就把HR的微信推给了你。', { npc: { '同学': { intimacy: 7, favor: 1 } } }),
        W('他全程聊别的，你把话咽了回去，这顿饭吃得有点贵。', { npc: { '同学': { intimacy: 1 } }, at: { happiness: -1 } }, 40)),
      o2('不麻烦他，自己投简历', { at: { stress: 3 }, npc: { '同学': { intimacy: 1 } }, tag: '年轻时没有麻烦同学内推' },
        W('你靠自己的简历进了面试，虽然没成，但心里踏实。', { at: { knowledge: 2, happiness: 2 } }),
        W('简历石沉大海，后来你才知道那个岗位确实是内定的。', { at: { happiness: -3 } }, 40))
    ]
  });

  add({
    id: 'v32_soc_boss_overtime', type: 'random', layer: 'random', stage: '青年',
    weight: 3, art: 'office', cond: A(23, 32, function (g) { return hasJob(g) && !!bossOf(g); }),
    title: '{{npc:boss}}留下你加班',
    text: '下班前十分钟，上司把一叠材料放在你桌上，说客户明天一早要看。办公室里其他人都在收东西，只有你的电脑还亮着。',
    opts: [
      o2('接下来，做到凌晨', { at: { stress: 5, health: -3, finance: 2 }, npc: { '上司': { intimacy: 5 } }, tag: '年轻时替上司熬过通宵' },
        W('第二天客户很满意，上司在会上点了你的名。', { npc: { '上司': { intimacy: 9, anchor: { kind: 'work', text: '你替他熬过一个通宵，方案一次通过' } } }, rep: { industry: 4 } }),
        W('材料里有他改错的数据，第二天挨批的是你。', { npc: { '上司': { intimacy: 1, favor: -1 } }, at: { happiness: -4 } }, 40)),
      o2('说家里有事，明天早上早点来', { at: { happiness: 2, stress: 1 }, npc: { '上司': { intimacy: -3 } }, tag: '年轻时拒绝过上司的临时加班' },
        W('他脸色不太好，但第二天你自己把材料补齐了。', { npc: { '上司': { intimacy: 1 } }, at: { knowledge: 2 } }),
        W('他在周会上说年轻人吃不了苦，你听得很清楚。', { npc: { '上司': { intimacy: -7, favor: -1 } }, at: { happiness: -3 } }, 40)),
      o2('叫上同事一起做，分工到人', { at: { charm: 3, stress: 3 }, npc: { '上司': { intimacy: 3 }, '同事': { intimacy: 3 } }, tag: '年轻时拉着同事一起加过班' },
        W('两个人做到十一点，上司请了夜宵，说你会带人。', { npc: { '上司': { intimacy: 6 }, '同事': { intimacy: 5 } }, rep: { industry: 2 } }),
        W('同事嘴上答应，实际干了一半就找借口走了。', { npc: { '同事': { intimacy: -4 } }, at: { stress: 3 } }, 40))
    ]
  });

  add({
    id: 'v32_soc_colleague_team', type: 'random', layer: 'random', stage: '青年',
    weight: 3, art: 'office', cond: A(22, 35, function (g) { return hasJob(g); }),
    title: '同事拉你进一个小群',
    text: '午休时，同事把你拉进一个没有领导的小群。群里在讨论部门里谁该升、谁在混，还有人问你怎么看。',
    opts: [
      o2('跟着聊两句，不站队', { ensureNpc: EN.colleague, at: { charm: 2, stress: 1 }, npc: { '同事': { intimacy: 3 } }, tag: '年轻时在同事群里说过场面话' },
        W('大家觉得你还算上道，之后有事会叫上你。', { npc: { '同事': { intimacy: 5 } } }),
        W('你的一句话被人截图发给了当事人。', { npc: { '同事': { favor: -2 } }, rep: { industry: -3 }, at: { stress: 3 } }, 40)),
      o2('只发表情，不接话', { ensureNpc: EN.colleague, at: { stress: -1 }, npc: { '同事': { intimacy: 1 } }, tag: '年轻时在同事群里装过哑巴' },
        W('群里慢慢也不怎么@你了，落得清静。', { npc: { '同事': { intimacy: 1 } } }),
        W('他们背后说你不合群，聚餐也不再叫你。', { npc: { '同事': { intimacy: -4 } }, at: { happiness: -2 } }, 40)),
      o2('退群，私下跟同事说别拉你', { ensureNpc: EN.colleague, at: { happiness: 1, stress: 2 }, npc: { '同事': { intimacy: -2 } }, tag: '年轻时退出过同事的小群' },
        W('同事愣了一下，反倒觉得你这个人可靠。', { npc: { '同事': { intimacy: 4, favor: 1 } } }),
        W('第二天全部门都知道你退了群。', { npc: { '同事': { intimacy: -6 } }, rep: { industry: -2 } }, 40))
    ]
  });

  add({
    id: 'v32_soc_client_first', type: 'random', layer: 'random', stage: '青年',
    weight: 2, art: 'money', cond: A(24, 38, function (g) { return hasJob(g); }),
    title: '第一次陪客户吃饭',
    text: '客户把菜单推给你，说随便点。桌上还有他的两个朋友，酒已经开了。你知道这顿饭单子不小，也知道自己酒量一般。',
    opts: [
      o2('陪着喝，把场面撑住', { ensureNpc: EN.client, money: { cash: -1200 }, at: { health: -4, stress: 4, charm: 3 }, npc: { '客户': { intimacy: 5 } }, tag: '年轻时陪客户喝到吐过' },
        W('客户当场拍板，合同第二天就签了。', { npc: { '客户': { intimacy: 8, favor: 1, anchor: { kind: 'deal', text: '第一单是你在酒桌上陪下来的' } } }, money: { cash: 8000 }, rep: { industry: 4 } }),
        W('你喝进了医院，单子却被同事接手了。', { npc: { '客户': { intimacy: 2 } }, at: { health: -6, happiness: -3 } }, 40)),
      o2('以茶代酒，把方案讲清楚', { ensureNpc: EN.client, at: { knowledge: 2, charm: 2 }, npc: { '客户': { intimacy: 3 } }, tag: '年轻时用方案而不是酒拿下客户' },
        W('客户听得认真，说就冲你这份专业，单子给你。', { npc: { '客户': { intimacy: 7, favor: 1 } }, rep: { industry: 5 }, money: { cash: 5000 } }),
        W('桌上有人起哄，说你不够意思，气氛一度冷下来。', { npc: { '客户': { intimacy: -3 } }, at: { stress: 3 } }, 40)),
      o2('找借口先走，让同事顶上', { ensureNpc: EN.client, at: { stress: -1, happiness: 1 }, npc: { '客户': { intimacy: -3 }, '同事': { intimacy: 2 } }, tag: '年轻时把客户饭局让给过同事' },
        W('同事把单子谈成了，分了你一点提成。', { npc: { '客户': { intimacy: -1 }, '同事': { intimacy: 4 } }, money: { cash: 2000 } }),
        W('客户觉得你不重视他，后面的合作再没找你。', { npc: { '客户': { intimacy: -7 } }, rep: { industry: -3 } }, 40))
    ]
  });

  add({
    id: 'v32_soc_mentor_help', type: 'random', layer: 'random', stage: '青年',
    weight: 2, art: 'office', cond: A(26, 40),
    title: '一个前辈愿意带你',
    text: '行业聚会上，一个比你大不少的前辈跟你聊了半小时。临走时他说，你身上有股认真劲，有空可以来找他。',
    opts: [
      o2('第二天就带着问题登门', { ensureNpc: EN.mentor, money: { cash: -300 }, at: { knowledge: 3, stress: 1 }, npc: { '恩人': { intimacy: 5 } }, tag: '年轻时主动上门请教过前辈' },
        W('他把自己踩过的坑一条条讲给你听，还把两个客户介绍给了你。', { npc: { '恩人': { intimacy: 9, favor: 2, anchor: { kind: 'help', text: '他把自己踩过的坑毫无保留讲给你' } } }, money: { cash: 4000 }, rep: { industry: 4 } }),
        W('他那天很忙，只聊了十分钟，你回去的路上有点失落。', { npc: { '恩人': { intimacy: 2 } }, at: { happiness: -1 } }, 40)),
      o2('先加微信，逢年过节问候', { ensureNpc: EN.mentor, at: { charm: 2, stress: -1 }, npc: { '恩人': { intimacy: 3 } }, tag: '年轻时和行业前辈保持着联系' },
        W('两年后他主动找你，说有个位置适合你。', { npc: { '恩人': { intimacy: 6, favor: 1 } }, at: { happiness: 2 } }),
        W('问候发了很多次，他始终只回一个“谢谢”。', { npc: { '恩人': { intimacy: 1 } }, at: { happiness: -1 } }, 40)),
      o2('客气谢过，还是自己摸索', { ensureNpc: EN.mentor, at: { happiness: 1, stress: 2 }, npc: { '恩人': { intimacy: -1 } }, tag: '年轻时没有接受前辈的提携' },
        W('你多走了两年弯路，但也把本事练得更扎实。', { at: { knowledge: 4, finance: 1 } }),
        W('后来你才知道，他当时手里真的有一个很好的机会。', { npc: { '恩人': { favor: -2 } }, at: { happiness: -3 } }, 40))
    ]
  });

  add({
    id: 'v32_soc_enemy_rumor', type: 'random', layer: 'random', stage: '青年',
    weight: 2, art: 'emptyDesk', cond: A(24, 42),
    title: '有人在背后说你',
    text: '你先是从同事嘴里听到，后来在饭桌上又听到同一个版本：你抢了别人的功劳。传来传去，源头指向一个和你打过交道的人。',
    opts: [
      o2('找到他，当面问清楚', { ensureNpc: EN.enemy, at: { stress: 4, charm: 1 }, npc: { '仇人': { intimacy: -2 } }, tag: '年轻时当面质问过造谣的人' },
        W('他抵赖了两句，最后还是承认，说只是随口一提。事情慢慢平息。', { npc: { '仇人': { favor: 1 } }, rep: { industry: 2 } }),
        W('他反过来把话传得更难听，你和他彻底结怨。', { npc: { '仇人': { favor: -3, anchor: { kind: 'conflict', text: '你们因为一句谣言彻底翻脸' } } }, rep: { industry: -4 }, at: { happiness: -3 } }, 45)),
      o2('不解释，用业绩说话', { ensureNpc: EN.enemy, at: { stress: 3, knowledge: 2 }, npc: { '仇人': { intimacy: -1 } }, tag: '年轻时用业绩压过谣言' },
        W('半年后你拿了部门第一，谣言自己就没人提了。', { rep: { industry: 5 }, at: { happiness: 3, finance: 3 } }),
        W('你埋头做事，但好位置还是被别人拿走了。', { npc: { '仇人': { favor: -2 } }, at: { happiness: -4 } }, 45)),
      o2('请共同的朋友居中调解', { ensureNpc: EN.enemy, money: { cash: -600 }, at: { charm: 2 }, npc: { '仇人': { intimacy: 2 }, '朋友': { intimacy: 2 } }, tag: '年轻时找人调解过职场矛盾' },
        W('一顿饭把话摊开，他道了歉，你们至少表面上过得去。', { npc: { '仇人': { favor: 1 }, '朋友': { intimacy: 4 } }, rep: { industry: 2 } }),
        W('调解的人偏向他，你花了钱还落了个小题大做的名声。', { npc: { '仇人': { favor: -1 } }, at: { happiness: -2 } }, 45))
    ]
  });

  /* ---- 中年 ---- */
  add({
    id: 'v32_soc_parent_care', type: 'random', layer: 'random', stage: '中年',
    weight: 3, art: 'clinic', cond: A(45, 65, parentAlive),
    title: '父母开始需要人照顾',
    text: '父亲的体检报告上多了几行字，母亲的膝盖也不如从前。医生说要有人陪着复诊，别让他们自己跑。你在手机上翻着请假流程。',
    opts: [
      o2('请假亲自陪，工作往后放', { money: { cash: -3000 }, at: { stress: 4, happiness: 2 }, npc: { '父亲': { intimacy: 6 }, '母亲': { intimacy: 6 } }, tag: '中年时放下工作陪父母看病' },
        W('检查结果不算太坏，父亲在走廊里说“还是你在放心”。', { npc: { '父亲': { intimacy: 9, anchor: { kind: 'care', text: '你请假陪他跑完了整套复查' } }, '母亲': { intimacy: 8 } } }),
        W('你请了假，项目却被别人接手，回来后被边缘了一阵。', { npc: { '父亲': { intimacy: 5 } }, rep: { industry: -3 }, at: { stress: 5 } }, 40)),
      o2('出钱请护工，自己周末去', { money: { cash: -12000 }, at: { stress: 2, happiness: 1 }, npc: { '父亲': { intimacy: 3 }, '母亲': { intimacy: 3 } }, tag: '中年时给父母请过护工' },
        W('护工很尽心，母亲说你别总花钱，人来看看就好。', { npc: { '母亲': { intimacy: 5 } } }),
        W('护工换了两茬，父亲嫌不自在，电话里语气越来越冲。', { npc: { '父亲': { intimacy: -3 } }, at: { happiness: -2 } }, 40)),
      o2('让兄弟姐妹多担一些', { at: { stress: -2, happiness: -2 }, npc: { 'sibling': { intimacy: -5 } }, tag: '中年时把照顾父母的事推给兄弟姐妹' },
        W('兄弟姐妹嘴上答应，心里记下了这笔账，逢年过节总要提一句。', { npc: { 'sibling': { favor: -2 } } }),
        W('他们直接拒绝，电话里吵了一架，最后还是你来管。', { npc: { 'sibling': { intimacy: -10 } }, at: { stress: 6 } }, 45))
    ]
  });

  add({
    id: 'v32_soc_spouse_tired', type: 'random', layer: 'random', stage: '中年',
    weight: 3, art: 'emptyHome', cond: A(35, 55, married),
    title: '和{{npc:配偶}}说不下去',
    text: '你回到家，饭已经凉了。伴侣坐在沙发上，说今天想跟你谈谈。你实在太累，只想先睡一觉，可这句话一出口，对方的脸色就变了。',
    opts: [
      o2('坐下来，把话听完', { at: { stress: 3, happiness: 2, charm: 2 }, npc: { '配偶': { intimacy: 5 } }, tag: '中年时认真听伴侣说过一次心里话' },
        W('你们聊到半夜，很多年没说的话都说开了。', { npc: { '配偶': { intimacy: 10, anchor: { kind: 'talk', text: '你们在中年时有过一次长谈' } } }, at: { happiness: 5 } }),
        W('你听着听着睡着了，对方摔门进了卧室，冷战了半个月。', { npc: { '配偶': { intimacy: -6 } }, at: { happiness: -4 } }, 40)),
      o2('说改天再谈，先睡', { at: { stress: -2, happiness: -3 }, npc: { '配偶': { intimacy: -5 } }, tag: '中年时把伴侣的话推到了改天' },
        W('对方没再说什么，第二天照常做饭，只是话少了很多。', { npc: { '配偶': { intimacy: -2 } } }),
        W('改天一直没有来，你们后来为一件小事彻底爆发。', { npc: { '配偶': { favor: -2 } }, at: { happiness: -6 } }, 45)),
      o2('提议周末两个人出去走走', { money: { cash: -2500 }, at: { happiness: 3, stress: -2 }, npc: { '配偶': { intimacy: 4 } }, tag: '中年时和伴侣出门散过心' },
        W('两天一夜，什么正事都没谈，回来时两个人都松了些。', { npc: { '配偶': { intimacy: 7, anchor: { kind: 'trip', text: '你们在中年时单独出去过两天' } } } }),
        W('临时有事，行程取消，对方说“早就知道”。', { npc: { '配偶': { intimacy: -4 } }, at: { happiness: -2 } }, 45))
    ]
  });

  add({
    id: 'v32_soc_child_school', type: 'random', layer: 'random', stage: '中年',
    weight: 3, art: 'nursery', cond: A(35, 50, function (g) { return !!firstChild(g); }),
    title: '孩子的班主任打来电话',
    text: '班主任说孩子最近作业不交，上课也不听。你问孩子，他低着头不说话。伴侣在旁边问，是不是你平时管得太少。',
    opts: [
      o2('每天抽一小时陪着写', { at: { stress: 4, knowledge: 2 }, npc: { '子女': { intimacy: 6 }, '配偶': { intimacy: 3 } }, tag: '中年时每天陪孩子写作业' },
        W('一个月后孩子交了作业，班主任在群里点名表扬。', { npc: { '子女': { intimacy: 8, anchor: { kind: 'help', text: '你每天陪着孩子把作业补了回来' } } } }),
        W('你陪了几天就加班断掉，孩子的成绩又滑了回去。', { npc: { '子女': { intimacy: 2 } }, at: { happiness: -2 } }, 40)),
      o2('报个补习班，交给老师', { money: { cash: -15000 }, at: { stress: -1 }, npc: { '子女': { intimacy: -3 }, '配偶': { intimacy: 2 } }, tag: '中年时给孩子报过补习班' },
        W('补习班老师管得严，成绩确实上来了。', { npc: { '子女': { intimacy: 2 } }, at: { knowledge: 1 } }),
        W('孩子越来越不愿意跟你说话，回家就关门。', { npc: { '子女': { intimacy: -8 } }, at: { happiness: -3 } }, 45)),
      o2('先弄清楚他到底卡在哪', { at: { knowledge: 2, charm: 2 }, npc: { '子女': { intimacy: 5 } }, tag: '中年时先问孩子原因再决定怎么办' },
        W('原来是被同学嘲笑了，你们一起想了个办法。', { npc: { '子女': { intimacy: 7, favor: 1 } } }),
        W('他什么也不肯说，你问急了，他把门反锁了。', { npc: { '子女': { intimacy: -3 } }, at: { stress: 3 } }, 40))
    ]
  });

  add({
    id: 'v32_soc_child_rebel', type: 'random', layer: 'random', stage: '中年',
    weight: 2, art: 'emptyHome', cond: A(42, 55, function (g) { return !!firstChild(g); }),
    title: '孩子说要退学',
    text: '孩子把书包扔在地上，说不想念了。你第一反应是发火，伴侣拉住你，说先听孩子讲完。客厅里安静得能听见钟表走针。',
    opts: [
      o2('先听完，再一起找办法', { at: { stress: 3, happiness: 1, charm: 3 }, npc: { '子女': { intimacy: 7 } }, tag: '中年时陪孩子扛过一次退学念头' },
        W('孩子最后没退学，换了个方向，重新愿意去上课。', { npc: { '子女': { intimacy: 10, anchor: { kind: 'talk', text: '你们在孩子想退学时坐下来谈了一夜' } } } }),
        W('你话说得太多，孩子还是摔门走了，几天没回家。', { npc: { '子女': { intimacy: -5 } }, at: { happiness: -5, stress: 5 } }, 40)),
      o2('硬压下去，退学绝对不行', { at: { stress: 4 }, npc: { '子女': { intimacy: -8 } }, tag: '中年时强行压过孩子的退学念头' },
        W('孩子暂时留下了，但之后什么话都不跟你说。', { npc: { '子女': { intimacy: -4 } } }),
        W('他第二天自己办了手续，你从学校电话里才知道。', { npc: { '子女': { intimacy: -12, favor: -1 } }, at: { happiness: -6 } }, 45)),
      o2('请孩子的朋友来劝', { money: { cash: -500 }, at: { charm: 2, stress: 1 }, npc: { '子女': { intimacy: 3 } }, tag: '中年时请孩子的朋友帮忙劝过' },
        W('朋友的话他听进去了，答应先把这学期念完。', { npc: { '子女': { intimacy: 4 } } }),
        W('朋友反倒跟他一起骂学校，事情更僵了。', { npc: { '子女': { intimacy: -4 } }, at: { happiness: -2 } }, 40))
    ]
  });

  add({
    id: 'v32_soc_boss_layoff', type: 'random', layer: 'random', stage: '中年',
    weight: 3, art: 'emptyDesk', cond: A(40, 55, function (g) { return hasJob(g) && !!bossOf(g); }),
    title: '裁员名单',
    text: '上司把你叫到会议室，关上门。桌上放着一张名单，你的名字在最后一行。他说公司难，给你两个选择：降薪留下，或者拿补偿走。',
    opts: [
      o2('接受降薪，先保住位置', { at: { stress: 5, happiness: -4, finance: 1 }, npc: { '上司': { intimacy: 3 } }, tag: '中年时接受过降薪留下' },
        W('一年后公司缓过来，上司把薪水补回了一部分。', { npc: { '上司': { intimacy: 6, favor: 1 } }, money: { cash: 6000 } }),
        W('降薪之后活更多，你成了部门里最便宜的那个。', { npc: { '上司': { intimacy: -2 } }, at: { happiness: -3 } }, 45)),
      o2('拿补偿走人，另找机会', { at: { stress: 3, happiness: 1 }, npc: { '上司': { intimacy: 1 } }, tag: '中年时拿补偿离开过一家公司' },
        W('补偿到账，你休息了两个月，进了另一家更稳的公司。', { money: { cash: 30000 }, at: { happiness: 4 } }),
        W('年龄卡住了你，半年没找到合适的岗位。', { at: { happiness: -6, stress: 8 } }, 45)),
      o2('问他能不能把手上的客户带走', { at: { charm: 3, stress: 3 }, npc: { '上司': { intimacy: -2 }, '客户': { intimacy: 3 } }, tag: '中年时和上司谈过带走客户' },
        W('他沉默了一会儿，说“你自己看着办”。后来两个老客户真跟了你。', { npc: { '客户': { intimacy: 6, favor: 1 } }, rep: { industry: 4 } }),
        W('他把这话报了上去，你走得很不体面。', { npc: { '上司': { favor: -3, anchor: { kind: 'conflict', text: '离职时你和上司闹得很难看' } } }, rep: { industry: -5 }, at: { happiness: -4 } }, 45))
    ]
  });

  add({
    id: 'v32_soc_client_big', type: 'random', layer: 'random', stage: '中年',
    weight: 2, art: 'money', cond: A(35, 55, function (g) { return alive(g, '客户'); }),
    title: '{{npc:客户}}给了一个大单',
    text: '合作了几年的客户突然打电话来，说有个更大的项目，想交给你。他没明说条件，只说“你懂的，得表示一下”。',
    opts: [
      o2('按规矩报价，不走暗账', { at: { stress: 2 }, rep: { industry: 4 }, npc: { '客户': { intimacy: -2 } }, tag: '中年时拒绝了客户要回扣的要求' },
        W('客户犹豫了几天，最后还是签了，说就看中你不玩虚的。', { npc: { '客户': { intimacy: 5, favor: 1 } }, money: { cash: 40000 }, rep: { industry: 5 } }),
        W('单子给了别人，你丢了这一笔，但也没留下把柄。', { npc: { '客户': { intimacy: -6 } }, at: { happiness: -3 } }, 45)),
      o2('私下给他一笔，先把单拿下', { money: { cash: -8000 }, at: { stress: 3, finance: 3 }, npc: { '客户': { intimacy: 5 } }, tag: '中年时给客户送过回扣' },
        W('单子做成了，利润很厚，客户也成了长期饭票。', { npc: { '客户': { intimacy: 9, favor: 2, anchor: { kind: 'deal', text: '你和他有过一笔不见光的交易' } } }, money: { cash: 60000 } }),
        W('公司审计查到了这笔钱，你被停职调查。', { rep: { industry: -12 }, at: { stress: 12, happiness: -8 } }, 40)),
      o2('把单子让给关系更近的同事', { at: { charm: 2, happiness: -2 }, npc: { '客户': { intimacy: -3 }, '同事': { intimacy: 6 } }, tag: '中年时把大单让给过同事' },
        W('同事记了这份情，后来在你落难时帮过一次。', { npc: { '同事': { intimacy: 9, favor: 2 } }, rep: { industry: 2 } }),
        W('同事拿了单子还觉得你傻，客户也慢慢不找你了。', { npc: { '客户': { intimacy: -6 } }, at: { happiness: -3 } }, 40))
    ]
  });

  add({
    id: 'v32_soc_subordinate_mistake', type: 'random', layer: 'random', stage: '中年',
    weight: 2, art: 'office', cond: A(28, 45, function (g) { return hasJob(g); }),
    title: '下属捅了娄子',
    text: '下属把一份报价单发错了客户，数字差了整整一个零。他站在你工位旁边，脸白得像纸，说“哥/姐，我怎么办”。',
    opts: [
      o2('替他扛下来，先补窟窿', { at: { stress: 5, charm: 3 }, npc: { '下属': { intimacy: 8 } }, tag: '中年时替下属扛过一次错' },
        W('事情压住了，他后来做事明显更稳，也更服你。', { npc: { '下属': { intimacy: 11, favor: 2, anchor: { kind: 'help', text: '你替他顶下了一次报价事故' } } } }),
        W('上面追责，你被扣了季度奖金，他反倒先辞了职。', { npc: { '下属': { intimacy: 2 } }, money: { cash: -6000 }, at: { happiness: -4 } }, 40)),
      o2('让他自己去说明，你陪着', { at: { stress: 3, charm: 2 }, npc: { '下属': { intimacy: 4 } }, tag: '中年时让下属自己面对过错' },
        W('他结结巴巴讲完，被骂了一顿，但没被开。之后他遇事会先来问你。', { npc: { '下属': { intimacy: 7 } } }),
        W('他当场被辞退，走时看你的眼神很冷。', { npc: { '下属': { intimacy: -8, favor: -2 } }, at: { happiness: -3 } }, 45)),
      o2('先保自己，把责任划清', { at: { stress: -1, happiness: -1 }, npc: { '下属': { intimacy: -10 } }, rep: { industry: 2 }, tag: '中年时把下属的错误划清了责任' },
        W('你没事，团队里其他人却都记住了这件事。', { rep: { industry: -3 }, at: { happiness: -2 } }),
        W('下属被开除后到处说你冷血，行业里传了一阵。', { npc: { '下属': { favor: -3 } }, rep: { industry: -6 } }, 40))
    ]
  });

  add({
    id: 'v32_soc_sister_marry', type: 'random', layer: 'random', stage: '青年',
    weight: 2, art: 'wedding', cond: A(25, 45, function (g) { return !!(sib(g, ['妹妹']) || npc(g, '妹妹')); }),
    title: '妹妹要出嫁了',
    text: '妹妹把婚期定在秋天，家里为彩礼和酒席吵了几轮。母亲问你，作为哥哥/姐姐，你能拿出多少。',
    opts: [
      o2('尽力出一份，把场面撑起来', { money: { cash: -20000 }, at: { happiness: 3, stress: 2 }, npc: { 'sibling': { intimacy: 9 }, '母亲': { intimacy: 4 } }, tag: '妹妹出嫁时你出了一大笔' },
        W('婚礼办得体面，妹妹敬酒时说这辈子记着你。', { npc: { 'sibling': { intimacy: 12, favor: 2, anchor: { kind: 'help', text: '她出嫁时你替她撑住了场面' } } } }),
        W('钱花出去了，家里却嫌你出得不如别人多。', { npc: { 'sibling': { intimacy: 3 }, '母亲': { intimacy: -3 } }, at: { happiness: -2 } }, 40)),
      o2('量力而行，给个红包', { money: { cash: -5000 }, at: { happiness: 1 }, npc: { 'sibling': { intimacy: 3 } }, tag: '妹妹出嫁时你只随了礼' },
        W('妹妹说心意到了就行，婚后还常回来看你。', { npc: { 'sibling': { intimacy: 5 } } }),
        W('母亲在亲戚面前提了一句，你听见了，心里不舒服。', { npc: { '母亲': { intimacy: -2 } }, at: { happiness: -1 } }, 40)),
      o2('劝她别急着嫁，再想想', { at: { charm: 2, stress: 3 }, npc: { 'sibling': { intimacy: -5 } }, tag: '妹妹出嫁前你劝过她再想想' },
        W('她真的缓了半年，后来证明那门亲事确实有问题。', { npc: { 'sibling': { intimacy: 6, favor: 1 } } }),
        W('她觉得你多管闲事，婚礼都没请你上台。', { npc: { 'sibling': { intimacy: -8 } }, at: { happiness: -3 } }, 45))
    ]
  });

  add({
    id: 'v32_soc_brother_borrow', type: 'random', layer: 'random', stage: '青年',
    weight: 2, art: 'money', cond: A(25, 45, function (g) { return !!(sib(g, ['哥哥', '弟弟']) || npc(g, '哥哥') || npc(g, '弟弟')); }),
    title: '兄弟开口借钱',
    text: '兄弟在电话里绕了很久，最后说想借一笔钱周转，数目不小。他说下个月一定还，你听得出他自己也没底。',
    opts: [
      o2('借给他，写个简单的字据', { money: { cash: -15000 }, at: { stress: 2, happiness: 1 }, npc: { 'sibling': { intimacy: 6 } }, tag: '兄弟借钱时你借了并留了字据' },
        W('他按时还了一半，剩下的一年后也补上了。', { npc: { 'sibling': { intimacy: 9, favor: 2, anchor: { kind: 'lend', text: '他周转不开时你借过他一笔钱' } } }, money: { cash: 8000 } }),
        W('字据还在，人却开始躲你，逢年过节也不来了。', { npc: { 'sibling': { intimacy: -5, favor: -2 } }, at: { happiness: -3 } }, 40)),
      o2('不借钱，但帮他想别的办法', { at: { charm: 3, stress: 2 }, npc: { 'sibling': { intimacy: 3 } }, tag: '兄弟借钱时你帮他找过别的出路' },
        W('你陪他跑了两趟银行，贷款批下来，他没再提借钱的事。', { npc: { 'sibling': { intimacy: 6, favor: 1 } } }),
        W('他觉得你不肯帮忙，话说得越来越客气。', { npc: { 'sibling': { intimacy: -4 } }, at: { happiness: -2 } }, 40)),
      o2('直接拒绝，各过各的', { at: { happiness: -1, stress: -1 }, npc: { 'sibling': { intimacy: -8 } }, tag: '兄弟借钱时你拒绝了他' },
        W('他后来自己扛过去了，只是再没跟你开过口。', { npc: { 'sibling': { intimacy: -2 } } }),
        W('他在亲戚面前说你发达了就不认人。', { npc: { 'sibling': { favor: -2 } }, at: { happiness: -4 } }, 45))
    ]
  });

  /* ---- 中老年 / 晚年 ---- */
  add({
    id: 'v32_soc_parent_grave', type: 'random', layer: 'random', stage: '中老年',
    weight: 3, art: 'grave', cond: A(60, 80, parentDead),
    title: '去给父母上坟',
    text: '清明前后，你一个人去了山上。碑上的字被风雨磨得有些浅，你蹲下来用袖子擦了很久。旁边的草长得比去年高。',
    opts: [
      o2('坐一会儿，把这些年的事说给他们听', { at: { happiness: -2, stress: -4 }, tag: '上了年纪后常去给父母上坟' },
        W('你说着说着笑了，又哭了一场，下山时心里空出一块，但轻了些。', { at: { happiness: 3, stress: -3 } }),
        W('你在碑前坐了很久，回家后天已经黑了，夜里梦见母亲在厨房。', { at: { happiness: 1, health: -1 } }, 45)),
      o2('把碑重新描一遍', { money: { cash: -3000 }, at: { stress: -2, happiness: 1 }, tag: '给父母的碑重新描过字' },
        W('描完最后一个字，你在山风里站了很久，觉得这件事总算做完了。', { at: { happiness: 2 } }),
        W('石匠嫌活小不肯来，你自己描歪了两笔，看着更难受。', { at: { happiness: -2 } }, 40)),
      o2('放下花就走，不多待', { at: { stress: -1 }, tag: '上坟时总是放下花就走' },
        W('你在山脚回头看了一眼，觉得他们应该知道你来过。', { at: { happiness: 1 } }),
        W('走到半路又折回来，把花摆正，才发现自己还是放不下。', { at: { happiness: -2 } }, 40))
    ]
  });

  add({
    id: 'v32_soc_child_adult', type: 'random', layer: 'random', stage: '中老年',
    weight: 3, art: 'home', cond: A(55, 72, function (g) { return !!firstChild(g); }),
    title: '孩子要搬出去住',
    text: '孩子把行李收进两个箱子，说公司附近租了房。你帮他/她把箱子提到门口，忽然想起很多年前，也是这样送他/她去上学。',
    opts: [
      o2('帮他/她把新家收拾好', { money: { cash: -8000 }, at: { stress: 2, happiness: 3 }, npc: { '子女': { intimacy: 6 } }, tag: '孩子搬出去时你帮着安了家' },
        W('新家的灯装好那天，孩子请你吃了顿饭，说以后常回来。', { npc: { '子女': { intimacy: 8, anchor: { kind: 'help', text: '孩子第一次独立生活，是你帮着安的家' } } } }),
        W('你插手太多，孩子嫌你管得宽，后来钥匙都没给你留。', { npc: { '子女': { intimacy: -3 } }, at: { happiness: -2 } }, 40)),
      o2('只送到楼下，让他/她自己走', { at: { happiness: -1, charm: 2 }, npc: { '子女': { intimacy: 3 } }, tag: '孩子搬出去时你只送到了楼下' },
        W('车开走时孩子摇下车窗跟你挥手，你站了很久。', { npc: { '子女': { intimacy: 6 } } }),
        W('孩子头也没回，你上楼后觉得屋里空得厉害。', { npc: { '子女': { intimacy: 1 } }, at: { happiness: -3 } }, 40)),
      o2('让他/她先在家住，省点房租', { at: { happiness: 1, stress: 2 }, npc: { '子女': { intimacy: -2 } }, tag: '孩子想搬出去时你劝过留下' },
        W('孩子留下了，但约定好一年后一定搬走。', { npc: { '子女': { intimacy: 3 } } }),
        W('孩子觉得你不舍得放手，为这事跟你冷战了一阵。', { npc: { '子女': { intimacy: -4 } }, at: { happiness: -2 } }, 40))
    ]
  });

  add({
    id: 'v32_soc_faxiao_old', type: 'random', layer: 'random', stage: '中老年',
    weight: 3, art: 'home', ageMin: 55, ageMax: 78, cond: function (g) {
      return g.age >= 55 && g.age <= 78 && alive(g, '发小');
    },
    title: '和{{npc:发小}}坐在老巷口',
    text: '老巷子要拆了，发小约你回去看看。两个人坐在已经关了门的杂货铺台阶上，一人一瓶啤酒，聊着谁家孩子结婚了。',
    opts: [
      o2('陪他坐到天黑', { at: { happiness: 4, stress: -3 }, npc: { '发小': { intimacy: 6 } }, tag: '老巷子拆迁前和发小坐了一晚上' },
        W('你们把小时候的事翻了个遍，散场时说以后每年都回来坐一次。', { npc: { '发小': { intimacy: 9, anchor: { kind: 'memory', text: '老巷子拆之前，你们在台阶上坐到天黑' } } } }),
        W('他接了家里的电话先走了，你一个人坐到路灯亮。', { npc: { '发小': { intimacy: 3 } }, at: { happiness: -1 } }, 40)),
      o2('拍几张照片留个念', { at: { happiness: 2, charm: 1 }, npc: { '发小': { intimacy: 4 } }, tag: '给老巷子拍过照片' },
        W('照片洗出来，他一张你一张，背后写了同一句话。', { npc: { '发小': { intimacy: 6 } } }),
        W('手机丢了，照片一张没剩，你后来想起就心疼。', { at: { happiness: -2 } }, 40)),
      o2('说家里有事，先走', { at: { stress: -1, happiness: -2 }, npc: { '发小': { intimacy: -4 } }, tag: '老巷子拆迁前你提前走了' },
        W('他没说什么，后来一个人把整条巷子走了一遍。', { npc: { '发小': { intimacy: -1 } } }),
        W('巷子拆了以后，你们见面的理由也少了。', { npc: { '发小': { intimacy: -5 } }, at: { happiness: -2 } }, 45))
    ]
  });

  add({
    id: 'v32_soc_tongxue_old', type: 'random', layer: 'random', stage: '中老年',
    weight: 2, art: 'home', cond: A(55, 78, function (g) { return alive(g, '同学'); }),
    title: '同学群里的一条讣告',
    text: '同学群里突然安静了。有人发了一条消息，说当年的班长走了。下面跟着一排“节哀”，再没人说话。',
    opts: [
      o2('去送一程', { money: { cash: -2000 }, at: { happiness: -3, stress: -1 }, npc: { '同学': { intimacy: 5 } }, tag: '去送过一位老同学' },
        W('葬礼上你见到很多年没见的人，大家互相拍了拍肩。', { npc: { '同学': { intimacy: 7 } }, at: { happiness: 1 } }),
        W('你站在人群最后面，忽然发现自己已经记不清他的声音。', { at: { happiness: -4 } }, 40)),
      o2('在群里说几句，不去了', { at: { happiness: -2 }, npc: { '同学': { intimacy: 1 } }, tag: '老同学去世时你只在群里说了几句' },
        W('有人私信你，说理解，大家都不容易。', { npc: { '同学': { intimacy: 3 } } }),
        W('后来群里再有人走，消息也没人回了。', { at: { happiness: -3 } }, 40)),
      o2('给家属转一笔钱，不露面', { money: { cash: -1000 }, at: { happiness: -1 }, npc: { '同学': { intimacy: 2 } }, tag: '老同学去世时你转了钱没去' },
        W('家属回了一条很长的感谢，你看完删了。', { at: { happiness: 1 } }),
        W('钱转过去了，你心里还是觉得欠着一趟。', { at: { happiness: -2 } }, 40))
    ]
  });

  add({
    id: 'v32_soc_spouse_old', type: 'random', layer: 'random', stage: '中老年',
    weight: 3, art: 'home', cond: A(60, 85, married),
    title: '和{{npc:配偶}}在医院走廊',
    text: '伴侣做了一个小手术，你在走廊里等。护士叫号时你站起来太快，腿有点发软。手术很快，推出来时人还睡着。',
    opts: [
      o2('守着，直到醒过来', { at: { stress: 3, health: -2, happiness: 2 }, npc: { '配偶': { intimacy: 6 } }, tag: '伴侣手术时你一直守在床边' },
        W('伴侣醒来第一句话是问你吃没吃饭。你转过身擦了擦眼睛。', { npc: { '配偶': { intimacy: 10, anchor: { kind: 'care', text: '手术醒来时，她/他先问的是你吃没吃饭' } } } }),
        W('你守到半夜睡着了，护士叫醒你时天已经亮。', { npc: { '配偶': { intimacy: 4 } }, at: { health: -3 } }, 40)),
      o2('请个护工，自己回去处理事', { money: { cash: -6000 }, at: { stress: -2, happiness: -1 }, npc: { '配偶': { intimacy: -3 } }, tag: '伴侣手术时你请了护工' },
        W('护工照顾得不错，伴侣却说病房里少了个人。', { npc: { '配偶': { intimacy: 1 } } }),
        W('伴侣嘴上不说，之后很久没主动跟你讲话。', { npc: { '配偶': { intimacy: -6 } }, at: { happiness: -3 } }, 45)),
      o2('叫孩子回来一趟', { at: { charm: 2, stress: 1 }, npc: { '配偶': { intimacy: 3 }, '子女': { intimacy: 2 } }, tag: '伴侣手术时你把孩子叫了回来' },
        W('孩子请了假赶回来，病房里三个人挤在一起，倒有点热闹。', { npc: { '配偶': { intimacy: 5 }, '子女': { intimacy: 5 } } }),
        W('孩子回不来，只在电话里说了几句，伴侣挂了电话没说话。', { npc: { '配偶': { intimacy: -2 }, '子女': { intimacy: -2 } }, at: { happiness: -2 } }, 40))
    ]
  });

  add({
    id: 'v32_soc_grandkid', type: 'random', layer: 'random', stage: '中老年',
    weight: 2, art: 'nursery', cond: A(58, 78, function (g) { return !!firstChild(g); }),
    title: '孩子把孩子送回来了',
    text: '孩子说工作忙，想把小孩放你这儿住一阵。小孩抱着一个旧玩偶，站在门口叫你，声音很小。',
    opts: [
      o2('接下来，当自己的娃带', { at: { stress: 3, happiness: 5, health: -2 }, npc: { '子女': { intimacy: 6 } }, tag: '帮孩子带过孙辈' },
        W('小孩住了半年，学会叫你起床，你觉得自己又年轻了几岁。', { npc: { '子女': { intimacy: 8, anchor: { kind: 'help', text: '孩子最忙的那几年，是你帮着带大了孙辈' } } }, at: { happiness: 3 } }),
        W('带了两个月你就吃不消，孩子只好另想办法。', { npc: { '子女': { intimacy: 2 } }, at: { health: -4, happiness: -2 } }, 40)),
      o2('只答应带白天，晚上送回去', { at: { stress: 2, happiness: 2 }, npc: { '子女': { intimacy: 3 } }, tag: '帮孩子带过白天的孙辈' },
        W('每天傍晚孩子来接，小孩总要磨蹭一会儿才肯走。', { npc: { '子女': { intimacy: 5 } }, at: { happiness: 2 } }),
        W('接送太折腾，没多久这件事就停了。', { npc: { '子女': { intimacy: -1 } }, at: { stress: 3 } }, 40)),
      o2('说自己身体不行，让他们请人', { at: { stress: -2, happiness: -1 }, npc: { '子女': { intimacy: -3 } }, tag: '孩子请你带孙辈时你拒绝了' },
        W('孩子请了阿姨，偶尔带小孩来看你，关系还算过得去。', { npc: { '子女': { intimacy: 1 } } }),
        W('孩子觉得你不肯帮，之后电话也少了。', { npc: { '子女': { intimacy: -6 } }, at: { happiness: -3 } }, 45))
    ]
  });

  /* =========================================================
     二、NPC 主动事件（layer: npc，engine 记入 g.npcInitiated）
     ========================================================= */
  add({
    id: 'v32_npc_faxiao_borrow', type: 'random', layer: 'npc', npcId: '发小', stage: '中年',
    weight: 3, art: 'money', cond: A(28, 48, function (g) { return alive(g, '发小'); }),
    title: '{{npc:发小}}半夜打来借钱',
    text: '夜里十一点，发小打来电话。他做生意押了一批货，还差一笔钱周转，说下个月货款回来就还。你听得出他喝了酒。',
    opts: [
      o3('借他十万，先把难关过了', { money: { cash: -10000 }, kindness: { role: '发小', kind: 'lend', text: '他押货周转不开时，你借给他一笔钱', amount: 10000, intimacy: 9, favor: 2 }, tag: '发小开口时你借了他一大笔' },
        W('一个月后货款到账，他连本带利还了，还多塞了两条烟。', { money: { cash: 11000 }, npc: { '发小': { intimacy: 8, favor: 1, anchor: { kind: 'lend', text: '他最难的时候，你借过他一笔钱' } } } }),
        W('货压在手里卖不动，他每次见你都绕着还钱的话说。', { npc: { '发小': { intimacy: -3, favor: -2 } }, at: { happiness: -3 } }, 45),
        W('钱还了一半，他人就去了外地，电话也换了。', { npc: { '发小': { favor: -4 } }, at: { happiness: -5, stress: 4 } }, 20)),
      o2('拿三万，明说这是能拿出的全部', { money: { cash: -3000 }, kindness: { role: '发小', kind: 'lend', text: '他开口借钱，你量力借了他三万', amount: 3000, intimacy: 5, favor: 1 }, tag: '发小借钱时你量力借了一部分' },
        W('他接过钱，说三万也够撑一阵，后来分期还清了。', { money: { cash: 3000 }, npc: { '发小': { intimacy: 6 } } }),
        W('他嫌少，嘴上说“够了”，之后联系明显少了。', { npc: { '发小': { intimacy: -4, favor: -1 } }, at: { happiness: -2 } }, 45)),
      o2('不借，直说自己也紧', { wrong: { role: '发小', kind: 'refuse', text: '他半夜开口借钱，你拒绝了他', intimacy: -8, favor: -2 }, tag: '发小借钱时你拒绝了他' },
        W('他沉默了一会儿，说理解，挂了电话。后来见面还是照常打招呼。', { npc: { '发小': { intimacy: -1 } } }),
        W('他到处说你发达了不认人，老同学都知道了。', { npc: { '发小': { favor: -3 } }, at: { happiness: -4 } }, 50))
    ]
  });

  add({
    id: 'v32_npc_faxiao_gift', type: 'random', layer: 'npc', npcId: '发小', stage: '青年',
    weight: 2, art: 'wedding', cond: A(22, 45, function (g) { return alive(g, '发小'); }),
    title: '{{npc:发小}}结婚，等你随礼',
    text: '发小的婚礼定在国庆。他亲自送来请帖，半开玩笑地说“你可别空手来”。你翻了翻银行卡余额，心里盘算着数目。',
    opts: [
      o2('随一份大的，给他撑场面', { money: { cash: -2000 }, kindness: { role: '发小', kind: 'gift', text: '他结婚时，你随了一份大礼', amount: 2000, intimacy: 8, favor: 1 }, tag: '发小结婚时你随了大礼' },
        W('他在敬酒时特意提到你，说这辈子有这样的朋友值了。', { npc: { '发小': { intimacy: 9, anchor: { kind: 'gift', text: '他结婚那天，你随了一份大礼' } } } }),
        W('你随了礼，他忙得没顾上跟你说话，后来也没提。', { npc: { '发小': { intimacy: 2 } }, at: { happiness: -1 } }, 40)),
      o2('按普通朋友的标准随', { money: { cash: -500 }, kindness: { role: '发小', kind: 'gift', text: '他结婚时，你按普通标准随了礼', amount: 500, intimacy: 3, favor: 0 }, tag: '发小结婚时你随了普通礼' },
        W('他收了礼，婚后还专门请你吃了顿饭。', { npc: { '发小': { intimacy: 5 } } }),
        W('他在酒桌上跟别人比了比红包，脸色不太好看。', { npc: { '发小': { intimacy: -3 } }, at: { happiness: -2 } }, 45)),
      o2('说去不了，回头补', { wrong: { role: '发小', kind: 'absent', text: '他结婚时你没去，礼也一直没补', intimacy: -6, favor: -1 }, tag: '发小结婚时你没去' },
        W('他婚礼后给你发了照片，你转了个红包，他收了。', { npc: { '发小': { intimacy: -1 } } }),
        W('他再没提这件事，但你们之间像隔了一层。', { npc: { '发小': { intimacy: -8, favor: -2 } }, at: { happiness: -2 } }, 50))
    ]
  });

  add({
    id: 'v32_npc_tongxue_refer', type: 'random', layer: 'npc', npcId: '同学', stage: '青年',
    weight: 2, art: 'jobfair', cond: A(23, 40, function (g) { return alive(g, '同学'); }),
    title: '{{npc:同学}}求你递个简历',
    text: '同学在微信上发来一份简历，说听说你公司正在招人，能不能帮忙递一下。他连发了几条，最后补了一句“不方便就算了”。',
    opts: [
      o2('帮他递给HR，还说了好话', { kindness: { role: '同学', kind: 'refer', text: '他找工作那年，你把他的简历递进了公司', intimacy: 7, favor: 2 }, tag: '同学找工作时你帮忙递过简历' },
        W('他进了面试，虽然没成，但一直记着这份情。', { npc: { '同学': { intimacy: 8, favor: 2, anchor: { kind: 'refer', text: '他找工作时，你把简历递进了公司' } } } }),
        W('HR嫌他履历不对口，你在中间解释了半天，最后也没成。', { npc: { '同学': { intimacy: 4 } }, at: { stress: 2 } }, 40)),
      o2('只把招聘要求发给他，让他自己投', { kindness: { role: '同学', kind: 'refer', text: '他求门路时，你只把招聘信息发给了他', intimacy: 2, favor: 0 }, tag: '同学求门路时你只给了信息' },
        W('他自己投了简历，居然也进了面试。', { npc: { '同学': { intimacy: 3 } } }),
        W('他投了没回音，觉得你其实没帮上忙。', { npc: { '同学': { intimacy: -2 } }, at: { happiness: -1 } }, 45)),
      o2('说公司卡学历，帮不了', { wrong: { role: '同学', kind: 'refuse', text: '他求你递简历时，你推说公司卡学历', intimacy: -6, favor: -1 }, tag: '同学求内推时你拒绝了他' },
        W('他说没关系，后来从别人那里听说岗位其实还在招。', { npc: { '同学': { favor: -2 } } }),
        W('他在同学群里说你不念旧情，你被好几个人私信问起。', { npc: { '同学': { intimacy: -10, favor: -3 } }, rep: { school: -5 }, at: { happiness: -3 } }, 50))
    ]
  });

  add({
    id: 'v32_npc_tongxue_grudge', type: 'random', layer: 'npc', npcId: '同学', stage: '中年',
    weight: 2, art: 'emptyHome', cond: A(30, 55, function (g) { return alive(g, '同学'); }),
    title: '{{npc:同学}}翻起了旧账',
    text: '饭局上同学突然提起很多年前的一件事，说当年你欠他一个人情，一直没还。桌上的人都停了筷子，等着看你怎么接。',
    opts: [
      o2('当场认下，说这顿我请', { money: { cash: -1500 }, npc: { '同学': { intimacy: 5, favor: 1, anchor: { kind: 'repair', text: '他在饭桌上翻旧账，你认下并请了客' } } }, tag: '同学翻旧账时你当场认下' },
        W('他愣了一下，端起杯说“就冲这句，过去了”。', { npc: { '同学': { intimacy: 7, favor: 1 } } }),
        W('他借坡下驴，又提了两件旧事，这顿饭吃得很长。', { npc: { '同学': { intimacy: 1 } }, at: { stress: 3 } }, 40)),
      o2('私下约他，认真谈一次', { at: { stress: 3, charm: 2 }, npc: { '同学': { intimacy: 4 } }, tag: '同学翻旧账时你私下约他谈过' },
        W('你们把当年的事从头捋了一遍，他说其实只是心里堵。', { npc: { '同学': { intimacy: 6, anchor: { kind: 'talk', text: '你们把一桩多年的旧账谈开了' } } } }),
        W('他越说越激动，最后拍桌子走了。', { npc: { '同学': { favor: -2 } }, at: { happiness: -3 } }, 45)),
      o2('装傻，说记不清了', { wrong: { role: '同学', kind: 'offend', text: '他在饭桌上翻旧账，你装傻说不记得', intimacy: -8, favor: -2 }, tag: '同学翻旧账时你装傻' },
        W('他笑了笑，没再往下说，饭局很快散了。', { npc: { '同学': { intimacy: -3 } } }),
        W('第二天他把你当年的事写成一段发在群里。', { npc: { '同学': { favor: -4 } }, rep: { school: -4 }, at: { happiness: -4 } }, 50))
    ]
  });

  add({
    id: 'v32_npc_friend_invite', type: 'random', layer: 'npc', npcId: '朋友', stage: '青年',
    weight: 2, art: 'home', cond: A(18, 55),
    title: '朋友临时约你出去',
    text: '周五下班前，朋友发来消息，说晚上几个人聚一聚，地方都订好了。你这周很累，本来打算回家躺着。',
    opts: [
      o2('去，露个面', { ensureNpc: EN.friend, at: { happiness: 3, stress: -2 }, npc: { '朋友': { intimacy: 6 } }, tag: '朋友临时邀约你去了' },
        W('你去了，席间认识了一个后来帮过你忙的人。', { npc: { '朋友': { intimacy: 7, anchor: { kind: 'gather', text: '那晚的饭局是你到场才热闹起来的' } } }, rep: { industry: 2 } }),
        W('你去了，但全程没什么精神，提前离席时他有点扫兴。', { npc: { '朋友': { intimacy: 2 } }, at: { happiness: 1 } }, 40)),
      o2('说改天，我请', { ensureNpc: EN.friend, at: { stress: -1 }, npc: { '朋友': { intimacy: 1 } }, tag: '朋友临时邀约你推到了改天' },
        W('他嘴上说好，改天却一直没定下来。', { npc: { '朋友': { intimacy: 1 } } }),
        W('后来你听说那晚他们玩得很开心，没人再问你。', { npc: { '朋友': { intimacy: -4 } }, at: { happiness: -2 } }, 40)),
      o2('直接说不想去', { ensureNpc: EN.friend, at: { happiness: -1 }, npc: { '朋友': { intimacy: -3 } }, tag: '朋友临时邀约你直接拒绝了' },
        W('他说行，下次提前约你。', { npc: { '朋友': { intimacy: 1 } } }),
        W('他回了个“哦”，之后再约人就绕过你了。', { npc: { '朋友': { intimacy: -6, favor: -1 } }, at: { happiness: -2 } }, 45))
    ]
  });

  add({
    id: 'v32_npc_friend_comfort', type: 'random', layer: 'npc', npcId: '朋友', stage: '青年',
    weight: 2, art: 'home', cond: A(20, 65),
    title: '朋友深夜说撑不住了',
    text: '凌晨一点，朋友发来一长段话，说最近什么都做不好，问我是不是很失败。消息后面跟着一句“你不用回，我就想找个人说说”。',
    opts: [
      o2('打电话过去，陪他聊到天亮', { ensureNpc: EN.friend, at: { stress: 2, happiness: 2 }, npc: { '朋友': { intimacy: 8 } }, tag: '朋友最低落时你陪他聊过一夜' },
        W('他哭了一场，第二天说好多了，后来逢人就说你靠得住。', { npc: { '朋友': { intimacy: 11, favor: 2, anchor: { kind: 'comfort', text: '他撑不住的那个夜里，你陪他聊到天亮' } } } }),
        W('你也不知道该说什么，两个人沉默了很久，但他没挂电话。', { npc: { '朋友': { intimacy: 5 } }, at: { stress: 3 } }, 35)),
      o2('回几句安慰的话，让他早点睡', { ensureNpc: EN.friend, at: { stress: -1 }, npc: { '朋友': { intimacy: 2 } }, tag: '朋友低落时你只回了安慰的话' },
        W('他回了个“谢谢”，第二天照常上班。', { npc: { '朋友': { intimacy: 2 } } }),
        W('之后他很少再跟你说心里话。', { npc: { '朋友': { intimacy: -4 } }, at: { happiness: -2 } }, 45)),
      o2('第二天帮他约个心理咨询', { ensureNpc: EN.friend, money: { cash: -800 }, at: { charm: 2 }, npc: { '朋友': { intimacy: 5 } }, tag: '朋友低落时你帮他约过心理咨询' },
        W('他去了两次，说确实有用，把咨询费还给了你。', { npc: { '朋友': { intimacy: 8, favor: 2 } }, money: { cash: 800 } }),
        W('他没去，觉得你把他当病人，话说得有点冲。', { npc: { '朋友': { intimacy: -3 } }, at: { happiness: -1 } }, 45))
    ]
  });

  add({
    id: 'v32_npc_boss_side', type: 'random', layer: 'npc', npcId: '上司', stage: '中年',
    weight: 3, art: 'office', cond: A(26, 50, function (g) { return !!bossOf(g); }),
    title: '{{npc:boss}}要你站队',
    text: '上司把你叫到楼梯间，说上面要调整部门，他需要一个人替他在会上说话。他盯着你，说“你跟了我这么久，我心里有数”。',
    opts: [
      o2('表态支持他，会上替他说话', { kindness: { role: '上司', kind: 'support', text: '部门斗争时，你在会上公开支持了他', intimacy: 9, favor: 2 }, at: { stress: 3 }, tag: '上司要站队时你公开支持了他' },
        W('他赢了这一局，半年后把你提了一级。', { npc: { '上司': { intimacy: 10, favor: 2, anchor: { kind: 'support', text: '你在会上公开站出来支持过他' } } }, money: { cash: 6000 }, rep: { industry: 5 } }),
        W('他输了，新来的领导把你当成他那一派的人。', { npc: { '上司': { intimacy: 4 } }, rep: { industry: -5 }, at: { happiness: -4 } }, 40)),
      o2('说只听安排，不站队', { wrong: { role: '上司', kind: 'neutral', text: '他要你在会上站队，你选择了不表态', intimacy: -4, favor: -1 }, at: { stress: 2 }, tag: '上司要站队时你选择了中立' },
        W('他脸色难看，但也没为难你，之后重要的事不再叫你。', { npc: { '上司': { intimacy: -2 } } }),
        W('新领导上台后，他把你归到了“不可用”那一类。', { npc: { '上司': { favor: -2 } }, rep: { industry: -3 } }, 45)),
      o2('把这话透给另一边', { wrong: { role: '上司', kind: 'betray', text: '他要你站队，你把他私下的话透给了对手', intimacy: -12, favor: -3 }, at: { happiness: -2 }, tag: '上司要站队时你出卖了他' },
        W('另一边记了你一功，但没人再敢跟你交底。', { rep: { industry: -2 } }),
        W('事情败露，上司当场翻脸，你在部门里待不下去。', { npc: { '上司': { favor: -4 } }, rep: { industry: -8 }, at: { stress: 8, happiness: -6 } }, 40))
    ]
  });

  add({
    id: 'v32_npc_colleague_shift', type: 'random', layer: 'npc', npcId: '同事', stage: '青年',
    weight: 2, art: 'office', cond: A(22, 55, function (g) { return hasJob(g) && alive(g, '同事'); }),
    title: '{{npc:同事}}求你顶个班',
    text: '同事家里临时出了事，问你能不能替他值这个周末的班。他说就这一次，回头一定还你。你周末本来也没安排，只是连着上了六天。',
    opts: [
      o2('答应同事，替他值这个周末的班', { at: { stress: 4, health: -2 }, npc: { '同事': { intimacy: 0 } }, kindness: { role: '同事', kind: 'cover', text: '他家里出事时，你替他值了周末的班', intimacy: 7, favor: 1 }, tag: '同事有难时你替他顶过班' },
        W('他回来后请你吃了饭，之后你忙的时候他主动接过两次。', { npc: { '同事': { intimacy: 9, favor: 2, anchor: { kind: 'cover', text: '你替他顶过一个周末的班' } } } }),
        W('他家里的事一直没完，后来又找你替了两次。', { npc: { '同事': { intimacy: 3 } }, at: { stress: 6, health: -3 } }, 40)),
      o2('跟他换班，而不是白替', { at: { stress: 2, charm: 2 }, npc: { '同事': { intimacy: 4 } }, tag: '同事求顶班时你跟他换了班' },
        W('他爽快答应，后来真的把班还给了你。', { npc: { '同事': { intimacy: 6, favor: 1 } } }),
        W('他嘴上答应，真到还班那天又推了。', { npc: { '同事': { intimacy: -2 } }, at: { stress: 2 } }, 40)),
      o2('说自己实在撑不住，拒绝', { wrong: { role: '同事', kind: 'refuse', text: '他求你顶班时，你拒绝了他', intimacy: -6, favor: -1 }, tag: '同事求顶班时你拒绝了他' },
        W('他找了别人，回来还是跟你正常相处。', { npc: { '同事': { intimacy: 1 } } }),
        W('他在部门里说你不好说话，之后配合你的事总慢半拍。', { npc: { '同事': { favor: -3 } }, rep: { industry: -2 }, at: { happiness: -2 } }, 45))
    ]
  });

  add({
    id: 'v32_npc_subordinate_cover', type: 'random', layer: 'npc', npcId: '下属', stage: '中年',
    weight: 2, art: 'office', cond: A(26, 55, function (g) { return alive(g, '下属'); }),
    title: '{{npc:下属}}求你保他',
    text: '下属在茶水间堵住你，说上面要拿他开刀，求你替他说句话。他家里刚添了孩子，房贷还没还完。',
    opts: [
      o2('替他说这句话', { at: { stress: 3 }, kindness: { role: '下属', kind: 'protect', text: '上面要动他时，你替他保住了位置', intimacy: 9, favor: 2 }, tag: '下属要被开时你替他保过' },
        W('他留下了，之后做事更拼，逢人便说你是他跟过最好的领导。', { npc: { '下属': { intimacy: 11, favor: 2, anchor: { kind: 'protect', text: '他被裁之前，是你替他说了话' } } } }),
        W('你替他说话得罪了上面，人没保住，你自己也被记了一笔。', { npc: { '下属': { intimacy: 5 } }, rep: { industry: -3 }, at: { stress: 5 } }, 40)),
      o2('让他自己去找上面谈', { at: { stress: 1 }, wrong: { role: '下属', kind: 'neutral', text: '他被裁时，你没有替他说话', intimacy: -5, favor: -1 }, tag: '下属求助时你没有替他说话' },
        W('他自己谈了下来，虽然降了职，但留下了。', { npc: { '下属': { intimacy: 2 } } }),
        W('他被裁了，走之前把手上所有资料都清空了。', { npc: { '下属': { favor: -3 } }, at: { stress: 4, happiness: -3 } }, 45)),
      o2('帮他找下家，而不是硬保', { money: { cash: -500 }, at: { charm: 2, stress: 2 }, npc: { '下属': { intimacy: 6 } }, tag: '下属被裁时你帮他找过下家' },
        W('他很快去了另一家公司，后来还给你介绍了客户。', { npc: { '下属': { intimacy: 8, favor: 1 } }, money: { cash: 3000 } }),
        W('他嫌你多管闲事，觉得你只是想快点把他送走。', { npc: { '下属': { intimacy: -4 } }, at: { happiness: -1 } }, 45))
    ]
  });

  add({
    id: 'v32_npc_client_deal', type: 'random', layer: 'npc', npcId: '客户', stage: '中年',
    weight: 2, art: 'money', cond: A(25, 55, function (g) { return hasJob(g) && alive(g, '客户'); }),
    title: '{{npc:客户}}要你给个底价',
    text: '客户把你约到茶馆，说下个季度的量能翻一倍，但价格得再压两成。他还说，如果不行，就去找你同行。',
    opts: [
      o2('让利两成，先把量拿到', { money: { cash: 20000 }, at: { stress: 3, finance: 2 }, kindness: { role: '客户', kind: 'deal', text: '他压价时，你让了两成把单子接下来', intimacy: 6, favor: 1 }, tag: '客户压价时你让利接下了大单' },
        W('量真的翻了倍，利润薄但流水好看，他在年会上点名谢你。', { npc: { '客户': { intimacy: 9, favor: 2, anchor: { kind: 'deal', text: '他压价两成，你接下来了，后来量翻了倍' } } } }),
        W('价格压下去就再没涨回来，你后面两年都在补这个窟窿。', { npc: { '客户': { intimacy: 3 } }, money: { cash: -8000 }, at: { stress: 5 } }, 40)),
      o2('守住价格，给他更好的方案', { at: { knowledge: 3, charm: 2 }, npc: { '客户': { intimacy: 4 } }, tag: '客户压价时你守住价格换了方案' },
        W('他被方案打动，价格只让了半成，单子还是给了你。', { npc: { '客户': { intimacy: 7, favor: 1 } }, money: { cash: 15000 }, rep: { industry: 3 } }),
        W('他转身去找了同行，你丢了这一单。', { npc: { '客户': { intimacy: -5 } }, at: { happiness: -2 } }, 45)),
      o2('不接，让他去找别人', { wrong: { role: '客户', kind: 'refuse', text: '他压价时，你直接把单子推了', intimacy: -8, favor: -2 }, tag: '客户压价时你拒绝了这单' },
        W('他过了两个月又回来，价格按你的来。', { npc: { '客户': { intimacy: 3, favor: 1 } }, money: { cash: 12000 } }),
        W('他真的找了同行，之后两年没再联系你。', { npc: { '客户': { favor: -4 } }, rep: { industry: -2 }, at: { happiness: -3 } }, 45))
    ]
  });

  add({
    id: 'v32_npc_enemy_truce', type: 'random', layer: 'npc', npcId: '仇人', stage: '中年',
    weight: 2, art: 'emptyHome', cond: A(28, 60, function (g) { return alive(g, '仇人') || !!negNpc(g); }),
    title: '{{npc:仇人}}托人来说和',
    text: '当年跟你结怨的人托共同的朋友带话，说想请你吃顿饭，把过去的事翻篇。朋友转述时一直看你的脸色。',
    opts: [
      o2('去，把话说开', { ensureNpc: EN.enemy, at: { stress: 3, happiness: 2 }, npc: { '仇人': { intimacy: 6, favor: 2 } }, tag: '和结怨的人吃过一顿和解饭' },
        W('饭桌上他先举杯认了错，你们没有变成朋友，但至少不再互相使绊。', { npc: { '仇人': { intimacy: 8, favor: 3, anchor: { kind: 'truce', text: '你们在多年后吃过一顿和解饭' } } } }),
        W('他旧事重提，饭吃到一半又吵了起来。', { npc: { '仇人': { favor: -2 } }, at: { stress: 4, happiness: -3 } }, 40)),
      o2('不去，让朋友带句话', { at: { stress: -1, happiness: 1 }, npc: { '仇人': { intimacy: -2 } }, tag: '结怨的人求和时你没有赴约' },
        W('他收到话后没再纠缠，你们从此各走各的。', { npc: { '仇人': { favor: 1 } } }),
        W('他觉得你不给面子，之后在生意上又卡了你一次。', { npc: { '仇人': { favor: -3 } }, rep: { industry: -3 }, at: { happiness: -2 } }, 45)),
      o2('借这个机会把旧账算清', { ensureNpc: EN.enemy, at: { charm: 2, stress: 3 }, npc: { '仇人': { intimacy: 3, favor: 1 } }, tag: '和结怨的人把旧账算清了' },
        W('两边的账一笔一笔对完，最后各退一步，签了张字据。', { npc: { '仇人': { intimacy: 5, favor: 2 } }, money: { cash: 3000 } }),
        W('账越算越乱，最后不欢而散，旧怨又添了新的一笔。', { npc: { '仇人': { favor: -4 } }, at: { stress: 5 } }, 45))
    ]
  });

  add({
    id: 'v32_npc_parent_money', type: 'random', layer: 'npc', npcId: '母亲', stage: '中年',
    weight: 2, art: 'home', cond: A(30, 60, function (g) { return alive(g, '母亲'); }),
    title: '{{npc:母亲}}开口要钱',
    text: '母亲在电话里绕了半天，最后说家里要修房子，还差一些钱。她说不用太多，你方便就行，又补了一句“不方便就算了”。',
    opts: [
      o2('如数转过去', { money: { cash: -12000 }, at: { happiness: 2, stress: 2 }, kindness: { role: '母亲', kind: 'money', text: '家里修房子时，你如数拿了钱', amount: 12000, intimacy: 8, favor: 1 }, tag: '母亲开口要钱时你如数给了' },
        W('房子修好了，母亲拍了照片给你，说以后回来住着舒服。', { npc: { '母亲': { intimacy: 9, anchor: { kind: 'money', text: '家里修房子，你二话没说拿了钱' } } } }),
        W('钱给了，房子却修得潦草，母亲说被人坑了，你也只能认。', { npc: { '母亲': { intimacy: 4 } }, at: { happiness: -2 } }, 40)),
      o2('给一半，剩下的让她找兄弟姐妹凑', { money: { cash: -6000 }, at: { stress: 1, happiness: 1 }, npc: { '母亲': { intimacy: 3 }, 'sibling': { intimacy: -3 } }, tag: '母亲要钱时你只给了一半' },
        W('兄弟姐妹补上了缺口，母亲没再说什么。', { npc: { '母亲': { intimacy: 4 } } }),
        W('兄弟姐妹觉得你推责任，家里为此闹了一阵。', { npc: { 'sibling': { favor: -2 } }, at: { happiness: -2 } }, 45)),
      o2('说自己手头也紧，先不给', { wrong: { role: '母亲', kind: 'refuse', text: '母亲开口要钱，你说手头紧没有给', intimacy: -8, favor: -1 }, tag: '母亲开口要钱时你拒绝了她' },
        W('母亲说没事，后来你听说她找邻居借了钱。', { npc: { '母亲': { intimacy: -4 } }, at: { happiness: -3 } }),
        W('她很久没主动给你打电话，逢年过节也只是问一句吃了没。', { npc: { '母亲': { intimacy: -10, favor: -2 } }, at: { happiness: -5 } }, 50))
    ]
  });

  add({
    id: 'v32_npc_child_money', type: 'random', layer: 'npc', npcId: '子女', stage: '中年',
    weight: 2, art: 'money', cond: A(35, 60, function (g) { return !!firstChild(g); }),
    title: '{{npc:子女}}跟你要钱',
    text: '孩子发来消息，说想报一个很贵的培训班，或者换一台电脑。你问了几句，他/她回得越来越短，最后说“算了，我自己想办法”。',
    opts: [
      o2('给，但说清楚这是最后一次', { money: { cash: -8000 }, at: { stress: 2, happiness: 1 }, kindness: { role: '子女', kind: 'money', text: '孩子开口要钱，你给了并叮嘱这是最后一次', amount: 8000, intimacy: 7, favor: 1 }, tag: '孩子要钱时你给了并定了规矩' },
        W('孩子收下钱，真的去报了班，期末拿了证给你看。', { npc: { '子女': { intimacy: 8, anchor: { kind: 'money', text: '孩子第一次开口要钱，你给了' } } } }),
        W('钱花完了，孩子又说还差一点，你发现自己定的规矩不算数。', { npc: { '子女': { intimacy: 2 } }, at: { happiness: -2 } }, 40)),
      o2('先问清楚用途，再决定', { at: { charm: 2, stress: 2 }, npc: { '子女': { intimacy: 3 } }, tag: '孩子要钱时你先问清了用途' },
        W('问清楚后发现是被人忽悠，你帮孩子把这事拦了下来。', { npc: { '子女': { intimacy: 6, favor: 1 } } }),
        W('孩子觉得你不信任他/她，钱没要成，话也不说了。', { npc: { '子女': { intimacy: -4 } }, at: { happiness: -2 } }, 45)),
      o2('不给，让他/她自己挣', { wrong: { role: '子女', kind: 'refuse', text: '孩子开口要钱，你让他/她自己想办法', intimacy: -6, favor: -1 }, tag: '孩子要钱时你拒绝了' },
        W('孩子真的去打了零工，后来跟你说那阵子挺难的。', { npc: { '子女': { intimacy: 1 } } }),
        W('孩子记了很久，成年后很少再跟你开口。', { npc: { '子女': { intimacy: -8, favor: -2 } }, at: { happiness: -3 } }, 50))
    ]
  });

  add({
    id: 'v32_npc_spouse_side', type: 'random', layer: 'npc', npcId: '配偶', stage: '中年',
    weight: 2, art: 'home', cond: A(28, 55, married),
    title: '{{npc:配偶}}要你表个态',
    text: '伴侣和你的家人闹了别扭，晚饭桌上谁也不说话。伴侣进房间前丢下一句：“你到底站哪边，今天说清楚。”',
    opts: [
      o2('站伴侣这边，先安抚', { npc: { '配偶': { intimacy: 8, favor: 1 } }, at: { stress: 3, happiness: 2 }, tag: '伴侣和家人闹矛盾时你站在伴侣这边' },
        W('伴侣的情绪下来了，第二天主动去跟你家人和好。', { npc: { '配偶': { intimacy: 10, anchor: { kind: 'support', text: '你和家人闹别扭时，他/她先站在了你这边' } } } }),
        W('你家人觉得你娶/嫁了人就忘了本，冷战了一阵。', { npc: { '母亲': { intimacy: -4 } }, at: { happiness: -2 } }, 40)),
      o2('两头劝，谁也不得罪', { at: { charm: 3, stress: 4 }, npc: { '配偶': { intimacy: -2 } }, tag: '伴侣和家人闹矛盾时你两头劝' },
        W('劝了几天，两边都消了气，只是你自己累得够呛。', { npc: { '配偶': { intimacy: 3 }, '母亲': { intimacy: 2 } } }),
        W('伴侣觉得你含糊其辞，问题一直没解决。', { npc: { '配偶': { intimacy: -5 } }, at: { happiness: -3 } }, 45)),
      o2('说伴侣小题大做', { wrong: { role: '配偶', kind: 'offend', text: '伴侣和家人闹矛盾时，你说伴侣小题大做', intimacy: -10, favor: -2 }, tag: '伴侣和家人闹矛盾时你说了重话' },
        W('伴侣没再吵，第二天开始自己做饭、自己出门。', { npc: { '配偶': { intimacy: -6 } }, at: { happiness: -4 } }),
        W('这件事变成了一根刺，很多年后还会被翻出来。', { npc: { '配偶': { favor: -3, anchor: { kind: 'conflict', text: '你说她/他小题大做，这句话被记了很多年' } } }, at: { happiness: -6 } }, 50))
    ]
  });

  /* =========================================================
     三、关系生命周期（arc，type causal / layer chain）
     ========================================================= */

  /* ---- 发小：6 岁认识 → 16 岁闯祸疏远 → 28 岁重聚 → 40 岁借钱或入伙 ---- */
  add({
    id: 'v32_arc_faxiao_6', type: 'causal', layer: 'chain', tier: 'echo', family: 'arc_faxiao',
    stage: '童年', weight: 3, art: 'home', cond: A(6, 9),
    title: '巷子口新搬来的孩子',
    text: '巷子口搬来一户人家，那家孩子蹲在门槛上啃辣条。你从他面前走过，他抬头看了你一眼，又低下头去。',
    opts: [
      o2('把辣条分他一半', { ensureNpc: EN.faxiao, npc: { '发小': { intimacy: 8 } }, at: { happiness: 2 }, tag: '六岁那年分给发小半包辣条' },
        W('他接过去，说以后一起玩。你们从那天起天天混在一起。', { npc: { '发小': { intimacy: 10, anchor: { kind: 'meet', text: '你们六岁那年在巷子口分过一包辣条' } } } }),
        W('他辣得直咳嗽，还是把剩下半包还给了你。', { npc: { '发小': { intimacy: 5 } }, at: { happiness: 1 } }, 40)),
      o2('问他叫什么，家住哪', { ensureNpc: EN.faxiao, npc: { '发小': { intimacy: 4 } }, at: { charm: 2 }, tag: '六岁那年主动认识了发小' },
        W('他报了个很土的小名，你笑了，他也笑，两个人就这么认识了。', { npc: { '发小': { intimacy: 7, anchor: { kind: 'meet', text: '你问了他的名字，他报了个很土的小名' } } } }),
        W('他怯生生地没答话，跑回了家。', { npc: { '发小': { intimacy: 1 } }, at: { happiness: -1 } }, 40)),
      o2('不理他，自己回家', { ensureNpc: EN.faxiao, npc: { '发小': { intimacy: -2 } }, tag: '六岁那年没搭理发小' },
        W('第二天他又蹲在同一个门槛上，看见你就喊了一声。', { npc: { '发小': { intimacy: 3 } } }),
        W('他有好一阵子没跟你说话，后来才慢慢熟起来。', { npc: { '发小': { intimacy: -3 } }, at: { happiness: -1 } }, 40))
    ]
  });

  add({
    id: 'v32_arc_faxiao_16', type: 'causal', layer: 'chain', tier: 'echo', family: 'arc_faxiao',
    stage: '少年', weight: 3, art: 'home', cond: A(15, 17, function (g) { return alive(g, '发小'); }),
    title: '和{{npc:发小}}闯的祸',
    text: '你和发小翻墙进了废弃的厂院，被保安抓住。登记姓名时，他抢着说都是他一个人的主意。回家的路上，两个人都没说话。',
    opts: [
      o2('把责任一起认下来', { at: { stress: 3 }, npc: { '发小': { intimacy: 7 } }, tag: '十六岁和发小一起认了错' },
        W('家长罚你们一起扫院子，扫到天黑，倒扫出了感情。', { npc: { '发小': { intimacy: 9, anchor: { kind: 'trouble', text: '你们一起翻墙闯祸，又一起认了罚' } } } }),
        W('你认了，他家里却把你供了出去，两家人闹得很僵。', { npc: { '发小': { intimacy: -2 } }, at: { happiness: -3 } }, 40)),
      o2('让他一个人担，你先走', { npc: { '发小': { intimacy: -6, favor: -1 } }, at: { happiness: -2 }, tag: '十六岁闯祸后你让发小一个人担' },
        W('他担了下来，之后很久没主动找你。', { npc: { '发小': { intimacy: -4 } } }),
        W('他家里把这事传开了，你在巷子里抬不起头。', { npc: { '发小': { favor: -2 } }, rep: { school: -3 }, at: { happiness: -4 } }, 45)),
      o2('事后请他吃一顿，把话揭过去', { money: { cash: -100 }, at: { charm: 2, stress: 1 }, npc: { '发小': { intimacy: 3 } }, tag: '十六岁闯祸后你请发小吃了顿' },
        W('两瓶汽水下去，他拍了拍你肩膀，说以后别再干这种蠢事。', { npc: { '发小': { intimacy: 5 } } }),
        W('他吃着吃着又提起那天，语气不太好。', { npc: { '发小': { intimacy: -1 } }, at: { stress: 2 } }, 40))
    ]
  });

  add({
    id: 'v32_arc_faxiao_28', type: 'causal', layer: 'chain', tier: 'echo', family: 'arc_faxiao',
    stage: '青年', weight: 3, art: 'home', cond: A(27, 29, function (g) { return alive(g, '发小'); }),
    title: '多年后和{{npc:发小}}重聚',
    text: '老同学组局，你和发小被安排在同一桌。十几年没怎么联系，他胖了，头发也少了。坐下后两个人都不知道该从哪句开始。',
    opts: [
      o2('先敬一杯，说小时候的事', { at: { happiness: 4, stress: -2 }, npc: { '发小': { intimacy: 7 } }, tag: '二十八岁和发小重新聚到了一起' },
        W('你们从翻墙说到河滩，越说越起劲，散场时互相留了新的号码。', { npc: { '发小': { intimacy: 9, anchor: { kind: 'reunion', text: '十几年后你们在一张桌上把小时候的事说了一夜' } } } }),
        W('他客气了几句就去别的桌敬酒，你一个人坐了很久。', { npc: { '发小': { intimacy: 2 } }, at: { happiness: -1 } }, 40)),
      o2('聊现在，不谈过去', { at: { charm: 2, finance: 1 }, npc: { '发小': { intimacy: 4 } }, tag: '二十八岁重聚时你和发小只聊了现在' },
        W('你们发现彼此都在同一行，后来还互相介绍过生意。', { npc: { '发小': { intimacy: 6, favor: 1 } }, rep: { industry: 2 } }),
        W('聊着聊着发现没什么可说的，饭局提前散了。', { npc: { '发小': { intimacy: -2 } }, at: { happiness: -2 } }, 40)),
      o2('称有事，露个面就走', { npc: { '发小': { intimacy: -3 } }, at: { stress: -1 }, tag: '二十八岁重聚时你提前走了' },
        W('他送到门口，说改天单独约。', { npc: { '发小': { intimacy: 1 } } }),
        W('改天一直没来，你们又回到了十几年不联系的状态。', { npc: { '发小': { intimacy: -5 } }, at: { happiness: -2 } }, 45))
    ]
  });

  add({
    id: 'v32_arc_faxiao_40', type: 'causal', layer: 'chain', tier: 'echo', family: 'arc_faxiao',
    stage: '中年', weight: 3, art: 'money', cond: A(38, 42, function (g) { return alive(g, '发小'); }),
    title: '{{npc:发小}}要拉你入伙',
    text: '发小开了个小厂，说缺一个信得过的人，想拉你入伙或者借一笔钱周转。他把账本摊在你面前，数字写得密密麻麻。',
    opts: [
      o3('拿钱入伙，跟他赌一把', { money: { cash: -30000 }, kindness: { role: '发小', kind: 'invest', text: '他开厂时，你拿钱入了伙', amount: 30000, intimacy: 9, favor: 2 }, tag: '四十岁那年和发小合伙做生意' },
        W('厂子第二年就回了本，你们一人一半，逢人便说是从小一起长大的交情。', { npc: { '发小': { intimacy: 10, favor: 2, anchor: { kind: 'partner', text: '他开厂那年，你拿钱入了伙' } } }, money: { cash: 20000 } }),
        W('厂子撑了一年就关了，本钱没回来，他见你就低头。', { npc: { '发小': { intimacy: 2, favor: -1 } }, money: { cash: -30000 }, at: { happiness: -5 } }, 45),
        W('账目越看越不对，你怀疑他做了手脚，两个人翻了脸。', { npc: { '发小': { favor: -4 } }, rep: { industry: -2 }, at: { stress: 6, happiness: -5 } }, 25)),
      o2('不入伙，借他一笔小钱', { money: { cash: -5000 }, kindness: { role: '发小', kind: 'lend', text: '他开厂缺钱时，你借了他一笔', amount: 5000, intimacy: 5, favor: 1 }, tag: '四十岁那年发小入伙你没答应，只借了钱' },
        W('他收了钱，说等厂子稳了再还。后来真的还了。', { money: { cash: 5000 }, npc: { '发小': { intimacy: 6 } } }),
        W('厂子没起来，钱也没了下文，他不再提这件事。', { npc: { '发小': { intimacy: -3, favor: -1 } }, at: { happiness: -3 } }, 45)),
      o2('不掺和，劝他稳一点', { wrong: { role: '发小', kind: 'refuse', text: '他拉你入伙时，你拒绝了并劝他收手', intimacy: -5, favor: -1 }, at: { happiness: 1, stress: -1 }, tag: '四十岁那年你拒绝了发小的入伙邀请' },
        W('他听了劝，厂子缩小了规模，虽然没赚大钱，但活了下来。', { npc: { '发小': { intimacy: 3, favor: 1 } } }),
        W('他觉得你看不起他，之后逢年过节也不联系了。', { npc: { '发小': { intimacy: -6, favor: -2 } }, at: { happiness: -3 } }, 50))
    ]
  });

  /* ---- 同学：7 岁同桌 → 13 岁竞争 → 18 岁散场 → 30 岁同学会 ---- */
  add({
    id: 'v32_arc_tongxue_7', type: 'causal', layer: 'chain', tier: 'echo', family: 'arc_tongxue',
    stage: '童年', ageMin: 7, weight: 3, art: 'exam', cond: A(7, 9),
    title: '老师安排的新同桌',
    text: '新学期排座位，老师把你和一个新转来的同学安排在一起。他把书包往桌上一放，橡皮滚到了你脚边。',
    opts: [
      o2('把橡皮捡起来还给他', { ensureNpc: EN.tongxue, npc: { '同学': { intimacy: 6 } }, at: { charm: 2 }, tag: '七岁那年和同桌第一次说话' },
        W('他说了声谢谢，后来总把橡皮借给你。', { npc: { '同学': { intimacy: 8, anchor: { kind: 'meet', text: '新学期你替他把滚到脚边的橡皮捡了起来' } } } }),
        W('他接过去没说话，一整天都没跟你搭腔。', { npc: { '同学': { intimacy: 2 } }, at: { happiness: -1 } }, 40)),
      o2('主动问他叫什么', { ensureNpc: EN.tongxue, npc: { '同学': { intimacy: 4 } }, at: { happiness: 1 }, tag: '七岁那年主动和新同桌搭话' },
        W('他有点害羞，写在纸上给你看，字歪歪扭扭。', { npc: { '同学': { intimacy: 6, anchor: { kind: 'meet', text: '他把名字写在纸上，字歪歪扭扭' } } } }),
        W('他小声说了名字，你听成了另一个，叫错了整整一学期。', { npc: { '同学': { intimacy: 3 } }, at: { happiness: 1 } }, 40)),
      o2('在桌子中间画条线', { ensureNpc: EN.tongxue, npc: { '同学': { intimacy: -2 } }, tag: '七岁那年和新同桌画了三八线' },
        W('他愣了一下，也在自己那边画了一条，两个人守了一学期。', { npc: { '同学': { intimacy: 1 } } }),
        W('他的胳膊肘总越线，你推了他一下，被老师看见了。', { npc: { '同学': { intimacy: -4 } }, rep: { school: -1 }, at: { happiness: -1 } }, 40))
    ]
  });

  add({
    id: 'v32_arc_tongxue_13', type: 'causal', layer: 'chain', tier: 'echo', family: 'arc_tongxue',
    stage: '少年', weight: 3, art: 'exam', cond: A(13, 15, function (g) { return alive(g, '同学'); }),
    title: '{{npc:同学}}超过了你',
    text: '期中排名出来，同学的名字排在前面，你的从第一页滑到了第二页。他拿着卷子过来，想跟你说什么，又咽了回去。',
    opts: [
      o2('向他请教，把差距补回来', { at: { knowledge: 4, stress: 2 }, npc: { '同学': { intimacy: 6 } }, tag: '十三岁向超过自己的同学请教过' },
        W('他把错题本借给你，你把分数追了回来，两个人成了搭子。', { npc: { '同学': { intimacy: 8, anchor: { kind: 'study', text: '他超过你那年，你低头向他请教过' } } } }),
        W('他讲得含糊，你听得更糊涂，那阵子很烦躁。', { npc: { '同学': { intimacy: 2 } }, at: { stress: 3 } }, 40)),
      o2('暗暗较劲，谁也不理', { at: { knowledge: 3, happiness: -2 }, npc: { '同学': { intimacy: -4 } }, tag: '十三岁和同学暗暗较劲' },
        W('下一次你反超了他，他主动来问你题。', { npc: { '同学': { intimacy: 2 } }, rep: { school: 2 } }),
        W('你们一学期没说话，座位调开后彻底断了联系。', { npc: { '同学': { intimacy: -6 } }, at: { happiness: -2 } }, 45)),
      o2('说些风凉话，心里才舒服', { npc: { '同学': { intimacy: -7, favor: -1 } }, at: { happiness: 1, stress: 1 }, tag: '十三岁对超过自己的同学说过风凉话' },
        W('他没接话，之后把错题本收了起来。', { npc: { '同学': { intimacy: -3 } } }),
        W('话传到老师耳朵里，你被叫去谈了一次。', { npc: { '同学': { favor: -2 } }, rep: { school: -3 }, at: { happiness: -2 } }, 45))
    ]
  });

  add({
    id: 'v32_arc_tongxue_18', type: 'causal', layer: 'chain', tier: 'echo', family: 'arc_tongxue',
    stage: '少年', weight: 3, art: 'exam', cond: A(17, 19, function (g) { return alive(g, '同学'); }),
    title: '毕业散场',
    text: '毕业典礼结束，教室里的人陆续走空。同学在他那张桌子上留了一行字，又把校服叠好放在椅子上。你站在门口，手里是没送出去的纪念册。',
    opts: [
      o2('把纪念册递过去，让他写一页', { npc: { '同学': { intimacy: 6 } }, at: { happiness: 3, stress: -1 }, tag: '毕业那天让同学写了纪念册' },
        W('他写了很多，最后一句是“以后别断了联系”。', { npc: { '同学': { intimacy: 8, anchor: { kind: 'farewell', text: '毕业那天他在你的纪念册上写了满满一页' } } } }),
        W('他只写了“前程似锦”四个字，字很好看，也很客气。', { npc: { '同学': { intimacy: 2 } }, at: { happiness: -1 } }, 40)),
      o2('约他吃最后一顿饭', { money: { cash: -200 }, at: { happiness: 3 }, npc: { '同学': { intimacy: 5 } }, tag: '毕业那天和同学吃了最后一顿饭' },
        W('两个人吃到店里打烊，说了很多以后要做的事。', { npc: { '同学': { intimacy: 7, anchor: { kind: 'farewell', text: '毕业那晚你们在店里坐到打烊' } } } }),
        W('他有事先走了，你一个人把剩下的菜吃完。', { npc: { '同学': { intimacy: 1 } }, at: { happiness: -2 } }, 40)),
      o2('什么也没说，转身走了', { npc: { '同学': { intimacy: -3 } }, at: { happiness: -2 }, tag: '毕业那天你什么也没说就走了' },
        W('他在校门口喊了你的名字，你回头，他挥了挥手。', { npc: { '同学': { intimacy: 3 } } }),
        W('你们从此很多年没再见过。', { npc: { '同学': { intimacy: -5 } }, at: { happiness: -2 } }, 45))
    ]
  });

  add({
    id: 'v32_arc_tongxue_30', type: 'causal', layer: 'chain', tier: 'echo', family: 'arc_tongxue',
    stage: '青年', weight: 3, art: 'home', cond: A(29, 31, function (g) { return alive(g, '同学'); }),
    title: '毕业十二年的同学会',
    text: '同学群里张罗同学会，地点定在一家不便宜的饭店。同学私信你，说“来吧，大家都想见见你”。你翻了翻当年的毕业照。',
    opts: [
      o2('去，坐到他旁边', { money: { cash: -500 }, at: { happiness: 4, stress: 1 }, npc: { '同学': { intimacy: 7 } }, tag: '三十岁参加了同学会' },
        W('你们把当年的事一件件翻出来，散场时约好以后每年见一次。', { npc: { '同学': { intimacy: 9, anchor: { kind: 'reunion', text: '十二年后的同学会上，你们又坐回了一张桌' } } } }),
        W('他混得不错，整晚都在跟别人敬酒，只跟你说了两句。', { npc: { '同学': { intimacy: 2 } }, at: { happiness: -1 } }, 40)),
      o2('只随份子，人不到', { money: { cash: -300 }, at: { happiness: -1 }, npc: { '同学': { intimacy: 1 } }, tag: '同学会你只随了份子' },
        W('群里发了合照，他在照片里笑得很开心，你找了半天才找到自己。', { npc: { '同学': { intimacy: 2 } } }),
        W('之后群里再组织活动，也没人特意叫你了。', { npc: { '同学': { intimacy: -4 } }, at: { happiness: -2 } }, 40)),
      o2('推说忙，不去', { npc: { '同学': { intimacy: -4 } }, at: { stress: -1, happiness: -1 }, tag: '三十岁那年你没去同学会' },
        W('他打电话来问了一句，说下次一定。', { npc: { '同学': { intimacy: 1 } } }),
        W('下次一直没来，你们的联系停在了那个群消息里。', { npc: { '同学': { intimacy: -6 } }, at: { happiness: -2 } }, 45))
    ]
  });

  /* ---- 兄弟 / 妹妹：8 / 14 / 22 / 35 岁 ---- */
  add({
    id: 'v32_arc_sib_8', type: 'causal', layer: 'chain', tier: 'echo', family: 'arc_sibling',
    stage: '童年', weight: 3, art: 'home', cond: A(8, 10, function (g) { return !!sib(g); }),
    title: '{{npc:sibling}}发烧的夜里',
    text: '半夜里{{npc:sibling}}发起烧来，母亲让你去村口叫医生。外面下着雨，你披了件大人的外套就往外跑。',
    opts: [
      o2('冒雨去叫医生', { at: { health: -2, stress: 3, happiness: 1 }, npc: { 'sibling': { intimacy: 8 } }, tag: '八岁那年冒雨替兄弟姐妹叫过医生' },
        W('医生来了，烧退下去时天快亮了，{{npc:sibling}}拉着你的手睡着了。', { npc: { 'sibling': { intimacy: 10, anchor: { kind: 'care', text: '他/她发烧那晚，你冒雨去叫了医生' } } } }),
        W('你摔了一跤，医生还是来了，你自己腿上留了块疤。', { npc: { 'sibling': { intimacy: 5 } }, at: { health: -3 } }, 40)),
      o2('叫醒母亲，让她去', { at: { stress: 1 }, npc: { 'sibling': { intimacy: 2 }, '母亲': { intimacy: 1 } }, tag: '八岁那年你叫醒母亲照顾兄弟姐妹' },
        W('母亲披衣出门，你留在屋里守着他/她。', { npc: { 'sibling': { intimacy: 4 } } }),
        W('母亲回来看你睡着在地上，说了你一句。', { npc: { 'sibling': { intimacy: 1 } }, at: { happiness: -1 } }, 40)),
      o2('装作没醒，继续睡', { npc: { 'sibling': { intimacy: -4 } }, at: { happiness: -2 }, tag: '八岁那年兄弟姐妹发烧你装睡' },
        W('第二天他/她退烧了，母亲说夜里叫了邻居帮忙。', { npc: { 'sibling': { intimacy: -2 } } }),
        W('他/她后来知道你没起来，提了很多年。', { npc: { 'sibling': { intimacy: -7, favor: -1 } }, at: { happiness: -3 } }, 45))
    ]
  });

  add({
    id: 'v32_arc_sib_14', type: 'causal', layer: 'chain', tier: 'echo', family: 'arc_sibling',
    stage: '少年', weight: 3, art: 'home', cond: A(14, 16, function (g) { return !!sib(g); }),
    title: '和{{npc:sibling}}的秘密',
    text: '你发现{{npc:sibling}}在偷偷写日记，本子压在枕头下面。他/她发现你在看，一把抢过去，脸涨得通红。',
    opts: [
      o2('说不会告诉任何人', { npc: { 'sibling': { intimacy: 6, favor: 1 } }, at: { stress: 1 }, tag: '十四岁替兄弟姐妹守住过秘密' },
        W('他/她把本子塞回枕头下，第二天主动给你留了半块糖。', { npc: { 'sibling': { intimacy: 8, anchor: { kind: 'secret', text: '你发现他/她的日记，答应不告诉任何人' } } } }),
        W('他/她不信你，之后把本子换了个地方藏。', { npc: { 'sibling': { intimacy: 2 } }, at: { happiness: -1 } }, 40)),
      o2('笑他/她两句', { npc: { 'sibling': { intimacy: -5 } }, at: { happiness: 1, stress: 1 }, tag: '十四岁拿兄弟姐妹的日记开过玩笑' },
        W('他/她气得把本子撕了两页，晚上又自己粘回去。', { npc: { 'sibling': { intimacy: -3 } } }),
        W('他/她一个学期没跟你说心里话。', { npc: { 'sibling': { intimacy: -8 } }, at: { happiness: -2 } }, 45)),
      o2('把这事告诉母亲', { npc: { 'sibling': { intimacy: -8, favor: -2 }, '母亲': { intimacy: 1 } }, rep: { home: 1 }, tag: '十四岁把兄弟姐妹的秘密告诉了母亲' },
        W('母亲找他/她谈了一次，他/她知道是你说的。', { npc: { 'sibling': { intimacy: -6 } } }),
        W('本子被母亲收走，他/她恨了你很久。', { npc: { 'sibling': { favor: -3 } }, at: { happiness: -4 } }, 45))
    ]
  });

  add({
    id: 'v32_arc_sib_22', type: 'causal', layer: 'chain', tier: 'echo', family: 'arc_sibling',
    stage: '青年', weight: 3, art: 'home', cond: A(22, 24, function (g) { return !!sib(g); }),
    title: '{{npc:sibling}}要去外地',
    text: '{{npc:sibling}}买了去外地的车票，说那边有个机会，想出去闯两年。行李不多，一个箱子就装下了。母亲在门口抹眼泪。',
    opts: [
      o2('送他/她去车站，塞点钱', { money: { cash: -2000 }, at: { happiness: 2, stress: 1 }, npc: { 'sibling': { intimacy: 7 }, '母亲': { intimacy: 2 } }, tag: '二十二岁送兄弟姐妹去外地' },
        W('车开前他/她抱了你一下，说混好了就接你过去。', { npc: { 'sibling': { intimacy: 9, anchor: { kind: 'farewell', text: '他/她去外地那天，你送到车站还塞了钱' } } } }),
        W('他/她嫌你给得少，上车后没再回头。', { npc: { 'sibling': { intimacy: 2 } }, at: { happiness: -2 } }, 40)),
      o2('劝他/她留下，家里需要人', { at: { charm: 2, stress: 2 }, npc: { 'sibling': { intimacy: -3 } }, tag: '二十二岁劝兄弟姐妹留在家乡' },
        W('他/她想了几天，还是走了，但走前跟你说了实话。', { npc: { 'sibling': { intimacy: 3 } } }),
        W('他/她觉得你自私，之后几年很少往家里打电话。', { npc: { 'sibling': { intimacy: -7 } }, at: { happiness: -2 } }, 45)),
      o2('帮他/她联系那边的熟人', { at: { charm: 2, stress: 1 }, npc: { 'sibling': { intimacy: 5 } }, tag: '二十二岁帮兄弟姐妹联系过外地的熟人' },
        W('熟人接站、找房，他/她落地就安顿下来，电话里一直谢你。', { npc: { 'sibling': { intimacy: 8, favor: 1, anchor: { kind: 'help', text: '他/她第一次去外地，是你托人接的站' } } } }),
        W('熟人没帮上忙，他/她在车站坐了一夜。', { npc: { 'sibling': { intimacy: -2 } }, at: { happiness: -2 } }, 40))
    ]
  });

  add({
    id: 'v32_arc_sib_35', type: 'causal', layer: 'chain', tier: 'echo', family: 'arc_sibling',
    stage: '中年', weight: 3, art: 'money', cond: A(35, 37, function (g) { return !!sib(g); }),
    title: '{{npc:sibling}}回来分家',
    text: '老家的房子要处理，{{npc:sibling}}从外地回来，带着一份自己拟的分配方案。方案里你占的那份，比你想的少。',
    opts: [
      o2('坐下来一条条谈', { at: { stress: 3, charm: 3 }, npc: { 'sibling': { intimacy: 4 } }, tag: '三十五岁和兄弟姐妹谈过分家' },
        W('谈到半夜，最后按人头平分，他/她签了字。', { npc: { 'sibling': { intimacy: 7, anchor: { kind: 'talk', text: '分家那晚你们一条条谈到半夜' } } } }),
        W('谈崩了，他/她把方案拍在桌上，第二天就走了。', { npc: { 'sibling': { favor: -2 } }, at: { stress: 5, happiness: -3 } }, 45)),
      o2('让一步，少拿一些', { money: { cash: -20000 }, npc: { 'sibling': { intimacy: 6, favor: 1 } }, at: { happiness: -2 }, tag: '三十五岁分家时你让了一步' },
        W('他/她没想到你这么痛快，后来逢人便说你厚道。', { npc: { 'sibling': { intimacy: 9, favor: 2 } } }),
        W('你让了，他/她却觉得你心虚，又加了一条。', { npc: { 'sibling': { intimacy: -3 } }, at: { happiness: -3 } }, 45)),
      o2('按法律来，谁也别占谁便宜', { money: { cash: 10000 }, at: { stress: 3 }, npc: { 'sibling': { intimacy: -4 } }, tag: '三十五岁分家时你按法律办' },
        W('律师把账算清，他/她虽然不高兴，但也说不出什么。', { npc: { 'sibling': { intimacy: 1, favor: 1 } } }),
        W('他/她觉得你不念亲情，之后两家来往少了。', { npc: { 'sibling': { favor: -2 } }, at: { happiness: -3 } }, 45))
    ]
  });

  /* ---- 上司：入职后 24 / 30 / 38 / 48 岁 ---- */
  add({
    id: 'v32_arc_boss_24', type: 'causal', layer: 'chain', tier: 'echo', family: 'arc_boss',
    stage: '青年', weight: 3, art: 'office', cond: A(23, 26, function (g) { return hasJob(g); }),
    title: '入职第一天见{{npc:boss}}',
    text: '入职第一天，人事把你领到工位就走了。你正对着电脑发呆，{{npc:boss}}走过来，把你的工牌摆正，说“以后跟着我干”。',
    opts: [
      o2('站起来，认真应下', { ensureNpc: EN.boss, npc: { '上司': { intimacy: 6 } }, at: { stress: 1, charm: 2 }, tag: '入职第一天就很得上司赏识' },
        W('他点了点头，下午就把你拉进了核心项目群。', { npc: { '上司': { intimacy: 8, anchor: { kind: 'meet', text: '入职第一天，他把你的工牌摆正说以后跟着他干' } } } }),
        W('他只是例行公事，说完就走了，你在工位上坐了一下午。', { npc: { '上司': { intimacy: 2 } }, at: { happiness: -1 } }, 40)),
      o2('先问清楚工作内容', { ensureNpc: EN.boss, at: { knowledge: 2, stress: 1 }, npc: { '上司': { intimacy: 3 } }, tag: '入职第一天先问清了工作内容' },
        W('他愣了一下，说你倒是实在，然后拿纸给你画了张流程。', { npc: { '上司': { intimacy: 6, anchor: { kind: 'meet', text: '入职第一天你就敢问他工作到底做什么' } } } }),
        W('他皱了皱眉，说“先把人认全再说”。', { npc: { '上司': { intimacy: -1 } }, at: { stress: 2 } }, 40)),
      o2('低头继续弄电脑', { ensureNpc: EN.boss, npc: { '上司': { intimacy: -2 } }, at: { stress: 1 }, tag: '入职第一天没接住上司的话' },
        W('他没再说什么，后来有事先找别人。', { npc: { '上司': { intimacy: -1 } } }),
        W('第一周你几乎被晾在一边，什么活都没分到。', { npc: { '上司': { intimacy: -4 } }, at: { happiness: -2 } }, 45))
    ]
  });

  add({
    id: 'v32_arc_boss_30', type: 'causal', layer: 'chain', tier: 'echo', family: 'arc_boss',
    stage: '青年', weight: 3, art: 'office', cond: A(29, 33, function (g) { return hasJob(g) && !!bossOf(g); }),
    title: '{{npc:boss}}让你背锅',
    text: '项目出了问题，上面要追责。上司在会上看了你一眼，说这个模块是你负责的。你记得方案是他改过的。',
    opts: [
      o2('在会上认下，私下再找他谈', { at: { stress: 5, charm: 2 }, npc: { '上司': { intimacy: 5 } }, tag: '三十岁替上司背过一次锅' },
        W('他被你这一手弄得不好意思，散会后把你叫到楼梯间，说记你一功。', { npc: { '上司': { intimacy: 9, favor: 1, anchor: { kind: 'cover', text: '你在会上替他背了锅，散会后他说记你一功' } } } }),
        W('他顺水推舟把责任全推给你，年底考核你垫了底。', { npc: { '上司': { intimacy: -4, favor: -1 } }, at: { happiness: -5, stress: 6 } }, 45)),
      o2('当场把聊天记录投出来', { at: { stress: 6, happiness: 2 }, wrong: { role: '上司', kind: 'offend', text: '他让你背锅时，你当众把记录投了出来', intimacy: -12, favor: -2 }, tag: '三十岁当众揭穿上司甩锅' },
        W('会议室里没人说话，上面决定重查，他再没敢动你。', { rep: { industry: 3 }, npc: { '上司': { favor: -3 } } }),
        W('你赢了这一场，但之后两年没有部门愿意接你。', { rep: { industry: -6 }, at: { happiness: -4 } }, 50)),
      o2('会后单独找他，给他留面子', { at: { charm: 3, stress: 2 }, npc: { '上司': { intimacy: 4 } }, tag: '三十岁私下找甩锅的上司谈过' },
        W('他承认自己改过方案，答应在年终给你补回来。', { npc: { '上司': { intimacy: 6, favor: 1 } }, money: { cash: 3000 } }),
        W('他嘴上答应，年终什么也没给，你也没再提。', { npc: { '上司': { intimacy: -2 } }, at: { happiness: -3 } }, 45))
    ]
  });

  add({
    id: 'v32_arc_boss_38', type: 'causal', layer: 'chain', tier: 'echo', family: 'arc_boss',
    stage: '中年', weight: 3, art: 'office', cond: A(37, 40, function (g) { return hasJob(g) && !!bossOf(g); }),
    title: '{{npc:boss}}要退了',
    text: '上司快到点了，把你叫到办公室，说位置空出来之前，会先问问你的意思。他桌上的东西已经收了一半。',
    opts: [
      o2('明说自己想接这个位置', { at: { charm: 2, stress: 2 }, npc: { '上司': { intimacy: 5, favor: 1 } }, tag: '三十八岁向上司明说要接他的位置' },
        W('他拍了拍你的肩，说会替你说话，之后真的在会上提了你的名字。', { npc: { '上司': { intimacy: 8, favor: 2, anchor: { kind: 'promote', text: '他退之前，在会上提了你的名字' } } }, money: { cash: 8000 } }),
        W('他含糊过去，最后把位置给了空降的人。', { npc: { '上司': { intimacy: -2 } }, at: { happiness: -3 } }, 45)),
      o2('说听组织安排', { at: { stress: -1 }, npc: { '上司': { intimacy: 2 } }, tag: '三十八岁对上司的接班暗示没有表态' },
        W('他看了你一会儿，说“你还是太稳”。', { npc: { '上司': { intimacy: 1 } } }),
        W('位置给了别人，你后来才知道他当时是在等你的话。', { npc: { '上司': { intimacy: -3 } }, at: { happiness: -3 } }, 45)),
      o2('劝他晚两年再退', { at: { charm: 3, stress: 1 }, npc: { '上司': { intimacy: 6 } }, tag: '三十八岁劝上司晚点退' },
        W('他真又干了两年，把你带到了更高的位置。', { npc: { '上司': { intimacy: 9, favor: 2, anchor: { kind: 'promote', text: '他本来要退，是你劝他再带了两年' } } }, rep: { industry: 4 } }),
        W('他退了，你的劝说反倒让上面觉得你想拉帮结派。', { rep: { industry: -3 }, npc: { '上司': { intimacy: 2 } }, at: { stress: 3 } }, 45))
    ]
  });

  add({
    id: 'v32_arc_boss_48', type: 'causal', layer: 'chain', tier: 'echo', family: 'arc_boss',
    stage: '中年', weight: 3, art: 'office', cond: A(47, 50, function (g) { return !!bossOf(g); }),
    title: '{{npc:boss}}的告别饭',
    text: '上司正式退了，约你在老地方吃饭。他带来一盒旧文件，说里面有些东西你可能用得上。酒过三巡，他问你以后什么打算。',
    opts: [
      o2('敬他一杯，说这些年多谢', { money: { cash: -600 }, at: { happiness: 4, charm: 2 }, npc: { '上司': { intimacy: 8 } }, tag: '四十八岁送别过退下来的上司' },
        W('他把文件推给你，说“以后别学我，太较真”。', { npc: { '上司': { intimacy: 10, anchor: { kind: 'farewell', text: '他退下来那天，把一盒旧文件留给了你' } } }, rep: { industry: 3 } }),
        W('他喝多了，反复说当年对不起你，你不知道该怎么接。', { npc: { '上司': { intimacy: 5 } }, at: { happiness: -1 } }, 40)),
      o2('问他有没有什么要交代的', { at: { knowledge: 3, stress: 1 }, npc: { '上司': { intimacy: 5 } }, tag: '四十八岁问过退下来的上司有什么交代' },
        W('他讲了两个小时，把行业里那些没写进文件的事都说了。', { npc: { '上司': { intimacy: 7, favor: 1 } }, rep: { industry: 4 }, at: { knowledge: 2 } }),
        W('他摆摆手，说“都过去了”，什么也没讲。', { npc: { '上司': { intimacy: 1 } }, at: { happiness: -1 } }, 40)),
      o2('只谈自己的打算，不接他的旧事', { at: { charm: 1, stress: 1 }, npc: { '上司': { intimacy: -2 } }, tag: '四十八岁没接退下来的上司的旧话' },
        W('他听完点了点头，说年轻人有自己的路。', { npc: { '上司': { intimacy: 1 } } }),
        W('饭吃到一半他就说累了，提前走了。', { npc: { '上司': { intimacy: -4 } }, at: { happiness: -2 } }, 45))
    ]
  });

  /* =========================================================
     四、静态跨年回响（id: v32_echo_s_，引用旧年份的锚点）
     ========================================================= */
  add({
    id: 'v32_echo_s_faxiao', type: 'causal', layer: 'chain', tier: 'echo',
    weight: 3, art: 'home', ageMin: 30, ageMax: 72, cond: function (g) {
      var n = npc(g, '发小');
      return g.age >= 30 && g.age <= 72 && !!(n && n.alive && Number(n.favor) >= 2 && n.anchors && n.anchors.length);
    },
    title: '旧照片里的{{npc:发小}}',
    text: '收拾柜子时翻出一张旧照片。{{anchor:发小}}。照片背面写着一个褪色的日期，你算了算，已经过去很多年。',
    opts: [
      o2('拍张照发给他', { npc: { '发小': { intimacy: 5 } }, at: { happiness: 3 }, tag: '翻到旧照片时给发小发了消息' },
        W('他很快回了电话，说那天他也记得，聊了半个钟头。', { npc: { '发小': { intimacy: 7, anchor: { kind: 'memory', text: '你翻出旧照片，他记得那天的每个细节' } } } }),
        W('他回了个笑脸，说照片里的人都老了。', { npc: { '发小': { intimacy: 2 } }, at: { happiness: 1 } }, 40)),
      o2('把照片收进抽屉，不打扰他', { at: { happiness: 1, stress: -1 }, npc: { '发小': { intimacy: 2 } }, tag: '翻到旧照片时你没有联系发小' },
        W('你把照片压在玻璃板下，偶尔看一眼，心里踏实。', { at: { happiness: 2 } }),
        W('后来搬家，那张照片不知道丢在哪了。', { at: { happiness: -1 } }, 40))
    ]
  });

  add({
    id: 'v32_echo_s_parent', type: 'causal', layer: 'chain', tier: 'echo',
    weight: 3, art: 'home', ageMin: 35, ageMax: 78, cond: function (g) {
      var n = npc(g, '母亲') || npc(g, '父亲');
      return g.age >= 35 && g.age <= 78 && !!(n && n.alive && Number(n.intimacy) >= 65);
    },
    title: '母亲又提起那一年',
    text: '母亲在电话里又提起那一年：{{anchor:母亲}}。她说了很多遍，你还是应着。挂电话前她问你什么时候回来吃饭。',
    opts: [
      o2('这周就回去', { at: { happiness: 3, stress: -2 }, npc: { '母亲': { intimacy: 6 } }, tag: '母亲念叨旧事时你这周就回了家' },
        W('饭桌上她一直给你夹菜，父亲在旁边说“够了够了”。', { npc: { '母亲': { intimacy: 8, anchor: { kind: 'visit', text: '她念叨那一年，你这周就回了家' } }, '父亲': { intimacy: 5 } } }),
        W('临时加班没回成，她在电话里说没事，声音低了下去。', { npc: { '母亲': { intimacy: -3 } }, at: { happiness: -2 } }, 45)),
      o2('说忙完这阵再回', { at: { stress: 1, happiness: -1 }, npc: { '母亲': { intimacy: 1 } }, tag: '母亲喊你回家时你说忙完再回' },
        W('她说好，之后隔三差五发来家里的饭菜照片。', { npc: { '母亲': { intimacy: 3 } } }),
        W('这阵一直没忙完，下次回去时她已住了院。', { npc: { '母亲': { intimacy: -4 } }, at: { happiness: -4 } }, 45))
    ]
  });

  add({
    id: 'v32_echo_s_tongxue', type: 'causal', layer: 'chain', tier: 'echo',
    weight: 2, art: 'exam', ageMin: 30, ageMax: 68, cond: A(30, 68, function (g) {
      var n = npc(g, '同学');
      return !!(n && n.alive && Number(n.favor) >= 2);
    }),
    title: '{{npc:同学}}寄来一本书',
    text: '收到一个没有署名的快递，拆开是一本旧书，扉页上写着一行字。{{anchor:同学}}。你翻到最后一页，夹着一张当年的课程表。',
    opts: [
      o2('回寄一张明信片', { npc: { '同学': { intimacy: 5 } }, at: { happiness: 3, charm: 1 }, tag: '给同学回寄过明信片' },
        W('他收到后发来照片，说明信片贴在书桌上。', { npc: { '同学': { intimacy: 7, anchor: { kind: 'letter', text: '你回寄的明信片，他贴在了书桌上' } } } }),
        W('明信片寄丢了，他以为你没收到书。', { npc: { '同学': { intimacy: -2 } }, at: { happiness: -2 } }, 40)),
      o2('打电话过去聊一会儿', { at: { happiness: 3, stress: -1 }, npc: { '同学': { intimacy: 4 } }, tag: '收到旧书后给同学打过电话' },
        W('聊到最后他说，其实这本书是当年你借给他没要回去的。', { npc: { '同学': { intimacy: 6, favor: 1 } } }),
        W('电话没人接，后来他回了一条“在忙”。', { npc: { '同学': { intimacy: -1 } }, at: { happiness: -1 } }, 40)),
      o2('把书放上书架，不联系', { at: { happiness: 1 }, npc: { '同学': { intimacy: 1 } }, tag: '收到旧书后你没有联系同学' },
        W('很多年后你再翻这本书，才发现扉页上还有一句话。', { at: { happiness: 2 } }),
        W('书被孩子拿去垫桌脚，你找回来时封面已经折了。', { at: { happiness: -2 } }, 40))
    ]
  });

  add({
    id: 'v32_echo_s_boss', type: 'causal', layer: 'chain', tier: 'echo',
    weight: 2, art: 'office', ageMin: 30, ageMax: 62, cond: A(30, 62, function (g) {
      var n = bossOf(g);
      return !!(n && n.alive && Number(n.intimacy) >= 60);
    }),
    title: '老上司的一条语音',
    text: '很久没联系的老上司发来一条语音，只有十几秒。{{anchor:上司}}。他说自己现在不管事了，有些话反而敢说。',
    opts: [
      o2('回电话，认真听他说完', { at: { happiness: 3, stress: 1 }, npc: { '上司': { intimacy: 6 } }, tag: '老上司发来语音时你回电话听他说完' },
        W('他讲了半个钟头，最后说起 2003 年项目验收，他把责任推给了你，这位老上司一直觉得亏欠你。', { npc: { '上司': { intimacy: 8, favor: 1, anchor: { kind: 'call', text: '他退下来后给你打过电话，说当年亏欠你' } } } }),
        W('他说的都是旧事，你听着，插不上话。', { npc: { '上司': { intimacy: 3 } }, at: { stress: 2 } }, 40)),
      o2('回一句“保重身体”', { at: { stress: -1 }, npc: { '上司': { intimacy: 2 } }, tag: '老上司发来语音你只回了保重' },
        W('他回了个大拇指，之后没再打扰你。', { npc: { '上司': { intimacy: 2 } } }),
        W('后来听说他身体不好，你想再联系时已经晚了。', { npc: { '上司': { intimacy: -3 } }, at: { happiness: -3 } }, 45))
    ]
  });

  add({
    id: 'v32_echo_s_spouse', type: 'causal', layer: 'chain', tier: 'echo',
    weight: 3, art: 'home', ageMin: 35, ageMax: 72, cond: A(35, 72, function (g) {
      var m = marriage(g);
      return !!(married(g) && m.year && (g.year - m.year) >= 12);
    }),
    title: '结婚纪念日的旧照片',
    text: '伴侣翻出结婚那天的照片，摆在桌上。{{anchor:配偶}}。照片里的两个人都很瘦，笑得有点拘谨。',
    opts: [
      o2('再拍一张同样的姿势', { at: { happiness: 4, stress: -2 }, npc: { '配偶': { intimacy: 7 } }, tag: '结婚纪念日重新拍过同样的照片' },
        W('你们照着旧照片摆姿势，拍完两个人都笑了，说肚子回不去了。', { npc: { '配偶': { intimacy: 9, anchor: { kind: 'anniversary', text: '结婚纪念日你们照着旧照片又拍了一张' } } } }),
        W('孩子笑你们肉麻，照片最后还是没拍成。', { npc: { '配偶': { intimacy: 2 } }, at: { happiness: -1 } }, 40)),
      o2('把照片重新装进相框', { money: { cash: -300 }, at: { happiness: 2 }, npc: { '配偶': { intimacy: 4 } }, tag: '给结婚照换过新相框' },
        W('伴侣把相框摆在床头，说这比什么礼物都好。', { npc: { '配偶': { intimacy: 6 } } }),
        W('相框尺寸买错了，照片塞不进去，被伴侣笑了半天。', { npc: { '配偶': { intimacy: 3 } }, at: { happiness: 1 } }, 40)),
      o2('说旧照片就别翻了', { at: { stress: -1, happiness: -2 }, npc: { '配偶': { intimacy: -3 } }, tag: '结婚纪念日你把旧照片收了起来' },
        W('伴侣没说什么，把照片放回抽屉，晚上话少了很多。', { npc: { '配偶': { intimacy: -1 } } }),
        W('这件事她/他记了很久，之后再也不提纪念日。', { npc: { '配偶': { favor: -1 } }, at: { happiness: -3 } }, 45))
    ]
  });

  add({
    id: 'v32_echo_s_child', type: 'causal', layer: 'chain', tier: 'echo',
    weight: 2, art: 'nursery', ageMin: 40, ageMax: 72, cond: A(40, 72, function (g) {
      var c = firstChild(g);
      return !!(c && Number(c.age) >= 18);
    }),
    title: '孩子翻出了旧书包',
    text: '孩子从储物间翻出一个旧书包，里面还有你当年写的便条。{{anchor:子女}}。他/她拿着便条问你，这上面写的是什么意思。',
    opts: [
      o2('坐下来讲讲当年的事', { at: { happiness: 4, stress: -1 }, npc: { '子女': { intimacy: 6 } }, tag: '孩子翻出旧物时你讲了当年的事' },
        W('孩子听得认真，最后说原来你也有那么难的时候。', { npc: { '子女': { intimacy: 8, anchor: { kind: 'talk', text: '孩子翻出旧书包，你给他/她讲了当年的事' } } } }),
        W('你讲着讲着发现很多细节已经记不清了。', { npc: { '子女': { intimacy: 3 } }, at: { happiness: 1 } }, 40)),
      o2('把便条收起来，说没什么', { at: { happiness: -1 }, npc: { '子女': { intimacy: 1 } }, tag: '孩子翻出旧物时你把便条收了起来' },
        W('孩子没再追问，晚上自己把书包收回了储物间。', { npc: { '子女': { intimacy: 2 } } }),
        W('他/她觉得你有事瞒着，之后很久没再提起。', { npc: { '子女': { intimacy: -3 } }, at: { happiness: -2 } }, 45))
    ]
  });

  add({
    id: 'v32_echo_s_mentor', type: 'causal', layer: 'chain', tier: 'echo',
    weight: 2, art: 'office', ageMin: 30, ageMax: 68, cond: A(30, 68, function (g) {
      var n = npc(g, '恩人');
      return !!(n && n.alive && Number(n.favor) >= 3);
    }),
    title: '{{npc:恩人}}托人带话',
    text: '一个后辈带来口信，说{{npc:恩人}}最近身体不好，念叨过你。{{anchor:恩人}}。后辈说，他/她当年也受过这个人的提携。',
    opts: [
      o2('当天就去看看他', { money: { cash: -800 }, at: { happiness: 3, stress: 1 }, npc: { '恩人': { intimacy: 7 } }, tag: '恩人病中你去看过他' },
        W('他躺在床上，拉着你的手说没白帮你。', { npc: { '恩人': { intimacy: 9, favor: 1, anchor: { kind: 'visit', text: '他病中念叨你，你当天就去了' } } } }),
        W('他到门口迎你，说自己没事，反倒让你别担心。', { npc: { '恩人': { intimacy: 5 } }, at: { happiness: 1 } }, 40)),
      o2('托后辈带点东西过去', { money: { cash: -500 }, at: { happiness: 1 }, npc: { '恩人': { intimacy: 4 } }, tag: '恩人病中你托人带了东西' },
        W('后辈回话说他收了，让你别惦记。', { npc: { '恩人': { intimacy: 4 } } }),
        W('东西辗转了几天才送到，他已经出院了。', { npc: { '恩人': { intimacy: 1 } }, at: { happiness: -1 } }, 40)),
      o2('说改天再去', { at: { stress: -1, happiness: -2 }, npc: { '恩人': { intimacy: -3 } }, tag: '恩人病中你说改天再去' },
        W('改天还没到，后辈打来电话说人走了。', { npc: { '恩人': { intimacy: -6, favor: -1 } }, at: { happiness: -6 } }),
        W('你后来去了，站在病房门口，没进去。', { npc: { '恩人': { intimacy: -2 } }, at: { happiness: -4 } }, 45))
    ]
  });

  add({
    id: 'v32_echo_s_enemy', type: 'causal', layer: 'chain', tier: 'echo',
    weight: 2, art: 'emptyHome', ageMin: 30, ageMax: 72, cond: A(30, 72, function (g) {
      var n = npc(g, '仇人');
      return !!(n && n.alive && Number(n.favor) <= -3);
    }),
    title: '{{npc:仇人}}又出现在同一场饭局',
    text: '行业饭局上，你和他被安排在同一桌。{{anchor:仇人}}。他端着酒杯过来，脸上带着那种你熟悉的笑。',
    opts: [
      o2('举杯，面子上过得去', { at: { stress: 2, charm: 2 }, npc: { '仇人': { favor: 1 } }, tag: '和仇人在饭局上举过杯' },
        W('你们碰了杯，谁也没提当年的事，散场后各走各的。', { npc: { '仇人': { favor: 2 } } }),
        W('他在酒桌上当众提了一句旧事，你笑着接了过去。', { npc: { '仇人': { favor: -1 } }, at: { happiness: -2 } }, 45)),
      o2('直接换桌', { at: { stress: -1, happiness: 1 }, npc: { '仇人': { favor: -1 } }, tag: '仇人同桌时你直接换了桌' },
        W('主办方给你换了个位置，那顿饭吃得还算安稳。', { npc: { '仇人': { favor: 1 } } }),
        W('全场都看见了，之后行业里传你心胸窄。', { npc: { '仇人': { favor: -2 } }, rep: { industry: -4 }, at: { happiness: -3 } }, 45)),
      o2('借这个机会把话挑明', { at: { stress: 4, charm: 1 }, npc: { '仇人': { favor: -2 } }, tag: '饭局上和仇人把话挑明' },
        W('他听完沉默了一会儿，说“那就这样吧”，之后没再找过你麻烦。', { npc: { '仇人': { favor: 2 } } }),
        W('话赶话又吵了起来，饭局不欢而散。', { npc: { '仇人': { favor: -3 } }, rep: { industry: -2 }, at: { happiness: -4 } }, 45))
    ]
  });

  /* =========================================================
     五、动态跨年回响：善缘兑现 / 报复返场
     返回 null 表示本年不触发
     ========================================================= */
  function kindFlavor(rec) {
    var c = rec.circle || '', k = String(rec.kind || '');
    if (Number(rec.amount) > 0 || /lend|money|invest|gift/.test(k)) {
      return {
        key: 'repay', title: '当年那笔钱，他记到今天',
        hook: '他带着钱和一箱水果上门，说连本带利，一分不少。',
        win: '他把钱推到你面前，说当年要不是你，他那一关过不去。',
        half: '他先还了一半，说剩下的再宽限几个月。'
      };
    }
    if (c === '同事圈' || /cover|protect|support/.test(k)) {
      return {
        key: 'refer', title: '当年递出去的话，有了回音',
        hook: '他说公司有个位置，第一个想到你。',
        win: '他把你推荐进了面试，还替你说了不少好话。',
        half: '他帮忙问了，但位置最后给了别人。'
      };
    }
    if (c === '发小圈' || /partner|invest/.test(k)) {
      return {
        key: 'partner', title: '当年一起熬的夜，换来了入伙',
        hook: '他说项目还缺一个合伙人，问你愿不愿意。',
        win: '他把合同推过来，说这摊子有你一半。',
        half: '他让你先挂个名，分红的事以后再说。'
      };
    }
    if (c === '行业圈' || /refer|deal|support/.test(k)) {
      return {
        key: 'gate', title: '当年的一句话，变成一条门路',
        hook: '他说有个门路，愿意替你牵线。',
        win: '那个电话打出去，事情就通了。',
        half: '线牵上了，但对面还要再考虑。'
      };
    }
    return {
      key: 'loan', title: '他知道你现在难，主动来了',
      hook: '他说知道你现在周转不开，这笔钱先用着。',
      win: '他二话不说把钱转了过来，连借条都没让写。',
      half: '他拿了一部分，说剩下的实在拿不出。'
    };
  }

  function revengeFlavor(rec) {
    var c = rec.circle || '', k = String(rec.kind || '');
    if (c === '行业圈' || c === '客户圈' || /client|deal/.test(k)) {
      return {
        key: 'client', title: '他把你跟了半年的客户挖走了',
        hook: '他给你最大的客户打了电话，报了一个你做不到的价。',
        win: '客户最终留了下来，但合同被压掉了一截。',
        lose: '客户跟着他走了，你半年的功夫打了水漂。'
      };
    }
    if (k === 'betray' || k === 'offend' || c === '同事圈') {
      return {
        key: 'report', title: '一封匿名举报信',
        hook: '上面收到一封举报，说你手脚不干净，要你配合调查。',
        win: '查了半个月没查出什么，事情压了下去。',
        lose: '调查拖了很久，你的位置被暂时停了。'
      };
    }
    return {
      key: 'chance', title: '他断掉了你的一次机会',
      hook: '一个本来该轮到你的机会，在最后关头换了人。',
      win: '你另找了一条路，虽然慢了一点，但走通了。',
      lose: '机会没了，你在原地多待了两年。'
    };
  }

  LS.buildEchoEvent = function (g, rec, kind) {
    if (!g || !rec || rec.resolved) return null;
    var n = LS.getNpc(g, rec.npcId);
    if (!n || !n.alive) return null;
    if (kind === 'kind') {
      if (g.year < (rec.dueFrom || rec.year + 10)) return null;
      if (g.year > (rec.dueTo || rec.year + 20)) return null;
    }
    var isKind = kind !== 'revenge';
    var fl = isKind ? kindFlavor(rec) : revengeFlavor(rec);
    var name = n.name || rec.npcName || rec.npcId;
    var npcKey = rec.npcId || n.id;
    var stamp = rec.id + '_' + g.year;
    var head = '那年是 ' + rec.year + ' 年，你 ' + rec.age + ' 岁。' + (rec.text || (isKind ? '你帮过他' : '你亏欠过他')) + '。';
    var body = isKind
      ? head + name + ' 一直记着这份人情。今年你 ' + g.age + ' 岁，他找上门来。' + fl.hook
      : head + name + ' 一直没忘这笔账。今年你 ' + g.age + ' 岁，他动手了。' + fl.hook;
    var gain = Number(rec.amount) > 0 ? Math.max(5000, Math.round(Number(rec.amount) * 1.2)) : 12000;
    if (fl.key === 'partner') gain = 20000;
    if (fl.key === 'loan') gain = 15000;
    if (fl.key === 'gate') gain = 10000;
    if (fl.key === 'refer') gain = 12000;
    var npcFx = {};
    npcFx[npcKey] = { intimacy: 6, favor: 2 };
    var payoffName = { repay: '还钱', refer: '内推工作', partner: '创业入伙', gate: '介绍门路', loan: '借你一笔' }[fl.key] || '回报';
    var payoffLog = function (how) {
      return '当年（' + rec.year + ' 年）你为他：' + (rec.text || '帮过一把') + '；今年（' + g.year + ' 年）他以「' + payoffName + '」回报，' + how;
    };

    if (isKind) {
      return {
        id: 'v32_echo_k_' + stamp,
        type: 'branch', layer: 'echo', tier: 'echo', stage: LS.stageOf(g.age), weight: 1, prio: 80,
        art: 'money', title: fl.title, text: body,
        opts: [
          o3('收下他这份人情', { payoff: { id: rec.id, type: fl.key, text: payoffLog('你收下了')
            }, npc: npcFx },
            W(fl.win, { money: { cash: gain }, npc: {} }, 55, '这份人情，他真的还了'),
            W(fl.half, { money: { cash: Math.round(gain / 2) }, at: { happiness: -1 } }, 30),
            W('他说了很多客气话，最后什么也没落下。', { npc: {} }, 15)),
          o2('推掉，说当年只是顺手', { payoff: { id: rec.id, type: fl.key, text: payoffLog('你把这份人情推了回去')
            }, npc: NX(npcKey, { intimacy: 4, favor: 1 }) },
            W('他坚持留下一点心意，说不然心里过不去。', { money: { cash: Math.round(gain / 3) }, npc: NX(npcKey, { intimacy: 3 }) }, 55),
            W('他收回手，说“那这份情我记着”。', { npc: NX(npcKey, { intimacy: 2 }) }, 45)),
          o2('反请他搭把手', { payoff: { id: rec.id, type: fl.key, text: payoffLog('你没要回报，反过来请他帮了个忙')
            }, npc: NX(npcKey, { intimacy: 4 }) },
            W('他一口答应，办得比自己的事还上心。', { money: { cash: Math.round(gain / 2) }, npc: NX(npcKey, { intimacy: 7, favor: 2 }) }, 60),
            W('他面露难色，说这事他做不了主。', { npc: NX(npcKey, { intimacy: -2 }), at: { happiness: -1 } }, 40))
        ]
      };
    }
    var moneyLoss = fl.key === 'client' ? -30000 : (fl.key === 'report' ? -15000 : -10000);
    return {
      id: 'v32_echo_r_' + stamp,
      type: 'branch', layer: 'echo', tier: 'echo', stage: LS.stageOf(g.age), weight: 1, prio: 80,
      art: 'emptyHome', title: fl.title, text: body,
      opts: [
        o2('当面道歉，拿钱补偿', { revengeDone: { id: rec.id, type: fl.key, text: '你当面道歉并做了补偿' }, money: { cash: -5000 } },
          W(fl.win + '他收了钱，说这笔账到此为止。', { npc: NX(npcKey, { intimacy: 4, favor: 2 }) }, 55),
          W('钱他收了，事却没完，他说“这只是利息”。', { money: { cash: -3000 }, npc: NX(npcKey, { favor: -1 }), at: { stress: 3 } }, 45)),
        o2('硬碰硬，不再退', { revengeDone: { id: rec.id, type: fl.key, text: '你没有退让，和他硬碰硬' }, rep: { industry: -3 }, at: { stress: 5 } },
          W('他见你不好惹，收了手，之后没再动作。', { npc: NX(npcKey, { favor: 1 }), at: { happiness: 2 } }, 50),
          W(fl.lose, { money: { cash: moneyLoss }, npc: NX(npcKey, { favor: -3 }), at: { happiness: -4 } }, 50)),
        o2('找中间人调停', { revengeDone: { id: rec.id, type: fl.key, text: '你托中间人把这事调停了' }, money: { cash: -2000 } },
          W('中间人把话说开，他答应收手，条件是你别再碰他那块。', { npc: NX(npcKey, { intimacy: 2, favor: 1 }) }, 60),
          W('调停的人两头不讨好，事情还是照旧。', { npc: NX(npcKey, { favor: -1 }), at: { stress: 3 } }, 40))
      ]
    };
  };

  /* ---------------- 注册到全局事件表 ---------------- */
  LS.EVENTS = E;
  var idx = {};
  for (var q = 0; q < E.length; q++) {
    if (E[q] && E[q].id) idx[E[q].id] = E[q];
  }
  LS.EVENT_INDEX = idx;

})();
