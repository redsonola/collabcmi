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

    return distance2d(x1, y1, x2, y2);
}


function distance2d(x1:number, y1:number, x2:number, y2:number) : number
{
    let dist = (x2-x1)**2 + (y2-y1)**2; 
    return Math.sqrt(dist); 
}

function distance2dFromXYVector3( v1 : THREE.Vector3, v2 : THREE.Vector3 )
{
    return distance2d( v1.x, v1.y, v2.x, v2.y );
}

//super class
class DetectIntersect
{
    minConfidence : number; 
    constructor(minConfidence : number)
    {
        this.minConfidence = minConfidence;
    }

    getVectors() : THREE.Vector3[]
    {
        let v : THREE.Vector3[] = [];
        return v;
    }

    getScore() : number
    {
        return 0;
    }

    update( keypoints: any) : void
    {

    }    

}



export class LimbIntersect extends DetectIntersect
{
    limbLine : THREE.Line3; 
    keypoints : any[]; 
    index1 : number; 
    index2 : number;
    flip : boolean = false; 
    w : number;
    h  : number;

    constructor(w:number, h:number, index1_ : number, index2_ : number, minConfidence_ : number = 0.4)
    {
        super(minConfidence_);
        this.limbLine = new THREE.Line3(); 
        this.index1 = index1_;
        this.index2 = index2_;
        this.keypoints = []; 
        this.w = w;
        this.h = h;

        
    }

    getIndex1() : number
    {
        return this.index1;
    }

    setSize(w:number, h:number)
    {
        this.w = w; 
        this.h = h; 
    }
    
    setFlipSelf(flip : boolean)
    {
        this.flip = flip; 
    }

    setLine(limb : THREE.Line3)
    {
        this.limbLine = limb; 
    }

    getVectors() : THREE.Vector3[]
    {
        return [this.limbLine.start, this.limbLine.end]; 
    }

    getScore() : number
    {
        let avg : number = 0; 
        if(this.keypoints.length > 0)
        {
            for( let i=0; i<this.keypoints.length; i++ )
            {
                if( this.keypoints[i].score )
                {
                    avg += this.keypoints[i].score; 
                }
            }
            avg /= this.keypoints.length; 
        }
        return avg; 
    }

    line()
    {
        return this.limbLine; 
    }

    setLine3(  l : THREE.Line3, pt1 : THREE.Vector3, pt2 : THREE.Vector3  ) : THREE.Line3
    {
        let start : THREE.Vector3 ;
        let end : THREE.Vector3 ;

        let val1 : number = (pt2.x - pt1.x); 
        let val2 : number = (pt2.y - pt1.y); 

        if((val1 < 0) || (val2 < 0))
        {
            start = pt2; 
            end = pt1;
        }
        else
        {
            start = pt1; 
            end = pt2; 
        }  
        l.set(start, end); 
        return l; 
    }

    setLimbLine(pt1 : THREE.Vector3, pt2 : THREE.Vector3  )
    {
        this.limbLine = this.setLine3( this.limbLine, pt1, pt2 );     
    }

