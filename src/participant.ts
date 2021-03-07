
import { CircularBuffer } from './circularBuffer';
import { AveragingFilter, Derivative } from './averagingFilterV2';
import * as PoseAngle from './anglesFromKeypoints';
import * as PoseIndex from './poseConstants.js';
import * as XCorr from 'abr-xcorr';
import * as GetMethods from './getMethods.js';
import * as math from 'mathjs';
import type { Keypoint } from '@tensorflow-models/posenet';
import { AverageFilteredKeyPoints } from './averagedKeypoints';
import * as PoseMatch from './poseMatching';
import * as Scale from './scale'
import { SkeletionIntersection } from './skeletonIntersection'
import { SkeletonTouch } from './SkeletonTouch'
import type { AnyARecord } from 'dns';


/* TODO:

1. Different ways of combining x & y values? 2d Xcorr? 8/12/2020-- note: tried fisher's z to combine them buuut THAT sucked. simple avg. better #$%^&*
2. Different ways of combining max & lag.

*/

export function orderParticipantID(id1: string, id2: string) {
    return id1 > id2 ? -1 : 0
}

//TODO: refactor such that otherParticipant is a pointer...... YIKES

export class Participant {

    participantID: string = "";
    friendParticipant: any; //starting this process, but it is not complete

    windowSize: number;
    keyPointBuffer: CircularBuffer<any>;
    endIndex: number;
    beginIndex: number;

    width: number;
    height: number;

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

    poseAnglesDx: Derivative[];

    derivativexCorrMaxMAX: number;
    derivativexCorrMaxMIN: number;
    derivativexCorriMaxMAX: number;
    derivativexCorriMaxMIN: number;

    dxCorrMaxMAX: number;
    dxCorrMaxMIN: number;
    dxCorriMaxMAX: number;
    dxCorriMaxMIN: number;

    poseSampleRate: number;

    avgKeyPoints: AverageFilteredKeyPoints;

    minConfidenceScore: number = 0.3;

    keyPointsBufferSize: number = 2; //changed 12/26/2020

    avgMinBodyPartXCorr: number = 100;
    avgMaxBodyPartXCorr: number = -100;

    maxVar: number[]; //the max variance we have encountered for each body part
    maxXCorrSkeleton: AveragingFilter;
    maxVarAvg: AveragingFilter;

    touch: SkeletonTouch = new SkeletonTouch();
    intersection: SkeletionIntersection;;

    constructor() {
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

        this.derivativexCorrMaxMAX = 0;
        this.derivativexCorrMaxMIN = 1;
        this.derivativexCorriMaxMAX = 0;
        this.derivativexCorriMaxMIN = 1;

        this.dxCorrMaxMAX = 0;
        this.dxCorrMaxMIN = 1;
        this.dxCorriMaxMAX = 0;
        this.dxCorriMaxMIN = 1;

        this.poseSampleRate = 16; //default rate from testing on my machine. mas o menos ahahah need to fix this

        this.avgKeyPoints = new AverageFilteredKeyPoints();


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

            this.xcorrMaxPositionDX.push(new AveragingFilter());
            this.iMaxPositionsDX.push(new AveragingFilter());
            this.xcorrMaxPositionDY.push(new AveragingFilter());
            this.iMaxPositionsDY.push(new AveragingFilter());

            //for the positions
            this.xcorrMaxPos.push(new AveragingFilter());
            this.xcorrMaxPosY.push(new AveragingFilter());

            this.xcorriMaxPos.push(new AveragingFilter());
        }

        this.setPoseSamplesRate(4); //ok just set to start with

