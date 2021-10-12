// import 'headjs/dist/1.0.0/head.js';
// import { loadWasmRectFinder } from './findRects';

// https://d36jrbyzk88a80.cloudfront.net/

//bodypix
//https://www.npmjs.com/package/@tensorflow-models/body-pix/v/1.1.2

//posenet import -- CDB 5/18/2020
//https://github.com/tensorflow/tfjs-models/blob/master/posenet/demos/camera.js
// import * as posenet from '@tensorflow-models/posenet';

import * as Tone from "tone";
import * as soundDesign from './soundDesignSpaceBtwSketch1.js';

import Peer from 'peerjs/dist/peerjs.js';

import * as SpaceBtwMessage from "./SpaceBtwMessage.js";
import { Participant } from "./participant.ts"

import { SonifierWithTuba } from "./xcorrSonify.ts";

import * as Scale from './scale.ts';

import * as THREE from 'three';

import { Tango332Riffs } from './midiConversion'

const USING_TEST_VIDEO = true;

var FLIP_SELFPORTRAIT = true; 




var videoWidth;
var videoHeight;

const imageScaleFactor = 0.50;
const flipHorizontal = false;
const outputStride = 16;

const defaultResNetMultiplier = 1.0;
const defaultResNetStride = 32;
const defaultResNetInputResolution = 250;

const useWebWorkers = false;
const LOG_POSES = false;

var peer;
var callerID = "";
//var serverParams = {host:'peerjs-server.herokuapp.com', secure:false};
// var serverParams = { host: window.location.hostname, secure: true, port: 9000, path: '/peerServer' };
var serverParams = { host: 'spacebtw-peerserver.herokuapp.com', secure: true, port: 443, path: '/'};
let peerCreated = false;
var peerjsDataConn = null;

var otherPersonPoseKeypoints = null;

//the dimensions of the other person's video.
var otherPersonNativeVideoWidth = 0;
var otherPersonNativeVideoHeight = 0;
var otherPersonSize = null; 

//finding sample per sec 
var poseSampleCount = 0; 
var startPoseMillis = 0; 
var startedPoseMilisCount = false;
var endPoseMillis = 0; 

var skeletonHatchedLines = null;

//try creating threejs stuff here?
let scene = null; 
let camera = null; 
let renderer = null; 

// const curDxLabel = document.getElementById('curDX');

function startThreeJS(w, h)
{
  throw new Error('startThreeJS main.js???')
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera( 75, w / h, 0.1, 1000 );

    renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setSize( w, h );
    // document.body.appendChild( this.renderer.domElement );
}

// Did you try to use relay server?
//CDB: nope, but I fixed my problems anyways.

// const peer = new Peer('randomId', { config: {
//   iceServers: [
//     { urls: "stun:stun.l.google.com:19302" },
//     { urls: "turn:0.peerjs.com:3478", username: "peerjs", credential: "peerjsp" }
//   ],
//   sdpSemantics: "unified-plan",
//   iceTransportPolicy: "relay" // <- it means using only relay server (our free turn server in this case)
// }});
// ...


let myVideoStream;




// init();

async function getPoseNet(w, h) {
  const n = await posenet.load({
    architecture: 'MobileNetV1',
    outputStride: 16,
    inputResolution: { width: w, height: h },
    multiplier: 0.75,
    // architecture: 'ResNet50',
    // outputStride: 32,
    // inputResolution: { width: 257, height: 200 },
     quantBytes: 2
  });
  // const n = await posenet.load({
  //   architecture: "ResNet50",
  //   outputStride: 32,
  //   // multiplier: 0.75,
  //   multiplier: 1,
  //   inputResolution: { width: w, height: h },
  // });
  return n;
}

async function getPose(vid, net, w, h) {
  throw new Error("getPose in main shouldn't run")
  //must add the following
  vid.width = w;
  vid.height = h;
  const pose = await net.estimateSinglePose(vid, {
    flipHorizontal: flipHorizontal,
    decodingMethod: 'single-person'
    // multiplier: 0.75, 
    // outputStride: 16
    // inputResolution: { width: w, height: h }
  });
  return pose;
}

