"""train.py - trains CuffCheck's two small posture models on MultiPosture.

Run from the project folder:
    python3 training/train.py training/data.csv

1. Loads data.csv and prints the real column names.
2. Converts each frame exactly like js/model.js toModelInput() does.
3. Splits by PERSON: the test people are never seen during training.
4. Trains two logistic regressions:
     upright - trunk upright (TUP) vs leaning (TLB, TLF, TLL, TLR)
     crossed - legs crossed (LCL, LCR) vs not crossed (everything else)
5. Prints accuracy, sensitivity and specificity on the test people.
6. Saves the weights to model/posture_model.json for the browser.

Dataset: MultiPosture dataset, Zenodo record 14230872, CC BY 4.0.
"""

import json
import sys
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupShuffleSplit, LeaveOneGroupOut
from sklearn.preprocessing import StandardScaler

# The 11 joints we use, same order as MODEL_JOINTS in js/model.js.
JOINTS = ["nose", "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
          "left_hip", "right_hip", "left_knee", "right_knee", "left_ankle", "right_ankle"]
L_SHOULDER, R_SHOULDER, L_HIP, R_HIP = 1, 2, 5, 6

TEST_SHARE = 0.3   # TEAM TUNES THIS - share of PEOPLE held out for testing
SEED = 42          # fixed so everyone gets the same split
OUTPUT = Path(__file__).resolve().parent.parent / "model" / "posture_model.json"


def to_model_input(points):
    """points: array (frames, 11, 3) of world landmarks. Same steps as js/model.js:
    center on the hips, turn so the hip line points along x, divide by torso length."""
    hip = (points[:, L_HIP] + points[:, R_HIP]) / 2
    moved = points - hip[:, None, :]
    hip_line = moved[:, L_HIP] - moved[:, R_HIP]
    angle = np.arctan2(hip_line[:, 2], hip_line[:, 0])
    cos, sin = np.cos(angle)[:, None], np.sin(angle)[:, None]
    x = moved[..., 0] * cos + moved[..., 2] * sin
    z = -moved[..., 0] * sin + moved[..., 2] * cos
    turned = np.stack([x, moved[..., 1], z], axis=-1)
    mid_shoulder = (turned[:, L_SHOULDER] + turned[:, R_SHOULDER]) / 2
    torso = np.linalg.norm(mid_shoulder, axis=1)
    torso[torso == 0] = 1
    return (turned / torso[:, None, None]).reshape(len(points), -1)


def rates(truth, guess):
    """Accuracy, sensitivity and specificity, where "positive" = the MISTAKE."""
    tp = int(np.sum(truth & guess)); tn = int(np.sum(~truth & ~guess))
    fp = int(np.sum(~truth & guess)); fn = int(np.sum(truth & ~guess))
    return {
        "accuracy": round((tp + tn) / len(truth), 3),
        "sensitivity": round(tp / (tp + fn), 3) if tp + fn else None,  # mistakes caught
        "specificity": round(tn / (tn + fp), 3) if tn + fp else None,  # correct posture left alone
    }


def fit(features, labels):
    scaler = StandardScaler().fit(features)
    # After turning, the hips' z is always 0, so those inputs never vary.
    # A scale of 1 keeps them harmless (and avoids dividing by ~0 in the browser).
    scaler.scale_[scaler.scale_ < 1e-6] = 1.0
    model = LogisticRegression(max_iter=2000, class_weight="balanced")
    model.fit(scaler.transform(features), labels)
    return scaler, model


def weights(scaler, model):
    return {"mean": scaler.mean_.round(8).tolist(), "scale": scaler.scale_.round(8).tolist(),
            "coef": model.coef_[0].round(6).tolist(), "intercept": round(float(model.intercept_[0]), 6)}


def main(csv_path):
    data = pd.read_csv(csv_path)
    print("Columns:", ", ".join(data.columns[:6]), "...", ", ".join(data.columns[-3:]))
    print(f"{len(data)} frames, {data.subject.nunique()} people, {len(data.columns)} columns")

    points = np.stack([data[[f"{j}_x", f"{j}_y", f"{j}_z"]].to_numpy() for j in JOINTS], axis=1)
    features = to_model_input(points)
    people = data.subject.to_numpy()
    tasks = {
        # name: (positive class = what the model outputs a chance for, mistake = which side is the mistake)
        "upright": (data.upperbody_label.eq("TUP").to_numpy(), False),
        "crossed": (data.lowerbody_label.isin(["LCL", "LCR"]).to_numpy(), True),
    }

    split = GroupShuffleSplit(n_splits=1, test_size=TEST_SHARE, random_state=SEED)
    train_rows, test_rows = next(split.split(features, groups=people))
    test_people = sorted(int(p) for p in set(people[test_rows]))
    print("Test people (never seen in training):", test_people)

    output = {"format": 1, "created": date.today().isoformat(),
              "dataset": "MultiPosture dataset, Zenodo record 14230872, CC BY 4.0",
              "joints": JOINTS, "input": "world landmarks, hip-centered, hip line turned to x, divided by torso length",
              "test_people": test_people, "metrics": {}, "models": {}}

    fitted = {}
    for name, (labels, positive_is_mistake) in tasks.items():
        scaler, model = fit(features[train_rows], labels[train_rows])
        fitted[name] = (scaler, model)
        guess = model.predict(scaler.transform(features[test_rows])).astype(bool)
        truth = labels[test_rows]
        mistake_truth = truth if positive_is_mistake else ~truth
        mistake_guess = guess if positive_is_mistake else ~guess
        test = rates(mistake_truth, mistake_guess)

        # A sturdier estimate: leave one person out, 13 times, and average.
        per_person = []
        for tr, te in LeaveOneGroupOut().split(features, groups=people):
            s, m = fit(features[tr], labels[tr])
            per_person.append(float(np.mean(m.predict(s.transform(features[te])) == labels[te])))
        loso = round(float(np.mean(per_person)), 3)

        print(f"\n{name}: test people accuracy {test['accuracy']}, "
              f"sensitivity {test['sensitivity']} (mistakes caught), specificity {test['specificity']}")
        print(f"{name}: leave-one-person-out accuracy {loso} "
              f"(worst person {min(per_person):.3f}, best {max(per_person):.3f})")
        output["metrics"][name] = {**test, "leave_one_person_out_accuracy": loso}
        output["models"][name] = weights(scaler, model)

    # One test frame with its expected outputs, so tests/model.test.js can
    # check that the JavaScript conversion gives exactly the same numbers.
    row = test_rows[0]
    example = {"joints_xyz": points[row].round(6).tolist(), "features": features[row].round(6).tolist()}
    for name, (scaler, model) in fitted.items():
        example[name] = round(float(model.predict_proba(scaler.transform(features[row:row + 1]))[0, 1]), 6)
    output["check_example"] = example

    OUTPUT.write_text(json.dumps(output, indent=1))
    print("\nSaved", OUTPUT)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "training/data.csv")
