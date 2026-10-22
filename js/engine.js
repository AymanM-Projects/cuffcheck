// engine.js - runs every check on each frame, smooths the answers so one bad
// frame cannot flip a dot, runs the rest timer, and decides "Verified".
//
// Phases: "setup" (camera on, not started) -> "resting" (after Start check,
// waiting for every check to pass) -> "measuring" (everything passed; the
// user presses start on their monitor). Verified = nothing slipped while measuring.

import {
  checkFraming, checkSeatedUpright, checkBackSupported, checkLegsUncrossed,
  checkFeetFlat, checkArmAtHeart, checkRest, checkNotTalking,
  trunkLeanAngle, motionAmount, nextRestSeconds,
} from "./checks.js";
import { postureChances } from "./model.js";

export const SMOOTH_FRAMES = 20;          // TEAM TUNES THIS - about 1 second of frames
export const BACK_WINDOW_MS = 4000;       // TEAM TUNES THIS - trunk-lean history for the back check
export const MOTION_WINDOW_MS = 1000;     // TEAM TUNES THIS - movement is measured over this time
export const TALK_WINDOW_MS = 2000;       // TEAM TUNES THIS - mouth and mic history for talking
export const REST_SECONDS = 300;          // 5 minutes, from the guidelines
export const DEMO_REST_SECONDS = 30;      // Demo mode only, for filming
export const MIN_READING_SECONDS = 20;    // TEAM TUNES THIS - a cuff reading takes at least this long

export const CHECK_IDS = ["framing", "seated", "back", "legs", "feet", "arm", "rest", "talking"];
export const CHECK_LABELS = {
  framing: "Whole body in the picture", seated: "Sitting upright", back: "Back against the chair",
  legs: "Legs uncrossed", feet: "Feet flat on the floor", arm: "Cuff at heart level",
  rest: "Rested 5 minutes", talking: "Not talking",
};

let state = freshState();

function freshState() {
  return {
    smoothing: new Map(),  // recent statuses per check, for the majority vote
    lean: [], bodies: [], jaw: [], voice: [], // { time, value } histories
    phase: "setup", demo: false, restSeconds: 0, requiredRest: REST_SECONDS,
    lastTime: null, measureStart: null, problems: new Set(),
  };
}

// Runs all checks on one frame. frame = { landmarks, worldLandmarks, jawOpen,
// micLevel, aspect }. now is a clock in ms; tests pass their own so they do not wait.
export function runChecks(frame, settings, now = Date.now()) {
  const landmarks = frame.landmarks;
  remember(state.lean, trunkLeanAngle(landmarks), now, BACK_WINDOW_MS);
  remember(state.bodies, landmarks, now, MOTION_WINDOW_MS);
  remember(state.jaw, frame.jawOpen, now, TALK_WINDOW_MS);
  remember(state.voice, frame.micLevel, now, TALK_WINDOW_MS);

  const motion = motionAmount(values(state.bodies));
  updateRestTimer(motion, now);
  const chances = postureChances(frame.worldLandmarks);

  const raw = {
    framing: checkFraming(landmarks, settings.cuffArm, frame.aspect),
    seated: checkSeatedUpright(landmarks),
    back: checkBackSupported(values(state.lean), chances.upright),
    legs: checkLegsUncrossed(landmarks, chances.crossed),
    feet: checkFeetFlat(landmarks),
    arm: checkArmAtHeart(landmarks, settings.cuffArm),
    rest: state.phase === "setup"
      ? { status: "unseen", reason: "Starts when you press Start check.", value: null, word: "Not started" }
      : checkRest(state.restSeconds, state.requiredRest, motion),
    talking: checkNotTalking(values(state.jaw), values(state.voice)),
  };
  const results = {};
  for (const id of CHECK_IDS) results[id] = { ...raw[id], status: smooth(id, raw[id].status) };
  trackPhase(results, now);
  return results;
}

// Starts a check session (the Start check button).
export function startSession(demoMode) {
  state.phase = "resting";
  state.demo = Boolean(demoMode);
  state.requiredRest = demoMode ? DEMO_REST_SECONDS : REST_SECONDS;
  state.restSeconds = 0;
  state.measureStart = null;
  state.problems.clear();
}

export function stopSession() {
  state.phase = "setup";
  state.restSeconds = 0;
}

export function getPhase() {
  return state.phase;
}

// Called when the user says their monitor finished. Verified only if every
// check passed for the whole time since the "press start" moment.
export function finishReading(now = Date.now()) {
  const measured = state.phase === "measuring";
  const seconds = measured ? Math.round((now - state.measureStart) / 1000) : 0;
  const tooShort = measured && seconds < MIN_READING_SECONDS;
  const result = {
    verified: measured && state.problems.size === 0 && !tooShort,
    reachedMeasuring: measured,       // false = entered before every check had passed
    failedChecks: [...state.problems], // check ids that slipped while measuring
    tooShort,
    measuredSeconds: seconds,
    demo: state.demo,
  };
  stopSession();
  return result;
}

// Clears everything, e.g. when the camera restarts.
export function resetEngine() {
  state = freshState();
}

// The session may begin only when the whole body is framed.
export function isReadyToStart(results) {
  return results.framing.status === "pass";
}

// Moves from resting to measuring when every check passes, then remembers
// any check that stops passing during the reading.
function trackPhase(results, now) {
  const allPass = CHECK_IDS.every((id) => results[id].status === "pass");
  if (state.phase === "resting" && allPass) {
    state.phase = "measuring";
    state.measureStart = now;
    state.problems.clear();
  } else if (state.phase === "measuring") {
    for (const id of CHECK_IDS) if (results[id].status !== "pass") state.problems.add(id);
  }
}

function updateRestTimer(motion, now) {
  const dt = state.lastTime === null ? 0 : Math.min(0.5, (now - state.lastTime) / 1000);
  state.lastTime = now;
  if (state.phase !== "setup") state.restSeconds = nextRestSeconds(state.restSeconds, motion, dt);
}

// Adds a value to a time-stamped history and forgets anything older than windowMs.
function remember(list, value, now, windowMs) {
  if (value !== null && value !== undefined) list.push({ time: now, value });
  while (list.length && now - list[0].time > windowMs) list.shift();
}

function values(list) {
  return list.map((sample) => sample.value);
}

// Majority vote over the last SMOOTH_FRAMES statuses of one check.
function smooth(id, status) {
  const recent = state.smoothing.get(id) || [];
  recent.push(status);
  if (recent.length > SMOOTH_FRAMES) recent.shift();
  state.smoothing.set(id, recent);
  const counts = {};
  for (const s of recent) counts[s] = (counts[s] || 0) + 1;
  let best = status;
  for (const s in counts) if (counts[s] > counts[best]) best = s;
  return best;
}
