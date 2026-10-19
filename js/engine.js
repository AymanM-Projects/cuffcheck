// engine.js - runs every check on each frame and smooths the answers, so one
// bad frame cannot flip a dot. Later milestones add more checks to the list
// and the "Verified" decision.

import { checkFraming } from "./checks.js";

export const SMOOTH_FRAMES = 20; // TEAM TUNES THIS - about 1 second at 20 frames per second

// Every check the engine knows about. settings holds the user's choices
// (right now only cuffArm). Each run function returns { status, reason }.
const CHECKS = [
  { id: "framing", run: (landmarks, settings) => checkFraming(landmarks, settings.cuffArm) },
];

// Recent statuses per check, newest last. Used for the majority vote.
const history = new Map();

// Runs all checks and returns { framing: { status, reason }, ... } where
// status is the smoothed (most common recent) answer.
export function runChecks(landmarks, settings) {
  const results = {};
  for (const check of CHECKS) {
    const latest = check.run(landmarks, settings);
    results[check.id] = {
      status: smooth(check.id, latest.status),
      reason: latest.reason,
    };
  }
  return results;
}

// Clears the memory, e.g. when the camera restarts.
export function resetSmoothing() {
  history.clear();
}

// The session may begin only when the whole body is framed.
export function isReadyToStart(results) {
  return results.framing.status === "pass";
}

// Remembers the last SMOOTH_FRAMES statuses for one check and returns the
// most common one. A single odd frame is outvoted by the frames around it.
function smooth(id, status) {
  const recent = history.get(id) || [];
  recent.push(status);
  if (recent.length > SMOOTH_FRAMES) recent.shift();
  history.set(id, recent);

  const counts = {};
  for (const s of recent) counts[s] = (counts[s] || 0) + 1;
  let best = status;
  for (const s in counts) {
    if (counts[s] > counts[best]) best = s;
  }
  return best;
}
