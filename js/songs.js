/*
 * songs.js
 * ---------------------------------------------------------------------------
 * Pure data module for "Cavia Con Carne: Pan-Flute Fury".
 *
 * Loading model: plain <script> (no ES modules). Everything is attached to the
 * global scope so later scripts (rhythm.js, game.js) can read it directly.
 *
 * Public globals defined here:
 *   - LANES    : ordered list of the four lane directions.
 *   - KEY_MAP  : maps keyboard event.code values to a lane direction.
 *   - SONGS    : the three battle charts, notes sorted ascending by time.
 *
 * This is intentionally logic-free: declarations only.
 * ---------------------------------------------------------------------------
 */

/**
 * The four lanes, left -> right. Also the canonical order used for rendering
 * and for mapping a lane to an ascending pan-flute pitch.
 * @type {Array<'left'|'down'|'up'|'right'>}
 */
const LANES = ['left', 'down', 'up', 'right'];

/**
 * Keyboard -> lane direction mapping.
 *
 * Keys are KeyboardEvent.code strings so the mapping is layout-independent:
 *   - Arrow keys:        ArrowLeft / ArrowDown / ArrowUp / ArrowRight
 *   - Home-row fallback: KeyD / KeyF / KeyJ / KeyK  (D=left, F=down, J=up, K=right)
 *
 * The dual mapping means the game is playable on any keyboard, one-handed or
 * two-handed. Consumers should look up event.code in this object; an undefined
 * result means the key is not a gameplay key.
 *
 * @type {Object<string, 'left'|'down'|'up'|'right'>}
 */
const KEY_MAP = {
  // Arrow cluster
  ArrowLeft: 'left',
  ArrowDown: 'down',
  ArrowUp: 'up',
  ArrowRight: 'right',
  // Home-row cluster (D F J K)
  KeyD: 'left',
  KeyF: 'down',
  KeyJ: 'up',
  KeyK: 'right'
};

/**
 * The battle charts.
 *
 * Each song:
 *   id          : unique string key
 *   name        : display title
 *   opponent    : 'llama' | 'mariachi'  (which rival to draw)
 *   bpm         : tempo, drives the backing groove
 *   theme       : 'meadow' | 'fiesta' | 'mountain'  (background + palette)
 *   durationSec : total length in seconds (song ends here)
 *   difficulty  : informational label for the menu
 *   notes       : array of { time (sec from start), dir } sorted ascending by time
 *
 * The data below is copied faithfully from the design JSON.
 * @type {Array<Object>}
 */
