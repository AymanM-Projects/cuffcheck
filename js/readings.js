// readings.js - the reading form, the Verified badge, the history list, the
// safety screen and the printable report. Stores only the numbers typed in
// and pass/fail results, in this browser's localStorage.

import { CHECK_LABELS } from "./engine.js";
import { attachReading } from "./sessionLog.js";

export const URGENT_SYSTOLIC = 180;  // from the safety rules
export const URGENT_DIASTOLIC = 120;
export const HIGH_SYSTOLIC = 130;
export const HIGH_DIASTOLIC = 80;
const STORAGE_KEY = "cuffcheck.readings";
const LIMITS = { systolic: [60, 260], diastolic: [30, 160], pulse: [30, 220] }; // TEAM TUNES THIS

// ---- Pure functions (tested in tests/app.test.js) ----

// Returns an error sentence, or null when the numbers look like a real reading.
export function validateReading({ systolic, diastolic, pulse }) {
  const values = { systolic, diastolic, pulse };
  for (const [name, [low, high]] of Object.entries(LIMITS)) {
    const value = values[name];
    if (!Number.isFinite(value)) return "Please enter your " + name + " number.";
    if (value < low || value > high) return `The ${name} number should be between ${low} and ${high}.`;
  }
  if (systolic <= diastolic) return "The top number (systolic) should be bigger than the bottom number.";
  return null;
}

// "urgent" shows the safety screen, "high" suggests sharing with a doctor.
export function classifyReading(systolic, diastolic) {
  if (systolic >= URGENT_SYSTOLIC || diastolic >= URGENT_DIASTOLIC) return "urgent";
  if (systolic >= HIGH_SYSTOLIC || diastolic >= HIGH_DIASTOLIC) return "high";
  return "normal";
}

// Numbers for the report. The average uses Verified readings only.
export function summarize(readings) {
  const verified = readings.filter((r) => r.verified);
  const mean = (key) => Math.round(verified.reduce((sum, r) => sum + r[key], 0) / verified.length);
  return {
    count: readings.length,
    verifiedCount: verified.length,
    percentVerified: readings.length ? Math.round((100 * verified.length) / readings.length) : 0,
    average: verified.length ? { systolic: mean("systolic"), diastolic: mean("diastolic"), pulse: mean("pulse") } : null,
  };
}

export function loadReadings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return []; // storage blocked (private mode) or damaged: start empty
  }
}

