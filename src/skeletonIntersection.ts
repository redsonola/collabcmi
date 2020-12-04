import * as THREE from 'three';
import type { Participant } from './participant';
import type { AverageFilteredKeyPoints } from './averagedKeypoints';
import * as PoseIndex from './poseConstants'

export class SkeletionIntersection
{
    avgKeypoints1 : AverageFilteredKeyPoints; 

    leftArmUpperBox : THREE.Box2; 
    rightArmUpperBox : THREE.Box2; 
    leftArmLowerBox : THREE.Box2; 
    rightArmLowerBox : THREE.Box2; 
    leftLegBox : THREE.Box2; 
    rightLegBox : THREE.Box2;


    headCenter : THREE.Vector3;
    headRadius : number;
    headSphere : THREE.Sphere; 

    
    // upperHeadPoint : THREE.Vector2;
    // lowerHeadPoint :  THREE.Vector2;

    // upperTorsoPoint : THREE.Vector2;
    // lowerTorsoPoint :  THREE.Vector2;

    friendSkeleton : SkeletionIntersection;

    constructor( participant : Participant, friend: SkeletionIntersection )
    {
        this.avgKeypoints1 = participant.getAvgKeyPoints(); 
        this.friendSkeleton = friend; 

        // this.headBox  = new THREE.Box2(); 
        // this.upperHeadPoint = new THREE.Vector2;
        // this.lowerHeadPoint = new THREE.Vector2;



        this.headCenter = new THREE.Vector3;
        this.headRadius = 0;
        this.headSphere  = new THREE.Sphere(this.headCenter, this.headRadius);  



        this.leftArmUpperBox = new THREE.Box2(); 
        this.rightArmUpperBox = new THREE.Box2();  
        this.leftArmLowerBox = new THREE.Box2(); 
        this.rightArmLowerBox = new THREE.Box2();  
        this.leftLegBox  = new THREE.Box2();  
        this.rightLegBox  = new THREE.Box2();  
    }


    distance(keypoints: any, poseIndex1 : number, poseIndex2 : number) : number
    {
        let x1 = keypoints[poseIndex1].pt.x;
        let y1 = keypoints[poseIndex1].pt.y;
        let x2 = keypoints[poseIndex2].pt.x;
        let y2 = keypoints[poseIndex2].pt.y; 

        let dist = (x2-x1)**2 + (y2-y1)**2; 
        return Math.sqrt(dist); 
    }


    updateHead(keypoints: any) : void
    {
        //find distance from nose to ear
        //find points as that distance from left & right ears -- TODO: use other reference points 
        let noseToEarDistance : number = this.distance(keypoints, PoseIndex.nose, PoseIndex.rightEar);
        this.headCenter.setX( keypoints[ PoseIndex.nose ].pt.x ); 
        this.headCenter.setY( keypoints[ PoseIndex.nose ].pt.y );
        this.headCenter.setZ( 0 ); 

        this.headSphere.set(this.headCenter, noseToEarDistance); 
    }

    // updateTorso(keypoints: any) : void
    // {
    //     this.upperTorsoPoint.setX(keypoints[PoseIndex.leftShoulder].pt.x); 
    //     this.upperTorsoPoint.setY(keypoints[PoseIndex.leftShoulder].pt.y); 
    //     this.lowerTorsoPoint.setX(keypoints[PoseIndex.rightHip].pt.x); 
    //     this.lowerTorsoPoint.setY(keypoints[PoseIndex.rightHip].pt.y);

    //     this.torsoBox.set(this.upperTorsoPoint, this.lowerTorsoPoint); 
    // }

    // updateLimbPart(keypoints: any, box : THREE.Box2, upperPt: THREE.Vector2, lowerPt: THREE.Vector2, 
    //     startIndex: number, endIndex : number, ratio : number = 0.25 )
    // {
    //     let dist : number = this.distance(keypoints, startIndex, endIndex); 

    //     upperPt : 

    // }

    updateBoxes()
    {
        let keypoints1 = this.avgKeypoints1.top(); 
        this.updateHead(keypoints1); 
        // this.updateTorso(keypoints1); 

        //update torso
        //leftShoulder to right hip

        //update arm -- first d
        //leftShoulder to elblow, 1/4 of that distance to create box (create funciton for that)


    }

    getHeadSphere() : THREE.Sphere
    {
        return this.headSphere;
    }

    touching()
    {
        //check heads
        let touch : boolean = this.headSphere.intersectsSphere( this.friendSkeleton.getHeadSphere() );

        return touch; 

    }

    

}