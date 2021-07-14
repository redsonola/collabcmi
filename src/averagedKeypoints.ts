import { CircularBuffer } from './circularBuffer';
import { AveragingFilter, UGEN, Derivative } from './averagingFilterV2';
import * as PoseIndex from './poseConstants';
import * as math from 'mathjs'
import * as PoseMatch from './poseMatching';
import { isPositiveDependencies } from 'mathjs';
import * as ScaleMD from './scaleBasedOnMovementData'

export function distance(keypoints: any, poseIndex1: number, poseIndex2: number): number {
    let x1 = keypoints[poseIndex1].position.x;
    let y1 = keypoints[poseIndex1].position.y;
    let x2 = keypoints[poseIndex2].position.x;
    let y2 = keypoints[poseIndex2].position.y;

    return distance2d(x1, y1, x2, y2);
}

//NOTE: this is taken from code I wrote for the collab oroject
//ironic isn't it? but whatever.
export function distance2d(x1: number, y1: number, x2: number, y2: number): number {
    let dist = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    return Math.sqrt(dist);
}

function distance2dFromXYVector3(v1: THREE.Vector3, v2: THREE.Vector3) {
    return distance2d(v1.x, v1.y, v2.x, v2.y);
}

//a class that averages all the pose keypoints and keeps them all handy.
//try drawing these instead to test
export class AverageFilteredKeyPoints 
{

    x : AveragingFilter[];
    y : AveragingFilter[];

    xAvg  : AveragingFilter[];
    yAvg  : AveragingFilter[];
    dxOfxAvg : Derivative[]; 
    dyOfyAvg  : Derivative[]; 


    rawScore : number[]; 

    xDx : Derivative[]; 
    yDx : Derivative[];
    xDxMax : number[]; 
    yDxMax : number[];
    dxAvg : AveragingFilter[]; 
    dyAvg : AveragingFilter[];
    dxAvgScaled : AveragingFilter[]; // these are scaled by eye distance
    dyAvgScaled : AveragingFilter[]; // these are scaled by eye distance
    dxScaledNoAbs : CircularBuffer<number>[]; // these are scaled by eye distance
    dyScaledNoAbs : CircularBuffer<number>[]; // these are scaled by eye distance
    updateTimesDx : CircularBuffer<number>[]; //when has dx  been updated
    
    jerkX : Derivative[]; 
    jerkY : Derivative[]; 
    jerkAvgX : AveragingFilter[]; 
    jerkAvgY : AveragingFilter[];

    accelX : Derivative[]; 
    accelY : Derivative[]; 
    accelAvgX : AveragingFilter[]; 
    accelAvgY : AveragingFilter[];


    AVG_DX_BUFFER_SIZE : number = 32; 
    AVG_JERK_BUFFER_SIZE : number = 8; 
    
    scaledX : AveragingFilter[];
    scaledY : AveragingFilter[];

    scaledxDx : Derivative[]; 
    scaledyDx : Derivative[];

    //combined dx & dy, ya know.
    distance : AveragingFilter[];

    score : AveragingFilter[];

    width : number; 
    height : number; 
    
    stillnessThresh : number; //found via experimentation

    //keep track of for debugging. may need to adjust for skeleton -- close or far to the camera
    maxDx : number; 
    maxDy : number;

    distanceOutBufferSize : number;
    shortBufferSizeXY : number = 4; 
    shortBufferSizeWinVar : number = 4; 

    windowedVarianceX : AveragingFilter[]; 
    windowedVarianceY : AveragingFilter[]; 


    part : string[];

    dxOutBufferSize : number = 32; 

    curEyeDistance : number = 0;

    minConfidence : number = 0.35; 


