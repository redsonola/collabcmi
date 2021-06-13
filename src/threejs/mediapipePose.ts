// FIXME
// there's a bunch of stuff named posenet, rename it to something more generic
// also, make it use 3js vectors instead of their point types

import * as posenet from '@tensorflow-models/posenet';
import * as pose from '../mediaPipePose';
import type { CameraVideo, VideoSize } from './cameraVideoElement';
import * as poseConstants from '../poseConstants';


const posenetToMediapipeIndices = () => {
  const landmarks = pose.getPoseLandmarks();
  return {
    [poseConstants.nose]: landmarks.NOSE,
    [poseConstants.leftEye]: landmarks.LEFT_EYE,
    [poseConstants.rightEye]: landmarks.RIGHT_EYE,
    [poseConstants.leftEar]: landmarks.LEFT_EAR,
    [poseConstants.rightEar]: landmarks.RIGHT_EAR,
    [poseConstants.leftShoulder]: landmarks.LEFT_SHOULDER,
    [poseConstants.rightShoulder]: landmarks.RIGHT_SHOULDER,
    [poseConstants.leftElbow]: landmarks.LEFT_ELBOW,
    [poseConstants.rightElbow]: landmarks.RIGHT_ELBOW,
    [poseConstants.leftWrist]: landmarks.LEFT_WRIST,
    [poseConstants.rightWrist]: landmarks.RIGHT_WRIST,
    [poseConstants.leftHip]: landmarks.LEFT_HIP,
    [poseConstants.rightHip]: landmarks.RIGHT_HIP,
    [poseConstants.leftKnee]: landmarks.LEFT_KNEE,
    [poseConstants.rightKnee]: landmarks.RIGHT_KNEE,
    [poseConstants.leftAnkle]: landmarks.LEFT_ANKLE,
    [poseConstants.rightAnkle]: landmarks.RIGHT_ANKLE,
  };
};

// from https://github.com/tensorflow/tfjs-models/tree/master/posenet#keypoints
const posenetIndicesToPartName = {
  0: "nose",
  1: "leftEye",
  2: "rightEye",
  3: "leftEar",
  4: "rightEar",
  5: "leftShoulder",
  6: "rightShoulder",
  7: "leftElbow",
  8: "rightElbow",
  9: "leftWrist",
  10: "rightWrist",
  11: "leftHip",
  12: "rightHip",
  13: "leftKnee",
  14: "rightKnee",
  15: "leftAnkle",
  16: "rightAnkle"
};

export interface PosenetSetup<T> {
  cleanup: () => void;
  onResults: (handler: (results: posenet.Pose) => void) => void;
  getSize: () => { width: number, height: number };
  updateConfig: (config: T) => void;
  updateVideo: (CameraVideo) => void;
}

// Supported/required config options:
// https://google.github.io/mediapipe/solutions/pose#javascript-solution-api
const defaultConfig: pose.PoseOptions = {
  modelComplexity: 1,
  smoothLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
};

export function mediapipeToPosenetKeypoints (result: pose.PoseResult, size: VideoSize): posenet.Keypoint[] | undefined {
  const mapping = posenetToMediapipeIndices();
  if (pose.resultHasLandmarks(result)) {
    let keypoints: posenet.Keypoint[] = []
    for (let i = 0; i < poseConstants.posePointCount; i++) {
      const landmark = result.poseLandmarks[mapping[i]];
      keypoints.push({
        position: { x: landmark.x * size.width, y: landmark.y * size.height },
        score: landmark.visibility,
        part: posenetIndicesToPartName[i]
      });
    }
    return keypoints;
  }
}


export function initPosenet(
  // _vid?: CameraVideo,
  config = defaultConfig
): PosenetSetup<pose.PoseOptions> {
  let running = false;
  const timestamp = Date.now();
  console.log('starting mediapipe', timestamp);

  // deactivate after disposing, until it's replaced
  let vid: CameraVideo | undefined;

  const net = pose.getPose();
  const inited = net.initialize().then(() => {
    running = true;
    nextPose();
    net.setOptions(config);
  })

  function updateVideo(_vid: CameraVideo) {
    vid = _vid;
    const { width, height } = vid.getSize();
    if (!width || !height) throw new Error(`Video track needs dimensions, but was (${width}x${height}).`);

    vid.videoElement.width = width;
    vid.videoElement.height = height;

    if (running) {
      nextPose();
    }
  }

  async function nextPose() {
    if (!running || !vid) {
      return;
    };
    await net.send({ image: vid.videoElement });
    setTimeout(nextPose);
  }

  async function updateConfig(config: pose.PoseOptions) {
    await inited;
    net.setOptions(config);
  }

  // if (_vid) updateVideo(_vid);
  updateConfig(config);


  function getSize() {
    return vid?.getSize() || { width: 0, height: 0 };
  }

  return {
    getSize,
    updateVideo,
    updateConfig,
    onResults: (handler) => {
      net.onResults(result => {
        const keypoints = mediapipeToPosenetKeypoints(result, getSize());
        // console.log({ result, keypoints })
        if (keypoints)
          handler({ score: 1, keypoints });
      });
    },
    cleanup() {
      running = false;
      console.log('stopping mediapipe', timestamp);
      net.close();
    }
  };
}