function createPeer(yrID) {
  if (!(callerID === yrID)) {
    callerID = yrID;
    peer = new Peer(yrID, serverParams);
    peer.options.bundlePolicy = "max-bundle";
    peer.on('error', function (err) { console.log(err) });

    //   peer.on('open', function (id) {
    //     // Workaround for peer.reconnect deleting previous id
    //     if (peer.id === null) {
    //         console.log('Received null id from peer open');
    //         peer.id = yrID;
    //     }
    //     console.log('ID: ' + yrID);

    // });

    peerCreated = true;
  }
}

//temporary
let dxLabel;
let minThreshSlider; 
let midiFile; 

// set up the video stuff & procesing stuff
export function init() {

  dxLabel = document.getElementById('dxID');
  minThreshSlider = document.getElementById('minimimThresSlider'); 

  let usingWebCam = true; 

  let streaming = false;
  const videoElement = document.querySelector("#videoElement");
  const videoElementCalled = document.querySelector("#videoElementCalled");

  const poseVideo = document.getElementById('videoElement');

  //to send video
  const callButton = document.getElementById('callButton');
  const submitButton = document.getElementById('submitButton');
  const yourID = document.getElementById('yourID');
  const callingID = document.getElementById('callingID');
  const status = document.getElementById('status');

  //test video
  const testVideo = document.querySelector("#testVideo");
  const playTestVideo = document.getElementById('playTestButton');


  //to send data
  const sendButton = document.getElementById('sendButton');
  const receivedMessages = document.getElementById('messages');
  const sendMessages = document.getElementById('sendMessages');

  let participant = new Participant();
  let friendParticipant = null; //the person that you call 
  let xcorrSonify = new SonifierWithTuba(participant); //ohhhh just doing this now.

  


  startCamera(videoElement);

  //start the audio engine when the video begins to play
  videoElement.addEventListener('play', async () => {
    await Tone.start();
    console.log('audio is ready');


      /************ TESTING SOUND *************/
      midiFile = new Tango332Riffs(); 
      await midiFile.parseFile('./perc_midi/base_w_more.mid'); 
      midiFile.startLoop(); 



    /************** END TESTING SOUND *******************/


    // soundpart.startSound(); 
    soundDesign.setup(Tone);
  });

  //if using the test video, then this will subsitutue for the webcam (todo)
  playTestVideo.addEventListener("click", () => {
    if(usingWebCam){
      videoElement.pause();
      testVideo.pause();
      testVideo.loop = true; 
      testVideo.play();
      playTestVideo.innerText = "Use Web Cam";
      myVideoStream = testVideo.captureStream();
    }
    else
    {
      testVideo.pause();
      testVideo.loop = false; 
      videoElement.pause();
      videoElement.play();   
      myVideoStream = videoElement.srcObject;

      playTestVideo.innerText = "Use Test Video";
    }
    usingWebCam = !usingWebCam; 
  });

  //send messages to another user via peerjs
  sendButton.addEventListener("click", () => {
    if (peerjsDataConn != null) {
      let msg = SpaceBtwMessage.spBtwMessage(SpaceBtwMessage.STRING_MESSAGE, sendMessages.value);
      peerjsDataConn.send(msg);
    }
    else {
      status.innerText = "No connection has been established. Call another user before proceeding.";
    }

  });

  //create a peerjs object to handle answering calls when button is clicked.
  submitButton.addEventListener("click", () => {
    createPeer(yourID.value);

    status.innerText = "Created ID in Peer system";

    //answer a call
    peer.on('call', function (call) {

      if (!streaming) {
        status.innerText = "Video and Pose Detection has not been loaded. Cannot answer user.";
        return;
      }
      else {
        status.innerText = "Answering...";
      }
      if(usingWebCam){
        call.answer(videoElement.srcObject); // Answer the call with an A/V stream.
      }
      else 
      {
        call.answer(testVideo.captureStream()); // Answer the call with an A/V stream.
      }
      call.on('stream', function (remoteStream) {
        // Show stream in some video/canvas element.        
        videoElementCalled.srcObject = remoteStream;
        restartCurrentVideo(videoElement, testVideo, usingWebCam);
        // const { width, height } = videoElementCalled.srcObject.getVideoTracks()[0].getSettings();
        // otherPersonNativeVideoWidth = width; 
        // otherPersonNativeVideoHeight = height; 
      });
    }, function (err) {
      console.log('Failed to get local stream', err);
    });


    //also create an event listener for data connections
    peer.on('connection', function (conn) {
      peerjsDataConn = conn;
      friendParticipant = new Participant();
      participant.addFriendParticipant(friendParticipant); 
      peerjsDataConn.on('data', function (data) {
        // console.log(data);
        if (data.dataType === SpaceBtwMessage.STRING_MESSAGE) {
          receivedMessages.innerText = data.data;
        }
        else if (data.dataType === SpaceBtwMessage.KEYPOINTS_MESSAGE) {
          otherPersonPoseKeypoints = data.data;
          friendParticipant.addKeypoint(otherPersonPoseKeypoints);
          // status.innerText = "Got someone else's pose data";
        }
        else if(data.dataType == SpaceBtwMessage.VIDEOSIZE_MESSAGE)
        {
          otherPersonSize = data.data;
          friendParticipant.setSize(otherPersonSize.width, otherPersonSize.height);
        }
      });
    });

    status.innerText = "Ready to answer calls.";

  });

  callButton.addEventListener("click", () => {
    if (!streaming) {
      status.innerText = "Video and Pose Detection has not been loaded. Cannot call user.";
      return;
    }
    else {
      status.innerText = "Calling...";
    }

    const callID = callingID.value;
    if (!peerCreated) //won't overwrite if it has been created, but will create if needed
    {
      createPeer(yourID.value);
    }

    //call some other use via an id
    var call = peer.call(callID, myVideoStream);
    status.innerText = "Created the call...";

    call.on('stream', function (remoteStream) {
      //show stream in video or canvas
      console.log("Nothing has failed so far");
      videoElementCalled.srcObject = remoteStream;
      restartCurrentVideo(videoElement, testVideo, usingWebCam);
      // const { width, height } = videoElementCalled.srcObject.getVideoTracks()[0].getSettings();
      // otherPersonNativeVideoWidth = width; 
      // otherPersonNativeVideoHeight = height; 
    }, function (err) {
      console.log('Failed to get local stream', err);
    });

    //clean up if a previous instance exists.
    if(peerjsDataConn != null)
    {
      peerjsDataConn.close(); 
    } 

    //get a data connection in order to send skeleton data
    peerjsDataConn = peer.connect(callID, {reliable: false});
    friendParticipant = new Participant();
    participant.addFriendParticipant(friendParticipant); 
    peerjsDataConn.on('data', function (data) {
      // console.log(data);
      if (data.dataType === SpaceBtwMessage.STRING_MESSAGE) {
        receivedMessages.innerText = data.data;
      }
      else if (data.dataType === SpaceBtwMessage.KEYPOINTS_MESSAGE) {
        otherPersonPoseKeypoints = data.data;
        friendParticipant.addKeypoint(otherPersonPoseKeypoints);
        // status.innerText = "Got someone else's pose data";
      }
      else if(data.dataType == SpaceBtwMessage.VIDEOSIZE_MESSAGE)
      {
        otherPersonSize = data.data;
        friendParticipant.setSize(otherPersonSize.width, otherPersonSize.height)

      }
    }, function (err) {
      console.log('Failed to get local stream', err);});
      

  });

  //TODO: this entire file needs to be refactored!!
  let testVideoStreaming = false;
  testVideo.addEventListener('play', () => {

    const outputCanvas = document.querySelector('#outputImage');
    const outputCanvas2 = document.querySelector('#outputImage2');

    setUpPoseAndVideoActions(outputCanvas, outputCanvas2, testVideo, false, participant, friendParticipant, xcorrSonify, videoElementCalled);
    streaming = true; 

    window.tv = testVideo;

  });

  videoElement.addEventListener('play', () => {

    const outputCanvas = document.querySelector('#outputImage');
    const outputCanvas2 = document.querySelector('#outputImage2');

    setUpPoseAndVideoActions(outputCanvas, outputCanvas2, videoElement, true, participant, friendParticipant, xcorrSonify, videoElementCalled);
    streaming = true; 


  });

  //start test video, if applicable. 
  // if (USING_TEST_VIDEO) {
  //   testVideo.play();
  // }

}

