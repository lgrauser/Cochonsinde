/*!
 * BULROG — gears.js
 * Shared procedural-horology library (no dependencies).
 * Exposes window.BulrogGears. Loaded (defer) BEFORE every section script.
 *
 * CONVENTIONS
 *  - All angles passed to / returned from *geometry* functions are in RADIANS,
 *    except where a name ends in "Deg" or the doc says degrees.
 *  - SVG coordinate system: +x right, +y down. A positive angle therefore turns
 *    CLOCKWISE on screen. Angle 0 points to +x (3 o'clock), -PI/2 points up (12 o'clock).
 *  - Every path generator returns a path "d" string centred on (0,0) unless cx/cy
 *    are given. Paths that contain holes (spoke windows, arbor holes) must be
 *    drawn with fill-rule="evenodd" (helpers below set it for you).
 *  - Tooth 0 of a gear is centred on angle `phase` (default 0 = pointing +x).
 *
 * QUICK START
 *   const G = window.BulrogGears;
 *   G.ensureDefs();                                   // shared gradients/patterns once
 *   const g = G.gear({ teeth: 80, radius: 120, spokes: 5, hole: 6 });
 *   svg.appendChild(G.el('path', { d: g.d, fill: 'url(#bg-gold)', 'fill-rule': 'evenodd' }));
 *   const h = G.ticker.add(({ time }) => {
 *     const s = G.escapement(time);                   // true 4 Hz Swiss lever kinematics
 *     const a = G.train(s);                           // gear-train angles (degrees)
 *     wheel.setAttribute('transform', `rotate(${a.fourth})`);
 *   }, { el: svg });                                  // auto-pauses offscreen / hidden tab / reduced motion
 */
