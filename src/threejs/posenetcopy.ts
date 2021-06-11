import '@tensorflow/tfjs-backend-webgl';
import * as posenet from '@tensorflow-models/posenet';
import type { CameraVideo } from './cameraVideoElement';
import type { PosenetSetup } from './mediapipePose';

// posenet.ModelConfig

const defaultConfig: posenet.ModelConfig = {
  architecture: 'MobileNetV1',
  outputStride: 16,
  inputResolution: { width: 255, height: 255 },
  multiplier: 0.75,
  // architecture: 'ResNet50',
  // outputStride: 32,
  // inputResolution: { width: 257, height: 200 },
  quantBytes: 2
};
// {
//   architecture: "ResNet50",
//   outputStride: 32,
//   // multiplier: 0.75,
//   multiplier: 1,
//   inputResolution: { width: w, height: h },
// }

export function initPosenet(
  // _vid: CameraVideo,
  _config = defaultConfig
): PosenetSetup<posenet.ModelConfig> {
  const timestamp = Date.now();
  console.log('starting posenet', timestamp);

  // deactivate after disposing, until it's replaced
  let active = true;

  let vid: CameraVideo | undefined;
  let config = _config;

  let net: posenet.PoseNet | undefined;
  posenet.load(config).then(_net => {
    net = _net
  });

  function updateVideo(_vid: CameraVideo) {
    vid = _vid;
    const { width, height } = vid.getSize();
    if (!width || !height) throw new Error(`Video track needs dimensions, but was (${width}x${height}).`);

    _vid.videoElement.width = width;
    _vid.videoElement.height = height;
  }

  async function updateConfig(_config: posenet.ModelConfig) {
    config = _config;
    const lastNet = net;
    net = await posenet.load(config);
    active = true;
    lastNet?.dispose();
  }

  updateConfig(_config);

  const listeners: ((results: posenet.Pose) => void)[] = [];
  async function getPose() {
    if (!net || !vid) {
      setTimeout(getPose, 100);
    } else if (active) {
      const pose = await net.estimateSinglePose(vid.videoElement, {
        flipHorizontal: false
      });
      listeners.forEach(listener => listener(pose));
      setTimeout(getPose);
    }
  }
  getPose();

  return {
    getSize() {
      if (vid)
        return vid.getSize();
      else
        return { width: 0, height: 0 };
    },
    updateVideo,
    updateConfig,
    onResults: (listener) => {
      listeners.push(listener);
    },
    cleanup() {
      console.log('stopping posenet', timestamp);
      active = false;
      net?.dispose();
    }
  };
}