//****************************************/
/* Code taken from here: https://github.com/tensorflow/tfjs-models/tree/master/posenet */

//draw point on canvas
function drawPoint(ctx, y, x, r, color) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
}

/**
 * Draw pose keypoints onto a canvas
 */
function drawKeypoints(keypoints, minConfidence, ctx, scale = 1) {
  const color = 'aqua';
  for (let i = 0; i < keypoints.length; i++) {
    const keypoint = keypoints[i];

    if (keypoint.score < minConfidence) {
      continue;
    }

    const { y, x } = keypoint.position;
    drawPoint(ctx, y * scale, x * scale, 3, color);
  }
}

function drawKeypointsUsingRatio(keypoints, minConfidence, ctx, ratio) {
  const color = 'aqua';
  for (let i = 0; i < keypoints.length; i++) {
    const keypoint = keypoints[i];

    if (keypoint.score < minConfidence) {
      continue;
    }

    const { y, x } = keypoint.position;
    drawPoint(ctx, y * ratio.height, x * ratio.width, 3, color);
  }
}

function poseMatchToPixelSize(matchScore) {
    //uses the max for distance.
    let matchMin = 0; //just cut-off lower values to create more spread in higher
    let matchMax = 0.25;
    let pixelMin = 1;
    let pixelMax = 100;
  
    // let pixelSz = Scale.linear_scale(matchScore, matchMin, matchMax, pixelMin, pixelMax);
    let pixelSz = Scale.linear_scale(matchScore, matchMin, matchMax, pixelMin, pixelMax, true); //try flipping

    // pixelSz = pixelMax - pixelSz;

    return pixelSz;
}


