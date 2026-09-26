/*!
 * BULROG — coeur.js  (owner: builder B · section #coeur · prefix coeur-)
 * « Au cœur du mouvement » :
 *   1. Modèle cinématique d'un échappement à ancre suisse (roue 15 dents club,
 *      ancre à deux levées rubis) : les contacts sont RÉSOLUS géométriquement
 *      (aucune pièce ne traverse l'autre) — dégagement, impulsion, chute, repos.
 *      Le balancier suit BulrogGears.CALIBRE (4 Hz, 285°, levée 52°), la roue
 *      avance de 12° par alternance comme BulrogGears.escapement().
 *   2. Vue éclatée 3D (CSS 3D) du Calibre BR-01 en 7 plans, pilotée au scroll
 *      (sticky) sur grand écran, en pas-à-pas au toucher sur mobile ; lignes de
 *      rappel, points d'intérêt, panneau de détail accessible.
 *   3. Loupe d'échappement ×40 : lecture/pause, vitesses, étape par étape.
 * Toutes les animations passent par BulrogGears.ticker (onglet caché, hors écran,
 * prefers-reduced-motion gérés).
 */
(function () {
  'use strict';

  var root = document.getElementById('coeur');
  var G = window.BulrogGears;
  if (!root || !G) return;

  var E = G.el;
  var TAU = Math.PI * 2, RAD = Math.PI / 180, DEG = 180 / Math.PI;
  var clamp = G.util.clamp, lerp = G.util.lerp;
  var CAL = G.CALIBRE;
  var AMP = CAL.amplitudeDeg, OMEGA = TAU * CAL.freqHz, HALF = 1 / (2 * CAL.freqHz), LIFT_HALF = CAL.liftDeg / 2;

  G.ensureDefs();

  function $(sel, ctx) { return (ctx || root).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || root).querySelectorAll(sel)); }
  function r2(n) { return Math.round(n * 100) / 100; }
  function pol(r, a, cx, cy) { return { x: (cx || 0) + r * Math.cos(a), y: (cy || 0) + r * Math.sin(a) }; }
  function fmt(n, dec) { return n.toFixed(dec).replace('-', '−').replace('.', ','); }
  function ptsD(pts, close) {
    return pts.map(function (q, i) { return (i ? 'L' : 'M') + r2(q.x) + ' ' + r2(q.y); }).join('') + (close ? 'Z' : '');
  }

  /* ======================================================================
   * 0. Section-local paint servers (ids prefixed coeur-)
   * ==================================================================== */
  (function defs() {
    var svg = E('svg', { class: 'coeur-defs', width: '0', height: '0', 'aria-hidden': 'true', focusable: 'false' });
    var d = E('defs');
    function lin(id, stops, x2, y2) {
      var g = E('linearGradient', { id: id, x1: '0', y1: '0', x2: x2 || '1', y2: y2 || '1' });
      stops.forEach(function (s) { g.appendChild(E('stop', { offset: s[0], 'stop-color': s[1], 'stop-opacity': s[2] != null ? s[2] : null })); });
      d.appendChild(g);
    }
    function rad(id, stops, cx, cy, r) {
      var g = E('radialGradient', { id: id, cx: cx || '0.5', cy: cy || '0.5', r: r || '0.5' });
      stops.forEach(function (s) { g.appendChild(E('stop', { offset: s[0], 'stop-color': s[1], 'stop-opacity': s[2] != null ? s[2] : null })); });
      d.appendChild(g);
    }
    lin('coeur-rose', [['0', '#f6d3bd'], ['0.3', '#dea283'], ['0.58', '#a4644a'], ['0.82', '#ebb99b'], ['1', '#86492f']]);
    lin('coeur-steel-dk', [['0', '#c9d0d7'], ['0.45', '#6f7882'], ['1', '#2e343b']]);
    lin('coeur-bridge', [['0', '#e9edf1'], ['0.45', '#b9c1c9'], ['1', '#7d8791']]);
    rad('coeur-drum', [['0', '#e7cf98'], ['0.7', '#b08d57'], ['1', '#6b5128']], '0.42', '0.38', '0.7');
    rad('coeur-plate', [['0', '#30343a'], ['0.6', '#1d2024'], ['1', '#0f1113']], '0.42', '0.45', '0.75');
    rad('coeur-vignette', [['0.55', '#000', 0], ['1', '#000', 0.78]], '0.5', '0.5', '0.62');
    rad('coeur-perle', [['0', '#fff', 0.13], ['0.55', '#fff', 0.03], ['0.82', '#000', 0.10], ['1', '#000', 0.24]], '0.45', '0.45', '0.55');
    rad('coeur-lensglow', [['0', '#e6cf97', 0.95], ['0.4', '#e6cf97', 0.45], ['1', '#e6cf97', 0]]);
    rad('coeur-rubyglow', [['0', '#ff8a9c', 0.9], ['0.45', '#e0405a', 0.35], ['1', '#e0405a', 0]]);
    var perl = E('pattern', { id: 'coeur-perlage-lg', patternUnits: 'userSpaceOnUse', width: '34', height: '34' });
    [[0, 0], [34, 0], [0, 34], [34, 34], [17, 17]].forEach(function (c) {
      perl.appendChild(E('circle', { cx: c[0], cy: c[1], r: '19', fill: 'url(#coeur-perle)' }));
    });
    d.appendChild(perl);
    svg.appendChild(d);
    root.insertBefore(svg, root.firstChild);
  })();

  /* ======================================================================
   * 1. SWISS LEVER ESCAPEMENT MODEL  (vertical frame, escape centre (0,0),
   *    pallet pivot above at (0,-d), balance above the pallet; R = 100)
   * ==================================================================== */
  var M = (function buildEscapement() {
    var R = 100, N = 15, P = TAU / N;
    var club = 0.05 * R;            // club height (tooth impulse plane rise)
    var gam = 0.22 * P;             // angular length of the club
    var rRoot = 0.72 * R;
    var d = R / Math.cos(30 * RAD); // tangential locking, embrace 60° = 2.5 teeth
    var lever = 0.95 * R, roller = 0.26 * R;
    var PV = { x: 0, y: -d };
    var S = Math.asin(roller * Math.sin(LIFT_HALF * RAD) / lever);   // pallet half swing (rad)
    var lockA = 2.5 * RAD, impS = 4.5 * RAD, draw = 12 * RAD, len = 0.3 * R;
    var clubA = club / (R * Math.tan(30 * RAD));

    function rot(q, a) {
      var c = Math.cos(a), s = Math.sin(a), x = q.x - PV.x, y = q.y - PV.y;
      return { x: PV.x + x * c - y * s, y: PV.y + x * s + y * c };
    }
    function rotV(v, a) { var c = Math.cos(a), s = Math.sin(a); return { x: v.x * c - v.y * s, y: v.x * s + v.y * c }; }

    // --- pallet stones (designed at their banked/locked position, stored pallet-local) ---
    var stones = [[-1, -120, 0.105], [1, -60, 0.09]].map(function (def) {
      var side = def[0], a0 = def[1] * RAD, w = def[2] * R;
      var sigma = side < 0 ? 1 : -1, pref = side < 0 ? -S : S;
      var rh = pol(1, a0), th = { x: -Math.sin(a0), y: Math.cos(a0) };
      var f = { x: Math.cos(draw) * rh.x + Math.sin(draw) * th.x, y: Math.cos(draw) * rh.y + Math.sin(draw) * th.y };
      var nn = { x: -Math.sin(draw) * rh.x + Math.cos(draw) * th.x, y: -Math.sin(draw) * rh.y + Math.cos(draw) * th.y };
      var lo = 0.7 * R, hi = R, k, m, c;
      for (k = 0; k < 50; k++) {
        m = (lo + hi) / 2; c = rot({ x: m * rh.x, y: m * rh.y }, sigma * lockA);
        if (Math.hypot(c.x, c.y) < R - club) lo = m; else hi = m;
      }
      var rl = (lo + hi) / 2, Cl = { x: rl * rh.x, y: rl * rh.y };
      var lo2 = -0.3 * R, hi2 = 0.3 * R;
      for (k = 0; k < 60; k++) {
        m = (lo2 + hi2) / 2; c = { x: Cl.x + w * nn.x - m * f.x, y: Cl.y + w * nn.y - m * f.y };
        var cr = rot(c, sigma * (lockA + clubA + impS));
        if (Math.hypot(cr.x, cr.y) < R) hi2 = m; else lo2 = m;
      }
      var h = (lo2 + hi2) / 2, Ci = { x: Cl.x + w * nn.x - h * f.x, y: Cl.y + w * nn.y - h * f.y };
      var pts = [{ x: Cl.x + len * f.x, y: Cl.y + len * f.y }, Cl, Ci, { x: Ci.x + (len + h) * f.x, y: Ci.y + (len + h) * f.y }];
      return {
        side: side, name: side < 0 ? 'entree' : 'sortie',
        local: pts.map(function (q) { return rot(q, -pref); }),
        f: rotV(f, -pref), n: rotV(nn, -pref)
      };
    });

    // --- escape tooth (collision polygon, wheel frame, locking corner at angle a) ---
    function tooth(a) {
      return [pol(rRoot, a - P * 0.16), pol(0.88 * R, a - P * 0.03), pol(R - club, a), pol(R, a - gam), pol(0.97 * R, a - gam - P * 0.05)];
    }
    function stonesAt(p) { return stones.map(function (s) { return s.local.map(function (q) { return rot(q, p); }); }); }
    function circSeg(r, A, B, out) {
      var dx = B.x - A.x, dy = B.y - A.y;
      var a = dx * dx + dy * dy, b = 2 * (A.x * dx + A.y * dy), c = A.x * A.x + A.y * A.y - r * r;
      var D = b * b - 4 * a * c;
      if (D < 0) return 0;
      var sq = Math.sqrt(D), n = 0, us = [(-b - sq) / (2 * a), (-b + sq) / (2 * a)];
      for (var i = 0; i < 2; i++) { var u = us[i]; if (u >= 0 && u <= 1) out[n++] = Math.atan2(A.y + u * dy, A.x + u * dx); }
      return n;
    }
    function norm(a) { return ((a % TAU) + TAU) % TAU; }
    var tmp = [0, 0];
    /* First obstruction met by the wheel turning clockwise from e0 (rad), pallet at p (rad). */
    function block(p, e0, maxD) {
      var SW = stonesAt(p), best = { d: maxD };
      for (var i = 0; i < N; i++) {
        var ta = e0 + i * P;
        if (Math.sin(ta) > 0.2) continue;
        var tp = tooth(ta);
        for (var si = 0; si < 2; si++) {
          var poly = SW[si], k, j, n, dd;
          for (var vi = 0; vi < 4; vi++) {            // tooth corners vs stone locking/impulse faces
            var V = tp[vi], r = Math.hypot(V.x, V.y), ang = Math.atan2(V.y, V.x);
            for (k = 0; k < 2; k++) {
              n = circSeg(r, poly[k], poly[k + 1], tmp);
              for (j = 0; j < n; j++) { dd = norm(tmp[j] - ang); if (dd < best.d) best = { d: dd, tooth: i, stone: si, edge: k, kind: 'tv', v: vi }; }
            }
          }
          for (var wi = 0; wi < 3; wi++) {            // stone corners vs tooth front face & club
            var W = poly[wi], rw = Math.hypot(W.x, W.y), aw = Math.atan2(W.y, W.x);
            for (k = 0; k < 3; k++) {
              n = circSeg(rw, tp[k], tp[k + 1], tmp);
              for (j = 0; j < n; j++) { dd = norm(aw - tmp[j]); if (dd < best.d) best = { d: dd, tooth: i, stone: si, edge: k, kind: 'sv', v: wi }; }
            }
          }
        }
      }
      return best;
    }
    function sweep(eStart, pFrom, pTo) {
      var n = 720, es = new Float64Array(n + 1), cs = new Array(n + 1), e = eStart;
      for (var k = 0; k <= n; k++) {
        var p = pFrom + (pTo - pFrom) * k / n;
        var b = block(p, e - 0.8 * RAD, 0.35);
        if (b.tooth == null) b = { d: 0.8 * RAD, stone: -1, kind: 'none', v: 0, tooth: 0, edge: 0 };
        e = e - 0.8 * RAD + b.d;
        es[k] = (e - eStart) * DEG;
        cs[k] = { stone: b.stone, lock: (b.kind === 'tv' && b.edge === 0) || (b.kind === 'sv' && b.edge <= 1), kind: b.kind, v: b.v, tooth: b.tooth };
      }
      return { p0: pFrom * DEG, p1: pTo * DEG, n: n, e: es, c: cs, end: e };
    }
    var b0 = block(-S, -124 * RAD, 0.3);
    var eEntry = -124 * RAD + b0.d;
    var swEntry = sweep(eEntry, -S, S);          // entry pallet unlocks (odd crossings)
    var swExit = sweep(swEntry.end, S, -S);      // exit pallet unlocks (even crossings)
    var BEAT = (swEntry.end - eEntry) * DEG;     // = 12° (half a tooth pitch)

    var model = {
      R: R, N: N, P: P, club: club, gam: gam, rRoot: rRoot, d: d, lever: lever, roller: roller,
      PV: PV, S: S, stones: stones, tooth: tooth, rot: rot, e0: eEntry * DEG, beat: BEAT,
      B: { x: 0, y: -d - lever - roller }, pinR: 0.042 * R
    };

    function thetaAt(t) { return AMP * Math.sin(OMEGA * t); }
    function palletOf(th) { return -Math.asin(roller * Math.sin(clamp(th, -LIFT_HALF, LIFT_HALF) * RAD) / lever) * DEG; }
    function target(t) {
      var n = Math.round(t / HALF), th = thetaAt(t), p = palletOf(th);
      var even = ((n % 2) + 2) % 2 === 0;
      var sw = even ? swExit : swEntry;
      var f = clamp((p - sw.p0) / (sw.p1 - sw.p0) * sw.n, 0, sw.n);
      var i = Math.min(sw.n - 1, Math.floor(f)), fr = f - i;
      var e = sw.e[i] + (sw.e[i + 1] - sw.e[i]) * fr;
      // whole pitches travelled since the sweep's reference position (tooth indices shift by one per pitch)
      var shift = Math.round(((n - 1) - (even ? 1 : 0)) / 2);
      return { n: n, th: th, p: p, even: even, e: model.e0 + (n - 1) * BEAT + e, c: sw.c[Math.round(f)], shift: shift };
    }
    // wheel inertia: after release the wheel cannot outrun VEL (deg/s) — gives a visible, physical « chute »
    var VEL = 0, maxJump = 0;
    (function calib() {
      var dt = 5e-6, prev = target(0).e;
      for (var t = dt; t < 2 * HALF; t += dt) {
        var e = target(t).e, de = e - prev; prev = e;
        if (de > 0.25) maxJump = Math.max(maxJump, de); else VEL = Math.max(VEL, de / dt);
      }
      VEL *= 1.3;
    })();
    var TAU_D = (maxJump / VEL) * 1.1, K = 8;

    var LABELS = {
      repos: 'Repos', verrou: 'Repos · verrouillage', degagement: 'Dégagement', impulsion: 'Impulsion', chute: 'Chute'
    };
    function state(t) {
      var T = target(t), disp = T.e;
      for (var j = 1; j <= K; j++) {
        var s = t - (j * TAU_D) / K, v = target(s).e + VEL * (t - s);
        if (v < disp) disp = v;
      }
      var phase, key;
      if (T.e - disp > 0.02) phase = 'chute';
      else if (Math.abs(T.th) >= LIFT_HALF) phase = 'repos';
      else if (T.c && T.c.stone === (T.even ? 1 : 0)) phase = T.c.lock ? 'degagement' : 'impulsion';
      else phase = 'repos';
      key = phase === 'repos' && Math.abs(T.th) < LIFT_HALF * 1.6 ? 'verrou' : phase;
      return {
        t: t, balanceDeg: T.th, palletDeg: T.p, escapeDeg: disp, targetDeg: T.e, contact: T.c,
        toothDeg: T.c ? disp + (((T.c.tooth - T.shift) % N) + N) % N * (360 / N) : disp,
        beats: T.n, phase: phase, sub: key, phaseLabel: LABELS[key], unlocking: T.even ? 1 : 0
      };
    }
    function phaseOnly(t) { return state(t).phase; }
    /* Time (s) of the next didactic stop after t: middle of the next phase, or the balance extreme for the rest. */
    function nextStop(t0) {
      var dt = 2e-5, t = t0 + dt, ph0 = phaseOnly(t0), lim = t0 + 0.4;
      while (phaseOnly(t) === ph0 && t < lim) t += dt;
      var ph1 = phaseOnly(t), tStart = t;
      if (ph1 === 'repos') {
        // the rest phase is shown at the next balance extreme (free « arc supplémentaire »)
        return Math.ceil(tStart / HALF - 0.5 + 1e-9) * HALF + HALF / 2;
      }
      while (phaseOnly(t) === ph1 && t < lim) t += dt;
      return (tStart + t) / 2;
    }
    model.state = state;
    model.nextStop = nextStop;
    model.contactPoint = function (st) {
      var c = st.contact;
      if (!c || c.stone < 0) return null;
      if (c.kind === 'tv') return model.tooth(st.toothDeg * RAD)[c.v];
      var q = stones[c.stone].local[c.v];
      return rot(q, st.palletDeg * RAD);
    };
    return model;
  })();

  /* ---------------------------------------------------------------------- *
   * Shared drawing (vertical frame, model units)
   * ---------------------------------------------------------------------- */
  function escapeWheelD() {
    var R = M.R, P = M.P, out = '';
    function p2(r, a) { var q = pol(r, a); return r2(q.x) + ' ' + r2(q.y); }
    for (var i = 0; i < M.N; i++) {
      var a = i * P;
      if (i === 0) out += 'M' + p2(M.rRoot, a - 0.55 * P);
      out += 'C' + p2(0.8 * R, a - 0.36 * P) + ' ' + p2(0.9 * R, a - 0.26 * P) + ' ' + p2(0.97 * R, a - M.gam - 0.05 * P);
      out += 'L' + p2(R, a - M.gam) + 'L' + p2(R - M.club, a) + 'L' + p2(0.88 * R, a - 0.03 * P) + 'L' + p2(M.rRoot, a - 0.16 * P);
      out += 'A' + M.rRoot + ' ' + M.rRoot + ' 0 0 1 ' + p2(M.rRoot, a + 0.45 * P);
    }
    out += 'Z';
    out += G.windowsPath({ rim: M.rRoot - 0.075 * R, hub: 0.2 * R, spokes: 5, width: 0.055 * R, curve: 0.5, phase: 0.2 });
    out += G.circlePath(0.035 * R);
    return out;
  }
  function toothD() {
    var R = M.R, P = M.P, a = 0;
    var pts = [pol(M.rRoot + 2, a - 0.5 * P), pol(0.97 * R, a - M.gam - 0.05 * P), pol(R, a - M.gam), pol(R - M.club, a), pol(0.88 * R, a - 0.03 * P), pol(M.rRoot + 2, a - 0.16 * P)];
    return ptsD(pts, true);
  }
  /* Pallet fork: returns { body:[elements], top:[elements], stones:[els] } in pallet-local (world at p=0) */
  function buildPallet(opt) {
    opt = opt || {};
    var R = M.R, PV = M.PV, F = { x: 0, y: -M.d - M.lever };
    var g = E('g', { class: 'coeur-pallet' });
    // arms: pivot → each stone (curved, polished), stones set in their slots
    M.stones.forEach(function (st) {
      var L = st.local;
      var gc = { x: lerp((L[0].x + L[3].x) / 2, (L[1].x + L[2].x) / 2, 0.28), y: lerp((L[0].y + L[3].y) / 2, (L[1].y + L[2].y) / 2, 0.28) };
      var mid = { x: (gc.x + PV.x) / 2, y: (gc.y + PV.y) / 2 };
      var ctrl = { x: mid.x * 0.9, y: mid.y - 0.1 * R };
      var d = 'M' + r2(PV.x) + ' ' + r2(PV.y) + 'Q' + r2(ctrl.x) + ' ' + r2(ctrl.y) + ' ' + r2(gc.x) + ' ' + r2(gc.y);
      g.appendChild(E('path', { d: d, fill: 'none', stroke: '#2a2f35', 'stroke-width': 0.15 * R, 'stroke-linecap': 'round' }));
      g.appendChild(E('path', { d: d, fill: 'none', stroke: 'url(#bg-steel)', 'stroke-width': 0.135 * R, 'stroke-linecap': 'round', class: 'coeur-l-arm' }));
      g.appendChild(E('path', { d: d, fill: 'none', stroke: 'rgba(255,255,255,.45)', 'stroke-width': 0.018 * R, 'stroke-linecap': 'round' }));
    });
    // lever + fork head
    var lv = [{ x: -0.045 * R, y: PV.y }, { x: 0.045 * R, y: PV.y }, { x: 0.03 * R, y: F.y + 0.08 * R }, { x: -0.03 * R, y: F.y + 0.08 * R }];
    g.appendChild(E('path', { d: ptsD(lv, true), class: 'coeur-l-steel', fill: 'url(#bg-steel)' }));
    var s = 0.05 * R;
    var fork = 'M' + r2(-0.03 * R) + ' ' + r2(F.y + 0.085 * R) +
      'L' + r2(-0.075 * R) + ' ' + r2(F.y + 0.035 * R) +
      'Q' + r2(-0.125 * R) + ' ' + r2(F.y - 0.03 * R) + ' ' + r2(-0.088 * R) + ' ' + r2(F.y - 0.115 * R) +
      'L' + r2(-s) + ' ' + r2(F.y - 0.1 * R) + 'L' + r2(-s) + ' ' + r2(F.y) +
      'A' + s + ' ' + s + ' 0 0 0 ' + r2(s) + ' ' + r2(F.y) +
      'L' + r2(s) + ' ' + r2(F.y - 0.1 * R) + 'L' + r2(0.088 * R) + ' ' + r2(F.y - 0.115 * R) +
      'Q' + r2(0.125 * R) + ' ' + r2(F.y - 0.03 * R) + ' ' + r2(0.075 * R) + ' ' + r2(F.y + 0.035 * R) +
      'L' + r2(0.03 * R) + ' ' + r2(F.y + 0.085 * R) + 'Z';
    g.appendChild(E('path', { d: fork, class: 'coeur-l-steel coeur-l-fork', fill: 'url(#bg-steel)' }));
    // hub
    g.appendChild(E('circle', { cx: PV.x, cy: PV.y, r: 0.09 * R, fill: 'url(#bg-steel-radial)', class: 'coeur-l-steel' }));
    // stones
    var stoneEls = M.stones.map(function (st) {
      var el = E('path', { d: ptsD(st.local, true), fill: 'url(#bg-ruby)', class: 'coeur-l-stone coeur-l-stone--' + st.name });
      g.appendChild(el);
      // polish highlight along the stone
      var L = st.local;
      g.appendChild(E('path', { d: 'M' + r2(lerp(L[1].x, L[2].x, 0.3)) + ' ' + r2(lerp(L[1].y, L[2].y, 0.3)) + 'L' + r2(lerp(L[0].x, L[3].x, 0.3)) + ' ' + r2(lerp(L[0].y, L[3].y, 0.3)), stroke: 'rgba(255,215,222,.55)', 'stroke-width': 0.012 * R, 'stroke-linecap': 'round', fill: 'none' }));
      return el;
    });
    // guard pin (dard) — above the fork, separate group so it can sit over the roller
    var top = E('g', { class: 'coeur-pallet-top' });
    top.appendChild(E('path', { d: 'M0 ' + r2(F.y + 0.02 * R) + 'L0 ' + r2(F.y - 0.072 * R), stroke: '#dfe4e9', 'stroke-width': 0.016 * R, 'stroke-linecap': 'round', class: 'coeur-l-dart' }));
    return { g: g, top: top, stones: stoneEls };
  }
  function bankingPins() {
    var R = M.R, y = M.PV.y - 0.55 * M.lever, half = lerp(0.045 * R, 0.03 * R, 0.55) + 0.028 * R;
    return [M.rot({ x: half, y: y }, M.S), M.rot({ x: -half, y: y }, -M.S)];
  }
  function buildRoller() {
    var R = M.R;
    var g = E('g', { class: 'coeur-roller' });
    g.appendChild(E('circle', { r: 0.33 * R, fill: 'url(#coeur-steel-dk)', opacity: '0.92' }));
    g.appendChild(E('circle', { r: 0.33 * R, fill: 'none', stroke: 'rgba(255,255,255,.35)', 'stroke-width': 0.008 * R }));
    g.appendChild(E('circle', { r: 0.16 * R, fill: 'url(#bg-steel-radial)' }));
    g.appendChild(E('circle', { cx: 0, cy: 0.16 * R, r: 0.038 * R, fill: '#15181c' }));
    var pin = E('path', {
      d: 'M' + r2(-M.pinR) + ' ' + r2(M.roller - 0.012 * R) + 'A' + r2(M.pinR) + ' ' + r2(M.pinR) + ' 0 1 0 ' + r2(M.pinR) + ' ' + r2(M.roller - 0.012 * R) + 'Z',
      fill: 'url(#bg-ruby)', class: 'coeur-l-pin'
    });
    g.appendChild(pin);
    g.appendChild(E('circle', { r: 0.045 * R, fill: 'url(#bg-gold-radial)' }));
    return { g: g, pin: pin };
  }
  function buildBalance(radius, opt) {
    opt = opt || {};
    var g = E('g', { class: 'coeur-balance' });
    var bw = G.balanceWheel({ radius: radius, rim: radius * 0.085, arms: 2, weights: 4, hubRadius: radius * 0.12, armWidth: radius * 0.07, phase: 0.0001 });
    g.appendChild(E('path', { d: bw.d, 'fill-rule': 'evenodd', fill: 'url(#bg-gold)', class: 'coeur-l-balance' }));
    bw.weights.forEach(function (w) {
      var q = pol(radius * 0.84, w.angle);
      g.appendChild(E('circle', { cx: r2(q.x), cy: r2(q.y), r: r2(radius * 0.075), fill: 'url(#bg-gold-radial)', stroke: 'rgba(60,40,10,.6)', 'stroke-width': radius * 0.008 }));
      g.appendChild(E('line', { x1: r2(q.x - radius * 0.05), y1: r2(q.y), x2: r2(q.x + radius * 0.05), y2: r2(q.y), stroke: 'rgba(60,40,10,.7)', 'stroke-width': radius * 0.012, transform: 'rotate(' + r2(w.angle * DEG) + ' ' + r2(q.x) + ' ' + r2(q.y) + ')' }));
    });
    return g;
  }

  /* ======================================================================
   * 2. THE LOUPE
   * ==================================================================== */
  var loupe = (function buildLoupe() {
    var svg = $('[data-coeur-loupe]');
    if (!svg) return null;
    var R = M.R;
    // plate + perlage + vignette (viewBox coords)
    var vb = { x: -110, y: -127, w: 410, h: 254 };
    svg.appendChild(E('rect', { x: vb.x, y: vb.y, width: vb.w, height: vb.h, fill: 'url(#coeur-plate)' }));
    svg.appendChild(E('rect', { x: vb.x, y: vb.y, width: vb.w, height: vb.h, fill: 'url(#coeur-perlage-lg)' }));
    // decorative screws / jewel settings on the plate
    [[-92, -108, 30], [-92, 108, 70]].forEach(function (s) { svg.appendChild(G.screw({ x: s[0], y: s[1], r: 8, slot: s[2] })); });

    var world = E('g', { transform: 'rotate(90)' });   // vertical model frame → horizontal display
    svg.appendChild(world);

    // banking pins (static)
    bankingPins().forEach(function (q) {
      world.appendChild(E('circle', { cx: r2(q.x), cy: r2(q.y), r: 0.028 * R, fill: 'url(#bg-steel-radial)', class: 'coeur-l-bank' }));
      world.appendChild(E('circle', { cx: r2(q.x), cy: r2(q.y), r: 0.01 * R, fill: '#1a1d21' }));
    });

    // escape wheel
    var wheel = E('g', { class: 'coeur-l-wheel' });
    wheel.appendChild(E('path', { d: escapeWheelD(), 'fill-rule': 'evenodd', fill: 'url(#bg-steel)', stroke: 'rgba(20,24,28,.55)', 'stroke-width': 0.6 }));
    wheel.appendChild(E('circle', { r: 0.13 * R, fill: 'url(#coeur-steel-dk)' }));
    world.appendChild(wheel);
    var hiTooth = E('path', { d: toothD(), class: 'coeur-l-hitooth', fill: 'none' });
    world.appendChild(hiTooth);
    world.appendChild(G.jewel({ x: 0, y: 0, r: 0.06 * R }));

    // pallet fork
    var pal = buildPallet();
    var palG = E('g', {}, [pal.g]);
    world.appendChild(palG);

    // balance group: roller, pin, then ghost balance + hairspring
    var balG = E('g', {});
    var roller = buildRoller();
    balG.appendChild(roller.g);
    world.appendChild(balG);
    var palTop = E('g', {}, [pal.top]);
    world.appendChild(palTop);
    world.appendChild(G.jewel({ x: M.PV.x, y: M.PV.y, r: 0.045 * R }));

    var ghost = E('g', { class: 'coeur-l-ghost' });
    var ghostRot = E('g', {});
    ghostRot.appendChild(buildBalance(1.12 * R));
    ghost.appendChild(ghostRot);
    var spring = E('path', { class: 'coeur-l-spring', fill: 'none' });
    ghost.appendChild(spring);
    ghost.setAttribute('transform', 'translate(' + r2(M.B.x) + ' ' + r2(M.B.y) + ')');
    world.appendChild(ghost);
    world.appendChild(G.jewel({ x: M.B.x, y: M.B.y, r: 0.055 * R }));

    // contact spark
    var spark = E('g', { class: 'coeur-l-spark' }, [
      E('circle', { r: 9, fill: 'url(#coeur-lensglow)' }),
      E('circle', { r: 2.1, fill: '#fff7e0' })
    ]);
    world.appendChild(spark);

    // vignette over everything
    svg.appendChild(E('rect', { x: vb.x, y: vb.y, width: vb.w, height: vb.h, fill: 'url(#coeur-vignette)', 'pointer-events': 'none' }));

    // annotations (display frame)
    var ann = E('g', { class: 'coeur-l-ann' });
    function label(txt, x, y, tx, ty, anchor) {
      ann.appendChild(E('path', { d: 'M' + x + ' ' + y + 'L' + tx + ' ' + ty, class: 'coeur-l-annline' }));
      ann.appendChild(E('circle', { cx: x, cy: y, r: 1.6, class: 'coeur-l-anndot' }));
      var t = E('text', { x: tx + (anchor === 'end' ? -3 : 3), y: ty + 3, 'text-anchor': anchor || 'start' });
      t.textContent = txt;
      ann.appendChild(t);
    }
    function disp(q) { return { x: r2(-q.y), y: r2(q.x) }; }   // rotate(90)
    var eSt = disp(M.stones[0].local[0]), xSt = disp(M.stones[1].local[0]);
    label('Roue d’échappement', -52, 72, -100, 116, 'start');
    label('Levée d’entrée', r2(eSt.x - 4), r2(eSt.y + 3), 40, -112, 'start');
    label('Levée de sortie', r2(xSt.x - 4), r2(xSt.y - 3), 60, 116, 'start');
    label('Ancre', 124, 40, 132, 88, 'start');
    label('Fourchette & dard', r2(M.d + M.lever - 2), -9, 172, -86, 'start');
    label('Cheville de plateau', r2(M.d + M.lever + 3), 6, 150, 100, 'start');
    label('Balancier & spiral', 292, 58, 296, 116, 'end');
    svg.appendChild(ann);

    var ui = {
      phase: $('[data-coeur-phase]'), desc: $('[data-coeur-phasedesc]'), live: $('[data-coeur-phaselive]'),
      lens: $('[data-coeur-lensphase]'), tag: $('[data-coeur-speedtag]'),
      theta: $('[data-coeur-theta]'), mark: $('[data-coeur-mark]'),
      pallet: $('[data-coeur-ro="pallet"]'), wheel: $('[data-coeur-ro="wheel"]'), beats: $('[data-coeur-ro="beats"]'), time: $('[data-coeur-ro="time"]'),
      items: $$('[data-coeur-ph]'), play: $('[data-coeur-play]'), playLabel: $('[data-coeur-playlabel]'),
      step: $('[data-coeur-stepbtn]'), speeds: $$('[data-coeur-speed]'),
      sound: $('[data-coeur-sound]'), scrub: $('[data-coeur-scrub]'), scrubWrap: $('[data-coeur-scrubwrap]')
    };

    /* ---- Tic-tac: Web Audio clicks at the real unlock / impulse / drop moments (muted by default) ---- */
    var AC = window.AudioContext || window.webkitAudioContext, audio = null, soundOn = false, noiseBuf = null;
    var TONES = { degagement: { f: 5200, g: 0.22, d: 0.006 }, impulsion: { f: 3100, g: 0.45, d: 0.009 }, verrou: { f: 2300, g: 0.7, d: 0.014 } };
    function click(kind, when) {
      if (!audio) return;
      var o = TONES[kind]; if (!o) return;
      var t0 = audio.currentTime + (when || 0);
      var src = audio.createBufferSource(); src.buffer = noiseBuf;
      var bp = audio.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = o.f; bp.Q.value = 7;
      var g = audio.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(o.g, t0 + 0.0008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d + 0.03);
      src.connect(bp); bp.connect(g); g.connect(audio.destination);
      src.start(t0); src.stop(t0 + o.d + 0.05);
    }
    function initAudio() {
      if (audio || !AC) return;
      audio = new AC();
      noiseBuf = audio.createBuffer(1, Math.round(audio.sampleRate * 0.06), audio.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audio.sampleRate * 0.004));
    }
    var lastSoundSub = '', lastSoundBeat = -1;
    function sound(st, speed) {
      if (!soundOn || !audio) { lastSoundSub = st.sub; lastSoundBeat = st.beats; return; }
      if (speed >= 0.2) {
        // fast: the three sounds of one beat fall inside a single frame, play them as one "tic"
        if (st.beats !== lastSoundBeat && lastSoundBeat >= 0) {
          var k = Math.min(1 / speed, 6);
          click('degagement', 0); click('impulsion', 0.0024 * k); click('verrou', 0.0068 * k);
        }
      } else if (st.sub !== lastSoundSub && lastSoundSub) click(st.sub, 0);
      lastSoundSub = st.sub; lastSoundBeat = st.beats;
    }
    var DESCS = {
      repos: 'La roue est verrouillée sur une levée ; le balancier parcourt librement son arc supplémentaire, sans aucun contact.',
      verrou: 'La dent vient de se bloquer sur la face de repos : le tirage plaque l’ancre contre sa goupille de limitation.',
      degagement: 'La cheville entre dans la fourchette et fait pivoter l’ancre : la levée libère la dent, qui recule légèrement.',
      impulsion: 'La dent glisse sur le plan incliné de la levée : l’ancre transmet au balancier l’énergie du barillet.',
      chute: 'La dent quitte la levée : la roue tourne librement jusqu’à rencontrer la levée opposée.'
    };

    var lastSub = '', lastUi = 0, lastSpringTh = 1e9;
    var userSpeed = 0.05, stepTarget = null;
    function render(t, force) {
      var st = M.state(t);
      wheel.setAttribute('transform', 'rotate(' + r2(st.escapeDeg) + ')');
      palG.setAttribute('transform', 'rotate(' + st.palletDeg.toFixed(3) + ' 0 ' + r2(M.PV.y) + ')');
      palTop.setAttribute('transform', 'rotate(' + st.palletDeg.toFixed(3) + ' 0 ' + r2(M.PV.y) + ')');
      balG.setAttribute('transform', 'translate(' + r2(M.B.x) + ' ' + r2(M.B.y) + ') rotate(' + r2(st.balanceDeg) + ')');
      ghostRot.setAttribute('transform', 'rotate(' + r2(st.balanceDeg) + ')');
      if (Math.abs(st.balanceDeg - lastSpringTh) > 0.4 || force) {
        lastSpringTh = st.balanceDeg;
        spring.setAttribute('d', G.hairspringPath({ inner: 0.2 * M.R, outer: 0.82 * M.R, turns: 9, twist: st.balanceDeg * RAD * 0.9, breguet: true, samples: 30 }));
      }
      var c = st.contact;
      if (c && c.stone >= 0) hiTooth.setAttribute('transform', 'rotate(' + r2(st.toothDeg) + ')');
      var cp = st.phase === 'chute' ? null : M.contactPoint(st);
      if (cp && Math.abs(st.balanceDeg) < LIFT_HALF * 2.2) { spark.setAttribute('transform', 'translate(' + r2(cp.x) + ' ' + r2(cp.y) + ')'); spark.style.opacity = '1'; }
      else spark.style.opacity = '0';
      pal.stones.forEach(function (el, i) { el.classList.toggle('is-working', !!c && c.stone === i && st.phase !== 'chute'); });
      svg.setAttribute('data-phase', st.phase);
      if (st.sub !== lastSub || force) {
        lastSub = st.sub;
        ui.phase.textContent = st.phaseLabel;
        ui.lens.textContent = st.phaseLabel;
        ui.desc.textContent = DESCS[st.sub];
        ui.items.forEach(function (li) {
          var on = li.getAttribute('data-coeur-ph') === st.phase;
          li.classList.toggle('is-current', on);
          if (on) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
        });
      }
      var now = performance.now();
      if (force || now - lastUi > 70) {
        lastUi = now;
        ui.theta.textContent = fmt(st.balanceDeg, 0) + '°';
        ui.mark.style.transform = 'translateX(' + (st.balanceDeg / AMP * 50).toFixed(2) + 'cqi)';
        ui.mark.classList.toggle('is-lift', Math.abs(st.balanceDeg) < LIFT_HALF);
        ui.pallet.textContent = fmt(st.palletDeg, 2) + '°';
        ui.wheel.textContent = fmt(((st.escapeDeg - M.e0) % 360 + 360) % 360, 1) + '°';
        ui.beats.textContent = String(Math.max(0, st.beats));
        ui.time.textContent = fmt(t, 3) + ' s';
        if (ui.scrub && !scrubbing) ui.scrub.value = String(Math.round((((t % (2 * HALF)) + 2 * HALF) % (2 * HALF)) / (2 * HALF) * 1000));
        if (ui.scrub) ui.scrub.setAttribute('aria-valuetext', st.phaseLabel + ', balancier à ' + fmt(st.balanceDeg, 0) + '°');
      }
      return st;
    }

    var handle = G.ticker.add(function (f) {
      var t = f.time;
      if (stepTarget != null && t >= stepTarget) {
        t = stepTarget; f.handle.time = t; stepTarget = null;
        f.handle.speed = userSpeed; f.handle.pause();
        var st = render(t, true);
        announce(st);
        syncPlay();
        return;
      }
      var s2 = render(t, f.dt === 0);
      if (f.dt > 0) sound(s2, f.handle.speed); else { lastSoundSub = s2.sub; lastSoundBeat = s2.beats; }
    }, { el: svg, reduced: 'run', autoplay: !G.reducedMotion, speed: userSpeed, time: 3 * HALF + HALF / 2 + 0.0004 });

    function announce(st) { ui.live.textContent = st.phaseLabel + '. ' + DESCS[st.sub]; }
    function syncPlay() {
      var playing = handle.playing && stepTarget == null;
      ui.playLabel.textContent = playing ? 'Pause' : 'Lecture';
      ui.play.classList.toggle('is-paused', !playing);
    }
    function setSpeed(v) {
      userSpeed = v;
      if (stepTarget == null) handle.speed = v;
      ui.speeds.forEach(function (b) { b.setAttribute('aria-pressed', parseFloat(b.getAttribute('data-coeur-speed')) === v ? 'true' : 'false'); });
      ui.tag.textContent = '×' + String(v).replace('.', ',');
    }
    ui.play.addEventListener('click', function () {
      if (stepTarget != null) { stepTarget = null; handle.speed = userSpeed; }
      if (handle.playing) { handle.pause(); announce(M.state(handle.time)); }
      else handle.play();
      syncPlay();
    });
    ui.speeds.forEach(function (b) {
      b.addEventListener('click', function () { setSpeed(parseFloat(b.getAttribute('data-coeur-speed'))); });
    });
    ui.step.addEventListener('click', function () {
      var t0 = stepTarget != null ? stepTarget : handle.time;
      var tt = M.nextStop(t0);
      if (G.reducedMotion) {
        stepTarget = null; handle.pause(); handle.time = tt;
        announce(render(tt, true)); syncPlay();
        return;
      }
      if (stepTarget != null) { handle.time = t0; }
      stepTarget = tt;
      handle.speed = Math.max((tt - handle.time) / 1.1, 0.0015);
      handle.play();
      syncPlay();
    });
    if (ui.sound && AC) {
      ui.sound.hidden = false;
      ui.sound.addEventListener('click', function () {
        initAudio();
        soundOn = !soundOn;
        if (soundOn && audio.state === 'suspended') audio.resume();
        ui.sound.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
      });
    }
    var scrubbing = false;
    if (ui.scrub) {
      ui.scrubWrap.hidden = false;
      var scrubTo = function () {
        stepTarget = null; handle.speed = userSpeed;
        if (handle.playing) handle.pause();
        var P = 2 * HALF, base = Math.floor(handle.time / P) * P;
        var tt = base + (+ui.scrub.value / 1000) * P;
        handle.time = tt;
        var st = render(tt, true);
        if (soundOn && audio) sound(st, 0);
        syncPlay();
      };
      ui.scrub.addEventListener('input', function () { scrubbing = true; scrubTo(); scrubbing = false; });
      ui.scrub.addEventListener('change', function () { announce(M.state(handle.time)); });
    }
    G.onReducedMotionChange(function (red) { if (red) { stepTarget = null; handle.pause(); handle.speed = userSpeed; syncPlay(); } });
    setSpeed(userSpeed);
    render(handle.time, true);
    syncPlay();
    return { handle: handle, render: render };
  })();

  /* ======================================================================
   * 3. EXPLODED VIEW — 7 planes of the Calibre BR-01 (plan coordinates,
   *    viewBox -160..160, movement radius 150)
   * ==================================================================== */
  var stage = $('[data-coeur-stage]');
  var stack = $('[data-coeur-stack]');
  if (!stage || !stack) return;

  // plan layout — centre distances = sum of pitch radii (exact meshing)
  var PL = (function () {
    var C0 = { x: 0, y: 0 };
    var BAR = pol(67.5, 200 * RAD);          // barrel 80 (m 1.5, r 60) ↔ centre pinion 10 (r 7.5)
    var THI = pol(54, -10 * RAD);            // centre 80 (m 1.2, r 48) ↔ third pinion 10 (r 6)
    var FOU = pol(46.75, 60 * RAD, THI.x, THI.y);   // third 75 (m 1.1, r 41.25) ↔ fourth pinion 10 (r 5.5)
    var ESC = pol(40.8, 110 * RAD, FOU.x, FOU.y);   // fourth 96 (m .8, r 38.4) ↔ escape pinion 6 (r 2.4)
    var k = 0.16, ROT = 205;                         // escapement group: scale & orientation
    function escToPlan(q) { var a = ROT * RAD, c = Math.cos(a), s = Math.sin(a); return { x: ESC.x + k * (q.x * c - q.y * s), y: ESC.y + k * (q.x * s + q.y * c) }; }
    return { C0: C0, BAR: BAR, THI: THI, FOU: FOU, ESC: ESC, k: k, ROT: ROT, escToPlan: escToPlan, PP: escToPlan(M.PV), BAL: escToPlan(M.B) };
  })();
  function ang(A, B) { return Math.atan2(B.y - A.y, B.x - A.x); }

  var LAYERS = [
    { id: 'platine', step: 5, name: 'Platine' },
    { id: 'barillet', step: 1, name: 'Barillet & ressort' },
    { id: 'rouage', step: 2, name: 'Rouage' },
    { id: 'echappement', step: 3, name: 'Échappement' },
    { id: 'balancier', step: 4, name: 'Balancier-spiral' },
    { id: 'ponts', step: 5, name: 'Ponts' },
    { id: 'masse', step: 6, name: 'Masse oscillante' }
  ];
  var STEP_ANCHOR = { 1: ['barillet', PL.BAR], 2: ['rouage', PL.THI], 3: ['echappement', PL.PP], 4: ['balancier', PL.BAL], 5: ['ponts', { x: 96, y: -30 }], 6: ['masse', pol(92, -118 * RAD)] };
  var STEP_NAMES = { 1: 'Barillet & ressort', 2: 'Rouage', 3: 'Échappement', 4: 'Balancier-spiral', 5: 'Ponts & platine', 6: 'Masse oscillante' };
  var HOTS = {
    barillet: [[PL.BAR, 'Rochet', 'Colimaçonnage réalisé à la main'], [pol(60, 150 * RAD, PL.BAR.x, PL.BAR.y), 'Tambour · 80 dents', '1 tour en 8 heures'], [pol(40, 40 * RAD, PL.BAR.x, PL.BAR.y), 'Ressort de barillet', 'Alliage cobalt-nickel · 72 h de réserve']],
    rouage: [[PL.C0, 'Roue de centre', '80 dents · 1 tour par heure'], [pol(28, 200 * RAD, PL.THI.x, PL.THI.y), 'Roue moyenne', '75 dents · 1 tour en 7 min 30 s'], [pol(26, 30 * RAD, PL.FOU.x, PL.FOU.y), 'Roue de secondes', '96 dents · 1 tour par minute']],
    echappement: [[PL.escToPlan({ x: 0, y: 64 }), 'Roue d’échappement', '15 dents club · 12° par alternance'], [PL.escToPlan({ x: 0, y: -M.d - M.lever * 0.55 }), 'Ancre suisse', 'Deux levées en rubis synthétique']],
    balancier: [[PL.BAL, 'Balancier & spiral Breguet', '4 Hz · amplitude ≈ 285°'], [pol(28, 300 * RAD, PL.BAL.x, PL.BAL.y), 'Masselottes en or', 'Quatre masselottes de réglage']],
    ponts: [[{ x: 100, y: -10 }, 'Côtes de Genève', 'Décor rayonnant des ponts'], [PL.THI, 'Rubis en chaton d’or', '31 rubis au total'], [{ x: -48, y: -96 }, 'Vis bleuies', 'Bleuies à la flamme']],
    platine: [[{ x: 10, y: 136 }, 'Perlage', 'Grainage circulaire de la platine']],
    masse: [[PL.C0, 'Roulement à billes', 'Billes céramique · remontage bidirectionnel'], [pol(118, -80 * RAD), 'Or rose 22 carats', 'Côtes de Genève'], [pol(74, -140 * RAD), 'Gravure', 'Monogramme de la manufacture']]
  };

  function svgLayer() {
    return E('svg', { class: 'coeur-layer-svg', viewBox: '-160 -160 320 320', 'aria-hidden': 'true', focusable: 'false' });
  }
  function gearEl(o, fill, extra) {
    var g = G.gear(o);
    var p = E('path', Object.assign({ d: g.d, 'fill-rule': 'evenodd', fill: fill, stroke: 'rgba(40,28,8,.45)', 'stroke-width': 0.35 }, extra || {}));
    return p;
  }
  var anim = {};   // animated nodes

  function layerPlatine(svg) {
    svg.appendChild(E('circle', { r: 152, fill: 'url(#bg-rhodium)' }));
    svg.appendChild(E('circle', { r: 152, fill: 'url(#bg-perlage)' }));
    svg.appendChild(E('circle', { r: 150.5, fill: 'none', stroke: 'rgba(255,255,255,.55)', 'stroke-width': 1.4 }));
    svg.appendChild(E('circle', { r: 152, fill: 'none', stroke: 'rgba(0,0,0,.4)', 'stroke-width': 0.6 }));
    svg.appendChild(E('circle', { cx: PL.BAL.x, cy: PL.BAL.y, r: 34, fill: 'rgba(40,46,54,.35)', stroke: 'rgba(255,255,255,.35)', 'stroke-width': 0.8 }));
    svg.appendChild(E('circle', { cx: PL.BAR.x, cy: PL.BAR.y, r: 63, fill: 'rgba(40,46,54,.22)', stroke: 'rgba(255,255,255,.28)', 'stroke-width': 0.8 }));
    [PL.C0, PL.THI, PL.FOU, PL.ESC, PL.PP, PL.BAL].forEach(function (q) { svg.appendChild(G.jewel({ x: q.x, y: q.y, r: 2.6 })); });
    var path = E('path', { id: 'coeur-plat-arc', d: 'M-118 0A118 118 0 0 1 118 0', fill: 'none' });
    svg.appendChild(path);
    var t = E('text', { class: 'coeur-engrave', 'font-size': '7.5', 'letter-spacing': '3' });
    var tp = E('textPath', { href: '#coeur-plat-arc', startOffset: '50%', 'text-anchor': 'middle' });
    tp.textContent = 'CALIBRE BR-01 · SWISS MADE';
    t.appendChild(tp); svg.appendChild(t);
    [[-140, 55], [140, -55]].forEach(function (q) { svg.appendChild(G.screw({ x: q[0], y: q[1], r: 4.2, slot: 20 })); });
  }
  function layerBarillet(svg) {
    var B = PL.BAR;
    var g = E('g', { transform: 'translate(' + r2(B.x) + ' ' + r2(B.y) + ')' });
    var drum = E('g');
    drum.appendChild(gearEl({ teeth: 80, radius: 60, spokes: 0, hole: 0 }, 'url(#bg-brass)'));
    drum.appendChild(E('circle', { r: 56, fill: 'url(#coeur-drum)' }));
    // mainspring through a sector window
    var clip = E('clipPath', { id: 'coeur-spring-win' }, [E('path', { d: 'M0 0L' + r2(54 * Math.cos(-0.2)) + ' ' + r2(54 * Math.sin(-0.2)) + 'A54 54 0 0 1 ' + r2(54 * Math.cos(1.9)) + ' ' + r2(54 * Math.sin(1.9)) + 'Z' })]);
    svg.appendChild(clip);
    var win = E('g', { 'clip-path': 'url(#coeur-spring-win)' });
    win.appendChild(E('circle', { r: 54, fill: '#15120d' }));
    win.appendChild(E('path', { d: G.hairspringPath({ inner: 12, outer: 52, turns: 13, samples: 36 }), fill: 'none', stroke: '#c8ccd2', 'stroke-width': 1.25 }));
    drum.appendChild(win);
    drum.appendChild(E('path', { d: 'M0 0L' + r2(54 * Math.cos(-0.2)) + ' ' + r2(54 * Math.sin(-0.2)) + 'M0 0L' + r2(54 * Math.cos(1.9)) + ' ' + r2(54 * Math.sin(1.9)), stroke: 'rgba(255,240,200,.5)', 'stroke-width': 0.8 }));
    g.appendChild(drum);
    // ratchet wheel with snailing (colimaçonnage)
    var ratchet = E('g');
    ratchet.appendChild(gearEl({ teeth: 44, radius: 36, profile: 'watch', spokes: 0 }, 'url(#bg-steel)', { stroke: 'rgba(20,24,28,.5)' }));
    for (var r = 6; r < 34; r += 2.2) ratchet.appendChild(E('circle', { r: r2(r), fill: 'none', stroke: r % 4.4 < 2.2 ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.12)', 'stroke-width': 1.1 }));
    ratchet.appendChild(E('rect', { x: -4.5, y: -4.5, width: 9, height: 9, fill: '#3a4048', rx: 1 }));
    g.appendChild(ratchet);
    g.appendChild(G.screw({ x: 0, y: 0, r: 4, slot: 30 }));
    svg.appendChild(g);
    anim.drum = drum; anim.ratchet = ratchet;
  }
  function wheelWithPinion(o) {
    var g = E('g', { transform: 'translate(' + r2(o.at.x) + ' ' + r2(o.at.y) + ')' });
    var rotG = E('g');
    rotG.appendChild(gearEl({ teeth: o.teeth, radius: o.r, spokes: 5, curve: 0.45, hole: 0 }, 'url(#bg-gold)'));
    rotG.appendChild(E('circle', { r: r2(o.r * 0.2), fill: 'url(#bg-gold-radial)' }));
    rotG.appendChild(E('path', { d: G.pinion({ teeth: o.pt, radius: o.pr }).d, fill: 'url(#bg-steel)', 'fill-rule': 'evenodd', stroke: 'rgba(20,24,28,.5)', 'stroke-width': 0.3 }));
    rotG.appendChild(E('circle', { r: r2(o.pr * 0.35), fill: '#2a2f35' }));
    g.appendChild(rotG);
    return { g: g, rot: rotG };
  }
  function layerRouage(svg) {
    var centre = wheelWithPinion({ at: PL.C0, teeth: 80, r: 48, pt: 10, pr: 7.5 });
    var third = wheelWithPinion({ at: PL.THI, teeth: 75, r: 41.25, pt: 10, pr: 6 });
    var fourth = wheelWithPinion({ at: PL.FOU, teeth: 96, r: 38.4, pt: 10, pr: 5.5 });
    svg.appendChild(third.g); svg.appendChild(centre.g); svg.appendChild(fourth.g);
    anim.centre = centre.rot; anim.third = third.rot; anim.fourth = fourth.rot;
  }
  function escGroup() {
    return E('g', { transform: 'translate(' + r2(PL.ESC.x) + ' ' + r2(PL.ESC.y) + ') rotate(' + PL.ROT + ') scale(' + PL.k + ')' });
  }
  function layerEchappement(svg) {
    var g = escGroup();
    var w = E('g');
    w.appendChild(E('path', { d: G.pinion({ teeth: 6, radius: 2.4 / PL.k }).d, fill: 'url(#coeur-steel-dk)', 'fill-rule': 'evenodd' }));
    w.appendChild(E('path', { d: escapeWheelD(), fill: 'url(#bg-steel)', 'fill-rule': 'evenodd', stroke: 'rgba(20,24,28,.6)', 'stroke-width': 2 }));
    g.appendChild(w);
    var pal = buildPallet();
    var pg = E('g', {}, [pal.g, pal.top]);
    g.appendChild(pg);
    bankingPins().forEach(function (q) { g.appendChild(E('circle', { cx: r2(q.x), cy: r2(q.y), r: 3, fill: 'url(#bg-steel-radial)' })); });
    svg.appendChild(g);
    anim.escWheel = w; anim.pallet = pg;
  }
  function layerBalancier(svg) {
    var g = escGroup();
    var bal = E('g', { transform: 'translate(' + r2(M.B.x) + ' ' + r2(M.B.y) + ')' });
    var rot = E('g');
    rot.appendChild(buildRoller().g);
    rot.appendChild(buildBalance(186));
    bal.appendChild(rot);
    var spring = E('path', { fill: 'none', stroke: '#dfe5ec', 'stroke-width': 2.2, opacity: '0.9' });
    bal.appendChild(spring);
    bal.appendChild(E('circle', { r: 16, fill: 'url(#bg-gold-radial)' }));
    g.appendChild(bal);
    svg.appendChild(g);
    anim.balance = rot; anim.spring = spring;
  }
  function bridge(svg, d) {
    svg.appendChild(E('path', { d: d, fill: 'url(#coeur-bridge)' }));
    svg.appendChild(E('path', { d: d, fill: 'url(#bg-cotes)' }));
    svg.appendChild(E('path', { d: d, fill: 'none', stroke: 'rgba(255,255,255,.9)', 'stroke-width': 1.8, 'stroke-linejoin': 'round' }));   // anglage
    svg.appendChild(E('path', { d: d, fill: 'none', stroke: 'rgba(20,24,30,.55)', 'stroke-width': 0.5, 'stroke-linejoin': 'round' }));
  }
  function P2(q) { return r2(q.x) + ' ' + r2(q.y); }
  function layerPonts(svg) {
    var a1 = pol(148, 145 * RAD), a2 = pol(148, 240 * RAD);
    bridge(svg, 'M' + P2(a1) + 'A148 148 0 0 1 ' + P2(a2) + 'Q-12 -96 -10 -36Q-8 18 -52 48Q-92 74 ' + P2(a1) + 'Z');
    var b1 = pol(148, -42 * RAD), b2 = pol(148, 24 * RAD);
    bridge(svg, 'M' + P2(b1) + 'A148 148 0 0 1 ' + P2(b2) + 'Q98 60 74 50Q40 34 33 4Q30 -30 66 -52Q92 -70 ' + P2(b1) + 'Z');
    // pallet bridge
    var e = PL.ESC, pp = PL.PP, dx = pp.x - e.x, dy = pp.y - e.y, dl = Math.hypot(dx, dy), nx = -dy / dl * 7, ny = dx / dl * 7;
    bridge(svg, 'M' + r2(e.x + nx) + ' ' + r2(e.y + ny) + 'L' + r2(pp.x + nx) + ' ' + r2(pp.y + ny) + 'A7 7 0 0 1 ' + r2(pp.x - nx) + ' ' + r2(pp.y - ny) + 'L' + r2(e.x - nx) + ' ' + r2(e.y - ny) + 'A7 7 0 0 1 ' + r2(e.x + nx) + ' ' + r2(e.y + ny) + 'Z');
    // balance cock
    var B = PL.BAL, c1 = pol(148, 14 * RAD), c2 = pol(148, 40 * RAD);
    bridge(svg, 'M' + P2(c1) + 'A148 148 0 0 1 ' + P2(c2) + 'Q' + r2(B.x + 26) + ' ' + r2(B.y + 4) + ' ' + r2(B.x + 8) + ' ' + r2(B.y + 10) + 'A11 11 0 1 1 ' + r2(B.x + 6) + ' ' + r2(B.y - 9) + 'Q' + r2(B.x + 34) + ' ' + r2(B.y - 30) + ' ' + P2(c1) + 'Z');
    // jewels & screws
    [PL.THI, PL.FOU, PL.ESC, PL.PP].forEach(function (q) { svg.appendChild(G.jewel({ x: q.x, y: q.y, r: 2.8 })); });
    svg.appendChild(G.jewel({ x: B.x, y: B.y, r: 3.4 }));
    [[-48, -96, 20], [-118, 40, -35], [-24, -8, 60], [118, -48, 10], [118, 30, -40], [54, 30, 75], [128, 70, 5], [58, 80, 40]].forEach(function (s) { svg.appendChild(G.screw({ x: s[0], y: s[1], r: 3.6, slot: s[2] })); });
    var t = E('text', { class: 'coeur-engrave', x: -96, y: -18, 'font-size': '8', 'letter-spacing': '2.4', transform: 'rotate(-58 -96 -18)' });
    t.textContent = 'BULROG';
    svg.appendChild(t);
    var t2 = E('text', { class: 'coeur-engrave', x: 96, y: -44, 'font-size': '5.2', 'letter-spacing': '1.4', 'text-anchor': 'middle', transform: 'rotate(62 96 -44)' });
    t2.textContent = '31 RUBIS · BR-01';
    svg.appendChild(t2);
  }
  function layerMasse(svg) {
    var g = E('g', { class: 'coeur-rotor' });
    var ro = 150, ri = 20, a0 = -90 * RAD - Math.PI / 2 * 1.02, a1 = -90 * RAD + Math.PI / 2 * 1.02;
    var p0 = pol(ro, a0), p1 = pol(ro, a1), q1 = pol(ri + 16, a1), q0 = pol(ri + 16, a0);
    var d = 'M' + P2(p0) + 'A' + ro + ' ' + ro + ' 0 0 1 ' + P2(p1) + 'L' + P2(q1) + 'A' + (ri + 16) + ' ' + (ri + 16) + ' 0 0 0 ' + P2(q0) + 'Z';
    // openwork windows
    var win = '';
    [-150, -90, -30].forEach(function (c) {
      var w0 = (c - 22) * RAD, w1 = (c + 22) * RAD, r0 = 58, r1 = 112;
      win += 'M' + P2(pol(r1, w0)) + 'A' + r1 + ' ' + r1 + ' 0 0 1 ' + P2(pol(r1, w1)) + 'L' + P2(pol(r0, w1)) + 'A' + r0 + ' ' + r0 + ' 0 0 0 ' + P2(pol(r0, w0)) + 'Z';
    });
    g.appendChild(E('path', { d: d + win, 'fill-rule': 'evenodd', fill: 'url(#coeur-rose)' }));
    g.appendChild(E('path', { d: d + win, 'fill-rule': 'evenodd', fill: 'url(#bg-cotes)' }));
    g.appendChild(E('path', { d: d + win, 'fill-rule': 'evenodd', fill: 'none', stroke: 'rgba(255,230,210,.85)', 'stroke-width': 1.5 }));
    // heavy rim segment
    g.appendChild(E('path', { d: 'M' + P2(p0) + 'A' + ro + ' ' + ro + ' 0 0 1 ' + P2(p1) + 'L' + P2(pol(128, a1)) + 'A128 128 0 0 0 ' + P2(pol(128, a0)) + 'Z', fill: 'rgba(90,40,20,.25)' }));
    var arc = E('path', { id: 'coeur-rotor-arc', d: 'M' + P2(pol(137, -160 * RAD)) + 'A137 137 0 0 1 ' + P2(pol(137, -20 * RAD)), fill: 'none' });
    g.appendChild(arc);
    var t = E('text', { class: 'coeur-engrave coeur-engrave--rose', 'font-size': '10', 'letter-spacing': '6' });
    var tp = E('textPath', { href: '#coeur-rotor-arc', startOffset: '50%', 'text-anchor': 'middle' });
    tp.textContent = 'BULROG · LE SENTIER';
    t.appendChild(tp); g.appendChild(t);
    // bearing
    g.appendChild(E('circle', { r: 22, fill: 'url(#bg-steel-radial)' }));
    for (var i = 0; i < 12; i++) { var q = pol(15, i * TAU / 12); g.appendChild(E('circle', { cx: r2(q.x), cy: r2(q.y), r: 2.6, fill: '#f1f1ee', stroke: 'rgba(0,0,0,.3)', 'stroke-width': 0.4 })); }
    g.appendChild(E('circle', { r: 9, fill: 'url(#coeur-rose)' }));
    g.appendChild(G.screw({ x: 0, y: 0, r: 4.4, slot: -30 }));
    svg.appendChild(g);
    anim.rotor = g;
  }
  var BUILDERS = { platine: layerPlatine, barillet: layerBarillet, rouage: layerRouage, echappement: layerEchappement, balancier: layerBalancier, ponts: layerPonts, masse: layerMasse };

  var layerEls = LAYERS.map(function (L, i) {
    var div = document.createElement('div');
    div.className = 'coeur-layer coeur-layer--' + L.id;
    div.setAttribute('data-layer', L.id);
    div.style.setProperty('--coeur-i', i);
    if (L.id !== 'platine' && L.id !== 'masse' && L.id !== 'ponts') L.plane = true;
    var ring = document.createElement('span');
    ring.className = 'coeur-layer-ring';
    div.appendChild(ring);
    var svg = svgLayer();
    if (L.plane) {
      svg.appendChild(E('circle', { r: 152, fill: 'rgba(230,207,151,.025)', stroke: 'rgba(230,207,151,.28)', 'stroke-width': 0.8, 'stroke-dasharray': '1.5 3' }));
    }
    BUILDERS[L.id](svg);
    div.appendChild(svg);
    // projection anchors (hotspots + leader line anchor)
    function anchor(q) {
      var a = document.createElement('span');
      a.className = 'coeur-anchor';
      a.style.left = ((q.x + 160) / 320 * 100).toFixed(3) + '%';
      a.style.top = ((q.y + 160) / 320 * 100).toFixed(3) + '%';
      div.appendChild(a);
      return a;
    }
    L.el = div;
    L.hots = (HOTS[L.id] || []).map(function (h) { return { anchor: anchor(h[0]), title: h[1], text: h[2] }; });
    L.lead = null;
    Object.keys(STEP_ANCHOR).forEach(function (k) { if (STEP_ANCHOR[k][0] === L.id) L.lead = anchor(STEP_ANCHOR[k][1]); });
    stack.appendChild(div);
    return div;
  });

  /* --- movement animation (real time) --- */
  var TH = { e: ang(PL.ESC, PL.FOU), f: ang(PL.FOU, PL.THI), t: ang(PL.THI, PL.C0), c: ang(PL.C0, PL.BAR) };
  var lastSpring = 1e9;
  G.ticker.add(function (f) {
    var t = f.time;
    var st = M.state(t);
    var eW = st.escapeDeg + PL.ROT;                           // escape arbor, plan frame (deg)
    var rF = G.meshRotation(6, 96, TH.e, eW * RAD);          // fourth
    var rT = G.meshRotation(10, 75, TH.f, rF);                // third
    var rC = G.meshRotation(10, 80, TH.t, rT);                // centre
    var rB = G.meshRotation(10, 80, TH.c, rC);                // barrel
    anim.fourth.setAttribute('transform', 'rotate(' + (rF * DEG).toFixed(3) + ')');
    anim.third.setAttribute('transform', 'rotate(' + (rT * DEG).toFixed(3) + ')');
    anim.centre.setAttribute('transform', 'rotate(' + (rC * DEG).toFixed(3) + ')');
    anim.drum.setAttribute('transform', 'rotate(' + (rB * DEG).toFixed(3) + ')');
    anim.escWheel.setAttribute('transform', 'rotate(' + st.escapeDeg.toFixed(3) + ')');
    anim.pallet.setAttribute('transform', 'rotate(' + st.palletDeg.toFixed(3) + ' 0 ' + r2(M.PV.y) + ')');
    anim.balance.setAttribute('transform', 'rotate(' + st.balanceDeg.toFixed(2) + ')');
    if (Math.abs(st.balanceDeg - lastSpring) > 1 || f.dt === 0) {
      lastSpring = st.balanceDeg;
      anim.spring.setAttribute('d', G.hairspringPath({ inner: 26, outer: 132, turns: 12, twist: st.balanceDeg * RAD * 0.9, breguet: true, samples: 28 }));
    }
    // rotor: slow wrist-driven swing
    var sw = -8 + 26 * Math.sin(t * 0.55) + 9 * Math.sin(t * 1.37 + 1);
    anim.rotor.setAttribute('transform', 'rotate(' + sw.toFixed(2) + ')');
    anim.ratchet.setAttribute('transform', 'rotate(' + (sw * 0.02 + rB * DEG * 0).toFixed(3) + ')');
  }, { el: stage, time: 4.2 });

  /* ======================================================================
   * 4. EXPLORER — scroll (sticky) on large screens, tap stepper on small
   * ==================================================================== */
  var explorer = $('[data-coeur-explorer]');
  var track = $('.coeur-track');
  var steps = $$('[data-coeur-step]');
  var tabs = $$('[data-coeur-goto]');
  var prevBtn = $('[data-coeur-prev]'), nextBtn = $('[data-coeur-next]');
  var liveEl = $('[data-coeur-live]'), curEl = $('[data-coeur-current]'), fillEl = $('[data-coeur-fill]'), hintEl = $('[data-coeur-hint]');
  var leaders = $('[data-coeur-leaders]'), labelsBox = $('[data-coeur-labels]'), hotsBox = $('[data-coeur-hots]');
  var NSTEP = 7;
  var mqScroll = window.matchMedia('(min-width: 1000px) and (min-height: 620px)');
  var mode = mqScroll.matches ? 'scroll' : 'stepper';
  var cur = { x: 0, act: LAYERS.map(function () { return 1; }) };
  var tgt = { x: 0, act: LAYERS.map(function () { return 1; }) };
  var step = 0;

  // leader lines + labels
  var leadEls = {};
  Object.keys(STEP_ANCHOR).forEach(function (k) {
    var path = E('path', { class: 'coeur-leader' });
    var dot = E('circle', { class: 'coeur-leader-dot', r: 3.2 });
    leaders.appendChild(path); leaders.appendChild(dot);
    var lab = document.createElement('div');
    lab.className = 'coeur-label';
    lab.innerHTML = '<span class="num">0' + k + '</span><span class="coeur-label-name"></span>';
    lab.lastChild.textContent = STEP_NAMES[k];
    labelsBox.appendChild(lab);
    leadEls[k] = { path: path, dot: dot, lab: lab, layer: LAYERS.filter(function (L) { return L.id === STEP_ANCHOR[k][0]; })[0] };
  });
  // hotspots
  var hotId = 0, openHot = null;
  LAYERS.forEach(function (L) {
    L.hots.forEach(function (h) {
      var id = 'coeur-hot-' + (++hotId);
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'coeur-hot';
      b.setAttribute('aria-expanded', 'false');
      b.setAttribute('aria-controls', id);
      b.innerHTML = '<span class="visually-hidden"></span>';
      b.firstChild.textContent = h.title;
      var bub = document.createElement('div');
      bub.className = 'coeur-bubble';
      bub.id = id;
      bub.setAttribute('role', 'tooltip');
      bub.innerHTML = '<span class="coeur-bubble-in"><strong></strong><span></span></span>';
      bub.firstChild.firstChild.textContent = h.title;
      bub.firstChild.lastChild.textContent = h.text;
      b.setAttribute('aria-describedby', id);
      hotsBox.appendChild(b); hotsBox.appendChild(bub);
      h.btn = b; h.bub = bub; h.layer = L;
      b.addEventListener('click', function () {
        var open = b.getAttribute('aria-expanded') !== 'true';
        closeHots();
        if (open) { b.setAttribute('aria-expanded', 'true'); bub.classList.add('is-open'); openHot = h; }
      });
      b.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeHots(); } });
    });
  });
  function closeHots() {
    LAYERS.forEach(function (L) { L.hots.forEach(function (h) { h.btn.setAttribute('aria-expanded', 'false'); h.bub.classList.remove('is-open'); }); });
    openHot = null;
  }
  document.addEventListener('click', function (e) { if (openHot && !e.target.closest('.coeur-hot')) closeHots(); });

  var geo = { w: 0, h: 0, size: 0 };
  function measure() {
    var r = stage.getBoundingClientRect();
    geo.w = r.width; geo.h = r.height; geo.size = stack.offsetWidth || 300;
    leaders.setAttribute('viewBox', '0 0 ' + r2(geo.w) + ' ' + r2(geo.h));
  }

  function apply() {
    var x = cur.x, size = geo.size;
    var gap = size * (mode === 'scroll' ? 0.125 : 0.105), gapMin = size * 0.014;
    var g = gapMin + (gap - gapMin) * x;
    var tilt = lerp(32, 58, x), spin = lerp(-14, -36, x);
    stack.style.transform = 'rotateX(' + tilt.toFixed(2) + 'deg) rotateZ(' + spin.toFixed(2) + 'deg) translateZ(' + (-(LAYERS.length - 1) / 2 * g).toFixed(1) + 'px)';
    LAYERS.forEach(function (L, i) {
      var a = cur.act[i];
      var z = i * g + a * x * gap * 0.22;
      L.el.style.transform = 'translateZ(' + z.toFixed(1) + 'px)';
      L.el.style.opacity = (1 - x * (1 - a) * 0.7).toFixed(3);
      L.el.style.setProperty('--coeur-act', (a * x).toFixed(3));
    });
    updateLeaders();
  }
  function rel(el) {
    var r = el.getBoundingClientRect(), s = stage.getBoundingClientRect();
    return { x: r.left + r.width / 2 - s.left, y: r.top + r.height / 2 - s.top };
  }
  function updateLeaders() {
    var x = cur.x, showLabels = mode === 'scroll' && geo.w > 640;
    explorer.classList.toggle('has-labels', showLabels);
    var labW = 172, labX = geo.w - labW;
    var items = Object.keys(leadEls).map(function (k) { var o = leadEls[k]; o.k = +k; o.p = rel(o.layer.lead); return o; });
    items.sort(function (a, b) { return b.k - a.k; });
    var minGap = 40, prevY = -1e9;
    items.forEach(function (o) { o.ly = Math.max(o.p.y, prevY + minGap); prevY = o.ly; });
    var over = prevY - (geo.h - 24);
    if (over > 0) items.forEach(function (o) { o.ly -= over; });
    items.forEach(function (o) {
      var on = step === o.k;
      var vis = showLabels ? clamp((x - 0.45) / 0.4, 0, 1) : (on ? clamp((x - 0.6) / 0.3, 0, 1) : 0);
      o.lab.style.opacity = showLabels ? vis.toFixed(3) : '0';
      o.lab.classList.toggle('is-on', on);
      o.lab.style.transform = 'translate(' + r2(labX) + 'px,' + r2(o.ly - 14) + 'px)';
      if (showLabels) {
        o.path.setAttribute('d', 'M' + r2(o.p.x) + ' ' + r2(o.p.y) + 'L' + r2(labX - 34) + ' ' + r2(o.ly) + 'L' + r2(labX - 6) + ' ' + r2(o.ly));
      } else o.path.setAttribute('d', '');
      o.path.style.opacity = (vis * (on ? 1 : 0.45)).toFixed(3);
      o.path.classList.toggle('is-on', on);
      o.dot.setAttribute('cx', r2(o.p.x)); o.dot.setAttribute('cy', r2(o.p.y));
      o.dot.style.opacity = (vis * (on ? 1 : 0.55)).toFixed(3);
      o.dot.classList.toggle('is-on', on);
    });
    // hotspots of the active step (spread apart so every target stays ≥ 44 px)
    var hv = clamp((x - 0.75) / 0.25, 0, 1), shown = [];
    LAYERS.forEach(function (L) {
      var on = L.step === step && hv > 0.05;
      L.hots.forEach(function (h) {
        if (!on) { if (!h.btn.hidden) { h.btn.hidden = true; h.bub.classList.remove('is-open'); h.btn.setAttribute('aria-expanded', 'false'); } return; }
        h.btn.hidden = false;
        h.p = rel(h.anchor);
        shown.push(h);
      });
    });
    for (var it = 0; it < 4; it++) {
      for (var i = 0; i < shown.length; i++) for (var j = i + 1; j < shown.length; j++) {
        var A = shown[i].p, B = shown[j].p, dx = B.x - A.x, dy = B.y - A.y, dl = Math.hypot(dx, dy) || 0.01, need = 46;
        if (dl < need) { var push = (need - dl) / 2; dx /= dl; dy /= dl; if (dl < 0.02) { dx = 1; dy = 0; } A.x -= dx * push; A.y -= dy * push; B.x += dx * push; B.y += dy * push; }
      }
    }
    shown.forEach(function (h) {
      var p = h.p;
      h.btn.style.transform = 'translate(' + r2(p.x) + 'px,' + r2(p.y) + 'px)';
      h.bub.style.transform = 'translate(' + r2(clamp(p.x, 110, geo.w - 110)) + 'px,' + r2(p.y) + 'px)';
      h.bub.classList.toggle('is-below', p.y < 110);
      h.btn.style.opacity = hv.toFixed(3);
    });
  }

  var layoutH = G.ticker.add(function (f) {
    var k = f.dt === 0 ? 1 : 1 - Math.exp(-f.dt * 9);
    var done = true;
    cur.x += (tgt.x - cur.x) * k; if (Math.abs(tgt.x - cur.x) > 0.001) done = false; else cur.x = tgt.x;
    for (var i = 0; i < cur.act.length; i++) {
      cur.act[i] += (tgt.act[i] - cur.act[i]) * k;
      if (Math.abs(tgt.act[i] - cur.act[i]) > 0.002) done = false; else cur.act[i] = tgt.act[i];
    }
    apply();
    if (done) { f.handle.pause(); explorer.classList.remove('is-moving'); }
  }, { el: stage, autoplay: false });

  function setTargets(x, s) {
    tgt.x = x;
    LAYERS.forEach(function (L, i) { tgt.act[i] = s === 0 ? 1 : (L.step === s ? 1 : 0); });
    if (G.reducedMotion) { cur.x = tgt.x; cur.act = tgt.act.slice(); apply(); }
    else { explorer.classList.add('is-moving'); layoutH.play(); }
  }

  function showStep(s, announce) {
    if (s === step && steps[s].classList.contains('is-active')) return;
    step = s;
    steps.forEach(function (el, i) { var on = i === s; el.classList.toggle('is-active', on); el.hidden = !on; });
    tabs.forEach(function (b, i) { if (i === s) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    curEl.textContent = '0' + s;
    fillEl.style.transform = 'scaleX(' + (s / 6).toFixed(3) + ')';
    var ae = document.activeElement;
    if (ae === prevBtn && s === 0) nextBtn.focus({ preventScroll: true });
    else if (ae === nextBtn && s === NSTEP - 1) prevBtn.focus({ preventScroll: true });
    prevBtn.disabled = s === 0; nextBtn.disabled = s === NSTEP - 1;
    closeHots();
    if (announce !== false) {
      var art = steps[s];
      liveEl.textContent = (s ? 'Sous-ensemble ' + s + ' sur 6 : ' : '') + art.getAttribute('data-coeur-name') + '. ' + $('.coeur-step-role', art).textContent;
    }
  }

  function scrollInfo() {
    var r = track.getBoundingClientRect();
    var span = r.height - window.innerHeight;
    return { top: r.top, span: span, abs: window.pageYOffset + r.top };
  }
  function onScroll() {
    if (mode !== 'scroll') return;
    var si = scrollInfo();
    var p = clamp(-si.top / Math.max(1, si.span), 0, 1);
    var f = p * NSTEP;
    var s = Math.min(NSTEP - 1, Math.floor(f));
    // assembled while entering step 00, opens up gradually across 00 → 01
    var x = clamp((f - 0.25) / 1.0, 0, 1);
    if (jumpTo !== null) {
      if (s === jumpTo) { jumpTo = null; clearTimeout(jumpTimer); }
      else if (Math.abs(window.pageYOffset - jumpY) < 4) { jumpTo = null; clearTimeout(jumpTimer); }
      else { setTargets(jumpTo === 0 ? x : Math.max(x, 0.6), jumpTo); return; }
    }
    if (s !== step) showStep(s);
    setTargets(x, s);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  // while a tab/arrow click scrolls smoothly to its step, don't show/announce every step passed on the way
  var jumpTo = null, jumpY = 0, jumpTimer = 0;
  function endJump() { clearTimeout(jumpTimer); jumpTo = null; onScroll(); }
  window.addEventListener('scrollend', function () {
    if (jumpTo !== null && Math.abs(window.pageYOffset - jumpY) < 4) endJump();
  });
  function headerH() { var h = document.querySelector('.site-header'); return h ? h.getBoundingClientRect().height : 58; }

  function go(s) {
    s = clamp(s, 0, NSTEP - 1);
    if (mode === 'scroll') {
      var si = scrollInfo();
      var f = s === 0 ? 0.12 : s + 0.5;
      showStep(s);
      jumpY = Math.round(si.abs + (f / NSTEP) * si.span);
      if (!G.reducedMotion) { jumpTo = s; clearTimeout(jumpTimer); jumpTimer = setTimeout(endJump, 1600); }
      window.scrollTo({ top: jumpY, behavior: G.reducedMotion ? 'auto' : 'smooth' });
    } else {
      showStep(s);
      setTargets(s === 0 ? 0 : 1, s);
      // keep the calibre in view on phones: the stage sits above the step panel
      var r = stage.getBoundingClientRect(), hh = headerH();
      if (r.top < hh - 1 || r.bottom > window.innerHeight + 1) {
        window.scrollBy({ top: Math.round(r.top - hh - 8), behavior: G.reducedMotion ? 'auto' : 'smooth' });
      }
    }
  }
  prevBtn.addEventListener('click', function () { go(step - 1); });
  nextBtn.addEventListener('click', function () { go(step + 1); });
  tabs.forEach(function (b) { b.addEventListener('click', function () { go(+b.getAttribute('data-coeur-goto')); }); });
  explorer.addEventListener('keydown', function (e) {
    if (e.target.closest('.coeur-hot')) return;
    if (!e.target.closest('.coeur-nav')) return;
    var d = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 0;
    if (e.key === 'Home') d = -step; else if (e.key === 'End') d = NSTEP - 1 - step;
    if (!d) return;
    e.preventDefault();
    var onTab = e.target.closest('.coeur-tab');
    go(step + d);
    if (onTab) tabs[step].focus({ preventScroll: true });
  });

  function setMode() {
    mode = mqScroll.matches ? 'scroll' : 'stepper';
    explorer.classList.toggle('is-scroll', mode === 'scroll');
    explorer.classList.toggle('is-stepper', mode === 'stepper');
    if (hintEl) hintEl.textContent = mode === 'scroll' ? 'Défilez, ou utilisez les flèches ← → du clavier.' : 'Touchez les numéros ou les flèches pour démonter le calibre.';
    measure();
    if (mode === 'scroll') onScroll();
    else setTargets(step === 0 ? 0 : 1, step);
  }
  if (mqScroll.addEventListener) mqScroll.addEventListener('change', setMode); else if (mqScroll.addListener) mqScroll.addListener(setMode);
  if ('ResizeObserver' in window) new ResizeObserver(function () { measure(); if (G.reducedMotion || !layoutH.playing) apply(); }).observe(stage);
  else window.addEventListener('resize', function () { measure(); apply(); });

  steps.forEach(function (el, i) { el.hidden = i !== 0; });
  explorer.classList.add('is-ready');
  showStep(0, false);
  setMode();
  cur.x = tgt.x; cur.act = tgt.act.slice();
  apply();

  window.BulrogCoeur = { model: M, loupe: loupe, go: go, get step() { return step; }, get mode() { return mode; } };
})();
