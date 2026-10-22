# CuffCheck: project context

A one-page briefing for anyone (teammate, judge-prep, or a fresh AI session) picking up this repo. For the full walkthrough see [HOW_IT_WORKS.md](HOW_IT_WORKS.md); for the public pitch see [README.md](README.md).

Last updated: Oct 22, 2026.

---

## 1. The Congressional App Challenge entry

| | |
| --- | --- |
| Competition | 2026 Congressional App Challenge, Virginia's 4th District |
| Team | Two high school students (names go in README "Team") |
| Deadline | **Mon Oct 26, 2026, 12:00 PM ET** |
| Our plan | Code freeze **Sat Oct 24**, submit **Sun Oct 25** |
| Repo | https://github.com/AymanM-Projects/cuffcheck (public, `main` branch) |
| Live app | https://aymanm-projects.github.io/cuffcheck/ (GitHub Pages, served from `main` root) |

**Confirm on congressionalappchallenge.us before submitting:** the demo video requirements (length, YouTube/Vimeo link), the submission form fields, and the judging criteria. These are not copied here because they can change year to year.

### Our own rules for the entry
These come from the project brief we wrote at the start and still apply:

- **We must understand every line.** Nothing goes in that we can't explain to a judge.
- **AI disclosure.** Every change made with Claude gets an entry in [AI_USAGE.md](AI_USAGE.md): what Claude generated and what we did ourselves.
- **Plain web stack.** HTML, CSS and vanilla JavaScript. The only outside code is MediaPipe, loaded from a CDN. No frameworks, no build step, no web fonts.
- **Small files.** Aim for about 200 lines per file.
- **Thresholds are ours to tune.** Every tunable number is marked `// TEAM TUNES THIS`.
- **No faked results.** A check that can't see a body part says "can't see". It never guesses "pass". Model accuracy numbers are only the ones we actually measured.
- **Privacy.** No video, image or sound leaves the phone. Nothing is uploaded.

---

## 2. What the app does

CuffCheck watches someone take their own blood pressure at home with the phone camera, and checks their **technique** live. It does not measure blood pressure; their own cuff does that.

**The problem:** only 3% of patients measure at home without a single error (Nessler et al., 2021). An unsupported arm alone raises systolic readings by about 6.5 mmHg (Liu et al., JAMA Internal Medicine, 2024). Wrong readings can lead to wrong medication. Home monitors check little or nothing about posture; CuffCheck checks the whole body.

**The flow:**
1. **Set up.** Choose camera, cuffed arm and rest time (5 / 3 / 1 min or none). Prop the phone about 2 m (6 ft) away, pointed at the cuffed side.
2. **Rest.** The rest timer runs only while every check passes and the person stays still.
3. **Measure.** The app says "press start on your monitor". If every check stays green until the user enters the reading, it gets a **Verified** badge.
4. **My readings.** History and a report that averages only Verified readings, plus a safety screen (180/120 urges a 911 call if there are symptoms).

**The eight checks:** whole body in the picture, sitting upright, back against the chair, legs uncrossed, feet flat, cuff at heart level, rested, not talking.

---

## 3. How the code fits together

```
camera.js   camera + MediaPipe Pose/Face + mic level, draws the skeleton
   │  frame = { landmarks, worldLandmarks, jawOpen, micLevel, aspect }
   ▼
engine.js   runs every check each frame, smooths ~1 s, rest timer, phases, Verified
   │  uses checks.js (pure rules) + model.js (posture model)
   ▼
coach.js    picks ONE message, shows it, speaks it (with a tip on repeats)
   ▼
main.js     wires the page: buttons, checklist, screens, text size
readings.js reading form, history, report, safety screen
sessionLog.js  per-second check results for export (our study data)
```

| File | Lines | What it holds |
| --- | --- | --- |
| [js/checks.js](js/checks.js) | 430 | One pure function per check, all thresholds |
| [js/main.js](js/main.js) | 233 | Page wiring |
| [js/camera.js](js/camera.js) | 215 | Camera, MediaPipe, mic, skeleton drawing |
| [js/readings.js](js/readings.js) | 204 | Reading form, history, report |
| [js/engine.js](js/engine.js) | 164 | Smoothing, phases, rest timer, Verified |
| [js/coach.js](js/coach.js) | 115 | Message choice, speech timing, tips |
| [js/model.js](js/model.js) | 90 | Posture model in plain JS |
| [js/sessionLog.js](js/sessionLog.js) | 58 | Export log |
| [index.html](index.html), [style.css](style.css) | 197, 222 | Page and theme |
| [training/train.py](training/train.py) | 143 | Trains the posture model |
| [model/posture_model.json](model/posture_model.json) | | Model weights the app loads |
| [tests/](tests/) | | 44 node tests (`checks` 24, `app` 14, `model` 6) |

