/* =========================================================
   endings_v38.js — 非自然终局事件包（v3.8）
   ---------------------------------------------------------
   定位：给“人人都能活到寿终”的主流程补上一层半路停下的可能。
   边界：本文件只新增，不改 js/ 既有文件、index.html、css/。
   接入：见 docs/endings_schema.md 的“主路接入清单”。
   ========================================================= */
(function (root) {
  'use strict';

  var LS = root.LS || (root.LS = {});
  var V = LS.V38 = LS.V38 || {};

  /* ---------------- 基础常量 ---------------- */

  var BANDS = ['0-6', '7-12', '13-18', '19-30', '31-55', '56+'];

  var ROLE_OK = ['父亲', '母亲', '伴侣', '朋友', '同事', '子女', '邻居', '同学', '老师', '工友'];

  V.VERSION = '3.8.0-endings';

  V.CONFIG = {
    enabled: true,
    /* 每个年龄段的“年度意外风险预算”。实际触发率 = 候选 baseChance 之和 + 风险加成，且不超过预算 × riskCap */
    annualBudget: {
      '0-6': 0.00880,
      '7-12': 0.01663,
      '13-18': 0.02505,
      '19-30': 0.02333,
      '31-55': 0.01266,
      '56+': 0.00389
    },
    /* 连续高危行为最多把当年风险抬到预算的多少倍 */
    riskCap: 3.5,
    /* 隐患标签的默认阈值（g.risks 为 0-100） */
    riskThreshold: 40,
    /* 同一事件最短冷却年数，避免幸存后反复刷同一条文案 */
    cooldown: 8,
    /* 主路可以整体关闭 */
    enabledKey: 'v38_endings'
  };

  /* 阶段标签：child 覆盖 0-12 两个 band，band 仍是最精确的年龄桶 */
  var STAGE_TARGET_BY_BAND = {
    '0-6': 'child',
    '7-12': 'child',
    '13-18': 'teen',
    '19-30': 'youth',
    '31-55': 'adult',
    '56+': 'elder'
  };
  V.STAGE_TARGETS = ['child', 'teen', 'youth', 'adult', 'elder'];
  V.STAGE_TARGET_BY_BAND = STAGE_TARGET_BY_BAND;

  /* 主路可注入的引擎能力；未注入时走数据层降级实现 */
  V.hooks = V.hooks || {};

  /* ---------------- 工具函数 ---------------- */

  function num(v, d) {
    var n = Number(v);
    return isFinite(n) ? n : (d || 0);
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function rand() {
    if (typeof LS.rand === 'function') return LS.rand();
    return Math.random();
  }

  function chance(p) {
    if (typeof LS.chance === 'function') return LS.chance(p);
    return Math.random() < p;
  }

  function bandOf(age) {
    age = num(age, 0);
    if (age <= 6) return '0-6';
    if (age <= 12) return '7-12';
    if (age <= 18) return '13-18';
    if (age <= 30) return '19-30';
    if (age <= 55) return '31-55';
    return '56+';
  }

  function attr(g, key) {
    return num(g && g.attrs && g.attrs[key], 0);
  }

  function riskVal(g, key) {
    return num(g && g.risks && g.risks[key], 0);
  }

  function debtOf(g) {
    return num(g && g.money && g.money.debt, 0);
  }

  function jobIdOf(g) {
    return (g && g.job && g.job.id) || '';
  }

  /* 本包的 v38_* 标记用 fx.set 写入 g.marks；这里同时兼容 g.flags，避免两套口径 */
  function flagOn(g, key) {
    return !!((g && g.flags && g.flags[key]) || (g && g.marks && g.marks[key]));
  }

  function hasAnyFlag(g, list) {
    if (!Array.isArray(list) || !list.length) return false;
    for (var i = 0; i < list.length; i++) if (flagOn(g, list[i])) return true;
    return false;
  }

  function hasAllFlags(g, list) {
    if (!Array.isArray(list) || !list.length) return false;
    for (var i = 0; i < list.length; i++) if (!flagOn(g, list[i])) return false;
    return true;
  }

  function hasAnyMark(g, list) {
    if (!Array.isArray(list) || !list.length) return false;
    var marks = (g && g.marks) || {};
    for (var i = 0; i < list.length; i++) if (marks[list[i]]) return true;
    return false;
  }

  function init(g) {
    if (!g) return null;
    if (!g.v38 || typeof g.v38 !== 'object') g.v38 = {};
    var s = g.v38;
    if (!s.seen || typeof s.seen !== 'object') s.seen = {};
    if (!s.survived || typeof s.survived !== 'object') s.survived = {};
    if (s.lastRollAge === undefined) s.lastRollAge = null;
    if (s.prison === undefined) s.prison = null;
    if (s.release === undefined) s.release = null;
    if (s.stain === undefined) s.stain = null;
    if (s.ending === undefined) s.ending = null;
    if (!g.marks || typeof g.marks !== 'object') g.marks = {};
    if (!g.flags || typeof g.flags !== 'object') g.flags = {};
    if (!g.risks || typeof g.risks !== 'object') g.risks = {};
    return s;
  }

  function seenRecently(g, e) {
    var s = init(g);
    var at = s.seen[e.id];
    if (at === undefined) return false;
    var gap = num(g.age, 0) - num(at, 0);
    var cd = e.cooldown === undefined ? V.CONFIG.cooldown : e.cooldown;
    return gap < cd;
  }

  /* requires：给主路做人群过滤的显式对象，同时也是包内的硬条件 */
  function requiresOk(g, r) {
    if (!r || typeof r !== 'object') return true;
    var age = num(g.age, 0);
    if (r.ageMin !== undefined && age < r.ageMin) return false;
    if (r.ageMax !== undefined && age > r.ageMax) return false;
    if (r.gender && g.gender && g.gender !== r.gender) return false;

    if (r.job && jobIdOf(g) !== r.job) return false;
    if (r.jobs && (!Array.isArray(r.jobs) || r.jobs.indexOf(jobIdOf(g)) < 0)) return false;

    if (r.hazard) {
      var need = num(r.hazardMin, V.CONFIG.riskThreshold);
      if (riskVal(g, r.hazard) < need) return false;
    }
    if (r.healthMax !== undefined && attr(g, 'health') > r.healthMax) return false;
    if (r.healthMin !== undefined && attr(g, 'health') < r.healthMin) return false;
    if (r.debtMin !== undefined && debtOf(g) < r.debtMin) return false;

    if (r.flag && !flagOn(g, r.flag)) return false;
    if (r.flags && !hasAllFlags(g, r.flags)) return false;
    if (r.mark && !hasAnyMark(g, [r.mark])) return false;
    return true;
  }
  V.requiresOk = requiresOk;

  /* 硬条件：全部满足才进入候选 */
  function condOk(g, e) {
    var c = e.cond || {};
    var age = num(g.age, 0);
    if (age < e.ageMin || age > e.ageMax) return false;
    if (!requiresOk(g, e.requires)) return false;

    if (c.healthMax !== undefined && attr(g, 'health') > c.healthMax) return false;
    if (c.healthMin !== undefined && attr(g, 'health') < c.healthMin) return false;
    if (c.happinessMax !== undefined && attr(g, 'happiness') > c.happinessMax) return false;
    if (c.happinessMin !== undefined && attr(g, 'happiness') < c.happinessMin) return false;
    if (c.stressMin !== undefined && attr(g, 'stress') < c.stressMin) return false;

    if (c.debtMin !== undefined && debtOf(g) < c.debtMin) return false;

    if (c.flagsAny && !hasAnyFlag(g, c.flagsAny)) return false;
    if (c.flagsAll && !hasAllFlags(g, c.flagsAll)) return false;

    if (c.marksAny && !hasAnyMark(g, c.marksAny)) return false;
    if (c.marksNone && hasAnyMark(g, c.marksNone)) return false;

    if (c.jobAny) {
      if (!Array.isArray(c.jobAny) || c.jobAny.indexOf(jobIdOf(g)) < 0) return false;
    }

    if (c.prevAny) {
      var fired = g.fired || {};
      var s = g.v38 || {};
      var hit = false;
      for (var i = 0; i < c.prevAny.length; i++) {
        var id = c.prevAny[i];
        if (fired[id] || (s.survived && s.survived[id])) { hit = true; break; }
      }
      if (!hit) return false;
    }

    return true;
  }

  /* 风险加成：任一条件命中即认为“连续高危”成立 */
  function riskHit(g, e) {
    var r = e.risk;
    if (!r) return false;

    if (r.healthMax !== undefined && attr(g, 'health') <= r.healthMax) return true;
    if (r.happinessMax !== undefined && attr(g, 'happiness') <= r.happinessMax) return true;
    if (r.stressMin !== undefined && attr(g, 'stress') >= r.stressMin) return true;
    if (r.debtMin !== undefined && debtOf(g) >= r.debtMin) return true;

    if (r.riskMin) {
      for (var k in r.riskMin) {
        var need = num(r.riskMin[k], V.CONFIG.riskThreshold);
        if (riskVal(g, k) >= need) return true;
      }
    }

    if (r.flagsAny && hasAnyFlag(g, r.flagsAny)) return true;
    if (r.marksAny && hasAnyMark(g, r.marksAny)) return true;

    return false;
  }

  function candidates(g, band) {
    var list = [];
    for (var i = 0; i < V.ENDINGS.length; i++) {
      var e = V.ENDINGS[i];
      if (e.band !== band) continue;
      if (!condOk(g, e)) continue;
      if (seenRecently(g, e)) continue;
      list.push(e);
    }
    return list;
  }

  function weightedPick(pool) {
    var total = 0;
    for (var i = 0; i < pool.length; i++) total += pool[i].w;
    if (total <= 0) return pool.length ? pool[0].e : null;
    var roll = rand() * total;
    for (var j = 0; j < pool.length; j++) {
      roll -= pool[j].w;
      if (roll <= 0) return pool[j].e;
    }
    return pool[pool.length - 1].e;
  }

  function jumpYears(g, n) {
    n = num(n, 0);
    if (n <= 0) return;
    g.age = clamp(num(g.age, 0) + n, 0, 110);
    g.year = num(g.year, 0) + n;
    if (typeof LS.stageOf === 'function') g.stage = LS.stageOf(g.age);
  }

  /* ---------------- 结局登记 ---------------- */

  function detailOf(g, e, ch) {
    var end = e.ending || {};
    return {
      id: e.id,
      title: e.title,
      band: e.band,
      cause: end.cause,
      lastWords: end.lastWords,
      relic: end.relic,
      present: (end.present || []).slice(),
      tag: end.tag,
      settle: e.settle.slice(),
      age: num(g.age, 0),
      year: num(g.year, 0),
      choice: (ch && ch.id) || 'terminal',
      choiceLabel: (ch && ch.label) || ''
    };
  }

  function trigger(g, e, ch) {
    var s = init(g);
    if (e.ending && e.ending.ageOffset) jumpYears(g, e.ending.ageOffset);
    var detail = detailOf(g, e, ch);
    s.ending = detail;
    /* 引擎钩子：deathReason 读到 v38Death 时返回具体死因 */
    g.v38Death = detail;
    g.forceDeath = true;
    if (typeof LS.addMemory === 'function') {
      LS.addMemory(g, e.title + '：' + detail.cause, 'life');
    }
    return e.settle.join('');
  }

  function resolveChoice(g, e, ch) {
    var route = ch.route || 'survive';

    if (route === 'sentence') {
      var years = num(ch.sentence && ch.sentence.years, 0);
      serve(g, e, years, ch);
      return ch.text || '';
    }

    if (route === 'ending') {
      if (ch.pDeath !== undefined && !chance(ch.pDeath)) {
        /* 高风险动作没兑现成终局：写进幸存记录，继续游戏 */
        var s = init(g);
        s.survived[e.id] = num(g.age, 0);
        return ch.failText || ch.text || '';
      }
      jumpYears(g, ch.ageAdvance || 0);
      return trigger(g, e, ch);
    }

    return ch.text || '';
  }

  /* 服刑路径：年龄推进、履历留污点、关系断裂，然后继续游戏 */
  function serve(g, e, years, ch) {
    var s = init(g);
    years = clamp(num(years, 3), 1, 15);
    var fromAge = num(g.age, 0);
    var fromYear = num(g.year, 0);
    /* 引擎在本次选择后的 advance 还会 +1 年，所以这里只推进 years - 1 */
    var toAge = clamp(fromAge + years, 0, 110);
    var toYear = fromYear + years;

    jumpYears(g, Math.max(0, years - 1));

    /* 履历污点 */
    g.marks.v38_record = true;
    g.marks.v38_exconvict = true;
    s.stain = {
      endingId: e.id,
      tag: e.ending && e.ending.tag,
      years: years,
      fromAge: fromAge,
      toAge: toAge,
      fromYear: fromYear,
      toYear: toYear
    };

    /* 经济与声誉 */
    if (g.money) {
      g.money.cash = Math.max(0, num(g.money.cash, 0) - 2000);
      g.money.debt = num(g.money.debt, 0) + 3000;
    }
    if (g.rep) {
      g.rep.society = clamp(num(g.rep.society, 0) - 12, 0, 100);
      g.rep.industry = clamp(num(g.rep.industry, 0) - 8, 0, 100);
    }
    if (g.attrs) {
      g.attrs.health = clamp(num(g.attrs.health, 50) - 6, 0, 100);
      g.attrs.stress = clamp(num(g.attrs.stress, 40) + 10, 0, 100);
    }

    /* 工作：优先交给引擎的 clearJob，避免绕过播报与工龄结算 */
    var clearJobFn = (typeof V.hooks.clearJob === 'function')
      ? V.hooks.clearJob
      : ((LS.engine && typeof LS.engine.clearJob === 'function') ? LS.engine.clearJob : null);
    if (clearJobFn) {
      clearJobFn(g, '服刑');
    } else if (g.job) {
      g.job.id = null;
      g.job.title = '待业';
      g.job.salary = 0;
      g.job.level = 0;
      g.job.years = 0;
      g.flags.needJob = true;
      g.flags.unemployed = true;
    }

    /* 关系断裂：只改数据，不臆造 NPC 名字 */
    var roleOffsets = { '父亲': [-12, -12], '母亲': [-10, -10], '配偶': [-20, -24], '朋友': [-16, -16], '子女': [-12, -12] };
    (g.npcs || []).forEach(function (n) {
      var off = roleOffsets[n.role];
      if (!off) return;
      n.intimacy = clamp(num(n.intimacy, 40) + off[1], 0, 100);
      var f = num(n.favor, 0) + off[0];
      n.favor = clamp(f, -5, 5);
      n.lastContactYear = g.year;
    });

    s.prison = {
      endingId: e.id,
      years: years,
      releaseAge: toAge,
      releaseYear: toYear,
      active: true,
      pendingRelease: true,
      tag: (e.ending && e.ending.tag) || ''
    };

    if (typeof LS.addMemory === 'function') {
      LS.addMemory(g, '因' + ((e.ending && e.ending.cause) || '刑事案件') + '服刑 ' + years + ' 年。', 'life');
    }

    return ch.text || '';
  }

  /* ---------------- 事件对象 ---------------- */

  function toEvent(g, e) {
    var opts;
    if (e.choices && e.choices.length) {
      opts = e.choices.map(function (ch) {
        return {
          label: ch.label,
          hint: ch.hint || '',
          tone: ch.tone || 'plain',
          fx: ch.fx || null,
          apply: function (gg) { return resolveChoice(gg, e, ch); }
        };
      });
    } else {
      opts = [{
        label: '……',
        hint: '这一页没有可以改写的部分',
        tone: 'plain',
        apply: function (gg) { return trigger(gg, e, null); }
      }];
    }

    return {
      id: e.id,
      type: 'ending',
      tier: 'ending',
      stage: (typeof LS.stageOf === 'function' ? LS.stageOf(num(g.age, 0)) : e.band),
      title: e.title,
      text: e.text,
      opts: opts,
      isEnding: true,
      endingId: e.id,
      band: e.band,
      weight: 0
    };
  }

  function releaseEvent(g, p) {
    var s = init(g);
    var e = byId(p.endingId);
    var rel = (e && e.release) || {
      title: '铁门外的天',
      text: '你在里面待了几年，门外的时间没有停。',
      settle: ['你出来那天，天很亮，门口没有人。', '案底跟着你，工作要重新找。', '你沿着路往前走，没有回头。']
    };

    return {
      id: 'v38_release_' + p.endingId + '_' + num(g.age, 0),
      type: 'release',
      tier: 'echo',
      stage: (typeof LS.stageOf === 'function' ? LS.stageOf(num(g.age, 0)) : '青年'),
      title: rel.title,
      text: rel.text,
      opts: [{
        label: '走出大门',
        hint: '日子还要继续',
        tone: 'plain',
        apply: function (gg) {
          var ss = init(gg);
          ss.prison = null;
          ss.release = {
            endingId: p.endingId,
            years: p.years,
            age: num(gg.age, 0),
            year: num(gg.year, 0)
          };
          gg.marks.v38_exconvict = true;
          if (gg.flags) {
            gg.flags.needJob = true;
            gg.flags.unemployed = !(gg.job && gg.job.id);
          }
          if (typeof LS.addMemory === 'function') {
            LS.addMemory(gg, '刑满释放，' + num(gg.age, 0) + ' 岁，履历上留着那一行字。', 'life');
          }
          return rel.settle.join('');
        }
      }],
      isRelease: true,
      prison: { years: p.years, endingId: p.endingId },
      weight: 0
    };
  }

  /* ---------------- 对外接口 ---------------- */

  function byId(id) {
    for (var i = 0; i < V.ENDINGS.length; i++) if (V.ENDINGS[i].id === id) return V.ENDINGS[i];
    return null;
  }

  /* 计算某年龄、某个状态下的年度概率（供主路展示/调试/测试用） */
  V.hazardAt = function (age, fakeG) {
    var g = fakeG || {
      age: age, attrs: { health: 70, happiness: 55, stress: 40 },
      risks: {}, flags: {}, marks: {}, money: { debt: 0 }
    };
    g.age = age;
    var band = bandOf(age);
    var budget = V.CONFIG.annualBudget[band];
    if (!budget) return 0;
    var list = candidates(g, band);
    var base = 0, boost = 0;
    list.forEach(function (e) {
      base += e.baseChance;
      if (riskHit(g, e)) boost += e.riskBoost;
    });
    return Math.min(budget * V.CONFIG.riskCap, base + boost);
  };

  /* 主路每年调用一次：返回终局事件 / 刑满释放事件 / null */
  V.due = function (g) {
    if (!g || (g.death && g.death.dead)) return null;
    if (!V.CONFIG.enabled) return null;

    var s = init(g);

    /* 1) 先处理刑满释放，保证它一定出现 */
    if (s.prison && s.prison.pendingRelease) {
      s.prison.pendingRelease = false;
      s.prison.active = false;
      return releaseEvent(g, s.prison);
    }

    /* 2) 服刑期间不触发新的终局，让主路先走完释放 */
    if (s.prison && s.prison.active) return null;

    /* 3) 同一年只掷一次，避免主路重复调用导致概率翻倍 */
    var age = num(g.age, 0);
    if (s.lastRollAge === age) return null;
    s.lastRollAge = age;

    var band = bandOf(age);
    var budget = V.CONFIG.annualBudget[band];
    if (!budget) return null;

    var list = candidates(g, band);
    if (!list.length) return null;

    var base = 0, boost = 0;
    var hits = [];
    list.forEach(function (e) {
      base += e.baseChance;
      var hit = riskHit(g, e);
      hits.push(hit);
      if (hit) boost += e.riskBoost;
    });

    var p = Math.min(budget * V.CONFIG.riskCap, base + boost);
    if (p <= 0 || !chance(p)) return null;

    var pool = list.map(function (e, i) {
      return { e: e, w: e.weight * (e.baseChance + (hits[i] ? e.riskBoost : 0)) };
    });
    var picked = weightedPick(pool);
    if (!picked) return null;

    s.seen[picked.id] = age;
    return toEvent(g, picked);
  };

  V.byId = byId;
  V.bandOf = bandOf;
  V.detailOf = detailOf;
  V.trigger = trigger;
  V.serve = serve;
  V.toEvent = toEvent;

  /* 主路在 finish() 里用这个补齐 summary */
  V.summaryPatch = function (g) {
    if (!g || !g.v38Death) return null;
    return {
      id: g.v38Death.id,
      cause: g.v38Death.cause,
      lastWords: g.v38Death.lastWords,
      relic: g.v38Death.relic,
      present: (g.v38Death.present || []).slice(),
      tag: g.v38Death.tag,
      settle: (g.v38Death.settle || []).slice(),
      age: g.v38Death.age,
      year: g.v38Death.year
    };
  };

  V.reasonOf = function (g) {
    return (g && g.v38Death && g.v38Death.cause) ? g.v38Death.cause : null;
  };

  /* =========================================================
     事件数据
     字段说明见 docs/endings_schema.md
     ========================================================= */

  V.ENDINGS = [

    /* ================= 0–6 岁（5 条） ================= */

    {
      id: 'v38_infant_fever',
      band: '0-6',
      ageMin: 0, ageMax: 6,
      weight: 1,
      baseChance: 0.00045,
      riskBoost: 0.00035,
      title: '体温计上的红线',
      text: '后半夜，孩子烧到四十度，奶也不肯吃。母亲把湿毛巾敷了又敷，体温计甩下去，红线还是不下来。父亲披上外套，说去镇上的卫生院。',
      cond: {},
      risk: { healthMax: 44 },
      choices: [],
      terminal: true,
      ending: {
        cause: '重症肺炎，转院途中呼吸衰竭',
        lastWords: '（他还不会说完整的句子，只把手抓住了母亲的衣角）',
        relic: '一只没来得及拆封的退热贴',
        present: ['母亲', '父亲'],
        tag: '没学会走路的人'
      },
      settle: [
        '车在半路上抛了锚。母亲抱着孩子跑了最后两公里，卫生院的值班医生只看了一眼，就让他们往县医院送。',
        '县医院的走廊很长，日光灯是白的。护士接过孩子的时候，他的小手还攥着母亲的衣角。',
        '凌晨四点十二分，心电图变成一条直线。父亲蹲在走廊尽头，一直没有站起来。',
        '这个孩子在这世上只过了两年零四个月，名字还没来得及写进族谱。'
      ]
    },

    {
      id: 'v38_infant_suffocation',
      band: '0-6',
      ageMin: 0, ageMax: 6,
      weight: 1,
      baseChance: 0.00040,
      riskBoost: 0.00025,
      title: '被子下面没有声音',
      text: '冬天冷，母亲把被子掖得很紧。早上进屋时，孩子整个缩在被子里，脸是青的，嘴边有一圈奶渍。',
      cond: {},
      risk: { healthMax: 50 },
      choices: [],
      terminal: true,
      ending: {
        cause: '被褥捂压导致窒息',
        lastWords: '（没有留下声音）',
        relic: '一条洗得发白的小棉被',
        present: ['母亲'],
        tag: '没有哭声的早晨'
      },
      settle: [
        '母亲把被子掀开，孩子的身体还是软的，但胸口没有起伏。',
        '村医赶来时摇了摇头，说送到医院也没有用了。父亲在门外听见这句话，蹲下去，很久没有起来。',
        '那天之后，家里再没有用过那床小棉被。母亲把它洗干净，叠好，放在柜子最底层。',
        '每年冬天最冷的那几天，她都会想起早上掀开被子的那一下。'
      ]
    },

    {
      id: 'v38_infant_scald',
      band: '0-6',
      ageMin: 0, ageMax: 6,
      weight: 1,
      baseChance: 0.00038,
      riskBoost: 0.00020,
      title: '灶台上的一锅开水',
      text: '母亲在灶台前忙，孩子扶着凳子站起来，伸手去够那口锅的把手。整锅热水顺着灶沿翻下来。',
      cond: {},
      risk: { healthMax: 40 },
      choices: [],
      terminal: true,
      ending: {
        cause: '大面积烫伤，感染后多器官衰竭',
        lastWords: '（他哭了一整夜，天亮时已经没有力气了）',
        relic: '一只被烫出凹痕的搪瓷碗',
        present: ['母亲', '父亲'],
        tag: '没等到春天'
      },
      settle: [
        '邻居帮忙找车，父亲抱着孩子坐在后排，一路用湿被子裹着。县医院说烧伤面积太大，必须转市里。',
        '市医院的烧伤科在六楼。孩子在换药的第二天开始发烧，第三天不再哭。',
        '医生把父亲叫到办公室，说感染已经控制不住了。父亲出来时，手里还攥着那张缴费单。',
        '孩子走的时候，窗外刚下过一场雪。母亲一直说，怪她没把锅端远一点。'
      ]
    },

    {
      id: 'v38_infant_poison',
      band: '0-6',
      ageMin: 0, ageMax: 6,
      weight: 1,
      baseChance: 0.00040,
      riskBoost: 0.00020,
      title: '柜子底下的小瓶子',
      text: '大人都在院子里，孩子从柜子底下摸出一个没有标签的塑料瓶。瓶子里是去年剩下的清洁剂，他把盖子咬开，喝了一口。',
      cond: {},
      risk: {},
      choices: [],
      terminal: true,
      ending: {
        cause: '误服清洁剂，消化道灼伤',
        lastWords: '（他只会说“苦”，然后一直流口水）',
        relic: '一个没有标签的塑料瓶',
        present: ['母亲', '父亲'],
        tag: '柜子没有上锁'
      },
      settle: [
        '母亲闻到味道时，孩子已经吐了一地。她抠他的喉咙，喂水，又抱着他往村口跑。',
        '村医看了一眼瓶子，让他们立刻去县医院，路上不要让孩子再喝水。',
        '县医院的洗胃管插进去时，孩子挣扎得很厉害。食道已经烧坏了，后面几天连水都咽不下。',
        '第七天，他死于感染和脱水。那个塑料瓶被父亲扔进灶膛，烧了很久。'
      ]
    },

    {
      id: 'v38_infant_sids',
      band: '0-6',
      ageMin: 0, ageMax: 6,
      weight: 1,
      baseChance: 0.00037,
      riskBoost: 0.00020,
      title: '睡得很沉的一夜',
      text: '孩子比平时睡得沉，晚饭时还笑过，睡前也喝了奶。母亲半夜起来看了一眼，被子盖到胸口，呼吸轻得几乎听不见。',
      cond: {},
      risk: { healthMax: 55 },
      choices: [],
      terminal: true,
      ending: {
        cause: '婴儿猝死综合征',
        lastWords: '（他没有醒过来，也没有哭）',
        relic: '一只缺了角的安抚奶嘴',
        present: ['母亲', '父亲'],
        tag: '没有征兆的告别'
      },
      settle: [
        '天亮时母亲再去抱他，身体已经凉了。她以为是手冷，把他抱到怀里捂了很久。',
        '救护车来的时候，医生看了一眼瞳孔，没有说话。父亲站在门口，反复问“怎么会”。',
        '尸检报告上写着婴儿猝死综合征，没有原因，也没有可以怪的人。',
        '后来他们搬了一次家。那只安抚奶嘴一直放在抽屉里，谁也没有扔。'
      ]
    },

    /* ================= 7–12 岁（6 条） ================= */

    {
      id: 'v38_child_car',
      band: '7-12',
      ageMin: 7, ageMax: 12,
      weight: 1,
      baseChance: 0.00030,
      riskBoost: 0.00025,
      title: '放学路上的白色货车',
      text: '放学后，孩子和同学追着跑过马路。一辆白色货车从路口右转，司机说后来才看见那个小小的影子。',
      cond: {},
      risk: { flagsAny: ['v38_speeder_family', 'v38_latchkey'] },
      choices: [],
      terminal: true,
      ending: {
        cause: '交通事故，颅脑损伤',
        lastWords: '“妈，我的书包还在那边。”',
        relic: '一只蓝色塑料水壶',
        present: ['同学', '母亲'],
        tag: '没走到马路对面'
      },
      settle: [
        '刹车声很短，之后整条街都安静了。书包里的作业本飞到马路另一侧，上面还写着今天的日期。',
        '同学跑回学校喊人，老师抱着他往医院赶，一路上他还有呼吸。',
        '手术做到天黑。医生出来时摘下口罩，说颅脑损伤太重，已经没有办法了。',
        '母亲赶到时，手里还提着给他买的晚饭。她在急诊门口站了很久，没有进去。'
      ]
    },

    {
      id: 'v38_child_drown',
      band: '7-12',
      ageMin: 7, ageMax: 12,
      weight: 1,
      baseChance: 0.00030,
      riskBoost: 0.00025,
      title: '河沟里的水只到大人膝盖',
      text: '夏天的午后，几个孩子去村口河沟摸螺蛳。水只到大人膝盖，但河底有一个挖沙留下的深坑。',
      cond: {},
      risk: { flagsAny: ['v38_rural_water'], happinessMax: 25 },
      choices: [],
      terminal: true,
      ending: {
        cause: '溺水窒息',
        lastWords: '（同伴说，他只看见一只手在水面上抓了一下）',
        relic: '一只塑料凉鞋',
        present: ['同学', '邻居'],
        tag: '水不深，坑很深'
      },
      settle: [
        '同伴吓哭了，跑回村里喊人。等大人们赶到，水面已经平静。',
        '捞上来时，他的指甲缝里全是河泥。村医把他放在岸边的草地上，按了很久的胸口。',
        '母亲不让人盖住他的脸，说再等等，说不定只是呛水，缓一缓就醒了。',
        '后来那条河沟被填了，村口立了一块没有名字的警示牌。'
      ]
    },

    {
      id: 'v38_child_fall',
      band: '7-12',
      ageMin: 7, ageMax: 12,
      weight: 1,
      baseChance: 0.00030,
      riskBoost: 0.00022,
      title: '没有装护栏的窗台',
      text: '家里在五楼，窗台很低，外面晾着衣服。孩子踩着小板凳探身出去，想够那件被风吹远的衬衫。',
      cond: {},
      risk: { healthMax: 40, flagsAny: ['v38_old_house'] },
      choices: [],
      terminal: true,
      ending: {
        cause: '高处坠落，抢救无效',
        lastWords: '“我够到了——”',
        relic: '一件被风吹到楼下的白衬衫',
        present: ['母亲', '邻居'],
        tag: '差一点就够到了'
      },
      settle: [
        '邻居先听见一声闷响，以为是花盆掉了。下楼时，孩子躺在绿化带的砖沿上，衬衫落在他旁边。',
        '他被抱起来时还有意识，问妈妈衣服捡到没有。母亲一直点头，说捡到了，捡到了。',
        '救护车在晚高峰里走了四十分钟。到医院时，他的瞳孔已经散开。',
        '母亲后来把所有的窗户都装了护栏，包括那扇再也不打开的。'
      ]
    },

    {
      id: 'v38_child_lost',
      band: '7-12',
      ageMin: 7, ageMax: 12,
      weight: 0.9,
      baseChance: 0.00030,
      riskBoost: 0.00022,
      title: '集市上松开的手',
      text: '赶集的人很多。孩子松开母亲的手去看一个卖气球的摊子，再回头，人群已经把母亲淹没了。',
      cond: {},
      risk: { happinessMax: 25, flagsAny: ['v38_latchkey'] },
      choices: [],
      terminal: true,
      ending: {
        cause: '走失后失温，跌入排水渠',
        lastWords: '“妈妈，我在这儿。”',
        relic: '一只红色气球，系着半截线',
        present: ['母亲', '邻居'],
        tag: '人群里松开的那一下'
      },
      settle: [
        '母亲找了一整夜，广播站也播了寻人启事。她沿着集市走了十几遍，见人就问有没有看见一个穿蓝外套的男孩。',
        '第二天清晨，有人在镇边的排水渠里发现了他。夜里下过雨，渠里的水比平时深。',
        '鞋少了一只，手里还攥着气球线。母亲把他抱起来时，气球从她指间飘走了。',
        '后来她再去集市，总把手攥得很紧，哪怕手里什么也没有。'
      ]
    },

    {
      id: 'v38_child_electric',
      band: '7-12',
      ageMin: 7, ageMax: 12,
      weight: 1,
      baseChance: 0.00030,
      riskBoost: 0.00022,
      title: '墙上的插座',
      text: '老房子的插座松了，铜片露在外面。孩子拿着一根铁丝去捅那个小孔，想看里面有没有灯。',
      cond: {},
      risk: { flagsAny: ['v38_old_house'] },
      choices: [],
      terminal: true,
      ending: {
        cause: '触电，心跳骤停',
        lastWords: '（他没有来得及喊）',
        relic: '一截弯了的铁丝',
        present: ['母亲', '父亲'],
        tag: '没人教过他那不是玩具'
      },
      settle: [
        '父亲先断了总闸，再把他从墙边抱下来。孩子的手掌有一块焦黑的印子，人已经软了。',
        '村医做了很久的按压，孩子一直没有反应。县医院的医生说是心室颤动，来得太快。',
        '派出所来做笔录时，父亲反复说，是我没看着，是我没看着。',
        '那间老房子后来翻修过，所有插座都换了，但父亲一直记得那截铁丝。'
      ]
    },

    {
      id: 'v38_child_fire',
      band: '7-12',
      ageMin: 7, ageMax: 12,
      weight: 1,
      baseChance: 0.00030,
      riskBoost: 0.00022,
      title: '半夜着起来的窗帘',
      text: '冬天用煤炉取暖，窗帘离炉子太近。半夜母亲闻到烟味，起来时火已经烧到了房梁。',
      cond: {},
      risk: { flagsAny: ['v38_old_house'] },
      choices: [],
      terminal: true,
      ending: {
        cause: '火灾中吸入有毒烟气',
        lastWords: '“妈妈，门打不开。”',
        relic: '一只烧变形的门把手',
        present: ['母亲', '邻居'],
        tag: '门从里面打不开'
      },
      settle: [
        '母亲先醒了，去推孩子的房门，门闩卡住了。她踹了两脚，门没有开。',
        '邻居砸开后窗，把孩子抱出来时，他已经没有呼吸。烟比火先到，屋里什么都看不清。',
        '消防车来的时候，火已经烧穿了屋顶。母亲坐在院子里，手里还握着那只门把手。',
        '母亲的手上留了一块疤，每到冬天就会发痒。'
      ]
    },

    /* ================= 13–18 岁（6 条） ================= */

    {
      id: 'v38_teen_fight',
      band: '13-18',
      ageMin: 13, ageMax: 18,
      weight: 1,
      baseChance: 0.00034,
      riskBoost: 0.00030,
      title: '校门口的那一砖',
      text: '两拨人在校门口约架，他站在最前面。对方从花坛边抄起半块砖，第一下就砸在他后脑。',
      cond: {},
      risk: { riskMin: { highStress: 50 }, marksAny: ['v38_bad_crowd'] },
      choices: [],
      terminal: true,
      ending: {
        cause: '斗殴致颅脑损伤，抢救无效',
        lastWords: '“别打了……”',
        relic: '一部屏幕碎了的手机',
        present: ['同学', '父亲'],
        tag: '差一岁成年'
      },
      settle: [
        '他倒下时，还有人以为他在装。有人踢了他一脚，见他不动，才慌了。',
        '同学打了急救电话。老师赶到时，他躺在校门口的台阶上，后脑下面洇开一片深色。',
        '手术做了六个小时。医生出来时只说“准备后事”，父亲当场坐在了地上。',
        '案子拖了半年。那个动手的孩子还未成年，判决书里写着一行很轻的字。'
      ]
    },

    {
      id: 'v38_teen_drown',
      band: '13-18',
      ageMin: 13, ageMax: 18,
      weight: 1,
      baseChance: 0.00033,
      riskBoost: 0.00028,
      title: '水库边的暑假',
      text: '暑假的中午，几个少年翻过护栏去水库边游泳。水面看着平静，底下是抽沙留下的陡坎。',
      cond: {},
      risk: { flagsAny: ['v38_rural_water'] },
      choices: [],
      terminal: true,
      ending: {
        cause: '水库溺水',
        lastWords: '（同伴说，他沉下去前还笑了一下）',
        relic: '一副断了腿的泳镜',
        present: ['同学', '朋友'],
        tag: '没游到对岸'
      },
      settle: [
        '同伴以为他在潜水，等了两分钟才觉得不对。水面上只剩一圈一圈的波纹。',
        '打捞队来的时候，岸上围了很多人。有人说是水底下有暗流，有人说是腿抽了筋。',
        '母亲认领遗物时，把那副泳镜擦了很久。她不相信一个会游泳的孩子会淹死在水库里。',
        '水库边后来加了围栏，但每年夏天还是有人翻过去。'
      ]
    },

    {
      id: 'v38_teen_runaway',
      band: '13-18',
      ageMin: 13, ageMax: 18,
      weight: 0.9,
      baseChance: 0.00033,
      riskBoost: 0.00026,
      title: '凌晨四点的长途汽车站',
      text: '他和家里大吵了一架，书包里塞了两件衣服和攒下的三百块钱，买了一张开往南方的夜班车票。',
      cond: {},
      risk: { happinessMax: 30, flagsAny: ['v38_runaway'] },
      choices: [],
      terminal: true,
      ending: {
        cause: '离家后失联，三年后确认死亡',
        lastWords: '（他最后一条消息是“别找我”）',
        relic: '一张磨破边的车票',
        present: ['母亲', '父亲'],
        tag: '没有人知道他那三年',
        ageOffset: 3
      },
      settle: [
        '家里报了警，贴了寻人启事，也去他同学家问过。父亲第一次学会用手机地图，沿着他可能走的路线看了很多遍。',
        '第二年，有人说在南方的工地见过一个像他的男孩。母亲赶过去，工地上的人说那个人已经走了。',
        '第三年，警方通知家属去认一张照片。照片上的人很瘦，眉眼还是他的。',
        '母亲一直留着他那条“别找我”的短信，没有删。她总说，孩子只是还没想好怎么回来。'
      ]
    },

    {
      id: 'v38_teen_crime',
      band: '13-18',
      ageMin: 13, ageMax: 18,
      weight: 1,
      baseChance: 0.00034,
      riskBoost: 0.00032,
      title: '便利店后门的监控',
      text: '三个人撬开便利店后门，拿走了收银机里的钱和两条烟。第二天，监控截图传到了派出所。派出所把电话打到家里，父亲接完电话，坐在门口抽了半包烟。',
      cond: {},
      risk: { debtMin: 15000, riskMin: { highStress: 50 } },
      choices: [
        {
          id: 'surrender',
          label: '跟父亲去派出所自首',
          hint: '两年，出来还能重来',
          tone: 'safe',
          route: 'sentence',
          sentence: { years: 2 },
          fx: { at: { happiness: -6 }, rep: { society: -10 } },
          text: '父亲没有打你。他把烟按灭，说“走，我陪你去”。讯问室的灯很亮，你把那晚的事从头讲了一遍。'
        },
        {
          id: 'flee',
          label: '连夜往省外跑',
          hint: '跑了就回不了头',
          tone: 'risk',
          route: 'ending',
          pDeath: 0.55,
          ageAdvance: 8,
          fx: { set: { v38_wanted: true }, risk: { highStress: 12 } },
          text: '你在长途车上坐了一夜，天亮时到了邻省。三年后，你在一个网吧里被按倒，案子被并成了典型。'
        },
        {
          id: 'settle',
          label: '找朋友凑钱，托人私了',
          hint: '钱能压下去，但案底还在',
          tone: 'warn',
          route: 'survive',
          fx: {
            money: { cash: -8000, debt: 12000 },
            set: { v38_record: true },
            rep: { society: -8 },
            npc: { 朋友: { favor: -10, intimacy: -8 } }
          },
          text: '朋友借了你一笔钱，中间人收了钱，说“尽量压成治安案”。你没有被关进去，但档案里还是留了一行字。'
        }
      ],
      ending: {
        cause: '抢劫罪，判处有期徒刑十二年，狱中病逝',
        lastWords: '“别让我妈来。”',
        relic: '一份判决书复印件',
        present: ['母亲'],
        tag: '名字留在档案里'
      },
      release: {
        title: '少管所的铁门',
        text: '两年，说长不长。你出来那天，门口只有父亲一个人。',
        settle: [
          '你在里面待了两年，出来时十九岁。',
          '父亲来接你，头发白了一半，没有问你里面的事。',
          '案底跟着你，找工作被拒了三次；以前的朋友，见了面只点头。',
          '你站在汽车站门口，第一次觉得路是往前的，但每一步都有人回头看。'
        ]
      },
      settle: [
        '你跑了三年，在邻省的一个网吧里被按倒。案子被并成了典型，从重处理。',
        '法庭上，母亲坐在最后一排。她一直看着你，像是想把你从被告席上叫起来。',
        '十二年。你在里面待到第八年，一场肺炎拖了半个月，狱医只给了几片退烧药。',
        '你死的时候，窗外的操场上有人在跑步。母亲后来收到一封信，信里只有一句“别让她来”。'
      ]
    },

    {
      id: 'v38_teen_moto',
      band: '13-18',
      ageMin: 13, ageMax: 18,
      weight: 1,
      baseChance: 0.00033,
      riskBoost: 0.00028,
      title: '借来的摩托车',
      text: '他还没到考驾照的年纪，借了朋友的摩托车，载着人往镇上跑。回程时为了超一辆货车，拧到了底。',
      cond: {},
      risk: { flagsAny: ['v38_speeder'] },
      choices: [],
      terminal: true,
      ending: {
        cause: '摩托车事故，重型颅脑损伤',
        lastWords: '“抓紧了。”',
        relic: '一只摔裂的头盔',
        present: ['朋友', '父亲'],
        tag: '没拿到驾照的人'
      },
      settle: [
        '摩托车从货车尾部擦过去，摔进了路边的沟里。头盔滚出去很远，扣子没有系。',
        '朋友断了一条腿，他躺在沟底，耳朵里有血。路过的人先拨了急救电话，又不知道该先扶哪一个。',
        '县医院做了开颅手术。父亲在手术室外面签了三次字，最后一次手一直在抖。',
        '第二天中午，医生撤掉了呼吸机。那辆摩托车后来被卖了废铁，朋友再没有骑过车。'
      ]
    },

    {
      id: 'v38_teen_cyber',
      band: '13-18',
      ageMin: 13, ageMax: 18,
      weight: 1,
      baseChance: 0.00033,
      riskBoost: 0.00028,
      title: '网吧包间的第十二个小时',
      text: '他在网吧包间里连着打了十几个小时，桌上堆着泡面桶和功能饮料。凌晨三点，他起身去接水，走到门口就倒了下去。',
      cond: {},
      risk: { riskMin: { lateNight: 50 }, marksAny: ['v38_overwork'] },
      choices: [],
      terminal: true,
      ending: {
        cause: '长时间熬夜诱发心源性猝死',
        lastWords: '（监控里，他倒下前扶了一下门框）',
        relic: '一张没退的包夜卡',
        present: ['朋友', '邻居'],
        tag: '没熬过那个通宵'
      },
      settle: [
        '网管以为他睡着了，过了十几分钟才去推他。人已经叫不醒，手还搭在门把上。',
        '救护车来的时候，网吧里的人在继续打游戏，只有朋友跟着上了车。',
        '医生说是心源性猝死，送来时已经错过了最好的几分钟。',
        '父亲把那张包夜卡和身份证一起领了回来，卡上还剩两个小时。'
      ]
    },

    /* ================= 19–30 岁（7 条） ================= */

    {
      id: 'v38_young_drunk',
      band: '19-30',
      ageMin: 19, ageMax: 30,
      weight: 1,
      baseChance: 0.00029,
      riskBoost: 0.00040,
      title: '散场后的车钥匙',
      text: '饭局散在凌晨，他喝了不少，觉得自己还清醒。车钥匙在口袋里，停车场离家只有四公里。',
      cond: {},
      risk: { riskMin: { lateNight: 45 }, flagsAny: ['v38_alcohol'] },
      choices: [
        {
          id: 'taxi',
          label: '叫代驾',
          hint: '八十块，换一条命',
          tone: 'safe',
          route: 'survive',
          fx: { money: { cash: -80 }, at: { health: -1 } },
          text: '代驾来得比想象中快。你坐在后排，看他把车开过那四个路口，第一次觉得这段路这么长。'
        },
        {
          id: 'drive',
          label: '自己开回去',
          hint: '就四公里，不会有事',
          tone: 'risk',
          route: 'ending',
          pDeath: 0.7,
          fx: { set: { v38_alcohol: true }, risk: { lateNight: 6 } },
          failText: '你把车停在小区门口，熄火时手还在抖。第二天看到昨晚的酒驾新闻，你删掉了行车记录。'
        },
        {
          id: 'friend',
          label: '让没喝酒的朋友开',
          hint: '朋友刚拿驾照',
          tone: 'warn',
          route: 'ending',
          pDeath: 0.3,
          fx: { npc: { 朋友: { favor: 4, intimacy: 4 } } },
          failText: '朋友把车开得很慢，一路没有说话。到了楼下，他让你以后别再这样。'
        }
      ],
      ending: {
        cause: '醉驾撞上护栏，颅脑损伤',
        lastWords: '“我就说我没醉。”',
        relic: '一副挂在后视镜上的平安符',
        present: ['朋友'],
        tag: '四公里的路'
      },
      settle: [
        '车在匝道口撞上护栏，翻了半圈。安全气囊弹出来，挡风玻璃上全是裂纹。',
        '酒精检测结果是每百毫升一百八十毫克。警察在事故单上写“醉酒驾驶”，字很工整。',
        '朋友赶到医院时，他已经被推进了抢救室。那副平安符从后视镜上掉下来，落在副驾驶的脚垫上。',
        '母亲没有见到最后一面。她只记得那天晚上，他出门前说“很快就回来”。'
      ]
    },

    {
      id: 'v38_young_crime',
      band: '19-30',
      ageMin: 19, ageMax: 30,
      weight: 1,
      baseChance: 0.00029,
      riskBoost: 0.00042,
      title: '一笔还不上的账',
      text: '他跟着朋友去要一笔债，对方不肯给，推搡中他抄起了桌上的玻璃烟灰缸。楼下传来警笛声，警察在问路。',
      cond: {},
      risk: { debtMin: 30000, marksAny: ['v38_gamble_debt'], riskMin: { highStress: 55 } },
      choices: [
        {
          id: 'surrender',
          label: '留下来，等警察来',
          hint: '四年，出来还能找工作',
          tone: 'safe',
          route: 'sentence',
          sentence: { years: 4 },
          fx: { at: { happiness: -8 }, rep: { society: -14 } },
          text: '你没有跑。烟灰缸放在桌上，手一直在抖。警察进门时，你自己把手伸了过去。'
        },
        {
          id: 'flee',
          label: '从后门跑掉',
          hint: '跑到外省，换个名字',
          tone: 'risk',
          route: 'ending',
          pDeath: 0.6,
          ageAdvance: 16,
          fx: { set: { v38_wanted: true }, risk: { highStress: 15 } },
          text: '你从后门跑出去，连夜上了高速。三年后在邻省落网，案子被从重处理。'
        },
        {
          id: 'settle',
          label: '找中间人花钱摆平',
          hint: '钱能拖一阵，拖不了一世',
          tone: 'warn',
          route: 'survive',
          fx: {
            money: { cash: -20000, debt: 30000 },
            set: { v38_record: true },
            rep: { society: -10 },
            npc: { 配偶: { favor: -4, intimacy: -8 } }
          },
          text: '中间人收了两万，说“先压着”。你回了家，伴侣问你手上哪来的伤，你说搬货划的。'
        }
      ],
      ending: {
        cause: '故意伤害致死，无期徒刑，狱中病逝',
        lastWords: '“我只是想吓唬他。”',
        relic: '一只缺角的玻璃烟灰缸',
        present: ['母亲'],
        tag: '一笔还不上的账'
      },
      release: {
        title: '四年后的火车站',
        text: '出来那天，城市的地铁修到了更远的地方。你站在站前广场，不知道该往哪走。',
        settle: [
          '你在里面待了四年。出来那天，门口的树比记忆里高了一截。',
          '母亲在你服刑的第三年走了，家里怕影响你改造，没有告诉你。',
          '案底让招工的人把简历推回来；伴侣的号码成了空号。',
          '你提着行李站在车站，发现这座城市已经不认识你。'
        ]
      },
      settle: [
        '你跑了三年，在邻省的一个出租屋里被找到。对方家属请了律师，案子没有再给你留余地。',
        '法庭上，你没有解释那只烟灰缸。判决书念了很长，最后落在“无期徒刑”四个字上。',
        '你在里面待了十六年。第十六年冬天，一次肺部感染没有及时送医。',
        '母亲来探视过两次，后来腿脚不好，来不了了。你死时，探视簿上最后一页还是空的。'
      ]
    },

    {
      id: 'v38_young_gamble',
      band: '19-30',
      ageMin: 19, ageMax: 30,
      weight: 1,
      baseChance: 0.00029,
      riskBoost: 0.00038,
      title: '牌桌上的最后一手',
      text: '他已经在牌桌上坐了三天，输掉了准备结婚的钱，又借了高利贷。最后一把，他把车钥匙压了上去。',
      cond: {},
      risk: { marksAny: ['v38_gamble', 'v38_gamble_debt'], debtMin: 20000 },
      choices: [],
      terminal: true,
      ending: {
        cause: '被逼债时坠楼身亡',
        lastWords: '“再给我一次机会。”',
        relic: '一张写满数字的欠条',
        present: ['朋友', '伴侣'],
        tag: '欠着的人'
      },
      settle: [
        '那一手还是输了。债主把欠条拍在桌上，说三天之内见不到钱，就去他家里坐。',
        '第三天晚上，他站在七楼的窗台上，下面的人已经围了一圈。有人报了警，也有人举着手机。',
        '他松手之前，把手机放在了窗台上。屏幕上还是伴侣发来的消息：“你在哪，回来吃饭。”',
        '最后那张欠条被债主收走了。伴侣替他办完后事，才发现他连一份保险都没有。'
      ]
    },

    {
      id: 'v38_young_site',
      band: '19-30',
      ageMin: 19, ageMax: 30,
      weight: 1,
      baseChance: 0.00029,
      riskBoost: 0.00034,
      title: '没有系好的安全绳',
      text: '工地上赶工期，他在六层外架上拆模板，安全绳挂在身后的钢管上，扣子没有扣死。',
      cond: {},
      risk: { riskMin: { noExercise: 50 }, flagsAny: ['v38_overwork'] },
      choices: [],
      terminal: true,
      ending: {
        cause: '高处坠落，多发性创伤',
        lastWords: '（他喊了一声“绳子”，下面是风声）',
        relic: '一只磨破的手套',
        present: ['工友', '父亲'],
        tag: '工期没等人'
      },
      settle: [
        '扣子在受力的一瞬间滑开。他往后仰，安全绳从钢管上脱出去，像一条没有抓手的蛇。',
        '工友跑下楼时，他已经不动了。安全帽滚在水泥堆旁边，帽檐上有一道很深的裂口。',
        '包工头先打电话给劳务公司，再打电话给家属。父亲在电话里问了工地的地址，问了三遍。',
        '赔偿谈了一个月。工地的进度没有停，第二天就有人站到了他原来的位置。'
      ]
    },

    {
      id: 'v38_young_sudden',
      band: '19-30',
      ageMin: 19, ageMax: 30,
      weight: 1,
      baseChance: 0.00029,
      riskBoost: 0.00040,
      title: '凌晨两点的工位',
      text: '项目上线前一周，他连续几天睡在工位下面。那天凌晨，他站起来去接咖啡，胸口突然一紧，眼前发黑。隔壁工位的同事还盯着屏幕，没人注意到他扶着桌子往下滑。',
      cond: {},
      risk: { riskMin: { lateNight: 50, highStress: 50 }, marksAny: ['v38_overwork'] },
      choices: [
        {
          id: 'stop',
          label: '停下来，叫同事',
          hint: '项目可以明天再上',
          tone: 'safe',
          route: 'survive',
          fx: { at: { health: -14 }, set: { v38_heart_warn: true, v38_overwork: true }, risk: { highStress: -6 } },
          text: '同事把你扶到沙发上，打了急救电话。医生说是严重的心律失常，再晚一点就不好说了。'
        },
        {
          id: 'coffee',
          label: '喝杯咖啡，缓一缓',
          hint: '上线就在明天',
          tone: 'risk',
          route: 'ending',
          pDeath: 0.55,
          fx: { set: { v38_overwork: true }, risk: { lateNight: 8, highStress: 8 } },
          failText: '你在茶水间坐了很久，心跳慢慢平了下来。第二天项目上线，你请了半天假。'
        },
        {
          id: 'taxi',
          label: '自己下楼打车去医院',
          hint: '不想惊动同事',
          tone: 'warn',
          route: 'ending',
          pDeath: 0.35,
          fx: { set: { v38_heart_warn: true }, risk: { highStress: 4 } },
          failText: '出租车在楼下等了一会儿。你坐进后排，让司机去最近的医院。急诊说再晚半小时就危险了。'
        }
      ],
      ending: {
        cause: '过劳诱发心源性猝死',
        lastWords: '“等我缓一下。”',
        relic: '一只印着公司 logo 的保温杯',
        present: ['同事'],
        tag: '没熬过那个版本'
      },
      settle: [
        '他扶着工位隔板站了几秒，然后整个人滑到地上。杯子摔在旁边，咖啡洒了一地。',
        '同事做了心肺复苏，救护车到的时候，他的嘴唇已经发紫。',
        '医生在抢救室外面说，连续熬夜和高压会让心脏在最普通的一刻停下来。',
        '项目第二天照常上线。他的工位上放了一束花，第三天就被保洁收走了。'
      ]
    },

    {
      id: 'v38_young_delivery',
      band: '19-30',
      ageMin: 19, ageMax: 30,
      weight: 1,
      baseChance: 0.00029,
      riskBoost: 0.00036,
      title: '最后一单的超时提醒',
      text: '雨下得很大，手机上的倒计时还剩三分钟。他在路口闯了黄灯，外卖箱里的汤晃出来，洒在裤腿上。',
      cond: {},
      risk: { riskMin: { lateNight: 45 }, flagsAny: ['v38_speeder'] },
      choices: [],
      terminal: true,
      ending: {
        cause: '交通事故，内脏破裂',
        lastWords: '（手机还在响，是催单的提示音）',
        relic: '一只摔裂的保温箱',
        present: ['同事', '邻居'],
        tag: '最后一单没送到'
      },
      settle: [
        '一辆右转的水泥罐车把他连人带车卷进了后轮。雨声很大，路人一开始没有听见。',
        '外卖箱摔开，里面的汤和饭撒在积水里。手机屏幕亮着，倒计时停在“超时 1 分钟”。',
        '送到医院时，他的血压已经测不出来。医生说是脾破裂，失血太多。',
        '那单外卖最后被系统判了异常。顾客在电话里骂了几句，没有人告诉他送餐的人已经不在了。'
      ]
    },

    {
      id: 'v38_young_gas',
      band: '19-30',
      ageMin: 19, ageMax: 30,
      weight: 1,
      baseChance: 0.00029,
      riskBoost: 0.00030,
      title: '出租屋里的热水器',
      text: '老式燃气热水器装在密闭的浴室里，排气管锈穿了。他洗完澡觉得头晕，扶着墙想开窗，没走到窗边。',
      cond: {},
      risk: { flagsAny: ['v38_old_house'] },
      choices: [],
      terminal: true,
      ending: {
        cause: '一氧化碳中毒',
        lastWords: '（他手机里最后一条消息是“有点晕，先睡”）',
        relic: '一台锈穿排气管的热水器',
        present: ['朋友', '邻居'],
        tag: '窗户只差两步'
      },
      settle: [
        '第二天中午，朋友来敲门，没有人应。房东拿钥匙开了门，浴室的灯还亮着。',
        '他倒在窗边，窗户只推开了一条缝。热水器的排气管上有一圈锈穿的洞，正对着浴室。',
        '急救人员说，一氧化碳无色无味，人在发觉不对时往往已经走不动了。',
        '房东换了热水器，把房子又租了出去。朋友后来每次洗澡，都会先把窗户开到最大。'
      ]
    },

    /* ================= 31–55 岁（7 条） ================= */

    {
      id: 'v38_mid_heart',
      band: '31-55',
      ageMin: 31, ageMax: 55,
      weight: 1,
      baseChance: 0.00032,
      riskBoost: 0.00040,
      title: '胸口那一块石头',
      text: '加班到晚上十点，他在电梯里突然觉得胸口压了一块石头，左手发麻，冷汗顺着后背往下流。',
      cond: {},
      risk: { riskMin: { highStress: 50, badDiet: 50 }, marksAny: ['v38_heart_warn'], flagsAny: ['v38_overwork'] },
      choices: [
        {
          id: 'call',
          label: '立刻打 120',
          hint: '救护车十分钟到',
          tone: 'safe',
          route: 'ending',
          pDeath: 0.15,
          fx: { money: { cash: -12000 }, at: { health: -16 }, set: { v38_heart_warn: true } },
          failText: '急救人员给你做了心电图，把车开得很快。导管室的门关上时，你听见医生说“再晚一点就麻烦了”。'
        },
        {
          id: 'pill',
          label: '让伴侣拿速效救心丸',
          hint: '家里离医院只有两公里',
          tone: 'warn',
          route: 'ending',
          pDeath: 0.45,
          fx: { set: { v38_heart_warn: true }, risk: { highStress: 4 } },
          failText: '舌下的药片化开，胸口的石头慢慢松了一点。伴侣坚持打了急救电话，医生说这是捡回来的一条命。'
        },
        {
          id: 'drive',
          label: '自己开车去医院',
          hint: '不想等救护车',
          tone: 'risk',
          route: 'ending',
          pDeath: 0.55,
          fx: { set: { v38_heart_warn: true }, risk: { highStress: 6 } },
          failText: '你把车停在急诊门口，按了两次喇叭。保安过来时，你已经趴在方向盘上，但没有熄火。'
        }
      ],
      ending: {
        cause: '急性心肌梗死',
        lastWords: '“别叫救护车，太贵了。”',
        relic: '一板没吃完的速效救心丸',
        present: ['伴侣', '同事'],
        tag: '电梯停在半层'
      },
      settle: [
        '电梯停在半层，门开了一次又关上。他靠着轿厢壁坐下，手里的手机滑到地上。',
        '同事在下一层找到他时，他的嘴唇已经没有血色。有人按压，有人去拿 AED。',
        '到医院时，心电图已经没有可用的波形。医生说，堵塞的位置太靠前。',
        '那板速效救心丸还在他口袋里，只少了两粒。伴侣后来把它放在床头柜里，一直没有扔。'
      ]
    },

    {
      id: 'v38_mid_stroke',
      band: '31-55',
      ageMin: 31, ageMax: 55,
      weight: 1,
      baseChance: 0.00032,
      riskBoost: 0.00038,
      title: '早上系不上的鞋带',
      text: '他早上弯腰系鞋带，右手突然不听使唤，话也说不清楚。伴侣以为他没睡醒，让他坐一会儿。',
      cond: {},
      risk: { riskMin: { highStress: 50 }, flagsAny: ['v38_hypertension'] },
      choices: [
        {
          id: 'call',
          label: '立刻打 120',
          hint: '卒中要抢时间',
          tone: 'safe',
          route: 'ending',
          pDeath: 0.2,
          fx: { money: { cash: -15000 }, at: { health: -20 }, set: { v38_stroke_warn: true } },
          failText: '救护车把你送到卒中中心。医生在车上就联系了导管室，说这次送得还算及时。'
        },
        {
          id: 'wait',
          label: '等天亮再说',
          hint: '也许只是没睡好',
          tone: 'risk',
          route: 'ending',
          pDeath: 0.7,
          fx: { risk: { highStress: 4 } },
          failText: '你在沙发上睡了一觉，醒来时右手还是麻的。伴侣坚持带你去医院，医生说错过了最好的时间窗。'
        },
        {
          id: 'folk',
          label: '掐人中、放血',
          hint: '听邻居说的土办法',
          tone: 'risk',
          route: 'ending',
          pDeath: 0.75,
          fx: { at: { health: -6 } },
          failText: '邻居掐了半天人中，你的手指能动一点了。后来去医院，医生说这次运气好，堵得不深。'
        }
      ],
      ending: {
        cause: '急性脑卒中',
        lastWords: '（他想说“去医院”，说出口只有含糊的音节）',
        relic: '一只没有系好的皮鞋',
        present: ['伴侣', '子女'],
        tag: '话没说完'
      },
      settle: [
        '他坐在门口的换鞋凳上，右手垂在身侧，鞋带散着。伴侣去扶他，发现他的嘴角也歪了。',
        '救护车到的时候，他已经说不出完整的句子。医生在车上问家属，最后一次看见他正常是什么时候。',
        '血栓堵在脑干附近。手术做了四个小时，出来时人没有醒。',
        '第三天凌晨，监护仪上的线变得很平。那只皮鞋还摆在门口，鞋带一直没有系上。'
      ]
    },

    {
      id: 'v38_mid_cancer',
      band: '31-55',
      ageMin: 31, ageMax: 55,
      weight: 1,
      baseChance: 0.00032,
      riskBoost: 0.00038,
      title: '胃镜报告上的那行字',
      text: '他胃疼了半年，自己买了药吃。单位体检做了胃镜，报告上写着“占位性病变，建议进一步检查”。',
      cond: {},
      risk: { riskMin: { badDiet: 50 }, flagsAny: ['v38_smoker'] },
      choices: [
        {
          id: 'hospital',
          label: '立刻住院检查',
          hint: '早一天，多一分',
          tone: 'safe',
          route: 'ending',
          pDeath: 0.12,
          fx: { money: { cash: -20000 }, at: { health: -18 } },
          failText: '住院后做了增强 CT 和活检。医生说是早期，手术切得很干净，后面只要按时复查。'
        },
        {
          id: 'work',
          label: '先忙完这个项目',
          hint: '等项目结束再去',
          tone: 'risk',
          route: 'ending',
          pDeath: 0.45,
          fx: { set: { v38_overwork: true }, risk: { highStress: 8 } },
          failText: '项目结束后你去复查，医生说还在可控范围，但需要马上安排手术。你请了长假。'
        },
        {
          id: 'folk',
          label: '先吃偏方，听说很灵',
          hint: '病友群里推荐的',
          tone: 'risk',
          route: 'ending',
          pDeath: 0.6,
          fx: { money: { cash: -6000 }, at: { health: -8 } },
          failText: '偏方吃了两个月，胃疼轻了一点。复查时医生说病灶没有缩小，但还没有扩散。'
        }
      ],
      ending: {
        cause: '胃癌晚期，多器官衰竭',
        lastWords: '“等这阵忙完，我就去复查。”',
        relic: '一张折了很多次的体检报告',
        present: ['伴侣', '子女'],
        tag: '没来得及复查'
      },
      settle: [
        '报告在抽屉里放了三个月。他每次胃疼，就吃两片药，说明天就去。',
        '再去医院时，CT 上的阴影已经不止一处。医生把伴侣叫到走廊，说已经不适合手术。',
        '化疗做了四个周期。他瘦得很快，最后连上楼都要人扶。',
        '走的那天，床头还放着那张体检报告。折痕很深，建议那一行被手指磨得发白。'
      ]
    },

    {
      id: 'v38_mid_work',
      band: '31-55',
      ageMin: 31, ageMax: 55,
      weight: 1,
      baseChance: 0.00032,
      riskBoost: 0.00034,
      title: '叉车倒车的那一下',
      text: '仓库里灯光很暗，叉车倒车时没有鸣笛。他正蹲在地上贴标签，货叉从背后扫过来。',
      cond: {},
      risk: { riskMin: { noExercise: 50 }, flagsAny: ['v38_overwork'] },
      choices: [],
      terminal: true,
      ending: {
        cause: '工伤，胸腹联合伤',
        lastWords: '（他没有看见那一下）',
        relic: '一只磨掉漆的工牌',
        present: ['工友', '伴侣'],
        tag: '工牌还在打卡机里'
      },
      settle: [
        '货叉把他推出去两米，纸箱塌下来盖在他身上。叉车司机说后视镜里什么也没有。',
        '工友搬开箱子时，他的工牌还挂在胸前，上面的照片被血浸了一半。',
        '救护车到厂门口用了二十分钟。医生在车上说，内出血太多，要直接去市医院。',
        '工伤认定书下来后，厂里开了一次安全会。他的工牌从打卡机里取出来，放进了档案袋。'
      ]
    },

    {
      id: 'v38_mid_overwork',
      band: '31-55',
      ageMin: 31, ageMax: 55,
      weight: 1,
      baseChance: 0.00032,
      riskBoost: 0.00042,
      title: '第四杯浓茶',
      text: '连续一个月，他每天只睡四个小时。那天下午开会时，他站起来发言，话说到一半，人往后倒。',
      cond: {},
      risk: { riskMin: { highStress: 55, lateNight: 50 }, flagsAny: ['v38_overwork'] },
      choices: [
        {
          id: 'leave',
          label: '请假去医院',
          hint: '工作可以换人',
          tone: 'safe',
          route: 'survive',
          fx: { at: { health: -18 }, money: { cash: -5000 }, set: { v38_heart_warn: true } },
          text: '你被同事送到医院，医生让你至少休息一个月。项目换了一个负责人，天没有塌。'
        },
        {
          id: 'continue',
          label: '缓一缓，继续开会',
          hint: '这个方案只有你熟',
          tone: 'risk',
          route: 'ending',
          pDeath: 0.6,
          fx: { set: { v38_overwork: true }, risk: { highStress: 10 } },
          failText: '你扶着桌子站稳，把剩下的几分钟讲完了。会后你在洗手间吐了一次，第二天照常上班。'
        },
        {
          id: 'quit',
          label: '当场辞职',
          hint: '命比职位重要',
          tone: 'warn',
          route: 'survive',
          fx: { money: { cash: -3000, debt: 10000 }, at: { health: -10 }, set: { v38_heart_warn: true } },
          text: '你把工牌放在桌上，说身体扛不住了。领导愣了一下，签字比想象中快。'
        }
      ],
      ending: {
        cause: '过劳诱发心源性猝死',
        lastWords: '“这个方案明天……”',
        relic: '一只印着“先进工作者”的杯子',
        present: ['同事', '伴侣'],
        tag: '会没开完'
      },
      settle: [
        '他讲到一半，声音停了。手里的激光笔掉在地上，人往后仰，椅子滑出去半米。',
        '同事先以为是低血糖，喂了糖水。有人摸他的颈动脉，脸色变了。',
        '救护车到楼下时，会议室的投影还亮着。PPT 停在“下一步计划”那一页。',
        '伴侣赶到医院，只看到走廊尽头那盏一直亮着的灯。那只“先进工作者”的杯子，后来一直放在家里。'
      ]
    },

    {
      id: 'v38_mid_diabetes',
      band: '31-55',
      ageMin: 31, ageMax: 55,
      weight: 1,
      baseChance: 0.00032,
      riskBoost: 0.00035,
      title: '脚上那个不愈合的口子',
      text: '他糖尿病多年，脚底磨出一个水泡，自己挑破了。一个月后，伤口发黑，走路开始有臭味。',
      cond: {},
      risk: { riskMin: { badDiet: 55 }, flagsAny: ['v38_diabetes'] },
      choices: [],
      terminal: true,
      ending: {
        cause: '糖尿病足感染，败血症',
        lastWords: '“早知道就不挑那个泡了。”',
        relic: '一只剪开的旧布鞋',
        present: ['伴侣', '子女'],
        tag: '从脚底开始'
      },
      settle: [
        '他一开始没当回事，贴了创可贴继续上班。伤口越来越大，袜子脱下来时粘住了皮。',
        '到医院时，医生说要清创，可能保不住几个脚趾。他签了字，还在问多久能回去干活。',
        '感染沿着血液走。第二次手术前，他已经开始说胡话。',
        '最后那几天，他清醒过一次，让伴侣把那双旧布鞋扔了。伴侣没有扔，把它放进了柜子最里面。'
      ]
    },

    {
      id: 'v38_mid_drive',
      band: '31-55',
      ageMin: 31, ageMax: 55,
      weight: 1,
      baseChance: 0.00032,
      riskBoost: 0.00040,
      title: '高速上的第一百公里',
      text: '长途货运赶时间，他在高速上连续开了六个小时。凌晨两点，对面的远光灯晃过来，他踩刹车的脚慢了半拍。',
      cond: {},
      risk: { riskMin: { lateNight: 45 }, flagsAny: ['v38_speeder'] },
      choices: [],
      terminal: true,
      ending: {
        cause: '疲劳驾驶，追尾货车',
        lastWords: '（行车记录仪最后一段，是他打哈欠的声音）',
        relic: '一张揉皱的过路费票据',
        present: ['工友', '父亲'],
        tag: '离家还有八十公里'
      },
      settle: [
        '车头追进前车的尾部，驾驶室变形。救援队用液压钳剪了四十分钟，才把他弄出来。',
        '货单上写着“明早八点前送到”。收货方后来打电话催，没有人接。',
        '父亲接到电话时，正在家里给他留着门。老人问了三遍“哪条高速”，才把地址记下来。',
        '事故认定书上写着疲劳驾驶。那张过路费票据被夹在驾驶证里，日期停在事发那天。'
      ]
    },

    /* ================= 56 岁以上（只写意外型，3 条） ================= */

    {
      id: 'v38_old_fall',
      band: '56+',
      ageMin: 56, ageMax: 90,
      weight: 1,
      baseChance: 0.00060,
      riskBoost: 0.00035,
      kind: 'accident',
      title: '浴室地砖上的肥皂',
      text: '他独自在家洗澡，踩到一块肥皂，整个人向后倒，后脑磕在浴缸边缘。',
      cond: {},
      risk: { healthMax: 50, flagsAny: ['v38_lives_alone'] },
      choices: [],
      terminal: true,
      ending: {
        cause: '跌倒后颅内出血',
        lastWords: '（他在地上躺了很久，手机在客厅）',
        relic: '一块用到只剩薄片的肥皂',
        present: ['邻居', '子女'],
        tag: '客厅里的手机'
      },
      settle: [
        '浴室的灯一直亮着。水从浴缸里漫出来，顺着地砖流到门口。',
        '邻居第二天早上听见水声，敲门没人应，叫来了物业。门打开时，他躺在浴缸旁边，人还有一口气。',
        '送到医院后，CT 显示硬膜下出血。医生说要开颅，但年纪大了，风险很高。',
        '子女从外地赶回来，在 ICU 外面守了三天。最后那一下心跳，是在夜里停的。'
      ]
    },

    {
      id: 'v38_old_traffic',
      band: '56+',
      ageMin: 56, ageMax: 90,
      weight: 1,
      baseChance: 0.00060,
      riskBoost: 0.00030,
      kind: 'accident',
      title: '买菜回来的路口',
      text: '早上他骑自行车去买菜，绿灯还剩几秒，他想赶过去。右转的水泥罐车没有看见他。',
      cond: {},
      risk: { healthMax: 55 },
      choices: [],
      terminal: true,
      ending: {
        cause: '交通事故，多发性创伤',
        lastWords: '（菜篮里的鸡蛋碎了一地）',
        relic: '一只装着青菜的布袋',
        present: ['邻居', '子女'],
        tag: '菜没买回家'
      },
      settle: [
        '自行车被卷到车轮下面，人摔在斑马线外侧。绿灯还亮着，倒计时停在“3”。',
        '司机下车后一直说自己没有看见。路口没有右转专用灯，监控里两个人都在往前。',
        '救护车来的时候，他还能说出家里的门牌号。到医院后，血压一直往下掉。',
        '那只布袋子被邻居捡了回来，青菜上沾着灰。子女后来把它洗干净，放进了厨房。'
      ]
    },

    {
      id: 'v38_old_fire',
      band: '56+',
      ageMin: 56, ageMax: 90,
      weight: 1,
      baseChance: 0.00060,
      riskBoost: 0.00032,
      kind: 'accident',
      title: '夜里忘记关的煤气阀',
      text: '他睡前忘了关煤气阀，厨房里有一锅正在炖的汤。半夜汤烧干，锅底烧穿，火沿着油烟机往上走。',
      cond: {},
      risk: { flagsAny: ['v38_lives_alone'], healthMax: 55 },
      choices: [],
      terminal: true,
      ending: {
        cause: '火灾中吸入烟气',
        lastWords: '（他先醒了，去推卧室的门，门把手是烫的）',
        relic: '一只烧黑的锅铲',
        present: ['邻居', '子女'],
        tag: '厨房里的那锅汤'
      },
      settle: [
        '火先从厨房烧起来。他醒了，披上外套去关阀门，手碰到了烧红的把手。',
        '邻居闻到焦味，报了警。消防车到的时候，厨房的窗户已经烧裂，烟从门缝往外冒。',
        '消防员在卧室门口找到他，人已经没有了呼吸。锅里那点汤早就烧干，只剩一层黑色的渣。',
        '子女收拾房子时，把那口锅和锅铲一起扔了。邻居说，老人平时总说一个人住，开火要小心。'
      ]
    }

  ];

  /* =========================================================
     v3.8 扩容：34 → 82 条
     目标分布（100 局）：0-6 6%、7-12 9%、13-18 12%、
     19-30 18%、31-55 15%（合计 60%），56+ 意外 3%，其余寿终。
     ========================================================= */
  V.ENDINGS.push(

    /* ---------- 0-6：+5，3 条选择型 ---------- */
    {
      id: 'v38_infant_drop', band: '0-6', ageMin: 0, ageMax: 6,
      weight: 2.5, baseChance: 0.00040, riskBoost: 0.0060,
      stageTarget: 'child', requires: {},
      title: '从炕上摔下来',
      text: '大人转身去端水，孩子从炕沿翻了下去，后脑勺磕在煤炉边。哭声先是很响，然后突然停了。',
      cond: {}, risk: { healthMax: 50 },
      choices: [
        { id: 'hospital', label: '连夜去县医院', hint: '路上要两个小时', tone: 'safe', route: 'survive',
          fx: { money: { cash: -1500 }, at: { health: -4 }, npc: { 母亲: { favor: 4, intimacy: 6 } } },
          text: '父亲借了邻居的三轮车。孩子在母亲怀里吐了一次，到了县医院，医生说要留院观察。' },
        { id: 'watch', label: '先抱起来哄一哄', hint: '说不定只是吓着了', tone: 'warn', route: 'ending', pDeath: 0.60, ageAdvance: 1,
          fx: { set: { v38_infant_drop_watch: true } },
          text: '孩子睡着了。半夜，母亲怎么叫都叫不醒。' },
        { id: 'folk', label: '找村里会看的老人', hint: '老人说揉一揉就好', tone: 'risk', route: 'ending', pDeath: 0.75, ageAdvance: 1,
          fx: { set: { v38_infant_drop_watch: true } },
          text: '老人用烧酒揉了后脑勺，说“没事”。天亮时，孩子的呼吸已经乱了。' }
      ],
      ending: {
        cause: '颅内出血，送到医院时瞳孔已经散了',
        lastWords: '（他还不会说完整的句子，只在母亲怀里哼了一声）',
        relic: '一只掉漆的拨浪鼓',
        present: ['母亲', '父亲'],
        tag: '炕沿边的一跤'
      },
      settle: [
        '孩子从炕上摔下来的时候，母亲正在灶台边端水。她听见哭声，转身看见孩子趴在地上，后脑勺贴着煤炉边。',
        '县医院离村子四十里。三轮车走到一半，孩子吐了母亲一身，之后就没有再哭。',
        '急诊室的灯很白。医生翻起孩子的眼皮，摇了摇头。母亲一直抱着那只拨浪鼓，直到天亮。'
      ]
    },

    {
      id: 'v38_infant_pneumonia', band: '0-6', ageMin: 0, ageMax: 6,
      weight: 2.5, baseChance: 0.00040, riskBoost: 0.0040,
      stageTarget: 'child', requires: {},
      title: '咳了半个月',
      text: '孩子咳了半个月，夜里喘得像拉风箱。母亲去镇上买了两瓶止咳糖浆，喝完还是咳。',
      cond: {}, risk: { healthMax: 48 },
      choices: [
        { id: 'county', label: '去县医院拍片子', hint: '要花掉半个月工钱', tone: 'safe', route: 'survive',
          fx: { money: { cash: -2000 }, at: { health: -6 } },
          text: '片子出来，医生说是肺炎，要住院。孩子在医院住了九天，出院时瘦了一圈。' },
        { id: 'medicine', label: '再买一瓶止咳糖浆', hint: '也许再喝两天就好了', tone: 'warn', route: 'ending', pDeath: 0.45, ageAdvance: 1,
          fx: { money: { cash: -300 } },
          text: '糖浆喝完了，咳嗽没有停。孩子开始发烧，嘴唇发紫。' },
        { id: 'wait', label: '盖厚被子发汗', hint: '老人说发汗就能好', tone: 'risk', route: 'ending', pDeath: 0.70, ageAdvance: 1,
          text: '被子盖了三层。孩子出了一身汗，天亮时呼吸变得很轻。' }
      ],
      ending: {
        cause: '重症肺炎，转院途中呼吸衰竭',
        lastWords: '（他抓住母亲的衣角，力气越来越小）',
        relic: '半瓶没喝完的止咳糖浆',
        present: ['母亲'],
        tag: '没等到开春的孩子'
      },
      settle: [
        '止咳糖浆是镇上小卖部买的，瓶身上印着一行看不清的小字。孩子喝到第二瓶，咳嗽反而更重了。',
        '转院那天下了雨。母亲抱着孩子坐在班车最后一排，车窗上全是雾。',
        '车到半路，孩子的呼吸停了。司机把车停在路边，母亲还在拍他的背。'
      ]
    },

    {
      id: 'v38_infant_waterjar', band: '0-6', ageMin: 0, ageMax: 6,
      weight: 2.5, baseChance: 0.00038, riskBoost: 0.0050,
      stageTarget: 'child', requires: {},
      title: '水缸盖没盖',
      text: '院子里那口大水缸刚挑满水，缸沿只到孩子胸口。母亲在屋里择菜，父亲蹲在门槛上抽烟，隔壁邻居家的门开着，忽然听见“扑通”一声。',
      cond: {}, risk: { healthMax: 50 },
      choices: [
        { id: 'pull', label: '立刻捞起来压胸口', hint: '村里老人教过', tone: 'safe', route: 'survive',
          fx: { at: { health: -8 }, npc: { 母亲: { favor: 6 } } },
          text: '母亲把孩子倒提起来，拍后背。孩子吐了几口水，哭出了声。' },
        { id: 'wait', label: '等父亲回来再说', hint: '也许他自己会爬出来', tone: 'risk', route: 'ending', pDeath: 0.80, ageAdvance: 1,
          text: '父亲回来时，水缸里已经没有了动静。' },
        { id: 'neighbor', label: '跑去喊邻居', hint: '来回要几分钟', tone: 'warn', route: 'ending', pDeath: 0.60, ageAdvance: 1,
          text: '邻居跟着跑回来，把孩子捞上来时，他的嘴唇已经发青。' }
      ],
      ending: {
        cause: '溺水窒息',
        lastWords: '（水缸里只冒了几个泡）',
        relic: '一只漂在水面上的小凉鞋',
        present: ['母亲', '邻居'],
        tag: '水缸沿上的孩子'
      },
      settle: [
        '那口缸是去年新买的，缸沿齐着大人的膝盖。孩子踩着板凳够水，板凳翻了。',
        '母亲把他捞上来时，他的手里还攥着一片菜叶。',
        '邻居说，再早两分钟就好了。母亲后来把那口缸砸了，院子里留下一圈湿印。'
      ]
    },

    {
      id: 'v38_infant_coal', band: '0-6', ageMin: 0, ageMax: 6,
      weight: 1, baseChance: 0.00032, riskBoost: 0.0015,
      stageTarget: 'child', requires: {},
      title: '煤炉边的午睡',
      text: '冬天的堂屋烧着煤炉，门关得严。孩子睡在炉边的竹床上，母亲去隔壁串门。',
      cond: {}, risk: { healthMax: 55 },
      choices: [], terminal: true,
      ending: {
        cause: '一氧化碳中毒',
        lastWords: '（他睡得很沉，脸上还带着笑）',
        relic: '一只搪瓷缸',
        present: ['父亲', '母亲'],
        tag: '没有开窗的冬天'
      },
      settle: [
        '父亲回来时，屋里有一股甜味。他叫了两声，孩子没有应。',
        '竹床边的煤炉还红着，窗户关得死死的。父亲把孩子抱到院子里，邻居说赶紧送卫生院。',
        '卫生院的值班医生只看了看瞳孔，就让准备后事。那天夜里下了雪，堂屋的门一直开着。'
      ]
    },

    {
      id: 'v38_infant_truck', band: '0-6', ageMin: 0, ageMax: 6,
      weight: 1, baseChance: 0.00032, riskBoost: 0.0012,
      stageTarget: 'child', requires: {},
      title: '村口倒车的货车',
      text: '村口在卸砖。货车倒车时，孩子正蹲在地上捡一块红色的塑料片。司机说他没有看见。',
      cond: {}, risk: { healthMax: 60 },
      choices: [], terminal: true,
      ending: {
        cause: '倒车碾压，当场死亡',
        lastWords: '（他手里还攥着那块红色塑料片）',
        relic: '一辆塑料小汽车',
        present: ['父亲', '邻居'],
        tag: '村口的那块红塑料'
      },
      settle: [
        '货车是外村来的，车斗里装着半车红砖。倒车的时候，司机只看了一侧后视镜。',
        '父亲听见邻居喊，跑过去时，孩子已经躺在后轮下面。',
        '司机蹲在地上抽烟，手一直抖。父亲没有打他，只是把孩子抱起来，往卫生院走。'
      ]
    },

    /* ---------- 7-12：+8，3 条选择型 ---------- */
    {
      id: 'v38_child_river', band: '7-12', ageMin: 7, ageMax: 12,
      weight: 2.5, baseChance: 0.00040, riskBoost: 0.0060,
      stageTarget: 'child', requires: {},
      title: '结伴下河',
      text: '放学后，三个孩子把书包藏在玉米地里，脱了鞋下河。河水刚没过膝盖，再往前一步，脚就踩空了。',
      cond: {}, risk: { happinessMax: 45 },
      choices: [
        { id: 'swim', label: '往深水区游', hint: '他们说河中间有鱼', tone: 'risk', route: 'ending', pDeath: 0.65, ageAdvance: 0,
          text: '他往前迈了一步，水面没过了胸口。' },
        { id: 'bank', label: '留在岸边看衣服', hint: '不下去就不会有事', tone: 'safe', route: 'survive',
          fx: { at: { happiness: -8 }, set: { v38_child_river_watch: true } },
          text: '他坐在岸边，看着同学在水里扑腾。后来大人来了，把他骂了一顿。' },
        { id: 'shout', label: '跑回村喊大人', hint: '同学还在水里', tone: 'warn', route: 'survive',
          fx: { at: { happiness: -4 }, npc: { 同学: { favor: 3 } } },
          text: '他跑回村，鞋丢了一只。大人赶到时，同学已经被冲到了下游。' }
      ],
      ending: {
        cause: '溺水，三天后在下游的拦水坝找到',
        lastWords: '（他最后看见的是岸上的书包）',
        relic: '一只塑料凉鞋',
        present: ['同学', '邻居'],
        tag: '河中间的那一步'
      },
      settle: [
        '河是村东头那条，夏天水不深，冬天能看见河底的石头。可河中间有一道挖沙留下的深坑。',
        '他往前迈了一步，脚底就空了。岸上的同学以为他在扎猛子，还笑了一声。',
        '大人沿着河找了三天，最后在拦水坝下面找到他。书包还在玉米地里，里面有一张没写完的数学卷子。'
      ]
    },

    {
      id: 'v38_child_bike', band: '7-12', ageMin: 7, ageMax: 12,
      weight: 2.5, baseChance: 0.00040, riskBoost: 0.0050,
      stageTarget: 'child', requires: {},
      title: '冲坡',
      text: '村后那道坡又长又陡。孩子骑着二八大杠，从坡顶往下冲，车链子响得像要散架。',
      cond: {}, risk: { happinessMax: 40 },
      choices: [
        { id: 'brake', label: '捏刹车慢慢下', hint: '车闸早就磨薄了', tone: 'safe', route: 'survive',
          fx: { at: { health: -4 } },
          text: '车闸捏到底，车子还是滑了十几米。他摔在路边的草垛上，膝盖破了一块皮。' },
        { id: 'rush', label: '站起来冲下去', hint: '风大，眼睛都睁不开', tone: 'risk', route: 'ending', pDeath: 0.60, ageAdvance: 0,
          text: '前轮撞上一块石头，车把猛地一偏。' },
        { id: 'jump', label: '半路跳车', hint: '跳下去可能摔在石头上', tone: 'warn', route: 'ending', pDeath: 0.35, ageAdvance: 0,
          text: '他松开手往路边跳，后脑勺磕在水泥渠沿上。' }
      ],
      ending: {
        cause: '颅脑损伤，送到镇卫生院时已无意识',
        lastWords: '（他摔在地上，第一句话是“车没坏吧”）',
        relic: '一辆掉漆的自行车',
        present: ['同学'],
        tag: '冲下坡的人'
      },
      settle: [
        '坡底有一个水泥渠沿，是村里修渠时留下的。自行车前轮撞上去，车把弯成了直角。',
        '同学跑回村叫大人。父亲赶到时，他还睁着眼，问“车没坏吧”。',
        '镇卫生院做了简单处理，让往县里送。救护车走到半路，他睡着了，再也没有醒。'
      ]
    },

    {
      id: 'v38_child_stranger', band: '7-12', ageMin: 7, ageMax: 12,
      weight: 2.5, baseChance: 0.00040, riskBoost: 0.0040,
      stageTarget: 'child', requires: {},
      title: '陌生人说带你去找妈妈',
      text: '放学路上，一辆面包车停在孩子旁边。车里的人说，你妈在镇上等你，上车吧。',
      cond: {}, risk: { happinessMax: 45 },
      choices: [
        { id: 'getin', label: '上车', hint: '他说认识你妈', tone: 'risk', route: 'ending', pDeath: 0.70, ageAdvance: 2,
          text: '车门关上，玻璃贴了膜，外面什么都看不清。' },
        { id: 'run', label: '转身往小卖部跑', hint: '小卖部人多', tone: 'safe', route: 'survive',
          fx: { at: { happiness: -6 }, set: { v38_child_stranger_escape: true } },
          text: '他跑进小卖部，老板问他怎么了。面包车在门口停了一会儿，开走了。' },
        { id: 'shout', label: '站在路边大喊', hint: '路上没有别人', tone: 'warn', route: 'survive',
          fx: { at: { happiness: -4 } },
          text: '他喊了两声，面包车没有停。后来村里的大人骑着摩托追了一段，没有追上。' }
      ],
      ending: {
        cause: '被拐后下落不明，两年后确认死亡',
        lastWords: '（他在车里一直说“我妈在镇上”）',
        relic: '一只书包',
        present: ['邻居', '老师'],
        tag: '没有走出村口的人'
      },
      settle: [
        '面包车是银灰色的，车牌用泥糊住了。孩子上车后，车门从里面锁上。',
        '村里找了半个月，贴了寻人启事。母亲把孩子的书包挂在门口，每天擦一遍。',
        '两年后，邻省警方传来消息，说在一个废弃砖窑里发现了遗物。书包里的数学本还在，最后一页写着“妈妈来接我”。'
      ]
    },

    {
      id: 'v38_child_well', band: '7-12', ageMin: 7, ageMax: 12,
      weight: 1, baseChance: 0.00030, riskBoost: 0.0015,
      stageTarget: 'child', requires: {},
      title: '枯井没有盖',
      text: '村西的枯井早就不用了，井口只搭了半块水泥板。孩子在井边追一只蚂蚱。',
      cond: {}, risk: { happinessMax: 50 },
      choices: [], terminal: true,
      ending: {
        cause: '坠井后窒息',
        lastWords: '（井底传来一声很短的回音）',
        relic: '一只塑料水壶',
        present: ['邻居'],
        tag: '井口那半块水泥板'
      },
      settle: [
        '枯井有七八米深，井壁长满青苔。孩子踩空时，手里还抓着那只装蚂蚱的塑料瓶。',
        '邻居听见回声，趴在井口喊他的名字。下面只有水壶碰到井壁的声音。',
        '村里人用绳子把他吊上来，已经过了半个多小时。母亲赶到时，井口围满了人。'
      ]
    },

    {
      id: 'v38_child_kitchen', band: '7-12', ageMin: 7, ageMax: 12,
      weight: 1, baseChance: 0.00030, riskBoost: 0.0012,
      stageTarget: 'child', requires: {},
      title: '灶台上的热油',
      text: '母亲把一锅油烧在灶上，去院子里收衣服。孩子踩着板凳，想看看锅里炸的丸子。',
      cond: {}, risk: { happinessMax: 50 },
      choices: [], terminal: true,
      ending: {
        cause: '热油烫伤继发感染',
        lastWords: '（他疼得没有哭出声）',
        relic: '一只铁锅',
        present: ['母亲'],
        tag: '灶台边的一锅油'
      },
      settle: [
        '油锅翻下来的时候，孩子从板凳上摔到灶膛边。母亲听见响声，跑进来时，孩子的半边脸和胳膊已经起了泡。',
        '镇卫生院涂了药，说不要紧。第三天，孩子开始发烧，伤口流出黄水。',
        '转到县医院时，医生说感染太重。母亲一直说是自己不好，锅不该放在灶上。'
      ]
    },

    {
      id: 'v38_child_floor', band: '7-12', ageMin: 7, ageMax: 12,
      weight: 1, baseChance: 0.00030, riskBoost: 0.0010,
      stageTarget: 'child', requires: {},
      title: '没封顶的二楼',
      text: '村里有人盖房，二楼楼板还没浇完，边上只拦了一根竹竿。孩子跟着大孩子上去捡弹珠。',
      cond: {}, risk: { happinessMax: 45 },
      choices: [], terminal: true,
      ending: {
        cause: '高处坠落，颅脑损伤',
        lastWords: '（他手里还攥着两颗弹珠）',
        relic: '一只装弹珠的布袋',
        present: ['工友', '邻居'],
        tag: '没封顶的二楼'
      },
      settle: [
        '楼板边缘的钢筋露在外面，竹竿一碰就晃。孩子弯腰去捡弹珠，脚下的木板滑了。',
        '工友听见声音，跑过来时，孩子躺在楼下的砖堆上。',
        '包工头开着面包车送人去县医院。路上孩子一直没有醒，弹珠从手里滚到了座位底下。'
      ]
    },

    {
      id: 'v38_child_rail', band: '7-12', ageMin: 7, ageMax: 12,
      weight: 1, baseChance: 0.00030, riskBoost: 0.0010,
      stageTarget: 'child', requires: {},
      title: '铁路边的蛇皮袋',
      text: '铁路边能捡到矿泉水瓶，一个能卖两分钱。孩子沿着铁轨走，听见后面有汽笛。',
      cond: {}, risk: { happinessMax: 40 },
      choices: [], terminal: true,
      ending: {
        cause: '被列车撞击，当场死亡',
        lastWords: '（他回头看了一眼，脚却卡在道岔里）',
        relic: '一只装瓶子的蛇皮袋',
        present: ['同学'],
        tag: '铁路边的两分钱'
      },
      settle: [
        '那段铁路没有护栏，村里孩子常去捡瓶子。孩子走在两根铁轨中间，蛇皮袋拖在身后。',
        '列车从弯道后面出来时，司机拉了笛。同学站在坡上喊他，他回头看了一眼。',
        '警察来的时候，蛇皮袋里的瓶子一个都没碎。母亲把袋子拿回家，放在门后，很久没有卖。'
      ]
    },

    {
      id: 'v38_child_ice', band: '7-12', ageMin: 7, ageMax: 12,
      weight: 1, baseChance: 0.00030, riskBoost: 0.0012,
      stageTarget: 'child', requires: {},
      title: '冰面下的水',
      text: '村后的水库结了冰，孩子在冰面上滑。冰层中间有一道裂纹，是从岸边一直延伸过去的。',
      cond: {}, risk: { happinessMax: 45 },
      choices: [], terminal: true,
      ending: {
        cause: '冰面破裂溺水',
        lastWords: '（冰水没过了他的胸口，他还在往前扑）',
        relic: '一只棉手套',
        present: ['同学'],
        tag: '冰面中间的那道裂纹'
      },
      settle: [
        '水库边的冰厚，中间薄。孩子滑到裂纹附近，脚下的冰发出“咔嚓”一声。',
        '同学趴在岸边，把一根树枝伸过去。他抓住树枝，冰又裂了一块。',
        '大人赶来时，冰面上只剩那只棉手套。打捞到第二天下午，才在水库下游找到人。'
      ]
    },

    /* ---------- 13-18：+10，含犯罪线 2 个节点 ---------- */
    {
      id: 'v38_line_crime_first', band: '13-18', ageMin: 13, ageMax: 18,
      weight: 2, baseChance: 0.00005, riskBoost: 0.0040,
      stageTarget: 'teen', requires: {},
      title: '网吧桌上的手机',
      text: '通宵网吧里，隔壁机位的人趴着睡着了，手机放在桌角。你起身去接水，路过时手停了一下。',
      cond: {}, risk: { happinessMax: 45, riskMin: { highStress: 45 } },
      choices: [
        { id: 'return', label: '把手机推回他手边', hint: '就当没看见', tone: 'safe', route: 'survive',
          fx: { at: { happiness: 2 }, set: { v38_line_crime_stop: true } },
          text: '你把手机推回去，他动了一下，没有醒。你接完水回来，天快亮了。' },
        { id: 'keep', label: '揣进兜里', hint: '他醒来也不会记得', tone: 'warn', route: 'survive',
          fx: { set: { v38_line_crime_start: true }, risk: { highStress: 5 } },
          text: '你把手机揣进兜里，心跳得很快。出门时，网吧老板看了你一眼。' },
        { id: 'sell', label: '拿去二手店卖掉', hint: '能换半个月网费', tone: 'risk', route: 'survive',
          fx: { money: { cash: 300 }, set: { v38_line_crime_start: true, v38_line_crime_deep: true }, risk: { highStress: 8 } },
          text: '二手店老板没有问来路，给了你三百。你拿着钱，又回了网吧。' },
        { id: 'resist', label: '被他发现后推他一把', hint: '他抓住了你的袖子', tone: 'risk', route: 'ending', pDeath: 0.35, ageAdvance: 0,
          text: '他醒来抓住你的袖子，你推了他一把。他的后脑勺磕在机箱上。' }
      ],
      ending: {
        cause: '推搡中后脑撞击，颅内出血',
        lastWords: '“我没拿……”',
        relic: '一部屏幕裂开的旧手机',
        present: ['朋友'],
        tag: '网吧里的第一次'
      },
      settle: [
        '网吧的灯是蓝的，机箱风扇一直响。他倒下去的时候，没有人听见。',
        '老板报了警。警察调了监控，看见你从他桌边走过。',
        '你在派出所里一直说“我没拿”。那部手机后来作为证物装进了塑料袋。'
      ]
    },

    {
      id: 'v38_line_crime_second', band: '13-18', ageMin: 13, ageMax: 18,
      weight: 2, baseChance: 0.00005, riskBoost: 0.0050,
      stageTarget: 'teen', requires: { flag: 'v38_line_crime_start' },
      title: '第二次',
      text: '第一次没有被抓到，第二次就顺手了。这次是学校门口的电动车，钥匙还插在车上。',
      cond: { flagsAny: ['v38_line_crime_start'] },
      risk: { riskMin: { highStress: 50 } },
      choices: [
        { id: 'stop', label: '把车推回原位', hint: '就当没发生过', tone: 'safe', route: 'survive',
          fx: { at: { happiness: 4 }, set: { v38_line_crime_stop: true } },
          text: '你把车推回原位，钥匙还插着。那天晚上你睡得很沉。' },
        { id: 'deeper', label: '骑走卖掉', hint: '已经回不了头了', tone: 'risk', route: 'survive',
          fx: { money: { cash: 500 }, set: { v38_line_crime_deep: true }, risk: { highStress: 10 } },
          text: '你把车骑到邻镇，卖了五百。回来的路上，你觉得路边的监控都在看你。' },
        { id: 'surrender', label: '去派出所自首', hint: '少管所一年', tone: 'warn', route: 'sentence', sentence: { years: 1 },
          fx: { rep: { society: -8 }, at: { happiness: -6 } },
          text: '父亲陪你去的。警察做了笔录，说未成年，送少管所一年。' },
        { id: 'run', label: '连夜跑路', hint: '跑了就回不了头', tone: 'risk', route: 'ending', pDeath: 0.55, ageAdvance: 2,
          fx: { set: { v38_wanted: true }, risk: { highStress: 12 } },
          text: '你坐上最后一班车，天亮时到了邻省。' }
      ],
      ending: {
        cause: '盗窃转化为抢劫，拒捕时被刺伤后死亡',
        lastWords: '“别告诉我爸。”',
        relic: '一把电动车的钥匙',
        present: ['朋友'],
        tag: '第二次没有回头'
      },
      release: {
        title: '少管所的铁门',
        text: '一年，说长不长。你出来那天，父亲在门口蹲着抽烟。',
        settle: [
          '你在少管所待了一年，出来时十八岁。',
          '案底跟着你，学校不要你复读，招工的地方看见记录就摇头。',
          '父亲老了很多，母亲没有来接你。你站在门口，第一次觉得太阳很刺眼。'
        ]
      },
      settle: [
        '你跑到邻省，在一个修车铺打黑工。两年后，老板丢了钱，第一个怀疑你。',
        '你和他打起来，顺手抄了桌上的螺丝刀。警察到的时候，你身上全是血。',
        '你死在去医院的路上。那把电动车钥匙一直挂在你的钥匙扣上，没有人知道它开过哪辆车。'
      ]
    },

    {
      id: 'v38_teen_dare', band: '13-18', ageMin: 13, ageMax: 18,
      weight: 2.5, baseChance: 0.00040, riskBoost: 0.0700,
      stageTarget: 'teen', requires: {},
      title: '天台上的两步',
      text: '两栋楼的天台之间隔着一步半。同学举着手机，说跳过去就发视频，点赞能过千。',
      cond: {}, risk: { happinessMax: 40 },
      choices: [
        { id: 'jump', label: '跳过去', hint: '视频里的人都跳了', tone: 'risk', route: 'ending', pDeath: 0.60, ageAdvance: 0,
          text: '你退后两步，助跑，起跳。脚没有踩到对面的边沿。' },
        { id: 'back', label: '退回来', hint: '视频不拍也罢', tone: 'safe', route: 'survive',
          fx: { at: { happiness: -4 }, npc: { 同学: { favor: -3 } } },
          text: '你退回来，同学笑你怂。你把视频删了，但那天晚上一直睡不着。' },
        { id: 'hold', label: '让同学拉住你的手', hint: '他也未必拉得住', tone: 'warn', route: 'ending', pDeath: 0.30, ageAdvance: 0,
          text: '你让他抓住你的手腕。他抓住了，但手心全是汗。' }
      ],
      ending: {
        cause: '高空坠落，当场死亡',
        lastWords: '（他起跳时还回头看了一眼镜头）',
        relic: '一部屏幕摔碎的手机',
        present: ['同学'],
        tag: '天台上的两步'
      },
      settle: [
        '两栋楼是旧厂区的宿舍，天台边只有一道半米高的矮墙。手机镜头里，对面的楼顶看起来很近了。',
        '他起跳的时候，同学还在喊“再跳一次”。脚踩空后，人没有抓住任何东西。',
        '楼下是水泥地。手机从口袋里滑出来，屏幕碎成了蛛网，视频还停在拍摄界面。'
      ]
    },

    {
      id: 'v38_teen_pill', band: '13-18', ageMin: 13, ageMax: 18,
      weight: 2.5, baseChance: 0.00040, riskBoost: 0.0060,
      stageTarget: 'teen', requires: {},
      title: '混着吃药',
      text: '感冒药、退烧药、止痛片，桌上摆了一排。他嫌好得慢，每样都加了一倍。',
      cond: {}, risk: { healthMax: 50, happinessMax: 40 },
      choices: [
        { id: 'hospital', label: '去急诊洗胃', hint: '要被同学知道', tone: 'safe', route: 'survive',
          fx: { money: { cash: -800 }, at: { health: -6 } },
          text: '你在急诊室吐了半夜。医生问你吃了多少，你说不记得了。' },
        { id: 'sleep', label: '睡一觉就好了', hint: '以前也这样', tone: 'warn', route: 'ending', pDeath: 0.55, ageAdvance: 0,
          text: '你躺在床上，心跳越来越快，耳朵里全是嗡鸣。' },
        { id: 'more', label: '再加两片', hint: '也许剂量不够', tone: 'risk', route: 'ending', pDeath: 0.80, ageAdvance: 0,
          text: '你又吞了两片。半小时后，你开始呕吐，随后失去了意识。' }
      ],
      ending: {
        cause: '药物过量导致急性肝衰竭',
        lastWords: '“我有点困……”',
        relic: '一只空药板',
        present: ['朋友'],
        tag: '桌上的那一排药'
      },
      settle: [
        '桌上摆着三种药，都是从小诊所买的。他嫌好得慢，每样加了一倍。',
        '朋友来找他打游戏，看见他躺在床上，脸色发黄，怎么叫都不应。',
        '急诊室的洗胃管插进去时，他已经没有了反应。医生说是对乙酰氨基酚过量。'
      ]
    },

    {
      id: 'v38_teen_factory', band: '13-18', ageMin: 13, ageMax: 18,
      weight: 2.5, baseChance: 0.00040, riskBoost: 0.0060,
      stageTarget: 'teen', requires: { hazard: 'lateNight' },
      title: '暑假工的夜班',
      text: '暑假工在镇上的五金厂，夜班从晚上八点到早上八点。工头说，连上七天给全勤。',
      cond: {}, risk: { riskMin: { lateNight: 45 } },
      choices: [
        { id: 'continue', label: '连上第七个夜班', hint: '全勤奖三百', tone: 'risk', route: 'ending', pDeath: 0.45, ageAdvance: 0,
          fx: { set: { v38_overwork: true }, money: { cash: 300 } },
          text: '第七个夜班，你站在冲压机前，眼睛怎么也睁不开。' },
        { id: 'leave', label: '跟工头请假', hint: '全勤奖没了', tone: 'safe', route: 'survive',
          fx: { at: { happiness: -4 }, set: { v38_overwork: true } },
          text: '工头骂了你两句，还是让你回去了。你睡了十四个小时。' },
        { id: 'sneak', label: '躲在仓库里睡', hint: '被发现了要扣钱', tone: 'warn', route: 'survive',
          fx: { money: { cash: -100 }, set: { v38_overwork: true } },
          text: '你在仓库的纸箱堆里睡着了。工头找到你时，天已经亮了。' }
      ],
      ending: {
        cause: '夜班疲劳操作，被冲压机卷入',
        lastWords: '（机器停下来时，车间里没有人听见喊声）',
        relic: '一只厂牌',
        present: ['工友'],
        tag: '第七个夜班'
      },
      settle: [
        '冲压机的声音很大，车间里说话要靠吼。第七个夜班，他站在机器前，眼睛闭了一下。',
        '手伸进去的时候，机器没有停。工友按下急停，但已经晚了。',
        '厂里赔了一笔钱，工头被带走了几天。那只厂牌后来挂在车间墙上，名字被机油盖住了。'
      ]
    },

    {
      id: 'v38_teen_ice', band: '13-18', ageMin: 13, ageMax: 18,
      weight: 1, baseChance: 0.00028, riskBoost: 0.0015,
      stageTarget: 'teen', requires: {},
      title: '水库夜里的冰',
      text: '几个人翻过水库的铁丝网，到冰面上拍夜景。冰层下面有水流的声音。',
      cond: {}, risk: { happinessMax: 45 },
      choices: [], terminal: true,
      ending: {
        cause: '冰面破裂溺水',
        lastWords: '（手机掉在冰上，闪光灯还亮着）',
        relic: '一只运动鞋',
        present: ['同学'],
        tag: '水库夜里的冰'
      },
      settle: [
        '水库的铁丝网有个缺口，是被人剪开的。几个人钻进去，冰面上有月光。',
        '他蹲下拍照时，脚下的冰裂了。旁边的人伸手去拉，也跟着滑进水里。',
        '救援队打捞了一夜。手机在冰面上响个不停，是家里打来的。'
      ]
    },

    {
      id: 'v38_teen_truck', band: '13-18', ageMin: 13, ageMax: 18,
      weight: 1, baseChance: 0.00028, riskBoost: 0.0012,
      stageTarget: 'teen', requires: {},
      title: '扒车尾',
      text: '镇上的拖拉机开得慢，几个少年扒在车斗后面，说要去隔壁镇看庙会。',
      cond: {}, risk: { happinessMax: 45 },
      choices: [], terminal: true,
      ending: {
        cause: '从车斗坠落，被后轮碾压',
        lastWords: '（他松手时，车斗还在拐弯）',
        relic: '一只布鞋',
        present: ['同学'],
        tag: '扒在车斗后面的少年'
      },
      settle: [
        '拖拉机拐弯时，车斗晃了一下。他抓着的铁栏杆是热的，手心全是汗。',
        '同伴喊他抓紧，他换了一只手。路面有个坑，车斗猛地一颠。',
        '司机听见后面有人喊，停了车。后轮下面，那只布鞋已经碾变形了。'
      ]
    },

    {
      id: 'v38_teen_gas', band: '13-18', ageMin: 13, ageMax: 18,
      weight: 1, baseChance: 0.00028, riskBoost: 0.0012,
      stageTarget: 'teen', requires: {},
      title: '出租屋的燃气',
      text: '几个同学在出租屋里煮火锅，窗户关着，煤气罐的软管有一道裂纹。',
      cond: {}, risk: { happinessMax: 45 },
      choices: [], terminal: true,
      ending: {
        cause: '燃气泄漏引发爆炸',
        lastWords: '（他起身去关阀门，打火机还在手里）',
        relic: '一只烧黑的火锅勺',
        present: ['同学', '邻居'],
        tag: '出租屋里的火锅'
      },
      settle: [
        '软管上的裂纹是用胶布缠住的。火锅吃到一半，有人闻到煤气味。',
        '他起身去关阀门，手里的打火机没有放下。',
        '爆炸把窗户掀到了街上。邻居跑出来时，出租屋的屋顶已经塌了。'
      ]
    },

    {
      id: 'v38_teen_knife', band: '13-18', ageMin: 13, ageMax: 18,
      weight: 1, baseChance: 0.00028, riskBoost: 0.0020,
      stageTarget: 'teen', requires: {},
      title: '带刀赴约',
      text: '网上的骂战约到了河堤。他把一把折叠刀塞进袖子，说只是防身。',
      cond: {}, risk: { happinessMax: 40, riskMin: { highStress: 55 } },
      choices: [], terminal: true,
      ending: {
        cause: '斗殴中被刺中主动脉，失血过多',
        lastWords: '“我没想捅他……”',
        relic: '一把折叠刀',
        present: ['朋友', '同学'],
        tag: '河堤上的那把刀'
      },
      settle: [
        '河堤上没有灯。两拨人从骂战吵到推搡，他袖子里的刀掉了出来。',
        '对方也带了人，混乱中有人捡起刀。他倒下时，还以为只是被拳头打中。',
        '救护车到的时候，河堤上的人已经跑光了。那把折叠刀留在草地上，刃口卷了。'
      ]
    },

    {
      id: 'v38_teen_train', band: '13-18', ageMin: 13, ageMax: 18,
      weight: 1, baseChance: 0.00028, riskBoost: 0.0010,
      stageTarget: 'teen', requires: {},
      title: '扒火车',
      text: '货运列车在站外减速，几个少年翻过围墙，想扒到下一站。车厢的把手比人还高。',
      cond: {}, risk: { happinessMax: 40 },
      choices: [], terminal: true,
      ending: {
        cause: '从行驶中的列车坠落，当场死亡',
        lastWords: '（他抓住把手，脚没有踩稳）',
        relic: '一只帆布书包',
        present: ['同学'],
        tag: '站外的那列货车'
      },
      settle: [
        '列车出站时开始加速。他挂在车厢外面的梯子上，书包先掉了下去。',
        '同伴在另一节车厢上喊他松手。他没有松，直到手心的汗让他滑脱。',
        '铁路公安沿着线路找了半天，在两百米外的碎石堆里找到了人。'
      ]
    },

    /* ---------- 19-30：+11，含犯罪线 2 个节点、高危职业线 3 个节点 ---------- */
    {
      id: 'v38_line_crime_caught', band: '19-30', ageMin: 19, ageMax: 30,
      weight: 2, baseChance: 0.00005, riskBoost: 0.0060,
      stageTarget: 'youth', requires: { flag: 'v38_line_crime_deep' },
      title: '第三次被抓',
      text: '第三次是在一家金店。你负责望风，同伙砸了柜台。警笛响的时候，他们先跑了。',
      cond: { flagsAny: ['v38_line_crime_deep'] },
      risk: { riskMin: { highStress: 55 } },
      choices: [
        { id: 'surrender', label: '站在原地举手', hint: '三年，出来还能活', tone: 'warn', route: 'sentence', sentence: { years: 3 },
          fx: { rep: { society: -12 }, at: { happiness: -10 } },
          text: '你没有跑。警察把你按在地上时，你看见同伙的摩托车拐进了巷子。' },
        { id: 'resist', label: '推开警察跑', hint: '跑了就回不了头', tone: 'risk', route: 'ending', pDeath: 0.70, ageAdvance: 2,
          fx: { set: { v38_wanted: true }, risk: { highStress: 15 } },
          text: '你推开警察，往巷子里跑。后面响了枪。' },
        { id: 'betray', label: '供出同伙换轻判', hint: '两年，但朋友没了', tone: 'plain', route: 'sentence', sentence: { years: 2 },
          fx: { rep: { society: -8 }, npc: { 朋友: { favor: -5, intimacy: -20 } } },
          text: '你把同伙的名字写在了笔录上。警察说，算你配合。' }
      ],
      ending: {
        cause: '抢劫罪，拒捕时中枪，送医后死亡',
        lastWords: '“我妈还在等我回去。”',
        relic: '一只假身份证',
        present: ['朋友'],
        tag: '金店门口的第三次'
      },
      release: {
        title: '监狱的大门',
        text: '三年，你出来时二十五岁。门口没有人接。',
        settle: [
          '你在监狱里学了缝纫，出来时带了一张结业证。',
          '案底跟着你，工厂不要，送外卖也要查记录。你在桥洞下住了半个月。',
          '父亲来看过你一次，隔着玻璃说“出来就好”。母亲没有来。'
        ]
      },
      settle: [
        '你跑进巷子，后面的人追了上来。枪响的时候，你还在想母亲做的面条。',
        '你倒在金店后门的台阶上。同伙的摩托车声越来越远。',
        '警察在你口袋里找到一张假身份证，名字是随便起的。母亲来认尸时，看了很久才点头。'
      ]
    },

    {
      id: 'v38_line_crime_terminal', band: '19-30', ageMin: 19, ageMax: 30,
      weight: 1.5, baseChance: 0.00005, riskBoost: 0.0060,
      stageTarget: 'youth', requires: { flag: 'v38_line_crime_deep' },
      title: '分赃的那天晚上',
      text: '四个人在出租屋里分钱。有人嫌自己拿少了，把手伸进了装钱的塑料袋。',
      cond: { flagsAny: ['v38_line_crime_deep'] },
      risk: { riskMin: { highStress: 60 } },
      choices: [], terminal: true,
      ending: {
        cause: '分赃冲突中被刺死',
        lastWords: '“钱我不要了……”',
        relic: '一只装现金的塑料袋',
        present: ['朋友'],
        tag: '出租屋里的分赃'
      },
      settle: [
        '出租屋的灯是声控的，灯灭的时候，有人摸到了桌上的刀。',
        '他倒下时，装钱的塑料袋还抱在怀里。其他人拿着钱跑了。',
        '房东第二天来收租，看见门缝下面的血。警察来了，塑料袋里的钱少了一半。'
      ]
    },

    {
      id: 'v38_line_job_site', band: '19-30', ageMin: 19, ageMax: 30,
      weight: 2, baseChance: 0.00005, riskBoost: 0.0500,
      stageTarget: 'youth', requires: { jobs: ['engineer', 'mechanic'], hazard: 'highStress' },
      title: '十二层的脚手架',
      text: '工地赶工期，十二层的外架只铺了半块踏板。工头说，系上安全绳太慢。',
      cond: { jobAny: ['engineer', 'mechanic'] },
      risk: { riskMin: { highStress: 50 }, healthMax: 60 },
      choices: [
        { id: 'harness', label: '系上安全绳', hint: '慢一点，但能回家', tone: 'safe', route: 'survive',
          fx: { at: { health: -2 }, money: { cash: -100 } },
          text: '你系上安全绳，工头骂了两句。那天下午，隔壁班组有人踩空了。' },
        { id: 'skip', label: '图快不系', hint: '就这一趟', tone: 'risk', route: 'ending', pDeath: 0.65, ageAdvance: 0,
          text: '你抱着钢管往后退，脚下的踏板翻了一下。' },
        { id: 'swap', label: '让新来的替你上去', hint: '他不敢不答应', tone: 'risk', route: 'ending', pDeath: 0.45, ageAdvance: 0,
          fx: { at: { happiness: -8 }, rep: { society: -4 } },
          text: '新来的系了绳，但还是踩空了。你站在下面，看见他挂在半空。' }
      ],
      ending: {
        cause: '高处坠落，钢筋贯穿胸腔',
        lastWords: '（他坠落时，安全帽先掉了下去）',
        relic: '一只安全帽',
        present: ['工友'],
        tag: '十二层的那半块踏板'
      },
      settle: [
        '踏板只有半块，边缘用铁丝绑着。他抱着钢管往后退，铁丝断了。',
        '下面的人听见安全帽落地的声音，然后是身体撞在防护网上的声音。',
        '救护车来了，医生在工棚里抢救了四十分钟。工头那天没有去工地。'
      ]
    },

    {
      id: 'v38_line_job_delivery', band: '19-30', ageMin: 19, ageMax: 30,
      weight: 2, baseChance: 0.00005, riskBoost: 0.0550,
      stageTarget: 'youth', requires: { jobs: ['gig', 'freelance', 'sales'], hazard: 'lateNight' },
      title: '超时的最后一单',
      text: '系统显示还有三分钟。红灯还有四十秒。客户在电话里说，再晚就退单。',
      cond: { jobAny: ['gig', 'freelance', 'sales'] },
      risk: { riskMin: { lateNight: 45 }, highStress: 55 },
      choices: [
        { id: 'redlight', label: '闯过去', hint: '这一单不能超时', tone: 'risk', route: 'ending', pDeath: 0.55, ageAdvance: 0,
          text: '你拧到底，冲进路口。右侧的货车按了喇叭。' },
        { id: 'wait', label: '等红灯', hint: '扣钱就扣钱', tone: 'safe', route: 'survive',
          fx: { money: { cash: -200 }, at: { happiness: -3 } },
          text: '你等了四十秒。客户退了单，站点扣了你两百。' },
        { id: 'wrongway', label: '逆行抄近路', hint: '这条路晚上没车', tone: 'risk', route: 'ending', pDeath: 0.45, ageAdvance: 0,
          text: '你拐进逆行道，对面来了一辆没开灯的车。' }
      ],
      ending: {
        cause: '闯红灯被货车撞击，当场死亡',
        lastWords: '（手机还在导航，提示“前方五十米到达”）',
        relic: '一只外卖箱',
        present: ['同事'],
        tag: '超时的最后一单'
      },
      settle: [
        '路口的红灯还有四十秒，他看了一眼导航，拧到底。',
        '右侧的货车是正常绿灯，司机说看见他的时候，已经刹不住了。',
        '外卖箱摔在路边，里面的汤洒了一地。手机还在响，是客户打来的催单电话。'
      ]
    },

    {
      id: 'v38_line_job_night', band: '19-30', ageMin: 19, ageMax: 30,
      weight: 2, baseChance: 0.00005, riskBoost: 0.0060,
      stageTarget: 'youth', requires: { hazard: 'lateNight' },
      title: '夜班第三年',
      text: '夜班从晚上十点到早上六点。第三年，你开始在下班路上扶着墙走。',
      cond: {}, risk: { riskMin: { lateNight: 50 } },
      choices: [
        { id: 'continue', label: '继续上夜班', hint: '夜班补贴多一千', tone: 'risk', route: 'survive',
          fx: { set: { v38_line_job_night: true }, money: { cash: 1000 }, risk: { lateNight: 10 } },
          text: '你又签了一年。夜里三点，你站在流水线前，听见自己的心跳。' },
        { id: 'transfer', label: '申请调白班', hint: '工资少一千', tone: 'safe', route: 'survive',
          fx: { money: { cash: -1000 }, set: { v38_line_job_night: true } },
          text: '主任说白班没有位置，让你再等等。你等了半年。' },
        { id: 'quit', label: '辞职', hint: '先活下来', tone: 'plain', route: 'survive',
          fx: { set: { needJob: true }, money: { cash: -500 } },
          text: '你辞了职，在出租屋睡了三天。醒来时，窗外的天是亮的。' },
        { id: 'collapse', label: '再撑一个通宵', hint: '眼前发黑', tone: 'risk', route: 'ending', pDeath: 0.35, ageAdvance: 0,
          text: '你靠在机器上，想闭眼休息一分钟。' }
      ],
      ending: {
        cause: '夜班过劳导致心源性猝死',
        lastWords: '（他靠在机器上，手里还拿着工牌）',
        relic: '一只磨掉漆的工牌',
        present: ['工友'],
        tag: '夜班第三年'
      },
      settle: [
        '流水线的灯是白的，夜里三点最安静。他靠在机器上，想闭眼一分钟。',
        '工友换班时看见他滑到地上，以为他睡着了。',
        '救护车到厂门口时，他的工牌还挂在胸前。医生说，心源性猝死。'
      ]
    },

    {
      id: 'v38_young_speeding', band: '19-30', ageMin: 19, ageMax: 30,
      weight: 3, baseChance: 0.00042, riskBoost: 0.0700,
      stageTarget: 'youth', requires: {},
      title: '凌晨的高架',
      text: '凌晨两点，高架上没有车。副驾的朋友说，再跑一段，看看能到多少。',
      cond: {}, risk: { happinessMax: 45, riskMin: { highStress: 50 } },
      choices: [
        { id: 'stop', label: '靠边停车', hint: '代驾已经在路上了', tone: 'safe', route: 'survive',
          fx: { set: { v38_speeder: true }, at: { happiness: -3 } },
          text: '你把车停在应急车道，朋友骂你扫兴。代驾来了，你们各自回家。' },
        { id: 'again', label: '再跑一段', hint: '仪表盘到一百八了', tone: 'risk', route: 'ending', pDeath: 0.70, ageAdvance: 1,
          fx: { set: { v38_speeder: true, v38_alcohol: true } },
          text: '你踩到底，高架的护栏开始变成一条线。' },
        { id: 'race', label: '跟旁边的车比一下', hint: '那辆车也在加速', tone: 'risk', route: 'ending', pDeath: 0.85, ageAdvance: 1,
          fx: { set: { v38_speeder: true } },
          text: '两辆车并排冲进弯道。你看见对方的车灯偏了过来。' }
      ],
      ending: {
        cause: '高速撞击护栏，车辆起火',
        lastWords: '“刹车……刹车……”',
        relic: '一只后视镜',
        present: ['朋友'],
        tag: '凌晨的高架'
      },
      settle: [
        '高架的护栏是水泥的，车头撞上去时，安全气囊弹了出来。',
        '朋友从副驾爬出来，看见车头已经开始冒烟。他拉不动你。',
        '消防车到的时候，车已经烧成了一个铁架子。护栏上留着一道很长的白印。'
      ]
    },

    {
      id: 'v38_young_debt', band: '19-30', ageMin: 19, ageMax: 30,
      weight: 2.5, baseChance: 0.00042, riskBoost: 0.0450,
      stageTarget: 'youth', requires: { debtMin: 15000 },
      title: '越借越多的网贷',
      text: '第一笔网贷是为了还赌债。第二笔是为了还第一笔。第三笔下来时，通讯录已经被打爆了。',
      cond: { debtMin: 12000 }, risk: { debtMin: 25000, riskMin: { highStress: 55 } },
      choices: [
        { id: 'borrow', label: '再借一笔填上', hint: '利息越滚越高', tone: 'risk', route: 'survive',
          fx: { money: { debt: 30000 }, set: { v38_gamble_debt: true }, risk: { highStress: 12 } },
          text: '你又借了一笔，把当月的口子堵上。手机安静了三天。' },
        { id: 'family', label: '回家跟父母摊牌', hint: '丢脸，但能活', tone: 'warn', route: 'survive',
          fx: { money: { cash: 10000, debt: -8000 }, npc: { 父亲: { favor: -15 }, 母亲: { favor: -12 } } },
          text: '父亲把存折摔在桌上，母亲哭了。最后他们替你还了八万。' },
        { id: 'run', label: '跑路', hint: '催收的人已经在楼下', tone: 'risk', route: 'ending', pDeath: 0.55, ageAdvance: 3,
          fx: { set: { v38_wanted: true }, risk: { highStress: 15 } },
          text: '你从后门翻出去，连行李都没带。' }
      ],
      ending: {
        cause: '被催收人员围堵，坠楼身亡',
        lastWords: '“我真的没有钱了。”',
        relic: '一部屏幕裂开的二手手机',
        present: ['朋友'],
        tag: '越借越多的人'
      },
      settle: [
        '催收的人堵在出租屋楼下，一共来了四个。你从后窗爬到二楼的雨棚上。',
        '雨棚是铁皮的，踩上去就凹了下去。下面的人还在喊你的名字。',
        '你摔在水泥地上。手机从口袋里掉出来，屏幕上还亮着一条催收短信。'
      ]
    },

    {
      id: 'v38_young_boat', band: '19-30', ageMin: 19, ageMax: 30,
      weight: 1, baseChance: 0.00028, riskBoost: 0.0015,
      stageTarget: 'youth', requires: {},
      title: '水库野泳',
      text: '下班后几个人去水库野泳。岸边竖着“禁止游泳”的牌子，字被太阳晒白了。',
      cond: {}, risk: { happinessMax: 45 },
      choices: [], terminal: true,
      ending: {
        cause: '水库深水区溺水',
        lastWords: '（他游到一半，突然开始往回扑）',
        relic: '一只拖鞋',
        present: ['朋友'],
        tag: '禁止游泳的牌子'
      },
      settle: [
        '水库的水面很平，下面是一个废弃的采砂坑。他游到一半，脚突然踩空。',
        '岸上的朋友以为他在开玩笑，直到看见他的手在水面上拍了两下。',
        '打捞船来了，在水面上转了三个小时。牌子还立在岸边，字被晒得看不清了。'
      ]
    },

    {
      id: 'v38_young_fire', band: '19-30', ageMin: 19, ageMax: 30,
      weight: 1, baseChance: 0.00028, riskBoost: 0.0012,
      stageTarget: 'youth', requires: {},
      title: '楼道里的电动车',
      text: '电动车在楼道里充了一夜。凌晨，电池开始冒烟，楼道里全是塑料烧焦的味道。',
      cond: {}, risk: { healthMax: 55 },
      choices: [], terminal: true,
      ending: {
        cause: '电动车电池起火，吸入有毒烟气',
        lastWords: '（他先醒了，去推防盗门，门把手是烫的）',
        relic: '一只烧焦的充电器',
        present: ['邻居'],
        tag: '楼道里的那辆车'
      },
      settle: [
        '电动车停在楼道口，充电器上的灯一直是红的。凌晨两点，电池开始冒白烟。',
        '他醒了，穿上拖鞋去推门。防盗门被热浪压住，推不开。',
        '消防员破门时，楼道里的车已经烧得只剩铁架。邻居说，那辆车才买了三个月。'
      ]
    },

    {
      id: 'v38_young_fall', band: '19-30', ageMin: 19, ageMax: 30,
      weight: 1, baseChance: 0.00028, riskBoost: 0.0015,
      stageTarget: 'youth', requires: {},
      title: '装修吊顶',
      text: '给人装吊顶，人字梯少了一条腿，用砖头垫着。他站在最上面一层，手里还拿着电钻。',
      cond: {}, risk: { healthMax: 60 },
      choices: [], terminal: true,
      ending: {
        cause: '梯子倾倒，后脑撞击地面',
        lastWords: '（他先扔了电钻，没有抓住吊顶龙骨）',
        relic: '一把卷尺',
        present: ['工友'],
        tag: '垫着砖头的人字梯'
      },
      settle: [
        '人字梯的一条腿垫着两块砖。他站在最上面，电钻的声音盖过了梯子的晃动。',
        '工友在下面扶梯子，手里的手机响了。他松手接电话的那一秒，梯子倒了。',
        '后脑勺撞在地砖上。电钻还在转，钻头把地面磨出了一个白点。'
      ]
    },

    {
      id: 'v38_young_heat', band: '19-30', ageMin: 19, ageMax: 30,
      weight: 1, baseChance: 0.00028, riskBoost: 0.0015,
      stageTarget: 'youth', requires: {},
      title: '高温下的工地',
      text: '下午两点，工地地表温度四十多度。他喝了半瓶水，继续搬砖。',
      cond: {}, risk: { healthMax: 60, riskMin: { highStress: 45 } },
      choices: [], terminal: true,
      ending: {
        cause: '热射病，多器官衰竭',
        lastWords: '（他说“歇一会儿”，然后就坐在了砖堆上）',
        relic: '一只塑料水壶',
        present: ['工友'],
        tag: '下午两点的工地'
      },
      settle: [
        '那天工地赶进度，中午只休息了半小时。他搬完第三车砖，说“歇一会儿”。',
        '工友以为他坐在砖堆上喝水，过了十分钟，水壶倒在地上。',
        '送到医院时，体温四十一度。医生说，热射病，脏器已经开始衰竭。'
      ]
    },

    /* ---------- 31-55：+11，含疾病线 4 个节点、高危职业线 2 个节点 ---------- */
    {
      id: 'v38_line_disease_check', band: '31-55', ageMin: 31, ageMax: 50,
      weight: 2, baseChance: 0.00005, riskBoost: 0.0040,
      stageTarget: 'adult', requires: {},
      title: '体检报告上的阴影',
      text: '单位体检，报告上写着“肝部低密度影，建议复查”。你把纸折起来，塞进了抽屉。',
      cond: {}, risk: { riskMin: { lateNight: 45, badDiet: 45 } },
      choices: [
        { id: 'recheck', label: '请假去复查', hint: '早查早治', tone: 'safe', route: 'survive',
          fx: { money: { cash: -2000 }, at: { health: 2 }, set: { v38_line_disease_ok: true } },
          text: '复查做了增强 CT，医生说是良性囊肿，半年后再看。你走出医院，觉得太阳很好。' },
        { id: 'delay', label: '先忙完这个项目', hint: '等项目结束再说', tone: 'warn', route: 'survive',
          fx: { set: { v38_line_disease_ignore: true }, risk: { highStress: 6 } },
          text: '项目结束又是下一个项目。那张报告一直在抽屉里，后来被文件压住了。' },
        { id: 'self', label: '自己买点护肝片', hint: '广告说管用', tone: 'risk', route: 'survive',
          fx: { set: { v38_line_disease_ignore: true }, risk: { badDiet: 8 }, at: { health: -4 } },
          text: '护肝片吃了两瓶，酒局一场没少。你觉得身体没有什么不舒服。' },
        { id: 'faint', label: '开会时突然眼前发黑', hint: '同事把你扶住了', tone: 'risk', route: 'ending', pDeath: 0.30, ageAdvance: 0,
          fx: { set: { v38_line_disease_bad: true } },
          text: '你扶着会议桌，杯子摔在地上。会议室里的人围了过来。' }
      ],
      ending: {
        cause: '肝癌破裂出血，抢救无效',
        lastWords: '“抽屉里那张报告……”',
        relic: '一张折了四折的体检报告',
        present: ['同事', '配偶'],
        tag: '塞进抽屉的阴影'
      },
      settle: [
        '那张报告在抽屉里放了一年。再拿出来时，纸边已经卷了。',
        '开会时他扶着桌子，杯子摔在地上。同事把他送到医院，急诊医生看了 CT，让家属进来。',
        '肝脏上的阴影已经长到了拳头大。他说抽屉里还有一张报告，没人听懂。'
      ]
    },

    {
      id: 'v38_line_disease_ignore', band: '31-55', ageMin: 33, ageMax: 52,
      weight: 2, baseChance: 0.00005, riskBoost: 0.0060,
      stageTarget: 'adult', requires: { flag: 'v38_line_disease_ignore' },
      title: '拖了一年',
      text: '一年后，右上腹开始隐隐作痛。你想起那张报告，又觉得只是最近酒喝多了。',
      cond: { flagsAny: ['v38_line_disease_ignore'] },
      risk: { riskMin: { badDiet: 50, lateNight: 45 } },
      choices: [
        { id: 'hospital', label: '现在去医院', hint: '也许还来得及', tone: 'warn', route: 'survive',
          fx: { money: { cash: -5000 }, at: { health: -8 }, set: { v38_line_disease_late: true } },
          text: '医生看着片子，沉默了一会儿，说“先住院查”。你听见走廊里有人在哭。' },
        { id: 'again', label: '再拖一年', hint: '等疼得厉害了再说', tone: 'risk', route: 'survive',
          fx: { set: { v38_line_disease_bad: true }, risk: { highStress: 10 } },
          text: '你买了止痛药，疼的时候吃一片。药盒在抽屉里越堆越高。' },
        { id: 'folk', label: '找个偏方', hint: '朋友说很灵', tone: 'risk', route: 'survive',
          fx: { set: { v38_line_disease_bad: true }, at: { health: -6 }, money: { cash: -3000 } },
          text: '偏方是一包黑色的粉末，喝了三个月。腹痛没有停，人瘦了十斤。' },
        { id: 'emergency', label: '疼得直不起腰', hint: '被同事送去急诊', tone: 'risk', route: 'ending', pDeath: 0.50, ageAdvance: 0,
          fx: { set: { v38_line_disease_bad: true } },
          text: '你蹲在办公室地上，冷汗把衬衫湿透了。同事打了 120。' }
      ],
      ending: {
        cause: '肝癌晚期，多器官衰竭',
        lastWords: '“我早该去查的。”',
        relic: '一只装满止痛药的空盒子',
        present: ['配偶', '子女'],
        tag: '拖了一年的腹痛'
      },
      settle: [
        '腹痛从隐隐变成持续的钝痛。他买了止痛药，疼的时候吃一片。',
        '急诊 CT 显示肝脏上的肿瘤已经扩散。医生把配偶叫到走廊，说了很久。',
        '他躺在病床上，床头柜里全是止痛药的空盒。最后一天，他说“我早该去查的”。'
      ]
    },

    {
      id: 'v38_line_disease_bad', band: '31-55', ageMin: 36, ageMax: 55,
      weight: 2, baseChance: 0.00005, riskBoost: 0.0080,
      stageTarget: 'adult', requires: { flag: 'v38_line_disease_bad' },
      title: '住院部的走廊',
      text: '住院部的走廊很长，加床排到了电梯口。医生说你来得太晚，但还可以试一试。',
      cond: { flagsAny: ['v38_line_disease_bad'] },
      risk: { healthMax: 45 },
      choices: [
        { id: 'treat', label: '住院治疗', hint: '活下来，但留下后遗症', tone: 'warn', route: 'survive',
          fx: { money: { cash: -10000 }, at: { health: -20, happiness: -10 }, set: { v38_line_disease_seq: true } },
          text: '你做了手术，切掉了一部分肝。出院时医生说要终身复查，不能喝酒，不能熬夜。' },
        { id: 'surgery', label: '再开一刀试试', hint: '医生说风险很大', tone: 'risk', route: 'ending', pDeath: 0.55, ageAdvance: 0,
          text: '手术灯亮了六个小时。走廊里的家属一直盯着那扇门。' },
        { id: 'refuse', label: '拒绝治疗，回家', hint: '不想死在医院', tone: 'risk', route: 'ending', pDeath: 0.90, ageAdvance: 1,
          text: '你签了字，回了家。家里的床比医院的软。' },
        { id: 'home', label: '回老家等', hint: '母亲说给你做好吃的', tone: 'risk', route: 'ending', pDeath: 0.85, ageAdvance: 1,
          text: '母亲把老屋收拾干净，每天熬粥。你吃不下。' }
      ],
      ending: {
        cause: '肝癌晚期，肝性脑病',
        lastWords: '“别告诉孩子。”',
        relic: '一张 CT 片',
        present: ['配偶', '子女'],
        tag: '住院部走廊的加床'
      },
      settle: [
        '住院部的加床排到了电梯口，晚上走廊里全是陪护的折叠椅。',
        '他签了拒绝治疗的同意书。回家的车上，他一直看着窗外。',
        '最后几天，他开始说胡话。配偶把 CT 片放在床头，他看了一眼，闭上了眼睛。'
      ]
    },

    {
      id: 'v38_line_disease_terminal', band: '31-55', ageMin: 40, ageMax: 55,
      weight: 1.5, baseChance: 0.00005, riskBoost: 0.0100,
      stageTarget: 'adult', requires: { flag: 'v38_line_disease_bad' },
      title: '最后一张片子',
      text: '片子上，肝脏的阴影已经连成了一片。医生说，已经没有手术的意义了。',
      cond: { flagsAny: ['v38_line_disease_bad'] },
      risk: { healthMax: 35 },
      choices: [], terminal: true,
      ending: {
        cause: '肝癌晚期，多器官衰竭',
        lastWords: '“我想回家。”',
        relic: '一只保温杯',
        present: ['配偶', '子女'],
        tag: '最后一张片子'
      },
      settle: [
        '医生把片子插在灯箱上，指着一片灰白色的区域，说“这里，这里，都已经是了”。',
        '他要求回家。救护车送到村口时，母亲已经在门口等着。',
        '最后那天，他喝了半杯水，说“我想回家”。其实已经到家了。'
      ]
    },

    {
      id: 'v38_line_job_truck', band: '31-55', ageMin: 31, ageMax: 55,
      weight: 2, baseChance: 0.00005, riskBoost: 0.0500,
      stageTarget: 'adult', requires: { jobs: ['taxi', 'gig', 'freelance'], hazard: 'lateNight' },
      title: '货运司机的最后一趟',
      text: '货主催得急，服务区还有四十公里。他已经连续开了九个小时，眼皮在打架。',
      cond: { jobAny: ['taxi', 'gig', 'freelance'] },
      risk: { riskMin: { lateNight: 55 }, highStress: 55 },
      choices: [
        { id: 'run', label: '再跑一趟', hint: '这趟运费顶两天', tone: 'risk', route: 'ending', pDeath: 0.60, ageAdvance: 0,
          text: '你把车窗摇下来，让风灌进来。前方的尾灯越来越近。' },
        { id: 'sleep', label: '进服务区睡一觉', hint: '货主会骂人', tone: 'safe', route: 'survive',
          fx: { money: { cash: -500 }, at: { health: 2 } },
          text: '你在服务区睡了两个小时。货主打了七个电话，你都按掉了。' },
        { id: 'drink', label: '喝功能饮料硬撑', hint: '心跳得很快', tone: 'warn', route: 'ending', pDeath: 0.45, ageAdvance: 0,
          text: '你连喝了两罐，心跳快得像要从胸口跳出来。前面的路开始模糊。' }
      ],
      ending: {
        cause: '疲劳驾驶追尾，驾驶室变形',
        lastWords: '（他最后踩了一脚刹车，但踩在了油门上）',
        relic: '一只掉漆的保温杯',
        present: ['同事'],
        tag: '连续第九个小时'
      },
      settle: [
        '服务区还有四十公里，他连续开了九个小时。副驾上的保温杯已经空了。',
        '前方的货车尾灯越来越近。他踩了一脚，踩在了油门上。',
        '驾驶室变形，消防员用液压钳剪了四十分钟。货主的电话还在副驾座位上响。'
      ]
    },

    {
      id: 'v38_line_job_collapse', band: '31-55', ageMin: 31, ageMax: 55,
      weight: 1.5, baseChance: 0.00005, riskBoost: 0.0100,
      stageTarget: 'adult', requires: { flag: 'v38_line_job_night' },
      title: '流水线停了三分钟',
      text: '流水线停了三分钟。工友以为他去厕所，找到时，他靠在料箱上，脸色发青。',
      cond: { flagsAny: ['v38_line_job_night'] },
      risk: { riskMin: { lateNight: 60 } },
      choices: [], terminal: true,
      ending: {
        cause: '长期夜班导致心源性猝死',
        lastWords: '（他手里还捏着半截没吃完的面包）',
        relic: '一只工牌',
        present: ['工友'],
        tag: '流水线停了三分钟'
      },
      settle: [
        '车间里的流水线停了三分钟，这是很少见的。工友去厕所找他，没有人。',
        '最后在料箱后面找到他，人已经滑到了地上。手里还捏着半截面包。',
        '厂医做了心肺复苏，救护车到的时候，心电图是一条直线。'
      ]
    },

    {
      id: 'v38_mid_liver', band: '31-55', ageMin: 31, ageMax: 55,
      weight: 1, baseChance: 0.00026, riskBoost: 0.0020,
      stageTarget: 'adult', requires: {},
      title: '酒桌上的第十年',
      text: '生意场上的酒局，一周五次。他开始觉得右上腹沉，眼白也有点黄。',
      cond: { healthMax: 55 }, risk: { riskMin: { badDiet: 55 }, healthMax: 50 },
      choices: [], terminal: true,
      ending: {
        cause: '酒精性肝硬化，食管静脉曲张破裂出血',
        lastWords: '“这杯我敬……”',
        relic: '一只半空的酒瓶',
        present: ['同事', '配偶'],
        tag: '酒桌上的第十年'
      },
      settle: [
        '酒局散场时，他在洗手间吐了一口血。朋友说只是胃出血，让他回去休息。',
        '半夜，他又吐了一次，量很大。配偶打 120，救护车来的时候，他已经站不稳了。',
        '急诊胃镜下，食管静脉曲张像蚯蚓一样盘着。医生说要立刻手术，但血压已经掉下去了。'
      ]
    },

    {
      id: 'v38_mid_kidney', band: '31-55', ageMin: 31, ageMax: 55,
      weight: 1, baseChance: 0.00026, riskBoost: 0.0018,
      stageTarget: 'adult', requires: {},
      title: '脚踝肿了',
      text: '脚踝肿了半年，他以为是站得太久。后来脸也肿了，早上起来眼睛睁不开。',
      cond: { healthMax: 50 }, risk: { riskMin: { badDiet: 50, highStress: 50 } },
      choices: [], terminal: true,
      ending: {
        cause: '尿毒症，心力衰竭',
        lastWords: '“透析要多少钱？”',
        relic: '一张透析排班表',
        present: ['配偶', '子女'],
        tag: '肿了半年的脚踝'
      },
      settle: [
        '脚踝肿了半年，他买了双大一号的鞋。后来脸也肿了，早上起来眼睛睁不开。',
        '医院查出肌酐高得吓人，直接安排了透析。他问医生“透析要多少钱”。',
        '透析做了半年，心脏开始衰竭。最后一次，他在透析床上睡着了，没有再醒。'
      ]
    },

    {
      id: 'v38_mid_anaphylaxis', band: '31-55', ageMin: 31, ageMax: 55,
      weight: 1, baseChance: 0.00026, riskBoost: 0.0020,
      stageTarget: 'adult', requires: {},
      title: '一顿海鲜',
      text: '客户请吃海鲜，他不知道自己过敏。吃到一半，嘴唇开始发麻，喉咙像被什么堵住了。',
      cond: { healthMax: 65 }, risk: { healthMax: 55 },
      choices: [], terminal: true,
      ending: {
        cause: '过敏性休克，气道水肿',
        lastWords: '“我……喘不上气……”',
        relic: '一只没吃完的蟹壳',
        present: ['同事'],
        tag: '一顿海鲜'
      },
      settle: [
        '他吃到一半，嘴唇开始发麻，以为是辣。过了一分钟，喉咙像被什么堵住了。',
        '同事扶他起来，他的脸已经肿了。餐厅服务员打了 120。',
        '救护车到的时候，他靠在椅子上，嘴唇发紫。医生说是过敏性休克，气道已经肿得插不进管子。'
      ]
    },

    {
      id: 'v38_mid_heat', band: '31-55', ageMin: 31, ageMax: 55,
      weight: 1, baseChance: 0.00026, riskBoost: 0.0018,
      stageTarget: 'adult', requires: {},
      title: '车间里的风扇',
      text: '车间里的风扇坏了三天，温度计停在三十九度。他怕扣全勤，没有请假。',
      cond: { healthMax: 60 }, risk: { riskMin: { highStress: 50 } },
      choices: [], terminal: true,
      ending: {
        cause: '热射病，多器官衰竭',
        lastWords: '“让我歇十分钟……”',
        relic: '一把坏了的风扇开关',
        present: ['工友'],
        tag: '三十九度的车间'
      },
      settle: [
        '风扇坏了三天，车间里像蒸笼。他怕扣全勤，一直没有请假。',
        '下午三点，他扶着工作台说“让我歇十分钟”，然后坐在了地上。',
        '工友把他抬到阴凉处，灌了藿香正气水。送到医院时，体温四十一度，已经昏迷。'
      ]
    },

    {
      id: 'v38_mid_commute', band: '31-55', ageMin: 31, ageMax: 55,
      weight: 1, baseChance: 0.00026, riskBoost: 0.0012,
      stageTarget: 'adult', requires: {},
      title: '早高峰的十字路口',
      text: '早上七点半，他骑着电动车过十字路口。右侧的渣土车正在右转，驾驶室很高。',
      cond: {}, risk: { riskMin: { lateNight: 45 } },
      choices: [], terminal: true,
      ending: {
        cause: '渣土车右转碾压，当场死亡',
        lastWords: '（他看见车头转过来，捏了刹车，但地面是湿的）',
        relic: '一只公文包',
        present: ['同事'],
        tag: '早高峰的十字路口'
      },
      settle: [
        '十字路口的信号灯刚变绿，他骑着电动车直行。右侧的渣土车打转向灯右转。',
        '渣土车的驾驶室很高，司机说没有看见电动车。地面洒水车刚过，刹车痕很长。',
        '公文包摔在路边，里面的饭盒盖子弹开了。那天早上，妻子给他装的是排骨。'
      ]
    },

    /* ---------- 56+：+3，全部选择型意外 ---------- */
    {
      id: 'v38_old_medicine', band: '56+', ageMin: 56, ageMax: 90, kind: 'accident',
      weight: 2.5, baseChance: 0.00055, riskBoost: 0.0040,
      stageTarget: 'elder', requires: {},
      title: '分药盒',
      text: '分药盒里周一到周日都装好了。他嫌血压降得慢，把降压药多加了一倍。',
      cond: {}, risk: { healthMax: 55 },
      choices: [
        { id: 'follow', label: '按医嘱吃', hint: '明天去社区医院量血压', tone: 'safe', route: 'survive',
          fx: { at: { health: 2 } },
          text: '他把多加的那片药放回盒子里。第二天去社区医院，血压还是高，医生给他换了一种药。' },
        { id: 'double', label: '加倍吃', hint: '想快点降下来', tone: 'risk', route: 'ending', pDeath: 0.60, ageAdvance: 0,
          text: '他吞了两片。半小时后，他站起来，眼前一黑。' },
        { id: 'stop', label: '干脆停药', hint: '是药三分毒', tone: 'risk', route: 'ending', pDeath: 0.70, ageAdvance: 0,
          text: '他把分药盒收进了抽屉。第三天早上，他没能从床上坐起来。' }
      ],
      ending: {
        cause: '降压药过量导致低血压，跌倒后颅内出血',
        lastWords: '“我没事，就是有点晕。”',
        relic: '一只分药盒',
        present: ['子女', '邻居'],
        tag: '分药盒里的星期几'
      },
      settle: [
        '分药盒是女儿买的，周一到周日七个小格子。他嫌血压降得慢，把周三和周四的药都倒了出来。',
        '站起来的时候眼前一黑，后脑勺磕在茶几角上。邻居听见响声，敲门没有人应。',
        '送到医院，CT 显示颅内出血。女儿在急诊室外一直攥着那只分药盒。'
      ]
    },

    {
      id: 'v38_old_stairs', band: '56+', ageMin: 56, ageMax: 90, kind: 'accident',
      weight: 2.5, baseChance: 0.00055, riskBoost: 0.0040,
      stageTarget: 'elder', requires: {},
      title: '楼道里的台阶',
      text: '楼道灯坏了，他扶着墙下楼。手里提着一袋垃圾，另一只手没有抓栏杆。',
      cond: {}, risk: { healthMax: 50 },
      choices: [
        { id: 'rail', label: '抓住栏杆慢慢走', hint: '慢一点没关系', tone: 'safe', route: 'survive',
          fx: { at: { health: -2 } },
          text: '他抓住栏杆，一级一级往下走。垃圾袋在手里晃，但没有摔。' },
        { id: 'own', label: '自己走，不用扶', hint: '走了几十年了', tone: 'warn', route: 'ending', pDeath: 0.50, ageAdvance: 0,
          text: '他走到第三级台阶，脚底踩空了。' },
        { id: 'skip', label: '跨两级快点下楼', hint: '天黑前还要收衣服', tone: 'risk', route: 'ending', pDeath: 0.70, ageAdvance: 0,
          text: '他跨了两级，拖鞋没有跟上。' }
      ],
      ending: {
        cause: '跌倒后颅内出血，卧床并发症',
        lastWords: '“别送医院了，麻烦。”',
        relic: '一只老花镜',
        present: ['配偶', '邻居'],
        tag: '楼道里的第三级台阶'
      },
      settle: [
        '楼道灯坏了半个月，物业一直没有修。他提着垃圾袋，扶着墙往下走。',
        '第三级台阶上有一块松动的地砖，脚踩上去的时候，地砖翻了一下。',
        '邻居听见垃圾袋落地的声音，出门看见他躺在楼梯转角。送医后，颅内出血，卧床半年。'
      ]
    },

    {
      id: 'v38_old_gas', band: '56+', ageMin: 56, ageMax: 90, kind: 'accident',
      weight: 2.5, baseChance: 0.00055, riskBoost: 0.0040,
      stageTarget: 'elder', requires: {},
      title: '厨房里的煤气味',
      text: '他进门时闻到煤气味，厨房的灶上还坐着一壶水。他第一反应是去开灯看看。',
      cond: {}, risk: { healthMax: 55 },
      choices: [
        { id: 'window', label: '先开窗通风', hint: '不要动开关', tone: 'safe', route: 'survive',
          fx: { at: { health: -2 } },
          text: '他摸黑开了窗，在楼道里站了半小时。后来燃气公司的人来换了软管。' },
        { id: 'light', label: '开灯看看', hint: '开关在门口', tone: 'risk', route: 'ending', pDeath: 0.80, ageAdvance: 0,
          text: '他按下开关。' },
        { id: 'sleep', label: '去床上躺一会儿', hint: '也许睡一觉就好了', tone: 'risk', route: 'ending', pDeath: 0.85, ageAdvance: 0,
          text: '他关了门，躺在卧室的床上。煤气味越来越浓。' }
      ],
      ending: {
        cause: '燃气爆炸，烧伤合并吸入性损伤',
        lastWords: '（他按下了开关，火光先亮起来）',
        relic: '一只烧黑的灯开关',
        present: ['邻居', '子女'],
        tag: '厨房里的煤气味'
      },
      settle: [
        '他进门时闻到煤气味，厨房的灶上坐着一壶水，火已经灭了。',
        '他按下门口的开关。火光从厨房里冲出来，把防盗门掀到了楼道。',
        '邻居报了警。消防员在厨房门口找到他，手里还攥着那只烧黑的开关。'
      ]
    }

  );

  /* 统一补齐 stageTarget / requires，并按 band 归一化到年度预算 */
  (function () {
    V.ENDINGS.forEach(function (e) {
      if (!e.stageTarget) e.stageTarget = STAGE_TARGET_BY_BAND[e.band];
      if (!e.requires || typeof e.requires !== 'object') e.requires = {};
    });

    BANDS.forEach(function (band) {
      var list = V.ENDINGS.filter(function (e) { return e.band === band; });
      var sum = 0;
      list.forEach(function (e) { sum += num(e.baseChance, 0); });
      var budget = V.CONFIG.annualBudget[band];
      if (sum > 0 && budget > 0) {
        var k = budget / sum;
        list.forEach(function (e) {
          e.baseChance = clamp(num(e.baseChance, 0) * k, 0.00001, 0.03);
        });
      }
      list.forEach(function (e) {
        e.riskBoost = clamp(num(e.riskBoost, 0), 0, Math.min(0.08 - e.baseChance, 0.08));
      });
    });
  })();

  V.bandBaseSum = function (band) {
    var s = 0;
    V.ENDINGS.forEach(function (e) { if (e.band === band) s += num(e.baseChance, 0); });
    return s;
  };

  V.TARGET_SHARES = {
    '0-6': 6, '7-12': 9, '13-18': 12, '19-30': 18, '31-55': 15, '56+': 3
  };


  V.countByBand = function () {
    var out = {};
    BANDS.forEach(function (b) { out[b] = 0; });
    V.ENDINGS.forEach(function (e) { out[e.band] = (out[e.band] || 0) + 1; });
    return out;
  };

})(typeof window !== 'undefined' ? window : globalThis);
