# Training the posture model

`train.py` trains the two small models CuffCheck uses in the browser and saves them to `model/posture_model.json`.

## Dataset

MultiPosture dataset, Zenodo record 14230872, CC BY 4.0 (Carneros-Prado et al., 2024). Download `data.csv` (about 9 MB) from https://zenodo.org/records/14230872 into this `training/` folder. Do not commit it; the app only needs the small JSON file the script produces.

What is really in the CSV, checked by reading it:

- 4,794 frames from 13 people (`subject` 1 to 13).
- `upperbody_label`: TUP upright, TLB leaning back, TLF forward, TLL left, TLR right.
- `lowerbody_label`: LAP apart, LWA wide apart, LCS closed, LCR crossed right over left, LCL crossed left over right, LLR lateral right, LLL lateral left.
- All 33 MediaPipe joints as `nose_x, nose_y, nose_z ... right_foot_index_z`. The dataset description says 11 joints; the file has 33. We use 11 of them: nose, shoulders, elbows, hips, knees, ankles.

## How the dataset differs from what the browser gives us

1. **World landmarks, not screen landmarks.** The coordinates are MediaPipe *world* landmarks: meters, with the origin at the middle of the hips. The checks in `js/checks.js` use screen landmarks (fractions of the picture). The model therefore uses `worldLandmarks` from `js/camera.js`.
2. **Filmed from the front.** In almost every frame the hip line points along x, which means the people faced the camera. CuffCheck films from the side. `toModelInput()` in `js/model.js` and `to_model_input()` here turn every body so its hips point along x before the model sees it.
3. **Heavy model vs. lite model.** The dataset was made with MediaPipe Pose Heavy; the app uses Pose Lite, which is noisier, especially for depth.
4. **Body size.** Both sides divide by torso length so tall and short people look alike.

`tests/model.test.js` checks that the JavaScript conversion gives the same numbers as this Python script, using a frame the script saves into the JSON.

## Run it

```
pip3 install pandas scikit-learn
python3 training/train.py training/data.csv
```

## Split

The CSV has a `subject` column, so we split **by person**: 30% of the people (4 of 13, chosen with a fixed random seed) are held out and never seen in training. The script also reports leave-one-person-out accuracy, which trains 13 times, each time testing on one unseen person.

"Positive" means the mistake: leaning for the trunk model, crossed for the legs model. Sensitivity is the share of mistakes caught. Specificity is the share of correct postures left alone.

## Honest limits

These numbers come from other people, filmed from the front, in their homes, with a better pose model. Our users are filmed from the side with the lite model. The numbers say the model can learn these postures; they do not say how well it works in CuffCheck. We must re-test on our own recorded sessions (the Export session results button) before trusting it.
