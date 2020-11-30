import ThreeStory from './ThreeStory.svelte';
import type { ThreeSetupFunction } from './ThreeStoryTypes';

import { OrthographicCamera, Vector3, WebGLRenderer, Geometry, Box3, Object3D, BoxBufferGeometry, MeshLambertMaterial } from 'three';
import { Matrix4, Quaternion, Group, DirectionalLight, Scene, Color, PlaneBufferGeometry, Mesh, MeshPhongMaterial } from 'three';

export default {
  title: 'Three',
  Component: ThreeStory,
};

const threeStory1Setup: ThreeSetupFunction = ({ canvas, setDebugData }) => {
  setDebugData({
    "This data will be JSON.stringified": "& shown in the debug panel"
  });

  const width = window.innerWidth;
  const height = window.innerHeight;

  const frustumSize = 50;
  const aspect = width / height;
  const camera = new OrthographicCamera(
    frustumSize * aspect * -0.5,
    frustumSize * aspect * 0.5,
    frustumSize * 0.5,
    frustumSize * -0.5,
    -1000,
    1000
  );

  camera.position.x = 100;
  camera.position.y = 0;
  camera.position.z = 0;

  camera.lookAt(new Vector3(0, 0, 0));

  camera.updateMatrixWorld();

  const renderer = new WebGLRenderer({ canvas, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);

  const scene = new Scene();
  scene.background = new Color(0xffffff);

  const light = new DirectionalLight(0xff99cc, 1);
  light.position.set(1, 1, 1).normalize();
  scene.add(light);


  const geometry = new BoxBufferGeometry(1, 1, 1);
  for (let i = 0; i < 50; i++) {
    const object = new Mesh(geometry, new MeshLambertMaterial({ color: Math.random() * 0xffffff }));
    object.position.x = 0;
    object.position.y = 0;
    object.position.z = 0;

    object.rotation.x = Math.random() * 2 * Math.PI;
    object.rotation.y = Math.random() * 2 * Math.PI;
    object.rotation.z = Math.random() * 2 * Math.PI;

    scene.add(object);
  }

  let running = true;
  function animate() {
    if (running) {
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }
  }
  requestAnimationFrame(animate);


  return {
    updateCanvasSize (width, height) {
      const aspect = width / height;

      camera.left = frustumSize * aspect * 0.5;
      camera.right = frustumSize * aspect * -0.5;
      camera.top = frustumSize * 0.5;
      camera.bottom = frustumSize * -0.5;

      camera.updateProjectionMatrix();

      renderer.setSize(width, height, false);
    },
    cleanup() {
      running = false;
      console.warn("Don't forget to clean up!");
    }
  }
};

export const ThreeStory1 = () => ({
  Component: ThreeStory,
  props: {
    setup: threeStory1Setup
  }
});
