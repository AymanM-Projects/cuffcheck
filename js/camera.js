// camera.js - starts the camera, loads MediaPipe Pose, and draws the skeleton
// on every new video frame. Everything runs inside the browser. No frame is
// ever saved, recorded or sent anywhere.

import { isSeen } from "./checks.js"; // same rule the checks use for "can't see"

// ---- Config: the ONE place where the MediaPipe version and model URLs live ----
export const MEDIAPIPE_VERSION = "1.1.1";
const MEDIAPIPE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}`;
const WASM_URL = `${MEDIAPIPE_URL}/wasm`;
const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
// If "lite" is jittery on your phone, try the bigger "full" model instead:
// "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task"

// ---- Tuning ----
const CAMERA_WIDTH = 640;          // TEAM TUNES THIS - smaller is faster on old phones
const CAMERA_HEIGHT = 480;
const LINE_COLOR = "#ffffff";
const LINE_OUTLINE = "#000000";    // a dark edge keeps white lines visible on light clothes

// ---- Module state (one camera, one model, one draw loop) ----
let PoseLandmarker = null; // the MediaPipe class, filled in by loadPoseModel()
let poseLandmarker = null; // the loaded model
let stream = null;         // the live camera stream
let animationId = null;    // handle for the draw loop so we can stop it
let lastVideoTime = -1;    // so we only run the model when a NEW frame arrived

// Turns the camera on and shows it in the <video>. facing is "user" (front)
// or "environment" (back). We ask for a modest size: the skeleton does not
// need HD, and smaller frames run faster on a phone.
export async function startCamera(videoEl, facing) {
  stopTracking(); // stop the old loop and camera first, so the model is never
                  // asked about a frame that does not exist yet (switching cameras)
  stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: facing }, // "ideal" so a laptop with one camera still works
      width: { ideal: CAMERA_WIDTH },
      height: { ideal: CAMERA_HEIGHT },
    },
    audio: false,
  });
  videoEl.srcObject = stream;
  await videoEl.play();
  await waitForVideoSize(videoEl);
}

// play() can resolve before the browser knows the frame size. The canvas
// needs that size, so wait for it.
function waitForVideoSize(videoEl) {
  return new Promise((resolve) => {
    if (videoEl.videoWidth > 0) return resolve();
    videoEl.addEventListener("loadedmetadata", () => resolve(), { once: true });
  });
}

// Downloads MediaPipe (once) and builds the pose model. Tries the GPU first
// because it is much faster; falls back to CPU on devices without WebGL.
export async function loadPoseModel() {
  if (poseLandmarker) return; // already loaded
  const vision = await import(`${MEDIAPIPE_URL}/vision_bundle.mjs`);
  PoseLandmarker = vision.PoseLandmarker;
  const files = await vision.FilesetResolver.forVisionTasks(WASM_URL);
  try {
    poseLandmarker = await createLandmarker(files, "GPU");
  } catch (err) {
    console.warn("GPU not available, using CPU instead.", err);
    poseLandmarker = await createLandmarker(files, "CPU");
  }
}

function createLandmarker(files, delegate) {
  return PoseLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate },
    runningMode: "VIDEO", // "VIDEO" lets the model track between frames
    numPoses: 1,          // we only care about the one person taking the reading
  });
}

// Runs the model on every new frame, draws the skeleton, and hands the
// landmarks to onLandmarks (the checks will use this from Milestone 2 on).
export function startTracking(videoEl, canvasEl, onLandmarks) {
  if (animationId) cancelAnimationFrame(animationId); // never run two loops
  const ctx = canvasEl.getContext("2d");
  canvasEl.width = videoEl.videoWidth;   // draw in the same pixel grid as the video
  canvasEl.height = videoEl.videoHeight;
  lastVideoTime = -1;

  function onFrame() {
    // The screen can refresh faster than the camera. Only run the model when
    // the video actually moved on, so we never waste work on the same frame.
    if (videoEl.videoWidth > 0 && videoEl.currentTime !== lastVideoTime) {
      lastVideoTime = videoEl.currentTime;
      try {
        const result = poseLandmarker.detectForVideo(videoEl, performance.now());
        const landmarks = result.landmarks[0] || null; // the first person, or null if nobody is seen
        drawSkeleton(ctx, landmarks);
        onLandmarks(landmarks);
      } catch (err) {
        // One bad frame should not silently end the whole session.
        console.error("Pose model failed on this frame.", err);
      }
    }
    animationId = requestAnimationFrame(onFrame);
  }
  animationId = requestAnimationFrame(onFrame);
}

// Stops the draw loop and turns the camera off (also saves battery when the
// page is hidden).
export function stopTracking() {
  if (animationId) cancelAnimationFrame(animationId);
  animationId = null;
  stopStream();
}

function stopStream() {
  if (!stream) return;
  for (const track of stream.getTracks()) track.stop();
  stream = null;
}

// Draws lines between the standard body joints, then a dot on each joint.
// Landmark x and y are fractions of the frame (0 to 1), so we multiply by
// the canvas size to get pixels.
function drawSkeleton(ctx, landmarks) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (!landmarks) return;

  for (const { start, end } of PoseLandmarker.POSE_CONNECTIONS) {
    const a = landmarks[start];
    const b = landmarks[end];
    if (!isSeen(a) || !isSeen(b)) continue; // never draw a bone we cannot see
    drawLine(ctx, a.x * w, a.y * h, b.x * w, b.y * h);
  }
  for (const p of landmarks) {
    if (isSeen(p)) drawDot(ctx, p.x * w, p.y * h);
  }
}

// A thick dark line with a thinner white line on top, so it shows on any background.
function drawLine(ctx, x1, y1, x2, y2) {
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineWidth = 7;
  ctx.strokeStyle = LINE_OUTLINE;
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = LINE_COLOR;
  ctx.stroke();
}

function drawDot(ctx, x, y) {
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fillStyle = LINE_COLOR;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = LINE_OUTLINE;
  ctx.stroke();
}
