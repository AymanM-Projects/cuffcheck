# AI usage disclosure

This file is updated after every milestone. We will paste it into the Congressional App Challenge form, so it stays honest and specific.

## Milestone 1 - camera and skeleton overlay (Oct 18, 2026)

**What Claude (Anthropic's AI assistant, via Claude Code) generated:**

- `index.html`: the page layout (video, canvas, camera choice, Start button, status line, footer).
- `style.css`: the base styles (white/black, one accent color, big button, mirror class).
- `js/camera.js`: the functions `startCamera`, `loadPoseModel`, `startTracking`, `stopTracking`, `isSeen` and `drawSkeleton`, and the config constants with the pinned MediaPipe 1.1.1 URLs.
- `js/main.js`: the button wiring, status messages and plain-English error messages.
- The first draft of `README.md` and this file.
- Claude also checked which MediaPipe version is current, confirmed the model and library URLs respond, and tested the page in Chrome on the laptop using a stand-in video stream (the real webcam needs a human to click Allow).
- During that test Claude found and fixed one bug: switching cameras ran the model on an empty frame, which crashed the model and silently stopped the skeleton. The fix is the `videoWidth > 0` guard and the `stopTracking()` call at the top of `startCamera` in `js/camera.js`.

**What we (the students) designed, changed, tuned, tested or wrote ourselves:**

_(Fill this in before moving on. Be specific.)_

- Wrote the project brief that defined the idea, the checks, the UI rules, the privacy rules and the milestone order.
- Chose the default camera (currently back) and the camera resolution (currently 640x480) after testing on: _(phones)_.
- Tuned `MIN_VISIBILITY` in `js/camera.js` from 0.5 to: _(value, and why)_.
- Tested on: _(iPhone model + Safari version, Android model + Chrome version)_.
- Changes we made to the generated code: _(list them, or "none yet")_.

## Milestone 2 - framing check and checklist (Oct 19, 2026)

**What Claude generated:**

- `js/checks.js`: the `POINT` landmark numbers, `isSeen` (moved here from `js/camera.js`), and the first check, `checkFraming`, with its first-draft wording.
- `js/engine.js`: `runChecks`, `resetSmoothing`, `isReadyToStart` and the majority-vote `smooth` function with `SMOOTH_FRAMES = 20`.
- `index.html`: the cuff-arm picker, the eight-row checklist, the Start check button and the A- / A+ buttons.
- `style.css`: the checklist grid, the three dot colors and the header row.
- `js/main.js`: `handleLandmarks`, `updateChecklist`, the Start check gate, and the text-size code (`setTextScale`, `handleTextKeys`).
- Claude tested the framing check and the smoothing in node with fake landmarks, and the page in Chrome with a stand-in video stream.

**What we (the students) designed, changed, tuned, tested or wrote ourselves:**

_(Fill this in before moving on.)_

- Rewrote the coaching wording in `checkFraming` to: _(your words)_.
- Tuned `SMOOTH_FRAMES` (currently 20) and `MIN_VISIBILITY` (currently 0.5) to: _(values, and what you saw)_.
- Chose the default cuff arm (currently left) because: _(reason)_.
- Tested the framing gate on: _(phones)_. Distance from the camera that worked: _(meters)_.
- Changes we made to the generated code: _(list them, or "none yet")_.
