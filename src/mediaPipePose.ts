/**
 * @mediapipe/pose doesn't have types. It just loads shiz into the
 * global window object.
 * google's example: https://codepen.io/mediapipe/pen/jOMbvxw
 */
import * as pose from "@mediapipe/pose/pose";
import { Vector3 } from "three";

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

export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export type PoseLandmark =
  | PoseLandmarkLeft
  | PoseLandmarkNeutral
  | PoseLandmarkRight;
export class LandmarkVector3 extends Vector3 {
  label: PoseLandmark | undefined;
  visibility: number = 0;
  updateLandmark(landmark: LandmarkPoint, label: PoseLandmark) {
    this.set(landmark.x, landmark.y, landmark.z);
    this.label = label;
    this.visibility = landmark.visibility;
  }
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
  upperBodyOnly: boolean,
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

const defaultGetPoseParams: PoseParams = {
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
}

export const getPose = (p?: Partial<PoseParams>) => {
  const params = { ...defaultGetPoseParams, ...p };
  const instance = new pose.Pose(params) as PoseClass;
  return instance.initialize().then(() => instance);
};

export const getPoseConnections: () => Readonly<number[][]> = () => pose.POSE_CONNECTIONS;
export const getPoseLandmarks: () => Readonly<Record<PoseLandmark, number>> = () => pose.POSE_LANDMARKS;
export const getPoseLandmarksLeft: () => Readonly<Record<PoseLandmarkLeft, number>> = () => pose.POSE_LANDMARKS_LEFT;
export const getPoseLandmarksNeutral: () => Readonly<Record<PoseLandmarkNeutral, number>> = () => pose.POSE_LANDMARKS_NEUTRAL;
export const getPoseLandmarksRight: () => Readonly<Record<PoseLandmarkRight, number>> = () => pose.POSE_LANDMARKS_RIGHT;

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