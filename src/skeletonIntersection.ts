import * as THREE from 'three';
import type { Participant } from './participant';
import * as PoseIndex from './poseConstants'
import { Box2, BufferGeometry, Vector3 } from 'three';
import * as SAT from 'sat'; 
import { threeRenderCode } from './draw3js';

//need to put in utilities space
function distance(keypoints: any, poseIndex1: number, poseIndex2: number): number {
    let x1 = keypoints[poseIndex1].position.x;
    let y1 = keypoints[poseIndex1].position.y;
    let x2 = keypoints[poseIndex2].position.x;
    let y2 = keypoints[poseIndex2].position.y;

    return distance2d(x1, y1, x2, y2);
}


function distance2d(x1: number, y1: number, x2: number, y2: number): number {
    let dist = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    return Math.sqrt(dist);
}

function distance2dFromXYVector3(v1: THREE.Vector3, v2: THREE.Vector3) {
    return distance2d(v1.x, v1.y, v2.x, v2.y);
}

//super class
class DetectIntersect {
    minConfidence: number;
    constructor(minConfidence: number) {
        this.minConfidence = minConfidence;
    }

    getVectors(): THREE.Vector3[] {
        let v: THREE.Vector3[] = [];
        return v;
    }

    getScore(): number {
        return 0;
    }

    update(keypoints: any): void {

    }

}

//TODO: keep many of these?
export class WhereTouch {
    isTouching: boolean = false;
    intersectPoint: { x: number, y: number } = { x: 0, y: 0 };
    dist: number = Number.MAX_SAFE_INTEGER;

    myIndex : number []= []; 
    theirIndex : number[] = [];

    toString() : string
    {
        let str : string = "";

        str = "WhereTouch: Touching? " + this.isTouching + " myIndex: " + this.myIndex + " theirIndex: " + this.theirIndex ;
        str += " intersectPoint: " + this.intersectPoint.x + ","+ this.intersectPoint.y ; 
        str += "  distance: " + this.dist; 
        return str; 
    }

    ifDistIsLessReplace( wT: WhereTouch, myIndex:number[]=[], theirIndex: number[]=[] ): void {
        if (this.dist > wT.dist) {
            this.dist = wT.dist;
            this.intersectPoint = wT.intersectPoint;
            this.isTouching = wT.isTouching;

            //this is...... awkward and prob. could be refactored out in some way but oh well I will fix later.
            if( myIndex.length > 0 )
            {
                this.myIndex = myIndex; 
            }
            else
            {
                this.myIndex = wT.myIndex; 
            }

            if( theirIndex.length > 0 )
            {
                this.theirIndex = theirIndex;
            }
            else
            {
                this.theirIndex = wT.theirIndex; 
            }
             
        }
    }

    constructor() {
    }
}

export class DrawSkeletonIntersectLine {

    material: THREE.LineBasicMaterial;
    touchingMaterial: THREE.LineBasicMaterial; 
    boxMaterial: THREE.LineBasicMaterial; 


    personId: string;
    limbs: LimbIntersect[];
    minConfidence : number; 

    geometry: BufferGeometry = new THREE.BufferGeometry();
    touchGeo: BufferGeometry = new THREE.BufferGeometry(); 

    // geometryBox: BufferGeometry =  new THREE.BufferGeometry();
    // boxLine : THREE.Line = new THREE.Line(); 
       
    line : THREE.Line = new THREE.Line();
    touchLine : THREE.Line = new THREE.Line(); 

    constructor(minConfidence:number =0.4, personId: string = "") {

        this.material = new THREE.LineBasicMaterial({ color: 0xFFFFFF, transparent:true, opacity:1});
        this.touchingMaterial = new THREE.LineBasicMaterial({ color: 0xFF00FF, transparent:true, opacity:1});
        // this.boxMaterial = new THREE.LineBasicMaterial({ color: 0x8888FF, transparent:true, opacity:1});

        this.personId = personId;
        this.limbs = [];
        this.minConfidence = minConfidence; 
    }

    isPerson(id: string) {
        return id === this.personId;

    }

    update(limbs : LimbIntersect[]) : void
    {
        this.limbs = limbs;
    }

