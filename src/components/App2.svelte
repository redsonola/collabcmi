<script lang="ts">
  import { onMount } from 'svelte';
  import Call from './Call.svelte';
  import DebugPanel from './DebugPanel.svelte';
  import PrintPose from './PrintPose.svelte';

  import { videoSubscription } from '../threejs/cameraVideoElement';
  import { goLoop, sleep } from '../threejs/promiseHelpers';
  import { initPosenet, PosenetSetup } from "../threejs/posenet";
  import { createMessagingPeer, getServerParams, PeerCommands, PeerMessageReceived } from '../peerJs';

  import { threeRenderCode, ThreeRenderer } from '../draw3js';
  import { PeerConnections, PeerConnection, PoseMessage, PeerMessage, peerMessageStore, Size } from './PoseMessages';
  import { Participant } from '../participant';
  import { findRadiusOfKeypoint } from '../main';
  import type { Keypoint, Pose } from '@tensorflow-models/posenet';
  import ScoreBar from './scoreBar.svelte';
  import * as Scale from '../scale'
  import { Tango332Riffs, FourFloorRiffs, MainVolume, DynamicMovementMidi, BodhranTango332 } from '../midiConversion'
  import { FPSTracker } from '../fpsMeasure'
  import { AmplitudeSoundMessage, SonifierWithTuba, SoundMessage, TouchPhrasesEachBar } from '../xcorrSonify'
  import { SkeletionIntersection } from '../skeletonIntersection';
  import * as  Tone from 'tone';
  import '../Organism01';
  
  const webcamVideo = videoSubscription();
  const videoSources = [
    "webcam",
    "/spacebtwTest.mp4",
    "/synchTestVideo.mp4"
  ];

  export let myId: string | undefined = new URL(window.location.href).searchParams.get('myid') || undefined;
  function setMyId(id: string) {
    myId = id;
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('myid', id);
    history.replaceState(null, document.title, newUrl.toString());
    participant.setParticipantID(myId); 
    // pushState(new URL(window.location.href).searchParams.set('myid', ))
  }
  const querystringCallId = new URL(window.location.href).searchParams.get('callid');
  // if a call id is provided in the URL string, call it.
  // or, for the storybook app, you can just say this app is making the call or not.
  export let idToCall: string | null = querystringCallId || null;
  export let size: { width: number, height: number };
  export const useDevPeerServer = false;

  const messages = peerMessageStore();
  
  let canvas;

  let participant = new Participant();
  let friendParticipant = new Participant();
  participant.addFriendParticipant(friendParticipant); 
  let fpsTracker = new FPSTracker(); 

  //todo: move
  participant.setPoseSamplesRate();
  friendParticipant.setPoseSamplesRate(); 

  let corrData: Keypoint[] = [];
  let matchScore = 0;
  let xCorrScore = 0;
  let synchScore = 0; 

  let windowedVarScore = 0;
  let windowedVarianceHead =0;
  let windowedVarianceTorso=0;
  let windowedVarianceLeftArm=0;
  let windowedVarianceRightArm=0;
  let windowedVarianceLeftLeg=0;
  let windowedVarianceRightLeg=0;

  let xCorrTouching = 0;

  let skeletonTouching =0; 
  let howLongTouch = 0; 
  let howMuchTouch = 0; 


  let midiFile : DynamicMovementMidi[];
  let midiFileBass : DynamicMovementMidi[];

  let mainVolume : MainVolume; 
  let volumeMeterReading : number=0; 

  let tubaSonfier : SonifierWithTuba;
  let touchMusicalPhrases : TouchPhrasesEachBar; 

  let three: ThreeRenderer;
  $: if (canvas) {
    three?.cleanup();
    three = threeRenderCode({ canvas });
  }
  $: if (three && size) {
    setTimeout(() => {
      three.dispatch({ type: 'SetSize', ...size });
    }, 1);
  }

  /***************** main update function *****************/ 
  function keypointsUpdated (particiantId: string, pose: Pose, size: Size) {
    let thisparticipant : Participant; 

    if( participant.isParticipant(particiantId) )
    {
      thisparticipant = participant; 
    } 
    else
    { 
      thisparticipant = friendParticipant; 
    }

    three?.dispatch({
      type: 'UpdatePose',
      targetVideoId: particiantId,
      personId: particiantId,
      pose,
      skeletonIntersect: thisparticipant.getSkeletonIntersection(),
      size
    })

    //set the current sample rate -- to adjust buffer/window sizes
    participant.setPoseSamplesRate( fpsTracker.getFPS() );
    //friendParticipant.setPoseSamplesRate(); //? need to send via peer -- TODO!

    //lol, refactor soon. 
    windowedVarianceHead = participant.getAverageBodyPartWindowedVarianceFromIndex(0);
    windowedVarianceTorso = participant.getAverageBodyPartWindowedVarianceFromIndex(1);
    windowedVarianceLeftArm = participant.getAverageBodyPartWindowedVarianceFromIndex(2);
    windowedVarianceRightArm = participant.getAverageBodyPartWindowedVarianceFromIndex(3);
    windowedVarianceLeftLeg = participant.getAverageBodyPartWindowedVarianceFromIndex(4);
    windowedVarianceRightLeg=  participant.getAverageBodyPartWindowedVarianceFromIndex(5);
    
    windowedVarScore = participant.getMaxBodyPartWindowedVariance(); 

    participant.updateTouchingFriend();
    friendParticipant.updateTouchingFriend();

    if(participant.areTouching())
    {
      skeletonTouching = 1; 
    }
    else 
    {
      skeletonTouching = 0;
    }
    let justStartedTouching : boolean = participant.justStartedTouching();
    let yposOfTouch : number = participant.getTouchPosition().y;
    let combinedWindowedScore = windowedVarScore;
    howLongTouch = participant.howLongTouching(); 
    howMuchTouch = participant.howMuchTouching();


    try {
      // participant.xCorrPositions( friendParticipant ); //update xcorr for position
      participant.xCorrDistance( friendParticipant ); //update xcorr velocity/distance
      participant.updatePoseSimilarity( friendParticipant ); 

      const r0 = findRadiusOfKeypoint(participant, 0);
      if (!Number.isNaN(r0)) {
        corrData = pose.keypoints
          // go through each keypoint, and replace score w/ the result of this fn
          // that way the little chart thing will have all the names too
          .map((keypoint, index) => ({
            ...keypoint,
            score: findRadiusOfKeypoint(participant, index) / 100
          }));


        let matchMin = 0; //just cut-off lower values to create more spread in higher
        let matchMax = 0.4; //before, 0.25
        let xCorrMin = 0.2; //-1
        let xCorrMax = 0.9; // 0.75
  
        let avgXcorr = participant.getHighestAvgXCorrAcrossBodyParts(0.25);
        if (!Number.isNaN(avgXcorr)) {
          xCorrScore = avgXcorr; 
        }

        let match = Scale.linear_scale(participant.getMatchScore(), matchMin, matchMax, 0, 1, true);
        if (!Number.isNaN(match)) {
          matchScore = match; 
        }

        let combined = match*0.5 + avgXcorr*0.5;
        if (!Number.isNaN(combined)) {
          synchScore = combined; 
        }
        xCorrTouching = participant.getTouchingXCorr();

      }

      if( friendParticipant.getMaxBodyPartWindowedVariance() )
      {
        combinedWindowedScore = combinedWindowedScore + friendParticipant.getMaxBodyPartWindowedVariance() / 2;
      }

      //update music 1st
      tubaSonfier.update(yposOfTouch, xCorrTouching, justStartedTouching, participant.justStoppedTouching(), howLongTouch);  
      touchMusicalPhrases.update(justStartedTouching, yposOfTouch, combinedWindowedScore);

    } catch (ex) {
      console.warn(ex);
    }

    //********** get the music messages HERE ********************//
    // let soundMessages : SoundMessage[] = tubaSonfier.getAmplitudeMessages(); //adds amplitude messages
    // soundMessages.push(...tubaSonfier.getSoundMessages() ); //adds sound messages
    // // soundMessages.forEach( (msg) => { 
    // //   console.log(msg.toString());
    // // });
    // tubaSonfier.clearMessages(); 

  }

  let peerConnections: PeerConnections = {};

  function updatePeerData (id: string, update: (m: PeerConnection) => PeerConnection | false): void {
    const updated = update(peerConnections[id]);
    if (updated) { 
      peerConnections = {
        ...peerConnections,
        [id]: { ...peerConnections[id], ...update(peerConnections[id]) }
      };
    } else {
      delete peerConnections[id];
    }
  }

  let peerIds: string[] = [];
  
  function setPeerConnection (
    theirId,
    type: 'data' | 'media',
    connected: boolean | 'open' | 'connecting' | 'received'
  ) {
    if (connected === false) {
      peerIds = peerIds.filter(id => id !== theirId);
      updatePeerData(theirId, () => false);
    } else {
      //set friend peerID 
      friendParticipant.setParticipantID(theirId); //for the dyad arrangement set the ID

      peerIds = peerIds.includes(theirId)
        ? peerIds
        : [...peerIds, theirId];

      updatePeerData(theirId, (d) => ({ ...d, [type]: connected }));
      const { data, media } = peerConnections[theirId];
      updatePeerData(theirId, (d) => ({ ...d, 
        ready: data === true && media === true
      }));
    }
  }

  async function init (suppliedId?: string) {
    let stopped = false;

    mainVolume = new MainVolume((val) => { volumeMeterReading = val });

      //this is from my audiovisual project
      midiFile = [new Tango332Riffs(mainVolume), new FourFloorRiffs(mainVolume)]; 
      midiFileBass = [ new BodhranTango332(mainVolume) ];

      //note: using a for-loop for this caused my browser to crash! WTF MATE GOOD TIMES.
      Tone.Transport.start();
      await midiFile[0].parseAllFiles(); 
      midiFile[0].startLoop(); 
      await midiFile[1].parseAllFiles(); 
      midiFile[1].startLoop(); 
      await midiFileBass[0].parseAllFiles(); 
      midiFileBass[0].startLoop(); 
    

      //this is the new code
      tubaSonfier = new SonifierWithTuba(participant, mainVolume);
      touchMusicalPhrases = new TouchPhrasesEachBar(tubaSonfier, midiFile, midiFileBass); 

    // const posenet = await initPosenet(webcamVideo);
    // const webcamVideo = await makeVideoElement();

    const peer = createMessagingPeer<PoseMessage>(suppliedId, getServerParams(useDevPeerServer));
    const dispatchToPeer = (x: PeerCommands<any>) => { messages.peerCommand(x); return peer.dispatch(x) };
    const myId = await peer.getId();
    setMyId(myId);

    function handlePeerMessage (event: PeerMessageReceived<PeerMessage>) {
      const { message } = event;
      switch (message.type) {
        case "Pose": {
          friendParticipant.setSize(message.size.width, message.size.height);
          friendParticipant.addKeypoint(message.pose.keypoints);
          keypointsUpdated(event.theirId, message.pose, message.size);
          break;
        }

        case "Text": {
          break;
        }
      }
    }

    let callVideoUnsubscribe = () => {};
    let theirVideoUnsubscribe = () => {};

    peer.listen(async (event) => {
      messages.peerAction(event);
      switch (event.type) {
        case 'PeerError':
        case 'ConnectionError': {
          console.error(event);
          throw event.error;
        }

        case 'PeerOpen': {
          setMyId(event.myId);
          break;
        }

        case 'ConnectionOpen': {
          setPeerConnection(event.theirId, 'data', true);
          break;
         }

        case 'ConnectingToPeer': {
          setPeerConnection(event.theirId, 'data', 'connecting');
          break;
        }

        case 'ReceivedCall': {
          // theirId = event.theirId;
          setPeerConnection(event.theirId, 'media', 'received');
          callVideoUnsubscribe = webcamVideo.subscribe(async video => {
            if (video?.stream) {
              dispatchToPeer({
                ...event,
                type: 'AnswerCall',
                mediaStream: video.stream
              });
            } else if (video) {
              console.warn("Rec'd call but didn't answer b/c I don't have a video stream :(");
            }
          });
          break;
        }

        case 'ConnectionClosed': {
          setPeerConnection(event.theirId, 'data', false);
          three.dispatch({ type: 'RemoveVideo', personId: event.theirId });
          break;
        }

        case 'CallEnded': {
          theirVideoUnsubscribe();
          three.dispatch({ type: 'RemoveVideo', personId: event.theirId });
          break;
        }

        case 'CallAnswered': {
          theirVideoUnsubscribe = videoSubscription(event.mediaStream).subscribe(async video => {
            if (video) {
              three.dispatch({ type: 'AddVideo', personId: event.theirId, video});
              setPeerConnection(event.theirId, 'media', true);
            }
          });
          break;
        }

        case 'PeerMessageReceived': {
          handlePeerMessage(event);
          break;
        }

        default: {
          console.error(event);
          throw new Error(`Event type ${event.type} not handled`);
        }
      }
    });

    let posenet: PosenetSetup | undefined;
    const myVideoUnsubscribe = webcamVideo.subscribe(async video => {
      if (!video) return;

      if (posenet) {
        posenet.updateVideo(video);
      } else {
        posenet = await initPosenet(video);
      }
      three.dispatch({ type: 'AddVideo', personId: myId, video });

      if (idToCall) {
        const theirId = idToCall;
        dispatchToPeer({ type: 'DisconnectMedia', theirId });
        dispatchToPeer({ type: 'ConnectToPeer', myId, theirId });

        if (video.stream) {
          dispatchToPeer({ type: 'CallPeer', myId, theirId, mediaStream: video.stream });
        }
      }
    });

    goLoop(async () => {
      if (stopped) return goLoop.STOP_LOOP;
      await sleep();
      if(touchMusicalPhrases){ 
        touchMusicalPhrases.play(); 
      }

            //********** get the music messages HERE ********************//
      // if( tubaSonfier )
      // {
      //   tubaSonfier.updateAmplitudeMessages();

      //   let soundMessages : SoundMessage[] = tubaSonfier.getSoundMessages(); 
      //   soundMessages.push( ...touchMusicalPhrases.getSoundMessages() ); //added the percussion to the sound messages, '...' spreads the array, so it just adds all the values from the array at once
      //   soundMessages.push( ...tubaSonfier.getAmplitudeMessages() );
      //   soundMessages.push( ...touchMusicalPhrases.getAmplitudeMessages() );

      //   // soundMessages.forEach( (msg) => { 
      //   //     console.log(msg.toString());
      //   // });
      //   tubaSonfier.clearMessages(); 
      //   touchMusicalPhrases.clearMessages(); 
      // }

    });

    goLoop(async () => {
      if (stopped) return goLoop.STOP_LOOP;
      if (!myId || !posenet) return sleep(100);
      fpsTracker.refreshLoop();

      const pose = await posenet.getPose();
      const size = posenet.getSize();
      participant.setSize(size.width, size.height);
      participant.addKeypoint(pose.keypoints);
      keypointsUpdated(myId, pose, size);

      
      // send to peers w/ data connections
      peerIds
        .filter(theirId => peerConnections[theirId]?.data === true)
        .forEach(theirId => {
          dispatchToPeer({
            type: 'SendPeerMessage',
            message: { type: "Pose", pose, size },
            myId,
            theirId
          });
      });
    });

    return () => {
      console.log(`Cleaning up app for ${myId}`);
      stopped = true;
      three.cleanup();
      callVideoUnsubscribe();
      myVideoUnsubscribe();
      dispatchToPeer({ type: 'DisconnectEverything' });
    }
  };

  onMount(() => {
    const promiseCleanup = init(myId);
    return () => {
      promiseCleanup.then(cleanup => {
        cleanup();
      });
    }
  });

  export function onChangeVolumeSlider( e ) {
      mainVolume.set( parseFloat( e.currentTarget.value ) );
    }


