// autostart.test.js - the auto-start countdown for someone checking alone.
// Run with: node --test tests/*.test.js

import { test } from "node:test";
import assert from "node:assert/strict";
import { CHECK_IDS } from "../js/engine.js";
import { createAutoStart, isAllClear, AUTO_START_SECONDS } from "../js/autostart.js";

// Results with every check passing (rest is "unseen" before a session),
// except the ones given, e.g. results({ legs: "fail" }).
function results(changes = {}) {
  const out = {};
  for (const id of CHECK_IDS) out[id] = { status: changes[id] || (id === "rest" ? "unseen" : "pass") };
  return out;
}

test("all clear ignores the rest timer but needs every other check", () => {
  assert.equal(isAllClear(results()), true);
  assert.equal(isAllClear(results({ feet: "fail" })), false);
  assert.equal(isAllClear(results({ talking: "unseen" })), false);
});

test("does nothing until armed", () => {
  const auto = createAutoStart();
  assert.equal(auto.update(results(), "setup", 0).state, "off");
});

test("counts down and then says go once", () => {
  const auto = createAutoStart();
  auto.arm();
  const first = auto.update(results(), "setup", 0);
  assert.deepEqual(first, { state: "counting", secondsLeft: AUTO_START_SECONDS, justCleared: true });
  assert.equal(auto.update(results(), "setup", 1500).secondsLeft, AUTO_START_SECONDS - 1);
  assert.equal(auto.update(results(), "setup", AUTO_START_SECONDS * 1000).state, "go");
  assert.equal(auto.update(results(), "setup", AUTO_START_SECONDS * 1000 + 100).state, "off");
});

test("waits while a check fails", () => {
  const auto = createAutoStart();
  auto.arm();
  assert.equal(auto.update(results({ arm: "fail" }), "setup", 0).state, "waiting");
});

test("moving out of position starts the countdown over", () => {
  const auto = createAutoStart();
  auto.arm();
  auto.update(results(), "setup", 0);
  assert.equal(auto.update(results({ legs: "fail" }), "setup", 3000).state, "waiting");
  const again = auto.update(results(), "setup", 3500);
  assert.equal(again.justCleared, true);
  assert.equal(again.secondsLeft, AUTO_START_SECONDS);
});

test("the coach's own voice (talking) does not cancel a countdown", () => {
  const auto = createAutoStart();
  auto.arm();
  auto.update(results(), "setup", 0);
  assert.equal(auto.update(results({ talking: "fail" }), "setup", 2000).state, "counting");
});

test("stops when a check is already running or it is disarmed", () => {
  const auto = createAutoStart();
  auto.arm();
  auto.update(results(), "setup", 0);
  assert.equal(auto.update(results(), "resting", 1000).state, "off");
  auto.arm();
  auto.disarm();
  assert.equal(auto.update(results(), "setup", 2000).state, "off");
});
