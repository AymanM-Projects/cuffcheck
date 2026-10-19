// main.js - connects the buttons on the page to camera.js and engine.js,
// updates the checklist, and handles the text-size controls.

import { startCamera, loadPoseModel, startTracking, stopTracking } from "./camera.js";
import { runChecks, resetSmoothing, isReadyToStart } from "./engine.js";

const video = document.getElementById("video");
const canvas = document.getElementById("overlay");
const stage = document.getElementById("stage");
const startButton = document.getElementById("start-button");
const sessionButton = document.getElementById("session-button");
const statusLine = document.getElementById("status");

let cameraOn = false;      // true while the camera and the draw loop are running
let sessionStarted = false; // true after the user presses Start check

function setStatus(text) {
  statusLine.textContent = text;
}

// Reads a radio group, e.g. radioValue("camera") -> "environment" or "user".
function radioValue(name) {
  return document.querySelector(`input[name="${name}"]:checked`).value;
}

// ---- Camera ----

// Pressing Start (again) also switches cameras if the choice changed.
async function handleStart() {
  startButton.disabled = true; // no double taps while loading
  const facing = radioValue("camera");
  stage.classList.toggle("mirrored", facing === "user");
  try {
    setStatus("Loading the pose model and starting the camera. This can take a few seconds.");
    // Both can happen at the same time: the model downloads while the
    // permission prompt is on screen.
    await Promise.all([loadPoseModel(), startCamera(video, facing)]);
    resetSmoothing();
    startTracking(video, canvas, handleLandmarks);
    cameraOn = true;
    setStatus("Camera on. Sit so your whole body is in the picture.");
  } catch (err) {
    console.error(err);
    setStatus(plainError(err));
  }
  startButton.disabled = false;
}

// Turns a browser error into a sentence a person can act on.
function plainError(err) {
  if (err.name === "NotAllowedError") {
    return "Camera permission was denied. Allow the camera in your browser settings and try again.";
  }
  if (err.name === "NotFoundError" || err.name === "OverconstrainedError") {
    return "No camera was found. Try the other camera choice.";
  }
  return "Something went wrong: " + err.message;
}

// Called by camera.js on every new frame with the 33 landmarks (or null).
function handleLandmarks(landmarks) {
  const results = runChecks(landmarks, { cuffArm: radioValue("arm") });
  updateChecklist(results);
  if (!sessionStarted) sessionButton.disabled = !isReadyToStart(results);
}

// ---- Checklist ----

const STATE_WORDS = { pass: "OK", fail: "Fix this", unseen: "Can't see" };

// Finds the dot, state word and reason text for each row, once.
const rows = {};
for (const li of document.querySelectorAll("#checklist li")) {
  rows[li.dataset.check] = {
    dot: li.querySelector(".dot"),
    state: li.querySelector(".state"),
    reason: li.querySelector(".reason"),
    last: "",
  };
}

// Writes each result into its row, but only when something changed, so the
// page is not redrawn 30 times a second for nothing.
function updateChecklist(results) {
  for (const [id, result] of Object.entries(results)) {
    const row = rows[id];
    if (!row) continue;
    const key = result.status + "|" + result.reason;
    if (key === row.last) continue;
    row.last = key;
    row.dot.className = "dot " + result.status;
    row.state.textContent = STATE_WORDS[result.status];
    row.reason.textContent = result.reason;
  }
}

function handleSessionStart() {
  sessionStarted = true;
  sessionButton.disabled = true;
  setStatus("Check started. Keep your whole body in the picture.");
}

// ---- Text size ----

const TEXT_SCALE_MIN = 0.8;  // TEAM TUNES THIS
const TEXT_SCALE_MAX = 1.6;  // TEAM TUNES THIS
const TEXT_SCALE_STEP = 0.1;
let textScale = 1;

// Every size on the page is in rem, so changing one CSS variable scales everything.
function setTextScale(next) {
  textScale = Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, Math.round(next * 10) / 10));
  document.documentElement.style.setProperty("--text-scale", textScale);
}

function handleTextKeys(event) {
  if (!(event.ctrlKey || event.metaKey)) return;
  if (event.key === "+" || event.key === "=") {
    event.preventDefault(); // otherwise the browser zooms the whole page
    setTextScale(textScale + TEXT_SCALE_STEP);
  } else if (event.key === "-") {
    event.preventDefault();
    setTextScale(textScale - TEXT_SCALE_STEP);
  }
}

// ---- Wiring ----

startButton.addEventListener("click", handleStart);
sessionButton.addEventListener("click", handleSessionStart);
document.getElementById("text-larger").addEventListener("click", () => setTextScale(textScale + TEXT_SCALE_STEP));
document.getElementById("text-smaller").addEventListener("click", () => setTextScale(textScale - TEXT_SCALE_STEP));
document.addEventListener("keydown", handleTextKeys);

// When the user switches apps, stop the camera to save battery and privacy.
document.addEventListener("visibilitychange", () => {
  if (document.hidden && cameraOn) {
    cameraOn = false;
    stopTracking();
    setStatus("Camera paused. Tap Start camera to continue.");
  }
});
