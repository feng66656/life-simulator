/* =========================================================
   events_v35.js — v3.5 人物关系网内容层
   1) 40 个带“在场者意见”的关键决策（LS.ADVISORS）
   2) 8 个核心 NPC × 跨阶段 × 13 场景 = 520 条 NPC 事件
   3) 60 条多节点事件链（3 主线节点 + 2 条中断尾巴，共 300 条）
   4) 100 条日常填充
   5) 2 条可复现因果链（善缘 / 报复）
   ========================================================= */
(function () {
  'use strict';
  var L = window.LS = window.LS || {};
  L.EVENTS = L.EVENTS || [];

  function fx(at, money, npc, extra) {
    var f = {};
    if (at) f.at = at;
    if (money) f.money = { cash: money };
    if (npc) f.npc = npc;
    if (extra) for (var k in extra) f[k] = extra[k];
    return f;
  }
  function W(w, label, text, f) { return { w: w, label: label, text: text, fx: f || {} }; }
  function O(label, hint, tone, outs, apply) { return { label: label, hint: hint || '', tone: tone || '', outcomes: outs, apply: apply || {} }; }

  /* ===================== 1. 在场者意见（40 个决策） ===================== */
  /* stance: support 支持 / oppose 反对；prefer: 采纳即“听他的”的选项下标；
     effects.adopt: 听他的 → 生效；effects.ignore: 没听 → 生效；p: 成功率修正 */
  function A(role, stance, reason, prefer, adopt, ignore, p) {
    return { role: role, stance: stance, reason: reason, prefer: prefer, effects: { adopt: adopt || null, ignore: ignore || null }, p: p || 0 };
  }
  L.ADVISORS = {
    c_housegain: [
      A('配偶', 'support', '“再小也是自己的家，月供我们勒紧点。”', 0, { at: { happiness: 3 } }, { at: { stress: 4 }, npc: { '配偶': { intimacy: -6 } } }, 0.06),
      A('母亲', 'oppose', '“首付把家底掏空，万一生病怎么办？”', 1, { at: { stress: -3 } }, { at: { money: { cash: -5000 }, npc: { '母亲': { intimacy: -4 } } } })
    ],
    c_startupfail: [
      A('发小', 'support', '“亏了就重来，我陪你。”', 0, { at: { happiness: 2 }, npc: { '发小': { intimacy: 6 } } }, { at: { stress: 5 }, npc: { '发小': { intimacy: -5 } } }, 0.08),
      A('配偶', 'oppose', '“房贷还没还完，别把家底押上。”', 1, { at: { stress: -4 } }, { at: { stress: 6 }, npc: { '配偶': { intimacy: -5 } } })
    ],
    c_startupfail2: [
      A('合伙人', 'support', '“再撑三个月，客户就回款了。”', 0, null, { at: { money: { cash: -20000 } } }, 0.05),
      A('父亲', 'oppose', '“生意不是这么做的，及时止损吧。”', 1, { at: { stress: -2 } }, { at: { stress: 4 } })
    ],
    c_startup_tension: [
      A('合伙人', 'support', '“先把账摊开说清楚。”', 0, { npc: { '合伙人': { intimacy: 5 } } }, { npc: { '合伙人': { intimacy: -6 }, favor: -1 } }),
      A('配偶', 'neutral', '“你们的事我不懂，但别瞒我。”', -1, null, { at: { happiness: -2 } })
    ],
    c_marriage_crisis: [
      A('配偶', 'support', '“我们坐下来，把话说完。”', 0, { at: { happiness: 4 }, npc: { '配偶': { intimacy: 8 } } }, { at: { happiness: -4 }, npc: { '配偶': { intimacy: -8 } } }),
      A('母亲', 'oppose', '“冷战最伤人，先回家住两天。”', 1, { at: { happiness: 2 } }, { at: { stress: 3 } })
    ],
    c_child_rebel: [
      A('配偶', 'support', '“孩子这个年纪，硬碰硬没用。”', 0, { at: { happiness: 2 }, npc: { '子女': { intimacy: 6 } } }, { at: { happiness: -3 }, npc: { '子女': { intimacy: -5 } } }),
      A('父亲', 'oppose', '“该立的规矩不能松。”', 1, { at: { stress: -2 } }, { at: { stress: 4 } })
    ],
    c_child_gaokao: [
      A('子女', 'support', '“我想试试自己喜欢的专业。”', 0, { at: { happiness: 3 }, npc: { '子女': { intimacy: 6 } } }, { at: { npc: { '子女': { intimacy: -6 } } } }),
      A('配偶', 'oppose', '“先选稳的专业，别拿前途赌。”', 1, { at: { stress: -2 } }, { at: { happiness: -2 } })
    ],
    c_child_late: [
      A('配偶', 'support', '“再难也想要一个孩子。”', 0, { at: { happiness: 3 } }, { at: { happiness: -5 }, npc: { '配偶': { intimacy: -5 } } }),
      A('母亲', 'oppose', '“身体要紧，别硬来。”', 1, { at: { health: 3 } }, { at: { health: -2 } })
    ],
    c_late_love: [
      A('发小', 'support', '“去见一面，不丢人。”', 0, { at: { happiness: 3 }, npc: { '发小': { intimacy: 5 } } }, { at: { happiness: -2 } }),
      A('子女', 'oppose', '“这个年纪了，别折腾。”', 1, { at: { stress: -2 } }, { at: { stress: 3 } })
    ],
    c_relative_borrow: [
      A('母亲', 'support', '“都是自家人，能帮就帮。”', 0, { npc: { '母亲': { intimacy: 6 } }, at: { happiness: 2 } }, { npc: { '母亲': { intimacy: -5 } }, at: { stress: 3 } }),
      A('配偶', 'oppose', '“我们自己的日子也不宽裕。”', 1, { at: { money: { cash: 5000 } } }, { at: { money: { cash: -8000 } } })
    ],
    c_job_hunt: [
      A('同学', 'support', '“我帮你内推，简历发我。”', 0, { npc: { '同学': { intimacy: 6 } } }, { npc: { '同学': { intimacy: -4 } } }, 0.12),
      A('父亲', 'oppose', '“先找个稳当的，别挑。”', 1, { at: { stress: -3 } }, { at: { stress: 2 } })
    ],
    c_layoff35: [
      A('同事', 'support', '“一起把赔偿谈到 N+2。”', 0, { at: { money: { cash: 20000 } }, npc: { '同事': { intimacy: 6 } } }, { at: { money: { cash: -30000 } } }),
      A('配偶', 'oppose', '“别闹僵，还要背调。”', 1, { at: { stress: -2 } }, { at: { stress: 4 } })
    ],
    c_headhunt: [
      A('上司', 'oppose', '“现在走，项目就烂尾了。”', 1, { npc: { '上司': { intimacy: 5 } }, at: { stress: -2 } }, { npc: { '上司': { intimacy: -8 }, favor: -1 } }),
      A('同事', 'support', '“机会难得，去看看。”', 0, { at: { money: { cash: 8000 } } }, { at: { happiness: -2 } }, 0.07)
    ],
    c_civil_tempt: [
      A('母亲', 'support', '“编制稳当，妈放心。”', 0, { at: { stress: -4 }, npc: { '母亲': { intimacy: 5 } } }, { npc: { '母亲': { intimacy: -4 } } }),
      A('同学', 'oppose', '“你不适合坐办公室。”', 1, { at: { happiness: 2 } }, { at: { happiness: -2 } })
    ],
    c_unemployed: [
      A('配偶', 'support', '“先歇一阵，家里有我。”', 0, { at: { stress: -5 }, npc: { '配偶': { intimacy: 6 } } }, { at: { stress: 5 } }),
      A('发小', 'oppose', '“别闲着，来我这儿先干着。”', 1, { at: { money: { cash: 3000 } } }, { at: { money: { cash: -2000 } } })
    ],
    c_bankrupt: [
      A('父亲', 'support', '“人还在，就还有翻本的机会。”', 0, { at: { stress: -4 }, npc: { '父亲': { intimacy: 6 } } }, { at: { stress: 6 } }),
      A('配偶', 'oppose', '“别再借了，先把窟窿堵上。”', 1, { at: { money: { cash: -3000 } } }, { at: { money: { cash: -15000 } } })
    ],
    c_debtcollect: [
      A('发小', 'support', '“我先替你垫一部分。”', 0, { at: { money: { cash: 10000 }, npc: { '发小': { intimacy: 8 }, favor: 1 } } }, { at: { stress: 6 }, npc: { '发小': { intimacy: -8 } } }),
      A('配偶', 'oppose', '“不能再欠人情了。”', 1, { at: { stress: -2 } }, { at: { money: { cash: -5000 } } })
    ],
    c_parent_sick: [
      A('母亲', 'support', '“你爸这病，得有人守夜。”', 0, { at: { health: -2, happiness: 3 }, npc: { '父亲': { intimacy: 8 } } }, { at: { happiness: -5 }, npc: { '父亲': { intimacy: -6 } } }),
      A('配偶', 'oppose', '“你也要上班，别把自己熬垮。”', 1, { at: { health: 3 } }, { at: { stress: 4 } })
    ],
    c_oldlove: [
      A('发小', 'support', '“见一面，把话说完。”', 0, { at: { happiness: 3 } }, { at: { happiness: -3 } }),
      A('配偶', 'oppose', '“过去了就让它过去。”', 1, { at: { stress: -3 } }, { at: { stress: 5 } })
    ],
    c_depression: [
      A('配偶', 'support', '“我们去看看医生。”', 0, { at: { health: 4, happiness: 3 } }, { at: { happiness: -4 } }),
      A('母亲', 'oppose', '“想开点，别乱吃药。”', 1, { at: { money: { cash: 3000 } } }, { at: { health: -3 } })
    ],
    c_depression2: [
      A('发小', 'support', '“我陪你去，别一个人扛。”', 0, { at: { happiness: 4 }, npc: { '发小': { intimacy: 7 } } }, { at: { happiness: -3 } }),
      A('配偶', 'neutral', '“你自己决定，我都支持。”', -1, null, null)
    ],
    c_depression3: [
      A('配偶', 'support', '“这次听医生的，住下来。”', 0, { at: { health: 5 } }, { at: { health: -5 } }),
      A('子女', 'oppose', '“家里离不开你。”', 1, { at: { happiness: 2 } }, { at: { happiness: -3 } })
    ],
    c_hospital: [
      A('配偶', 'support', '“手术吧，钱我想办法。”', 0, { at: { health: 6 }, money: { cash: -20000 } }, { at: { health: -6 } }),
      A('父亲', 'oppose', '“保守治疗，别挨这一刀。”', 1, { at: { money: { cash: 5000 } } }, { at: { health: -4 } })
    ],
    c_health_check: [
      A('母亲', 'support', '“查清楚，别拖。”', 0, { at: { health: 4 } }, { at: { health: -4 } }),
      A('配偶', 'oppose', '“别自己吓自己。”', 1, { at: { stress: -2 } }, { at: { stress: 3 } })
    ],
    c_stock: [
      A('同事', 'support', '“这波能上车，我盯着。”', 0, { at: { money: { cash: 6000 } } }, { at: { money: { cash: -6000 } } }, 0.08),
      A('配偶', 'oppose', '“别拿家用去赌。”', 1, { at: { stress: -3 } }, { at: { stress: 4 } })
    ],
    c_stock2: [
      A('同学', 'support', '“内部消息，稳的。”', 0, { at: { money: { cash: 12000 } } }, { at: { money: { cash: -12000 } } }, 0.1),
      A('配偶', 'oppose', '“哪有稳赚的事。”', 1, { at: { money: { cash: 2000 } } }, { at: { money: { cash: -10000 } } })
    ],
    c_corruption: [
      A('上司', 'support', '“签了，大家都这么走。”', 0, { at: { money: { cash: 30000 } } }, { at: { money: { cash: -10000 }, npc: { '上司': { intimacy: -6 } } } }, 0.07),
      A('同事', 'oppose', '“出事就是一辈子。”', 1, { at: { stress: -4 } }, { at: { stress: 5 } })
    ],
    c_corruption2: [
      A('上司', 'support', '“最后一次，收手就没事。”', 0, { at: { money: { cash: 50000 } } }, { at: { money: { cash: -20000 } } }, 0.05),
      A('配偶', 'oppose', '“家里不能没有你。”', 1, { at: { happiness: 2 } }, { at: { happiness: -4 } })
    ],
    c_quack: [
      A('母亲', 'support', '“偏方也是方，试试。”', 0, { at: { money: { cash: -5000 } } }, { at: { money: { cash: 2000 } } }),
      A('配偶', 'oppose', '“去正规医院。”', 1, { at: { health: 3 } }, { at: { health: -4 } })
    ],
    c_inflation_pressure: [
      A('配偶', 'support', '“先把房贷提前还一部分。”', 0, { at: { money: { cash: -15000 }, happiness: 2 } }, { at: { stress: 3 } }),
      A('父亲', 'oppose', '“手里要留现金。”', 1, { at: { money: { cash: 3000 } } }, { at: { money: { cash: -3000 } } })
    ],
    c_freelance_dry: [
      A('发小', 'support', '“我给你介绍两个客户。”', 0, { at: { money: { cash: 6000 }, npc: { '发小': { intimacy: 5 } } } }, { at: { money: { cash: -3000 } } }),
      A('配偶', 'oppose', '“要不先找个班上。”', 1, { at: { money: { cash: 4000 } } }, { at: { stress: 4 } })
    ],
    c_teacher_tutor: [
      A('同学', 'support', '“一起开个班，生源我有。”', 0, { at: { money: { cash: 8000 } } }, { at: { money: { cash: -4000 } } }, 0.07),
      A('母亲', 'oppose', '“别耽误正经工作。”', 1, { at: { stress: -2 } }, { at: { stress: 3 } })
    ],
    c_promise: [
      A('发小', 'support', '“你答应过我的。”', 0, { at: { happiness: 2 }, npc: { '发小': { intimacy: 7 } } }, { at: { happiness: -3 }, npc: { '发小': { intimacy: -7 } } }),
      A('配偶', 'oppose', '“先顾好自己家。”', 1, { at: { money: { cash: 3000 } } }, { at: { money: { cash: -3000 } } })
    ],
    c_promise2: [
      A('父亲', 'support', '“答应人的事，要做到。”', 0, { at: { reputation: 3 }, npc: { '父亲': { intimacy: 5 } } }, { at: { reputation: -3 } }),
      A('同事', 'oppose', '“职场别讲这些。”', 1, { at: { money: { cash: 3000 } } }, { at: { money: { cash: -2000 } } })
    ],
    c_wrongmajor: [
      A('同学', 'support', '“转专业吧，别耗着。”', 0, { at: { knowledge: 4, happiness: 2 } }, { at: { happiness: -4 } }),
      A('母亲', 'oppose', '“都读一半了，忍忍。”', 1, { at: { stress: -3 } }, { at: { stress: 4 } })
    ],
    c_sleep: [
      A('配偶', 'support', '“早点睡，身体要紧。”', 0, { at: { health: 3 } }, { at: { health: -3 } }),
      A('同事', 'oppose', '“这阵子熬过去就好。”', 1, { at: { money: { cash: 2000 } } }, { at: { health: -4 } })
    ],
    c_smoke: [
      A('配偶', 'support', '“戒了吧，我陪你。”', 0, { at: { health: 4 }, npc: { '配偶': { intimacy: 5 } } }, { at: { health: -4 }, npc: { '配偶': { intimacy: -4 } } }),
      A('发小', 'oppose', '“男人哪有不抽的。”', 1, { at: { stress: -2 } }, { at: { health: -5 } })
    ],
    c_drink: [
      A('同事', 'support', '“这杯不喝，合同就没了。”', 0, { at: { money: { cash: 3000 }, health: -3 } }, { at: { money: { cash: -4000 } } }),
      A('配偶', 'oppose', '“你的肝不要了？”', 1, { at: { health: 3 } }, { at: { health: -4 } })
    ],
    c_sedentary: [
      A('配偶', 'support', '“晚上一起去走走。”', 0, { at: { health: 4 }, npc: { '配偶': { intimacy: 4 } } }, { at: { health: -3 } }),
      A('同事', 'oppose', '“忙完这阵再说。”', 1, { at: { money: { cash: 2000 } } }, { at: { health: -4 } })
    ],
    c_bully: [
      A('同学', 'support', '“我陪你去告诉老师。”', 0, { at: { happiness: 3 }, npc: { '同学': { intimacy: 7 } } }, { at: { happiness: -4 }, npc: { '同学': { intimacy: -5 } } }),
      A('父亲', 'oppose', '“忍一忍，别惹事。”', 1, { at: { stress: 3 } }, { at: { stress: -2 } })
    ],
    c_leftbehind: [
      A('母亲', 'support', '“妈去城里陪你。”', 0, { at: { happiness: 4 }, npc: { '母亲': { intimacy: 8 } } }, { at: { happiness: -5 }, npc: { '母亲': { intimacy: -6 } } }),
      A('父亲', 'oppose', '“家里地谁来种？”', 1, { at: { money: { cash: 2000 } } }, { at: { money: { cash: -2000 } } })
    ],
    c_childless_old: [
      A('配偶', 'support', '“我们两个人也挺好。”', 0, { at: { happiness: 3 }, npc: { '配偶': { intimacy: 6 } } }, { at: { happiness: -4 } }),
      A('发小', 'oppose', '“老了没人照应。”', 1, { at: { stress: 3 } }, { at: { stress: -2 } })
    ]
  };

  /* --------- 意见运行时 --------- */
  function stanceText(s) { return s === 'support' ? '支持' : (s === 'oppose' ? '反对' : '无所谓'); }
  function roleNpc(g, role) {
    var n = L.getNpc(g, role);
    if (!n || !n.alive) return null;
    return n;
  }
  function supplement(g, list, need) {
    var pool = (g.npcs || []).filter(function (n) { return n.alive && !list.some(function (a) { return a.role === n.role; }); });
    pool.sort(function (a, b) { return Number(b.intimacy) - Number(a.intimacy); });
    for (var i = 0; i < pool.length && list.length < need; i++) {
      var n = pool[i];
      list.push({ role: n.role, stance: 'neutral', reason: '“' + (n.role === '配偶' ? '你自己拿主意。' : '我听着，你想清楚就好。') + '”', prefer: -1, effects: {}, p: 0, auto: true });
    }
    return list;
  }
  L.advisorFor = function (g, ev) {
    if (!g || !ev) return [];
    var spec = (ev.advisors && ev.advisors.length) ? ev.advisors : L.ADVISORS[ev.id];
    if (!spec || !spec.length) return [];
    var list = [];
    spec.forEach(function (a) {
      var n = roleNpc(g, a.role);
      if (!n) return;
      list.push({
        role: a.role, id: n.id, name: n.name, stance: a.stance, reason: a.reason,
        prefer: a.prefer, effects: a.effects || {}, p: Number(a.p) || 0, attitude: L.SOCIAL.attitude(n)
      });
    });
    if (!list.length && spec.length) {
      /* 声明的角色都不在：用当前最亲近的人补位，保证意见机制不空转 */
      supplement(g, list, 2);
    }
    if (list.length < 2) supplement(g, list, 2);
    return list.slice(0, 3);
  };
  L.advisorResolve = function (g, ev, chosen) {
    var list = L.advisorFor(g, ev);
    if (!list.length) return null;
    var report = { fx: {}, pDelta: 0, lines: [], adopted: [], ignored: [] };
    list.forEach(function (a) {
      var npc = L.getNpc(g, a.role);
      if (!npc) return;
      var adopted = a.prefer === chosen;
      var eff = adopted ? (a.effects && a.effects.adopt) : (a.effects && a.effects.ignore);
      var stance = a.stance;
      var dIt = 0;
      if (adopted) { dIt = 5; report.adopted.push(a.name || a.role); }
      else if (a.prefer >= 0) { dIt = stance === 'support' ? -4 : 3; report.ignored.push(a.name || a.role); }
      npc.intimacy = L.clamp((Number(npc.intimacy) || 0) + dIt, 0, 100);
      if (adopted) npc.favor = L.clamp((Number(npc.favor) || 0) + 1, -5, 5);
      npc.relation = L.relationOf(npc);
      if (eff) mergeFx(report.fx, eff);
      if (adopted && Number(a.p)) report.pDelta += Number(a.p);
      report.lines.push({
        name: npc.name, role: npc.role, stance: stanceText(stance), adopted: adopted,
        text: (adopted ? '听了' + npc.name + '的：' : (a.prefer >= 0 ? '没听' + npc.name + '的：' : '与' + npc.name + '只是聊了聊：')) + a.reason.replace(/[“”]/g, '') + '（亲密度 ' + (dIt >= 0 ? '+' : '') + dIt + '）',
        dIntimacy: dIt
      });
      if (L.SOCIAL && L.SOCIAL.npcImpact) {
        L.SOCIAL.npcImpact(g, npc, adopted ? 'advice-adopt' : 'advice-ignore', (adopted ? '你采纳了' : '你忽略了') + npc.name + '在“' + (ev.title || '') + '”里的意见', ev.id);
      }
    });
    g.adviceLog = g.adviceLog || [];
    g.adviceLog.push({ year: g.year, age: g.age, eventId: ev.id, title: ev.title || '', chosen: chosen, advisors: list.map(function (a) { return { role: a.role, stance: a.stance, prefer: a.prefer }; }), lines: report.lines });
    if (g.adviceLog.length > 160) g.adviceLog.shift();
    report.pDelta = L.clamp(report.pDelta, -0.1, 0.12);
    return report;
  };
  function mergeFx(dst, src) {
    if (!src) return;
    if (src.at) { dst.at = dst.at || {}; for (var k in src.at) dst.at[k] = (dst.at[k] || 0) + src.at[k]; }
    if (src.money) { dst.money = dst.money || {}; dst.money.cash = (dst.money.cash || 0) + (src.money.cash || 0); }
    if (src.reputation) dst.reputation = (dst.reputation || 0) + src.reputation;
    if (src.npc) { dst.npc = dst.npc || {}; for (var r in src.npc) { dst.npc[r] = dst.npc[r] || {}; for (var f in src.npc[r]) dst.npc[r][f] = (dst.npc[r][f] || 0) + src.npc[r][f]; } }
  }

  /* ===================== 2. NPC 事件（8 人 × 跨阶段 × 13 场景 = 520） ===================== */
  var CAST = [
    { role: '父亲', key: 'father', nature: 'family', stages: ['婴幼儿', '童年', '少年', '青年', '中年', '中老年', '晚年'] },
    { role: '母亲', key: 'mother', nature: 'family', stages: ['婴幼儿', '童年', '少年', '青年', '中年', '中老年', '晚年'] },
    { role: '发小', key: 'buddy', nature: 'friend', stages: ['童年', '少年', '青年', '中年', '中老年', '晚年'] },
    { role: '同学', key: 'classmate', nature: 'friend', stages: ['童年', '少年', '青年', '中年', '中老年', '晚年'] },
    { role: '同事', key: 'coworker', nature: 'interest', stages: ['青年', '中年', '中老年'] },
    { role: '上司', key: 'boss', nature: 'interest', stages: ['青年', '中年', '中老年'] },
    { role: '配偶', key: 'spouse', nature: 'love', stages: ['青年', '中年', '中老年', '晚年'] },
    { role: '子女', key: 'child', nature: 'family', stages: ['中年', '中老年', '晚年'] }
  ];
  var STAGE_KEY = { '婴幼儿': 'inf', '童年': 'chd', '少年': 'ten', '青年': 'you', '中年': 'mid', '中老年': 'eld', '晚年': 'lat' };
  var FLAVOR = {
    '婴幼儿': '那时你还小，', '童年': '放学后，', '少年': '课业正紧的时候，', '青年': '刚踏入社会那几年，',
    '中年': '日子被工作和家庭填满，', '中老年': '身体开始提醒你慢一点，', '晚年': '时间变得很宽，'
  };
  var SCENES = [
    { key: 'visit', tier: 'daily', title: '{{npc}}来串门', text: '{{npc}}拎着一点东西上门，坐下后却没有急着说事。' },
    { key: 'meal', tier: 'daily', title: '和{{npc}}吃顿饭', text: '小馆子里人声嘈杂，{{npc}}把菜单推到你面前。' },
    { key: 'askhelp', tier: 'cross', title: '{{npc}}开口求你', text: '{{npc}}绕了半天，终于说出现在手头紧，想请你搭把手。' },
    { key: 'goodnews', tier: 'echo', title: '{{npc}}带来好消息', text: '{{npc}}的语气轻快，说最近终于有件顺心的事。' },
    { key: 'sickness', tier: 'echo', title: '{{npc}}病了一场', text: '电话那头声音很虚，{{npc}}说已经在家躺了几天。' },
    { key: 'jobloss', tier: 'echo', title: '{{npc}}丢了工作', text: '{{npc}}把工牌放在桌上，说不用再去那个地方了。' },
    { key: 'quarrel', tier: 'cross', title: '和{{npc}}起了争执', text: '一句话没说对，{{npc}}的脸色沉了下来，气氛僵在原地。' },
    { key: 'reunion', tier: 'echo', title: '与{{npc}}重逢', text: '隔了很多年再见，{{npc}}先认出了你，叫了一声你的名字。' },
    { key: 'refer', tier: 'cross', title: '{{npc}}递来一个机会', text: '{{npc}}说有个位置空出来，问你要不要试试。' },
    { key: 'family', tier: 'echo', title: '{{npc}}家里的难处', text: '{{npc}}家里出了点事，话说得很轻，却压得人喘不过气。' },
    { key: 'trip', tier: 'daily', title: '和{{npc}}出趟门', text: '临时起意的一趟短途，{{npc}}在车站等你。' },
    { key: 'startup', tier: 'cross', title: '{{npc}}想拉你入伙', text: '{{npc}}拿出一份写满字的计划，说缺一个信得过的人。' },
    { key: 'farewell', tier: 'echo', title: '{{npc}}要走了', text: '{{npc}}说这次可能很久不回来，约你见最后一面。' }
  ];
  var NATURE_OPTS = {
    family: [
      ['耐心听他说完', '', '', [[78, '说开了', '你把话听完，也把自己的难处讲了。', { at: { happiness: 2 }, npc: { intimacy: 5 } }], [22, '还是没说透', '话到嘴边又咽了回去。', { at: { stress: 2 }, npc: { intimacy: 1 } }]]],
      ['替他分担一些', '', '', [[64, '分担了', '你搭了一把手，事情轻了一点。', { at: { health: -1, happiness: 2 }, money: { cash: -1000 }, npc: { intimacy: 7 }, favor: 1 }], [36, '越帮越乱', '好心没落到点上。', { at: { stress: 3 }, money: { cash: -800 }, npc: { intimacy: -1 } }]]],
      ['说自己最近也忙', '', '', [[55, '他理解', '他点点头，没再说什么。', { npc: { intimacy: -5 } }], [45, '他记下了', '他没接话，之后很久没联系。', { npc: { intimacy: -8, favor: -1 }, at: { happiness: -1 } }]]]
    ],
    friend: [
      ['陪他走一段', '', '', [[72, '走过来了', '你们沿着街走了很久。', { at: { happiness: 3 }, npc: { intimacy: 6 } }], [28, '各有各的心事', '走到路口就散了。', { at: { happiness: 1 }, npc: { intimacy: 2 } }]]],
      ['借他一笔钱', '', '', [[58, '钱到了', '他连声道谢，说很快还。', { at: { stress: 3 }, money: { cash: -2000 }, npc: { intimacy: 8 }, favor: 1, kindness: { role: '发小', kind: 'lend', amount: 2000, text: '你在朋友最难的时候借出一笔钱' } }], [42, '钱打了水漂', '之后他绝口不提。', { at: { happiness: -3 }, money: { cash: -2000 }, npc: { intimacy: -6 }, favor: -1 }]]],
      ['找个理由推掉', '', '', [[60, '他没再问', '你说了句最近不方便。', { npc: { intimacy: -4 } }], [40, '关系淡了', '从那以后联系少了。', { npc: { intimacy: -7 }, at: { happiness: -1 } }]]]
    ],
    interest: [
      ['接下这个机会', '', '', [[66, '接下来了', '你把事情应了下来。', { at: { money: { cash: 3000 }, stress: 3 }, npc: { intimacy: 5 }, favor: 1 }], [34, '没接住', '事情比想象中麻烦。', { at: { stress: 5 }, npc: { intimacy: 1 } }]]],
      ['按规矩办事', '', '', [[74, '公事公办', '你没多说一句。', { at: { stress: -2 } }], [26, '显得生分', '对方的笑意淡了。', { npc: { intimacy: -4 } }]]],
      ['保持距离', '', '', [[58, '没惹麻烦', '你把边界划清了。', { at: { stress: -2 }, npc: { intimacy: -3 } }], [42, '错过一条线', '后来才知道那是个门路。', { at: { happiness: -2 } }]]]
    ],
    love: [
      ['好好谈一次', '', '', [[75, '谈开了', '你们把积着的话说完了。', { at: { happiness: 4 }, npc: { intimacy: 7 } }], [25, '又吵起来', '说着说着声音高了。', { at: { stress: 4 }, npc: { intimacy: -4 } }]]],
      ['各自冷静几天', '', '', [[62, '缓过来了', '几天后气氛松了。', { at: { stress: -2 }, npc: { intimacy: 2 } }], [38, '冷成了习惯', '谁也没先开口。', { at: { happiness: -3 }, npc: { intimacy: -6 } }]]],
      ['把话留到以后', '', '', [[50, '暂时搁下', '你们都当没发生过。', { at: { stress: 2 }, npc: { intimacy: -2 } }], [50, '积成了结', '这件小事后来反复被提起。', { at: { happiness: -2 }, npc: { intimacy: -5 } }]]]
    ]
  };
  function npcOpt(o) {
    var label = o[0], hint = o[1], res = o[3];
    return O(label, hint, '', res.map(function (r) {
      var f = r[3] || {};
      /* 把泛化的 npc.intimacy 落到具体角色 */
      return W(r[0], r[1], r[2], f);
    }));
  }
  function roleOpts(role, nature, sceneKey, g) {
    /* 场景微调：求助/入伙/争执用岔路口吻；其余用关系口吻 */
    var base = NATURE_OPTS[nature] || NATURE_OPTS.friend;
    if (sceneKey === 'askhelp') {
      return [
        O('帮，能帮多少帮多少', '', '', [
          W(64, '帮上了', '{{npc}}松了口气，连说以后一定还。', fx({ happiness: 2, stress: 2 }, -2000, null, { kindness: { role: role, kind: 'lend', amount: 2000, text: '你在{{npc}}最难的时候伸了手' } })),
          W(36, '帮了倒忙', '事情没办成，钱也搭进去了。', fx({ stress: 4, happiness: -2 }, -2000, null, { npc: makeNpcFx(role, -4, -1) }))
        ]),
        O('先问清楚再决定', '', '', [
          W(70, '问明白了', '你听完整件事，心里有了数。', fx({ stress: 1 }, 0, null, { npc: makeNpcFx(role, 3, 0) })),
          W(30, '问出了尴尬', '对方觉得你不信任他。', fx({ happiness: -2 }, 0, null, { npc: makeNpcFx(role, -5, -1) }))
        ]),
        O('这次帮不了', '', '', [
          W(58, '他没说什么', '电话挂得很轻。', fx({ happiness: -1 }, 0, null, { npc: makeNpcFx(role, -6, -1) })),
          W(42, '他记住了', '后来他再没找过你。', fx({ happiness: -2, stress: 2 }, 0, null, { npc: makeNpcFx(role, -9, -2), wrong: { role: role, kind: 'refuse', text: '{{npc}}开口求助时你拒绝了' } }))
        ])
      ];
    }
    if (sceneKey === 'startup') {
      return [
        O('入伙，拿钱也拿时间', '', '', [
          W(52, '做起来了', '生意慢慢有了起色。', fx({ money: 12000, stress: 6, happiness: 3 }, -10000, null, { npc: makeNpcFx(role, 9, 2) })),
          W(48, '赔了', '账上的钱很快见了底。', fx({ money: -10000, stress: 8, happiness: -4 }, -10000, null, { npc: makeNpcFx(role, -5, -1) }))
        ]),
        O('只出主意不出钱', '', '', [
          W(66, '帮上了忙', '你的几条建议真派上用场。', fx({ happiness: 2 }, 0, null, { npc: makeNpcFx(role, 6, 1) })),
          W(34, '被嫌不够意思', '他觉得你不够朋友。', fx({ happiness: -2 }, 0, null, { npc: makeNpcFx(role, -6, -1) }))
        ]),
        O('婉拒', '', '', [
          W(70, '各自安好', '你们还是朋友，只是不再谈生意。', fx({ stress: -1 }, 0, null, { npc: makeNpcFx(role, -2, 0) })),
          W(30, '渐行渐远', '他忙起来，联系就少了。', fx({ happiness: -2 }, 0, null, { npc: makeNpcFx(role, -5, -1) }))
        ])
      ];
    }
    if (sceneKey === 'quarrel') {
      return [
        O('先低头', '', '', [
          W(74, '和好了', '一句软话化开了僵局。', fx({ happiness: 3, stress: -2 }, 0, null, { npc: makeNpcFx(role, 7, 1) })),
          W(26, '对方不领情', '他转身走了。', fx({ stress: 4 }, 0, null, { npc: makeNpcFx(role, -3, 0) }))
        ]),
        O('把道理讲清楚', '', '', [
          W(52, '讲通了', '你们把误会拆开。', fx({ happiness: 1, stress: 2 }, 0, null, { npc: makeNpcFx(role, 3, 0) })),
          W(48, '越讲越僵', '谁都不肯退。', fx({ stress: 5, happiness: -2 }, 0, null, { npc: makeNpcFx(role, -7, -1) }))
        ]),
        O('冷处理', '', '', [
          W(60, '慢慢淡了', '过阵子再见面，客气了许多。', fx({ happiness: -1 }, 0, null, { npc: makeNpcFx(role, -5, 0) })),
          W(40, '结下了', '这件事成了心里的刺。', fx({ stress: 3, happiness: -3 }, 0, null, { npc: makeNpcFx(role, -10, -2), wrong: { role: role, kind: 'cold', text: '{{npc}}与你的争执被冷处理' } }))
        ])
      ];
    }
    return base.map(function (o) { return npcOpt(o); });
  }
  function makeNpcFx(role, intimacy, favor) {
    var m = {}; m[role] = { intimacy: intimacy, favor: favor }; return m;
  }
  /* 为每条 NPC 事件补上角色键 */
  CAST.forEach(function (c) {
    c.stages.forEach(function (stage) {
      SCENES.forEach(function (sc) {
        var id = 'v35_npc_' + c.key + '_' + STAGE_KEY[stage] + '_' + sc.key;
        var title = sc.title.replace(/\{\{npc\}\}/g, c.role);
        var text = (FLAVOR[stage] || '') + sc.text.replace(/\{\{npc\}\}/g, c.role);
        var opts = roleOpts(c.role, c.nature, sc.key);
        /* 每条选项补上“在场 NPC”的亲密度变化（若模板没有显式 npc） */
        L.EVENTS.push({
          id: id, type: 'random', stage: stage, tier: sc.tier === 'cross' ? 'crossroad' : (sc.tier === 'echo' ? 'echo' : 'daily'),
          weight: sc.tier === 'cross' ? 0.9 : 1.0, family: id, npcRole: c.role, npcEvent: true,
          title: title, text: text, opts: opts,
          cond: function (g) { return L.npcAlive(g, c.role); }
        });
      });
    });
  });

  /* ===================== 3. 60 条多节点链（3 节点 + 2 尾巴 = 300） ===================== */
  var CHAINS = [
    { key: 'startup', stage: '青年', name: '创业', nodes: [
      ['一个念头', '你反复想着那个还没成形的生意，夜里翻来覆去。', '要不要试试？', '先做起来', '再等等'],
      ['第一笔投入', '账上少了五万，你盯着回款表看了很久。', '钱花在了哪儿？', '继续投', '立刻止损'],
      ['生死线', '这个月如果还签不下客户，现金流就断了。', '桌上的电话一直没响。', '再撑一个月', '关门止损']
    ]},
    { key: 'illness', stage: '中年', name: '重病', nodes: [
      ['体检异常', '报告单上有个指标被圈了红笔。', '医生让你进一步复查。', '去复查', '先拖着'],
      ['复查结果', '走廊尽头的灯很白，医生把片子推过来。', '需要做进一步检查。', '安排手术', '保守治疗'],
      ['手术之后', '麻醉退去，你在病床上听见窗外的雨。', '恢复期还很长。', '按医嘱康复', '急着回去上班']
    ]},
    { key: 'longdist', stage: '青年', name: '异地恋', nodes: [
      ['异地开始', '车站广播响了第三遍，她还没挂电话。', '这段关系要怎么维持？', '每周见一次', '先各自忙'],
      ['第一次争吵', '视频那头很吵，你们都没听清对方在说什么。', '语气先重了起来。', '连夜过去', '冷静几天'],
      ['抉择', '她问你，愿不愿意来她的城市。', '你在窗前站了很久。', '搬过去', '分手']
    ]},
    { key: 'civil', stage: '青年', name: '考公', nodes: [
      ['决定备考', '书摊上那摞资料很厚，你翻到第一页。', '备考要占掉一整年。', '全力备考', '边工作边考'],
      ['笔试', '考场外的梧桐叶落了一地。', '铃声响起前，你手心全是汗。', '稳住答题', '越写越慌'],
      ['面试', '候考室里每个人都在小声背稿。', '轮到你了。', '如实作答', '按模板讲']
    ]},
    { key: 'house', stage: '青年', name: '买房', nodes: [
      ['看房', '售楼处的沙盘亮着灯，销售说这是最后两套。', '首付要掏空家底。', '定下来', '再看看'],
      ['凑首付', '双方父母的电话都打过了，还差一截。', '你算了三遍账。', '借一点', '降低预算'],
      ['交房', '钥匙在手里有点凉，屋里还是水泥地。', '装修又是一笔钱。', '简单装', '慢慢攒']
    ]},
    { key: 'postgrad', stage: '青年', name: '考研', nodes: [
      ['要不要考', '同学都在投简历，你还在自习室。', '再读三年值不值？', '报名', '先工作'],
      ['备考后期', '凌晨的自习室只剩两盏灯。', '模拟分还是不稳。', '咬牙冲刺', '调整目标'],
      ['复试', '导师的问题比想象中尖锐。', '你握着笔，指尖发凉。', '坦诚回答', '硬着头皮编']
    ]},
    { key: 'jump', stage: '中年', name: '跳槽', nodes: [
      ['猎头来电', '对方报出的数字比现在高不少。', '但要去另一座城市。', '去见一面', '直接回绝'],
      ['面试', '玻璃幕墙的会议室里，三个人轮流提问。', '你讲完了自己的项目。', '谈条件', '先答应'],
      ['离职', '老东家的门禁卡还在口袋里。', '上司说再考虑考虑。', '体面告别', '闹得不欢而散']
    ]},
    { key: 'parentcare', stage: '中年', name: '照顾父母', nodes: [
      ['一次摔倒', '母亲的膝盖磕在楼梯口，缝了几针。', '医生说要有人长期照看。', '接来同住', '请护工'],
      ['照护日常', '药盒按星期分好，还是常常记混。', '你开始在夜里惊醒。', '排班照护', '送去机构'],
      ['最后一段', '父亲开始记不清你的名字。', '你坐在床边，握着他的手。', '陪着', '请人陪']
    ]},
    { key: 'debt', stage: '中年', name: '债务', nodes: [
      ['一笔借款', '朋友说周转两个月就还，你签了担保。', '后来他失联了。', '先替他还', '去找人'],
      ['债主上门', '门口站着两个陌生人，语气不算客气。', '他们说下周是最后期限。', '卖车', '再借一笔'],
      ['还清', '最后一笔转出去，你盯着余额看了很久。', '家里安静得出奇。', '从头再来', '先歇一阵']
    ]},
    { key: 'abroad', stage: '青年', name: '出国', nodes: [
      ['一个名额', '导师把推荐表放在你桌上。', '截止日期就在下周。', '申请', '放弃'],
      ['签证与行李', '行李箱摊在床上，装不满也合不上。', '母亲在门口看着你。', '走', '留下'],
      ['异乡第一年', '超市的标签全是陌生文字。', '夜里你给家里打了电话。', '撑下去', '买票回国']
    ]},
    { key: 'partner', stage: '中年', name: '合伙', nodes: [
      ['合伙提议', '老同事说，一起出来做点事。', '他出资源，你出人。', '答应', '再想想'],
      ['第一次分歧', '账目上有一笔说不清的开支。', '他说是应酬。', '查清楚', '睁只眼闭只眼'],
      ['散伙', '会议室的钥匙被放在桌上。', '谁也没先提分钱的事。', '按合同分', '净身退出']
    ]},
    { key: 'childedu', stage: '中年', name: '子女教育', nodes: [
      ['择校', '两所学校的招生简章摊在餐桌上。', '一所近，一所好。', '选好的', '选近的'],
      ['成绩下滑', '班主任的电话在周五晚上打来。', '孩子把房门关上了。', '坐下来谈', '先加压'],
      ['升学', '志愿表只有一张。', '孩子看着你，等你点头。', '尊重他', '按你的来']
    ]}
  ];
  var CHAIN_FLAVOR = ['第一次', '第二次', '这一年', '后来', '很多年后'];
  var TAIL_TEXTS = {
    a: ['中途转了弯', '你在半路改了主意，事情没有按原计划走。'],
    b: ['另一条路', '你选择了另一条路，原来的计划停在原地。']
  };
  CHAINS.forEach(function (ch, ci) {
    for (var v = 1; v <= 5; v++) {
      var base = 'v35_ch_' + ch.key + v;
      var pref = CHAIN_FLAVOR[(ci + v) % CHAIN_FLAVOR.length];
      ch.nodes.forEach(function (node, ni) {
        var nid = base + '_' + (ni + 1);
        var isLast = ni === ch.nodes.length - 1;
        var nextId = isLast ? null : base + '_' + (ni + 2);
        var opts = [
          O(node[3], '', '', [
            W(58, '往前走了', '你做了决定，事情继续往下走。', fx({ stress: 3, happiness: 1 }, -1000, null, isLast ? {} : { flag: [{ event: nextId, delay: 1 + (ni % 3) }] }))
          ]),
          O(node[4], '', '', [
            W(100, '停在原地', '你把手从门把上收了回来。', fx({ stress: -2 }, 0, null, isLast ? {} : { flag: [{ event: base + (ni === 0 ? '_a' : '_b'), delay: 2 + ni }] }))
          ])
        ];
        L.EVENTS.push({
          id: nid, type: 'random', stage: ch.stage, tier: 'crossroad',
          weight: 0.7, family: base, chainKey: ch.key, chainStep: ni + 1, chainOf: 3,
          title: pref + '·' + node[0], text: node[1] + ' ' + node[2], opts: opts
        });
      });
      ['a', 'b'].forEach(function (t) {
        L.EVENTS.push({
          id: base + '_' + t, type: 'random', stage: ch.stage, tier: 'echo',
          weight: 0.6, family: base + '_tail', chainKey: ch.key, chainTail: true,
          title: TAIL_TEXTS[t][0], text: TAIL_TEXTS[t][1],
          opts: [O('把日子过下去', '', '', [
            W(100, '继续生活', '这件事慢慢变成了过去。', fx({ happiness: -1 }, 0, null, {}))
          ])]
        });
      });
    }
  });

  /* ===================== 4. 日常填充（100 条） ===================== */
  var DAILY = [
    ['窗台上的光', '光挪过窗台，你忽然想起很久以前的事。'],
    ['楼下的早餐摊', '豆浆的热气在冬天里升得很慢。'],
    ['一阵旧歌', '收音机里放着一首你差点忘掉的歌。'],
    ['加班的夜', '办公室只剩你这一排灯还亮着。'],
    ['菜市场的早晨', '摊主把青菜码得整整齐齐。'],
    ['雨天的公交', '车窗上全是雾，你用手背擦出一小块。'],
    ['旧衣服', '衣柜底那件衣服还留着，扣子掉了一颗。'],
    ['一次体检预约', '手机里躺着一条没处理的提醒。'],
    ['邻居的狗', '那隻狗隔着栏杆看了你一会儿。'],
    ['一个人的晚饭', '碗筷摆好，又觉得少了什么。'],
    ['月末的账单', '你对着几张单子算了一遍。'],
    ['公园的长椅', '有人在下棋，有人在打盹。'],
    ['手机里的旧照片', '照片里的人都比现在年轻。'],
    ['夜里醒来', '天花板很安静，你听见自己的呼吸。']
  ];
  ['婴幼儿', '童年', '少年', '青年', '中年', '中老年', '晚年'].forEach(function (stage, si) {
    DAILY.forEach(function (d, i) {
      if ((si * 14 + i) % 3 === 2 && i > 11) return; /* 保留 100 条总量 */
      var id = 'v35_d_' + STAGE_KEY[stage] + '_' + (i + 1);
      L.EVENTS.push({
        id: id, type: 'random', stage: stage, tier: 'daily', weight: 1.1, family: id,
        title: d[0], text: (FLAVOR[stage] || '') + d[1],
        opts: [O('把这一天过完', '', '', [
          W(100, '日子继续', '没有什么特别的事发生。', fx({ happiness: 1 }, 0, null, {}))
        ])]
      });
    });
  });

  /* ===================== 5. 可复现因果链（善缘 / 报复） ===================== */
  L.EVENTS.push({
    id: 'v35_causal_lend', type: 'random', stage: '中年', tier: 'crossroad', weight: 0.55,
    family: 'v35_causal_lend', title: '发小开口借两万', priority: 60,
    text: '发小坐在你对面，手指一直摩挲着杯沿。他说只差两万，撑过这个月就能翻身。',
    cond: function (g) { return L.npcAlive(g, '发小') && (Number(g.money.cash) >= 20000); },
    opts: [
      O('借给他，不催', '', '', [
        W(100, '钱转了过去', '他连说了三声谢谢，说十年之内一定还你。', fx({ stress: 2, happiness: 1 }, -20000, null, {
          npc: { '发小': { intimacy: 12, favor: 3 } },
          kindness: { role: '发小', kind: 'lend', amount: 20000, text: '你借给发小两万块，没催过', forcedEvent: 'v35_causal_repay', forcedDelay: 10 }
        }))
      ]),
      O('不借，把话说清', '', '', [
        W(100, '他沉默了很久', '他说知道了，起身时椅子腿在地上刮出一声。', fx({ stress: 2, happiness: -2 }, 0, null, {
          npc: { '发小': { intimacy: -12, favor: -3 } },
          wrong: { role: '发小', kind: 'refuse', text: '发小借钱时你拒绝了', forcedEvent: 'v35_causal_revenge', forcedDelay: 8 }
        }))
      ])
    ]
  });
  L.EVENTS.push({
    id: 'v35_causal_repay', type: 'random', stage: '中年', tier: 'echo', weight: 0.4,
    family: 'v35_causal_repay', title: '十年后，发小回来了', kind: 'payoff',
    text: '发小把一张卡推过来，说当年那两万，他一直记着。',
    cond: function (g) { return L.npcAlive(g, '发小'); },
    opts: [O('收下', '', '', [
      W(100, '连本带利', '卡里有二十万。他说，没有那两万就没有今天。', fx({ money: 200000, happiness: 8, stress: -4 }, 0, null, { npc: { '发小': { intimacy: 15, favor: 4 } } }))
    ])]
  });
  L.EVENTS.push({
    id: 'v35_causal_revenge', type: 'random', stage: '中年', tier: 'echo', weight: 0.4,
    family: 'v35_causal_revenge', title: '背后使坏的人', kind: 'revenge',
    text: '面试最后一轮，HR 委婉地说，有人提过你“不太讲义气”。',
    opts: [O('咽下这口气', '', '', [
      W(100, '机会没了', '你走出写字楼，风把领带吹得歪了。', fx({ money: -5000, stress: 10, happiness: -6 }, 0, null, { npc: { '发小': { intimacy: -8, favor: -2 } } }))
    ])]
  });

  /* 让强制因果链精确到期：扩展 dueKindness / dueRevenge */
  var _dueK = L.SOCIAL.dueKindness;
  var _dueR = L.SOCIAL.dueRevenge;
  L.SOCIAL.dueKindness = function (g) {
    var out = [];
    (g.kindnessLog || []).forEach(function (rec) {
      if (rec.resolved || !rec.forcedEvent) return;
      if (g.year >= rec.year + (rec.forcedDelay || 10)) out.push(rec);
    });
    return out.length ? out : _dueK(g);
  };
  L.SOCIAL.dueRevenge = function (g) {
    var out = [];
    (g.revengeLog || []).forEach(function (rec) {
      if (rec.resolved || !rec.forcedEvent) return;
      if (g.year >= rec.year + (rec.forcedDelay || 8)) out.push(rec);
    });
    return out.length ? out : _dueR(g);
  };
  /* kindness/wrong 记录上保存 forced 字段 */
  var _kind = L.SOCIAL.kindness, _wrong = L.SOCIAL.wrong;
  L.SOCIAL.kindness = function (g, npc, kind, text, opt) {
    var rec = _kind(g, npc, kind, text, opt);
    if (rec && opt) { rec.forcedEvent = opt.forcedEvent || ''; rec.forcedDelay = opt.forcedDelay || 0; }
    return rec;
  };
  L.SOCIAL.wrong = function (g, npc, kind, text, opt) {
    var rec = _wrong(g, npc, kind, text, opt);
    if (rec && opt) { rec.forcedEvent = opt.forcedEvent || ''; rec.forcedDelay = opt.forcedDelay || 0; }
    return rec;
  };

  L.V35 = { chains: 60, npc: 520, advisors: 40, totalAdded: L.EVENTS.length };
})();
