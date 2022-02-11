import { CircularBuffer } from './circularBuffer';
import { AveragingFilter, Derivative } from './averagingFilterV2';
import * as PoseIndex from './poseConstants.js';
import { Xcorr } from './abr-xcorr/xcorr.js';
// import * as GetMethods from './getMethods.js';
import * as math from 'mathjs';
import type { Keypoint } from '@tensorflow-models/posenet';
import { AverageFilteredKeyPoints } from './averagedKeypoints';
import * as PoseMatch from './poseMatching';
import * as Scale from './scale'
import { SkeletionIntersection } from './skeletonIntersection'
import { SkeletonTouch } from './SkeletonTouch'

import { FPSTracker } from './fpsMeasure' 
import { AppendFunction, deferredFile } from './fileApis';
import { recordBodyPartsJerkRaw, recordKeypoints } from './persistedFlags';
import { appStartTimestamp } from './appStartTimestamp';
import { EventEmitter } from "eventemitter3"; //note Brent added this -- it emits events that's all I know.
import { VerticalityAngle, VerticalityCorrelation  } from './Verticality'; 


// import { Buffer } from "buffer";

/* TODO:

1. Different ways of combining x & y values? 2d Xcorr? 8/12/2020-- note: tried fisher's z to combine them buuut THAT sucked. simple avg. better #$%^&*
2. Different ways of combining max & lag.

*/

export function orderParticipantID(id1: string, id2: string) {
    return id1 > id2 ? -1 : 0
}


// make a filename based on the participant -- Brent code
const fileNameBase = (p: Participant, fileName: string) => (
    `${appStartTimestamp}_${p.participantID}_${fileName}`
);

//Brent code
export interface RecordedKeypoint {
    timestamp: number;
    keypoints: Keypoint[];
} 

export enum ParticipantEvents {
    KeypointsAdded = "KeypointsAdded",
    SetSize = "SetSize"
}

///end Brent

export class Participant extends EventEmitter {

    //unique id of participant -- now the same as the peerID -- perhaps unique Id will be 
    //this + number in vector
    participantID: string = "";

    //we will change this to an array
    friendParticipant: any; //starting this process, but it is not complete

    updateNow : number = 0; 

    windowSize: number;
    keyPointBuffer: CircularBuffer<any>;
    endIndex: number;
    beginIndex: number;

    fpsTracker : FPSTracker;

    //for adding data to files
    appendKeypoints: AppendFunction;
    appendXCorrTest: AppendFunction;

    width: number;
    height: number;

    //this is pose-matching not cross-correlation 
    matchScore: number = 0;

    //note: this is probably going to turn into a processing tree. hahahahahahaha - or NOT mess follows.
    xcorrMax: AveragingFilter[];
    xcorrTouchingMax: AveragingFilter;
    iMax: AveragingFilter[];
    poseAngles: AveragingFilter[];

    //this is for the dx of the pose body angles
    xcorrMaxDerivative1: AveragingFilter[];
    iMaxDerivative1: AveragingFilter[];

    //this is for the normalized positions
    xcorrMaxPos: AveragingFilter[];
    xcorrMaxPosY: AveragingFilter[];

    xcorriMaxPos: AveragingFilter[];

    //this is for the positions
    // xcorrMaxPositions: AveragingFilter[];
    // iMaxPositions: AveragingFilter[];  

    xcorrMaxPositionDX: AveragingFilter[];
    iMaxPositionsDX: AveragingFilter[];
    xcorrMaxPositionDY: AveragingFilter[];
    iMaxPositionsDY: AveragingFilter[];
    xcorrAvg: AveragingFilter[];


    //not using this anymore I think. need to bah-lete
    poseAnglesDx: Derivative[];

    //keep track of overall max and min -- will depreciate these since adding recording system and better data analysis
    derivativexCorrMaxMAX: number;
    derivativexCorrMaxMIN: number;
    derivativexCorriMaxMAX: number;
    derivativexCorriMaxMIN: number;

    //keep track of overall max and min -- will depreciate these since adding recording system and better data analysis
    dxCorrMaxMAX: number;
    dxCorrMaxMIN: number;
    dxCorriMaxMAX: number;
    dxCorriMaxMIN: number;

    poseSampleRate: number;

    avgKeyPoints: AverageFilteredKeyPoints;

    //overall confidence score for posenet / mediapipe. need to refactor and streamline this
    minConfidenceScore: number = 0.3;

    keyPointsBufferSize: number = 2; //changed 12/26/2020

    avgMinBodyPartXCorr: number = 100;
    avgMaxBodyPartXCorr: number = -100;

    maxVar: number[] = []; //the max variance we have encountered for each body part
    maxJerk : number[] = []; //the max jerk we have encountered for each body part
    bodyPartsJerkMax : number[]; //this are legacy values of jerk maxes that need to get updated with testing/recording
    maxXCorrSkeleton: AveragingFilter;
    maxVarAvg: AveragingFilter;
    winVarScaleMax : number = 1;

    touch: SkeletonTouch = new SkeletonTouch();
    intersection: SkeletionIntersection;

    verticalAngle : VerticalityAngle; 
    verticalityCorrelation : VerticalityCorrelation | null = null; 

