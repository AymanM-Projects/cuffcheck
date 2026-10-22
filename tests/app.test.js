// app.test.js - the engine's phases and Verified decision, the coach, the
// reading rules and the session log. No camera or browser needed.

import { test } from "node:test";
import assert from "node:assert/strict";
import { POINT } from "../js/checks.js";
import { runChecks, resetEngine, startSession, finishReading, getPhase, CHECK_IDS } from "../js/engine.js";
import { setPostureModel } from "../js/model.js";
import { pickMessage, createSpeaker, LINES, TIPS, ANY_LINE_GAP_MS, SAME_LINE_GAP_MS, PROBLEM_HOLD_MS } from "../js/coach.js";
import { validateReading, classifyReading, summarize } from "../js/readings.js";
import { startLog, logResults, attachReading, getLog } from "../js/sessionLog.js";

// A person sitting correctly, seen from their left side (same as checks.test.js).
function sideViewBody(changes = {}) {
  const body = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }));
  const spots = { 11: [0.50, 0.30], 12: [0.52, 0.30], 13: [0.58, 0.43], 14: [0.60, 0.43], 23: [0.50, 0.55],
    24: [0.52, 0.55], 25: [0.70, 0.57], 26: [0.72, 0.57], 27: [0.70, 0.80], 28: [0.72, 0.80] };
  for (const [index, [x, y]] of Object.entries(spots)) Object.assign(body[index], { x, y });
  for (const [index, change] of Object.entries(changes)) Object.assign(body[index], change);
  return body;
}

// A fake posture model that always says "upright" and "not crossed".
const zeros = Array(33).fill(0), ones = Array(33).fill(1);
const calmModel = { models: {
  upright: { mean: zeros, scale: ones, coef: zeros, intercept: 3 },
  crossed: { mean: zeros, scale: ones, coef: zeros, intercept: -3 },
} };

const settings = { cuffArm: "left" };
const goodFrame = () => ({ landmarks: sideViewBody(), worldLandmarks: sideViewBody(), jawOpen: 0.05, micLevel: 0.001 });

// Feeds frames every 50 ms (20 per second) from time `from` for `seconds`.
function play(makeFrame, from, seconds) {
  let results;
  for (let t = from; t < from + seconds * 1000; t += 50) results = runChecks(makeFrame(), settings, t);
  return { results, time: from + seconds * 1000 };
}

test("a good demo session reaches measuring and is Verified", () => {
  resetEngine();
  setPostureModel(calmModel);
  let clock = play(goodFrame, 0, 3).time;
  assert.equal(getPhase(), "setup");
  startSession(true);
  clock = play(goodFrame, clock, 32).time; // 30 s demo rest + smoothing
  assert.equal(getPhase(), "measuring");
  clock = play(goodFrame, clock, 25).time;
  const result = finishReading(clock);
  assert.equal(result.verified, true, JSON.stringify(result));
  assert.deepEqual(result.failedChecks, []);
  assert.equal(result.demo, true);
  assert.equal(getPhase(), "setup");
});

test("dropping the arm during the reading means not Verified", () => {
  resetEngine();
  setPostureModel(calmModel);
  startSession(true);
  let clock = play(goodFrame, 0, 33).time;
  assert.equal(getPhase(), "measuring");
  const armDown = () => ({ ...goodFrame(), landmarks: sideViewBody({ [POINT.LEFT_ELBOW]: { x: 0.50, y: 0.47 } }) });
  clock = play(armDown, clock, 3).time;
  clock = play(goodFrame, clock, 20).time;
  const result = finishReading(clock);
  assert.equal(result.verified, false);
  assert.ok(result.failedChecks.includes("arm"));
});

test("finishing before every check passed, or too quickly, is not Verified", () => {
  resetEngine();
  setPostureModel(calmModel);
  startSession(false); // real 5-minute rest
  let clock = play(goodFrame, 0, 10).time;
  assert.equal(getPhase(), "resting");
  const early = finishReading(clock);
  assert.equal(early.verified, false);
  assert.equal(early.reachedMeasuring, false);

  resetEngine();
  startSession(true);
  clock = play(goodFrame, 0, 33).time;
  clock = play(goodFrame, clock, 5).time;
  const quick = finishReading(clock);
  assert.equal(quick.verified, false);
  assert.equal(quick.tooShort, true);
});

test("a big movement while resting starts the rest timer over", () => {
  resetEngine();
  setPostureModel(calmModel);
  startSession(true);
  let clock = play(goodFrame, 0, 20).time;
  let shift = 0;
  const fidget = () => {
    shift = shift ? 0 : 0.1;
    const body = sideViewBody();
    for (const i of [11, 12, 23, 24]) body[i].x += shift;
    return { ...goodFrame(), landmarks: body };
  };
  clock = play(fidget, clock, 1).time;
  const after = play(goodFrame, clock, 15);
  assert.equal(getPhase(), "resting", "20 s + 15 s is not enough after a restart");
  assert.equal(after.results.rest.status, "fail");
  setPostureModel(null);
});

test("engine reports all eight checks", () => {
  resetEngine();
  const { results } = play(goodFrame, 0, 1);
  assert.deepEqual(Object.keys(results), CHECK_IDS);
});

