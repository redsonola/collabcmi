import { Matrix4, Quaternion, Vector3, Group, DirectionalLight, Scene, PlaneBufferGeometry, Mesh, MeshPhongMaterial, Box3, Line, MeshBasicMaterial, Plane, PlaneHelper, Object3D, Vector2 } from 'three';
import * as THREE from 'three';

import { videoRect } from './threejs/videoRect';
import { Joints } from './threejs/brentDrawSkeleton';

import { createOrthographicCamera } from './threejs/createOrthographicCamera';
import type { CameraVideo } from './threejs/cameraVideoElement';
import type { PosenetSetup } from './threejs/mediapipePose';
import type { Pose } from '@tensorflow-models/posenet';
import { orderParticipantID } from './participant'
import type { SkeletionIntersection } from './skeletonIntersection';
import { number } from 'mathjs';

export const videoOverlapAmount = 0.66;

export interface PoseVideo {
  video: CameraVideo;
  posenet?: PosenetSetup<any>;
}

export interface ThreeRenderProps {
  canvas: HTMLCanvasElement;
  handleResize : ()=>void;
};

export interface ThreeRenderer {
  cleanup: () => void;
  dispatch: (command: DrawingCommands) => void;
  getMuteButtonPosition: (personId: string) =>  THREE.Vector3 ;
  onMouseClick : (x:number, y:number) => number; 
  setWhichIsSelf : (personId : string) => void ;
  positionFromScreen : (x:number, y:number) => THREE.Vector3;
  moveVideoCam : (which:number, x2:number, y2:number) => void;
  moveVideoCamFromThreeJSCoords : (which:number, x2:number, y2:number) => void;
  getOffsetVidPosition : (isFriend : boolean) => Vector3
  setLayout : (settings : LayoutSettings) => void; //desktop / phone portrait / phone landscape

}

export type LayoutMode = 'desktop' | 'portrait' | 'landscape';

export interface LayoutSettings {
  mode: LayoutMode;
  connected: boolean; //in a call (or joining one), as opposed to waiting alone
  bottomBarPx: number; //portrait: measured height of the bottom control bar / sheet
}

export type MakeThreeRenderer = (props: ThreeRenderProps) => ThreeRenderer;

//strips of the window used by HTML controls. The videos are fitted between them.
const DESKTOP_RESERVE = { top: 130, bottom: 125, left: 0, right: 0 }; //music + call panels on top; mute buttons above links below
const DESKTOP_SIDE_MARGIN_PX = 56; //room for the mute buttons beside the outer video corners

//portrait phone: the second video is shifted diagonally (world units; a video is 1 wide, 0.75 tall)
const PORTRAIT_DX = 0.18;
const PORTRAIT_DY = 0.51;

function reserveFor(layout: LayoutSettings) {
  switch (layout.mode) {
    case 'portrait':
      return { reserve: { top: 12, bottom: layout.bottomBarPx + 12, left: 0, right: 0 }, sideMargin: 6 };
    case 'landscape':
      //left rail: mute buttons, right rail: end call, or the invite panel while waiting alone
      return { reserve: { top: 54, bottom: 34, left: 92, right: layout.connected ? 92 : 330 }, sideMargin: 0 };
    default:
      return { reserve: DESKTOP_RESERVE, sideMargin: DESKTOP_SIDE_MARGIN_PX };
  }
}
const MUTE_BUTTON_GAP_PX = 6;
const MUTE_BUTTON_SIZE_PX = 40; //keep in sync with .muteButton in App2.svelte

const textureLoader = new THREE.TextureLoader();
const map0 = textureLoader.load('/circle.jpg');