    constructor() {
        super(); 

        this.windowSize = 16; //should test different window sizes.

        this.keyPointBuffer = new CircularBuffer(this.windowSize);

        this.beginIndex = PoseIndex.noseToShoulders;
        this.endIndex = PoseIndex.rightKneeHipAnkle;

        this.width = 0;
        this.height = 0;

        this.xcorrMax = []; //the max correlation value 0-1
        this.iMax = []; //index of max, or how many indices lag btw signals
        this.poseAngles = [];         //buffers of pose angles
        this.xcorrMaxDerivative1 = [];
        this.iMaxDerivative1 = [];
        this.poseAnglesDx = [];


        // this.xcorrMaxPositions = [];
        // this.iMaxPositions = [];

        this.xcorrMaxPositionDX = [];
        this.iMaxPositionsDX = [];
        this.xcorrMaxPositionDY = [];
        this.iMaxPositionsDY = [];
        this.xcorrAvg = [];

        this.derivativexCorrMaxMAX = 0;
        this.derivativexCorrMaxMIN = 1;
        this.derivativexCorriMaxMAX = 0;
        this.derivativexCorriMaxMIN = 1;

        this.dxCorrMaxMAX = 0;
        this.dxCorrMaxMIN = 1;
        this.dxCorriMaxMAX = 0;
        this.dxCorriMaxMIN = 1;

        this.bodyPartsJerkMax = [175, 175, 35, 35, 35, 35];
        for(let i=0; i<PoseIndex.bodyPartArray.length; i++)
        {
            this.maxVar.push(0);
            this.maxJerk.push(0);
        }

        //not really using this.
        this.poseSampleRate = 16; //default rate from testing on my machine. mas o menos ahahah need to fix this


        this.avgKeyPoints = new AverageFilteredKeyPoints();
        this.verticalAngle = new VerticalityAngle(this.avgKeyPoints, this.minConfidenceScore); 

    

        this.fpsTracker = new FPSTracker();

        this.appendKeypoints = deferredFile((append) => {
            if (recordKeypoints.get() && this.participantID && this.width !== 0) {
                append(JSON.stringify({ width: this.width, height: this.height }));
                return fileNameBase(this, "keypoints.csv");
            }
        });

        this.appendXCorrTest = deferredFile(() => {
            if (recordBodyPartsJerkRaw.get() && this.participantID) {
                return fileNameBase(this, "xCorrTest.csv");
            }
        });

        this.maxVar = [];
        this.maxXCorrSkeleton = new AveragingFilter();
        this.maxVarAvg = new AveragingFilter();
        this.xcorrTouchingMax = new AveragingFilter();

        for (let i = 0; i < PoseIndex.bodyPartArray.length; i++) {
            this.maxVar.push(0);
        }

        for (let i = this.beginIndex; i <= this.endIndex; i++) {
            this.xcorrMax.push(new AveragingFilter());
            this.iMax.push(new AveragingFilter());
            this.poseAngles.push(new AveragingFilter());

            this.xcorrMaxDerivative1.push(new AveragingFilter());
            this.iMaxDerivative1.push(new AveragingFilter());




            this.poseAnglesDx.push(new Derivative());
        }

        this.xcorrMaxPos = [];
        this.xcorrMaxPosY = [];
        this.xcorriMaxPos = [];
        for (let i = 0; i < PoseIndex.posePointCount; i++) {
            // this.xcorrMaxPositions.push(new AveragingFilter()); 
            // this.iMaxPositions.push(new AveragingFilter()); 

            this.xcorrMaxPositionDX.push( new AveragingFilter(2, 2) ); 
            this.iMaxPositionsDX.push( new AveragingFilter(2, 2) ); 
            this.xcorrMaxPositionDY.push( new AveragingFilter(2, 2) ); 
            this.iMaxPositionsDY.push( new AveragingFilter(2, 2) ); 
            this.xcorrAvg.push( new AveragingFilter(4, 2) ); 

            //for the positions
            this.xcorrMaxPos.push(new AveragingFilter());
            this.xcorrMaxPosY.push(new AveragingFilter());

            this.xcorriMaxPos.push(new AveragingFilter());
        }

        //again this is depreciated. when I have time (lol, never, I want to delete this shit)
        this.setPoseSamplesRate(4); //ok just set to start with

        //this holds the info about intersections AND also draws the skeleton
        //a coupling that doesn't make sense now
        //but sense the skeleton was originally only drawn to test the intersection code
        //as a legacy makes sense but here we are.
        this.intersection = new SkeletionIntersection(this);
    }

    getVerticalAngle() : VerticalityAngle
    {
        return this.verticalAngle; 
    }    

    addFriendParticipant(p: Participant) {
        this.friendParticipant = p;
        this.intersection.setFriend(p.getSkeletonIntersection());
        this.verticalityCorrelation = new VerticalityCorrelation([ this.verticalAngle, p.getVerticalAngle() ]); 
    }

    getZeroConfidenceTime()
    {
        return this.avgKeyPoints.getZeroConfidenceTime(); 
    }

    resetZeroConfidenceTime()
    {
        this.avgKeyPoints.resetZeroConfidenceTime();
    }

    getSkeletonIntersection() {
        return this.intersection;
    }

    isFriendPartcipantNull() {
        return this.friendParticipant === null;
    }
    //where it is on the screen in relation to other videos.
    setParticipantID(id: string) {
        this.participantID = id;
    }

    /** can override in testing */
    now () {
        return performance.now();
    }

    getVerticalityCorrelation() : number
    {
        if(this.verticalityCorrelation)
            return this.verticalityCorrelation.getCorrelation(); 
        else return 0; 
    }

    getVerticalAngleMeasure() : number
    {
        if( this.verticalAngle )
        {
            return this.verticalAngle.getAngle(); 
        }
        else return 0; 
    }

