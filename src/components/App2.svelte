<script lang="ts">
  import { onMount } from "svelte";
  import type { RouterState } from "yrv";
  import Peer from 'peerjs';
  import Call from "./Call.svelte";
  import DebugPanel from "./DebugPanel.svelte";
  import PrintPose from "./PrintPose.svelte";
  import Loading from "./Loading.svelte";
  // import { interceptFileRequest } from "../hackXhrInterceptor";

  import { initPosenet } from "../threejs/posenetcopy";
  // import { initPosenet } from "../threejs/mediapipePose";
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
  import type { ThreeRenderer } from "../draw3js";
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
  import "../Organism01";
  import { onVirtualTouch } from "../Organism01";
  import * as THREE from "three";
  import { DataConnection, MediaConnection } from "peerjs";


  export let router: RouterState;
  export let showDebugPanel = router.query.debug === "true";

  const webcamVideo = videoSubscription("webcam");
  const theirVideo = videoSubscription();
  // const videoSources = ["webcam", "/spacebtwTest.mp4", "/synchTestVideo.mp4"];

  let theirVideoElement;
  let muteUrl = "./icons/noun_mic_283245_grey.png"; 
  let unmuteURL = "./icons/noun_Mute_2692102_grey.png";
  let myMuteButtonText = muteUrl;
  let theirMuteButtonText = muteUrl; 
  let myMutePosition : THREE.Vector3 = new THREE.Vector3(); 
  let theirMutePosition : THREE.Vector3 = new THREE.Vector3(); 
  let handleResize : ()=>void = ()=>{}; //init as empty
  let beforeUnload : ()=>void = ()=>{}; 
  let glowClass = "noGlow"; 
  let volSliderReading = 0; 
  let inPotForChatRoulette = false; 
  
  $: {
    if ($theirVideo !== null) {
      console.log('their video', $theirVideo);
      theirVideoElement = $theirVideo.videoElement; 
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
  let progressNumber = 0;
  let progress = "0%";
  $: progress = Math.min(Math.ceil(progressNumber), 100) + "%";

  const loadInterval = setInterval(() => {
    if (!loading)
      clearInterval(loadInterval);
    else
      progressNumber = progressNumber + Math.random() * 2;
  }, 5);

  // interceptFileRequest(
  //   "/@mediapipe/pose/pose_solution_packed_assets.data",
  //   (req: XMLHttpRequest) => {
  //     req.addEventListener("progress", (e) => {
  //       progress = Math.round((e.loaded / (e.total || 17002032)) * 100) + "%";
  //       if (progress === "100%") progress = "starting";
  //     });
  //   }
  // );

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

  const BEGINNING_VOLUME = 0.66;
  // var selfMute;
  // var friendMute;  

  let three: ThreeRenderer;
  $: if (canvas) {
    three?.cleanup();
    three = threeRenderCode({ canvas, handleResize });
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

    participant.updateTouchingFriend();
    friendParticipant.updateTouchingFriend();

    if (participant.areTouching()) {
      skeletonTouching = 1;
    } else {
      skeletonTouching = 0;
    }
    let justStartedTouching: boolean = participant.justStartedTouching();
    let yposOfTouch: number = participant.getTouchPosition().y;
    let combinedWindowedScore = windowedVarScore;
    howLongTouch = participant.howLongTouching();
    howMuchTouch = participant.howMuchTouching();
    onVirtualTouch(participant.getTouch());

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

      if (friendParticipant.getMaxBodyPartWindowedVariance()) {
        combinedWindowedScore =
          combinedWindowedScore +
          friendParticipant.getMaxBodyPartWindowedVariance() / 2;
      }

      if(tubaSonfier && touchMusicalPhrases){

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

  const peer = new Peer(myId, peerServerParams);

  async function init() {
    let stopped = false;
    const posenet: PosenetSetup<any> = initPosenet();

    peer.on('open', setMyId);
    await waitFor(() => myId || null);

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
    let theirVideoUnsubscribe = () => {};

    function listenToDataConnection(conn: DataConnection) {
      if (dataConnections[conn.peer]) {
        console.warn("Trying to reconnect data for ", conn.peer, dataConnections);
      }
      dataConnections[conn.peer] = conn;
      console.log("listenToDataConnection", conn, dataConnections);
      friendParticipant.setParticipantID(conn.peer); //for the dyad arrangement set the ID
      peerIds.push(conn.peer); //so that other things work -- plugging the hole in the dam. -CDB

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
              myMuteButtonText = message.muted ?unmuteURL : muteUrl;
              break;
            }
          }

          default: {
            console.error('Unhandled data message:', message);
          }
        }
      });

      conn.on('close', function () {
        console.log("closing out bc other participant closed");
        peerIds = peerIds.filter((id) => id !== conn.peer);
        delete dataConnections[conn.peer];
        // updatePeerData(conn.peer, () => false);
        three.dispatch({ type: "RemoveVideo", personId: conn.peer });
        theirVideoUnsubscribe();

        //get rid of current friend
        friendParticipant = new Participant; 
        participant.addFriendParticipant(friendParticipant); 
        peerIds = [];
        const status = document.getElementById("chatStatus"); 
        if( status ) status.innerText = "The other participant has closed the connection...";

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
        const status = document.getElementById("chatStatus"); 
        if( status ) status.innerText = "";

        console.log('CallAnswered', call, mediaStream);
        theirVideoUnsubscribe = theirVideo.subscribe(video => {
          if (video) {
            three.dispatch({ type: "AddVideo", personId: call.peer, video });
            // setPeerConnection(call.peer, "media", true);
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
        console.log("closing out bc other participant closed here 479");

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
      loading = false;
      fpsTracker.refreshLoop();

      const size = posenet.getSize();
      participant.setSize(size.width, size.height);
      participant.addKeypoint(pose.keypoints);
      keypointsUpdated(peer.id, pose, size);

      // send to peers w/ data connections
      Object.values(dataConnections).forEach((conn) => {
        if (conn.open) conn.send({ type: "Pose", pose, size });
      });
    });

    const myVideoUnsubscribe = webcamVideo.subscribe(async (video) => {
      if (!video) return;

      posenet.updateVideo(video);

      three.dispatch({ type: "AddVideo", personId: peer.id, video });

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
          listenToDataConnection(peer.connect(theirId, { label: theirId, serialization: 'json' }));

          if (video.stream) 
          {
            if(!theirId)
              return; 
            
            console.log("calling peer");
            const call = peer.call(theirId, video.stream);
            listenToMediaConnection(call);
          }
        });
      }
      else
      {
        const status = document.getElementById("chatStatus"); 
        if( status )
          status.innerText = "Waiting for a chat partner...";
        }
      await loadMusic(mainVolume);
      turnUpVolume();
    }

    sendMuteMessage = (which: number, muted: boolean) =>
    {
      // send to peers w/ data connections
      Object.values(dataConnections).forEach((conn) => {
        if (conn.open) conn.send({ type: "Mute", which, muted });
      });
    }


    return () => {
      console.log(`Cleaning up app for ${myId}`);
      stopped = true;
      three.cleanup();
      posenet.cleanup()
      callVideoUnsubscribe();
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
    mainVolume.set(parseFloat(e.currentTarget.value));
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

  //TODO: Implement -- need to just send a message via peerjs to "muteThem"
  export function muteSelf(e)
  {
    let button = e;
    if( button )
    {
        if( myMuteButtonText === muteUrl )
        {
          myMuteButtonText = unmuteURL;
          sendMuteMessage(1, true); 
        }
        else
        {
          myMuteButtonText = muteUrl;
          sendMuteMessage(1, false); 

        }
    }
  }

  export function muteThem(e)
  {

    let button = e;
    if( button )
    {
        if( theirMuteButtonText === muteUrl )
        {
          theirMuteButtonText = unmuteURL;
          if( theirVideoElement )
          {
            theirVideoElement.muted = true ;
            console.log("muted someone else")
          }
          console.log(theirVideoElement); 
        }
        else
        {
          theirMuteButtonText = muteUrl;
          if( theirVideoElement )
          {
            theirVideoElement.muted = false; 
            console.log("turned off mute")

          }
        }
        sendMuteMessage(0, theirVideoElement.muted); 

    }
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
</script>

<!-- <svelte:window on:resize={handleResize}/> -->
<svelte:window on:beforeunload={beforeUnload} on:close={beforeUnload}/>


<div class="valueSliders">
  <label for="mainVolume">Music Volume:</label>
  <div class={glowClass} width="75%">
  <input
    type="range"
    min="0"
    max="0.75"
    class="slider1"
    id="mainVolume"
    step="0.01"
    value="0"
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
  <input type="image" on:click={muteSelf} alt="muteButton" src={myMuteButtonText} width="23px" height="23px" />
</div>

<!-- I just made the myMutePosition.y position top for this one, bc they should be the same anyways. fix for real l8rz -->
<div class="theirMute" style={`left:${theirMutePosition.x}px; top:${myMutePosition.y}px`}> 
  <input type="image" on:click={muteThem} alt="theirMuteButton" src={theirMuteButtonText} width="23px" height="23px" />
</div>
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
  Data conections: {Object.keys(dataConnections).join(', ')}<br />

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
  style={`width: 100%; height: 100vh`}
/>

<div class="callPanel">
  {#if peerIds.length === 0 && idToCall === null}
    <Call myId={myId} {turnUpVolume} {loadMusic} {mainVolume} on:call-link-changed={(e) => {
      window.postMessage({ name: "call-call-link-changed", ...e.detail });
    }} />
    <br/><br/><div class="callText">or<br/></div>
    <button type="button" class="chatRouletteButton" on:click={connectToRandomPartner}>Connect to a random partner!</button>
    <br /><br />
    <div class="callText"><label id="chatStatus"></label></div>
  {:else if !myId}
    Preparing to answer<br />
    {idToCall}
  {/if}
</div>  

<br />
<div class="linksPanel">
  <a href="/about" target="_blank">About Skin Hunger</a>
</div>

{#if loading}
  <Loading {progress} />
{/if}

<!-- <Balls /> -->
<style>
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
