/* 


Implementing the verticality measure as described in this paper:
https://dl.acm.org/doi/pdf/10.1145/3212721.3212805?casa_token=wVSKp_jnpokAAAAA:fGahqKTCQEdIulMxZuNnrgf1GRmGzlXW7Ar8Zd9CYbvWiFBavItHk8FXf9kEs3L9D8GcUfpx12pL

Courtney Brown
July 2021


*/

import { AverageFilteredKeyPoints } from './averagedKeypoints';
import { AveragingFilter } from './averagingFilterV2';
import { CircularBuffer } from './circularBuffer';
import * as PoseIndex from './poseConstants.js';

let BUFFER_SIZE = 10; 


//finds the verticality angle for 1 participant - that is angle away from being completely upright
export class VerticalityAngle
{

  keypoints : AverageFilteredKeyPoints;
  vAngle : number = 0; 
  vAngleMean : AveragingFilter;
  minConfidence = 0.3; 
  useNoseShoulder: boolean = false; //sub for nose/shoulder if only portrait view/sitting down

  constructor( keypoints : AverageFilteredKeyPoints, minConfidence : number )
  {
    this.keypoints = keypoints; 
    this.minConfidence = minConfidence; 
    this.vAngleMean = new AveragingFilter(BUFFER_SIZE, 1);
  }

  enoughData( points : { x: number, y: number, score: number }[]   ) : boolean
  {
    this.useNoseShoulder = !( points[ PoseIndex.rightHip].score >= this.minConfidence &&
           points[ PoseIndex.leftHip].score >= this.minConfidence &&
           points[ PoseIndex.leftShoulder].score >= this.minConfidence &&
           points[ PoseIndex.rightShoulder].score >= this.minConfidence ) ; 
    
    if( this.useNoseShoulder )
    {  
      this.useNoseShoulder =  points[ PoseIndex.nose].score >= this.minConfidence &&
      points[ PoseIndex.leftShoulder].score >= this.minConfidence &&
      points[ PoseIndex.rightShoulder].score >= this.minConfidence;
      return this.useNoseShoulder; 
    }
    else return true; 
  }

  midpoint( points: { position: {x: number, y: number}, score: number }[], i : number, j : number ) : { x: number, y: number } 
  {
    let pt : { x: number, y: number } = {x:0, y:0}; 
    pt.x = ( points[i].position.x - points[j].position.x  ) / 2;
    pt.y = ( points[i].position.y - points[j].position.y  ) / 2;
    return pt; 
  }

  update()
  {
    let points = this.keypoints.top(); 
    if( !this.enoughData(points) )
      return; 

    let hip = this.midpoint(points, PoseIndex.rightHip, PoseIndex.leftHip);
    let shoulder = this.midpoint(points, PoseIndex.rightShoulder, PoseIndex.leftShoulder);

    //if using nose/shoulder -- use that.
    if( this.useNoseShoulder )
    {
      hip = shoulder; //lol KINDA
      shoulder = points[ PoseIndex.nose ].position; //again, lol KINDA!
    }

    //note: y is flipped from the paper, so should check whether there is sign flippage, etc.
    let v = { x:hip.x-shoulder.x, y:hip.y-shoulder.y };
    let vmag = Math.sqrt( v.x*v.x + v.y*v.y ); 

    //k is the unit vector in the y-direction <0, 1}> -- same variable as in paper
    //find the dot product to find the angle btw v & k
    let dot = v.y ; //x is always 0 since k has no horizontal component & y of k will be 1

    let angle = Math.acos(  dot / vmag );
    this.vAngleMean.update(angle); //average w/past samples
    this.vAngle = angle - this.vAngleMean.top(); //subtract the mean from the results
  }

  getAngle() : number
  {
    return this.vAngle; 
  }

}

//returns the Pearson correlation btw 2 verticality angles
export class VerticalityCorrelation
{
  //note: I assume only 2 for now, so code is written that way. it is dyadic. perhaps will expand tho.
  vAngles : VerticalityAngle[];

  avgAngles : AveragingFilter[] = [];
  angles : CircularBuffer<number>[] = []; 

  correlation : number = 0; //should be from 1 to -1


  constructor(vAngles : VerticalityAngle[])
  {
    this.vAngles = vAngles; 

    for( let i=0; i<vAngles.length; i++ )
    {
      this.avgAngles.push( new AveragingFilter( BUFFER_SIZE, 1 ) ); 
      this.angles.push( new CircularBuffer( BUFFER_SIZE ) );       
    }
  }

  //find the pearson correlation coefficient btw hte data at the specified indices
  pearsonCoefficient(i : number, j: number ) : number
  {  
    //find numerator
    let numerator = 0;
    for(let index =0; index < this.angles[i].length(); index++)
    {
      numerator += ( this.angles[i].at(index) - this.avgAngles[i].top() ) * ( this.angles[j].at(index) - this.avgAngles[j].top() );
    } 

    //find denominator -- note x & y just stand for different signals/angles, not x,y locations or vector values as in paper
    let xSum = 0; 
    let ySum = 0; 
    for(let index =0; index < this.angles[i].length(); index++)
    {
      xSum += ( this.angles[i].at(index) - this.avgAngles[i].top() )*( this.angles[i].at(index) - this.avgAngles[i].top() ) ;
      ySum += ( this.angles[j].at(index) - this.avgAngles[j].top() )*( this.angles[j].at(index) - this.avgAngles[j].top() ) ;
    }  
    let denominator = Math.sqrt( xSum ) * Math.sqrt( ySum );

    return numerator / denominator;
  }

  update()
  {
    //update with the new values
    for( let i=0; i<this.vAngles.length; i++ )
    {
      this.avgAngles[i].update( this.vAngles[i].getAngle() );
      this.angles[i].add( this.vAngles[i].getAngle()  );
      console.log( this.vAngles[i].getAngle() ); 
    }
    
    //find current correlation value
    this.correlation = this.pearsonCoefficient(0, 1);
    if(isNaN( this.correlation ))
    {
      this.correlation = 0; //this means there isn't enough skeleton showing likely to make this measure. Just setting it 0.
    }
  }

  getCorrelation() : number
  {
    return this.correlation; 
  }  

}