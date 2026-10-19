// checks.js - one pure function per guideline check. No DOM code here, so
// every check can be tested in node with fake landmark data.
//
// Every check takes the 33 pose landmarks (or null when nobody is seen) and
// returns { status: "pass" | "fail" | "unseen", reason }. A check answers
// "unseen" whenever the points it needs are not visible. It never guesses.

export const MIN_VISIBILITY = 0.5; // TEAM TUNES THIS - a point below this counts as "not seen"

// Landmark numbers from MediaPipe Pose. "LEFT" means the person's own left
// side, not the left of the screen. (The front-camera mirror is only CSS,
// so it does not change these numbers.)
export const POINT = {
  NOSE: 0,
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,    RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,    RIGHT_WRIST: 16,
  LEFT_HIP: 23,      RIGHT_HIP: 24,
  LEFT_KNEE: 25,     RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,    RIGHT_ANKLE: 28,
};

// True when MediaPipe is confident enough that this point is really visible.
export function isSeen(point) {
  return Boolean(point) && point.visibility >= MIN_VISIBILITY;
}

// Framing: the session cannot start until shoulders, hips, the elbow of the
// cuffed arm and both knees are all in the picture. cuffArm is "left" or "right".
export function checkFraming(landmarks, cuffArm) {
  if (!landmarks) {
    return { status: "unseen", reason: "Nobody is in the picture yet." };
  }
  const cuffElbow = cuffArm === "right" ? POINT.RIGHT_ELBOW : POINT.LEFT_ELBOW;
  const needed = [
    ["shoulders", [POINT.LEFT_SHOULDER, POINT.RIGHT_SHOULDER]],
    ["hips", [POINT.LEFT_HIP, POINT.RIGHT_HIP]],
    ["cuff-arm elbow", [cuffElbow]],
    ["knees", [POINT.LEFT_KNEE, POINT.RIGHT_KNEE]],
  ];
  const missing = [];
  for (const [name, ids] of needed) {
    if (!ids.every((i) => isSeen(landmarks[i]))) missing.push(name);
  }
  if (missing.length === 0) {
    return { status: "pass", reason: "Whole body is in the picture." };
  }
  // TEAM TUNES THIS wording
  return {
    status: "fail",
    reason: "Move back or tilt the camera so I can see your " + joinWords(missing) + ".",
  };
}

// ["a", "b", "c"] -> "a, b and c"
function joinWords(words) {
  if (words.length <= 1) return words.join("");
  return words.slice(0, -1).join(", ") + " and " + words[words.length - 1];
}