export function threeRenderCode({
  canvas,
  handleResize
}: ThreeRenderProps): ThreeRenderer {
  let running = true;

  const {
    camera,
    renderer,
    updateSize,
    fitContent
  } = createOrthographicCamera(canvas, window.innerWidth, window.innerHeight);

  setTimeout(() => {
    console.log("camera", camera);
  })

  const scene = new Scene();

  const circles: THREE.Mesh[] = [];

  const circleColors = [
    0x000080,
    0x000099,
    0x0000cc,
    0x0000e6,
    0x0000ff,
    0x1a1aff,
    0x3333ff,
    0x5500ff,
    0x8000ff,
  ];

  function randomPoints() {
    const max = Math.floor(Math.random() * 10) + 5;
    const points: THREE.Vector2[] = [];
    for (let i = 0; i <= max; i++) {
      points.push(new THREE.Vector2(
        Math.random() * 3 - 1,
        Math.random() * 3 - 1
      ));
    }
    // points.push(points[0]);
    return points;
  }

  function randomPath() {
    return new THREE.SplineCurve(randomPoints());
  }

  function updatePath(origPath: THREE.SplineCurve) {
    const points = origPath.points.slice(-3);
    const newPath = [
      ...points,
      ...randomPoints()
    ];
    return new THREE.SplineCurve(newPath);
  }


  circleColors.forEach(color => {
    const geometry = new THREE.CircleGeometry(Math.random() * 2 + 0.5, 16);
    // const geometry = new THREE.CircleGeometry(0.5, 16);
    const material = new THREE.MeshPhongMaterial({
      color,
      transparent: true,
      map: map0,
      blending: THREE.AdditiveBlending,
    });
    const circle = new THREE.Mesh(geometry, material);

    circle.userData.distance = 0;
    circle.userData.path = randomPath();

    circles.push(circle);
    scene.add(circle);
  });

  function updateCircle(delta: number) {
    circles.forEach(circle => {
      const distance = circle.userData.distance as number;
      const path = circle.userData.path as THREE.SplineCurve;
      circle.userData.distance += delta * 0.000015;
      if (circle.userData.distance >= 1) {
        circle.userData.distance = 0;
        circle.userData.path = updatePath(circle.userData.path);
      }
      const { x, y } = path.getPointAt(distance);
      circle.position.set(x, y, 0);
    });
  }

  let participantJoints: Joints[] = [];


  const light = new DirectionalLight(0xff99cc, 1);
  light.position.set(1, 1, 1).normalize();
  scene.add(light);

  const allVideosGroup = new Group(); //TODO: kill videoGroups & only use AllVideoGroups -- good times.
  scene.add(allVideosGroup);

  // video groups have a video and a drawn skeleton
  // const videoGroups: Group[] = [];
  const findGroup = (id) => allVideosGroup.children.find(g => g.userData.personId === id) as Group;

  let videoWidth3js = 0; 
  let videoHeight3js = 0; 
  let currentLayout: LayoutSettings = { mode: 'desktop', connected: false, bottomBarPx: 0 };

  let lastSize : {w:number, h:number} = {w:0,h:0};


  //these variables allow moving the video
  let offsetSelfVideo : Vector3 = new Vector3(0,0,0); 
  let offsetFriendVideo : Vector3 = new Vector3(0,0,0); 
  let whichIndexIsSelf : number = 0; 
  let myId : string = ""; 

  const videos: Mesh<PlaneBufferGeometry, MeshPhongMaterial>[] = [];
  //TODO this only works for dyads. Find another solution.
  const addVideo = (video: CameraVideo, personId: string, recentIds: string[]) => {
    let group: Group | undefined = findGroup(personId);
    let isRecentID = recentIds.indexOf(personId) !== -1;
    if( isRecentID )
    { 
      console.log("was a recent id: " + personId);
      return; 
    }

    if (group) {
      // replace video if it exists
      group.children
        .filter(obj => obj.userData.isVideo)
        .forEach(obj => group?.remove(obj));

    } else 
    {
      // add the video if it's not there

      console.log("group below: added new video:" + personId); 
      console.log(allVideosGroup)

      group = new Group();
      allVideosGroup.add(group);

      group.userData.personId = personId;
      group.userData.isVideoGroup = true;

      participantJoints.push(new Joints(personId));

      // videoGroups.push(group);
      // if(!isCallAnswered)
      //   videoGroups.push(group);
      // else videoGroups.unshift(group);
      allVideosGroup.children.sort((a, b) => orderParticipantID(a.userData.personId, b.userData.personId));
    }

    group.children.forEach(c => c.position.y = Math.random());
    const vid = videoRect(video);
    const scaleNum = 1 / video.getSize().width;
    vid.applyMatrix4(new Matrix4().makeScale(scaleNum, scaleNum, 1))

    group.add(vid);
    let box = new THREE.Box3().setFromObject( vid );
    let sz = new THREE.Vector3();
    if( !isNaN( box.getSize(sz).x) )
    {
      videoWidth3js = box.getSize(sz).x;
      videoHeight3js = sz.y;
    }
    
    layoutVideos();
  }


  //places every video for the current layout mode and fits them to the window
  function layoutVideos() {
    const count = allVideosGroup.children.length;
    if (count === 0) return;

    const vw = videoWidth3js || 1;
    const vh = videoHeight3js || 0.75;
    const leftMargin = count <= 1 ? 0.5 : 0.67;
    const diagonal = currentLayout.mode === 'portrait';

    for (let i = 0; i < count; i++) {
      const group = allVideosGroup.children[i];
      if (diagonal) {
        //me lower and to the right, the other participant up and to the left
        const slot = count === 2 ? (i === whichIndexIsSelf ? 1 : 0) : i;
        group.position.x = leftMargin + PORTRAIT_DX * slot;
        group.position.y = 0.3 - PORTRAIT_DY * slot;
      } else {
        group.position.x = ( videoOverlapAmount * i ) + leftMargin;
        group.position.y = 0.3;
      }
    }

    //anything dragged is back at its starting place
    offsetSelfVideo.set(0, 0, 0);
    offsetFriendVideo.set(0, 0, 0);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    allVideosGroup.children.forEach((g) => {
      minX = Math.min(minX, g.position.x - vw / 2);
      maxX = Math.max(maxX, g.position.x + vw / 2);
      minY = Math.min(minY, g.position.y - vh / 2);
      maxY = Math.max(maxY, g.position.y + vh / 2);
    });

    const { reserve, sideMargin } = reserveFor(currentLayout);
    fitContent(
      new Vector3((minX + maxX) / 2, (minY + maxY) / 2, 0),
      maxX - minX,
      maxY - minY,
      reserve,
      sideMargin
    );
    handleResize();
  }

  let lastUpdate = performance.now();
  function animate() {
    if (running) {
      updateSize(canvas.clientWidth, canvas.clientHeight);
      if(lastSize.w !== canvas.clientWidth || lastSize.h !== canvas.clientHeight) //only call if different
      {
        if( handleResize )
          handleResize();
      }
      lastSize.w = canvas.clientWidth;
      lastSize.h = canvas.clientHeight;


      const now = performance.now();
      const delta = now - lastUpdate;

      updateCircle(delta);
      renderer.render(scene, camera);

      lastUpdate = now;
      requestAnimationFrame(animate);
    }
  }
  requestAnimationFrame(animate);

  function dispatch(command: DrawingCommands) {
    if (command.type !== 'UpdatePose')
      console.log('threejs', command.type, command);
    switch (command.type) {
      case "AddVideo": {
        addVideo(command.video, command.personId, command.recentIds);
        break;
      }

      case "RemoveVideo": {
        allVideosGroup.remove(findGroup(command.personId));
        console.warn("TODO: cleanup threejs video objects");
        break;
      }

      case "UpdatePose": {
        const { personId, targetVideoId, size, pose, skeletonIntersect } = command;
        const videoGroup = findGroup(targetVideoId);
        if (!videoGroup) return;

        const lastSkeleton = videoGroup.children.find(o => (
          o.userData.isSkeleton &&
          o.userData.personId === personId
        ));

        const groupOfStuffToRender = new Group();

        // do the drawing
        const isInArray = (element) => element.isPerson(personId);
        // let jointIndex = participantJoints.findIndex( isInArray );        

        // if( jointIndex !== -1 )
        // {
        //   const joints = participantJoints[jointIndex].createJoints(
        //     pose,
        //     (k => k.part.includes('Eye') ? 0x8a2be2 : 0xaa5588),
        //     (k => k.part.includes('Eye') ? 1 : k.score * 5 + 3)
        //   );
        //   groupOfStuffToRender.add(joints);
        // }

        //add the skeleton intersection lines to be drawn -- currently doesn't work
        groupOfStuffToRender.add(skeletonIntersect.getDrawGroup());
        // const skeletonLines : Line[] = skeletonIntersect.getLines(); 
        // for(let i=0; i<skeletonLines.length; i++)
        // {
        //   videoGroup.add( skeletonLines[i] )
        // }

        // const objects = createSkeleton(pose).add(joints);

        groupOfStuffToRender.userData.isSkeleton = true;
        groupOfStuffToRender.userData.personId = personId;

        // the skeleton just uses the coordinates straight from posenet.
        // the matrix below flips & moves it into position.
        const scale = 1 / size.width;
        const posenetToVideoCoords = new Matrix4().compose(
          new Vector3(size.width * scale * 0.5, size.height * scale * 0.5, 0),
          new Quaternion(),
          new Vector3(-scale, -scale, 1)
        );
        groupOfStuffToRender.applyMatrix4(posenetToVideoCoords);

        if (lastSkeleton) {
          videoGroup.remove(lastSkeleton);
        }
        videoGroup.add(groupOfStuffToRender);



        break;
      }
    }
  }

  function posToScreen(x : number, y : number) : THREE.Vector3
  {
    let pos = new THREE.Vector3(x, y, 0); 

    // let vidWidth = videoWidth3js;
    // let vidHeight = videoHeight3js;

    // pos.x = pos.x -  ( vidWidth / 2 ); 
    // pos.y = pos.y - (vidHeight / 2);
    
    camera.updateMatrixWorld(); 
    pos.project(camera);

    let widthHalf = window.innerWidth / 2;
    let heightHalf = window.innerHeight  / 2;

    pos.x = (pos.x * widthHalf) + widthHalf;
    pos.y = - (pos.y * heightHalf) + heightHalf;
    pos.z = 0;

    return pos; 
  }

  //returns world position from screen coordinates
  function posFromScreen(x : number, y: number) : THREE.Vector3
  {
    let newPos = new THREE.Vector3; 
    let inputVec = new THREE.Vector3(x,y,0);

    let widthHalf = window.innerWidth / 2;
    let heightHalf = window.innerHeight  / 2;

    //inverse of xform to screen
    inputVec.x = (inputVec.x - widthHalf) * (1/widthHalf)  ;
    inputVec.y = (inputVec.y - heightHalf) * (1/heightHalf) ;

    inputVec.set(
      (x / window.innerWidth) * 2 - 1,
      - (y / window.innerHeight) * 2 + 1,
      0);

    camera.updateMatrixWorld();
    newPos = inputVec.unproject(camera)

  
    return newPos; 
  }

  //i -- index of video
  function isInVideo(pos : Vector3) : number
  {
    let isInVid : number = -1;
    let vidWidth = videoWidth3js;
    let vidHeight = videoHeight3js;
    for( let i=0; i<allVideosGroup.children.length; i++ )
    {

      let vid = allVideosGroup.children[i];
      if( ( pos.x <= vid.position.x + vidWidth/2 && pos.x >= vid.position.x - vidWidth/2  ) &&
        ( pos.y <= vid.position.y + vidHeight/2 && pos.y >= vid.position.y - vidHeight/2 ) )
      {
        isInVid = i;
      }
    }
    return isInVid; 
  }

  function moveVideo(which:number, x2:number, y2:number)
  {
    let vid = allVideosGroup.children[which]; 

    let vidPos = posToScreen(vid.position.x, vid.position.y); 
    let pos2 = posToScreen(x2, y2);

    let offsetx = (pos2.x - vidPos.x) ; 
    let offsety = (pos2.y - vidPos.y) ;    

    if(whichIndexIsSelf === which) 
    {
      offsetSelfVideo.x += offsetx;
      offsetSelfVideo.y += offsety;
    }
    else
    { 
      offsetFriendVideo.x += offsetx;
      offsetFriendVideo.y += offsety;
    }

    vid.position.x = x2; 
    vid.position.y = y2;

    handleResize(); //moves the mute button to the new position as well, etc.
  }

  return {
    dispatch,
    onMouseClick(x:number, y:number) : number
    {
      let newpos = posFromScreen(x, y);
      let whichVideo = isInVideo(newpos);
      return whichVideo; 
    },
    positionFromScreen(x:number, y:number) : Vector3
    {
      return posFromScreen(x, y);
    },
    setWhichIsSelf(personId : string) : void //kind hacky gah but this code is not super flexible
    {
      myId = personId; 
      const videoGroup = findGroup(personId);
      if (!videoGroup) return;
      const newIndex = allVideosGroup.children.indexOf(videoGroup);
      const changed = newIndex !== whichIndexIsSelf;
      whichIndexIsSelf = newIndex;
      if (changed && currentLayout.mode === 'portrait') layoutVideos();
    },
    setLayout(settings : LayoutSettings) : void
    {
      currentLayout = { ...settings };
      layoutVideos();
    },
    getOffsetVidPosition( isFriend : boolean ) : THREE.Vector3
    {
      if( !isFriend )
      {
        return offsetSelfVideo; 
      }
      else{
        return offsetFriendVideo; 
      }
    },
    moveVideoCamFromThreeJSCoords(which:number, x2:number, y2:number) 
    {
      moveVideo(which, x2, y2) 
    },
    moveVideoCam(which:number, x2:number, y2:number) 
    {
      let pos2 = posFromScreen(x2, y2);
      moveVideo(which, pos2.x, pos2.y); 
    },
    getMuteButtonPosition (personId: string) : THREE.Vector3 {

      let pos = new THREE.Vector3();
      const videoGroup = findGroup(personId);
      if (!videoGroup) return pos;

      const index = allVideosGroup.children.indexOf(videoGroup); 
      if(index === -1) return pos; 

      // const vid = videoGroup.children.find((element)=>element.userData.isVideo);
      // if(!vid) return pos;


      //convert from threejs coordinates to computer screen/browser coordinates.
      // console.log(personId + " vid.position ");
      // console.log( videoGroup.position );

      // var projector = new Projector();
      // projector.projectVector( pos.setFromMatrixPosition( videoGroup.matrixWorld ), camera );

      pos = videoGroup.position.clone(); //center of the video

      //TODO: when more participants fix
      let xsign = -1;
      if(index === 0)
      {
        xsign = 1;
      }
      let vidWidth = videoWidth3js;
      let vidHeight = videoHeight3js;

      pos.x = pos.x - ( xsign * ( vidWidth / 2 ) ); 
      pos.y = pos.y - (vidHeight / 2);
      
      camera.updateMatrixWorld(); 
      pos.project(camera);

      let widthHalf = window.innerWidth / 2;
      let heightHalf = window.innerHeight  / 2;

      pos.x = (pos.x * widthHalf) + widthHalf;
      pos.y = - (pos.y * heightHalf) + heightHalf;
      pos.z = 0;

      //after this subtract the button width for the right-hand video.
      if(xsign > 0)
      {
        pos.x -= MUTE_BUTTON_SIZE_PX; //so the button lines up with the right edge of the video
      }

      //sits just under the video, and never leaves the visible window
      //(when the videos fill the window width there is no margin beside them)
      pos.y += MUTE_BUTTON_GAP_PX;
      const margin = 8;
      pos.x = Math.min( Math.max(pos.x, margin), window.innerWidth - MUTE_BUTTON_SIZE_PX - margin );

      return pos; 
    },
    cleanup() {
      console.warn('Cleaning up three stuff');
      running = false;
      videos.forEach((videoObj) => {
        videoObj.geometry.dispose();
        videoObj.material.dispose();
      });
    }
  };
}