</script>

<style>
  .callPanel {
    position: absolute;
    top: 0;
    left: 0;
  }

  .slider1 {
  -webkit-appearance: none;  /* Override default CSS styles */
  appearance: none;
  width: 75%; /* Full-width */
  height: 10px; /* Specified height */
  background: #363535; /* Grey background */
  outline: none; /* Remove outline */
  opacity: 0.7; /* Set transparency (for mouse-over effects on hover) */
  -webkit-transition: .2s; /* 0.2 seconds transition on hover */
  transition: opacity .2s;
  align-self:center; 
}

.valueSliders {
    position: relative;
    width:75%;
    top: 40px;
    left: 50px; 
    color: #928888;
  }

  .meter {
    display: block;
    position:relative; 
    left: 60px; 
    top: 10px; 
    background-color:gray;
  }
/*********************************************************************************************/
/****************************** This is the start of Melanie's code!!!!!! ********************/
/*********************************************************************************************/

canvas {
  background-color: transparent;
}

:global(body){
background-color: black;
background: linear-gradient(30deg, 
#010126, 
#00001a, 
#01040c, 
#0c000c, 
#00060f, 
#000033);
background-size: 1000% 1000%;
overflow: hidden;
-webkit-animation: backgroundgradient 35s ease infinite;
-moz-animation: backgroundgradient 35s ease infinite;
-o-animation: backgroundgradient 35s ease infinite;
animation: backgroundgradient 35s ease infinite;
}
@-webkit-keyframes backgroundgradient {
    0%{background-position:0% 87%}
    50%{background-position:100% 14%}
    100%{background-position:0% 87%}
}
@-moz-keyframes backgroundgradient {
    0%{background-position:0% 87%}
    50%{background-position:100% 14%}
    100%{background-position:0% 87%}
}
@-o-keyframes backgroundgradient {
    0%{background-position:0% 87%}
    50%{background-position:100% 14%}
    100%{background-position:0% 87%}
}
@keyframes backgroundgradient {
    0%{background-position:0% 87%}
    50%{background-position:100% 14%}
    100%{background-position:0% 87%}
}

/*  BALL */

#ball1 {
position: absolute;
background:#0000ff; 
mix-blend-mode: hard-light;
top:10%;
left:80%;
border-radius: 20%;
-webkit-animation:ball1 25s alternate linear infinite; /* Chrome, Safari, Opera */
animation:ball1 25s alternate linear infinite;
}

