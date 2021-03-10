// import * as posenet from '@tensorflow-models/posenet';
import * as math from 'mathjs';
// import * as XCorr from 'abr-xcorr'; 

//TODO: Separate out the limbs, etc. & give those values for windowed var
//perhaps change sound based on what limb?
//probably will need to fine tune volume, etc. response. look into Tonejs... again.

var prevPose = null; 
var velocities = []; 
var windowSize = 24; 

//note: need to find min & max for each # of keypoints found, since that changes it a lot -- basically close and far.
var maxWinVar = 0.0; 
var minWinVar = 100.0; 

//find the difference between each point of the skeleton and the last to get an overall measure of velocity
function getAvgPoseVelocity(pose, width, height)
{
    var minConfidence = 0.15;
    var count = 0.0; 
    var sum = 0.0; 
    var scaleFactor = 100.0; 

    if(prevPose != null)
    {
        for (let i = 0; i < pose.keypoints.length; i++) {
        const keypoint1 = pose.keypoints[i];
        const keypoint2 = prevPose.keypoints[i];

        if (keypoint1.score >= minConfidence && keypoint2.score >= minConfidence) {
                const {y, x} = keypoint1.position;
                const {y:y2, x:x2} = keypoint2.position;

                sum += math.distance([(x*scaleFactor)/width, (y*scaleFactor)/height], [(x2*scaleFactor)/width, (y2*scaleFactor)/height]); 
                count++; 
            }
        }
        if(count > 0){
            velocities.push( sum / count ); 
        }
    }
    prevPose = pose;
}

//get an array of values and return variance
export function getPoseVelocityWindowedVariance(pose, width, height)
{
    //find the current velocity
    getAvgPoseVelocity(pose, width, height);

    //keep to window size
    if(velocities.length > windowSize )
        velocities.shift(); 
    
    //just leave when there are not enough with 0
    if(velocities.length < 2 )
    {
        return 0; 
    }

    var winVar = math.variance(velocities);
    // maxWinVar = math.max(maxWinVar, winVar); 
    // minWinVar = math.min(minWinVar, winVar); 
    // console.log( "minWinVar:" + minWinVar + "maxWinVar: " + maxWinVar);

    return winVar;
}

//perform cross-correlation on the windowed samples -- uses xcorr-abr which mirrors matlab's xcorr() 
export function xcorr(keyPoints, remoteKeyPoints)
{


}