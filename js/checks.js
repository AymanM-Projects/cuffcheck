// checks.js - one pure function per guideline check. No DOM code here, so
// every check can be tested in node with fake landmark data.
//
// Every check returns { status: "pass" | "fail" | "unseen", reason, value }.
// "unseen" means the points it needs are not visible. It never guesses.
// value is the number behind the decision ("Show numbers for tuning").
// x arrives already scaled to the same units as y (camera.js does this), so
// angles match the picture. The rules assume a side view of the person.

export const MIN_VISIBILITY = 0.5;       // TEAM TUNES THIS - a point below this counts as "not seen"
export const HIP_ANGLE_MIN = 70;         // TEAM TUNES THIS - degrees at the hip (shoulder-hip-knee)
export const HIP_ANGLE_MAX = 120;        // TEAM TUNES THIS
export const BACK_LEAN_LIMIT = 20;       // TEAM TUNES THIS - degrees from vertical the trunk may lean
export const BACK_STEADY_LIMIT = 4;      // TEAM TUNES THIS - degrees of wobble allowed
export const BACK_MIN_SAMPLES = 30;      // TEAM TUNES THIS - frames needed before judging (about 1.5 s)
export const MODEL_UPRIGHT_MIN = 0.5;    // TEAM TUNES THIS - model must be this sure the trunk is upright
export const MODEL_CROSSED_MAX = 0.5;    // TEAM TUNES THIS - above this the model says legs are crossed
export const CROSS_MIN_GAP = 0.03;       // TEAM TUNES THIS - closer than this = can't tell left from right
export const FEET_MIN_DROP = 0.05;       // TEAM TUNES THIS - an ankle must sit this far below its knee
export const CUFF_RATIO = 0.6;           // TEAM TUNES THIS - cuff centre: 0 = shoulder, 1 = elbow
export const HEART_RATIO = 0.25;         // TEAM TUNES THIS - mid-chest: 0 = shoulder, 1 = hip
export const HEART_TOLERANCE = 0.1;      // TEAM TUNES THIS - allowed gap, in torso lengths
export const STILL_LIMIT = 0.08;         // TEAM TUNES THIS - movement (torso lengths in 1 s) that still counts as resting
export const MOVE_LIMIT = 0.25;          // TEAM TUNES THIS - movement this big restarts the rest timer
export const MOUTH_MOVE_LIMIT = 0.05;    // TEAM TUNES THIS - wobble in the jaw-open score that means talking
export const VOICE_LEVEL_LIMIT = 0.02;   // TEAM TUNES THIS - microphone level that counts as sound
export const VOICE_FRACTION_LIMIT = 0.3; // TEAM TUNES THIS - share of the last 2 s that is loud = talking
export const TALK_MIN_SAMPLES = 10;      // samples needed before the talking check will judge

// MediaPipe Pose landmark numbers. LEFT = the person's own left side.
export const POINT = {
  NOSE: 0,
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,    RIGHT_ELBOW: 14,
  LEFT_HIP: 23,      RIGHT_HIP: 24,
  LEFT_KNEE: 25,     RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,    RIGHT_ANKLE: 28,
};

// True when MediaPipe is confident enough that this point is really visible.
export function isSeen(point) {
  return Boolean(point) && point.visibility >= MIN_VISIBILITY;
}

// The landmark with this number, or null if it is not visible.
function seen(landmarks, index) {
  const point = landmarks ? landmarks[index] : null;
  return isSeen(point) ? point : null;
}

const pass = (reason, value = null) => ({ status: "pass", reason, value });
const fail = (reason, value = null) => ({ status: "fail", reason, value });
const unseen = (reason) => ({ status: "unseen", reason, value: null });

