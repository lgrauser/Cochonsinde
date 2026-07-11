/*
 * audio.js  —  Cavia Con Carne: Pan-Flute Fury
 * ---------------------------------------------------------------------------
 * Global class AudioEngine: all sound is synthesized live with the WebAudio
 * API (oscillators, gain envelopes, and short noise buffers). There are NO
 * external audio files, so the whole game runs happily over file://.
 *
 * Public surface (see technical contract):
 *   new AudioEngine()
 *   .resume()                    -> unlock/resume the AudioContext (user gesture)
 *   .playFlute(dir)              -> breathy pan-flute tone for a lane
 *   .startBacking(bpm, theme)    -> looping drum/bass groove for a battle
 *   .stopBacking()               -> stop the groove & clean up the scheduler
 *   .sfx(name)                   -> short UI/gameplay blips
 *
 * Robustness: every public method is wrapped so that a missing, blocked, or
 * throwing AudioContext degrades to a silent no-op instead of crashing the
 * game. Audio is a nicety here, never a hard dependency.
 * ---------------------------------------------------------------------------
 */

(function (global) {
  'use strict';

  // Resolve a usable AudioContext constructor once (webkit prefix for Safari).
  var AC = global.AudioContext || global.webkitAudioContext || null;

  /*
   * Pan-flute pitches, one per lane. Ascending left -> right using a pleasant
   * pentatonic run (A4, C5, D5, E5 — an A-minor pentatonic slice) so any hit
   * combination sounds consonant. Values are frequencies in Hz.
   */
  var FLUTE_FREQ = {
    left: 440.00, // A4  (lowest)
    down: 523.25, // C5
    up: 587.33,   // D5
    right: 659.25 // E5  (highest)
  };

  function AudioEngine() {
    this.ctx = null;          // lazily created AudioContext
    this.master = null;       // master gain node (all sound routes through this)
    this.unavailable = false; // set true if we ever detect audio can't work

    // --- backing-groove scheduler state ---
    this._backingOn = false;
    this._schedTimer = null;  // setInterval handle for the lookahead scheduler
    this._nextNoteTime = 0;   // absolute ctx time of the next 16th step
    this._step = 0;           // running 16th-note index (loops 0..15)
    this._secPerStep = 0.125; // seconds per 16th note (recomputed from bpm)
    this._theme = 'meadow';
    this._backingGain = null; // sub-mix for the groove so we can fade/stop it
  }

  /* ----------------------------------------------------------------------- *
   * Internal: make sure we have a context + master bus. Returns true on
   * success, false if audio is unavailable (so callers can bail silently).
   * ----------------------------------------------------------------------- */
  AudioEngine.prototype._ensure = function () {
    if (this.unavailable) return false;
    if (this.ctx) return true;
    if (!AC) { this.unavailable = true; return false; }
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      return true;
    } catch (e) {
      // Construction can throw (e.g. too many contexts, autoplay policy quirks).
      this.unavailable = true;
      this.ctx = null;
      this.master = null;
      return false;
    }
  };

  /* ----------------------------------------------------------------------- *
   * resume() — MUST be called from a real user gesture to unlock audio on
   * browsers that start the context in the "suspended" state.
   * ----------------------------------------------------------------------- */
  AudioEngine.prototype.resume = function () {
    try {
      if (!this._ensure()) return;
      if (this.ctx.state === 'suspended' && this.ctx.resume) {
        // resume() returns a promise; swallow rejections so nothing bubbles up.
        var p = this.ctx.resume();
        if (p && p.catch) p.catch(function () {});
      }
    } catch (e) { /* silent no-op */ }
  };

  /* ----------------------------------------------------------------------- *
   * Small synthesis helpers. All create-and-forget: nodes are started and
   * scheduled to stop, then garbage-collected once they finish.
   * ----------------------------------------------------------------------- */

  // Create (and cache) a short white-noise buffer we can reuse for breath/hats.
  AudioEngine.prototype._noiseBuffer = function () {
    if (this._noiseBuf) return this._noiseBuf;
    var ctx = this.ctx;
    var len = Math.floor(ctx.sampleRate * 0.5); // 0.5s of noise, looped as needed
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this._noiseBuf = buf;
    return buf;
  };

  // A single enveloped oscillator tone.
  // opts: { type, freq, t0, dur, peak, dest, attack }
  AudioEngine.prototype._tone = function (opts) {
    var ctx = this.ctx;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(opts.freq, opts.t0);
    var atk = opts.attack != null ? opts.attack : 0.008;
    g.gain.setValueAtTime(0.0001, opts.t0);
    g.gain.exponentialRampToValueAtTime(opts.peak, opts.t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, opts.t0 + opts.dur);
    osc.connect(g);
    g.connect(opts.dest || this.master);
    osc.start(opts.t0);
    osc.stop(opts.t0 + opts.dur + 0.02);
    return osc; // returned so callers can add vibrato etc.
  };

  // A burst of band-limited noise (drum hats, breath).
  // opts: { t0, dur, peak, filterType, freq, Q, dest }
  AudioEngine.prototype._noise = function (opts) {
    var ctx = this.ctx;
    var src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer();
    var filt = ctx.createBiquadFilter();
    filt.type = opts.filterType || 'highpass';
    filt.frequency.value = opts.freq || 4000;
    if (opts.Q != null) filt.Q.value = opts.Q;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, opts.t0);
    g.gain.exponentialRampToValueAtTime(opts.peak, opts.t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, opts.t0 + opts.dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(opts.dest || this.master);
    src.start(opts.t0);
    src.stop(opts.t0 + opts.dur + 0.02);
    return src;
  };

  /* ----------------------------------------------------------------------- *
   * playFlute(dir) — soft breathy pan-flute tone for a lane.
   *   * a triangle "air column" fundamental with a quick attack + gentle decay
   *   * a light sine sub-octave for body
   *   * subtle vibrato via an LFO on the main oscillator
   *   * a whisper of high-pass noise at the onset to fake the breath transient
   * ----------------------------------------------------------------------- */
  AudioEngine.prototype.playFlute = function (dir) {
    try {
      if (!this._ensure()) return;
      var ctx = this.ctx;
      var freq = FLUTE_FREQ[dir] || FLUTE_FREQ.up;
      var t0 = ctx.now ? ctx.now() : ctx.currentTime;
      var dur = 0.42;

      // Main breathy body (triangle reads soft/woody like a flute).
      var main = this._tone({
        type: 'triangle', freq: freq, t0: t0, dur: dur, peak: 0.28, attack: 0.02
      });

      // Gentle vibrato: an LFO modulating the main oscillator's frequency.
      var lfo = ctx.createOscillator();
      var lfoGain = ctx.createGain();
      lfo.frequency.value = 5.5;             // ~5-6 Hz, natural human vibrato
      lfoGain.gain.value = freq * 0.006;     // depth scales with pitch (~0.6%)
      lfo.connect(lfoGain);
      lfoGain.connect(main.frequency);
      lfo.start(t0);
      lfo.stop(t0 + dur + 0.02);

      // Quiet sine an octave down for a rounder tone.
      this._tone({
        type: 'sine', freq: freq * 0.5, t0: t0, dur: dur * 0.8, peak: 0.10, attack: 0.02
      });

      // Breath transient: brief filtered noise at the attack.
      this._noise({
        t0: t0, dur: 0.13, peak: 0.05, filterType: 'highpass', freq: 2200
      });
    } catch (e) { /* silent no-op */ }
  };

  /* ----------------------------------------------------------------------- *
   * BACKING GROOVE
   * A classic WebAudio "lookahead" scheduler: a setInterval fires often and
   * schedules any 16th-note steps that fall inside the next lookahead window,
   * using precise AudioContext timestamps. This keeps timing rock-solid even
   * though setInterval itself is jittery.
   * ----------------------------------------------------------------------- */

  var SCHEDULE_AHEAD = 0.12; // seconds of audio to schedule in advance
  var LOOKAHEAD_MS = 25;     // how often the scheduler wakes up

  AudioEngine.prototype.startBacking = function (bpm, theme) {
    try {
      if (!this._ensure()) return;
      this.stopBacking(); // ensure a clean slate (idempotent)

      this._theme = theme || 'meadow';
      var beat = 60 / (bpm && bpm > 0 ? bpm : 100);
      this._secPerStep = beat / 4; // sixteenth notes
      this._step = 0;
      this._backingOn = true;

      // Sub-mix so the whole groove sits a bit under the flute melody.
      this._backingGain = this.ctx.createGain();
      this._backingGain.gain.value = 0.55;
      this._backingGain.connect(this.master);

      var startT = (this.ctx.currentTime) + 0.06;
      this._nextNoteTime = startT;

      var self = this;
      this._schedTimer = setInterval(function () {
        try { self._scheduler(); } catch (e) { /* keep the loop alive */ }
      }, LOOKAHEAD_MS);
    } catch (e) { /* silent no-op */ }
  };

  AudioEngine.prototype.stopBacking = function () {
    try {
      this._backingOn = false;
      if (this._schedTimer != null) {
        clearInterval(this._schedTimer);
        this._schedTimer = null;
      }
      // Fade the sub-mix out quickly, then disconnect so nodes are collected.
      if (this._backingGain && this.ctx) {
        var g = this._backingGain;
        var now = this.ctx.currentTime;
        try {
          g.gain.cancelScheduledValues(now);
          g.gain.setValueAtTime(g.gain.value, now);
          g.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
        } catch (e) { /* ignore ramp errors */ }
        // Disconnect a touch after the fade so we don't cut it audibly.
        setTimeout(function () { try { g.disconnect(); } catch (e) {} }, 140);
      }
      this._backingGain = null;
    } catch (e) { /* silent no-op */ }
  };

  // Advance the scheduler: enqueue every step whose time is within the window.
  AudioEngine.prototype._scheduler = function () {
    if (!this._backingOn || !this.ctx) return;
    while (this._nextNoteTime < this.ctx.currentTime + SCHEDULE_AHEAD) {
      this._scheduleStep(this._step, this._nextNoteTime);
      this._nextNoteTime += this._secPerStep;
      this._step = (this._step + 1) % 16; // one bar of 16th notes
    }
  };

  /*
   * One 16th-note step of the groove. Pattern is a simple, danceable beat:
   *   - kick on steps 0, 4, 8, 12 (four-on-the-floor), plus theme accents
   *   - hats on off-beats, with the mountain theme adding busier hats
   *   - a walking-ish bass following a short theme-flavoured note pattern
   */
  AudioEngine.prototype._scheduleStep = function (step, t) {
    var dest = this._backingGain || this.master;
    var theme = this._theme;

    // ---- Kick drum: pitched sine that drops fast ----
    var kick = (step % 4 === 0);
    // fiesta gets a syncopated extra kick; mountain drives harder.
    if (theme === 'fiesta' && step === 10) kick = true;
    if (theme === 'mountain' && (step === 6 || step === 14)) kick = true;
    if (kick) {
      try {
        var ctx = this.ctx;
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, t);
        osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.9, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        osc.connect(g); g.connect(dest);
        osc.start(t); osc.stop(t + 0.2);
      } catch (e) {}
    }

    // ---- Hi-hat: short high-passed noise ----
    var hat = (step % 2 === 1);                    // off-beat 8ths by default
    if (theme === 'mountain') hat = true;          // busier driving hats
    if (theme === 'fiesta' && step % 2 === 0) hat = hat || (step % 4 === 2);
    if (hat) {
      var closed = (step % 4 !== 2);
      this._noise({
        t0: t, dur: closed ? 0.03 : 0.08, peak: closed ? 0.10 : 0.14,
        filterType: 'highpass', freq: 7000, dest: dest
      });
    }

    // ---- Snare/clap on the backbeat (steps 4 and 12) ----
    if (step === 4 || step === 12) {
      this._noise({
        t0: t, dur: 0.12, peak: 0.22, filterType: 'bandpass', freq: 1800, Q: 0.7,
        dest: dest
      });
    }

    // ---- Bass line: one note per 8th, following a short theme pattern ----
    if (step % 2 === 0) {
      // Root notes (Hz). Each theme walks a different friendly bass figure.
      var patterns = {
        meadow:   [110.0, 110.0, 146.83, 130.81, 110.0, 110.0, 98.0, 130.81], // A, A, D, C, A, A, G, C
        fiesta:   [146.83, 146.83, 110.0, 164.81, 146.83, 130.81, 110.0, 98.0], // D-ish spanish flavour
        mountain: [110.0, 130.81, 146.83, 130.81, 110.0, 98.0, 110.0, 146.83]
      };
      var pat = patterns[theme] || patterns.meadow;
      var idx = (step / 2) % pat.length;
      var bf = pat[idx];
      try {
        var bctx = this.ctx;
        var bosc = bctx.createOscillator();
        var bg = bctx.createGain();
        // triangle bass = round and warm without being boomy
        bosc.type = 'triangle';
        bosc.frequency.setValueAtTime(bf, t);
        bg.gain.setValueAtTime(0.0001, t);
        bg.gain.exponentialRampToValueAtTime(0.28, t + 0.01);
        bg.gain.exponentialRampToValueAtTime(0.0001, t + this._secPerStep * 2 * 0.9);
        bosc.connect(bg); bg.connect(dest);
        bosc.start(t); bosc.stop(t + this._secPerStep * 2 + 0.02);
      } catch (e) {}
    }
  };

  /* ----------------------------------------------------------------------- *
   * sfx(name) — short blips for gameplay/UI events.
   * ----------------------------------------------------------------------- */
  AudioEngine.prototype.sfx = function (name) {
    try {
      if (!this._ensure()) return;
      var ctx = this.ctx;
      var t = ctx.currentTime + 0.001;

      switch (name) {
        case 'hit': {
          // small bright tick
          this._tone({ type: 'square', freq: 660, t0: t, dur: 0.10, peak: 0.16 });
          break;
        }
        case 'perfect': {
          // happy up-arpeggio
          this._tone({ type: 'triangle', freq: 784, t0: t, dur: 0.10, peak: 0.20 });
          this._tone({ type: 'triangle', freq: 988, t0: t + 0.06, dur: 0.12, peak: 0.20 });
          this._tone({ type: 'triangle', freq: 1319, t0: t + 0.12, dur: 0.14, peak: 0.18 });
          break;
        }
        case 'miss': {
          // dull downward buzz
          var m = this._tone({ type: 'sawtooth', freq: 220, t0: t, dur: 0.20, peak: 0.16 });
          try { m.frequency.exponentialRampToValueAtTime(120, t + 0.20); } catch (e) {}
          break;
        }
        case 'win': {
          // triumphant little fanfare (C-E-G-C)
          var winSeq = [523.25, 659.25, 783.99, 1046.50];
          for (var i = 0; i < winSeq.length; i++) {
            this._tone({ type: 'triangle', freq: winSeq[i], t0: t + i * 0.12, dur: 0.22, peak: 0.22 });
          }
          break;
        }
        case 'lose': {
          // sad descending trombone-ish slide (wah-wah-waaah)
          var loseSeq = [392.00, 349.23, 311.13, 261.63];
          for (var j = 0; j < loseSeq.length; j++) {
            var l = this._tone({ type: 'sawtooth', freq: loseSeq[j], t0: t + j * 0.16, dur: 0.26, peak: 0.18 });
            try { l.frequency.exponentialRampToValueAtTime(loseSeq[j] * 0.94, t + j * 0.16 + 0.24); } catch (e) {}
          }
          break;
        }
        case 'select': {
          // crisp UI blip
          this._tone({ type: 'square', freq: 880, t0: t, dur: 0.07, peak: 0.14 });
          break;
        }
        case 'count': {
          // metronome-style count-in click
          this._tone({ type: 'sine', freq: 1200, t0: t, dur: 0.08, peak: 0.20 });
          break;
        }
        default: {
          // unknown name -> gentle neutral blip
          this._tone({ type: 'sine', freq: 600, t0: t, dur: 0.08, peak: 0.12 });
        }
      }
    } catch (e) { /* silent no-op */ }
  };

  // Expose globally (no modules).
  global.AudioEngine = AudioEngine;

})(typeof window !== 'undefined' ? window : this);
