# CuffCheck

CuffCheck uses your phone camera to watch you take your own blood pressure at home and checks, live, that you are doing it correctly. Readings taken with correct technique get a **Verified** badge. CuffCheck does not measure blood pressure; your own cuff does that.

Built by two high school students for the 2026 Congressional App Challenge (Virginia's 4th District).

> **Status:** Milestone 2 of 10. The app shows the camera with a live skeleton overlay, a checklist with gray / green / red dots, and the first check (whole body in the picture). The posture checks come next.

## The problem

_(Sources to be added by the team.)_

- In one study, only 3% of patients measured their blood pressure without error.
- An arm hanging at your side raises systolic pressure by about 7 mmHg.
- Wrong readings can lead doctors to change medication that did not need changing.

## How to run it

**On a phone:** open the GitHub Pages link: _(link to be added once published)_.

**On a laptop:** from this folder run

```
npx serve .
```

and open `http://localhost:3000`. Browsers treat `localhost` as secure, so the camera works without HTTPS.

## How it works

```
phone camera -> <video> -> MediaPipe Pose (in the browser) -> 33 body landmarks
                                                                    |
   skeleton overlay <-- js/camera.js <------------------------------+
   checklist dots   <-- js/main.js <-- js/engine.js (smooths ~1 s) <-- js/checks.js (one pure function per rule)
   (coach, readings and the posture model arrive in later milestones)
```

## Privacy

All video processing happens in the browser. No video or images are ever recorded, uploaded or saved. The only network requests are to load the MediaPipe library and its pose model.

## Dataset credit

MultiPosture dataset, Zenodo record 14230872, CC BY 4.0. _(Used from Milestone 9 on.)_

## Limitations

- CuffCheck does not measure blood pressure and does not give medical advice.
- Camera angles vary; a hidden leg or arm shows as "couldn't see", never as a pass.

## AI disclosure

See [AI_USAGE.md](AI_USAGE.md).

## Team

_(Names and the date coding was completed, to be added.)_