(function (global) {
  'use strict';

  var TAU = Math.PI * 2;
  var RAD = Math.PI / 180;
  var DEG = 180 / Math.PI;
  var SVGNS = 'http://www.w3.org/2000/svg';

  /* ------------------------------------------------------------------ *
   * Small numeric helpers
   * ------------------------------------------------------------------ */
  function r2(n) { return Math.round(n * 100) / 100; }
  function pt(r, a, cx, cy) { return [r2((cx || 0) + r * Math.cos(a)), r2((cy || 0) + r * Math.sin(a))]; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  /** Full circle as a path sub-command string (usable as a hole with evenodd). */
  function circlePath(r, cx, cy) {
    cx = cx || 0; cy = cy || 0;
    return 'M' + r2(cx + r) + ' ' + r2(cy) +
      'A' + r2(r) + ' ' + r2(r) + ' 0 1 0 ' + r2(cx - r) + ' ' + r2(cy) +
      'A' + r2(r) + ' ' + r2(r) + ' 0 1 0 ' + r2(cx + r) + ' ' + r2(cy) + 'Z';
  }

  /** Annulus (ring) path: outer circle + inner hole. Use fill-rule evenodd. */
  function ringPath(rOuter, rInner, cx, cy) {
    return circlePath(rOuter, cx, cy) + circlePath(rInner, cx, cy);
  }

  /** Arc command from current point to angle a2 on radius r (sweep follows increasing angle when dir>0). */
  function arcTo(r, a1, a2, dir, cx, cy) {
    var span = Math.abs(a2 - a1);
    var large = span > Math.PI ? 1 : 0;
    var sweep = dir > 0 ? 1 : 0;
    var p = pt(r, a2, cx, cy);
    return 'A' + r2(r) + ' ' + r2(r) + ' 0 ' + large + ' ' + sweep + ' ' + p[0] + ' ' + p[1];
  }

  /* ------------------------------------------------------------------ *
   * GEAR TEETH
   * ------------------------------------------------------------------ */

  /**
   * Resolve gear dimensions.
   * Provide `teeth` and either `radius` (pitch radius) or `module`.
   */
  function dims(o) {
    var N = o.teeth;
    var m = o.module != null ? o.module : (2 * o.radius) / N;
    var r = (m * N) / 2;
    var profile = o.profile || (N <= 14 ? 'leaf' : 'involute');
    var add = o.addendum != null ? o.addendum : (profile === 'leaf' ? 0.72 : profile === 'watch' ? 1.25 : 1.0);
    var ded = o.dedendum != null ? o.dedendum : (profile === 'leaf' ? 1.5 : 1.3);
    return {
      N: N, m: m, r: r, profile: profile,
      ra: r + add * m,
      rf: Math.max(r - ded * m, m * 0.6)
    };
  }

  /**
   * Tooth outline path only (no hub/spokes).
   * profile:
   *   'involute' — true involute flanks (pressure angle 20°), for wheels ≥ 15 teeth.
   *   'watch'    — horological ogival (cycloidal-like) teeth: radial dedendum flanks
   *                + rounded ogive addendum. Very "clock-like".
   *   'leaf'     — pinion leaves: radial flanks + semicircular tip (default when teeth ≤ 14).
   */
  function teethPath(o) {
    var d = dims(o);
    var N = d.N, r = d.r, ra = d.ra, rf = d.rf;
    var cx = o.cx || 0, cy = o.cy || 0;
    var phase = o.phase || 0;
    var backlash = o.backlash != null ? o.backlash : 0.06;
    var pitchA = TAU / N;
    var halfT = (Math.PI / (2 * N)) * (1 - backlash); // half tooth thickness (angle) at pitch circle
    var out = '';
    var i, k, c, flank = [], samples = o.samples || 6;

    if (d.profile === 'involute') {
      var pa = (o.pressureAngle != null ? o.pressureAngle : 20) * RAD;
      var rb = r * Math.cos(pa);
      var inv = function (a) { return Math.tan(a) - a; };
      var invPa = inv(pa);
      var psi = function (rho) {
        if (rho <= rb) return halfT + invPa;
        return halfT + invPa - inv(Math.acos(rb / rho));
      };
      // avoid pointed teeth
      while (psi(ra) < halfT * 0.18 && ra > r) ra -= d.m * 0.05;
      var rStart = Math.max(rb, rf);
      for (k = 0; k <= samples; k++) {
        var rho = lerp(rStart, ra, k / samples);
        flank.push([rho, psi(rho)]);
      }
      var psi0 = flank[0][1];
      for (i = 0; i < N; i++) {
        c = phase + i * pitchA;
        var p0 = pt(rf, c - psi0, cx, cy);
        out += (i === 0 ? 'M' : 'L') + p0[0] + ' ' + p0[1];
        for (k = 0; k < flank.length; k++) { var q = pt(flank[k][0], c - flank[k][1], cx, cy); out += 'L' + q[0] + ' ' + q[1]; }
        var tipA = flank[flank.length - 1][1];
        out += arcTo(ra, c - tipA, c + tipA, 1, cx, cy);
        for (k = flank.length - 1; k >= 0; k--) { var q2 = pt(flank[k][0], c + flank[k][1], cx, cy); out += 'L' + q2[0] + ' ' + q2[1]; }
        var p1 = pt(rf, c + psi0, cx, cy);
        out += 'L' + p1[0] + ' ' + p1[1];
        out += arcTo(rf, c + psi0, c + pitchA - psi0, 1, cx, cy);
      }
      return out + 'Z';
    }

    // 'watch' (ogival) and 'leaf' (semicircular tip) share radial dedendum flanks
    var tipSamples = o.samples || 8;
    var ogive = [];
    for (k = 0; k <= tipSamples; k++) {
      var u = k / tipSamples;               // 0 at pitch circle, 1 at tip
      var ang = Math.PI / 2 * u;
      var rr = r + (ra - r) * Math.sin(ang);
      var hw = halfT * Math.cos(ang);
      if (d.profile === 'watch') hw = halfT * Math.pow(Math.cos(ang), 0.8);
      ogive.push([rr, hw]);
    }
    for (i = 0; i < N; i++) {
      c = phase + i * pitchA;
      var a0 = pt(rf, c - halfT, cx, cy);
      out += (i === 0 ? 'M' : 'L') + a0[0] + ' ' + a0[1];
      for (k = 0; k < ogive.length; k++) { var q3 = pt(ogive[k][0], c - ogive[k][1], cx, cy); out += 'L' + q3[0] + ' ' + q3[1]; }
      for (k = ogive.length - 2; k >= 0; k--) { var q4 = pt(ogive[k][0], c + ogive[k][1], cx, cy); out += 'L' + q4[0] + ' ' + q4[1]; }
      var a1 = pt(rf, c + halfT, cx, cy);
      out += 'L' + a1[0] + ' ' + a1[1];
      out += arcTo(rf, c + halfT, c + pitchA - halfT, 1, cx, cy);
    }
    return out + 'Z';
  }

  /**
   * Spoke "windows" (the cut-outs between the arms of a wheel).
   * o.rim    inner radius of the rim (where windows end, outside)
   * o.hub    radius of the hub (where windows start, inside)
   * o.spokes number of arms (0 = solid)
   * o.width  arm width in user units (default ~ 12% of rim radius)
   * o.curve  twist of the arms in radians from hub to rim (0 = straight, 0.5 = elegant curve)
   * o.phase  angle of arm 0
   */
  function windowsPath(o) {
    var S = o.spokes | 0;
    if (!S) return '';
    var Ri = o.rim, Rh = o.hub;
    var w = o.width != null ? o.width : Ri * 0.12;
    var curve = o.curve || 0;
    var phase = o.phase || 0;
    var cx = o.cx || 0, cy = o.cy || 0;
    var n = curve ? 10 : 1;
    var out = '';
    function edge(phi, rho, side) {
      var tw = curve * Math.sin(((rho - Rh) / (Ri - Rh)) * Math.PI / 2);
      return phi + tw + side * Math.asin(Math.min(0.95, w / 2 / rho));
    }
    for (var k = 0; k < S; k++) {
      var fa = phase + (TAU * k) / S, fb = fa + TAU / S;
      var i0 = edge(fa, Rh, 1), i1 = edge(fb, Rh, -1);
      var o0 = edge(fa, Ri, 1), o1 = edge(fb, Ri, -1);
      if (i1 - i0 <= 0.02 || o1 - o0 <= 0.02) continue;
      var s = pt(Rh, i0, cx, cy);
      out += 'M' + s[0] + ' ' + s[1] + arcTo(Rh, i0, i1, 1, cx, cy);
      for (var j = 1; j <= n; j++) { var rho = lerp(Rh, Ri, j / n); var q = pt(rho, edge(fb, rho, -1), cx, cy); out += 'L' + q[0] + ' ' + q[1]; }
      out += arcTo(Ri, o1, o0, -1, cx, cy);
      for (var j2 = n - 1; j2 >= 0; j2--) { var rho2 = lerp(Rh, Ri, j2 / n); var q2 = pt(rho2, edge(fa, rho2, 1), cx, cy); out += 'L' + q2[0] + ' ' + q2[1]; }
      out += 'Z';
    }
    return out;
  }

  /**
   * Complete wheel: teeth + (optional) spoke windows + arbor hole.
   * Options: teeth, radius|module, profile, phase, cx, cy,
   *          spokes (default 0 for teeth<=14, else 5), curve, spokeWidth,
   *          rimWidth (default 9% of pitch radius), hubRadius (default 22%),
   *          hole (arbor hole radius, default 0 = none).
   * Returns { d, pitchRadius, outerRadius, rootRadius, module, teeth } — draw with fill-rule="evenodd".
   */
  function gear(o) {
    var d = dims(o);
    var cx = o.cx || 0, cy = o.cy || 0;
    var path = teethPath(o);
    var spokes = o.spokes != null ? o.spokes : (d.N <= 14 ? 0 : 5);
    if (spokes && d.rf > d.m * 6) {
      var rim = d.rf - (o.rimWidth != null ? o.rimWidth : d.r * 0.09);
      var hub = o.hubRadius != null ? o.hubRadius : d.r * 0.22;
      path += windowsPath({ rim: rim, hub: hub, spokes: spokes, width: o.spokeWidth, curve: o.curve, phase: (o.spokePhase != null ? o.spokePhase : (o.phase || 0)), cx: cx, cy: cy });
    }
    if (o.hole) path += circlePath(o.hole, cx, cy);
    return { d: path, pitchRadius: d.r, outerRadius: d.ra, rootRadius: d.rf, module: d.m, teeth: d.N };
  }

  /** Pinion (few leaves, solid) — convenience wrapper. Defaults to 'leaf' profile. */
  function pinion(o) {
    var q = Object.assign({ profile: 'leaf', spokes: 0 }, o);
    return gear(q);
  }

  /**
   * Swiss lever escape wheel with CLUB teeth (default 15 teeth).
   * Teeth lean CLOCKWISE (+angle) — the wheel must turn clockwise (positive rotate()).
   * o.radius     tip radius (locking corners lie on this circle)
   * o.teeth      default 15
   * o.root       root radius ratio (default 0.74)
   * o.club       club height ratio of radius (default 0.075)
   * o.spokes     default 4, o.curve default 0.35, o.hole arbor hole radius
   * Returns { d, radius, teeth, pitchAngle } (fill-rule evenodd)
   */
  function escapeWheel(o) {
    var N = o.teeth || 15;
    var R = o.radius;
    var cx = o.cx || 0, cy = o.cy || 0;
    var phase = o.phase || 0;
    var rRoot = R * (o.root || 0.74);
    var club = R * (o.club || 0.075);
    var P = TAU / N;
    var out = '';
    for (var i = 0; i < N; i++) {
      var a = phase + i * P;
      // tooth tip (locking corner) is at angle a (tooth "points" at a)
      var tip = pt(R, a, cx, cy);
      var heel = pt(R - club, a - P * 0.2, cx, cy);                 // back end of the club (impulse plane)
      var backTop = pt(R - club * 1.35, a - P * 0.24, cx, cy);
      var backCtrl = pt(lerp(rRoot, R, 0.55), a - P * 0.5, cx, cy);
      var rootBack = pt(rRoot, a - P * 0.66, cx, cy);               // where the back of the tooth meets the rim
      var rootFront = pt(rRoot, a - P * 0.2, cx, cy);               // where the locking face meets the rim
      var frontCtrl = pt(lerp(rRoot, R, 0.7), a - P * 0.07, cx, cy);
      if (i === 0) out += 'M' + rootBack[0] + ' ' + rootBack[1];
      out += 'Q' + backCtrl[0] + ' ' + backCtrl[1] + ' ' + backTop[0] + ' ' + backTop[1];
      out += 'L' + heel[0] + ' ' + heel[1];
      out += 'L' + tip[0] + ' ' + tip[1];                           // impulse face (club)
      out += 'Q' + frontCtrl[0] + ' ' + frontCtrl[1] + ' ' + rootFront[0] + ' ' + rootFront[1]; // locking face
      out += arcTo(rRoot, a - P * 0.2, a + P - P * 0.66, 1, cx, cy);
    }
    out += 'Z';
    var spokes = o.spokes != null ? o.spokes : 4;
    if (spokes) {
      out += windowsPath({ rim: rRoot - R * 0.07, hub: o.hubRadius || R * 0.2, spokes: spokes, width: o.spokeWidth || R * 0.07, curve: o.curve != null ? o.curve : 0.35, phase: phase, cx: cx, cy: cy });
    }
    if (o.hole) out += circlePath(o.hole, cx, cy);
    return { d: out, radius: R, teeth: N, pitchAngle: P };
  }

  /**
   * Balance wheel: rim + arms (+ positions for inertia weights / screws).
   * o.radius outer radius, o.rim rim thickness (default 10%), o.arms (default 3),
   * o.weights number of inertia weights/screws on the rim (default 4 for 2 arms, 6 for 3).
   * Returns { d, weights:[{x,y,angle}], radius } — fill-rule evenodd.
   */
  function balanceWheel(o) {
    var R = o.radius;
    var cx = o.cx || 0, cy = o.cy || 0;
    var rim = o.rim != null ? o.rim : R * 0.1;
    var arms = o.arms || 3;
    var d = circlePath(R, cx, cy) + windowsPath({ rim: R - rim, hub: o.hubRadius || R * 0.14, spokes: arms, width: o.armWidth || R * 0.09, curve: o.curve || 0, phase: (o.phase != null ? o.phase : -Math.PI / 2), cx: cx, cy: cy });
    if (o.hole) d += circlePath(o.hole, cx, cy);
    var n = o.weights != null ? o.weights : arms * 2;
    var weights = [];
    for (var i = 0; i < n; i++) {
      var a = (o.phase != null ? o.phase : -Math.PI / 2) + (TAU * (i + 0.5)) / n;
      var p = pt(R - rim / 2, a, cx, cy);
      weights.push({ x: p[0], y: p[1], angle: a });
    }
    return { d: d, weights: weights, radius: R };
  }

  /**
   * Hairspring (Archimedean spiral, optional Breguet overcoil hint).
   * o.inner, o.outer radii, o.turns (default 12), o.twist (radians, current balance
   * rotation: inner end turns fully, outer end fixed at the stud => realistic "breathing"),
   * o.samples per turn (default 40), o.phase start angle of the outer end.
   * Returns path d (stroke it, fill none).
   */
  function hairspringPath(o) {
    var r0 = o.inner, r1 = o.outer;
    var turns = o.turns || 12;
    var twist = o.twist || 0;
    var phase = o.phase || 0;
    var cx = o.cx || 0, cy = o.cy || 0;
    var n = Math.max(16, Math.round(turns * (o.samples || 40)));
    var out = '';
    for (var i = 0; i <= n; i++) {
      var u = i / n;                       // 0 = inner (collet) … 1 = outer (stud)
      var a = phase - (1 - u) * turns * TAU + twist * (1 - u);
      var rho = lerp(r0, r1, u) * (1 + 0.012 * twist * Math.sin(u * Math.PI));
      var p = pt(rho, a, cx, cy);
      out += (i ? 'L' : 'M') + p[0] + ' ' + p[1];
    }
    if (o.breguet) {                       // terminal curve lifting towards the centre
      var end = pt(r1, phase, cx, cy);
      var c1 = pt(r1 * 1.08, phase + 0.5, cx, cy);
      var e2 = pt(r1 * 0.72, phase + 1.25, cx, cy);
      out += 'Q' + c1[0] + ' ' + c1[1] + ' ' + e2[0] + ' ' + e2[1];
      void end;
    }
    return out;
  }

  /* ------------------------------------------------------------------ *
   * ESCAPEMENT GEOMETRY (Swiss lever)
   * ------------------------------------------------------------------ */

  /**
   * Layout for a Swiss lever escapement, in the escape-wheel frame (escape centre = 0,0),
   * pallet pivot straight above (−y), balance above the pallet.
   * R = escape-wheel tip radius. Embrace 60° (2.5 teeth of a 15-tooth wheel),
   * pallet centre distance R/cos30° (tangential locking).
   * Returns {
   *   escape:{x,y,r}, pallet:{x,y}, balance:{x,y}, leverLength, rollerRadius, pinRadius,
   *   stones:[{x,y,angle,len,w,name}] (in PALLET-LOCAL coords, pivot at 0,0; angle in deg),
   *   forkD (pallet-local path, fill evenodd), swingDeg (pallet half-swing), liftDeg
   * }
   * Usage: <g transform="translate(pallet.x pallet.y) rotate(palletAngle)"> draw forkD + stones </g>
   */
  function escapementLayout(R, o) {
    o = o || {};
    var d = R / Math.cos(30 * RAD);
    var lever = o.leverLength || R * 0.95;
    var roller = o.rollerRadius || R * 0.26;
    var lift = o.liftDeg || 52;
    var swing = (lift / 2) * RAD * roller / lever * DEG; // pallet half-swing in degrees (≈ 7°)
    var P = { x: 0, y: -d };
    var stones = [];
    [-1, 1].forEach(function (side) {
      // locking point on the escape circle at ±30° from the line of centres
      var L = { x: side * R * Math.sin(30 * RAD), y: -R * Math.cos(30 * RAD) };
      var ang = Math.atan2(L.y, L.x) * DEG;          // radial direction from escape centre
      stones.push({
        name: side < 0 ? 'entree' : 'sortie',
        x: r2(L.x * 0.93 - P.x), y: r2(L.y * 0.93 - P.y), // working end (lock depth 7% R inside the tip circle), pallet-local
        angle: r2(ang), len: r2(R * 0.3), w: r2(R * 0.1)
      });
    });
    // Pallet body: two arms from pivot to the stones + lever to the fork (towards −y)
    var aw = R * 0.07;
    var sL = stones[0], sR = stones[1];
    var fork = -lever;
    var hornW = R * 0.1, notch = R * 0.055;
    var body =
      'M' + r2(sL.x - aw) + ' ' + r2(sL.y - R * 0.12) +
      'Q' + r2(-R * 0.25) + ' ' + r2(-R * 0.02) + ' ' + r2(-aw * 1.2) + ' ' + r2(-aw * 0.6) +
      'L' + r2(-aw * 0.55) + ' ' + r2(fork + R * 0.14) +
      'L' + r2(-hornW - notch * 0.2) + ' ' + r2(fork + R * 0.06) +
      'Q' + r2(-hornW * 1.9) + ' ' + r2(fork - R * 0.05) + ' ' + r2(-hornW * 1.7) + ' ' + r2(fork - R * 0.12) +
      'L' + r2(-notch) + ' ' + r2(fork - R * 0.02) +
      'L' + r2(-notch) + ' ' + r2(fork + R * 0.05) +
      'A' + r2(notch) + ' ' + r2(notch) + ' 0 0 0 ' + r2(notch) + ' ' + r2(fork + R * 0.05) +
      'L' + r2(notch) + ' ' + r2(fork - R * 0.02) +
      'L' + r2(hornW * 1.7) + ' ' + r2(fork - R * 0.12) +
      'Q' + r2(hornW * 1.9) + ' ' + r2(fork - R * 0.05) + ' ' + r2(hornW + notch * 0.2) + ' ' + r2(fork + R * 0.06) +
      'L' + r2(aw * 0.55) + ' ' + r2(fork + R * 0.14) +
      'L' + r2(aw * 1.2) + ' ' + r2(-aw * 0.6) +
      'Q' + r2(R * 0.25) + ' ' + r2(-R * 0.02) + ' ' + r2(sR.x + aw) + ' ' + r2(sR.y - R * 0.12) +
      'L' + r2(sR.x - aw * 0.4) + ' ' + r2(sR.y - R * 0.1) +
      'Q' + r2(R * 0.12) + ' ' + r2(R * 0.1) + ' ' + r2(0) + ' ' + r2(R * 0.12) +
      'Q' + r2(-R * 0.12) + ' ' + r2(R * 0.1) + ' ' + r2(sL.x + aw * 0.4) + ' ' + r2(sL.y - R * 0.1) +
      'Z' + circlePath(R * 0.035, 0, 0);
    return {
      escape: { x: 0, y: 0, r: R },
      pallet: P,
      balance: { x: 0, y: r2(-d - lever - roller) },
      leverLength: lever, rollerRadius: roller, pinRadius: R * 0.035,
      stones: stones, forkD: body, swingDeg: swing, liftDeg: lift
    };
  }

  /** Ruby pallet stone path (pallet-local), from a stone descriptor of escapementLayout. */
  function palletStonePath(s) {
    var a = s.angle * RAD;
    var ux = Math.cos(a), uy = Math.sin(a);   // points AWAY from the escape centre
    var vx = -uy, vy = ux;
    var hw = s.w / 2;
    var bevel = s.w * 0.9;                    // impulse plane at the working end
    var p = [
      [s.x + vx * hw, s.y + vy * hw],
      [s.x - vx * hw + ux * bevel * 0.5, s.y - vy * hw + uy * bevel * 0.5],
      [s.x - vx * hw + ux * s.len, s.y - vy * hw + uy * s.len],
      [s.x + vx * hw + ux * s.len, s.y + vy * hw + uy * s.len]
    ];
    return 'M' + p.map(function (q) { return r2(q[0]) + ' ' + r2(q[1]); }).join('L') + 'Z';
  }

  /* ------------------------------------------------------------------ *
   * KINEMATICS — Calibre BR-01 (28 800 alt/h = 4 Hz)
   * ------------------------------------------------------------------ */
  var CALIBRE = {
    name: 'Calibre BR-01',
    freqHz: 4,                 // full oscillations per second
    beatsPerSecond: 8,         // alternations per second (28 800 / 3600)
    vph: 28800,
    amplitudeDeg: 285,         // balance amplitude (typical 270–310°)
    liftDeg: 52,               // lift angle
    escapeTeeth: 15,
    // Going train (teeth / pinion leaves) — the ratios are exact:
    // barrel 1 rev / 8 h, centre 1 rev / h, third 1 rev / 7.5 min, fourth 1 rev / min, escape 16 rev / min
    wheels: {
      barrel: { teeth: 80, revPerHour: 1 / 8, dir: 1 },
      centre: { teeth: 80, pinion: 10, revPerHour: 1, dir: -1 },
      third: { teeth: 75, pinion: 10, revPerHour: 8, dir: 1 },
      fourth: { teeth: 96, pinion: 10, revPerHour: 60, dir: -1 },
      escape: { teeth: 15, pinion: 6, revPerHour: 960, dir: 1 }
    },
    powerReserveHours: 72
  };

  /**
   * Swiss lever escapement state at time t (seconds).
   * Returns {
   *   balanceDeg        balance rotation (sinusoid, amplitude CALIBRE.amplitudeDeg)
   *   palletDeg         pallet fork rotation (±swing, moves only inside the lift arc)
   *   escapeDeg         cumulative escape-wheel rotation (+ = clockwise), 12° per beat
   *   beats             cumulative beats (continuous, integer steps between impulses)
   *   phase             'repos' | 'degagement' | 'impulsion' | 'chute'
   *   phaseLabel        French label ('Repos (arc supplémentaire)', 'Dégagement', 'Impulsion', 'Chute')
   *   progress          0..1 progress inside the current impulse window (0 when at rest)
   *   direction         +1 / −1 direction of the balance
   * }
   * o: { amplitudeDeg, freqHz, liftDeg, swingDeg } overrides.
   */
  function escapement(t, o) {
    o = o || {};
    var A = o.amplitudeDeg || CALIBRE.amplitudeDeg;
    var f = o.freqHz || CALIBRE.freqHz;
    var lift = o.liftDeg || CALIBRE.liftDeg;
    var swing = o.swingDeg || 7;
    var w = TAU * f;
    var theta = A * Math.sin(w * t);
    var dir = Math.cos(w * t) >= 0 ? 1 : -1;
    var half = 1 / (2 * f);                          // time between two beats
    var n = Math.round(t / half);                    // nearest zero crossing
    var dtc = t - n * half;
    var wHalf = Math.asin(Math.min(1, (lift / 2) / A)) / w;  // half-duration of the lift arc
    var s, phase = 'repos';
    if (dtc <= -wHalf) s = 0;
    else if (dtc >= wHalf) s = 1;
    else s = (dtc + wHalf) / (2 * wHalf);
    var inWindow = s > 0 && s < 1;
    var ease;
    if (!inWindow) ease = s;
    else if (s < 0.18) { phase = 'degagement'; ease = -0.02 * Math.sin((s / 0.18) * Math.PI); }       // slight recoil while unlocking
    else if (s < 0.88) { phase = 'impulsion'; ease = 0.86 * easeInOut((s - 0.18) / 0.7); }
    else { phase = 'chute'; ease = lerp(0.86, 1, easeOut((s - 0.88) / 0.12)); }
    var beats = (n - 1) + ease;
    var labels = { repos: 'Repos (arc supplémentaire)', degagement: 'Dégagement', impulsion: 'Impulsion', chute: 'Chute' };
    return {
      balanceDeg: theta,
      palletDeg: -swing * clamp(theta / (lift / 2), -1, 1),
      escapeDeg: beats * (360 / CALIBRE.escapeTeeth / 2),
      beats: beats,
      phase: phase,
      phaseLabel: labels[phase],
      progress: inWindow ? s : 0,
      direction: dir
    };
  }

  /**
   * Going-train angles (DEGREES, cumulative, signed so meshing wheels counter-rotate)
   * derived from an escapement state (or from a time in seconds).
   * Returns { escape, fourth, third, centre, barrel }.
   * fourth = seconds wheel (1 rev/min), centre = minutes (1 rev/h).
   */
  function train(state) {
    if (typeof state === 'number') state = escapement(state);
    var e = state.escapeDeg;
    var W = CALIBRE.wheels;
    return {
      escape: e * W.escape.dir,
      fourth: (e / 16) * W.fourth.dir,
      third: (e / 16 / 7.5) * W.third.dir,
      centre: (e / 16 / 60) * W.centre.dir,
      barrel: (e / 16 / 60 / 8) * W.barrel.dir
    };
  }

  /**
   * Hand angles (DEGREES, 0 = 12 o'clock, clockwise) for a Date (default now).
   * The seconds hand advances in 8 small steps per second, like a real 4 Hz calibre.
   */
  function hands(date) {
    date = date || new Date();
    var ms = date.getMilliseconds();
    var s = date.getSeconds() + Math.floor(ms / 125) * 0.125;
    var m = date.getMinutes() + s / 60;
    var h = (date.getHours() % 12) + m / 60;
    return { hour: h * 30, minute: m * 6, second: s * 6 };
  }

  /**
   * Rotation (radians) to give gear B so its teeth mesh with gear A.
   * nA, nB teeth; theta = direction (radians) from A's centre to B's centre;
   * rotA = current rotation of A (radians, tooth 0 of A at angle rotA).
   * Centre distance for meshing = pitchRadiusA + pitchRadiusB.
   */
  function meshRotation(nA, nB, theta, rotA) {
    return theta + Math.PI + Math.PI / nB - (nA / nB) * ((rotA || 0) - theta);
  }

  /* ------------------------------------------------------------------ *
   * SVG DOM helpers
   * ------------------------------------------------------------------ */
  function el(tag, attrs, children) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (children) children.forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  /** Blued screw (heat-blued, slotted) as an SVG <g>. o: { x, y, r, slot (deg) } */
  function screw(o) {
    var r = o.r || 6;
    var a = (o.slot != null ? o.slot : 35);
    return el('g', { class: 'bg-screw', transform: 'translate(' + r2(o.x || 0) + ' ' + r2(o.y || 0) + ')' }, [
      el('circle', { r: r2(r * 1.18), fill: 'url(#bg-steel)', opacity: '0.9' }),
      el('circle', { r: r2(r), fill: 'url(#bg-blued)' }),
      el('rect', { x: r2(-r * 0.95), y: r2(-r * 0.13), width: r2(r * 1.9), height: r2(r * 0.26), rx: r2(r * 0.06), fill: '#08101f', transform: 'rotate(' + a + ')' }),
      el('circle', { r: r2(r), fill: 'none', stroke: 'rgba(160,190,255,.35)', 'stroke-width': r2(r * 0.08) })
    ]);
  }

  /** Ruby jewel in a gold chaton as an SVG <g>. o: { x, y, r, hole, chaton (bool, default true) } */
  function jewel(o) {
    var r = o.r || 5;
    var hole = o.hole != null ? o.hole : r * 0.28;
    var kids = [];
    if (o.chaton !== false) kids.push(el('circle', { r: r2(r * 1.55), fill: 'url(#bg-gold)', stroke: 'rgba(0,0,0,.35)', 'stroke-width': r2(r * 0.06) }));
    kids.push(el('circle', { r: r2(r), fill: 'url(#bg-ruby)' }));
    kids.push(el('circle', { r: r2(hole), fill: '#1a0306' }));
    kids.push(el('ellipse', { cx: r2(-r * 0.35), cy: r2(-r * 0.4), rx: r2(r * 0.32), ry: r2(r * 0.18), fill: 'rgba(255,220,225,.55)', transform: 'rotate(-35 ' + r2(-r * 0.35) + ' ' + r2(-r * 0.4) + ')' }));
    return el('g', { class: 'bg-jewel', transform: 'translate(' + r2(o.x || 0) + ' ' + r2(o.y || 0) + ')' }, kids);
  }

  /**
   * Injects ONE hidden <svg> with shared paint servers (call once; idempotent).
   * IDs available everywhere in the document:
   *   Gradients: #bg-gold  #bg-gold-radial  #bg-brass  #bg-steel  #bg-steel-radial
   *              #bg-blued  #bg-ruby  #bg-rhodium (silvery bridge plating)
   *   Patterns : #bg-cotes (côtes de Genève stripes, userSpace, 24u period)
   *              #bg-perlage (circular graining, userSpace, 12u cell)
   *   Filters  : #bg-shadow (soft drop shadow), #bg-glow (warm glow)
   */
  function ensureDefs() {
    if (document.getElementById('bg-defs')) return;
    var svg = el('svg', { id: 'bg-defs', width: '0', height: '0', 'aria-hidden': 'true', focusable: 'false', style: 'position:absolute;width:0;height:0;overflow:hidden' });
    var defs = el('defs');
    function lin(id, stops, x2, y2) {
      var g = el('linearGradient', { id: id, x1: '0', y1: '0', x2: x2 || '1', y2: y2 || '1' });
      stops.forEach(function (s) { g.appendChild(el('stop', { offset: s[0], 'stop-color': s[1] })); });
      defs.appendChild(g);
    }
    function rad(id, stops, cx, cy, r) {
      var g = el('radialGradient', { id: id, cx: cx || '0.4', cy: cy || '0.35', r: r || '0.75' });
      stops.forEach(function (s) { g.appendChild(el('stop', { offset: s[0], 'stop-color': s[1] })); });
      defs.appendChild(g);
    }
    lin('bg-gold', [['0', '#f1dca4'], ['0.35', '#c9a45c'], ['0.62', '#8a6a2f'], ['0.85', '#d9b977'], ['1', '#7a5a24']]);
    rad('bg-gold-radial', [['0', '#f6e6b8'], ['0.5', '#c9a45c'], ['1', '#6f521f']]);
    lin('bg-brass', [['0', '#d8bf86'], ['0.5', '#a8844a'], ['1', '#6b5128']]);
    lin('bg-steel', [['0', '#eef1f4'], ['0.4', '#9aa3ad'], ['0.7', '#5a626c'], ['1', '#c9cfd6']]);
    rad('bg-steel-radial', [['0', '#f4f6f8'], ['0.6', '#8e97a1'], ['1', '#3d434a']]);
    lin('bg-rhodium', [['0', '#dfe3e8'], ['0.5', '#aab2bb'], ['1', '#79828c']]);
    rad('bg-blued', [['0', '#7c9cf0'], ['0.45', '#2d4fb3'], ['1', '#0f1f52']], '0.35', '0.3', '0.8');
    rad('bg-ruby', [['0', '#ff8a9c'], ['0.35', '#e0405a'], ['0.75', '#b3122e'], ['1', '#5a0614']], '0.38', '0.32', '0.8');

    // Côtes de Genève: soft repeating bands
    var cotes = el('pattern', { id: 'bg-cotes', patternUnits: 'userSpaceOnUse', width: '24', height: '24', patternTransform: 'rotate(-18)' });
    var cg = el('linearGradient', { id: 'bg-cotes-band', x1: '0', y1: '0', x2: '1', y2: '0' });
    [['0', 'rgba(255,255,255,0)'], ['0.45', 'rgba(255,255,255,0.22)'], ['0.55', 'rgba(255,255,255,0.05)'], ['0.9', 'rgba(0,0,0,0.18)'], ['1', 'rgba(0,0,0,0.25)']].forEach(function (s) { cg.appendChild(el('stop', { offset: s[0], 'stop-color': s[1] })); });
    defs.appendChild(cg);
    cotes.appendChild(el('rect', { width: '24', height: '24', fill: 'url(#bg-cotes-band)' }));
    defs.appendChild(cotes);

    // Perlage: overlapping circular grains
    var pr = el('radialGradient', { id: 'bg-perle', cx: '0.45', cy: '0.45', r: '0.55' });
    [['0', 'rgba(255,255,255,0.28)'], ['0.55', 'rgba(255,255,255,0.05)'], ['0.8', 'rgba(0,0,0,0.12)'], ['1', 'rgba(0,0,0,0.28)']].forEach(function (s) { pr.appendChild(el('stop', { offset: s[0], 'stop-color': s[1] })); });
    defs.appendChild(pr);
    var perl = el('pattern', { id: 'bg-perlage', patternUnits: 'userSpaceOnUse', width: '12', height: '12' });
    [[0, 0], [12, 0], [0, 12], [12, 12], [6, 6]].forEach(function (c) {
      perl.appendChild(el('circle', { cx: c[0], cy: c[1], r: '6.6', fill: 'url(#bg-perle)' }));
    });
    defs.appendChild(perl);

    var sh = el('filter', { id: 'bg-shadow', x: '-20%', y: '-20%', width: '140%', height: '140%' });
    sh.appendChild(el('feDropShadow', { dx: '0', dy: '2', stdDeviation: '2.5', 'flood-color': '#000', 'flood-opacity': '0.55' }));
    defs.appendChild(sh);
    var gl = el('filter', { id: 'bg-glow', x: '-50%', y: '-50%', width: '200%', height: '200%' });
    gl.appendChild(el('feGaussianBlur', { stdDeviation: '4', result: 'b' }));
    gl.appendChild(el('feMerge', null, [el('feMergeNode', { in: 'b' }), el('feMergeNode', { in: 'SourceGraphic' })]));
    defs.appendChild(gl);

    svg.appendChild(defs);
    (document.body || document.documentElement).insertBefore(svg, (document.body || document.documentElement).firstChild);
  }

  /* ------------------------------------------------------------------ *
   * TICKER — one shared requestAnimationFrame loop
   * ------------------------------------------------------------------ */
  var mq = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var reduced = !!(mq && mq.matches);
  var reducedListeners = [];
  var subs = [];
  var rafId = 0;
  var io = null;

  function isActive(s) {
    if (!s.playing || !s.visible || document.hidden) return false;
    if (reduced && s.reduced === 'static') return false;
    return true;
  }

  var timerId = 0;
  function frame(now) {
    rafId = 0;
    var any = false, soonest = Infinity;
    // iterate over a snapshot: callbacks may remove() themselves (or others) mid-loop
    var list = subs.slice();
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (subs.indexOf(s) < 0) continue;
      if (!isActive(s)) { s.lastNow = 0; continue; }
      any = true;
      var minGap = s.fps ? 1000 / s.fps : 0;
      if (reduced && typeof s.reduced === 'number') minGap = 1000 / s.reduced;
      if (s.lastNow && minGap && now - s.lastCall < minGap - 2) { soonest = Math.min(soonest, s.lastCall + minGap - now); continue; }
      var dt = s.lastNow ? Math.min((now - s.lastNow) / 1000, 0.1) : 0;
      s.lastNow = now; s.lastCall = now;
      soonest = Math.min(soonest, minGap);
      var sdt = dt * s.speed;
      s.time += sdt;
      try { s.fn({ time: s.time, dt: sdt, now: now, reduced: reduced, handle: s.handle }); }
      catch (e) { if (global.console) console.error('[BulrogGears.ticker]', e); }
    }
    if (!any || rafId || timerId) return;
    // only slow subscribers (e.g. 1 fps clocks under reduced motion): sleep instead of spinning at 60 Hz
    if (soonest >= 100 && soonest !== Infinity) {
      timerId = global.setTimeout(function () { timerId = 0; if (!rafId) rafId = global.requestAnimationFrame(frame); }, soonest - 12);
    } else rafId = global.requestAnimationFrame(frame);
  }

  function wake() {
    if (rafId || !subs.some(isActive)) return;
    if (timerId) { global.clearTimeout(timerId); timerId = 0; }
    rafId = global.requestAnimationFrame(frame);
  }

  function renderStatic(s) {
    try { s.fn({ time: s.time, dt: 0, now: global.performance ? performance.now() : Date.now(), reduced: reduced, handle: s.handle }); }
    catch (e) { if (global.console) console.error('[BulrogGears.ticker]', e); }
  }

  function getIO() {
    if (io || !('IntersectionObserver' in global)) return io;
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        subs.forEach(function (s) {
          if (s.el === en.target) {
            var was = s.visible;
            s.visible = en.isIntersecting;
            if (s.visible && !was && reduced && s.reduced === 'static') renderStatic(s);
          }
        });
      });
      wake();
    }, { rootMargin: '120px 0px' });
    return io;
  }

  /**
   * Register an animation callback on the shared loop.
   *   fn({ time, dt, now, reduced, handle }) — `time` = this subscriber's own clock in seconds
   *     (advances only while running, scaled by handle.speed; dt is clamped to 0.1 s).
   * opts:
   *   el       Element whose visibility gates the animation (IntersectionObserver). Strongly recommended.
   *   fps      Optional frame cap (e.g. 30 for heavy canvases).
   *   reduced  Behaviour under prefers-reduced-motion:
   *              'static' (default) → no loop; fn is called once with dt=0 so a still frame is drawn.
   *              'run'              → keeps animating (use only for tiny, non-vestibular motion).
   *              <number>           → runs at that many fps (e.g. 1 for a clock updating each second).
   *   time     Initial clock value (seconds).
   *   autoplay default true.
   * Returns handle { play(), pause(), toggle(), remove(), renderOnce(), speed (get/set), time (get/set), playing (get) }
   */
  function add(fn, opts) {
    opts = opts || {};
    var s = {
      fn: fn, el: opts.el || null, fps: opts.fps || 0,
      reduced: opts.reduced != null ? opts.reduced : 'static',
      speed: opts.speed != null ? opts.speed : 1,
      time: opts.time || 0, lastNow: 0, lastCall: 0,
      playing: opts.autoplay !== false,
      visible: true
    };
    var handle = {
      play: function () { s.playing = true; wake(); return handle; },
      pause: function () { s.playing = false; return handle; },
      toggle: function () { return s.playing ? handle.pause() : handle.play(); },
      remove: function () {
        var i = subs.indexOf(s); if (i >= 0) subs.splice(i, 1);
        if (s.el && io && !subs.some(function (o) { return o.el === s.el; })) io.unobserve(s.el);
      },
      renderOnce: function () { renderStatic(s); return handle; },
      get speed() { return s.speed; }, set speed(v) { s.speed = v; },
      get time() { return s.time; }, set time(v) { s.time = v; },
      get playing() { return s.playing; }
    };
    s.handle = handle;
    subs.push(s);
    if (s.el) {
      var obs = getIO();
      if (obs) { s.visible = false; obs.observe(s.el); }
    }
    renderStatic(s);   // always paint a first frame immediately
    wake();
    return handle;
  }

  document.addEventListener('visibilitychange', function () { if (!document.hidden) wake(); });
  if (mq) {
    var onMq = function () {
      reduced = mq.matches;
      reducedListeners.forEach(function (cb) { try { cb(reduced); } catch (e) { /* noop */ } });
      if (reduced) subs.forEach(function (s) { if (s.reduced === 'static' && s.visible) renderStatic(s); });
      wake();
    };
    if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
  }

  global.BulrogGears = {
    version: '1.0.0',
    TAU: TAU, RAD: RAD, DEG: DEG, SVGNS: SVGNS,
    CALIBRE: CALIBRE,
    // geometry
    gear: gear, pinion: pinion, teethPath: teethPath, windowsPath: windowsPath,
    escapeWheel: escapeWheel, balanceWheel: balanceWheel, hairspringPath: hairspringPath,
    escapementLayout: escapementLayout, palletStonePath: palletStonePath,
    circlePath: circlePath, ringPath: ringPath, meshRotation: meshRotation, polar: pt,
    // kinematics
    escapement: escapement, train: train, hands: hands,
    // svg
    el: el, screw: screw, jewel: jewel, ensureDefs: ensureDefs,
    // animation
    ticker: { add: add, get count() { return subs.length; } },
    get reducedMotion() { return reduced; },
    onReducedMotionChange: function (cb) { reducedListeners.push(cb); },
    // math utils
    util: { clamp: clamp, lerp: lerp, easeInOut: easeInOut, easeOut: easeOut, round: r2 }
  };
})(window);