    update( keypoints: any) : void
    {
        this.keypoints = []
        this.keypoints.push(keypoints[this.index1]);
        this.keypoints.push(keypoints[this.index2]);

        let pt1 : THREE.Vector3 =  new THREE.Vector3(keypoints[this.index1].position.x, keypoints[this.index1].position.y, 2);
        let pt2 : THREE.Vector3 =  new THREE.Vector3(keypoints[this.index2].position.x, keypoints[this.index2].position.y, 2) ;
        
        this.setLimbLine(pt1, pt2);
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

    scaleVector( v: THREE.Vector3, flip:boolean ) : THREE.Vector3
    {
        //TODO: ok this should be a passed in value -- but it is passed in via draw3js.ts line 84 
        let percentXOver = 0.66; 

        let scaledX = 1-( v.x / this.w ); //x is flipped 
        if(flip)
        {
            scaledX -= percentXOver;
        }

        let scaledY = v.y / this.h;

        return new THREE.Vector3( scaledX, scaledY, 2 );
    }

    scaleLine(l : THREE.Line3, flip : boolean) : THREE.Line3
    {

        let line : THREE.Line3 = new THREE.Line3();
        return this.setLine3( line, this.scaleVector(l.start, flip), this.scaleVector(l.end, flip) ); 
    }

    findDistBetweenPointAndLine( v : THREE.Vector3, aLine : THREE.Line3 ) : number
    {
        let dist : number;

        let closestPoint = new THREE.Vector3(); 
        closestPoint = aLine.closestPointToPoint( v, true, closestPoint );
        dist = distance2dFromXYVector3( v, closestPoint  ); 
        return dist; 
    }

    

    closeEnough(limb : LimbIntersect, whatIsEnough : number)
    {
        let myLine = this.scaleLine( this.line(), this.flip ); 
        let otherLine = this.scaleLine( limb.line(), !this.flip ); 

        //find shortest distance btw 2 end points 
        let dist : number = this.findDistBetweenPointAndLine( otherLine.start, myLine );
        dist = Math.min( dist, this.findDistBetweenPointAndLine( otherLine.end, myLine ) ); 
        dist = Math.min( dist, this.findDistBetweenPointAndLine( myLine.end, otherLine ) ); 
        dist = Math.min( dist, this.findDistBetweenPointAndLine( myLine.start, otherLine ) ); 

        //find the shortest distance btw each midpoint
         
        let myMidPoint = new THREE.Vector3();
        myMidPoint = myLine.getCenter(myMidPoint); 

        let otherMidPoint = new THREE.Vector3();
        otherMidPoint = otherLine.getCenter(otherMidPoint); 

        dist = Math.min( dist, this.findDistBetweenPointAndLine( myMidPoint, otherLine ) ); 
        dist = Math.min( dist, this.findDistBetweenPointAndLine( otherMidPoint, myLine ) ); 

        //TODO: find quarters & others in loop.


        return dist <= whatIsEnough; 
    }

    intersects(limb : LimbIntersect, w:number, h:number) : boolean
    {
        this.w = w; 
        this.h = h; 
        let myLine = this.scaleLine( this.line(), this.flip ); 
        let otherLine = this.scaleLine( limb.line(), !this.flip ); 
        const CLOSE_ENOUGH : number = 0.09;
        let intersect : boolean = false; 
        if( this.getScore() > this.minConfidence && limb.getScore() > this.minConfidence )
        {
            //  intersect = this.intersectsLine(myLine, otherLine);
            if(!intersect)
            {
                intersect = this.closeEnough( limb, CLOSE_ENOUGH ); //from previous experimentation
            }
        }
        // if(intersect)
        // {
        //     console.log("touch start");

        //     console.log(this.getIndex1() +":"+ myLine.start.x  + "," + myLine.start.y + " | "  
        //     + myLine.end.x  + "," + myLine.end.y );

        //     console.log(limb.getIndex1() + ": "+otherLine.start.x  + "," + otherLine.start.y + " | "  
        //     + otherLine.end.x  + "," + otherLine.end.y );

        //     console.log("touch end");
    
        // }

        return intersect; 
    }

    toString() : string
    {
        return (this.limbLine.start.toString()  + "," + this.limbLine.end.toString() );
    }


}

class BodyPartIntersect extends DetectIntersect
{

    limbs : LimbIntersect[]; //lol
    geometry : THREE.BufferGeometry;
    line : THREE.Line; 
    material : THREE.Material; 
    name : string;
    meshMaterial : THREE.MeshBasicMaterial; 
    // shape : THREE.ShapeBufferGeometry;
    flip : boolean = false; 
    w : number;
    h : number;