function saveReadings(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

// ---- Page code ----

let showScreen = null;  // given by main.js
let pendingCheck = null; // result of the camera check, or null for a manual entry
const $ = (id) => document.getElementById(id);

export function initReadings(showScreenFunction) {
  showScreen = showScreenFunction;
  $("reading-form").addEventListener("submit", handleSave);
  $("cancel-reading").addEventListener("click", () => showScreen("history"));
  $("report-button").addEventListener("click", () => { renderReport(); showScreen("report"); });
  $("print-button").addEventListener("click", () => window.print());
  $("manual-button").addEventListener("click", () => openReadingForm(null));
}

// Opens the form. checkResult comes from engine.finishReading(), or null.
export function openReadingForm(checkResult) {
  pendingCheck = checkResult;
  $("reading-form").reset();
  $("form-error").textContent = "";
  const preview = $("verified-preview");
  if (checkResult && checkResult.verified) {
    preview.textContent = "Verified: every check passed for the whole reading.";
    preview.className = "verified-preview badge-verified";
  } else {
    preview.textContent = "Not verified: " + problemText(checkResult) + ".";
    preview.className = "verified-preview badge-not";
  }
  showScreen("reading");
}

function handleSave(event) {
  event.preventDefault();
  const reading = {
    date: new Date().toISOString(),
    systolic: readNumber("systolic"),
    diastolic: readNumber("diastolic"),
    pulse: readNumber("pulse"),
    verified: Boolean(pendingCheck && pendingCheck.verified),
    failedChecks: pendingCheck ? pendingCheck.failedChecks : ["no camera check"],
    demo: Boolean(pendingCheck && pendingCheck.demo),
  };
  const error = validateReading(reading);
  if (error) {
    $("form-error").textContent = error;
    return;
  }
  const list = loadReadings();
  list.push(reading);
  if (!saveReadings(list)) $("form-error").textContent = "This browser would not save the reading.";
  attachReading(reading);
  const level = classifyReading(reading.systolic, reading.diastolic);
  if (level === "urgent") {
    showScreen("safety");
  } else {
    showScreen("history");
    $("high-note").hidden = level !== "high";
  }
}

// An empty box becomes NaN (not 0), so the form asks for the number.
function readNumber(id) {
  const text = $(id).value.trim();
  return text === "" ? NaN : Number(text);
}

// Fills the "My readings" list, newest first.
export function renderHistory() {
  const list = $("history-list");
  list.replaceChildren();
  $("high-note").hidden = true;
  const readings = loadReadings().slice().reverse();
  if (readings.length === 0) list.append(element("li", "No readings yet."));
  for (const r of readings) {
    const item = element("li");
    const numbers = element("span", `${r.systolic}/${r.diastolic} `, "history-bp");
    numbers.append(element("small", "mmHg"));
    item.append(numbers);
    item.append(element("span", r.verified ? "Verified" : "Not verified", r.verified ? "badge-verified" : "badge-not"));
    item.append(element("span", `Pulse ${r.pulse} · ${formatDate(r.date)}${r.demo ? " (demo mode)" : ""}`, "history-date"));
    list.append(item);
  }
}

// Builds the printable report. The user saves it with Print -> Save as PDF.
function renderReport() {
  const readings = loadReadings();
  const stats = summarize(readings);
  const box = $("report-content");
  box.replaceChildren();
  box.append(element("h2", "CuffCheck blood pressure report"));
  box.append(element("p", "Created " + formatDate(new Date().toISOString()) + "."));
  box.append(element("p", `Readings: ${stats.count}. Verified (correct technique): ${stats.verifiedCount} (${stats.percentVerified}%).`));
  box.append(element("p", stats.average
    ? `Average of verified readings: ${stats.average.systolic}/${stats.average.diastolic} mmHg, pulse ${stats.average.pulse}.`
    : "Average of verified readings: no verified readings yet."));
  box.append(element("p", "Only Verified readings are used for the average. Readings come from the user's own cuff."));
  const table = element("table");
  const head = element("tr");
  for (const title of ["Date", "Reading (mmHg)", "Pulse", "Verified"]) head.append(element("th", title));
  table.append(head);
  for (const r of readings) {
    const row = element("tr");
    for (const text of [formatDate(r.date), `${r.systolic}/${r.diastolic}`, String(r.pulse), r.verified ? "Yes" : "No"]) {
      row.append(element("td", text));
    }
    table.append(row);
  }
  box.append(table);
  box.append(element("p", "CuffCheck checks measurement technique. It does not measure blood pressure or give medical advice."));
}

// Plain words for why a reading is not verified.
function problemText(checkResult) {
  if (!checkResult) return "entered without the camera check";
  if (!checkResult.reachedMeasuring) return "not every check had passed yet when you entered it";
  const reasons = [];
  if (checkResult.failedChecks.length) {
    reasons.push("these checks slipped during the reading: " + checkResult.failedChecks.map((id) => CHECK_LABELS[id] || id).join(", "));
  }
  if (checkResult.tooShort) reasons.push("the reading took less than a real cuff reading");
  if (checkResult.shortRest) {
    reasons.push(checkResult.restSeconds > 0
      ? "you rested " + checkResult.restSeconds / 60 + " minute" + (checkResult.restSeconds === 60 ? "" : "s") + ", not the 5 minutes guidelines ask for"
      : "the rest timer was off; guidelines ask for 5 minutes of quiet rest first");
  }
  return reasons.join("; ");
}

function formatDate(iso) {
  return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

// Makes an element with text (textContent, so typed text is never run as code).
function element(tag, text = "", className = "") {
  const el = document.createElement(tag);
  el.textContent = text;
  if (className) el.className = className;
  return el;
}
