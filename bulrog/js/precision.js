/*!
 * BULROG — precision.js  (owner: builder C · prefix prec-)
 * Sections #precision (03) and #finitions (04).
 *  1. Animated counters (count up once when visible; final values live in the HTML).
 *  2. Beat visualiser: BR-01 seconds hand in 8 steps/s (driven by BulrogGears.escapement/train,
 *     balance at 4 Hz in an open-heart aperture) vs a quartz hand jumping once per second.
 *  3. Timegrapher: scrolling tic/tac dot trace on <canvas>, rate / amplitude / beat error /
 *     lift-time readouts, position selector (CH, CB, 6H, 9H, 3H), beat acoustic signature.
 *  4. Finishing samples: procedural canvas textures (côtes de Genève, perlage, anglage,
 *     vis bleuies, poli miroir, soleillage) + a ×3 loupe (pointer, touch tap, keyboard).
 * All animation goes through BulrogGears.ticker (offscreen / hidden tab / reduced motion aware).
 */
(function () {
  'use strict';

  var G = window.BulrogGears;
  var sec = document.getElementById('precision');
  var fin = document.getElementById('finitions');
  if (!G || (!sec && !fin)) return;

  var E = G.el, U = G.util, RAD = Math.PI / 180, TAU = Math.PI * 2;
  var NNBSP = ' ', MINUS = '−';
  var DPR = function () { return Math.min(window.devicePixelRatio || 1, 2); };
  var rootStyle = getComputedStyle(document.documentElement);
  function tok(name, fb) { var v = rootStyle.getPropertyValue(name).trim(); return v || fb; }
  var C = {
    gold: tok('--c-gold', '#c9a45c'), goldLight: tok('--c-gold-light', '#e6cf97'), goldDeep: tok('--c-gold-deep', '#8a6a2f'),
    steel: tok('--c-steel', '#9aa3ad'), steelLight: tok('--c-steel-light', '#d4d9de'), steelDark: tok('--c-steel-dark', '#4a5058'),
    ruby: tok('--c-ruby', '#b3122e'), rubyLight: tok('--c-ruby-light', '#e0405a'),
    blue: tok('--c-blue', '#2d4fb3'), blueLight: tok('--c-blue-light', '#5b7fe0'), blueDeep: tok('--c-blue-deep', '#13265f'),
    text: tok('--c-text', '#ece6da'), muted: tok('--c-text-muted', '#a39a8a'), dim: tok('--c-text-dim', '#6d665b'),
    mono: tok('--font-mono', 'monospace'), display: tok('--font-display', 'serif')
  };

  /* Seeded PRNG (deterministic textures & traces) */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function fmtNum(n, dec) {
    var s = Math.abs(n).toFixed(dec || 0).replace('.', ',');
    var parts = s.split(',');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
    return parts.join(',');
  }

  /* ======================================================================
   * 1. COUNTERS
   * ==================================================================== */
  (function counters() {
    if (!sec) return;
    var stats = [].slice.call(sec.querySelectorAll('.prec-stat'));
    if (!stats.length || G.reducedMotion || !('IntersectionObserver' in window)) return;

    function fmt(el, v) {
      var r = Math.round(v);
      var s = fmtNum(r, 0);
      if (!el.hasAttribute('data-prec-thousands')) s = String(Math.abs(r));
      if (el.hasAttribute('data-prec-sign')) s = (r < 0 ? MINUS : r > 0 ? '+' : '') + s;
      return s;
    }
    stats.forEach(function (li) {
      li.style.setProperty('--prec-p', '0');
      [].forEach.call(li.querySelectorAll('[data-prec-to]'), function (n) { n.textContent = fmt(n, 0); });
    });

    function run(li, delay) {
      var nums = [].slice.call(li.querySelectorAll('[data-prec-to]'));
      var dur = 1.9;
      var done = false;
      var h = G.ticker.add(function (f) {
        if (done) return;
        var p = U.clamp((f.time - delay) / dur, 0, 1);
        var e = p >= 1 ? 1 : 1 - Math.pow(2, -10 * p);   // expo out: fast, then settles like a regulated hand
        nums.forEach(function (n) { n.textContent = fmt(n, +n.getAttribute('data-prec-to') * e); });
        li.style.setProperty('--prec-p', e.toFixed(3));
        if (p >= 1) {
          done = true;
          setTimeout(function () { if (h) h.remove(); }, 0);
        }
      }, { el: li });
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        run(en.target, 0.15 + stats.indexOf(en.target) % 4 * 0.08);
      });
    }, { threshold: 0.4 });
    stats.forEach(function (li) { io.observe(li); });
  })();

  /* ======================================================================
   * 2. BEAT VISUALISER — mechanical 8 beats/s vs quartz 1 step/s
   * ==================================================================== */
  (function beatViz() {
    if (!sec) return;
    var svgM = sec.querySelector('[data-prec-dial="meca"]');
    var svgQ = sec.querySelector('[data-prec-dial="quartz"]');
    if (!svgM || !svgQ) return;
    var cellsM = [].slice.call(sec.querySelectorAll('[data-prec-cells="meca"] span'));
    var cellsQ = [].slice.call(sec.querySelectorAll('[data-prec-cells="quartz"] span'));

    function grad(defs, id, stops, radial, attrs) {
      var g = E(radial ? 'radialGradient' : 'linearGradient', Object.assign({ id: id }, attrs || {}));
      stops.forEach(function (s) { g.appendChild(E('stop', { offset: s[0], 'stop-color': s[1], 'stop-opacity': s[2] != null ? s[2] : 1 })); });
      defs.appendChild(g);
    }

    function buildDial(svg, kind) {
      var meca = kind === 'meca';
      var p = 'prec-' + kind + '-';
      var defs = E('defs');
      svg.appendChild(defs);
      grad(defs, p + 'dial', meca
        ? [['0', '#2a2e33'], ['0.55', '#16181b'], ['1', '#0b0c0d']]
        : [['0', '#232426'], ['0.7', '#161719'], ['1', '#0e0f10']], true, { cx: '0.42', cy: '0.35', r: '0.75' });
      grad(defs, p + 'sheen', [['0', '#ffffff', 0.10], ['0.5', '#ffffff', 0], ['1', '#ffffff', 0.04]], false, { x1: '0', y1: '0', x2: '1', y2: '1' });
      var clip = E('clipPath', { id: p + 'ap' }, [E('circle', { cx: 0, cy: 46, r: 29 })]);
      defs.appendChild(clip);

      /* case & bezel */
      svg.appendChild(E('circle', { r: 119, fill: meca ? 'url(#bg-gold)' : 'url(#bg-steel)' }));
      svg.appendChild(E('circle', { r: 114.5, fill: 'none', stroke: 'rgba(0,0,0,.55)', 'stroke-width': 1.2 }));
      svg.appendChild(E('circle', { r: 113, fill: 'url(#' + p + 'dial)' }));
      if (meca) {
        /* fine sunray on the dial */
        var rays = '';
        for (var k = 0; k < 180; k++) {
          var a = k * 2 * RAD;
          rays += 'M' + U.round(Math.cos(a) * 8) + ' ' + U.round(Math.sin(a) * 8) + 'L' + U.round(Math.cos(a) * 112) + ' ' + U.round(Math.sin(a) * 112);
        }
        svg.appendChild(E('path', { d: rays, stroke: 'rgba(255,255,255,.035)', 'stroke-width': 0.5 }));
      }
      svg.appendChild(E('circle', { r: 113, fill: 'url(#' + p + 'sheen)' }));

      /* minute track (chemin de fer) */
      svg.appendChild(E('circle', { r: 105, fill: 'none', stroke: 'rgba(230,207,151,.35)', 'stroke-width': 0.5 }));
      svg.appendChild(E('circle', { r: 97, fill: 'none', stroke: 'rgba(230,207,151,.22)', 'stroke-width': 0.4 }));
      var fine = '', mid = '', big = '';
      var n = meca ? 480 : 60, step = 360 / n;
      for (var i = 0; i < n; i++) {
        var ang = (i * step - 90) * RAD, c = Math.cos(ang), s = Math.sin(ang);
        var isBig = meca ? i % 40 === 0 : i % 5 === 0;
        var isMid = meca ? i % 8 === 0 : true;
        var r0 = isBig ? 92 : isMid ? 97 : 101.2, r1 = 105;
        var seg = 'M' + U.round(c * r0) + ' ' + U.round(s * r0) + 'L' + U.round(c * r1) + ' ' + U.round(s * r1);
        if (isBig) big += seg; else if (isMid) mid += seg; else fine += seg;
      }
      if (fine) svg.appendChild(E('path', { d: fine, stroke: 'rgba(212,217,222,.38)', 'stroke-width': 0.28 }));
      svg.appendChild(E('path', { d: mid, stroke: 'rgba(236,230,218,.75)', 'stroke-width': 0.7 }));
      svg.appendChild(E('path', { d: big, stroke: C.goldLight, 'stroke-width': 1.6 }));
      for (var j = 1; j <= 12; j++) {
        var aa = (j * 30 - 90) * RAD;
        var tx = E('text', { x: U.round(Math.cos(aa) * 83), y: U.round(Math.sin(aa) * 83 + 2.6), 'text-anchor': 'middle' });
        tx.textContent = j === 12 ? '60' : (j * 5 < 10 ? '0' : '') + j * 5;
        svg.appendChild(tx);
      }
      var brand = E('text', { class: 'prec-dial-brand', x: 0, y: -44, 'text-anchor': 'middle' });
      brand.textContent = 'BULROG';
      svg.appendChild(brand);
      var sub = E('text', { class: 'prec-dial-sub', x: 0, y: -34, 'text-anchor': 'middle' });
      sub.textContent = meca ? 'CALIBRE BR-01 · 28 800' : 'QUARTZ';
      svg.appendChild(sub);

      /* aperture at 6 o'clock */
      var ap = E('g', { 'clip-path': 'url(#' + p + 'ap)' });
      ap.appendChild(E('circle', { cx: 0, cy: 46, r: 29, fill: meca ? '#07080a' : '#0b1310' }));
      var moving = {};
      if (meca) {
        /* perlage glimpse (platine) */
        var pr = rng(7), perl = E('g', { opacity: 0.55 });
        for (var py = 16; py < 80; py += 5.2) for (var px = -32; px < 34; px += 6) {
          perl.appendChild(E('circle', { cx: px + (Math.round(py) % 2 ? 3 : 0), cy: py, r: 3.3, fill: 'none', stroke: 'rgba(212,217,222,' + (0.08 + pr() * 0.1).toFixed(3) + ')', 'stroke-width': 0.6 }));
        }
        ap.appendChild(perl);
        var bal = E('g', { transform: 'translate(0 46)' });
        var rot = E('g');
        var bw = G.balanceWheel({ radius: 24, rim: 2.6, arms: 3, weights: 4 });
        rot.appendChild(E('path', { d: bw.d, fill: 'url(#bg-gold)', 'fill-rule': 'evenodd', stroke: 'rgba(0,0,0,.4)', 'stroke-width': 0.3 }));
        bw.weights.forEach(function (w) {
          rot.appendChild(E('circle', { cx: w.x, cy: w.y, r: 2.3, fill: 'url(#bg-gold-radial)', stroke: 'rgba(0,0,0,.45)', 'stroke-width': 0.3 }));
        });
        /* impulse roller + ruby pin */
        rot.appendChild(E('circle', { r: 4.2, fill: 'url(#bg-steel)' }));
        rot.appendChild(E('ellipse', { cx: 0, cy: 3.6, rx: 0.8, ry: 1.1, fill: C.rubyLight }));
        var spring = E('path', { d: '', fill: 'none', stroke: 'rgba(212,217,222,.85)', 'stroke-width': 0.35 });
        bal.appendChild(rot);
        bal.appendChild(spring);
        /* balance cock */
        bal.appendChild(E('path', { d: 'M40 -16 L40 -4 C22 -3 12 1 8 4 A8 8 0 1 1 6 -6 C14 -9 24 -14 40 -16 Z', fill: 'url(#bg-rhodium)', stroke: 'rgba(0,0,0,.55)', 'stroke-width': 0.5 }));
        bal.appendChild(E('path', { d: 'M40 -15 C24 -13 14 -8.5 6.4 -5.4', fill: 'none', stroke: 'rgba(255,255,255,.55)', 'stroke-width': 0.6 }));
        bal.appendChild(G.jewel({ x: 0, y: 0, r: 2.2 }));
        bal.appendChild(G.screw({ x: 22, y: -7.6, r: 2.1, slot: 20 }));
        ap.appendChild(bal);
        moving.rot = rot; moving.spring = spring;
      } else {
        /* quartz module: PCB, crystal can, step-motor coil and rotor */
        var tr = '';
        for (var q = 0; q < 7; q++) tr += 'M' + (-30 + q * 2.4) + ' ' + (22 + q * 3) + 'h' + (26 - q * 2) + 'v' + (10 + q);
        ap.appendChild(E('path', { d: tr, stroke: 'rgba(201,164,92,.35)', 'stroke-width': 0.6, fill: 'none' }));
        ap.appendChild(E('rect', { x: -22, y: 30, width: 30, height: 9, rx: 4.5, fill: 'url(#bg-steel)' }));
        var xt = E('text', { x: -7, y: 36.3, 'text-anchor': 'middle', style: 'font-size:4px;fill:#1a1d20' });
        xt.textContent = '32.768 kHz';
        ap.appendChild(xt);
        ap.appendChild(E('rect', { x: -14, y: 48, width: 30, height: 10, rx: 1.5, fill: C.goldDeep }));
        var coil = '';
        for (var cl = 0; cl < 14; cl++) coil += 'M' + (-13 + cl * 2) + ' 48v10';
        ap.appendChild(E('path', { d: coil, stroke: 'rgba(0,0,0,.35)', 'stroke-width': 0.8 }));
        ap.appendChild(E('circle', { cx: 18, cy: 53, r: 5.5, fill: 'url(#bg-steel)' }));
        moving.rotor = E('path', { d: 'M18 48.2 L19.4 53 L18 57.8 L16.6 53 Z', fill: C.rubyLight });
        ap.appendChild(moving.rotor);
      }
      svg.appendChild(ap);
      svg.appendChild(E('circle', { cx: 0, cy: 46, r: 29.6, fill: 'none', stroke: meca ? 'url(#bg-gold)' : 'url(#bg-steel)', 'stroke-width': 2.2 }));
      svg.appendChild(E('circle', { cx: 0, cy: 46, r: 28.4, fill: 'none', stroke: 'rgba(0,0,0,.6)', 'stroke-width': 0.6 }));

      /* hands */
      var hourD = meca ? 'M0 -52 L4.4 -6 L0 7 L-4.4 -6 Z' : 'M-2.4 8 L-2 -50 L2 -50 L2.4 8 Z';
      var minD = meca ? 'M0 -90 L3.6 -8 L0 8 L-3.6 -8 Z' : 'M-2 9 L-1.6 -88 L1.6 -88 L2 9 Z';
      var handFill = meca ? 'url(#bg-gold)' : 'url(#bg-steel)';
      var hour = E('g', {}, [E('path', { d: hourD, fill: handFill, stroke: 'rgba(0,0,0,.5)', 'stroke-width': 0.4 }),
        meca ? E('path', { d: 'M0 -52 L0 7', stroke: 'rgba(255,255,255,.35)', 'stroke-width': 0.5 }) : null]);
      var minute = E('g', {}, [E('path', { d: minD, fill: handFill, stroke: 'rgba(0,0,0,.5)', 'stroke-width': 0.4 }),
        meca ? E('path', { d: 'M0 -90 L0 8', stroke: 'rgba(255,255,255,.35)', 'stroke-width': 0.5 }) : null]);
      svg.appendChild(hour);
      svg.appendChild(minute);

      var ghosts = [];
      var gCount = meca ? 7 : 1;
      for (var gi = 1; gi <= gCount; gi++) {
        var gl = E('line', { x1: 0, y1: -60, x2: 0, y2: -104, stroke: meca ? C.rubyLight : C.steelLight, 'stroke-width': 0.9, 'stroke-linecap': 'round', opacity: (meca ? 0.5 * (1 - gi / 8) : 0.28).toFixed(3) });
        svg.appendChild(gl);
        ghosts.push(gl);
      }
      var secColor = meca ? C.rubyLight : C.steelLight;
      var second = E('g', {}, [
        E('path', { d: 'M-0.55 22 L-0.35 -106 L0.35 -106 L0.55 22 Z', fill: secColor }),
        E('circle', { cx: 0, cy: 16, r: meca ? 3.6 : 3, fill: secColor }),
        meca ? E('circle', { cx: 0, cy: 16, r: 1.6, fill: '#0b0c0d' }) : null
      ]);
      svg.appendChild(second);
      svg.appendChild(E('circle', { r: 3.4, fill: handFill }));
      svg.appendChild(E('circle', { r: 1.3, fill: meca ? C.ruby : '#2a2d31' }));
      /* crystal reflection */
      svg.appendChild(E('path', { d: 'M-80 -78 A112 112 0 0 1 60 -96 A130 130 0 0 0 -80 -78 Z', fill: 'rgba(255,255,255,.05)' }));
      return { hour: hour, minute: minute, second: second, ghosts: ghosts, moving: moving };
    }

    var M = buildDial(svgM, 'meca');
    var Q = buildDial(svgQ, 'quartz');

    var now = new Date();
    var baseSec = now.getSeconds() + now.getMilliseconds() / 1000;
    var baseMin = now.getHours() % 12 * 60 + now.getMinutes();
    var lastCellM = -1, lastCellQ = -1;

    function rotate(el, deg) { el.setAttribute('transform', 'rotate(' + U.round(deg) + ')'); }
    function backOut(x) { var c1 = 2.2, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }

    function frame(f) {
      var t = f.time;                               // seconds within the demo (starts at real clock second)
      var st = G.escapement(t);
      var trn = G.train(st);
      var mech = -trn.fourth;                       // seconds wheel: 0.75° per alternation, 6°/s
      var beatsDone = Math.round(st.beats);
      var totalMin = baseMin + t / 60;
      /* hour / minute (both dials show the same time) */
      [M, Q].forEach(function (D) {
        rotate(D.minute, totalMin * 6);
        rotate(D.hour, totalMin / 2);
      });
      /* mechanical seconds: stepped by the escapement */
      rotate(M.second, mech);
      for (var k = 0; k < M.ghosts.length; k++) rotate(M.ghosts[k], (beatsDone - k - 1) * 0.75);
      M.moving.rot.setAttribute('transform', 'rotate(' + U.round(st.balanceDeg) + ')');
      M.moving.spring.setAttribute('d', G.hairspringPath({ inner: 3.4, outer: 15, turns: 9, twist: st.balanceDeg * RAD * 0.9, phase: -0.6, samples: 22 }));
      /* quartz: one fast jump per second, tiny overshoot */
      var whole = Math.floor(t), frac = t - whole;
      var jump = frac < 0.045 ? backOut(frac / 0.045) : 1;
      rotate(Q.second, (whole - 1 + jump) * 6);
      rotate(Q.ghosts[0], (whole - 1) * 6);
      Q.moving.rotor.setAttribute('transform', 'rotate(' + ((whole % 2) * 180 + (jump - 1) * 180) + ' 18 53)');
      /* cells */
      var cM = ((beatsDone % 8) + 8) % 8;
      if (cM !== lastCellM) {
        lastCellM = cM;
        for (var i = 0; i < cellsM.length; i++) cellsM[i].classList.toggle('is-on', i <= cM);
      }
      var cQ = frac < 0.14 ? 1 : 0;
      if (cQ !== lastCellQ) { lastCellQ = cQ; cellsQ.forEach(function (c) { c.classList.toggle('is-on', !!cQ); }); }
    }

    var handle = G.ticker.add(frame, { el: svgM.closest('.prec-beat-grid') || svgM, reduced: 'run', time: baseSec, autoplay: !G.reducedMotion });

    /* controls */
    var playBtn = sec.querySelector('[data-prec-beat-play]');
    var speedBtns = [].slice.call(sec.querySelectorAll('[data-prec-speed]'));
    function syncPlay() {
      if (!playBtn) return;
      var paused = !handle.playing;
      playBtn.setAttribute('data-paused', paused ? 'true' : 'false');
      playBtn.querySelector('.prec-btn-text').textContent = paused ? 'Lecture' : 'Pause';
    }
    if (playBtn) playBtn.addEventListener('click', function () { handle.toggle(); syncPlay(); });
    speedBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        handle.speed = parseFloat(b.getAttribute('data-prec-speed')) || 1;
        speedBtns.forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
        if (!handle.playing) { handle.play(); syncPlay(); }
      });
    });
    syncPlay();
  })();

  /* ======================================================================
   * 3. TIMEGRAPHER
   * ==================================================================== */
  (function timegrapher() {
    if (!sec) return;
    var dev = sec.querySelector('[data-prec-tg]');
    if (!dev) return;
    var cvT = dev.querySelector('[data-prec-tg-trace]');
    var cvW = dev.querySelector('[data-prec-tg-wave]');
    var out = {};
    [].forEach.call(dev.querySelectorAll('[data-prec-tg-out]'), function (n) { out[n.getAttribute('data-prec-tg-out')] = n; });
    var live = dev.querySelector('[data-prec-tg-live]');
    var stateEl = dev.querySelector('[data-prec-tg-state]');
    var ctxT = cvT.getContext('2d'), ctxW = cvW.getContext('2d');

    /* Plausible BR-01 figures per position (rate within −2 / +4 s/j, spread 5 s/j) */
    var POS = {
      CH: { rate: 2, amp: 285, be: 0.2, name: 'cadran en haut' },
      CB: { rate: 3, amp: 289, be: 0.1, name: 'cadran en bas' },
      '6H': { rate: -1, amp: 266, be: 0.3, name: '6 heures en haut' },
      '9H': { rate: 1, amp: 262, be: 0.2, name: '9 heures en haut' },
      '3H': { rate: -2, amp: 264, be: 0.3, name: '3 heures en haut' }
    };
    var LIFT = G.CALIBRE.liftDeg, F = G.CALIBRE.freqHz, BEAT = 1 / (2 * F);
    var WIN = 16;              // seconds shown
    var RANGE = 1.5;           // ms full height
    var target = POS.CH;
    var cur = { rate: target.rate, amp: target.amp, be: target.be };
    var disturb = 0, settleUntil = 0;
    var rand = rng(1874);
    var beats = [];            // { t, y, odd }
    var nextBeat = 0, cum = 0;
    var lastRead = -1, lastT = 0, waveSeed = 1;
    var W = 0, H = 0, WW = 0, WH = 0, dpr = 1;
    var gridCache = null;

    function gauss() { return (rand() + rand() + rand() - 1.5) / 1.5; }
    function liftMs(amp) { return 2 / (TAU * F) * Math.asin(Math.min(1, LIFT / (2 * amp))) * 1000; }

    function genBeats(t, dt) {
      var k = Math.max(0.0001, dt);
      var a = 1 - Math.exp(-k / 1.1);
      cur.rate += (target.rate - cur.rate) * a;
      cur.amp += (target.amp - cur.amp) * a;
      cur.be += (target.be - cur.be) * (1 - Math.exp(-k / 0.8));
      disturb *= Math.exp(-k / 0.5);
      while (nextBeat * BEAT <= t) {
        var tb = nextBeat * BEAT;
        cum += cur.rate / 86400 * BEAT * 1000;       // ms gained per beat
        var odd = nextBeat % 2 === 1;
        var y = cum + (odd ? -cur.be / 2 : cur.be / 2) + gauss() * (0.012 + disturb * 0.09);
        beats.push({ t: tb, y: y, odd: odd });
        nextBeat++;
        waveSeed = nextBeat;
      }
      var minT = t - WIN - 0.5;
      var cut = 0;
      while (cut < beats.length && beats[cut].t < minT) cut++;
      if (cut) beats.splice(0, cut);
    }

    function size() {
      dpr = DPR();
      var r1 = cvT.getBoundingClientRect(), r2 = cvW.getBoundingClientRect();
      W = Math.max(1, Math.round(r1.width * dpr)); H = Math.max(1, Math.round(r1.height * dpr));
      WW = Math.max(1, Math.round(r2.width * dpr)); WH = Math.max(1, Math.round(r2.height * dpr));
      if (cvT.width !== W) cvT.width = W;
      if (cvT.height !== H) cvT.height = H;
      if (cvW.width !== WW) cvW.width = WW;
      if (cvW.height !== WH) cvW.height = WH;
      gridCache = null;
    }

    function drawGrid() {
      var g = document.createElement('canvas');
      g.width = W; g.height = H;
      var c = g.getContext('2d');
      var padL = 44 * dpr, padT = 26 * dpr, padB = 14 * dpr;
      var ph = H - padT - padB;
      c.fillStyle = '#060706';
      c.fillRect(0, 0, W, H);
      /* fine phosphor grid */
      c.lineWidth = 1;
      for (var i = 0; i <= 10; i++) {
        var y = Math.round(padT + ph * i / 10) + 0.5;
        c.strokeStyle = i === 5 ? 'rgba(201,164,92,.28)' : i % 5 === 0 ? 'rgba(201,164,92,.18)' : 'rgba(201,164,92,.07)';
        c.beginPath(); c.moveTo(padL, y); c.lineTo(W, y); c.stroke();
      }
      for (var s = 0; s <= WIN; s += 2) {
        var x = Math.round(padL + (W - padL) * s / WIN) + 0.5;
        c.strokeStyle = 'rgba(201,164,92,.07)';
        c.beginPath(); c.moveTo(x, padT); c.lineTo(x, padT + ph); c.stroke();
      }
      c.fillStyle = C.dim;
      c.font = (9 * dpr) + 'px ' + C.mono;
      c.textAlign = 'right';
      c.textBaseline = 'middle';
      c.fillText('+0,75', padL - 7 * dpr, padT);
      c.fillText('0', padL - 7 * dpr, padT + ph / 2);
      c.fillText(MINUS + '0,75', padL - 7 * dpr, padT + ph);
      c.save();
      c.translate(11 * dpr, padT + ph / 2);
      c.rotate(-Math.PI / 2);
      c.textAlign = 'center';
      c.fillText('ms', 0, 0);
      c.restore();
      c.textAlign = 'right';
      c.textBaseline = 'alphabetic';
      c.fillText(MINUS + WIN + ' s', padL + 30 * dpr, H - 3 * dpr);
      c.fillText('maintenant', W - 6 * dpr, H - 3 * dpr);
      gridCache = { canvas: g, padL: padL, padT: padT, ph: ph };
    }

    function drawTrace(t) {
      if (!gridCache) drawGrid();
      var gc = gridCache;
      ctxT.drawImage(gc.canvas, 0, 0);
      var pw = W - gc.padL;
      ctxT.save();
      ctxT.beginPath();
      ctxT.rect(gc.padL, gc.padT - 4 * dpr, pw, gc.ph + 8 * dpr);
      ctxT.clip();
      var r = Math.max(1.3, 1.5 * dpr);
      for (var pass = 0; pass < 2; pass++) {
        for (var i = 0; i < beats.length; i++) {
          var b = beats[i];
          var age = t - b.t;
          if (age < 0 || age > WIN) continue;
          var x = gc.padL + pw * (1 - age / WIN);
          var yy = b.y / RANGE + 0.5;
          yy = yy - Math.floor(yy);                  // wrap like a real instrument
          var y = gc.padT + gc.ph * (1 - yy);
          var col = b.odd ? '212,217,222' : '230,207,151';
          if (pass === 0) {
            ctxT.fillStyle = 'rgba(' + col + ',.13)';
            ctxT.beginPath(); ctxT.arc(x, y, r * 2.6, 0, TAU); ctxT.fill();
          } else {
            ctxT.fillStyle = 'rgba(' + col + ',' + (0.55 + 0.45 * (1 - age / WIN)).toFixed(3) + ')';
            ctxT.beginPath(); ctxT.arc(x, y, r, 0, TAU); ctxT.fill();
          }
        }
      }
      /* scan head */
      var hx = W - 1.5 * dpr;
      var lg = ctxT.createLinearGradient(hx - 40 * dpr, 0, hx, 0);
      lg.addColorStop(0, 'rgba(201,164,92,0)');
      lg.addColorStop(1, 'rgba(201,164,92,.16)');
      ctxT.fillStyle = lg;
      ctxT.fillRect(hx - 40 * dpr, gc.padT, 40 * dpr, gc.ph);
      ctxT.restore();
    }

    function drawWave(amp) {
      var c = ctxW, w = WW, h = WH;
      c.fillStyle = '#060706';
      c.fillRect(0, 0, w, h);
      var padX = 10 * dpr, top = 24 * dpr, bot = 24 * dpr;
      var mid = top + (h - top - bot) / 2, ah = (h - top - bot) / 2;
      var span = 11;                                          // ms across the screen
      var Lt = liftMs(amp);
      var t1 = 1.2, t2 = t1 + Lt * 0.42, t3 = t1 + Lt;
      var X = function (ms) { return padX + (w - 2 * padX) * ms / span; };
      /* grid */
      c.strokeStyle = 'rgba(201,164,92,.08)';
      c.lineWidth = 1;
      for (var m = 0; m <= span; m++) { var gx = Math.round(X(m)) + 0.5; c.beginPath(); c.moveTo(gx, top); c.lineTo(gx, h - bot); c.stroke(); }
      c.strokeStyle = 'rgba(201,164,92,.2)';
      c.beginPath(); c.moveTo(padX, Math.round(mid) + 0.5); c.lineTo(w - padX, Math.round(mid) + 0.5); c.stroke();
      /* signal: three damped bursts (unlock, impulse, drop) */
      var rr = rng(waveSeed * 97 + 13);
      var bursts = [
        { t0: t1, a: 0.55, f: 6.5, tau: 0.22 },
        { t0: t2, a: 0.42, f: 4.8, tau: 0.45 },
        { t0: t3, a: 0.95, f: 5.6, tau: 0.35 }
      ].map(function (b) { b.a *= 0.85 + rr() * 0.3; b.ph = rr() * TAU; b.t0 += (rr() - 0.5) * 0.05; return b; });
      var N = Math.max(200, Math.round(w / (1.2 * dpr)));
      c.beginPath();
      for (var i = 0; i <= N; i++) {
        var tm = span * i / N;
        var v = (rr() - 0.5) * 0.04;
        for (var k = 0; k < bursts.length; k++) {
          var b = bursts[k], d = tm - b.t0;
          if (d > 0) v += b.a * Math.exp(-d / b.tau) * Math.sin(TAU * b.f * d + b.ph) * Math.min(1, d / 0.05);
        }
        var px = X(tm), py = mid - U.clamp(v, -1, 1) * ah;
        if (i) c.lineTo(px, py); else c.moveTo(px, py);
      }
      c.strokeStyle = 'rgba(230,207,151,.18)';
      c.lineWidth = 3.2 * dpr;
      c.stroke();
      c.strokeStyle = C.goldLight;
      c.lineWidth = 1 * dpr;
      c.stroke();
      /* markers */
      c.setLineDash([3 * dpr, 3 * dpr]);
      c.strokeStyle = 'rgba(224,64,90,.7)';
      [t1, t3].forEach(function (tm) { var mx = Math.round(X(tm)) + 0.5; c.beginPath(); c.moveTo(mx, top - 4 * dpr); c.lineTo(mx, h - bot + 4 * dpr); c.stroke(); });
      c.setLineDash([]);
      c.fillStyle = C.muted;
      c.font = (8.5 * dpr) + 'px ' + C.mono;
      c.textAlign = 'center';
      c.textBaseline = 'top';
      var ly = h - bot + 7 * dpr;
      c.fillText('dégag.', X(t1), ly);
      c.fillText('impuls.', X(t2), ly);
      c.fillText('chute', X(t3), ly);
    }

    var shown = { rate: null, amp: null, be: null, lift: null };
    function setOut(key, txt) {
      if (shown[key] === txt || !out[key]) return;
      shown[key] = txt;
      out[key].textContent = txt;
    }
    function readouts(t, force) {
      if (!force && t - lastRead < 0.3) return;
      lastRead = t;
      var r = Math.round(cur.rate + gauss() * 0.3 * (1 + disturb * 6));
      setOut('rate', (r > 0 ? '+' : r < 0 ? MINUS : '') + Math.abs(r));
      var a = Math.round(cur.amp + gauss() * 1.2 * (1 + disturb * 6));
      setOut('amp', String(a));
      var be = Math.max(0, cur.be + gauss() * 0.03);
      setOut('be', fmtNum(be, 1));
      setOut('lift', fmtNum(liftMs(a), 1));
      if (stateEl) {
        var st = !handle || handle.playing ? (t < settleUntil ? 'Stabilisation…' : 'Mesure en cours') : 'En pause';
        if (stateEl.textContent !== st) stateEl.textContent = st;
      }
    }

    var lastWaveBeat = -1;
    function frame(f) {
      if (!W) size();
      var t = f.time;
      genBeats(t, f.dt || (t - lastT));
      lastT = t;
      drawTrace(t);
      if (nextBeat !== lastWaveBeat) { lastWaveBeat = nextBeat; drawWave(cur.amp); }
      readouts(t, f.dt === 0);
    }

    var handle = null;
    handle = G.ticker.add(frame, { el: dev, reduced: 'run', time: WIN + 0.4, autoplay: !G.reducedMotion });

    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(function () { size(); handle.renderOnce(); });
      ro.observe(cvT); ro.observe(cvW);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { gridCache = null; lastWaveBeat = -1; handle.renderOnce(); });

    /* position selector */
    var posBtns = [].slice.call(dev.querySelectorAll('[data-prec-pos]'));
    posBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        var key = b.getAttribute('data-prec-pos');
        if (!POS[key] || target === POS[key]) return;
        target = POS[key];
        posBtns.forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
        if (handle.playing && !G.reducedMotion) {
          disturb = 1;
          settleUntil = handle.time + 1.4;
        } else {
          /* paused / reduced motion: jump straight to the settled measurement */
          cur.rate = target.rate; cur.amp = target.amp; cur.be = target.be;
          beats = []; nextBeat = Math.max(0, Math.floor((handle.time - WIN - 0.5) / BEAT)); cum = 0;
          handle.renderOnce();
        }
        if (live) {
          var r = target.rate;
          live.textContent = 'Position ' + target.name + '. Marche ' + (r > 0 ? 'plus ' : r < 0 ? 'moins ' : '') + Math.abs(r) + ' seconde' + (Math.abs(r) > 1 ? 's' : '') + ' par jour, amplitude ' + target.amp + ' degrés, écart de repère ' + fmtNum(target.be, 1) + ' milliseconde.';
        }
      });
    });

    var playBtn = dev.querySelector('[data-prec-tg-play]');
    function syncPlay() {
      var paused = !handle.playing;
      dev.classList.toggle('is-paused', paused);
      if (!playBtn) return;
      playBtn.setAttribute('data-paused', paused ? 'true' : 'false');
      playBtn.querySelector('.prec-btn-text').textContent = paused ? 'Mesurer' : 'Pause';
      readouts(handle.time, true);
    }
    if (playBtn) playBtn.addEventListener('click', function () { handle.toggle(); syncPlay(); });
    syncPlay();
  })();

  /* ======================================================================
   * 4. FINISHINGS — procedural textures + loupe
   * ==================================================================== */
  (function finishings() {
    if (!fin) return;
    var samples = [].slice.call(fin.querySelectorAll('[data-prec-tex]'));
    if (!samples.length) return;
    var ZOOM = 3;

    /* ---- shared helpers ------------------------------------------------ */
    function hex(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
    function mix(a, b, t) { var A = hex(a), B = hex(b); return 'rgb(' + Math.round(A[0] + (B[0] - A[0]) * t) + ',' + Math.round(A[1] + (B[1] - A[1]) * t) + ',' + Math.round(A[2] + (B[2] - A[2]) * t) + ')'; }
    var noiseTile = null;
    function noise(ctx) {
      if (!noiseTile) {
        noiseTile = document.createElement('canvas');
        noiseTile.width = noiseTile.height = 96;
        var nc = noiseTile.getContext('2d'), id = nc.createImageData(96, 96), r = rng(42);
        for (var i = 0; i < id.data.length; i += 4) {
          var v = r() < 0.5 ? 0 : 255;
          id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
          id.data[i + 3] = Math.round(r() * 38);
        }
        nc.putImageData(id, 0, 0);
      }
      return ctx.createPattern(noiseTile, 'repeat');
    }
    function grain(ctx, w, h, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = noise(ctx);
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    function vignette(ctx, w, h, a) {
      var g = ctx.createRadialGradient(w * 0.45, h * 0.4, Math.min(w, h) * 0.2, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,' + a + ')');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    function conic(ctx, a, x, y, stops) {
      if (!ctx.createConicGradient) {
        var rg = ctx.createRadialGradient(x, y, 0, x, y, 30);
        rg.addColorStop(0, stops[0][1]); rg.addColorStop(1, stops[stops.length - 1][1]);
        return rg;
      }
      var g = ctx.createConicGradient(a, x, y);
      stops.forEach(function (s) { g.addColorStop(s[0], s[1]); });
      return g;
    }
    function cJewel(ctx, x, y, r) {
      var g = ctx.createRadialGradient(x - r * 0.6, y - r * 0.7, r * 0.1, x, y, r * 1.7);
      g.addColorStop(0, '#f6e4b0'); g.addColorStop(0.45, C.gold); g.addColorStop(0.8, C.goldDeep); g.addColorStop(1, '#5a4219');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r * 1.65, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = r * 0.07; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,240,200,.5)'; ctx.lineWidth = r * 0.05;
      ctx.beginPath(); ctx.arc(x, y, r * 1.2, 0, TAU); ctx.stroke();
      var rg = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
      rg.addColorStop(0, '#ff9aab'); rg.addColorStop(0.35, C.rubyLight); rg.addColorStop(0.75, C.ruby); rg.addColorStop(1, '#4a0410');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1a0306';
      ctx.beginPath(); ctx.arc(x, y, r * 0.26, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,225,230,.6)';
      ctx.beginPath(); ctx.ellipse(x - r * 0.38, y - r * 0.42, r * 0.3, r * 0.15, -0.6, 0, TAU); ctx.fill();
    }
    function cScrew(ctx, x, y, r, col, slot, sink) {
      /* polished countersink */
      if (sink !== false) {
        var s = ctx.createRadialGradient(x, y, r * 0.95, x, y, r * 1.45);
        s.addColorStop(0, '#2a2e33'); s.addColorStop(0.35, '#f2f4f6'); s.addColorStop(0.7, '#8d949b'); s.addColorStop(1, '#3a3f45');
        ctx.fillStyle = s;
        ctx.beginPath(); ctx.arc(x, y, r * 1.45, 0, TAU); ctx.fill();
      }
      /* head: temper colour with a polished bevel */
      var hg = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r * 1.05);
      hg.addColorStop(0, mix(col, '#ffffff', 0.55)); hg.addColorStop(0.45, col); hg.addColorStop(1, mix(col, '#000000', 0.55));
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = mix(col, '#ffffff', 0.35); ctx.lineWidth = r * 0.12;
      ctx.beginPath(); ctx.arc(x, y, r * 0.9, Math.PI * 1.05, Math.PI * 1.75); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = r * 0.06;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      /* slot */
      ctx.save();
      ctx.translate(x, y); ctx.rotate(slot * RAD);
      ctx.fillStyle = '#05070c';
      ctx.fillRect(-r * 0.98, -r * 0.13, r * 1.96, r * 0.26);
      ctx.fillStyle = 'rgba(255,255,255,.22)';
      ctx.fillRect(-r * 0.9, r * 0.1, r * 1.8, r * 0.04);
      ctx.restore();
    }

    /* ---- textures (drawn in CSS px space, w × h) ---------------------- */
    function cotes(ctx, w, h, o) {
      o = o || {};
      var P = o.period || 22, ang = o.angle != null ? o.angle : -0.42;
      var dark = o.dark || '#6b727a', light = o.light || '#f3f5f6', midc = o.mid || '#b8bec4';
      ctx.save();
      ctx.fillStyle = midc;
      ctx.fillRect(0, 0, w, h);
      ctx.translate(w / 2, h / 2);
      ctx.rotate(ang);
      var D = Math.hypot(w, h) / 2 + P * 2;
      var R = P * 1.7, rr = rng(19);
      for (var x = -D; x < D; x += P) {
        var gr = ctx.createLinearGradient(x, 0, x + P, 0);
        gr.addColorStop(0, mix(midc, dark, 0.85)); gr.addColorStop(0.08, mix(midc, dark, 0.3)); gr.addColorStop(0.34, light);
        gr.addColorStop(0.55, mix(midc, light, 0.35)); gr.addColorStop(0.8, midc); gr.addColorStop(0.95, mix(midc, dark, 0.7)); gr.addColorStop(1, dark);
        ctx.fillStyle = gr;
        ctx.fillRect(x, -D, P + 0.5, 2 * D);
        /* arc striations left by the rotating wheel */
        ctx.save();
        ctx.beginPath(); ctx.rect(x, -D, P, 2 * D); ctx.clip();
        var pl = new Path2D(), pd = new Path2D(), k = 0;
        for (var y = -D; y < D + R; y += 1.35) {
          var p = (k++ % 3 === 0) ? pd : pl;
          var cy = y + R, cx = x + P / 2;
          p.moveTo(cx - P * 0.62, cy - Math.sqrt(R * R - P * P * 0.3844));
          p.arc(cx, cy, R, -Math.PI / 2 - 0.38, -Math.PI / 2 + 0.38);
        }
        ctx.lineWidth = 0.45;
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.18 + rr() * 0.08).toFixed(3) + ')';
        ctx.stroke(pl);
        ctx.strokeStyle = 'rgba(40,44,50,' + (0.22 + rr() * 0.08).toFixed(3) + ')';
        ctx.stroke(pd);
        ctx.restore();
        /* seam between two côtes */
        ctx.fillStyle = 'rgba(20,22,26,.45)';
        ctx.fillRect(x - 0.35, -D, 0.7, 2 * D);
      }
      ctx.restore();
      /* broad light falloff across the bridge */
      var lf = ctx.createLinearGradient(0, 0, w, h);
      lf.addColorStop(0, 'rgba(255,255,255,.10)'); lf.addColorStop(0.5, 'rgba(0,0,0,0)'); lf.addColorStop(1, 'rgba(0,0,0,.28)');
      ctx.fillStyle = lf;
      ctx.fillRect(0, 0, w, h);
      grain(ctx, w, h, 0.25);
    }

    function perlage(ctx, w, h, o) {
      o = o || {};
      var R = o.r || 11, S = R * 1.3, dark = o.dark || '#5f666e', light = o.light || '#e9ecef';
      var rr = rng(o.seed || 3);
      ctx.fillStyle = dark;
      ctx.fillRect(0, 0, w, h);
      var row = 0;
      for (var y = -R; y < h + R; y += S * 0.86, row++) {
        for (var x = -R + (row % 2 ? S / 2 : 0); x < w + R; x += S) {
          var jx = x + (rr() - 0.5) * 1.2, jy = y + (rr() - 0.5) * 1.2;
          var a0 = rr() * TAU;
          ctx.fillStyle = conic(ctx, a0, jx, jy, [
            [0, light], [0.18, mix(dark, light, 0.35)], [0.3, dark], [0.5, mix(dark, light, 0.9)],
            [0.68, mix(dark, light, 0.3)], [0.8, dark], [1, light]
          ]);
          ctx.beginPath(); ctx.arc(jx, jy, R, 0, TAU); ctx.fill();
          /* circular grain */
          ctx.lineWidth = 0.35;
          for (var cr = R * 0.18; cr < R; cr += 0.9) {
            ctx.strokeStyle = (Math.round(cr * 7) % 2) ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.06)';
            ctx.beginPath(); ctx.arc(jx, jy, cr, 0, TAU); ctx.stroke();
          }
          ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 0.7;
          ctx.beginPath(); ctx.arc(jx, jy, R, 0, TAU); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 0.4;
          ctx.beginPath(); ctx.arc(jx, jy, R - 0.6, Math.PI * 0.9, Math.PI * 1.6); ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,.3)';
          ctx.beginPath(); ctx.arc(jx, jy, 0.6, 0, TAU); ctx.fill();
        }
      }
      grain(ctx, w, h, 0.2);
    }

    function anglage(ctx, w, h) {
      perlage(ctx, w, h, { r: 7, dark: '#3e444b', light: '#a9b0b7', seed: 11 });
      ctx.fillStyle = 'rgba(0,0,0,.28)';
      ctx.fillRect(0, 0, w, h);
      var bridge = new Path2D();
      var jx = w * 0.76, jy = h * 0.5, jr = h * 0.34;
      bridge.moveTo(-30, h * 0.16);
      bridge.lineTo(w * 0.26, h * 0.16);
      bridge.lineTo(w * 0.36, h * 0.40);           /* inward angle (angle rentrant) */
      bridge.lineTo(w * 0.46, h * 0.16);
      bridge.lineTo(jx, jy - jr);
      bridge.arc(jx, jy, jr, -Math.PI / 2, Math.PI / 2);
      bridge.lineTo(w * 0.50, h * 0.84);
      bridge.bezierCurveTo(w * 0.42, h * 0.84, w * 0.40, h * 0.66, w * 0.30, h * 0.66);
      bridge.lineTo(w * 0.22, h * 0.84);            /* second inward angle */
      bridge.lineTo(-30, h * 0.84);
      bridge.closePath();
      /* shadow of the bridge on the plate */
      ctx.save();
      ctx.translate(4, 6);
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.filter = 'blur(5px)';
      ctx.fill(bridge);
      ctx.restore();
      ctx.filter = 'none';
      ctx.save();
      ctx.clip(bridge);
      cotes(ctx, w, h, { period: 26, angle: -0.3 });
      /* chamfer: stroke clipped inside the bridge; conic paint = reflection varies with edge direction */
      var c = Math.max(6, Math.min(w, h) * 0.035);
      ctx.lineJoin = 'miter';
      ctx.miterLimit = 10;
      ctx.lineWidth = 2 * c + 1.6;
      ctx.strokeStyle = 'rgba(30,33,38,.8)';
      ctx.stroke(bridge);
      ctx.lineWidth = 2 * c;
      ctx.strokeStyle = conic(ctx, -0.8, w * 0.45, h * 0.5, [
        [0, '#ffffff'], [0.14, '#aeb5bc'], [0.26, '#f7f9fa'], [0.4, '#6c737a'], [0.52, '#e8ecef'],
        [0.66, '#ffffff'], [0.78, '#8d949b'], [0.9, '#f2f4f6'], [1, '#ffffff']
      ]);
      ctx.stroke(bridge);
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = 'rgba(255,255,255,.75)';
      ctx.stroke(bridge);
      /* countersunk jewel hole & screw */
      var sg = ctx.createRadialGradient(jx, jy, h * 0.05, jx, jy, h * 0.13);
      sg.addColorStop(0, '#30353b'); sg.addColorStop(0.3, '#fbfcfd'); sg.addColorStop(0.65, '#9aa3ad'); sg.addColorStop(1, '#4a5058');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(jx, jy, h * 0.13, 0, TAU); ctx.fill();
      cJewel(ctx, jx, jy, h * 0.05);
      cScrew(ctx, w * 0.12, h * 0.5, h * 0.07, C.blue, 28);
      ctx.restore();
      ctx.strokeStyle = 'rgba(0,0,0,.7)';
      ctx.lineWidth = 1.2;
      ctx.stroke(bridge);
      vignette(ctx, w, h, 0.35);
    }

    var TEMPER = [
      { t: 220, c: '#d8b565', n: 'paille' },
      { t: 250, c: '#a86a2e', n: 'bronze' },
      { t: 270, c: '#7b2f6e', n: 'pourpre' },
      { t: 290, c: '#2d4fb3', n: 'bleu roi' },
      { t: 320, c: '#7d9cc4', n: 'bleu pâle' }
    ];
    function vis(ctx, w, h) {
      /* brass bluing plate with colimaçonnage */
      var bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#7a5a24'); bg.addColorStop(0.4, '#b08d57'); bg.addColorStop(0.7, '#8a6a2f'); bg.addColorStop(1, '#5a4219');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      var cx = w * 0.5, cy = h * 1.6, maxR = Math.hypot(w, h * 1.6) + 10;
      ctx.lineWidth = 0.6;
      for (var r = h * 0.5; r < maxR; r += 1.4) {
        ctx.strokeStyle = (Math.round(r / 1.4) % 2) ? 'rgba(255,230,170,.08)' : 'rgba(40,25,5,.12)';
        ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
      }
      /* heat glow from the flame (left = hottest? no: right hotter) */
      var hg = ctx.createLinearGradient(0, 0, w, 0);
      hg.addColorStop(0, 'rgba(0,0,0,.25)'); hg.addColorStop(1, 'rgba(255,120,40,.12)');
      ctx.fillStyle = hg;
      ctx.fillRect(0, 0, w, h);
      grain(ctx, w, h, 0.25);
      var n = TEMPER.length, gap = w / (n + 0.2), r0 = Math.min(gap * 0.3, h * 0.13);
      var y = h * 0.42;
      ctx.textAlign = 'center';
      TEMPER.forEach(function (tp, i) {
        var x = gap * (i + 0.6);
        /* hole in the plate */
        ctx.fillStyle = 'rgba(20,12,2,.6)';
        ctx.beginPath(); ctx.arc(x + 1.5, y + 2.5, r0 * 1.2, 0, TAU); ctx.fill();
        cScrew(ctx, x, y, r0, tp.c, 20 + i * 31, true);
        if (tp.t === 290) {
          ctx.strokeStyle = C.goldLight; ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          ctx.beginPath(); ctx.arc(x, y, r0 * 1.85, 0, TAU); ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.fillStyle = tp.t === 290 ? '#fff4d6' : 'rgba(255,245,220,.82)';
        ctx.font = '500 ' + Math.max(9, Math.round(r0 * 0.62)) + 'px ' + C.mono;
        ctx.fillText(tp.t + ' °C', x, y + r0 * 2.3);
        ctx.fillStyle = 'rgba(255,245,220,.6)';
        ctx.font = 'italic ' + Math.max(10, Math.round(r0 * 0.72)) + 'px ' + C.display;
        ctx.fillText(tp.n, x, y + r0 * 2.3 + Math.max(11, r0 * 0.8));
      });
      /* temper colour bar */
      var by = h * 0.76, bh = Math.max(6, h * 0.03), bx0 = gap * 0.35, bx1 = w - gap * 0.35;
      var tg = ctx.createLinearGradient(bx0, 0, bx1, 0);
      tg.addColorStop(0, '#e9d6a0');
      TEMPER.forEach(function (tp, i) { tg.addColorStop((i + 0.6) * gap / w, tp.c); });
      tg.addColorStop(1, '#a9bcd6');
      ctx.fillStyle = 'rgba(0,0,0,.4)';
      ctx.fillRect(bx0 - 1, by - 1, bx1 - bx0 + 2, bh + 2);
      ctx.fillStyle = tg;
      ctx.fillRect(bx0, by, bx1 - bx0, bh);
      vignette(ctx, w, h, 0.3);
    }

    function poli(ctx, w, h) {
      /* frosted (grené) surround */
      ctx.fillStyle = '#7d848c';
      ctx.fillRect(0, 0, w, h);
      grain(ctx, w, h, 1);
      grain(ctx, w, h, 0.8);
      var rr = rng(5);
      for (var i = 0; i < w * h / 18; i++) {
        ctx.fillStyle = rr() < 0.5 ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.18)';
        ctx.fillRect(rr() * w, rr() * h, 0.8, 0.8);
      }
      var sh = ctx.createLinearGradient(0, 0, w, h);
      sh.addColorStop(0, 'rgba(255,255,255,.12)'); sh.addColorStop(1, 'rgba(0,0,0,.35)');
      ctx.fillStyle = sh;
      ctx.fillRect(0, 0, w, h);
      /* black-polished steel part (click spring / cliquet silhouette) */
      var p = new Path2D();
      p.moveTo(w * 0.08, h * 0.30);
      p.bezierCurveTo(w * 0.30, h * 0.14, w * 0.62, h * 0.12, w * 0.86, h * 0.24);
      p.lineTo(w * 0.93, h * 0.42);
      p.lineTo(w * 0.80, h * 0.46);                     /* sharp inward angle */
      p.bezierCurveTo(w * 0.66, h * 0.50, w * 0.62, h * 0.74, w * 0.70, h * 0.86);
      p.lineTo(w * 0.34, h * 0.86);
      p.bezierCurveTo(w * 0.36, h * 0.66, w * 0.24, h * 0.52, w * 0.08, h * 0.52);
      p.closePath();
      ctx.save();
      ctx.translate(3, 5); ctx.filter = 'blur(4px)';
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fill(p);
      ctx.restore();
      ctx.filter = 'none';
      ctx.save();
      ctx.clip(p);
      var g = ctx.createLinearGradient(w * 0.1, h * 0.1, w * 0.9, h * 0.9);
      g.addColorStop(0, '#07080a'); g.addColorStop(0.38, '#111316'); g.addColorStop(0.455, '#2a2f35');
      g.addColorStop(0.47, '#f4f7fa'); g.addColorStop(0.49, '#dfe4e9'); g.addColorStop(0.505, '#2a2f35');
      g.addColorStop(0.6, '#0b0c0e'); g.addColorStop(1, '#030304');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      /* anglage on the edge */
      ctx.lineJoin = 'miter';
      ctx.lineWidth = 7;
      ctx.strokeStyle = conic(ctx, 0.4, w * 0.5, h * 0.5, [[0, '#ffffff'], [0.25, '#6c737a'], [0.5, '#f2f4f6'], [0.75, '#4a5058'], [1, '#ffffff']]);
      ctx.stroke(p);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255,255,255,.8)';
      ctx.stroke(p);
      ctx.restore();
      cScrew(ctx, w * 0.5, h * 0.3, Math.min(w, h) * 0.05, C.blue, -30);
      vignette(ctx, w, h, 0.3);
    }

    function soleil(ctx, w, h) {
      var cx = w * 0.5, cy = h * 0.54, R = Math.hypot(w, h);
      ctx.fillStyle = '#16181b';
      ctx.fillRect(0, 0, w, h);
      var rr = rng(9), N = 2600, light = -0.5;
      ctx.lineWidth = 0.7;
      for (var i = 0; i < N; i++) {
        var a = i / N * TAU;
        var b = Math.pow(0.5 + 0.5 * Math.cos(2 * (a - light)), 3.5);
        var v = U.clamp(0.1 + b * 0.62 + (rr() - 0.5) * 0.12, 0, 1);
        ctx.strokeStyle = mix('#16181b', '#aeb4bb', v);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 3, cy + Math.sin(a) * 3);
        ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        ctx.stroke();
      }
      grain(ctx, w, h, 0.18);
      /* applied gold indices + minute track */
      var Rd = Math.min(w, h) * 0.46;
      ctx.strokeStyle = 'rgba(230,207,151,.55)';
      ctx.lineWidth = 0.6;
      for (var m = 0; m < 60; m++) {
        var ma = m * 6 * RAD - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ma) * (Rd + 4), cy + Math.sin(ma) * (Rd + 4));
        ctx.lineTo(cx + Math.cos(ma) * (Rd + (m % 5 ? 8 : 11)), cy + Math.sin(ma) * (Rd + (m % 5 ? 8 : 11)));
        ctx.stroke();
      }
      for (var k = 0; k < 12; k++) {
        var ka = k * 30 * RAD - Math.PI / 2;
        ctx.save();
        ctx.translate(cx + Math.cos(ka) * (Rd - 6), cy + Math.sin(ka) * (Rd - 6));
        ctx.rotate(ka + Math.PI / 2);
        var iw = k % 3 === 0 ? 5 : 3.2, ih = k % 3 === 0 ? 16 : 12;
        ctx.fillStyle = 'rgba(0,0,0,.5)';
        ctx.fillRect(-iw / 2 + 1, -ih / 2 + 1.5, iw, ih);
        var ig = ctx.createLinearGradient(-iw / 2, 0, iw / 2, 0);
        ig.addColorStop(0, '#f6e4b0'); ig.addColorStop(0.5, '#8a6a2f'); ig.addColorStop(1, '#e6cf97');
        ctx.fillStyle = ig;
        ctx.fillRect(-iw / 2, -ih / 2, iw, ih);
        ctx.restore();
      }
      /* brand */
      ctx.fillStyle = C.goldLight;
      ctx.textAlign = 'center';
      ctx.font = '500 ' + Math.round(Rd * 0.13) + 'px ' + C.display;
      if ('letterSpacing' in ctx) ctx.letterSpacing = Math.round(Rd * 0.05) + 'px';
      ctx.fillText('BULROG', cx, cy - Rd * 0.4);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      /* dauphine hands at 10:09 */
      function hand(angDeg, len, wd) {
        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(angDeg * RAD);
        ctx.fillStyle = 'rgba(0,0,0,.45)';
        ctx.beginPath(); ctx.moveTo(2, -len + 3); ctx.lineTo(wd + 2, 3); ctx.lineTo(2, 12); ctx.lineTo(-wd + 2, 3); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f1dca4';
        ctx.beginPath(); ctx.moveTo(0, -len); ctx.lineTo(wd, 0); ctx.lineTo(0, 9); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#8a6a2f';
        ctx.beginPath(); ctx.moveTo(0, -len); ctx.lineTo(-wd, 0); ctx.lineTo(0, 9); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      hand(-55, Rd * 0.6, 4.2);
      hand(55, Rd * 0.88, 3.4);
      var cg = ctx.createRadialGradient(cx - 1, cy - 1, 0.5, cx, cy, 5);
      cg.addColorStop(0, '#f6e4b0'); cg.addColorStop(1, '#8a6a2f');
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.arc(cx, cy, 4.5, 0, TAU); ctx.fill();
      vignette(ctx, w, h, 0.35);
    }

    function cotesSample(ctx, w, h) {
      cotes(ctx, w, h, { period: 36, angle: -0.5 });
      /* a jewel and a blued screw, as on a real bridge */
      var s = Math.min(w, h);
      cScrew(ctx, w * 0.18, h * 0.76, s * 0.055, C.blue, 40);
      var sg = ctx.createRadialGradient(w * 0.8, h * 0.28, s * 0.03, w * 0.8, h * 0.28, s * 0.1);
      sg.addColorStop(0, '#30353b'); sg.addColorStop(0.35, '#fbfcfd'); sg.addColorStop(0.7, '#9aa3ad'); sg.addColorStop(1, '#4a5058');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(w * 0.8, h * 0.28, s * 0.1, 0, TAU); ctx.fill();
      cJewel(ctx, w * 0.8, h * 0.28, s * 0.038);
      vignette(ctx, w, h, 0.4);
    }
    function perlageSample(ctx, w, h) {
      perlage(ctx, w, h, { r: 16, dark: '#666d75', light: '#eef1f3' });
      vignette(ctx, w, h, 0.4);
    }

    var DRAW = { cotes: cotesSample, perlage: perlageSample, anglage: anglage, vis: vis, poli: poli, soleil: soleil };

    /* ---- per-sample controller ---------------------------------------- */
    samples.forEach(function (el) {
      var kind = el.getAttribute('data-prec-tex');
      var draw = DRAW[kind];
      var cv = el.querySelector('.prec-fin-canvas');
      if (!draw || !cv) return;
      var ctx = cv.getContext('2d');
      var loupe = document.createElement('div');
      loupe.className = 'prec-loupe';
      loupe.setAttribute('aria-hidden', 'true');
      var lc = document.createElement('canvas');
      var mag = document.createElement('span');
      mag.className = 'prec-loupe-mag';
      mag.textContent = '×' + ZOOM;
      loupe.appendChild(lc);
      loupe.appendChild(mag);
      el.appendChild(loupe);
      var lctx = lc.getContext('2d');
      var w = 0, h = 0, hi = null, hiQ = 1, pos = { x: 0, y: 0 }, open = false;

      function render() {
        var r = cv.getBoundingClientRect();
        if (!r.width) return;
        w = r.width; h = r.height;
        var d = DPR();
        cv.width = Math.round(w * d); cv.height = Math.round(h * d);
        ctx.setTransform(d, 0, 0, d, 0, 0);
        draw(ctx, w, h);
        hi = null;
      }
      function hiRes() {
        if (hi) return hi;
        var d = DPR();
        hiQ = Math.min(ZOOM * d, Math.sqrt(4.5e6 / Math.max(1, w * h)));
        hi = document.createElement('canvas');
        hi.width = Math.round(w * hiQ); hi.height = Math.round(h * hiQ);
        var hc = hi.getContext('2d');
        hc.setTransform(hiQ, 0, 0, hiQ, 0, 0);
        draw(hc, w, h);
        return hi;
      }
      function paintLoupe() {
        var L = loupe.offsetWidth || 170, d = DPR(), px = Math.round(L * d);
        if (lc.width !== px) { lc.width = px; lc.height = px; }
        var src = hiRes();
        lctx.fillStyle = '#0a0908';
        lctx.fillRect(0, 0, px, px);
        var sw = (L / ZOOM) * hiQ;
        var sx = pos.x * hiQ - sw / 2, sy = pos.y * hiQ - sw / 2;
        /* clamp the source rect manually (portable drawImage) */
        var cx0 = Math.max(0, sx), cy0 = Math.max(0, sy);
        var cx1 = Math.min(src.width, sx + sw), cy1 = Math.min(src.height, sy + sw);
        if (cx1 > cx0 && cy1 > cy0) {
          var k = px / sw;
          lctx.drawImage(src, cx0, cy0, cx1 - cx0, cy1 - cy0, (cx0 - sx) * k, (cy0 - sy) * k, (cx1 - cx0) * k, (cy1 - cy0) * k);
        }
      }
      function show(x, y) {
        pos.x = U.clamp(x, 0, w); pos.y = U.clamp(y, 0, h);
        loupe.style.setProperty('--prec-x', pos.x + 'px');
        loupe.style.setProperty('--prec-y', pos.y + 'px');
        paintLoupe();
        if (!open) { open = true; el.classList.add('is-zoom'); }
      }
      function hide() { open = false; el.classList.remove('is-zoom'); }
      function local(e) { var r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

      /* mouse & pen: loupe follows the pointer */
      el.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        var p = local(e); show(p.x, p.y);
      });
      el.addEventListener('pointerenter', function (e) {
        if (e.pointerType === 'touch') return;
        var p = local(e); show(p.x, p.y);
      });
      el.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch' && document.activeElement !== el) hide(); });
      /* touch: tap = static zoom at that point; tap again elsewhere to move it, tap outside to close */
      var down = null;
      el.addEventListener('pointerdown', function (e) { if (e.pointerType === 'touch') down = { x: e.clientX, y: e.clientY }; });
      el.addEventListener('pointerup', function (e) {
        if (e.pointerType !== 'touch' || !down) return;
        var moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10;
        down = null;
        if (moved) return;
        var p = local(e);
        if (open && Math.hypot(p.x - pos.x, p.y - pos.y) < 24) hide(); else show(p.x, p.y);
      });
      el.addEventListener('pointercancel', function () { down = null; });
      document.addEventListener('pointerdown', function (e) { if (open && !el.contains(e.target)) hide(); }, { passive: true });
      /* keyboard: focus centres the loupe, arrows move it, Escape closes */
      el.addEventListener('focus', function () { if (!open) show(w / 2, h / 2); });
      el.addEventListener('blur', hide);
      el.addEventListener('keydown', function (e) {
        var step = e.shiftKey ? 40 : 12, dx = 0, dy = 0;
        if (e.key === 'ArrowLeft') dx = -step; else if (e.key === 'ArrowRight') dx = step;
        else if (e.key === 'ArrowUp') dy = -step; else if (e.key === 'ArrowDown') dy = step;
        else if (e.key === 'Escape') { hide(); return; }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (open) hide(); else show(w / 2, h / 2); return; }
        else return;
        e.preventDefault();
        show((open ? pos.x : w / 2) + dx, (open ? pos.y : h / 2) + dy);
      });

      render();
      var lastW = w;
      if ('ResizeObserver' in window) {
        var tm = 0;
        new ResizeObserver(function () {
          clearTimeout(tm);
          tm = setTimeout(function () {
            var r = cv.getBoundingClientRect();
            if (Math.abs(r.width - lastW) < 0.5 && cv.width) return;
            lastW = r.width; render();
            if (open) paintLoupe();
          }, 120);
        }).observe(cv);
      }
      if (document.fonts && document.fonts.ready && (kind === 'vis' || kind === 'soleil')) {
        document.fonts.ready.then(function () { render(); });
      }
    });
  })();

  window.BulrogPrecision = { version: '1.0.0' };
})();
