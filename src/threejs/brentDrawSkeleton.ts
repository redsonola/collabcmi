import * as THREE from 'three';
import { Color, Group, Mesh, MeshBasicMaterial, SphereBufferGeometry, Vector3 } from 'three';
import type { Pose, Keypoint } from '@tensorflow-models/posenet/dist/types';

const partNames = [
    "Ankle",
    "Ear",
    "Elbow",
    "Eye",
    "Hip",
    "Knee",
    "Shoulder",
    "Shoulder",
    "Wrist",
];

const parts = [
  ...partNames.map(n => 'left' + n),
  ...partNames.map(n => 'right' + n),
  "nose"
];

const randomPart = () => parts[Math.floor(Math.random() * parts.length)];

const connections: string[][] = [
  [
    "leftEar",
    "leftEye",
    "nose",
  ],
  [
    "nose",
    "rightEye",
    "rightEar"
  ],
  [
    "leftHip",
    "leftShoulder",
    "rightShoulder",
    "rightHip",
  ],
  [
    "leftWrist",
    "leftElbow",
    "leftShoulder",
    "rightShoulder",
  ],
  [
    "leftShoulder",
    "rightShoulder",
    "rightElbow",
    "rightWrist"
  ],
  [
    "leftAnkle",
    "leftKnee",
    "leftHip",
    "rightHip",
    "rightKnee",
    "rightAnkle"
  ],
];

function keypointToSkeletonVector3(point: Keypoint): THREE.Vector3 {
  return new Vector3(
    point.position.x,
    point.position.y,
    0
  )
}

const random255 = () => Math.random();
const randomColor = () => new Color(random255(), random255(), random255());
const colors: MeshBasicMaterial[] = [];
for (let i =0; i < 15; i++) {
  colors.push(new MeshBasicMaterial({ color: randomColor() }));
}

function makeLine(points: Vector3[]): THREE.Mesh {
  const shape = new THREE.Shape();

  shape.moveTo(points[0].x, points[0].y);
  points.forEach(({ x, y }) => {
    shape.lineTo(x, y);
  });
  shape.lineTo(points[0].x, points[0].y);

  const geometry = new THREE.ShapeBufferGeometry(shape);
  const mesh = new THREE.Mesh(geometry, colors[Math.floor(Math.random() * colors.length)]);
  mesh.position.z = Math.random();

  return mesh;
}


export function createSkeleton(pose: Pose, filter = (x: Keypoint) => true): THREE.Group {
  const goodKeypoints = pose.keypoints.filter(filter);
  const group = new THREE.Group();

  connections.map((connectedParts): Keypoint[] =>
    connectedParts
      .map(part => goodKeypoints.find(kp => kp.part === part))
      .filter(x => x) as Keypoint[]
  )
    .filter((points) => points.length >= 2)
    .map(points => points.map(keypointToSkeletonVector3))
    .map(points => makeLine(points))
    .forEach(line => {
      group.add(line);
    });

  return group;
}

export function createJoints(
  pose: Pose,
  color: (k: Keypoint) => number,
  size: (k: Keypoint) => number
): THREE.Group {
  const keypoints = pose.keypoints; // .filter(keypoint => keypoint.score > 0.005);
  const group = new Group();
  keypoints.forEach(keypoint => {
    const { position } = keypoint;
    const geometry = new SphereBufferGeometry(size(keypoint), 16, 16);
    const material = new MeshBasicMaterial({ color: color(keypoint) });
    const sphere = new Mesh(geometry, material);
    sphere.position.x = position.x;
    sphere.position.y = position.y;
    group.add(sphere);
  });
  return group;
}
