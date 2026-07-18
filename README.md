# Cavia Con Carne: Pan-Flute Fury

A tiny browser rhythm game starring one brave guinea pig, a magic pan flute, and a
whole lot of shady rivals. Arrows fall down a four-lane highway; hit each one in
time with the beat to out-pipe the llama and the mariachi. Pure canvas art and
live-synthesized WebAudio sound &mdash; **no images, no audio files, no server.**

## How to play

- **Menu:** press **&uarr; / &darr;** (or **W / S**) to pick a battle, then **Enter**
  or **Space** to start.
- **Battle:** a 3&middot;2&middot;1&middot;GO! count-in plays, then arrows stream toward the
  hit line. Press the matching lane the instant an arrow reaches the receptor:
  - **D** or **&larr;** &rarr; left lane
  - **F** or **&darr;** &rarr; down lane
  - **J** or **&uarr;** &rarr; up lane
  - **K** or **&rarr;** &rarr; right lane
- Tight timing scores a **PERFECT**, close enough is a **GOOD**, and mistimed or
  missed notes cost health. Keep your combo alive and don't let the health bar
  hit zero before the song ends.
- **Pause:** **Esc** or **P** during a battle. From the pause screen, **Esc / P**
  resumes and **Enter** quits to the menu.
- **Results:** **Enter** replays the same battle, **Esc** returns to the menu.

### On a phone / tablet (touch)

The game is fully playable by touch. Hold the device in **landscape** (it shows a
"rotate your phone" hint in portrait), then:

- **Menu:** tap a battle to select it, tap it again to start.
- **Battle:** four big arrow buttons sit along the bottom of the screen &mdash; tap
  them in time with the falling notes (multi-touch works, so you can hit two at
  once). Tap **&#10074;&#10074; Pause** (top-right) to pause.
- **Pause / Results:** tap the on-screen **Resume / Replay / Menu** buttons.

The whole page behaves like an app on touch devices: no scrolling, pinch-zoom, or
double-tap-zoom &mdash; every tap is a button press.

### The three battles

1. **Meadow Wheek-Off** &mdash; vs a smug llama, 96 BPM (easy warm-up).
2. **Fiesta Flauta Fandango** &mdash; vs a strumming mariachi, 120 BPM (medium).
3. **Andes Llama Showdown** &mdash; vs the llama again, 135 BPM (hard finale).

Win (finish with health above zero) and you earn a rank from **C** up to **S**
based on how many PERFECT hits you land.

## Running it

Just **open `index.html`** in any modern browser &mdash; double-click the file, no
web server or build step required. Everything runs over `file://`. Sound unlocks
automatically on your first keypress/tap (a browser autoplay requirement); if audio
is blocked, the game plays on silently rather than crashing.

### Play it on your phone (GitHub Pages)

Because it's a fully static site, it hosts for free on **GitHub Pages** &mdash; ideal
for opening on a phone. This repo ships a deploy workflow at
`.github/workflows/deploy-pages.yml` that publishes the site on every push.

One-time setup: in the repository, go to **Settings &rarr; Pages** and set
**Build and deployment &rarr; Source** to **GitHub Actions**. (The workflow also
attempts to enable this automatically.) After the next push, the **Deploy to
GitHub Pages** action runs and the game goes live at:

```
https://lgrauser.github.io/Cochonsinde/
```

Open that URL on your phone, rotate to landscape, and tap to play.

## Architecture

The game is a set of plain (non-module) scripts loaded in order by `index.html`,
each publishing exactly one global. `game.js` glues them together.

| File | Global | Responsibility |
|------|--------|----------------|
| `js/audio.js` | `AudioEngine` | All sound, synthesized live with WebAudio oscillators + noise: breathy pan-flute tones, an **Andean/Peruvian backing track** (bombo drum, chajchas shaker, charango arpeggios, root/fifth bass and a quena panpipe melody over an A-minor-pentatonic Am–G vamp, tempo-locked to each song so you tap in rhythm), and UI/gameplay SFX. Degrades to a silent no-op if audio is unavailable. |
| `js/characters.js` | `Characters` | Stateless canvas painters: `guineaPig`, `llama`, `mariachi`, `background`, `panFlute`. No assets, just paths and gradients. |
| `js/songs.js` | `SONGS`, `LANES`, `KEY_MAP` | Pure data: the three battle charts, the canonical lane order, and the `KeyboardEvent.code` &rarr; lane mapping. |
| `js/rhythm.js` | `RhythmEngine` | Timing/scoring logic: hit windows, combos, health, and which notes are on screen. No DOM/audio/canvas. |
| `js/game.js` | `Game` | The controller/renderer: requestAnimationFrame loop, input, the menu &rarr; count-in &rarr; battle &rarr; results state machine, and all HUD drawing. |
| `styles.css` | &mdash; | Page chrome around the canvas: centered responsive frame, warm background, optional header/footer. |
| `index.html` | &mdash; | Loads the scripts in order and boots `new Game(canvas)` on `DOMContentLoaded`. |

Enjoy, and &iexcl;toca o corre! &mdash; play or run.
