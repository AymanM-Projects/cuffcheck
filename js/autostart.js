// autostart.js - for someone checking alone who can't reach the phone.
// Once every check except the rest timer passes, the coach says "All clear",
// counts down, and the check starts by itself. This file is only the logic;
// main.js shows the countdown, speaks, and presses Start check.

import { CHECK_IDS } from "./engine.js";

export const AUTO_START_SECONDS = 5; // TEAM TUNES THIS - countdown before the check starts

// The rest timer only runs after Start check, so it can't pass yet.
// Talking can't cancel a countdown, because the mic hears the coach saying
// "All clear". The check itself still waits for quiet before measuring.
const BODY_CHECKS = CHECK_IDS.filter((id) => id !== "rest" && id !== "talking");

export function isAllClear(results) {
  return CHECK_IDS.every((id) => id === "rest" || results[id].status === "pass");
}

// Makes the auto-starter. update() is called on every frame and returns one of:
// { state: "off" }       not armed, or a check is already running
// { state: "waiting" }   armed, waiting for every check to pass
// { state: "counting", secondsLeft, justCleared }  counting down
// { state: "go" }        start the check now (it disarms itself)
export function createAutoStart() {
  let armed = false;
  let since = null; // when the countdown began
  return {
    arm() { armed = true; since = null; },
    disarm() { armed = false; since = null; },
    update(results, phase, now) {
      if (!armed || phase !== "setup") {
        since = null;
        return { state: "off" };
      }
      if (since === null) {
        if (!isAllClear(results)) return { state: "waiting" };
        since = now;
        return { state: "counting", secondsLeft: AUTO_START_SECONDS, justCleared: true };
      }
      // Moving out of position during the countdown starts it over.
      if (!BODY_CHECKS.every((id) => results[id].status === "pass")) {
        since = null;
        return { state: "waiting" };
      }
      const secondsLeft = Math.ceil(AUTO_START_SECONDS - (now - since) / 1000);
      if (secondsLeft > 0) return { state: "counting", secondsLeft, justCleared: false };
      armed = false;
      since = null;
      return { state: "go" };
    },
  };
}
