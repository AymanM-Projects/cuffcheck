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

## Milestone 3 - seated, back, legs and feet rules + tests (Oct 19, 2026)

**What Claude generated:**

- `js/checks.js`: `checkSeatedUpright`, `checkBackSupported`, `checkLegsUncrossed`, `checkFeetFlat`, the helpers `trunkLeanAngle`, `angleAt`, `sideOrder`, and the first-draft thresholds (`HIP_ANGLE_MIN/MAX`, `BACK_LEAN_LIMIT`, `BACK_STEADY_LIMIT`, `BACK_MIN_SAMPLES`, `CROSS_MIN_GAP`, `FEET_MIN_DROP`) and wording.
- `js/engine.js`: the five-check list, the 10-second trunk-lean history (`rememberLean`, `BACK_WINDOW_MS`), and the optional clock argument so tests do not wait.
- `tests/checks.test.js`: the fake side-view and front-view bodies and 23 tests.
- Claude ran `node --test` and the page in Chrome with a stand-in stream.

**What we (the students) designed, changed, tuned, tested or wrote ourselves:**

_(Fill this in before moving on.)_

- Tuned thresholds after live testing: _(which ones, from what to what, and why)_.
- Rewrote the coaching wording for: _(which checks)_.
- Tests we added or changed: _(list)_.
- False alarms we saw and how we fixed them: _(list)_.
- Tested on: _(phones, chair type, distance, side view or angled)_.

## Milestones 4 to 10 - built in one pass at our request (Oct 19, 2026)

We asked Claude to build the remaining milestones together so we could test the whole app at once. Claude ran the test suite and checked every screen in Chrome with a stand-in video stream; it could not test with a real person, a real phone, or a real cuff.

**What Claude generated:**

- **Milestone 4, arm at heart level:** `checkArmAtHeart` in `js/checks.js`. Claude changed the brief's "midpoint of shoulder to elbow" into a tunable `CUFF_RATIO` (default 0.6), because at 0.5 an arm hanging at your side would pass. Only height is compared, so an arm resting forward on a table is fine.
- **Milestone 5, rest, stillness, talking, coaching:** `motionAmount`, `nextRestSeconds`, `checkRest`, `checkNotTalking` in `js/checks.js`; the phases, rest timer, histories and Verified decision in `js/engine.js`; all of `js/coach.js`; the Face Landmarker, the microphone level and the picture-unit scaling in `js/camera.js`; the Demo mode switch and banner.
- **Milestone 6, readings:** all of `js/readings.js` (validation, safety levels, history, report) and the reading, safety, history and report screens in `index.html`.
- **Milestone 7, why it matters and About:** the three cards and the About text. Claude found the sources (Nessler et al. 2021; Liu et al. 2024, the ARMS trial) and checked the numbers against them.
- **Milestone 8, session log:** all of `js/sessionLog.js` and the Export button.
- **Milestone 9, posture model:** `training/train.py`, `training/README.md`, `js/model.js`, `model/posture_model.json` (produced by running the script), and `tests/model.test.js`. Claude inspected the CSV and found it holds world landmarks for all 33 joints, filmed from the front, and wrote the conversion that turns side views to match.
- **Milestone 10, polish:** fixed buttons that stayed visible when hidden, fixed the header and tabs overflowing on 320-pixel phones, checked every screen fits at 320, 375 and 414 pixels wide at normal and largest text, finished the README, wrote `HOW_IT_WORKS.md`, and added `.gitignore` so the training CSV is not committed.
- Tests: rewrote `tests/checks.test.js` and added `tests/app.test.js` (33 tests in total).

**What we (the students) designed, changed, tuned, tested or wrote ourselves:**

_(Fill this in before submitting. Be specific: values, phones, what you rewrote.)_

- Tested on: _(iPhone model + Safari, Android model + Chrome)_, with a real cuff: _(model)_.
- Thresholds we tuned using "Show numbers for tuning": _(name, old value, new value, why)_.
- Coaching wording we rewrote: _(which lines)_.
- False alarms we found and fixed: _(list)_.
- Own-session test of the posture model: _(how many sessions, results)_.
- Changes we made to the generated code: _(list)_.