    //update the keypoints from the pose and also update other shiz related to keypoints. 
    addKeypoint(keypoints: Keypoint[], hasFriend : boolean, offsetPos : THREE.Vector3, isLocalParticipant : boolean): void {

        let now : number = this.now(); //note: maybe want to do this in main.
        if( keypoints === null ) return; 
        this.updateNow = now; 

        //this records keypoints
        if (recordKeypoints.get()) {
            console.log("recording");
            this.appendKeypoints(JSON.stringify({
                timestamp: now,
                keypoints
            }));
        }

        this.keyPointBuffer.add(keypoints);
        this.avgKeyPoints.update(keypoints, now);
        this.updateTouchingFriend(offsetPos, hasFriend, isLocalParticipant);
        this.verticalAngle.update(); 
        this.fpsTracker.refreshLoop(); 
        this.emit(ParticipantEvents.KeypointsAdded, this.participantID, keypoints);
        if( hasFriend && isLocalParticipant )
        {
            this.updatePoseSimilarity(this.friendParticipant);
            this.verticalityCorrelation?.update(); 
        }

        let filename = "xCorrTest.csv";
        
        if (recordBodyPartsJerkRaw.get()) {
            this.appendXCorrTest([
                this.now(), this.avgKeyPoints.getEyeDistance(),
                ...this.avgKeyPoints.getDXArray(),
                ...this.avgKeyPoints.getDYArray(),
                ...this.avgKeyPoints.getAccelXArray(),
                ...this.avgKeyPoints.getAccelYArray(), 
                ...this.avgKeyPoints.getJerkXArray(),
                ...this.avgKeyPoints.getJerkYArray(), 
                // ...this.getXcorrMaxPositionDXArray(),
                // ...this.getXcorrMaxPositionDXArray()                
            ].join(','));
        }
    }

    //Feb '22 -- get the max dx.
    getMaxTouchingDx() : number
    {
        if( !this.touch.touching )
        {
            return 0; 
        }
        else
        {
            let maxDx : number = 0; 

            //TODO -- traverse these keypoints, find the max dx and send to Max 8
            let pts : number[] = this.intersection.getTouchingKeypoints(); 
            for( let i=0; i<pts.length; i++ )
            {
                let dist = Math.sqrt(this.avgKeyPoints.getTopDx(pts[i])*this.avgKeyPoints.getTopDx(pts[i]) + this.avgKeyPoints.getTopDy(pts[i])*this.avgKeyPoints.getTopDy(pts[i]) );
                maxDx = Math.max(dist, maxDx)  ; 
            }

            pts = this.friendParticipant.intersection.getTouchingKeypoints(); 
            for( let i=0; i<pts.length; i++ )
            {
                let dist = Math.sqrt(this.avgKeyPoints.getTopDx(pts[i])*this.avgKeyPoints.getTopDx(pts[i]) + this.avgKeyPoints.getTopDy(pts[i])*this.avgKeyPoints.getTopDy(pts[i]) );
                maxDx = Math.max(dist, maxDx)  ;             
            }
            return maxDx;
        }

    }

    //per second -- vary the window size with the samplerate
    //TODO: need to measure samplerate again & change all values accordingly. Also fix some hardcoded shit in the AveragingKeypoints whatever class
    setPoseSamplesRate(sps: number = 32): void {
        this.poseSampleRate = sps;

        // this.windowSize = this.nearestPowerOf2(sps); doesn't work. 4 now, quick & dirty

        //fix this shit later -- has to do with xcorr buffer size. 
        //basically, I was averaging to shit as was my custom when I had like 60fps all the time
        //but lol we are not getting 60 fps 
        if (sps / 2 >= 32) { this.windowSize = 32; }
        else if (sps / 2 >= 16) { this.windowSize = 16; }
        else if (sps / 2 >= 8) { this.windowSize = 8; }
        else { this.windowSize = 4; } //I want to set the minimum @ 16 I think since less than that is not enough. Maybe I double
        // else if(sps >= 8) this.windowSize=8;
        // else this.windowSize=4; 

        //not even using this.
        for (let i = 0; i <= 8; i++) {
            this.poseAngles[i].setWindowSize(12, this.windowSize);
            this.poseAnglesDx[i].setWindowSize(12, this.windowSize);
        }
        this.avgKeyPoints.setWindowSize(this.keyPointsBufferSize, this.windowSize);
        this.maxXCorrSkeleton.setWindowSize(this.windowSize);
        this.maxVarAvg.setWindowSize(this.windowSize / 2, 1);
    }

    updatePoseSimilarity(otherParticipant: any): void {
        if (otherParticipant.getCurKeyPoints() === undefined) {
            return;
        }
        this.matchScore = PoseMatch.poseSimilarity(this.getCurKeyPoints(), this.width, this.height, otherParticipant.getCurKeyPoints(), otherParticipant.getWidth(), otherParticipant.getHeight());
    }

    getMatchScore(): number {
        return this.matchScore;
    }

    //pretty sure this is wrong. don't use.
    nearestPowerOf2(n: number): number {
        let count = 0;
        n = math.round(n);

        // First n in the below condition  
        // is for the case where n is 0  
        if (n && !(n & (n - 1)))
            return n;

        while (n != 0 || count < 5) {
            n >>= 1;
            count += 1;
        }

        return 1 << count;
    }

    getLastKeypoints(): any {
        return this.keyPointBuffer.top();
    }


    getAvgKeyPoints(): any {
        return this.avgKeyPoints.top();
    }

    getKeyPointBuffer() {
        return this.keyPointBuffer.getContents();
    }

    keyPointLength(): number {
        return this.keyPointBuffer.length();
    }

    /*
        cross-correlation is a measure for similarity between signals
        const sig = Buffer.from([0, 1, 0, 0]); // two 16-bit samples
        Xcorr(sig, sig) === {
        xcorr: [1, 0], // raw cross-correlation profile
        xcorrMax: 1,   // max cross-correlation
        iMax: 0,       // index in first buffer at which cross-correlation is maxed --basically the lag btw signals, in indices.
    }   
    */
    getCurAngles(): AveragingFilter[] {
        return this.poseAngles;
    }

    getCurAnglesDx(): Derivative[] {
        return this.poseAnglesDx;
    }

    convertToUint16(array: number[]): number[] {
        // console.log("array:",array);

        let divisor: number = Math.PI * 2.0;
        for (let i = 0; i < array.length; i++) {
            array[i] = array[i] / divisor;
            array[i] = array[i] * 16.0;
            // array_2[i] = math.round(array_2[i]);
        }

        // console.log("array_2:",array_2);

        return array;
    }

    setWinVarScaleMax(m:number) : void
    {
        this.winVarScaleMax = m; 
    }

    getCurDX(): Derivative[] {
        return this.avgKeyPoints.getDXBuffer();
    }

