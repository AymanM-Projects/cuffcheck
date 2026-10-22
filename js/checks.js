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
export const HIP_ANGLE_MAX = 140;        // TEAM TUNES THIS - leaning back on a chair opens the hip past 120
export const BACK_FORWARD_LIMIT = 15;    // TEAM TUNES THIS - degrees forward that means the back left the chair
export const BACK_RECLINE_LIMIT = 40;    // TEAM TUNES THIS - degrees back that is too far reclined
export const BACK_MIN_SAMPLES = 15;      // TEAM TUNES THIS - frames needed before judging (under 1 s)
export const MODEL_UPRIGHT_MIN = 0.15;   // TEAM TUNES THIS - below this the model is sure the trunk is NOT upright
export const FACING_SHOULDER_RATIO = 0.7; // TEAM TUNES THIS - shoulders wider than this (torso lengths) = facing the camera
export const FACING_THIGH_RATIO = 0.4;   // TEAM TUNES THIS - thighs shorter than this (torso lengths) = pointing at the camera
export const TOO_FAR_TORSO = 0.12;       // TEAM TUNES THIS - torso shorter than this share of the picture height = too far
export const TOO_CLOSE_TORSO = 0.45;     // TEAM TUNES THIS - torso taller than this share = too close
export const EDGE_MARGIN = 0.02;         // a hidden point this near the edge counts as cut off
export const MODEL_CROSSED_MAX = 0.85;   // TEAM TUNES THIS - the model alone fails legs only when this sure
export const SURE_VISIBILITY = 0.8;      // TEAM TUNES THIS - a point must be this clearly seen to count as proof of a mistake
export const CROSS_MIN_GAP = 0.06;       // TEAM TUNES THIS - closer than this = can't tell left from right
export const SIDE_VIEW_RATIO = 0.35;     // TEAM TUNES THIS - shoulders narrower than this (torso lengths) = side view
export const KNEE_LEVEL_LIMIT = 0.2;     // TEAM TUNES THIS - knee heights this far apart (torso lengths) = knee over knee
export const ANKLE_RAISED_LIMIT = 0.15;  // TEAM TUNES THIS - an ankle this close to knee height = ankle over knee
export const FEET_MIN_DROP = 0.3;        // TEAM TUNES THIS - an ankle must sit this far below its knee (torso lengths)
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

// ---- Framing: the right distance, a side view with the cuffed arm toward the
// camera, and shoulders, hips, cuffed elbow, knees and a foot all visible.
// Each failure says exactly what to move and which way.
// aspect = picture width / height, so x runs from 0 to aspect.
export function checkFraming(landmarks, cuffArm, aspect = 4 / 3) {
  // TEAM TUNES THIS wording (all messages below)
  if (!landmarks) return unseen("I can't see anyone yet. Sit in the chair with your side to the camera, about 2 meters (6 feet) away.");
  const torso = torsoLength(landmarks);
  const size = torso === null ? null : round2(torso);
  if (torso !== null && torso < TOO_FAR_TORSO) {
    return fail("You're too far from the camera. Move it about 1 meter (3 feet) closer to you.", size);
  }
  if (torso !== null && torso > TOO_CLOSE_TORSO) {
    return fail("You're too close to the camera. Move it about 1 meter (3 feet) farther away.", size);
  }
  if (facesCamera(landmarks)) {
    return fail(`You're facing the camera. Turn your chair sideways so your ${cuffArm} side, with the cuff, faces the camera.`, size);
  }

  const right = cuffArm === "right";
  const cuffElbow = right ? POINT.RIGHT_ELBOW : POINT.LEFT_ELBOW;
  // Only the cuffed side, which faces the camera. The far side hides behind
  // the body in a side view, so it is never required.
  const needed = [
    ["shoulder", [right ? POINT.RIGHT_SHOULDER : POINT.LEFT_SHOULDER], "all"],
    ["hip", [right ? POINT.RIGHT_HIP : POINT.LEFT_HIP], "all"],
    ["cuffed elbow", [cuffElbow], "all"],
    ["knee", [right ? POINT.RIGHT_KNEE : POINT.LEFT_KNEE], "all"],
    ["feet", [POINT.LEFT_ANKLE, POINT.RIGHT_ANKLE], "any"],
  ];
  const missingParts = needed.filter(([, ids, rule]) =>
    rule === "all" ? !ids.every((i) => seen(landmarks, i)) : !ids.some((i) => seen(landmarks, i)));
  if (missingParts.length === 0) return pass("Whole body is in the picture, seen from the side.", size);

  const missing = missingParts.map(([name]) => name);
  const missingIds = missingParts.flatMap(([, ids]) => ids);
  if (cuffArmIsFar(landmarks, right)) {
    return fail(`Your cuffed arm is on the far side. Turn around so your ${cuffArm} arm faces the camera.`, size);
  }
  const edges = cutOffEdges(landmarks, missingIds, aspect);
  if (edges.top && edges.bottom) {
    return fail("You're too close to the camera. Move it about 1 meter (3 feet) farther away.", size);
  }
  if (edges.bottom) {
    return fail("I can't see your " + joinWords(missing) + ". Tilt the camera down a little, or move it about half a meter (2 feet) back.", size);
  }
  if (edges.top) {
    return fail("I can't see your " + joinWords(missing) + ". Tilt the camera up a little, or move it about half a meter (2 feet) back.", size);
  }
  if (edges.side) {
    return fail("You're at the edge of the picture. Move the camera so you're in the middle.", size);
  }
  return fail("I can't see your " + joinWords(missing) + ". Make sure nothing, like a table, is blocking the camera's view of them.", size);
}

