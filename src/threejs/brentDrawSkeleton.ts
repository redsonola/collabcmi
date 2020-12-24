import * as THREE from 'three';
import { BufferGeometry, Color, Group, Mesh, MeshBasicMaterial, SphereBufferGeometry, Vector3 } from 'three';
import type { Pose, Keypoint } from '@tensorflow-models/posenet/dist/types';
import { VerletNode } from './PByte3/VerletNode';

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

export class Joints{

   geometry : BufferGeometry[] ;
   material : MeshBasicMaterial;
   personId : string;


  constructor(personId : string)
  {
    this.geometry = []; 
    this.material = new MeshBasicMaterial({ color: 0x5555ff });
    this.personId = personId;
  }

  isPerson(id : string)
  {
    return id === this.personId;
  }

  createJoints(
  pose: Pose,
  color: (k: Keypoint) => number,
  size: (k: Keypoint) => number
): THREE.Group {
  const keypoints = pose.keypoints; // .filter(keypoint => keypoint.score > 0.005);
  const group = new Group();

  if( this.geometry.length > 0)
  {
    this.geometry.forEach( (geo) => geo.dispose() );
    this.geometry = [];
  }

  keypoints.forEach(keypoint => {
    const { position } = keypoint;

    this.geometry.push(new SphereBufferGeometry(size(keypoint), 16, 16));
    // const sphere = new Mesh(this.geometry[ this.geometry.length-1] , this.material);
    // sphere.position.x = position.x;
    // sphere.position.y = position.y;
    // group.add(sphere);

    const node = new VerletNode(new THREE.Vector3(position.x, position.y, 0), 10);
    node.position.x = position.x;
    node.position.y = position.y;
    group.add(node);

  });
  return group;
}
}