    constructor(avgSz : number = 12, avgOutBufferSize : number = 2, minConfidence=0.35, width=640, height=480)
    {
        this.stillnessThresh = 0.9; //found via experimentation Oct. 21

        this.minConfidence = minConfidence; 

        this.x = [];
        this.y = []; 

        this.xAvg  = [];
        this.yAvg  = [];
        this.dxOfxAvg  = [];
        this.dyOfyAvg  = [];

        this.score = [];
        this.part = [];


        this.xDx = [];
        this.yDx = [];
        this.xDxMax = []; 
        this.yDxMax = [];
        this.dxAvg = []; 
        this.dyAvg = []; 
        this.updateTimesDx  = [];


        this.dxAvgScaled = []; // these are scaled by eye distance
        this.dyAvgScaled = []; // these are scaled by eye distance
        this.dxScaledNoAbs = []; // these are scaled by eye distance
        this.dyScaledNoAbs = []; // these are scaled by eye distance
    
        this.jerkX = []; 
        this.jerkY = []; 
        this.jerkAvgX = []; 
        this.jerkAvgY = []; 

        this.accelX = []; 
        this.accelY = [];  
        this.accelAvgX = []; 
        this.accelAvgY = []; 
    
        this.distance = [];

        this.scaledX = [];
        this.scaledY = [];
    
        this.scaledxDx = []; 
        this.scaledyDx = [];

        this.width = width; 
        this.height = height; 

        this.maxDx = 0; 
        this.maxDy = 0;

        this.rawScore = []; 

        //for how many distance values to keep. need for the variance
        this.distanceOutBufferSize = 64; //try this as a ceiling, perhaps it is a ratio with this, or need to send in the fps
        this.windowedVarianceX = [];
        this.windowedVarianceY = [];

        for(let i=0; i<PoseIndex.posePointCount; i++)
        {
            this.x.push(new AveragingFilter(2, avgOutBufferSize));
            this.y.push(new AveragingFilter(2, avgOutBufferSize));
            this.xAvg.push(new AveragingFilter(avgSz, avgOutBufferSize));
            this.yAvg.push(new AveragingFilter(avgSz, avgOutBufferSize));
    
            this.score.push(new AveragingFilter(avgSz, avgOutBufferSize));

            this.xDx.push(new Derivative(avgSz, this.dxOutBufferSize));
            this.yDx.push(new Derivative(avgSz, this.dxOutBufferSize));

            this.dxOfxAvg.push(new Derivative(avgSz, this.dxOutBufferSize));
            this.dyOfyAvg.push(new Derivative(avgSz, this.dxOutBufferSize));

            this.jerkX.push(new Derivative(avgSz, avgOutBufferSize)); 
            this.jerkY.push(new Derivative(avgSz, avgOutBufferSize));
            this.accelX.push(new Derivative(avgSz, avgOutBufferSize)); 
            this.accelY.push(new Derivative(avgSz, avgOutBufferSize));

            //TODO make this not hardcoded here
            this.dxAvg.push(new AveragingFilter(this.AVG_DX_BUFFER_SIZE, avgOutBufferSize));
            this.dyAvg.push(new AveragingFilter(this.AVG_DX_BUFFER_SIZE, avgOutBufferSize));
            this.dxAvgScaled.push(new AveragingFilter(this.AVG_DX_BUFFER_SIZE, avgOutBufferSize)); // these are scaled by eye distance
            this.dyAvgScaled.push(new AveragingFilter(this.AVG_DX_BUFFER_SIZE, avgOutBufferSize)); // these are scaled by eye distance
            
            this.dxScaledNoAbs.push(new CircularBuffer<number>(this.dxOutBufferSize)); 
            this.dyScaledNoAbs.push(new CircularBuffer<number>(this.dxOutBufferSize)); 
            this.updateTimesDx.push(new CircularBuffer<number>(this.dxOutBufferSize)); 

            this.jerkAvgX.push(new AveragingFilter(this.AVG_JERK_BUFFER_SIZE, avgOutBufferSize));
            this.jerkAvgY.push(new AveragingFilter(this.AVG_JERK_BUFFER_SIZE, avgOutBufferSize));
            this.accelAvgX.push(new AveragingFilter(this.AVG_JERK_BUFFER_SIZE, avgOutBufferSize));
            this.accelAvgY.push(new AveragingFilter(this.AVG_JERK_BUFFER_SIZE, avgOutBufferSize));

            this.xDxMax.push(0);
            this.yDxMax.push(0);
            this.rawScore.push(0);

            //try just making window size smaller for this measure
            this.distance.push( new AveragingFilter(1, this.distanceOutBufferSize) );

            this.scaledX.push(new AveragingFilter(avgSz, avgOutBufferSize));
            this.scaledY.push(new AveragingFilter(avgSz, avgOutBufferSize));
        
            this.scaledxDx.push(new Derivative(avgSz, avgOutBufferSize)); 
            this.scaledyDx.push(new Derivative(avgSz, avgOutBufferSize));

            this.windowedVarianceX.push(new AveragingFilter( this.AVG_DX_BUFFER_SIZE, avgOutBufferSize )); //fix
            this.windowedVarianceY.push(new AveragingFilter( this.AVG_DX_BUFFER_SIZE, avgOutBufferSize )); //fix

        }

    }

