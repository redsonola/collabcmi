import {
  LinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
  MeshNormalMaterial, 
  PlaneBufferGeometry,
  RGBFormat,
  VideoTexture,
  Color
} from 'three';
import type { CameraVideo } from './cameraVideoElement';

export function videoRect(video: CameraVideo) {
  const texture = new VideoTexture(video.videoElement);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.format = RGBFormat;

  const { width, height } = video.getSize();
  const geometry = new PlaneBufferGeometry(width, height);
  const color3 = new Color("rgb(255, 255, 255)");

  // transparent material for video
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.15,
    // color: color3
  });
  // const material = new MeshBasicMaterial({ map: texture });

  const mesh = new Mesh(geometry, material);
  // z = -1 so lines can be drawn @ 0 and not get covered
  mesh.position.z = -1;

  mesh.applyMatrix4(new Matrix4().makeScale(-1, 1, 1))
  mesh.userData.isVideo = true;
  return mesh;
}