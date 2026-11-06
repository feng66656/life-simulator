/* =========================================================
   v3.7 P3 — 回合结构（中年上下半年）
   只向 window.LS 挂载 LS.V37，不改事件库本体。
   ES5 IIFE。
   ========================================================= */
(function () {
  'use strict';
  var LS = window.LS;
  var V = LS.V37 = {};

  var MID_FROM = 31;
  var MID_TO = 55;

  V.MID_FROM = MID_FROM;
  V.MID_TO = MID_TO;

  function num(n) {
    n = Number(n);
    return isFinite(n) ? n : 0;
  }

  V.isDouble = function (age) {
    age = num(age);
    return age >= MID_FROM && age <= MID_TO;
  };

  V.halfOf = function (g) {
    return (g && g.half === 'H2') ? 'H2' : 'H1';
  };

  V.halfLabel = function (g) {
    if (!g || !V.isDouble(g.age)) return '全年';
    return V.halfOf(g) === 'H2' ? '下半年' : '上半年';
  };

  V.badgeText = function (g) {
    if (!g || !V.isDouble(g.age)) return '';
    return '中年 · ' + Math.round(num(g.age)) + ' 岁';
  };

  /* ---- 主题分类：用来做 H1/H2 权重，不改事件本体 ---- */
  var H1_G = /工作|加班|公司|老板|升职|裁员|同事|上司|创业|项目|客户|合同|签约|面试|跳槽|出差|生意|行业|事业|社会|人脉|生意|工资|薪资|奖金|分红|投资|理财|存款|房贷|负债|招人|副业|谈判|赛道|风口|订单|绩效|考核|竞聘|合伙|办公室|工厂|客户|市场/g;
  var H2_G = /父亲|母亲|父母|爸爸|妈妈|孩子|儿子|女儿|家庭|家人|亲戚|哥哥|姐姐|弟弟|妹妹|伴侣|妻子|丈夫|老婆|老公|恋人|恋爱|结婚|婚姻|体检|医院|医生|身体|健康|病|住院|手术|吃药|康复|锻炼|运动|睡眠|情绪|孤独|陪伴|照看|照顾|接送|家长会|亲情|朋友|邻里|关系|生日|团圆|晚饭/g;

  var H1_CATS = { work: 1, money: 1, study: 1, risk: 1, travel: 1, art: 1 };
  var H2_CATS = { family: 1, love: 1, health: 1, sports: 1, gift: 1, grief: 1 };

  function fullText(e) {
    if (!e) return '';
    var s = (e.title || '') + ' ' + String(e.text || '').slice(0, 160);
    var os = e.opts || [], i;
    for (i = 0; i < os.length; i++) s += ' ' + (os[i].label || '') + ' ' + (os[i].hint || '');
    return s;
  }

  V.sideOf = function (e) {
    if (!e) return 'neutral';
    var s = fullText(e);
    var m1 = s.match(H1_G);
    var m2 = s.match(H2_G);
    var c1 = m1 ? m1.length : 0;
    var c2 = m2 ? m2.length : 0;
    if (c1 > c2) return 'work';
    if (c2 > c1) return 'home';
    var cat = LS.iconCatOf ? LS.iconCatOf(e) : '';
    if (H1_CATS[cat]) return 'work';
    if (H2_CATS[cat]) return 'home';
    return 'neutral';
  };

  /* 中年：偏向主题 ×1.6（≥1.5 倍），另一侧 ×0.6（绝不归零） */
  V.weightOf = function (g, e) {
    if (!g || !V.isDouble(g.age)) return 1;
    var side = V.sideOf(e);
    if (side === 'neutral') return 1;
    if (V.halfOf(g) === 'H2') return side === 'home' ? 1.6 : 0.6;
    return side === 'work' ? 1.6 : 0.6;
  };

  /* ---- 年度快照：年终小结只比这一年 ---- */
  V.snapYear = function (g) {
    var npcs = {};
    (g && g.npcs || []).forEach(function (n) {
      if (!n || !n.id) return;
      npcs[n.id] = {
        intimacy: num(n.intimacy),
        name: n.name || n.role || '',
        role: n.role || ''
      };
    });
    var m = (g && g.money) || {};
    return {
      year: g ? g.year : 0,
      cash: num(m.cash),
      net: num(m.cash) + num(m.assets) - num(m.debt),
      health: num(g && g.attrs && g.attrs.health),
      npcs: npcs
    };
  };

  /* ---- H1 年度账本：只记中年上半年的明显代价/收益 ---- */
  function moneyText(d) {
    return '现金 ' + (d > 0 ? '+' : '') + LS.fmtMoney(d);
  }

  function itemText(it) {
    if (!it) return '';
    if (it.kind === 'health') {
      return '健康 ' + (it.delta > 0 ? '+' : '') + Math.round(it.delta);
    }
    if (it.kind === 'money') {
      return moneyText(it.delta);
    }
    if (it.kind === 'relation') {
      return '与' + (it.name || '一段关系') + (it.role ? '（' + it.role + '）' : '') +
        '亲密度 ' + (it.delta > 0 ? '+' : '') + Math.round(it.delta);
    }
    return it.text || '';
  }
  V.itemText = itemText;

  function fxItems(fx) {
    var out = [];
    if (!fx) return out;
    if (fx.at && num(fx.at.health) <= -2) {
      out.push({ kind: 'health', delta: num(fx.at.health), declared: true });
    }
    if (fx.money && Math.abs(num(fx.money.cash)) >= 2000) {
      out.push({ kind: 'money', delta: num(fx.money.cash), declared: true });
    }
    if (fx.npc) {
      for (var role in fx.npc) {
        var spec = fx.npc[role] || {};
        var d = num(spec.intimacy);
        if (d <= -2) {
          out.push({ kind: 'relation', delta: d, name: role, role: '', declared: true });
        }
      }
    }
    return out;
  }

  V.onChoice = function (g, ev, opt, before) {
    if (!g || !ev || !opt || !before) return null;
    if (!V.isDouble(g.age) || V.halfOf(g) !== 'H1') return null;

    var items = [];
    var dh = num(g.attrs && g.attrs.health) - num(before.health);
    var dc = num(g.money && g.money.cash) - num(before.cash);

    if (dh <= -2) {
      items.push({ kind: 'health', delta: dh });
    }
    if (Math.abs(dc) >= 2000) {
      items.push({ kind: 'money', delta: dc });
    }

    var rel = null, i;
    var old = before.intimacy || {};
    var list = g.npcs || [];
    for (i = 0; i < list.length; i++) {
      var n = list[i];
      if (!n || !n.id || old[n.id] === undefined) continue;
      var rd = num(n.intimacy) - num(old[n.id]);
      if (rd <= -2 && (!rel || rd < rel.delta)) {
        rel = { kind: 'relation', delta: rd, name: n.name || n.role || '', role: n.role || '' };
      }
    }
    if (rel) items.push(rel);

    if (!items.length) {
      var ex = fxItems(opt.fx);
      for (i = 0; i < ex.length; i++) items.push(ex[i]);
    }
    if (!items.length) return null;

    var cost = [];
    for (i = 0; i < items.length; i++) cost.push(itemText(items[i]));

    var entry = {
      year: g.year,
      age: g.age,
      half: 'H1',
      turn: g.turn,
      label: opt.label || '一个选择',
      eventTitle: ev.title || '',
      items: items,
      cost: cost.join('；'),
      choiceId: (ev.id || 'ev') + '@' + g.age + '#' + g.turn
    };
    entry.text = V.consequenceText(entry);

    g.halfLedger = g.halfLedger || [];
    g.halfLedger.push(entry);
    if (g.halfLedger.length > 12) g.halfLedger = g.halfLedger.slice(-12);
    return entry;
  };

  V.ledgerForYear = function (g) {
    var list = (g && g.halfLedger) || [];
    var hit = null;
    for (var i = list.length - 1; i >= 0; i--) {
      if (!list[i]) continue;
      if (Number(list[i].year) === Number(g.year) && list[i].half === 'H1') { hit = list[i]; break; }
    }
    return hit;
  };

  V.clearLedger = function (g) {
    if (!g) return;
    g.halfLedger = [];
    g.pendingConsequence = null;
  };

  /* 后果卡正文：必须同时出现「年份 + 当时的选择 + 具体后果」 */
  V.consequenceText = function (entry) {
    if (!entry) return '';
    var items = entry.items || [];
    var detail = [], i;
    for (i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.kind === 'health') {
        detail.push('健康少了 ' + Math.abs(Math.round(it.delta)) + ' 点，下半年体检报告上多了两项箭头');
      } else if (it.kind === 'money') {
        if (it.delta < 0) {
          detail.push('现金少了 ' + LS.fmtMoney(Math.abs(it.delta)) + '，下半年账面上的余量先紧了一截');
        } else {
          detail.push('账上多了 ' + LS.fmtMoney(it.delta) + '，下半年手头松了些，但这份收益也是拿时间和身体换的');
        }
      } else if (it.kind === 'relation') {
        detail.push('和' + (it.name || '对方') + '的亲密度降了 ' + Math.abs(Math.round(it.delta)) +
          ' 点，下半年你们的话明显少了');
      }
    }
    var head = String(entry.year) + ' 年上半年，你选择了「' + (entry.label || '一个选择') + '」' +
      (entry.eventTitle ? '（' + entry.eventTitle + '）' : '') + '。';
    var tail = detail.length ? detail[0] : ('这笔账落在了' + (entry.cost || '当年'));
    if (detail.length > 1) tail += '；另外，' + detail.slice(1).join('；') + '。';
    else tail += '。';
    return head + tail;
  };

  V.consequenceOf = function (g, entry) {
    if (!entry) return null;
    var card = {
      type: 'forced',
      year: entry.year,
      age: entry.age,
      label: entry.label,
      eventTitle: entry.eventTitle,
      cost: entry.cost,
      items: entry.items || [],
      title: String(entry.year) + ' 年 · 上半年选择的后果',
      text: entry.text || V.consequenceText(entry)
    };
    if (g) {
      g.consequenceLog = g.consequenceLog || [];
      var last = g.consequenceLog[g.consequenceLog.length - 1];
      if (!last || Number(last.year) !== Number(entry.year)) {
        g.consequenceLog.push({
          year: entry.year, age: entry.age, half: 'H2', turn: g.turn,
          label: entry.label, eventTitle: entry.eventTitle,
          cost: entry.cost, text: card.text
        });
      }
    }
    return card;
  };

  /* ---- 年终小结：钱 / 健康 / 一段关系，每年一张 ---- */
  function relOf(g, snap) {
    var best = null, i;
    var list = g.npcs || [];
    for (i = 0; i < list.length; i++) {
      var n = list[i];
      var old = snap && snap.npcs && snap.npcs[n.id];
      if (!old) continue;
      var d = Math.round(num(n.intimacy) - num(old.intimacy));
      if (!best || Math.abs(d) > Math.abs(best.delta)) {
        best = { name: n.name || n.role || '', role: n.role || '', delta: d, after: Math.round(num(n.intimacy)) };
      }
    }
    if (!best && list.length) {
      var n0 = list[0];
      best = { name: n0.name || n0.role || '', role: n0.role || '', delta: 0, after: Math.round(num(n0.intimacy)) };
    }
    return best;
  }

  V.buildYearSummary = function (g) {
    if (!g) return null;
    var snap = g.yearStartSnap;
    if (!snap || Number(snap.year) !== Number(g.year)) snap = V.snapYear(g);

    var m = g.money || {};
    var cashD = Math.round(num(m.cash) - num(snap.cash));
    var netD = Math.round(num(m.cash) + num(m.assets) - num(m.debt) - num(snap.net));
    var useNet = Math.abs(netD) > Math.abs(cashD) + 1;
    var healthD = Math.round(num(g.attrs && g.attrs.health) - num(snap.health));
    var rel = relOf(g, snap);

    var items = [
      {
        kind: 'money',
        label: useNet ? '净资产' : '现金',
        delta: useNet ? netD : cashD,
        text: (useNet ? '净资产' : '现金') +
          ((useNet ? netD : cashD) === 0 ? '基本没动' :
            (' ' + ((useNet ? netD : cashD) > 0 ? '+' : '') + LS.fmtMoney(useNet ? netD : cashD)))
      },
      {
        kind: 'health',
        label: '健康',
        delta: healthD,
        text: '健康' + (healthD === 0 ? '基本持平' : (' ' + (healthD > 0 ? '+' : '') + healthD))
      },
      {
        kind: 'relation',
        label: rel ? ('与' + rel.name) : '关系',
        delta: rel ? rel.delta : 0,
        text: rel
          ? ('与' + (rel.name || '身边人') + ' ' + (rel.delta > 0 ? '+' : '') + rel.delta +
             (rel.delta === 0 ? '（没什么起落）' : ''))
          : '身边还没有可记的关系'
      }
    ];

    var out = {
      year: g.year,
      atAge: g.age,
      half: 'H2',
      title: String(g.year) + ' 年 · 年终小结',
      items: items,
      turn: g.turn
    };
    g.yearSummaryLog = g.yearSummaryLog || [];
    var last = g.yearSummaryLog[g.yearSummaryLog.length - 1];
    if (last && Number(last.year) === Number(g.year)) {
      g.yearSummaryLog[g.yearSummaryLog.length - 1] = out;
    } else {
      g.yearSummaryLog.push(out);
    }
    return out;
  };

  /* ================= v3.7 P4：四个分流点 ================= */
  var fkOpt = function (label, hint, fx, meta) {
    fx = fx || {};
    var o = { label: label, hint: hint, fx: fx, tone: 'mid' };
    /* fx.fork 写成内联便于静态扫描；运行时把路径登记信息提到选项层 */
    if (fx.fork) o.fork = fx.fork;
    if (fx.cond) o.cond = fx.cond;
    if (meta && meta.cond) o.cond = meta.cond;
    return o;
  };
  var track15 = function (g) {
    if (g.marks.fork15_voc) return 'voc';
    if (g.marks.fork15_dropout) return 'dropout';
    if (g.marks.fork15_repeat) return 'repeat';
    return 'academic';
  };
  var track18 = function (g) {
    if (g.marks.fork18_voc) return 'voc';
    if (g.marks.fork18_dropout) return 'dropout';
    if (g.marks.fork18_work || g.marks.fork18_army || g.marks.fork18_apprentice) return 'work';
    return 'academic';
  };
  var fkEvent = function (id, age, title, text, opts) {
    var ev = {
      id: id, type: 'forced', stage: LS.stageOf(age), age: age,
      ageMin: age, ageMax: age, prio: 130, weight: 1, tier: 'crossroad',
      title: title, text: text, opts: opts, tags: ['v37', 'fork'],
      layer: 'v37_fork', family: 'v37_fork'
    };
    LS.EVENTS.push(ev);
    LS.EVENT_INDEX[ev.id] = ev;
    return ev;
  };

  /* 15 岁：中考 */
  fkEvent('v37_fork_zhongkao', 15, '中考分流',
    '中考成绩单压在桌上，县里的高中、职校、中专各自来人宣讲。继续读书要交学费，早点学门手艺能少花两年；复读要再赌一年，辍学则要马上找活干。这一步选哪条路，后面十八岁、二十二岁的路都会跟着变。',
    [
      fkOpt('重点高中（理科方向）', '择校与补课约 2 万元，三年高压，健康 -2；上限高，但高考仍是唯一出口。',
        { edu: 3, money: { cash: -20000 }, at: { stress: 5, health: -2, knowledge: 2 }, set: { highschool: true, science: true, fork15_academic: true, fork15_key: true }, tag: '中考进了重点高中' }),
      fkOpt('普通高中，稳稳读完', '学费与生活费约 1.2 万元，三年时间；平台稳定，但名校与热门专业的上限有限。',
        { edu: 3, money: { cash: -12000 }, at: { stress: 3, knowledge: 1 }, set: { highschool: true, fork15_academic: true, fork15_normal: true }, tag: '中考进了普通高中' }),
      fkOpt('私立高中，花钱换环境', '学费与住宿约 3 万元，家里现金流吃紧；关系上欠一次人情，上限仍取决于高考分数。',
        { edu: 3, money: { cash: -30000 }, at: { stress: 4, happiness: -2 }, set: { highschool: true, fork15_academic: true, fork15_private: true }, tag: '中考花钱进了私立高中' }),
      fkOpt('职校（机电/数控）', '三年学费约 1.5 万元，实训伤手伤腰，健康 -3；早入行但学历天花板较低。',
        { edu: 3, money: { cash: -15000 }, at: { health: -3, finance: 1 }, set: { vocational: true, fork15_voc: true, fork15_tech: true }, tag: '中考后读职校机电' }),
      fkOpt('职校（烹饪）', '三年学费约 1.2 万元，长期站灶台，健康 -2、体重与作息走样；出师快但起薪低。',
        { edu: 3, money: { cash: -12000 }, at: { health: -2, happiness: 1 }, set: { vocational: true, fork15_voc: true, fork15_chef: true }, tag: '中考后读职校烹饪' }),
      fkOpt('中专（护理/文秘）', '三年学费约 1 万元，实习期倒班，健康 -1；就业面窄，继续升学的名额有限。',
        { edu: 3, money: { cash: -10000 }, at: { health: -1, knowledge: 1 }, set: { vocational: true, fork15_voc: true, fork15_mid: true }, tag: '中考后读中专' }),
      fkOpt('辍学打工', '立刻少花学费、当月能挣 5000 元，但学历停在初中，健康 -3、快乐 -4；关系上要靠熟人带路。',
        { edu: 2, money: { cash: 5000 }, at: { health: -3, happiness: -4, finance: 2 }, set: { dropped_out: true, fork15_dropout: true }, tag: '十五岁辍学打工' }),
      fkOpt('复读一年再考', '复读费约 1 万元，晚一年入社会，压力 +8；上限提高，但健康与心态先被消耗。',
        { money: { cash: -10000 }, at: { stress: 8, knowledge: 3, health: -2 }, set: { fork15_repeat: true, fork15_academic: true }, tag: '中考复读一年' })
    ]);

  /* 18 岁：高考 / 分流 */
  fkEvent('v37_fork_gaokao', 18, '十八岁的岔路',
    '十八岁这年，成绩、家境和胆量一起摆上桌面。读本科要再投四年，读高职两年就能上岗；复读、参军、直接就业、跟师傅学徒，各有各的代价。你选的方向会决定二十二岁能往哪走。',
    [
      fkOpt('复读一年再冲本科', '再花 1 万元和一年时间，压力 +8、健康 -2；上限提高，但同龄人已先走一步。',
        { money: { cash: -10000 }, at: { stress: 8, knowledge: 3, health: -2 }, set: { fork18_repeat: true }, tag: '十八岁选择复读' }),
      fkOpt('参军入伍', '至少两年时间，津贴低、自由受限，健康 +2；退伍后考公/辅警有加分，但学业中断。',
        { job: { id: 'soldier' }, at: { health: 2, stress: 3, happiness: -2 }, money: { cash: 3000 }, set: { fork18_army: true }, tag: '十八岁参军入伍' }),
      fkOpt('直接就业（工厂/服务业）', '马上有收入约 3.6 万元/年，但学历停在高中，晋升上限低；加班伤健康 -2。',
        { job: { id: 'gig' }, money: { cash: 3000 }, at: { health: -2, stress: 2 }, set: { fork18_work: true }, tag: '十八岁直接就业' }),
      fkOpt('跟师傅学徒（汽修/水电）', '学徒期两年，月钱只够吃饭，健康 -2；手艺傍身，但入行靠人情、学历上限低。',
        { job: { id: 'mechanic' }, at: { health: -2, knowledge: 1 }, set: { fork18_apprentice: true }, fork: { path: 'mechanic', track: 'apprentice' }, tag: '十八岁跟师傅学徒' }),
      fkOpt('本科·工科', '四年学费与生活费约 6 万元，晚四年挣钱；成绩压力 +4，换来工程师路线的高上限。',
        { edu: 5, money: { cash: -60000 }, at: { stress: 4, knowledge: 3 }, set: { fork18_benke: true, fork18_tech: true }, tag: '十八岁读工科本科' },
        { cond: function (g) { return track15(g) === 'academic' || track15(g) === 'repeat'; } }),
      fkOpt('本科·临床医学', '五年制加规培，学费与生活约 8 万元，健康 -3；周期最长，但医生路径的上限最高。',
        { edu: 5, money: { cash: -80000 }, at: { stress: 5, health: -3, knowledge: 2 }, set: { fork18_benke: true, fork18_doctor: true }, tag: '十八岁读临床医学' },
        { cond: function (g) { return track15(g) === 'academic' || track15(g) === 'repeat'; } }),
      fkOpt('本科·师范', '四年学费约 4 万元，支教与实习占两年，收入起点低；教师编制稳定，但晋升慢。',
        { edu: 5, money: { cash: -40000 }, at: { stress: 2, knowledge: 2, happiness: 2 }, set: { fork18_benke: true, fork18_teacher: true }, tag: '十八岁读师范本科' },
        { cond: function (g) { return track15(g) === 'academic' || track15(g) === 'repeat'; } }),
      fkOpt('高职·烹饪', '两年学费约 2 万元，站灶台伤腰，健康 -3；出师快，起薪低、上升靠手艺。',
        { edu: 4, money: { cash: -20000 }, at: { health: -3, happiness: 1 }, job: { id: 'chef' }, set: { fork18_voc: true }, fork: { path: 'chef', track: 'voc' }, tag: '十八岁读高职烹饪' },
        { cond: function (g) { return track15(g) === 'voc'; } }),
      fkOpt('高职·机电', '两年学费约 1.8 万元，实训有风险，健康 -2；进厂起薪稳，但学历天花板明显。',
        { edu: 4, money: { cash: -18000 }, at: { health: -2, finance: 1 }, job: { id: 'mechanic' }, set: { fork18_voc: true }, fork: { path: 'mechanic', track: 'voc' }, tag: '十八岁读高职机电' },
        { cond: function (g) { return track15(g) === 'voc'; } }),
      fkOpt('混社会', '没有学费，短期来钱快，但健康 -4、声望 -6，法律风险高；上限看似自由，实际很容易沉沦。',
        { edu: 2, money: { cash: 4000 }, at: { health: -4, reputation: -6, stress: 4 }, job: { id: 'gang' }, set: { fork18_dropout: true }, fork: { path: 'gang', track: 'street' }, tag: '十八岁混社会' },
        { cond: function (g) { return track15(g) === 'dropout'; } })
    ]);

  /* 22 岁：大学毕业 / 初入社会 */
  fkEvent('v37_fork_grad', 22, '二十二岁的第一份选择',
    '毕业季，招聘会、考研教室和创业群同时发来消息。考公要脱产备考，进企业要接受加班，创业要押上积蓄；继续读研能抬高上限，但要多花两三年。每一条路都要先付一笔代价。',
    [
      fkOpt('考公务员', '脱产备考一年，资料与生活约 2 万元，录取率低；基层服务期五年，晋升慢但稳定。',
        { money: { cash: -20000 }, at: { stress: 6, knowledge: 2 }, job: { id: 'civil' }, set: { fork22_work: true }, fork: { path: 'civil', track: 'exam' }, tag: '二十二岁考公务员' }),
      fkOpt('公安辅警/协警，争取转正', '两年低薪与体能消耗，健康 -2；转正名额有限，关系与考核都要过关。',
        { at: { health: -2, stress: 4 }, money: { cash: -5000 }, job: { id: 'police' }, set: { fork22_work: true }, fork: { path: 'police', track: 'aux' }, tag: '二十二岁做辅警' }),
      fkOpt('进企业做技术', '校招起薪尚可，但 996、出差与背锅，健康 -3；三十五岁前必须往上走，否则被替代。',
        { at: { health: -3, stress: 5, knowledge: 2 }, job: { id: 'engineer' }, set: { fork22_work: true }, fork: { path: 'engineer', track: 'corp' }, tag: '二十二岁进企业做技术' },
        { cond: function (g) { return track18(g) === 'academic'; } }),
      fkOpt('小本创业', '先投 5 万元积蓄，前两年可能零收入，负债与健康风险都在；成功上限高，失败要还债。',
        { money: { cash: -50000 }, at: { stress: 8, health: -2, finance: -2 }, job: { id: 'startup' }, set: { fork22_work: true }, fork: { path: 'startup', track: 'founder' }, tag: '二十二岁开始创业' }),
      fkOpt('考研（继续读书）', '备考与学费约 3 万元，晚两三年挣钱，压力 +6；学历上限提高，但同龄人已升职。',
        { edu: 6, money: { cash: -30000 }, at: { stress: 6, knowledge: 4, health: -1 }, set: { fork22_kaoyan: true }, tag: '二十二岁选择考研' },
        { cond: function (g) { return track18(g) === 'academic'; } }),
      fkOpt('支教/基层教师', '两年偏远地区服务，月薪低、条件艰苦，健康 -2；编制与职称有倾斜，但回城名额有限。',
        { at: { health: -2, happiness: 3, stress: 2 }, job: { id: 'teacher' }, set: { fork22_work: true, fork22_teacher: true }, fork: { path: 'teacher', track: 'teach' }, tag: '二十二岁去支教' }),
      fkOpt('进后厨学厨', '起薪低、工时长，油烟与烫伤伤健康 -3；手艺是唯一本钱，出头靠年头。',
        { at: { health: -3, stress: 3 }, job: { id: 'chef' }, set: { fork22_work: true }, fork: { path: 'chef', track: 'kitchen' }, tag: '二十二岁进后厨' },
        { cond: function (g) { return track18(g) !== 'academic'; } }),
      fkOpt('跑出租/网约车', '先交车份钱或租车费约 2 万元，久坐伤腰，健康 -3；收入看时长，上限有限。',
        { money: { cash: -20000 }, at: { health: -3, stress: 4 }, job: { id: 'taxi' }, set: { fork22_work: true }, fork: { path: 'taxi', track: 'drive' }, tag: '二十二岁跑出租' },
        { cond: function (g) { return track18(g) !== 'academic'; } }),
      fkOpt('进厂做技工', '学徒期两年，月薪低、体力消耗大，健康 -3；手艺熟练后收入稳，但晋升靠工龄。',
        { at: { health: -3, stress: 2 }, job: { id: 'mechanic' }, set: { fork22_work: true }, fork: { path: 'mechanic', track: 'factory' }, tag: '二十二岁进厂做技工' },
        { cond: function (g) { return track18(g) !== 'academic'; } }),
      fkOpt('摆摊/开店', '押上 3 万元积蓄，守店时间长、关系要打点，健康 -2；生意好坏全看选址与运气。',
        { money: { cash: -30000 }, at: { health: -2, stress: 4, happiness: 2 }, job: { id: 'shop' }, set: { fork22_work: true }, fork: { path: 'shop', track: 'owner' }, tag: '二十二岁摆摊开店' })
    ]);

  /* 25 岁：研究生毕业 */
  fkEvent('v37_fork_postgrad', 25, '二十五岁的去处',
    '研究生毕业，实验室、医院、企业和体制内都在招人。科研要熬非升即走，医院要倒夜班，企业研发吃青春饭，公务员稳定但晋升慢；也可以转身去做手艺或跑运输。每一项都要拿时间和健康换。',
    [
      fkOpt('科研院所', '非升即走，三年考核不过就离开；起薪低、论文压力大，健康 -3，但学术上限高。',
        { at: { stress: 8, health: -3, knowledge: 4 }, job: { id: 'researcher' }, set: { fork25_research: true }, fork: { path: 'research', track: 'academy' }, tag: '二十五岁进科研院所' },
        { cond: function (g) { return !!g.marks.fork22_kaoyan; } }),
      fkOpt('三甲医院临床', '规培与夜班三年，健康 -4，医患关系压力大；收入稳、社会地位高，但几乎没有个人时间。',
        { at: { stress: 7, health: -4, reputation: 4 }, job: { id: 'doctor' }, set: { fork25_doctor: true }, fork: { path: 'doctor', track: 'hospital' }, tag: '二十五岁进三甲医院' },
        { cond: function (g) { return !!g.marks.fork22_kaoyan && !!g.marks.fork18_doctor; } }),
      fkOpt('高校教师/辅导员', '博士延毕与论文考核，健康 -2、压力 +5；假期多但非升即走，上限取决于课题。',
        { at: { stress: 5, health: -2, knowledge: 2 }, job: { id: 'teacher' }, set: { fork25_teach: true }, fork: { path: 'teacher', track: 'college' }, tag: '二十五岁进高校' }),
      fkOpt('企业研发', '加班与项目周期，健康 -3、压力 +5；起薪高，但三十五岁后要转管理或转行。',
        { at: { stress: 5, health: -3 }, job: { id: 'engineer' }, set: { fork25_corp: true }, fork: { path: 'engineer', track: 'rnd' }, tag: '二十五岁进企业研发' }),
      fkOpt('考公/事业单位', '备考半年到一年，资料与生活约 2 万元；稳定、编制，但基层服务期与晋升都很慢。',
        { money: { cash: -20000 }, at: { stress: 4, knowledge: 2 }, job: { id: 'civil' }, set: { fork25_civil: true }, fork: { path: 'civil', track: 'public' }, tag: '二十五岁考公' }),
      fkOpt('转行创业', '押上积蓄与人情，前两年可能没有稳定收入，健康 -2；自由度高，失败要自己兜底。',
        { money: { cash: -40000 }, at: { stress: 7, health: -2 }, job: { id: 'startup' }, set: { fork25_startup: true }, fork: { path: 'startup', track: 'pivot' }, tag: '二十五岁转行创业' }),
      fkOpt('进厂/做技工', '从头学手艺，起薪低、体力消耗大，健康 -3；熟练后收入稳定，但晋升靠工龄。',
        { at: { health: -3, stress: 2 }, job: { id: 'mechanic' }, set: { fork25_tech: true }, fork: { path: 'mechanic', track: 'factory' }, tag: '二十五岁进厂做技工' }),
      fkOpt('跑运输/出租', '租车与车份钱约 2 万元，久坐、昼夜颠倒，健康 -5；时间自由，收入上限有限。',
        { money: { cash: -20000 }, at: { health: -5, stress: 4 }, job: { id: 'taxi' }, set: { fork25_drive: true }, fork: { path: 'taxi', track: 'drive' }, tag: '二十五岁跑运输' })
    ]);

  V.FORK_AGE = { 15: 'v37_fork_zhongkao', 18: 'v37_fork_gaokao', 22: 'v37_fork_grad', 25: 'v37_fork_postgrad' };
  V.dueFork = function (g) {
    if (!g || !g.death || g.death.dead) return null;
    var id = V.FORK_AGE[g.age];
    if (!id) return null;
    if (g.fired && g.fired.indexOf(id) >= 0) return null;
    /* v3.10：人已在岗时，22/25 的“毕业去向”不再弹。否则会出现「上班上得好好的，
       突然被问要不要考研、投简历」；考研只留在待业分支里当并列选项。 */
    if (g.job && g.job.id && (id === 'v37_fork_grad' || id === 'v37_fork_postgrad')) {
      g.marks = g.marks || {};
      g.marks.fork_skipped_employed = true;
      return null;
    }
    return (LS.EVENT_INDEX && LS.EVENT_INDEX[id]) || null;
  };
  V.applyFork = function (g, ev, opt) {
    if (!g || !opt || !opt.fork) return;
    var f = opt.fork;
    if (f.path && LS.CAREER && LS.CAREER.enter) {
      /* 选项里的 fx 已把 g.job 设好，这里登记职业路径并记录入行年龄 */
      LS.CAREER.enter(g, f.path, { track: f.track || null, since: g.age, job: true });
    }
    if (f.path) {
      g.marks['fork_enter_' + f.path] = true;
      g.marks['fork_enter_age_' + f.path] = g.age;
    }
  };

})();
