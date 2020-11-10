import type { Pose } from '@tensorflow-models/posenet';
import type { PosenetSetup } from './posenet';

export const safeFileName: ((string) => string | void) = (str: string | null | undefined) => {
  if (!str) return;
  const sanatized = str.match(/\w+/g)?.join('__');
  if (sanatized) return sanatized + '.json';
}

export interface PoseRecord {
  timestamp: number;
  pose: Pose;
}

export interface RecordedFile {
  keypoints: PoseRecord[];
  video: { width: number, height: number };
}

export function makeFile(data: RecordedFile, name?: string) {
  const fileName = safeFileName(name);
  const url = fileName
    ? `/api/write-recording?=${fileName}`
    : '/api/write-recording';

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
    .then((res) => res.json())
    .then((res) => console.log(res));
}

export function selectedFilePoseSource(selectedFile: string) {
  return () => fetch(`/recordings/${selectedFile}`)
    .then(res => res.json())
    .then((file: RecordedFile): PosenetSetup => {
      let i = 0;
      return {
        updateConfig (config) { /* noop */ },
        updateVideo (vid) { /* noop */ },
        getSize() { return file.video; },
        getPose: () => {
          const { keypoints } = file;
          const { length } = keypoints;
          if (++i >= length) {
            i = 0;
          }
          return new Promise(ok => {
            // play keypoints back at the rate they were recorded
            if (i > 0) {
              const lastTime = keypoints[i - 1].timestamp;
              const thisTime = keypoints[i].timestamp;
              setTimeout(ok, thisTime - lastTime, keypoints[i].pose);
            } else {
              setTimeout(ok, 1000, keypoints[i].pose);
            }
          });
        },
        cleanup() { }
      }
    });
}
