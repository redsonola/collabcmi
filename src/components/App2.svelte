<script lang="ts">
  import { onMount } from "svelte";
  import Call from "./Call.svelte";
  // import DebugPanel from "./DebugPanel.svelte";
  // import PrintPose from "./PrintPose.svelte";
  import Loading from "./Loading.svelte";
  import { interceptFileRequest } from "../hackXhrInterceptor";

  import { videoSubscription } from "../threejs/cameraVideoElement";
  import { goLoop, sleep } from "../threejs/promiseHelpers";
  import { initPosenet } from "../threejs/mediapipePose";
  import type { PosenetSetup } from "../threejs/mediapipePose";
  import {
    createMessagingPeer,
    peerServerParams,
  } from "../peerJs";
  import type {
    PeerCommands,
    PeerMessageReceived,
  } from "../peerJs";

  // import Balls from "./Balls.svelte";
  import { threeRenderCode } from "../draw3js";
  import type { ThreeRenderer } from "../draw3js";
  import {
    peerMessageStore,
  } from "./PoseMessages";
  import type {
    Size,
    PeerConnections,
    PeerConnection,
    PoseMessage,
    PeerMessage,
  } from "./PoseMessages";
  import { Participant } from "../participant";
  import { findRadiusOfKeypoint } from "../main";
  import type { Keypoint, Pose } from "@tensorflow-models/posenet";
  // import ScoreBar from "./scoreBar.svelte";
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

  const webcamVideo = videoSubscription();
  const videoSources = ["webcam", "/spacebtwTest.mp4", "/synchTestVideo.mp4"];

  export let myId: string | undefined =
    new URL(window.location.href).searchParams.get("myid") || undefined;
  function setMyId(id: string) {
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
  let progress = "0%";
  interceptFileRequest(
    "/@mediapipe/pose/pose_solution_packed_assets.data",
    (req: XMLHttpRequest) => {
      req.addEventListener("progress", (e) => {
        progress = Math.round((e.loaded / (e.total || 17002032)) * 100) + "%";
        if (progress === "100%") progress = "starting";
      });
    }
  );

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

  let three: ThreeRenderer;
  $: if (canvas) {
    three?.cleanup();
    three = threeRenderCode({ canvas });
  }
  $: if (three && size) {
    setTimeout(() => {
      three.dispatch({ type: "SetSize", ...size });
    }, 1);
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

  let peerConnections: PeerConnections = {};

  function updatePeerData(
    id: string,
    update: (m: PeerConnection) => PeerConnection | false
  ): void {
    const updated = update(peerConnections[id]);
    if (updated) {
      peerConnections = {
        ...peerConnections,
        [id]: { ...peerConnections[id], ...update(peerConnections[id]) },
      };
    } else {
      delete peerConnections[id];
    }
  }

  let peerIds: string[] = [];

  function setPeerConnection(
    theirId,
    type: "data" | "media",
    connected: boolean | "open" | "connecting" | "received"
  ) {
    if (connected === false) {
      peerIds = peerIds.filter((id) => id !== theirId);
      updatePeerData(theirId, () => false);
    } else {
      //set friend peerID
      friendParticipant.setParticipantID(theirId); //for the dyad arrangement set the ID

      peerIds = peerIds.includes(theirId) ? peerIds : [...peerIds, theirId];

      updatePeerData(theirId, (d) => ({ ...d, [type]: connected }));
      const { data, media } = peerConnections[theirId];
      updatePeerData(theirId, (d) => ({
        ...d,
        ready: data === true && media === true,
      }));
    }
  }

  async function init(suppliedId?: string) {
    let stopped = false;
    const posenet: PosenetSetup = initPosenet();

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

    const peer = createMessagingPeer<PoseMessage>(suppliedId, peerServerParams);
    const dispatchToPeer = (x: PeerCommands<any>) => {
      messages.peerCommand(x);
      return peer.dispatch(x);
    };
    const myId = await peer.getId();
    setMyId(myId);

    function handlePeerMessage(event: PeerMessageReceived<PeerMessage>) {
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
        case "PeerError":
        case "ConnectionError": {
          console.error(event);
          throw event.error;
        }

        case "PeerOpen": {
          setMyId(event.myId);
          break;
        }

        case "ConnectionOpen": {
          setPeerConnection(event.theirId, "data", true);
          break;
        }

        case "ConnectingToPeer": {
          setPeerConnection(event.theirId, "data", "connecting");
          break;
        }

        case "ReceivedCall": {
          // theirId = event.theirId;
          setPeerConnection(event.theirId, "media", "received");
          callVideoUnsubscribe = webcamVideo.subscribe(async (video) => {
            if (video?.stream) {
              dispatchToPeer({
                ...event,
                type: "AnswerCall",
                mediaStream: video.stream,
              });
            } else if (video) {
              console.warn(
                "Rec'd call but didn't answer b/c I don't have a video stream :("
              );
            }
          });
          break;
        }

        case "ConnectionClosed": {
          setPeerConnection(event.theirId, "data", false);
          three.dispatch({ type: "RemoveVideo", personId: event.theirId });
          break;
        }

        case "CallEnded": {
          theirVideoUnsubscribe();
          three.dispatch({ type: "RemoveVideo", personId: event.theirId });
          break;
        }

        case "CallAnswered": {
          theirVideoUnsubscribe = videoSubscription(
            event.mediaStream
          ).subscribe(async (video) => {
            if (video) {
              three.dispatch({
                type: "AddVideo",
                personId: event.theirId,
                video,
              });
              setPeerConnection(event.theirId, "media", true);
            }
          });
          break;
        }

        case "PeerMessageReceived": {
          handlePeerMessage(event);
          break;
        }

        default: {
          console.error(event);
          throw new Error(`Event type ${(event as any).type} not handled`);
        }
      }
    });

    posenet.onResults((pose) => {
      loading = false;
      fpsTracker.refreshLoop();

      const size = (posenet as PosenetSetup).getSize();
      participant.setSize(size.width, size.height);
      participant.addKeypoint(pose.keypoints);
      keypointsUpdated(myId, pose, size);

      // send to peers w/ data connections
      peerIds
        .filter((theirId) => peerConnections[theirId]?.data === true)
        .forEach((theirId) => {
          dispatchToPeer({
            type: "SendPeerMessage",
            message: { type: "Pose", pose, size },
            myId,
            theirId,
          });
        });
    });

    const myVideoUnsubscribe = webcamVideo.subscribe(async (video) => {
      if (!video) return;

      posenet.updateVideo(video);

      three.dispatch({ type: "AddVideo", personId: myId, video });

      if (idToCall) {
        const theirId = idToCall;
        dispatchToPeer({ type: "DisconnectMedia", theirId });
        dispatchToPeer({ type: "ConnectToPeer", myId, theirId });

        if (video.stream) {
          dispatchToPeer({
            type: "CallPeer",
            myId,
            theirId,
            mediaStream: video.stream,
          });
        }
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

    return () => {
      console.log(`Cleaning up app for ${myId}`);
      stopped = true;
      three.cleanup();
      callVideoUnsubscribe();
      myVideoUnsubscribe();
      dispatchToPeer({ type: "DisconnectEverything" });
    };
  }

  onMount(() => {
    const promiseCleanup = init(myId);
    return () => {
      promiseCleanup.then((cleanup) => {
        cleanup();
      });
    };
  });

  export function onChangeVolumeSlider(e) {
    mainVolume.set(parseFloat(e.currentTarget.value));
  }
</script>

<div class="valueSliders">
  <label for="mainVolume">Volume:</label>
  <input
    type="range"
    min="0"
    max="0.75"
    class="slider1"
    id="mainVolume"
    step="0.01"
    value="0"
    on:input={onChangeVolumeSlider}
  /><br />
  <svg
    class="meter"
    xmlns="http://www.w3.org/2000/svg"
    width="87%"
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
  Turn up the volume to hear sound.

  <!-- <text>{volumeMeterReading}</text> -->
  <!-- <br/><br/> -->
</div>

<!-- <DebugPanel messages={messages} myId={myId} peerConnections={peerConnections}> -->
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

<!-- <ScoreBar label="skeleton touching:" score={skeletonTouching} />
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
</DebugPanel> -->

<canvas
  class="videoAndPoseCanvas"
  bind:this={canvas}
  style={`width: 100%; height: 100vh`}
/>

<div class="callPanel">
  {#if peerIds.length === 0 && idToCall === null}
    <Call {myId} />
  {:else if !myId}
    Preparing to answer<br />
    {idToCall}
  {/if}
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

  .valueSliders {
    position: relative;
    /* position: absolute; */
    width: 45%;
    top: 15px;
    left: 25px;
    color: #928888;
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
</style>
