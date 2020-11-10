import Posenet from './Posenet.svelte';
import { threeRenderCode } from '../draw3js';

import files from "../stories/recordingFileList.json";

const videos = [
  "/spacebtwTest.mp4",
  "/synchTestVideo.mp4"
];

export default {
  title: 'Video/Posenet',
  component: Posenet,
  argTypes: {
    debugPanelExpanded: { control: 'boolean' },
    multipleVideos: { control: 'boolean' },
    videoSrc: {
      control: {
        type: "select",
        options: ["webcam", ...videos],
      }
    },
    poseSource: {
      control: {
        type: "select",
        options: ['posenet', ...files],
      }
    }
  },
};

function extraVideos(addExtra = false) {
  if (addExtra) {
    return [{
      videoSrc: "/spacebtwTest.mp4",
      poseSource: files[1]
    }, {
      videoSrc: "/synchTestVideo.mp4",
      poseSource: 'posenet'
    }];
  } else {
    return [];
  }
}

const Template = (args) => ({
  Component: Posenet,
  props: {
    threeRenderCode,
    videos: [{
      poseSource: args.poseSource || files[0],
      videoSrc: args.videoSrc || 'webcam'
    }, ...extraVideos(args.multipleVideos)],
    ...args
  }
});

export const Webcam = (args) => Template(args);
Webcam.args = {
  debugPanelExpanded: false,
  multipleVideos: false,
  videoSrc: "webcam",
  poseSource: 'posenet'
};

export const RecordedVideo = (args) => Template(args);
RecordedVideo.args = {
  debugPanelExpanded: false,
  multipleVideos: false,
  videoSrc: videos[0],
  poseSource: 'posenet'
};

export const PoseData = (args) => Template(args);
PoseData.args = {
  debugPanelExpanded: true,
  multipleVideos: false,
  videoSrc: "webcam",
  poseSource: 'posenet'
};

export const RecordedData = (args) => Template(args);
RecordedData.args = {
  debugPanelExpanded: false,
  multipleVideos: false,
  videoSrc: videos[1],
  poseSource: files[1]
};

export const MultipleVideos = (args) => Template(args);
RecordedData.args = {
  debugPanelExpanded: false,
  multipleVideos: true,
  videoSrc: "webcam",
  poseSource: 'posenet'
};

export const StressTest = (args) => ({
  Component: Posenet,
  props: {
    threeRenderCode,
    videos: [{
      poseSource: 'posenet',
      videoSrc: 'webcam'
    }, {
      poseSource: 'posenet',
      videoSrc: 'webcam'
    }, {
      poseSource: 'posenet',
      videoSrc: 'webcam'
    }, {
      poseSource: 'posenet',
      videoSrc: 'webcam'
    }],
    ...args
  }
});
