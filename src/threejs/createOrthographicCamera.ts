import { OrthographicCamera, Vector3, WebGLRenderer, Geometry, Box3, Object3D } from 'three';

import { OrbitControls }  from 'three/examples/jsm/controls/OrbitControls.js';

export function cameraSizeRectangle(x, y, width, height) {
  return new Geometry().setFromPoints([
    new Vector3(0, 0, 0),
    new Vector3(0, height, 0),
    new Vector3(width, height, 0),
    new Vector3(width, 0, 0),
  ]);
}

export function createOrthographicCamera(canvas, _width, _height) {
  let width = _width, height = _height;
  const frustumSize = 1000;
  const aspect = width / height;
  const camera = new OrthographicCamera(
    frustumSize * aspect / - 2,
    frustumSize * aspect / 2,
    frustumSize / 2,
    frustumSize / - 2,
    -1000,
    1000
  );

  camera.position.x = 100;
  camera.position.y = 100;
  camera.position.z = 100;

  camera.lookAt(new Vector3(100, 100, 0));
  camera.updateMatrixWorld();
  const renderer = new WebGLRenderer({ canvas, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);

  // const controls = new OrbitControls( camera, renderer.domElement );

  return {
    camera,
    renderer,
    updateSize(width, height) {
      const aspect = width / height;

      camera.left = frustumSize * aspect / -2;
      camera.right = frustumSize * aspect / 2;
      camera.top = frustumSize / 2;
      camera.bottom = frustumSize / -2;

      camera.updateProjectionMatrix();

      renderer.setSize(width, height, false);
    },
    /**
     * Move & resize the camera so it includes obj
     * https://stackoverflow.com/questions/42865240/how-to-fit-object-to-camera-in-threejs-using-orthographiccamera
     * returns resizeWasSuccessful
     * 
     * fill=false makes it fit the object to the canvas
     * true makes it fill the canvas, possibly cutting some off
     */
    lookAt(obj: Object3D | Box3, fill = false) {
      let boundingBox: Box3;
      if (obj instanceof Box3) {
        boundingBox = obj;
      } else {
        boundingBox = new Box3().setFromObject(obj);
      }

      const size = boundingBox.getSize(new Vector3());

      const objectAspectRatio = size.x / size.y;

      const canvasAspectRatio = width / height;

      const compare = fill
        ? canvasAspectRatio < objectAspectRatio
        : canvasAspectRatio > objectAspectRatio;

      if (compare) {
        // if view is wider than it is tall, zoom to fit height
        camera.zoom = height / size.y;
      } else {
        // if view is taller than it is wide, zoom to fit width
        camera.zoom = width / size.x;
      }

      boundingBox.getCenter(camera.position)
      camera.position.z = 150

      camera.updateProjectionMatrix();
    }
  }
}