    groupToDraw() : THREE.Group {
        const group = new THREE.Group();
        let points : THREE.Vector3[] = []; 
        let touchingPoints : THREE.Vector3[] = []; 
        let boxPoints  : THREE.Vector3[] = []; 



        this.limbs.forEach(limb => {
            const keypoints = limb.getKeypoints();

            let box = limb.box; 
            let limbPoints  : THREE.Vector3[] = []; 

            if( keypoints[0].position.x && keypoints[0].position.y && keypoints[1].position.x && keypoints[1].position.y &&
                keypoints[0].score > this.minConfidence && keypoints[1].score > this.minConfidence )  
            {
                let v1=new THREE.Vector3(); 
                let v2=new THREE.Vector3(); 
                if( !limb.touching )
                {
                    points.push( new THREE.Vector3( keypoints[0].position.x, keypoints[0].position.y, 0.95 ) ); 
                    points.push( new THREE.Vector3( keypoints[1].position.x, keypoints[1].position.y, 0.95 ) ); 
                }
                else
                {
                    v1 = new THREE.Vector3( keypoints[0].position.x, keypoints[0].position.y, 0.95 ) ; 
                    v2 = new THREE.Vector3( keypoints[1].position.x, keypoints[1].position.y, 0.95 ) 

                    touchingPoints.push( v1 ); 
                    touchingPoints.push( v2 );
                }

                //this is just for debugging -- uncomment to show the collision box
                // console.log("v1:" + v1.x + "," + v1.y + "  v2:" + v2.x + "," + v2.y )
            //     let i=0; 
            //     box.forEach((vec)=>{ 
            //         vec.z = 0.95; 


                    
            //         if(limb.flip)
            //         {
            //             vec.x += 0.66; 
            //         }
            //         vec.x = 1 - vec.x;
            //         vec.x = vec.x * (320);  
            //         vec.y = vec.y * (240); 

            //         // console.log("vec" + i + ":"+ vec.x + "," + vec.y );


            //         limbPoints.push(vec);
            //         i++;
            //      });
            //      boxPoints.push(...limbPoints); 
            //      if(box.length > 0)
            //      {
            //         boxPoints.push(limbPoints[0].clone());
            //      }

            //         // console.log( "here:" + keypoints[0].position.x + "," + keypoints[0].position.y + " to " + keypoints[1].position.x + "," + keypoints[1].position.y  );
            } });

            this.geometry.setFromPoints(points);
            this.line.geometry = this.geometry; 
            this.line.material = this.material;
            this.line.frustumCulled = false;  

            this.touchGeo.setFromPoints(touchingPoints);
            this.touchLine.geometry = this.touchGeo; 
            this.touchLine.material = this.touchingMaterial;
            this.touchLine.frustumCulled = false;  
            
            // this.geometryBox.setFromPoints(boxPoints);
            // this.boxLine.geometry = this.geometryBox; 
            // this.boxLine.material = this.boxMaterial;
            // this.boxLine.frustumCulled = false;   

            group.add(this.line);
            group.add(this.touchLine);
            // group.add(this.boxLine);

        return group;
    }
}

//TODO: add touching to this
class DrawHead extends DrawSkeletonIntersectLine {
    center : THREE.Vector3 | null  = null ; 
    radius : number = 0;
    ellipseCurve : THREE.EllipseCurve = new THREE.EllipseCurve(0, 0, 0, 0, 0, 0, false, 0); 
    touching : boolean; 
    
    updateHead(center : THREE.Vector3, radius : number, touching:boolean ) : void
    {
        this.center = center; 
        this.radius = radius; 
        this.touching = touching; 
    }

    groupToDraw() : THREE.Group {
        const group = new THREE.Group();
        let points : THREE.Vector2[] = []; 

        if( this.center )
        {
            // 360 full circle will be drawn clockwise
            let x_radius : number = this.radius; 
            let y_radius : number = this.radius + (this.radius*0.2)
            this.ellipseCurve.aX = this.center.x; 
            this.ellipseCurve.aY = this.center.y; 
            this.ellipseCurve.xRadius = x_radius; 
            this.ellipseCurve.yRadius = y_radius; 
            this.ellipseCurve.aStartAngle = 0; 
            this.ellipseCurve.aEndAngle = 2 * Math.PI; 
            this.ellipseCurve.aClockwise = false;
            this.ellipseCurve.aRotation = 0;

            // const curve = new THREE.EllipseCurve(
            //     this.center.x,  this.center.y,            // ax, aY
            //     x_radius, y_radius,           // xRadius, yRadius
            //     0,  2 * Math.PI,  // aStartAngle, aEndAngle
            //     false,            // aClockwise
            //     0                 // aRotation
            // );
            
            points = this.ellipseCurve.getPoints( 30 );
            // points2.forEach( ( point ) => { points.push( new THREE.Vector3( points2. ) ) } );
        }

        this.geometry.setFromPoints(points);
        this.line.geometry = this.geometry;
        if( !this.touching ) 
            this.line.material = this.material; 
        else this.line.material = this.touchingMaterial; 
        this.line.frustumCulled = false; 
        group.add(this.line);

        return group;
    }

}

//to reuse the values -- the collision function
let normVector2 = new THREE.Vector2(); 
let normVector2nd = new THREE.Vector2();
let normVector = new THREE.Vector3();
let normVector2ndPts = new THREE.Vector3();
let parallelVector = new THREE.Vector2();

