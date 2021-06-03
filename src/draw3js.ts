import { Matrix4, Quaternion, Vector3, Group, DirectionalLight, Scene, PlaneBufferGeometry, Mesh, MeshPhongMaterial, Box3, Line, MeshBasicMaterial, Plane, PlaneHelper, Object3D } from 'three';
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
  getOffsetVidPosition : (isFriend : boolean) => Vector3

}

export type MakeThreeRenderer = (props: ThreeRenderProps) => ThreeRenderer;

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
    lookAt
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
    
    let leftMargin : number = 0.67; 
    if( allVideosGroup.children.length <= 1 )
    {
      leftMargin = 0.5; 
    }

    for (let i = 0; i < allVideosGroup.children.length; i++) {
      const group = allVideosGroup.children[i];
      group.position.x = ( videoOverlapAmount * i ) + leftMargin;
      group.position.y = 0.3;

      //leaving the overlapped videos for now

      // const clippingPlanes: Plane[] = [];
      // // clip the right side if it's not the last video:
      // if (i !== videoGroups.length - 1) {
      //   const plane = new Plane(new Vector3(-1, 0, 0), videoOverlapAmount * i + videoOverlapAmount);
      //   clippingPlanes.push(plane);
      // }

      // // clip the left side if it's not the first video:
      // if (i !== 0) {
      //   const plane = new Plane(new Vector3(1, 0, 0), -videoOverlapAmount * i - 1 + videoOverlapAmount);
      //   clippingPlanes.push(plane);
      //   // show where it's clipping for debugging:
      //   // scene.add(new PlaneHelper(plane, 2, 0xff0000));
      // }

      // group.children
      //   .filter(x => x.userData.isVideo)
      //   .forEach((vid) => {
      //     (vid as Mesh<any, MeshBasicMaterial>).material.clippingPlanes = clippingPlanes;
      //   });
    }

    lookAt(new Box3(
      new Vector3(0, -0.5, 0),
      new Vector3(allVideosGroup.children.length, 1, 0),
    ));
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
      whichIndexIsSelf = allVideosGroup.children.indexOf(videoGroup); 
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
    moveVideoCam(which:number, x2:number, y2:number) 
    {
      let pos2 = posFromScreen(x2, y2);
      let vid = allVideosGroup.children[which]; 

      let screenPos = posToScreen(vid.position.x, vid.position.y); 

      if(whichIndexIsSelf === which) 
      {
        offsetSelfVideo.x += x2 - screenPos.x;
        offsetSelfVideo.y += y2 - screenPos.y;
      }
      else
      { 
        offsetSelfVideo.x += x2 - screenPos.x;
        offsetSelfVideo.y += y2 - screenPos.y;
      }

      vid.position.x = pos2.x; 
      vid.position.y = pos2.y;

      handleResize(); //moves the mute button to the new position as well, etc.
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

      //after this need to add/subtract 23 pixels for one of them.
      if(xsign > 0)
      {
        pos.x -= 23; //subtracts 23 px so in line. this is the width of the icon. need to put in constant later.
      }

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