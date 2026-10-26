// main.js - connects the page to the other modules: screen switching, the
// buttons, the checklist, the coaching message and the text-size controls.

import { startCamera, loadModels, startTracking, stopTracking, startMicrophone, stopMicrophone } from "./camera.js";
import { runChecks, resetEngine, isReadyToStart, startSession, stopSession, finishReading, getPhase } from "./engine.js";
import { pickMessage, createSpeaker, speakAloud, LINES } from "./coach.js";
import { initReadings, openReadingForm, renderHistory } from "./readings.js";
import { startLog, logResults, downloadLog } from "./sessionLog.js";
import { loadPostureModel } from "./model.js";
import { createAutoStart } from "./autostart.js";

const $ = (id) => document.getElementById(id);
const speaker = createSpeaker(speakAloud);
const autoStart = createAutoStart();
let cameraOn = false;

function setStatus(text) {
  $("status").textContent = text;
}

// Reads a radio group, e.g. radioValue("arm") -> "left" or "right".
function radioValue(name) {
  return document.querySelector(`input[name="${name}"]:checked`).value;
}

// ---- Screens: show one <section class="screen"> and hide the rest ----

function showScreen(name) {
  for (const screen of document.querySelectorAll(".screen")) screen.hidden = screen.id !== "screen-" + name;
  for (const tab of document.querySelectorAll(".tabs button")) {
    tab.setAttribute("aria-current", tab.dataset.screen === name ? "page" : "false");
  }
  if (name === "history") renderHistory();
  window.scrollTo(0, 0);
}

// ---- Camera ----

// Pressing Start camera (again) also switches cameras if the choice changed.
async function handleStartCamera() {
  $("start-button").disabled = true;
  armAutoStart();
  const facing = radioValue("camera");
  $("stage").classList.toggle("mirrored", facing === "user");
  try {
    setStatus("Loading the models and starting the camera. This can take a few seconds.");
    await Promise.all([loadModels(), startCamera($("video"), facing)]);
    resetEngine();
    startTracking($("video"), $("overlay"), handleFrame);
    cameraOn = true;
    setStatus("Camera on. Sit with your cuffed side toward the camera, about 2 meters (6 feet) away, so your whole body is in the picture.");
  } catch (err) {
    console.error(err);
    setStatus(plainError(err));
  }
  $("start-button").disabled = false;
}

function plainError(err) {
  if (err.name === "NotAllowedError") return "Camera permission was denied. Allow the camera in your browser settings and try again.";
  if (err.name === "NotFoundError" || err.name === "OverconstrainedError") return "No camera was found. Try the other camera choice.";
  return "Something went wrong: " + err.message;
}

// Called by camera.js on every new frame.
function handleFrame(frame) {
  const now = Date.now();
  const results = runChecks(frame, { cuffArm: radioValue("arm") }, now);
  const phase = getPhase();
  updateChecklist(results);
  showStep(phase);
  if (!runAutoStart(results, phase, now)) showCoach(results, phase, now);
  if (phase !== "setup") logResults(results, phase, now);
  if ($("opt-numbers").checked) showNumbers(results);
  updateButtons(phase, results);
}

// ---- Check session ----

async function handleStartCheck() {
  autoStart.disarm();
  const demo = $("opt-demo").checked;
  const restSeconds = Number(radioValue("rest"));
  startSession(demo, restSeconds);
  rows.rest.li.querySelector("span:nth-child(2)").textContent = restLabel(demo, restSeconds);
  speaker.reset();
  if ($("opt-speech").checked) speakAloud(LINES.start); // speaking inside the tap unlocks speech on iPhone
  startLog({ cuffArm: radioValue("arm"), camera: radioValue("camera"), demoMode: demo, restSeconds, microphone: $("opt-mic").checked });
  $("setup").open = false;
  if ($("opt-mic").checked) {
    try {
      await startMicrophone();
    } catch (err) {
      console.warn(err);
      setStatus("Microphone not available. Talking is checked by watching your mouth only.");
    }
  }
}

// Checklist label for the rest row, e.g. "Rested 3 minutes".
function restLabel(demo, restSeconds) {
  if (demo) return "Rested 30 seconds (demo)";
  if (restSeconds === 0) return "Rest timer off";
  const minutes = restSeconds / 60;
  return "Rested " + minutes + (minutes === 1 ? " minute" : " minutes");
}

function handleEnterReading() {
  const result = finishReading(Date.now());
  stopMicrophone();
  openReadingForm(result);
}

function handleStopCheck() {
  stopSession();
  stopMicrophone();
  $("setup").open = true;
}

// ---- Auto-start, for someone checking alone ----

// Called from a tap (Start camera, Stop check, the Check tab, the option
// itself), because phones only allow speech and the microphone after a tap.
function armAutoStart() {
  if (!$("opt-auto").checked) return;
  autoStart.arm();
  if ($("opt-speech").checked) speakAloud(LINES.autoArmed);
  if ($("opt-mic").checked) startMicrophone().catch((err) => console.warn(err));
}

