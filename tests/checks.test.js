// checks.test.js - runs with:  node --test
// Fake landmark bodies prove each rule answers pass, fail or unseen correctly.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  POINT, checkFraming, checkSeatedUpright, checkBackSupported, checkLegsUncrossed,
  checkFeetFlat, checkArmAtHeart, checkRest, nextRestSeconds, motionAmount,
  checkNotTalking, trunkLeanAngle, angleAt, formatTime, STILL_LIMIT, MOVE_LIMIT,
} from "../js/checks.js";

// A person sitting upright, seen from their left side. y grows downward.
function sideViewBody(changes = {}) {
  const body = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }));
  place(body, POINT.LEFT_SHOULDER, 0.50, 0.30); place(body, POINT.RIGHT_SHOULDER, 0.52, 0.30);
  place(body, POINT.LEFT_ELBOW, 0.58, 0.43);    place(body, POINT.RIGHT_ELBOW, 0.60, 0.43);
  place(body, POINT.LEFT_HIP, 0.50, 0.55);      place(body, POINT.RIGHT_HIP, 0.52, 0.55);
  place(body, POINT.LEFT_KNEE, 0.70, 0.57);     place(body, POINT.RIGHT_KNEE, 0.72, 0.57);
  place(body, POINT.LEFT_ANKLE, 0.70, 0.80);    place(body, POINT.RIGHT_ANKLE, 0.72, 0.80);
  for (const [index, change] of Object.entries(changes)) Object.assign(body[index], change);
  return body;
}

// The same person from the front: left and right apart on screen.
function frontViewBody(changes = {}) {
  const body = sideViewBody();
  place(body, POINT.LEFT_HIP, 0.60, 0.55);   place(body, POINT.RIGHT_HIP, 0.40, 0.55);
  place(body, POINT.LEFT_KNEE, 0.60, 0.70);  place(body, POINT.RIGHT_KNEE, 0.40, 0.70);
  place(body, POINT.LEFT_ANKLE, 0.60, 0.85); place(body, POINT.RIGHT_ANKLE, 0.40, 0.85);
  for (const [index, change] of Object.entries(changes)) Object.assign(body[index], change);
  return body;
}

function place(body, index, x, y) {
  body[index].x = x;
  body[index].y = y;
}

const hidden = { visibility: 0.1 };

test("angleAt measures a right angle; formatTime shows minutes", () => {
  assert.ok(Math.abs(angleAt({ x: 0, y: -1 }, { x: 0, y: 0 }, { x: 1, y: 0 }) - 90) < 0.001);
  assert.equal(formatTime(272.2), "4:33");
});

test("framing: passes, names missing parts, respects the cuffed arm, unseen when empty", () => {
  assert.equal(checkFraming(sideViewBody(), "left").status, "pass");
  const kneeHidden = checkFraming(sideViewBody({ [POINT.LEFT_KNEE]: hidden }), "left");
  assert.equal(kneeHidden.status, "fail");
  assert.match(kneeHidden.reason, /knees/);
  const elbowHidden = sideViewBody({ [POINT.RIGHT_ELBOW]: hidden });
  assert.equal(checkFraming(elbowHidden, "left").status, "pass");
  assert.equal(checkFraming(elbowHidden, "right").status, "fail");
  assert.equal(checkFraming(null, "left").status, "unseen");
});

test("seated: upright passes, bent forward and reclining fail, hidden is unseen", () => {
  assert.equal(checkSeatedUpright(sideViewBody()).status, "pass");
  const forward = sideViewBody({ [POINT.LEFT_SHOULDER]: { x: 0.72, y: 0.45 }, [POINT.RIGHT_SHOULDER]: { x: 0.74, y: 0.45 } });
  assert.equal(checkSeatedUpright(forward).status, "fail");
  const reclined = sideViewBody({ [POINT.LEFT_SHOULDER]: { x: 0.25, y: 0.40 }, [POINT.RIGHT_SHOULDER]: { x: 0.27, y: 0.40 } });
  assert.equal(checkSeatedUpright(reclined).status, "fail");
  const half = sideViewBody({ [POINT.LEFT_KNEE]: hidden, [POINT.RIGHT_HIP]: hidden });
  assert.equal(checkSeatedUpright(half).status, "unseen");
});

test("trunk lean: upright is about 0 degrees, leaning is more", () => {
  assert.ok(trunkLeanAngle(sideViewBody()) < 1);
  const leaning = sideViewBody({ [POINT.LEFT_SHOULDER]: { x: 0.65 }, [POINT.RIGHT_SHOULDER]: { x: 0.67 } });
  assert.ok(trunkLeanAngle(leaning) > 25);
  assert.equal(trunkLeanAngle(null), null);
});

test("back: steady passes; leaning, wobbling or a model 'not upright' fails; too few samples is unseen", () => {
  assert.equal(checkBackSupported(Array(40).fill(5)).status, "pass");
  assert.equal(checkBackSupported(Array(40).fill(30)).status, "fail");
  assert.equal(checkBackSupported(Array.from({ length: 40 }, (_, i) => (i % 2 ? 0 : 15))).status, "fail");
  assert.equal(checkBackSupported(Array(40).fill(5), 0.2).status, "fail");
  assert.equal(checkBackSupported(Array(40).fill(5), 0.9).status, "pass");
  assert.equal(checkBackSupported([5, 5, 5]).status, "unseen");
});

