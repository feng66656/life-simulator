/* =========================================================
   fx.js — 表现层增强包（音效 / 震动 / 动画 / 人像 / 弹窗 / 设置）
   只挂载 window.LS.FX，不创建其它全局变量。
   无外部音频、无 CDN、无构建；WebAudio 实时合成。
   加载失败或未引入时，游戏本体不受影响。
   ========================================================= */
(function () {
  'use strict';

  var LS = window.LS = window.LS || {};
  var doc = (typeof document !== 'undefined') ? document : null;

  /* ================= 设置 ================= */
  var STORE_KEY = 'lifesim_fx_v1';
  var DEFAULTS = {
    sound: 0.7,            /* 0–1，0 为静音 */
    shake: true,           /* 震动开关 */
    motion: 'full',        /* full | reduced */
    modalMode: 'major',    /* major | all | off */
    modalMaxPerTurn: 1     /* 每回合阻断式弹窗上限，0 表示不允许，9 视为不限制 */
  };

  var memStore = null;
  function loadStore() {
    var out = {};
    for (var k in DEFAULTS) if (DEFAULTS.hasOwnProperty(k)) out[k] = DEFAULTS[k];
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        var raw = window.localStorage.getItem(STORE_KEY);
        if (raw) {
          var obj = JSON.parse(raw);
          for (var key in obj) {
            if (out.hasOwnProperty(key)) {
              var nv = normalize(key, obj[key]);
              if (nv !== null) out[key] = nv;
            }
          }
        }
      }
    } catch (e) { /* localStorage 不可用时用内存默认值 */ }
    memStore = out;
    return out;
  }
  function persist() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORE_KEY, JSON.stringify(memStore));
      }
    } catch (e) { /* 静默降级 */ }
  }
  function clamp(n, a, b) { return n < a ? a : (n > b ? b : n); }
  function normalize(key, v) {
    if (key === 'sound') {
      var n = Number(v);
      if (!isFinite(n)) return null;
      if (n > 1 && n <= 100) n = n / 100;
      return clamp(n, 0, 1);
    }
    if (key === 'shake') {
      if (v === true || v === 1 || v === 'on' || v === 'true') return true;
      if (v === false || v === 0 || v === 'off' || v === 'false') return false;
      return null;
    }
    if (key === 'motion') {
      var m = String(v).toLowerCase();
      if (m === 'reduced' || m === 'reduce' || m === 'off') return 'reduced';
      if (m === 'full' || m === 'on' || m === 'auto') return 'full';
      return null;
    }
    if (key === 'modalMode') {
      var mm = String(v).toLowerCase();
      return /^(major|all|off)$/.test(mm) ? mm : null;
    }
    if (key === 'modalMaxPerTurn') {
      var c = Math.round(Number(v));
      return isFinite(c) ? clamp(c, 0, 9) : null;
    }
    return null;
  }
  function snapshot() {
    var out = {};
    for (var k in memStore) if (memStore.hasOwnProperty(k)) out[k] = memStore[k];
    return out;
  }

  var listeners = [];
  function notify() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](snapshot()); } catch (e) {}
    }
  }

  var settings = {
    get: function (key) {
      if (key === undefined) return snapshot();
      return memStore.hasOwnProperty(key) ? memStore[key] : undefined;
    },
    set: function (key, value) {
      if (typeof key === 'object' && key !== null) {
        var changed = false;
        for (var k in key) {
          if (!key.hasOwnProperty(k)) continue;
          var nv = normalize(k, key[k]);
          if (nv !== null) { memStore[k] = nv; changed = true; }
        }
        if (changed) { persist(); applyRuntime(); notify(); }
        return snapshot();
      }
      var one = normalize(key, value);
      if (one === null) return snapshot();
      memStore[key] = one;
      persist();
      applyRuntime();
      notify();
      return snapshot();
    },
    reset: function () {
      memStore = loadStoreDefaults();
      persist();
      applyRuntime();
      notify();
      return snapshot();
    },
    subscribe: function (fn) {
      if (typeof fn !== 'function') return function () {};
      listeners.push(fn);
      return function () {
        for (var i = listeners.length - 1; i >= 0; i--) {
          if (listeners[i] === fn) listeners.splice(i, 1);
        }
      };
    }
  };
  function loadStoreDefaults() {
    var out = {};
    for (var k in DEFAULTS) if (DEFAULTS.hasOwnProperty(k)) out[k] = DEFAULTS[k];
    return out;
  }
  loadStore();

  /* ================= 动效偏好 ================= */
  function systemReduced() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }
  function motionReduced() {
    return memStore.motion === 'reduced' || systemReduced();
  }
  function applyRuntime() {
    if (audioCtx && masterGain) masterGain.gain.value = memStore.sound;
    if (doc && doc.body) {
      doc.body.classList.toggle('fx-motion-reduced', motionReduced());
    }
  }
  function applyMotionClass() { applyRuntime(); }
  if (doc) {
    if (doc.body) applyMotionClass();
    else if (doc.addEventListener) doc.addEventListener('DOMContentLoaded', applyMotionClass, { once: true });
    try {
      var mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mq && mq.addEventListener) mq.addEventListener('change', applyMotionClass);
      else if (mq && mq.addListener) mq.addListener(applyMotionClass);
    } catch (e) {}
  }

  /* ================= WebAudio 合成音效 ================= */
  var audioCtx = null;
  var masterGain = null;
  var noiseBuf = null;
  var volScale = 1;
  var audioUnlocked = false;   /* 首次真实交互前不出声，避免绕过浏览器自动播放策略 */

  function ensureCtx() {
    if (audioCtx) return audioCtx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = memStore.sound;
      masterGain.connect(audioCtx.destination);
    } catch (e) {
      audioCtx = null;
      masterGain = null;
    }
    return audioCtx;
  }

  function unlockAudio() {
    audioUnlocked = true;
    var ctx = ensureCtx();
    if (!ctx) return false;
    try {
      if (ctx.state !== 'running' && ctx.resume) ctx.resume();
    } catch (e) {}
    return true;
  }

  function play(fn) {
    if (!audioUnlocked) return false;
    if (memStore.sound <= 0) return false;
    var ctx = ensureCtx();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      var scale = volScale;
      try {
        var p = ctx.resume();
        if (p && p.then) {
          p.then(function () {
            if (ctx.state === 'running') {
              var prev = volScale;
              volScale = scale;
              try { fn(ctx); } catch (e) {}
              volScale = prev;
            }
          });
        }
      } catch (e) {}
      return false;
    }
    try { fn(ctx); } catch (e) {}
    return true;
  }

  function tone(ctx, o) {
    var t0 = ctx.currentTime + (o.delay || 0);
    var dur = Math.max(0.02, o.dur || 0.2);
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq || 440, t0);
    if (o.freq2) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freq2), t0 + dur);
    }
    var vol = Math.max(0, (o.vol === undefined ? 0.25 : o.vol) * volScale);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(Math.max(0.0002, vol), t0 + (o.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  function getNoise(ctx) {
    if (noiseBuf) return noiseBuf;
    var len = Math.floor(ctx.sampleRate * 0.6);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    noiseBuf = buf;
    return buf;
  }

  function noise(ctx, o) {
    var t0 = ctx.currentTime + (o.delay || 0);
    var dur = Math.max(0.02, o.dur || 0.2);
    var src = ctx.createBufferSource();
    src.buffer = getNoise(ctx);
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(o.f1 || 1200, t0);
    if (o.f2) bp.frequency.exponentialRampToValueAtTime(Math.max(40, o.f2), t0 + dur);
    bp.Q.value = o.q || 0.9;
    var g = ctx.createGain();
    var vol = Math.max(0, (o.vol === undefined ? 0.18 : o.vol) * volScale);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp);
    bp.connect(g);
    g.connect(masterGain);
    src.start(t0);
    src.stop(t0 + dur + 0.03);
  }

  var SOUNDS = {
    tick: function (ctx) {
      tone(ctx, { freq: 720, type: 'triangle', dur: 0.055, vol: 0.22, attack: 0.004 });
    },
    click: function (ctx) {
      tone(ctx, { freq: 440, type: 'square', dur: 0.035, vol: 0.13, attack: 0.003 });
      noise(ctx, { f1: 2600, f2: 1100, dur: 0.045, vol: 0.05, q: 1.4 });
    },
    page: function (ctx) {
      noise(ctx, { f1: 900, f2: 2600, dur: 0.24, vol: 0.2, q: 0.8 });
      noise(ctx, { f1: 300, f2: 700, dur: 0.18, vol: 0.06, q: 0.6, delay: 0.05 });
    },
    good: function (ctx) {
      tone(ctx, { freq: 523.25, type: 'triangle', dur: 0.24, vol: 0.26, delay: 0 });
      tone(ctx, { freq: 659.25, type: 'triangle', dur: 0.24, vol: 0.24, delay: 0.09 });
      tone(ctx, { freq: 783.99, type: 'triangle', dur: 0.32, vol: 0.26, delay: 0.18 });
      tone(ctx, { freq: 1046.5, type: 'sine', dur: 0.3, vol: 0.2, delay: 0.27 });
    },
    bad: function (ctx) {
      tone(ctx, { freq: 196, freq2: 128, type: 'sawtooth', dur: 0.62, vol: 0.26, delay: 0 });
      tone(ctx, { freq: 110, freq2: 76, type: 'sine', dur: 0.72, vol: 0.22, delay: 0.06 });
    },
    alarm: function (ctx, opts) {
      var times = Math.max(1, Math.min(4, Number(opts && opts.times) || 2));
      for (var i = 0; i < times; i++) {
        tone(ctx, { freq: 880, type: 'square', dur: 0.13, vol: 0.16, delay: i * 0.3 });
        tone(ctx, { freq: 620, type: 'square', dur: 0.13, vol: 0.14, delay: i * 0.3 + 0.16 });
      }
    },
    heartbeat: function (ctx, opts) {
      var times = Math.max(1, Math.min(4, Number(opts && opts.times) || 2));
      for (var i = 0; i < times; i++) {
        var base = i * 0.92;
        tone(ctx, { freq: 58, freq2: 44, type: 'sine', dur: 0.17, vol: 0.32, delay: base });
        tone(ctx, { freq: 52, freq2: 40, type: 'sine', dur: 0.13, vol: 0.24, delay: base + 0.26 });
      }
    }
  };
  var SOUND_NAMES = ['tick', 'page', 'good', 'bad', 'alarm', 'heartbeat', 'click'];
  var savedScale = 1;
  function sound(name, opts) {
    if (memStore.sound <= 0) return false;
    var fn = SOUNDS[name] || SOUNDS.tick;
    savedScale = volScale;
    volScale = (opts && isFinite(Number(opts.volume)) && Number(opts.volume) > 0) ? clamp(Number(opts.volume), 0, 2) : 1;
    var ok = play(function (ctx) { fn(ctx, opts || {}); });
    volScale = savedScale;
    return ok;
  }

  /* 首次交互解锁 AudioContext（浏览器策略） */
  if (doc && doc.addEventListener) {
    doc.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });
    doc.addEventListener('keydown', unlockAudio, { once: true, capture: true });
  }

  /* ================= 震动（transform + rAF 衰减） ================= */
  var shakeState = { raf: 0, el: null, orig: '' };

  function resolveEl(el) {
    if (!el) return null;
    if (typeof el === 'string') {
      if (!doc) return null;
      try { return doc.querySelector(el); } catch (e) { return null; }
    }
    return (el.nodeType === 1) ? el : null;
  }

  function stopShake() {
    if (!shakeState.el) return;
    if (shakeState.raf) {
      try { window.cancelAnimationFrame(shakeState.raf); } catch (e) {}
      shakeState.raf = 0;
    }
    try {
      shakeState.el.style.transform = shakeState.orig;
      shakeState.el.classList.remove('fx-shaking');
    } catch (e) {}
    shakeState.el = null;
    shakeState.orig = '';
  }

  function shake(level, opts) {
    if (memStore.shake === false) return false;
    if (!doc || !doc.body) return false;
    var lv = Math.round(Number(level) || 1);
    lv = clamp(lv, 1, 3);
    var el = resolveEl(opts && opts.target) || doc.getElementById('app') || doc.body;
    if (!el) return false;
    stopShake();
    var amp = [4, 8, 14][lv - 1];
    if (motionReduced()) amp = amp * 0.4;
    var dur = [260, 380, 560][lv - 1];
    shakeState.el = el;
    shakeState.orig = el.style.transform || '';
    el.classList.add('fx-shaking');
    var start = null;
    function step(now) {
      if (shakeState.el !== el) return;
      if (start === null) start = now;
      var p = (now - start) / dur;
      if (p >= 1) { stopShake(); return; }
      var decay = (1 - p) * (1 - p);
      var x = amp * Math.sin(p * Math.PI * 2 * (4 + lv)) * decay;
      var y = lv >= 3 ? amp * 0.28 * Math.sin(p * Math.PI * 2 * 7) * decay * (1 - p) : 0;
      el.style.transform = (shakeState.orig ? shakeState.orig + ' ' : '') +
        'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0)';
      shakeState.raf = window.requestAnimationFrame(step);
    }
    try { shakeState.raf = window.requestAnimationFrame(step); } catch (e) {}
    return true;
  }

  /* ================= 进场动画（CSS class） ================= */
  var ENTER_CLASSES = ['fx-enter', 'fx-enter--card', 'fx-enter--fade', 'fx-enter--up'];
  function enter(el, opts) {
    var node = resolveEl(el);
    if (!node) return false;
    if (motionReduced()) return false;
    var kind = 'card';
    if (typeof opts === 'string') kind = opts;
    else if (opts && opts.kind) kind = opts.kind;
    if (kind !== 'fade' && kind !== 'up') kind = 'card';
    for (var i = 0; i < ENTER_CLASSES.length; i++) node.classList.remove(ENTER_CLASSES[i]);
    void node.offsetWidth;
    node.classList.add('fx-enter');
    node.classList.add('fx-enter--' + kind);
    var token = { node: node };
    node.__fxEnter = token;
    setTimeout(function () {
      if (node.__fxEnter !== token) return;
      for (var j = 0; j < ENTER_CLASSES.length; j++) node.classList.remove(ENTER_CLASSES[j]);
    }, 760);
    return true;
  }

  /* ================= 数值滚动（只改 textContent） ================= */
  function parseNum(txt) {
    var m = String(txt == null ? '' : txt).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : 0;
  }
  function fmtNum(n, opts) {
    if (opts && typeof opts.format === 'function') {
      try { return String(opts.format(n)); } catch (e) { return String(n); }
    }
    var d = Number(opts && opts.decimals);
    if (!isFinite(d) || d < 0) d = 0;
    var s = Number(n).toFixed(d);
    if (opts && opts.thousands !== false && d === 0 && Math.abs(n) >= 1000) {
      s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    if (opts && opts.sign && n > 0) s = '+' + s;
    return (opts && opts.prefix ? opts.prefix : '') + s + (opts && opts.suffix ? opts.suffix : '');
  }
  function count(el, a, b, opts) {
    var node = resolveEl(el);
    if (!node) return Promise.resolve(false);
    var from;
    var to;
    var o = {};
    if (a !== null && typeof a === 'object') {
      o = a;
      to = Number(b);
      from = parseNum(node.textContent);
    } else if (b === undefined) {
      o = {};
      to = Number(a);
      from = parseNum(node.textContent);
    } else if (b !== null && typeof b === 'object') {
      o = b;
      to = Number(a);
      from = parseNum(node.textContent);
    } else {
      from = Number(a);
      to = Number(b);
      o = opts || {};
    }
    if (!isFinite(from)) from = 0;
    if (!isFinite(to)) to = from;
    if (!o || typeof o !== 'object') o = {};
    var duration = Number(o.duration);
    if (!isFinite(duration) || duration <= 0) duration = 650;
    var token = { node: node };
    node.__fxCount = token;
    node.classList.add('fx-count');
    node.classList.remove('fx-count-up', 'fx-count-down');
    if (to > from) node.classList.add('fx-count-up');
    else if (to < from) node.classList.add('fx-count-down');

    if (motionReduced() || duration < 40) {
      node.textContent = fmtNum(to, o);
      node.classList.remove('fx-count');
      if (typeof o.onDone === 'function') { try { o.onDone(to); } catch (e) {} }
      return Promise.resolve(true);
    }

    return new Promise(function (done) {
      var start = null;
      function step(now) {
        if (node.__fxCount !== token) { done(false); return; }
        if (start === null) start = now;
        var p = (now - start) / duration;
        if (p >= 1) {
          node.textContent = fmtNum(to, o);
          node.classList.remove('fx-count');
          if (typeof o.onDone === 'function') { try { o.onDone(to); } catch (e) {} }
          done(true);
          return;
        }
        var e = 1 - Math.pow(1 - p, 3);
        node.textContent = fmtNum(from + (to - from) * e, o);
        try { window.requestAnimationFrame(step); } catch (err) { done(false); }
      }
      try { window.requestAnimationFrame(step); } catch (err) {
        node.textContent = fmtNum(to, o);
        node.classList.remove('fx-count');
        done(false);
      }
    });
  }

  /* ================= 阶段过场（独立遮罩，不触碰 v2Overlay） ================= */
  function stage(opts) {
    if (!doc || !doc.body) return Promise.resolve(false);
    var o = (typeof opts === 'string') ? { title: opts } : (opts || {});
    var title = String(o.title || '');
    var sub = String(o.sub || '');
    var kicker = String(o.kicker || '人生阶段');
    var hold = o.hold === undefined ? 1000 : Math.max(0, Number(o.hold) || 0);
    var dismissable = o.dismissable !== false;

    var root = doc.createElement('div');
    root.className = 'fx-stage';
    root.setAttribute('aria-hidden', 'true');
    var inner = doc.createElement('div');
    inner.className = 'fx-stage-inner';
    var k = doc.createElement('div');
    k.className = 'fx-stage-kicker';
    k.textContent = kicker;
    var h = doc.createElement('h2');
    h.className = 'fx-stage-title';
    h.textContent = title;
    inner.appendChild(k);
    inner.appendChild(h);
    if (sub) {
      var p = doc.createElement('p');
      p.className = 'fx-stage-sub';
      p.textContent = sub;
      inner.appendChild(p);
    }
    root.appendChild(inner);
    doc.body.appendChild(root);

    var closed = false;
    var timer = 0;
    var onKey = function (e) {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        if (dismissable) { e.preventDefault(); close(); }
      }
    };
    function close() {
      if (closed) return;
      closed = true;
      if (timer) { clearTimeout(timer); timer = 0; }
      if (doc.removeEventListener) doc.removeEventListener('keydown', onKey);
      root.classList.remove('is-open');
      root.classList.add('is-closing');
      setTimeout(function () {
        if (root.parentNode) root.parentNode.removeChild(root);
      }, motionReduced() ? 0 : 260);
    }
    root.addEventListener('click', function () {
      if (dismissable) close();
    });
    if (doc.addEventListener) doc.addEventListener('keydown', onKey);
    requestAnimationFrameSafe(function () { root.classList.add('is-open'); });
    var resolveDone = null;
    var done = new Promise(function (resolve) { resolveDone = resolve; });
    var originalClose = close;
    close = function () {
      originalClose();
      if (resolveDone) { resolveDone(true); resolveDone = null; }
    };
    if (hold > 0) timer = setTimeout(function () { close(); }, hold);
    return { el: root, close: close, done: done };
  }
  function requestAnimationFrameSafe(fn) {
    try {
      if (window.requestAnimationFrame) window.requestAnimationFrame(fn);
      else setTimeout(fn, 16);
    } catch (e) { setTimeout(fn, 16); }
  }

  /* ================= 人物像 / 场景图 ================= */
  var STAGE_MAP = {
    infant: 'youth', inf: 'youth', child: 'youth', chd: 'youth',
    teen: 'youth', ten: 'youth', youth: 'youth', you: 'youth',
    midlife: 'midlife', mid: 'midlife', middle: 'midlife', adult: 'midlife',
    elder: 'elder', eld: 'elder', late: 'elder', lat: 'elder',
    old: 'elder', senior: 'elder', aged: 'elder',
    '婴幼儿': 'youth', '童年': 'youth', '少年': 'youth', '青年': 'youth',
    '中年': 'midlife', '中老年': 'elder', '晚年': 'elder', '老年': 'elder'
  };
  function normalizeStage(stage, age) {
    var s = String(stage == null ? '' : stage).toLowerCase();
    if (STAGE_MAP[s]) return STAGE_MAP[s];
    if (stage && STAGE_MAP[stage]) return STAGE_MAP[stage];
    var a = Number(age);
    if (isFinite(a)) {
      if (a < 18) return 'youth';
      if (a < 60) return 'midlife';
      return 'elder';
    }
    return 'youth';
  }
  function normalizeGender(g) {
    var s = String(g == null ? '' : g).toLowerCase();
    if (/男|male|^\s*m(?!rs)/.test(s)) return '男';
    if (/女|female|^\s*f(?!at)/.test(s)) return '女';
    return '其他';
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function addSize(el, size) {
    el.classList.remove('fx-portrait--sm', 'fx-portrait--md', 'fx-portrait--lg');
    el.classList.remove('fx-scene--sm', 'fx-scene--md', 'fx-scene--lg');
    if (!size) return;
    var cls = (el.classList.contains('fx-portrait') ? 'fx-portrait--' : 'fx-scene--') + String(size);
    if (size === 'sm' || size === 'md' || size === 'lg') el.classList.add(cls);
  }
  function portrait(container, gender, stage, opts) {
    var el = resolveEl(container);
    if (!el) return false;
    var o = opts || {};
    var st = normalizeStage(stage, o.age);
    var html = '';
    if (LS.artPortrait) {
      html = LS.artPortrait(normalizeGender(gender), st, 'fx-portrait-img',
        o.seed === undefined ? 0 : o.seed) || '';
    }
    el.classList.add('fx-portrait');
    addSize(el, o.size);
    el.innerHTML = html + (o.caption
      ? '<div class="fx-portrait-cap">' + esc(o.caption) + '</div>' : '');
    el.classList.toggle('fx-portrait--empty', !html);
    if (html) enter(el, { kind: 'fade' });
    return !!html;
  }
  function eventArt(container, ev, opts) {
    var el = resolveEl(container);
    if (!el) return false;
    var o = opts || {};
    var key = '';
    if (typeof ev === 'string') key = ev;
    else if (ev) {
      key = (LS.sceneKeyForEvent ? LS.sceneKeyForEvent(ev) : '') || ev.art || '';
    }
    var html = (key && LS.artHas && LS.artHas(key) && LS.artScene)
      ? LS.artScene(key, 'fx-scene-img') : '';
    el.classList.add('fx-scene');
    addSize(el, o.size);
    el.innerHTML = html;
    el.classList.toggle('fx-scene--empty', !html);
    if (html) enter(el, { kind: 'fade' });
    return !!html;
  }

  /* ================= 统一弹窗 ================= */
  var TONE_LABEL = { good: '好消息', bad: '坏消息', neutral: '提醒', crossroad: '选择' };
  var VALID_TONE = { good: 1, bad: 1, neutral: 1, crossroad: 1 };
  var modalStack = [];
  var turnCounts = {};
  var currentTurn = null;

  function setTurn(turn) {
    var n = Number(turn);
    currentTurn = isFinite(n) ? n : null;
    return currentTurn;
  }
  function trimTurns() {
    var keys = [];
    for (var k in turnCounts) if (turnCounts.hasOwnProperty(k)) keys.push(k);
    if (keys.length > 80) {
      keys.sort(function (a, b) { return Number(a) - Number(b); });
      for (var i = 0; i < keys.length - 40; i++) delete turnCounts[keys[i]];
    }
  }
  function claimTurn(turn) {
    var k = String(turn);
    var used = turnCounts[k] || 0;
    if (used >= memStore.modalMaxPerTurn) return false;
    turnCounts[k] = used + 1;
    trimTurns();
    return true;
  }
  function suppressed(opts, reason) {
    if (opts && typeof opts.onSuppress === 'function') {
      try { opts.onSuppress(reason); } catch (e) {}
    }
    return Promise.resolve(null);
  }

  if (doc && doc.addEventListener) {
    doc.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!modalStack.length) return;
      var top = modalStack[modalStack.length - 1];
      if (top && top.escClose) {
        e.preventDefault();
        top.close(null, true);
      }
    });
  }

  function modal(opts) {
    var o = opts || {};
    if (!doc || !doc.body) return Promise.resolve(null);
    var mode = memStore.modalMode;
    var level = String(o.level || 'normal');
    if (mode === 'off' || (mode === 'major' && level !== 'major')) {
      return suppressed(o, 'mode');
    }
    var blocking = o.blocking !== false;
    var turn = (o.turn === undefined) ? currentTurn : Number(o.turn);
    if (blocking && isFinite(turn) && turn !== null) {
      if (!claimTurn(turn)) return suppressed(o, 'turn-cap');
    }

    var tone = String(o.tone || 'neutral').toLowerCase();
    if (!VALID_TONE[tone]) tone = 'neutral';
    var actions = (o.actions && o.actions.length) ? o.actions : [
      { label: o.okLabel || '知道了', value: 'ok', primary: true }
    ];
    var escClose = o.escClose !== false && o.closable !== false;
    var maskClose = o.maskClose !== false && o.closable !== false;

    var root = doc.createElement('div');
    root.className = 'fx-modal tone-' + tone;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    var card = doc.createElement('div');
    card.className = 'fx-modal-card tone-' + tone;

    var head = doc.createElement('div');
    head.className = 'fx-modal-head';
    var kick = doc.createElement('span');
    kick.className = 'fx-modal-kicker';
    kick.textContent = o.kicker || TONE_LABEL[tone] || '提醒';
    var h3 = doc.createElement('h3');
    h3.className = 'fx-modal-title';
    h3.textContent = String(o.title == null ? '' : o.title);
    head.appendChild(kick);
    head.appendChild(h3);
    if (o.closable !== false) {
      var x = doc.createElement('button');
      x.type = 'button';
      x.className = 'fx-modal-x';
      x.setAttribute('aria-label', '关闭');
      x.textContent = '×';
      x.addEventListener('click', function () { close(null, true); });
      head.appendChild(x);
    }
    card.appendChild(head);

    var body = doc.createElement('div');
    body.className = 'fx-modal-body';
    if (o.body && o.body.nodeType === 1) body.appendChild(o.body);
    else body.innerHTML = (o.body == null ? '' : String(o.body));
    card.appendChild(body);

    var foot = doc.createElement('div');
    foot.className = 'fx-modal-actions';
    var firstBtn = null;
    for (var i = 0; i < actions.length; i++) {
      (function (act) {
        var btn = doc.createElement('button');
        btn.type = 'button';
        btn.className = 'btn' + (act.primary ? ' primary' : '') + (act.ghost ? ' ghost' : '');
        btn.textContent = String(act.label == null ? '确定' : act.label);
        btn.addEventListener('click', function () {
          var keep = false;
          if (typeof act.onClick === 'function') {
            try { keep = (act.onClick() === false); } catch (e) {}
          }
          if (!keep) close(act.value === undefined ? null : act.value, true);
        });
        foot.appendChild(btn);
        if (!firstBtn && act.primary) firstBtn = btn;
      })(actions[i]);
    }
    card.appendChild(foot);
    root.appendChild(card);
    doc.body.appendChild(root);

    var prevFocus = doc.activeElement;
    var closed = false;
    var sentValue = null;
    var settle = null;
    var promise = new Promise(function (resolve) { settle = resolve; });

    function close(value, byUser) {
      if (closed) return;
      closed = true;
      sentValue = value;
      for (var j = modalStack.length - 1; j >= 0; j--) {
        if (modalStack[j].root === root) modalStack.splice(j, 1);
      }
      root.classList.remove('is-open');
      root.classList.add('is-closing');
      var delay = motionReduced() ? 0 : 210;
      setTimeout(function () {
        if (root.parentNode) root.parentNode.removeChild(root);
        if (prevFocus && prevFocus.focus) { try { prevFocus.focus(); } catch (e) {} }
      }, delay);
      if (typeof o.onClose === 'function') {
        try { o.onClose(sentValue, !!byUser); } catch (e) {}
      }
      settle(sentValue);
    }

    root.addEventListener('click', function (e) {
      if (e.target === root && maskClose) close(null, true);
    });

    modalStack.push({
      root: root,
      close: close,
      escClose: escClose
    });

    requestAnimationFrameSafe(function () { root.classList.add('is-open'); });
    setTimeout(function () {
      try {
        if (firstBtn) firstBtn.focus();
        else { var b = foot.querySelector('button'); if (b) b.focus(); }
      } catch (e) {}
    }, 30);

    promise.close = function (v) { close(v === undefined ? null : v, false); };
    return promise;
  }

  /* ================= 设置面板（可插入任意容器） ================= */
  function mountSettings(container) {
    var host = resolveEl(container);
    if (!doc || !host) return null;

    var root = doc.createElement('div');
    root.className = 'fx-settings';
    var title = doc.createElement('div');
    title.className = 'fx-set-title';
    title.textContent = '表现层设置';
    root.appendChild(title);

    var volRow = row('音效音量');
    var range = doc.createElement('input');
    range.type = 'range';
    range.min = '0';
    range.max = '100';
    range.step = '5';
    range.className = 'fx-range';
    var volVal = doc.createElement('span');
    volVal.className = 'fx-set-val';
    var volWrap = doc.createElement('div');
    volWrap.className = 'fx-set-ctl';
    volWrap.appendChild(range);
    volWrap.appendChild(volVal);
    var tryBtn = doc.createElement('button');
    tryBtn.type = 'button';
    tryBtn.className = 'btn tiny';
    tryBtn.textContent = '试听';
    tryBtn.addEventListener('click', function () { sound('good'); });
    volWrap.appendChild(tryBtn);
    volRow.appendChild(volWrap);
    root.appendChild(volRow);

    var shakeRow = row('界面震动');
    var shakeBtn = doc.createElement('button');
    shakeBtn.type = 'button';
    shakeBtn.className = 'fx-switch';
    shakeBtn.setAttribute('role', 'switch');
    shakeBtn.addEventListener('click', function () {
      settings.set('shake', !memStore.shake);
      if (memStore.shake) shake(1);
    });
    shakeRow.appendChild(shakeBtn);
    root.appendChild(shakeRow);

    var motionRow = row('动效强度');
    var motionSel = doc.createElement('select');
    motionSel.className = 'fx-select';
    addOption(motionSel, 'full', '完整');
    addOption(motionSel, 'reduced', '精简');
    motionSel.addEventListener('change', function () {
      settings.set('motion', motionSel.value);
    });
    motionRow.appendChild(motionSel);
    root.appendChild(motionRow);

    if (systemReduced()) {
      var sysNote = doc.createElement('div');
      sysNote.className = 'fx-set-note';
      sysNote.textContent = '系统已开启「减少动效」，FX 动画将自动停用。';
      root.appendChild(sysNote);
    }

    var modeRow = row('弹窗频率');
    var modeSel = doc.createElement('select');
    modeSel.className = 'fx-select';
    addOption(modeSel, 'major', '仅重大事件');
    addOption(modeSel, 'all', '全部事件');
    addOption(modeSel, 'off', '关闭弹窗');
    modeSel.addEventListener('change', function () {
      settings.set('modalMode', modeSel.value);
    });
    modeRow.appendChild(modeSel);
    root.appendChild(modeRow);

    var capRow = row('每回合弹窗上限');
    var capSel = doc.createElement('select');
    capSel.className = 'fx-select';
    addOption(capSel, '0', '0 · 不允许');
    addOption(capSel, '1', '1 · 默认');
    addOption(capSel, '2', '2');
    addOption(capSel, '3', '3');
    addOption(capSel, '9', '9 · 不限制');
    capSel.addEventListener('change', function () {
      settings.set('modalMaxPerTurn', Number(capSel.value));
    });
    capRow.appendChild(capSel);
    root.appendChild(capRow);

    var foot = doc.createElement('div');
    foot.className = 'fx-set-foot';
    var resetBtn = doc.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'btn tiny ghost';
    resetBtn.textContent = '恢复默认';
    resetBtn.addEventListener('click', function () { settings.reset(); });
    foot.appendChild(resetBtn);
    root.appendChild(foot);

    host.appendChild(root);

    range.addEventListener('input', function () {
      settings.set('sound', Number(range.value) / 100);
    });

    function sync() {
      range.value = String(Math.round(memStore.sound * 100));
      volVal.textContent = memStore.sound <= 0
        ? '静音' : Math.round(memStore.sound * 100) + '%';
      shakeBtn.textContent = memStore.shake ? '开' : '关';
      shakeBtn.classList.toggle('is-on', !!memStore.shake);
      shakeBtn.setAttribute('aria-checked', memStore.shake ? 'true' : 'false');
      motionSel.value = memStore.motion;
      modeSel.value = memStore.modalMode;
      capSel.value = String(memStore.modalMaxPerTurn === 9 ? 9 : memStore.modalMaxPerTurn);
      if (!capSel.value) capSel.value = '1';
    }
    var unsub = settings.subscribe(sync);
    sync();

    return {
      el: root,
      sync: sync,
      destroy: function () {
        try { unsub(); } catch (e) {}
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }
  function row(labelText) {
    var r = doc.createElement('div');
    r.className = 'fx-set-row';
    var l = doc.createElement('span');
    l.className = 'fx-set-label';
    l.textContent = labelText;
    r.appendChild(l);
    return r;
  }
  function addOption(sel, value, label) {
    var opt = doc.createElement('option');
    opt.value = value;
    opt.textContent = label;
    sel.appendChild(opt);
  }

  /* ================= 对外 API ================= */
  LS.FX = {
    version: '1.0.0',
    SOUND_NAMES: SOUND_NAMES,
    sound: sound,
    shake: shake,
    enter: enter,
    count: count,
    stage: stage,
    portrait: portrait,
    eventArt: eventArt,
    modal: modal,
    settings: settings,
    mountSettings: mountSettings,
    setTurn: setTurn,
    unlockAudio: unlockAudio
  };
})();