@-webkit-keyframes ball1 {
0% {filter: hue-rotate(0) blur(55px) ;
    border-radius: 50%; height:05%; width:30%; 
    opacity: .1;}

50% { filter: hue-rotate(.1deg) blur(55px) ;
    height:10%;  opacity: .3;}

100% {filter: hue-rotate(0) blur(75px); 
    border-radius: 80%; height:75%; width:75%; 
    opacity: .1;}
}

@keyframes ball1 {
0% {filter: hue-rotate(0) blur(55px) ;
    border-radius: 50%; height:05%; width:30%; 
    opacity: .1;}
50% { filter: hue-rotate(.1deg) blur(55px) ;
    height:10%;  opacity: .3;}
100% {filter: hue-rotate(0) blur(75px); 
    border-radius: 80%; height:75%; width:75%; 
    opacity: .1;}
}

#ball1b {
position: absolute;
mix-blend-mode: hard-light;
top:0%; left:10%;
width:20%; height:20%;
-webkit-animation:ball1 33s alternate linear infinite; /* Chrome, Safari, Opera */
animation:ball1 33s alternate linear infinite;
}

#ball1c {
position: absolute;
background:#0000ff; 
mix-blend-mode: difference;
top:80%;left:55%;
width:5%; height:5%;
-webkit-animation:ball1c 42s alternate linear infinite; /* Chrome, Safari, Opera */
animation:ball1c 42s alternate linear infinite;
}

