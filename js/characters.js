/* =============================================================================
 * characters.js  —  Cavia Con Carne: Pan-Flute Fury
 * -----------------------------------------------------------------------------
 * Pure canvas-drawing routines for every on-screen critter and backdrop.
 *
 * Everything here is a stateless painter: each function does ctx.save() at the
 * top and ctx.restore() at the bottom, touches only the pixels it is asked to,
 * and leaks NO global canvas state (no lingering transforms, fillStyle, alpha,
 * lineWidth, shadows...). That lets game.js call these in any order every frame.
 *
 * No images, no external assets — only arcs, paths, gradients and quadratics.
 *
 * Public global (attached to window):
 *     Characters.guineaPig(ctx, x, y, s, mood, t)
 *     Characters.llama    (ctx, x, y, s, mood, t)
 *     Characters.mariachi (ctx, x, y, s, mood, t)
 *     Characters.background(ctx, w, h, theme, t)
 *     Characters.panFlute (ctx, x, y, s)
 *
 * Convention: (x, y) is the character's "feet anchor" — the point on the ground
 * the character stands on. s is a scale multiplier (~1 => roughly 150px tall).
 * t is elapsed time in seconds, used purely for idle/animation motion.
 * =========================================================================== */

(function (global) {
  'use strict';

  /* ---------------------------------------------------------------------------
   * Palette (mirrors the design JSON). Kept local so nothing else can mutate it.
   * ------------------------------------------------------------------------- */
  var PAL = {
    guineaPig: ['#C8783C', '#8A4A26', '#F4D9B0', '#FFFFFF', '#F0A0B4'],
    llama:     ['#EFE7D6', '#C9B79A', '#7A5C3E', '#E86A5C', '#3A2E24'],
    mariachi:  ['#2A2340', '#E4C04A', '#C0392B', '#F3E9CF', '#7B3FA0'],
    meadow:    ['#8FD46A', '#57B04A', '#BFE98C', '#7ECBF0', '#FFF4B8'],
    fiesta:    ['#5A2A8C', '#E4462F', '#F6A623', '#F9E04C', '#18A0A0'],
    mountain:  ['#334E7A', '#6C89B8', '#D6E4F2', '#A8B7D0', '#F2B8C6']
  };

  /* ---------------------------------------------------------------------------
   * Small drawing helpers (all leave ctx state as they found it in practice,
   * because callers wrap their own save/restore around these).
   * ------------------------------------------------------------------------- */

  // Filled ellipse centred at (cx, cy) with radii rx, ry, optional rotation.
  function ellipse(ctx, cx, cy, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, Math.PI * 2);
  }

  // Filled circle.
  function circle(ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(0.01, r), 0, Math.PI * 2);
  }

  // A rounded rectangle path (does not fill/stroke — caller decides).
  function roundRectPath(ctx, x, y, w, h, r) {
    var rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  // Convert #rrggbb to an rgba() string with the given alpha.
  function rgba(hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  // Two glossy eyes (big black dots + white highlight arc). Used by everyone.
  // half = distance from centre to each eye, ey = vertical centre, r = radius.
  function drawEyes(ctx, half, ey, r) {
    for (var i = -1; i <= 1; i += 2) {
      var ex = i * half;
      circle(ctx, ex, ey, r);
      ctx.fillStyle = '#241a16';
      ctx.fill();
      // highlight
      circle(ctx, ex - r * 0.3, ey - r * 0.35, r * 0.38);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fill();
    }
  }

  /* ===========================================================================
   * GUINEA PIG (the hero)
   * Fat horizontal capsule body, no neck, rosette fur swirls, buck teeth, and
   * (when playing) the pan flute lifted to the mouth.
   * moods: 'idle' | 'play' | 'happy' | 'sad'
   * ========================================================================= */
  function guineaPig(ctx, x, y, s, mood, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);

    var C = PAL.guineaPig;
    t = t || 0;

    // --- Mood-driven motion --------------------------------------------------
    var breathe = Math.sin(t * 2.2) * 1.5;          // gentle idle bob
    var bounce = 0, tilt = 0, droop = 0, cheekGlow = 0.35;
    if (mood === 'happy') {
      bounce = Math.abs(Math.sin(t * 6)) * 14;       // excited hopping
      cheekGlow = 0.6;
    } else if (mood === 'sad') {
      droop = 6;                                     // slumps down + forward lean
      tilt = 0.12;
      breathe *= 0.4;
    } else if (mood === 'play') {
      breathe = Math.sin(t * 3.4) * 2;               // faster breathing while piping
    }

    ctx.translate(0, -bounce + droop);
    ctx.rotate(tilt);

    // Body is anchored so feet sit near y=0. Body centre sits above the ground.
    var bodyCY = -46 - breathe;
    var bodyRX = 62;   // ~1.3x wider than tall
    var bodyRY = 46;

    // --- Soft ground shadow --------------------------------------------------
    ellipse(ctx, 0, 2, bodyRX * 0.85, 12);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fill();

    // --- Two tiny feet --------------------------------------------------------
    ctx.fillStyle = C[1];
    for (var f = -1; f <= 1; f += 2) {
      roundRectPath(ctx, f * 22 - 8, -14, 16, 12, 5);
      ctx.fill();
    }

    // --- Body (fat capsule, bottom slightly flattened by sitting on feet) -----
    var bg = ctx.createLinearGradient(0, bodyCY - bodyRY, 0, bodyCY + bodyRY);
    bg.addColorStop(0, C[0]);
    bg.addColorStop(1, PAL.guineaPig[1]);
    ellipse(ctx, 0, bodyCY, bodyRX, bodyRY);
    ctx.fillStyle = bg;
    ctx.fill();

    // White belly / chin patch low on the front.
    ellipse(ctx, 6, bodyCY + 20, 34, 22);
    ctx.fillStyle = C[3];
    ctx.fill();

    // --- Rosette fur swirls: short curved strokes radiating from 2 cowlicks ---
    ctx.strokeStyle = C[1];
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    var swirlPts = [[-30, bodyCY - 6], [26, bodyCY + 4]];
    for (var p = 0; p < swirlPts.length; p++) {
      var sx = swirlPts[p][0], sy = swirlPts[p][1];
      for (var k = 0; k < 3; k++) {
        var a0 = (k / 3) * Math.PI * 2 + p;
        ctx.beginPath();
        ctx.arc(sx, sy, 12, a0, a0 + 1.4);
        ctx.stroke();
      }
    }
    ctx.lineWidth = 1; // reset-ish for safety

    // --- Head lump overlapping the front (no neck) ---------------------------
    var headCX = 40;
    var headCY = bodyCY - 14;
    var headR = 34;
    ellipse(ctx, headCX, headCY, headR, headR * 0.94);
    ctx.fillStyle = C[0];
    ctx.fill();

    // Ears: two petal-shaped filled semicircles high on the head, wiggling.
    var earWig = Math.sin(t * 4) * 0.12;
    ctx.fillStyle = C[1];
    for (var e = -1; e <= 1; e += 2) {
      ctx.save();
      ctx.translate(headCX + e * 14, headCY - 26);
      ctx.rotate(e * (0.3 + earWig));
      ellipse(ctx, 0, 0, 9, 12);
      ctx.fill();
      ctx.restore();
    }

    // Rosy cheek (low alpha), pulses when happy.
    circle(ctx, headCX + 16, headCY + 8, 9);
    ctx.fillStyle = rgba(C[4], cheekGlow);
    ctx.fill();

    // Eyes (big, glossy) — droop lids a touch when sad.
    ctx.save();
    ctx.translate(headCX, headCY - 2);
    if (mood === 'sad') {
      drawEyes(ctx, 12, 2, 5.5);
    } else {
      drawEyes(ctx, 12, 0, 6.5);
    }
    ctx.restore();

    // Pink nose triangle.
    ctx.beginPath();
    ctx.moveTo(headCX + headR - 4, headCY + 8);
    ctx.lineTo(headCX + headR + 6, headCY + 4);
    ctx.lineTo(headCX + headR + 6, headCY + 12);
    ctx.closePath();
    ctx.fillStyle = C[4];
    ctx.fill();

    // Buck teeth: two small white rounded rects below the nose.
    ctx.fillStyle = C[3];
    for (var ti = 0; ti < 2; ti++) {
      roundRectPath(ctx, headCX + headR - 1 + ti * 5, headCY + 12, 4, 8, 1.5);
      ctx.fill();
    }
    ctx.strokeStyle = rgba('#8A4A26', 0.5);
    ctx.lineWidth = 0.8;
    for (var ts = 0; ts < 2; ts++) {
      roundRectPath(ctx, headCX + headR - 1 + ts * 5, headCY + 12, 4, 8, 1.5);
      ctx.stroke();
    }

    // --- Pan flute lifted to the mouth when playing --------------------------
    if (mood === 'play') {
      // little pumping motion as the cavy breathes into it
      var pump = Math.sin(t * 6) * 2;
      panFlute(ctx, headCX + headR + 6, headCY + 6 + pump, 0.7);
      // two paw arcs holding it
      ctx.strokeStyle = C[0];
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(headCX + headR + 12, headCY + 22, 8, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      // musical breath puffs
      ctx.fillStyle = rgba('#FFFFFF', 0.5);
      for (var pf = 0; pf < 3; pf++) {
        var puff = (t * 1.5 + pf * 0.33) % 1;
        circle(ctx, headCX + headR + 34, headCY - puff * 26, 3 + pf);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /* ===========================================================================
   * LLAMA (rival) — tall, haughty, long curved neck, smug lidded eyes.
   * moods: 'idle' | 'taunt' | 'play' | 'happy' | 'sad'
   * ========================================================================= */
  function llama(ctx, x, y, s, mood, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);

    var C = PAL.llama;
    t = t || 0;

    var breathe = Math.sin(t * 2) * 1.4;
    var headTilt = 0, bounce = 0, droop = 0, neckLean = 0;
    if (mood === 'taunt') {
      headTilt = -0.22 + Math.sin(t * 3) * 0.05; // snooty head-back tilt
      neckLean = -4;
    } else if (mood === 'happy') {
      bounce = Math.abs(Math.sin(t * 5)) * 10;
      headTilt = Math.sin(t * 8) * 0.1;
    } else if (mood === 'sad') {
      droop = 10;
      headTilt = 0.3;               // hangs its head
      breathe *= 0.4;
    } else if (mood === 'play') {
      headTilt = Math.sin(t * 3) * 0.08;
    }

    ctx.translate(0, -bounce + droop);

    // Ground shadow.
    ellipse(ctx, 0, 0, 40, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fill();

    // --- Legs: two thin rounded rects ----------------------------------------
    ctx.fillStyle = C[2];
    for (var lg = -1; lg <= 1; lg += 2) {
      roundRectPath(ctx, lg * 16 - 6, -46, 12, 46, 5);
      ctx.fill();
    }

    // --- Body: upright rounded blob, woolly scalloped top --------------------
    var bodyTop = -110 - breathe;
    var bodyBot = -40;
    var bodyH = bodyBot - bodyTop;
    roundRectPath(ctx, -34, bodyTop, 68, bodyH, 26);
    ctx.fillStyle = C[0];
    ctx.fill();

    // Woolly bumps along the top edge.
    ctx.fillStyle = C[1];
    for (var w = -3; w <= 3; w++) {
      circle(ctx, w * 10, bodyTop + 2, 7);
      ctx.fill();
    }

    // Boss / red-poncho stripe (all llamas here get a jaunty stripe).
    ctx.fillStyle = C[3];
    roundRectPath(ctx, -34, bodyTop + bodyH * 0.42, 68, 12, 4);
    ctx.fill();

    // --- Long curved neck rising from the body -------------------------------
    var neckBaseX = 8, neckBaseY = bodyTop + 14;
    var headX = 26 + neckLean, headY = bodyTop - 46;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(neckBaseX - 14, neckBaseY);
    // outer edge up to head
    ctx.quadraticCurveTo(neckBaseX + 26, neckBaseY - 30, headX + 4, headY + 10);
    ctx.lineTo(headX - 14, headY + 14);
    // inner edge back down
    ctx.quadraticCurveTo(neckBaseX - 4, neckBaseY - 24, neckBaseX + 4, neckBaseY);
    ctx.closePath();
    ctx.fillStyle = C[0];
    ctx.fill();
    ctx.restore();

    // --- Head (small oval, tilted for a snooty look) -------------------------
    ctx.save();
    ctx.translate(headX, headY);
    ctx.rotate(headTilt);

    ellipse(ctx, 0, 0, 20, 16);
    ctx.fillStyle = C[0];
    ctx.fill();

    // Snout out front.
    ellipse(ctx, 16, 6, 12, 9);
    ctx.fillStyle = C[1];
    ctx.fill();
    // nostrils + mouth line
    ctx.fillStyle = C[4];
    circle(ctx, 20, 4, 1.6); ctx.fill();
    circle(ctx, 20, 9, 1.6); ctx.fill();
    ctx.strokeStyle = C[4];
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    if (mood === 'sad') {
      ctx.arc(12, 14, 5, Math.PI * 1.15, Math.PI * 1.85); // frown
    } else {
      ctx.arc(12, 8, 5, 0.15, 1.1);                       // smirk
    }
    ctx.stroke();

    // Floppy teardrop ears off the top.
    ctx.fillStyle = C[0];
    for (var ea = -1; ea <= 1; ea += 2) {
      ctx.save();
      ctx.translate(ea * 10, -14);
      ctx.rotate(ea * (0.9 + Math.sin(t * 3 + ea) * 0.08));
      ellipse(ctx, 0, -6, 5, 11);
      ctx.fill();
      ctx.fillStyle = C[1];
      ellipse(ctx, 0, -6, 2.5, 7);
      ctx.fill();
      ctx.fillStyle = C[0];
      ctx.restore();
    }

    // Smug lidded eyes: downward half-moon arcs with flicking lashes.
    ctx.strokeStyle = C[4];
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (var ey = -1; ey <= 1; ey += 2) {
      var exx = 2 + ey * 8;
      ctx.beginPath();
      ctx.arc(exx, -2, 5, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      // three lashes at the outer corner
      var lashX = exx + ey * 5, lashY = -2;
      for (var la = 0; la < 3; la++) {
        ctx.beginPath();
        ctx.moveTo(lashX, lashY + la);
        ctx.lineTo(lashX + ey * 4, lashY + la - 3);
        ctx.stroke();
      }
    }

    // Angry V-brows when playing/taunting to look like a real rival.
    if (mood === 'taunt' || mood === 'play') {
      ctx.lineWidth = 2.4;
      for (var br = -1; br <= 1; br += 2) {
        ctx.beginPath();
        ctx.moveTo(2 + br * 3, -12);
        ctx.lineTo(2 + br * 11, -9);
        ctx.stroke();
      }
    }

    ctx.restore(); // head

    ctx.restore(); // whole llama
  }

  /* ===========================================================================
   * MARIACHI (band rival) — sombrero, big curly moustache, tiny vihuela guitar.
   * moods: 'idle' | 'taunt' | 'play' | 'happy' | 'sad'
   * ========================================================================= */
  function mariachi(ctx, x, y, s, mood, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);

    var C = PAL.mariachi;
    t = t || 0;

    var breathe = Math.sin(t * 2.1) * 1.4;
    var bounce = 0, sway = 0, droop = 0;
    if (mood === 'happy') {
      bounce = Math.abs(Math.sin(t * 5)) * 10;
      sway = Math.sin(t * 5) * 0.06;
    } else if (mood === 'sad') {
      droop = 8;
      breathe *= 0.4;
    } else if (mood === 'play') {
      sway = Math.sin(t * 4) * 0.05;   // strumming rock
    } else if (mood === 'taunt') {
      sway = Math.sin(t * 2) * 0.08;
    }

    ctx.translate(0, -bounce + droop);
    ctx.rotate(sway);

    // Ground shadow.
    ellipse(ctx, 0, 0, 40, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fill();

    // --- Charro body (rounded) -----------------------------------------------
    var bodyCY = -52 - breathe;
    ellipse(ctx, 0, bodyCY, 40, 48);
    ctx.fillStyle = C[0];
    ctx.fill();

    // Gold botón dots down the jacket front.
    ctx.fillStyle = C[1];
    for (var b = 0; b < 4; b++) {
      circle(ctx, 0, bodyCY - 20 + b * 16, 3);
      ctx.fill();
    }
    // hint of purple lapel
    ctx.strokeStyle = C[4];
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-12, bodyCY - 34);
    ctx.lineTo(-4, bodyCY + 6);
    ctx.moveTo(12, bodyCY - 34);
    ctx.lineTo(4, bodyCY + 6);
    ctx.stroke();

    // --- Head, mostly shadowed under the brim --------------------------------
    var headCY = bodyCY - 52;
    ellipse(ctx, 0, headCY, 24, 24);
    ctx.fillStyle = C[3];
    ctx.fill();
    // shadow band under brim
    ellipse(ctx, 0, headCY - 4, 24, 14);
    ctx.fillStyle = 'rgba(20,10,30,0.4)';
    ctx.fill();

    // Two dot eyes peeking out of the shadow.
    drawEyesAt(ctx, 0, headCY - 2, 7, 3);

    // --- Big curly moustache (mirrored bezier hooks curling up) ---------------
    ctx.strokeStyle = '#241a16';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    var mustY = headCY + 8;
    for (var m = -1; m <= 1; m += 2) {
      ctx.beginPath();
      ctx.moveTo(0, mustY);
      ctx.bezierCurveTo(m * 8, mustY + 4, m * 18, mustY + 2, m * 20, mustY - 6);
      ctx.bezierCurveTo(m * 22, mustY - 12, m * 14, mustY - 12, m * 15, mustY - 6);
      ctx.stroke();
    }

    // --- Sombrero: wide brim ellipse + dome, gold with red band --------------
    var hatY = headCY - 18;
    // brim
    ellipse(ctx, 0, hatY, 46, 13);
    ctx.fillStyle = C[1];
    ctx.fill();
    // scalloped gold trim along the brim edge
    ctx.strokeStyle = rgba(C[2], 0.9);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (var sc = -44; sc <= 44; sc += 8) {
      ctx.arc(sc, hatY + 9, 4, Math.PI, 0, false);
    }
    ctx.stroke();
    // dome
    ctx.save();
    ellipse(ctx, 0, hatY - 2, 24, 26);
    ctx.clip();
    ctx.fillStyle = C[1];
    ctx.fillRect(-24, hatY - 30, 48, 30);
    // red band
    ctx.fillStyle = C[2];
    ctx.fillRect(-24, hatY - 8, 48, 7);
    ctx.restore();
    // dome outline for a crisp top
    ctx.beginPath();
    ctx.ellipse(0, hatY - 2, 24, 26, 0, Math.PI, Math.PI * 2);
    ctx.strokeStyle = rgba(C[2], 0.5);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // --- Tiny vihuela guitar held diagonally across the chest ----------------
    ctx.save();
    ctx.translate(-6, bodyCY + 4);
    ctx.rotate(-0.5);
    // figure-8 body (two overlapping circles, larger bottom)
    ctx.fillStyle = C[3];
    circle(ctx, 0, 8, 12); ctx.fill();
    circle(ctx, 0, -4, 9); ctx.fill();
    // soundhole
    circle(ctx, 0, 4, 3);
    ctx.fillStyle = '#3a2a16';
    ctx.fill();
    // neck + frets
    ctx.fillStyle = C[4];
    roundRectPath(ctx, -3, -34, 6, 22, 2);
    ctx.fill();
    ctx.strokeStyle = rgba('#F3E9CF', 0.8);
    ctx.lineWidth = 1;
    for (var fr = 0; fr < 4; fr++) {
      ctx.beginPath();
      ctx.moveTo(-3, -30 + fr * 5);
      ctx.lineTo(3, -30 + fr * 5);
      ctx.stroke();
    }
    ctx.restore();

    // strumming arm arc when playing
    if (mood === 'play') {
      ctx.strokeStyle = C[0];
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      var strum = Math.sin(t * 10) * 6;
      ctx.beginPath();
      ctx.arc(6, bodyCY + 6 + strum, 10, Math.PI * 0.9, Math.PI * 1.6);
      ctx.stroke();
      // musical note puffs
      ctx.fillStyle = rgba(C[1], 0.7);
      for (var mp = 0; mp < 3; mp++) {
        var pv = (t * 1.4 + mp * 0.33) % 1;
        circle(ctx, 30, bodyCY - pv * 30, 2.5 + mp);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  // Helper: eyes drawn at an explicit local centre (used by mariachi).
  function drawEyesAt(ctx, cx, cy, half, r) {
    ctx.save();
    ctx.translate(cx, cy);
    drawEyes(ctx, half, 0, r);
    ctx.restore();
  }

  /* ===========================================================================
   * PAN FLUTE prop — a row of 5-6 tan vertical rounded rects of descending
   * height, bound by two ties. Drawn so (x, y) is the top-left of the tallest
   * pipe, scaled by s.
   * ========================================================================= */
  function panFlute(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);

    var C = PAL.guineaPig;
    var pipes = 6;
    var pw = 7;          // pipe width
    var gap = 2;         // gap between pipes
    var tall = 46;       // tallest pipe height

    for (var i = 0; i < pipes; i++) {
      var h = tall - i * 6;                // descending height
      var px = i * (pw + gap);
      // pipe body with a soft vertical gradient
      var g = ctx.createLinearGradient(px, 0, px + pw, 0);
      g.addColorStop(0, C[2]);
      g.addColorStop(0.5, '#D9B98A');
      g.addColorStop(1, C[1]);
      roundRectPath(ctx, px, 0, pw, h, 3);
      ctx.fillStyle = g;
      ctx.fill();
      // dark hole at the top of each pipe
      ellipse(ctx, px + pw / 2, 3, pw / 2 - 1, 2);
      ctx.fillStyle = '#5a3a20';
      ctx.fill();
    }

    // two binding ties across the pipes
    ctx.strokeStyle = C[1];
    ctx.lineWidth = 3;
    var span = pipes * (pw + gap) - gap;
    for (var b = 0; b < 2; b++) {
      var by = 8 + b * 12;
      ctx.beginPath();
      ctx.moveTo(-1, by);
      ctx.lineTo(span + 1, by);
      ctx.stroke();
    }

    ctx.restore();
  }

  /* ===========================================================================
   * BACKGROUNDS — layered & gently animated. Fills the whole (w x h) canvas.
   * theme: 'meadow' | 'fiesta' | 'mountain'
   * ========================================================================= */
  function background(ctx, w, h, theme, t) {
    ctx.save();
    t = t || 0;

    if (theme === 'fiesta') {
      drawFiesta(ctx, w, h, t);
    } else if (theme === 'mountain') {
      drawMountain(ctx, w, h, t);
    } else {
      drawMeadow(ctx, w, h, t);
    }

    ctx.restore();
  }

  // --- Meadow: sky, drifting clouds, rolling hills -------------------------
  function drawMeadow(ctx, w, h, t) {
    var C = PAL.meadow;
    // sky gradient
    var sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, C[3]);
    sky.addColorStop(0.6, '#CFF0FF');
    sky.addColorStop(1, C[4]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // warm sun
    circle(ctx, w * 0.82, h * 0.2, 40);
    ctx.fillStyle = rgba(C[4], 0.9);
    ctx.fill();
    circle(ctx, w * 0.82, h * 0.2, 54);
    ctx.fillStyle = rgba(C[4], 0.25);
    ctx.fill();

    // drifting clouds (parallax by looping x)
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (var c = 0; c < 4; c++) {
      var speed = 12 + c * 5;
      var cx = ((t * speed + c * 260) % (w + 160)) - 80;
      var cy = h * (0.14 + c * 0.07);
      cloud(ctx, cx, cy, 0.8 + (c % 2) * 0.3);
    }

    // rolling hills (back to front)
    hill(ctx, w, h, h * 0.62, C[2], t * 4, 60);
    hill(ctx, w, h, h * 0.72, C[0], t * 7, 80);
    // front grassy field
    ctx.fillStyle = C[1];
    ctx.fillRect(0, h * 0.8, w, h * 0.2);
    // little swaying grass blades
    ctx.strokeStyle = rgba(C[0], 0.8);
    ctx.lineWidth = 2;
    for (var g = 0; g < w; g += 26) {
      var gs = Math.sin(t * 2 + g) * 4;
      ctx.beginPath();
      ctx.moveTo(g, h);
      ctx.quadraticCurveTo(g + gs, h - 18, g + gs * 1.6, h - 26);
      ctx.stroke();
    }
  }

  // --- Fiesta: warm dusk sky + papel-picado bunting ------------------------
  function drawFiesta(ctx, w, h, t) {
    var C = PAL.fiesta;
    var sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, C[0]);
    sky.addColorStop(0.55, C[1]);
    sky.addColorStop(1, C[2]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // soft glowing lanterns / bokeh
    for (var l = 0; l < 6; l++) {
      var lx = (l + 0.5) * (w / 6);
      var ly = h * (0.35 + Math.sin(t * 0.8 + l) * 0.03);
      circle(ctx, lx, ly, 10 + (l % 3) * 4);
      ctx.fillStyle = rgba(C[3], 0.5);
      ctx.fill();
    }

    // ground/stage
    ctx.fillStyle = '#3a1c5c';
    ctx.fillRect(0, h * 0.82, w, h * 0.18);
    ctx.fillStyle = rgba('#000000', 0.2);
    ctx.fillRect(0, h * 0.82, w, 6);

    // papel-picado bunting: two draped strings of flags
    var flagCols = [C[1], C[3], C[4], C[2]];
    for (var row = 0; row < 2; row++) {
      var baseY = 26 + row * 30;
      var sag = 22;
      // draped string
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (var xx = 0; xx <= w; xx += 8) {
        var yy = baseY + Math.sin(xx / 60) * 4 + Math.abs(Math.sin(xx / 120)) * sag;
        if (xx === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
      // flags hanging under the string, gently fluttering
      var fw = 34;
      for (var fx = 10, idx = 0; fx < w - fw; fx += fw + 6, idx++) {
        var fy = baseY + Math.sin(fx / 60) * 4 + Math.abs(Math.sin(fx / 120)) * sag;
        var flutter = Math.sin(t * 3 + idx + row) * 3;
        ctx.fillStyle = flagCols[(idx + row) % flagCols.length];
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx + fw, fy);
        ctx.lineTo(fx + fw / 2, fy + 24 + flutter);
        ctx.closePath();
        ctx.fill();
        // punched hole detail
        circle(ctx, fx + fw / 2, fy + 9, 3);
        ctx.fillStyle = rgba('#000000', 0.15);
        ctx.fill();
      }
    }
  }

  // --- Mountain: cool sky, layered peaks with snow caps --------------------
  function drawMountain(ctx, w, h, t) {
    var C = PAL.mountain;
    var sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, C[0]);
    sky.addColorStop(0.55, C[1]);
    sky.addColorStop(1, C[2]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // pale sun/moon
    circle(ctx, w * 0.2, h * 0.22, 34);
    ctx.fillStyle = rgba(C[4], 0.8);
    ctx.fill();

    // drifting thin clouds
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (var c = 0; c < 3; c++) {
      var cx = ((t * (8 + c * 4) + c * 300) % (w + 200)) - 100;
      cloud(ctx, cx, h * (0.2 + c * 0.08), 1.1);
    }

    // three ranges of peaks, far -> near
    peaks(ctx, w, h, h * 0.5, h * 0.78, C[3], 3);
    peaks(ctx, w, h, h * 0.58, h * 0.82, C[1], 4);
    peaks(ctx, w, h, h * 0.66, h * 0.9, C[0], 5, true); // near range + snow caps

    // snowy foreground
    ctx.fillStyle = C[2];
    ctx.fillRect(0, h * 0.86, w, h * 0.14);
  }

  /* ------------------------- background sub-helpers ------------------------ */

  // A puffy 3-lobe cloud centred at (cx, cy).
  function cloud(ctx, cx, cy, s) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    circle(ctx, -20, 0, 16); ctx.fill();
    circle(ctx, 0, -6, 20); ctx.fill();
    circle(ctx, 20, 0, 16); ctx.fill();
    roundRectPath(ctx, -34, -2, 68, 16, 8); ctx.fill();
    ctx.restore();
  }

  // One sinuous hill band filling from crestY to the bottom of the canvas.
  function hill(ctx, w, h, crestY, color, phase, amp) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, crestY);
    for (var xx = 0; xx <= w; xx += 20) {
      var yy = crestY + Math.sin((xx + phase) / amp) * (amp * 0.25);
      ctx.lineTo(xx, yy);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }

  // A jagged mountain range between crestY (peak tips) and baseY (base line).
  function peaks(ctx, w, h, crestY, baseY, color, count, snow) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, baseY);
    var step = w / count;
    var tips = [];
    for (var i = 0; i <= count; i++) {
      var px = i * step;
      var py = (i % 2 === 0) ? crestY : baseY - (baseY - crestY) * 0.35;
      tips.push([px, py]);
      ctx.lineTo(px, py);
    }
    ctx.lineTo(w, baseY);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // snow caps on the tall (even-index) tips
    if (snow) {
      ctx.fillStyle = PAL.mountain[2];
      for (var s = 0; s < tips.length; s += 2) {
        var tx = tips[s][0], ty = tips[s][1];
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx - 16, ty + 22);
        ctx.quadraticCurveTo(tx - 6, ty + 14, tx, ty + 20);
        ctx.quadraticCurveTo(tx + 6, ty + 14, tx + 16, ty + 22);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  /* ---------------------------------------------------------------------------
   * Publish the public API.
   * ------------------------------------------------------------------------- */
  global.Characters = {
    guineaPig: guineaPig,
    llama: llama,
    mariachi: mariachi,
    background: background,
    panFlute: panFlute
  };

})(typeof window !== 'undefined' ? window : this);
