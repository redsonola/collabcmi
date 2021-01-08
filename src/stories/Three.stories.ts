/**
 * An example storybook story using threejs
 * code copied from
 * https://github.com/mrdoob/three.js/blob/master/examples/webgl_interactive_lines.html
 * https://threejs.org/examples/?q=line#webgl_lines_fat
 * 
 * To make a new story, copy this file & change the exported value at the end of the
 * file from ThreeStory1.
 */

import ThreeStory from './ThreeStory.svelte';
import type { ThreeSetupFunction } from './ThreeStoryTypes';

import { CatmullRomCurve3, Color, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Line2 } from 'three/examples/jsm/lines/Line2';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry';
import { GeometryUtils } from 'three/examples/jsm/utils/GeometryUtils';

export default {
  title: 'Three',
  Component: ThreeStory,
};

const threeStory1Setup: ThreeSetupFunction = ({ canvas, setDebugData }) => {
  setDebugData({
    "This data will be JSON.stringified": "& shown in the debug panel"
  });

  let running = true;

  // viewport
  let width = 0;
  let height = 0;

  let insetWidth = 0;
  let insetHeight = 0;

  const renderer = new WebGLRenderer({ antialias: true, canvas, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x000000, 0.0);
  renderer.setSize(width, height);

  const scene = new Scene();

  const camera = new PerspectiveCamera(40, width / height, 1, 1000);
  camera.position.set(-40, 0, 60);

  const camera2 = new PerspectiveCamera(40, 1, 1, 1000);
  camera2.position.copy(camera.position);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.minDistance = 10;
  controls.maxDistance = 500;


  // Position and Color Data
  const positions: number[] = [];
  const colors: number[] = [];

  const points = GeometryUtils.hilbert3D(new Vector3(0, 0, 0), 20.0, 1, 0, 1, 2, 3, 4, 5, 6, 7);

  const spline = new CatmullRomCurve3(points);
  const divisions = Math.round(12 * points.length);
  const point = new Vector3();
  const color = new Color();

  for (let i = 0, l = divisions; i < l; i++) {
    const t = i / l;

    spline.getPoint(t, point);
    positions.push(point.x, point.y, point.z);

    color.setHSL(t, 1.0, 0.5);
    colors.push(color.r, color.g, color.b);
  }

  const geometry = new LineGeometry();
  geometry.setPositions(positions);
  geometry.setColors(colors);

  const matLine = new LineMaterial({
    color: 0xffffff,
    linewidth: 10, // in pixels
    vertexColors: true,
    //resolution:  // to be set by renderer, eventually
  });

  // matLine.dashed = true;
  // matLine.dashSize = 2;
  // matLine.gapSize = 1;
  // matLine.defines.USE_DASH = true;

  // Line2 ( LineGeometry, LineMaterial )
  const line = new Line2(geometry, matLine);
  line.computeLineDistances();
  line.scale.set(1, 1, 1);
  scene.add(line);

  onWindowResize();

  function onWindowResize() {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);

    insetWidth = width / 4; // square
    insetHeight = height / 4;

    camera2.aspect = insetWidth / insetHeight;
    camera2.updateProjectionMatrix();
  }

  function animate() {
    if (!running) return;

    requestAnimationFrame(animate);

    // main scene
    renderer.setClearColor(0x000000, 0);
    renderer.setViewport(0, 0, width, height);

    // renderer will set this eventually
    matLine.resolution.set(width, height); // resolution of the viewport
    renderer.render(scene, camera);

    // inset scene
    renderer.setClearColor(0x222222, 1);
    renderer.clearDepth(); // important!
    renderer.setScissorTest(true);
    renderer.setScissor(20, 20, insetWidth, insetHeight);
    renderer.setViewport(20, 20, insetWidth, insetHeight);

    camera2.position.copy(camera.position);
    camera2.quaternion.copy(camera.quaternion);

    // renderer will set this eventually
    matLine.resolution.set(insetWidth, insetHeight); // resolution of the inset viewport

    renderer.render(scene, camera2);

    renderer.setScissorTest(false);
  }

  animate();

  return {
    updateCanvasSize(_width, _height) {
      width = _width
      height = _height;
      onWindowResize();
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