function xCorrToPixelSize(xCorr, xCorrImax) {
  // let xCorrMin = - 1;
  // let xCorrMax = 1;
  // let pixelMin = 2;
  // let pixelMax = 50;

  // return Scale.linear_scale(xCorr, xCorrMin, xCorrMax, pixelMin, pixelMax);
  //change to the derivative
  // let xCorrMin = -0.2879;
  // let xCorrMax = 0.2175;

  //uses the Max for the dx
  // let xCorrMin = -1;
  // let xCorrMax = 1;
  // let pixelMin = 2;
  // let pixelMax = 40;

  let xCorrMin = -1;
  let xCorrMax = 0.5;
  let pixelMin = 2;
  let pixelMax = 100;

  //uses the max for distance.
  // let xCorrMin = -1; //just cut-off lower values to create more spread in higher
  // let xCorrMax = 1;
  // let pixelMin = 1;
  // let pixelMax = 100;

  let maxPart =  Scale.exp_scale(xCorr, xCorrMin, xCorrMax, pixelMin, pixelMax);

    //uses the iMax (lags)
    let xCorriMin = -4;
    let xCorriMax = 2;
    let pixeliMin = 2;
    let pixeliMax = 90;

  let iMaxPart =  Scale.exp_scale(xCorrImax, xCorriMin, xCorriMax, pixelMin, pixelMax);

  return maxPart*1.0 + iMaxPart*0.0; 
}

function xCorrBodyPartToPixelSize(xCorr) {

  let xCorrMin = -1;
  let xCorrMax = 0.75;
  let pixelMin = 2;
  let pixelMax = 100;

  let maxPart =  Scale.exp_scale(xCorr, xCorrMin, xCorrMax, pixelMin, pixelMax);

  return maxPart; 
}