    getCurDY(): Derivative[] {
        return this.avgKeyPoints.getDYBuffer();
    }

    getAvgCurDXTop(index): number {
        return this.getCurDX()[index].top();
    }

    setMinThreshForDX(thresh: number): void {
        this.avgKeyPoints.setMinThreshForDx(thresh);
    }

    getCurAvgKeyPoints(): AverageFilteredKeyPoints {
        return this.avgKeyPoints;
    }

    fishersZ(num: number): number {
        return 0.5 * Math.log((1 + num) / (1 - num));
    }

    fishersZinverse(num: number): number {
        return (Math.exp(2 * num) - 1) / (Math.exp(2 * num) + 1);
    }

    //also uses rms
    collapseMultiVariateCrossCorrelationUsingFishersZ(xcorr: number, ycorr: number): number {
        let zSum: number = 0;
        let rmsZ: number;

        //convert to fisher's z then square and sum
        zSum = this.fishersZ(xcorr) ** 2 + this.fishersZ(ycorr) ** 2;

        //complete the rms
        rmsZ = Math.sqrt(zSum);

        //convert back.
        return this.fishersZinverse(rmsZ);
    }

    getWidth() {
        return this.width;
    }

    setSize(w, h) {
        this.width = w;
        this.height = h;
        this.avgKeyPoints.setSize(w, h);
        this.intersection.setSize(w, h);
        if (recordKeypoints.get()) {
            this.appendKeypoints(JSON.stringify({ width: w, height: h }));
        }
        this.emit(ParticipantEvents.SetSize, this.participantID, { width: w, height: h });

    }

    getHeight() {
        return this.height;
    }

    getXCorrPos(index: number) {

        return this.xcorrMaxPos[index].top() * 0.5 + this.xcorrMaxPosY[index].top() * 0.5;
    }

    getXCorrLength() {
        return this.xcorrMaxPos[0].length();
    }

    //this returns the average confidence score of a keypoints, given index (which position in the skeleton)
    getAvgScore(index) {
        return this.avgKeyPoints.getAvgScore(index);
    }

    getWindowSize(): number {
        return this.windowSize;
    }
    //this finds the cross-correlation btw velocities (rate of change of the positions)
    //a problem with this measure is that it is very sensitive to movement (obv) and no movement == no correlation.
    //thus, even if moving back and forth, it will give the most correlation at the highest velocities
    //this creates measures which when participants oscillate, when they change direction, it becomes silent
    //so, this could be useful/interesting as ONE measure to be sonified even tho in some ways it is a poor measure of synchronicity because
    //obv. it is not divorced from velocity
    xCorrDistance(otherParticipant: Participant): void {

        this.minConfidenceScore = 0.35;

        let otherX: Derivative[] = otherParticipant.getCurDX();
        let meX: Derivative[] = this.getCurDX();

        let otherY: Derivative[] = otherParticipant.getCurDY();
        let meY: Derivative[] = this.getCurDY();

        let otherArrayX: number[][] = [];
        let myArrayX: number[][] = [];

        let otherArrayY: number[][] = [];
        let myArrayY: number[][] = [];

        let sz = math.min(otherX[0].length(), meX[0].length()); //take the lowest sampling rate as the window for comparison
        //log sz here

        if (sz < this.windowSize) return; //TODO: probably send window size from the other participant... maybe
        sz = this.windowSize;

        for (let i = 0; i < PoseIndex.posePointCount; i++) {

            otherArrayX.push(otherX[i].getOutputContents(sz));
            myArrayX.push(meX[i].getOutputContents(sz));

            otherArrayY.push(otherY[i].getOutputContents(sz));
            myArrayY.push(meY[i].getOutputContents(sz));
        }

        for (let i: number = 0; i < this.xcorrMaxPositionDX.length; i++) {

            if (!(myArrayX[i].length < this.windowSize || otherArrayX[i].length < this.windowSize ||
                myArrayY[i].length < this.windowSize || otherArrayY[i].length < this.windowSize)) {
                const sig1X = Buffer.from(myArrayX[i]);
                const sig2X = Buffer.from(otherArrayX[i]);

                const sig1Y = Buffer.from(myArrayY[i]);
                const sig2Y = Buffer.from(otherArrayY[i]);

                if (this.getAvgScore(i) >= this.minConfidenceScore && otherParticipant.getAvgScore(i) >= this.minConfidenceScore
                    && sig1X.length == sig2X.length && sig1Y.length == sig2Y.length) {

                    let xcorr_outX = Xcorr(sig1X, sig2X);
                    let xcorr_outY = Xcorr(sig1Y, sig2Y);


                    if (!isNaN(xcorr_outX.xcorrMax)) {
                        this.xcorrMaxPositionDX[i].update(xcorr_outX.xcorrMax);
                    }
                    else {
                        this.xcorrMaxPositionDX[i].update(0.0);
                    }

                    if (!isNaN(xcorr_outY.xcorrMax)) {
                        this.xcorrMaxPositionDY[i].update(xcorr_outY.xcorrMax);
                    }
                    else {
                        this.xcorrMaxPositionDY[i].update(0.0);
                    }
                }
                else {
                    this.xcorrMaxPositionDY[i].update(-1);
                    this.xcorrMaxPositionDX[i].update(-1);

                    this.iMaxPositionsDX[i].update(0);
                    this.iMaxPositionsDY[i].update(0);
                }
            }
        }
    }


    //this returns the cross-correlation between this participant and some friend participant for each keypose. Only have dyadic interactions now.
    //using the dx & dy of the points currently & this works much better than the body angles.
    getDistXCorrMax(i: number): number {
        //this version finds the average btw measures -- //to DO -- perhaps body angles could be a good addition to this, while not great as a primary measure
        return this.xcorrMaxPositionDX[i].top() * 0.5 + this.xcorrMaxPositionDY[i].top() * 0.5

        //this version uses fisher's z to collapse the correlations into one -- not sure how it works w/cross-correlation but WE SEE. //result -- NOPE, but could try with higher order data.
        // return this.collapseMultiVariateCrossCorrelationUsingFishersZ(this.xcorrMaxPositionDX[i].top(), this.xcorrMaxPositionDY[i].top())
    }

