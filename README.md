# CuffCheck

CuffCheck uses your phone camera to watch you take your own blood pressure at home and checks, live, that you are doing it correctly. Readings taken with correct technique get a **Verified** badge, and your report averages only those. CuffCheck does not measure blood pressure; your own cuff does that, and your clinician makes every treatment decision.

Built by two high school students for the 2026 Congressional App Challenge (Virginia's 4th District).

**Try it:** https://aymanm-projects.github.io/cuffcheck/

## The problem

- Only 3% of patients measured their blood pressure at home without a single error; 60% made three or more errors. ([Nessler et al., BMC Cardiovascular Disorders, 2021](https://doi.org/10.1186/s12872-021-02351-5))
- An arm hanging unsupported at your side raised systolic readings by 6.5 mmHg on average, compared with an arm supported on a desk. ([Liu et al., ARMS trial, JAMA Internal Medicine, 2024](https://doi.org/10.1001/jamainternmed.2024.5213))
- Inaccurate self-measurement carries a risk of patients being over-prescribed excess or inappropriate medication. (Nessler et al., 2021, discussion)

Home monitors already check wrist height or movement. Nobody checks the whole body with a camera during a cuff reading. CuffCheck does.

## How to run it

**On a phone:** open the link above and allow the camera.

**On a laptop:** from this folder run

```
npx serve .
```

and open `http://localhost:3000`. Browsers treat `localhost` as secure, so the camera works without HTTPS.

**Tests:** `node --test` (33 tests: the checks, the engine, the coach, the reading rules, and the model conversion).

## How it works

```
camera  -> MediaPipe Pose + Face (in the browser) -> 33 body points, jaw-open score, mic level
        -> js/checks.js   one pure function per guideline: pass / fail / can't see
        -> js/engine.js   smooths ~1 s, runs the 5-minute rest timer, decides Verified
        -> js/coach.js    picks ONE message, shows it big and speaks it
        -> js/readings.js you type the cuff's numbers; history, report, safety screen
```

The eight checks: whole body in the picture, sitting upright, back against the chair, legs uncrossed, feet flat, cuff at heart level, rested 5 minutes, not talking. A check that cannot see the body parts it needs says "can't see"; it never guesses "pass". A reading is Verified only if every check passed for the whole time from "press start on your monitor" until the user enters the reading.

See [HOW_IT_WORKS.md](HOW_IT_WORKS.md) for a full walkthrough, test plan and tuning guide.

## The posture model

Two small logistic regressions (trunk upright vs leaning; legs crossed vs not) run in plain JavaScript in [js/model.js](js/model.js), with weights in [model/posture_model.json](model/posture_model.json). They are trained by [training/train.py](training/train.py).

- **Dataset:** MultiPosture dataset, Zenodo record 14230872, CC BY 4.0 (Carneros-Prado et al., 2024). 4,794 frames, 13 people.
- **Split:** by person. 4 of the 13 people (1, 9, 10, 12) are held out and never seen in training. The script also reports leave-one-person-out accuracy.
- **Format fix:** the dataset holds MediaPipe world landmarks filmed from the front; we film from the side. Both the Python and the JavaScript turn every body so its hips face the same way and divide by torso length. A test checks the two give identical numbers.

Results on the held-out people, from running `train.py` on Oct 19, 2026 ("positive" = the mistake):

| Model | Accuracy | Sensitivity (mistakes caught) | Specificity | Leave-one-person-out accuracy |
| --- | --- | --- | --- | --- |
| Trunk leaning | 0.915 | 0.876 | 0.982 | 0.939 |
| Legs crossed | 0.969 | 0.965 | 0.970 | 0.984 |

These people were filmed from the front with a more accurate pose model. The numbers do not yet say how well the model works from the side in CuffCheck; we are re-testing on our own sessions. _(Team: add your own-session numbers here.)_

## Privacy

All video processing happens in the browser. No video, images or sound are ever recorded, uploaded or saved. Only pass/fail results and the numbers you type are stored, in this browser's `localStorage`. There are no accounts, no analytics and no network calls except loading MediaPipe and its models. The "Export session results" file holds only per-second check results and the reading.

## Limitations

- It does not measure blood pressure and does not give medical advice.
- Camera angles vary. The rules assume a side view; a leg or arm the camera cannot see shows "can't see" and the reading cannot be Verified.
- Talking detection uses the microphone and mouth movement. A loud cuff pump may trip the microphone check, and the face may be too small to read from across the room.
- Feet flat checks that ankles sit below knees; it cannot see a raised heel.
- The posture model was trained on front-view data from 13 people.
- Thresholds are first guesses that we tune by testing; see HOW_IT_WORKS.md.

## AI disclosure

We used Claude (Anthropic) as a coding assistant. What it generated and what we did ourselves is listed milestone by milestone in [AI_USAGE.md](AI_USAGE.md).

## Team

_(Names.)_ Coding completed: _(date)_.