    setShortBufferSizeXY(sz : number) : void
    {
        this.shortBufferSizeXY = sz; 
    }

    setShortBufferSizeWinVar(sz : number) : void
    {
        this.shortBufferSizeWinVar = sz; 
    }
    
    setMinThreshForDx(thresh : number) : void
    {
        this.stillnessThresh = thresh; 
    }

    setSize(w : number, h : number)
    {
        w = this.width; 
        h = this.height; 
    }

    setWindowSize( sz : number, buffer2Size : number = 4  ) : void {
        
        for(let i=0; i<PoseIndex.posePointCount; i++)
        {
            this.x[i].setWindowSize(2, buffer2Size); 
            this.y[i].setWindowSize(2, buffer2Size); 
            this.score[i].setWindowSize(2, buffer2Size); 

            this.xAvg[i].setWindowSize(sz, buffer2Size);
            this.yAvg[i].setWindowSize(sz, buffer2Size);

            this.xDx[i].setWindowSize(sz, this.dxOutBufferSize); 
            this.yDx[i].setWindowSize(sz, this.dxOutBufferSize);
            
            this.dxOfxAvg[i].setWindowSize(sz, this.dxOutBufferSize); 
            this.dyOfyAvg[i].setWindowSize(sz, this.dxOutBufferSize); 

            // this.distanceOutBufferSize = sz;
            this.distance[i].setWindowSize(1, this.distanceOutBufferSize); //fix?
            this.windowedVarianceX[i].setWindowSize(this.distanceOutBufferSize, buffer2Size); 
            this.windowedVarianceY[i].setWindowSize(this.distanceOutBufferSize, buffer2Size); 

        }
    }

    setDXOutBufferSize( sz : number )
    {
        //TODO: make the incoming buffer greater than 2 maybe, but I mean maybe not.
        this.dxOutBufferSize = sz; 
        for( let i=0; i<this.xDx.length; i++ )
        {
            this.xDx[i].setWindowSize(2, this.dxOutBufferSize); 
            this.yDx[i].setWindowSize(2, this.dxOutBufferSize); 

            this.dxOfxAvg[i].setWindowSize(2, this.dxOutBufferSize); 
            this.dyOfyAvg[i].setWindowSize(2, this.dxOutBufferSize); 
        }

        for( let i=0; i<this.dxScaledNoAbs.length; i++ )
        {
            this.dxScaledNoAbs[i].setWindowSize(this.dxOutBufferSize ); 
            this.dyScaledNoAbs[i].setWindowSize(this.dxOutBufferSize ); 
            this.updateTimesDx[i].setWindowSize( this.dxOutBufferSize )
        }
    }

