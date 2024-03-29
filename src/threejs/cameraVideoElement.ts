import { writable } from 'svelte/store';
import type { Readable } from 'svelte/store';
import { waitUntil } from "./promiseHelpers";

function startCamera(videoElement: HTMLVideoElement): Promise<MediaStream> {
  if (navigator.mediaDevices.getUserMedia) {
    return navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: true })
    // return navigator.mediaDevices.getUserMedia({ video: { width: 160, height: 120 }, audio: true })

      .then((stream) => {
        videoElement.srcObject = stream;
        return stream;
      })
      .catch((err0r) => {
        console.error("Something went wrong starting camera!", err0r);
        throw err0r;
      });
  } else {
    return Promise.reject("navigator.mediaDevices.getUserMedia is false /* :( */");
  }
}

export interface VideoSize {
  width: number;
  height: number;
}

export interface CameraVideo {
  videoElement: HTMLVideoElement;
  getSize: () => VideoSize;
  stop: () => void;
  stream?: MediaStream;
}

const waitUntilLive = (source: MediaStream) =>
  waitUntil(() => source.getVideoTracks()[0].readyState === "live");

const waitUntilHasSize = (source: MediaStream) =>
  waitUntil(() => {
    const { width = 0, height = 0 } = source.getVideoTracks()[0].getSettings();
    return width !== 0 && height !== 0;
  });

const waitUntil4 = (videoElement: HTMLVideoElement) =>
  waitUntil(() => videoElement.readyState === 4);

// webcam if no url provided
export async function makeVideoElement(source?: string | MediaStream): Promise<CameraVideo | undefined> {
  const videoElement = document.createElement('video');
  videoElement.autoplay = true;

  if (!source || source === 'webcam') {
    console.log('making webcam video element');
    const stream = await startCamera(videoElement);
    console.log('got webcam stream', ...stream.getVideoTracks().map(t => t.getSettings()));
    await Promise.all([
      waitUntil4(videoElement),
      waitUntilHasSize(stream)
    ]);
    videoElement.muted = true; 
    return {
      videoElement,
      stream,
      stop() {
        stream.getVideoTracks()[0].stop();
      },
      getSize() {
        const { width = 0, height = 0 } = stream.getVideoTracks()[0].getSettings();
        return { width, height };
      }
    };
  } else if (typeof source === 'string') {
    console.log(`making video element for ${source}`);
    videoElement.loop = true;
    const videoSrcElement = document.createElement('source');
    videoSrcElement.src = source;
    videoSrcElement.type = "video/mp4";
    videoElement.append(videoSrcElement)

    console.log("can play mp4:", videoElement.canPlayType("video/mp4"));
    await waitUntil(() => videoElement.readyState === 4);
    return {
      videoElement,
      stop() {
        videoElement.pause();
      },
      getSize() {
        const { videoWidth, videoHeight } = videoElement;
        return { width: videoWidth, height: videoHeight };
      }
    };
  } else if (source) {
    console.log('making stream video element', source, ...source.getVideoTracks().map(t => t.getSettings()));
    await Promise.all([
      waitUntilLive(source),
      waitUntilHasSize(source)
    ]);
    console.log('has size', source, ...source.getVideoTracks().map(t => t.getSettings()));
    videoElement.srcObject = source;
    return {
      videoElement,
      stream: source,
      stop() {
        source.getVideoTracks()[0].stop();
      },
      getSize() {
        const { width = 0, height = 0 } = source.getVideoTracks()[0].getSettings();
        return { width, height };
      }
    };
  }
}

export interface WritableVideoStore {
  setSource: (source?: string | MediaStream) => void;
}

export function videoSubscription(source?: string | MediaStream): Readable<CameraVideo | null> & WritableVideoStore {
  let lastVideo: Promise<CameraVideo | undefined> | undefined;
  let lastSource = source;

  const store = writable<CameraVideo | null>(null, (set) => {
    // when going from 0 to 1 subscribers, create the video:
    lastVideo = makeVideoElement(source)
    lastVideo.then(val => set(val || null));

    return () => {
      // when going from 1 to 0 subscribers, stop it:
      lastVideo?.then(vid => vid?.stop());
    }
  });

  return {
    subscribe: store.subscribe,
    setSource(source?: string | MediaStream) {
      if (lastSource !== source) {
        if (lastVideo) {
          lastVideo = lastVideo
            .then(v => v?.stop())
            .then(() => makeVideoElement(source));
        } else {
          lastVideo = makeVideoElement(source);
        }
        lastVideo.then(video => store.set(video || null));
      }
      lastSource = source;
    }
  };
}