export interface AddVideo {
  type: "AddVideo";
  personId: string;
  video: CameraVideo;
  recentIds : string[]; 
}

export interface RemoveVideo {
  type: "RemoveVideo";
  personId: string;
}

export interface UpdatePose {
  type: "UpdatePose";
  personId: string;
  targetVideoId: string; // which video to draw the pose on
  pose: Pose;
  skeletonIntersect: SkeletionIntersection;
  size: { width: number, height: number };
}

export interface Destroy {
  type: "Destroy";
}

export interface SetSize {
  type: "SetSize";
  width: number;
  height: number;
}

export type DrawingCommands =
  | SetSize
  | AddVideo
  | RemoveVideo
  | UpdatePose
  | Destroy;



/************************************
 * THIS HAS NOT BEEN TESTED!!!      *
interface Disposable {
  dispose: () => void;
}

interface DisposableStore {
  [name: string]: Disposable[]
}
function disposer() {
  let objects: DisposableStore = {};
  return {
    disposable<T extends Disposable>(name: string, value: T): T {
      if (disposer[name]) {
        disposer[name] = value;
      } else {
        disposer[name] = [value];
      }
      return value;
    },
    dispose(name: string) {
      if (name === "ALL") {
        Object.values(objects)
          // 2d array
          .forEach(objs => objs
            .forEach(obj => {
              obj.dispose();
            }));
        objects = {};
      } else {
        objects[name].forEach(obj => {
          obj.dispose();
        });
        delete objects[name];
      }
    }
  }
}
/************************************/