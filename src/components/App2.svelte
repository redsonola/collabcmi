<script lang="ts">
  import { onMount } from "svelte";
  import type { RouterState } from "yrv";
  import Peer from 'peerjs';
  import Call from "./Call.svelte";
  import DebugPanel from "./DebugPanel.svelte";
  import PrintPose from "./PrintPose.svelte";
  import Loading from "./Loading.svelte";
  import '@tensorflow/tfjs-backend-webgl';
  // import { initPosenet } from "../threejs/posenetcopy";
  import { initPosenet } from "../threejs/mediapipePose";
  // import { initPosenet } from "../threejs/posenetMock";

  import { videoSubscription } from "../threejs/cameraVideoElement";
  import { goLoop, sleep, timeout, waitFor } from "../threejs/promiseHelpers";
  import type { PosenetSetup } from "../threejs/mediapipePose";
  import {
    peerServerParams,
    findChatRoulettePartner
  } from "../peerJs";

  // import Balls from "./Balls.svelte";
  import { threeRenderCode } from "../draw3js";
  import type { ThreeRenderer, LayoutMode } from "../draw3js";
  import type { Size, PeerMessage, PoseMessage } from "./PoseMessages";
  import { Participant } from "../participant";
  import { findRadiusOfKeypoint } from "../main";
  import type { Keypoint, Pose } from "@tensorflow-models/posenet";
  import ScoreBar from "./scoreBar.svelte";
  import * as Scale from "../scale";
  import {
    Tango332Riffs,
    FourFloorRiffs,
    MainVolume,
    DynamicMovementMidi,
    BodhranTango332,
  } from "../midiConversion";
  import { FPSTracker } from "../fpsMeasure";
  import {
    SonifierWithTuba,
    TouchPhrasesEachBar,
  } from "../xcorrSonify";
  import * as Tone from "tone";
  import "../Organism01"; //turn back on for creature
  import { onVirtualTouch, startAnimation } from "../Organism01"; //turn back on for creature, uncomment Line 285
  import * as THREE from "three";
  import type { DataConnection, MediaConnection } from "peerjs";