export class LimbIntersect extends DetectIntersect {
    limbLine: THREE.Line3;
    keypoints: any[];
    index1: number;
    index2: number;
    flip: boolean = false;
    w: number;
    h: number;
    touching: boolean; //whether it is touching the other person
    offsets : THREE.Vector3 = new THREE.Vector3(0,0,0); 
    lastOffsetX : number = 0;
    lastOffsetXIndex : number = 0;

    box : Vector3[] = []; 


    constructor(w: number, h: number, index1_: number, index2_: number, minConfidence_: number = 0.4) {
        super(minConfidence_);
        this.limbLine = new THREE.Line3();
        this.index1 = index1_;
        this.index2 = index2_;
        this.keypoints = [];
        this.w = w;
        this.h = h;




    }

    updateOffsets(offs : THREE.Vector3)
    {
        this.offsets = offs; 
    }

    resetTouch() : void
    {
        this.touching = false;
    }

    getIndex1(): number {
        return this.index1;
    }

    getIndices() : number[]
    {
        return [this.index1, this.index2];
    }

    setSize(w: number, h: number) {
        this.w = w;
        this.h = h;
    }

    setFlipSelf(flip: boolean) {
        this.flip = flip;
    }

    setLine(limb: THREE.Line3) {
        this.limbLine = limb;
    }

    getScaledKeypointsVector3() : THREE.Vector3[]
    {
        let keypoints : THREE.Vector3[]= 
        [
            this.scaleVector( new THREE.Vector3( this.keypoints[0].position.x , this.keypoints[0].position.y, 0 ), this.flip ),
            this.scaleVector( new THREE.Vector3( this.keypoints[1].position.x , this.keypoints[1].position.y, 0 ), this.flip )
        ]
        return keypoints; 
    }

    getKeypoints()
    {
        return this.keypoints; 
    }

    getVectors(): THREE.Vector3[] {
        return [this.limbLine.start, this.limbLine.end];
    }

    //return minimum score instead of average score
    getScore(): number {
        // let avg: number = 0;
        // if (this.keypoints.length > 0) {
        //     for (let i = 0; i < this.keypoints.length; i++) {
        //         if (this.keypoints[i].score) {
        //             avg += this.keypoints[i].score;
        //         }
        //     }
        //     avg /= this.keypoints.length;
        // }
        // return avg;

        let min: number = 1;
        if (this.keypoints.length > 0) {
            for (let i = 0; i < this.keypoints.length; i++) {
                if (!isNaN(this.keypoints[i].score)) {
                    min = Math.min( min, this.keypoints[i].score )
                }
            }
        }
        return min;
    }

    line() {
        return this.limbLine;
    }

    setLine3(l: THREE.Line3, pt1: THREE.Vector3, pt2: THREE.Vector3): THREE.Line3 {
        let start: THREE.Vector3;
        let end: THREE.Vector3;

        let val1: number = (pt2.x - pt1.x);
        let val2: number = (pt2.y - pt1.y);

        if ((val1 < 0) || (val2 < 0)) {
            start = pt2;
            end = pt1;
        }
        else {
            start = pt1;
            end = pt2;
        }
        l.set(pt1, pt2);
        return l;
    }

    setLimbLine(pt1: THREE.Vector3, pt2: THREE.Vector3) {
        this.limbLine = this.setLine3(this.limbLine, pt1, pt2);
    }

    update(keypoints: any): void {
        this.keypoints = []
        this.keypoints.push(keypoints[this.index1]);
        this.keypoints.push(keypoints[this.index2]);

        let pt1: THREE.Vector3 = new THREE.Vector3(keypoints[this.index1].position.x, keypoints[this.index1].position.y, 2);
        let pt2: THREE.Vector3 = new THREE.Vector3(keypoints[this.index2].position.x, keypoints[this.index2].position.y, 2);

        this.setLimbLine(pt1, pt2);
    }