    getDistXCorrMaxLength() {
        return this.xcorrMaxPositionDX[0].length();
    }

    //this returns the cross-correlation _lags_ between this participant and some friend participant for each keypose. Only have dyadic interactions now.
    //using the dx & dy of the points currently & this works much better than the body angles.
    //additionally as 0 = no lags, and anything else is just which is ahead or behind, for this measure, abs. is applied. & 0 is highest synch
    getDistXCorriMaxAbs(i: number): number {
        //this version finds the average btw measures -- //to DO -- perhaps body angles could be a good addition to this, while not great as a primary measure
        return this.xcorrMaxPositionDX[i].top() * 0.5 + this.xcorrMaxPositionDY[i].top() * 0.5

        //this version uses fisher's z to collapse the correlations into one -- not sure how it works w/cross-correlation but WE SEE. //result -- NOPE, but could try with higher order data.
        // return this.collapseMultiVariateCrossCorrelationUsingFishersZ(this.xcorrMaxPositionDX[i].top(), this.xcorrMaxPositionDY[i].top())
    }

    getCurrXCorrMaxDx(index: number): number {
        return this.xcorrMaxDerivative1[index].top();
    }

    getCurriMaxDx(index: number): number {
        return this.iMaxDerivative1[index].top();
    }

    getCurrXCorrMax(index: number): number {
        return this.xcorrMax[index].getNext();
    }

    getCurriMax(index: number): number {
        return this.iMax[index].getNext();
    }

    getCurrXCorrMaxAvg(): number {

        let sum: number = 0;
        for (let i: number = 0; i < this.xcorrMax.length; i++) {
            sum = sum + this.xcorrMax[i].getNext();
            // console.log(this.xcorrMax[i].getAvg());
        }
        // console.log(this.xcorrMax);
        // console.log(this.xcorrMax.length);
        return sum / this.xcorrMax.length;
    }

    getCurKeyPoints(): number {
        return this.keyPointBuffer.top();
    }

    getKeyPointLength() {
        return this.keyPointBuffer.length();
    }
    //so this will return the highest value PER body part MOVING -- instead of avg. across the body.

    //this also updates the buffers & returns the average. gah kind of messy need to refactor. 
    getHighestAvgXCorrAcrossBodyParts(minConfidence: number = 0.35): number {
        //perhaps use a mix of total body & partial. I felt like when my whole body was moving, I wanted it to do more still, 
        //than if it was just one body part

        let bodyParts: number[] = [];
        bodyParts.push(this.getTorsoXCorrSynchronicity(minConfidence));
        bodyParts.push(this.getHeadXCorrSynchronicity(minConfidence));
        bodyParts.push(this.getLeftArmXCorrSynchronicity(minConfidence));
        bodyParts.push(this.getRightArmXCorrSynchronicity(minConfidence));
        bodyParts.push(this.getLeftLegXCorrSynchronicity(minConfidence));
        bodyParts.push(this.getRightLegXCorrSynchronicity(minConfidence));

        let maxXCorr: number = -100;

        for (let i = 0; i < bodyParts.length; i++) {
            if (bodyParts[i] > maxXCorr)
                maxXCorr = bodyParts[i];
        }
        // console.log(bodyParts); 

        //    if(maxXCorr < this.avgMinBodyPartXCorr) this.avgMinBodyPartXCorr=maxXCorr;
        //    if(maxXCorr > this.avgMaxBodyPartXCorr) this.avgMaxBodyPartXCorr = maxXCorr;

        //     console.log("Min: " + this.avgMinBodyPartXCorr + " Max: " + this.avgMaxBodyPartXCorr );

        //just another fast scale
        maxXCorr = Scale.linear_scale(maxXCorr, 0.25, 1, 0, 1);
        this.maxXCorrSkeleton.update(maxXCorr);

        return this.maxXCorrSkeleton.top();
    }

    scaleXcorr(xcorrIn): number {
        let xCorrMin = -1;
        let xCorrMax = 0.5;

        return Scale.exp_scale(xcorrIn, xCorrMin, xCorrMax, 0, 1);
    }

    getAverageBodyPartXCorrVelocitySynchronicity(bodyPartIndices: number[], minConfidence: number = 0.3): number {
        let sum: number = 0;
        let count: number = 0;
        for (let i = 0; i < bodyPartIndices.length; i++) {
            if (this.getAvgScore(i) >= minConfidence && this.friendParticipant.getAvgScore(i) >= minConfidence) {
                sum += this.scaleXcorr(this.getDistXCorrMax(bodyPartIndices[i]));
                count++;
            }
        }
        if (count == 0) return 0;
        else return sum / count;
    }

    getTorsoXCorrSynchronicity(minConfidence: number): number {

        return this.getAverageBodyPartXCorrVelocitySynchronicity(PoseIndex.torso, minConfidence);
    }

    getHeadXCorrSynchronicity(minConfidence: number): number {
        return this.getAverageBodyPartXCorrVelocitySynchronicity(PoseIndex.head, minConfidence);
    }

    getLeftArmXCorrSynchronicity(minConfidence: number): number {
        return this.getAverageBodyPartXCorrVelocitySynchronicity(PoseIndex.leftArm, minConfidence);
    }

    getRightArmXCorrSynchronicity(minConfidence: number): number {
        return this.getAverageBodyPartXCorrVelocitySynchronicity(PoseIndex.rightArm, minConfidence);
    }

    getLeftLegXCorrSynchronicity(minConfidence: number): number {
        return this.getAverageBodyPartXCorrVelocitySynchronicity(PoseIndex.leftLeg, minConfidence);
    }