// ---- Framing: shoulders, hips, cuffed elbow and knees must all be visible ----
export function checkFraming(landmarks, cuffArm) {
  if (!landmarks) return unseen("Nobody is in the picture yet.");
  const cuffElbow = cuffArm === "right" ? POINT.RIGHT_ELBOW : POINT.LEFT_ELBOW;
  const needed = [
    ["shoulders", [POINT.LEFT_SHOULDER, POINT.RIGHT_SHOULDER]],
    ["hips", [POINT.LEFT_HIP, POINT.RIGHT_HIP]],
    ["cuff-arm elbow", [cuffElbow]],
    ["knees", [POINT.LEFT_KNEE, POINT.RIGHT_KNEE]],
  ];
  const missing = needed.filter(([, ids]) => !ids.every((i) => seen(landmarks, i))).map(([name]) => name);
  if (missing.length === 0) return pass("Whole body is in the picture.");
  // TEAM TUNES THIS wording
  return fail("Move back or tilt the camera so I can see your " + joinWords(missing) + ".");
}

// ---- Seated upright: the shoulder-hip-knee angle is near a right angle ----
export function checkSeatedUpright(landmarks) {
  const sides = [
    [POINT.LEFT_SHOULDER, POINT.LEFT_HIP, POINT.LEFT_KNEE],
    [POINT.RIGHT_SHOULDER, POINT.RIGHT_HIP, POINT.RIGHT_KNEE],
  ];
  const angles = [];
  for (const [s, h, k] of sides) {
    const shoulder = seen(landmarks, s), hip = seen(landmarks, h), knee = seen(landmarks, k);
    if (shoulder && hip && knee) angles.push(angleAt(shoulder, hip, knee));
  }
  if (angles.length === 0) return unseen("I can't see your shoulder, hip and knee on one side.");
  const hipAngle = Math.round(average(angles));
  // TEAM TUNES THIS wording
  if (hipAngle < HIP_ANGLE_MIN) return fail("You're bent forward. Sit up straight.", hipAngle);
  if (hipAngle > HIP_ANGLE_MAX) return fail("You're slumped or reclining. Sit upright in the chair.", hipAngle);
  return pass("Sitting upright.", hipAngle);
}

// ---- Back supported: trunk near vertical, steady for the last 10 s, and the
// posture model (if loaded) agrees it is upright. leanAngles come from the engine.
export function checkBackSupported(leanAngles, uprightChance = null) {
  if (leanAngles.length < BACK_MIN_SAMPLES) return unseen("Hold still for a moment.");
  const mean = average(leanAngles);
  const wobble = spread(leanAngles);
  // TEAM TUNES THIS wording
  if (mean > BACK_LEAN_LIMIT) return fail("Sit back against the chair.", Math.round(mean));
  if (wobble > BACK_STEADY_LIMIT) return fail("Keep your back still against the chair.", Math.round(mean));
  if (uprightChance !== null && uprightChance < MODEL_UPRIGHT_MIN) {
    return fail("Sit back against the chair.", round2(uprightChance));
  }
  return pass("Back is steady against the chair.", Math.round(mean));
}

// How far the hip-to-shoulder line leans from straight up, in degrees.
export function trunkLeanAngle(landmarks) {
  const sides = [[POINT.LEFT_SHOULDER, POINT.LEFT_HIP], [POINT.RIGHT_SHOULDER, POINT.RIGHT_HIP]];
  const angles = [];
  for (const [s, h] of sides) {
    const shoulder = seen(landmarks, s), hip = seen(landmarks, h);
    if (!shoulder || !hip) continue;
    const dx = shoulder.x - hip.x;
    const dy = hip.y - shoulder.y; // positive when the shoulder is above the hip (y grows downward)
    angles.push(Math.abs(Math.atan2(dx, dy)) * 180 / Math.PI);
  }
  return angles.length ? average(angles) : null;
}