    update( keypoints : any[], now : number ) : void
    {
        if( keypoints == null ) return; 
        let scaledKeypoints = PoseMatch.reScaleTo1(keypoints, this.width, this.height);

        let avgDx : number = 0; 
        let avgDy : number = 0; 

        if( keypoints ){
            if( !isNaN(keypoints[PoseIndex.rightEye].position.x) && !isNaN(keypoints[PoseIndex.leftEye].position.x) )
            {
                this.curEyeDistance = distance(keypoints, PoseIndex.rightEye, PoseIndex.leftEye);
            }
        }

        for(let i=0; i<keypoints.length; i++){
            const keypoint = keypoints[i];
            const { y, x } = keypoint.position;

            this.x[i].update(x); 
            this.y[i].update(y);
            this.xAvg[i].update(x); 
            this.yAvg[i].update(y);

            this.part[i] = keypoint.part;

            this.x[i].update(x); 
            this.y[i].update(y);
            this.score[i].update(keypoint.score);
            this.rawScore[i] = keypoint.score; 

            this.scaledX[i].update( scaledKeypoints[i].position.x ); 
            this.scaledY[i].update( scaledKeypoints[i].position.y ); 

            this.xDx[i].updateWithStillnessThresh( this.x[i].top(), this.stillnessThresh );
            this.yDx[i].updateWithStillnessThresh( this.y[i].top(), this.stillnessThresh );

            this.dxOfxAvg[i].updateWithStillnessThresh( this.xAvg[i].top(), this.stillnessThresh );
            this.dyOfyAvg[i].updateWithStillnessThresh( this.yAvg[i].top(), this.stillnessThresh );

            if( !isNaN(this.xDx[i].top()) && !isNaN(this.curEyeDistance) )
            {
                let scaledDx = ScaleMD.scaleDx(Math.abs(  this.dxOfxAvg[i].top() ), i, this.curEyeDistance );
                let scaledDy = ScaleMD.scaleDy( Math.abs( this.dyOfyAvg[i].top() ), i, this.curEyeDistance ) ;

                let scaledDxXcorr = ScaleMD.scaleDx(Math.abs(  this.xDx[i].top() ), i, this.curEyeDistance );
                let scaledDyXcorr = ScaleMD.scaleDy( Math.abs( this.yDx[i].top() ), i, this.curEyeDistance ) ;


                if( !isNaN(scaledDxXcorr) )
                {
                    this.dxAvgScaled[i].update( scaledDxXcorr ); 
                    if( this.xDx[i].top() >= 0  )
                    {
                        this.dxScaledNoAbs[i].add( scaledDxXcorr );
                    }
                    else
                    {
                        this.dxScaledNoAbs[i].add( -scaledDxXcorr );  
                    }

                    this.updateTimesDx[i].add(now);
                }

                if( !isNaN(scaledDyXcorr) )
                {
                    this.dyAvgScaled[i].update( scaledDyXcorr ); 
                    if( this.xDx[i].top() >= 0  )
                    {
                        this.dyScaledNoAbs[i].add( scaledDyXcorr );
                    }
                    else
                    {
                        this.dyScaledNoAbs[i].add( -scaledDyXcorr );  
                    }              
                }
            }

            if( keypoint.score > 0.35 ) // jesus why is this hardcoded.
            {
                // this.jerkX[i].updateWithStillnessThresh( this.xDx[i].top(), this.stillnessThresh );
                // this.jerkY[i].updateWithStillnessThresh( this.yDx[i].top(), this.stillnessThresh );



                this.scaledxDx[i].update(this.scaledX[i].top());
                this.scaledyDx[i].update(this.scaledY[i].top());

                avgDx += this.xDx[i].top(); 
                avgDy += this.yDx[i].top(); 

                if( this.xDx[i].length() > 1 )
                {
                    //this is the abs value bc used as movement measure so don't care about direction
                    this.dxAvg[i].update( Math.abs( this.xDx[i].top() ) );
                    this.dyAvg[i].update( Math.abs( this.yDx[i].top() ) );

                                    //TO DO: this is a new way of doing things, so uncomment this and comment above
                    this.accelX[i].updateWithStillnessThresh( this.xDx[i].top(), this.stillnessThresh );
                    this.accelY[i].updateWithStillnessThresh( this.yDx[i].top(), this.stillnessThresh );
                    
                    if(!isNaN( this.accelX[i].top() ) )
                    {
                        this.accelAvgX[i].update( Math.abs( this.accelX[i].top() ) );
                        this.accelAvgY[i].update( Math.abs( this.accelY[i].top() ) );
                    }
                    else{
                        this.accelAvgX[i].update( 0 );
                        this.accelAvgY[i].update( 0);                       
                    }
                    
                    if( this.accelAvgX[i].length() > 1 && !isNaN( this.accelX[i].top() ) )
                    {
                        this.jerkX[i].updateWithStillnessThresh( this.accelX[i].top(), this.stillnessThresh );
                        this.jerkY[i].updateWithStillnessThresh( this.accelY[i].top(), this.stillnessThresh );
                        
                        if(!isNaN( this.jerkX[i].top() ) )
                        {
                            this.jerkAvgX[i].update( Math.abs( this.jerkX[i].top() ) );
                            this.jerkAvgY[i].update( Math.abs( this.jerkY[i].top() ) );
                        }
                        else
                        {
                            this.jerkAvgX[i].update( 0 );
                            this.jerkAvgY[i].update( 0 );
                        }
                    }
                    else
                    {
                        this.jerkAvgX[i].update( 0 );
                        this.jerkAvgY[i].update( 0 );
                    }

                    this.xDxMax[i] = Math.max(this.xDxMax[i], this.dxAvg[i].top());
                    this.yDxMax[i] = Math.max(this.yDxMax[i], this.dyAvg[i].top());

                    //this.distance[i].update( dist ); //ok, this is distance but just the magnititude btw positions. Its still pretty good.
                    this.windowedVarianceX[i].update( math.variance( this.dxAvg[i].getOutputContents() ) ); 
                    this.windowedVarianceY[i].update( math.variance( this.dxAvg[i].getOutputContents() ) ); 

                }   
            }
            else 
            {   
                this.dxAvg[i].update( 0 );
                this.dyAvg[i].update( 0 );

                this.jerkAvgX[i].update( 0 );
                this.jerkAvgY[i].update( 0 );

                this.accelAvgX[i].update( 0 );
                this.accelAvgY[i].update( 0 );

                this.windowedVarianceX[i].update(0); //since this is a measure of movement, it should set to 0... hmm maybe dx & dy as well
                this.windowedVarianceY[i].update(0); //since this is a measure of movement, it should set to 0... hmm maybe dx & dy as well

            }
    }
        avgDx /= keypoints.length; 
        avgDy /= keypoints.length; 

        if( avgDx > this.maxDx )
            this.maxDx = avgDx; 

        if( avgDy > this.maxDy  )
            this.maxDy = avgDy; 
    }