test("legs: front view uncrossed passes; ankles or knees swapped fails", () => {
  assert.equal(checkLegsUncrossed(frontViewBody()).status, "pass");
  const ankles = frontViewBody({ [POINT.LEFT_ANKLE]: { x: 0.40 }, [POINT.RIGHT_ANKLE]: { x: 0.60 } });
  assert.equal(checkLegsUncrossed(ankles).status, "fail");
  const kneeOverKnee = frontViewBody({ [POINT.LEFT_KNEE]: { x: 0.38 }, [POINT.LEFT_ANKLE]: { x: 0.30 } });
  assert.equal(checkLegsUncrossed(kneeOverKnee).status, "fail");
});

test("legs: side view needs the model; the model can also catch crossing", () => {
  assert.equal(checkLegsUncrossed(sideViewBody()).status, "unseen");
  assert.equal(checkLegsUncrossed(sideViewBody(), 0.1).status, "pass");
  assert.equal(checkLegsUncrossed(sideViewBody(), 0.9).status, "fail");
  assert.equal(checkLegsUncrossed(frontViewBody(), 0.9).status, "fail");
  assert.equal(checkLegsUncrossed(frontViewBody({ [POINT.LEFT_ANKLE]: hidden }), 0.1).status, "unseen");
});

test("feet: ankles below knees pass, a raised ankle fails, hidden is unseen", () => {
  assert.equal(checkFeetFlat(sideViewBody()).status, "pass");
  assert.equal(checkFeetFlat(sideViewBody({ [POINT.LEFT_ANKLE]: { y: 0.58 } })).status, "fail");
  assert.equal(checkFeetFlat(sideViewBody({ [POINT.LEFT_ANKLE]: hidden, [POINT.RIGHT_ANKLE]: hidden })).status, "unseen");
});

test("arm: resting at heart level passes", () => {
  const result = checkArmAtHeart(sideViewBody(), "left");
  assert.equal(result.status, "pass", JSON.stringify(result));
});

test("arm: hanging at the side fails and says raise", () => {
  const hanging = sideViewBody({ [POINT.LEFT_ELBOW]: { x: 0.50, y: 0.47 } });
  const result = checkArmAtHeart(hanging, "left");
  assert.equal(result.status, "fail");
  assert.match(result.reason, /Raise/);
});

test("arm: raised up high fails and says lower", () => {
  const raised = sideViewBody({ [POINT.LEFT_ELBOW]: { x: 0.62, y: 0.28 } });
  const result = checkArmAtHeart(raised, "left");
  assert.equal(result.status, "fail");
  assert.match(result.reason, /Lower/);
});

test("arm: uses the cuffed side and is unseen when that elbow is hidden", () => {
  const rightHanging = sideViewBody({ [POINT.RIGHT_ELBOW]: { x: 0.52, y: 0.47 } });
  assert.equal(checkArmAtHeart(rightHanging, "left").status, "pass");
  assert.equal(checkArmAtHeart(rightHanging, "right").status, "fail");
  assert.equal(checkArmAtHeart(sideViewBody({ [POINT.LEFT_ELBOW]: hidden }), "left").status, "unseen");
});

test("motion: a still body is near 0, a shifting body is large, nobody is null", () => {
  const still = Array.from({ length: 30 }, () => sideViewBody());
  assert.ok(motionAmount(still) < STILL_LIMIT);
  const shifting = Array.from({ length: 30 }, (_, i) => sideViewBody({
    [POINT.LEFT_SHOULDER]: { x: 0.5 + i * 0.005 }, [POINT.RIGHT_SHOULDER]: { x: 0.52 + i * 0.005 },
    [POINT.LEFT_HIP]: { x: 0.5 + i * 0.005 }, [POINT.RIGHT_HIP]: { x: 0.52 + i * 0.005 },
  }));
  assert.ok(motionAmount(shifting) > MOVE_LIMIT);
  assert.equal(motionAmount([null, null]), null);
});

test("rest timer grows while still, pauses for fidgets or when unseen, restarts after big moves", () => {
  assert.equal(nextRestSeconds(10, 0.01, 0.5), 10.5);
  assert.equal(nextRestSeconds(10, (STILL_LIMIT + MOVE_LIMIT) / 2, 0.5), 10);
  assert.equal(nextRestSeconds(10, null, 0.5), 10);
  assert.equal(nextRestSeconds(10, MOVE_LIMIT + 0.1, 0.5), 0);
});

test("rest check: waiting, done, unseen", () => {
  const waiting = checkRest(28, 300, 0.01);
  assert.equal(waiting.status, "fail");
  assert.equal(waiting.word, "Waiting");
  assert.match(waiting.reason, /4:32 left/);
  assert.equal(checkRest(300, 300, 0.01).status, "pass");
  assert.equal(checkRest(10, 300, null).status, "unseen");
});

test("talking: still mouth and quiet room pass; moving mouth or loud room fail; no data is unseen", () => {
  const stillMouth = Array(20).fill(0.05), movingMouth = Array.from({ length: 20 }, (_, i) => (i % 2 ? 0.05 : 0.4));
  const quiet = Array(40).fill(0.002), loud = Array(40).fill(0.08);
  assert.equal(checkNotTalking(stillMouth, quiet).status, "pass");
  assert.equal(checkNotTalking(movingMouth, quiet).status, "fail");
  assert.equal(checkNotTalking(stillMouth, loud).status, "fail");
  assert.equal(checkNotTalking([], loud).status, "fail");
  assert.equal(checkNotTalking(stillMouth, []).status, "pass");
  assert.equal(checkNotTalking([], []).status, "unseen");
});
