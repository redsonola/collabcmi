import { Matrix4, Quaternion, Vector3, Group, DirectionalLight, Scene, PlaneBufferGeometry, Mesh, MeshPhongMaterial, Box3 } from 'three';
import * as THREE from 'three';

import { videoRect } from './threejs/videoRect';
import { Joints } from './threejs/brentDrawSkeleton';

import { createOrthographicCamera } from './threejs/createOrthographicCamera';
import type { CameraVideo } from './threejs/cameraVideoElement';
import type { PosenetSetup } from './threejs/mediapipePose';
// import type { Pose } from '@tensorflow-models/posenet';
import { orderParticipantID } from './participant'
import type { SkeletionIntersection } from './skeletonIntersection';

const log = console.log.bind(console, 'draw3js');

export const videoOverlapAmount = 0.2;

export interface PoseVideo
{
  video: CameraVideo;
  posenet?: PosenetSetup<any>;
}

export interface ThreeRenderProps
{
  canvas: HTMLCanvasElement;
  handleResize: () => void;
};

export type MakeThreeRenderer = (props: ThreeRenderProps) => ThreeRenderer;

const textureLoader = new THREE.TextureLoader();
const map0 = textureLoader.load('/circle.jpg');

export type ThreeRenderer = ReturnType<typeof threeRenderCode>;

