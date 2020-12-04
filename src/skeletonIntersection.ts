import * as THREE from 'three';
import type { Participant } from './participant';
import type { AverageFilteredKeyPoints } from './averagedKeypoints';
import * as PoseIndex from './poseConstants'
import { Box3, Vector3 } from 'three';
import { number } from 'mathjs';

//need to put in utilities space
function distance(keypoints: any, poseIndex1 : number, poseIndex2 : number) : number
{
    let x1 = keypoints[poseIndex1].position.x;
    let y1 = keypoints[poseIndex1].position.y;
    let x2 = keypoints[poseIndex2].position.x;
    let y2 = keypoints[poseIndex2].position.y; 

    let dist = (x2-x1)**2 + (y2-y1)**2; 
    return Math.sqrt(dist); 
}

class LimbIntersect
{
    limbLine : THREE.Line3; 
    keypoints : any[]; 
    index1 : number; 
    index2 : number;
    minConfidence : number

    constructor(index1_ : number, index2_ : number, minConfidence_ : number = 0.4)
    {
        this.limbLine = new THREE.Line3(); 
        this.index1 = index1_;
        this.index2 = index2_;
        this.keypoints = []; 

        this.minConfidence = minConfidence_;
    }
    setLine(limb : THREE.Line3)
    {
        this.limbLine = limb; 
    }

    getScore() : number
    {
        let avg : number = 0; 
        if(this.keypoints.length > 0)
        {
            for( let i=0; i<this.keypoints.length; i++ )
            {
                avg += this.keypoints[i].score; 
            }
            avg /= this.keypoints.length; 
        }
        return avg; 
    }

    line()
    {
        return this.limbLine; 
    }
    update( keypoints: any) : void
    {
        this.keypoints = []
        this.keypoints.push(keypoints[this.index1]);
        this.keypoints.push(keypoints[this.index2]);


        this.limbLine.set( new THREE.Vector3(keypoints[this.index1].position.x, 0, keypoints[this.index1].position.y), 
            new THREE.Vector3(keypoints[this.index2].position.x, 0, keypoints[this.index2].position.y, ) ); 
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

    intersects(limb : LimbIntersect) : boolean
    {
        let intersect : boolean = false; 
        if( this.getScore() > this.minConfidence && limb.getScore()  > this.minConfidence )
        {
            intersect = this.intersectsLine(this.line(), limb.line() );
        }
        return intersect; 
    }

}

class TorsoIntersect
{
    limbs : LimbIntersect[]; //lol
    minConfidence : number; 

    constructor(minConfidence_ : number = 0.4)
    {
        this.minConfidence = minConfidence_; 
        this.limbs = 
        [
            new  LimbIntersect( PoseIndex.leftShoulder, PoseIndex.rightShoulder, this.minConfidence ),
            new  LimbIntersect( PoseIndex.leftShoulder, PoseIndex.leftHip, this.minConfidence ),
            new  LimbIntersect( PoseIndex.leftHip, PoseIndex.rightHip, this.minConfidence ),
            new  LimbIntersect( PoseIndex.rightHip, PoseIndex.rightShoulder, this.minConfidence )
        ];
    }

    update(keypoints)
    {
        for(let i=0; i<this.limbs.length; i++)
            this.limbs[i].update(keypoints);
    }

    getLimbs() : LimbIntersect[]
    {
        return this.limbs; 
    }

    intersectWithTorso( torso : TorsoIntersect ) : boolean
    {
        let otherLimbs = torso.getLimbs(); 
        for(let i=0; i<this.limbs.length; i++)
        {
            for(let j=0; j<otherLimbs.length; j++)
            {
                if(this.limbs[i].intersects(otherLimbs[j]))
                    return true; 
            }
        }
        return false;
    }

    intersectWithLimb( limb : LimbIntersect ) : boolean
    {
        for(let i=0; i<this.limbs.length; i++)
        {
            if(this.limbs[i].intersects(limb))
            return true; 
        }  
        return false;     
    }
}

class HeadBoundary extends LimbIntersect
{
    constructor(minConfidence : number = 0.4)
    {
        super(0,0, minConfidence); 
    }