export function findRadiusOfKeypoint(participant, index) {

  // if (index !== -1) {
    // return xCorrToPixelSize(participant.getCurrXCorrMax(index)); 
    // return xCorrToPixelSize(participant.getCurrXCorrMaxDx(index), participant.getCurriMaxDx(index)); //change to the velocity/derivative
    return xCorrToPixelSize(participant.getDistXCorrMax(index), participant.getDistXCorrMax(index)); //change to the pixel distance
}

//CDB --> modified previous function so that radius of dots is bigger where there is more synch btw participants 
//varying with the velocity of the body angles 7/3/2020
function drawKeypointsSizeVaryWithXCorr(participant, friendParticipant, keypoints, minConfidence, ctx, scale = 1) {
  if (friendParticipant == null) return;

  const color = 'aqua';
  for (let i = 0; i < keypoints.length; i++) {
    const keypoint = keypoints[i];

    if (keypoint.score < minConfidence) {
      continue;
    }

    const { y, x } = keypoint.position;
    drawPoint(ctx, y * scale, x * scale, findRadiusOfKeypoint(participant, i), color);
    // drawPoint(ctx, y * scale, x * scale, 5, color);

  }
}

function drawMatchPoint( ctx, x, y, matchscore )
{
  const color = 'blue';
  drawPoint(ctx, x, y, poseMatchToPixelSize( matchscore ), color) 
}

function drawAvgXCorr( ctx, x, y, xcorr, match )
{
  const color = 'purple';
  let pixelSize = xCorrBodyPartToPixelSize( xcorr, xcorr ); 
  // if(pixelSize > 25) pixelSize = pixelSize*0.7 + poseMatchToPixelSize(match)*0.3; 
  drawPoint(ctx, x, y, pixelSize, color) 


   pixelSize = pixelSize*0.5 + poseMatchToPixelSize(match)*0.5; 

  //draw combined score
  drawPoint(ctx, x-100, y, pixelSize, 'red') ;

}

function getMixedSynchronicityMeasure(xcorr, match)
{
    let matchMin = 0; //just cut-off lower values to create more spread in higher
    let matchMax = 0.25;

    let xCorrMin = -1;
    let xCorrMax = 0.6;  
  
    // let pixelSz = Scale.linear_scale(matchScore, matchMin, matchMax, pixelMin, pixelMax);
    let matchScore = Scale.linear_scale(match, matchMin, matchMax, 0, 1, true); //try flipping
    let xcorrScore = Scale.exp_scale(xcorr, xCorrMin, xCorrMax, 0, 1); 

    return matchScore*0.5 + xcorrScore*0.5; 

}

function toTuple({y, x}) {
  return [y, x];
}

/**
 * Draws a line on a canvas, i.e. a joint
 */
export function drawSegment([ay, ax], [by, bx], color, scale, ctx) {
  ctx.beginPath();
  ctx.moveTo(ax * scale, ay * scale);
  ctx.lineTo(bx * scale, by * scale);
  ctx.lineWidth = 5;
  ctx.strokeStyle = color;
  ctx.stroke();
}

/**
 * Draws a pose skeleton by looking up all adjacent keypoints/joints -- from posenet demo
 */
export function drawSkeleton(keypoints, minConfidence, ctx, scale = 1) {
  const color = 'blue';

  const adjacentKeyPoints =
      posenet.getAdjacentKeyPoints(keypoints, minConfidence);


  adjacentKeyPoints.forEach((keypoints) => {
    drawSegment(
        toTuple(keypoints[0].position), toTuple(keypoints[1].position), color,
        scale, ctx);
  });
}

//****************************************/


function rectFinder() {
  // the findRect function takes a callback, but the worker
  // thread only has 1 listener. Take a callback and just
  // assign it to a variable. The worker thread will just
  // call the last used callback function. Not ideal, but
  // it should always work in this case.
  let cb = () => { };
  // note: the worker.js file is built by parcel, see the package.json
  // file.
  const sendDataToWorker = makeWorker('worker.js', (data) => cb(data));

  return (videoData, width, height, callback) => {
    cb = callback;
    sendDataToWorker({ videoData, width, height });
  }
}

