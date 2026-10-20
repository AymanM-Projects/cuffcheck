// sessionLog.js - for our study. Records each check's status (and the number
// behind it) once per second during a check, plus the final reading, and
// downloads it as a JSON file. It never stores video, images or landmarks.

let log = null;
let startTime = 0;
let lastSecond = -1;

// Starts a new log. settings = { cuffArm, camera, demoMode, microphone }.
export function startLog(settings, now = Date.now()) {
  log = { app: "CuffCheck", format: 1, started: new Date(now).toISOString(), settings, seconds: [], reading: null };
  startTime = now;
  lastSecond = -1;
}

// Adds one entry per second; extra frames in the same second are skipped.
export function logResults(results, phase, now = Date.now()) {
  if (!log) return;
  const second = Math.floor((now - startTime) / 1000);
  if (second === lastSecond) return;
  lastSecond = second;
  const checks = {}, values = {};
  for (const [id, result] of Object.entries(results)) {
    checks[id] = result.status;
    values[id] = result.value;
  }
  log.seconds.push({ t: second, phase, checks, values });
}

// Stores the saved reading (numbers and pass/fail only) with this session.
export function attachReading(reading) {
  if (log) log.reading = reading;
}

export function getLog() {
  return log;
}

// Downloads the log as cuffcheck-session-<date>.json. Returns false if empty.
export function downloadLog() {
  if (!log) return false;
  const blob = new Blob([JSON.stringify(log, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "cuffcheck-session-" + localStamp(new Date(log.started)) + ".json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

// "2026-10-20-14-04" in the phone's own time zone, so file names match the clock.
function localStamp(date) {
  const two = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}-${two(date.getHours())}-${two(date.getMinutes())}`;
}
