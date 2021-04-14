import * as THREE from 'three';
import { Group, Matrix4 } from 'three';

import { createOrthographicCamera } from '../threejs/createOrthographicCamera';
import { videoRect } from '../threejs/videoRect';
import type { ThreeRenderer, ThreeRenderProps } from '../draw3js';
import type { CameraVideo } from './cameraVideoElement';

export function initThree(config: ThreeRenderProps): ThreeRenderer {
  const {
    camera,
    renderer,
    updateSize,
    lookAt
  } = createOrthographicCamera(config.canvas, window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(1, 1, 1).normalize();
  scene.add(light);

  const videoGroup = new Group();
  let firstSize: { width: number, height: number };
  scene.add(videoGroup);

  let left = 0;

  const allVideosGroup = new Group();
  scene.add(allVideosGroup);

  const videoGroups: { [id: string]: Group } = {};
  const videos: THREE.Mesh<THREE.PlaneBufferGeometry, THREE.MeshPhongMaterial>[] = [];
  const addVideo = (video: CameraVideo, id: string) => {
    if (!firstSize) {
      firstSize = video.getSize();
    }
    const videoGroup = videoGroups[id] || new Group();
    videoGroups[id] = videoGroup;
    allVideosGroup.add(videoGroup);
    const size = video.getSize();
    const scale = firstSize.height / size.height;
    console.log('adding video to scene: `', id, left, firstSize, video.getSize(), scale);

    videoGroup.applyMatrix4(new Matrix4().makeScale(scale, scale, scale));
    videoGroup.position.x = left;
    left += size.width * scale;

    const videoObj = videoRect(video);
    videoGroup.add(videoObj)
    lookAt(allVideosGroup);
  }

  function onWindowResize() {
    updateSize(window.innerWidth, window.innerHeight);
  }

  window.addEventListener('resize', onWindowResize, false);

  let animating = true;

  function animate() {
    if (animating) {
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }
  }
  animate();


  return {
    dispatch(command) {
      switch (command.type) {
        case "AddVideo": {
          addVideo(command.video, command.personId);
          break;
        }
      }
    },
    getMuteButtonPosition(personId: string) : THREE.Vector3
    {
      let pos = new THREE.Vector3(); 
      return pos; 
    },
    cleanup() {
      console.warn('Cleaning up three stuff');
      window.removeEventListener('resize', onWindowResize, false);
      animating = false;

      videos.forEach((videoObj) => {
        videoObj.geometry.dispose();
        videoObj.material.dispose();
      });
    }
  };
}