    setFlipSelf(flip : boolean)
    {
        this.flip = flip; 
        for( let i =0; i<this.limbs.length; i++ )
        {
            this.limbs[i].setFlipSelf(flip);
        }
    }

    constructor(w:number, h:number, name: string, material : THREE.Material, confidence : number)
    {
        super(confidence);
        this.name =name; 
        this.limbs = [];
        this.geometry = new THREE.BufferGeometry();
        this.material = material; 
        this.line = new THREE.Line( this.geometry, this.material ); 
        this.meshMaterial =  new THREE.MeshBasicMaterial({ color: 0x0000ff});
        this.w = w; 
        this.h = h; 

    }

    getVectorsFromLimbs( limbs_ : LimbIntersect[] ) : THREE.Vector3[]
    {
        let vectors : THREE.Vector3[] = []; 

        for( let i=0; i<limbs_.length; i++ )
        {
            vectors = vectors.concat( limbs_[i].getVectors() );
        }
        return vectors;
    }

    setSize(w:number, h:number)
    {
        this.w = w; 
        this.h = h; 
        for(let i=0; i<this.limbs.length; i++)
        {
            this.limbs[i].setSize(w,h); 
        }
    }


//     makeLine(): THREE.Mesh 
//     {
//         let points : THREE.Vector3[] = this.getVectors(); 
//         const shape = new THREE.Shape();
    
//         shape.moveTo(points[0].x, points[0].y);
//         points.forEach(({ x, y }) => {
//         shape.lineTo(x, y);
//         });
//         shape.lineTo(points[0].x, points[0].y);
    
//         const geometry = new THREE.ShapeBufferGeometry(shape);
//         const mesh = new THREE.Mesh(geometry, this.meshMaterial);
//         mesh.position.z = 1.5;
    
//         return mesh;
//   }

    update(keypoints : any[]) : void
    {
        for(let i=0; i<this.limbs.length; i++) 
        {
            this.limbs[i].update(keypoints);
        }
        this.line.geometry.setFromPoints( this.getVectors() ); 
    }

    getLimbs() : LimbIntersect[]
    {
        return this.limbs; 
    }

    getPositions() : number[][]
    {
        let positions : number[][] = []; 
        let limbs = this.getLimbs(); 

        for(let i=0; i<limbs.length; i++)
        {
            positions.push( [ limbs[i].line().start.x, limbs[i].line().start.y ] );
            positions.push( [ limbs[i].line().end.x, limbs[i].line().end.y ] );
        }

        return positions;

    }

    getLine() : THREE.Line
    {
        return this.line; 
    }

    getVectors()
    {
        return this.getVectorsFromLimbs( this.limbs );
    }

    intersects( bodypart : BodyPartIntersect, w:number, h:number ) : boolean
    {
        let otherLimbs = bodypart.getLimbs(); 
        for(let i=0; i<this.limbs.length; i++)
        {
            for(let j=0; j<otherLimbs.length; j++)
            {
                if( this.limbs[i].getScore() > this.minConfidence )
                    if(this.limbs[i].intersects(otherLimbs[j], w, h))
                        return true; 
            }
        }
        return false;
    }

    toString()
    {
        let str : string = this.name + " ";
        for(let i=0; i<this.limbs.length; i++)
        {
            str += this.limbs[i].toString() + " ";
        }

    }
}


class TorsoIntersect extends BodyPartIntersect
{

