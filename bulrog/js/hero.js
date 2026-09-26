/*!
 * BULROG — hero.js (owner: builder A, section #hero)
 * Draws the living Calibre BR-01 (skeletonised, dial side) as stacked SVG layers:
 *   rotor · plate (perlage) · going train · bridges (côtes de Genève, anglage, blued screws, jewels)
 *   · escapement & balance (ancre suisse, balancier-spiral 4 Hz) · chapter ring · hands (real time).
 * All motion comes from ONE time source (BulrogGears.escapement(t) → train by exact meshing),
 * driven by the shared ticker (pauses offscreen / hidden tab / reduced motion).
 * Per frame: only transform attributes change (the hairspring uses a path cache).
 * Extras: assembling intro, pointer tilt with 3D layer depth, scroll "explode" + rotor winding,
 * pause / slow-motion controls, live beat counter.
 */
(function () {
  'use strict';

  var root = document.getElementById('hero');
  if (!root) return;
  var G = window.BulrogGears;
  if (!G) return;
  G.ensureDefs();

  var E = G.el, RAD = G.RAD, DEG = G.DEG, TAU = G.TAU, U = G.util;
  var r2 = U.round;

  function layer(name) { return root.querySelector('[data-hero-layer="' + name + '"]'); }
  var L = {
    rotor: layer('rotor'), plate: layer('plate'), train: layer('train'), bridges: layer('bridges'),
    escape: layer('escape'), balance: layer('balance'), cock: layer('cock'), dial: layer('dial'), hands: layer('hands'), notes: layer('notes')
  };
  if (!L.plate || !L.train) return;
  var cal = root.querySelector('.hero-cal');
  var stack = root.querySelector('[data-hero-stack]');

  /* ------------------------------------------------------------------ *
   * Geometry — "movement frame" (train()-native, caseback orientation).
   * The whole movement is shown mirrored + rotated (dial-side skeleton view)
   * so that the centre wheel turns clockwise like the hands.
   * ------------------------------------------------------------------ */
  var BETA = 12;                                    // rotation of the movement frame (deg)
  var MOV = 'scale(-1 1) rotate(' + BETA + ')';
  var RM = 432;                                     // mainplate radius

  function pol(r, aDeg, o) { var a = aDeg * RAD; return [(o ? o[0] : 0) + r * Math.cos(a), (o ? o[1] : 0) + r * Math.sin(a)]; }
  function ang(a, b) { return Math.atan2(b[1] - a[1], b[0] - a[0]); }       // radians, a → b
  function rotP(p, aDeg) { var a = aDeg * RAD, c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; }
  function toVisual(p) { var q = rotP(p, BETA); return [-q[0], q[1]]; }
  function fromVisualAngle(aDeg) { return 180 - aDeg - BETA; }              // visual angle → movement-frame angle
  function tr(p) { return 'translate(' + r2(p[0]) + ' ' + r2(p[1]) + ')'; }

  // modules (mm-like units) chosen so each wheel/pinion pair shares a module
  var mB = 3.4, mC = 3, m3 = 2.6, m4 = 1.7;
  var CW = G.CALIBRE.wheels;              // exact BR-01 tooth counts (80/10 · 80/10 · 75/10 · 96/10 · 15/6)
  var T = { barrel: CW.barrel.teeth, centre: CW.centre.teeth, cp: CW.centre.pinion, third: CW.third.teeth, tp: CW.third.pinion,
    fourth: CW.fourth.teeth, fp: CW.fourth.pinion, ep: CW.escape.pinion };
  var P = {};
  P.centre = [0, 0];
  P.barrel = pol(mB * (T.barrel + T.cp) / 2, 215);
  P.third = pol(mC * (T.centre + T.tp) / 2, -25);
  P.fourth = pol(m3 * (T.third + T.fp) / 2, 30, P.third);
  P.escape = pol(m4 * (T.fourth + T.ep) / 2, 80, P.fourth);
  var PHI = 120;                                    // direction escape → balance (deg)
  var ALPHA = PHI + 90;                             // rotation of the escapement frame
  var ER = 58;                                      // escape-wheel tip radius
  var ESC = G.escapementLayout(ER, { leverLength: ER * 1.9, rollerRadius: ER * 0.51 });   // long lever: fork visible beside the balance
  var ESC_OPT = { swingDeg: ESC.swingDeg };
  P.pallet = [P.escape[0] + rotP([ESC.pallet.x, ESC.pallet.y], ALPHA)[0], P.escape[1] + rotP([ESC.pallet.x, ESC.pallet.y], ALPHA)[1]];
  P.balance = [P.escape[0] + rotP([ESC.balance.x, ESC.balance.y], ALPHA)[0], P.escape[1] + rotP([ESC.balance.x, ESC.balance.y], ALPHA)[1]];
  var BAL_R = 98;
  // automatic winding: ratchet on the barrel + two winding wheels
  var mR = 3.2;
  P.w1 = pol(mR * (60 + 24) / 2, 112, P.barrel);
  P.w2 = pol(mR * (24 + 16) / 2, 96, P.w1);

  // meshing angles (rad), A drives B
  var TH = {
    bc: ang(P.barrel, P.centre), c3: ang(P.centre, P.third), t4: ang(P.third, P.fourth), fe: ang(P.fourth, P.escape),
    w2w1: ang(P.w2, P.w1), w1r: ang(P.w1, P.barrel)
  };
  // rotation of driver A knowing the rotation of driven B (inverse of meshRotation)
  function invMesh(nA, nB, theta, rotB) { return theta + (theta + Math.PI + Math.PI / nB - rotB) * nB / nA; }

  /* ------------------------------------------------------------------ *
   * Shared paint servers (prefixed hero-), in the plate layer
   * ------------------------------------------------------------------ */
  function stops(g, list) { list.forEach(function (s) { g.appendChild(E('stop', { offset: s[0], 'stop-color': s[1], 'stop-opacity': s[2] != null ? s[2] : null })); }); return g; }
  var defs = E('defs');
  function lin(id, list, a) { a = a || {}; var g = E('linearGradient', Object.assign({ id: id, x1: '0', y1: '0', x2: '1', y2: '1' }, a)); defs.appendChild(stops(g, list)); }
  function rad(id, list, a) { a = a || {}; var g = E('radialGradient', Object.assign({ id: id, cx: '0.42', cy: '0.38', r: '0.75' }, a)); defs.appendChild(stops(g, list)); }
  var US = { gradientUnits: 'userSpaceOnUse' };
  rad('hero-plate', [['0', '#4b4f56'], ['0.55', '#2b2e33'], ['1', '#15171a']], { cx: '0.4', cy: '0.35', r: '0.8' });
  lin('hero-rhod', [['0', '#d9dee3'], ['0.22', '#8f98a2'], ['0.42', '#c9d0d6'], ['0.6', '#6c757f'], ['0.8', '#b8c0c8'], ['1', '#7b848e']], Object.assign({ x1: '-460', y1: '-460', x2: '460', y2: '460' }, US));
  lin('hero-bevel', [['0', '#ffffff'], ['0.12', '#6f7882'], ['0.3', '#fbfcfd'], ['0.46', '#4d545c'], ['0.62', '#ffffff'], ['0.8', '#6a737c'], ['1', '#f4f6f8']], Object.assign({ x1: '-460', y1: '460', x2: '460', y2: '-460' }, US));
  lin('hero-cube', [['0', '#f6dcaa'], ['0.35', '#cf9f5e'], ['0.65', '#8e602d'], ['1', '#e6bd7e']]);
  lin('hero-gold', [['0', '#f5e2ae'], ['0.3', '#d4b06a'], ['0.55', '#9a7634'], ['0.8', '#e2c283'], ['1', '#8a6a2f']]);
  lin('hero-rotor', [['0', '#ffe4cc'], ['0.3', '#e7ad88'], ['0.55', '#b8765a'], ['0.8', '#f2c4a5'], ['1', '#a86a4d']]);
  rad('hero-drum', [['0', '#3d434a'], ['0.7', '#1e2226'], ['1', '#111316']], { cx: '0.5', cy: '0.5', r: '0.5' });
  lin('hero-ring', [['0', '#1c1a17'], ['0.5', '#0e0d0c'], ['1', '#171512']]);
  lin('hero-case', [['0', '#fbfcfd'], ['0.18', '#9aa3ad'], ['0.36', '#3b4148'], ['0.52', '#e4e8ec'], ['0.7', '#5c646d'], ['0.86', '#cfd5db'], ['1', '#50575f']], Object.assign({ x1: '-520', y1: '-520', x2: '520', y2: '520' }, US));
  lin('hero-blue', [['0', '#6f8fe8'], ['0.5', '#2d4fb3'], ['1', '#13265f']]);
  // côtes de Genève — wide soft bands
  var cotesBand = E('linearGradient', { id: 'hero-cotes-band', x1: '0', y1: '0', x2: '1', y2: '0' });
  defs.appendChild(stops(cotesBand, [['0', '#000', '0.22'], ['0.18', '#fff', '0'], ['0.48', '#fff', '0.34'], ['0.56', '#fff', '0.1'], ['0.86', '#000', '0.12'], ['1', '#000', '0.3']]));
  var cotes = E('pattern', { id: 'hero-cotes', patternUnits: 'userSpaceOnUse', width: '38', height: '38', patternTransform: 'rotate(' + (BETA + 30) + ')' });
  cotes.appendChild(E('rect', { width: '38', height: '38', fill: 'url(#hero-cotes-band)' }));
  defs.appendChild(cotes);
  // perlage (circular graining) — overlapping grains, staggered rows
  var perle = E('radialGradient', { id: 'hero-perle', cx: '0.42', cy: '0.4', r: '0.6' });
  defs.appendChild(stops(perle, [['0', '#fff', '0.26'], ['0.45', '#fff', '0.07'], ['0.78', '#000', '0.05'], ['0.92', '#000', '0.32'], ['1', '#fff', '0.12']]));
  var perl = E('pattern', { id: 'hero-perlage', patternUnits: 'userSpaceOnUse', width: '44', height: '38', patternTransform: 'rotate(8)' });
  [[0, 0], [44, 0], [22, 19], [0, 38], [44, 38], [22, -19], [22, 57]].forEach(function (c) { perl.appendChild(E('circle', { cx: c[0], cy: c[1], r: '22.5', fill: 'url(#hero-perle)' })); });
  defs.appendChild(perl);
  // côtes on the rotor (finer)
  var cotesR = E('pattern', { id: 'hero-cotes-r', patternUnits: 'userSpaceOnUse', width: '22', height: '22', patternTransform: 'rotate(10)' });
  cotesR.appendChild(E('rect', { width: '22', height: '22', fill: 'url(#hero-cotes-band)' }));
  defs.appendChild(cotesR);
  // filters (used on STATIC layers only)
  var fSh = E('filter', { id: 'hero-shadow', x: '-20%', y: '-20%', width: '140%', height: '140%' });
  fSh.appendChild(E('feDropShadow', { dx: '0', dy: '0', stdDeviation: '5', 'flood-color': '#000', 'flood-opacity': '0.75' }));
  defs.appendChild(fSh);
  var fBl = E('filter', { id: 'hero-blur', x: '-30%', y: '-30%', width: '160%', height: '160%' });
  fBl.appendChild(E('feGaussianBlur', { stdDeviation: '9' }));
  defs.appendChild(fBl);
  var fHs = E('filter', { id: 'hero-hand-shadow', x: '-30%', y: '-30%', width: '160%', height: '160%' });
  fHs.appendChild(E('feDropShadow', { dx: '4', dy: '9', stdDeviation: '5', 'flood-color': '#000', 'flood-opacity': '0.6' }));
  defs.appendChild(fHs);
  L.plate.appendChild(defs);

  /* ------------------------------------------------------------------ *
   * Helpers
   * ------------------------------------------------------------------ */
  function pstr(p) { return r2(p[0]) + ' ' + r2(p[1]); }
  function smooth(pts) {
    var d = 'M' + pstr(pts[0]);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      var c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      var c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += 'C' + pstr(c1) + ' ' + pstr(c2) + ' ' + pstr(p2);
    }
    return d;
  }
  // Catmull-Rom sampling → tapered outline with round caps (bridges, plate slots)
  function sampleCurve(pts, per) {
    var out = [];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      for (var k = (i ? 1 : 0); k <= per; k++) {
        var t = k / per, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(function (j) {
          return 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3);
        }));
      }
    }
    return out;
  }
  function taper(pts, w0, w1) {
    var c = sampleCurve(pts, 14), n = c.length, left = [], right = [];
    for (var i = 0; i < n; i++) {
      var a = c[Math.max(0, i - 1)], b = c[Math.min(n - 1, i + 1)];
      var tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
      var nx = -ty / l, ny = tx / l;
      var u = i / (n - 1), w = U.lerp(w0, w1, u * u * (3 - 2 * u)) / 2;
      left.push([c[i][0] + nx * w, c[i][1] + ny * w]);
      right.push([c[i][0] - nx * w, c[i][1] - ny * w]);
    }
    var d = 'M' + left.map(pstr).join('L');
    d += 'A' + r2(w1 / 2) + ' ' + r2(w1 / 2) + ' 0 0 0 ' + pstr(right[n - 1]);
    d += 'L' + right.reverse().map(pstr).join('L');
    d += 'A' + r2(w0 / 2) + ' ' + r2(w0 / 2) + ' 0 0 0 ' + pstr(left[0]) + 'Z';
    return d;
  }
  function arcPts(r, a1, a2) { var o = [], n = Math.max(3, Math.round(Math.abs(a2 - a1) / 6)); for (var i = 0; i <= n; i++) o.push(pol(r, U.lerp(a1, a2, i / n))); return o; }
  function sector(r1, r2_, a1, a2) {
    var p1 = pol(r2_, a1), p2 = pol(r2_, a2), p3 = pol(r1, a2), p4 = pol(r1, a1);
    var large = Math.abs(a2 - a1) > 180 ? 1 : 0;
    return 'M' + pstr(p1) + 'A' + r2_ + ' ' + r2_ + ' 0 ' + large + ' 1 ' + pstr(p2) +
      'L' + pstr(p3) + 'A' + r1 + ' ' + r1 + ' 0 ' + large + ' 0 ' + pstr(p4) + 'Z';
  }
  function g(attrs, kids) { return E('g', attrs, kids); }
  function path(d, fill, extra) { return E('path', Object.assign({ d: d, fill: fill, 'fill-rule': 'evenodd' }, extra || {})); }
  // wheel = outer group (fixed position) + inner rotating group
  function wheelGroup(parent, pos) {
    var rotG = g({});
    parent.appendChild(g({ transform: tr(pos) }, [rotG]));
    return rotG;
  }
  function sunray(n, rIn, rOut, op) {         // "soleillage" / colimaçonnage hint (thin radial lines)
    var d = '';
    for (var i = 0; i < n; i++) { var a = (360 / n) * i; d += 'M' + pstr(pol(rIn, a)) + 'L' + pstr(pol(rOut, a)); }
    return E('path', { d: d, stroke: '#fff', 'stroke-opacity': op, 'stroke-width': '0.6', fill: 'none' });
  }

  /* ------------------------------------------------------------------ *
   * LAYER 0 — oscillating weight (rotor), behind the openworked plate
   * ------------------------------------------------------------------ */
  var rotorRot = g({});
  (function () {
    var mov = g({ transform: MOV });
    var rr = 424, rh = 64;
    var body = 'M' + pstr(pol(rr, -90)) + 'A' + rr + ' ' + rr + ' 0 0 1 ' + pstr(pol(rr, 90)) +
      'L' + pstr(pol(rh, 90)) + 'A' + rh + ' ' + rh + ' 0 0 0 ' + pstr(pol(rh, -90)) + 'Z';
    var win = sector(170, 330, -62, -14) + sector(170, 330, 14, 62);
    rotorRot.appendChild(path(body + win, 'url(#hero-rotor)'));
    rotorRot.appendChild(path(body + win, 'url(#hero-cotes-r)', { opacity: '0.8' }));
    rotorRot.appendChild(path(G.ringPath(rr, 372), '#000', { opacity: '0.18' }));
    rotorRot.appendChild(E('circle', { r: rh + 8, fill: 'url(#hero-rotor)' }));
    rotorRot.appendChild(E('circle', { r: 28, fill: 'url(#bg-steel-radial)' }));
    mov.appendChild(rotorRot);
    L.rotor.appendChild(mov);
  })();

  /* ------------------------------------------------------------------ *
   * LAYER 1 — mainplate (perlage, skeleton windows) + contact shadows
   * ------------------------------------------------------------------ */
  (function () {
    var mov = g({ transform: MOV });
    var windows =
      taper(arcPts(352, 128, 154), 62, 62) +
      taper(arcPts(356, 262, 288), 58, 58) +
      taper(arcPts(364, 86, 108), 46, 46) +
      taper(arcPts(372, 346, 356), 34, 34) +
      G.circlePath(78, P.balance[0], P.balance[1]);
    var plateD = G.circlePath(RM) + windows;
    mov.appendChild(E('circle', { r: RM + 6, fill: '#050505', opacity: '0.8', filter: 'url(#hero-blur)' }));
    mov.appendChild(path(plateD, 'url(#hero-plate)'));
    mov.appendChild(path(plateD, 'url(#hero-perlage)'));
    // polished (anglé) edges of the openings + plate rim
    mov.appendChild(E('path', { d: windows, fill: 'none', stroke: 'url(#hero-bevel)', 'stroke-width': '6', 'stroke-linejoin': 'round', opacity: '0.9' }));
    mov.appendChild(E('circle', { r: RM - 1.5, fill: 'none', stroke: 'url(#hero-bevel)', 'stroke-width': '3', opacity: '0.7' }));
    // contact shadows under the moving parts (static → costs nothing per frame)
    var sh = g({ filter: 'url(#hero-blur)', opacity: '0.85' });
    [[P.barrel, 140], [P.centre, 122], [P.third, 99], [P.fourth, 84], [P.escape, 50], [P.balance, 100], [P.w1, 42], [P.w2, 29]].forEach(function (c) {
      sh.appendChild(E('circle', { cx: r2(c[0][0] + 4), cy: r2(c[0][1] + 7), r: c[1], fill: '#000', opacity: '0.55' }));
    });
    mov.appendChild(sh);
    L.plate.appendChild(mov);
  })();

  /* ------------------------------------------------------------------ *
   * LAYER 2 — going train (barrel, centre, third, fourth wheels + pinions)
   * ------------------------------------------------------------------ */
  var W = {};
  (function () {
    var mov = g({ transform: MOV });
    // Barrel: open drum showing the mainspring
    W.barrel = wheelGroup(mov, P.barrel);
    var bG = G.gear({ teeth: T.barrel, module: mB, spokes: 0 });
    var drumIn = bG.rootRadius - 9;
    W.barrel.appendChild(E('circle', { r: r2(drumIn), fill: 'url(#hero-drum)' }));
    var spring = '';
    for (var i = 0; i <= 420; i++) {
      var u = i / 420, a = u * 7.5 * TAU, rr = U.lerp(26, drumIn - 6, Math.pow(u, 0.85));
      var q = [rr * Math.cos(a), rr * Math.sin(a)];
      spring += (i ? 'L' : 'M') + pstr(q);
    }
    W.barrel.appendChild(E('path', { d: spring, fill: 'none', stroke: '#8e97a1', 'stroke-width': '2.2', opacity: '0.85' }));
    W.barrel.appendChild(E('path', { d: spring, fill: 'none', stroke: '#e8ecf0', 'stroke-width': '0.6', opacity: '0.5', transform: 'translate(-0.8 -0.8)' }));
    W.barrel.appendChild(path(bG.d + G.circlePath(drumIn), 'url(#hero-gold)'));
    W.barrel.appendChild(sunray(80, drumIn + 1, bG.rootRadius - 1, '0.18'));
    W.barrel.appendChild(E('circle', { r: 26, fill: 'url(#bg-steel)' }));

    function arbor(pos, wheelOpt, pinOpt, key) {
      var rg = wheelGroup(mov, pos);
      var wg = G.gear(wheelOpt);
      rg.appendChild(path(wg.d, 'url(#hero-gold)', { stroke: 'rgba(60,40,10,.45)', 'stroke-width': '0.6' }));
      var hub = (wheelOpt.hubRadius || wg.pitchRadius * 0.22);
      rg.appendChild(E('circle', { r: r2(hub * 0.92), fill: 'url(#bg-gold-radial)' }));
      var pg = G.pinion(pinOpt);
      rg.appendChild(path(pg.d, 'url(#bg-steel)', { stroke: 'rgba(0,0,0,.4)', 'stroke-width': '0.5' }));
      rg.appendChild(E('circle', { r: r2(pg.pitchRadius * 0.42), fill: 'url(#bg-steel-radial)' }));
      W[key] = rg;
    }
    arbor(P.centre, { teeth: T.centre, module: mC, spokes: 5, curve: 0.5, hole: 0, spokeWidth: 9 }, { teeth: T.cp, module: mB }, 'centre');
    arbor(P.third, { teeth: T.third, module: m3, spokes: 5, curve: 0.45, spokeWidth: 7.5 }, { teeth: T.tp, module: mC }, 'third');
    arbor(P.fourth, { teeth: T.fourth, module: m4, spokes: 4, curve: 0.55, spokeWidth: 6.5 }, { teeth: T.fp, module: m3 }, 'fourth');
    // escape pinion (its wheel lives on the escapement layer)
    W.escPinion = wheelGroup(mov, P.escape);
    W.escPinion.appendChild(path(G.pinion({ teeth: T.ep, module: m4 }).d, 'url(#bg-steel)'));
    L.train.appendChild(mov);
  })();

  /* ------------------------------------------------------------------ *
   * LAYER 3 — bridges (côtes de Genève, polished bevels), jewels, blued screws
   * ------------------------------------------------------------------ */
  var screwSeed = 0;
  function screwAt(parent, p, r) { screwSeed += 47; parent.appendChild(G.screw({ x: p[0], y: p[1], r: r || 9, slot: (screwSeed % 180) - 90 })); }
  function jewelAt(parent, p, r) { parent.appendChild(G.jewel({ x: p[0], y: p[1], r: r || 6.5 })); }
  // arms: [{ pts, w0, w1 }], bosses: [[pos, r]] — polished bevel (anglage), rhodium flat, côtes de Genève
  function drawBridge(parent, arms, bosses) {
    var grp = g({ filter: 'url(#hero-shadow)' });
    var outline = arms.map(function (a) { return taper(a.pts, a.w0, a.w1); }).join('') +
      bosses.map(function (b) { return G.circlePath(b[1], b[0][0], b[0][1]); }).join('');
    var shapes = arms.map(function (a) { return taper(a.pts, a.w0, a.w1); }).concat(bosses.map(function (b) { return G.circlePath(b[1], b[0][0], b[0][1]); }));
    // 1. bevel: outline stroked wide (outer half stays visible around the flat)
    shapes.forEach(function (d) { grp.appendChild(E('path', { d: d, fill: 'url(#hero-bevel)', stroke: 'url(#hero-bevel)', 'stroke-width': '11', 'stroke-linejoin': 'round' })); });
    // 2. flat: rhodium + côtes (nonzero union of all shapes)
    grp.appendChild(E('path', { d: outline, fill: 'url(#hero-rhod)', 'fill-rule': 'nonzero' }));
    grp.appendChild(E('path', { d: outline, fill: 'url(#hero-cotes)', 'fill-rule': 'nonzero' }));
    // 3. crisp edge between flat and bevel
    shapes.forEach(function (d) { grp.appendChild(E('path', { d: d, fill: 'none', stroke: 'rgba(15,18,22,.55)', 'stroke-width': '1.3' })); });
    parent.appendChild(grp);
  }
  function mix(a, b, t) { return [U.lerp(a[0], b[0], t), U.lerp(a[1], b[1], t)]; }
  (function () {
    var mov = g({ transform: MOV });
    // barrel bridge: two feet on the rim, boss over the barrel arbor
    var fb1 = pol(398, 196), fb2 = pol(398, 250);
    drawBridge(mov, [
      { pts: [fb1, pol(300, 200), P.barrel], w0: 50, w1: 30 },
      { pts: [fb2, pol(300, 244), P.barrel], w0: 50, w1: 30 }
    ], [[P.barrel, 46]]);
    screwAt(mov, pol(390, 196), 10); screwAt(mov, pol(390, 250), 10);
    // centre bridge
    var fc = pol(398, 116);
    drawBridge(mov, [{ pts: [fc, pol(220, 108), P.centre], w0: 46, w1: 24 }], [[P.centre, 26]]);
    screwAt(mov, pol(388, 116), 9.5);
    jewelAt(mov, P.centre, 7);
    // train bridge (third + fourth)
    var ft1 = pol(398, -64), ft2 = pol(398, -24);
    drawBridge(mov, [
      { pts: [ft1, pol(250, -58), P.third], w0: 48, w1: 26 },
      { pts: [P.third, mix(P.third, P.fourth, 0.5), P.fourth], w0: 26, w1: 24 },
      { pts: [P.fourth, pol(320, -14), ft2], w0: 24, w1: 46 }
    ], [[P.third, 22], [P.fourth, 20]]);
    screwAt(mov, pol(388, -64), 9.5); screwAt(mov, pol(388, -24), 9.5);
    jewelAt(mov, P.third, 6.5); jewelAt(mov, P.fourth, 6);
    // winding stem, entering at 3 o'clock (visual)
    var aS = fromVisualAngle(0);
    var s1 = pol(RM + 12, aS), s2 = pol(318, aS);
    mov.appendChild(E('line', { x1: r2(s1[0]), y1: r2(s1[1]), x2: r2(s2[0]), y2: r2(s2[1]), stroke: 'url(#bg-steel)', 'stroke-width': '13', 'stroke-linecap': 'round' }));
    mov.appendChild(E('line', { x1: r2(s1[0]), y1: r2(s1[1]), x2: r2(s2[0]), y2: r2(s2[1]), stroke: '#fff', 'stroke-opacity': '0.35', 'stroke-width': '2' }));
    L.bridges.appendChild(mov);
    // gold-filled engravings along the bridges (drawn in the visual frame so they read correctly)
    function engrave(id, pts, text, size) {
      var v = pts.map(toVisual);
      if (v[0][0] > v[v.length - 1][0]) v.reverse();
      var defsE = E('defs', null, [E('path', { id: id, d: smooth(v) })]);
      var t = E('text', { 'font-family': 'Manrope, sans-serif', 'font-size': size || 11, 'font-weight': '600', 'letter-spacing': '3.2', fill: '#c9a45c', 'text-anchor': 'middle', 'dominant-baseline': 'central', opacity: '0.92' });
      var tp = E('textPath', { href: '#' + id, startOffset: '50%' });
      tp.textContent = text;
      t.appendChild(tp);
      L.bridges.appendChild(defsE);
      L.bridges.appendChild(g({ style: 'paint-order:stroke', stroke: 'rgba(0,0,0,.35)', 'stroke-width': '0.6' }, [t]));
    }
    engrave('hero-eng-1', [pol(372, 116), pol(220, 108), pol(60, 60)], 'BULROG · SWISS', 13);
    engrave('hero-eng-2', [pol(372, 250), pol(300, 244), mix(pol(300, 244), P.barrel, 0.6)], '31 RUBIS', 12.5);
    engrave('hero-eng-3', [pol(372, -64), pol(250, -58), mix(pol(250, -58), P.third, 0.7)], 'BR-01', 13);
  })();

  /* ------------------------------------------------------------------ *
   * LAYER 4 — winding works, escapement, balance-spring, balance cock
   * ------------------------------------------------------------------ */
  var X = {};
  var HS_IN = 11, HS_OUT = 60, HS_TURNS = 12, HS_PHASE = -0.6;
  (function () {
    var mov = g({ transform: MOV });
    var movC = g({ transform: MOV });           // static parts above the balance (own layer: no per-frame repaint)
    // Ratchet wheel on the barrel bridge (colimaçonnage) + winding wheels + click
    X.ratchet = wheelGroup(mov, P.barrel);
    var rg = G.gear({ teeth: 60, module: mR, profile: 'watch', spokes: 5, curve: 0.3, spokeWidth: 12, hubRadius: 30 });
    X.ratchet.appendChild(path(rg.d, 'url(#bg-steel)', { stroke: 'rgba(0,0,0,.35)', 'stroke-width': '0.6' }));
    X.ratchet.appendChild(sunray(120, 30, rg.rootRadius - 12, '0.16'));
    X.ratchet.appendChild(E('circle', { r: r2(rg.rootRadius - 11), fill: 'none', stroke: 'rgba(255,255,255,.35)', 'stroke-width': '1' }));
    X.ratchet.appendChild(G.screw({ x: 0, y: 0, r: 17, slot: 20 }));
    X.w1 = wheelGroup(mov, P.w1);
    X.w1.appendChild(path(G.gear({ teeth: 24, module: mR, profile: 'watch', spokes: 4, spokeWidth: 5, hole: 3 }).d, 'url(#bg-steel)'));
    X.w1.appendChild(E('circle', { r: 9, fill: 'url(#bg-steel-radial)' }));
    X.w2 = wheelGroup(mov, P.w2);
    X.w2.appendChild(path(G.gear({ teeth: 16, module: mR, profile: 'watch', spokes: 0, hole: 3 }).d, 'url(#hero-gold)'));
    jewelAt(mov, P.w1, 4.5); jewelAt(mov, P.w2, 4);
    // click (cliquet) against the ratchet
    var ck = pol(rg.outerRadius + 10, 300, P.barrel);
    mov.appendChild(g({ transform: tr(ck) + ' rotate(' + r2(300 + 90) + ')' }, [
      path('M-6 -8 L36 -3 Q44 0 36 5 L-6 8 Q-14 0 -6 -8Z', 'url(#bg-steel)', { stroke: 'rgba(0,0,0,.4)', 'stroke-width': '0.6' }),
      G.screw({ x: 0, y: 0, r: 5.5, slot: 60 })
    ]));

    // Escapement frame (escape centre, rotated so that balance lies along PHI)
    var ef = g({ transform: tr(P.escape) + ' rotate(' + ALPHA + ')' });
    X.escWheel = g({});
    X.escWheel.appendChild(path(G.escapeWheel({ radius: ER, hole: 0, spokeWidth: 3.6 }).d, 'url(#bg-steel)', { stroke: 'rgba(0,0,0,.45)', 'stroke-width': '0.5' }));
    X.escWheel.appendChild(E('circle', { r: 9, fill: 'url(#bg-steel-radial)' }));
    ef.appendChild(X.escWheel);
    X.pallet = g({});
    X.pallet.appendChild(path(ESC.forkD, 'url(#bg-steel)', { stroke: 'rgba(0,0,0,.5)', 'stroke-width': '0.6' }));
    ESC.stones.forEach(function (st) { X.pallet.appendChild(path(G.palletStonePath(st), 'url(#bg-ruby)', { stroke: 'rgba(90,6,20,.8)', 'stroke-width': '0.5' })); });
    ef.appendChild(g({ transform: 'translate(' + ESC.pallet.x + ' ' + ESC.pallet.y + ')' }, [X.pallet]));
    mov.appendChild(ef);

    // escapement bridge (escape + pallet pivots)
    var fe = pol(398, 4);
    drawBridge(movC, [
      { pts: [fe, pol(330, 2), P.escape], w0: 34, w1: 12 },
    ], [[P.escape, 12]]);
    screwAt(movC, pol(386, 4), 9);
    jewelAt(movC, P.escape, 5); jewelAt(movC, P.pallet, 4.5);

    // Balance (in the escapement frame, at ESC.balance)
    var bf = g({ transform: tr(P.balance) + ' rotate(' + ALPHA + ')' });
    var bw = G.balanceWheel({ radius: BAL_R, rim: 8.5, arms: 3, weights: 4, armWidth: 6.5, curve: 0.25, hole: 0 });
    X.ghosts = [];
    [0.28, 0.16, 0.08].forEach(function (op) {
      var gh = g({ opacity: '0' });
      gh.appendChild(path(bw.d, 'url(#hero-cube)'));
      bf.appendChild(gh);
      X.ghosts.push({ el: gh, op: op });
    });
    X.balance = g({});
    X.balance.appendChild(path(bw.d, 'url(#hero-cube)', { stroke: 'rgba(60,35,10,.5)', 'stroke-width': '0.6' }));
    X.balance.appendChild(E('circle', { r: BAL_R - 1, fill: 'none', stroke: 'rgba(255,240,210,.45)', 'stroke-width': '1' }));
    bw.weights.forEach(function (w, i) {           // 4 gold inertia weights (masselottes), inside the rim
      var p = pol(BAL_R - 8.5 - 5.5, w.angle * DEG);
      X.balance.appendChild(g({ transform: tr(p) + ' rotate(' + r2(w.angle * DEG) + ')' }, [
        E('rect', { x: -4, y: -7, width: 8, height: 14, rx: 3, fill: 'url(#hero-gold)', stroke: 'rgba(60,40,10,.6)', 'stroke-width': '0.6' }),
        E('line', { x1: -3, y1: 0, x2: 3, y2: 0, stroke: '#4a3614', 'stroke-width': '1.2', transform: 'rotate(' + (i * 35) + ')' })
      ]));
    });
    // double roller + impulse jewel (ellipse)
    X.balance.appendChild(E('circle', { r: r2(ESC.rollerRadius + 3), fill: 'url(#bg-steel)', opacity: '0.95' }));
    X.balance.appendChild(E('ellipse', { cx: 0, cy: r2(ESC.rollerRadius), rx: r2(ESC.pinRadius * 1.3), ry: r2(ESC.pinRadius * 2), fill: 'url(#bg-ruby)' }));
    X.balance.appendChild(E('circle', { r: 7, fill: 'url(#bg-steel-radial)' }));
    bf.appendChild(X.balance);
    // hairspring (breathing) + stud
    X.hs = E('path', { d: '', fill: 'none', stroke: '#dfe5ea', 'stroke-width': '1.15', 'stroke-linecap': 'round', opacity: '0.95' });
    bf.appendChild(X.hs);
    var stud = pol(HS_OUT + 2, HS_PHASE * DEG);
    bf.appendChild(E('rect', { x: r2(stud[0] - 4), y: r2(stud[1] - 4), width: 8, height: 8, rx: 1.5, fill: 'url(#bg-steel)', stroke: 'rgba(0,0,0,.5)', 'stroke-width': '0.5' }));
    // The balance repaints every frame: it lives in its own small SVG cropped around it,
    // so the browser only re-rasterises that little square.
    if (L.balance) {
      var vb = toVisual(P.balance), half = BAL_R + 16, VB = 1140;
      var x0 = vb[0] - half, y0 = vb[1] - half;
      L.balance.setAttribute('viewBox', r2(x0) + ' ' + r2(y0) + ' ' + r2(half * 2) + ' ' + r2(half * 2));
      var st = L.balance.style;
      st.left = ((x0 + VB / 2) / VB * 100) + '%';
      st.top = ((y0 + VB / 2) / VB * 100) + '%';
      st.width = st.height = (half * 2 / VB * 100) + '%';
      st.transformOrigin = ((-x0) / (half * 2) * 100) + '% ' + ((-y0) / (half * 2) * 100) + '%';
      L.balance.appendChild(g({ transform: MOV }, [bf]));
    } else mov.appendChild(bf);

    // balance cock (single foot) with regulator index and shock-absorber (lyre spring)
    var fk = pol(398, 40);
    drawBridge(movC, [{ pts: [fk, pol(330, 46), P.balance], w0: 48, w1: 22 }], [[P.balance, 22]]);
    screwAt(movC, pol(388, 40), 10);
    var studW = [P.balance[0] + rotP(stud, ALPHA)[0], P.balance[1] + rotP(stud, ALPHA)[1]];
    var idxA = ang(P.balance, studW) * DEG;
    movC.appendChild(g({ transform: tr(P.balance) + ' rotate(' + r2(idxA - 8) + ')' }, [
      path('M0 -4 L' + (HS_OUT + 16) + ' -2 L' + (HS_OUT + 22) + ' 0 L' + (HS_OUT + 16) + ' 2 L0 4Z', 'url(#bg-steel)', { stroke: 'rgba(0,0,0,.4)', 'stroke-width': '0.5' })
    ]));
    movC.appendChild(E('circle', { cx: r2(P.balance[0]), cy: r2(P.balance[1]), r: 15, fill: 'url(#hero-gold)', stroke: 'rgba(0,0,0,.4)', 'stroke-width': '0.6' }));
    jewelAt(movC, P.balance, 6);
    var lyre = 'M-12 -3 C-14 -14 -4 -16 0 -9 C4 -16 14 -14 12 -3 C11 4 5 9 0 12 C-5 9 -11 4 -12 -3Z';
    movC.appendChild(E('path', { d: lyre, transform: tr(P.balance) + ' scale(1.25)', fill: 'none', stroke: 'url(#hero-blue)', 'stroke-width': '1.6' }));
    L.escape.appendChild(mov);
    L.cock.appendChild(movC);
  })();

  /* ------------------------------------------------------------------ *
   * LAYER 5 — case ring, chapter ring (réhaut), crown — visual frame
   * ------------------------------------------------------------------ */
  (function () {
    var d = L.dial;
    // crown (couronne cannelée) + tube, at 3 o'clock
    var crown = g({});
    crown.appendChild(E('rect', { x: 512, y: -15, width: 18, height: 30, rx: 3, fill: 'url(#hero-case)' }));
    crown.appendChild(E('rect', { x: 526, y: -40, width: 30, height: 80, rx: 8, fill: 'url(#hero-case)', stroke: 'rgba(0,0,0,.5)', 'stroke-width': '1' }));
    var fl = '';
    for (var y = -34; y <= 34; y += 5) fl += 'M529 ' + y + 'L553 ' + y;
    crown.appendChild(E('path', { d: fl, stroke: 'rgba(0,0,0,.45)', 'stroke-width': '1.6' }));
    crown.appendChild(E('rect', { x: 553, y: -36, width: 5, height: 72, rx: 2.5, fill: 'url(#bg-gold)' }));
    d.appendChild(crown);
    // case middle / bezel (polished)
    d.appendChild(E('circle', { r: 524, fill: 'none', stroke: 'rgba(0,0,0,.6)', 'stroke-width': '8', filter: 'url(#hero-blur)' }));
    d.appendChild(path(G.ringPath(522, 494), 'url(#hero-case)'));
    d.appendChild(path(G.ringPath(506, 503.5), 'rgba(0,0,0,.35)'));
    d.appendChild(E('circle', { r: 521.5, fill: 'none', stroke: 'rgba(255,255,255,.5)', 'stroke-width': '1' }));
    // chapter ring
    d.appendChild(path(G.ringPath(494, 440), 'url(#hero-ring)'));
    d.appendChild(E('circle', { r: 440.5, fill: 'none', stroke: 'url(#bg-gold)', 'stroke-width': '2' }));
    d.appendChild(E('circle', { r: 493, fill: 'none', stroke: 'rgba(0,0,0,.8)', 'stroke-width': '2' }));
    var ticks = '', ticks5 = '';
    for (var i = 0; i < 60; i++) {
      var a = i * 6 - 90;
      if (i % 5) ticks += 'M' + pstr(pol(478, a)) + 'L' + pstr(pol(488, a));
      else ticks5 += 'M' + pstr(pol(472, a)) + 'L' + pstr(pol(488, a));
    }
    d.appendChild(E('path', { d: ticks, stroke: '#cdbf9f', 'stroke-opacity': '0.55', 'stroke-width': '1.6' }));
    d.appendChild(E('path', { d: ticks5, stroke: '#e6cf97', 'stroke-opacity': '0.9', 'stroke-width': '2.6' }));
    // applied gold indices
    for (var h = 0; h < 12; h++) {
      var ah = h * 30;
      var bars = h === 0 ? [-7.5, 7.5] : [0];
      bars.forEach(function (off) {
        d.appendChild(g({ transform: 'rotate(' + ah + ') translate(' + off + ' 0)' }, [
          E('rect', { x: -4.5, y: -470, width: 9, height: 26, rx: 1.2, fill: 'url(#hero-gold)', filter: 'url(#hero-hand-shadow)' }),
          E('rect', { x: -1, y: -468, width: 2, height: 22, fill: '#fff6dc', opacity: '0.6' })
        ]));
      });
    }
    var txt = { fill: '#a39a8a', 'font-family': 'Manrope, sans-serif', 'font-size': '12', 'letter-spacing': '3.5', 'font-weight': '600', 'text-anchor': 'middle' };
    var t1 = E('text', Object.assign({ x: -62, y: 466 }, txt)); t1.textContent = 'SWISS';
    var t2 = E('text', Object.assign({ x: 62, y: 466 }, txt)); t2.textContent = 'MADE';
    d.appendChild(t1); d.appendChild(t2);
  })();

  /* ------------------------------------------------------------------ *
   * LAYER 6 — hands at real time (skeleton dauphine, gold) — visual frame
   * ------------------------------------------------------------------ */
  var H = {};
  (function () {
    var h = L.hands;
    function dauphine(len, w, tail) {
      var hole = [len * 0.86, w * 0.42, len * 0.2, len * 0.08];      // tip, half width, widest, base (inner cut)
      var left = 'M0 ' + (-len) + ' L' + (-w) + ' ' + r2(-len * 0.16) + ' L' + (-w * 0.55) + ' ' + tail + ' L0 ' + (tail + 2) + 'Z' +
        'M0 ' + r2(-hole[0]) + ' L' + r2(-hole[1]) + ' ' + r2(-hole[2]) + ' L0 ' + r2(-hole[3]) + 'Z';
      var right = 'M0 ' + (-len) + ' L' + w + ' ' + r2(-len * 0.16) + ' L' + (w * 0.55) + ' ' + tail + ' L0 ' + (tail + 2) + 'Z' +
        'M0 ' + r2(-hole[0]) + ' L' + r2(hole[1]) + ' ' + r2(-hole[2]) + ' L0 ' + r2(-hole[3]) + 'Z';
      return g({ filter: 'url(#hero-hand-shadow)' }, [
        path(left, '#f3e1ae'), path(right, '#a9843f'),
        E('path', { d: 'M0 ' + (-len) + 'L0 ' + r2(-hole[0]), stroke: '#fff3cf', 'stroke-width': '0.8', opacity: '0.7' })
      ]);
    }
    H.hour = g({}); H.hour.appendChild(dauphine(262, 17, 30));
    H.minute = g({}); H.minute.appendChild(dauphine(405, 13, 34));
    H.second = g({ filter: 'url(#hero-hand-shadow)' });
    H.second.appendChild(E('path', { d: 'M-1.3 110 L-0.9 -438 L0 -446 L0.9 -438 L1.3 110 Z', fill: '#e6cf97' }));
    H.second.appendChild(E('circle', { cy: 84, r: 11, fill: 'none', stroke: '#e6cf97', 'stroke-width': '3' }));
    H.second.appendChild(E('circle', { cy: 84, r: 5, fill: 'url(#bg-ruby)' }));
    h.appendChild(H.hour); h.appendChild(H.minute); h.appendChild(H.second);
    h.appendChild(E('circle', { r: 15, fill: 'url(#bg-gold-radial)', stroke: 'rgba(0,0,0,.45)', 'stroke-width': '1' }));
    h.appendChild(G.jewel({ x: 0, y: 0, r: 5, chaton: false }));
  })();

  /* ------------------------------------------------------------------ *
   * Annotations (desktop): leader lines to the key organs
   * ------------------------------------------------------------------ */
  // leader lines drawn in the visual frame: a = direction (deg, visual), len (viewBox units)
  var NOTES = [
    { p: P.balance, a: 158, len: 190, label: 'Balancier-spiral', value: '4 Hz · 28\u202F800 alt/h' },
    { p: P.escape, a: 186, len: 180, label: 'Échappement', value: 'Ancre suisse · levées rubis' },
    { p: P.fourth, a: 202, len: 200, label: 'Roue de secondes', value: '1 tour / 60 s' },
    { p: P.barrel, a: -58, len: 200, label: 'Barillet', value: '72 h de réserve' }
  ];
  (function () {
    if (!L.notes) return;
    var VB = 1140;
    function pc(v) { return ((v + VB / 2) / VB * 100).toFixed(2) + '%'; }
    NOTES.forEach(function (n, i) {
      var v = toVisual(n.p);
      var e = pol(n.len, n.a, v);
      var right = Math.cos(n.a * RAD) >= 0;
      var el = document.createElement('div');
      el.className = 'hero-note hero-note--' + (right ? 'right' : 'left');
      el.style.setProperty('--hero-note-delay', (i * 140) + 'ms');
      var dot = document.createElement('span'); dot.className = 'hero-note-dot';
      dot.style.left = pc(v[0]); dot.style.top = pc(v[1]);
      var line = document.createElement('span'); line.className = 'hero-note-line';
      line.style.left = pc(v[0]); line.style.top = pc(v[1]);
      line.style.width = (n.len / VB * 100).toFixed(2) + '%';
      line.style.transform = 'rotate(' + n.a + 'deg)';
      var txt = document.createElement('span'); txt.className = 'hero-note-text';
      txt.style.top = pc(e[1]);
      if (right) txt.style.left = pc(e[0]); else txt.style.right = (100 - parseFloat(pc(e[0]))).toFixed(2) + '%';
      var l1 = document.createElement('span'); l1.className = 'hero-note-label'; l1.textContent = n.label;
      var l2 = document.createElement('span'); l2.className = 'hero-note-value'; l2.textContent = n.value;
      txt.appendChild(l1); txt.appendChild(l2);
      el.appendChild(line); el.appendChild(dot); el.appendChild(txt);
      L.notes.appendChild(el);
    });
  })();

  /* ------------------------------------------------------------------ *
   * Animation
   * ------------------------------------------------------------------ */
  var reduced = G.reducedMotion;
  var now0 = new Date();
  var T0 = now0.getHours() * 3600 + now0.getMinutes() * 60 + now0.getSeconds() + now0.getMilliseconds() / 1000;
  var AMP = G.CALIBRE.amplitudeDeg, W4 = TAU * G.CALIBRE.freqHz;
  var hsCache = {};
  function hairspring(twistDeg) {
    var k = Math.round(twistDeg / 1.5);
    var d = hsCache[k];
    if (!d) d = hsCache[k] = G.hairspringPath({ inner: HS_IN, outer: HS_OUT, turns: HS_TURNS, twist: k * 1.5 * RAD, phase: HS_PHASE, samples: 30 });
    return d;
  }
  function deg(a) { a = a % 360; return r2(a); }
  function setRot(elm, aDeg) { elm.setAttribute('transform', 'rotate(' + deg(aDeg) + ')'); }

  var beatsEl = root.querySelector('[data-hero-beats]');
  var lastBeats = -1;
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

  var lastEsc = null, lastPal = null;
  // winding / rotor physics
  var rotor = { a: -30, v: 0, target: -30, wind: 0 };
  var scrollY = window.scrollY || 0, heroH = root.offsetHeight || 800;
  var pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var intro = reduced ? 1 : 0;
  var lastStackCss = '', isFlat = false;
  var hovering = false, annotated = false;
  function setAnnotated(on) { if (on !== annotated) { annotated = on; root.classList.toggle('is-annotated', on); } }

  function updateMovement(t, dt, speed) {
    var s = G.escapement(t, ESC_OPT);
    // train, only when the escape wheel actually moved (it is locked between beats)
    if (s.escapeDeg !== lastEsc) {
      lastEsc = s.escapeDeg;
      var rE = (ALPHA + s.escapeDeg) * RAD;
      var r4 = invMesh(T.fourth, T.ep, TH.fe, rE);
      var r3 = invMesh(T.third, T.fp, TH.t4, r4);
      var rC = invMesh(T.centre, T.tp, TH.c3, r3);
      var rB = invMesh(T.barrel, T.cp, TH.bc, rC);
      setRot(X.escWheel, s.escapeDeg);
      setRot(W.escPinion, rE * DEG);
      setRot(W.fourth, r4 * DEG);
      setRot(W.third, r3 * DEG);
      setRot(W.centre, rC * DEG);
      setRot(W.barrel, rB * DEG);
    }
    var pd = r2(s.palletDeg);
    if (pd !== lastPal) { lastPal = pd; setRot(X.pallet, pd); }
    X.balance.setAttribute('transform', 'rotate(' + r2(s.balanceDeg) + ')');
    X.hs.setAttribute('d', hairspring(s.balanceDeg));
    // motion blur ghosts: balance positions over the last frame interval
    for (var i = 0; i < X.ghosts.length; i++) {
      var gh = X.ghosts[i];
      if (dt > 0 && speed > 0.3) {
        var tg = t - dt * (i + 1) / 3;
        gh.el.setAttribute('transform', 'rotate(' + r2(AMP * Math.sin(W4 * tg)) + ')');
        gh.el.setAttribute('opacity', gh.op);
      } else if (gh.el.getAttribute('opacity') !== '0') gh.el.setAttribute('opacity', '0');
    }
  }

  function updateRotor(dt) {
    if (dt <= 0) { setRot(rotorRot, rotor.a); return; }
    // spring-damper towards target driven by scroll + pointer ("wrist" movement)
    rotor.target = -30 + scrollY * 0.45 + pointer.x * 24;
    var k = 26, c = 7.5;
    var acc = k * (rotor.target - rotor.a) - c * rotor.v;
    rotor.v += acc * dt;
    var da = rotor.v * dt;
    if (Math.abs(da) < 1e-4 && Math.abs(rotor.target - rotor.a) < 0.01) return;
    rotor.a += da;
    rotor.wind += Math.abs(da);                     // bidirectional winding (reverser wheels)
    setRot(rotorRot, rotor.a);
    // winding train: w2 ← reverser, w1, ratchet (always forward)
    var rw2 = rotor.wind * 1.8 * RAD;
    var rw1 = G.meshRotation(16, 24, TH.w2w1, rw2);
    var rr = G.meshRotation(24, 60, TH.w1r, rw1);
    setRot(X.w2, rw2 * DEG); setRot(X.w1, rw1 * DEG); setRot(X.ratchet, rr * DEG);
  }

  function updateStack(dt) {
    if (!stack) return;
    var ex = 0, tx = 0, ty = 0, rx = 0;
    if (!reduced) {
      if (intro < 1 && dt > 0) intro = Math.min(1, intro + dt / 2.4);
      var ie = U.easeOut(intro);
      var sp = U.clamp(scrollY / heroH, 0, 1);
      setAnnotated(hovering || (sp > 0.06 && sp < 0.85));
      ex = (1 - ie) * 5 + sp * 3.2;
      rx = (1 - ie) * 28 + sp * 22;
      if (fine) {
        pointer.tx += (pointer.x - pointer.tx) * Math.min(1, dt * 5);
        pointer.ty += (pointer.y - pointer.ty) * Math.min(1, dt * 5);
        tx = pointer.tx; ty = pointer.ty;
      }
    }
    var css = 'rotateX(' + r2(rx - ty * 7) + 'deg) rotateY(' + r2(tx * 9) + 'deg)';
    var spread = r2(1 + ex);
    var key = css + spread;
    if (key !== lastStackCss) {
      lastStackCss = key;
      // at rest the 3D stack projects to exactly the flat image (each layer's scale cancels its
      // perspective), so drop preserve-3d then: 9 large composited layers -> 1 painted layer
      var flat = Math.abs(rx - ty * 7) < 0.05 && Math.abs(tx * 9) < 0.05 && spread <= 1.001;
      if (flat !== isFlat) { isFlat = flat; root.classList.toggle('is-flat', flat); }
      stack.style.transform = css;
      stack.style.setProperty('--hero-spread', spread);
    }
  }

  var movHandle = G.ticker.add(function (f) {
    var speed = f.handle.speed;
    updateMovement(T0 + f.time, f.dt, speed);
    var realDt = speed > 0 ? f.dt / speed : 0;
    updateRotor(realDt);
    updateStack(realDt);
    if (beatsEl) {
      var b = Math.max(0, Math.floor(f.time * 8));
      if (b !== lastBeats) { lastBeats = b; beatsEl.textContent = fmt(b); }
    }
  }, { el: cal });

  var lastSec = null;
  var handsHandle = G.ticker.add(function () {
    var a = G.hands();
    if (a.second === lastSec) return;
    lastSec = a.second;
    setRot(H.hour, a.hour); setRot(H.minute, a.minute); setRot(H.second, a.second);
  }, { el: cal, fps: 24, reduced: 1 });

  /* ------------------------------------------------------------------ *
   * Interaction
   * ------------------------------------------------------------------ */
  window.addEventListener('scroll', function () { scrollY = window.scrollY || 0; }, { passive: true });
  window.addEventListener('resize', function () { heroH = root.offsetHeight || heroH; }, { passive: true });
  if (fine && !reduced) {
    root.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = cal.getBoundingClientRect();
      pointer.x = U.clamp((e.clientX - (r.left + r.width / 2)) / (r.width * 0.8), -1, 1);
      pointer.y = U.clamp((e.clientY - (r.top + r.height / 2)) / (r.height * 0.8), -1, 1);
    });
    root.addEventListener('pointerleave', function () { pointer.x = 0; pointer.y = 0; });
    cal.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') hovering = true; });
    cal.addEventListener('pointerleave', function () { hovering = false; });
  }

  var btnSlow = root.querySelector('[data-hero-slow]');
  var btnPause = root.querySelector('[data-hero-pause]');
  if (btnSlow) btnSlow.addEventListener('click', function () {
    var on = btnSlow.getAttribute('aria-pressed') !== 'true';
    btnSlow.setAttribute('aria-pressed', String(on));
    movHandle.speed = on ? 0.1 : 1;
    root.classList.toggle('is-slow', on);
  });
  if (btnPause) btnPause.addEventListener('click', function () {
    var paused = btnPause.getAttribute('aria-pressed') !== 'true';
    btnPause.setAttribute('aria-pressed', String(paused));
    var lab = btnPause.querySelector('.hero-ctrl-label');
    if (lab) lab.textContent = paused ? 'Lecture' : 'Pause';
    if (paused) { movHandle.pause(); handsHandle.pause(); } else { movHandle.play(); handsHandle.play(); }
    root.classList.toggle('is-paused', paused);
  });

  G.onReducedMotionChange(function (r) {
    reduced = r;
    if (r) { intro = 1; lastStackCss = ''; updateStack(0); X.ghosts.forEach(function (gh) { gh.el.setAttribute('opacity', '0'); }); }
  });

  // start the assembling intro (next task, so the initial hidden state is painted first)
  setTimeout(function () { root.classList.add('is-ready'); }, 60);

  window.BulrogHero = { movement: movHandle, hands: handsHandle, positions: P, toVisual: toVisual, t0: T0 };
})();
