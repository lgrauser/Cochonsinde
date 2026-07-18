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
   * BACKING MUSIC — Andean / Peruvian arrangement
   * A classic WebAudio "lookahead" scheduler: a setInterval fires often and
   * schedules any 16th-note steps that fall inside the next lookahead window,
   * using precise AudioContext timestamps. This keeps timing rock-solid even
   * though setInterval itself is jittery.
   *
   * The arrangement evokes Andean folk music (think "El Cóndor Pasa"): a warm
   * bombo bass-drum with a huayno gallop, chajchas-style shaker, a plucked
   * charango arpeggio, a root/fifth bass, and a soft quena panpipe melody — all
   * in A-minor pentatonic over a two-bar Am–G vamp, so every lane the player
   * taps (A, C, D, E) lands consonantly on the music.
   * ----------------------------------------------------------------------- */

  var SCHEDULE_AHEAD = 0.12; // seconds of audio to schedule in advance
  var LOOKAHEAD_MS = 25;     // how often the scheduler wakes up
  var LOOP_STEPS = 32;       // two bars of sixteenth notes (16 per bar)

  // Two-bar chord vamp: bar 0 = Am, bar 1 = G (i – VII, the Andean sound).
  // Each chord carries a bass root + fifth and a charango triad (Hz).
  var CHORDS = [
    { root: 110.00, fifth: 82.41,  triad: [440.00, 523.25, 659.25] }, // Am: A2/E2, A4-C5-E5
    { root: 98.00,  fifth: 146.83, triad: [392.00, 493.88, 587.33] }  // G:  G2/D3, G4-B4-D5
  ];

  // Quena (panpipe) melody, sparse across the 32 steps. A-minor pentatonic
  // (G4 392, A4 440, C5 523, D5 587, E5 659, G5 784). null-ish = rest.
  var MELODY = {
    0: 659.25, 3: 587.33, 4: 523.25, 7: 440.00, 8: 523.25, 10: 587.33, 12: 659.25, 15: 783.99,
    16: 587.33, 19: 659.25, 20: 587.33, 23: 523.25, 24: 440.00, 27: 392.00, 28: 440.00
  };

  // Per-theme arrangement flavour.
  var ARRANGEMENTS = {
    meadow:   { charango16: false, clap: false, drone: false, melodyVol: 0.12, gain: 0.55 },
    fiesta:   { charango16: true,  clap: true,  drone: false, melodyVol: 0.13, gain: 0.58 },
    mountain: { charango16: true,  clap: true,  drone: true,  melodyVol: 0.14, gain: 0.60 }
  };

  AudioEngine.prototype.startBacking = function (bpm, theme) {
    try {
      if (!this._ensure()) return;
      this.stopBacking(); // ensure a clean slate (idempotent)

      this._theme = theme || 'meadow';
      this._arr = ARRANGEMENTS[this._theme] || ARRANGEMENTS.meadow;
      var beat = 60 / (bpm && bpm > 0 ? bpm : 100);
      this._secPerStep = beat / 4; // sixteenth notes
      this._step = 0;
      this._backingOn = true;

      // Sub-mix so the whole groove sits a bit under the player's flute.
      this._backingGain = this.ctx.createGain();
      this._backingGain.gain.value = this._arr.gain;
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
      this._step = (this._step + 1) % LOOP_STEPS; // two bars of 16th notes
    }
  };

  /* --- small instrument voices for the Andean arrangement ---------------- */

  // Bombo: a warm, soft Andean bass drum (lower & rounder than a club kick).
  AudioEngine.prototype._bombo = function (t, dest, hard) {
    try {
      var ctx = this.ctx;
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(48, t + 0.14);
      var peak = hard ? 0.85 : 0.34;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (hard ? 0.22 : 0.14));
      osc.connect(g); g.connect(dest);
      osc.start(t); osc.stop(t + 0.26);
      // A touch of body thump: very short low noise on hard hits.
      if (hard) this._noise({ t0: t, dur: 0.05, peak: 0.10, filterType: 'lowpass', freq: 220, dest: dest });
    } catch (e) {}
  };

  // Charango pluck: a bright, fast-decaying string (two detuned oscillators).
  AudioEngine.prototype._pluck = function (freq, t, dur, peak, dest) {
    try {
      var ctx = this.ctx;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      g.connect(dest);
      var o1 = ctx.createOscillator();
      o1.type = 'triangle';
      o1.frequency.setValueAtTime(freq, t);
      o1.connect(g); o1.start(t); o1.stop(t + dur + 0.02);
      // detuned partner for the shimmery double-course charango timbre
      var o2 = ctx.createOscillator();
      o2.type = 'triangle';
      o2.frequency.setValueAtTime(freq * 1.006, t);
      var g2 = ctx.createGain();
      g2.gain.value = 0.5;
      o2.connect(g2); g2.connect(g);
      o2.start(t); o2.stop(t + dur + 0.02);
    } catch (e) {}
  };

  // Quena/panpipe melody note: soft, breathy, a little vibrato.
  AudioEngine.prototype._quena = function (freq, t, dur, peak, dest) {
    try {
      var ctx = this.ctx;
      var main = this._tone({ type: 'triangle', freq: freq, t0: t, dur: dur, peak: peak, attack: 0.03, dest: dest });
      // sub-octave sine for warmth
      this._tone({ type: 'sine', freq: freq * 0.5, t0: t, dur: dur * 0.9, peak: peak * 0.4, attack: 0.03, dest: dest });
      // gentle vibrato
      var lfo = ctx.createOscillator();
      var lg = ctx.createGain();
      lfo.frequency.value = 5.2;
      lg.gain.value = freq * 0.005;
      lfo.connect(lg); lg.connect(main.frequency);
      lfo.start(t); lfo.stop(t + dur + 0.02);
      // soft breath onset
      this._noise({ t0: t, dur: 0.10, peak: peak * 0.3, filterType: 'highpass', freq: 2400, dest: dest });
    } catch (e) {}
  };

  /*
   * One 16th-note step of the Andean arrangement. `step` runs 0..31 (two bars).
   */
  AudioEngine.prototype._scheduleStep = function (step, t) {
    var dest = this._backingGain || this.master;
    var arr = this._arr || ARRANGEMENTS.meadow;
    var bar = step < 16 ? 0 : 1;
    var s = step % 16;               // step within the bar
    var chord = CHORDS[bar];

    // ---- Bombo (huayno gallop): strong on the beat, soft pickups ----
    var hard = (s === 0 || s === 4 || s === 8 || s === 12);
    var soft = (s === 6 || s === 14 || (this._theme === 'mountain' && (s === 3 || s === 11)));
    if (hard) this._bombo(t, dest, true);
    else if (soft) this._bombo(t, dest, false);

    // ---- Chajchas shaker on the eighth notes (accented off-beats) ----
    if (s % 2 === 0) {
      var accent = (s % 4 === 2);
      this._noise({
        t0: t, dur: accent ? 0.06 : 0.03, peak: accent ? 0.11 : 0.07,
        filterType: 'highpass', freq: 6500, dest: dest
      });
    }

    // ---- Palmas / clap on the backbeat (fiesta & mountain) ----
    if (arr.clap && (s === 4 || s === 12)) {
      this._noise({ t0: t, dur: 0.12, peak: 0.20, filterType: 'bandpass', freq: 1700, Q: 0.7, dest: dest });
    }

    // ---- Bass: root on beats 1 & 3, fifth on 2 & 4 (warm pulse) ----
    if (s === 0 || s === 8) this._bassNote(chord.root, t, dest);
    else if (s === 4 || s === 12) this._bassNote(chord.fifth, t, dest);

    // ---- Charango arpeggio over the chord triad ----
    var playCharango = arr.charango16 ? true : (s % 2 === 0);
    if (playCharango) {
      var note = chord.triad[step % chord.triad.length];
      // higher octave sparkle on the busy 16th themes' off-steps
      if (arr.charango16 && s % 2 === 1) note *= 2;
      var pdur = arr.charango16 ? this._secPerStep * 1.6 : this._secPerStep * 2.4;
      var ppeak = (s % 4 === 0) ? 0.16 : 0.11;
      this._pluck(note, t, pdur, ppeak, dest);
    }

    // ---- Quena melody line ----
    var mel = MELODY[step];
    if (mel) {
      this._quena(mel, t, this._secPerStep * 2.6, arr.melodyVol, dest);
      // mountain doubles the melody an octave up, quietly, for intensity
      if (arr.drone) this._quena(mel * 2, t, this._secPerStep * 2.2, arr.melodyVol * 0.5, dest);
    }

    // ---- Sustained siku drone pad at each bar start (mountain only) ----
    if (arr.drone && s === 0) {
      try {
        var ctx = this.ctx;
        var pad = ctx.createOscillator();
        var pg = ctx.createGain();
        pad.type = 'sawtooth';
        pad.frequency.setValueAtTime(chord.root * 2, t); // root one octave up, soft
        var lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 700;
        var barDur = this._secPerStep * 16;
        pg.gain.setValueAtTime(0.0001, t);
        pg.gain.exponentialRampToValueAtTime(0.05, t + 0.15);
        pg.gain.setValueAtTime(0.05, t + barDur * 0.7);
        pg.gain.exponentialRampToValueAtTime(0.0001, t + barDur);
        pad.connect(lp); lp.connect(pg); pg.connect(dest);
        pad.start(t); pad.stop(t + barDur + 0.05);
      } catch (e) {}
    }
  };

  // Warm triangle bass note lasting roughly one beat.
  AudioEngine.prototype._bassNote = function (freq, t, dest) {
    try {
      var ctx = this.ctx;
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.30, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + this._secPerStep * 4 * 0.85);
      osc.connect(g); g.connect(dest);
      osc.start(t); osc.stop(t + this._secPerStep * 4 + 0.02);
    } catch (e) {}
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
