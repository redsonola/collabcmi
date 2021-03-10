import { Matrix4, Quaternion, Vector3, Group, DirectionalLight, Scene, PlaneBufferGeometry, Mesh, MeshPhongMaterial, Box3, Line, MeshBasicMaterial, Plane, PlaneHelper } from 'three';
import * as THREE from 'three';

import { videoRect } from './threejs/videoRect';
import { Joints } from './threejs/brentDrawSkeleton';

import { createOrthographicCamera } from './threejs/createOrthographicCamera';
import type { CameraVideo } from './threejs/cameraVideoElement';
import type { PosenetSetup } from './threejs/mediapipePose';
import type { Pose } from '@tensorflow-models/posenet';
import { orderParticipantID } from './participant'
import type { SkeletionIntersection } from './skeletonIntersection';

export const videoOverlapAmount = 0.66;

export interface PoseVideo {
  video: CameraVideo;
  posenet?: PosenetSetup;
}

export interface ThreeRenderProps {
  canvas: HTMLCanvasElement;
};

export interface ThreeRenderer {
  cleanup: () => void;
  dispatch: (command: DrawingCommands) => void;
}

export type MakeThreeRenderer = (props: ThreeRenderProps) => ThreeRenderer;

const textureLoader = new THREE.TextureLoader();
const map0 = textureLoader.load('/circle.jpg');

export function threeRenderCode({
  canvas,
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
  const videoGroups: Group[] = [];
  const findGroup = id => videoGroups.find(g => g.userData.personId === id);

  const videos: Mesh<PlaneBufferGeometry, MeshPhongMaterial>[] = [];
  //TODO this only works for dyads. Find another solution.
  const addVideo = (video: CameraVideo, personId: string) => {
    let group: Group | undefined = findGroup(personId);
    if (group) {
      // replace video if it exists
      group.children
        .filter(obj => obj.userData.isVideo)
        .map(obj => group?.remove(obj));

    } else {
      // add the video if it's not there
      group = new Group();
      group.userData.personId = personId;
      group.userData.isVideoGroup = true;

      participantJoints.push(new Joints(personId));

      videoGroups.push(group);
      // if(!isCallAnswered)
      //   videoGroups.push(group);
      // else videoGroups.unshift(group);
      videoGroups.sort((a, b) => orderParticipantID(a.userData.personId, b.userData.personId));
      allVideosGroup.add(group); //add from start? - can this be removed?
    }

    const vid = videoRect(video);
    const scaleNum = 1 / video.getSize().width;
    vid.applyMatrix4(new Matrix4().makeScale(scaleNum, scaleNum, 1))

    group.add(vid);

    let leftMargin : number = 0.67; 
    if( videoGroups.length <= 1 )
    {
      leftMargin = 0.5; 
    }

    for (let i = 0; i < videoGroups.length; i++) {
      const group = videoGroups[i];
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
      new Vector3(videoGroups.length, 1, 0),
    ));
  }


  let lastUpdate = performance.now();
  function animate() {
    if (running) {
      updateSize(canvas.clientWidth, canvas.clientHeight);

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
        addVideo(command.video, command.personId);
        break;
      }

      case "RemoveVideo": {
        allVideosGroup.remove(videoGroups[command.personId]);
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
  return {
    dispatch,
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