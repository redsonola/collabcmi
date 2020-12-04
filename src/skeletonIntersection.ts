import * as THREE from 'three';
import type { Participant } from './participant';
import type { AverageFilteredKeyPoints } from './averagedKeypoints';
import * as PoseIndex from './poseConstants'
import { Box3 } from 'three';

export class SkeletionIntersection
{
    participant : Participant; 

    leftArmUpperLine : THREE.Line3; 
    rightArmUpperLine : THREE.Line3; 
    leftArmLowerLine : THREE.Line3; 
    rightArmLowerLine : THREE.Line3; 

    leftLegUpperLine : THREE.Line3; 
    rightLegUpperLine : THREE.Line3; 
    leftLegLowerLine : THREE.Line3; 
    rightLegLowerLine : THREE.Line3; 

    headCenter : THREE.Vector3;
    headRadius : number;
    headSphere : THREE.Sphere; 

    torsoBox : THREE.Box3; 
    upperTorsoPoint : THREE.Vector3;
    lowerTorsoPoint :  THREE.Vector3;

    limbs : THREE.Line3[]; 

    friendSkeleton : any = undefined; // I find annoying that neither null or undefined can be assigned to defined type except via | which introduces even more freaking complexity. WTF.

    constructor( participant_ : Participant )
    {
        this.participant = participant_; 

        this.upperTorsoPoint = new THREE.Vector3;
        this.lowerTorsoPoint = new THREE.Vector3;
        this.torsoBox  = new THREE.Box3(this.upperTorsoPoint, this.lowerTorsoPoint); 

        this.headCenter = new THREE.Vector3;
        this.headRadius = 0;
        this.headSphere  = new THREE.Sphere(this.headCenter, this.headRadius);  

        this.leftArmUpperLine = new THREE.Line3(); 
        this.rightArmUpperLine = new  THREE.Line3(); 
        this.leftArmLowerLine = new  THREE.Line3(); 
        this.rightArmLowerLine = new  THREE.Line3(); 
    
        this.leftLegUpperLine = new  THREE.Line3(); 
        this.rightLegUpperLine = new  THREE.Line3(); 
        this.leftLegLowerLine = new  THREE.Line3(); 
        this.rightLegLowerLine = new  THREE.Line3(); 

        this.limbs = [ this.leftArmUpperLine, this.rightArmUpperLine, this.leftArmLowerLine, this.rightArmLowerLine,
            this.leftLegUpperLine, this.rightLegUpperLine, this.leftLegLowerLine, this.rightLegLowerLine   ];
    }

    setFriend(friend : SkeletionIntersection)
    {
        this.friendSkeleton = friend; 
    }


    distance(keypoints: any, poseIndex1 : number, poseIndex2 : number) : number
    {
        let x1 = keypoints[poseIndex1].position.x;
        let y1 = keypoints[poseIndex1].position.y;
        let x2 = keypoints[poseIndex2].position.x;
        let y2 = keypoints[poseIndex2].position.y; 

        let dist = (x2-x1)**2 + (y2-y1)**2; 
        return Math.sqrt(dist); 
    }


    updateHead(keypoints: any) : void
    {
        //find distance from nose to ear
        //find points as that distance from left & right ears -- TODO: use other reference points 
        let noseToEarDistance : number = this.distance(keypoints, PoseIndex.nose, PoseIndex.rightEar);
        this.headCenter.setX( keypoints[ PoseIndex.nose ].position.x ); 
        this.headCenter.setY( keypoints[ PoseIndex.nose ].position.y );
        this.headCenter.setZ( 0 ); 

        this.headSphere.set(this.headCenter, noseToEarDistance); 
    }

    updateTorso(keypoints: any) : void
    {
        this.upperTorsoPoint.setX(keypoints[PoseIndex.leftShoulder].position.x); 
        this.upperTorsoPoint.setY(0);
        this.upperTorsoPoint.setZ(keypoints[PoseIndex.leftShoulder].position.y); 

        this.lowerTorsoPoint.setX(keypoints[PoseIndex.rightHip].position.x);
        this.lowerTorsoPoint.setY(0); 
        this.lowerTorsoPoint.setZ(keypoints[PoseIndex.rightHip].position.y);

        this.torsoBox.set(this.upperTorsoPoint, this.lowerTorsoPoint); 
    }

    updateLimb( keypoints: any, limb: THREE.Line3, index1: number, index2: number ) : void
    {
        limb.set( new THREE.Vector3(keypoints[index1].position.x, 0, keypoints[index1].position.y), 
            new THREE.Vector3(keypoints[index2].position.x, 0, keypoints[index2].position.y, ) ); 
    }

    updateLimbs( keypoints: any ) : void
    {
        //arms
        this.updateLimb( keypoints, this.leftArmUpperLine, PoseIndex.leftShoulder, PoseIndex.leftElbow ) ;
        this.updateLimb( keypoints, this.rightArmUpperLine, PoseIndex.leftElbow, PoseIndex.leftWrist ) ;
        this.updateLimb( keypoints, this.leftArmLowerLine, PoseIndex.rightShoulder, PoseIndex.rightElbow ) ;
        this.updateLimb( keypoints, this.rightArmLowerLine, PoseIndex.rightElbow, PoseIndex.rightWrist ) ;

        //legs
        this.updateLimb( keypoints, this.leftLegUpperLine,  PoseIndex.leftHip, PoseIndex.leftKnee ) ;
        this.updateLimb( keypoints, this.rightLegUpperLine, PoseIndex.rightHip, PoseIndex.rightKnee  ) ;
        this.updateLimb( keypoints, this.leftLegLowerLine,  PoseIndex.leftKnee, PoseIndex.leftAnkle ) ;
        this.updateLimb( keypoints, this.rightLegLowerLine, PoseIndex.rightKnee, PoseIndex.rightAnkle  ) ;    
    }