// we could use a stream, or we could just do this:
// Takes a js file and a function that's called when the webworker responds
// Returns a function to call the webworker
function makeWorker(filename, onMessage) {
  const worker = new Worker(filename);

  worker.addEventListener('message', e => onMessage(e.data.result));

  return data => {
    worker.postMessage({ data });
  };
}

function drawLine(context, [x1, y1, x2, y2]) {
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.lineWidth = 10;
  context.strokeStyle = '#00FF00';
  context.stroke();
}


function startCamera(videoElement) {
  if (navigator.mediaDevices.getUserMedia) {
    return navigator.mediaDevices.getUserMedia({ video: true })
      .then(function (stream) {
        videoElement.srcObject = stream;
        myVideoStream = stream;
      })
      .catch(function (err0r) {
        console.error("Something went wrong starting camera!", err0r);
        throw err0r;
      });
  } else {
    return Promise.reject("navigator.mediaDevices.getUserMedia is false /* :( */");
  }
}

function resizeElement(element, width, height) {
  element.width = width;
  element.height = height;
}

// returns a function that returns the video data
function videoDataGetter(videoElement, width, height) {
  const canvas = document.createElement('canvas');
  resizeElement(canvas, width, height);
  const ctx = canvas.getContext('2d');

  return function getVideoData() {
    ctx.drawImage(videoElement, 0, 0);

    const { data } = ctx.getImageData(0, 0, width, height);

    return data;
  }
}

// returns a function that returns the video data
function videoDataGetter3(videoElement, width, height) {
  const canvas = document.createElement('canvas');
  resizeElement(canvas, width, height);
  const ctx = canvas.getContext('2d');

  return function getVideoData() {
    ctx.drawImage(videoElement, 0, 0, width, height);

    const { data } = ctx.getImageData(0, 0, width, height);

    return data;
  }
}

//OMFG refactor -- get the remote video
function videoDataGetter2(videoElement2, x, y, width, height) {
  const canvas = document.createElement('canvas');
  resizeElement(canvas, width, height);
  const ctx = canvas.getContext('2d');

  return function getVideoData2() {
    ctx.drawImage(videoElement2, x, y);

    const { data } = ctx.getImageData(x, y, width, height);

    return data;
  }
}

function drawOnCanvas(outputCanvas, width, height) {
  const ctx = outputCanvas.getContext('2d');

  resizeElement(outputCanvas, width, height);

  // draws the video and all the rectangles
  return function draw(handler) {
    handler(ctx);
  }
}



