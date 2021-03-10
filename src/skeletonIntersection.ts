import * as THREE from 'three';
import type { Participant } from './participant';
import * as PoseIndex from './poseConstants'
import type { BufferGeometry } from 'three';

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

    geometry: BufferGeometry = new THREE.BufferGeometry(); ;
    material: THREE.LineBasicMaterial;
    personId: string;
    limbs: LimbIntersect[];
    mesh : THREE.Mesh | null;
    minConfidence : number; 
    line : THREE.Line = new THREE.Line();



    constructor(minConfidence:number =0.4, personId: string = "") {
        this.geometry = new THREE.BufferGeometry();
        this.mesh = null; 
        this.material = new THREE.LineBasicMaterial({ color: 0x505055, transparent:true, opacity:0.75});
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

        this.limbs.forEach(limb => {
            const keypoints = limb.getKeypoints(); 
            if( keypoints[0].position.x && keypoints[0].position.y && keypoints[1].position.x && keypoints[1].position.y &&
                keypoints[0].score > this.minConfidence && keypoints[1].score > this.minConfidence )  
            {
                    points.push( new THREE.Vector3( keypoints[0].position.x, keypoints[0].position.y, 0.95 ) ); 
                    points.push( new THREE.Vector3( keypoints[1].position.x, keypoints[1].position.y, 0.95 ) ); 

                    // console.log( "here:" + keypoints[0].position.x + "," + keypoints[0].position.y + " to " + keypoints[1].position.x + "," + keypoints[1].position.y  );
            } });

            this.geometry.setFromPoints(points);
            this.line.geometry = this.geometry; 
            this.line.material = this.material; 
            group.add(this.line);

        return group;
    }
}

class DrawHead extends DrawSkeletonIntersectLine {
    center : THREE.Vector3 | null  = null ; 
    radius : number = 0;
    ellipseCurve : THREE.EllipseCurve = new THREE.EllipseCurve(0, 0, 0, 0, 0, 0, false, 0); 
    
    updateHead(center : THREE.Vector3, radius : number ) : void
    {
        this.center = center; 
        this.radius = radius; 
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
        this.line.material = this.material; 
        group.add(this.line);

        return group;
    }

}

export class LimbIntersect extends DetectIntersect {
    limbLine: THREE.Line3;
    keypoints: any[];
    index1: number;
    index2: number;
    flip: boolean = false;
    w: number;
    h: number;

