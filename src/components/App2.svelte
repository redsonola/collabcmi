<script lang="ts">
  import { onMount } from "svelte";
  import type { RouterState } from "yrv";
  import Peer from 'peerjs';
  // import Call from "./Call.svelte";
  import DebugPanel from "./DebugPanel.svelte";
  import PrintPose from "./PrintPose.svelte";
  import Loading from "./Loading.svelte";
  // import { interceptFileRequest } from "../hackXhrInterceptor";
  // import { initPosenet } from "../threejs/posenetcopy";
  import { initPosenet } from "../threejs/mediapipePose";
  // import { initPosenet } from "../threejs/posenetMock";

  import { videoSubscription } from "../threejs/cameraVideoElement";
  import { goLoop, sleep, timeout, waitFor } from "../threejs/promiseHelpers";
  import type { PosenetSetup } from "../threejs/mediapipePose";
  import {
    peerServerParams,
    findChatRoulettePartner, 
    updateConnection,
    disconnectID
  } from "../peerJs";

  // import Balls from "./Balls.svelte";
  import { threeRenderCode } from "../draw3js";
  import type { ThreeRenderer } from "../draw3js";
  import type { Size, PeerMessage, PoseMessage } from "./PoseMessages";
  import { Participant, orderParticipantID } from "../participant";
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

  import {
    SynchSonifier
  } from "../SynchSonification"

  import * as Tone from "tone";
  import "../Organism01"; //turn back on for creature
  import { onVirtualTouch, startAnimation } from "../Organism01"; //turn back on for creature, uncomment Line 285, Line 607

  import * as THREE from "three";
  import { DataConnection, MediaConnection } from "peerjs";
  import { Vector3 } from "three";
  import * as OSCInterface from "../OSCInterface"
  import * as PoseIndex from "../poseConstants.js"

  export let router: RouterState;
  export let showDebugPanel = router.query.debug === "true";

  const webcamVideo = videoSubscription("webcam");
  const theirVideo = videoSubscription();
  let theirVideoUnsubscribe;
  // const videoSources = ["webcam", "/spacebtwTest.mp4", "/synchTestVideo.mp4"];

  $: if ($webcamVideo !== null) {
    console.log('webcamVideo', $webcamVideo);
  }

  enum WhichPiece {
    SKIN_HUNGER = 0, 
    SPACE_BTW = 1,
    TUG_OF_WAR = 2
  } 
  export let whichPiece : WhichPiece = WhichPiece.TUG_OF_WAR; //WhichPiece.SKIN_HUNGER; //which piece are we realizing in this main 

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
  let chatstatusMessage = "";
  let disconnectedBySelf = false;  
  let closeConnection = (conn:DataConnection) => {};
  let recentIds : string[] = []; 
  let cursorStyle : string = "default";
  let hasFriend : boolean = false; //set this when there is another participant to true & read value

  //******** IMPORTANT!!!!!!!!!!!!!!!!!! REMINDER TO SELF -- TURN BACK ON VIDEO CALL AUDIO & MUTE BUTTONS AFTER PERFORMANCE ***********/


  //is the webcam moving, if so, where?
  let movingWebCamWindow : {which:number, startX:number, startY:number, isMoving: boolean } = 
      { which:-1, startX:0, startY:0, isMoving: false } ;
  
  $: {
    if ($theirVideo !== null) {
      console.log('their video', $theirVideo);
      theirVideoElement = $theirVideo.videoElement; 
    }
  }

  export let myId: string | undefined = undefined; //so that refresh works, temp fix OCt. 24 CDB

    //new URL(window.location.href).searchParams.get("myid") || undefined; 
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

  onMount(() => {
    function onWindowResize() {
      const width = canvas.parentElement.clientWidth;
      const height = canvas.parentElement.clientHeight;
      size = { width, height };
    }
    onWindowResize();

    window.addEventListener('resize', onWindowResize, false);

    // onMount can return a cleanup function
    return () => {
      window.removeEventListener('resize', onWindowResize);
    }
  });

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

  //measures of correlation & similarity 
  let corrData: Keypoint[] = [];
  const XCORR_BODY_PARTS : number = 6; //omg fix this, but it is kind of arbitrary 
  let matchScore = 0;
  let xCorrScore = 0;
  let synchScore = 0;
  let verticalityCorrelation = 0;
  let verticalAngle = 0; 

  //measure of movement 
  let windowedVarScore = 0; // really dx as found it to be a better measure of movement than the variance for this app.
  let dxAvg : number[] = [];
  let xcorrDx : number[] = [];
  let avgLocation : {x:number, y:number}[]; //hmmm? from spacebtw but I don't if I use this

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
  let synchSonifier : SynchSonifier;
  let musicLoaded : boolean = false;
  let toneStarted = false;  
  let lastSent = 0; 


  let lastTimeWithPoseResults = -1; 
  let lastTimePolledWithAConnectionRequest = -1; 
  let lastTimeConnected = -1; 


  let isChrome = !!window.chrome && (!!window.chrome.webstore || !!window.chrome.runtime);

  var connectToRandomPartner = (e) => {}; //function to connect to a random partner
  var connectToUpdatedConnection = (e)=> {}; 
  var turnUpVolume = () => {}; //turn up the volume when connected to another user
  var sendMuteMessage = (which:number, muted:boolean) => {}; //if muting self, need to send to other person to mute.
  var sendVideoMoveMessage = (which:number, x:number, y:number) => {}; //if muting self, need to send to other person to mute.

  var endCall : ()=>void ;

  var chatRouletteButton; 

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

  //note: in this version max does everything so no music is loaded
  async function loadMusic (mainVolume : MainVolume)
  {
    //this is from my audiovisual project


        //this is the new code
    
    if( whichPiece === WhichPiece.SKIN_HUNGER)
    {

      midiFile = [new Tango332Riffs(mainVolume), new FourFloorRiffs(mainVolume)];
      midiFileBass = [new BodhranTango332(mainVolume)];

      tubaSonfier = new SonifierWithTuba(participant, mainVolume);
      touchMusicalPhrases = new TouchPhrasesEachBar(
        tubaSonfier,
        midiFile,
        midiFileBass
      );

      //note: using a for-loop for this caused my browser to crash! WTF MATE GOOD TIMES.
      Tone.Transport.start();
      await midiFile[0].parseAllFiles();
      midiFile[0].startLoop();
      await midiFile[1].parseAllFiles();
      midiFile[1].startLoop();
      await midiFileBass[0].parseAllFiles();
      midiFileBass[0].startLoop();
    }
    else if(whichPiece === WhichPiece.SPACE_BTW )
    {
      synchSonifier = new SynchSonifier(participant, mainVolume); 
      //load other midi files tbd
    }

    musicLoaded = true; 
  }

  /**************************  switch spaces if no one is here  ************************/
  function resetTestsForParticipantPresence()
  {
      lastTimeWithPoseResults = -1; 
      participant.resetZeroConfidenceTime();
  }


  function  switchSpacesIfNoUser()
  {
    if(lastTimeWithPoseResults === -1 )
    {
      return; 
    }

    let timeWithoutUser = ( Date.now() - lastTimeWithPoseResults)  / 1000.0 ; //ms to sec
    let timeWithLowConfidence = participant.getZeroConfidenceTime()  / 1000.0 ; //ms to sec
  
    let TIME_TO_WAIT = 10 * 60.0; //waiting 6min of no user to switch 
    if( timeWithoutUser > TIME_TO_WAIT || timeWithLowConfidence > TIME_TO_WAIT )
    {
      connectToRandomPartner( chatRouletteButton ); 
      resetTestsForParticipantPresence();
    }
  }

  //not yet implemented
  function  pollForConnectionRequest()
  {
    let timeWithoutPolling = ( Date.now() - lastTimePolledWithAConnectionRequest)  / 1000.0 ; //ms to sec

    let TIME_TO_WAIT = 2.0; //poll every 10 sec...
    if( timeWithoutPolling > TIME_TO_WAIT  )
    {
      lastTimePolledWithAConnectionRequest = Date.now(); 
      connectToUpdatedConnection( chatRouletteButton ); 
    }
  }

  function pollLastTimeConnected()
  {
    if( lastTimeConnected === -1 )
    {
      return;
    }

    let timeWithoutConnection = ( Date.now() - lastTimeConnected)  / 1000.0 ; //ms to sec
    let TIME_TO_CONNECT_AGAIN =  15 * 60.0; // 

    if( timeWithoutConnection > TIME_TO_CONNECT_AGAIN  )
    {
      connectToRandomPartner( chatRouletteButton ); 
      lastTimeConnected = Date.now(); //try again in 15, not immediately
    }
  }

  /*********************  SEND OSC   ***********************/

  /***************** main update function *****************/

  function keypointsUpdated(particiantId: string, pose: Pose, size: Size) {
    let thisparticipant: Participant;

    if (participant.isParticipant(particiantId)) {
      thisparticipant = participant;
      three.setWhichIsSelf( particiantId ); //figure out how to just set this once, gah.
      friendParticipant.updateTouchingFriend(three.getOffsetVidPosition(true), hasFriend, false);
    } else {
      thisparticipant = friendParticipant;
      participant.updateTouchingFriend(three.getOffsetVidPosition(false), hasFriend, true);

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

    for( let i=0; i<XCORR_BODY_PARTS; i++ )
    {
      dxAvg[i] = participant.getAverageBodyPartDXFromIndex(i).avg;
    }

    let minConfidence = 0.66;
    windowedVarScore = participant.getMaxBodyPartDx(minConfidence); 

    let justStartedTouching: boolean = false;
    let yposOfTouch: number = 0;
    let combinedWindowedScore : number = 0;

    if( peerIds.length !== 0 && hasFriend ){

      if (participant.areTouching()) {
        skeletonTouching = 1;
      } else {
        skeletonTouching = 0;
      }
      justStartedTouching = participant.justStartedTouching();
      yposOfTouch = participant.getTouchPosition().y;
      combinedWindowedScore = windowedVarScore;
      howLongTouch = participant.howLongTouching();
      //howMuchTouch = participant.howMuchTouching();
      onVirtualTouch(participant.getTouch()); //TURN ON FOR CREATURE
    }

    try {
      //pearson correlation is -1 to 1 -- just scale to 0 to 1 to display in debugging window.
      //verticalityCorrelation = Scale.linear_scale( participant.getVerticalityCorrelation(), -1, 1, 0, 1);
      
      //high negative correlation is still high correlation for this measure
      verticalityCorrelation = Math.abs( participant.getVerticalityCorrelation() ); 

      //omfg
      let verticalityCorrOSC: number = -1; 
      let touchVelocityOSC:number = -1; 
      let touchXPosOSC: number = -1; 
      let touchYPosOSC:number = -1; 
      let localParticipant_jerkOSC:number = -1; 
      let touchPointCorrelationOSC:number = -1; 
      let howLongTouchOSC:number = -1; 
      let self_noseXOSC:number = -1; 
      let self_noseYOSC:number = -1; 
      let friend_noseXOSC:number = -1; 
      let friend_noseYOSC:number = -1; 
      let combinedDxDyOSC:number = -1; 
      let synchScoreOSC:number = -1; 

      let iAmSecond = orderParticipantID(particiantId, friendParticipant.participantID) === -1;
      if( Date.now() - lastSent >= 100  )
      {
        lastSent = Date.now();
        // if( iAmSecond )
        // {

          //note the file recording server has to be running for this
          if( whichPiece === WhichPiece.TUG_OF_WAR ) //send to max patch
          {
            let vert = participant.getVerticalityCorrelation();
            if( !isNaN( vert ) )
            verticalityCorrOSC = participant.getVerticalityCorrelation();
          }
          if( participant.areTouching() )
          {
            //this is a hack. let's see tho.
            let si = participant.getSkeletonIntersection(); 
            let x = Scale.linear_scale( participant.getTouchPosition().x, si.xMin, si.xMax, 0, 1); 
            let y = Scale.linear_scale( participant.getTouchPosition().y, si.yMin, si.yMax, 0, 1); 
            // console.log("x: "+participant.getTouchPosition().x+ " y: " + participant.getTouchPosition().y + " xmax: " + si.xMax + " xmin: " + si.xMin);

            touchVelocityOSC = participant.getTouchVelocity();
            touchXPosOSC = x; 
            touchYPosOSC = y ;
            localParticipant_jerkOSC = participant.getAvgJerk();
            touchPointCorrelationOSC = participant.getAvgXCorrAtTouchingKeypoints(); 

          }
          howLongTouchOSC =  howLongTouch; //send no matter what
          
          self_noseXOSC =  participant.avgKeyPoints.getTopX(PoseIndex.nose); 
          self_noseYOSC = participant.avgKeyPoints.getTopY(PoseIndex.nose); 

          if( hasFriend )
          {
            friend_noseXOSC = friendParticipant.avgKeyPoints.getTopX(PoseIndex.nose); 
            friend_noseYOSC = friendParticipant.avgKeyPoints.getTopY(PoseIndex.nose); 

            combinedWindowedScore += friendParticipant.getMaxBodyPartDx(minConfidence); 
            combinedWindowedScore /= 2; 
            combinedDxDyOSC = combinedWindowedScore; 
            synchScoreOSC =  synchScore; 
          }
          OSCInterface.sendOSC(verticalityCorrOSC,
              touchVelocityOSC, 
              touchXPosOSC, 
              touchYPosOSC,
              localParticipant_jerkOSC, 
              touchPointCorrelationOSC,
              howLongTouchOSC, 
              self_noseXOSC, 
              self_noseYOSC,
              friend_noseXOSC,
              friend_noseYOSC,
              combinedDxDyOSC,
              synchScoreOSC );

      // }
  }

      
      // leaving in here for debugging
      // verticalAngle = participant.getVerticalAngleMeasure();
      // console.log( { verticalAngle } );

      participant.xCorrDistance(friendParticipant); //update xcorr velocity/distance

      const r0 = findRadiusOfKeypoint(participant, 0);
      if (!Number.isNaN(r0)) {
        corrData = pose.keypoints
          // go through each keypoint, and replace score w/ the result of this fn
          // that way the little chart thing will have all the names too
          .map((keypoint, index) => ({
            ...keypoint,
            score: findRadiusOfKeypoint(participant, index) / 100,
          }));

        xcorrDx = participant.getAvgXCorrBodyParts();

        let matchMin = 0; //just cut-off lower values to create more spread in higher
        let matchMax = 0.4; //before, 0.25

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
        combinedWindowedScore = ( combinedWindowedScore + friendParticipant.getMaxBodyPartDx() ) / 2;
      }

      //I will fix this. this needs to be refactored out. will def. do this at some point.
      if(tubaSonfier && touchMusicalPhrases && peerIds.length > 0){

        //update music 1st
        if( musicLoaded ) 
        {
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
      }
      else if( synchSonifier )
      {
        if( musicLoaded ) 
        {
          synchSonifier.update( 
            matchScore, 
            participant.getAvgBodyPartsLocation(), 
            xcorrDx, 
            participant.getAvgBodyPartsJerk(), 
            friendParticipant.getAvgBodyPartsJerk(), 
            dxAvg, windowedVarScore, 
            participant.getAvgBodyPartsAccel() );
        }
      }
      

    } 
    catch (ex) 
    {
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

  $: {
    console.log('peerIds changed:', peerIds);
  }

  const peer = new Peer(myId, peerServerParams);

  async function init() {
    if( !isChrome )
    {
      alert("We detected that you were on a suboptimal browser for Skin Hunger. In order to fully experience our installation, we suggest using Chrome as your web browser. All features may not be fully functional or you might suffer performance problems.");
    }

    //only if sending to max -- note the file recording server should be started
    if( whichPiece === WhichPiece.TUG_OF_WAR )
       OSCInterface.initOSC();


    mainVolume = new MainVolume((val) => {
      volumeMeterReading = val;
    });
    let stopped = false;
    const posenet: PosenetSetup<any> = initPosenet();

    peer.on('open', setMyId);
    await waitFor(() => myId || null);

    for(let i=0; i<XCORR_BODY_PARTS; i++)     
    {
      dxAvg.push(0); 
    }

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
      if( !hasFriend )
        return; 
        
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
        if( !disconnectedBySelf )//immediately reconnect
            chatstatusMessage = "The other participant has disconnected.\n Connecting to another space...";

          
        disconnectedBySelf = false;
        hasFriend = false; 
    }

    function listenToDataConnection(conn: DataConnection) {
      lastTimePolledWithAConnectionRequest = Date.now();
      if (dataConnections[conn.peer]) {
        console.warn("Trying to reconnect data for ", conn.peer, dataConnections);
      }

      //hang up if already has call.
      if( hasFriend )
      {
        endCall(); 
        console.log("ending call of prev. friend");
      }

      dataConnections[conn.peer] = conn;
      console.log("listenToDataConnection", conn, dataConnections);
      friendParticipant.setParticipantID(conn.peer); //for the dyad arrangement set the ID
      hasFriend = true; 
      peerIds = [...peerIds, conn.peer]; //so that other things work -- plugging the hole in the dam. -CDB

      console.log('setting friend ID:', conn.peer)

      conn.on('data', function (message: PeerMessage) {
        lastTimeConnected = Date.now(); 
        switch (message.type) {
          case "Pose": {
            friendParticipant.setSize(message.size.width, message.size.height);
            friendParticipant.addKeypoint(message.pose.keypoints, hasFriend, three.getOffsetVidPosition(true), false);
            participant.updateTouchingFriend(three.getOffsetVidPosition(false), true, true); //call skeleton intersection
            keypointsUpdated(conn.peer, message.pose, message.size);
            break;
          }
          case "Mute": {
            if( message.which === 0 )
            {
              myMuteButtonText = message.muted ?unmuteURL : muteUrl;
            }
            else
            {
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
            three.moveVideoCamFromThreeJSCoords( message.which, message.x, message.y );
            break; 
          }

          default: {
            console.error('Unhandled data message:', message);
          }
        }
      });

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
        loadMusic(mainVolume); 
        turnUpVolume();
        musicLoaded = true; 
        
        //connect to a partner upon load.
        connectToRandomPartner( document.getElementById('btnChatRoulette') ); 

      }
      loading = false;
      fpsTracker.refreshLoop();

      lastTimeWithPoseResults = Date.now(); 

      const size = posenet.getSize();
      participant.setSize(size.width, size.height);
      participant.addKeypoint(pose.keypoints, hasFriend,three.getOffsetVidPosition(false), true);
      keypointsUpdated(peer.id, pose, size);

      // send to peers w/ data connections
      Object.values(dataConnections).forEach((conn) => {
        if (conn.open) conn.send({ type: "Pose", pose, size });
      });
    });

    const myVideoUnsubscribe = webcamVideo.subscribe(async (video) => {
      if (!video) return;

      posenet.updateVideo(video);

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

        // setTimeout( function(){ loadMusic(mainVolume); }, 100 );
      }
    });

    goLoop(async () => {
      if (stopped) return goLoop.STOP_LOOP;
      await sleep();
      switchSpacesIfNoUser(); //if there is not a user, switch spaces
      setTimeout(pollForConnectionRequest, 100 );
      pollLastTimeConnected(); //if not connected for 20 minutes, will reconnect

      if (touchMusicalPhrases) { //if this is skin hunger.
        touchMusicalPhrases.play();
      }

      //********** get the music messages HERE ********************//
      //note that this needs to be turned on / uncommented in the sonifier class as well
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


    chatRouletteButton = document.getElementById('btnChatRoulette');
    connectToRandomPartner = async (e) => {

      endCall(); 
      console.log( "connecting to random partner" );
      let theirId = await findChatRoulettePartner( peer.id );

      if( theirId && theirId !== "0" )
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

          chatstatusMessage = "Connecting to a new space. May take a minute...";

          listenToDataConnection(peer.connect(theirId, { label: theirId, serialization: 'json' }));

          if (video.stream) 
          {
            if(!theirId)
              return; 
            
            const call = peer.call(theirId, video.stream);
            listenToMediaConnection(call);
          }
          else
          {
            console.log(" didn't get the video stream in connectToUpdatedConnection! ");
          }
        });
      }
      else
      {
        chatstatusMessage = "Waiting for a connection...";

        // await loadMusic(mainVolume);
      }
    }

    connectToUpdatedConnection = async (e) =>
    {
      let theirId = await updateConnection( peer.id );

      if( theirId === "0" )
      {
        endCall(); 
        chatstatusMessage = "Currently not connected to a space. Cycle spaces to connect to a space";
        //to do -- put in a timeout function if this works.
      }

      //copied from above but should work
      if( theirId && theirId !== "0" )
      {
        //endCall(); //this is different

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

          chatstatusMessage = "Connecting to new space...";

          listenToDataConnection(peer.connect(theirId, { label: theirId, serialization: 'json' }));

          if (video.stream) 
          {
            if(!theirId)
              return; 
            
            const call = peer.call(theirId, video.stream);
            listenToMediaConnection(call);
          }
          else
          {
            console.log(" didn't get the video stream in connectToUpdatedConnection! ");
          }
        });
      }
      else
      {
        chatstatusMessage = " ";
        if( theirId === "0" )
        {
          chatstatusMessage = "Currently not connected to a space. Cycle spaces to connect to a space.";
        }

        // await loadMusic(mainVolume);
      }

    };

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
      disconnectID(peer.id ); 
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
    if( !toneStarted  ) {
           Tone.start();
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
      disconnectID(peer.id ); 
      peer.disconnect(); 
      console.log("disconnected from peer");
  }

  endCall = () => 
  {
    if( !hasFriend )
      return; 

    disconnectedBySelf = true; 
    idToCall = null; 

    Object.values(dataConnections).forEach((conn) => {
        if (conn.open) conn.close();
      });
    console.log("ended the call");
  }

  function mouseClick(event)
  {
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

  function mouseUp(event)
  {
    movingWebCamWindow.isMoving = false; 
    document.body.style.cursor = "default"; 
  }

  function mouseMove(event)
  {
    let endPosX = event.clientX;
    let endPosY = event.clientY;
    let vidIndex = three.onMouseClick(event.clientX, event.clientY);

    if( vidIndex > -1 )
    {
      document.body.style.cursor = "move";
    }
    else if(!movingWebCamWindow.isMoving)
    {
      document.body.style.cursor = "default";
    }

    if(  movingWebCamWindow.isMoving )
    {
      three.moveVideoCam( movingWebCamWindow.which, endPosX, endPosY ) ;
      let pos : Vector3 = three.positionFromScreen(endPosX, endPosY); 
      sendVideoMoveMessage( movingWebCamWindow.which, pos.x, pos.y ) ;
    }

  }


</script>

<!-- <svelte:window on:resize={handleResize}/> -->
<svelte:window on:beforeunload={beforeUnload} on:mousedown={mouseClick} on:mouseup={mouseUp} on:mousemove={mouseMove} />


<div class="valueSliders">
  <!-- <label for="mainVolume">Music Volume:</label>
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
  </div> -->
  <!-- <br /> -->
  <!--
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
-->

  <!-- <text>{volumeMeterReading}</text> -->
  <!-- <br/><br/> -->
</div>

 {#if peerIds.length !== 0 || idToCall !== null}
<div class="myMute" style={`left:${myMutePosition.x}px; top:${myMutePosition.y}px`}>
  <input type="image" on:click={muteSelf} alt="muteButton" src={myMuteButtonText} width="23px" height="23px" />
</div>

<!-- I just made the myMutePosition.y position top for this one, bc they should be the same anyways. fix for real l8rz -->
<div class="theirMute" style={`left:${theirMutePosition.x}px; top:${theirMutePosition.y}px`}> 
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
  Data connections: {Object.keys(dataConnections).join(', ')}<br />  
  <ScoreBar label="verticality correlation:" score={verticalityCorrelation} />
  <ScoreBar label="skeleton touching:" score={skeletonTouching} />
    <ScoreBar label="how long touching:" score={howLongTouch} />
    <!--<ScoreBar label="how much touching:" score={howMuchTouch} /> -->
    <ScoreBar label="match score:" score={matchScore} />
    <ScoreBar label="touching xcorr score:" score={xCorrTouching} />
    <ScoreBar label="total xcorr score:"score={xCorrScore} />
    <ScoreBar label="combined score:"score={synchScore} />

    <ScoreBar label="xcorr head:"score={xcorrDx[0]} />
    <ScoreBar label="xcorr torso:"score={xcorrDx[1]} />
    <ScoreBar label="xcorr left arm:"score={xcorrDx[2]} />
    <ScoreBar label="xcorr arm:"score={xcorrDx[3]} />
    <ScoreBar label="xcorr left leg:"score={xcorrDx[4]} />
    <ScoreBar label="xcorr right leg:"score={xcorrDx[5]} />

    <ScoreBar label="dx score:"score={windowedVarScore} />
    <ScoreBar label="dx head:"score={dxAvg[0]} />
    <ScoreBar label="dx torso:"score={dxAvg[1]} />
    <ScoreBar label="dx left arm:"score={dxAvg[2]} />
    <ScoreBar label="dx right arm:"score={dxAvg[3]} />
    <ScoreBar label="dx left leg:"score={dxAvg[4]} />
    <ScoreBar label="dx right leg:"score={dxAvg[5]} />

    <PrintPose keypoints={corrData} />
  </DebugPanel> 
{/if}

<canvas
  class="videoAndPoseCanvas"
  bind:this={canvas}
  style={`width: 100%; height: 100vh`}
/>

<div class="callPanel">
  <!-- {#if peerIds.length === 0 && idToCall === null} -->
    <!-- <Call myId={myId} {turnUpVolume} on:call-link-changed={(e) => {
      window.postMessage({ name: "call-call-link-changed", ...e.detail });
    }} /> -->
    <!-- <br/><br/><div class="callText">or<br/></div> -->
    <button type="button" class="chatRouletteButton" id="btnChatRoulette" on:click={connectToRandomPartner}>Connect to a new remote space!</button>
    <br /><br />
    <div class="callText"><label id="chatStatus">{chatstatusMessage}</label></div>
  <!-- {:else if !myId}
    Preparing to answer<br />
    {idToCall}
  {/if} -->
</div>  


<!-- for the telematic version, just keep it connected if possible -->
 <!-- {#if peerIds.length > 0} -->
<!-- <div class="disconnectButton">
  <button on:click={endCall} class="disconnectButtonColor">End Video Call</button>
  </div>> -->
<!-- {/if}  -->

<br />
<div class="linksPanel">
  <a href="/about" target="_blank">About Skin Hunger</a> | <a href="/instructions" target="_blank">Instructions</a>
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
    width: 250px;
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
    font-size: 16px; 
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