    update()
    {
        let keypoints1 = this.participant.getAvgKeyPoints(); 
        this.updateHead(keypoints1); 
        this.updateTorso(keypoints1); 
        this.updateLimbs(keypoints1); 
    }

    //modified from : https://www.geeksforgeeks.org/check-if-two-given-line-segments-intersect/
    // Given three colinear points p, q, r, the function checks if 
    // point q lies on line segment 'pr' 
    onSegment( p : THREE.Vector3, q : THREE.Vector3, r : THREE.Vector3 ) : boolean
    { 
        return (q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) && 
            q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y)) 

    }


    // modified from here: https://www.geeksforgeeks.org/check-if-two-given-line-segments-intersect/
    // To find orientation of ordered triplet (p, q, r). 
    // The function returns following values 
    // 0 --> p, q and r are colinear 
    // 1 --> Clockwise 
    // 2 --> Counterclockwise 
    orientation(p : THREE.Vector3, q  : THREE.Vector3, r  : THREE.Vector3)  : number
    { 
        // See https://www.geeksforgeeks.org/orientation-3-ordered-points/ 
        // for details of below formula. 
        let val : number = (q.y - p.y) * (r.x - q.x) - 
                (q.x - p.x) * (r.y - q.y); 
    
        if (val == 0) return 0;  // colinear 
    
        return (val > 0)? 1: 2; // clock or counterclock wise 
    } 

    // modified from here: https://www.geeksforgeeks.org/check-if-two-given-line-segments-intersect/
    // The main function that returns true if line segment 'p1q1' 
    // and 'p2q2' intersect. 
    intersectsLine(line1 : THREE.Line3, line2 : THREE.Line3) : boolean
    { 


        // Find the four orientations needed for general and 
        // special cases 
        let o1 : number = this.orientation(line1.start, line2.start, line1.end); 
        let o2 : number = this.orientation(line1.start, line2.start, line2.end); 
        let o3 : number = this.orientation(line1.end, line2.end, line1.start); 
        let o4 : number = this.orientation(line1.end, line2.end, line2.start); 

        // General case 
        if (o1 != o2 && o3 != o4) 
            return true; 
    
        // Special Cases 
        // p1, q1 and p2 are colinear and p2 lies on segment p1q1 
        if (o1 == 0 && this.onSegment(line1.start, line1.end, line2.start)) return true; 
    
        // p1, q1 and q2 are colinear and q2 lies on segment p1q1 
        if (o2 == 0 && this.onSegment(line1.start, line2.end, line2.start)) return true; 
    
        // p2, q2 and p1 are colinear and p1 lies on segment p2q2 
        if (o3 == 0 && this.onSegment(line1.end, line1.start, line2.end)) return true; 
    
        // p2, q2 and q1 are colinear and q1 lies on segment p2q2 
        if (o4 == 0 && this.onSegment(line1.end, line2.start, line2.end)) return true; 
    
        return false; // Doesn't fall in any of the above cases 
    } 

    intersectsBox( line : THREE.Line3, box : THREE.Box3 ) : boolean
    {
        let intersect = false; 
        intersect = this.intersectsLine( line, new THREE.Line3( box.min, new THREE.Vector3( box.max.x, 0, box.min.y ) ) );
        intersect = intersect || this.intersectsLine( line, new THREE.Line3( box.min, new THREE.Vector3( box.min.x, 0, box.max.y ) ) );
        intersect = intersect || this.intersectsLine( line, new THREE.Line3( new THREE.Vector3( box.min.x, 0, box.max.y ), box.max ) );
        intersect = intersect || this.intersectsLine( line, new THREE.Line3( new THREE.Vector3( box.max.x, 0, box.min.y ), box.max ) );

        return intersect; 
    }

    getHeadSphere() : THREE.Sphere
    {
        return this.headSphere;
    }

    getTorsoBox() : THREE.Box3
    {
        return this.torsoBox; 
    }

    getLimbs() : THREE.Line3[]
    {
        return this.limbs; 
    }

    touching()
    {
        //TODO: return out when found

        //check the stuff
        let touch : boolean = this.headSphere.intersectsSphere( this.friendSkeleton.getHeadSphere() );
        touch = touch || this.headSphere.intersectsBox( this.friendSkeleton.getTorsoBox() );
        touch = touch || this.friendSkeleton.getHeadSphere().intersectsBox( this.getTorsoBox() );
        touch = touch || this.getTorsoBox().intersectsBox( this.friendSkeleton.getTorsoBox() ); 

        //check all the limbs against each other 
        let friendLimbs = this.friendSkeleton.getLimbs();
        console.assert( friendLimbs.length == this.limbs.length ); //assume limb length is the same.......

        for (let i=0; i<this.limbs.length; i++) 
        {
            //head to limbs 
            touch = touch || this.intersectsBox(this.limbs[i], this.friendSkeleton.getHeadSphere().getBoundingBox(new Box3()) );
            touch = touch || this.intersectsBox(friendLimbs[i], this.headSphere.getBoundingBox(new Box3()) );

            //torso to limbs
            touch = touch || this.intersectsBox(this.limbs[i], this.getTorsoBox() );
            touch = touch || this.intersectsBox(friendLimbs[i], this.friendSkeleton.getTorsoBox() );

            //limbs to limbs
            for( let j=0; j<friendLimbs.length; j++ )
            {
                touch = touch || this.intersectsLine( this.limbs[i], friendLimbs[j] );       
            }
        }

        return touch; 
    }

    

}