// coach.js - picks ONE message at a time from the check results, shows it
// big on the screen and says it out loud. It never speaks within 3 seconds of
// the last thing it said, and waits longer before repeating the same line.
// A repeated line comes with a how-to tip, and fixing a problem earns a "Good."

export const COACH_ORDER = ["framing", "seated", "back", "legs", "feet", "arm", "talking", "rest"];
export const ANY_LINE_GAP_MS = 3000;    // never speak twice within 3 s
export const SAME_LINE_GAP_MS = 15000;  // TEAM TUNES THIS - wait this long before repeating a line
export const PROBLEM_HOLD_MS = 2000;    // TEAM TUNES THIS - a problem must last this long before it is spoken

// TEAM TUNES THIS wording
export const LINES = {
  setupFramed: "Your body is in the picture. Press Start check.",
  start: "Starting the check. Sit back, feet flat, arm resting at heart level.",
  resting: "Good. Now relax and stay still and quiet. I'll tell you when to start your monitor.",
  ready: "Everything looks right. Press start on your blood pressure monitor now, and stay still and quiet until it finishes.",
  measuring: "Measuring. Stay still and quiet. When your monitor finishes, press Enter my reading.",
};

// TEAM TUNES THIS wording - how to fix each problem. Shown under the message,
// and spoken when the same problem is still there the next time.
export const TIPS = {
  framing: "Best spot: phone about 2 meters (6 feet) away, at chest height, pointing at your cuffed side.",
  seated: "Bottom all the way back in the seat, shoulders over your hips.",
  back: "Let your shoulder blades rest on the chair back. Leaning back a little is fine.",
  legs: "Both feet on the floor, about hip-width apart.",
  feet: "Knees bent at about a right angle, soles flat on the floor. Use a footrest if your feet don't reach.",
  arm: "Rest your forearm on a table or pillow so the cuff is level with the middle of your chest.",
  talking: "Talking can raise your reading. Stay quiet until the monitor finishes.",
};

// Chooses the one message to show. Returns { id, text, line, tip, once }:
// text goes on screen, line is spoken (null = say nothing), tip is the how-to,
// once = say it only once per session.
export function pickMessage(results, phase) {
  if (phase === "setup") {
    const framing = results.framing;
    if (framing.status === "pass") return { id: "framing", text: LINES.setupFramed, line: null };
    return { id: "framing", text: framing.reason, line: null, tip: TIPS.framing };
  }
  for (const id of COACH_ORDER) {
    const result = results[id];
    if (result.status === "pass") continue;
    if (id === "rest") return { id, text: result.reason, line: LINES.resting, once: true };
    return { id, text: result.reason, line: result.reason, tip: TIPS[id] };
  }
  if (phase === "measuring") return { id: "ready", text: LINES.measuring, line: LINES.ready, once: true };
  return { id: "ready", text: LINES.ready, line: LINES.ready, once: true };
}

// Place in the coaching order; "ready" comes after every check.
function orderOf(id) {
  const index = COACH_ORDER.indexOf(id);
  return index === -1 ? COACH_ORDER.length : index;
}

// Makes a speaker that decides WHEN to say a line. sayAloud does the talking
// (speakAloud in the app, a fake in the tests).
export function createSpeaker(sayAloud) {
  let lastLine = null;
  let lastTime = -Infinity;
  let lastFixId = null;          // the check we last asked the user to fix
  let problemId = null;          // the problem on screen now, and since when
  let problemSince = 0;
  const saidOnce = new Set();
  const timesSaid = new Map();   // line -> how often it was spoken
  return {
    reset() {
      lastLine = null;
      lastTime = -Infinity;
      lastFixId = null;
      problemId = null;
      saidOnce.clear();
      timesSaid.clear();
    },
    // Says the message's line if the timing rules allow. Returns true if spoken.
    offer(message, now) {
      if (!message.line) return false;
      // A problem that flickers on for a moment is shown but not spoken.
      const isProblem = Boolean(message.tip);
      if (!isProblem) problemId = null;
      else if (message.id !== problemId) {
        problemId = message.id;
        problemSince = now;
      }
      if (isProblem && now - problemSince < PROBLEM_HOLD_MS) return false;
      if (message.once && saidOnce.has(message.line)) return false;
      if (now - lastTime < ANY_LINE_GAP_MS) return false;
      if (message.line === lastLine && now - lastTime < SAME_LINE_GAP_MS) return false;
      let spoken = message.line;
      // Still the same problem: add the how-to, so it is not just the same words again.
      if (timesSaid.get(message.line) && message.tip) spoken += " " + message.tip;
      // Moved on to a later step: the last problem was fixed.
      if (lastFixId && message.id && orderOf(message.id) > orderOf(lastFixId) && !spoken.startsWith("Good")) {
        spoken = "Good. " + spoken;
      }
      lastLine = message.line;
      lastTime = now;
      lastFixId = message.tip ? message.id : null;
      timesSaid.set(message.line, (timesSaid.get(message.line) || 0) + 1);
      if (message.once) saidOnce.add(message.line);
      sayAloud(spoken);
      return true;
    },
  };
}

// Uses the browser's built-in voice. Nothing is sent anywhere.
export function speakAloud(text) {
  if (!("speechSynthesis" in globalThis)) return;
  speechSynthesis.cancel(); // stop an old message so they never overlap
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  speechSynthesis.speak(utterance);
}
