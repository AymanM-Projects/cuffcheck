// camera.js - the app's senses. Starts the camera, loads MediaPipe Pose and
// Face, runs them on every new video frame, draws the skeleton, and reads the
// microphone level. Everything runs inside the browser. No frame or sound is
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
const FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// ---- Tuning ----
const CAMERA_WIDTH = 640;        // TEAM TUNES THIS - smaller is faster on old phones
const CAMERA_HEIGHT = 480;
const FACE_EVERY_N_FRAMES = 3;   // TEAM TUNES THIS - the face model is slow, so skip frames
const LINE_COLOR = "#ffffff";
const LINE_OUTLINE = "#000000";  // a dark edge keeps white lines visible on light clothes

// ---- Module state ----
let vision = null;         // the MediaPipe library, loaded once
let poseLandmarker = null;
let faceLandmarker = null; // stays null if the face model fails; talking then uses the mic
let stream = null;
let animationId = null;
let lastVideoTime = -1;
let frameCount = 0;
let lastJawOpen = null;
let audio = null;          // { context, stream, analyser, samples } while the mic is on

// Turns the camera on and shows it in the <video>. facing is "user" (front)
// or "environment" (back). A modest size keeps phones fast.
export async function startCamera(videoEl, facing) {
  stopTracking(); // stop any old loop and camera first (switching cameras)
  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: facing }, width: { ideal: CAMERA_WIDTH }, height: { ideal: CAMERA_HEIGHT } },
    audio: false,
  });
  videoEl.srcObject = stream;
  await videoEl.play();
  if (videoEl.videoWidth === 0) {
    await new Promise((resolve) => videoEl.addEventListener("loadedmetadata", resolve, { once: true }));
  }
}

// Downloads MediaPipe (once) and builds the pose and face models. Tries the
// GPU first because it is much faster; falls back to the CPU.
export async function loadModels() {
  if (poseLandmarker) return;
  vision = await import(`${MEDIAPIPE_URL}/vision_bundle.mjs`);
  const files = await vision.FilesetResolver.forVisionTasks(WASM_URL);
  poseLandmarker = await withGpuOrCpu((delegate) => vision.PoseLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate },
    runningMode: "VIDEO", // "VIDEO" lets the model track between frames
    numPoses: 1,          // only the one person taking the reading
  }));
  try {
    faceLandmarker = await withGpuOrCpu((delegate) => vision.FaceLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: true, // gives the "jawOpen" score we use for talking
    }));
  } catch (err) {
    console.warn("Face model failed to load; talking will be checked with the microphone only.", err);
  }
}

async function withGpuOrCpu(create) {
  try {
    return await create("GPU");
  } catch (err) {
    console.warn("GPU not available, using CPU instead.", err);
    return create("CPU");
  }
}

// Runs the models on every new frame, draws the skeleton, and hands a frame
// summary to onFrame: { landmarks, worldLandmarks, jawOpen, micLevel }.
export function startTracking(videoEl, canvasEl, onFrame) {
  if (animationId) cancelAnimationFrame(animationId); // never run two loops
  const ctx = canvasEl.getContext("2d");
  canvasEl.width = videoEl.videoWidth;   // draw in the same pixel grid as the video
  canvasEl.height = videoEl.videoHeight;
  const aspect = videoEl.videoWidth / videoEl.videoHeight;
  lastVideoTime = -1;

  function loop() {
    // Only run the models when the video moved on to a NEW frame.
    if (videoEl.videoWidth > 0 && videoEl.currentTime !== lastVideoTime) {
      lastVideoTime = videoEl.currentTime;
      try {
        const now = performance.now();
        const pose = poseLandmarker.detectForVideo(videoEl, now);
        const landmarks = pose.landmarks[0] || null;
        drawSkeleton(ctx, landmarks);
        if (faceLandmarker && frameCount++ % FACE_EVERY_N_FRAMES === 0) {
          lastJawOpen = readJawOpen(faceLandmarker.detectForVideo(videoEl, now));
        }
        onFrame({
          landmarks: toPictureUnits(landmarks, aspect),
          worldLandmarks: pose.worldLandmarks[0] || null,
          jawOpen: lastJawOpen,
          micLevel: readMicLevel(),
        });
      } catch (err) {
        console.error("A model failed on this frame.", err); // one bad frame should not end the session
      }
    }
    animationId = requestAnimationFrame(loop);
  }
  animationId = requestAnimationFrame(loop);
}