    getWindowedVarianceX( index: number ) : number
    {
        return this.windowedVarianceX[index].getNextWithShorterWindow(this.shortBufferSizeWinVar);
    }

    getWindowedVarianceY( index: number ) : number
    {
        return this.windowedVarianceY[index].getNextWithShorterWindow(this.shortBufferSizeWinVar);
    }

    // getWindowedVarianceMaxXorY( i: number )
    // {
    //     return Math.max( ScaleMD.scaleWindowedVarX(this.getWindowedVarianceX(i), i ), ScaleMD.scaleWindowedVarY(this.getWindowedVarianceY(i), i )  );
    // }

    getMaxDx()
    {
        return this.maxDx ;
    }

    getMaxDy()
    {
        return this.maxDy ;
    }

    getTopX(i : number) : number
    {
        return this.x[i].top();
    }

    getTopY(i : number) : number
    {
        return this.y[i].top();
    }

    getTopAvgX(i : number) : number
    {
        return this.xAvg[i].top();
    }

    getTopAvgY(i : number) : number
    {
        return this.yAvg[i].top();
    }

    getTopDx(i : number) : number
    {
        return this.xDx[i].top();
    }

    getTopDy(i : number) : number
    {
        return this.yDx[i].top();
    }

    getEyeDistance() : number
    {
        return this.curEyeDistance; 
    }