export function threeRenderCode({
  canvas,
  handleResize
}: ThreeRenderProps)
{
  let running = true;

  const {
    camera,
    renderer,
    updateSize,
    lookAt
  } = createOrthographicCamera(canvas, window.innerWidth, window.innerHeight);

  setTimeout(() =>
  {
    log("camera", camera);
  })

  const scene = new Scene();
  (window as any).scene = scene;

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

  function randomPoints()
  {
    const max = Math.floor(Math.random() * 10) + 5;
    const points: THREE.Vector2[] = [];
    for (let i = 0; i <= max; i++)
    {
      points.push(new THREE.Vector2(
        Math.random() * 3 - 1,
        Math.random() * 3 - 1
      ));
    }
    // points.push(points[0]);
    return points;
  }

  function randomPath()
  {
    return new THREE.SplineCurve(randomPoints());
  }

  function updatePath(origPath: THREE.SplineCurve)
  {
    const points = origPath.points.slice(-3);
    const newPath = [
      ...points,
      ...randomPoints()
    ];
    return new THREE.SplineCurve(newPath);
  }


  circleColors.forEach(color =>
  {
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

  function updateCircle(delta: number)
  {
    circles.forEach(circle =>
    {
      const distance = circle.userData.distance as number;
      const path = circle.userData.path as THREE.SplineCurve;
      circle.userData.distance += delta * 0.000015;
      if (circle.userData.distance >= 1)
      {
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

  //IRA'S LIGHT
  // Simple lighting calculations
  const color = 0xEEEEFF;
  const intensity = .85;
  const light3 = new THREE.AmbientLight(color, intensity);
  scene.add(light3);

  const color2 = 0xFFFFDD;
  const intensity2 = 1;
  const light2 = new THREE.DirectionalLight(color, intensity);
  light2.position.set(-2, 6, 1);
  //light2.target.position.set(0, 0, 0);
  scene.add(light2);
  //scene.add(light2.target);

  //end IRA'S LIGHT

  // scene.add(new THREE.AxesHelper(1)); //proof that this code is fucked

  const allVideosGroup = new Group(); //TODO: kill videoGroups & only use AllVideoGroups -- good times.
  scene.add(allVideosGroup);

  // video groups have a video and a drawn skeleton
  // const videoGroups: Group[] = [];
  const findGroup = (id) => allVideosGroup.children.find(g => g.userData.personId === id) as Group;
  const listGroupIds = () => allVideosGroup.children.map(g => g.userData.personId) as (string | undefined)[];

  let videoWidth3js = 0;
  let videoHeight3js = 0;

  let lastSize: { w: number, h: number } = { w: 0, h: 0 };


  //these variables allow moving the video
  let offsetSelfVideo: Vector3 = new Vector3(0, 0, 0);
  let offsetFriendVideo: Vector3 = new Vector3(0, 0, 0);
  let whichIndexIsSelf: number = 0;
  let myId: string = "";

  let currentVideos: Record<string, CameraVideo> = {};
  (window as any).currentVideos = currentVideos;
  (window as any).appendLatestVideos = () =>
  {
    // draw the current videos on the screen
    Object.entries(currentVideos)
      .forEach(([id, vid]) =>
      {
        vid.videoElement.setAttribute("data-peer-id", id);
        vid.videoElement.setAttribute("alt", id);
        document.body.append(vid.videoElement);
      });
  }
  log('currentVideos', currentVideos);

  const videos: Mesh<PlaneBufferGeometry, MeshPhongMaterial>[] = [];
  //TODO this only works for dyads. Find another solution.
  const addVideo = (video: CameraVideo, personId: string, recentIds: string[]) =>
  {
    currentVideos[personId] = video;
    log("addVideo", personId, "existing groups ids:", listGroupIds());
    let group: Group | undefined = findGroup(personId);
    let isRecentID = recentIds.indexOf(personId) !== -1;
    if (isRecentID)
    {
      log("addVideo but was a recent id: ", { personId });
      return;
    }

    if (group)
    {
      log("addVideo replacing group", { personId, recentIds, group });
      // replace video if it exists
      group.children
        .filter(obj => obj.userData.isVideo)
        .forEach(obj => group?.remove(obj));

    } else
    {
      //only 2 videos -- hack hack I'm tired
      if( allVideosGroup.children.length >=2 )
      {
        for( let i=0; i<allVideosGroup.children.length; i++ )
        {
          if( i!=whichIndexIsSelf)
          {
            allVideosGroup.children.splice(i, 1); 
            log("got rid of an extra video"); 
          }
        }
      }

      // add the video if it's not there
      log("addVideo creating group", { personId, recentIds, allVideosGroup });

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
    let box = new THREE.Box3().setFromObject(vid);
    let sz = new THREE.Vector3();
    if (!isNaN(box.getSize(sz).x))
    {
      videoWidth3js = box.getSize(sz).x;
      videoHeight3js = sz.y;
    }

    let leftMargin: number = 0.67;
    if (allVideosGroup.children.length <= 1)
    {
      leftMargin = 0.1;
    }

    for (let i = 0; i < allVideosGroup.children.length; i++)
    {
      const group = allVideosGroup.children[i];
      group.position.x = (videoOverlapAmount * i) + leftMargin;
      group.position.y = 0.4;
    }

    // setFrustum(-0.5, group.position.y);
    // if( allVideosGroup.children.length <= 1 )
    // {
    let boundingXBoxSize = 1.3 + ((videoOverlapAmount) * (allVideosGroup.children.length - 1));
    let xstart = 0;
    if (allVideosGroup.children.length == 1)
    {
      xstart = -0.75;
      boundingXBoxSize = 1.25;
    }
    else if( allVideosGroup.children.length > 2 )
    {
        log("added 3 videos");
        log("personid: "+personId);
        log({recentIds}); 

    }

    lookAt(new Box3(
      new Vector3(xstart, -0.5, 0),
      new Vector3(boundingXBoxSize, 1.1, 0),
    ));
    // }
  }


  let lastUpdate = performance.now();
  function animate()
  {
    if (running)
    {
      updateSize(canvas.clientWidth, canvas.clientHeight);
      if (lastSize.w !== canvas.clientWidth || lastSize.h !== canvas.clientHeight) //only call if different
      {
        if (handleResize)
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

  function updatePose(
    personId: string,
    targetVideoId: string, // which video to draw the pose on
    // pose: Pose,
    skeletonIntersect: SkeletionIntersection,
    size: { width: number, height: number }
  )
  {
    const videoGroup = findGroup(targetVideoId);
    if (!videoGroup) return;

    const lastSkeleton = videoGroup.children.find(o => (
      o.userData.isSkeleton &&
      o.userData.personId === personId
    ));

    const groupOfStuffToRender = new Group();

    // hairyLineLive = skeletonIntersect.hairyLineLive.bind(skeletonIntersect);

    // do the drawing
    // const isInArray = (element) => element.isPerson(personId);
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

    if (lastSkeleton)
    {
      videoGroup.remove(lastSkeleton);
    }
    videoGroup.add(groupOfStuffToRender);
  }

  function posToScreen(x: number, y: number): THREE.Vector3
  {
    let pos = new THREE.Vector3(x, y, 0);

    // let vidWidth = videoWidth3js;
    // let vidHeight = videoHeight3js;

    // pos.x = pos.x -  ( vidWidth / 2 ); 
    // pos.y = pos.y - (vidHeight / 2);

    camera.updateMatrixWorld();
    pos.project(camera);

    let widthHalf = window.innerWidth / 2;
    let heightHalf = window.innerHeight / 2;

    pos.x = (pos.x * widthHalf) + widthHalf;
    pos.y = - (pos.y * heightHalf) + heightHalf;
    pos.z = 0;

    return pos;
  }

  //returns world position from screen coordinates
  function posFromScreen(x: number, y: number): THREE.Vector3
  {
    let newPos = new THREE.Vector3;
    let inputVec = new THREE.Vector3(x, y, 0);

    let widthHalf = window.innerWidth / 2;
    let heightHalf = window.innerHeight / 2;

    //inverse of xform to screen
    inputVec.x = (inputVec.x - widthHalf) * (1 / widthHalf);
    inputVec.y = (inputVec.y - heightHalf) * (1 / heightHalf);

    inputVec.set(
      (x / window.innerWidth) * 2 - 1,
      - (y / window.innerHeight) * 2 + 1,
      0);

    camera.updateMatrixWorld();
    newPos = inputVec.unproject(camera)


    return newPos;
  }

  //i -- index of video
  function isInVideo(pos: Vector3): number
  {
    let isInVid: number = -1;
    let vidWidth = videoWidth3js;
    let vidHeight = videoHeight3js;
    for (let i = 0; i < allVideosGroup.children.length; i++)
    {

      let vid = allVideosGroup.children[i];
      if ((pos.x <= vid.position.x + vidWidth / 2 && pos.x >= vid.position.x - vidWidth / 2) &&
        (pos.y <= vid.position.y + vidHeight / 2 && pos.y >= vid.position.y - vidHeight / 2))
      {
        isInVid = i;
      }
    }
    return isInVid;
  }

  function moveVideo(which: number, x2: number, y2: number)
  {
    let vid = allVideosGroup.children[which];

    let vidPos = posToScreen(vid.position.x, vid.position.y);
    let pos2 = posToScreen(x2, y2);

    let offsetx = (pos2.x - vidPos.x);
    let offsety = (pos2.y - vidPos.y);

    if (whichIndexIsSelf === which)
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
    addVideo,
    removeVideo(personId: string)
    {
      delete currentVideos[personId];
      log("removeVideo", personId, "current groups ids:", listGroupIds());
      allVideosGroup.remove(findGroup(personId));
      console.warn("TODO: cleanup threejs video objects");
    },
    updatePose,

    onMouseClick(x: number, y: number): number
    {
      let newpos = posFromScreen(x, y);
      let whichVideo = isInVideo(newpos);
      return whichVideo;
    },
    positionFromScreen(x: number, y: number): Vector3
    {
      return posFromScreen(x, y);
    },
    setWhichIsSelf(personId: string): void //kind hacky gah but this code is not super flexible
    {
      myId = personId;
      const videoGroup = findGroup(personId);
      if (!videoGroup) return;
      whichIndexIsSelf = allVideosGroup.children.indexOf(videoGroup);
    },
    positionToScreen(x: number, y: number): THREE.Vector3
    {
      return posToScreen(x, y);
    },
    getOffsetVidPosition(isFriend: boolean): THREE.Vector3
    {
      if (!isFriend)
      {
        return offsetSelfVideo;
      }
      else
      {
        return offsetFriendVideo;
      }
    },
    moveVideoCamFromThreeJSCoords(which: number, x2: number, y2: number)
    {
      moveVideo(which, x2, y2)
    },
    moveVideoCam(which: number, x2: number, y2: number)
    {
      let pos2 = posFromScreen(x2, y2);
      moveVideo(which, pos2.x, pos2.y);
    },
    getMuteButtonPosition(personId: string): THREE.Vector3
    {

      let pos = new THREE.Vector3();
      const videoGroup = findGroup(personId);
      if (!videoGroup) return pos;

      const index = allVideosGroup.children.indexOf(videoGroup);
      if (index === -1) return pos;

      // const vid = videoGroup.children.find((element)=>element.userData.isVideo);
      // if(!vid) return pos;


      //convert from threejs coordinates to computer screen/browser coordinates.
      // log(personId + " vid.position ");
      // log( videoGroup.position );

      // var projector = new Projector();
      // projector.projectVector( pos.setFromMatrixPosition( videoGroup.matrixWorld ), camera );

      pos = videoGroup.position.clone(); //center of the video

      //TODO: when more participants fix
      let xsign = -1;
      if (index === 0)
      {
        xsign = 1;
      }
      let vidWidth = videoWidth3js;
      let vidHeight = videoHeight3js;

      pos.x = pos.x - (xsign * (vidWidth / 2));
      pos.y = pos.y - (vidHeight / 2);

      camera.updateMatrixWorld();
      pos.project(camera);

      let widthHalf = window.innerWidth / 2;
      let heightHalf = window.innerHeight / 2;

      pos.x = (pos.x * widthHalf) + widthHalf;
      pos.y = - (pos.y * heightHalf) + heightHalf;
      pos.z = 0;

      //after this need to add/subtract 23 pixels for one of them.
      if (xsign > 0)
      {
        pos.x -= 23; //subtracts 23 px so in line. this is the width of the icon. need to put in constant later.
      }

      return pos;
    },
    cleanup()
    {
      log('Cleaning up three stuff');
      running = false;
      currentVideos = {};
      videos.forEach((videoObj) =>
      {
        videoObj.geometry.dispose();
        videoObj.material.dispose();
      });
    }
  };
}
