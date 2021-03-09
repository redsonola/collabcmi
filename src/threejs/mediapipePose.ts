// FIXME
// there's a bunch of stuff named posenet, rename it to something more generic
// also, make it use 3js vectors instead of their point types

import * as posenet from '@tensorflow-models/posenet';
import * as pose from '../mediaPipePose';
import type { CameraVideo } from './cameraVideoElement';
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

export interface PosenetSetup {
  cleanup: () => void;
  onResults: (handler: (results: posenet.Pose) => void) => void;
  getSize: () => { width: number, height: number };
  updateConfig: (config: pose.PoseOptions) => void;
  updateVideo: (CameraVideo) => void;
}

const defaultConfig: pose.PoseOptions = {
  smoothLandmarks: true,
  upperBodyOnly: false,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
};

export function initPosenet(
  // _vid?: CameraVideo,
  config = defaultConfig
): PosenetSetup {
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
    if (!running) {
      nextPose();
    }
    const { width, height } = vid.getSize();
    if (!width || !height) throw new Error(`Video track needs dimensions, but was (${width}x${height}).`);

    vid.videoElement.width = width;
    vid.videoElement.height = height;
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
        const mapping = posenetToMediapipeIndices();
        const { width, height } = getSize();
        if (pose.resultHasLandmarks(result)) {
          let keypoints: posenet.Keypoint[] = []
          for (let i = 0; i < poseConstants.posePointCount; i++) {
            const landmark = result.poseLandmarks[mapping[i]];
            keypoints.push({
              position: { x: landmark.x * width, y: landmark.y * height },
              score: landmark.visibility,
              part: ""
            })
          }
          handler({ score: 1, keypoints });
        }
      });
    },
    cleanup() {
      running = false;
      console.log('stopping mediapipe', timestamp);
      net.close();
    }
  };
}