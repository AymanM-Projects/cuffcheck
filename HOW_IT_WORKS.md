# CuffCheck: how it works and how to test it

This guide is for the two of us building CuffCheck. It explains what every part of the app does, how to run a test session together, what to try, and how to tune the numbers. Read it once top to bottom, then keep the test plan open while you test.

---

## 1. Get it running

**On your laptop**

```
cd cuffcheck
npx serve .
```

Open `http://localhost:3000` and allow the camera.

**On a phone**

Push your changes, wait about a minute, then open https://aymanm-projects.github.io/cuffcheck/

```
git add -A
git commit -m "Milestones 4-10"
git push
```

Your partner gets the same code with `git pull`.

**Run the tests** (needs Node.js):

```
node --test
```

You should see 33 passing. Run this every time you change a threshold or a check.

The first visit downloads the MediaPipe library and its pose and face models, several megabytes in all, so give it some seconds on mobile data. Later visits are faster.

---

## 2. The screens

The tabs at the top switch between three main screens. Two more appear when needed.

| Screen | What it is for |
| --- | --- |
| **Check** | Setup, the live camera with skeleton, one big coaching message, the session buttons, and the 8-row checklist. |
| **My readings** | Your saved readings, newest first, each marked Verified or Not verified. Buttons for the report, a manual reading, and Export session results. |
| **Why it matters** | Three fact cards with sources, plus the About section with the dataset credit and the privacy statement. |
| Enter your reading | Appears after a check. Type systolic, diastolic and pulse from the cuff. |
| Safety screen | Appears instead of My readings when the reading is 180 or higher on top, or 120 or higher on the bottom. |

The A− and A+ buttons, or Ctrl/Cmd with + and −, make all the text smaller or bigger.

On the Check screen, a step strip shows where you are: **1 Set up**, **2 Rest**, **3 Measure**. Steps you have finished turn green. Each checklist dot shows a symbol as well as a color: a check mark for OK, ! for fix this, and ? for can't see.

---

## 3. Setting up the phone

The checks were designed for a **side view**. Getting the camera right is the single biggest thing for good results.

1. Sit in a normal chair with a back, next to a table.
2. Put the phone on a stand or prop it on books about **2 meters away**, at roughly **hip to chest height**, pointed at your side.
3. **The cuffed arm faces the camera.** If the cuff is on your left arm, your left side faces the phone. The far arm is hidden behind your body and the arm check would say "can't see".
4. Turn the chair slightly toward the phone, about a quarter turn. A pure profile hides one leg behind the other, so the legs rule can't tell left from right. A slight turn lets the camera see both legs.
5. The whole body must be in the picture: head to ankles.
6. Light the room well. Avoid a bright window behind you.

In Setup, pick the camera (back camera if the phone faces you, front camera if you want to see yourself) and **which arm wears the cuff**.

---

## 4. A full session, step by step

1. **Setup.** Choose camera and arm. Leave "Speak the coaching messages" and "Listen for talking" on. Turn on "Show numbers for tuning" while you are testing.
2. **Start camera.** The skeleton appears. The coaching message says exactly what to change, for example "You're too far from the camera. Move it about 1 meter (3 feet) closer to you." or "You're facing the camera. Turn your chair sideways so your left side, with the cuff, faces the camera." A smaller how-to tip sits under it. If the same problem is still there next time, the voice adds that tip instead of repeating the same words, and it says "Good." when you fix something.
3. **Start check** turns blue once the top row, "Whole body in the picture", is green. Press it. The phone says "Starting the check…". The Setup box folds away.
4. **Fix anything red.** The coach says one problem at a time, in this order: framing, sitting upright, back, legs, feet, arm, talking. It speaks no more than once every 3 seconds and waits 12 seconds before repeating the same sentence.
5. **Rest.** When everything else is green, the coach says "Good. Now relax and stay still and quiet." The "Rested 5 minutes" row counts down. It counts only while you are still, pauses for small fidgets, and **starts over** if you move a lot. Turn on **Demo mode** to make it 30 seconds for testing and filming; a banner says DEMO MODE the whole time.
6. **All green.** The coach says "Everything looks right. Press start on your blood pressure monitor now…". From this moment the app watches for anything that slips.
7. **Measure.** Press start on the cuff and stay still and quiet.
8. **Enter the reading.** When the cuff finishes, press "My monitor is done: enter reading". The form shows whether the reading is Verified. Type the three numbers and save.
9. **After saving.**
   - 180+ on top or 120+ on the bottom: the safety screen with the 911 advice and a **Find care near me** button that opens Google Maps.
   - 130+ on top or 80+ on the bottom: My readings shows a note suggesting you share your report with your doctor.
   - Otherwise: straight to My readings.

**Verified** means all three of these are true:

- every check was green at the moment you were told to press start;
- no check went red or gray at any time until you pressed "enter reading";
- at least 20 seconds passed in between, since a real cuff reading takes that long.

"Stop check" ends the session without saving anything.

---

## 5. Test plan to run with your friend

One person sits and takes the reading. The other holds this list and writes down what happens. Then swap. Do each test with "Show numbers for tuning" on, and write down the number shown for that row in both the correct and the wrong position. Those numbers are what you need for tuning in section 7.

### The eight checks

| # | Check | Make it pass | Make it fail | Expected |
| --- | --- | --- | --- | --- |
| 1 | Whole body in the picture | Sit 2 m away, all of you in frame | Lean toward the phone so knees leave the frame | Red, message names the missing parts; Start check turns gray |
| 2 | Sitting upright | Sit up straight | Fold forward over your knees; or slump far back | Red: "You're bent forward" or "slumped or reclining" |
| 3 | Back against the chair | Sit back against the chair (leaning back a little is fine) | Lean forward away from the chair; then recline far back | Forward: red, "You're leaning forward. Sit back until your back touches the chair". Far back: red, "leaning too far back". Gray for the first second ("Hold still") is normal |
| 4 | Legs uncrossed | Both feet on the floor, apart | Cross your legs, knee over knee, then ankle over ankle | Red: "Uncross your legs". If it says "Turn a little toward the camera", angle the chair more |
| 5 | Feet flat | Feet flat on the floor | Pull one foot up onto the chair rung | Red: "Put both feet flat on the floor". Lifting just a heel will **not** be caught |
| 6 | Cuff at heart level | Forearm resting on the table, cuff about level with mid-chest | Let the arm hang at your side; then raise the elbow up high | Hanging: red, "Raise your arm a little". Too high: red, "Lower your arm a little" |
| 7 | Rested 5 minutes | Demo mode on, sit still for 30 s | Stand up halfway, or shift around a lot | Countdown in the reason text; a big move restarts it at 0:30 |
| 8 | Not talking | Stay quiet, mouth still | Talk normally for a few seconds | Red: "Please stay quiet". Try once with the mic option off to test the mouth-only path |

### The reading flow

| # | Test | Expected |
| --- | --- | --- |
| 9 | A full good session in Demo mode, cuff running, then enter 118/76/64 | Form says "Verified"; My readings shows the reading with a Verified badge and "(demo mode)" |
| 10 | Same, but drop your arm to your side while the cuff is measuring | Form says "Not verified: these checks slipped during the reading: Cuff at heart level" |
| 11 | Press "enter reading" during the rest countdown | "Not verified: not every check had passed yet when you entered it" |
| 12 | Leave a box empty, or type 80 on top and 120 on the bottom | A clear error under the form; nothing saved |
| 13 | Enter 186/96 (made-up test numbers) | Safety screen. "Find care near me" opens Google Maps in a new tab |
| 14 | Enter 136/84 | My readings with the "130/80 or higher" note |
| 15 | My readings → View report | Count, % verified, average of verified readings only, and a table of every reading |
| 16 | On the report, press "Print or save as PDF" | Print preview shows only the report and the footer. Save as PDF works |
| 17 | After a session, My readings → Export session results | A JSON file downloads (see section 8) |
| 18 | A+ six times, then Ctrl/Cmd + and − | All text grows and shrinks; nothing runs off the side of the screen |
| 19 | Switch to another app mid-session, then come back | Camera and mic stop; status says "Camera paused" |

**Clean up after testing:** made-up test readings stay in that phone's browser. To clear them, delete the site's data: on iPhone, Settings → Safari → Advanced → Website Data; on Android Chrome, Settings → Site settings → All sites.

### Phones to test

Test on at least one iPhone with Safari and one Android phone with Chrome. Note for each phone:

- how smooth the skeleton is;
- whether speech works (iPhone needs the Start check tap to unlock speech);
- whether the mic permission prompt appears;
- whether the face is detected from 2 m: turn the mic option off, then open and close your mouth. If the talking row's number stays "-", the face is not being found.

---

## 6. How each check works

All the rules live in `js/checks.js`. Each one is a short function that takes the 33 body points and returns pass, fail or "can't see". A point counts as seen only when MediaPipe's own confidence for it is at least 0.5 (`MIN_VISIBILITY`).

MediaPipe gives each point as a fraction of the picture width (x) and height (y). `camera.js` multiplies x by width ÷ height before the checks run, so angles are measured the same way they look on screen.