@-webkit-keyframes ball1c {
0% {filter: hue-rotate(0) blur(100px);
    border-radius: 50%; 
    top:80%;left:55%;
    height:05%; width:30%; 
    opacity: .2;}

50% {filter: hue-rotate(.1turn) blur(50px);
    top:90%;left:40%;
    height:10%;  
    opacity: .3;}

100% {filter: hue-rotate(0) blur(100px); 
    border-radius: 80%; 
    top:80%;left:35%;
    height:75%; width:75%; 
    opacity: .2;}
}

@keyframes ball1c {
0% {filter: hue-rotate(0) blur(100px);
    border-radius: 50%; 
    top:80%;left:55%;
    height:05%; width:30%; 
    opacity: .2;}

50% {filter: hue-rotate(.1turn) blur(50px);
    top:90%;left:40%;
    height:10%;  
    opacity: .3;}

100% {filter: hue-rotate(0) blur(100px); 
    border-radius: 80%; 
    top:80%;left:35%;
    height:75%; width:75%; 
    opacity: .2;}
}

#ball1d {
position: absolute;
background:#0000ff; 
top:20%;left:20%;
width:10%;
height:10%;
mix-blend-mode: exclusion;
-webkit-animation:ball2c 35s alternate linear infinite; /* Chrome, Safari, Opera */
animation:ball2c 35s alternate linear infinite;
}