    getMaxDxByKeypoint(i : number) : number
    {
        return this.xDxMax[i];
    }

    getMaxDyByKeypoint(i : number) : number
    {
        return this.yDxMax[i];
    }

    top()
    {
        let keypoints : any[] = [];

        for(let i=0; i<PoseIndex.posePointCount; i++)
        {
            var keypoint = { position: {y: this.getTopY(i), x: this.getTopX(i)}, score: this.score[i].top() };
            keypoints.push(keypoint);
        }

        return keypoints; 
    }

    getX( i : number )
    {
        return this.x[i].getOutputContents(); 
    }

    getDXBuffer() : Derivative[]
    {
        return this.xDx; 
    }

    getDYBuffer() : Derivative[]
    {
        return this.yDx; 
    }

    getScaledDXBuffer() : CircularBuffer<number>[]
    {
        (window as any).dxScale = this.dxScaledNoAbs; 
        (window as any).updateTimes = this.updateTimesDx; 
        return this.dxScaledNoAbs; 
    }

    getUpdateTimesDx() : CircularBuffer<number>[]
    {
        return this.updateTimesDx;
    }

    getScaledDYBuffer() :  CircularBuffer<number>[]
    {
        (window as any).dyScale = this.dxScaledNoAbs; 
        return this.dyScaledNoAbs; 
    }

    //this is scaled, btw
    getDXForLastSeconds(now: number, secondsBack: number) : number[][]
    {
        return this.getDataForLastSeconds(now, secondsBack, this.getScaledDXBuffer());
    }

    //also scaled, btw
    getDYForLastSeconds(now: number, secondsBack: number) : number[][]
    {
        return this.getDataForLastSeconds(now, secondsBack, this.getScaledDYBuffer());
    }

    getDataForLastSeconds( now: number, secondsBack: number, dx : CircularBuffer<number>[] ) : number[][]
    {
        let timeCutOff = now - secondsBack; 
        let timedBuffer : number[][] = [];

        // console.log({dx});
        // console.log( {this.updateTimesDx});  
        
        for(let i=0; i<dx.length; i++)
        {
            timedBuffer.push([]); 
            let j = dx[i].length()-1; 
            let overTime = false;

            while( j >= 0  && !overTime )   
            {
                overTime = this.updateTimesDx[i].at(j) < timeCutOff;
                // console.log( "last time: " + this.updateTimesDx[i].at(j) + "time cutoff:"  + timeCutOff  );
                if(!overTime )
                {
                    timedBuffer[i].unshift( dx[i].at(j) );
                    // console.log(" adding:  " + dx[i].at[j], i, j );
                }
                j--;
            }
            
            // //ok try this
            // if( timedBuffer[i].length === 0 )
            // {
            //     timedBuffer[i].push(0); 
            // }
        }

        return timedBuffer; 
    }

    getY( i : number )
    {
        return this.y[i].getOutputContents(); 
    }

    getDX( i : number )
    {
        return this.xDx[i].getOutputContents(); 
    }

    //this is for analysis -- for the max dx, not the xcorr, altho maybe should use avg for the xcorr... do I? check GAH
    getDXArray() : number[]
    {
        let dx : number[] = []; 
        this.dxAvg.forEach( (element) => { dx.push(  Math.abs(element.top()) ) } );
        return dx; 
    }

    getDYArray() : number[]
    {
        let dy : number[] = []; 
        this.dyAvg.forEach( (element) => { dy.push( Math.abs(element.top())  ) } );
        return dy; 
    }