    getRightLegXCorrSynchronicity(minConfidence: number): number {
        return this.getAverageBodyPartXCorrVelocitySynchronicity(PoseIndex.rightLeg, minConfidence);
    }

    getPoseMaxDX() {
        return this.avgKeyPoints.getMaxDx();
    }

    getPoseMaxDY() {
        return this.avgKeyPoints.getMaxDy();
    }

    getParticipantID(): string {
        return this.participantID;
    }

    isParticipant(id: string): boolean {
        return this.participantID === id;
    }

    getAverageBodyPartDXFromIndex( index: number, winVarMax: number = this.winVarScaleMax, minConfidence : number = 0.45 ) : {avg: number, count: number}
    {
        let winvar = this.getAverageBodyPartDx( PoseIndex.bodyPartArray[index], minConfidence );
        return winvar
    }

    //note, perhaps this should be a mix of the actual avg. of skeleton vs. some bodypart avg.
    getAverageBodyPartDx( bodyPartIndices: number[], minConfidence : number = 0.45 ) : {avg: number, count: number}
    {
        let sum : number = 0; 
        let count : number = 0;
        for(let i = 0 ; i<bodyPartIndices.length; i++)
        {
            if( this.getAvgScore(bodyPartIndices[i]) >= minConfidence )
                {
                    sum += this.avgKeyPoints.getDxyAvg2(bodyPartIndices[i]); 
                    count++; 
                }
        } 
        if(count == 0) return {avg: 0, count: 0}; 
        else {
            let v =  sum/count;
            if( isNaN(v)) v = 0;
            return {avg: v, count: count}; 
        } 
    }

    //NOTE -- this measure should grow when more body parts approach max.
    //TODO -- do that!
    getMaxBodyPartDx(minConfidence : number = 0.45, winVarMax : number = this.winVarScaleMax )
    {
        let maxWindowedVar : number = 0;
        let thresh : number = 0.55;
        let keypointsVisibleCount: number = 0;

        let partsOverThresh: number = 0;
        let highDxThresh : number = 0.7;

        for(let i=0; i<PoseIndex.bodyPartArray.length; i++)
        {
            let curDx = this.getAverageBodyPartDXFromIndex(i, this.winVarScaleMax, minConfidence ).avg;
            maxWindowedVar= Math.max(curDx, maxWindowedVar); 
            if(curDx > highDxThresh)
            {
                partsOverThresh++; 
            }
        }

        let finalAvg = 0; 
        if( partsOverThresh >= 4)
        {
            finalAvg =  Math.max(maxWindowedVar, 0.95); 
        }
        else
        {
            finalAvg = maxWindowedVar;
        }

        // let finalAvg = maxWindowedVar;

        //update a running average to calm that down dude
        this.maxVarAvg.update( finalAvg ) ; 

        return maxWindowedVar; //this.maxVarAvg.top();//this.maxVarAvg.top(); //already scaled 0 to 1
    }

    getAvgXCorrBodyParts(minConfidence : number = 0.65) : number[]
    {
        //perhaps use a mix of total body & partial. I felt like when my whole body was moving, I wanted it to do more still, 
        //than if it was just one body part

        // following `poseConstants#bodyPartArray`'s order
        let bodyParts: number[] = [
            this.getHeadXCorrSynchronicity(minConfidence),
            this.getTorsoXCorrSynchronicity(minConfidence),
            this.getLeftArmXCorrSynchronicity(minConfidence),
            this.getRightArmXCorrSynchronicity(minConfidence),
            this.getLeftLegXCorrSynchronicity(minConfidence),
            this.getRightLegXCorrSynchronicity(minConfidence)
        ];

        let maxXCorr : number = -100; 

        //return an averaged
        let parts : number[] = [];
        for(let i=0; i<this.xcorrAvg.length; i++)
        {
            let part = bodyParts[i];
            if(!isNaN(part))
            {
                this.xcorrAvg[i].update(bodyParts[i]);
            }
            parts.push( this.xcorrAvg[i].getNext() ); 
        }

        return bodyParts; // bodyParts; 
    }
    
    //TODO: update everything in one method & just have that as the outside thingy!
    updateTouchingFriend(offsets : THREE.Vector3, hasFriend : boolean, isLocalParticipant : boolean): void {
        this.intersection.update(offsets); 

        if (this.friendParticipant && hasFriend ) {
            //TODO: refactor so I only do this once.
            let iAmSecond = orderParticipantID(this.participantID, this.friendParticipant.getParticipantID()) === -1;

            if( isLocalParticipant )
            {
                this.touch = this.touching(this.touch, iAmSecond); 
                this.touch.updateTouching();
                this.xcorrTouchingMax.update( this.getAvgXCorrAtTouchingKeypoints()  );
            }
        }
    }

    getTouchingXCorr() : number
    {
        return this.scaleXcorr(this.xcorrTouchingMax.top()); 
    }

    getTouch() : SkeletonTouch
    {
        return this.touch; 
    }

    areTouching(): boolean {
        return this.touch.areTouching();
    }

    justStartedTouching(): boolean {
        return this.touch.justStartedTouching();
    }

    justStoppedTouching(): boolean {
        return this.touch.justStoppedTouching();
    }

    howLongTouching(): number {
        return this.touch.howLong();
    }

    howLongTouchingScaled(): number {
        return this.touch.howLongScaled();
    }

    howMuchTouching(): number {
        return this.touch.howMuchTouching();
    }

    getTouchPosition(): { x: number, y: number } {
        return this.touch.getTouchPosition();
    }

    getTouchingKeypointsIndices(): Array<Array<number>> {
        return this.touch.getTouchingKeypoints();
    }

