/**
 * @mediapipe/pose doesn't have types. It just loads shiz into the
 * global window object. pose.js is loaded as a classic <script> in
 * index.html (served from /mediapipe/pose/ by vite.config.ts).
 * google's example: https://codepen.io/mediapipe/pen/RwGWYJw
 */
import { Vector3 } from "three";

export class LandmarkVector3 extends Vector3 {
  label: PoseLandmark | undefined;
  visibility: number = 0;
  updateLandmark(landmark: LandmarkPoint, label: PoseLandmark) {
    this.set(landmark.x, landmark.y, landmark.z);
    this.label = label;
    this.visibility = landmark.visibility;
  }
}

export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface PoseResultEmpty {
  image: HTMLCanvasElement;
}

export interface PoseResultNotEmpty {
  image: HTMLCanvasElement;
  poseLandmarks: LandmarkPoint[];
}

export type PoseResult = PoseResultEmpty | PoseResultNotEmpty;

export function resultHasLandmarks(r?: PoseResult): r is PoseResultNotEmpty {
  return !!(r as PoseResultNotEmpty)?.poseLandmarks;
}

export interface PoseParams {
  locateFile: (file: string) => string;
}

export interface PoseOptions {
  modelComplexity: number,
  smoothLandmarks: boolean,
  minDetectionConfidence: number,
  minTrackingConfidence: number
}



export abstract class PoseClass {
  constructor(p: PoseParams) {
    throw new Error("Can't init this PoseClass, use the window.Pose")
  }

  abstract initialize(): Promise<void>;
  abstract onResults: (cb: (result: PoseResult) => void) => void;
  abstract send: (params: { image: HTMLVideoElement }) => Promise<void>;
  abstract setOptions: (opts: PoseOptions) => void;
  abstract close: () => void;
}

export type PoseLandmarkLeft =
  | "LEFT_ANKLE"
  | "LEFT_EAR"
  | "LEFT_ELBOW"
  | "LEFT_EYE"
  | "LEFT_EYE_INNER"
  | "LEFT_EYE_OUTER"
  | "LEFT_FOOT_INDEX"
  | "LEFT_HEEL"
  | "LEFT_HIP"
  | "LEFT_INDEX"
  | "LEFT_KNEE"
  | "LEFT_PINKY"
  | "LEFT_RIGHT"
  | "LEFT_SHOULDER"
  | "LEFT_THUMB"
  | "LEFT_WRIST";

export type PoseLandmarkNeutral =
  | "NOSE";

export type PoseLandmarkRight =
  | "RIGHT_ANKLE"
  | "RIGHT_EAR"
  | "RIGHT_ELBOW"
  | "RIGHT_EYE"
  | "RIGHT_EYE_INNER"
  | "RIGHT_EYE_OUTER"
  | "RIGHT_FOOT_INDEX"
  | "RIGHT_HEEL"
  | "RIGHT_HIP"
  | "RIGHT_INDEX"
  | "RIGHT_KNEE"
  | "RIGHT_LEFT"
  | "RIGHT_PINKY"
  | "RIGHT_SHOULDER"
  | "RIGHT_THUMB"
  | "RIGHT_WRIST";

export type PoseLandmark =
  | PoseLandmarkLeft
  | PoseLandmarkNeutral
  | PoseLandmarkRight;


const defaultGetPoseParams: PoseParams = {
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.3.1621277220/${file}`,
  // locateFile: (file) => `/mediapipe/pose/${file}`,
}

/**
 * Files @mediapipe/pose downloads before it can produce its first result, with their
 * decoded sizes in bytes (from node_modules/@mediapipe/pose; keep in sync with the
 * version pinned in locateFile above). The model is chosen by modelComplexity, but initPosenet
 * starts on 'lite' and then switches to the configured model, so both get fetched.
 */
const poseDownloadSizes: Record<string, number> = {
  'pose_solution_packed_assets_loader.js': 7855,
  'pose_solution_packed_assets.data': 7565664,
  'pose_solution_simd_wasm_bin.js': 326273,
  'pose_solution_simd_wasm_bin.wasm': 6849863,
  'pose_web.binarypb': 615,
  'pose_landmark_lite.tflite': 2955440,
  'pose_landmark_full.tflite': 6418272,
  'pose_landmark_heavy.tflite': 27308976,
};

const poseModelFiles = ['pose_landmark_lite.tflite', 'pose_landmark_full.tflite', 'pose_landmark_heavy.tflite'];

/**
 * Downloads the mediapipe files ahead of time so we can report real progress (0 to 1).
 * They're served with immutable cache headers, so when mediapipe asks for the same URLs
 * right afterwards, they come from the browser cache. Never rejects: if a download fails,
 * mediapipe will try (and report) on its own.
 */
export async function preloadPoseAssets(
  modelComplexity: number,
  onProgress: (fraction: number) => void,
  locateFile = defaultGetPoseParams.locateFile,
) {
  const wantedModel = poseModelFiles[modelComplexity] ?? poseModelFiles[1];
  const files = Object.keys(poseDownloadSizes).filter(
    f => !poseModelFiles.includes(f) || f === poseModelFiles[0] || f === wantedModel
  );
  const total = files.reduce((sum, f) => sum + poseDownloadSizes[f], 0);
  const loaded: Record<string, number> = {};
  const report = () => {
    const done = files.reduce((sum, f) => sum + Math.min(loaded[f] || 0, poseDownloadSizes[f]), 0);
    onProgress(Math.min(done / total, 1));
  };

  onProgress(0);
  await Promise.all(files.map(async (file) => {
    try {
      const response = await fetch(locateFile(file));
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      if (response.body) {
        const reader = response.body.getReader();
        loaded[file] = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          loaded[file] += value.byteLength;
          report();
        }
      } else {
        await response.arrayBuffer();
      }
    } catch (e) {
      console.warn(`Couldn't preload ${file}; mediapipe will fetch it itself.`, e);
    }
    loaded[file] = poseDownloadSizes[file];
    report();
  }));
}

export const getPose = (p?: Partial<PoseParams>) => {
  const params = { ...defaultGetPoseParams, ...p };
  return new (window as any).Pose(params) as PoseClass;
};

export const getPoseConnections: () => Readonly<[number, number][]> = () => (window as any).POSE_CONNECTIONS;
export const getPoseLandmarks: () => Readonly<Record<PoseLandmark, number>> = () => (window as any).POSE_LANDMARKS;
export const getPoseLandmarksLeft: () => Readonly<Record<PoseLandmarkLeft, number>> = () => (window as any).POSE_LANDMARKS_LEFT;
export const getPoseLandmarksNeutral: () => Readonly<Record<PoseLandmarkNeutral, number>> = () => (window as any).POSE_LANDMARKS_NEUTRAL;
export const getPoseLandmarksRight: () => Readonly<Record<PoseLandmarkRight, number>> = () => (window as any).POSE_LANDMARKS_RIGHT;

export function updateOrCreateLandmarkArray(landmarkVectors: LandmarkVector3[] = [], result?: PoseResult) {
  if (resultHasLandmarks(result)) {
    const { poseLandmarks } = result;
    Object.entries(getPoseLandmarks()).forEach(([label, index]) => {
      const vec = landmarkVectors[index] || new LandmarkVector3();
      landmarkVectors[index] = vec;
      const landmark = poseLandmarks[index];
      vec.updateLandmark(landmark, label as PoseLandmark);
    });
  }
  return landmarkVectors;
}