// Shows the countdown and starts the check when it reaches zero.
// Returns true while the countdown is on screen instead of the coach message.
function runAutoStart(results, phase, now) {
  const onCheckScreen = !$("screen-check").hidden;
  const auto = autoStart.update(results, onCheckScreen ? phase : "away", now);
  if (auto.state === "go") handleStartCheck();
  if (auto.state !== "counting") return false;
  if (auto.justCleared && $("opt-speech").checked) speakAloud(LINES.autoClear.replace("{n}", auto.secondsLeft));
  const text = "All clear. Starting the check in " + auto.secondsLeft + "…";
  if (text !== lastCoachText) {
    $("coach").textContent = text;
    $("coach-tip").hidden = true;
    lastCoachText = text;
  }
  return true;
}

// Shows only the buttons that make sense right now.
function updateButtons(phase, results) {
  const inSession = phase !== "setup";
  $("session-button").hidden = inSession;
  $("session-button").disabled = !isReadyToStart(results);
  $("reading-button").hidden = !inSession;
  $("stop-button").hidden = !inSession;
}

// ---- Checklist, coach and numbers ----

const STATE_WORDS = { pass: "OK", fail: "Fix this", unseen: "Can't see" };
const rows = {};
for (const li of document.querySelectorAll("#checklist li")) {
  rows[li.dataset.check] = { li, dot: li.querySelector(".dot"), state: li.querySelector(".state"), reason: li.querySelector(".reason"), last: "" };
}

// Writes each result into its row, but only when something changed.
function updateChecklist(results) {
  for (const [id, result] of Object.entries(results)) {
    const row = rows[id];
    const word = result.word || STATE_WORDS[result.status];
    const key = result.status + "|" + word + "|" + result.reason;
    if (!row || key === row.last) continue;
    row.last = key;
    row.dot.className = "dot " + result.status;
    row.li.dataset.status = result.status; // tints the whole row green, red or gray
    row.state.textContent = word;
    row.reason.textContent = result.reason;
  }
}

// Highlights the current step (1 Set up, 2 Rest, 3 Measure); earlier steps show as done.
const STEP_ORDER = ["setup", "resting", "measuring"];
let lastStep = "";
function showStep(phase) {
  if (phase === lastStep) return;
  lastStep = phase;
  const current = STEP_ORDER.indexOf(phase);
  document.querySelectorAll("#steps li").forEach((li, index) => {
    li.className = index === current ? "current" : index < current ? "done" : "";
  });
}

let lastCoachText = "";
function showCoach(results, phase, now) {
  const message = pickMessage(results, phase);
  if (message.text !== lastCoachText) {
    $("coach").textContent = message.text;
    $("coach-tip").textContent = message.tip || "";
    $("coach-tip").hidden = !message.tip;
    lastCoachText = message.text;
  }
  if ($("opt-speech").checked) speaker.offer(message, now);
}

// The numbers behind each decision, for tuning thresholds.
function showNumbers(results) {
  const parts = Object.entries(results).map(([id, r]) => id + " " + (r.value === null ? "-" : r.value));
  $("numbers").textContent = parts.join("  |  ");
}

// ---- Text size ----

const TEXT_SCALE_MIN = 0.8; // TEAM TUNES THIS
const TEXT_SCALE_MAX = 1.6; // TEAM TUNES THIS
const TEXT_SCALE_STEP = 0.1;
let textScale = 1;

// Every size on the page is in rem, so one CSS variable scales everything.
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

$("start-button").addEventListener("click", handleStartCamera);
$("session-button").addEventListener("click", handleStartCheck);
$("reading-button").addEventListener("click", handleEnterReading);
$("stop-button").addEventListener("click", () => { handleStopCheck(); armAutoStart(); });
$("opt-auto").addEventListener("change", () => { if ($("opt-auto").checked && cameraOn) armAutoStart(); else autoStart.disarm(); });
$("text-larger").addEventListener("click", () => setTextScale(textScale + TEXT_SCALE_STEP));
$("text-smaller").addEventListener("click", () => setTextScale(textScale - TEXT_SCALE_STEP));
$("opt-demo").addEventListener("change", () => { $("demo-banner").hidden = !$("opt-demo").checked; });
$("opt-numbers").addEventListener("change", () => { $("numbers").hidden = !$("opt-numbers").checked; });
$("export-button").addEventListener("click", () => {
  $("export-status").textContent = downloadLog() ? "Downloaded." : "No session yet. Run a check first.";
});
document.addEventListener("keydown", handleTextKeys);
for (const button of document.querySelectorAll("[data-screen]")) {
  button.addEventListener("click", () => {
    showScreen(button.dataset.screen);
    if (button.dataset.screen === "check" && cameraOn && getPhase() === "setup") armAutoStart();
  });
}

// When the user switches apps, stop the camera and mic to save battery and privacy.
document.addEventListener("visibilitychange", () => {
  if (document.hidden && cameraOn) {
    cameraOn = false;
    stopTracking();
    handleStopCheck();
    setStatus("Camera paused. Tap Start camera to continue.");
  }
});

initReadings(showScreen);
showStep("setup");
loadPostureModel().catch((err) => console.warn("Posture model not loaded; rules only.", err));
showScreen("check");