    //ya baby.
    getAvgXCorrAtTouchingKeypoints(): number {

        if( !this.areTouching() || !this.friendParticipant  )
        {
            return 0; 
        }

        let xcorrAvg: number = 0;
        let keypointIndex = this.touch.getTouchingKeypoints();

        //TODO: test ALL keypoints against each other 
        //skeleton intersection tests limbs not keypoints  & don't know which is closer at the moment
        let count = 0;
        let sum = 0;  
        for( let i=0; i<keypointIndex.length; i++ )
        {
            let indexPair = keypointIndex[i]; 
            sum += this.xCorrWithDifferentKeypoints( indexPair[0], indexPair[1], this.minConfidenceScore );
            count++;
        }
        if( count <= 0 )
        {
            return 0;
        }
        else
        {
            return sum/count; 
        }
    }

    getTouchVelocity()
    {
        return this.touch.getTouchVelocity(); 
    }

    //moved from avg keypoints... prob need to refactor this shit.
    //TODO: how much of the body & also for how long (scale?)
    //Then -- how fast before the touch? prob just windowedvar @ touch 
    //Then refine the touch measure so is less crude -- ie now it is just distance btw. keypoints but prob need to look at distance from skeleton/connecting line
    touching(sTouch: SkeletonTouch, iAmSecond: boolean = false): SkeletonTouch {
        //TODO: this does not return where the touch was. could do that.
        this.intersection.setShouldFlipSelf(iAmSecond)
        let whereTouch = this.intersection.touching(this.width, this.height);
        sTouch.removeAllTouches();
        if (whereTouch.isTouching) {
            sTouch.addWhereTouch(whereTouch); //TODO -- get these values from the skeleton
            // console.log( whereTouch.toString() );
        }

        return sTouch;

    }

    //I PROMISE I will refactor this fucking BS. --> copied & pasted from xCorrDistance lol
    xCorrWithDifferentKeypoints(myIndex: number, theirIndex: number, minConfidence: number): number {

        try {

        let maxXCorrBtwMeAndFriend: number = 0;

        if (!this.friendParticipant) {
            return 0; //GET OUT!
        }

        let otherX: Derivative[] = this.friendParticipant.getCurDX();
        let meX: Derivative[] = this.getCurDX();

        let otherY: Derivative[] = this.friendParticipant.getCurDY();
        let meY: Derivative[] = this.getCurDY();

        let otherArrayX: number[][] = [];
        let myArrayX: number[][] = [];

        let otherArrayY: number[][] = [];
        let myArrayY: number[][] = [];

        let sz = math.min(otherX[0].length(), meX[0].length()); //take the lowest sampling rate as the window for comparison
        //log sz here

        if (sz < this.windowSize) return 0; //TODO: probably send window size from the other participant... maybe
        sz = this.windowSize;


        otherArrayX.push(otherX[theirIndex].getOutputContents(sz));
        myArrayX.push(meX[myIndex].getOutputContents(sz));

        otherArrayY.push(otherY[theirIndex].getOutputContents(sz));
        myArrayY.push(meY[myIndex].getOutputContents(sz));

        if (!(myArrayX[0].length < this.windowSize || otherArrayX[0].length < this.windowSize ||
            myArrayY[0].length < this.windowSize || otherArrayY[0].length < this.windowSize)) {


            const sig1X = Buffer.from(myArrayX[0]);
            const sig2X = Buffer.from(otherArrayX[0]);

            const sig1Y = Buffer.from(myArrayY[0]);
            const sig2Y = Buffer.from(otherArrayY[0]);

            if ((sig1X.length % 2 !== 0 || sig1X.length === 0) ||
            (sig2X.length % 2 !== 0 || sig2X.length === 0) ||
            (sig1Y.length % 2 !== 0 || sig1Y.length === 0) ||
            (sig2Y.length % 2 !== 0 || sig2Y.length === 0) )
            {
                return 0;
            }


            if (this.getAvgScore(myIndex) >= this.minConfidenceScore && this.friendParticipant.getAvgScore(theirIndex) >= minConfidence
                && sig1X.length == sig2X.length && sig1Y.length == sig2Y.length) {

                let xcorr_outX = Xcorr(sig1X, sig2X);
                let xcorr_outY = Xcorr(sig1Y, sig2Y);

                if (!isNaN(xcorr_outX.xcorrMax)) {
                    maxXCorrBtwMeAndFriend += xcorr_outX.xcorrMax;


                    if (!isNaN(xcorr_outY.xcorrMax)) {
                        maxXCorrBtwMeAndFriend += xcorr_outY.xcorrMax;
                    }
                    maxXCorrBtwMeAndFriend /= 2;
                }
                else {
                    return 0;
                }
            }
            return maxXCorrBtwMeAndFriend;
        }
        else return 0;
        }
        catch(e)
        {
            console.log(e); 
            return 0; 
        } 
    }

    getAvgBodyPartsLocation(minConfidence : number = 0.45): {x:number, y: number}[]
    {
        let bodyPartsLocation : {x:number, y: number}[] = [];
        PoseIndex.bodyPartArray.forEach( (array) => {
            bodyPartsLocation.push(this.getAverageBodyPartLocation(array, minConfidence));
        });

        //If there is the nose, default to that instead of the average. -- ok I was a little sensible here.
        if(!isNaN(this.avgKeyPoints.getTopX(PoseIndex.nose)))
        {
            bodyPartsLocation[PoseIndex.nose].x = this.avgKeyPoints.getTopX(PoseIndex.nose) / this.width;
            bodyPartsLocation[PoseIndex.nose].y = this.avgKeyPoints.getTopY(PoseIndex.nose) / this.height;
        }

        return bodyPartsLocation;
    }