    //modified from : https://www.geeksforgeeks.org/check-if-two-given-line-segments-intersect/
    // Given three colinear points p, q, r, the function checks if 
    // point q lies on line segment 'pr' 
    onSegment(p: THREE.Vector3, q: THREE.Vector3, r: THREE.Vector3): boolean {
        return (q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
            q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y))

    }


    // modified from here: https://www.geeksforgeeks.org/check-if-two-given-line-segments-intersect/
    // To find orientation of ordered triplet (p, q, r). 
    // The function returns following values 
    // 0 --> p, q and r are colinear 
    // 1 --> Clockwise 
    // 2 --> Counterclockwise 
    orientation(p: THREE.Vector3, q: THREE.Vector3, r: THREE.Vector3): number {
        // See https://www.geeksforgeeks.org/orientation-3-ordered-points/ 
        // for details of below formula. 
        let val: number = (q.y - p.y) * (r.x - q.x) -
            (q.x - p.x) * (r.y - q.y);

        if (val == 0) return 0;  // colinear 

        return (val > 0) ? 1 : 2; // clock or counterclock wise 
    }

    // modified from here: https://www.geeksforgeeks.org/check-if-two-given-line-segments-intersect/
    // The main function that returns true if line segment 'p1q1' 
    // and 'p2q2' intersect. 
    // NOTE: this is not used bc it does not handle all cases!! failed unit tests #$%^&*(O^&) with false positives.
    intersectsLine(line1: THREE.Line3, line2: THREE.Line3): boolean {


        // Find the four orientations needed for general and 
        // special cases 
        let o1: number = this.orientation(line1.start, line2.start, line1.end);
        let o2: number = this.orientation(line1.start, line2.start, line2.end);
        let o3: number = this.orientation(line1.end, line2.end, line1.start);
        let o4: number = this.orientation(line1.end, line2.end, line2.start);

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

    //TODO: remove the "scale" & replace with actual positions drawn by 3js.
    scaleVector(v: THREE.Vector3, flip: boolean, i : number=-1): THREE.Vector3 
    {
        //TODO: ok this should be a passed in value -- but it is passed in via draw3js.ts line 84 
        let percentXOver = 0.66;

        let scaledX = 1 - (v.x / this.w); //x is flipped 
        if (flip) {
            scaledX -= percentXOver;
        }

        let scaledY = v.y / this.h;

        //it is scaled by 2 because keypoints are from the scaled image given to posenet/mediapipe. 
        //need to get rid of this and just work from the points actually drawn by 3js
        //because this is hacky as SHIT!
        //however, not now. 
        scaledX += (this.offsets.x/this.w)/2; 
        scaledY += (this.offsets.y/this.h)/2;

        return new THREE.Vector3(scaledX, scaledY, 2);
    }

    scaleLine(l: THREE.Line3, flip: boolean): THREE.Line3 {

        let line: THREE.Line3 = new THREE.Line3();
        return this.setLine3(line, this.scaleVector(l.start, flip, 0), this.scaleVector(l.end, flip, 1));
    }

    findDistBetweenPointAndLine(v: THREE.Vector3, aLine: THREE.Line3): WhereTouch {

        let closestPoint = new THREE.Vector3();
        let whereIntersect = new WhereTouch();

        closestPoint = aLine.closestPointToPoint(v, true, closestPoint);
        whereIntersect.intersectPoint.x = closestPoint.x;
        whereIntersect.intersectPoint.y = closestPoint.y;

        whereIntersect.dist = distance2dFromXYVector3(v, closestPoint);

        return whereIntersect;
    }

    doLinesIntersectAtMidpoint ( linesegment1: THREE.Line3, line2: THREE.Line3, myIndices:number[], theirIndices:number[],  whereIntersect: WhereTouch, times : number ) : WhereTouch
    {
        let myMidPoint = new THREE.Vector3();
        myMidPoint = linesegment1.getCenter(myMidPoint);

        whereIntersect.ifDistIsLessReplace(this.findDistBetweenPointAndLine(myMidPoint, line2), myIndices, theirIndices);

        if(times ===0 ){
            return whereIntersect;
        }
        else
        {
            let line1 : THREE.Line3 = new THREE.Line3( linesegment1.start, myMidPoint );
            let endline : THREE.Line3 = new THREE.Line3( myMidPoint, linesegment1.end );
            
            whereIntersect = this.doLinesIntersectAtMidpoint ( line1, line2, myIndices, theirIndices,  whereIntersect, times-1 );
            return this.doLinesIntersectAtMidpoint ( endline, line2, myIndices, theirIndices,  whereIntersect, times-1 );
        }
    };

    //LATER!
    createSATPolygonFromLine(line : THREE.Line3) : SAT.Polygon
    {
        //to find the box: 
               //find the normal for each line
        let point1 = line.start.clone(); 
        let point2 = line.end.clone(); 
        let dx = point1.clone().sub(point2);

        //find the normals in different directions
        normVector2.set( -dx.y, dx.x).normalize(); 
        normVector2nd.set( dx.y, -dx.x).normalize();
        normVector.set( normVector2.x, normVector2.y, 0 );
        normVector2ndPts.set( normVector2nd.x, normVector2nd.y, 0 );
        parallelVector.set( dx.x, dx.y).normalize();
       
        // thickness of box / 2 -- so far this is 2X of current 'closeEnough'
        let boxThick = 0.008;
        let normV1 = normVector.multiplyScalar(boxThick);
        let normV2 =  normVector2ndPts.multiplyScalar(boxThick);
        parallelVector.multiplyScalar(boxThick);
        let pVector = new Vector3(parallelVector.x, parallelVector.y, 0); 

        // then each point in the box is:
        let boxPoint1 = point1.clone().add( normV1 ).add( pVector );
        let boxPoint2 = point1.clone().add( normV2 ).add( pVector );; 
        let boxPoint4 = point2.clone().add( normV1 ).sub( pVector );;
        let boxPoint3 = point2.clone().add( normV2 ).sub( pVector );;

        this.box = [boxPoint1, boxPoint2, boxPoint3, boxPoint4]; 

        return new SAT.Polygon(new SAT.Vector(0,0), [
                new SAT.Vector(boxPoint1.x, boxPoint1.y), 
                new SAT.Vector(boxPoint2.x, boxPoint2.y),
                new SAT.Vector(boxPoint3.x, boxPoint3.y),
                new SAT.Vector(boxPoint4.x, boxPoint4.y)
        ]);
    }

    createSATLine(line : THREE.Line3) : SAT.Polygon
    {
        return new SAT.Polygon(new SAT.Vector(line.start.x, line.start.y), [
            new SAT.Vector(line.start.x, line.start.y),
            new SAT.Vector(line.end.x, line.end.y),
          ]);
    }

    closeEnough(limb: LimbIntersect, whatIsEnough: number, whereIntersect: WhereTouch): WhereTouch {
        let myLine : THREE.Line3 = this.scaleLine(this.line(), this.flip);
        let otherLine : THREE.Line3 = limb.scaleLine(limb.line(), !this.flip);

        //TODO: substitute this intersection code with library code
        //algorithm -- find boxes for each limb then test for intersection
                    //test intersection with https://github.com/jriecken/sat-js
                    
        // let line1 : SAT.Polygon = this.createSATPolygonFromLine(myLine); 
        // let line2 : SAT.Polygon = limb.createSATPolygonFromLine(otherLine); 
        // let response : SAT.Response = new SAT.Response();
        // let collided : boolean = SAT.testPolygonPolygon(line1, line2, response);
        // whereIntersect.isTouching = collided; 
        // let myIndices = this.getIndices();
        // let theirIndices = limb.getIndices(); 

        // if( collided )
        // {
        //     whereIntersect.intersectPoint.x = response.overlap.x; 
        //     whereIntersect.intersectPoint.y = response.overlap.y;
        //     whereIntersect.dist = 0; 
        //     whereIntersect.myIndex = myIndices; 
        //     whereIntersect.theirIndex = theirIndices; 
        // }

        //find shortest distance btw 2 end points 
        let myIndices = [this.index1, this.index2]; 
        let theirIndices = [limb.index1, limb.index2];
        whereIntersect = this.findDistBetweenPointAndLine(otherLine.start, myLine);
        whereIntersect.ifDistIsLessReplace(this.findDistBetweenPointAndLine(otherLine.end, myLine), myIndices, theirIndices);
        whereIntersect.ifDistIsLessReplace(this.findDistBetweenPointAndLine(myLine.end, otherLine), myIndices, theirIndices);
        whereIntersect.ifDistIsLessReplace(this.findDistBetweenPointAndLine(myLine.start, otherLine), myIndices, theirIndices);

        //find the midpoints & quarter points & eight points
        const numberOfMidpointsEach : number = 2; // divide line into 4ths

        let myLineSegment : THREE.Line3 = myLine;
        let otherLineSegment : THREE.Line3 = otherLine;

        whereIntersect = this.doLinesIntersectAtMidpoint( myLine, otherLine, myIndices, theirIndices, whereIntersect, 2 );
        whereIntersect = this.doLinesIntersectAtMidpoint( otherLine, myLine, myIndices, theirIndices, whereIntersect, 2 );   

        whereIntersect.isTouching = whereIntersect.dist <= whatIsEnough;

        return whereIntersect;
    }

    intersects(limb: LimbIntersect, w: number, h: number): WhereTouch {
        this.w = w;
        this.h = h;
        let myLine = this.scaleLine(this.line(), this.flip);
        let otherLine = limb.scaleLine(limb.line(), !this.flip);

        const CLOSE_ENOUGH: number = 0.05;
        let whereIntersect: WhereTouch = new WhereTouch();
        whereIntersect.isTouching = false;

        if (this.getScore() > this.minConfidence && limb.getScore() > this.minConfidence) {
            //  intersect = this.intersectsLine(myLine, otherLine);
            // if(!intersect)
            // {
            whereIntersect = this.closeEnough(limb, CLOSE_ENOUGH, whereIntersect); //from previous experimentation
            // }
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

        return whereIntersect;
    }

    toString(): string {
        return (this.limbLine.start.toString() + "," + this.limbLine.end.toString());
    }


}

class BodyPartIntersect extends DetectIntersect {

    limbs: LimbIntersect[]; //lol
    // line: THREE.Line;
    name: string;
    flip: boolean = false;
    w: number;
    h: number;
    
    // geometry : THREE.BufferGeometry = new THREE.BufferGeometry(); 
    
    drawSkeleton : DrawSkeletonIntersectLine;

    constructor(w: number, h: number, name: string, material: THREE.Material, confidence: number) {
        super(confidence);
        this.name = name;
        this.limbs = [];
        this.w = w;
        this.h = h;
        this.drawSkeleton = new DrawSkeletonIntersectLine(confidence, ""); 
        // this.line.geometry = this.geometry; 

    }

    resetTouch() : void
    {
        this.limbs.forEach( (limb )=>{limb.resetTouch(); } ); 
    }

    setFlipSelf(flip: boolean) {
        this.flip = flip;
        for (let i = 0; i < this.limbs.length; i++) {
            this.limbs[i].setFlipSelf(flip);
        }
    }

    getVectorsFromLimbs(limbs_: LimbIntersect[]): THREE.Vector3[] {
        let vectors: THREE.Vector3[] = [];

        for (let i = 0; i < limbs_.length; i++) {
            vectors = vectors.concat(limbs_[i].getVectors());
        }
        return vectors;
    }

    setSize(w: number, h: number) {
        this.w = w;
        this.h = h;
        for (let i = 0; i < this.limbs.length; i++) {
            this.limbs[i].setSize(w, h);
        }
    }

    update(keypoints: any[]): void {
        for (let i = 0; i < this.limbs.length; i++) {
            this.limbs[i].update(keypoints);
        }
        // this.line.geometry.setFromPoints(this.getVectors());

        this.drawSkeleton.update(this.limbs);
    }

    //just so I don't have to propagate changes to inherited classes.
    updateOffsets( offsets : THREE.Vector3 )
    {
        this.limbs.forEach( (limb)=>{ limb.updateOffsets(offsets) } );
    }

    draw() : THREE.Group
    {
        return this.drawSkeleton.groupToDraw(); 
    }

    getLimbs(): LimbIntersect[] {
        return this.limbs;
    }

    getPositions(): number[][] {
        let positions: number[][] = [];
        let limbs = this.getLimbs();

        for (let i = 0; i < limbs.length; i++) {
            positions.push([limbs[i].line().start.x, limbs[i].line().start.y]);
            positions.push([limbs[i].line().end.x, limbs[i].line().end.y]);
        }

        return positions;

    }

    getVectors() {
        return this.getVectorsFromLimbs(this.limbs);
    }

    intersects(bodypart: BodyPartIntersect, w: number, h: number): WhereTouch {
        let whereTouch = new WhereTouch();
        let otherLimbs = bodypart.getLimbs();
        for (let i = 0; i < this.limbs.length; i++) {
            for (let j = 0; j < otherLimbs.length; j++) {
                if (this.limbs[i].getScore() > this.minConfidence) {
                    whereTouch.ifDistIsLessReplace(this.limbs[i].intersects(otherLimbs[j], w, h), this.limbs[i].getIndices(), otherLimbs[j].getIndices());
                }
                this.limbs[i].touching = this.limbs[i].touching || whereTouch.isTouching; 
                otherLimbs[j].touching = otherLimbs[j].touching || whereTouch.isTouching; 
            }
        }
        return whereTouch;
    }

    toString() {
        let str: string = this.name + " ";
        for (let i = 0; i < this.limbs.length; i++) {
            str += this.limbs[i].toString() + " ";
        }

    }
}


class TorsoIntersect extends BodyPartIntersect {

    constructor(w: number, h: number, name: string, material: THREE.Material, minConfidence_: number = 0.4) {
        super(w, h, name, material, minConfidence_)
        this.limbs =
            [
                new LimbIntersect(w, h, PoseIndex.leftShoulder, PoseIndex.rightShoulder, this.minConfidence),
                new LimbIntersect(w, h, PoseIndex.leftShoulder, PoseIndex.leftHip, this.minConfidence),
                new LimbIntersect(w, h, PoseIndex.leftHip, PoseIndex.rightHip, this.minConfidence),
                new LimbIntersect(w, h, PoseIndex.rightHip, PoseIndex.rightShoulder, this.minConfidence)
            ];
    }

}

//ok do the arms & legs - yes odd inheritance but its hte same tghing
class ArmsLegsIntersect extends BodyPartIntersect {
    constructor(w: number, h: number, name: string, material: THREE.Material, upperIndex1: number, upperIndex2: number, lowerIndex1: number, lowerIndex2: number, minConfidence_: number = 0.4) {
        super(w, h, name, material, minConfidence_)
        this.limbs =
            [
                new LimbIntersect(w, h, upperIndex1, upperIndex2, this.minConfidence),
                new LimbIntersect(w, h, lowerIndex1, lowerIndex2, this.minConfidence)
            ];
    }
}

class HeadBoundary extends LimbIntersect {
    constructor(w: number, h: number, minConfidence: number = 0.4) {
        super(w, h, 0, 0, minConfidence);
    }

    updateBoundary(x1: number, y1: number, x2: number, y2: number, score_: number): void {
        this.keypoints = []
        this.keypoints.push({ position: { x: x1, y: y1 }, score: score_ });
        this.keypoints.push({ position: { x: x2, y: y2 }, score: score_ });

        let pt1: THREE.Vector3 = new THREE.Vector3(x1, y1, 2);
        let pt2: THREE.Vector3 = new THREE.Vector3(x2, y2, 2);

        this.setLimbLine(pt1, pt2);
    }
}

class HeadIntersect extends BodyPartIntersect {
    boundaries: HeadBoundary[];
    sphere: THREE.Sphere;
    index: number[];
    touching: boolean; 

    constructor(w: number, h: number, name: string, material: THREE.Material, confidence) {
        super(w, h, name, material, confidence);
        this.boundaries = [
            new HeadBoundary(w, h, confidence),
            new HeadBoundary(w, h, confidence),
            new HeadBoundary(w, h, confidence),
            new HeadBoundary(w, h, confidence)
        ];
        this.limbs = this.boundaries;
        this.sphere = new THREE.Sphere();

        this.index = [PoseIndex.nose, PoseIndex.leftEar, PoseIndex.rightEar, PoseIndex.leftEye, PoseIndex.rightEye];
        this.drawSkeleton = new DrawHead(confidence, "");  
    }

    //return max instead of average. need to compensate for ears tho
    getAvgScore(keypoints: any[]): number {
        let score: number = 0;
        for (let i = 0; i < this.index.length; i++) {
            if (keypoints[this.index[i]].score)
                score = Math.max(score, keypoints[this.index[i]].score);
        }
        return score;
    }

    updateBoundaries(box: THREE.Box3, score: number) {
        // let leftTop = box.min; 
        // let rightBottom = box.max; 

        this.boundaries[0].updateBoundary(box.min.x, box.min.y, box.min.x, box.max.y, score);
        this.boundaries[1].updateBoundary(box.min.x, box.max.y, box.max.x, box.max.y, score);
        this.boundaries[2].updateBoundary(box.max.x, box.max.y, box.max.x, box.min.y, score);
        this.boundaries[3].updateBoundary(box.max.x, box.min.y, box.min.x, box.min.y, score);
    }

        //just so I don't have to propagate changes to inherited classes.
        updateOffsets( offsets : THREE.Vector3 )
        {
            this.boundaries.forEach( (limb)=>{ limb.updateOffsets(offsets) } );
        }

    getVectors() {
        return this.getVectorsFromLimbs(this.boundaries);
    }

    update(keypoints: any[]) {
        //TODO: deal with confidence later on this.
        let noseToEarDistance1: number = distance(keypoints, PoseIndex.nose, PoseIndex.rightEar);
        let noseToEarDistance2: number = distance(keypoints, PoseIndex.nose, PoseIndex.leftEar);
        let rightX = keypoints[PoseIndex.rightEar].position.x ;
        let rightY = keypoints[PoseIndex.rightEar].position.y ;
        let leftX = keypoints[PoseIndex.leftEar].position.x ;
        let leftY = keypoints[PoseIndex.leftEar].position.y ;


        if( keypoints[PoseIndex.rightEar].score < this.minConfidence )
        {
            noseToEarDistance1 = distance(keypoints, PoseIndex.nose, PoseIndex.rightEye);
            rightX = keypoints[PoseIndex.rightEye].position.x ;
            rightY = keypoints[PoseIndex.rightEye].position.y ;
        }

        if( keypoints[PoseIndex.leftEar].score < this.minConfidence )
        {
            noseToEarDistance2 = distance(keypoints, PoseIndex.nose, PoseIndex.leftEye);
            leftX = keypoints[PoseIndex.leftEye].position.x ;
            leftY = keypoints[PoseIndex.leftEye].position.y ;
        }

        let noseToEarDistance : number = (noseToEarDistance1 + noseToEarDistance2) / 2;
        let xcenter = ( rightX + leftX ) / 2 ;
        let ycenter = ( rightY + leftY ) / 2 ;


        let headCenter = new THREE.Vector3();
        headCenter.setX( xcenter );
        headCenter.setY( ycenter );
        headCenter.setZ( 0 );

        this.sphere.set(headCenter, noseToEarDistance);
        let box = new THREE.Box3;
        box = this.sphere.getBoundingBox(box);
        this.updateBoundaries(box, this.getAvgScore(keypoints));
        // this.line.geometry.setFromPoints(this.getVectors());

        this.touching = false; 
        this.boundaries.forEach( (bound)=>{
            this.touching = this.touching || bound.touching; 
        });

        (this.drawSkeleton as DrawHead).updateHead(headCenter, noseToEarDistance, this.touching);

    }

    //lol
    getLimbs(): LimbIntersect[] {
        return this.boundaries;
    }
}

export class SkeletionIntersection {
    minConfidence: number = 0.4;

    participant: Participant;

    head: HeadIntersect;

    torso: TorsoIntersect;

    leftArm: ArmsLegsIntersect;
    rightArm: ArmsLegsIntersect;
    leftLeg: ArmsLegsIntersect;
    rightLeg: ArmsLegsIntersect;
    parts: BodyPartIntersect[];

    shouldFlipSelf: boolean = false;

    friendSkeleton: any = undefined; // I find annoying that neither null or undefined can be assigned to defined type except via | which introduces even more freaking complexity. WTF.

    material: THREE.Material
    isFriend : boolean = false; 
    w : number;
    h : number; 

    constructor(participant_: Participant, minConfidence: number = 0.3, w: number = 1, h: number = 1) {
        this.participant = participant_;
        this.w = w; 
        this.h = h; 

        this.material = new THREE.LineBasicMaterial({
            color: 0x0000ff
        });
        this.torso = new TorsoIntersect(w, h, "torso", this.material, minConfidence);
        this.head = new HeadIntersect(w, h, "head", this.material, minConfidence);

        this.leftArm = new ArmsLegsIntersect(w, h, "leftArm", this.material, PoseIndex.leftShoulder, PoseIndex.leftElbow, PoseIndex.leftElbow, PoseIndex.leftWrist, minConfidence);
        this.rightArm = new ArmsLegsIntersect(w, h, "rightArm", this.material, PoseIndex.rightShoulder, PoseIndex.rightElbow, PoseIndex.rightElbow, PoseIndex.rightWrist, minConfidence);
        this.leftLeg = new ArmsLegsIntersect(w, h, "leftLeg", this.material, PoseIndex.leftHip, PoseIndex.leftKnee, PoseIndex.leftKnee, PoseIndex.leftAnkle, minConfidence);
        this.rightLeg = new ArmsLegsIntersect(w, h, "rightLeg", this.material, PoseIndex.rightHip, PoseIndex.rightKnee, PoseIndex.rightKnee, PoseIndex.rightAnkle, minConfidence);

        this.parts = [this.head, this.torso, this.leftArm, this.rightArm, this.leftLeg, this.rightLeg];
    }

    setIsFriend(friend:boolean = true)
    {
        this.isFriend = friend; 
    }

    setShouldFlipSelf(should: boolean) {
        this.shouldFlipSelf = should;
        for (let i = 0; i < this.parts.length; i++) {
            this.parts[i].setFlipSelf(should);
        }
    }

    setSize(w: number, h: number) {

        for (let i = 0; i < this.parts.length; i++) {
            this.parts[i].setSize(w, h);
        }
        this.w = w;
        this.h = h; 
    }

    setFriend(friend: SkeletionIntersection) {
        this.friendSkeleton = friend;
        this.friendSkeleton.setIsFriend(); 
    }

    update(offsets : Vector3) {
        let keypoints1 = this.participant.getAvgKeyPoints();
        let limbs : LimbIntersect[] = []; 
        for (let i = 0; i < this.parts.length; i++) {
            this.parts[i].update(keypoints1);
            // limbs.push(...this.parts[i].getLimbs());
            // console.log( this.parts[i] ); 
        }
        this.updateOffsets(offsets);

        let offsetx = -((offsets.x/this.w)/2);
        let offsety = -((offsets.y/this.h)/2);

        // console.log(  "isFriend:" + this.isFriend + "  offsetx:" + offsetx + "  offsety:" + offsety  );
    }

    updateOffsets(offsets : Vector3)
    {
        for (let i = 0; i < this.parts.length; i++) 
        {
            this.parts[i].updateOffsets(offsets);
        }
    }

    getDrawGroup() : THREE.Group
    {
        let group : THREE.Group = new THREE.Group();

        this.parts.forEach( ( part ) =>
            {
                group.add(part.draw());
            }
        );

        return group; 
    }

    getBodyPartIntersections(): BodyPartIntersect[] {
        return this.parts;
    }

    //TODO: return where it is touching


    resetTouch() : void
    {
        this.parts.forEach( (part)=>{ part.resetTouch() } );
        
    }

    touching(w: number, h: number): WhereTouch {

        // (window as any).headIntersect = this.head.getPositions(); 

        let touch: WhereTouch = new WhereTouch();
        this.resetTouch(); 
        this.friendSkeleton.resetTouch(); 

        let friendParts = this.friendSkeleton.getBodyPartIntersections();
        // (window as any).friendHeadIntersect = friendParts[0].getPositions(); 

        this.friendSkeleton.setShouldFlipSelf(!this.shouldFlipSelf);

        let i = 0;
        let j;
        while (i < this.parts.length) //TODO make back into a for loop
        {
            j = 0;
            while (j < friendParts.length) {
                touch.ifDistIsLessReplace(this.parts[i].intersects(friendParts[j], w, h))
                j++;
            }
            i++;
        }

        //     console.log("Touching! "+i+ " with " + j);
        // } else console.log( "Not touching!!");
        return touch;
    }

}