// Length of the shoulder-to-hip line, as a share of the picture height.
// Uses whichever side is visible. null if neither side is.
export function torsoLength(landmarks) {
  const shoulder = seen(landmarks, POINT.LEFT_SHOULDER) || seen(landmarks, POINT.RIGHT_SHOULDER);
  const hip = seen(landmarks, POINT.LEFT_HIP) || seen(landmarks, POINT.RIGHT_HIP);
  if (!shoulder || !hip) return null;
  return Math.hypot(hip.x - shoulder.x, hip.y - shoulder.y);
}

// True when the person faces the camera instead of showing their side: the
// shoulders look wide, or the thighs point at the lens and look short.
// The angle checks are meaningless from the front, so they stay "unseen".
export function facesCamera(landmarks) {
  const ls = seen(landmarks, POINT.LEFT_SHOULDER), rs = seen(landmarks, POINT.RIGHT_SHOULDER);
  const lh = seen(landmarks, POINT.LEFT_HIP), rh = seen(landmarks, POINT.RIGHT_HIP);
  if (!ls || !rs || !lh || !rh) return false;
  const torso = Math.hypot((lh.x + rh.x - ls.x - rs.x) / 2, (lh.y + rh.y - ls.y - rs.y) / 2);
  if (torso === 0) return false;
  const thighs = [[lh, seen(landmarks, POINT.LEFT_KNEE)], [rh, seen(landmarks, POINT.RIGHT_KNEE)]]
    .filter(([, knee]) => knee)
    .map(([hip, knee]) => Math.hypot(knee.x - hip.x, knee.y - hip.y) / torso);
  const shoulderWidth = Math.abs(ls.x - rs.x) / torso;
  return shoulderWidth > FACING_SHOULDER_RATIO || (thighs.length > 0 && Math.max(...thighs) < FACING_THIGH_RATIO);
}

// True when the camera sees the person's side: the shoulders look narrow, or
// one shoulder is hidden behind the body. Left/right order means little then.
export function sideView(landmarks) {
  const torso = torsoLength(landmarks);
  if (!torso) return false;
  const ls = seen(landmarks, POINT.LEFT_SHOULDER), rs = seen(landmarks, POINT.RIGHT_SHOULDER);
  if (!ls || !rs) return true;
  return Math.abs(ls.x - rs.x) / torso < SIDE_VIEW_RATIO;
}

// True when the cuffed shoulder is farther from the camera than the other one
// (MediaPipe's z: smaller = closer), i.e. the person sits the wrong way round.
function cuffArmIsFar(landmarks, right) {
  const cuff = landmarks[right ? POINT.RIGHT_SHOULDER : POINT.LEFT_SHOULDER];
  const other = landmarks[right ? POINT.LEFT_SHOULDER : POINT.RIGHT_SHOULDER];
  return Boolean(cuff && other) && typeof cuff.z === "number" && cuff.z > other.z;
}