    constructor(w: number, h: number, index1_: number, index2_: number, minConfidence_: number = 0.4) {
        super(minConfidence_);
        this.limbLine = new THREE.Line3();
        this.index1 = index1_;
        this.index2 = index2_;
        this.keypoints = [];
        this.w = w;
        this.h = h;


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
            this.scaleVector( new THREE.Vector3( this.keypoints[0].position.x , this.keypoints[0].position.y, 0.9 ), this.flip ),
            this.scaleVector( new THREE.Vector3( this.keypoints[1].position.x , this.keypoints[1].position.y, 0.9 ), this.flip )
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
        l.set(start, end);
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

    scaleVector(v: THREE.Vector3, flip: boolean): THREE.Vector3 {
        //TODO: ok this should be a passed in value -- but it is passed in via draw3js.ts line 84 
        let percentXOver = 0.66;

        let scaledX = 1 - (v.x / this.w); //x is flipped 
        if (flip) {
            scaledX -= percentXOver;
        }

        let scaledY = v.y / this.h;

        return new THREE.Vector3(scaledX, scaledY, 2);
    }

    scaleLine(l: THREE.Line3, flip: boolean): THREE.Line3 {

        let line: THREE.Line3 = new THREE.Line3();
        return this.setLine3(line, this.scaleVector(l.start, flip), this.scaleVector(l.end, flip));
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

    

    closeEnough(limb: LimbIntersect, whatIsEnough: number, whereIntersect: WhereTouch): WhereTouch {
        let myLine = this.scaleLine(this.line(), this.flip);
        let otherLine = this.scaleLine(limb.line(), !this.flip);

        let myIndices = this.getIndices();
        let theirIndices = limb.getIndices(); 


        //find shortest distance btw 2 end points 
        whereIntersect = this.findDistBetweenPointAndLine(otherLine.start, myLine);
        whereIntersect.ifDistIsLessReplace(this.findDistBetweenPointAndLine(otherLine.end, myLine), myIndices, theirIndices);
        whereIntersect.ifDistIsLessReplace(this.findDistBetweenPointAndLine(myLine.end, otherLine), myIndices, theirIndices);
        whereIntersect.ifDistIsLessReplace(this.findDistBetweenPointAndLine(myLine.start, otherLine), myIndices, theirIndices);

        //find the shortest distance btw each midpoint

        // let myMidPoint = new THREE.Vector3();
        // myMidPoint = myLine.getCenter(myMidPoint);

        // let otherMidPoint = new THREE.Vector3();
        // otherMidPoint = otherLine.getCenter(otherMidPoint);

        // whereIntersect.ifDistIsLessReplace(this.findDistBetweenPointAndLine(myMidPoint, otherLine), myIndices, theirIndices);
        // whereIntersect.ifDistIsLessReplace(this.findDistBetweenPointAndLine(otherMidPoint, myLine), myIndices, theirIndices);

        //TODO: find quarters & others in loop.

        //find the midpoints & quarter points & eight points
        const numberOfMidpointsEach : number = 2; // divide line into 8ths

        let myLineSegment : THREE.Line3 = myLine;
        let otherLineSegment : THREE.Line3 = otherLine;

        whereIntersect = this.doLinesIntersectAtMidpoint( myLine, otherLine, myIndices, theirIndices, whereIntersect, 2 );
        whereIntersect = this.doLinesIntersectAtMidpoint( otherLine, myLine, myIndices, theirIndices, whereIntersect, 2 );   

        whereIntersect.isTouching = whereIntersect.dist <= whatIsEnough;

        //TODO create a whereTouch factory I guess. also pinpoint actually where and not just the skeletion key
        // let whereTouch : WhereTouch = new WhereTouch(); 
        // whereTouch.isTouching = dist <= whatIsEnough;
        // whereTouch.keypointIndices.push(this.index1);
        // whereTouch.keypointIndices.push(this.index2);
        // whereTouch.xyValsPerIndices.push( this.keypoints[0].position); 

        return whereIntersect;
    }

    intersects(limb: LimbIntersect, w: number, h: number): WhereTouch {
        this.w = w;
        this.h = h;
        let myLine = this.scaleLine(this.line(), this.flip);
        let otherLine = this.scaleLine(limb.line(), !this.flip);
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
    geometry: THREE.BufferGeometry;
    line: THREE.Line;
    material: THREE.Material;
    name: string;
    meshMaterial: THREE.MeshBasicMaterial;
    // shape : THREE.ShapeBufferGeometry;
    flip: boolean = false;
    w: number;
    h: number;

    drawSkeleton : DrawSkeletonIntersectLine;

    setFlipSelf(flip: boolean) {
        this.flip = flip;
        for (let i = 0; i < this.limbs.length; i++) {
            this.limbs[i].setFlipSelf(flip);
        }
    }

    constructor(w: number, h: number, name: string, material: THREE.Material, confidence: number) {
        super(confidence);
        this.name = name;
        this.limbs = [];
        this.geometry = new THREE.BufferGeometry();
        this.material = material;
        this.line = new THREE.Line(this.geometry, this.material);
        this.meshMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
        this.w = w;
        this.h = h;
        this.drawSkeleton = new DrawSkeletonIntersectLine(confidence, ""); 

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
        this.line.geometry.setFromPoints(this.getVectors());

        this.drawSkeleton.update(this.limbs);
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

    getLine(): THREE.Line {
        return this.line;
    }

    getVectors() {
        return this.getVectorsFromLimbs(this.limbs);
    }

    intersects(bodypart: BodyPartIntersect, w: number, h: number): WhereTouch {
        let whereTouch = new WhereTouch();
        let otherLimbs = bodypart.getLimbs();
        for (let i = 0; i < this.limbs.length; i++) {
            for (let j = 0; j < otherLimbs.length; j++) {
                if (this.limbs[i].getScore() > this.minConfidence)
                    whereTouch.ifDistIsLessReplace(this.limbs[i].intersects(otherLimbs[j], w, h), this.limbs[i].getIndices(), otherLimbs[j].getIndices());
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
        this.line.geometry.setFromPoints(this.getVectors());

        (this.drawSkeleton as DrawHead).updateHead(headCenter, noseToEarDistance);

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


    constructor(participant_: Participant, minConfidence: number = 0.3, w: number = 1, h: number = 1) {
        this.participant = participant_;

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
    }

    getLines(): THREE.Line[] {
        let lines: THREE.Line[] = [];
        for (let i = 0; i < this.parts.length; i++) {
            lines.push(this.parts[i].getLine());
        }
        return lines;
    }

    setFriend(friend: SkeletionIntersection) {
        this.friendSkeleton = friend;

    }

    update() {
        let keypoints1 = this.participant.getAvgKeyPoints();
        let limbs : LimbIntersect[] = []; 
        for (let i = 0; i < this.parts.length; i++) {
            this.parts[i].update(keypoints1);
            // limbs.push(...this.parts[i].getLimbs());
            // console.log( this.parts[i] ); 
        }
        // this.drawSkeleton.update(limbs);
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


    touching(w: number, h: number): WhereTouch {

        // (window as any).headIntersect = this.head.getPositions(); 

        let touch: WhereTouch = new WhereTouch();

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