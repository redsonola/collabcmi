//Programmer: Courtney Brown, June 2020
//find angles btw different body parts

import * as math from 'mathjs';
// import { assert } from 'console';
import * as PoseIndex from './poseConstants.js';
import type { Keypoint } from '@tensorflow-models/posenet';


export function distance(x1:number, y1:number, x2:number, y2:number) : number
{
    return math.sqrt( (x2-x1)*(x2-x1) + (y2-y1)*(y2-y1)  );
}

export function getAngleFunctionsFromKeypoints(keypoints1 : Keypoint[]) {

    var keypoints : Keypoint[] = keypoints1; 

    if (keypoints == null) return null;

    math.config({
        number: 'BigNumber',      // Default type of number:
                                  // 'number' (default), 'BigNumber', or 'Fraction'
        precision: 64             // Number of significant digits for BigNumbers
      })

    //law of cosines
    // arccos((P12^2 + P13^2 - P23^2) / (2 * P12 * P13))
    // where P12 is the length of the segment from P1 to P2, calculated by
    // sqrt((P1x - P2x)^2 + (P1y - P2y)^2)
    //p1 is the center point, p2 is the next point clockwise, p3 is the remaining point
    //p23 is the opposite side
    function getAngle(k1:Keypoint, k2:Keypoint, k3:Keypoint) : number {

        const {y:p1y,  x:p1x} = k1.position; 
        const {y:p2y,  x:p2x } = k2.position; 
        const {y:p3y,  x:p3x} = k3.position;  

        let p12 : number = distance(p1x, p1y, p2x, p2y);
        let p13 : number = distance(p1x, p1y,p3x, p3y);
        let p23 : number = distance(p2x, p2y, p3x, p3y);

        let ans : number = math.acos((p12 * p12 + p13 * p13 - p23 * p23) / (2 * p12 * p13));

        if( p12===0 || p13 ===0 )
        {
            return 0; 
        }
        else return ans;
    }

    /*********** a series of functions to return angle between specific body parts ***********/
    return {
        //calculates nose to shoulders.. lets see how this does
        //this uses the left shoulder as the point of the angle to measure -- 6/23/2020
        noseToShoulders() : number {

            console.assert(keypoints != null);

            return getAngle(keypoints[PoseIndex.leftShoulder], keypoints[PoseIndex.rightShoulder], keypoints[PoseIndex.nose] );

        },

        leftShoulderHipElbow() : number  {
            console.assert(keypoints != null);

            return getAngle(keypoints[PoseIndex.leftShoulder], keypoints[PoseIndex.leftHip], keypoints[PoseIndex.leftElbow]);
        },

        rightShoulderHipElbow() : number  {
            console.assert(keypoints != null);

            return getAngle(keypoints[PoseIndex.rightShoulder], keypoints[PoseIndex.rightHip], keypoints[PoseIndex.rightElbow]);
        },

        leftElbowShoulderWrist()  : number {
            console.assert(keypoints != null);

            return getAngle(keypoints[PoseIndex.leftElbow], keypoints[PoseIndex.leftShoulder], keypoints[PoseIndex.leftWrist]);
        },

        rightElbowShoulderWrist()  : number {
            console.assert(keypoints != null);

            return getAngle(keypoints[PoseIndex.rightElbow], keypoints[PoseIndex.rightShoulder], keypoints[PoseIndex.rightWrist]);
        },

        //start lower body
        leftHipShoulderKnee() : number  {
            console.assert(keypoints != null);

            return getAngle(keypoints[PoseIndex.leftHip], keypoints[PoseIndex.leftShoulder], keypoints[PoseIndex.leftKnee]);
        },

        rightHipShoulderKnee()  : number {
            console.assert(keypoints != null);

            return getAngle(keypoints[PoseIndex.rightHip], keypoints[PoseIndex.rightShoulder], keypoints[PoseIndex.rightKnee]);
        },

        leftKneeHipAnkle() : number  {
            console.assert(keypoints != null);

            return getAngle(keypoints[PoseIndex.leftKnee], keypoints[PoseIndex.leftHip], keypoints[PoseIndex.leftAnkle]);
        },

        rightKneeHipAnkle() : number  {
            console.assert(keypoints != null);

            return getAngle(keypoints[PoseIndex.rightKnee], keypoints[PoseIndex.rightHip], keypoints[PoseIndex.rightAnkle]);
        }
    };
};