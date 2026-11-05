/* js/replay.js — 种子化 + 完整回放（零侵入）
 *
 * 载入时机：state.js 之后、engine.js 之前（见 docs/replay_integration.md）。
 * 做法：运行期替换 Math.random，并挂钩 LS.createGame / legacy / eventCD，
 *       既有文件一行不改即可复现。
 *
 * 对外 API（LS.REPLAY）：
 *   seed() / setSeed(n)
 *   logChoice(turn, eventId, idx)      idx 为 0 基（与 ui.onChoose 一致）
 *   exportCode() / loadCode(str)
 *   replay({ onMismatch, onStep }) → { ok, reason, mismatch, steps, game, eventLog }
 *   history() / isReplaying() / status() / resume() / init()
 *
 * 回放码：seed:2-1-3（每个回合选的选项序号，从 1 开始；空选择写作 seed:）
 * URL：?replay=8842:2-1-3
 */
(function () {
  'use strict';

  var root = (typeof window !== 'undefined') ? window
           : (typeof globalThis !== 'undefined') ? globalThis : this;
  var LS = root.LS = root.LS || {};
  if (LS.REPLAY) return;

  var nativeRandom = Math.random;

  var META_KEY = 'lifesim_replay_meta_v1';   /* 每个种子的建卡快照 + 跨局状态快照 */
  var PROG_KEY = 'lifesim_replay_progress_v1'; /* 未完成回放的进度 */
  var MAX_SEEDS = 20;

  /* ---------------- 存储（node 无 localStorage 时退化为内存） ---------------- */
  var mem = {};
  function sget(k) {
    try {
      var raw = root.localStorage ? root.localStorage.getItem(k) : mem[k];
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function sset(k, v) {
    try {
      var raw = JSON.stringify(v);
      if (root.localStorage) root.localStorage.setItem(k, raw); else mem[k] = raw;
    } catch (e) { /* 配额满等，忽略 */ }
  }
  function sdel(k) {
    try {
      if (root.localStorage) root.localStorage.removeItem(k); else delete mem[k];
    } catch (e) {}
  }

  /* ---------------- 确定性 PRNG（mulberry32，可读写内部状态） ---------------- */
  function mulberry32(a) {
    a = a >>> 0;
    var fn = function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    fn.getState = function () { return a; };
    fn.setState = function (v) { a = v >>> 0; };
    return fn;
  }

  function newSeed() { return 100000 + Math.floor(nativeRandom() * 900000); }

  function normSeed(v) {
    var n = Number(String(v).replace(/[^0-9]/g, ''));
    if (!isFinite(n) || n <= 0) return null;
    n = Math.floor(n);
    return n > 4294967295 ? (n % 4294967295) : n;
  }

  /* ---------------- 内部状态 ---------------- */
  var state = {
    seed: newSeed(),
    locked: false,        /* setSeed / loadCode 后锁定，新开局沿用 */
    stream: null,         /* Math.random 替换后的取数流 */
    log: [],              /* [{turn, eventId, idx}] idx 0 基 */
    cursor: 0,
    replaying: false,
    blocked: false,       /* 失配后冻结输入 */
    internal: false,      /* 回放驱动正在调用引擎 */
    inReplay: false,      /* 整段回放期间，用于接管 legacy/eventCD 读取 */
    replayLegacy: null,
    replayEventCD: null,
    mismatch: null,
    last: null,           /* {game} */
    idsBySeed: {},        /* seed → {ids, turns} 用于逐步比对 */
    onMismatch: null
  };

  /* ---------------- 存储读写 ---------------- */
  function metaAll() {
    var m = sget(META_KEY);
    if (!m || typeof m !== 'object') m = {};
    if (!m.seeds || typeof m.seeds !== 'object') m.seeds = {};
    return m;
  }
  function metaFor(seed) {
    return metaAll().seeds[String(seed)] || null;
  }
  function metaSet(seed, patch) {
    var m = metaAll();
    var cur = m.seeds[String(seed)] || {};
    for (var k in patch) { if (Object.prototype.hasOwnProperty.call(patch, k)) cur[k] = patch[k]; }
    cur.at = Date.now(); /* 仅用于裁剪，不参与判定 */
    m.seeds[String(seed)] = cur;

    var keys = Object.keys(m.seeds);
    if (keys.length > MAX_SEEDS) {
      keys.sort(function (a, b) { return (m.seeds[b].at || 0) - (m.seeds[a].at || 0); });
      for (var i = MAX_SEEDS; i < keys.length; i++) delete m.seeds[keys[i]];
    }
    sset(META_KEY, m);
  }

  function cloneAttrs(a) {
    var o = {};
    for (var k in a) { if (Object.prototype.hasOwnProperty.call(a, k)) o[k] = a[k]; }
    return o;
  }
  function pickCfg(cfg) {
    var o = {};
    var keys = ['name', 'gender', 'birthplace', 'background', 'attrs'];
    for (var i = 0; i < keys.length; i++) {
      if (cfg[keys[i]] !== undefined) o[keys[i]] = cfg[keys[i]];
    }
    if (Array.isArray(cfg.talents)) o.talents = cfg.talents.slice();
    if (o.attrs) o.attrs = cloneAttrs(o.attrs);
    return o;
  }

  /* ---------------- Math.random 替换 ---------------- */
  Math.random = function () {
    return state.stream ? state.stream() : nativeRandom();
  };

  function resetStream(seed) {
    /* 与 LS.RNG 用同一 seed 但错开，避免两条流同步相关 */
    state.stream = mulberry32((seed ^ 0x9E3779B9) >>> 0);
  }

  /* 记录/恢复两条随机流的状态：抵消渲染层额外消耗 Math.random 造成的漂移 */
  function snapshotRng() {
    return {
      m: state.stream ? state.stream.getState() : null,
      l: (LS.RNG && typeof LS.RNG.state === 'number') ? LS.RNG.state : null
    };
  }
  function restoreRng(rs) {
    if (!rs) return;
    if (rs.m != null && state.stream) state.stream.setState(rs.m);
    if (rs.l != null && LS.RNG) LS.RNG.state = rs.l;
  }

  /* ---------------- 挂钩：createGame ---------------- */
  function hookCreate() {
    if (!LS.createGame || LS.createGame.__replayWrapped) return !!LS.createGame;
    var orig = LS.createGame;
    var wrapped = function (cfg) {
      cfg = cfg || {};
      if (!state.locked && !state.inReplay) state.seed = newSeed();
      cfg.seed = state.seed;
      resetStream(state.seed);

      if (!state.inReplay) {
        state.log = [];
        state.cursor = 0;
        state.mismatch = null;
        state.blocked = false;
        /* 快照本局起点的跨局状态：前世继承 + 全局事件冷却 */
        state.replayLegacy = LS.legacyRead ? LS.legacyRead() : { reputation: 0, cash: 0, runs: 0 };
        state.replayEventCD = (LS.eventCDRead ? LS.eventCDRead() : {}) || {};
      }
      metaSet(state.seed, {
        cfg: pickCfg(cfg),
        legacy: state.replayLegacy,
        eventCD: state.replayEventCD
      });

      var g = orig.call(LS, cfg);
      state.last = { game: g };
      refreshBadge();
      return g;
    };
    wrapped.__replayWrapped = true;
    LS.createGame = wrapped;
    return true;
  }

  /* ---------------- 挂钩：玩家输入（resolve） ---------------- */
  function hookEngine() {
    var E = LS.engine;
    if (!E || !E.resolve || E.resolve.__replayWrapped) return !!E;
    var orig = E.resolve;
    var wrapped = function (g, index) {
      if ((state.replaying || state.blocked) && !state.internal) {
        return { ok: false, error: '回放进行中：玩家输入已禁用' };
      }
      return orig(g, index);
    };
    wrapped.__replayWrapped = true;
    E.resolve = wrapped;
    return true;
  }

  /* ---------------- 挂钩：跨局状态读取（复现用快照，写入置空） ---------------- */
  function hookGlobalState() {
    if (LS.legacyRead && !LS.legacyRead.__replayWrapped) {
      var lr = LS.legacyRead;
      var wlr = function () {
        if (state.inReplay) {
          return state.replayLegacy || { reputation: 0, cash: 0, runs: 0, source: '' };
        }
        return lr();
      };
      wlr.__replayWrapped = true;
      LS.legacyRead = wlr;
    }
    if (LS.eventCDRead && !LS.eventCDRead.__replayWrapped) {
      var cr = LS.eventCDRead;
      var wcr = function () {
        if (state.inReplay) return state.replayEventCD || {};
        return cr();
      };
      wcr.__replayWrapped = true;
      LS.eventCDRead = wcr;
    }
    if (LS.legacyWrite && !LS.legacyWrite.__replayWrapped) {
      var lw = LS.legacyWrite;
      var wlw = function (o) { if (state.inReplay) return; return lw(o); };
      wlw.__replayWrapped = true;
      LS.legacyWrite = wlw;
    }
    if (LS.eventCDWrite && !LS.eventCDWrite.__replayWrapped) {
      var cw = LS.eventCDWrite;
      var wcw = function (o) { if (state.inReplay) return; return cw(o); };
      wcw.__replayWrapped = true;
      LS.eventCDWrite = wcw;
    }
  }

  /* ---------------- 角落小字 ---------------- */
  var badgeDom = null;

  function ensureBadge() {
    if (typeof document === 'undefined' || !document.body || !document.createElement) return null;
    if (badgeDom) return badgeDom;

    var style = document.createElement('style');
    style.textContent =
      '#lsReplayBadge{position:fixed;left:10px;bottom:8px;z-index:9999;' +
      'font:11px/1.7 ui-monospace,Consolas,"Courier New",monospace;color:#7c828c;' +
      'background:rgba(255,255,255,.74);border:1px solid rgba(0,0,0,.06);border-radius:6px;' +
      'padding:3px 7px;pointer-events:none;white-space:pre-line;max-width:48vw}' +
      '#lsReplayBadge button{margin-left:6px;pointer-events:auto;cursor:pointer;' +
      'font:11px/1.4 inherit;border:1px solid #c9ced6;background:#fff;border-radius:4px;padding:0 5px}';
    (document.head || document.body).appendChild(style);

    var box = document.createElement('div');
    box.id = 'lsReplayBadge';
    var text = document.createElement('span');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '继续回放';
    btn.style.display = 'none';
    btn.onclick = function () { LS.REPLAY.resume(); };
    box.appendChild(text);
    box.appendChild(btn);
    document.body.appendChild(box);

    badgeDom = { box: box, text: text, btn: btn };
    return badgeDom;
  }

  function refreshBadge(note) {
    var d = ensureBadge();
    if (!d) return;
    var g = (LS.ui && LS.ui.getGame) ? LS.ui.getGame() : (state.last && state.last.game);
    if (g && g.seed && !state.locked && !state.inReplay) state.seed = Number(g.seed);

    var text = '种子 ' + state.seed;
    if (state.replaying) text += ' · 回放 ' + state.cursor + '/' + state.log.length;
    else if (note) text += ' · ' + note;
    else if (state.log.length) text += ' · 已记录 ' + state.log.length + ' 步';

    d.text.textContent = text;
    var prog = sget(PROG_KEY);
    d.btn.style.display = (!state.replaying && prog && prog.code) ? 'inline-block' : 'none';
  }

  /* ---------------- 初始化（幂等） ---------------- */
  function init() {
    hookCreate();
    hookEngine();
    hookGlobalState();
    refreshBadge();
    return true;
  }

  /* ---------------- 回放码 ---------------- */
  function exportCode() {
    var seq = [];
    var ids = [];
    var turns = [];
    var rng = [];
    for (var i = 0; i < state.log.length; i++) {
      var r = state.log[i];
      seq.push(Number(r.idx) + 1);
      ids.push(r.eventId || null);
      turns.push(Number(r.turn));
      rng.push(r.rs || null);
    }
    var code = String(state.seed) + ':' + seq.join('-');

    state.idsBySeed[String(state.seed)] = { code: code, ids: ids, turns: turns, rng: rng };
    metaSet(state.seed, { code: code, ids: ids, turns: turns, rng: rng });
    return code;
  }

  function parseCode(str) {
    if (!str) return { ok: false, error: '回放码为空' };
    var s = String(str).replace(/\s+/g, '');
    var p = s.split(':');
    if (p.length === 2 && p[1] === '' && s.indexOf(':') !== s.length - 1) { /* 兼容 */ }
    if (p.length > 2) return { ok: false, error: '回放码格式应为 seed:2-1-3' };
    var seed = normSeed(p[0]);
    if (!seed) return { ok: false, error: '种子非法：' + p[0] };

    var seq = [];
    var body = (p[1] || '').replace(/^-|-$/g, '');
    if (body) {
      var arr = body.split('-');
      for (var i = 0; i < arr.length; i++) {
        var n = Number(arr[i]);
        if (!isFinite(n) || n < 1 || Math.floor(n) !== n) {
          return { ok: false, error: '第 ' + (i + 1) + ' 个选项序号非法：' + arr[i] };
        }
        seq.push(n - 1); /* 对外 1 基，对内 0 基 */
      }
    }
    return { ok: true, seed: seed, seq: seq };
  }

  function loadCode(str) {
    var p = parseCode(str);
    if (!p.ok) return p;

    state.seed = p.seed;
    state.locked = true;
    state.cursor = 0;
    state.mismatch = null;
    state.blocked = false;

    var meta = metaFor(p.seed) || {};
    var ids = meta.ids || [];
    var turns = meta.turns || [];
    var rngs = meta.rng || [];
    var recs = [];
    for (var i = 0; i < p.seq.length; i++) {
      recs.push({
        turn: (i < turns.length ? Number(turns[i]) : null),
        eventId: (i < ids.length ? ids[i] : null),
        idx: p.seq[i],
        rs: (i < rngs.length ? rngs[i] : null)
      });
    }
    state.log = recs;
    sset(PROG_KEY, { code: String(p.seed) + ':' + p.seq.map(function (x) { return x + 1; }).join('-'), cursor: 0 });
    refreshBadge();
    return { ok: true, seed: p.seed, steps: recs.length, hasIds: ids.length >= recs.length && recs.length > 0 };
  }

  /* ---------------- 自动建卡（跨设备回放时的兜底） ---------------- */
  function sortedKeys(obj) {
    var k = [];
    for (var name in obj) { if (Object.prototype.hasOwnProperty.call(obj, name)) k.push(name); }
    return k.sort(); /* 固定顺序，规避 Object.keys 遍历顺序差异 */
  }

  function autoCfg(seed) {
    var rnd = mulberry32((seed ^ 0x51ED270B) >>> 0);
    var gs = ['男', '女', '其他'];
    var gender = gs[Math.floor(rnd() * gs.length)];
    var bps = sortedKeys(LS.BIRTHPLACES || {});
    var bgs = sortedKeys(LS.BACKGROUNDS || {});
    var bp = bps.length ? bps[Math.floor(rnd() * bps.length)] : '小城';
    var bg = bgs.length ? bgs[Math.floor(rnd() * bgs.length)] : '普通工薪';

    var list = LS.TALENTS || [];
    var pool = [];
    for (var i = 0; i < list.length; i++) pool.push(list[i].id);
    var talents = [];
    for (var n = 0; n < 2 && pool.length; n++) {
      talents.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    }

    var keys = ['knowledge', 'health', 'finance', 'charm', 'happiness', 'reputation'];
    var attrs = LS.baseAttrs ? LS.baseAttrs(bp, bg, talents) : {};
    var left = Number(LS.FREE_POINTS) || 0;
    var guard = 0;
    while (left > 0 && guard++ < 500) {
      var k = keys[Math.floor(rnd() * keys.length)];
      if ((Number(attrs[k]) || 0) >= 100) continue;
      attrs[k] = (Number(attrs[k]) || 0) + 1;
      left--;
    }

    return {
      name: '回放 ' + seed,
      gender: gender,
      birthplace: bp,
      background: bg,
      talents: talents,
      attrs: attrs
    };
  }

  /* ---------------- 动态事件缓存清理 ----------------
   * lines.js 的承诺到期事件（promise_due_*）是「一次性注册 + 闭包绑定当局限定对象」：
   * IDX[id] 只在第一次注册，cond 里闭包捕获那局的 promise（pp.status === 'open'）。
   * 同一页面/进程内跑第二局（含回放）时，旧闭包指向上一局的 promise，cond 恒为 false，
   * 事件永远抽不到 —— 会造成回放与原始局在第 N 回合选事件失配。
   * 回放前清掉这批动态事件，强制本局重新注册。
   */
  function purgeDynamicIndex() {
    var idx = LS.EVENT_INDEX;
    if (!idx) return 0;
    var n = 0;
    for (var k in idx) {
      if (!Object.prototype.hasOwnProperty.call(idx, k)) continue;
      if (k.indexOf('promise_due_') === 0) { delete idx[k]; n++; }
    }
    return n;
  }

  /* ---------------- 回放驱动 ---------------- */
  function pausePending(g) {
    return !!(g.pendingConsequence || g.pendingYearSummary || g.pendingSummary || g.pendingStage);
  }

  function project(g) {
    var out = [];
    var log = (g && g.eventLog) ? g.eventLog : [];
    for (var i = 0; i < log.length; i++) {
      var e = log[i];
      out.push({
        seq: e.seq,
        turn: e.turn,
        eventId: e.eventId,
        choiceIndex: e.choiceIndex,
        outcomeLabel: e.outcomeLabel,
        auto: !!e.auto
      });
    }
    return out;
  }

  function replay(opts) {
    opts = opts || {};
    init();

    var seq = state.log.slice();
    if (!seq.length) {
      return { ok: false, reason: 'no-sequence', error: '没有可回放的选择序列', steps: 0, mismatch: null, game: null, eventLog: [] };
    }

    var meta = metaFor(state.seed) || {};
    var cfg = opts.cfg || meta.cfg || autoCfg(state.seed);
    var g = null;
    var reason = 'running';
    var guard = 0;
    var steps = 0;
    var mismatch = null;

    state.replaying = true;
    state.internal = true;
    state.inReplay = true;
    state.cursor = 0;
    state.mismatch = null;
    state.blocked = false;
    state.replayLegacy = meta.legacy || { reputation: 0, cash: 0, runs: 0, source: '' };
    state.replayEventCD = meta.eventCD || {};
    resetStream(state.seed);
    purgeDynamicIndex();

    try {
      g = LS.engine.start(cfg);
      state.last = { game: g };

      while (reason === 'running') {
        if (++guard > 8000) { reason = 'guard'; break; }
        if (g.death && g.death.dead) { reason = 'dead'; break; }

        if (pausePending(g)) {
          var pr = LS.engine.continueAfter(g);
          if (!pr || !pr.ok) { reason = 'pause-error'; break; }
          if (pr.dead) { reason = 'dead'; break; }
          continue;
        }

        if (!g.current) {
          var ev = LS.engine.nextEvent(g);
          if (g.death && g.death.dead) { reason = 'dead'; break; }
          if (!ev && !pausePending(g)) { reason = 'no-event'; break; }
          continue;
        }

        if (state.cursor >= seq.length) { reason = 'exhausted'; break; }

        var rec = seq[state.cursor];
        var cnt = (g.current.opts || []).length;

        if (rec.turn != null && Number(rec.turn) !== Number(g.turn)) {
          mismatch = {
            reason: 'turn', step: state.cursor + 1, turn: Number(g.turn),
            expectedTurn: Number(rec.turn), expectedId: rec.eventId, actualId: g.current.id
          };
          break;
        }
        if (rec.eventId && String(rec.eventId) !== String(g.current.id)) {
          mismatch = {
            reason: 'event', step: state.cursor + 1, turn: Number(g.turn),
            expectedTurn: (rec.turn == null ? null : Number(rec.turn)),
            expectedId: rec.eventId, actualId: g.current.id
          };
          break;
        }
        if (!(rec.idx >= 0 && rec.idx < cnt)) {
          mismatch = {
            reason: 'choice', step: state.cursor + 1, turn: Number(g.turn),
            expectedId: g.current.id, actualId: g.current.id,
            expectedIndex: Number(rec.idx) + 1, optionCount: cnt
          };
          break;
        }

        state.internal = true;
        restoreRng(rec.rs);
        var r = LS.engine.resolve(g, rec.idx);
        state.internal = false;

        if (!r || !r.ok) {
          mismatch = {
            reason: 'resolve', step: state.cursor + 1, turn: Number(g.turn),
            expectedId: g.current ? g.current.id : null, actualId: null,
            error: (r && r.error) || '引擎拒绝推进'
          };
          break;
        }

        state.cursor++;
        steps++;
        var pg = 0;
        while (r.paused && ++pg < 12) {
          r = LS.engine.continueAfter(g);
          if (!r || !r.ok) break;
          if (r.dead) break;
        }
        if (!r || !r.ok) { reason = 'pause-error'; break; }
        if (r.dead) { reason = 'dead'; break; }

        if (opts.onStep) {
          try { opts.onStep({ step: state.cursor, total: seq.length, turn: g.turn }); } catch (e) {}
        }
        refreshBadge();
      }
    } catch (err) {
      reason = 'error';
      mismatch = { reason: 'error', step: state.cursor + 1, turn: null, message: String((err && err.message) || err) };
    } finally {
      state.inReplay = false;
      state.internal = false;
      state.replaying = false;
    }

    state.mismatch = mismatch;
    if (mismatch) {
      state.blocked = true;
      sdel(PROG_KEY);
    }

    var code = exportCode();
    var res = {
      ok: !mismatch,
      seed: state.seed,
      code: code,
      reason: reason,
      steps: steps,
      total: seq.length,
      mismatch: mismatch,
      ended: !!(g && g.death && g.death.dead),
      game: g,
      eventLog: project(g)
    };

    if (mismatch) {
      var cb = opts.onMismatch || state.onMismatch;
      if (cb) { try { cb(mismatch, res); } catch (e) {} }
      refreshBadge('失配 @ 第 ' + (mismatch.turn != null ? mismatch.turn : '?') + ' 回合');
    } else if (reason === 'dead' || reason === 'exhausted') {
      sdel(PROG_KEY);
      refreshBadge(null);
    } else {
      refreshBadge(null);
    }
    return res;
  }

  /* ---------------- URL / 恢复 ---------------- */
  function urlReplay() {
    if (typeof location === 'undefined' || !location || !location.search) return null;
    var m = /[?&]replay=([^&]+)/.exec(location.search);
    if (!m) return null;
    try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
  }

  function renderIntoUI(g) {
    if (!g || !LS.ui || !LS.ui.setGame) return;
    try { LS.ui.setGame(g); } catch (e) {}
  }

  function boot() {
    init();
    var q = urlReplay();
    if (q) {
      var loaded = loadCode(q);
      if (!loaded.ok) {
        refreshBadge('回放码非法');
        return;
      }
      var res = replay({});
      if (res.ok) {
        sdel(PROG_KEY);
        renderIntoUI(res.game);
      }
      return;
    }
    var prog = sget(PROG_KEY);
    refreshBadge(prog && prog.code ? '上次回放未完成' : null);
  }

  function resume() {
    var prog = sget(PROG_KEY);
    if (!prog || !prog.code) return { ok: false, reason: 'no-progress' };
    loadCode(prog.code);
    return replay({});
  }

  /* ---------------- 对外 API ---------------- */
  LS.REPLAY = {
    /* 种子 */
    seed: function () { return state.seed; },
    setSeed: function (n) {
      var s = normSeed(n);
      if (!s) return false;
      state.seed = s;
      state.locked = true;
      state.stream = null;      /* 未开局前不做取数 */
      try { sdel(PROG_KEY); } catch (e) {}
      refreshBadge();
      return s;
    },

    /* 记录 */
    logChoice: function (turn, eventId, idx) {
      if (state.replaying && !state.internal) return false;
      var g = (LS.ui && LS.ui.getGame) ? LS.ui.getGame() : (state.last && state.last.game);
      if (g && g.seed && !state.locked) state.seed = Number(g.seed);

      var i = Number(idx);
      if (!isFinite(i) || i < 0) return false;
      i = Math.floor(i);

      var rec = { turn: Number(turn), eventId: eventId || null, idx: i, rs: snapshotRng() };
      var n = state.log.length;
      var lastRec = n ? state.log[n - 1] : null;
      if (lastRec && Number(lastRec.turn) === Number(turn) && String(lastRec.eventId) === String(eventId)) {
        lastRec.idx = i;
        lastRec.rs = rec.rs;
      } else {
        state.log.push(rec);
      }
      state.cursor = state.log.length;
      refreshBadge();
      return true;
    },

    history: function () {
      var out = [];
      for (var i = 0; i < state.log.length; i++) {
        out.push({ turn: state.log[i].turn, eventId: state.log[i].eventId, idx: state.log[i].idx });
      }
      return out;
    },

    /* 回放码 */
    exportCode: exportCode,
    loadCode: loadCode,

    /* 回放 */
    replay: replay,
    resume: resume,
    isReplaying: function () { return !!state.replaying; },
    status: function () {
      return {
        seed: state.seed,
        locked: state.locked,
        steps: state.log.length,
        replaying: state.replaying,
        blocked: state.blocked,
        mismatch: state.mismatch
      };
    },
    onMismatch: function (fn) { state.onMismatch = (typeof fn === 'function' ? fn : null); },

    /* 供接线时手动初始化（DOMContentLoaded 会自动调用） */
    init: init,
    __state: state
  };

  /* ---------------- 自启动 ---------------- */
  init();
  if (typeof document !== 'undefined' && document.addEventListener) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      setTimeout(boot, 0);
    }
  }
})();