    getWindowedVarXArray() : number[]
    {
        let varX : number[] = []; 
        this.windowedVarianceX.forEach( (element) => { varX.push( Math.abs(element.top())  ) } );
        return varX; 
    }

    getWindowedVarYArray() : number[]
    {
        let varY : number[] = []; 
        this.windowedVarianceY.forEach( (element) => { varY.push( Math.abs(element.top())  ) } );
        return varY; 
    }

    getJerkXArray() : number[]
    {
        let jerk : number[] = []; 
        this.jerkAvgX.forEach( (element) => { jerk.push( Math.abs(element.top())  ) } );
        return jerk; 
    }    

    getJerkYArray() : number[]
    {
        let jerk : number[] = []; 
        this.jerkAvgY.forEach( (element) => { jerk.push( Math.abs(element.top())  ) } );
        return jerk; 
    }    

    getAccelXArray() : number[]
    {
        let accel : number[] = []; 
        this.accelAvgX.forEach( (element) => { accel.push( Math.abs(element.top())  ) } );
        return accel; 
    }    

    getAccelYArray() : number[]
    {
        let accel : number[] = []; 
        this.accelAvgY.forEach( (element) => { accel.push( Math.abs(element.top())  ) } );
        return accel; 
    }
    
    getMaxAccelXYArray()
    {
        let x : number[] = this.getAccelXArray(); 
        let y : number[] = this.getAccelXArray(); 
        let res : number[] = [];

        for(let i=0; i<x.length; i++)
        {
            res.push( Math.max(x[i], y[i]) );
        }
        return res; 
    }

    //returns dx of keypoint at specified index
    getDXTop( i : number )
    {
        return this.xDx[i].top(); 
    }

    //returns dx of keypoint at specified index
    getDYTop( i : number )
    {
        return this.yDx[i].top(); 
    }

    getDxAvg( i : number )
    {
        return this.dxAvg[i].top(); 
    }

    getDyAvg( i : number )
    {
        return this.dyAvg[i].top(); 
    }

    getJerkX( i : number )
    {
        return this.jerkAvgX[i].top();
    }

    getJerkY( i : number )
    {
        return this.jerkAvgY[i].top();
    }

    getAccelX( i : number )
    {
        return this.accelAvgX[i].top();
    }

    getAccelY( i : number )
    {
        return this.accelAvgY[i].top();
    }

    getDY( i : number )
    {
        return this.yDx[i].getOutputContents(); 
    }

    // getDxyAvg( i: number )
    // {
    //     return ( this.getDxAvg(i)*0.5  +  this.getDyAvg(i)*0.5  );
    // }
    
    //change name to max...... -- it uses scaled values.
    getDxyAvg( i: number )
    {
        return Math.max( this.dxAvgScaled[i].top(), this.dyAvgScaled[i].top() ) ;
    }

    getDxyMax( i: number )
    {
        return ( this.getMaxDxByKeypoint(i)*0.25 + this.getMaxDyByKeypoint(i)*0.25  ) + 0.5*Math.max( this.getMaxDxByKeypoint(i), this.getMaxDyByKeypoint(i)*0.25 ); 
    }


    //returns keypoints with the dx
    dxTop()
    {
        let keypoints : any[] = [];

        for(let i=0; i<PoseIndex.posePointCount; i++)
        {
            var keypoint = { position: {y: this.getTopDx(i), x: this.getTopDy(i)}, score: this.score[i].top() };
            keypoints.push(keypoint);
        }

        return keypoints; 
    }

    topDist(i : number) : number
    {
        return this.distance[i].top();
    }

    getDistanceBtw() : AveragingFilter[]
    {
        return this.distance;
    }

    getDistanceBtwIndex(i : number) : AveragingFilter
    {
        return this.distance[i];
    }

    //how many keypoints.
    length() : number
    {
        return this.x[0].length();
    }

    //ok, this gets the average score, so just the top() score of the average buffer
    getAvgScore(index: number) : number
    {
        return this.score[index].top(); 
    }

}