test("coach: silent in setup, first problem first, rest line once, then press start", () => {
  const all = (status) => Object.fromEntries(CHECK_IDS.map((id) => [id, { status, reason: id + " reason" }]));
  assert.equal(pickMessage(all("pass"), "setup").line, null);
  const armAndTalk = { ...all("pass"), arm: { status: "fail", reason: "Raise your arm" }, talking: { status: "fail", reason: "Quiet" } };
  assert.equal(pickMessage(armAndTalk, "resting").line, "Raise your arm");
  const onlyRest = { ...all("pass"), rest: { status: "fail", reason: "Keep resting quietly: 4:00 left." } };
  assert.deepEqual(pickMessage(onlyRest, "resting"), { id: "rest", text: "Keep resting quietly: 4:00 left.", line: LINES.resting, once: true });
  assert.equal(pickMessage(armAndTalk, "resting").tip, TIPS.arm);
  assert.equal(pickMessage(all("pass"), "measuring").line, LINES.ready);
});

test("speaker: never within 3 s, never repeats a once-line, waits before repeating", () => {
  const said = [];
  const speaker = createSpeaker((line) => said.push(line));
  assert.equal(speaker.offer({ line: "A" }, 0), true);
  assert.equal(speaker.offer({ line: "B" }, ANY_LINE_GAP_MS - 1), false);
  assert.equal(speaker.offer({ line: "B" }, ANY_LINE_GAP_MS), true);
  assert.equal(speaker.offer({ line: "B" }, ANY_LINE_GAP_MS * 2), false, "same line too soon");
  assert.equal(speaker.offer({ line: "R", once: true }, 20000), true);
  assert.equal(speaker.offer({ line: "R", once: true }, 60000), false);
  assert.deepEqual(said, ["A", "B", "R"]);
});

test("speaker: a repeated problem adds the how-to tip; fixing it earns a 'Good.'", () => {
  const said = [];
  const speaker = createSpeaker((line) => said.push(line));
  const back = { id: "back", line: "Sit back.", tip: "Shoulder blades on the chair." };
  const arm = { id: "arm", line: "Raise your arm.", tip: "Use a pillow." };
  speaker.offer(back, 0);
  speaker.offer(back, PROBLEM_HOLD_MS);
  speaker.offer(back, PROBLEM_HOLD_MS + SAME_LINE_GAP_MS);
  const t = PROBLEM_HOLD_MS * 2 + SAME_LINE_GAP_MS * 2;
  speaker.offer(arm, t);
  speaker.offer(arm, t + PROBLEM_HOLD_MS);
  assert.deepEqual(said, ["Sit back.", "Sit back. Shoulder blades on the chair.", "Good. Raise your arm."]);
});

test("speaker: a problem that flickers for under 2 s is never spoken", () => {
  const said = [];
  const speaker = createSpeaker((line) => said.push(line));
  const legs = { id: "legs", line: "Uncross your legs.", tip: "Feet apart." };
  assert.equal(speaker.offer(legs, 0), false);
  assert.equal(speaker.offer(legs, PROBLEM_HOLD_MS - 1), false);
  speaker.offer({ id: "ready", line: "Ready", once: true }, PROBLEM_HOLD_MS - 1); // problem went away
  assert.equal(speaker.offer(legs, PROBLEM_HOLD_MS + 100), false, "the hold restarts when the problem comes back");
  assert.deepEqual(said, ["Ready"]);
});

test("rest choice: a 1-minute rest measures but is not Verified; no timer starts measuring at once", () => {
  resetEngine();
  setPostureModel(calmModel);
  startSession(false, 60);
  let clock = play(goodFrame, 0, 63).time;
  assert.equal(getPhase(), "measuring");
  clock = play(goodFrame, clock, 25).time;
  const short = finishReading(clock);
  assert.equal(short.verified, false);
  assert.equal(short.shortRest, true);
  assert.equal(short.restSeconds, 60);

  resetEngine();
  startSession(false, 0);
  play(goodFrame, 0, 3);
  assert.equal(getPhase(), "measuring");
  setPostureModel(null);
});

test("readings: validation catches blanks, impossible numbers and swapped numbers", () => {
  assert.equal(validateReading({ systolic: 120, diastolic: 80, pulse: 70 }), null);
  assert.match(validateReading({ systolic: NaN, diastolic: 80, pulse: 70 }), /systolic/);
  assert.match(validateReading({ systolic: 400, diastolic: 80, pulse: 70 }), /between/);
  assert.match(validateReading({ systolic: 80, diastolic: 120, pulse: 70 }), /bigger/);
});

test("readings: safety screen at 180 or 120, doctor note at 130 or 80", () => {
  assert.equal(classifyReading(180, 90), "urgent");
  assert.equal(classifyReading(150, 120), "urgent");
  assert.equal(classifyReading(179, 119), "high");
  assert.equal(classifyReading(130, 70), "high");
  assert.equal(classifyReading(120, 80), "high");
  assert.equal(classifyReading(129, 79), "normal");
});

test("report: average uses Verified readings only", () => {
  const stats = summarize([
    { systolic: 120, diastolic: 80, pulse: 60, verified: true },
    { systolic: 140, diastolic: 90, pulse: 80, verified: true },
    { systolic: 200, diastolic: 110, pulse: 100, verified: false },
  ]);
  assert.deepEqual(stats, { count: 3, verifiedCount: 2, percentVerified: 67, average: { systolic: 130, diastolic: 85, pulse: 70 } });
  assert.equal(summarize([]).average, null);
});

test("session log: one entry per second, statuses and numbers only, plus the reading", () => {
  startLog({ cuffArm: "left" }, 0);
  const results = { arm: { status: "pass", reason: "ok", value: 0.02 } };
  for (let t = 0; t < 3000; t += 50) logResults(results, "resting", t);
  attachReading({ systolic: 120, diastolic: 80, pulse: 70, verified: true });
  const log = getLog();
  assert.equal(log.seconds.length, 3);
  assert.deepEqual(log.seconds[0], { t: 0, phase: "resting", checks: { arm: "pass" }, values: { arm: 0.02 } });
  assert.equal(log.reading.verified, true);
});
