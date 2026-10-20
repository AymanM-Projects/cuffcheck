// coach.js - picks ONE message at a time from the check results, shows it
// big on the screen and says it out loud. It never speaks within 3 seconds of
// the last thing it said, and waits longer before repeating the same line.

export const COACH_ORDER = ["framing", "seated", "back", "legs", "feet", "arm", "talking", "rest"];
export const ANY_LINE_GAP_MS = 3000;    // never speak twice within 3 s
export const SAME_LINE_GAP_MS = 12000;  // TEAM TUNES THIS - wait this long before repeating a line

// TEAM TUNES THIS wording
export const LINES = {
  setupFramed: "Your body is in the picture. Press Start check.",
  start: "Starting the check. Sit back, feet flat, arm resting at heart level.",
  resting: "Good. Now relax and stay still and quiet. I'll tell you when to start your monitor.",
  ready: "Everything looks right. Press start on your blood pressure monitor now, and stay still and quiet until it finishes.",
  measuring: "Measuring. Stay still and quiet. When your monitor finishes, press Enter my reading.",
};

// Chooses the one message to show. Returns { text, line, once }: text goes on
// screen, line is spoken (null = say nothing), once = say it only once per session.
export function pickMessage(results, phase) {
  if (phase === "setup") {
    const framing = results.framing;
    return { text: framing.status === "pass" ? LINES.setupFramed : framing.reason, line: null };
  }
  for (const id of COACH_ORDER) {
    const result = results[id];
    if (result.status === "pass") continue;
    if (id === "rest") return { text: result.reason, line: LINES.resting, once: true };
    return { text: result.reason, line: result.reason };
  }
  if (phase === "measuring") return { text: LINES.measuring, line: LINES.ready, once: true };
  return { text: LINES.ready, line: LINES.ready, once: true };
}

// Makes a speaker that decides WHEN to say a line. sayAloud does the talking
// (speakAloud in the app, a fake in the tests).
export function createSpeaker(sayAloud) {
  let lastLine = null;
  let lastTime = -Infinity;
  const saidOnce = new Set();
  return {
    reset() {
      lastLine = null;
      lastTime = -Infinity;
      saidOnce.clear();
    },
    // Says the message's line if the timing rules allow. Returns true if spoken.
    offer(message, now) {
      if (!message.line) return false;
      if (message.once && saidOnce.has(message.line)) return false;
      if (now - lastTime < ANY_LINE_GAP_MS) return false;
      if (message.line === lastLine && now - lastTime < SAME_LINE_GAP_MS) return false;
      lastLine = message.line;
      lastTime = now;
      if (message.once) saidOnce.add(message.line);
      sayAloud(message.line);
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
