import type * as posenet from '@tensorflow-models/posenet';
import type { PosenetSetup } from './mediapipePose';
import fileData from  '../../public/recordings/1602647813658.json';

interface File {
  keypoints: ({ timestamp: number, pose: posenet.Pose })[];
  video: { width: number, height: number };
}

// posenet.ModelConfig
interface MockPosenetConfig {
  file: File;
}

const defaultConfig: MockPosenetConfig = {
  file: fileData as File,
};
// {
//   architecture: "ResNet50",
//   outputStride: 32,
//   // multiplier: 0.75,
//   multiplier: 1,
//   inputResolution: { width: w, height: h },
// }

export function initPosenet(config = defaultConfig): PosenetSetup<MockPosenetConfig> {
  const startTime = Date.now();
  console.log('starting posenet mock', startTime);

  let running = true;
  const listeners: ((results: posenet.Pose) => void)[] = [];

  let i = 0;
  const interval = setInterval(() => {
    if (!running) return void clearInterval(interval);
    i++;
    if (i >= config.file.keypoints.length) i = 0;
    listeners.forEach(listen => {
      listen(config.file.keypoints[i].pose);
    })
  }, 100);

  return {
    getSize() {
      return config.file.video;
    },
    updateVideo () {},
    updateConfig () {},
    onResults: (listener) => {
      listeners.push(listener);
    },
    cleanup() {
      console.log('stopping posenet mock', startTime);
      running = false;
    }
  };
}