| Check | How it decides | Number shown in "Show numbers" | Threshold to tune |
| --- | --- | --- | --- |
| Framing | In order: torso size in the picture (too far / too close); facing the camera (shoulders look wide or thighs look short); then both shoulders, both hips, the cuffed elbow, both knees and at least one ankle must be seen. If the cuffed elbow is hidden and that shoulder is farther away, it says turn around. Hidden points past an edge give "tilt the camera up/down" or "move to the middle" | Torso length as a share of picture height | `TOO_FAR_TORSO` 0.12, `TOO_CLOSE_TORSO` 0.45, `FACING_SHOULDER_RATIO` 0.7, `FACING_THIGH_RATIO` 0.4, `MIN_VISIBILITY` |
| Sitting upright | Angle at the hip between the line to the shoulder and the line to the knee | Hip angle in degrees | `HIP_ANGLE_MIN` 70, `HIP_ANGLE_MAX` 140 (leaning back on a chair opens the hip past 120) |
| Back against the chair | The engine keeps 4 s of trunk lean angles (hip-to-shoulder line vs straight up), signed: + = forward toward the knees, − = back toward the chair. It uses the side nearest the camera. Fails if the median leans forward too far or reclines too far. The posture model only gets a say when the trunk is not leaning back, and only when it is very sure, because it was trained to call leaning *back* "not upright" too | Median lean in degrees, or the model's upright chance | `BACK_FORWARD_LIMIT` 15, `BACK_RECLINE_LIMIT` 40, `MODEL_UPRIGHT_MIN` 0.15 |
| Legs uncrossed | Rule: uncrossed legs keep the same left/right order at hips, knees and ankles; crossing swaps it. Model: chance the legs are crossed. Either one saying "crossed" fails. If the rule can't tell sides apart, the model decides | Model's crossed chance | `CROSS_MIN_GAP` 0.03, `MODEL_CROSSED_MAX` 0.5 |
| Feet flat | Each visible ankle must sit clearly below its knee | Smallest knee-to-ankle drop | `FEET_MIN_DROP` 0.05 |
| Cuff at heart level | Cuff point = 60% of the way from shoulder to elbow. Heart = 25% of the way from shoulder to hip. Compares only their **height**, in torso lengths | Gap in torso lengths: + means cuff too low, − means too high | `CUFF_RATIO` 0.6, `HEART_RATIO` 0.25, `HEART_TOLERANCE` 0.1 |
| Rested 5 minutes | Movement = how far shoulders, hips and knees wandered in the last second, in torso lengths. Below `STILL_LIMIT` the timer runs; between the two limits it pauses; above `MOVE_LIMIT` it restarts | Seconds rested so far | `STILL_LIMIT` 0.08, `MOVE_LIMIT` 0.25 |
| Not talking | Fails if the face model's "jawOpen" score wobbles over the last 2 s, **or** if the mic was loud for more than 30% of the last 2 s. "Can't see" only if neither the face nor the mic gives data | Mouth wobble, or the loud share if no face | `MOUTH_MOVE_LIMIT` 0.05, `VOICE_LEVEL_LIMIT` 0.02, `VOICE_FRACTION_LIMIT` 0.3 |

**Why 60% and not the halfway point for the cuff?** The brief said the midpoint of the upper arm. But the cuff sits on the lower half of the upper arm, and at 50% an arm hanging at your side would land close enough to heart height to pass. 60% separates "resting on a table" from "hanging at your side". Tune it with real numbers.

**The engine** (`js/engine.js`) runs all eight checks on every frame, then **smooths** them. It keeps each check's last 20 answers, about one second, and shows the most common one, so a single bad frame never flips a dot. It also runs the rest timer and the phases: setup, then resting, then measuring.

**The coach** (`js/coach.js`) picks the first problem in a fixed order and shows it big. It speaks it with the phone's built-in voice. Some lines ("now relax", "press start on your monitor") are said only once per session.

**The posture model** (`js/model.js`) is a weighted sum plus a sigmoid, with weights trained by `training/train.py`. It uses MediaPipe's 3D "world" points, not the screen points. Before scoring, it turns the body so the hips face the camera. The dataset was filmed from the front and we film from the side, so this turn makes the two match. `tests/model.test.js` proves the JavaScript and the Python produce the same numbers.

---

## 7. How to tune a threshold

1. Turn on **Show numbers for tuning**. The line under the checklist shows each check's number live.
2. For one check, write down the number in the **correct** position for both of you, then in the **wrong** position.
3. Set the threshold about halfway between the correct and wrong numbers. Leave a margin on the correct side, so real users don't get false alarms.
4. Change the constant at the top of `js/checks.js`. Every one is marked `// TEAM TUNES THIS`.
5. Run `node --test`. If a test fails, either your new number is wrong or the test's fake body needs updating. Decide which, and write down why in AI_USAGE.md.
6. Write the old value, the new value and your reason in AI_USAGE.md. Judges will ask.

Other tunable spots:

| Setting | File |
| --- | --- |
| `SMOOTH_FRAMES`, `BACK_WINDOW_MS`, `MOTION_WINDOW_MS`, `TALK_WINDOW_MS`, `MIN_READING_SECONDS` | `js/engine.js` |
| `ANY_LINE_GAP_MS`, `SAME_LINE_GAP_MS` and all the spoken lines in `LINES` | `js/coach.js` |
| Camera size, `FACE_EVERY_N_FRAMES`, the mic's voice filter | `js/camera.js` |
| Text-size range | `js/main.js` |
| Allowed reading ranges | `js/readings.js` |

All the coaching wording, the `reason` sentences in `checks.js` and the `LINES` in `coach.js`, is marked `// TEAM TUNES THIS wording`. Rewrite it in your own words.

---

## 8. The session log (for your study)

"Export session results" downloads a file like `cuffcheck-session-2026-10-20-15-04.json` (your local date and time). It covers the most recent check session:

```json
{
  "app": "CuffCheck",
  "started": "2026-10-20T19:04:12.000Z",
  "settings": { "cuffArm": "left", "camera": "environment", "demoMode": true, "microphone": true },
  "seconds": [
    { "t": 0, "phase": "resting", "checks": { "framing": "pass", "arm": "fail", "...": "..." },
      "values": { "arm": 0.14, "...": "..." } }
  ],
  "reading": { "systolic": 118, "diastolic": 76, "pulse": 64, "verified": true, "failedChecks": [] }
}
```

It holds one entry per second: each check's status and the number behind it. No video, no images, no body points. Use these files to:

- count false alarms: rows that went red while the person was sitting correctly;
- pick thresholds from real numbers;
- measure the posture model on your own side-view sessions. The README asks for those numbers.

The log lives in memory only. It disappears if you reload the page, so export right after each session.

---

## 9. Known limits: watch for these while testing

- **Cuff pump vs microphone.** Some pumps are loud enough to trip the talking check during the reading, which would make every reading "Not verified". The mic has noise suppression and a voice-range filter, but test it with your real cuff. If it trips, raise `VOICE_LEVEL_LIMIT` or turn the mic option off.
- **Face at 2 m.** The face model is built for faces near the camera. From across the room in profile it may not find the face. Then talking relies on the mic alone. If both the face and the mic are missing, talking stays "can't see" and nothing can be Verified.
- **Pure side view hides one leg.** The legs rule needs a slight turn. The posture model can decide alone, but it was trained on front views.
- **Raised heels** are not detected.
- **Posture model.** Trained on 13 people filmed from the front with MediaPipe's heavy model; we use the lite model from the side. Its scores in the README come from the dataset, not from us. Re-test before trusting it.
- **Front camera vs back camera.** The front camera is mirrored on screen only. The checks always use your real left and right.
- **Battery and heat.** Pose plus face models on every frame is heavy. If an older phone gets slow, raise `FACE_EVERY_N_FRAMES`, or try `CAMERA_WIDTH` 480.

---

## 10. Where everything is

| File | What it does |
| --- | --- |
| `index.html` | The one page; each screen is a section that is shown or hidden |
| `style.css` | Plain styles: white, black, one blue, big buttons; print rules for the report |
| `js/main.js` | Connects everything: screens, buttons, checklist, coach, text size |
| `js/camera.js` | Camera, MediaPipe Pose and Face, microphone level, skeleton drawing |
| `js/checks.js` | One pure function per check, plus every threshold |
| `js/engine.js` | Runs the checks, smooths, rest timer, phases, Verified |
| `js/coach.js` | Picks and speaks one message at a time |
| `js/readings.js` | Reading form, safety levels, history, report, storage |
| `js/sessionLog.js` | The per-second study log and its download |
| `js/model.js` | Runs the posture model; converts world points to the dataset's format |
| `model/posture_model.json` | The trained weights, plus test numbers and one check example |
| `training/train.py` | Trains the model on MultiPosture, split by person |
| `tests/` | `node --test`: checks, engine/coach/readings, model conversion |
| `AI_USAGE.md` | What Claude generated and what we did. Fill in the blanks |

To retrain the model, download `data.csv` from https://zenodo.org/records/14230872 into `training/`, then run `python3 training/train.py training/data.csv`. Steps are in `training/README.md`. The CSV is in `.gitignore`, so it won't be committed.

---

## 11. Before we submit (code freeze Saturday, Oct 24)

- [ ] Every test in section 5 done on an iPhone and an Android phone, with results written down
- [ ] Thresholds tuned from real numbers, and each change written in AI_USAGE.md
- [ ] Coaching wording rewritten in our own words
- [ ] Posture model re-tested on our own exported sessions; numbers added to the README
- [ ] AI_USAGE.md blanks filled in for every milestone
- [ ] README: team names and the date coding was completed
- [ ] Demo mode is off by default (it is, but check after any edits)
- [ ] `node --test` passes
- [ ] Final `git push`, and the GitHub Pages link opens on a phone
- [ ] Each of us can explain every file in this table in our own words