    constructor(w:number, h:number,name : string, material : THREE.Material, minConfidence_ : number = 0.4)
    {
        super(w, h, name, material, minConfidence_)
        this.limbs = 
        [
            new  LimbIntersect( w, h, PoseIndex.leftShoulder, PoseIndex.rightShoulder, this.minConfidence ),
            new  LimbIntersect( w, h, PoseIndex.leftShoulder, PoseIndex.leftHip, this.minConfidence ),
            new  LimbIntersect( w, h, PoseIndex.leftHip, PoseIndex.rightHip, this.minConfidence ),
            new  LimbIntersect( w, h, PoseIndex.rightHip, PoseIndex.rightShoulder, this.minConfidence )
        ];
    }

}

//ok do the arms & legs - yes odd inheritance but its hte same tghing
class ArmsLegsIntersect extends BodyPartIntersect
{
    constructor(w:number, h:number,name: string, material : THREE.Material, upperIndex1: number, upperIndex2: number, lowerIndex1: number, lowerIndex2: number, minConfidence_ : number = 0.4)
    {
        super(w, h, name, material, minConfidence_)
        this.limbs = 
        [
            new  LimbIntersect( w, h, upperIndex1, upperIndex2,  this.minConfidence  ),
            new  LimbIntersect( w, h, lowerIndex1, lowerIndex2, this.minConfidence )
        ];
    }
}

class HeadBoundary extends LimbIntersect
{
    constructor(w:number, h:number,minConfidence : number = 0.4)
    {
        super(w, h, 0,0, minConfidence); 
    }

    updateBoundary( x1 : number, y1 : number, x2 : number, y2 : number, score_ : number ) : void
    {
        this.keypoints = []
        this.keypoints.push( { position: {x : x1, y : y1 }, score: score_ } );
        this.keypoints.push( { position: {x : x2, y : y2 }, score: score_ } );

        let pt1 : THREE.Vector3 =  new THREE.Vector3(x1, y1,2);
        let pt2 : THREE.Vector3 =  new THREE.Vector3(x2,y2,2 ) ;
        
        this.setLimbLine(pt1, pt2);
    }
}

class HeadIntersect extends BodyPartIntersect
{
    boundaries : HeadBoundary[]; 
    sphere : THREE.Sphere; 
    index : number[]; 

    constructor(w:number, h:number,name: string, material : THREE.Material, confidence)
    {
        super(w,h,name, material, confidence);
        this.boundaries = [
            new HeadBoundary(w,h,confidence),
            new HeadBoundary(w,h,confidence),
            new HeadBoundary(w,h,confidence),
            new HeadBoundary(w,h,confidence)
        ];
        this.limbs = this.boundaries; 
        this.sphere = new THREE.Sphere(); 

        this.index = [PoseIndex.nose, PoseIndex.leftEar, PoseIndex.rightEar, PoseIndex.leftEye, PoseIndex.rightEye];
    }

    //return max instead of average. need to compensate for ears tho
    getAvgScore(keypoints : any[]) : number
    {
        let score : number = 0;
        for(let i=0; i<this.index.length; i++)
        {
            if( keypoints[this.index[i]].score )
                score = Math.max(score, keypoints[this.index[i]].score);
        }
        return score; 
    }

    updateBoundaries(box : THREE.Box3, score : number)
    {
        // let leftTop = box.min; 
        // let rightBottom = box.max; 

        this.boundaries[0].updateBoundary(box.min.x, box.min.y, box.min.x, box.max.y, score  );
        this.boundaries[1].updateBoundary(box.min.x, box.max.y , box.max.x, box.max.y, score  );
        this.boundaries[2].updateBoundary(box.max.x, box.max.y , box.max.x, box.min.y, score   );
        this.boundaries[3].updateBoundary(box.max.x, box.min.y, box.min.x, box.min.y, score  );
    }

    getVectors()
    {
        return this.getVectorsFromLimbs( this.boundaries );
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
        this.updateBoundaries(box, this.getAvgScore(keypoints)); 
        this.line.geometry.setFromPoints( this.getVectors() ); 
    }

    //lol
    getLimbs() : LimbIntersect[]
    {
        return this.boundaries; 
    }
}

export class SkeletionIntersection
{
    minConfidence : number = 0.4; 

    participant : Participant; 

    head: HeadIntersect; 

    torso: TorsoIntersect;
    