**The posture model:** two logistic regressions (trunk leaning, legs crossed), trained on the MultiPosture dataset (Zenodo 14230872, CC BY 4.0, 13 people filmed from the **front**). We film from the **side**, so both Python and JS rotate the body first. Its "not upright" label includes leaning *back*, so the app ignores it when the person is leaning back against the chair. It is only a tie-breaker: legs need a crossed chance above 0.85.

---

## 4. Current rules and key thresholds

All in [js/checks.js](js/checks.js) unless noted. "Torso" = shoulder-to-hip length.

| Check | Passes when | Main knobs |
| --- | --- | --- |
| Framing | Right distance; side (not front) facing the camera; cuffed-side shoulder, elbow, hip, knee and one ankle seen. Gives directions: closer/farther, turn sideways, turn around, tilt up/down | `TOO_FAR_TORSO` 0.12, `TOO_CLOSE_TORSO` 0.45, `FACING_*` |
| Sitting upright | Shoulder-hip-knee angle 70–140° | `HIP_ANGLE_MIN/MAX` |
| Back against chair | Median trunk lean over 4 s: no more than 15° forward, no more than 40° back. Leaning back is correct | `BACK_FORWARD_LIMIT`, `BACK_RECLINE_LIMIT` |
| Legs uncrossed | No *clearly seen* (visibility ≥ 0.8) lifted knee/ankle (side view) or left/right swap (angled view) | `SURE_VISIBILITY`, `KNEE_LEVEL_LIMIT`, `ANKLE_RAISED_LIMIT` |
| Feet flat | Nearest leg's ankle at least 0.3 torso below its knee | `FEET_MIN_DROP` |
| Cuff at heart | Cuff point (60% down the upper arm) within 0.1 torso of mid-chest | `CUFF_RATIO`, `HEART_TOLERANCE` |
| Rested | Still for the chosen time; big moves restart it. Under 5 min = not Verified | `STILL_LIMIT`, `MOVE_LIMIT`; rest time in [js/engine.js](js/engine.js) |
| Not talking | Jaw movement and mic loudness low | `MOUTH_MOVE_LIMIT`, `VOICE_*` |

The coach ([js/coach.js](js/coach.js)) speaks a problem only after it lasts 2 s, adds a how-to tip when it repeats, says "Good." when one is fixed, and waits 15 s before repeating a line.

---

## 5. History

| Date | What happened |
| --- | --- |
| Oct 18–19 | Milestones 1–10 built: camera, all checks, engine, coach, readings, posture model, polish |
| Oct 20 | Visual theme refresh (teal accent, cards, step strip) |
| Oct 21 | **First real test:** "sit back in the chair" repeated even when sitting correctly. Fixed: leaning back now passes, the model can no longer veto it, specific distance/direction messages, tips on repeats |
| Oct 22 | **Second test with a real cuff:** "too stingy", "keeps spamming uncross legs" (the far leg is hidden from the side). Fixed: only clearly seen joints count, near-side-only framing, 2 s speech hold, rest-time choice with an explanation |

---

## 6. Still to do before submitting

- [ ] **Real-phone testing and tuning** with a cuff: run the test plan in HOW_IT_WORKS §5 with "Show numbers for tuning" on, and adjust the `TEAM TUNES THIS` values.
- [ ] **AI_USAGE.md student sections:** fill in every _(Fill this in)_ blank: phones tested, thresholds changed, wording rewritten.
- [ ] **README:** team names, coding-completed date, update the test count (it still says 33; there are now 44) and the limitation about the 5-minute rest.
- [ ] **Posture model on our own side-view sessions:** add the numbers to README, or keep saying we haven't measured it.
- [ ] **checks.js is 430 lines**, over our ~200-line target. Either split it (for example a `framing.js`) or be ready to explain why.
- [ ] **Demo video and submission form:** check the current rules on the CAC site.
- [ ] Final run: `node --test tests/*.test.js`, a phone test on the live link, Demo mode **off** by default.

---

## 7. How to run it

```
npx serve .                 # then open http://localhost:3000 (camera works on localhost)
node --test tests/*.test.js # 44 tests
python3 training/train.py   # retrain the posture model (needs the dataset CSV, which is git-ignored)
```

On a phone, just open the live link and allow the camera. Turn on **Demo mode** for a 30-second rest when filming.