import { Vector3 } from "three";


  export let router: RouterState;
  export let showDebugPanel = router.query.debug === "true";

  const webcamVideo = videoSubscription("webcam");
  const webcamError = webcamVideo.error;
  const theirVideo = videoSubscription(null); //their stream is set when they call; don't open a second webcam
  let theirVideoUnsubscribe;
  // const videoSources = ["webcam", "/spacebtwTest.mp4", "/synchTestVideo.mp4"];

  let theirVideoElement;
  let muteUrl = "./icons/noun_mic_283245_grey.png"; 
  let unmuteURL = "./icons/noun_Mute_2692102_grey.png";
  let theirMuteButtonText = muteUrl; 

  //my microphone: a mute toggle. a muted mic sends silence to the other participant.
  let micMuted = false;
  $: myMuteButtonText = micMuted ? unmuteURL : muteUrl;
  $: applyLocalMicMute(micMuted);
  let localWebcamStream : MediaStream | undefined; //my own camera+mic stream, so the mic track can be turned off

  //whether the other participant has muted their own mic -- stored so it can be applied once their video element exists
  let theirIncomingMuted = false;
  let myMutePosition : THREE.Vector3 = new THREE.Vector3(); 
  let theirMutePosition : THREE.Vector3 = new THREE.Vector3(); 
  let handleResize : ()=>void = ()=>{}; //init as empty
  let beforeUnload : ()=>void = ()=>{}; 
  let glowClass = "noGlow"; 
  let volSliderReading = 0; 
  let inPotForChatRoulette = false; 
  let chatstatusMessage = "";
  let disconnectedBySelf = false;  
  let closeConnection = (conn:DataConnection) => {};
  let recentIds : string[] = []; 
  let cursorStyle : string = "default";
  let hasFriend : boolean = false; //set this when there is another participant to true & read value

  //desktop, or a phone held upright (portrait) or sideways (landscape).
  //add ?layout=portrait, ?layout=landscape or ?layout=desktop to the url to try one on a computer.
  const layoutOverride = new URL(window.location.href).searchParams.get("layout");
  function detectLayoutMode() : LayoutMode
  {
    if( layoutOverride === "portrait" || layoutOverride === "landscape" || layoutOverride === "desktop" )
      return layoutOverride;
    const touchScreen = window.matchMedia?.("(pointer: coarse)").matches;
    const smallScreen = Math.min(window.innerWidth, window.innerHeight) <= 600;
    if( !(touchScreen && smallScreen) ) return "desktop";
    return window.innerHeight > window.innerWidth ? "portrait" : "landscape";
  }
  let layoutMode : LayoutMode = detectLayoutMode();
  let pBottomHeight = 0; //portrait: height of the bottom control bar, so the videos stay above it
  $: connected = peerIds.length !== 0 || idToCall !== null;

  // On phones the camera and audio start from a tap on the Start button. Browsers there
  // drop a permission prompt that appears on its own while the page is loading, and iOS
  // won't start audio without a tap. Desktop starts right away, as it always did.
  let cameraAllowed = false;
  let startTapped = false;
  $: needsStartTap = layoutMode !== "desktop" && !cameraAllowed;
  function startFromTap() {
    startTapped = true;
    cameraAllowed = true;
    Tone.start(); //must be called from the tap itself
  }
  function retryCamera() {
    webcamVideo.retry();
    Tone.start();
  }
  function onViewportChange() { layoutMode = detectLayoutMode(); }


  //is the webcam moving, if so, where?
  let movingWebCamWindow : {which:number, startX:number, startY:number, isMoving: boolean } = 
      { which:-1, startX:0, startY:0, isMoving: false } ;
  
  $: {
    if ($theirVideo !== null) {
      console.log('their video', $theirVideo);
      theirVideoElement = $theirVideo.videoElement; 
      theirVideoElement.muted = theirIncomingMuted;
    }
  }

  export let myId: string | undefined =
    new URL(window.location.href).searchParams.get("myid") || undefined;
  function setMyId(id: string) {
    console.log("setMyId", id);
    myId = id;
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set("myid", id);
    history.replaceState(null, document.title, newUrl.toString());
    participant.setParticipantID(myId);
    // pushState(new URL(window.location.href).searchParams.set('myid', ))
  }
  const querystringCallId = new URL(window.location.href).searchParams.get(
    "callid"
  );
  // if a call id is provided in the URL string, call it.
  // or, for the storybook app, you can just say this app is making the call or not.
  export let idToCall: string | null = querystringCallId || null;
  export let size: { width: number; height: number };

  let loading = true;
  // fraction (0 to 1) of the pose model files downloaded, reported by initPosenet
  let downloadFraction = 0;
  let progress = "0%";
  $: progress = downloadFraction >= 1 ? "starting" : Math.floor(downloadFraction * 100) + "%";

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
  let windowedVarianceHead = 0;
  let windowedVarianceTorso = 0;
  let windowedVarianceLeftArm = 0;
  let windowedVarianceRightArm = 0;
  let windowedVarianceLeftLeg = 0;
  let windowedVarianceRightLeg = 0;

  let xCorrTouching = 0;

  let skeletonTouching = 0;
  let howLongTouch = 0;
  let howMuchTouch = 0;

  let midiFile: DynamicMovementMidi[];
  let midiFileBass: DynamicMovementMidi[];

  let mainVolume: MainVolume;
  let volumeMeterReading: number = 0;

  let tubaSonfier: SonifierWithTuba;
  let touchMusicalPhrases: TouchPhrasesEachBar;


  var connectToRandomPartner = (e) => {}; //function to connect to a random partner
  var turnUpVolume = () => {}; //turn up the volume when connected to another user
  var sendMuteMessage = (which:number, muted:boolean) => {}; //if muting self, need to send to other person to mute.
  var sendVideoMoveMessage = (which:number, x:number, y:number) => {}; //if muting self, need to send to other person to mute.

  var endCall : ()=>void ;

  const BEGINNING_VOLUME = 0.66;
  // var selfMute;
  // var friendMute;  

  let three: ThreeRenderer;
  $: if (canvas) {
    three?.cleanup();
    three = threeRenderCode({ canvas, handleResize });
  }
  $: if (three) {
    three.setLayout({ mode: layoutMode, connected, bottomBarPx: pBottomHeight });
  }
  $: if (three && size) {
    setTimeout(() => {
      three.dispatch({ type: "SetSize", ...size });
    }, 1);
  }

  async function loadMusic (mainVolume : MainVolume)
  {
    //this is from my audiovisual project
    midiFile = [new Tango332Riffs(mainVolume), new FourFloorRiffs(mainVolume)];
    midiFileBass = [new BodhranTango332(mainVolume)];

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
    touchMusicalPhrases = new TouchPhrasesEachBar(
      tubaSonfier,
      midiFile,
      midiFileBass
    );
  }

  /***************** main update function *****************/

  function keypointsUpdated(particiantId: string, pose: Pose, size: Size) {
    let thisparticipant: Participant;

    if (participant.isParticipant(particiantId)) {
      thisparticipant = participant;
      three.setWhichIsSelf( particiantId ); //figure out how to just set this once, gah.
    } else {
      thisparticipant = friendParticipant;
    }


    three?.dispatch({
      type: "UpdatePose",
      targetVideoId: particiantId,
      personId: particiantId,
      pose,
      skeletonIntersect: thisparticipant.getSkeletonIntersection(),
      size,
    });

    //set the current sample rate -- to adjust buffer/window sizes
    participant.setPoseSamplesRate(fpsTracker.getFPS());
    //friendParticipant.setPoseSamplesRate(); //? need to send via peer -- TODO!

    //lol, refactor soon.
    windowedVarianceHead = participant.getAverageBodyPartWindowedVarianceFromIndex(
      0
    );
    windowedVarianceTorso = participant.getAverageBodyPartWindowedVarianceFromIndex(
      1
    );
    windowedVarianceLeftArm = participant.getAverageBodyPartWindowedVarianceFromIndex(
      2
    );
    windowedVarianceRightArm = participant.getAverageBodyPartWindowedVarianceFromIndex(
      3
    );
    windowedVarianceLeftLeg = participant.getAverageBodyPartWindowedVarianceFromIndex(
      4
    );
    windowedVarianceRightLeg = participant.getAverageBodyPartWindowedVarianceFromIndex(
      5
    );

    windowedVarScore = participant.getMaxBodyPartWindowedVariance();

    let justStartedTouching: boolean = false;
    let yposOfTouch: number = 0;
    let combinedWindowedScore : number = 0;
    let offset = three.getOffsetVidPosition(false);
    
    //ok this is bad because it also gives the points to draw which should be a separate thing, etc. 
    participant.updateTouchingFriend(three.getOffsetVidPosition(false), hasFriend);
    

    if( peerIds.length !== 0 && hasFriend ){

      friendParticipant.updateTouchingFriend(three.getOffsetVidPosition(true), hasFriend);

      if (participant.areTouching()) {
        skeletonTouching = 1;
      } else {
        skeletonTouching = 0;
      }
      justStartedTouching = participant.justStartedTouching();
      yposOfTouch = participant.getTouchPosition().y;
      combinedWindowedScore = windowedVarScore;
      howLongTouch = participant.howLongTouching();
      howMuchTouch = participant.howMuchTouching();
      onVirtualTouch(participant.getTouch()); //TURN ON FOR CREATURE
    }

    try {
      // participant.xCorrPositions( friendParticipant ); //update xcorr for position
      participant.xCorrDistance(friendParticipant); //update xcorr velocity/distance
      participant.updatePoseSimilarity(friendParticipant);

      const r0 = findRadiusOfKeypoint(participant, 0);
      if (!Number.isNaN(r0)) {
        corrData = pose.keypoints
          // go through each keypoint, and replace score w/ the result of this fn
          // that way the little chart thing will have all the names too
          .map((keypoint, index) => ({
            ...keypoint,
            score: findRadiusOfKeypoint(participant, index) / 100,
          }));

        let matchMin = 0; //just cut-off lower values to create more spread in higher
        let matchMax = 0.4; //before, 0.25
        let xCorrMin = 0.2; //-1
        let xCorrMax = 0.9; // 0.75

        let avgXcorr = participant.getHighestAvgXCorrAcrossBodyParts(0.25);
        if (!Number.isNaN(avgXcorr)) {
          xCorrScore = avgXcorr;
        }

        let match = Scale.linear_scale(
          participant.getMatchScore(),
          matchMin,
          matchMax,
          0,
          1,
          true
        );
        if (!Number.isNaN(match)) {
          matchScore = match;
        }

        let combined = match * 0.5 + avgXcorr * 0.5;
        if (!Number.isNaN(combined)) {
          synchScore = combined;
        }
        xCorrTouching = participant.getTouchingXCorr();
      }

      if( peerIds.length !== 0 ){
        combinedWindowedScore = combinedWindowedScore + friendParticipant.getMaxBodyPartWindowedVariance() / 2;
      }

      if(tubaSonfier && touchMusicalPhrases && peerIds.length > 0){

      //update music 1st
      tubaSonfier.update(
        yposOfTouch,
        xCorrTouching,
        justStartedTouching,
        participant.justStoppedTouching(),
        howLongTouch
      );
      touchMusicalPhrases.update(
        justStartedTouching,
        yposOfTouch,
        combinedWindowedScore
      );
    }

    } catch (ex) {
      console.error("***** FIXME *****");
      console.error("***** check if there's one participant and don't let this break *****");
      console.error(ex);
    }

    //********** get the music messages HERE ********************//
    // let soundMessages : SoundMessage[] = tubaSonfier.getAmplitudeMessages(); //adds amplitude messages
    // soundMessages.push(...tubaSonfier.getSoundMessages() ); //adds sound messages
    // // soundMessages.forEach( (msg) => {
    // //   console.log(msg.toString());
    // // });
    // tubaSonfier.clearMessages();
  }

  let dataConnections: Record<string, DataConnection> = {};

  let peerIds: string[] = [];

  const peer = myId ? new Peer(myId, peerServerParams) : new Peer(peerServerParams);

  async function init() {
    let stopped = false;
    const posenet: PosenetSetup<any> = initPosenet(undefined, (fraction) => (downloadFraction = fraction));

    peer.on('open', setMyId);

    // The peer server can take 30+ seconds to answer when it's been asleep, so don't make
    // the camera, pose model, audio or controls wait for it. Only the things that need my
    // peer id wait (see waitFor below).
    // Subscribing now starts the webcam (and its permission prompt) right away; the
    // later subscription below just gets the same video.
    if (layoutMode === "desktop") cameraAllowed = true;
    await waitFor(() => (cameraAllowed ? true : null));
    const startCameraEarly = webcamVideo.subscribe((video) => {
      if (video) posenet.updateVideo(video);
    });

    mainVolume = new MainVolume((val) => {
      volumeMeterReading = val;
    });

    //this is from my audiovisual project
    midiFile = [new Tango332Riffs(mainVolume), new FourFloorRiffs(mainVolume)];
    midiFileBass = [new BodhranTango332(mainVolume)];

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
    touchMusicalPhrases = new TouchPhrasesEachBar(
      tubaSonfier,
      midiFile,
      midiFileBass
    );

    turnUpVolume = () => 
    {
      const volSlider : HTMLInputElement | null = document.getElementById("mainVolume") as HTMLInputElement; 
      if( volSlider )
      {
          volSlider.value = BEGINNING_VOLUME.toString();
      }
      mainVolume.set(BEGINNING_VOLUME);
      volSliderReading = BEGINNING_VOLUME; //ohhh this should be refactored.
    };

    let callVideoUnsubscribe = () => {};
    // let theirVideoUnsubscribe = () => {};

    closeConnection = (conn : DataConnection) =>
    {
      console.log("closing out bc other participant closed");
        peerIds = peerIds.filter((id) => id !== conn.peer);
        recentIds.push( conn.peer ); 

    
        // updatePeerData(conn.peer, () => false);
        theirVideoUnsubscribe();
        three.dispatch({ type: "RemoveVideo", personId: conn.peer });

        delete dataConnections[conn.peer];

        //get rid of current friend
        friendParticipant = new Participant; 
        participant.addFriendParticipant(friendParticipant); 
        peerIds = [];
        if( !disconnectedBySelf )
            chatstatusMessage = "The other participant has disconnected.\n Please use the above controls to restart, if desired.";

        disconnectedBySelf = false;
        hasFriend = false; 

    }

    function listenToDataConnection(conn: DataConnection) {
      if (dataConnections[conn.peer]) {
        console.warn("Trying to reconnect data for ", conn.peer, dataConnections);
      }
      dataConnections[conn.peer] = conn;
      console.log("listenToDataConnection", conn, dataConnections);
      friendParticipant.setParticipantID(conn.peer); //for the dyad arrangement set the ID
      hasFriend = true; 
      peerIds = [...peerIds, conn.peer]; //so that other things work -- plugging the hole in the dam. -CDB (reassigned, not pushed, so Svelte 5 notices the change)

      console.log('setting friend ID:', conn.peer)

      conn.on('data', function (message: PeerMessage) {
        switch (message.type) {
          case "Pose": {
            friendParticipant.setSize(message.size.width, message.size.height);
            friendParticipant.addKeypoint(message.pose.keypoints);
            keypointsUpdated(conn.peer, message.pose, message.size);
            break;
          }
          case "Mute": {
            if( message.which === 0 )
            {
              //the other participant muted me on their side; my own mic setting is unchanged
            }
            else
            {
              theirIncomingMuted = message.muted;
              if( theirVideoElement )
                {
                  theirVideoElement.muted = message.muted ;
                  theirMuteButtonText = message.muted ? unmuteURL : muteUrl;
                }
            }
            break;
          }
          case "MoveVideo":
          {
            //need to send in screen resolution invariant terms
            //phones arrange the videos their own way, so only the desktop layout follows the other person's drags
            if( layoutMode === "desktop" )
              three.moveVideoCamFromThreeJSCoords( message.which, message.x, message.y );
            break;
          }

          default: {
            console.error('Unhandled data message:', message);
          }
        }
      });

      //let the new connection know how my mic is set
      if (conn.open) sendMicState();
      else conn.on('open', sendMicState);

      conn.on('close', function () {
        closeConnection(conn); 
      });

      conn.on('error', (error) => {
        console.error({ myId: peer.id, theirId: conn.peer, error });
        throw error;
      })
    }

    peer.on('connection', listenToDataConnection);

    function listenToMediaConnection(call: MediaConnection) {

      // theirId = call.peer;
      call.on('stream', function (mediaStream) {
        chatstatusMessage = ""; 

        //if the current call.peer is in recentIds then it is current not RECENT.
        let idx = recentIds.indexOf( call.peer );
        if(idx !== -1)
        {
          recentIds.splice(idx, 1); 
        } 

        console.log('CallAnswered', call, mediaStream);
        theirVideoUnsubscribe = theirVideo.subscribe(video => {
          if (video) {
            three.dispatch({ type: "AddVideo", personId: call.peer, video, recentIds });
            three.setWhichIsSelf(participant.getParticipantID()); 
            //their video now exists, so place both mute buttons under their videos
            myMutePosition = three.getMuteButtonPosition(peer.id);
            theirMutePosition = three.getMuteButtonPosition(call.peer);
          }
        });
        myMutePosition = three.getMuteButtonPosition(peer.id);
        theirMutePosition = three.getMuteButtonPosition(call.peer);
        theirVideo.setSource(mediaStream);
      });

      call.on('close', function () {
        console.log('removing media connection');
        theirVideoUnsubscribe();
        three.dispatch({ type: "RemoveVideo", personId: call.peer });
      });

      call.on('error', (error) => {
        console.error({ myId: peer.id, theirId: call.peer, error });
        throw error;
      })
    }

    peer.on('call', call => {
      listenToMediaConnection(call);
      // setPeerConnection(call.peer, "media", "received");
      callVideoUnsubscribe = webcamVideo.subscribe(async (video) => {
        if (video?.stream) {
          call.answer(video.stream);
        } else if (video) {
          console.warn(
            "Rec'd call but didn't answer b/c I don't have a video stream :("
          );
        }
      });
    });
  


    posenet.onResults((pose) => {
      if(loading)
      {
        startAnimation(); 
      }
      loading = false;
      fpsTracker.refreshLoop();

      if (!peer.id) return; //still waiting for the peer server; nothing to share yet

      const size = posenet.getSize();
      participant.setSize(size.width, size.height);
      participant.addKeypoint(pose.keypoints);
      keypointsUpdated(peer.id, pose, size);

      // send to peers w/ data connections
      Object.values(dataConnections).forEach((conn) => {
        if (conn.open) conn.send({ type: "Pose", pose, size });
      });

    });

    await waitFor(() => myId || null); //everything below uses my peer id

    const myVideoUnsubscribe = webcamVideo.subscribe(async (video) => {
      if (!video) return;

      localWebcamStream = video.stream;
      applyLocalMicMute(micMuted);

      three.dispatch({ type: "AddVideo", personId: peer.id, video, recentIds });
      three.setWhichIsSelf(participant.getParticipantID()); 



      if (idToCall) {
        const theirId = idToCall;
        listenToDataConnection(peer.connect(theirId, { label: theirId, serialization: 'json' }));

        glowClass = "glowEffect";

        if (video.stream) {
          const call = peer.call(theirId, video.stream);
          listenToMediaConnection(call);
        }

        setTimeout( function(){ loadMusic(mainVolume); }, 100 );
        //await loadMusic(mainVolume);
      }
    });

    goLoop(async () => {
      if (stopped) return goLoop.STOP_LOOP;
      await sleep();
      if (touchMusicalPhrases) {
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

    connectToRandomPartner = async (e) => {
      let theirId = await findChatRoulettePartner( peer.id );

      if( theirId )
      {

        const myVideoUnsubscribe = webcamVideo.subscribe(async (video) => 
        {
          if(!video){
            console.log("video is undefined")
            return; 
          }

          if(!theirId){
            console.log("theirId is now undefined??")
            return; 
          }

          chatstatusMessage = "Connecting...";

          listenToDataConnection(peer.connect(theirId, { label: theirId, serialization: 'json' }));

          if (video.stream) 
          {
            if(!theirId)
              return; 
            
            const call = peer.call(theirId, video.stream);
            listenToMediaConnection(call);
          }
        });
      }
      else
      {
        chatstatusMessage = "Waiting for a chat partner...";

        await loadMusic(mainVolume);
        turnUpVolume();
      }
    }

    sendMuteMessage = (which: number, muted: boolean) =>
    {
      // send to peers w/ data connections
      Object.values(dataConnections).forEach((conn) => {
        if (conn.open) conn.send({ type: "Mute", which, muted });
      });
    }

    sendVideoMoveMessage = ( which: number, x:number, y:number ) =>
    {
      // send to peers w/ data connections
      Object.values(dataConnections).forEach((conn) => {
        if (conn.open) conn.send({ type: "MoveVideo", which, x, y });
      });      
    }


    return () => {
      console.log(`Cleaning up app for ${myId}`);
      stopped = true;
      three.cleanup();
      posenet.cleanup()
      callVideoUnsubscribe();
      startCameraEarly();
      myVideoUnsubscribe();
      peer.disconnect();
    };
  }

  onMount(() => {
    const promiseCleanup = timeout(100).then(() => init());

    return () => {
      promiseCleanup.then(cleanup => cleanup());
    };
  });

  export function onChangeVolumeSlider(e) {
    let vol = parseFloat(e.currentTarget.value);
    volSliderReading = vol;
    mainVolume?.set(parseFloat(e.currentTarget.value));
    if( vol > 0 )
    {
      glowClass = "noGlow";
    }
  }

  //not used but could become useful later if need to seriously remix sounds
  export function updateLabel( e, l ) {
      let label = document.getElementById(l);
      if( label )
      {
        label.innerText = e.currentTarget.value 
      }
  }

  //actually switch my microphone track on or off, so a muted mic sends silence
  function applyLocalMicMute(muted : boolean)
  {
    if( !localWebcamStream ) return;
    localWebcamStream.getAudioTracks().forEach((track) => { track.enabled = !muted; });
  }

  //tell the other participant whether my mic is muted (so their icon matches)
  function sendMicState()
  {
    sendMuteMessage(1, micMuted);
  }

  //the mic button
  export function muteSelf(e)
  {
    micMuted = !micMuted;
    sendMicState();
  }

  export function muteThem(e)
  {
    const mute = theirMuteButtonText === muteUrl;
    theirMuteButtonText = mute ? unmuteURL : muteUrl;
    if( theirVideoElement )
    {
      theirVideoElement.muted = mute;
    }
    sendMuteMessage(0, mute);
  }

    //test.. may have to force call the three animate function
  handleResize = () => 
  {
    if( three && myId && friendParticipant.getParticipantID() && (peerIds.length !== 0 || idToCall !== null) )
    {
      myMutePosition = three.getMuteButtonPosition(myId);
      theirMutePosition = three.getMuteButtonPosition(friendParticipant.getParticipantID());
    }
  }

  beforeUnload = () =>
  {
      // send to peers w/ data connections
      Object.values(dataConnections).forEach((conn) => {
        if (conn.open) conn.close();
      });
      
      peer.disconnect(); 
      console.log("disconnected from peer");
  }

  endCall = () => 
  {
    disconnectedBySelf = true; 
    idToCall = null; 

    Object.values(dataConnections).forEach((conn) => {
        if (conn.open) conn.close();
      });
    console.log("ended the call"); 
  }

  //dragging a video works with a mouse or a finger (pointer events cover both).
  //pressing a button, slider or link never starts a drag.
  function isOnControl(event : PointerEvent) : boolean
  {
    const target = event.target as HTMLElement | null;
    return !!target?.closest?.("button, input, a, label, .noDrag");
  }

  function pointerDown(event : PointerEvent)
  {
    if( !three || !event.isPrimary || isOnControl(event) ) return;
    let vidIndex = three.onMouseClick(event.clientX, event.clientY);
    if(vidIndex > -1)
    {
      document.body.style.cursor = "move"
      movingWebCamWindow.which = vidIndex;
      movingWebCamWindow.startX = event.clientX;
      movingWebCamWindow.startY = event.clientY;
      movingWebCamWindow.isMoving = true; 
    }
  }

  function pointerUp(event : PointerEvent)
  {
    movingWebCamWindow.isMoving = false; 
    document.body.style.cursor = "default"; 
  }

  function pointerMove(event : PointerEvent)
  {
    if( !three || !event.isPrimary ) return;
    let endPosX = event.clientX;
    let endPosY = event.clientY;

    if( event.pointerType === "mouse" )
    {
      let vidIndex = three.onMouseClick(event.clientX, event.clientY);
      if( vidIndex > -1 && !isOnControl(event) )
      {
        document.body.style.cursor = "move";
      }
      else if(!movingWebCamWindow.isMoving)
      {
        document.body.style.cursor = "default";
      }
    }

    if(  movingWebCamWindow.isMoving )
    {
      three.moveVideoCam( movingWebCamWindow.which, endPosX, endPosY ) ;
      if( layoutMode === "desktop" ) //phones move their videos only on their own screen
      {
        let pos : Vector3 = three.positionFromScreen(endPosX, endPosY); 
        sendVideoMoveMessage( movingWebCamWindow.which, pos.x, pos.y ) ;
      }
    }

  }

  //stop the browser scrolling or zooming the page while a finger moves a video
  onMount(() => {
    document.documentElement.classList.add("skinhunger-app");
    return () => document.documentElement.classList.remove("skinhunger-app");
  });

</script>

<!-- <svelte:window on:resize={handleResize}/> -->
<svelte:window on:beforeunload={beforeUnload} on:pointerdown={pointerDown} on:pointerup={pointerUp} on:pointercancel={pointerUp} on:pointermove={pointerMove} on:resize={onViewportChange} on:orientationchange={onViewportChange} />


{#if layoutMode === 'desktop'}
<div class="valueSliders">
  <label for="mainVolume">Music Volume:</label>
  <div class={glowClass}>
  <input
    type="range"
    min="0"
    max="0.75"
    class="slider1"
    id="mainVolume"
    step="0.01"
    value={volSliderReading}
    width="100%"
    on:input={onChangeVolumeSlider} />
  </div>
  <!-- <br /> -->
  <svg
    class="meter"
    xmlns="http://www.w3.org/2000/svg"
    width="75%"
    height="16"
    fill="none"
  >
    <rect width="100%" height="16" fill="gray" rx="3" />
    <rect
      width="{volumeMeterReading * 100}%"
      height="16"
      fill="#87CEFA"
      rx="3"
    />
  </svg><br /> 
  {#if volSliderReading <= 0 }
  Turn up the volume to hear music.
  {/if}

  <!-- <text>{volumeMeterReading}</text> -->
  <!-- <br/><br/> -->

</div>

{#if peerIds.length !== 0 || idToCall !== null}
<div class="myMute" style={`left:${myMutePosition.x}px; top:${myMutePosition.y}px`}>
  <button type="button" class="muteButton" class:isMuted={micMuted} on:click={muteSelf}
    aria-label={micMuted ? "Unmute microphone" : "Mute microphone"} title={micMuted ? "Unmute microphone" : "Mute microphone"}>
    <img src={myMuteButtonText} alt="" />
  </button>
</div>

<!-- I just made the myMutePosition.y position top for this one, bc they should be the same anyways. fix for real l8rz -->
<div class="theirMute" style={`left:${theirMutePosition.x}px; top:${theirMutePosition.y}px`}> 
  <button type="button" class="muteButton" class:isMuted={theirMuteButtonText === unmuteURL} on:click={muteThem}
    aria-label={theirMuteButtonText === unmuteURL ? "Unmute the other participant" : "Mute the other participant"}
    title={theirMuteButtonText === unmuteURL ? "Unmute the other participant" : "Mute the other participant"}>
    <img src={theirMuteButtonText} alt="" />
  </button>
</div>
{/if}
{/if}
{#if showDebugPanel}
  <DebugPanel myId={myId}>
  <!--
      anything passed in here will be in the Passed in tab
      you can move it to the DebugPanel.svelte file if it will
      be useful later, or just stick it here for experiments.
    -->

  <!-- TODO: make it replace the video it sends to the peer when switching -->
  <!-- {#each videoSources as source}
      <input type="button" on:click={() => webcamVideo.setSource(source)} value="{source}" />
    {/each}
    <br/> -->
  Data connections: {Object.keys(dataConnections).join(', ')}<br />

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
{/if}

<canvas
  class="videoAndPoseCanvas"
  bind:this={canvas}
  style={`width: 100%; height: 100vh; height: 100dvh`}
/>

{#if layoutMode === 'desktop'}
<div class="callPanel">
  {#if peerIds.length === 0 && idToCall === null}
    <Call myId={myId} {turnUpVolume} {loadMusic} {mainVolume} on:call-link-changed={(e) => {
      window.postMessage({ name: "call-call-link-changed", ...e.detail });
    }} />
    <br/><br/><div class="callText">or<br/></div>
    <button type="button" class="chatRouletteButton" on:click={connectToRandomPartner}>Connect to a random partner!</button>
    <br /><br />
    <div class="callText"><label id="chatStatus">{chatstatusMessage}</label></div>
  {:else if !myId}
    Preparing to answer<br />
    {idToCall}
  {/if}
</div>  

{#if peerIds.length > 0}
<div class="disconnectButton">
  <button on:click={endCall} class="disconnectButtonColor">End Video Call</button>
  </div>
{/if}

<br />
<div class="linksPanel">
  <a href="/about" target="_blank">About Skin Hunger</a> | <a href="/instructions" target="_blank">Instructions</a>
</div>
{/if}

{#if layoutMode !== 'desktop'}
<div class="phoneUI {layoutMode}">
  <div class="pBottom noDrag" bind:clientHeight={pBottomHeight}>

    <div class="pMusic">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#a89d9d" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/></svg>
      <div class="pSliderBox {glowClass}">
        <input
          type="range"
          min="0"
          max="0.75"
          class="pSlider"
          id="mainVolume"
          aria-label="Music volume"
          step="0.01"
          value={volSliderReading}
          on:input={onChangeVolumeSlider} />
      </div>
    </div>
    <div class="pMeter" aria-hidden="true"><i style={`width:${volumeMeterReading * 100}%`}></i></div>
    {#if volSliderReading <= 0 }
      <div class="pHint">Turn up the volume to hear music.</div>
    {/if}

    {#if !connected}
      <div class="pInvite">
        <h2 class="pTitle">Invite someone to move with you</h2>
        <Call myId={myId} compact={true} {turnUpVolume} {loadMusic} {mainVolume} on:call-link-changed={(e) => {
          window.postMessage({ name: "call-call-link-changed", ...e.detail });
        }} />
        <button type="button" class="pPrimary" on:click={connectToRandomPartner}>Connect to a random partner</button>
        {#if chatstatusMessage}
          <div class="pStatus">{chatstatusMessage}</div>
        {/if}
      </div>
    {:else if !myId}
      <div class="pInvite"><div class="pStatus">Preparing to answer...</div></div>
    {:else}
      <div class="pCtrls">
        <div class="ctl partner">
          <button type="button" class="round" class:off={theirMuteButtonText === unmuteURL} on:click={muteThem}
            aria-label={theirMuteButtonText === unmuteURL ? "Unmute the other participant" : "Mute the other participant"}>
            <img src={theirMuteButtonText} alt="" />
          </button>
          <span>{theirMuteButtonText === unmuteURL ? "Unmute partner" : "Mute partner"}</span>
        </div>
        <div class="ctl mic">
          <button type="button" class="round big" class:off={micMuted} on:click={muteSelf}
            aria-label={micMuted ? "Unmute microphone" : "Mute microphone"}>
            <img src={myMuteButtonText} alt="" />
          </button>
          <span>{micMuted ? "Mic is off" : "Mic is on"}</span>
        </div>
        <div class="ctl end">
          <button type="button" class="round endCall" on:click={endCall} aria-label="End video call">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e8d9de" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 14.5c5-4 13-4 18 0l-2.5 3-3.5-1.5v-2.5c-2-.7-4-.7-6 0V16L5.5 17.5 3 14.5z"/></svg>
          </button>
          <span>End call</span>
        </div>
      </div>
    {/if}

    <div class="pLinks">
      <a href="/about" target="_blank">About Skin Hunger</a>
      <a href="/instructions" target="_blank">Instructions</a>
    </div>
  </div>
</div>
{/if}

{#if layoutMode !== 'desktop' && (needsStartTap || $webcamError)}
  <div class="pStart noDrag" role="dialog" aria-label="Start Skin Hunger">
    {#if $webcamError}
      <h2 class="pTitle">Camera or microphone blocked</h2>
      <p>Skin Hunger needs both to work. Allow them for this site in your browser's settings, then try again.</p>
      <button type="button" class="pPrimary" on:click={retryCamera}>Try again</button>
    {:else}
      <h2 class="pTitle">Ready to move together?</h2>
      <p>Skin Hunger uses your camera to follow your movement and your microphone so you can talk with your partner.</p>
      <button type="button" class="pPrimary" on:click={startFromTap}>Start</button>
    {/if}
  </div>
{/if}

{#if loading}
  <Loading {progress} />
{/if}

<!-- <Balls /> -->
<style>
  /* a phone: nothing scrolls or zooms, so a finger can move the videos */
  :global(html.skinhunger-app),
  :global(html.skinhunger-app body) {
    overflow: hidden;
    touch-action: none;
    overscroll-behavior: none;
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
  }
  :global(html.skinhunger-app input[type="text"]) {
    -webkit-user-select: text;
    user-select: text;
  }

  .phoneUI {
    position: fixed;
    inset: 0;
    z-index: 2;
    pointer-events: none; /* empty areas fall through to the videos */
    color: #a89d9d;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  .phoneUI :global(button), .phoneUI :global(input), .phoneUI :global(a), .phoneUI .pHint, .phoneUI .pStatus, .phoneUI .pTitle {
    pointer-events: auto;
  }

  .pMusic {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 44px;
  }
  .pSliderBox {
    flex: 1;
    min-width: 0;
    border-radius: 100px;
  }
  .pSlider {
    -webkit-appearance: none;
    appearance: none;
    display: block;
    width: 100%;
    height: 44px;
    margin: 0;
    background: transparent;
  }
  .pSlider::-webkit-slider-runnable-track { height: 10px; background: #363535; border-radius: 5px; }
  .pSlider::-moz-range-track { height: 10px; background: #363535; border-radius: 5px; }
  .pSlider::-webkit-slider-thumb { -webkit-appearance: none; width: 28px; height: 28px; margin-top: -9px; border-radius: 50%; background: #0a5ccc; border: 0; }
  .pSlider::-moz-range-thumb { width: 28px; height: 28px; border-radius: 50%; background: #0a5ccc; border: 0; }

  .pMeter { height: 6px; margin: 0 0 0 38px; border-radius: 3px; background: #444; }
  .pMeter i { display: block; height: 6px; border-radius: 3px; background: #87CEFA; }
  .pHint, .pStatus { font-size: 14px; line-height: 20px; }
  .pTitle { margin: 0; font-size: 19px; line-height: 24px; font-weight: 600; color: #c8bfbf; }
  .pInvite { display: flex; flex-direction: column; gap: 12px; }
  .pPrimary {
    height: 48px;
    border: 0;
    border-radius: 24px;
    background: #57035f;
    color: #efe6ef;
    font-size: 16px;
    font-weight: 600;
    font-family: inherit;
  }
  .pStart {
    position: fixed;
    z-index: 30;
    left: 50%;
    bottom: calc(16px + env(safe-area-inset-bottom, 0px));
    transform: translateX(-50%);
    box-sizing: border-box;
    width: min(420px, calc(100vw - 32px));
    padding: 18px 20px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    border-radius: 24px;
    background: #1a1020;
    border: 1px solid #3a3340;
    color: #a89d9d;
    font-size: 15px;
    line-height: 21px;
  }
  .pStart p { margin: 0; }
  .pStart .pPrimary { height: 52px; font-size: 17px; }
  @media (orientation: landscape) {
    .pStart { left: auto; right: 12px; transform: none; bottom: 50%; margin-bottom: -110px; width: 340px; }
  }
  .pLinks { display: flex; justify-content: center; gap: 28px; font-size: 14px; }
  .pLinks a { display: flex; align-items: center; height: 44px; color: #a89d9d; text-decoration: none; }

  .ctl { display: flex; flex-direction: column; align-items: center; gap: 5px; font-size: 13px; line-height: 16px; color: #c8bfbf; text-align: center; }
  .round {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    border: 0;
    padding: 0;
    background: #37233b;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .round.big { width: 64px; height: 64px; }
  .round.off { background: #57035f; }
  .round.endCall { background: #6a1f3a; }
  .round img { width: 30px; height: 30px; pointer-events: none; }
  .round.big img { width: 34px; height: 34px; }

  /* phone held upright: a bar along the bottom, the videos overlap on a diagonal above it */
  .portrait .pBottom {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    box-sizing: border-box;
    padding: 8px 16px 4px;
    max-height: 70dvh;
    overflow-y: auto;
    border-radius: 24px 24px 0 0;
    background: rgba(18, 10, 22, 0.92);
    border-top: 1px solid #3a3340;
    display: flex;
    flex-direction: column;
    gap: 6px;
    pointer-events: auto;
  }
  .portrait .pCtrls { display: flex; justify-content: space-around; align-items: flex-start; padding-top: 4px; }
  .portrait .ctl { width: 96px; }
  .portrait .round, .portrait .round.big { width: 60px; height: 60px; }
  .portrait .round.big img { width: 30px; height: 30px; }

  /* phone held sideways: music top left, mute buttons in a left rail, end call in a right rail */
  .landscape .pBottom { display: contents; }
  .landscape .pMusic { position: absolute; left: 24px; top: 6px; width: min(420px, 50vw); }
  .landscape .pMeter { display: none; }
  .landscape .pHint { position: absolute; left: min(456px, calc(50vw + 36px)); top: 15px; width: 280px; }
  .landscape .pCtrls { display: contents; }
  .landscape .ctl { position: absolute; width: 76px; font-size: 12px; line-height: 15px; }
  .landscape .ctl.partner { left: 8px; top: 70px; }
  .landscape .ctl.mic { left: 8px; top: 160px; }
  .landscape .ctl.end { right: 8px; top: 70px; }
  .landscape .round { width: 52px; height: 52px; }
  .landscape .round.big { width: 52px; height: 52px; }
  .landscape .round.big img { width: 30px; height: 30px; }
  .landscape .pLinks { position: absolute; left: 0; right: 0; bottom: 0; height: 34px; align-items: center; }
  .landscape .pLinks a { height: 34px; }
  .landscape .pInvite {
    position: absolute;
    right: 12px;
    top: 58px;
    width: 300px;
    max-height: calc(100dvh - 100px);
    overflow-y: auto;
    gap: 10px;
  }
  .landscape .pTitle { font-size: 17px; line-height: 22px; }

  :global(body) {
    background-color: #050505;
  }

  .callPanel {
    position: absolute;
    top: 15px;
    right: 35px;
    width: 200px;
    z-index: 1; 
  }

  .disconnectButton {
    position: absolute;
    right: 35px;  
    bottom: 35px; 
    z-index: 1; 
  }

  .disconnectButtonColor {
      background-color: rgb(55, 35, 59);
      color: #928888; 
      border-style: none;
  }

  .linksPanel {
    position: absolute;
    left: 25px;
    bottom: 25px; 
    z-index: 2; 
    color: #928888;
  }

  a:link, a:visited {
  color: #928888;
  padding: 15px 25px;
  text-align: center;
  text-decoration: none;
  display: inline-block;
}

a:hover {
  color: #57035f;
  padding: 15px 25px;
  text-align: center;
  text-decoration: none;
  display: inline-block;
}

  .myMute {
    position: absolute;
    left: 35px;
    bottom: 15px;
    z-index: 1; 
    color: #928888;
  } 

  .theirMute {
    position: absolute;
    bottom: 15px;
    right: 35px;
    width: 100px;
    z-index: 1; 
    color: #928888;
  }

  .slider1 {
    -webkit-appearance: none; /* Override default CSS styles */
    appearance: none;
    width: 75%; /* Full-width */
    height: 10px; /* Specified height */
    background: #363535; /* Grey background */
    outline: none; /* Remove outline */
    opacity: 0.7; /* Set transparency (for mouse-over effects on hover) */
    -webkit-transition: 0.2s; /* 0.2 seconds transition on hover */
    transition: opacity 0.2s;
    align-self: center;
  }

  .callText
  {
    color: #928888;
  }

  .chatRouletteButton
  {
    z-index: 1;
    position: relative; 
    top: 10px;  
  }

  .valueSliders {
    position: relative;
    /* position: absolute; */
    width: 45%;
    top: 15px;
    left: 25px;
    color: #928888;
    z-index: 1;
  }

  .meter {
    display: block;
    position: relative;
    left: 0px; /* before 60 */
    top: 8px;
    background-color: gray;
  }

  /* zoom-style round control under each video, same dark purple as the End Video Call button */
  .muteButton {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background-color: rgb(55, 35, 59);
    cursor: pointer;
    opacity: 0.8;
    transition: opacity 0.2s, background-color 0.2s;
  }

  .muteButton:hover {
    opacity: 1;
    background-color: rgb(78, 50, 84);
  }

  .muteButton.isMuted {
    background-color: #57035f;
  }

  .muteButton img {
    width: 28px;
    height: 28px;
    pointer-events: none;
  }

  :global(canvas) {
    background-color: transparent;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }

  .videoAndPoseCanvas {
    z-index: -1;
  }

  .noGlow {
    z-index: 2;
  }

  .glowEffect {
    /* width: 45%; */
    /* height: 200px; */ 
    border-radius: 100px;
    /* background-color: rgb(8, 67, 177); */
    animation: glow 1s infinite alternate;
}

@keyframes glow {
  from {
    box-shadow: 0 0 10px -10px rgb(8, 67, 177);
  }
  to {
    box-shadow: 0 0 10px 10px rgb(8, 67, 177);
  }
}


</style>