// ---- Legs uncrossed: crossed legs swap left/right order between hips,
// knees and ankles. The posture model (if loaded) can also say "crossed".
// When the rule can't tell sides apart, a "not crossed" model answer passes.
export function checkLegsUncrossed(landmarks, crossedChance = null) {
  const leftKnee = seen(landmarks, POINT.LEFT_KNEE), rightKnee = seen(landmarks, POINT.RIGHT_KNEE);
  const leftAnkle = seen(landmarks, POINT.LEFT_ANKLE), rightAnkle = seen(landmarks, POINT.RIGHT_ANKLE);
  const leftHip = seen(landmarks, POINT.LEFT_HIP), rightHip = seen(landmarks, POINT.RIGHT_HIP);
  if (!leftKnee || !rightKnee) return unseen("I can't see both knees.");
  if (!leftAnkle || !rightAnkle) return unseen("I can't see both ankles.");

  const orders = [
    leftHip && rightHip ? sideOrder(leftHip, rightHip) : 0,
    sideOrder(leftKnee, rightKnee),
    sideOrder(leftAnkle, rightAnkle),
  ].filter((order) => order !== 0);
  const ruleSaysCrossed = orders.some((order) => order !== orders[0]);
  const modelSaysCrossed = crossedChance !== null && crossedChance > MODEL_CROSSED_MAX;
  const value = crossedChance === null ? null : round2(crossedChance);
  // TEAM TUNES THIS wording
  if (ruleSaysCrossed || modelSaysCrossed) return fail("Uncross your legs.", value);
  if (orders.length === 0 && crossedChance === null) {
    return unseen("Turn a little toward the camera so I can see both legs.");
  }
  return pass("Legs are uncrossed.", value);
}

// +1 or -1 for which side the left point is on, 0 if too close to tell.
function sideOrder(leftPoint, rightPoint) {
  const gap = leftPoint.x - rightPoint.x;
  if (Math.abs(gap) < CROSS_MIN_GAP) return 0;
  return gap > 0 ? 1 : -1;
}

// ---- Feet flat: each visible ankle sits clearly below its knee ----
export function checkFeetFlat(landmarks) {
  const legs = [[POINT.LEFT_KNEE, POINT.LEFT_ANKLE], [POINT.RIGHT_KNEE, POINT.RIGHT_ANKLE]];
  const drops = [];
  for (const [k, a] of legs) {
    const knee = seen(landmarks, k), ankle = seen(landmarks, a);
    if (knee && ankle) drops.push(ankle.y - knee.y); // positive = ankle below knee
  }
  if (drops.length === 0) return unseen("I can't see your ankles.");
  const lowest = round2(Math.min(...drops));
  // TEAM TUNES THIS wording
  if (lowest < FEET_MIN_DROP) return fail("Put both feet flat on the floor.", lowest);
  return pass("Feet are flat on the floor.", lowest);
}

// ---- Arm at heart level: the cuff point (part way down the upper arm) must
// be level with mid-chest, within HEART_TOLERANCE torso lengths. Only height
// matters: an arm resting forward on a table is fine.
export function checkArmAtHeart(landmarks, cuffArm) {
  const right = cuffArm === "right";
  const shoulder = seen(landmarks, right ? POINT.RIGHT_SHOULDER : POINT.LEFT_SHOULDER);
  const elbow = seen(landmarks, right ? POINT.RIGHT_ELBOW : POINT.LEFT_ELBOW);
  const hip = seen(landmarks, right ? POINT.RIGHT_HIP : POINT.LEFT_HIP) ||
              seen(landmarks, right ? POINT.LEFT_HIP : POINT.RIGHT_HIP);
  if (!shoulder || !elbow || !hip) return unseen("I can't see the shoulder and elbow of your cuffed arm.");
  const torso = Math.hypot(hip.x - shoulder.x, hip.y - shoulder.y);
  if (torso === 0) return unseen("I can't measure your torso.");
  const cuffY = shoulder.y + CUFF_RATIO * (elbow.y - shoulder.y);
  const heartY = shoulder.y + HEART_RATIO * (hip.y - shoulder.y);
  const offset = round2((cuffY - heartY) / torso); // positive = cuff is below the heart
  // TEAM TUNES THIS wording
  if (offset > HEART_TOLERANCE) return fail("Raise your arm a little. The cuff should be at heart level.", offset);
  if (offset < -HEART_TOLERANCE) return fail("Lower your arm a little. The cuff should be at heart level.", offset);
  return pass("Cuff is at heart level.", offset);
}