    updateBoundary( x1 : number, y1 : number, x2 : number, y2 : number, score_ : number ) : void
    {
        this.keypoints = []
        this.keypoints.push( { position: {x : x1, y : y1 }, score: score_ } );
        this.keypoints.push( { position: {x : x2, y : y2 }, score: score_ } );

        this.limbLine.set( new THREE.Vector3(x1, 0, y1), 
            new THREE.Vector3(x2, 0, y2 ));
    }
}

class HeadIntersect
{
    boundaries : HeadBoundary[]; 
    minConfidence : number;
    sphere : THREE.Sphere; 
    index : number[]; 

    constructor(confidence : number = 0.4)
    {
        this.minConfidence = confidence; 
        this.boundaries = [
            new HeadBoundary(confidence),
            new HeadBoundary(confidence),
            new HeadBoundary(confidence),
            new HeadBoundary(confidence)
        ];
        this.sphere = new THREE.Sphere(); 

        this.index = [PoseIndex.nose, PoseIndex.leftEar, PoseIndex.rightEar, PoseIndex.leftEye, PoseIndex.rightEye];
    }

    //return max instead of average. need to compensate for ears tho
    getScore(keypoints : any[]) : number
    {
        let score : number = 0;
        for(let i=0; i<this.index.length; i++)
        {
            score = Math.max(score, keypoints[this.index[i]].score);
        }
        return score; 
    }

    updateBoundaries(box : THREE.Box3, score : number)
    {
        let leftTop = box.min; 
        let rightBottom = box.max; 

        this.boundaries[0].updateBoundary(box.min.x, box.min.y, box.min.x, box.max.y, score  );
        this.boundaries[1].updateBoundary(box.min.x, box.max.y , box.max.x, box.max.y, score  );
        this.boundaries[2].updateBoundary(box.max.x, box.max.y , box.max.x, box.min.y, score   );
        this.boundaries[3].updateBoundary(box.max.x, box.min.y, box.min.x, box.min.y, score  );
    }

    update(keypoints : any[])
    {
        //TODO: deal with confidence later on this.
        let noseToEarDistance : number = distance(keypoints, PoseIndex.nose, PoseIndex.rightEar);

        let headCenter = new THREE.Vector3();
        headCenter.setX( keypoints[ PoseIndex.nose ].position.x ); 
        headCenter.setY( keypoints[ PoseIndex.nose ].position.y );
        headCenter.setZ( 0 ); 

        this.sphere.set(headCenter, noseToEarDistance); 
        let box = new THREE.Box3; 
        box = this.sphere.getBoundingBox(box);
        this.updateBoundaries(box, this.getScore(keypoints)); 
    }

    //lol
    getLimbs() : LimbIntersect[]
    {
        return this.boundaries; 
    }

    intersectsWithLimb( limb : LimbIntersect ) : boolean
    {
        for(let i=0; i<this.boundaries.length; i++)
        {
            return this.boundaries[i].intersects(limb);
        }
        return false; 
    }

    //todo create an abstract class and refactor 
    intersectsWithTorso( torso : TorsoIntersect ) : boolean
    {
        let otherLimbs = torso.getLimbs(); 
        for(let i=0; i<this.boundaries.length; i++)
        {
            for(let j=0; j<otherLimbs.length; j++)
            {
                if(this.boundaries[i].intersects(otherLimbs[j]))
                    return true; 
            }
        }
        return false;
    }

    intersectsWithHead( head : HeadIntersect ) : boolean
    {
        let otherLimbs = head.getLimbs(); 
        for(let i=0; i<this.boundaries.length; i++)
        {
            for(let j=0; j<otherLimbs.length; j++)
            {
                if(this.boundaries[i].intersects(otherLimbs[j]))
                    return true; 
            }
        }
        return false;
    }
}



export class SkeletionIntersection
{
    minConfidence : number = 0.4; 

    participant : Participant; 

    leftArmUpperLine : LimbIntersect; 
    rightArmUpperLine : LimbIntersect; 
    leftArmLowerLine : LimbIntersect; 
    rightArmLowerLine : LimbIntersect; 

    leftLegUpperLine : LimbIntersect; 
    rightLegUpperLine : LimbIntersect; 
    leftLegLowerLine : LimbIntersect; 
    rightLegLowerLine : LimbIntersect; 

    head: HeadIntersect; 

    torso: TorsoIntersect; 


    limbs : LimbIntersect[]; 

    friendSkeleton : any = undefined; // I find annoying that neither null or undefined can be assigned to defined type except via | which introduces even more freaking complexity. WTF.