        this.intersection = new SkeletionIntersection(this);
    }

    addFriendParticipant(p: Participant) {
        this.friendParticipant = p;
        this.intersection.setFriend(p.getSkeletonIntersection());
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

    addKeypoint(keypoints: Keypoint[]): void {
        if (keypoints === null) return;
        this.keyPointBuffer.add(keypoints);
        this.avgKeyPoints.update(keypoints);

        /*
        let angleFindingObj = PoseAngle.getAngleFunctionsFromKeypoints(this.avgKeyPoints.top());
        let angleFunctions = GetMethods.getMethods(angleFindingObj);
        // console.log(angleFunctions); 
        if (angleFindingObj != null)
            for (let i = 0; i <= 8; i++) {
                let newAngleFunc : any = angleFindingObj[angleFunctions[i]];
                let newAngle : number = newAngleFunc(this.avgKeyPoints.top());
                this.poseAngles[i].update(newAngle);
                this.poseAnglesDx[i].update(this.poseAngles[i].top());
                //  console.log(newAngle); 
            }
            */ //not using any of the angles code anymore
        // console.log(keypoints);
    }

    //per second -- vary the window size with the samplerate
    //TODO: need to measure samplerate again & change all values accordingly. Also fix some hardcoded shit in the AveragingKeypoints whatever class
    setPoseSamplesRate(sps: number = 32): void {
        this.poseSampleRate = sps;

        // this.windowSize = this.nearestPowerOf2(sps); doesn't work. 4 now, quick & dirty

        //fix this shit later
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

    getCurDX(): Derivative[] {
        return this.avgKeyPoints.getDXBuffer();
    }

    getCurDY(): Derivative[] {
        return this.avgKeyPoints.getDYBuffer();
    }

    getScaledCurDX(): Derivative[] {
        return this.avgKeyPoints.getScaledDXBuffer();
    }

    getScaledCurDY(): Derivative[] {
        return this.avgKeyPoints.getScaledDYBuffer();
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

    //this gets the cross-covariance btw each a window of values, in the rescaled (but not L2 normalized) positional data
    //this was SUCKY so it is depreciated & would need to be updated to run properly
    // xCorrPositions( otherParticipant: Participant  ): void
    // {
    //     //TODO: fix this is not going to work need to use an actual buffer not just current keypoints
    //     let other  = otherParticipant.getKeyPointBuffer();
    //     let me = this.getKeyPointBuffer();

    //     let sz = Math.min(me.length, other.length); //take the lowest sampling rate as the window for comparison
    //     if( sz < this.windowSize ) return; 
    //     sz = this.windowSize; //force sampling to window size, jesus.
    //     // (window as any).windowSizeOtherParticipant = sz;
    //     // (window as any).windowSizeParticipant = this.windowSize;

    //     //take the sample size
    //     other = other.slice(other.length-sz, other.length); 
    //     me = me.slice(me.length-sz, me.length); 

    //     // (window as any).other = other;

    //     let otherNorm : any[] = [];
    //     let meNorm : any[] = [];

    //     for( let i=0; i<sz; i++ )
    //     {
    //          otherNorm.push(PoseMatch.reScaleTo1(other[i], otherParticipant.getWidth(), otherParticipant.getHeight()));
    //          meNorm.push(PoseMatch.reScaleTo1(me[i], this.getWidth(), this.getHeight()));
    //     }

    //     let buffermeX : any[] = [];
    //     let bufferotherX : any[] = [];
    //     let buffermeY : any[] = [];
    //     let bufferotherY : any[] = [];
    //     for(let j=0; j<otherNorm[0].length; j++)
    //     {
    //         let bufmeX : number[] = [];
    //         let bufotherX : number[] = [];
    //         let bufmeY : number[] = [];
    //         let bufotherY : number[] = [];

    //          for (let i=0; i<otherNorm.length; i++)
    //          {
    //             bufmeY.push(meNorm[i][j].position.y * 256.0);
    //             bufmeX.push(meNorm[i][j].position.x * 256.0);

    //             bufotherY.push(otherNorm[i][j].position.y * 256.0);
    //             bufotherX.push(otherNorm[i][j].position.x * 256.0 );
    //          }
    //         buffermeX.push(bufmeX);
    //         bufferotherX.push(bufotherX);
    //         buffermeY.push(bufmeY);
    //         bufferotherY.push(bufotherY);
    //     }

    //     for( let i=0; i<buffermeX.length; i++ )
    //     {
    //         const sig1 = Buffer.from( buffermeX[i] );
    //         const sig2 = Buffer.from( bufferotherX[i] );

    //         const sig3 = Buffer.from( buffermeY[i] );
    //         const sig4 = Buffer.from( bufferotherY[i] );

    //         if(this.getAvgScore(i) >= this.minConfidenceScore && otherParticipant.getAvgScore(i) >= this.minConfidenceScore )
    //         {

    //             let xcorr_out = XCorr.Xcorr(sig1, sig2);
    //             if( !isNaN(xcorr_out.xcorrMax)  )
    //             {
    //                 this.xcorrMaxPos[i].update(xcorr_out.xcorrMax);
    //             }
    //             else 
    //             {
    //                 this.xcorrMaxPos[i].update(-100);
    //             }
    //             this.xcorriMaxPos[i].update(xcorr_out.iMax); 

    //             let xcorr_out2 = XCorr.Xcorr(sig3, sig4);
    //             if( !isNaN(xcorr_out2.xcorrMax)  )
    //             {
    //                 this.xcorrMaxPosY[i].update(xcorr_out2.xcorrMax);
    //             }
    //             else 
    //             {
    //                 this.xcorrMaxPosY[i].update(-100);
    //             }
    //             this.xcorriMaxPos[i].update(xcorr_out2.iMax); 
    //         }
    //         else 
    //         {
    //             //zero values out for low confidence scores.
    //             this.xcorrMaxPos[i].update(-1); 
    //             this.xcorriMaxPos[i].update(0); 
    //         }
    //     }  

    //     //TODO: this  version of synchronity later now that things work
    //     // for( let i=0; i<sz; i++ )
    //     // {
    //     //      otherNorm.push(PoseMatch.scaleAndL2Norm(other[i], otherParticipant.getWidth(), otherParticipant.getHeight()));
    //     //      meNorm.push(PoseMatch.scaleAndL2Norm(me[i], this.getWidth(), this.getHeight()));
    //     // }

    //     // let buffermeX : any[] = [];
    //     // let bufferotherX : any[] = [];
    //     // let buffermeY : any[] = [];
    //     // let bufferotherY : any[] = [];
    //     // for(let j=0; j<otherNorm[0].length; j+=2)
    //     // {
    //     //     let bufmeX : number[] = [];
    //     //     let bufotherX : number[] = [];
    //     //     let bufmeY : number[] = [];
    //     //     let bufotherY : number[] = [];

    //     //     for (let i=0; i<otherNorm.length; i++)
    //     //     {
    //     //         bufmeY.push(meNorm[i][j]);
    //     //         bufmeX.push(meNorm[i][j+1]);

    //     //         bufotherY.push(otherNorm[i][j]);
    //     //         bufotherX.push(otherNorm[i][j+1]);
    //     //     }
    //     //     buffermeX.push(bufmeX);
    //     //     bufferotherX.push(bufotherX);
    //     //     buffermeY.push(bufmeY);
    //     //     bufferotherY.push(bufotherY);
    //     // }

    //     // for( let i=0; i<buffermeX.length; i++ )
    //     // {
    //     //     const sig1 = Buffer.from( buffermeX[i] );
    //     //     const sig2 = Buffer.from( bufferotherX[i] );

    //     //     let xcorr_out = XCorr.Xcorr(sig1, sig2);
    //     //     if( !isNaN(xcorr_out.xcorrMax)  )
    //     //     {
    //     //         this.xcorrMaxPos[i].update(xcorr_out.xcorrMax);
    //     //     }
    //     //     else 
    //     //     {
    //     //         this.xcorrMaxPos[i].update(-100);
    //     //     }
    //     //     this.xcorriMaxPos[i].update(xcorr_out.iMax); 
    //     // }  


    // }

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

                    let xcorr_outX = XCorr.Xcorr(sig1X, sig2X);
                    let xcorr_outY = XCorr.Xcorr(sig1Y, sig2Y);


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

                    this.iMaxPositionsDX[i].update(xcorr_outX.iMax);
                    this.iMaxPositionsDY[i].update(xcorr_outY.iMax);
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

    //find the x - correlation between the body angles of 2 participants.
    xCorrAngles(otherParticipant: Participant): void {
        //ok, this is just on one elbow to test - rightShoulderHipElbow
        // this.xcorrMaxRightShoulderHipElbow  = new CircularBuffer(this.windowSize);
        // this.xcorrMaxIndexRightShoulderHipElbow  = new CircularBuffer(this.windowSize);

        //not really usign this, but changed from a Derivative yikes.
        let otherAngles: Derivative[] = otherParticipant.getCurAnglesDx();

        let otherAnglesArray: number[][] = [];
        let myAnglesArray: number[][] = [];
        let sz = math.min(otherAngles[0].length(), this.poseAnglesDx[0].length()); //take the lowest sampling rate as the window for comparison
        if (sz < this.windowSize) return; //TODO: probably send window size from the other participant... maybe


        for (let i = 0; i < this.xcorrMax.length; i++) {
            otherAnglesArray.push(otherAngles[i].getOutputContents(sz));
            myAnglesArray.push(this.poseAnglesDx[i].getOutputContents(sz));
        }

        // if (otherAnglesArray[0].length < this.windowSize) return;
        if (myAnglesArray[0].length < this.windowSize) return;

        if (otherAnglesArray[0].length != myAnglesArray[0].length) {
            console.log("Problem i is 0");

            console.log("otherAnglesArray[i].length: " + otherAnglesArray[0].length.toString());
            console.log("this.poseAnglesDx[i].length: " + myAnglesArray[0].length.toString());

            console.log("sz: " + sz.toString());

            console.log("otherAngles[i].length(): " + otherAngles[0].length().toString());
            console.log("myAnglesArray[i].length: " + this.poseAnglesDx[0].length().toString());

        }
        console.assert(otherAnglesArray[0].length == myAnglesArray[0].length);
        //also assert power of 2, later. for now, it should be windowsize.

        for (let i: number = 0; i < this.xcorrMax.length; i++) {

            const sig1 = Buffer.from(this.convertToUint16(myAnglesArray[i]));
            const sig2 = Buffer.from(this.convertToUint16(otherAnglesArray[i]));
            if (otherAnglesArray[i].length != myAnglesArray[i].length) {
                console.log("Problem i is: " + i.toString());

                console.log("otherAnglesArray[i].length: " + otherAnglesArray[i].length.toString());
                console.log("this.poseAnglesDx[i].length: " + myAnglesArray[i].length.toString());

                console.log("sz: " + sz.toString());

                console.log("otherAngles[i].length(): " + otherAngles[i].length().toString());
                console.log("myAnglesArray[i].length: " + this.poseAnglesDx[i].length().toString());

            }
            console.assert(otherAnglesArray[i].length == myAnglesArray[i].length);

            let xcorr_out = XCorr.Xcorr(sig1, sig2);

            if (!isNaN(xcorr_out.xcorrMax)) {
                this.xcorrMax[i].update(xcorr_out.xcorrMax);
            }
            else {
                this.xcorrMax[i].update(0.0);
            }

            this.iMax[i].update(xcorr_out.iMax);
            this.xcorrMaxDerivative1[i].update(this.xcorrMax[i].top());
            this.iMaxDerivative1[i].update(this.iMax[i].top());

            // if(this.xcorrMaxDerivative1[i].top() >  this.derivativexCorrMaxMAX ) {this.derivativexCorrMaxMAX = this.xcorrMaxDerivative1[i].top()};
            // if(this.xcorrMaxDerivative1[i].top() <  this.derivativexCorrMaxMIN ) {this.derivativexCorrMaxMIN = this.xcorrMaxDerivative1[i].top()};

            // if(this.iMaxDerivative1[i].top() >  this.derivativexCorriMaxMAX ) {this.derivativexCorriMaxMAX = this.iMaxDerivative1[i].top()};
            // if(this.iMaxDerivative1[i].top() <  this.derivativexCorriMaxMIN ) {this.derivativexCorriMaxMIN = this.iMaxDerivative1[i].top()};

            // console.log("max:");
            // console.log(this.derivativexCorriMaxMAX);

            // console.log("min");
            // console.log(this.derivativexCorriMaxMIN);


            // this.iMax[i].add(xcorr_out.iMax);

            //  console.log("Angle " +i+ " -->  xCorrMax: " +xcorr_out.xcorrMax + " xCorrMaxIndex: " +xcorr_out.iMax);
            //  console.log(xcorr_out.xcorrMax);
        }
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

    // getAverageBodyPartXCorrSynchronicity( bodyPartIndices: number[], minConfidence: number ) : number
    // {
    //     let sum : number = 0; 
    //     for(let i = 0 ; i<bodyPartIndices.length; i++)
    //     {
    //         sum += this.getXCorrPos(bodyPartIndices[i]); 
    //     } 

    //     return sum/bodyPartIndices.length;
    // }

    // getAvgSkeletonXCorr(minConfidence : number = 0.25) : number
    // {
    //     //    getXCorrPos(index : number)
    //     //getAvgScore(index)

    //     let sum : number = 0; 
    //     let count : number = 0;
    //     for(let i = 0 ; i<PoseIndex.posePointCount; i++)
    //     {
    //         if( this.getAvgScore(i) >= minConfidence && this.friendParticipant.getAvgScore(i) >= minConfidence )
    //         {
    //             sum += this.getDistXCorrMax(i); 
    //             count++; 
    //         }
    //     } 

    //     return sum/count;
    // }

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

    getAverageBodyPartWindowedVarianceFromIndex(index: number, minConfidence: number = 0.3): number {
        //goes through the below order: 
        //[head, torso, leftArm, rightArm, leftLeg, rightLeg];
        let maxWindowedVarTestedMaximums = [2, 2, 5, 5, 5, 5]; //just from one session -- TODO: find better maxes.

        let winvar = this.getAverageBodyPartWindowedVariance(index, PoseIndex.bodyPartArray[index], minConfidence);
        // console.log(index + ":" + winvar);
        winvar = Scale.linear_scale(winvar, 0, maxWindowedVarTestedMaximums[index], 0, 1);

        if (!isNaN(winvar))
            return winvar;
        else return 0;
    }

    getAverageBodyPartWindowedVariance(index: number, bodyPartIndices: number[], minConfidence: number = 0.3): number {
        let sum: number = 0;
        let count: number = 0;
        for (let i = 0; i < bodyPartIndices.length; i++) {
            if (this.getAvgScore(i) >= minConfidence) {
                sum += this.avgKeyPoints.getWindowedVariance(bodyPartIndices[i]);
                count++;
            }
        }
        if (count == 0) return 0;
        else {

            let v = sum / count;
            if (this.maxVar[index] < v) {
                this.maxVar[index] = v;
            }
            // console.log( index + ":" + this.maxVar[index] );

            return v;
        }
    }

    //this is not getting updated at some points.... gah.
    //this should be in an averaging filter. 
    getMaxBodyPartWindowedVariance(minConfidence: number = 0.4) {
        let maxWindowedVar: number = 0;

        for (let i = 0; i < PoseIndex.bodyPartArray.length; i++) {
            let winvar = this.getAverageBodyPartWindowedVarianceFromIndex(i);
            //let winvar = this.getAverageBodyPartWindowedVariance( PoseIndex.bodyPartArray[i] );

            if (winvar > maxWindowedVar)
                maxWindowedVar = winvar;

            // not searching for the max now -- test more later

            // if(i < 3)
        }

        //update a running average to calm that down dude
        this.maxVarAvg.update(maxWindowedVar)

        return this.maxVarAvg.top();//this.maxVarAvg.top(); //already scaled 0 to 1
    }


    getParticipantID(): string {
        return this.participantID;
    }

    isParticipant(id: string): boolean {
        return this.participantID === id;
    }

    //TODO: update everything in one method & just have that as the outside thingy!
    updateTouchingFriend(): void {
        this.intersection.update(); //TODO only update when have friend

        if (this.friendParticipant) {
            //TODO: refactor so I only do this once.
            let iAmSecond = orderParticipantID(this.participantID, this.friendParticipant.getParticipantID()) === -1;

            let friendKeypoints = this.friendParticipant.getAvgKeyPoints();
            let minDistanceTouching = 0.09; //in percent, just a guess.
            if (friendKeypoints) {
                for (let i = 0; i < friendKeypoints.length; i++) {
                    this.touch = this.touching(friendKeypoints[i], minDistanceTouching, this.touch, this.width, this.height,
                        this.friendParticipant.getWidth(), this.friendParticipant.getHeight(), i, iAmSecond);
                }

            }
            this.touch.updateTouching();
            this.xcorrTouchingMax.update( this.getAvgXCorrAtTouchingKeypoints()  );
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

    //moved from avg keypoints... prob need to refactor this shit.
    //TODO: how much of the body & also for how long (scale?)
    //Then -- how fast before the touch? prob just windowedvar @ touch 
    //Then refine the touch measure so is less crude -- ie now it is just distance btw. keypoints but prob need to look at distance from skeleton/connecting line
    touching(keypointToTest: any, minDistanceTouching: number, sTouch: SkeletonTouch, w: number, h: number,
        theirW: number, theirH: number, index: number, iAmSecond: boolean = false): SkeletonTouch {
        //TODO: this does not return where the touch was. could do that.
        this.intersection.setShouldFlipSelf(iAmSecond)
        let whereTouch = this.intersection.touching(w, h);
        sTouch.removeAllTouches();
        if (whereTouch.isTouching) {
            sTouch.addWhereTouch(whereTouch); //TODO -- get these values from the skeleton
            // console.log( whereTouch.toString() );
        }

        return sTouch;

    }

    //I PROMISE I will refactor this fucking BS. --> copied & pasted from xCorrDistance lol
    xCorrWithDifferentKeypoints(myIndex: number, theirIndex: number, minConfidence: number): number {

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

            if (this.getAvgScore(myIndex) >= this.minConfidenceScore && this.friendParticipant.getAvgScore(theirIndex) >= minConfidence
                && sig1X.length == sig2X.length && sig1Y.length == sig2Y.length) {

                let xcorr_outX = XCorr.Xcorr(sig1X, sig2X);
                let xcorr_outY = XCorr.Xcorr(sig1Y, sig2Y);

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

};