// ---- 5-minute rest: the engine keeps the timer, this decides the answer ----
export function checkRest(restSeconds, requiredSeconds, motion) {
  if (motion === null) return unseen("I can't see you, so the rest timer is paused.");
  if (restSeconds >= requiredSeconds) return pass("Rested and still.", Math.round(restSeconds));
  // TEAM TUNES THIS wording
  const result = fail("Keep resting quietly: " + formatTime(requiredSeconds - restSeconds) + " left.", Math.round(restSeconds));
  return { ...result, word: "Waiting" }; // not a mistake, so the row says "Waiting"
}

// New rest time after this frame: grows while still, pauses for small
// fidgets or when unseen, and starts over after a big movement.
export function nextRestSeconds(restSeconds, motion, dtSeconds) {
  if (motion === null) return restSeconds;
  if (motion >= MOVE_LIMIT) return 0;
  if (motion < STILL_LIMIT) return restSeconds + dtSeconds;
  return restSeconds;
}

// How much the body moved in the recent frames: the average range covered
// by shoulders, hips and knees, in torso lengths. null if nothing is seen.
export function motionAmount(recentBodies) {
  const latest = recentBodies[recentBodies.length - 1];
  const shoulder = seen(latest, POINT.LEFT_SHOULDER) || seen(latest, POINT.RIGHT_SHOULDER);
  const hip = seen(latest, POINT.LEFT_HIP) || seen(latest, POINT.RIGHT_HIP);
  if (!shoulder || !hip) return null;
  const torso = Math.hypot(hip.x - shoulder.x, hip.y - shoulder.y);
  const ranges = [];
  for (const index of [11, 12, 23, 24, 25, 26]) {
    const points = recentBodies.map((body) => seen(body, index)).filter(Boolean);
    if (points.length < 2) continue;
    const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
    ranges.push(Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)));
  }
  return ranges.length && torso > 0 ? round2(average(ranges) / torso) : null;
}

// ---- No talking: the mouth keeps opening and closing (Face Landmarker
// "jawOpen" score wobbles) OR the microphone hears voice-level sound.
export function checkNotTalking(jawValues, voiceLevels) {
  const mouthMove = jawValues.length >= TALK_MIN_SAMPLES ? spread(jawValues) : null;
  const loudShare = voiceLevels.length >= TALK_MIN_SAMPLES
    ? voiceLevels.filter((level) => level > VOICE_LEVEL_LIMIT).length / voiceLevels.length
    : null;
  if (mouthMove === null && loudShare === null) return unseen("I can't see your mouth or hear the room.");
  const value = round2(mouthMove ?? loudShare);
  const talking = (mouthMove !== null && mouthMove > MOUTH_MOVE_LIMIT) ||
                  (loudShare !== null && loudShare > VOICE_FRACTION_LIMIT);
  // TEAM TUNES THIS wording
  return talking ? fail("Please stay quiet.", value) : pass("Quiet.", value);
}

// ---- Small helpers ----

// Angle in degrees at point b, between the lines b->a and b->c.
export function angleAt(a, b, c) {
  const abx = a.x - b.x, aby = a.y - b.y, cbx = c.x - b.x, cby = c.y - b.y;
  const length = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (length === 0) return 0;
  const cosine = (abx * cbx + aby * cby) / length;
  return Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

function average(numbers) {
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

// Standard deviation: how much the numbers wobble around their average.
function spread(numbers) {
  const mean = average(numbers);
  return Math.sqrt(average(numbers.map((n) => (n - mean) ** 2)));
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// ["a", "b", "c"] -> "a, b and c"
function joinWords(words) {
  if (words.length <= 1) return words.join("");
  return words.slice(0, -1).join(", ") + " and " + words[words.length - 1];
}