@-webkit-keyframes ball2c {
0% {filter: hue-rotate(0) blur(100px) ;
    border-radius: 50%; 
    top:20%;left:20%;
    height:15%; width:30%; 
    opacity: .2;}

50% {filter: hue-rotate(.1turn) blur(75px) ;
    top:30%;left:30%;
    height:10%;  
    opacity: .3;}

100% {filter: hue-rotate(0) blur(100px) ;
    border-radius: 80%;
    top:20%;left:20%;
    top:80%;left:35%;
    height:75%; width:75%; 
    opacity: .2;}
}

@keyframes ball2c {
0% {filter: hue-rotate(0) blur(100px) ;
    border-radius: 50%; 
    top:20%;left:20%;
    height:15%; width:30%; 
    opacity: .2;}

50% {filter: hue-rotate(.1turn) blur(75px) ;
    top:30%;left:30%;
    height:10%;  
    opacity: .3;}

100% {filter: hue-rotate(0) blur(100px) ;
    border-radius: 80%;
    top:20%;left:20%;
    top:80%;left:35%;
    height:75%; width:75%; 
    opacity: .2;}
}

#ball1e {
position: absolute;
background:#0000ff;
top:20%;
left:80%;
width:10%;
height:10%;
mix-blend-mode: difference;
-webkit-animation:ball1e 50s alternate linear infinite; /* Chrome, Safari, Opera */
animation:ball1e 30s alternate linear infinite;
}