// Which picture edges the hidden points fall past. MediaPipe still guesses
// where a hidden point is, and for a cut-off body part that guess is off-screen.
function cutOffEdges(landmarks, ids, aspect) {
  const edges = { top: false, bottom: false, side: false };
  for (const i of ids) {
    const p = landmarks[i];
    if (!p || isSeen(p)) continue;
    if (p.y > 1 - EDGE_MARGIN) edges.bottom = true;
    else if (p.y < EDGE_MARGIN) edges.top = true;
    else if (p.x < EDGE_MARGIN || p.x > aspect - EDGE_MARGIN) edges.side = true;
  }
  return edges;
}

// ---- Seated upright: the shoulder-hip-knee angle is near a right angle ----
export function checkSeatedUpright(landmarks) {
  if (facesCamera(landmarks)) return unseen("Turn sideways so I can see how you're sitting.");
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
  if (hipAngle < HIP_ANGLE_MIN) return fail("You're bent forward. Sit up tall with your back against the chair.", hipAngle);
  if (hipAngle > HIP_ANGLE_MAX) return fail("You're slumped down. Slide your hips all the way back in the seat and sit up.", hipAngle);
  return pass("Sitting upright.", hipAngle);
}

// ---- Back supported: over the last few seconds the trunk is not leaning
// forward (away from the chair back) or reclined too far. leanAngles come from
// the engine; the median ignores the odd jittery frame.
// A back resting on a chair leans BACK a little, and that must pass. The
// posture model was trained to call any lean, back included, "not upright",
// so it only gets a say when the trunk is not leaning back.
export function checkBackSupported(leanAngles, uprightChance = null) {
  if (leanAngles.length < BACK_MIN_SAMPLES) return unseen("Hold still for a moment.");
  const lean = Math.round(median(leanAngles));
  // TEAM TUNES THIS wording
  if (lean > BACK_FORWARD_LIMIT) return fail("You're leaning forward. Sit back until your back touches the chair.", lean);
  if (lean < -BACK_RECLINE_LIMIT) return fail("You're leaning too far back. Sit up a little, keeping your back on the chair.", lean);
  if (uprightChance !== null && uprightChance < MODEL_UPRIGHT_MIN && lean >= 0) {
    return fail("Sit up straight against the chair, without leaning forward or to the side.", round2(uprightChance));
  }
  return pass("Back is resting against the chair.", lean);
}

// How far the hip-to-shoulder line leans from straight up, in degrees.
// Positive = leaning forward (toward the knees), negative = leaning back.
// Uses the side nearest the camera, which MediaPipe sees best; the hidden
// far side is often a poor guess. null if it can't be measured.
export function trunkLeanAngle(landmarks) {
  if (!landmarks || facesCamera(landmarks)) return null;
  const sides = [
    [POINT.LEFT_SHOULDER, POINT.LEFT_HIP, POINT.LEFT_KNEE],
    [POINT.RIGHT_SHOULDER, POINT.RIGHT_HIP, POINT.RIGHT_KNEE],
  ];
  let best = null;
  for (const [s, h, k] of sides) {
    const shoulder = seen(landmarks, s), hip = seen(landmarks, h);
    if (!shoulder || !hip) continue;
    const score = Math.min(shoulder.visibility, hip.visibility);
    if (!best || score > best.score) best = { shoulder, hip, knee: seen(landmarks, k), score };
  }
  if (!best) return null;
  // "Forward" is the way the knees point; if no knee is seen, the way the nose points.
  const knee = best.knee || seen(landmarks, POINT.LEFT_KNEE) || seen(landmarks, POINT.RIGHT_KNEE);
  const nose = seen(landmarks, POINT.NOSE);
  const ahead = knee ? knee.x - best.hip.x : nose ? nose.x - best.shoulder.x : 0;
  if (ahead === 0) return null;
  const dx = (best.shoulder.x - best.hip.x) * Math.sign(ahead);
  const dy = best.hip.y - best.shoulder.y; // positive when the shoulder is above the hip (y grows downward)
  return Math.atan2(dx, dy) * 180 / Math.PI;
}

