//https://medium.com/tensorflow/move-mirror-an-ai-experiment-with-pose-estimation-in-the-browser-using-tensorflow-js-2f7b769f9b23
//Note: 8/12/2020 OK, found a pose matching algorithm from above, so I think I can just use this to estimate poses IRL

// Great npm package for computing cosine similarity  
const similarity = require('compute-cosine-similarity');
var l2norm = require( 'compute-l2norm' );


//This didn't work as well.....
// Cosine similarity as a distance function. The lower the number, the closer // the match
// poseVector1 and poseVector2 are a L2 normalized 34-float vectors (17 keypoints each  
// with an x and y. 17 * 2 = 32)
// function cosineDistanceMatching(poseVector1, poseVector2) {
//   let cosineSimilarity = similarity(poseVector1, poseVector2);
//   let distance = 2 * (1 - cosineSimilarity);
//   return Math.sqrt(distance);
// }

//TODO:
//1. rescale to bounding box
//2. L2 normalization 
//3. use below to estimate pose similarity, lower score, less.


//from here -- hmm, so in the end, Euclidean distance -- CDB
// poseVector1 and poseVector2 are 52-float vectors composed of:
// Values 0-33: are x,y coordinates for 17 body parts in alphabetical order
// Values 34-51: are confidence values for each of the 17 body parts in alphabetical order
// Value 51: A sum of all the confidence values
// Again the lower the number, the closer the distance
function weightedDistanceMatching(poseVector1, poseVector2) {
    let vector1PoseXY = poseVector1.slice(0, 34);
    let vector1Confidences = poseVector1.slice(34, 51);
    let vector1ConfidenceSum = poseVector1.slice(51, 52);
  
    let vector2PoseXY = poseVector2.slice(0, 34);
  
    // First summation
    let summation1 = 1 / vector1ConfidenceSum;
  
    // Second summation
    let summation2 = 0;
    for (let i = 0; i < vector1PoseXY.length; i++) {
      let tempConf = Math.floor(i / 2);
      let tempSum = vector1Confidences[tempConf] * Math.abs(vector1PoseXY[i] - vector2PoseXY[i]);
      summation2 = summation2 + tempSum;
    }
  
    return summation1 * summation2;
  }

  //--------- CBD code below here -------------

  export function reScaleTo1(keypoints, w, h)
  {
    //find max & min of x, y
    let maxX = 0; 
    let maxY = 0; 
    let minX = w; 
    let minY = h; 

    //1. find the min & max of each x & y
    for(let i=0; i<keypoints.length; i++)
    {
        const keypoint = keypoints[i];
        const { y, x } = keypoint.position;

        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
    }

    //2. find bounding box -- 10% + max length ea. side
    let xLen = maxX - minX; 
    let yLen = maxY - minY; 

    //ok, what we do is find the top left of the "bounding box", then xlate to 0, 0.
    //and make the bounding box square... 
    let maxLen = Math.max(xLen, yLen); //how big the bounding box is 

    //now we need to xlate everything so that the bounding box is at (0,0).
    //so that means we subtract min x & y from everything.
    //then we divide x & y by the length of the bounding box

    let xlatedKeypoints : any[] = [];
    for(let i=0; i<keypoints.length; i++)
    {
      var keypoint = { position: {y: (keypoints[i].position.y-minY)/maxLen, x: (keypoints[i].position.x-minX)/maxLen}, score: keypoints[i].score };
      xlatedKeypoints.push( keypoint );
    }

    return xlatedKeypoints;
  }

  //scale to 1 then L2 norm
  export function scaleAndL2Norm(keypoints, w, h) : number[]
  {

    let scaledPoints : any[] = reScaleTo1( keypoints, w, h ); 
    let scaledPointsV : number[] = []; 

    for(let i=0; i<keypoints.length; i++)
    {
      scaledPointsV.push(scaledPoints[i].position.y);
      scaledPointsV.push(scaledPoints[i].position.x);
    }

    let l2norm1 : number = l2norm(scaledPointsV);
    for(let i=0; i<keypoints.length; i++)
    {
      scaledPointsV[i] = scaledPointsV[i]/l2norm1;
    }

    return scaledPointsV;
  }

  //scale it but put it in a keypoints array w/previous scores.
  export function scaleAndL2NormKeypoints(keypoints, w, h) : any[]
  {
    let scaledValues = scaleAndL2Norm(keypoints, w, h);

    let skeys : any[] = []; 
    for(let i=0; i<scaledValues.length; i+=2)
    {
      var keypoint = { position: {y: scaledValues[i], x:scaledValues[i+1]}, score: keypoints[i/2].score };
      skeys.push( keypoint );
    }

    return skeys;
  }

  //pose1, pose2 -- poses to be compared, expected in posenet pose format
  //then the width & height for each p1w, p1h, p2w, p2h
  export function poseSimilarity(keypoints1, p1w, p1h, keypoints2, p2w, p2h) : number
  {
      //1. rescaleTo1 & do L2 normalization
      let scaledPoints1 : number[] = scaleAndL2Norm( keypoints1, p1w, p1h ); 
      let scaledPoints2 : number[] = scaleAndL2Norm( keypoints2, p2w, p2h ); 

      //put into vectors &  the sum of all the confidence scores.
      let confidenceScoreSum1 : number = 0; 
      let confidenceScoreSum2 : number = 0; 
      let scoresV1  : any[] = [];
      let scoresV2 : any[] = [];
      for(let i=0; i<keypoints1.length; i++)
      {
        scoresV1.push(keypoints1[i].score);
        scoresV2.push(keypoints2[i].score);
        confidenceScoreSum1 = confidenceScoreSum1 + keypoints1[i].score ;
        confidenceScoreSum2 = confidenceScoreSum2 + keypoints2[i].score;
      }

      //concat vectors to go into weighted distance matching.
      let points1 : any[] = scaledPoints1.concat( scoresV1 );
      points1.push( confidenceScoreSum1 );
      let points2 : any[] = scaledPoints2.concat( scoresV2 );
      points2.push( confidenceScoreSum2 );

      //4. return weightedDistanceMatching
      return weightedDistanceMatching( points1, points2 );
  }