        //this really just assigns particular keypoints to get their locations for the bodyparts.
        getAverageBodyPartLocation( bodyPartIndices: number[], minConfidence : number = 0.45 ) : {x:number, y:number}
        {
            let sumx : number = 0; 
            let sumy : number = 0; 
    
            let count : number = 0;
    
            //return the wrist location if wrist exists & it is that other body part, else it essentially returns the elbow.
            if( ( bodyPartIndices[0] === PoseIndex.leftElbow || bodyPartIndices[0] === PoseIndex.rightElbow  ) && 
                (this.avgKeyPoints.getAvgScore(bodyPartIndices[1]) > minConfidence))
            {
                let res =  {x:this.avgKeyPoints.getTopAvgX(bodyPartIndices[1])/ this.width, y:this.avgKeyPoints.getTopAvgY(bodyPartIndices[1]) / this.height };
                // console.log(res);
                return res; 
            }
            else
            {
                //this is maniacally stupid omfg. I dont know why I would want avg. location. even for the head, the nose would do or how such a concept would be even slightly intuitive.
                //ToDo: make this not stupid. -- maybe for torso i want center of gravity, something like that & ya, just center - nose for head
                //for legs, the feet make sense but I don't think people will be using their legs much
                for(let i = 0 ; i<bodyPartIndices.length; i++)
                {
    
                    if( this.getAvgScore(bodyPartIndices[i]) >= minConfidence )
                    {
                        let x = this.avgKeyPoints.getTopX(bodyPartIndices[i]) / this.width;
                        let y = this.avgKeyPoints.getTopY(bodyPartIndices[i]) / this.height;
                        if( !isNaN(x) && !isNaN(y) )
                        { 
                            sumx += x; 
                            sumy += y; 
    
                            count++; 
                        }
                    }
                }
            } 
            //as it is an average, most things won't go to 0 or 1, so just expand the middle
            sumx = Scale.linear_scale( sumx, 0.1, 0.85, 0, 1 );
            sumy = Scale.linear_scale( sumy, 0.1, 0.85, 0, 1 );
    
            if(count === 0) return { x:0, y:0 }; 
            else {
                let v =  { x:sumx/count, y:sumy/count} ;
                return v; 
            } 
        }

        getAvgBodyPartsJerk(minConfidence : number = 0.3): number[]
        {
            let bodyPartsJerk : number[] = [];
            let bodyPartsJerkRaw : number[] = [];
    
            //still need to explore this.
            let bodyPartsJerkMin : number[] = [10, 10, 0, 0, 0, 0];
    
    
            let i = 0;
            PoseIndex.bodyPartArray.forEach( (array) => {
                bodyPartsJerk.push(this.getMaxBodyPartJerk(array, minConfidence));
                bodyPartsJerkRaw.push(this.getMaxBodyPartJerk(array, minConfidence));
                this.maxJerk[i] = Math.max( this.maxJerk[i], bodyPartsJerk[i]); 
                bodyPartsJerk[i] = Scale.linear_scale( bodyPartsJerk[i], 10, this.bodyPartsJerkMax[i], 0, 1 ); 
                i++;
            });
    
            return bodyPartsJerk;
        }

        getBodyPartConfidence(index : number, minConfidence:number = this.minConfidenceScore) : boolean
        {
            let bArray = PoseIndex.bodyPartArray[index]; 
            let aboveConfidenceThresh = false; 
            
            for(let i=0; i<bArray.length; i++)
            {
                aboveConfidenceThresh = aboveConfidenceThresh || bArray[i] >= minConfidence; 
            } 
            return aboveConfidenceThresh;
        }

        getAvgJerk() : number
        {
            let avgJerks : number[] = this.getAvgBodyPartsJerk(); 
            let avg : number = 0; 
            let count : number = 0;
            for( let i=0; i<avgJerks.length; i++ )
            {
                if( this.getBodyPartConfidence(i) )
                {
                    avg += avgJerks[i];
                    count++;
                }
            }
            return avg/count;
        }

        getAvgBodyPartAccel( bodyPartIndices : number[], accel:number[], minConfidence :number ) : number
        {
            let avg : number = 0; 
            let count : number = 0;
            for(let i=0; i<bodyPartIndices.length; i++)
            {
                let index = bodyPartIndices[i];
                if( this.avgKeyPoints.getAvgScore(index) > minConfidence )
                {
                    avg += accel[index]; 
                    count++; 
                }
            }
            if( count === 0 || isNaN(avg) ) return 0;
            else
            return avg / count; 
        }
    
        getAvgBodyPartsAccel(minConfidence : number = 0.3): number[]
        {
            let bodyPartsAccel : number[] = [];
            let bodyPartsAccelRaw : number[] = [];
    
            //still need to explore this.
            let bodyPartsAccelMin : number[] = [10, 10, 0, 0, 0, 0];
            let accel : number[] = this.avgKeyPoints.getMaxAccelXYArray(); 
    
    
            let i = 0;
            PoseIndex.bodyPartArray.forEach( (array) => {
                bodyPartsAccel.push(this.getAvgBodyPartAccel(array, accel, minConfidence));
                // bodyPartsAccelRaw.push(this.getMaxBodyPartJerk(array, minConfidence));
                bodyPartsAccel[i] = Scale.linear_scale( bodyPartsAccel[i], 10, this.bodyPartsJerkMax[i], 0, 1 ); 
                i++;
            });
    
            return bodyPartsAccel;
        }

    //note, perhaps this should be a mix of the actual avg. of skeleton vs. some bodypart avg.
    getMaxBodyPartJerk( bodyPartIndices: number[], minConfidence : number = 0.45 ) : number
    {
        let max : number = 0; 
        let count : number = 0;

        for(let i = 0 ; i<bodyPartIndices.length; i++)
        {
               if( this.getAvgScore(bodyPartIndices[i]) >= minConfidence )
               {
                    let x = this.avgKeyPoints.getJerkX(bodyPartIndices[i]) ;
                    let y = this.avgKeyPoints.getJerkY(bodyPartIndices[i]) ;
                    let jerk = x*0.5 + y*0.5;
                    if( !isNaN(jerk) )
                    { 
                        max = Math.max(max, x);
                        max = Math.max(max, y);

                        count++; 
                    }
                }
        } 
        //as it is an average, most things won't go to 0 or 1, so just expand the middle
        // sum = Scale.linear_scale( sum, 0.1, 0.85, 0, 1 );

        if(count === 0) return 0; 
        else {
            let v =  max;//sum / count ;
            return v; 
        } 
    }
};