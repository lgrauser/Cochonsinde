/*!
 * BULROG — collection.js (owner: builder D, prefix "coll-")
 * Sections #collection, #manufacture, #rendez-vous and the footer.
 *  - Draws three product-shot watches procedurally (SVG): case with conic
 *    metal shading, lugs, knurled crown, sunray / enamel / skeleton dials,
 *    applied indexes, hands at live local time (BulrogGears.hands()).
 *  - Ossature 42: openworked dial revealing a meshing going train, escape
 *    wheel, pallet fork and a 4 Hz balance (BulrogGears.escapement / meshRotation).
 *  - "Voir le fond saphir": flips each watch to its caseback — BR-01 with
 *    côtes de Genève, perlage, rose-gold rotor, blued screws, beating balance.
 *  - Timeline activation, figure counters, appointment form (client-side
 *    validation, aria messages, no network), model pre-selection.
 * All animation goes through BulrogGears.ticker (offscreen / hidden / reduced motion aware).
 */
(function () {
  'use strict';

  var G = window.BulrogGears;
  var doc = document;
  var TAU = Math.PI * 2;
  var RAD = Math.PI / 180;

  /* ====================================================================== *
   * Small helpers
   * ====================================================================== */
  function E(tag, attrs, kids) { return G.el(tag, attrs, kids); }
  function r2(n) { return Math.round(n * 100) / 100; }
  function P(r, a) { return [r2(r * Math.cos(a)), r2(r * Math.sin(a))]; }   // a in radians, 0 = 3 h
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hex(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function mix(a, b, t) {
    var A = hex(a), B = hex(b);
    return 'rgb(' + Math.round(A[0] + (B[0] - A[0]) * t) + ',' + Math.round(A[1] + (B[1] - A[1]) * t) + ',' + Math.round(A[2] + (B[2] - A[2]) * t) + ')';
  }
  /** Colour along a dark→light palette (array of hex), l in [0,1]. */
  function ramp(pal, l) {
    l = clamp(l, 0, 1) * (pal.length - 1);
    var i = Math.min(pal.length - 2, Math.floor(l));
    return mix(pal[i], pal[i + 1], l - i);
  }
  function rng(seed) {                         // mulberry32
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function defsOf(node) { return (node.ownerSVGElement || node).querySelector('defs'); }
  function angDiff(a, b) { var d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }

  /** Annular sector path (radians). ri = 0 → pie wedge. */
  function sector(ro, ri, a0, a1) {
    var p0 = P(ro, a0), p1 = P(ro, a1);
    var large = (a1 - a0) > Math.PI ? 1 : 0;
    var d = 'M' + p0[0] + ' ' + p0[1] + 'A' + ro + ' ' + ro + ' 0 ' + large + ' 1 ' + p1[0] + ' ' + p1[1];
    if (ri > 0) {
      var q1 = P(ri, a1), q0 = P(ri, a0);
      d += 'L' + q1[0] + ' ' + q1[1] + 'A' + ri + ' ' + ri + ' 0 ' + large + ' 0 ' + q0[0] + ' ' + q0[1];
    } else d += 'L0 0';
    return d + 'Z';
  }
  /** Poor man's conic gradient: n wedges whose colour = fn(midAngle). */
  function conic(parent, ro, ri, n, fn, attrs) {
    var g = E('g', attrs || {});
    var step = TAU / n;
    for (var i = 0; i < n; i++) {
      var a0 = i * step - Math.PI / 2, a1 = a0 + step + 0.006;
      g.appendChild(E('path', { d: sector(ro, ri, a0, a1), fill: fn(a0 + step / 2, i) }));
    }
    parent.appendChild(g);
    return g;
  }
  function lin(defs, id, stops, x1, y1, x2, y2, extra) {
    var a = { id: id, x1: x1 == null ? 0 : x1, y1: y1 == null ? 0 : y1, x2: x2 == null ? 1 : x2, y2: y2 == null ? 1 : y2 };
    if (extra) for (var k in extra) a[k] = extra[k];
    var g = E('linearGradient', a);
    stops.forEach(function (s) { g.appendChild(E('stop', { offset: s[0], 'stop-color': s[1], 'stop-opacity': s[2] == null ? 1 : s[2] })); });
    defs.appendChild(g); return g;
  }
  function rad(defs, id, stops, cx, cy, r, extra) {
    var a = { id: id, cx: cx == null ? 0.5 : cx, cy: cy == null ? 0.5 : cy, r: r == null ? 0.5 : r };
    if (extra) for (var k in extra) a[k] = extra[k];
    var g = E('radialGradient', a);
    stops.forEach(function (s) { g.appendChild(E('stop', { offset: s[0], 'stop-color': s[1], 'stop-opacity': s[2] == null ? 1 : s[2] })); });
    defs.appendChild(g); return g;
  }

  /* ====================================================================== *
   * Materials
   * ====================================================================== */
  var METALS = {
    steel: { pal: ['#23272c', '#555c64', '#8e969f', '#c9cfd6', '#f4f6f8'], contrast: 1, name: 'acier' },
    rose:  { pal: ['#3d1c10', '#7e4430', '#bf7f60', '#e9b89b', '#fde4d3'], contrast: 1, name: 'or rose' },
    ti:    { pal: ['#1f2124', '#35383c', '#50545a', '#6f747a', '#979ca3'], contrast: 0.55, name: 'titane' }
  };
  var LIGHT = -2.25;   // key light from the upper-left (radians)

  /** Polished metal reflection as a function of the surface normal angle a. */
  function sheen(a, k) {
    var d = angDiff(a, LIGHT);
    var v = 0.48 + 0.26 * Math.cos(2 * d) + 0.14 * Math.cos(d) + 0.34 * Math.exp(-(d * d) / 0.035) + 0.22 * Math.exp(-Math.pow(angDiff(a, LIGHT + Math.PI), 2) / 0.02);
    return 0.5 + (v - 0.5) * (k == null ? 1 : k);
  }

  var MODELS = {
    'joux-40': {
      diam: 40, metal: 'steel', dial: 'sunray', hands: 'dauphine', strap: 'croco', strapCol: ['#050505', '#15151a', '#262629'], stitch: '#3b3a38',
      handPal: ['#6e521f', '#c9a45c', '#f3dfa8'], index: 'gold', label: 'Joux 40'
    },
    'risoud-41': {
      diam: 41, metal: 'rose', dial: 'enamel', hands: 'leaf', strap: 'croco', strapCol: ['#1e0f07', '#3c2213', '#5a3620'], stitch: '#7c5c42',
      handPal: ['#7a3d27', '#d99676', '#fbd9c3'], index: 'rose', label: 'Risoud 41'
    },
    'ossature-42': {
      diam: 42, metal: 'ti', dial: 'skeleton', hands: 'baton', strap: 'rubber', strapCol: ['#08090a', '#141518', '#212327'], stitch: null,
      handPal: ['#5d646c', '#c9cfd6', '#f4f6f8'], index: 'rhodium', label: 'Ossature 42'
    }
  };
  var MM = 6.4;           // SVG units per millimetre
  var LUG_HALF = 64;      // 20 mm lug width

  /* ====================================================================== *
   * Case, lugs, crown, strap (shared by front & back)
   * ====================================================================== */
  function buildDefsCommon(defs, id, m, R) {
    var pal = METALS[m.metal].pal;
    lin(defs, id + 'lug', [[0, pal[1]], [0.25, pal[3]], [0.5, pal[4]], [0.7, pal[2]], [1, pal[0]]], 0, 0, 1, 0);
    lin(defs, id + 'lugtop', [[0, pal[3]], [0.5, pal[2]], [1, pal[1]]], 0, 0, 0, 1);
    lin(defs, id + 'crown', [[0, pal[0]], [0.3, pal[3]], [0.45, pal[4]], [0.6, pal[2]], [1, pal[0]]], 0, 0, 0, 1);
    // knurling (ridges parallel to the crown axis)
    var kn = E('pattern', { id: id + 'knurl', patternUnits: 'userSpaceOnUse', width: 4, height: 2.6 });
    kn.appendChild(E('rect', { width: 4, height: 1.1, fill: 'rgba(0,0,0,.45)' }));
    defs.appendChild(kn);
    // strap
    var sc = m.strapCol;
    lin(defs, id + 'strapshade', [[0, '#000', 0.75], [0.14, '#000', 0.15], [0.5, '#fff', 0.06], [0.86, '#000', 0.15], [1, '#000', 0.8]], 0, 0, 1, 0);
    lin(defs, id + 'strapfade', [[0, '#fff', 0], [0.55, '#fff', 1], [1, '#fff', 1]], 0, 0, 0, 1);
    lin(defs, id + 'strapfade2', [[0, '#fff', 1], [0.45, '#fff', 1], [1, '#fff', 0]], 0, 0, 0, 1);
    var mask = E('mask', { id: id + 'strapmask', maskUnits: 'userSpaceOnUse', x: -180, y: -240, width: 360, height: 480 });
    mask.appendChild(E('rect', { x: -180, y: -240, width: 360, height: 130, fill: 'url(#' + id + 'strapfade)' }));
    mask.appendChild(E('rect', { x: -180, y: -111, width: 360, height: 222, fill: '#fff' }));
    mask.appendChild(E('rect', { x: -180, y: 110, width: 360, height: 130, fill: 'url(#' + id + 'strapfade2)' }));
    defs.appendChild(mask);
    if (m.strap === 'croco') {
      // procedural alligator scales: rows of rounded rectangles, larger at the centre
      rad(defs, id + 'bump', [[0, '#fff', 0.07], [0.6, '#fff', 0], [0.9, '#000', 0.12], [1, '#000', 0.4]], 0.45, 0.4, 0.72);
      var pat = E('pattern', { id: id + 'croco', patternUnits: 'userSpaceOnUse', width: 132, height: 120, x: -66 });
      pat.appendChild(E('rect', { width: 132, height: 120, fill: sc[0] }));
      var rnd = rng(m.diam * 97);
      var y = 0;
      while (y < 120) {
        var h = 11 + rnd() * 9; if (y + h > 120) h = 120 - y;
        var x = -rnd() * 10;
        while (x < 132) {
          var dc = Math.abs(x + 12 - 66) / 66;                 // 0 at the centre line
          var w = (dc < 0.35 ? 20 : 11) + rnd() * (dc < 0.35 ? 10 : 7);
          if (x + w > 132) w = 132 - x;
          if (x < 0) { w += x; x = 0; }
          if (w > 3 && h > 3) {
            pat.appendChild(E('rect', { x: r2(x + 0.6), y: r2(y + 0.6), width: r2(w - 1.2), height: r2(h - 1.2), rx: r2(Math.min(w, h) * 0.2), fill: mix(sc[1], sc[2], rnd() * 0.8) }));
            pat.appendChild(E('rect', { x: r2(x + 0.6), y: r2(y + 0.6), width: r2(w - 1.2), height: r2(h - 1.2), rx: r2(Math.min(w, h) * 0.2), fill: 'url(#' + id + 'bump)' }));
          }
          x += w;
        }
        y += h;
      }
      defs.appendChild(pat);
    } else {
      var rp = E('pattern', { id: id + 'rubber', patternUnits: 'userSpaceOnUse', width: 20, height: 9 });
      rp.appendChild(E('rect', { width: 20, height: 9, fill: sc[1] }));
      rp.appendChild(E('rect', { y: 0, width: 20, height: 2.2, fill: sc[0] }));
      rp.appendChild(E('rect', { y: 2.2, width: 20, height: 0.7, fill: '#fff', opacity: 0.06 }));
      defs.appendChild(rp);
    }
    rad(defs, id + 'shadow', [[0, '#000', 0.75], [0.6, '#000', 0.35], [1, '#000', 0]]);
    // titanium microbilled grain
    if (m.metal === 'ti') {
      var f = E('filter', { id: id + 'grain', x: 0, y: 0, width: 1, height: 1 });
      f.appendChild(E('feTurbulence', { type: 'fractalNoise', baseFrequency: 1.6, numOctaves: 1, seed: 4, result: 'n' }));
      f.appendChild(E('feColorMatrix', { in: 'n', type: 'matrix', values: '0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .22 0', result: 'g' }));
      f.appendChild(E('feComposite', { in: 'g', in2: 'SourceGraphic', operator: 'in', result: 'gi' }));
      f.appendChild(E('feBlend', { in: 'gi', in2: 'SourceGraphic', mode: 'screen' }));
      defs.appendChild(f);
    }
  }

  function strapPath(dir, R) {
    // dir = -1 (top) / +1 (bottom); from under the case to the viewBox edge, slightly tapering
    var y0 = dir * (R * 0.72), y1 = dir * 240;
    var w0 = LUG_HALF - 1, w1 = LUG_HALF - 8;
    var ym = (y0 + y1) / 2;
    return 'M' + (-w0) + ' ' + y0 + 'C' + (-w0) + ' ' + ym + ' ' + (-w1) + ' ' + ym + ' ' + (-w1) + ' ' + y1 +
      'L' + w1 + ' ' + y1 + 'C' + w1 + ' ' + ym + ' ' + w0 + ' ' + ym + ' ' + w0 + ' ' + y0 + 'Z';
  }

  function drawStrap(svg, id, m, R) {
    var g = E('g', { mask: 'url(#' + id + 'strapmask)' });
    [-1, 1].forEach(function (dir) {
      var d = strapPath(dir, R);
      g.appendChild(E('path', { d: d, fill: 'url(#' + id + (m.strap === 'croco' ? 'croco' : 'rubber') + ')' }));
      g.appendChild(E('path', { d: d, fill: 'url(#' + id + 'strapshade)' }));
      if (m.stitch) {
        var y0 = dir * (R * 0.8), y1 = dir * 240;
        [-1, 1].forEach(function (s) {
          g.appendChild(E('path', { d: 'M' + s * (LUG_HALF - 6) + ' ' + y0 + 'Q' + s * (LUG_HALF - 7.5) + ' ' + ((y0 + y1) / 2) + ' ' + s * (LUG_HALF - 13) + ' ' + y1, fill: 'none', stroke: m.stitch, 'stroke-width': 1.1, 'stroke-dasharray': '3.2 2.4', 'stroke-linecap': 'round' }));
        });
      } else {
        // rubber: moulded centre channel
        g.appendChild(E('path', { d: 'M-14 ' + dir * (R * 0.95) + 'L-11 ' + dir * 240 + 'L11 ' + dir * 240 + 'L14 ' + dir * (R * 0.95) + 'Z', fill: '#000', opacity: 0.35 }));
        g.appendChild(E('path', { d: 'M-14 ' + dir * (R * 0.95) + 'L-11 ' + dir * 240, stroke: '#fff', 'stroke-opacity': 0.08, 'stroke-width': 1 }));
      }
    });
    svg.appendChild(g);
  }

  function drawLugs(svg, id, m, R) {
    var pal = METALS[m.metal].pal;
    var g = E('g', {});
    var x0 = LUG_HALF + 0.5, x1 = LUG_HALF + 15.5, yEnd = R + 36;
    [-1, 1].forEach(function (sx) {
      [-1, 1].forEach(function (sy) {
        var d = 'M' + sx * x0 + ' ' + sy * (R * 0.6) +
          'L' + sx * x0 + ' ' + sy * (yEnd - 3) +
          'Q' + sx * x0 + ' ' + sy * yEnd + ' ' + sx * (x0 + 3) + ' ' + sy * yEnd +
          'L' + sx * (x1 - 3) + ' ' + sy * yEnd +
          'Q' + sx * x1 + ' ' + sy * yEnd + ' ' + sx * (x1 + 0.5) + ' ' + sy * (yEnd - 4) +
          'C' + sx * (x1 + 2) + ' ' + sy * (R * 0.95) + ' ' + sx * (x1 + 5) + ' ' + sy * (R * 0.8) + ' ' + sx * (x1 + 9) + ' ' + sy * (R * 0.6) + 'Z';
        // soft contact shadow on the strap / table
        g.appendChild(E('path', { d: d, fill: '#000', opacity: 0.5, transform: 'translate(2.5 4)' }));
        g.appendChild(E('path', { d: d, fill: 'url(#' + id + 'lug)', transform: sx < 0 ? 'scale(1 1)' : '' }));
        // polished chamfer along the outer edge + satin top highlight
        g.appendChild(E('path', {
          d: 'M' + sx * (x1 + 0.5) + ' ' + sy * (yEnd - 4) + 'C' + sx * (x1 + 2) + ' ' + sy * (R * 0.95) + ' ' + sx * (x1 + 5) + ' ' + sy * (R * 0.8) + ' ' + sx * (x1 + 9) + ' ' + sy * (R * 0.6),
          fill: 'none', stroke: sx * sy < 0 ? pal[4] : pal[2], 'stroke-width': 1.4, opacity: 0.9
        }));
        g.appendChild(E('path', { d: 'M' + sx * (x0 + 4) + ' ' + sy * (R * 0.75) + 'L' + sx * (x0 + 4) + ' ' + sy * (yEnd - 3), stroke: pal[4], 'stroke-width': 1.2, opacity: sx < 0 ? 0.55 : 0.2 }));
        // spring-bar hole
        g.appendChild(E('circle', { cx: sx * (x0 + 7.5), cy: sy * (yEnd - 9), r: 1.5, fill: pal[0], opacity: 0.7 }));
      });
    });
    svg.appendChild(g);
  }

  function drawCrown(svg, id, m, R, side) {
    var pal = METALS[m.metal].pal;
    var s = side || 1;
    var g = E('g', { transform: side < 0 ? 'scale(-1 1)' : null });
    g.appendChild(E('rect', { x: R - 6, y: -7, width: 13, height: 14, fill: 'url(#' + id + 'crown)' }));   // tube
    g.appendChild(E('rect', { x: R + 5, y: -17.5, width: 20, height: 35, rx: 4, fill: '#000', opacity: 0.45, transform: 'translate(2 3)' }));
    g.appendChild(E('rect', { x: R + 5, y: -17.5, width: 20, height: 35, rx: 4, fill: 'url(#' + id + 'crown)' }));
    g.appendChild(E('rect', { x: R + 7.5, y: -17.5, width: 15, height: 35, fill: 'url(#' + id + 'knurl)' }));
    g.appendChild(E('rect', { x: R + 5, y: -17.5, width: 3, height: 35, rx: 1.5, fill: pal[3], opacity: 0.7 }));
    g.appendChild(E('rect', { x: R + 22, y: -17, width: 3, height: 34, rx: 1.5, fill: pal[4], opacity: 0.55 }));
    void s;
    svg.appendChild(g);
  }

  function drawCaseBody(svg, id, m, R, key) {
    var met = METALS[m.metal];
    var pal = met.pal;
    // ground shadow
    svg.appendChild(E('ellipse', { cx: 6, cy: 14, rx: R * 1.16, ry: R * 1.2, fill: 'url(#' + id + 'shadow)' }));
    // case middle: flank (dark edge), then the satin top face as a conic ring
    svg.appendChild(E('circle', { r: R + 1.2, fill: pal[0] }));
    var body = conic(svg, R, R * 0.9, 120, function (a, i) {
      var j = (rng(i * 13 + key)() - 0.5) * 0.05;
      return ramp(pal, 0.5 + (sheen(a, 0.55) - 0.5) * met.contrast + j);
    });
    if (m.metal === 'ti') body.setAttribute('filter', 'url(#' + id + 'grain)');
    // outer bevel highlight
    svg.appendChild(E('circle', { r: R - 0.4, fill: 'none', stroke: pal[4], 'stroke-width': 0.8, opacity: 0.35 }));
  }

  function drawBezel(svg, id, m, rOut, rIn) {
    var met = METALS[m.metal];
    var pal = met.pal;
    conic(svg, rOut, rIn, 144, function (a) { return ramp(pal, 0.5 + (sheen(a + 0.15, 1.15) - 0.5) * (m.metal === 'ti' ? 0.75 : 1)); });
    // polished inner step (opposite lighting = concave)
    conic(svg, rIn, rIn - 2.4, 72, function (a) { return ramp(pal, 1 - sheen(a, 0.9)); });
    svg.appendChild(E('circle', { r: rOut, fill: 'none', stroke: '#000', 'stroke-opacity': 0.35, 'stroke-width': 0.8 }));
    svg.appendChild(E('circle', { r: rIn - 2.4, fill: 'none', stroke: '#000', 'stroke-opacity': 0.6, 'stroke-width': 1 }));
  }

  /** Sapphire crystal: inner shadow, AR bluish bloom and two curved reflections. */
  function drawCrystal(svg, id, r) {
    var defs = defsOf(svg);
    rad(defs, id + 'xin', [[0, '#000', 0], [0.86, '#000', 0], [0.97, '#000', 0.35], [1, '#000', 0.65]]);
    lin(defs, id + 'xref', [[0, '#fff', 0.17], [0.35, '#fff', 0.06], [0.6, '#fff', 0]], 0, 0, 1, 1);
        var g = E('g', { 'pointer-events': 'none' });
    g.appendChild(E('circle', { r: r, fill: 'url(#' + id + 'xin)' }));
    // crescent reflection: the crystal disc minus an offset disc, fading toward the centre
    var cid = id + 'xclip';
    defs.appendChild(E('clipPath', { id: cid }, [E('circle', { r: r })]));
    var cr = E('g', { 'clip-path': 'url(#' + cid + ')' });
    cr.appendChild(E('path', { d: G.circlePath(r * 0.985) + G.circlePath(r * 1.04, r * 0.16, r * 0.24), 'fill-rule': 'evenodd', fill: 'url(#' + id + 'xref)' }));
    g.appendChild(cr);
    g.appendChild(E('path', { d: 'M' + P(r * 0.95, -2.75).join(' ') + 'A' + r2(r * 0.95) + ' ' + r2(r * 0.95) + ' 0 0 1 ' + P(r * 0.95, -2.05).join(' '), fill: 'none', stroke: '#fff', 'stroke-opacity': 0.35, 'stroke-width': 1.1, 'stroke-linecap': 'round' }));
    svg.appendChild(g);
  }

  /* ====================================================================== *
   * Hands
   * ====================================================================== */
  function handGrad(defs, id, pal) {
    // hard-edged facet: light left half, dark right half (turns with the hand)
    lin(defs, id, [[0, pal[2]], [0.5, pal[1]], [0.5, pal[0]], [1, pal[1]]], 0, 0, 1, 0);
  }
  function dauphine(L, w, tail) {
    return 'M0 ' + (-L) + 'L' + (-w) + ' ' + r2(-L * 0.06) + 'L' + r2(-w * 0.5) + ' ' + tail + 'L' + r2(w * 0.5) + ' ' + tail + 'L' + w + ' ' + r2(-L * 0.06) + 'Z';
  }
  function leaf(L, w, tail) {
    return 'M0 ' + (-L) +
      'C' + r2(w * 0.35) + ' ' + r2(-L * 0.84) + ' ' + r2(w * 1.2) + ' ' + r2(-L * 0.55) + ' ' + r2(w * 0.95) + ' ' + r2(-L * 0.32) +
      'C' + r2(w * 0.8) + ' ' + r2(-L * 0.2) + ' ' + r2(w * 0.3) + ' ' + r2(-L * 0.12) + ' ' + r2(w * 0.28) + ' 0' +
      'L' + r2(w * 0.2) + ' ' + tail + 'L' + r2(-w * 0.2) + ' ' + tail + 'L' + r2(-w * 0.28) + ' 0' +
      'C' + r2(-w * 0.3) + ' ' + r2(-L * 0.12) + ' ' + r2(-w * 0.8) + ' ' + r2(-L * 0.2) + ' ' + r2(-w * 0.95) + ' ' + r2(-L * 0.32) +
      'C' + r2(-w * 1.2) + ' ' + r2(-L * 0.55) + ' ' + r2(-w * 0.35) + ' ' + r2(-L * 0.84) + ' 0 ' + (-L) + 'Z';
  }
  function batonOpen(L, w, tail) {
    var o = 'M' + (-w) + ' ' + tail + 'L' + (-w) + ' ' + r2(-L + w) + 'L0 ' + (-L) + 'L' + w + ' ' + r2(-L + w) + 'L' + w + ' ' + tail + 'Z';
    var iw = w - 1.6;
    var i = 'M' + (-iw) + ' ' + r2(-8) + 'L' + (-iw) + ' ' + r2(-L * 0.62) + 'L' + iw + ' ' + r2(-L * 0.62) + 'L' + iw + ' -8Z';
    return o + i;
  }

  function buildHands(svg, id, m, Rd) {
    var defs = defsOf(svg);
    var pal = m.handPal;
    handGrad(defs, id + 'hand', pal);
    var gH = E('g', {}), gM = E('g', {}), gS = E('g', {});
    var sh = { fill: '#000', opacity: 0.5 };
    function add(g, d, fill, extra) {
      var sd = E('path', { d: d, fill: sh.fill, opacity: sh.opacity, transform: 'translate(1.6 2.6)', 'fill-rule': 'evenodd' });
      var p = E('path', { d: d, fill: fill, 'fill-rule': 'evenodd' });
      if (extra) for (var k in extra) p.setAttribute(k, extra[k]);
      g.appendChild(sd); g.appendChild(p);
      return p;
    }
    if (m.hands === 'dauphine') {
      add(gH, dauphine(Rd * 0.56, 5.4, 12), 'url(#' + id + 'hand)');
      add(gM, dauphine(Rd * 0.9, 4.4, 14), 'url(#' + id + 'hand)');
    } else if (m.hands === 'leaf') {
      add(gH, leaf(Rd * 0.55, 7.2, 11), 'url(#' + id + 'hand)');
      add(gM, leaf(Rd * 0.86, 5.6, 12), 'url(#' + id + 'hand)');
      gH.appendChild(E('circle', { r: 5.5, fill: 'none', stroke: pal[1], 'stroke-width': 1.4 }));
    } else {
      add(gH, batonOpen(Rd * 0.55, 4.2, 10), 'url(#' + id + 'hand)');
      add(gM, batonOpen(Rd * 0.86, 3.4, 12), 'url(#' + id + 'hand)');
      // luminescent tips
      gH.appendChild(E('path', { d: 'M-2.6 ' + r2(-Rd * 0.53) + 'L0 ' + r2(-Rd * 0.55 + 1) + 'L2.6 ' + r2(-Rd * 0.53) + 'L2.6 ' + r2(-Rd * 0.42) + 'L-2.6 ' + r2(-Rd * 0.42) + 'Z', fill: '#e4f0d6' }));
      gM.appendChild(E('path', { d: 'M-1.8 ' + r2(-Rd * 0.84) + 'L0 ' + r2(-Rd * 0.86 + 1) + 'L1.8 ' + r2(-Rd * 0.84) + 'L1.8 ' + r2(-Rd * 0.72) + 'L-1.8 ' + r2(-Rd * 0.72) + 'Z', fill: '#e4f0d6' }));
    }
    // seconds hand: fine needle + counterweight
    var sCol = m.hands === 'baton' ? '#e0405a' : pal[2];
    var sd = 'M-0.55 ' + r2(-Rd * 0.95) + 'L0.55 ' + r2(-Rd * 0.95) + 'L1 22L-1 22Z';
    gS.appendChild(E('path', { d: sd, fill: '#000', opacity: 0.45, transform: 'translate(2 3.4)' }));
    gS.appendChild(E('path', { d: sd, fill: sCol }));
    gS.appendChild(E('circle', { cy: 22, r: 3.6, fill: sCol }));
    gS.appendChild(E('circle', { cy: 22, r: 1.5, fill: '#0a0a0a', opacity: 0.6 }));
    if (m.hands === 'baton') gS.appendChild(E('circle', { cy: r2(-Rd * 0.74), r: 2.4, fill: '#e4f0d6', stroke: sCol, 'stroke-width': 0.8 }));
    var hub = E('g', {}, [
      E('circle', { r: 4.6, fill: pal[1] }),
      E('circle', { r: 3, fill: pal[2] }),
      E('circle', { r: 1.1, fill: pal[0] })
    ]);
    var g = E('g', { class: 'coll-hands' }, [gH, gM, gS, hub]);
    svg.appendChild(g);
    return function (a) {
      gH.setAttribute('transform', 'rotate(' + r2(a.hour) + ')');
      gM.setAttribute('transform', 'rotate(' + r2(a.minute) + ')');
      gS.setAttribute('transform', 'rotate(' + r2(a.second) + ')');
    };
  }

  /* ====================================================================== *
   * Dials
   * ====================================================================== */
  function appliedIndex(parent, a, r0, r1, w, pal) {
    var deg = a / RAD + 90;
    var g = E('g', { transform: 'rotate(' + r2(deg) + ')' });
    g.appendChild(E('rect', { x: -w / 2 + 1.2, y: -r1 + 1.8, width: w, height: r1 - r0, fill: '#000', opacity: 0.55, rx: 0.6 }));
    g.appendChild(E('rect', { x: -w / 2, y: -r1, width: w / 2, height: r1 - r0, fill: pal[2], rx: 0.4 }));
    g.appendChild(E('rect', { x: 0, y: -r1, width: w / 2, height: r1 - r0, fill: pal[0], rx: 0.4 }));
    g.appendChild(E('rect', { x: -w / 2, y: -r1, width: w, height: r1 - r0, fill: 'none', stroke: pal[1], 'stroke-width': 0.5, rx: 0.4 }));
    parent.appendChild(g);
  }
  function ticks(parent, r0, r1, n, every, col, w, wBig, rBig) {
    var d = '', dB = '';
    for (var i = 0; i < n; i++) {
      var a = i / n * TAU - Math.PI / 2;
      var big = every && i % every === 0;
      var p0 = P(big && rBig ? rBig : r0, a), p1 = P(r1, a);
      if (big) dB += 'M' + p0.join(' ') + 'L' + p1.join(' '); else d += 'M' + p0.join(' ') + 'L' + p1.join(' ');
    }
    parent.appendChild(E('path', { d: d, stroke: col, 'stroke-width': w, fill: 'none' }));
    if (dB) parent.appendChild(E('path', { d: dB, stroke: col, 'stroke-width': wBig || w * 2, fill: 'none' }));
  }
  function text(parent, str, x, y, size, cls, fill, extra) {
    var t = E('text', { x: x, y: y, 'font-size': size, 'text-anchor': 'middle', class: cls, fill: fill });
    if (extra) for (var k in extra) t.setAttribute(k, extra[k]);
    t.textContent = str;
    parent.appendChild(t);
    return t;
  }

  var INDEX_PALS = {
    gold: ['#7a5a24', '#c9a45c', '#f6e6b8'],
    rose: ['#7e4430', '#d99a7b', '#fde4d3'],
    rhodium: ['#6d757e', '#c3c9d0', '#f6f8fa']
  };

  function dialSunray(svg, id, m, Rd) {
    var defs = defsOf(svg);
    var rnd = rng(401);
    conic(svg, Rd, 0, 240, function (a) {
      var d = angDiff(a, LIGHT);
      var band = Math.pow(Math.abs(Math.cos(d)), 7);
      var l = 0.1 + 0.62 * band + 0.08 * Math.pow(Math.abs(Math.cos(d + 0.3)), 30) + (rnd() - 0.5) * 0.07;
      return ramp(['#0f1113', '#1d2125', '#343a41', '#5d6670', '#8d97a2'], l);
    });
    rad(defs, id + 'vig', [[0, '#000', 0], [0.7, '#000', 0.12], [1, '#000', 0.55]]);
    svg.appendChild(E('circle', { r: Rd, fill: 'url(#' + id + 'vig)' }));
    var pal = INDEX_PALS[m.index];
    var g = E('g', {});
    // minute track
    ticks(g, Rd * 0.93, Rd * 0.975, 60, 5, 'rgba(236,230,218,.55)', 0.6, 1.2);
    g.appendChild(E('circle', { r: Rd * 0.905, fill: 'none', stroke: 'rgba(236,230,218,.25)', 'stroke-width': 0.4 }));
    for (var h = 0; h < 12; h++) {
      var a = h / 12 * TAU - Math.PI / 2;
      if (h === 0) {
        [-1, 1].forEach(function (s) {
          var gg = E('g', { transform: 'translate(' + s * 3.6 + ' 0)' }); appliedIndex(gg, a, Rd * 0.66, Rd * 0.88, 4.6, pal); g.appendChild(gg);
        });
      } else appliedIndex(g, a, Rd * (h % 3 === 0 ? 0.66 : 0.71), Rd * 0.88, h % 3 === 0 ? 5.6 : 4.2, pal);
    }
    text(g, 'BULROG', 0, r2(-Rd * 0.4), 12.5, 'coll-tx-display coll-tx-brand', pal[2]);
    text(g, 'VALLÉE DE JOUX', 0, r2(-Rd * 0.4 + 9), 4, 'coll-tx-sans coll-tx-small', 'rgba(236,230,218,.62)');
    text(g, 'AUTOMATIQUE', 0, r2(Rd * 0.42), 4.6, 'coll-tx-sans coll-tx-small', 'rgba(236,230,218,.7)');
    text(g, 'CALIBRE BR-01', 0, r2(Rd * 0.42 + 7), 3.6, 'coll-tx-mono coll-tx-small', pal[1]);
    text(g, 'SWISS MADE', 0, r2(Rd * 0.885), 3.3, 'coll-tx-sans coll-tx-small', 'rgba(236,230,218,.55)');
    svg.appendChild(g);
  }

  function dialEnamel(svg, id, m, Rd) {
    var defs = defsOf(svg);
    rad(defs, id + 'enamel', [[0, '#27418f'], [0.45, '#172b66'], [0.85, '#0c173d'], [1, '#070d24']], 0.42, 0.38, 0.72);
    rad(defs, id + 'gloss', [[0, '#fff', 0.24], [0.5, '#fff', 0.05], [1, '#fff', 0]], 0.5, 0.5, 0.5);
    svg.appendChild(E('circle', { r: Rd, fill: 'url(#' + id + 'enamel)' }));
    // enamel depth: slight darker ring where the enamel meets the flange
    svg.appendChild(E('circle', { r: Rd - 1.2, fill: 'none', stroke: '#050a1c', 'stroke-width': 2.4, opacity: 0.8 }));
    var pal = INDEX_PALS[m.index];
    var g = E('g', {});
    // railway (chemin de fer) minute track
    g.appendChild(E('circle', { r: Rd * 0.955, fill: 'none', stroke: pal[1], 'stroke-width': 0.55 }));
    g.appendChild(E('circle', { r: Rd * 0.895, fill: 'none', stroke: pal[1], 'stroke-width': 0.55 }));
    ticks(g, Rd * 0.895, Rd * 0.955, 60, 5, pal[1], 0.5, 1.6, Rd * 0.87);
    var romans = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    romans.forEach(function (rn, h) {
      var a = h / 12 * TAU - Math.PI / 2;
      var p = P(Rd * 0.73, a);
      var t = text(g, rn, p[0], r2(p[1] + 5.2), h % 3 === 0 ? 16 : 13, 'coll-tx-display coll-tx-roman', pal[1]);
      t.setAttribute('transform', 'rotate(' + r2(h * 30) + ' ' + p[0] + ' ' + p[1] + ')');
    });
    text(g, 'BULROG', 0, r2(-Rd * 0.33), 11.5, 'coll-tx-display coll-tx-brand', pal[2]);
    text(g, 'LE SENTIER', 0, r2(-Rd * 0.33 + 8), 3.8, 'coll-tx-sans coll-tx-small', 'rgba(253,228,211,.6)');
    text(g, 'ÉMAIL GRAND FEU', 0, r2(Rd * 0.38), 3.8, 'coll-tx-sans coll-tx-small', 'rgba(253,228,211,.62)');
    text(g, 'SWISS MADE', 0, r2(Rd * 0.99 - 0.8), 2.8, 'coll-tx-sans coll-tx-small', 'rgba(253,228,211,.5)');
    svg.appendChild(g);
    // glassy enamel reflection (fixed to the light)
    svg.appendChild(E('ellipse', { cx: r2(-Rd * 0.28), cy: r2(-Rd * 0.34), rx: r2(Rd * 0.55), ry: r2(Rd * 0.32), fill: 'url(#' + id + 'gloss)', transform: 'rotate(-35 ' + r2(-Rd * 0.28) + ' ' + r2(-Rd * 0.34) + ')' }));
  }

  /* ---------- Escapement group (skeleton & caseback) --------------------- */
  function buildEscapement(parent, id, o) {
    // o: { x, y, dirDeg (direction escape→balance), R (escape tip radius), balanceR, pinionR }
    var L = G.escapementLayout(o.R, { leverLength: o.R * 0.95 });
    var psi = o.dirDeg + 90;               // local −y must point to dirDeg
    var g = E('g', { transform: 'translate(' + r2(o.x) + ' ' + r2(o.y) + ') rotate(' + r2(psi) + ')' });
    var ew = E('g', {});
    ew.appendChild(E('path', { d: G.escapeWheel({ radius: o.R, hole: o.R * 0.07, spokes: 4, curve: 0.4 }).d, fill: 'url(#' + id + 'steelw)', 'fill-rule': 'evenodd', stroke: 'rgba(0,0,0,.35)', 'stroke-width': 0.3 }));
    var pin = G.pinion({ teeth: 6, radius: o.pinionR });
    ew.appendChild(E('path', { d: pin.d, fill: 'url(#' + id + 'steelw)', stroke: 'rgba(0,0,0,.5)', 'stroke-width': 0.25 }));
    g.appendChild(ew);
    var pal = E('g', {});
    pal.appendChild(E('path', { d: L.forkD, fill: 'url(#' + id + 'steelw)', 'fill-rule': 'evenodd', stroke: 'rgba(0,0,0,.45)', 'stroke-width': 0.3 }));
    L.stones.forEach(function (s) { pal.appendChild(E('path', { d: G.palletStonePath(s), fill: 'url(#bg-ruby)', stroke: '#5a0614', 'stroke-width': 0.2 })); });
    pal.appendChild(E('circle', { r: o.R * 0.07, fill: '#e0405a' }));
    var pg = E('g', { transform: 'translate(' + L.pallet.x + ' ' + L.pallet.y + ')' }, [pal]);
    g.appendChild(pg);
    // balance
    var bx = L.balance.x, by = L.balance.y;
    var bw = G.balanceWheel({ radius: o.balanceR, arms: 2, weights: 4, hole: 0.8, rim: o.balanceR * 0.1, armWidth: o.balanceR * 0.1 });
    var bal = E('g', {});
    bal.appendChild(E('path', { d: bw.d, fill: 'url(#' + id + 'cube)', 'fill-rule': 'evenodd', stroke: 'rgba(0,0,0,.4)', 'stroke-width': 0.3 }));
    bw.weights.forEach(function (w) {
      bal.appendChild(E('circle', { cx: w.x, cy: w.y, r: r2(o.balanceR * 0.1), fill: 'url(#bg-gold-radial)', stroke: 'rgba(0,0,0,.4)', 'stroke-width': 0.25 }));
    });
    bal.appendChild(E('circle', { r: L.rollerRadius, fill: 'url(#' + id + 'steelw)', opacity: 0.9 }));
    bal.appendChild(E('ellipse', { cx: 0, cy: r2(L.rollerRadius * 0.9), rx: r2(L.pinRadius * 1.2), ry: r2(L.pinRadius * 1.8), fill: '#e0405a' }));
    var bgp = E('g', { transform: 'translate(' + bx + ' ' + by + ')' });
    bgp.appendChild(bal);
    var hs = E('path', { fill: 'none', stroke: '#d9dde2', 'stroke-width': 0.28, opacity: 0.85 });
    bgp.appendChild(hs);
    bgp.appendChild(G.jewel({ x: 0, y: 0, r: o.balanceR * 0.09 }));
    g.appendChild(bgp);
    parent.appendChild(g);
    var hsInner = o.balanceR * 0.16, hsOuter = o.balanceR * 0.66;
    var lastTwist = null;
    return {
      psi: psi, layout: L, group: g,
      balanceAbs: (function () {  // balance centre in parent coords
        var a = psi * RAD; return { x: o.x + bx * Math.cos(a) - by * Math.sin(a), y: o.y + bx * Math.sin(a) + by * Math.cos(a) };
      })(),
      update: function (t) {
        var s = G.escapement(t);
        ew.setAttribute('transform', 'rotate(' + r2(s.escapeDeg) + ')');
        pal.setAttribute('transform', 'rotate(' + r2(s.palletDeg) + ')');
        bal.setAttribute('transform', 'rotate(' + r2(s.balanceDeg) + ')');
        var tw = Math.round(s.balanceDeg);
        if (tw !== lastTwist) {
          lastTwist = tw;
          hs.setAttribute('d', G.hairspringPath({ inner: hsInner, outer: hsOuter, turns: 9, samples: 22, twist: s.balanceDeg * RAD * 0.35, phase: -0.4 }));
        }
        return s;
      }
    };
  }

  function movementDefs(defs, id) {
    lin(defs, id + 'steelw', [[0, '#f2f5f8'], [0.45, '#a6aeb8'], [1, '#5c646d']]);
    lin(defs, id + 'cube', [[0, '#f7d9a8'], [0.5, '#c9975a'], [1, '#7c5227']]);        // copper-beryllium balance
    lin(defs, id + 'wheel', [[0, '#f3dfa6'], [0.5, '#d3ad63'], [1, '#9a7535']]);       // gilt brass wheels
    lin(defs, id + 'ruth', [[0, '#4a4e55'], [0.5, '#2e3137'], [1, '#1c1e22']]);        // ruthenium bridges
  }

  /* ---------- Movement helpers (skeleton dial & caseback) ----------------- */
  /**
   * Draws several bridges as ONE union: drop shadow, polished bevel (anglage), body, texture.
   * parts: { d, w } stroked centre-line · { d, fill: true } closed shape · { c: [x, y, r] } boss.
   */
  function bridgeUnion(parent, parts, body, bevel, texture) {
    var layers = [
      { col: '#000', op: 0.5, grow: 1.3, dx: 1.6, dy: 2.8 },
      { col: bevel, grow: 1.25 },
      { col: body, grow: 0 }
    ];
    if (texture) layers.push({ col: texture, grow: 0 });
    layers.forEach(function (L) {
      var g = E('g', { opacity: L.op || null, transform: L.dx ? 'translate(' + L.dx + ' ' + L.dy + ')' : null });
      parts.forEach(function (p) {
        if (p.c) g.appendChild(E('circle', { cx: r2(p.c[0]), cy: r2(p.c[1]), r: r2(p.c[2] + L.grow), fill: L.col }));
        else if (p.fill) g.appendChild(E('path', { d: p.d, fill: L.col, stroke: L.grow ? L.col : 'none', 'stroke-width': r2(L.grow * 2), 'stroke-linejoin': 'round' }));
        else g.appendChild(E('path', { d: p.d, fill: 'none', stroke: L.col, 'stroke-width': r2(p.w + L.grow * 2), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      });
      parent.appendChild(g);
    });
  }
  function seg(a, b) { return 'M' + r2(a[0] != null ? a[0] : a.x) + ' ' + r2(a[1] != null ? a[1] : a.y) + 'L' + r2(b[0] != null ? b[0] : b.x) + ' ' + r2(b[1] != null ? b[1] : b.y); }
  function add(p, r, deg) { return { x: p.x + r * Math.cos(deg * RAD), y: p.y + r * Math.sin(deg * RAD) }; }
  function toAbs(o, psiDeg, local) {
    var a = psiDeg * RAD;
    return { x: o.x + local.x * Math.cos(a) - local.y * Math.sin(a), y: o.y + local.x * Math.sin(a) + local.y * Math.cos(a) };
  }
  /** Gilt wheel (+ optional steel pinion drawn on its own layer). */
  function wheel(layer, pinLayer, id, pos, teeth, mod, spokes, pinTeeth, pinMod, extra) {
    var gw = E('g', { transform: 'translate(' + r2(pos.x) + ' ' + r2(pos.y) + ')' });
    var rot = E('g', {});
    var gd = G.gear({ teeth: teeth, module: mod, spokes: spokes, curve: 0.45, hole: 0.9, rimWidth: mod * teeth * 0.05, spokeWidth: mod * teeth * 0.05 });
    rot.appendChild(E('path', { d: gd.d, fill: 'url(#' + id + 'wheel)', 'fill-rule': 'evenodd', stroke: 'rgba(60,40,10,.6)', 'stroke-width': 0.25 }));
    if (extra) extra(rot, gd);
    gw.appendChild(rot);
    layer.appendChild(gw);
    var pin = null;
    if (pinTeeth) {
      pin = E('g', {}, [E('path', { d: G.pinion({ teeth: pinTeeth, module: pinMod }).d, fill: 'url(#' + id + 'steelw)', stroke: 'rgba(0,0,0,.55)', 'stroke-width': 0.2 })]);
      pinLayer.appendChild(E('g', { transform: 'translate(' + r2(pos.x) + ' ' + r2(pos.y) + ')' }, [pin]));
    }
    return { rot: rot, pin: pin, pos: pos, gear: gd };
  }
  /** Steel ratchet wheel with colimaçonnage (snailing) on the barrel. */
  function ratchetWheel(parent, id, pos, teeth, radius) {
    var gw = E('g', { transform: 'translate(' + r2(pos.x) + ' ' + r2(pos.y) + ')' });
    var rot = E('g', {});
    var gd = G.gear({ teeth: teeth, radius: radius, profile: 'watch', spokes: 0, hole: 0 });
    rot.appendChild(E('path', { d: gd.d, fill: 'url(#' + id + 'steelw)', stroke: 'rgba(0,0,0,.5)', 'stroke-width': 0.3 }));
    var sn = '';
    for (var k = 0; k < 28; k++) {
      var a0 = k / 28 * TAU;
      for (var j = 0; j <= 10; j++) {
        var u = j / 10, rr = radius * (0.2 + 0.68 * u), a = a0 + u * 1.1;
        var q = P(rr, a); sn += (j ? 'L' : 'M') + q.join(' ');
      }
    }
    rot.appendChild(E('path', { d: sn, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.22, 'stroke-width': 0.45 }));
    rot.appendChild(E('path', { d: sn, fill: 'none', stroke: '#000', 'stroke-opacity': 0.18, 'stroke-width': 0.45, transform: 'rotate(4)' }));
    gw.appendChild(rot);
    gw.appendChild(G.screw({ x: 0, y: 0, r: radius * 0.22, slot: 25 }));
    parent.appendChild(gw);
    return { rot: rot, gear: gd };
  }
  function perlagePattern(defs, pid, cell) {
    var pat = E('pattern', { id: pid, patternUnits: 'userSpaceOnUse', width: cell, height: cell });
    [[0, 0], [cell, 0], [0, cell], [cell, cell], [cell / 2, cell / 2]].forEach(function (c) { pat.appendChild(E('circle', { cx: c[0], cy: c[1], r: r2(cell * 0.56), fill: 'url(#bg-perle)' })); });
    defs.appendChild(pat);
  }
  function cotesPattern(defs, id, pid, period, angle, strength) {
    lin(defs, pid + 'band', [[0, '#fff', 0], [0.42, '#fff', 0.34 * strength], [0.55, '#fff', 0.05 * strength], [0.86, '#000', 0.22 * strength], [1, '#000', 0.34 * strength]], 0, 0, 1, 0);
    var p = E('pattern', { id: pid, patternUnits: 'userSpaceOnUse', width: period, height: period, patternTransform: 'rotate(' + angle + ')' });
    p.appendChild(E('rect', { width: period, height: period, fill: 'url(#' + pid + 'band)' }));
    defs.appendChild(p);
  }

  /* ---------- Skeleton dial (Ossature 42, Calibre BR-01S) ---------------- */
  function dialSkeleton(svg, id, m, Rd) {
    var defs = defsOf(svg);
    movementDefs(defs, id);
    var Ro = Rd * 0.8;                       // openwork radius (inside the black rehaut)
    var S = Ro / 99.5;
    // ---- geometry: exact BR-01 tooth counts, one module per mesh stage ----
    var m1 = 0.95 * S, m2 = 0.7 * S, m3 = 0.6 * S, m4 = 0.45 * S;
    var C = { x: 0, y: 0 };
    var B = add(C, 45 * m1, -90);             // barrel 80 → centre pinion 10
    var T = add(C, 45 * m2, 150);             // centre 80 → third pinion 10
    var F = add(T, 42.5 * m3, 72);            // third 75 → fourth pinion 10
    var Es = add(F, 51 * m4, 4);              // fourth 96 → escape pinion 6
    var ER = 11.5 * S, BR = 22 * S;
    var escDir = 26;

    rad(defs, id + 'deep', [[0, '#16181b'], [0.75, '#0c0d0f'], [1, '#040405']]);
    perlagePattern(defs, id + 'perl', 6 * S);
    cotesPattern(defs, id, id + 'cotes', 9 * S, -30, 0.5);
    svg.appendChild(E('circle', { r: Ro + 2, fill: 'url(#' + id + 'deep)' }));

    // escapement (built first so the balance position is known)
    var escHolder = E('g', {});
    var esc = buildEscapement(escHolder, id, { x: Es.x, y: Es.y, dirDeg: escDir, R: ER, balanceR: BR, pinionR: 3 * m4 });
    var Bal = esc.balanceAbs;
    var Pal = toAbs(Es, esc.psi, esc.layout.pallet);

    // ratchet + crown wheel (keyless works) on the barrel bridge
    var ratR = 20 * S, ratN = 54, crN = 26;
    var ratMod = 2 * ratR / ratN, crR = crN * ratMod / 2;
    var thRC = -18 * RAD;
    var CW = add(B, ratR + crR, -18);

    // ---- lower plate: dark ruthenium with perlage, cut out around every mobile ----
    var mask = E('mask', { id: id + 'platemask', maskUnits: 'userSpaceOnUse', x: -Ro - 5, y: -Ro - 5, width: 2 * Ro + 10, height: 2 * Ro + 10 });
    mask.appendChild(E('circle', { r: Ro + 2, fill: '#fff' }));
    [[B, 40 * S], [C, 31 * S], [T, 25 * S], [F, 24 * S], [Es, 14 * S], [Bal, BR + 3 * S], [Pal, 8 * S]].forEach(function (h) {
      mask.appendChild(E('circle', { cx: r2(h[0].x), cy: r2(h[0].y), r: r2(h[1]), fill: '#000' }));
    });
    defs.appendChild(mask);
    var plate = E('g', { mask: 'url(#' + id + 'platemask)' });
    plate.appendChild(E('circle', { r: Ro + 2, fill: '#2a2d32' }));
    plate.appendChild(E('circle', { r: Ro + 2, fill: 'url(#' + id + 'perl)', opacity: 0.4 }));
    svg.appendChild(plate);
    // bevel around the openings
    [[B, 40 * S], [C, 31 * S], [T, 25 * S], [F, 24 * S], [Es, 14 * S], [Bal, BR + 3 * S]].forEach(function (h) {
      svg.appendChild(E('circle', { cx: r2(h[0].x), cy: r2(h[0].y), r: r2(h[1]), fill: 'none', stroke: '#8d949c', 'stroke-opacity': 0.35, 'stroke-width': 0.7 }));
    });

    // ---- going train (driven below driver) ----
    var wheels = E('g', {}), pins = E('g', {});
    svg.appendChild(wheels);
    wheels.appendChild(escHolder);
    var wF = wheel(wheels, pins, id, F, 96, m4, 5, 10, m3);
    var wT = wheel(wheels, pins, id, T, 75, m3, 5, 10, m2);
    var wC = wheel(wheels, pins, id, C, 80, m2, 5, 10, m1);
    var wB = wheel(wheels, pins, id, B, 80, m1, 0, 0, 0, function (rot, gd) {
      var r = gd.rootRadius - 1.5;
      rot.appendChild(E('circle', { r: r2(r), fill: '#141518' }));
      var sp = '';
      for (var k = 0; k <= 280; k++) { var u = k / 280, a = u * 7 * TAU, rr = 5 + (r - 7) * u; var q = P(rr, a); sp += (k ? 'L' : 'M') + q.join(' '); }
      rot.appendChild(E('path', { d: sp, fill: 'none', stroke: '#9aa2ab', 'stroke-width': 0.9, opacity: 0.8 }));
      rot.appendChild(E('path', { d: G.ringPath(r, r - 1.8), 'fill-rule': 'evenodd', fill: 'url(#' + id + 'wheel)' }));
    });
    svg.appendChild(pins);

    // ---- skeletonised bridges: ruthenium, polished bevels, fine côtes ----
    var foot = function (deg) { return P(Ro + 6, deg * RAD); };
    var parts = [
      { d: seg(foot(-124), B) + seg(B, foot(-56)), w: 11 * S },            // barrel bridge (V)
      { c: [B.x, B.y, 14 * S] },
      { d: seg(B, CW) + seg(CW, foot(-8)), w: 5.5 * S },                     // keyless bar
      { c: [CW.x, CW.y, 6 * S] },
      { d: 'M' + foot(196).join(' ') + 'Q' + r2(T.x - 22 * S) + ' ' + r2(T.y - 4 * S) + ' ' + r2(T.x) + ' ' + r2(T.y) + seg(T, F), w: 9 * S }, // train bridge
      { c: [T.x, T.y, 7 * S] }, { c: [F.x, F.y, 6.5 * S] },
      { d: 'M' + foot(114).join(' ') + 'Q' + r2(Es.x - 6 * S) + ' ' + r2(Es.y + 26 * S) + ' ' + r2(Es.x) + ' ' + r2(Es.y) + seg(Es, Pal), w: 6 * S }, // escapement bridge
      { c: [Es.x, Es.y, 4.4 * S] }, { c: [Pal.x, Pal.y, 3.8 * S] },
      { d: 'M' + foot(10).join(' ') + 'Q' + r2(Bal.x + 30 * S) + ' ' + r2(Bal.y - 22 * S) + ' ' + r2(Bal.x) + ' ' + r2(Bal.y) + 'Q' + r2(Bal.x + 30 * S) + ' ' + r2(Bal.y + 4 * S) + ' ' + foot(50).join(' '), w: 9 * S }, // balance cock
      { c: [Bal.x, Bal.y, 7.5 * S] }
    ];
    var brg = E('g', {});
    bridgeUnion(brg, parts, 'url(#' + id + 'ruth)', '#dfe4ea', 'url(#' + id + 'cotes)');
    svg.appendChild(brg);

    // keyless works on the barrel bridge
    var rat = ratchetWheel(svg, id, B, ratN, ratR);
    var crown = ratchetWheel(svg, id, CW, crN, crR);
    // click (pawl) with its spring
    var clickA = add(B, ratR + 3 * S, 200);
    svg.appendChild(E('path', { d: 'M' + r2(clickA.x - 9 * S) + ' ' + r2(clickA.y + 5 * S) + 'Q' + r2(clickA.x - 2 * S) + ' ' + r2(clickA.y - 2 * S) + ' ' + r2(clickA.x + 3 * S) + ' ' + r2(clickA.y - 5.5 * S) + 'L' + r2(clickA.x + 1 * S) + ' ' + r2(clickA.y + 1 * S) + 'Z', fill: 'url(#' + id + 'steelw)', stroke: 'rgba(0,0,0,.5)', 'stroke-width': 0.3 }));
    svg.appendChild(G.screw({ x: clickA.x - 8 * S, y: clickA.y + 4.5 * S, r: 1.8 * S, slot: 70 }));

    // jewels in gold chatons + blued screws
    var jw = E('g', {});
    [T, F, Es, Pal].forEach(function (p) { jw.appendChild(G.jewel({ x: p.x, y: p.y, r: 1.9 * S })); });
    jw.appendChild(G.jewel({ x: Bal.x, y: Bal.y, r: 2.3 * S }));
    [-124, -56, -8, 196, 114, 10, 50].forEach(function (deg, i) {
      var q = P(Ro - 7 * S, deg * RAD);
      jw.appendChild(G.screw({ x: q[0], y: q[1], r: 2.5 * S, slot: 20 + i * 47 }));
    });
    var tb = add(B, 16 * S, -142);
    text(jw, 'BR-01S', r2(tb.x - 4 * S), r2(tb.y - 3 * S), 3.6 * S, 'coll-tx-mono coll-tx-engrave', '#aeb5bd', { transform: 'rotate(36 ' + r2(tb.x - 4 * S) + ' ' + r2(tb.y - 3 * S) + ')' });
    svg.appendChild(jw);

    // ---- black rehaut with applied rhodium indexes ----
    var reh = E('g', {});
    reh.appendChild(E('path', { d: G.ringPath(Rd, Ro), 'fill-rule': 'evenodd', fill: '#0b0b0d' }));
    reh.appendChild(E('circle', { r: Ro, fill: 'none', stroke: '#3a3e44', 'stroke-width': 1.2 }));
    ticks(reh, Rd * 0.92, Rd * 0.975, 60, 5, 'rgba(236,230,218,.75)', 0.55, 1.3);
    var pal = INDEX_PALS.rhodium;
    for (var h = 0; h < 12; h++) {
      var a = h / 12 * TAU - Math.PI / 2;
      var rOut = (h === 0 || h === 6) ? Ro + 8 : Rd * 0.9;
      if (h === 0) {
        [-1, 1].forEach(function (s2) { var gg = E('g', { transform: 'translate(' + s2 * 3.2 + ' 0)' }); appliedIndex(gg, a, Ro - 6, rOut, 4, pal); reh.appendChild(gg); });
      } else appliedIndex(reh, a, Ro - 6, rOut, h % 3 === 0 ? 5.4 : 3.8, pal);
      var lp = P(Ro + 1.5, a);
      if (h) reh.appendChild(E('circle', { cx: lp[0], cy: lp[1], r: 1.3, fill: '#e4f0d6', opacity: 0.9 }));
    }
    var rTx = Ro + 9.6, rBx = Ro + 12.6;
    var arcTop = E('path', { id: id + 'arcT', d: 'M' + P(rTx, -2.3).join(' ') + 'A' + r2(rTx) + ' ' + r2(rTx) + ' 0 0 1 ' + P(rTx, -0.84).join(' '), fill: 'none' });
    var arcBot = E('path', { id: id + 'arcB', d: 'M' + P(rBx, 2.3).join(' ') + 'A' + r2(rBx) + ' ' + r2(rBx) + ' 0 0 0 ' + P(rBx, 0.84).join(' '), fill: 'none' });
    defs.appendChild(arcTop); defs.appendChild(arcBot);
    function onArc(pid, str, size, fill, cls, off) {
      var t = E('text', { 'font-size': size, fill: fill, class: cls, 'text-anchor': 'middle' });
      var tp = E('textPath', { href: '#' + pid, startOffset: off || '50%' });
      tp.textContent = str; t.appendChild(tp); reh.appendChild(t);
    }
    onArc(id + 'arcT', 'BULROG', 4.6, '#f2f4f6', 'coll-tx-display coll-tx-brand', '50%');
    onArc(id + 'arcB', 'SWISS MADE', 2.8, 'rgba(236,230,218,.6)', 'coll-tx-sans coll-tx-small');
    svg.appendChild(reh);

    // ---- animation: the escapement drives the train, backwards through every mesh ----
    var thEF = Math.atan2(F.y - Es.y, F.x - Es.x);
    var thFT = Math.atan2(T.y - F.y, T.x - F.x);
    var thTC = Math.atan2(C.y - T.y, C.x - T.x);
    var thCB = Math.atan2(B.y - C.y, B.x - C.x);
    function rot(el, r) { el.setAttribute('transform', 'rotate(' + r2(r / RAD) + ')'); }
    return function (time) {
      var s = esc.update(time);
      var rE = (esc.psi + s.escapeDeg) * RAD;             // absolute escape (and escape pinion) rotation
      var rF = G.meshRotation(6, 96, thEF, rE);          // fourth wheel ↔ escape pinion
      var rT = G.meshRotation(10, 75, thFT, rF);         // third wheel ↔ fourth pinion
      var rC = G.meshRotation(10, 80, thTC, rT);         // centre wheel ↔ third pinion
      var rB = G.meshRotation(10, 80, thCB, rC);         // barrel ↔ centre pinion
      rot(wF.rot, rF); rot(wF.pin, rF); rot(wT.rot, rT); rot(wT.pin, rT); rot(wC.rot, rC); rot(wC.pin, rC); rot(wB.rot, rB);
      // automatic winding: the ratchet creeps forward, the crown wheel follows
      var rR = time * 1.2 * RAD;
      rot(rat.rot, rR);
      rot(crown.rot, G.meshRotation(ratN, crN, thRC, rR));
    };
  }

  /* ====================================================================== *
   * Front view
   * ====================================================================== */
  function buildFront(svg, key, m) {
    var id = 'coll-' + key + '-f-';
    var R = m.diam / 2 * MM;
    var defs = E('defs');
    svg.appendChild(defs);
    buildDefsCommon(defs, id, m, R);
    var root = E('g', { class: 'coll-watch-root' });
    svg.appendChild(root);
    drawStrap(root, id, m, R);
    drawLugs(root, id, m, R);
    drawCrown(root, id, m, R, 1);
    drawCaseBody(root, id, m, R, m.diam);
    var rBezOut = R * 0.955, rBezIn = R * (m.dial === 'skeleton' ? 0.9 : 0.885);
    drawBezel(root, id, m, rBezOut, rBezIn);
    var Rd = rBezIn - 2.4;
    var dial = E('g', {});
    defs.appendChild(E('clipPath', { id: id + 'dialclip' }, [E('circle', { r: Rd })]));
    dial.setAttribute('clip-path', 'url(#' + id + 'dialclip)');
    root.appendChild(dial);
    var animate = null;
    if (m.dial === 'sunray') dialSunray(dial, id, m, Rd);
    else if (m.dial === 'enamel') dialEnamel(dial, id, m, Rd);
    else animate = dialSkeleton(dial, id, m, Rd);
    var setHands = buildHands(root, id, m, Rd);
    drawCrystal(root, id, Rd + 2);
    return { setHands: setHands, animate: animate };
  }

  /* ====================================================================== *
   * Back view (sapphire caseback, Calibre BR-01 / BR-01S)
   * ====================================================================== */
  function buildBack(svg, key, m) {
    var id = 'coll-' + key + '-b-';
    var R = m.diam / 2 * MM;
    var defs = E('defs');
    svg.appendChild(defs);
    buildDefsCommon(defs, id, m, R);
    movementDefs(defs, id);
    var root = E('g', { class: 'coll-watch-root' });
    svg.appendChild(root);
    drawStrap(root, id, m, R);
    drawLugs(root, id, m, R);
    drawCrown(root, id, m, R, -1);             // seen from the back, the crown is on the left
    drawCaseBody(root, id, m, R, m.diam + 3);
    // screwed caseback ring with engraving
    var rRingOut = R * 0.955, rRingIn = R * 0.79;
    drawBezel(root, id, m, rRingOut, rRingIn);
    var pal = METALS[m.metal].pal;
    var ringR = (rRingOut + rRingIn) / 2 - 1.6;
    defs.appendChild(E('path', { id: id + 'eng', d: 'M' + P(ringR, -Math.PI / 2).join(' ') + 'A' + r2(ringR) + ' ' + r2(ringR) + ' 0 1 1 ' + P(ringR, -Math.PI / 2 - 0.001).join(' '), fill: 'none' }));
    var et = E('text', { 'font-size': 4.1, class: 'coll-tx-sans coll-tx-engrave', fill: ramp(pal, m.metal === 'ti' ? 0.02 : 0.12), opacity: 0.85 });
    var tp = E('textPath', { href: '#' + id + 'eng', startOffset: '0', textLength: r2(TAU * ringR * 0.985), lengthAdjust: 'spacing' });
    tp.textContent = 'BULROG · MANUFACTURE HORLOGÈRE · LE SENTIER · VALLÉE DE JOUX · SWISS MADE · SAPHIR · ' +
      (key === 'ossature-42' ? 'CALIBRE BR-01S · N° 01/88 · 30 M ·' : 'CALIBRE BR-01 · 31 RUBIS · 50 M ·');
    et.appendChild(tp); root.appendChild(et);
    for (var i = 0; i < 6; i++) {
      var a = i / 6 * TAU + 0.26;
      var q = P(rRingOut - 2.6, a);
      root.appendChild(E('rect', { x: -4, y: -1.2, width: 8, height: 2.4, rx: 1, fill: pal[0], opacity: 0.75, transform: 'translate(' + q.join(' ') + ') rotate(' + r2(a / RAD + 90) + ')' }));
    }

    var Rm = rRingIn - 2.6;
    var S = Rm / 96;
    var mv = E('g', { 'clip-path': 'url(#' + id + 'mvclip)' });
    defs.appendChild(E('clipPath', { id: id + 'mvclip' }, [E('circle', { r: Rm })]));
    root.appendChild(mv);
    perlagePattern(defs, id + 'perl', 5.5 * S);
    cotesPattern(defs, id, id + 'cotes', 15 * S, -24, 0.85);
    cotesPattern(defs, id, id + 'cotesR', 13 * S, 90, 0.9);
    lin(defs, id + 'rho', [[0, '#e9edf1'], [0.5, '#b8c0c9'], [1, '#8a939d']]);
    lin(defs, id + 'rhoPlate', [[0, '#c9d0d7'], [1, '#8f98a2']]);
    mv.appendChild(E('circle', { r: Rm, fill: 'url(#' + id + 'rhoPlate)' }));
    mv.appendChild(E('circle', { r: Rm, fill: 'url(#' + id + 'perl)', opacity: 0.55 }));

    // train geometry (same tooth counts as the dial side)
    var m1 = 0.8 * S, m2 = 0.6 * S, m3 = 0.55 * S, m4 = 0.4 * S;
    var C = { x: 0, y: 0 };
    var B = add(C, 45 * m1, -122);
    var T = add(C, 45 * m2, 160);
    var F = add(T, 42.5 * m3, 22);
    var Es = add(F, 51 * m4, 8);
    var escHolder = E('g', {});
    var esc = buildEscapement(escHolder, id, { x: Es.x, y: Es.y, dirDeg: 52, R: 10 * S, balanceR: 21 * S, pinionR: 3 * m4 });
    var Bal = esc.balanceAbs, Pal = toAbs(Es, esc.psi, esc.layout.pallet);
    var wheels = E('g', {}), pins = E('g', {});
    mv.appendChild(wheels);
    wheels.appendChild(escHolder);
    var wF = wheel(wheels, pins, id, F, 96, m4, 5, 10, m3);
    var wT = wheel(wheels, pins, id, T, 75, m3, 5, 10, m2);
    var wC = wheel(wheels, pins, id, C, 80, m2, 5, 10, m1);
    mv.appendChild(pins);

    // bridges: rhodium, côtes de Genève, polished anglage
    var foot = function (deg) { return P(Rm + 6, deg * RAD); };
    var barrelBridge = 'M' + foot(186).join(' ') + 'A' + r2(Rm + 6) + ' ' + r2(Rm + 6) + ' 0 0 1 ' + foot(322).join(' ') +
      'Q' + r2(40 * S) + ' ' + r2(-34 * S) + ' ' + r2(22 * S) + ' ' + r2(-16 * S) +
      'Q' + r2(8 * S) + ' ' + r2(-4 * S) + ' ' + r2(-12 * S) + ' ' + r2(-14 * S) +
      'Q' + r2(-50 * S) + ' ' + r2(-26 * S) + ' ' + foot(186).join(' ') + 'Z';
    var parts = [
      { d: barrelBridge, fill: true },
      { d: 'M' + foot(150).join(' ') + 'Q' + r2(T.x - 18 * S) + ' ' + r2(T.y + 18 * S) + ' ' + r2(T.x) + ' ' + r2(T.y) + seg(T, F) + seg(F, Es), w: 8 * S },
      { c: [T.x, T.y, 6.5 * S] }, { c: [F.x, F.y, 6 * S] }, { c: [Es.x, Es.y, 5 * S] },
      { d: 'M' + foot(112).join(' ') + 'Q' + r2(Pal.x - 10 * S) + ' ' + r2(Pal.y + 30 * S) + ' ' + r2(Pal.x) + ' ' + r2(Pal.y), w: 5.5 * S },
      { c: [Pal.x, Pal.y, 4.5 * S] }
    ];
    bridgeUnion(mv, parts, 'url(#' + id + 'rho)', '#fbfcfd', 'url(#' + id + 'cotes)');
    // balance cock on its own level
    bridgeUnion(mv, [
      { d: 'M' + foot(4).join(' ') + 'Q' + r2(Bal.x + 26 * S) + ' ' + r2(Bal.y - 16 * S) + ' ' + r2(Bal.x) + ' ' + r2(Bal.y) + 'Q' + r2(Bal.x + 22 * S) + ' ' + r2(Bal.y + 16 * S) + ' ' + foot(44).join(' '), w: 9 * S },
      { c: [Bal.x, Bal.y, 7 * S] }
    ], 'url(#' + id + 'rho)', '#fbfcfd', 'url(#' + id + 'cotes)');
    // ratchet + crown wheel on the barrel bridge
    var ratR = 24 * S, ratN = 60, crN = 30;
    var crR = crN * (2 * ratR / ratN) / 2;
    var CW = add(B, ratR + crR, 188);
    var thRC = 188 * RAD;
    var rat = ratchetWheel(mv, id, B, ratN, ratR);
    var crown = ratchetWheel(mv, id, CW, crN, crR);
    // jewels, screws, engraving
    [T, F, Es, Pal].forEach(function (p) { mv.appendChild(G.jewel({ x: p.x, y: p.y, r: 2.1 * S })); });
    mv.appendChild(G.jewel({ x: Bal.x, y: Bal.y, r: 2.6 * S }));
    [[208], [250], [300], [150], [112], [4], [44]].forEach(function (d, k) {
      var q = P(Rm - 7 * S, d[0] * RAD); mv.appendChild(G.screw({ x: q[0], y: q[1], r: 3 * S, slot: 30 + k * 53 }));
    });
    var tx = 34 * S, ty = -52 * S;
    text(mv, key === 'ossature-42' ? 'BR-01S · 31 RUBIS' : 'BR-01 · 31 RUBIS', r2(tx), r2(ty), 4 * S, 'coll-tx-mono coll-tx-engrave', '#8a6a2f', { transform: 'rotate(38 ' + r2(tx) + ' ' + r2(ty) + ')' });

    // oscillating weight: 22 ct rose gold, côtes de Genève, ceramic ball bearing
    lin(defs, id + 'rotor', [[0, '#fbe0cc'], [0.35, '#dca184'], [0.7, '#a86a4f'], [1, '#f0c3a6']]);
    var rotor = E('g', {});
    var rr = Rm - 1.5;
    var rotorD = 'M' + P(rr, Math.PI + 0.06).join(' ') + 'A' + r2(rr) + ' ' + r2(rr) + ' 0 0 1 ' + P(rr, -0.06).join(' ') +
      'L' + P(rr * 0.3, -0.3).join(' ') + 'A' + r2(rr * 0.3) + ' ' + r2(rr * 0.3) + ' 0 0 0 ' + P(rr * 0.3, Math.PI + 0.3).join(' ') + 'Z' +
      sector(rr * 0.82, rr * 0.42, Math.PI + 0.32, Math.PI + 1.28) + sector(rr * 0.82, rr * 0.42, -1.28, -0.32);
    rotor.appendChild(E('path', { d: rotorD, fill: '#000', opacity: 0.45, 'fill-rule': 'evenodd', transform: 'translate(1.8 3.4)' }));
    rotor.appendChild(E('path', { d: rotorD, fill: 'url(#' + id + 'rotor)', 'fill-rule': 'evenodd', stroke: '#fde4d3', 'stroke-width': 1 }));
    rotor.appendChild(E('path', { d: rotorD, fill: 'url(#' + id + 'cotesR)', 'fill-rule': 'evenodd', opacity: 0.9 }));
    rotor.appendChild(E('path', { d: sector(rr, rr * 0.86, Math.PI + 0.08, TAU - 0.08), fill: '#b87555', opacity: 0.55 }));
    rotor.appendChild(E('path', { d: sector(rr - 0.6, rr * 0.86 + 0.6, Math.PI + 0.1, TAU - 0.1), fill: 'none', stroke: '#fde4d3', 'stroke-opacity': 0.5, 'stroke-width': 0.5 }));
    text(rotor, 'BULROG', 0, r2(-rr * 0.6), 6.6, 'coll-tx-display coll-tx-brand', '#5e2f1d');
    text(rotor, 'OR 22 K', 0, r2(-rr * 0.6 + 7), 2.8, 'coll-tx-sans coll-tx-small', '#6f3b27');
    rotor.appendChild(E('circle', { r: r2(rr * 0.24), fill: 'url(#' + id + 'steelw)' }));
    for (var b = 0; b < 14; b++) { var bp = P(rr * 0.185, b / 14 * TAU); rotor.appendChild(E('circle', { cx: bp[0], cy: bp[1], r: 1.35, fill: '#f4f6f8', stroke: '#6b7280', 'stroke-width': 0.3 })); }
    rotor.appendChild(E('circle', { r: r2(rr * 0.12), fill: 'url(#' + id + 'rotor)', stroke: '#6f3b27', 'stroke-width': 0.4 }));
    [0, 1, 2].forEach(function (k) { var sp = P(rr * 0.07, k / 3 * TAU - Math.PI / 2); rotor.appendChild(G.screw({ x: sp[0], y: sp[1], r: 1.6, slot: k * 60 })); });
    mv.appendChild(rotor);
    drawCrystal(root, id, rRingIn);

    var thEF = Math.atan2(F.y - Es.y, F.x - Es.x);
    var thFT = Math.atan2(T.y - F.y, T.x - F.x);
    var thTC = Math.atan2(C.y - T.y, C.x - T.x);
    function rot(el, r) { el.setAttribute('transform', 'rotate(' + r2(r / RAD) + ')'); }
    var lastRotor = null, ratchet = 0;
    return function (time) {
      var s = esc.update(time);
      var rE = (esc.psi + s.escapeDeg) * RAD;
      var rF = G.meshRotation(6, 96, thEF, rE);
      var rT = G.meshRotation(10, 75, thFT, rF);
      var rC = G.meshRotation(10, 80, thTC, rT);
      rot(wF.rot, rF); rot(wF.pin, rF); rot(wT.rot, rT); rot(wT.pin, rT); rot(wC.rot, rC); rot(wC.pin, rC);
      // wrist motion: slow, irregular swings of the oscillating weight (bidirectional winding)
      var a = 70 * Math.sin(time * 0.55) + 38 * Math.sin(time * 0.21 + 1.3) + 18 * Math.sin(time * 1.3);
      rotor.setAttribute('transform', 'rotate(' + r2(a) + ')');
      if (lastRotor !== null) ratchet += Math.abs(a - lastRotor) * 0.06;
      lastRotor = a;
      rot(rat.rot, ratchet * RAD);
      rot(crown.rot, G.meshRotation(ratN, crN, thRC, ratchet * RAD));
    };
  }

  /* ====================================================================== *
   * Collection wiring
   * ====================================================================== */
  function initCollection() {
    var section = doc.getElementById('collection');
    if (!section || !G) return;
    Array.prototype.forEach.call(section.querySelectorAll('.coll-card'), function (card) {
      var key = card.getAttribute('data-coll-model');
      var m = MODELS[key];
      if (!m) return;
      var svgF = card.querySelector('[data-coll-watch="front"]');
      var svgB = card.querySelector('[data-coll-watch="back"]');
      var flip = card.querySelector('[data-coll-flip]');
      var btn = card.querySelector('[data-coll-flip-btn]');
      var faceF = card.querySelector('[data-coll-face="front"]');
      var faceB = card.querySelector('[data-coll-face="back"]');
      var label = card.querySelector('[data-coll-flip-label]');
      var front = buildFront(svgF, key, m);
      svgF.classList.add('is-drawn');
      // hands at live local time, smooth 8-steps/s seconds; 1 fps under reduced motion
      var handsH = G.ticker.add(function () { front.setHands(G.hands()); }, { el: svgF, fps: 32, reduced: 1 });
      var mechH = null;
      if (front.animate) {
        mechH = G.ticker.add(function (f) { front.animate(f.time); }, { el: svgF, time: (Date.now() / 1000) % 600 });
      }
      var backAnim = null, backH = null;
      if (btn && flip && svgB) {
        btn.addEventListener('click', function () {
          var on = btn.getAttribute('data-flipped') !== 'true';
          btn.setAttribute('data-flipped', on ? 'true' : 'false');
          if (label) label.textContent = on ? 'Voir le cadran' : 'Voir le fond saphir';
          if (on && !backAnim) {
            backAnim = buildBack(svgB, key, m);
            svgB.classList.add('is-drawn');
            backH = G.ticker.add(function (f) { backAnim(f.time); }, { el: svgB, time: 3 + m.diam });
          }
          flip.classList.toggle('is-flipped', on);
          faceF.setAttribute('aria-hidden', on ? 'true' : 'false');
          faceB.setAttribute('aria-hidden', on ? 'false' : 'true');
          // only the visible side keeps its loop running
          if (on) { handsH.pause(); if (mechH) mechH.pause(); if (backH) backH.play(); }
          else { handsH.play(); if (mechH) mechH.play(); if (backH) backH.pause(); }
        });
      }
    });
  }

  /* ====================================================================== *
   * Manufacture: timeline activation + figure counters
   * ====================================================================== */
  function initManufacture() {
    var sec = doc.getElementById('manufacture');
    if (!sec) return;
    var items = Array.prototype.slice.call(sec.querySelectorAll('[data-coll-tl]'));
    var tl = sec.querySelector('[data-coll-timeline]');
    var reduced = G ? G.reducedMotion : false;
    function setProgress() {
      var n = items.filter(function (i) { return i.classList.contains('is-on'); }).length;
      if (tl) tl.style.setProperty('--coll-tl-progress', items.length ? (n / items.length) : 1);
    }
    if (!('IntersectionObserver' in window) || reduced) {
      items.forEach(function (i) { i.classList.add('is-on'); });
      setProgress();
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('is-on'); io.unobserve(en.target); }
        });
        // keep the line continuous: light every item before the last lit one
        var last = -1; items.forEach(function (i, k) { if (i.classList.contains('is-on')) last = k; });
        items.forEach(function (i, k) { if (k <= last) i.classList.add('is-on'); });
        setProgress();
      }, { rootMargin: '0px 0px -18% 0px', threshold: 0.6 });
      items.forEach(function (i) { io.observe(i); });
    }
    if (tl) tl.classList.add('is-ready');

    // counters (final values are in the HTML for no-JS / reduced motion)
    var nums = Array.prototype.slice.call(sec.querySelectorAll('[data-coll-count]'));
    if (!G || reduced || !('IntersectionObserver' in window)) return;
    nums.forEach(function (n) {
      var target = parseInt(n.getAttribute('data-coll-count'), 10);
      var h = null;
      var cio = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        cio.disconnect();
        n.textContent = '0';
        h = G.ticker.add(function (f) {
          var t = Math.min(1, f.time / 1.8);
          n.textContent = String(Math.round(target * G.util.easeOut(t)));
          if (t >= 1) { n.textContent = String(target); h.remove(); }
        }, { el: n, reduced: 'static' });
      }, { threshold: 0.8 });
      cio.observe(n);
    });
  }

  /* ====================================================================== *
   * Rendez-vous form
   * ====================================================================== */
  function initForm() {
    var form = doc.getElementById('coll-form');
    if (!form) return;
    var summary = form.querySelector('[data-coll-summary]');
    var success = form.querySelector('[data-coll-success]');
    var countOut = form.querySelector('[data-coll-count-out]');
    var msg = form.elements.message;
    var dateIn = form.elements.date;
    var touched = {};

    // min date = tomorrow, max = +1 year (local time)
    function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    var tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
    var max = new Date(); max.setFullYear(max.getFullYear() + 1);
    if (dateIn) { dateIn.min = iso(tmr); dateIn.max = iso(max); }

    var LABELS = { nom: 'Nom et prénom', email: 'E-mail', tel: 'Téléphone', modele: 'Objet du rendez-vous', lieu: 'Lieu', date: 'Date souhaitée', consent: 'Consentement' };
    function radioVal(name) { var r = form.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : ''; }

    var checks = {
      nom: function () {
        var v = form.elements.nom.value.trim();
        if (!v) return 'Veuillez indiquer votre nom.';
        if (v.length < 2) return 'Votre nom doit comporter au moins deux caractères.';
        return '';
      },
      email: function () {
        var v = form.elements.email.value.trim();
        if (!v) return 'Veuillez indiquer votre adresse e-mail.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Cette adresse e-mail semble incomplète (exemple : nom@domaine.ch).';
        return '';
      },
      tel: function () {
        var v = form.elements.tel.value.trim();
        if (!v) return '';
        var digits = v.replace(/\D/g, '');
        if (!/^\+?[\d\s().\-]+$/.test(v) || digits.length < 8 || digits.length > 15) return 'Numéro invalide : 8 à 15 chiffres, par exemple +41 21 000 00 00.';
        return '';
      },
      modele: function () { return form.elements.modele.value ? '' : 'Veuillez choisir un modèle ou la visite de l’atelier.'; },
      lieu: function () { return radioVal('lieu') ? '' : 'Veuillez choisir le lieu du rendez-vous.'; },
      date: function () {
        var v = dateIn.value;
        if (!v) return 'Veuillez choisir une date.';
        var p = v.split('-');
        var d = new Date(+p[0], +p[1] - 1, +p[2]);
        if (isNaN(d.getTime())) return 'Date invalide.';
        if (v < dateIn.min) return 'Veuillez choisir une date à partir de demain.';
        if (v > dateIn.max) return 'Nous prenons les rendez-vous jusqu’à un an à l’avance.';
        if (radioVal('lieu') === 'salon' && (d.getDay() === 0 || d.getDay() === 1)) return 'Le salon est ouvert du mardi au samedi : veuillez choisir un autre jour.';
        return '';
      },
      consent: function () { return form.elements.consent.checked ? '' : 'Votre accord est nécessaire pour traiter la demande.'; }
    };
    function fieldEls(name) {
      if (name === 'lieu') return Array.prototype.slice.call(form.querySelectorAll('input[name="lieu"]'));
      return [form.elements[name]];
    }
    function show(name, msgTxt) {
      var err = doc.getElementById('coll-' + name + '-err');
      var wrap = form.querySelector('[data-coll-field="' + name + '"]');
      if (err) err.textContent = msgTxt;
      if (wrap) wrap.classList.toggle('is-invalid', !!msgTxt);
      fieldEls(name).forEach(function (el) {
        if (!el) return;
        if (msgTxt) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
      });
      // lieu: aria-invalid is carried by the radios themselves (fieldsets ignore it)
    }
    function validate(name) { var e = checks[name](); show(name, e); return e; }

    Object.keys(checks).forEach(function (name) {
      fieldEls(name).forEach(function (el) {
        if (!el) return;
        el.addEventListener('blur', function () { if (el.value || name === 'consent' || touched[name]) { touched[name] = true; validate(name); } });
        el.addEventListener('input', function () { if (touched[name]) validate(name); });
        el.addEventListener('change', function () {
          touched[name] = true; validate(name);
          if (name === 'lieu' && touched.date) validate('date');
        });
      });
    });

    if (msg && countOut) {
      var upd = function () { countOut.textContent = msg.value.length + ' / 800'; };
      msg.addEventListener('input', upd); upd();
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (success) success.textContent = '';
      var errors = [];
      Object.keys(checks).forEach(function (name) { touched[name] = true; var er = validate(name); if (er) errors.push({ name: name, msg: er }); });
      if (errors.length) {
        summary.hidden = false;
        summary.innerHTML = '';
        var h = doc.createElement('p');
        h.className = 'coll-form-summary__title';
        h.textContent = errors.length === 1 ? 'Un champ demande votre attention :' : errors.length + ' champs demandent votre attention :';
        var ul = doc.createElement('ul');
        errors.forEach(function (er) {
          var li = doc.createElement('li');
          var a = doc.createElement('a');
          var target = fieldEls(er.name)[0];
          a.href = '#' + (target && target.id ? target.id : 'coll-form');
          a.textContent = LABELS[er.name] + ' — ' + er.msg;
          a.addEventListener('click', function (ev) { ev.preventDefault(); if (target) target.focus(); });
          li.appendChild(a); ul.appendChild(li);
        });
        summary.appendChild(h); summary.appendChild(ul);
        var first = fieldEls(errors[0].name)[0];
        if (first) first.focus();
        return;
      }
      summary.hidden = true; summary.innerHTML = '';
      var sel = form.elements.modele;
      var modelTxt = sel.options[sel.selectedIndex].text;
      var d = dateIn.value.split('-');
      var dateTxt = new Date(+d[0], +d[1] - 1, +d[2]).toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(',', '');
      var lieuTxt = radioVal('lieu') === 'salon' ? 'au salon de l’atelier, au Sentier' : 'en visio-conférence';
      var civ = radioVal('civilite');
      var name = form.elements.nom.value.trim();
      success.innerHTML = '';
      var t = doc.createElement('p'); t.className = 'coll-success__title';
      t.textContent = 'Merci' + (civ ? ' ' + civ + ' ' : ' ') + name + '.';
      var p = doc.createElement('p');
      p.textContent = 'Votre demande de rendez-vous (' + modelTxt + ', ' + lieuTxt + ', le ' + dateTxt + ') a bien été enregistrée. Un horloger vous répondra sous 48 heures ouvrées.';
      success.appendChild(t); success.appendChild(p);
      success.classList.add('is-on');
      form.reset();
      touched = {};
      Object.keys(checks).forEach(function (n2) { show(n2, ''); });
      if (countOut) countOut.textContent = '0 / 800';
      success.setAttribute('tabindex', '-1');
      success.focus({ preventScroll: false });
    });

    // "Prendre rendez-vous" on a card pre-selects the model
    Array.prototype.forEach.call(doc.querySelectorAll('[data-coll-book]'), function (a) {
      a.addEventListener('click', function () {
        var sel = form.elements.modele;
        sel.value = a.getAttribute('data-coll-book');
        touched.modele = true; validate('modele');
        var wrap = form.querySelector('[data-coll-field="modele"]');
        if (wrap) { wrap.classList.remove('is-prefilled'); void wrap.offsetWidth; wrap.classList.add('is-prefilled'); }
      });
    });
  }

  if (G) initCollection();
  initManufacture();
  initForm();

  window.BulrogCollection = { MODELS: MODELS };
})();