@-webkit-keyframes ball1e {
0% { filter: hue-rotate(0) blur(50px);
    border-radius: 50%; height:40%; width:40%; 
    top:90%; left:90%;
    opacity: .05;}

50% {filter: hue-rotate(.2turn) blur(100px);
    height:60%; 
    top:50%;left:90%;
    opacity: .7;}

100% {filter: hue-rotate(0) blur(75px); 
    border-radius: 80%; height:75%; width:75%;
    top:90%; left:90%; 
    opacity: .05;}
}

@keyframes ball1e {
0% { filter: hue-rotate(0) blur(50px);
    border-radius: 50%; height:40%; width:40%; 
    top:90%; left:90%;
    opacity: .05;}

50% {filter: hue-rotate(.2turn) blur(100px);
    height:60%; 
    top:50%;left:90%;
    opacity: .7;}

100% {filter: hue-rotate(0) blur(75px); 
    border-radius: 80%; height:75%; width:75%;
    top:90%; left:90%; 
    opacity: .05;}
}

#ball1f {
position: absolute;
background-image: radial-gradient(#1a1aff,  #0000ff, #000099);
top:10%;
left:10%;
width:40%;
height:40%;
mix-blend-mode: color-dodge;
-webkit-animation:ball1f 50s alternate linear infinite; /* Chrome, Safari, Opera */
animation:ball1f 50s alternate linear infinite;
}

