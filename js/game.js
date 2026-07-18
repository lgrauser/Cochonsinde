/*
 * game.js  —  Cavia Con Carne: Pan-Flute Fury
 * ===========================================================================
 * The top-level controller & renderer. This is the "glue" file: it owns the
 * requestAnimationFrame loop, the input handling, the finite state machine and
 * all of the on-screen drawing. It leans on the other modules for the heavy
 * lifting:
 *
 *   AudioEngine  (audio.js)      -> all sound
 *   Characters   (characters.js) -> pure canvas draw routines
 *   SONGS/KEY_MAP/LANES (songs.js) -> chart data + input mapping
 *   RhythmEngine (rhythm.js)      -> scoring, timing windows, note geometry
 *
 * Loading model: plain <script>, no modules. We publish exactly one global,
 * the `Game` class. A tiny inline bootstrap in index.html does:
 *     new Game(document.getElementById('game'));
 *
 * State machine:
 *     menu  ->  countin (3-2-1-GO)  ->  battle  ->  results  ->  menu
 *                                         ^  \-> paused (Esc toggles)
 *
 * Everything degrades gracefully: audio is optional, and a frame never throws
 * because of a missing sound.
 * ===========================================================================
 */

(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Fixed logical resolution. The backing store is scaled by devicePixelRatio
   * for crispness and the CSS box is scaled to fit the viewport (see _resize),
   * but ALL drawing code below works in this stable 900x600 coordinate space.
   * ------------------------------------------------------------------ */
  var W = 900;
  var H = 600;

  /* ------------------------------------------------------------------ *
   * Note-highway geometry (logical coordinates).
   * ------------------------------------------------------------------ */
  var LANE_W = 62;                       // width of one lane
  var HIGHWAY_W = LANE_W * 4;            // total highway width (4 lanes)
  var HIGHWAY_X = (W - HIGHWAY_W) / 2;   // left edge, horizontally centered
  var TOP_Y = 88;                        // where notes first appear
  var HIT_Y = 496;                       // the judgement / hit line
  var LOOK_AHEAD = 1.75;                 // seconds a note is visible before its hit time

  // Per-lane visual identity: label glyph + hue. LANES order is left,down,up,right.
  var LANE_STYLE = {
    left:  { color: '#F2B8C6', keys: 'D / ←' },
    down:  { color: '#F9E04C', keys: 'F / ↓' },
    up:    { color: '#8FD46A', keys: 'J / ↑' },
    right: { color: '#7ECBF0', keys: 'K / →' }
  };

  // Copy of the design "uiText" so the controller is self-contained.
  var UI = {
    title: 'Cavia Con Carne: Pan-Flute Fury',
    tagline: 'One brave guinea pig, one magic pan flute, and a whole lot of shady llamas — ¡toca o corre!',
    winLines: [
      '¡Órale! You out-piped the fluff — that llama just got wheek-ted off the stage!',
      'Flawless run, maestro cavy! The crowd throws churros and lettuce.',
      'Sí sí sí! Your groove is smoother than a freshly brushed rosette.'
    ],
    loseLines: [
      'Ay, cochino! The llama spat, you slipped, the beat left without you.',
      'Off-tempo, little piggy — even the mariachi’s moustache is disappointed.',
      'Wheek noooo... your flute went flat and the llama took the trophy. Otra vez?'
    ]
  };

  /* ================================================================== *
   * Small helpers
   * ================================================================== */

  // Clamp helper.
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  // x-center of lane index i (0..3).
  function laneCenterX(i) { return HIGHWAY_X + i * LANE_W + LANE_W / 2; }

  // Convert a lane direction to its index within LANES.
  function laneIndex(dir) { return LANES.indexOf(dir); }

  // Rounded-rectangle path (used for panels & bars).
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Draw a directional arrow glyph centered at (cx,cy) fitting roughly `size`.
  function drawArrow(ctx, cx, cy, size, dir, fill, stroke) {
    var a = { left: Math.PI, down: Math.PI / 2, up: -Math.PI / 2, right: 0 }[dir] || 0;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    var s = size / 2;
    // A chunky, friendly arrow: triangular head + short tail.
    ctx.beginPath();
    ctx.moveTo(s, 0);              // tip
    ctx.lineTo(0, -s);            // upper barb
    ctx.lineTo(0, -s * 0.42);
    ctx.lineTo(-s, -s * 0.42);   // tail
    ctx.lineTo(-s, s * 0.42);
    ctx.lineTo(0, s * 0.42);
    ctx.lineTo(0, s);            // lower barb
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = 2.5; ctx.strokeStyle = stroke; ctx.stroke(); }
    ctx.restore();
  }

  /* ================================================================== *
   * TOUCH / POINTER hit-boxes (logical coordinates).
   * These same rects are used by both the renderer (to draw the on-screen
   * buttons) and the input router (to hit-test taps), so they always match.
   * ================================================================== */

  var LANE_TAP_TOP = 452;                // taps below this y in a battle press a lane
  var LANE_BTN_TOP = 524;                // where the visible lane buttons start (below the hit line)

  function pointInRect(px, py, r) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }
  // Song-select row i (mirrors the geometry drawn in _renderMenu).
  function menuRowRect(i) { return { x: 424, y: 194 + i * 78, w: 432, h: 72 }; }
  // Visible lane button i (full-width quarters along the bottom). Tall + wide
  // so they're comfortable finger targets once the canvas is scaled down on a phone.
  function laneBtnRect(i) { var bw = W / 4; return { x: i * bw + 5, y: LANE_BTN_TOP, w: bw - 10, h: H - LANE_BTN_TOP - 6 }; }
  // Small pause button, top-right under the HUD bars.
  function pauseBtnRect() { return { x: W - 150, y: 62, w: 126, h: 34 }; }
  // Two footer buttons on the results screen.
  function resultBtnRects() {
    var bw = 176, bh = 46, gap = 26, x0 = (W - (bw * 2 + gap)) / 2, y = H - 66;
    return { replay: { x: x0, y: y, w: bw, h: bh }, menu: { x: x0 + bw + gap, y: y, w: bw, h: bh } };
  }
  // Two centered buttons on the pause overlay.
  function pauseMenuRects() {
    var bw = 210, bh = 50, gap = 22, total = bw * 2 + gap, x0 = (W - total) / 2, y = H / 2 + 18;
    return { resume: { x: x0, y: y, w: bw, h: bh }, menu: { x: x0 + bw + gap, y: y, w: bw, h: bh } };
  }
  // Generic rounded button used by the touch overlays.
  function drawButton(ctx, r, label, fill, textColor, big) {
    ctx.save();
    roundRect(ctx, r.x, r.y, r.w, r.h, Math.min(14, r.h / 2));
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(42,35,64,0.35)';
    ctx.stroke();
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 ' + (big ? 20 : 16) + 'px system-ui, sans-serif';
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1);
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
  }

  /* ================================================================== *
   * Game class
   * ================================================================== */

  /**
   * @param {HTMLCanvasElement} canvas  the target canvas element
   */
  function Game(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // --- subsystems -------------------------------------------------
    this.audio = new AudioEngine();
    this.rhythm = null;              // created per battle
    this.song = null;                // current SONGS entry

    // --- state machine ---------------------------------------------
    this.state = 'menu';             // menu | countin | battle | paused | results
    this.audioUnlocked = false;      // first-gesture guard for AudioEngine.resume()

    // --- menu state -------------------------------------------------
    this.menuIndex = 0;              // selected song row

    // --- clocks -----------------------------------------------------
    this.startPerf = performance.now();  // wall clock origin (for menu animation)
    this.battleStart = 0;            // performance.now() at song time 0
    this.countStart = 0;             // performance.now() when count-in began
    this.lastCountBeat = -1;         // which count beat has already been announced
    this.pausePerf = 0;              // performance.now() when we paused

    // --- results ----------------------------------------------------
    this.result = null;              // { win, rank, line, ... } filled in on finish

    // --- transient battle visuals ----------------------------------
    this.laneFlash = { left: 0, down: 0, up: 0, right: 0 };   // decay timers
    this.laneHeld = { left: false, down: false, up: false, right: false };
    this.floaters = [];              // floating PERFECT!/GOOD/MISS texts
    this.recentMiss = 0;            // seconds since last miss (drives rival taunt)
    this.recentPerfect = 0;         // seconds since last perfect (drives hero glee)
    this.hitShake = 0;              // small screen-shake pulse on miss

    // --- touch / pointer -------------------------------------------
    this._touchUsed = false;         // once true, on-screen touch buttons render
    this._touchMap = {};             // pointer/touch id -> lane dir (for release)

    // --- bind & wire -----------------------------------------------
    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onKeyUp = this._handleKeyUp.bind(this);
    this._onResize = this._resize.bind(this);
    this._loop = this._frame.bind(this);
    this._onTouchStart = this._handleTouchStart.bind(this);
    this._onTouchEnd = this._handleTouchEnd.bind(this);
    this._onMouseDown = this._handleMouseDown.bind(this);
    this._onMouseUp = this._handleMouseUp.bind(this);

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);
    // Touch: passive:false so we can preventDefault (stop scroll/zoom/double-tap).
    this.canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
    this.canvas.addEventListener('touchend', this._onTouchEnd, { passive: false });
    this.canvas.addEventListener('touchcancel', this._onTouchEnd, { passive: false });
    // Mouse: lets desktop players click the menu / on-screen buttons too.
    this.canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);

    this._resize();
    requestAnimationFrame(this._loop);
  }

  /* ------------------------------------------------------------------ *
   * Canvas sizing: high-DPI backing store + responsive CSS box.
   * ------------------------------------------------------------------ */
  Game.prototype._resize = function () {
    var dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
    // Backing store at device pixels for crisp rendering.
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    // All drawing uses logical units; this transform maps them to device px.
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // CSS box: fit inside the viewport while preserving the 3:2 aspect ratio.
    var vw = window.innerWidth || W;
    var vh = window.innerHeight || H;
    var scale = Math.min(vw / W, vh / H);
    if (!isFinite(scale) || scale <= 0) scale = 1;
    this.canvas.style.width = Math.round(W * scale) + 'px';
    this.canvas.style.height = Math.round(H * scale) + 'px';
  };

  /* ================================================================== *
   * INPUT
   * ================================================================== */

  Game.prototype._handleKeyDown = function (e) {
    // First interaction anywhere unlocks the audio context (browser policy).
    if (!this.audioUnlocked) {
      this.audioUnlocked = true;
      try { this.audio.resume(); } catch (err) { /* audio optional */ }
    }

    var code = e.code;

    // Route by state ------------------------------------------------
    if (this.state === 'menu') {
      this._menuKey(code, e);
    } else if (this.state === 'battle') {
      this._battleKey(code, e);
    } else if (this.state === 'paused') {
      if (code === 'Escape' || code === 'KeyP') { this._resumeFromPause(); e.preventDefault(); }
      else if (code === 'Enter') { this._toMenu(); e.preventDefault(); } // quit to menu
    } else if (this.state === 'results') {
      if (code === 'Enter') { this._startCountIn(this.song); e.preventDefault(); }       // replay
      else if (code === 'Escape') { this._toMenu(); e.preventDefault(); }                // menu
    } else if (this.state === 'countin') {
      if (code === 'Escape') { this._toMenu(); e.preventDefault(); }
    }
  };

  Game.prototype._handleKeyUp = function (e) {
    var dir = KEY_MAP[e.code];
    if (dir) this.laneHeld[dir] = false;
  };

  // --- menu key handling -------------------------------------------
  Game.prototype._menuKey = function (code, e) {
    if (code === 'ArrowUp' || code === 'KeyW') {
      this.menuIndex = (this.menuIndex + SONGS.length - 1) % SONGS.length;
      this.audio.sfx('select');
      e.preventDefault();
    } else if (code === 'ArrowDown' || code === 'KeyS') {
      this.menuIndex = (this.menuIndex + 1) % SONGS.length;
      this.audio.sfx('select');
      e.preventDefault();
    } else if (code === 'Enter' || code === 'Space') {
      this.audio.sfx('select');
      this._startCountIn(SONGS[this.menuIndex]);
      e.preventDefault();
    }
  };

  // --- battle key handling (a lane hit) ----------------------------
  Game.prototype._battleKey = function (code, e) {
    if (code === 'Escape' || code === 'KeyP') { this._pause(); e.preventDefault(); return; }

    var dir = KEY_MAP[code];
    if (!dir) return;               // not a gameplay key
    e.preventDefault();

    if (e.repeat) return;           // ignore auto-repeat while a key is held
    this._pressLane(dir);
  };

  // Register a single hit on a lane (shared by keyboard AND touch/mouse input).
  Game.prototype._pressLane = function (dir) {
    if (this.state !== 'battle') return;
    this.laneHeld[dir] = true;
    this.laneFlash[dir] = 0.16;     // light the lane briefly

    var now = this._songTime();
    var j = this.rhythm.judge(dir, now);

    // Audio + visual feedback.
    this.audio.playFlute(dir);      // the pan flute always sings on a press
    if (j.result === 'perfect') {
      this.audio.sfx('perfect');
      this.recentPerfect = 0.9;
    } else if (j.result === 'good') {
      this.audio.sfx('hit');
    } else { // miss
      this.audio.sfx('miss');
      this.recentMiss = 1.2;
      this.hitShake = 0.18;
    }
    this._spawnFloater(dir, j.result);
  };

  /* ================================================================== *
   * TOUCH / MOUSE input — routed through the same state machine as keys.
   * ================================================================== */

  // Map a viewport (client) coordinate onto the fixed 900x600 logical space.
  Game.prototype._clientToLogical = function (clientX, clientY) {
    var rect = this.canvas.getBoundingClientRect();
    var sx = rect.width ? W / rect.width : 1;
    var sy = rect.height ? H / rect.height : 1;
    return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
  };

  Game.prototype._handleTouchStart = function (e) {
    e.preventDefault();             // stop scroll / pinch / double-tap-zoom
    this._touchUsed = true;
    this._unlockAudio();
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      var p = this._clientToLogical(t.clientX, t.clientY);
      this._tapDown(p.x, p.y, 't' + t.identifier);
    }
  };

  Game.prototype._handleTouchEnd = function (e) {
    if (e.cancelable) e.preventDefault();
    for (var i = 0; i < e.changedTouches.length; i++) {
      this._tapUp('t' + e.changedTouches[i].identifier);
    }
  };

  Game.prototype._handleMouseDown = function (e) {
    this._touchUsed = true;
    this._unlockAudio();
    var p = this._clientToLogical(e.clientX, e.clientY);
    this._tapDown(p.x, p.y, 'mouse');
  };

  Game.prototype._handleMouseUp = function () { this._tapUp('mouse'); };

  Game.prototype._unlockAudio = function () {
    if (this.audioUnlocked) return;
    this.audioUnlocked = true;
    try { this.audio.resume(); } catch (err) { /* audio optional */ }
  };

  // A pointer went down at logical (lx,ly). Route by state; `id` lets us release
  // the right lane on the matching touchend (multi-touch friendly).
  Game.prototype._tapDown = function (lx, ly, id) {
    if (this.state === 'menu') {
      for (var i = 0; i < SONGS.length; i++) {
        if (pointInRect(lx, ly, menuRowRect(i))) {
          if (i === this.menuIndex) { this.audio.sfx('select'); this._startCountIn(SONGS[i]); }
          else { this.menuIndex = i; this.audio.sfx('select'); }
          return;
        }
      }
    } else if (this.state === 'battle') {
      if (pointInRect(lx, ly, pauseBtnRect())) { this._pause(); return; }
      if (ly >= LANE_TAP_TOP) {
        var lane = clamp(Math.floor(lx / (W / 4)), 0, 3);
        var dir = LANES[lane];
        this._touchMap[id] = dir;
        this._pressLane(dir);
      }
    } else if (this.state === 'paused') {
      var pr = pauseMenuRects();
      if (pointInRect(lx, ly, pr.resume)) { this._resumeFromPause(); return; }
      if (pointInRect(lx, ly, pr.menu)) { this._toMenu(); return; }
    } else if (this.state === 'results') {
      var rr = resultBtnRects();
      if (pointInRect(lx, ly, rr.replay)) { this._startCountIn(this.song); return; }
      if (pointInRect(lx, ly, rr.menu)) { this._toMenu(); return; }
    }
  };

  Game.prototype._tapUp = function (id) {
    var dir = this._touchMap[id];
    if (dir) { this.laneHeld[dir] = false; delete this._touchMap[id]; }
  };

  /* ================================================================== *
   * STATE TRANSITIONS
   * ================================================================== */

  // Enter the 3-2-1-GO count-in for a given song.
  Game.prototype._startCountIn = function (song) {
    this.song = song;
    this.rhythm = new RhythmEngine(song);
    this.rhythm.reset();
    this.result = null;
    this.floaters.length = 0;
    this.recentMiss = 0;
    this.recentPerfect = 0;
    this.hitShake = 0;
    this.state = 'countin';
    this.countStart = performance.now();
    this.lastCountBeat = -1;
  };

  // Called once the count-in elapses: begin the actual battle & backing groove.
  Game.prototype._beginBattle = function () {
    this.state = 'battle';
    this.battleStart = performance.now();     // song time 0 starts now
    try { this.audio.startBacking(this.song.bpm, this.song.theme); } catch (e) {}
  };

  Game.prototype._pause = function () {
    if (this.state !== 'battle') return;
    this.state = 'paused';
    this.pausePerf = performance.now();
    try { this.audio.stopBacking(); } catch (e) {}
  };

  Game.prototype._resumeFromPause = function () {
    if (this.state !== 'paused') return;
    // Shift the song-time origin forward by the paused duration so the clock
    // (and therefore note positions) resume exactly where they left off.
    var paused = performance.now() - this.pausePerf;
    this.battleStart += paused;
    this.state = 'battle';
    try { this.audio.startBacking(this.song.bpm, this.song.theme); } catch (e) {}
  };

  // Battle finished -> compute the results payload and switch screens.
  Game.prototype._finishBattle = function () {
    try { this.audio.stopBacking(); } catch (e) {}
    var r = this.rhythm;
    var win = r.health > 0;

    // Rank from perfect-accuracy (perfects / total notes).
    var total = r.totalNotes || (this.song.notes.length) || 1;
    var acc = r.perfects / total;
    var rank;
    if (acc >= 0.9) rank = 'S';
    else if (acc >= 0.75) rank = 'A';
    else if (acc >= 0.5) rank = 'B';
    else rank = 'C';
    // A loss caps the rank so it never reads S/A on a defeat.
    if (!win && (rank === 'S' || rank === 'A')) rank = 'B';

    var lines = win ? UI.winLines : UI.loseLines;
    var line = lines[Math.floor(Math.random() * lines.length)];

    this.result = {
      win: win,
      rank: rank,
      line: line,
      score: r.score,
      maxCombo: r.maxCombo,
      perfects: r.perfects,
      hits: r.hits,
      misses: r.misses,
      total: total,
      accuracy: acc
    };
    this.state = 'results';
    this.audio.sfx(win ? 'win' : 'lose');
  };

  Game.prototype._toMenu = function () {
    try { this.audio.stopBacking(); } catch (e) {}
    this.state = 'menu';
    this.audio.sfx('select');
  };

  /* ================================================================== *
   * CLOCKS
   * ================================================================== */

  // Seconds since the current battle's song time 0.
  Game.prototype._songTime = function () {
    return (performance.now() - this.battleStart) / 1000;
  };

  // Seconds since the app started (used for idle character animation).
  Game.prototype._wallTime = function () {
    return (performance.now() - this.startPerf) / 1000;
  };

  /* ================================================================== *
   * FLOATING FEEDBACK TEXT
   * ================================================================== */

  Game.prototype._spawnFloater = function (dir, result) {
    var text = result === 'perfect' ? 'PERFECT!' : (result === 'good' ? 'GOOD' : 'MISS');
    var color = result === 'perfect' ? '#F9E04C' : (result === 'good' ? '#8FD46A' : '#E86A5C');
    this.floaters.push({
      x: laneCenterX(laneIndex(dir)),
      y: HIT_Y - 40,
      text: text,
      color: color,
      life: 0,
      ttl: 0.7
    });
  };

  Game.prototype._updateFloaters = function (dt) {
    for (var i = this.floaters.length - 1; i >= 0; i--) {
      var f = this.floaters[i];
      f.life += dt;
      f.y -= dt * 46;               // drift upward
      if (f.life >= f.ttl) this.floaters.splice(i, 1);
    }
  };

  /* ================================================================== *
   * MAIN LOOP
   * ================================================================== */

  Game.prototype._frame = function (nowMs) {
    // dt in seconds, clamped so a tab-switch stall doesn't warp physics.
    if (this._lastMs == null) this._lastMs = nowMs;
    var dt = clamp((nowMs - this._lastMs) / 1000, 0, 0.05);
    this._lastMs = nowMs;

    this._update(dt);
    this._render();

    requestAnimationFrame(this._loop);
  };

  Game.prototype._update = function (dt) {
    // Decay transient visual timers regardless of state.
    for (var k in this.laneFlash) { if (this.laneFlash[k] > 0) this.laneFlash[k] -= dt; }
    if (this.recentMiss > 0) this.recentMiss -= dt;
    if (this.recentPerfect > 0) this.recentPerfect -= dt;
    if (this.hitShake > 0) this.hitShake -= dt;
    this._updateFloaters(dt);

    if (this.state === 'countin') {
      // Count-in runs for 4 beats: "3", "2", "1", "GO!".
      var secPerBeat = 60 / this.song.bpm;
      var elapsed = (performance.now() - this.countStart) / 1000;
      var beat = Math.floor(elapsed / secPerBeat);   // 0..3
      if (beat !== this.lastCountBeat && beat <= 3) {
        this.lastCountBeat = beat;
        this.audio.sfx('count');                     // blip on each number
      }
      if (elapsed >= secPerBeat * 4) {
        this._beginBattle();
      }
    } else if (this.state === 'battle') {
      var now = this._songTime();
      this.rhythm.update(now);          // advance cursor, auto-register misses

      // Watch for auto-registered misses so the rival can gloat even when the
      // player simply stops pressing keys.
      if (this._lastMissCount == null) this._lastMissCount = this.rhythm.misses;
      if (this.rhythm.misses > this._lastMissCount) {
        this.recentMiss = 1.2;
        this._lastMissCount = this.rhythm.misses;
      }

      if (this.rhythm.finished(now)) {
        this._lastMissCount = null;
        this._finishBattle();
      }
    }
  };

  /* ================================================================== *
   * RENDER — dispatches by state
   * ================================================================== */

  Game.prototype._render = function () {
    var ctx = this.ctx;
    ctx.save();
    // Small screen shake on a miss for game-feel.
    if (this.hitShake > 0) {
      var m = this.hitShake * 22;
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }

    if (this.state === 'menu') this._renderMenu();
    else if (this.state === 'countin') { this._renderBattle(true); this._renderCountIn(); }
    else if (this.state === 'battle') this._renderBattle(false);
    else if (this.state === 'paused') { this._renderBattle(false); this._renderPause(); }
    else if (this.state === 'results') this._renderResults();

    ctx.restore();
  };

  /* ------------------------------------------------------------------ *
   * MENU screen
   * ------------------------------------------------------------------ */
  Game.prototype._renderMenu = function () {
    var ctx = this.ctx;
    var t = this._wallTime();

    // Animated meadow behind the menu.
    Characters.background(ctx, W, H, 'meadow', t);

    // A cheerful guinea pig bopping, holding its flute.
    ctx.save();
    var gx = 160, gy = 360 + Math.sin(t * 2) * 4;
    Characters.guineaPig(ctx, gx, gy, 1.35, 'play', t);
    ctx.restore();

    // Title card panel.
    ctx.save();
    ctx.textAlign = 'center';
    // Title.
    ctx.font = '700 42px system-ui, "Segoe UI", sans-serif';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(42,35,64,0.85)';
    ctx.strokeText(UI.title, W / 2 + 60, 96);
    var grad = ctx.createLinearGradient(0, 60, 0, 120);
    grad.addColorStop(0, '#F9E04C');
    grad.addColorStop(1, '#F6A623');
    ctx.fillStyle = grad;
    ctx.fillText(UI.title, W / 2 + 60, 96);

    // Tagline (wrapped).
    ctx.font = '500 17px system-ui, sans-serif';
    ctx.fillStyle = '#2A2340';
    this._wrapText(ctx, UI.tagline, W / 2 + 60, 128, 560, 22);
    ctx.restore();

    // Song-select list.
    var listX = 430, listY = 200, rowH = 78, listW = 420;
    for (var i = 0; i < SONGS.length; i++) {
      var s = SONGS[i];
      var y = listY + i * rowH;
      var selected = (i === this.menuIndex);

      ctx.save();
      // Row panel — highlighted when selected, with a gentle pulse.
      var pulse = selected ? (0.5 + 0.5 * Math.sin(t * 5)) : 0;
      roundRect(ctx, listX, y, listW, rowH - 12, 14);
      ctx.fillStyle = selected ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.62)';
      ctx.fill();
      ctx.lineWidth = selected ? 4 : 2;
      ctx.strokeStyle = selected ? 'rgba(228,70,47,' + (0.6 + 0.4 * pulse) + ')' : 'rgba(42,35,64,0.25)';
      ctx.stroke();

      // Selection caret.
      if (selected) {
        ctx.fillStyle = '#E4462F';
        drawArrow(ctx, listX - 16, y + (rowH - 12) / 2, 20, 'right', '#E4462F', null);
      }

      // Song name.
      ctx.textAlign = 'left';
      ctx.fillStyle = '#2A2340';
      ctx.font = '700 22px system-ui, sans-serif';
      ctx.fillText(s.name, listX + 18, y + 30);

      // Meta line: difficulty + opponent + bpm.
      ctx.font = '500 14px system-ui, sans-serif';
      ctx.fillStyle = '#7A5C3E';
      var oppLabel = s.opponent === 'llama' ? 'vs Llama' : 'vs Mariachi';
      ctx.fillText(
        s.difficulty.toUpperCase() + '  •  ' + oppLabel + '  •  ' + s.bpm + ' BPM',
        listX + 18, y + 52
      );

      // A tiny opponent portrait on the right of the row.
      var px = listX + listW - 42, py = y + (rowH - 12) / 2 + 6;
      if (s.opponent === 'llama') Characters.llama(ctx, px, py, 0.34, selected ? 'taunt' : 'idle', t);
      else Characters.mariachi(ctx, px, py, 0.34, selected ? 'taunt' : 'idle', t);
      ctx.restore();
    }

    // Controls legend at the bottom (adapts to touch vs keyboard).
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(42,35,64,0.85)';
    if (this._touchUsed) {
      ctx.fillText('Tap a battle to select  •  tap again to play', W / 2, H - 44);
      ctx.font = '500 14px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(42,35,64,0.7)';
      ctx.fillText('In battle, tap the four arrow buttons in time', W / 2, H - 22);
    } else {
      ctx.fillText('↑ ↓  choose song      ↵ Enter  start', W / 2, H - 44);
      ctx.font = '500 14px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(42,35,64,0.7)';
      ctx.fillText('Lanes:  D / ←   F / ↓   J / ↑   K / →', W / 2, H - 22);
    }
    ctx.restore();
  };

  /* ------------------------------------------------------------------ *
   * BATTLE screen.  `previewOnly` = true during count-in (draw the scene but
   * do not advance/read live gameplay timers as if playing).
   * ------------------------------------------------------------------ */
  Game.prototype._renderBattle = function (previewOnly) {
    var ctx = this.ctx;
    var song = this.song;
    var r = this.rhythm;
    var wall = this._wallTime();
    var now = previewOnly ? 0 : this._songTime();

    // Background.
    Characters.background(ctx, W, H, song.theme, wall);

    // --- decide character moods from live performance ---------------
    var heroMood = 'play';
    if (!previewOnly) {
      if (r.health <= 25) heroMood = 'sad';
      else if (this.recentPerfect > 0 || r.combo >= 12) heroMood = 'happy';
    }
    // Rival: taunts when you miss, sulks when you're dominating.
    var rivalMood = 'play';
    if (!previewOnly) {
      if (this.recentMiss > 0) rivalMood = 'taunt';
      else if (r.combo >= 10) rivalMood = 'sad';
      else rivalMood = 'idle';
    } else {
      rivalMood = 'taunt';
    }

    // --- hero (guinea pig) on the left, mid-song bob ---------------
    ctx.save();
    var hbob = Math.sin(wall * 5) * 3;
    Characters.guineaPig(ctx, 118, 372 + hbob, 1.15, heroMood, wall);
    ctx.restore();

    // --- rival on the right ----------------------------------------
    ctx.save();
    var rbob = Math.sin(wall * 4 + 1) * 3;
    if (song.opponent === 'llama') Characters.llama(ctx, 782, 350 + rbob, 1.1, rivalMood, wall);
    else Characters.mariachi(ctx, 782, 360 + rbob, 1.05, rivalMood, wall);
    ctx.restore();

    // --- the note highway ------------------------------------------
    this._renderHighway(now, previewOnly);

    // --- HUD --------------------------------------------------------
    this._renderHUD(now, previewOnly);

    // --- floating feedback texts -----------------------------------
    ctx.save();
    ctx.textAlign = 'center';
    for (var i = 0; i < this.floaters.length; i++) {
      var f = this.floaters[i];
      var a = 1 - (f.life / f.ttl);
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.font = '800 26px system-ui, sans-serif';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(42,35,64,0.75)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();

    // --- on-screen touch controls (only once a pointer has been used) ---
    this._renderTouchControls();
  };

  /* ------------------------------------------------------------------ *
   * On-screen touch controls for the battle: 4 big lane buttons along the
   * bottom + a small pause button. Only drawn after the player has actually
   * used touch/mouse, so the desktop keyboard experience is unchanged.
   * ------------------------------------------------------------------ */
  Game.prototype._renderTouchControls = function () {
    if (!this._touchUsed) return;
    var ctx = this.ctx;

    for (var i = 0; i < 4; i++) {
      var dir = LANES[i];
      var r = laneBtnRect(i);
      var lit = Math.max(this.laneFlash[dir], this.laneHeld[dir] ? 0.14 : 0);
      ctx.save();
      roundRect(ctx, r.x, r.y, r.w, r.h, 14);
      // Base fill brightens when the lane is being pressed/hit.
      ctx.globalAlpha = lit > 0 ? 0.85 : 0.5;
      ctx.fillStyle = LANE_STYLE[dir].color;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(42,35,64,0.5)';
      ctx.stroke();
      // Arrow glyph centered in the button (bigger for easy targeting).
      drawArrow(ctx, r.x + r.w / 2, r.y + r.h / 2, Math.min(48, r.h * 0.62), dir, 'rgba(42,35,64,0.92)', null);
      ctx.restore();
    }

    // Pause button.
    var pb = pauseBtnRect();
    drawButton(ctx, pb, '❚❚  Pause', 'rgba(24,20,38,0.6)', '#FFFFFF', false);
  };

  /* ------------------------------------------------------------------ *
   * The 4-lane falling-note highway.
   * ------------------------------------------------------------------ */
  Game.prototype._renderHighway = function (now, previewOnly) {
    var ctx = this.ctx;

    // Highway backdrop.
    ctx.save();
    roundRect(ctx, HIGHWAY_X - 8, TOP_Y - 8, HIGHWAY_W + 16, (HIT_Y + 46) - (TOP_Y - 8), 16);
    ctx.fillStyle = 'rgba(24,20,38,0.42)';
    ctx.fill();

    // Lane separators + per-lane subtle fill.
    for (var i = 0; i < 4; i++) {
      var lx = HIGHWAY_X + i * LANE_W;
      var dir = LANES[i];
      // lane column
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)';
      ctx.fillRect(lx, TOP_Y, LANE_W, HIT_Y + 46 - TOP_Y);
      // flash overlay when the lane is pressed / hit
      var flash = Math.max(this.laneFlash[dir], this.laneHeld[dir] ? 0.08 : 0);
      if (flash > 0) {
        ctx.fillStyle = LANE_STYLE[dir].color;
        ctx.globalAlpha = clamp(flash * 3.5, 0, 0.5);
        ctx.fillRect(lx, TOP_Y, LANE_W, HIT_Y + 46 - TOP_Y);
        ctx.globalAlpha = 1;
      }
      // separator line
      if (i > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(lx, TOP_Y);
        ctx.lineTo(lx, HIT_Y + 46);
        ctx.stroke();
      }
    }
    ctx.restore();

    // Hit-line receptors: a target arrow at the bottom of each lane.
    for (var j = 0; j < 4; j++) {
      var dir2 = LANES[j];
      var cx = laneCenterX(j);
      var lit = Math.max(this.laneFlash[dir2], this.laneHeld[dir2] ? 0.12 : 0);
      ctx.save();
      // receptor ring
      ctx.beginPath();
      ctx.arc(cx, HIT_Y, 26, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = lit > 0 ? LANE_STYLE[dir2].color : 'rgba(255,255,255,0.35)';
      ctx.stroke();
      // receptor arrow
      var glow = lit > 0 ? LANE_STYLE[dir2].color : 'rgba(255,255,255,0.5)';
      drawArrow(ctx, cx, HIT_Y, 30, dir2, lit > 0 ? LANE_STYLE[dir2].color : 'rgba(255,255,255,0.22)', glow);
      ctx.restore();
    }

    // Falling notes. We ask the rhythm engine which notes are visible, but we
    // compute the on-screen Y ourselves from note.time so we are independent of
    // the exact progress-field name the engine returns.
    if (this.rhythm) {
      var active = [];
      try { active = this.rhythm.activeNotes(now, LOOK_AHEAD) || []; } catch (e) { active = []; }
      for (var k = 0; k < active.length; k++) {
        var entry = active[k];
        var note = entry && entry.note ? entry.note : entry;   // tolerate either shape
        if (!note || note.dir == null) continue;
        var idx = laneIndex(note.dir);
        if (idx < 0) continue;

        // progress: 0 at spawn (LOOK_AHEAD away), 1 at the hit line.
        var dt = note.time - now;
        var prog = 1 - (dt / LOOK_AHEAD);
        var ny = TOP_Y + prog * (HIT_Y - TOP_Y);
        if (ny < TOP_Y - 30 || ny > HIT_Y + 60) continue;     // off-highway, skip

        var ncx = laneCenterX(idx);
        var col = LANE_STYLE[note.dir].color;
        ctx.save();
        // shadow disc so the arrow reads on any background
        ctx.beginPath();
        ctx.arc(ncx, ny, 23, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(24,20,38,0.55)';
        ctx.fill();
        // colored note arrow
        drawArrow(ctx, ncx, ny, 30, note.dir, col, 'rgba(42,35,64,0.9)');
        ctx.restore();
      }
    }

    // Per-lane key hints under the highway (hidden on touch, where the big
    // lane buttons take their place).
    if (!this._touchUsed) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '600 13px system-ui, sans-serif';
      for (var m = 0; m < 4; m++) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(LANE_STYLE[LANES[m]].keys, laneCenterX(m), HIT_Y + 66);
      }
      ctx.restore();
    }
  };

  /* ------------------------------------------------------------------ *
   * Battle HUD: score, combo, health bar, song progress.
   * ------------------------------------------------------------------ */
  Game.prototype._renderHUD = function (now, previewOnly) {
    var ctx = this.ctx;
    var r = this.rhythm;

    // Score (top-left).
    ctx.save();
    ctx.textAlign = 'left';
    ctx.font = '800 30px system-ui, sans-serif';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(42,35,64,0.8)';
    ctx.strokeText(String(r.score).padStart(6, '0'), 22, 44);
    ctx.fillStyle = '#F9E04C';
    ctx.fillText(String(r.score).padStart(6, '0'), 22, 44);
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('SCORE', 24, 60);
    ctx.restore();

    // Combo (top-center, only when meaningful).
    if (r.combo >= 2) {
      ctx.save();
      ctx.textAlign = 'center';
      var pop = 1 + clamp((0.16 - (0.16 - (this.recentPerfect > 0 ? 0.16 : 0))), 0, 0.16);
      ctx.font = '800 ' + Math.round(28 * pop) + 'px system-ui, sans-serif';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(42,35,64,0.8)';
      ctx.strokeText(r.combo + '  COMBO', W / 2, 46);
      ctx.fillStyle = '#F6A623';
      ctx.fillText(r.combo + '  COMBO', W / 2, 46);
      ctx.restore();
    }

    // Health bar (top-right).
    ctx.save();
    var hbW = 240, hbH = 20, hbX = W - hbW - 24, hbY = 24;
    roundRect(ctx, hbX, hbY, hbW, hbH, 10);
    ctx.fillStyle = 'rgba(24,20,38,0.55)';
    ctx.fill();
    var frac = clamp(r.health / 100, 0, 1);
    // color shifts red as health drops
    var hc = r.health > 55 ? '#8FD46A' : (r.health > 25 ? '#F6A623' : '#E4462F');
    roundRect(ctx, hbX + 2, hbY + 2, (hbW - 4) * frac, hbH - 4, 8);
    ctx.fillStyle = hc;
    ctx.fill();
    ctx.textAlign = 'right';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('HEALTH', hbX + hbW, hbY - 6);
    ctx.restore();

    // Song progress bar (thin, under the health bar).
    ctx.save();
    var pbW = 240, pbX = W - pbW - 24, pbY = 52, pbH = 6;
    roundRect(ctx, pbX, pbY, pbW, pbH, 3);
    ctx.fillStyle = 'rgba(24,20,38,0.5)';
    ctx.fill();
    var pf = clamp(now / this.song.durationSec, 0, 1);
    roundRect(ctx, pbX, pbY, pbW * pf, pbH, 3);
    ctx.fillStyle = '#7ECBF0';
    ctx.fill();
    ctx.restore();
  };

  /* ------------------------------------------------------------------ *
   * Count-in overlay (3 / 2 / 1 / GO!)
   * ------------------------------------------------------------------ */
  Game.prototype._renderCountIn = function () {
    var ctx = this.ctx;
    var secPerBeat = 60 / this.song.bpm;
    var elapsed = (performance.now() - this.countStart) / 1000;
    var beat = Math.floor(elapsed / secPerBeat);     // 0..3
    var frac = (elapsed / secPerBeat) - beat;        // 0..1 within the beat
    var labels = ['3', '2', '1', 'GO!'];
    var label = labels[clamp(beat, 0, 3)];

    ctx.save();
    // dim the scene
    ctx.fillStyle = 'rgba(24,20,38,0.35)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // number pops in big then shrinks over the beat
    var scale = 1.6 - frac * 0.6;
    var alpha = clamp(1 - frac * 0.8, 0.2, 1);
    ctx.globalAlpha = alpha;
    ctx.translate(W / 2, H / 2 - 20);
    ctx.scale(scale, scale);
    ctx.font = '800 96px system-ui, sans-serif';
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(42,35,64,0.85)';
    ctx.strokeText(label, 0, 0);
    ctx.fillStyle = label === 'GO!' ? '#8FD46A' : '#F9E04C';
    ctx.fillText(label, 0, 0);
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
  };

  /* ------------------------------------------------------------------ *
   * Pause overlay
   * ------------------------------------------------------------------ */
  Game.prototype._renderPause = function () {
    var ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(24,20,38,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#F9E04C';
    ctx.font = '800 54px system-ui, sans-serif';
    ctx.fillText('PAUSED', W / 2, H / 2 - 40);
    ctx.restore();

    if (this._touchUsed) {
      var pr = pauseMenuRects();
      drawButton(ctx, pr.resume, '▶  Resume', '#8FD46A', '#2A2340', true);
      drawButton(ctx, pr.menu, '☰  Menu', 'rgba(255,255,255,0.92)', '#2A2340', true);
    } else {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '600 18px system-ui, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('Esc / P = resume        Enter = quit to menu', W / 2, H / 2 + 34);
      ctx.restore();
    }
  };

  /* ------------------------------------------------------------------ *
   * RESULTS screen
   * ------------------------------------------------------------------ */
  Game.prototype._renderResults = function () {
    var ctx = this.ctx;
    var res = this.result;
    var song = this.song;
    var t = this._wallTime();

    Characters.background(ctx, W, H, song.theme, t);

    // Dim veil for readability.
    ctx.save();
    ctx.fillStyle = 'rgba(24,20,38,0.5)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // Winner celebrates, loser sulks.
    var heroMood = res.win ? 'happy' : 'sad';
    var rivalMood = res.win ? 'sad' : 'happy';
    ctx.save();
    Characters.guineaPig(ctx, 175, 380 + Math.sin(t * 3) * (res.win ? 8 : 2), 1.25, heroMood, t);
    ctx.restore();
    ctx.save();
    if (song.opponent === 'llama') Characters.llama(ctx, 725, 360 + Math.sin(t * 3 + 1) * (res.win ? 2 : 8), 1.2, rivalMood === 'happy' ? 'taunt' : 'sad', t);
    else Characters.mariachi(ctx, 725, 372 + Math.sin(t * 3 + 1) * (res.win ? 2 : 8), 1.12, rivalMood === 'happy' ? 'taunt' : 'sad', t);
    ctx.restore();

    // Headline.
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '800 52px system-ui, sans-serif';
    ctx.lineWidth = 9;
    ctx.strokeStyle = 'rgba(42,35,64,0.85)';
    var headline = res.win ? '¡VICTORIA!' : 'DEFEAT...';
    ctx.strokeText(headline, W / 2, 84);
    ctx.fillStyle = res.win ? '#F9E04C' : '#E4462F';
    ctx.fillText(headline, W / 2, 84);

    // Flavor line (wrapped).
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    this._wrapText(ctx, res.line, W / 2, 118, 620, 22);
    ctx.restore();

    // Central stats panel.
    ctx.save();
    var pw = 300, ph = 220, px = (W - pw) / 2, py = 170;
    roundRect(ctx, px, py, pw, ph, 18);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(42,35,64,0.5)';
    ctx.stroke();

    // Rank badge.
    ctx.textAlign = 'center';
    ctx.font = '800 84px system-ui, sans-serif';
    var rankColor = { S: '#F6A623', A: '#8FD46A', B: '#7ECBF0', C: '#C9B79A' }[res.rank] || '#C9B79A';
    ctx.fillStyle = rankColor;
    ctx.fillText(res.rank, W / 2, py + 92);
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillStyle = '#7A5C3E';
    ctx.fillText('RANK', W / 2, py + 112);

    // Numbers.
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillStyle = '#2A2340';
    var accPct = Math.round(res.accuracy * 100);
    var rows = [
      ['Score', String(res.score)],
      ['Max Combo', String(res.maxCombo)],
      ['Perfects', res.perfects + ' / ' + res.total],
      ['Accuracy', accPct + '%']
    ];
    for (var i = 0; i < rows.length; i++) {
      var ry = py + 140 + i * 20;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#7A5C3E';
      ctx.fillText(rows[i][0], px + 22, ry);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#2A2340';
      ctx.fillText(rows[i][1], px + pw - 22, ry);
    }
    ctx.restore();

    // Footer prompt / buttons.
    if (this._touchUsed) {
      var rr = resultBtnRects();
      drawButton(ctx, rr.replay, '↻  Replay', '#F6A623', '#2A2340', true);
      drawButton(ctx, rr.menu, '☰  Menu', 'rgba(255,255,255,0.92)', '#2A2340', true);
    } else {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '700 18px system-ui, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('↵ Enter = replay        Esc = menu', W / 2, H - 34);
      ctx.restore();
    }
  };

  /* ------------------------------------------------------------------ *
   * Utility: word-wrapped centered/aligned text.
   * ------------------------------------------------------------------ */
  Game.prototype._wrapText = function (ctx, text, x, y, maxW, lineH) {
    var words = text.split(' ');
    var line = '';
    var yy = y;
    for (var n = 0; n < words.length; n++) {
      var test = line ? line + ' ' + words[n] : words[n];
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, yy);
        line = words[n];
        yy += lineH;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, yy);
  };

  /* ------------------------------------------------------------------ *
   * Teardown (not required by the contract, but tidy).
   * ------------------------------------------------------------------ */
  Game.prototype.destroy = function () {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('orientationchange', this._onResize);
    this.canvas.removeEventListener('touchstart', this._onTouchStart);
    this.canvas.removeEventListener('touchend', this._onTouchEnd);
    this.canvas.removeEventListener('touchcancel', this._onTouchEnd);
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    try { this.audio.stopBacking(); } catch (e) {}
  };

  // Publish the single public global.
  global.Game = Game;

})(typeof window !== 'undefined' ? window : this);
