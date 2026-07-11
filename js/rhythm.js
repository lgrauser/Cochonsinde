/*
 * rhythm.js — RhythmEngine
 * ------------------------------------------------------------------
 * Pure gameplay/scoring logic for "Cavia Con Carne: Pan-Flute Fury".
 *
 * This class owns the note timeline for a single song and answers the
 * two questions the renderer/input code care about:
 *   1. "Which notes should be on screen right now, and how far along
 *       their approach are they?"           -> activeNotes()
 *   2. "The player just pressed a lane — was that a hit?"  -> judge()
 *
 * It also advances an internal cursor each frame (update()) so notes
 * that scroll past the hit window without a keypress are counted as
 * misses exactly once.
 *
 * No DOM, no audio, no canvas — this file is deliberately I/O free so
 * it stays easy to reason about and test. It attaches the global class
 * `RhythmEngine` to window (no modules / no bundler, per project rules).
 * ------------------------------------------------------------------
 */

(function (global) {
  'use strict';

  // ---- Tunable constants (kept local; the contract fixes these values) ----

  // Timing windows, in seconds, measured as |pressTime - noteTime|.
  var PERFECT_WINDOW = 0.06; // |dt| <= 0.06s  -> "perfect"
  var GOOD_WINDOW = 0.13;    // |dt| <= 0.13s  -> "good" (also the hit-able window)

  // Scoring.
  var GOOD_POINTS = 100;
  var PERFECT_BASE = 300;         // multiplied by (1 + combo * COMBO_BONUS)
  var COMBO_BONUS = 0.02;         // +2% of the perfect base per point of current combo

  // Health economy. Starts at 60, clamped to [0, 100]. Win == health > 0 at end.
  var HEALTH_START = 60;
  var HEALTH_MAX = 100;
  var HEALTH_MIN = 0;
  var HEALTH_PERFECT = 6;
  var HEALTH_GOOD = 3;
  var HEALTH_MISS = -10;

  /**
   * @param {Object} song A SONGS entry: { notes:[{time,dir},...], durationSec, ... }
   */
  function RhythmEngine(song) {
    this.song = song || { notes: [], durationSec: 0 };
    // Defensive copy of the note list, sorted ascending by time. Each entry
    // is wrapped with mutable per-play bookkeeping so we never mutate the
    // shared SONGS data.
    var rawNotes = (this.song.notes || []).slice().sort(function (a, b) {
      return a.time - b.time;
    });
    this._notes = rawNotes.map(function (n, i) {
      return {
        index: i,          // stable id for renderers that want to key notes
        time: n.time,      // target hit time, seconds from song start
        dir: n.dir,        // 'left' | 'down' | 'up' | 'right'
        hit: false,        // true once judged as perfect/good
        missed: false,     // true once auto-missed or judged as miss
        result: null       // 'perfect' | 'good' | 'miss' | null
      };
    });

    this.totalNotes = this._notes.length;
    this.reset();
  }

  /** Reset all mutable play state so the same engine instance can replay. */
  RhythmEngine.prototype.reset = function () {
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.health = HEALTH_START;
    this.hits = 0;       // perfects + goods
    this.perfects = 0;
    this.misses = 0;
    // Cursor: index into _notes below which everything is fully resolved
    // (hit or missed). Lets update() skip already-processed notes cheaply.
    this._cursor = 0;

    for (var i = 0; i < this._notes.length; i++) {
      var n = this._notes[i];
      n.hit = false;
      n.missed = false;
      n.result = null;
    }
  };

  /**
   * Advance the internal cursor to `nowSec`. Any note whose entire "good"
   * window has elapsed without being hit is registered as a miss (once).
   *
   * @param {number} nowSec current song time in seconds
   */
  RhythmEngine.prototype.update = function (nowSec) {
    // Notes are time-sorted, so once we hit an unresolved note whose window
    // hasn't fully passed we can stop — nothing later has passed either.
    while (this._cursor < this._notes.length) {
      var note = this._notes[this._cursor];

      if (note.hit || note.missed) {
        // Already resolved (hit by judge() or missed earlier). Advance past it.
        this._cursor++;
        continue;
      }

      // The latest moment this note could still be struck.
      var windowEnd = note.time + GOOD_WINDOW;
      if (nowSec > windowEnd) {
        // The player never pressed in time — auto-miss.
        this._registerMiss(note);
        this._cursor++;
        continue;
      }

      // This note is still live (or upcoming); everything after it is too.
      break;
    }
  };

  /**
   * Judge a lane press. Finds the nearest un-resolved note in that lane
   * whose target time is within the good window of `nowSec`, marks it hit,
   * and applies score/health/combo. A press with no eligible note is a miss
   * (combo break) that does not consume any note.
   *
   * @param {string} dir 'left'|'down'|'up'|'right'
   * @param {number} nowSec current song time in seconds
   * @returns {{result:string, points:number, note:Object|null}}
   */
  RhythmEngine.prototype.judge = function (dir, nowSec) {
    var best = null;
    var bestDt = Infinity; // absolute time distance of the best candidate

    // Search all still-open notes in this lane for the closest in-window one.
    // We scan from the cursor forward; notes before the cursor are resolved.
    for (var i = this._cursor; i < this._notes.length; i++) {
      var note = this._notes[i];
      if (note.hit || note.missed) continue;
      if (note.dir !== dir) continue;

      var dt = Math.abs(note.time - nowSec);
      if (dt > GOOD_WINDOW) {
        // Too far in the future to be relevant. Because notes are sorted,
        // once a same-lane note is beyond the window ahead of us we could
        // keep scanning for nothing — but other lanes interleave, so we just
        // continue; the loop is short in practice.
        if (note.time - nowSec > GOOD_WINDOW) {
          // Everything further ahead is even later; safe to stop entirely.
          break;
        }
        continue;
      }

      if (dt < bestDt) {
        bestDt = dt;
        best = note;
      }
    }

    if (!best) {
      // No note to catch here — a wasted press. Breaks the combo.
      this._registerMiss(null);
      return { result: 'miss', points: 0, note: null };
    }

    // Classify by tightness of the timing.
    var result = bestDt <= PERFECT_WINDOW ? 'perfect' : 'good';
    var points = 0;

    if (result === 'perfect') {
      points = Math.round(PERFECT_BASE * (1 + this.combo * COMBO_BONUS));
      this.perfects++;
      this.health = clamp(this.health + HEALTH_PERFECT, HEALTH_MIN, HEALTH_MAX);
    } else {
      points = GOOD_POINTS;
      this.health = clamp(this.health + HEALTH_GOOD, HEALTH_MIN, HEALTH_MAX);
    }

    best.hit = true;
    best.result = result;
    this.hits++;
    this.score += points;
    this.combo++;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;

    return { result: result, points: points, note: best };
  };

  /**
   * List notes currently worth drawing: those approaching within
   * `lookAheadSec` and not yet scrolled fully past the hit line.
   *
   * `y` is a 0..1 approach progress where 0 = just spawned (lookAhead away)
   * and 1 = at the hit line (note.time == nowSec). It can exceed 1 slightly
   * for notes a hair past the line still inside the miss window, letting the
   * renderer show them overshooting before they vanish.
   *
   * @param {number} nowSec current song time in seconds
   * @param {number} lookAheadSec how far ahead (seconds) notes become visible
   * @returns {Array<{note:Object, y:number}>}
   */
  RhythmEngine.prototype.activeNotes = function (nowSec, lookAheadSec) {
    var look = lookAheadSec > 0 ? lookAheadSec : 1;
    var out = [];

    for (var i = 0; i < this._notes.length; i++) {
      var note = this._notes[i];
      if (note.hit) continue; // struck notes disappear immediately

      var delta = note.time - nowSec; // seconds until this note reaches the line
      if (delta > look) {
        // Not visible yet; since notes are sorted, all later ones are further.
        break;
      }
      // Keep briefly-past notes visible through the miss window for a clean
      // overshoot, then drop them.
      if (delta < -GOOD_WINDOW) continue;

      var progress = 1 - delta / look; // 0 at spawn, 1 at the hit line
      out.push({ note: note, y: progress });
    }

    return out;
  };

  /**
   * @param {number} nowSec current song time in seconds
   * @returns {boolean} true once the song's duration has elapsed
   */
  RhythmEngine.prototype.finished = function (nowSec) {
    var dur = this.song.durationSec || 0;
    return nowSec >= dur;
  };

  // ---- internal helpers ----

  /**
   * Apply a miss: break combo, dock health, count it. When `note` is given
   * the miss belongs to a specific note (auto-miss); pass null for a wasted
   * key press. Guards against double-counting a note.
   */
  RhythmEngine.prototype._registerMiss = function (note) {
    if (note) {
      if (note.hit || note.missed) return; // already resolved — do nothing
      note.missed = true;
      note.result = 'miss';
    }
    this.misses++;
    this.combo = 0;
    this.health = clamp(this.health + HEALTH_MISS, HEALTH_MIN, HEALTH_MAX);
  };

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  // Expose globally (no modules; index.html loads plain scripts in order).
  global.RhythmEngine = RhythmEngine;
})(typeof window !== 'undefined' ? window : this);
