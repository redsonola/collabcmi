import { Matrix4, Quaternion, Vector3, Group, DirectionalLight, Scene, Color, PlaneBufferGeometry, Mesh, MeshPhongMaterial } from 'three';

import { videoRect } from './threejs/videoRect';
import { createJoints, createSkeleton } from './threejs/brentDrawSkeleton';

import { createOrthographicCamera } from './threejs/createOrthographicCamera';
import type { CameraVideo } from './threejs/cameraVideoElement';
import type { PosenetSetup } from './threejs/posenet';
import type { Pose } from '@tensorflow-models/posenet';
import type { Size } from './components/PoseMessages';

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

  const light = new DirectionalLight(0xff99cc, 1);
  light.position.set(1, 1, 1).normalize();
  scene.add(light);

  let running = true;

  const allVideosGroup = new Group();
  scene.add(allVideosGroup);

  let sizes: { id: string, size: Size }[] = [];
  const scale = (size: Size) => {
    if (!sizes[0]) return 1;
    else return sizes[0].size.height / size.height;
  }

  const left = (i = sizes.length - 1) => sizes.slice(0, i).reduce((sum, { size }) => sum + size.width * scale(size), 0);

  const videoGroups: Group[] = [];
  const findGroup = id => videoGroups.find(g => g.userData.personId === id);

  const videos: Mesh<PlaneBufferGeometry, MeshPhongMaterial>[] = [];
  const addVideo = (video: CameraVideo, personId: string) => {
    let group: Group | undefined = findGroup(personId);
    const size = video.getSize();
    if (group) {
      // replace video if it exists
      group.children
        .filter(obj => obj.userData.isVideo)
        .map(obj => group?.remove(obj));

      group.add(videoRect(video));
      const sizeIndex = sizes.findIndex(({ id }) => id === personId);
      sizes[sizeIndex] = { id: personId, size };
      
    } else {
      // add the video if it's not there
      group = new Group();
      group.userData.personId = personId;
      videoGroups.push(group);
      sizes.push({ id: personId, size });
      allVideosGroup.add(group);
      group.add(videoRect(video));
    }
    group.userData.isVideoGroup = true;

    // const scale = sizes[0][1].height || 0 / size.height;
    updateSizes();
    lookAt(scene);
  }

  function updateSizes() {
    console.log('updating sizes', { sizes, videoGroups: videoGroups.filter(g => g.userData.isVideoGroup) });
    sizes.forEach(({ size, id }, i) => {
      const group = findGroup(id);
      if (!group) return;
      let scaleNum = scale(size);
      group.matrix = new Matrix4().makeScale(scaleNum, scaleNum, scaleNum);
      group.updateMatrix();
      group.position.x = left(i);
    });
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
        sizes = sizes.filter(({ id }) => id !== command.personId);
        Object.values(videoGroups).forEach((vid, i) => vid.position.x = left(i));
        updateSizes();
        console.warn("TODO: cleanup threejs video objects");
        break;
      }
      
      case "UpdatePose": {
        const { personId, targetVideoId, size, pose } = command;
        const videoGroup = findGroup(targetVideoId);
        if (!videoGroup) return;

        const lastSkeleton = videoGroup.children.find(o => (
          o.userData.isSkeleton &&
          o.userData.personId === personId
        ));

        const groupOfStuffToRender = new Group();

        // do the drawing
        const joints = createJoints(
          pose,
          (k => k.part.includes('Eye') ? 0x8a2be2 : 0xaa5588),
          (k => k.part.includes('Eye') ? 20 : k.score * 5 + 3)
        );

        const objects = createSkeleton(pose).add(joints);

        
        groupOfStuffToRender.add(objects);
        groupOfStuffToRender.userData.isSkeleton = true;
        groupOfStuffToRender.userData.personId = personId;

        // the skeleton just uses the coordinates straight from posenet.
        // the matrix below flips & moves it into position.
        const posenetToVideoCoords = new Matrix4().compose(
          new Vector3(size.width * 0.5, size.height * 0.5, 0),
          new Quaternion(),
          new Vector3(-1, -1, 1)
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