// ---- Legs uncrossed: only a clearly seen sign of crossing fails. MediaPipe
// still guesses where a hidden leg is, and those guesses must never count.
// Side view: a knee or ankle lifted onto the other leg. Angled or front view:
// left/right order swapping between hips, knees and ankles. The posture model
// (trained on front views) can fail it alone only when it is very sure.
export function checkLegsUncrossed(landmarks, crossedChance = null) {
  const torso = torsoLength(landmarks);
  if (!torso || !(seen(landmarks, POINT.LEFT_KNEE) || seen(landmarks, POINT.RIGHT_KNEE))) {
    return unseen("I can't see your knees.");
  }
  const ruleSaysCrossed = sideView(landmarks) ? legLifted(landmarks, torso) : orderSwapped(landmarks);
  const modelSaysCrossed = crossedChance !== null && crossedChance > MODEL_CROSSED_MAX;
  const value = crossedChance === null ? null : round2(crossedChance);
  // TEAM TUNES THIS wording
  if (ruleSaysCrossed || modelSaysCrossed) return fail("Uncross your legs.", value);
  return pass("Legs look uncrossed.", value);
}

// The landmark only if it is CLEARLY seen (proof, not a guess).
function sure(landmarks, index) {
  const point = landmarks ? landmarks[index] : null;
  return point && point.visibility >= SURE_VISIBILITY ? point : null;
}

// Side view: one knee clearly higher than the other, or an ankle up near knee height.
function legLifted(landmarks, torso) {
  const lk = sure(landmarks, POINT.LEFT_KNEE), rk = sure(landmarks, POINT.RIGHT_KNEE);
  if (lk && rk && Math.abs(lk.y - rk.y) / torso > KNEE_LEVEL_LIMIT) return true;
  for (const [k, a] of [[POINT.LEFT_KNEE, POINT.LEFT_ANKLE], [POINT.RIGHT_KNEE, POINT.RIGHT_ANKLE]]) {
    const knee = sure(landmarks, k), ankle = sure(landmarks, a);
    if (knee && ankle && (ankle.y - knee.y) / torso < ANKLE_RAISED_LIMIT) return true;
  }
  return false;
}

// Angled or front view: crossed legs swap left/right order between hips, knees and ankles.
function orderSwapped(landmarks) {
  const pairs = [
    [POINT.LEFT_HIP, POINT.RIGHT_HIP], [POINT.LEFT_KNEE, POINT.RIGHT_KNEE], [POINT.LEFT_ANKLE, POINT.RIGHT_ANKLE],
  ];
  const orders = pairs
    .map(([l, r]) => {
      const left = sure(landmarks, l), right = sure(landmarks, r);
      return left && right ? sideOrder(left, right) : 0;
    })
    .filter((order) => order !== 0);
  return orders.some((order) => order !== orders[0]);
}

// +1 or -1 for which side the left point is on, 0 if too close to tell.
function sideOrder(leftPoint, rightPoint) {
  const gap = leftPoint.x - rightPoint.x;
  if (Math.abs(gap) < CROSS_MIN_GAP) return 0;
  return gap > 0 ? 1 : -1;
}

// ---- Feet flat: the ankle sits well below the knee, measured in torso
// lengths so distance from the camera doesn't matter. Judges the most visible
// leg; the other leg counts only if it is clearly seen.
export function checkFeetFlat(landmarks) {
  const torso = torsoLength(landmarks);
  const legs = [[POINT.LEFT_KNEE, POINT.LEFT_ANKLE], [POINT.RIGHT_KNEE, POINT.RIGHT_ANKLE]]
    .map(([k, a]) => ({ knee: seen(landmarks, k), ankle: seen(landmarks, a) }))
    .filter((leg) => leg.knee && leg.ankle);
  if (!torso || legs.length === 0) return unseen("I can't see your ankles.");
  const clarity = (leg) => Math.min(leg.knee.visibility, leg.ankle.visibility);
  const nearest = legs.reduce((best, leg) => (clarity(leg) > clarity(best) ? leg : best));
  const judged = legs.filter((leg) => leg === nearest || clarity(leg) >= SURE_VISIBILITY);
  const lowest = round2(Math.min(...judged.map((leg) => (leg.ankle.y - leg.knee.y) / torso)));
  // TEAM TUNES THIS wording
  if (lowest < FEET_MIN_DROP) return fail("Put your feet flat on the floor.", lowest);
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
  if (!shoulder || !elbow || !hip) {
    return unseen(`I can't see your cuffed arm. Your ${right ? "right" : "left"} side should face the camera.`);
  }
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

function median(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// ["a", "b", "c"] -> "a, b and c"
function joinWords(words) {
  if (words.length <= 1) return words.join("");
  return words.slice(0, -1).join(", ") + " and " + words[words.length - 1];
}
