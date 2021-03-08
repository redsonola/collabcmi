import * as posenet from '@tensorflow-models/posenet';
import type { CameraVideo } from '../threejs/cameraVideoElement';
import { waitUntil } from './promiseHelpers';

export interface PosenetSetup {
  cleanup: () => void;
  getPose: () => Promise<posenet.Pose>;
  getSize: () => { width: number, height: number };
  updateConfig: (config: posenet.ModelConfig) => void;
  updateVideo: (CameraVideo) => void;
}

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

export async function initPosenet(
  _vid: CameraVideo,
  _config = defaultConfig
): Promise<PosenetSetup> {
  const timestamp = Date.now();
  console.log('starting posenet', timestamp);

  // deactivate after disposing, until it's replaced
  let active = true;

  let vid = _vid;
  let config = _config;

  let net = await posenet.load(config);

  function updateVideo(_vid: CameraVideo) {
    vid = _vid;
    const { width, height } = vid.getSize();
    if (!width || !height) throw new Error(`Video track needs dimensions, but was (${width}x${height}).`);

    vid.videoElement.width = width;
    vid.videoElement.height = height;
  }

  async function updateConfig(_config: posenet.ModelConfig) {
    config = _config;
    const lastNet = net;
    net = await posenet.load(config);
    active = true;
    lastNet.dispose();
  }

  updateVideo(_vid);
  updateConfig(_config);

  return {
    getSize() {
      return vid.getSize();
    },
    updateVideo,
    updateConfig,
    async getPose() {
      await waitUntil(() => active);
      return await net.estimateSinglePose(vid.videoElement, {
        flipHorizontal: false
      });
    },
    cleanup() {
      console.log('stopping posenet', timestamp);
      active = false;
      net.dispose();
    }
  };
}