const SONGS = [
  {
    id: 'battle1_meadow',
    name: 'Meadow Wheek-Off',
    opponent: 'llama',
    bpm: 96,
    theme: 'meadow',
    durationSec: 31,
    difficulty: 'easy',
    notes: [
      { time: 2, dir: 'left' },
      { time: 2.625, dir: 'right' },
      { time: 3.25, dir: 'left' },
      { time: 3.875, dir: 'right' },
      { time: 4.5, dir: 'up' },
      { time: 5.125, dir: 'up' },
      { time: 5.75, dir: 'down' },
      { time: 7, dir: 'right' },
      { time: 7.625, dir: 'left' },
      { time: 8.25, dir: 'right' },
      { time: 8.875, dir: 'left' },
      { time: 9.5, dir: 'down' },
      { time: 10.125, dir: 'up' },
      { time: 10.75, dir: 'down' },
      { time: 12, dir: 'left' },
      { time: 12.625, dir: 'down' },
      { time: 13.25, dir: 'up' },
      { time: 13.875, dir: 'right' },
      { time: 14.5, dir: 'right' },
      { time: 15.125, dir: 'up' },
      { time: 15.75, dir: 'down' },
      { time: 17, dir: 'left' },
      { time: 17.625, dir: 'left' },
      { time: 18.25, dir: 'right' },
      { time: 18.875, dir: 'right' },
      { time: 19.5, dir: 'up' },
      { time: 20.125, dir: 'down' },
      { time: 20.75, dir: 'up' },
      { time: 22, dir: 'right' },
      { time: 22.625, dir: 'up' },
      { time: 23.25, dir: 'down' },
      { time: 23.875, dir: 'left' },
      { time: 24.5, dir: 'left' },
      { time: 25.125, dir: 'right' },
      { time: 25.75, dir: 'left' },
      { time: 26.375, dir: 'right' },
      { time: 27, dir: 'up' },
      { time: 27.625, dir: 'up' },
      { time: 28.25, dir: 'down' },
      { time: 28.875, dir: 'down' },
      { time: 29.5, dir: 'left' }
    ]
  },
  {
    id: 'battle2_fiesta',
    name: 'Fiesta Flauta Fandango',
    opponent: 'mariachi',
    bpm: 120,
    theme: 'fiesta',
    durationSec: 36,
    difficulty: 'medium',
    notes: [
      { time: 2, dir: 'left' },
      { time: 2.5, dir: 'right' },
      { time: 3, dir: 'down' },
      { time: 3.5, dir: 'up' },
      { time: 4, dir: 'right' },
      { time: 4.25, dir: 'right' },
      { time: 4.5, dir: 'up' },
      { time: 5, dir: 'down' },
      { time: 6, dir: 'down' },
      { time: 6.5, dir: 'up' },
      { time: 7, dir: 'left' },
      { time: 7.5, dir: 'right' },
      { time: 8, dir: 'left' },
      { time: 8.25, dir: 'down' },
      { time: 8.5, dir: 'up' },
      { time: 8.75, dir: 'right' },
      { time: 9.5, dir: 'right' },
      { time: 10, dir: 'right' },
      { time: 10.5, dir: 'left' },
      { time: 11, dir: 'right' },
      { time: 12, dir: 'down' },
      { time: 12.25, dir: 'down' },
      { time: 12.5, dir: 'up' },
      { time: 13, dir: 'left' },
      { time: 14, dir: 'up' },
      { time: 14.5, dir: 'down' },
      { time: 15, dir: 'left' },
      { time: 15.5, dir: 'right' },
      { time: 16, dir: 'left' },
      { time: 16.25, dir: 'down' },
      { time: 16.5, dir: 'up' },
      { time: 16.75, dir: 'right' },
      { time: 17, dir: 'left' },
      { time: 17.25, dir: 'down' },
      { time: 18, dir: 'right' },
      { time: 18.5, dir: 'up' },
      { time: 19, dir: 'down' },
      { time: 19.5, dir: 'left' },
      { time: 20, dir: 'up' },
      { time: 20.25, dir: 'up' },
      { time: 20.5, dir: 'left' },
      { time: 21, dir: 'down' },
      { time: 22, dir: 'down' },
      { time: 22.5, dir: 'up' },
      { time: 23, dir: 'down' },
      { time: 23.5, dir: 'up' },
      { time: 24, dir: 'right' },
      { time: 24.25, dir: 'left' },
      { time: 24.5, dir: 'up' },
      { time: 24.75, dir: 'down' },
      { time: 25, dir: 'right' },
      { time: 25.25, dir: 'left' },
      { time: 26, dir: 'left' },
      { time: 26.5, dir: 'right' },
      { time: 27, dir: 'down' },
      { time: 28, dir: 'up' },
      { time: 28.25, dir: 'up' },
      { time: 28.5, dir: 'down' },
      { time: 29, dir: 'left' },
      { time: 30, dir: 'left' },
      { time: 30.5, dir: 'down' },
      { time: 31, dir: 'up' },
      { time: 31.5, dir: 'right' },
      { time: 32, dir: 'left' },
      { time: 32.25, dir: 'right' },
      { time: 32.5, dir: 'left' },
      { time: 32.75, dir: 'right' },
      { time: 33, dir: 'down' },
      { time: 33.25, dir: 'up' },
      { time: 34, dir: 'up' }
    ]
  },
  {
    id: 'battle3_mountain',
    name: 'Andes Llama Showdown',
    opponent: 'llama',
    bpm: 135,
    theme: 'mountain',
    durationSec: 41,
    difficulty: 'hard',
    notes: [
      { time: 2, dir: 'left' },
      { time: 2.444, dir: 'up' },
      { time: 2.889, dir: 'right' },
      { time: 3.333, dir: 'up' },
      { time: 3.778, dir: 'left' },
      { time: 4, dir: 'left' },
      { time: 4.222, dir: 'up' },
      { time: 4.444, dir: 'right' },
      { time: 4.667, dir: 'down' },
      { time: 5.111, dir: 'up' },
      { time: 5.556, dir: 'right' },
      { time: 6, dir: 'left' },
      { time: 6.222, dir: 'up' },
      { time: 6.444, dir: 'down' },
      { time: 6.889, dir: 'right' },
      { time: 7.333, dir: 'up' },
      { time: 7.556, dir: 'down' },
      { time: 7.778, dir: 'up' },
      { time: 8, dir: 'down' },
      { time: 8.222, dir: 'left' },
      { time: 8.444, dir: 'right' },
      { time: 8.667, dir: 'left' },
      { time: 8.889, dir: 'right' },
      { time: 9.111, dir: 'down' },
      { time: 9.556, dir: 'up' },
      { time: 10, dir: 'down' },
      { time: 10.444, dir: 'up' },
      { time: 10.889, dir: 'left' },
      { time: 11.111, dir: 'down' },
      { time: 11.333, dir: 'up' },
      { time: 11.556, dir: 'right' },
      { time: 11.778, dir: 'left' },
      { time: 12, dir: 'down' },
      { time: 12.222, dir: 'up' },
      { time: 12.444, dir: 'right' },
      { time: 12.667, dir: 'right' },
      { time: 13.111, dir: 'right' },
      { time: 13.333, dir: 'left' },
      { time: 13.556, dir: 'left' },
      { time: 14, dir: 'up' },
      { time: 14.444, dir: 'down' },
      { time: 14.667, dir: 'up' },
      { time: 14.889, dir: 'down' },
      { time: 15.111, dir: 'up' },
      { time: 15.333, dir: 'left' },
      { time: 15.778, dir: 'right' },
      { time: 16.222, dir: 'left' },
      { time: 16.444, dir: 'right' },
      { time: 16.667, dir: 'down' },
      { time: 16.889, dir: 'up' },
      { time: 17.111, dir: 'left' },
      { time: 17.333, dir: 'right' },
      { time: 17.556, dir: 'down' },
      { time: 17.778, dir: 'up' },
      { time: 18, dir: 'right' },
      { time: 18.444, dir: 'up' },
      { time: 18.889, dir: 'down' },
      { time: 19.778, dir: 'left' },
      { time: 20, dir: 'left' },
      { time: 20.222, dir: 'down' },
      { time: 20.444, dir: 'down' },
      { time: 20.667, dir: 'up' },
      { time: 20.889, dir: 'up' },
      { time: 21.111, dir: 'right' },
      { time: 21.333, dir: 'right' },
      { time: 21.556, dir: 'up' },
      { time: 21.778, dir: 'right' },
      { time: 22, dir: 'down' },
      { time: 22.222, dir: 'left' },
      { time: 22.444, dir: 'up' },
      { time: 22.667, dir: 'right' },
      { time: 22.889, dir: 'down' },
      { time: 23.111, dir: 'left' },
      { time: 23.333, dir: 'left' },
      { time: 23.778, dir: 'up' },
      { time: 24, dir: 'right' },
      { time: 24.222, dir: 'down' },
      { time: 24.667, dir: 'up' },
      { time: 25.111, dir: 'right' },
      { time: 25.333, dir: 'down' },
      { time: 25.556, dir: 'up' },
      { time: 25.778, dir: 'left' },
      { time: 26, dir: 'right' },
      { time: 26.222, dir: 'down' },
      { time: 26.444, dir: 'up' },
      { time: 26.667, dir: 'left' },
      { time: 26.889, dir: 'down' },
      { time: 27.333, dir: 'down' },
      { time: 27.778, dir: 'up' },
      { time: 28.222, dir: 'up' },
      { time: 28.667, dir: 'left' },
      { time: 28.889, dir: 'right' },
      { time: 29.111, dir: 'left' },
      { time: 29.333, dir: 'right' },
      { time: 29.556, dir: 'up' },
      { time: 29.778, dir: 'down' },
      { time: 30, dir: 'up' },
      { time: 30.222, dir: 'down' },
      { time: 30.444, dir: 'left' },
      { time: 30.667, dir: 'up' },
      { time: 30.889, dir: 'right' },
      { time: 31.111, dir: 'down' },
      { time: 31.333, dir: 'left' },
      { time: 31.556, dir: 'up' },
      { time: 31.778, dir: 'right' },
      { time: 32, dir: 'down' },
      { time: 32.222, dir: 'up' },
      { time: 32.667, dir: 'down' },
      { time: 32.889, dir: 'up' },
      { time: 33.111, dir: 'left' },
      { time: 33.556, dir: 'right' },
      { time: 34, dir: 'right' },
      { time: 34.222, dir: 'left' },
      { time: 34.444, dir: 'right' },
      { time: 34.667, dir: 'left' },
      { time: 34.889, dir: 'down' },
      { time: 35.111, dir: 'up' },
      { time: 35.333, dir: 'down' },
      { time: 35.556, dir: 'up' },
      { time: 35.778, dir: 'left' },
      { time: 36.222, dir: 'up' },
      { time: 36.667, dir: 'right' },
      { time: 37.111, dir: 'down' },
      { time: 37.556, dir: 'left' },
      { time: 37.778, dir: 'down' },
      { time: 38, dir: 'up' },
      { time: 38.222, dir: 'right' },
      { time: 38.444, dir: 'up' },
      { time: 38.667, dir: 'down' },
      { time: 38.889, dir: 'left' },
      { time: 39.111, dir: 'right' },
      { time: 39.333, dir: 'up' }
    ]
  }
];

// Expose on window explicitly for clarity (top-level const in a classic script
// already becomes a global in browsers, but this makes the contract obvious and
// is harmless under strict environments/tools).
if (typeof window !== 'undefined') {
  window.LANES = LANES;
  window.KEY_MAP = KEY_MAP;
  window.SONGS = SONGS;
}