//input -- the output canvas element, the video, and if the video stream is from the webcam
function setUpPoseAndVideoActions(whichOutputCanvas, outputCanvas2, whichVideo, isWebcam, participant, friendParticipant, xcorrSonify, videoElementCalled)
{
  // only trigger this once.
  // if (!streaming) {
    // `const { a } = thing;` == `const a = thing.a;`

    //note -- this may need a switch based on whether it is webcam or a video
    let videoWidth; 
    let videoHeight; 

    if(isWebcam)
    {
      const { width, height } = whichVideo.srcObject.getVideoTracks()[0].getSettings();
      videoWidth = width;
      videoHeight = height;
    }
    else
    {
      videoWidth= whichVideo.videoWidth * 0.5;
      videoHeight = whichVideo.videoHeight * 0.5;
    }
    participant.setSize(videoWidth, videoHeight); 
    startThreeJS(videoWidth, videoHeight);

    let sentVideoSize = 0; 

    /********** Video & WASM calls **********/

    // the last found rectangles
    let rects = [];

    // make a canvas, and get a function to copy the current video
    // frame to the canvas and get the bitmap data
    let getVideoData;
    if(isWebcam){
      getVideoData = videoDataGetter(whichVideo, videoWidth, videoHeight);
    }
    else {
      getVideoData = videoDataGetter3(whichVideo, videoWidth, videoHeight);
    }
    const getVideoData2 = videoDataGetter(videoElementCalled, videoWidth, videoWidth);


    //the last found pose
    let lastPose = null;
        //ALSO, find a way to put into a video stream.
        //note: perhaps participants can 'turn up accuracy  of tracking'
        const net = getPoseNet(250, 250).then(function (net) { //with mo


         recur(setTimeout, next => {

          //4 = HAVE_ENOUGH_DATA
          if(whichVideo.readyState===4 || isWebcam) //need to move this up, too
          {
            const pose = getPose(whichVideo, net, videoWidth, videoHeight).then(function (pose) {

              if (LOG_POSES) {
                console.log(pose);
              }
              lastPose = null; 
              lastPose = pose;
              participant.addKeypoint(lastPose.keypoints);
          
              //sonification here
              // xcorrSonify.volumeMod
              // xcorrSonify.play

              //finding sample per sec 
              // var poseSampleCount = 0; 
              // var startPoseMillis = 0; 
              // var startedPoseMilisCount = false;
              let d = new Date();
              if(!startedPoseMilisCount)
              {
                startedPoseMilisCount = true;
                startPoseMillis = d.getTime();
              }
              endPoseMillis = d.getTime(); 
              if(lastPose){
                poseSampleCount++;
              }

              //find the pose sample rate
              let epsilon = 0.000000001;
              let avgSample = poseSampleCount / ( ((endPoseMillis-startPoseMillis)+epsilon) / 1000 );
              participant.setPoseSamplesRate(avgSample); //(ok, now it does work. BUT. kind of TODO: make not hacky)
              //  console.log(avgSample); 

              if (friendParticipant != null ) {
                // friendParticipant.addKeypoint(otherPersonPoseKeypoints);
                friendParticipant.setPoseSamplesRate(avgSample); //send this samplerate TODO
                // participant.xCorrAngles(friendParticipant); //update xcorr for pose angle dx btw participants  
                if( otherPersonSize != null && friendParticipant.getKeyPointLength() > 0 && participant.getKeyPointLength() > 0 ) {
                  participant.xCorrPositions( friendParticipant ); //update xcorr for position
                  participant.xCorrDistance( friendParticipant ); //update xcorr velocity/distance
                  participant.updatePoseSimilarity( friendParticipant ); 
                }
              }

              if (peerjsDataConn != null) {
                //send keypoints then size messages. maybe need to bundle, we see
                let msg = SpaceBtwMessage.spBtwMessage(SpaceBtwMessage.KEYPOINTS_MESSAGE, lastPose.keypoints);
                peerjsDataConn.send(msg);
              }
               if(!whichVideo.paused) next();
            });
          } else if(!whichVideo.paused) next(); //this will be moved
        });
      } );

    //*************** Sonifying ********************/
    // recur(setTimeout, next => {
    //   // Tone.setup
    //   xcorrSonify.play();
    //   next(); 
    // });

    /********** Drawing **********/
    // set up the rendering pipeline & get a function to do it
    const draw = drawOnCanvas(whichOutputCanvas, videoWidth, videoHeight);
    const draw2 = drawOnCanvas(outputCanvas2, videoWidth, videoHeight);

    // run draw(rects) on every animation frame
    // using requestAnimationFrame makes it only update the video
    // when rendering, and stop if the window isn't visible.
    let alreadyFlipped = false;

    recur(requestAnimationFrame, next => {
      draw2(ctx => {

        ctx.drawImage(videoElementCalled, 0, 0, videoWidth, videoHeight);


        if (otherPersonPoseKeypoints != null) {
          const minPartConfidence = 0.01;
          if(otherPersonSize != null)
          {
            let ratio = resizeKeypointsFromOtherVideo(otherPersonPoseKeypoints, otherPersonSize, videoWidth, videoHeight); 
            drawKeypointsUsingRatio(otherPersonPoseKeypoints, minPartConfidence, ctx, ratio);
            // drawSkeleton(otherPersonPoseKeypoints, 0.3, ctx);

          }
          else{
             drawKeypoints(otherPersonPoseKeypoints, minPartConfidence, ctx);
          }
         }
      });

      draw(ctx => {
        // this is the actual drawing code:

        ctx.drawImage(whichVideo, 0, 0, videoWidth, videoHeight);

        if (lastPose != null) {
           draw(ctx => {

            // console.log(lastPose.keypoints[0].position);
            const minPartConfidence = 0.3; //only see points with 30% confidence and above

            window.otherPersonSize = otherPersonSize; 
            if (peerjsDataConn != null) {
              //send keypoints then size messages. maybe need to bundle, we see
              // let msg = new SpaceBtwMessage.SpBtwMessage(SpaceBtwMessage.KEYPOINTS_MESSAGE, lastPose.keypoints);
              // peerjsDataConn.send(msg);
              // now sending via posenet
  
              if(sentVideoSize < 1000){ //note it seems video size COULD change tho still, keep an eye out. OK I've actually halved messages here... 
                let sz = SpaceBtwMessage.size2d(videoWidth, videoHeight);
                let szMessage = SpaceBtwMessage.spBtwMessage(SpaceBtwMessage.VIDEOSIZE_MESSAGE, sz ); 
                peerjsDataConn.send(szMessage);
                sentVideoSize++; //um, ya. 
              }
            }

            //drawSkeleton(participant.getAvgKeyPoints(), 0.3, ctx);
            dxLabel.innerText = participant.getAvgCurDXTop(0);
            participant.setMinThreshForDX(parseFloat(minThreshSlider.value));

            if (friendParticipant == null) {
              // console.log(participant.getAvgKeyPoints()); 
              drawKeypoints(participant.getAvgKeyPoints(), minPartConfidence, ctx);
            }
            else {
              friendParticipant.setMinThreshForDX(parseFloat(minThreshSlider.value));


              drawKeypointsSizeVaryWithXCorr(participant, friendParticipant, participant.getAvgKeyPoints(), minPartConfidence, ctx);
              if( otherPersonSize != null && friendParticipant.getKeyPointLength() > 0 && participant.getKeyPointLength() > 0 ) {
                drawMatchPoint( ctx, 100, 100, participant.getMatchScore() );
                drawAvgXCorr(  ctx, 250, 100, participant.getHighestAvgXCorrAcrossBodyParts(), participant.getMatchScore()); 

                
                let synchMeasure = getMixedSynchronicityMeasure(participant.getHighestAvgXCorrAcrossBodyParts(), participant.getMatchScore());
                midiFile.magneticPlay( synchMeasure ); 


                // console.log( participant.getHighestAvgXCorrAcrossBodyParts() ); 
              }
              xcorrSonify.play(); //try this?
            }
            // if(skeletonHatchedLines == null ) 
            // {
            //   skeletonHatchedLines= new SkeletonHatchedLines(); 
            //   window.outputCanvas = whichOutputCanvas;
            //   skeletonHatchedLines.init(participant.getAvgKeyPoints(), whichOutputCanvas, posenet);
            // }
            // else
            // {
            //    skeletonHatchedLines.update(participant.getAvgKeyPoints());
            // }
            // skeletonHatchedLines.draw(ctx);
           });
        }
        if(!whichVideo.paused) next();
      });

    });


}

function restartCurrentVideo(videoElement, testVideo, usingWebCam)
{
  if(usingWebCam)
  {
    videoElement.pause(); 
    videoElement.play(); 
  }
  else
  {
    testVideo.pause(); 
    testVideo.play(); 
  }
}

function resizeKeypointsFromOtherVideo(keypoints, otherPersonSize, myWidth, myHeight)
{
  console.assert(otherPersonSize !== null);

  let ratioX = myWidth / otherPersonSize.width ; 
  let ratioY = myHeight / otherPersonSize.height ; 

  let sz = SpaceBtwMessage.size2d(ratioX, ratioY);

  return sz;
}


function recur(schedule, callback) {
  let stopped = false;
  let i = 0;
  function loop() {
    if (!stopped)
    schedule(() => callback(loop));
  }
  loop();
  
  // it returns a function that you can use to end it if you want.
  return () => {
    stopped = true;
  };
}
