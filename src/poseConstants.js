//there is probably a better way of doing this
//from: https://github.com/tensorflow/tfjs-models/tree/master/posenet
export const nose = 0; 
export const leftEye = 1; 
export const rightEye = 2; 
export const leftEar = 3; 
export const rightEar = 4; 
export const leftShoulder = 5; 
export const rightShoulder = 6; 
export const leftElbow = 7; 
export const rightElbow = 8; 
export const leftWrist = 9; 
export const rightWrist = 10; 
export const leftHip = 11; 
export const rightHip = 12; 
export const leftKnee = 13; 
export const rightKnee = 14; 
export const leftAnkle = 15; 
export const rightAnkle = 16; 

export const posePointCount = 17; 

//body parts from found points/joints
export const head = [ nose, leftEye, rightEye, leftEar, rightEar ];
export const torso = [ nose, leftEye, rightEye, leftEar, rightEar, leftShoulder, rightShoulder, leftHip, rightHip  ];
export const leftArm = [ leftElbow, leftWrist ];
export const rightArm = [ rightElbow, rightWrist ];
export const leftLeg = [ leftKnee, leftAnkle ];
export const rightLeg = [  rightKnee, rightAnkle ];
export const bodyPartArray = [head, torso, leftArm, rightArm, leftLeg, rightLeg];
 
//********for the lines drawing code -- just limbs

//arms
export const leftUpperArm = [leftShoulder, leftElbow];
export const rightUpperArm = [rightShoulder, rightElbow];
export const leftForeArm = [leftElbow , leftWrist];
export const rightForeArm = [rightElbow , rightWrist];
export const collarBone = [leftShoulder , rightShoulder];


//legs
export const leftThigh = [leftHip, leftKnee];
export const rightThigh = [rightHip, rightKnee];
export const leftCalf = [leftKnee , leftAnkle];
export const rightCalf = [rightKnee , rightAnkle];


//all the lines for skeleton visualization
export const skeletonLimbs = [leftUpperArm, rightUpperArm, leftForeArm, rightForeArm, leftThigh, rightThigh, leftCalf, rightCalf, collarBone];


//angle between body constants
export const noseToShoulders = 0;
export const leftShoulderHipElbow = 1;
export const rightShoulderHipElbow = 2;
export const leftElbowShoulderWrist = 3;
export const rightElbowShoulderWrist = 4;
//start lower body
export const leftHipShoulderKnee = 5;
export const rightHipShoulderKnee = 6;
export const leftKneeHipAnkle = 7;
export const rightKneeHipAnkle = 8;

