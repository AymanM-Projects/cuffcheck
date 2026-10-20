// model.test.js - checks that js/model.js converts landmarks exactly like
// training/train.py, and that the saved weights give the same answers.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MODEL_JOINTS, toModelInput, predict, postureChances, setPostureModel } from "../js/model.js";

const saved = JSON.parse(readFileSync(new URL("../model/posture_model.json", import.meta.url)));
const example = saved.check_example;

// Builds a 33-point world-landmark body from the 11 joints Python saved.
function bodyFrom(joints) {
  const body = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
  MODEL_JOINTS.forEach((index, i) => {
    const [x, y, z] = joints[i];
    body[index] = { x, y, z, visibility: 1 };
  });
  return body;
}

// Turns a body around the vertical axis, like walking around the person.
function turnAround(body, degrees) {
  const a = (degrees * Math.PI) / 180;
  return body.map((p) => ({ ...p, x: p.x * Math.cos(a) - p.z * Math.sin(a), z: p.x * Math.sin(a) + p.z * Math.cos(a) }));
}

function assertClose(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);
}

test("the saved model file has both models with 33 weights each", () => {
  for (const name of ["upright", "crossed"]) {
    const m = saved.models[name];
    assert.equal(m.coef.length, 33);
    assert.equal(m.mean.length, 33);
    assert.ok(m.scale.every((s) => s > 0), "no zero scales");
  }
  assert.match(saved.dataset, /14230872/);
});

test("JavaScript conversion matches the Python conversion", () => {
  const input = toModelInput(bodyFrom(example.joints_xyz));
  assert.equal(input.length, 33);
  input.forEach((value, i) => assertClose(value, example.features[i], 1e-5, "feature " + i));
});

test("JavaScript prediction matches scikit-learn", () => {
  const input = toModelInput(bodyFrom(example.joints_xyz));
  assertClose(predict(saved.models.upright, input), example.upright, 1e-4, "upright");
  assertClose(predict(saved.models.crossed, input), example.crossed, 1e-4, "crossed");
});

test("a side view gives the same model input as a front view", () => {
  const front = bodyFrom(example.joints_xyz);
  const frontInput = toModelInput(front);
  for (const degrees of [90, -90, 45, 180]) {
    const turnedInput = toModelInput(turnAround(front, degrees));
    turnedInput.forEach((value, i) => assertClose(value, frontInput[i], 1e-9, `${degrees} deg feature ${i}`));
  }
});

test("bigger people give the same model input", () => {
  const body = bodyFrom(example.joints_xyz);
  const bigger = body.map((p) => ({ ...p, x: p.x * 1.3, y: p.y * 1.3, z: p.z * 1.3 }));
  const a = toModelInput(body), b = toModelInput(bigger);
  a.forEach((value, i) => assertClose(b[i], value, 1e-9, "feature " + i));
});

test("postureChances is null without a model or when the hips are hidden", () => {
  setPostureModel(null);
  assert.deepEqual(postureChances(bodyFrom(example.joints_xyz)), { upright: null, crossed: null });
  setPostureModel(saved);
  const body = bodyFrom(example.joints_xyz);
  body[23].visibility = 0.1;
  assert.deepEqual(postureChances(body), { upright: null, crossed: null });
  const chances = postureChances(bodyFrom(example.joints_xyz));
  assert.ok(chances.upright > 0 && chances.upright < 1);
  setPostureModel(null);
});