    constructor( participant_ : Participant, minConfidence : number = 0.4 )
    {
        this.participant = participant_; 

        this.torso = new TorsoIntersect(minConfidence); 
        this.head = new HeadIntersect(minConfidence);

        this.leftArmUpperLine = new LimbIntersect(PoseIndex.leftShoulder, PoseIndex.leftElbow, minConfidence); 
        this.rightArmUpperLine = new  LimbIntersect(PoseIndex.leftElbow, PoseIndex.leftWrist, minConfidence); 
        this.leftArmLowerLine = new  LimbIntersect(PoseIndex.rightShoulder, PoseIndex.rightElbow, minConfidence); 
        this.rightArmLowerLine = new  LimbIntersect(PoseIndex.rightElbow, PoseIndex.rightWrist, minConfidence); 
    
        this.leftLegUpperLine = new  LimbIntersect( PoseIndex.leftHip, PoseIndex.leftKnee, minConfidence ); 
        this.rightLegUpperLine = new  LimbIntersect( PoseIndex.rightHip, PoseIndex.rightKnee, minConfidence ); 
        this.leftLegLowerLine = new  LimbIntersect( PoseIndex.leftKnee, PoseIndex.leftAnkle, minConfidence ); 
        this.rightLegLowerLine = new  LimbIntersect( PoseIndex.rightKnee, PoseIndex.rightAnkle, minConfidence ); 

        this.limbs = [ this.leftArmUpperLine, this.rightArmUpperLine, this.leftArmLowerLine, this.rightArmLowerLine,
            this.leftLegUpperLine, this.rightLegUpperLine, this.leftLegLowerLine, this.rightLegLowerLine   ];
    }

    setFriend(friend : SkeletionIntersection)
    {
        this.friendSkeleton = friend; 
    }

    updateLimbs( keypoints: any ) : void
    {
        for(let i=0; i<this.limbs.length; i++)
        {
            this.limbs[i].update(keypoints);
        }
    }

    update()
    {
        let keypoints1 = this.participant.getAvgKeyPoints(); 
        this.head.update(keypoints1); 
        this.getTorso().update(keypoints1); 
        this.updateLimbs(keypoints1); 
    }



    // intersectsBox( line : THREE.Line3, box : THREE.Box3 ) : boolean
    // {
    //     let intersect = false; 
    //     intersect = this.intersectsLine( line, new THREE.Line3( box.min, new THREE.Vector3( box.max.x, 0, box.min.y ) ) );
    //     intersect = intersect || this.intersectsLine( line, new THREE.Line3( box.min, new THREE.Vector3( box.min.x, 0, box.max.y ) ) );
    //     intersect = intersect || this.intersectsLine( line, new THREE.Line3( new THREE.Vector3( box.min.x, 0, box.max.y ), box.max ) );
    //     intersect = intersect || this.intersectsLine( line, new THREE.Line3( new THREE.Vector3( box.max.x, 0, box.min.y ), box.max ) );

    //     return intersect; 
    // }

    getHead() : HeadIntersect
    {
        return this.head;
    }

    getTorso() : TorsoIntersect
    {
        return this.torso; 
    }

    getLimbs() : LimbIntersect[]
    {
        return this.limbs; 
    }
    
    touching()
    {
        //TODO: return out when found
        let touch : boolean = false;

        //check the stuff
        touch = touch || this.head.intersectsWithHead( this.friendSkeleton.getHead() );
        touch = touch || this.head.intersectsWithTorso( this.friendSkeleton.getTorso() );
        touch = touch || this.friendSkeleton.getHead().intersectsWithTorso( this.getTorso() );
        touch = touch || this.getTorso().intersectWithTorso( this.friendSkeleton.getTorso() ); 

        //check all the limbs against each other 
        let friendLimbs = this.friendSkeleton.getLimbs();
        console.assert( friendLimbs.length == this.limbs.length ); //assume limb length is the same.......

        for (let i=0; i<this.limbs.length; i++) 
        {
            //head to limbs 
            touch = touch || this.getHead().intersectsWithLimb( friendLimbs[i] ) ;
            touch = touch || this.friendSkeleton.getHead().intersectsWithLimb( this.limbs[i] ) ;


            //torso to limbs
            touch = touch || this.getTorso().intersectWithLimb( friendLimbs[i] );
            touch = touch || this.friendSkeleton.getTorso().intersectWithLimb( this.limbs[i] );

            //limbs to limbs
            for( let j=0; j<friendLimbs.length; j++ )
            {
                touch = touch || this.limbs[i].intersects( friendLimbs[j] );       
            }
        }

        return touch; 
    }

}