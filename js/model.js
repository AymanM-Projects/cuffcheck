// model.js - runs our trained posture model (made by training/train.py) in
// plain JavaScript: a weighted sum and a sigmoid. No ML library in the browser.
//
// IMPORTANT: the MultiPosture dataset is NOT in the same format as the
// normalized landmarks the checks use. It holds MediaPipe *world* landmarks
// (meters, origin at the middle of the hips) filmed from the FRONT. We film
// from the side. toModelInput() converts our world landmarks to match.

import { isSeen } from "./checks.js";

export const MODEL_URL = "./model/posture_model.json";

// The 11 joints the model uses, in MediaPipe's numbering (same order as the
// dataset): nose, shoulders, elbows, hips, knees, ankles.
export const MODEL_JOINTS = [0, 11, 12, 13, 14, 23, 24, 25, 26, 27, 28];
// Positions of some joints inside that list of 11.
const L_SHOULDER = 1, R_SHOULDER = 2, L_HIP = 5, R_HIP = 6;
// These must be visible for the model to run. Hidden elbows or ankles are
// still estimated by MediaPipe, and the model was trained on such estimates.
const MUST_SEE = [11, 12, 23, 24, 25, 26];

let model = null; // filled in by loadPostureModel()

// Downloads the weights file from our own site (not an outside server).
export async function loadPostureModel(url = MODEL_URL) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Posture model not found at " + url);
  model = await response.json();
  return model;
}

// Lets the tests use a model without fetching a file.
export function setPostureModel(newModel) {
  model = newModel;
}

// Chance (0 to 1) that the trunk is upright and that the legs are crossed.
// Both are null when the model is not loaded or the body is not visible.
export function postureChances(worldLandmarks) {
  const none = { upright: null, crossed: null };
  if (!model || !worldLandmarks) return none;
  if (!MUST_SEE.every((i) => isSeen(worldLandmarks[i]))) return none;
  const input = toModelInput(worldLandmarks);
  return {
    upright: predict(model.models.upright, input),
    crossed: predict(model.models.crossed, input),
  };
}

// Converts MediaPipe world landmarks into the 33 numbers the model expects:
// 1. keep the 11 joints;
// 2. move the origin to the middle of the hips;
// 3. turn the body around the vertical axis so the hip line points along x,
//    which is how a person filmed from the front looks (the dataset);
// 4. divide by the torso length, so tall and short people look the same.
// training/train.py does exactly the same steps in Python.
export function toModelInput(worldLandmarks) {
  const joints = MODEL_JOINTS.map((i) => worldLandmarks[i]);
  const hipX = (joints[L_HIP].x + joints[R_HIP].x) / 2;
  const hipY = (joints[L_HIP].y + joints[R_HIP].y) / 2;
  const hipZ = (joints[L_HIP].z + joints[R_HIP].z) / 2;
  const moved = joints.map((p) => ({ x: p.x - hipX, y: p.y - hipY, z: p.z - hipZ }));

  // Angle of the hip line seen from above; turning by minus this angle
  // lines the hips up with the x axis.
  const angle = Math.atan2(moved[L_HIP].z - moved[R_HIP].z, moved[L_HIP].x - moved[R_HIP].x);
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const turned = moved.map((p) => ({ x: p.x * cos + p.z * sin, y: p.y, z: -p.x * sin + p.z * cos }));

  const midShoulder = {
    x: (turned[L_SHOULDER].x + turned[R_SHOULDER].x) / 2,
    y: (turned[L_SHOULDER].y + turned[R_SHOULDER].y) / 2,
    z: (turned[L_SHOULDER].z + turned[R_SHOULDER].z) / 2,
  };
  const torso = Math.hypot(midShoulder.x, midShoulder.y, midShoulder.z) || 1;

  const input = [];
  for (const p of turned) input.push(p.x / torso, p.y / torso, p.z / torso);
  return input;
}

// Logistic regression: scale each input the way training did, multiply by
// its weight, add them up, and squash the total into 0..1 with a sigmoid.
export function predict(weights, input) {
  let total = weights.intercept;
  for (let i = 0; i < input.length; i++) {
    total += weights.coef[i] * (input[i] - weights.mean[i]) / weights.scale[i];
  }
  return 1 / (1 + Math.exp(-total));
}