@-webkit-keyframes ball1f {
0% {filter: hue-rotate(0) blur(25px);
    border-radius: 50%; height:40%; width:40%; 
    top:10%; left:10%;
    opacity: .05;}

50% {filter: hue-rotate(.1turn); height:60%; 
    top:20%;left:5%;
    opacity: .9;}

100% {filter: hue-rotate(0) blur(100px); 
    border-radius: 80%; height:75%; width:75%;
    top:10%; left:10%; 
    opacity: .05;}
}

@keyframes ball1f {
0% {filter: hue-rotate(0) blur(25px);
    border-radius: 50%; height:40%; width:40%; 
    top:10%; left:10%;
    opacity: .05;}

50% {filter: hue-rotate(.1turn); height:60%; 
    top:20%;left:5%;
    opacity: .9;}

100% {filter: hue-rotate(0) blur(100px); 
    border-radius: 80%; height:75%; width:75%;
    top:10%; left:10%; 
    opacity: .05;}
}



#ball1g {
position: absolute;
background-image: radial-gradient(#8000ff, #3333ff, #0000ff); 
top:30%;
left:30%;
width:40%;
height:40%;
mix-blend-mode: color-dodge;
-webkit-animation:ball1g 50s alternate linear infinite; /* Chrome, Safari, Opera */
animation:ball1f 30s alternate linear infinite;
}

@-webkit-keyframes ball1g {
0% {filter: hue-rotate(0) blur(50px);
    border-radius: 50%; 
    height:40%; width:40%; 
    opacity: .05;}

50% {filter: hue-rotate(.1turn) blur(100px); 
    border-radius: 80%; 
    height:60%; opacity: .9;}

100% {filter: hue-rotate(0) blur(50px);
    border-radius: 50%; 
    height:75%; width:75%; 
    opacity: .05;}
}

@keyframes ball1g {
0% {filter: hue-rotate(0) blur(50px);
    border-radius: 50%; 
    height:40%; width:40%; 
    opacity: .05;}

50% {filter: hue-rotate(.1turn) blur(100px); 
    border-radius: 80%; 
    height:60%; opacity: .9;}

100% {filter: hue-rotate(0) blur(50px);
    border-radius: 50%; 
    height:75%; width:75%; 
    opacity: .05;}
}


#rad {
position: absolute;
background-image: radial-gradient(#1a1aff, #8000ff, #0000cc);
top:30%;
left:30%;
width:40%;
height:40%;
mix-blend-mode: color-dodge;
-webkit-animation:rad1 50s alternate linear infinite; /* Chrome, Safari, Opera */
animation:rad1 50s alternate linear infinite;
}

@-webkit-keyframes rad1 {
0% {filter: hue-rotate(0) blur(25px);
    border-radius: 50%; 
    height:40%; width:40%; 
    opacity: .05;}

50% {filter: hue-rotate(.1turn) blur(100px);
    height:60%; 
    opacity: .9;}

100% {filter: hue-rotate(0) blur(25px);
    border-radius: 80%; 
    height:75%; width:75%; 
    opacity: .05;}
}

