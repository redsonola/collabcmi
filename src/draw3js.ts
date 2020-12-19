import { Matrix4, Quaternion, Vector3, Group, DirectionalLight, Scene, Color, PlaneBufferGeometry, Mesh, MeshPhongMaterial, Box3, Line } from 'three';

import { videoRect } from './threejs/videoRect';
import { Joints } from './threejs/brentDrawSkeleton';

import { createOrthographicCamera } from './threejs/createOrthographicCamera';
import type { CameraVideo } from './threejs/cameraVideoElement';
import type { PosenetSetup } from './threejs/posenet';
import type { Pose } from '@tensorflow-models/posenet';
import type { Size } from './components/PoseMessages';
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

export function threeRenderCode({
  canvas,
}: ThreeRenderProps): ThreeRenderer {
  const {
    camera,
    renderer,
    updateSize,
    lookAt
  } = createOrthographicCamera(canvas, window.innerWidth, window.innerHeight);

  const scene = new Scene();
  scene.background = new Color(0xffffff);

  let participantJoints : Joints[] = []; 


  const light = new DirectionalLight(0xff99cc, 1);
  light.position.set(1, 1, 1).normalize();
  scene.add(light);

  let running = true;

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
       videoGroups.sort( ( a, b ) => orderParticipantID( a.userData.personId, b.userData.personId ) );
      allVideosGroup.add(group); //add from start? - can this be removed?
    }

    const vid = videoRect(video);
    const scaleNum = 1 / video.getSize().width;
    vid.applyMatrix4(new Matrix4().makeScale(scaleNum, scaleNum, 1))

    group.add(vid);
    for (let i = 0; i < videoGroups.length; i++) {
      videoGroups[i].position.x = videoOverlapAmount*i + 0.5;
      videoGroups[i].position.y = 0.5; 
    }

    lookAt(new Box3(
      new Vector3(0, -0.5, 0),
      new Vector3(videoGroups.length, 1, 0),
    ));
  }

  function animate() {
    if (running) {
      updateSize(canvas.clientWidth, canvas.clientHeight);

      renderer.render(scene, camera);
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
        let jointIndex = participantJoints.findIndex( isInArray );        

        if( jointIndex !== -1 )
        {
          const joints = participantJoints[jointIndex].createJoints(
            pose,
            (k => k.part.includes('Eye') ? 0x8a2be2 : 0xaa5588),
            (k => k.part.includes('Eye') ? 1 : k.score * 5 + 3)
          );
          groupOfStuffToRender.add(joints);
        }

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

        //add the skeleton intersection lines to be drawn -- currently doesn't work
        // const skeletonLines : Line[] = skeletonIntersect.getLines(); 
        // for(let i=0; i<skeletonLines.length; i++)
        // {
        //   videoGroup.add( skeletonLines[i] )
        // }

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
  skeletonIntersect : SkeletionIntersection;
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