    leftArm : ArmsLegsIntersect; 
    rightArm : ArmsLegsIntersect;
    leftLeg : ArmsLegsIntersect; 
    rightLeg: ArmsLegsIntersect;
    parts: BodyPartIntersect[];

    shouldFlipSelf : boolean = false; 


    friendSkeleton : any = undefined; // I find annoying that neither null or undefined can be assigned to defined type except via | which introduces even more freaking complexity. WTF.

    material : THREE.Material

    constructor(participant_ : Participant, minConfidence : number = 0.4,  w : number = 1, h:number = 1  )
    {
        this.participant = participant_; 

        this.material = new THREE.LineBasicMaterial({
            color: 0x0000ff
        }); 

        this.torso = new TorsoIntersect(w, h, "torso", this.material, minConfidence); 
        this.head = new HeadIntersect(w, h, "head", this.material, minConfidence);

        this.leftArm = new ArmsLegsIntersect(w, h, "leftArm",this.material, PoseIndex.leftShoulder, PoseIndex.leftElbow, PoseIndex.rightShoulder, PoseIndex.rightElbow, minConfidence);
        this.rightArm = new  ArmsLegsIntersect(w, h, "rightArm",this.material, PoseIndex.leftElbow, PoseIndex.leftWrist, PoseIndex.rightElbow, PoseIndex.rightWrist, minConfidence); 
        this.leftLeg = new  ArmsLegsIntersect( w, h, "leftLeg",this.material, PoseIndex.leftHip, PoseIndex.leftKnee, PoseIndex.leftKnee, PoseIndex.leftAnkle, minConfidence ); 
        this.rightLeg = new  ArmsLegsIntersect( w, h, "rightLeg",this.material, PoseIndex.rightHip, PoseIndex.rightKnee, PoseIndex.rightKnee, PoseIndex.rightAnkle, minConfidence ); 

        this.parts = [this.head, this.torso, this.leftArm, this.rightArm, this.leftLeg, this.rightLeg];    
    }

    setShouldFlipSelf(should : boolean)
    {
        this.shouldFlipSelf = should; 
        for( let i=0; i<this.parts.length; i++ )
        {
            this.parts[i].setFlipSelf(should); 
        }
    }

    setSize(w:number, h:number)
    {

        for(let i=0; i<this.parts.length; i++)
        {
            this.parts[i].setSize(w,h); 
        }
    }

    getLines() : THREE.Line[]
    {
        let lines : THREE.Line[] = [];
        for( let i=0; i<this.parts.length; i++ )
        {
            lines.push( this.parts[i].getLine() );
        }
        return lines; 
    }

    setFriend(friend : SkeletionIntersection)
    {
        this.friendSkeleton = friend; 

    }

    update()
    {
        let keypoints1 = this.participant.getAvgKeyPoints(); 
        for(let i=0; i<this.parts.length; i++)
        {
            this.parts[i].update(keypoints1);
            // console.log( this.parts[i] ); 
        }
    }

    getBodyPartIntersections() : BodyPartIntersect[]
    {
        return this.parts; 
    }

    //TODO: return where it is touching

    
    touching(w:number, h:number)
    {

        // (window as any).headIntersect = this.head.getPositions(); 

        let touch : boolean = false; 

        let friendParts = this.friendSkeleton.getBodyPartIntersections() ;
        // (window as any).friendHeadIntersect = friendParts[0].getPositions(); 

        this.friendSkeleton.setShouldFlipSelf( !this.shouldFlipSelf ); 

        let i = 0; //skipping head for now
        let j; 
        while( !touch && i<this.parts.length )
        {
            j = 0; 
            while( !touch && j<friendParts.length )
            {
                touch = this.parts[i].intersects( friendParts[j], w, h  ) ;
                j++;
            }
            i++;
        }

        if( touch ){
            i--; 
            j--; 
        }
        //     console.log("Touching! "+i+ " with " + j);
        // } else console.log( "Not touching!!");
        return touch; 
    }

}