@keyframes rad1 {
0% {filter: hue-rotate(0) blur(25px);
    border-radius: 50%; 
    height:40%; width:40%; 
    opacity: .05;}

50% {filter: hue-rotate(.1turn) blur(100px);
    height:60%; 
    opacity: .9;}

100% {filter: hue-rotate(0) blur(25px);
    border-radius: 80%; 
    height:75%; width:75%; 
    opacity: .05;}
}

#rad2 {
background-image: radial-gradient(#0000e6, #000080, #5500ff);
position: absolute;
top:70%;
left:0%;
width:20%;
height:20%;
mix-blend-mode: soft-light;
-webkit-animation:rad1 50s alternate linear infinite; /* Chrome, Safari, Opera */
animation:rad1 30s alternate linear infinite;
}

#c {
    width: 100%;
    height: 100%;
    /* display: block; */
    background: transparent;
    background-size: cover;
}

/*********************************************************************************************/
/*********************************************************************************************/
/*********************************************************************************************/

</style>
<!-- <style lang="scss" href="mystyle.css"> -->
  <!-- <link rel="stylesheet" type="text/css" href="../css/background.css"> -->

<!-- <div id="ball1"></div>
<div id="ball1b"></div>
<div id="ball1c"></div>
<div id="ball1d"></div> 
<div id="ball1e"></div> 
<div id="ball1f"></div> 
<div id="ball1g"></div>
<div id="rad"></div>
<div id="rad2"></div> -->


<div class="valueSliders">
<label for="mainVolume">Volume:</label>
<input type="range" min="0" max="0.75" class="slider1" id="mainVolume" step="0.01" value="0" on:input={onChangeVolumeSlider}><br />
<svg class="meter" xmlns="http://www.w3.org/2000/svg" width="75%" height="16" fill="none">
  <rect width="100%" height="16" fill="gray" rx="3" />
  <rect width="{volumeMeterReading * 100}%" height="16" fill="#87CEFA" rx="3" />
  <text>{volumeMeterReading}</text>
<br/><br/>
</div>

<DebugPanel messages={messages} myId={myId} peerConnections={peerConnections}>
  <!--
    anything passed in here will be in the Passed in tab
    you can move it to the DebugPanel.svelte file if it will
    be useful later, or just stick it here for experiments.
  -->

  <!-- TODO: make it replace the video it sends to the peer when switching -->
  {#each videoSources as source}
    <input type="button" on:click={() => webcamVideo.setSource(source)} value="{source}" />
  {/each}
  <br/>

  <ScoreBar label="skeleton touching:" score={skeletonTouching} />
  <ScoreBar label="how long touching:" score={howLongTouch} />
  <ScoreBar label="how much touching:" score={howMuchTouch} />
  <ScoreBar label="match score:" score={matchScore} />
  <ScoreBar label="touching xcorr score:" score={xCorrTouching} />
  <ScoreBar label="total xcorr score:"score={xCorrScore} />
  <ScoreBar label="combined score:"score={synchScore} />
  <ScoreBar label="windowed var score:"score={windowedVarScore} />
  <ScoreBar label="windowed var head:"score={windowedVarianceHead} />
  <ScoreBar label="windowed var torso:"score={windowedVarianceTorso} />
  <ScoreBar label="windowed var left arm:"score={windowedVarianceLeftArm} />
  <ScoreBar label="windowed var right arm:"score={windowedVarianceRightArm} />
  <ScoreBar label="windowed var left leg:"score={windowedVarianceLeftLeg} />
  <ScoreBar label="windowed var right leg:"score={windowedVarianceRightLeg} />

  <PrintPose keypoints={corrData} />
</DebugPanel>

<canvas bind:this={canvas}
  style={`width: 100%; height: 100vh`} />

<div class="callPanel">
  {#if peerIds.length === 0 && idToCall === null}
    <Call myId={myId} />
  {:else if !myId}
    Preparing to answer<br />
    {idToCall}
  {/if}
</div>