export function stopTracking() {
  if (animationId) cancelAnimationFrame(animationId);
  animationId = null;
  if (stream) for (const track of stream.getTracks()) track.stop();
  stream = null;
}

// MediaPipe gives x as a fraction of the WIDTH and y as a fraction of the
// HEIGHT. Multiplying x by width/height puts both in the same units, so the
// checks measure true angles. (Drawing still uses the original numbers.)
function toPictureUnits(landmarks, aspect) {
  if (!landmarks) return null;
  return landmarks.map((p) => ({ ...p, x: p.x * aspect }));
}

// The face model scores 52 expressions from 0 to 1; "jawOpen" is how open the mouth is.
function readJawOpen(faceResult) {
  const shapes = faceResult.faceBlendshapes[0];
  if (!shapes) return null; // no face found this frame
  const jaw = shapes.categories.find((c) => c.categoryName === "jawOpen");
  return jaw ? jaw.score : null;
}

// ---- Microphone (only the loudness is used; nothing is recorded) ----

// Must be called from a button tap (phones only allow audio after a tap).
export async function startMicrophone() {
  if (audio) return;
  const micStream = await navigator.mediaDevices.getUserMedia({
    // Noise suppression helps ignore the steady hum of the cuff's pump.
    audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: false },
    video: false,
  });
  const context = new AudioContext();
  await context.resume();
  const source = context.createMediaStreamSource(micStream);
  const voiceFilter = context.createBiquadFilter(); // keep the speech range, drop low hum
  voiceFilter.type = "bandpass";
  voiceFilter.frequency.value = 1000; // TEAM TUNES THIS
  voiceFilter.Q.value = 0.7;
  const analyser = context.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(voiceFilter);
  voiceFilter.connect(analyser); // not connected to the speakers, so no echo
  audio = { context, stream: micStream, analyser, samples: new Float32Array(analyser.fftSize) };
}

export function stopMicrophone() {
  if (!audio) return;
  for (const track of audio.stream.getTracks()) track.stop();
  audio.context.close();
  audio = null;
}

// Loudness of the last few milliseconds (root mean square), or null if off.
function readMicLevel() {
  if (!audio) return null;
  audio.analyser.getFloatTimeDomainData(audio.samples);
  let sum = 0;
  for (const s of audio.samples) sum += s * s;
  return Math.sqrt(sum / audio.samples.length);
}

// ---- Drawing ----

// Lines between the standard body joints, then a dot on each visible joint.
function drawSkeleton(ctx, landmarks) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (!landmarks) return;
  ctx.lineCap = "round";
  for (const { start, end } of vision.PoseLandmarker.POSE_CONNECTIONS) {
    const a = landmarks[start], b = landmarks[end];
    if (!isSeen(a) || !isSeen(b)) continue; // never draw a bone we cannot see
    for (const [width, color] of [[7, LINE_OUTLINE], [3, LINE_COLOR]]) {
      ctx.beginPath();
      ctx.moveTo(a.x * w, a.y * h);
      ctx.lineTo(b.x * w, b.y * h);
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.stroke();
    }
  }
  for (const p of landmarks) {
    if (!isSeen(p)) continue;
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, 5, 0, Math.PI * 2);
    ctx.fillStyle = LINE_COLOR;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = LINE_OUTLINE;
    ctx.stroke();
  }
}
