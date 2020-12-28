import { CircularBuffer } from './circularBuffer';
import { AveragingFilter, UGEN, Derivative } from './averagingFilterV2';
import * as PoseIndex from './poseConstants.js';
import * as math from 'mathjs'
import * as PoseMatch from './poseMatching';


//a class that averages all the pose keypoints and keeps them all handy.
//try drawing these instead to test
export class AverageFilteredKeyPoints 
{

    x : AveragingFilter[];
    y : AveragingFilter[];

    //shorter window for windowed variation
    xShort : AveragingFilter[];
    yShort : AveragingFilter[];
    xShortDx : Derivative[];
    yShortDy : Derivative[];

    xDx : Derivative[]; 
    yDx : Derivative[];

    xDxNOStill : Derivative[]; 
    yDxNOStill  : Derivative[];
    
    scaledX : AveragingFilter[];
    scaledY : AveragingFilter[];

    scaledxDx : Derivative[]; 
    scaledyDx : Derivative[];

    //combined dx & dy, ya know.
    //ok, this may need to get unfucked but I'm trying to merge things FAST
    distance : AveragingFilter[]; // this is for touch
    distanceForWindowedVar : AveragingFilter[]; // this is for windowed var

    score : AveragingFilter[];

    width : number; 
    height : number; 
    
    stillnessThresh : number; //found via experimentation

    //keep track of for debugging. may need to adjust for skeleton -- close or far to the camera
    maxDx : number; 
    maxDy : number;

    distanceOutBufferSize : number;
    shortBufferSizeXY : number = 4; 
    shortBufferSizeWinVar : number = 2; 

    windowedVarianceDistanceX : AveragingFilter[]; 
    windowedVarianceDistanceY : AveragingFilter[]; 


     minConfidence : number; 
     part : string[];

    constructor(avgSz : number = 12, avgOutBufferSize : number = 2, width=640, height=480)
    {
        this.stillnessThresh = 0.9; //found via experimentation Oct. 21

        this.x = [];
        this.y = []; 
        this.score = [];
        this.part = [];

        this.xDx = [];
        this.yDx = [];

        this.distanceForWindowedVar = [];
        this.distance = []; 

        this.scaledX = [];
        this.scaledY = [];
    
        this.scaledxDx = []; 
        this.scaledyDx = [];

        this.width = width; 
        this.height = height; 

        this.maxDx = 0; 
        this.maxDy = 0;

        
        this.xDxNOStill = [];
        this.yDxNOStill = [];
        this.xShort = [];
        this.yShort = []; 
        this.xShortDx = []; 
        this.yShortDy = []; 

        //for how many distance values to keep. need for the variance
        this.distanceOutBufferSize = 12; //try this as a ceiling, perhaps it is a ratio with this, or need to send in the fps
        this.windowedVarianceDistanceX = [];
        this.windowedVarianceDistanceY = [];


        this.minConfidence = 0.4;

        for(let i=0; i<PoseIndex.posePointCount; i++)
        {
            this.x.push(new AveragingFilter(avgSz, avgOutBufferSize));
            this.y.push(new AveragingFilter(avgSz, avgOutBufferSize));
            this.score.push(new AveragingFilter(avgSz, avgOutBufferSize));
            this.part.push(""); 

            this.xDx.push(new Derivative(avgSz, avgOutBufferSize));
            this.yDx.push(new Derivative(avgSz, avgOutBufferSize));

            //the windowed var actually is better w/a shorter filter in this application, TODO: put in terms of fps
            this.xDxNOStill.push(new Derivative(1, avgOutBufferSize)); //probably will deelte these extra x & y's during a refactor, fixed the thing that made me create so many
            this.yDxNOStill.push(new Derivative(1, avgOutBufferSize));
            this.xShort.push(new AveragingFilter(this.distanceOutBufferSize, avgOutBufferSize));
            this.yShort.push(new AveragingFilter(this.distanceOutBufferSize, avgOutBufferSize));
            this.xShortDx.push(new Derivative(2, avgOutBufferSize));
            this.yShortDy.push(new Derivative(2, avgOutBufferSize));

            //try just making window size smaller for this measure
            this.distanceForWindowedVar.push( new AveragingFilter(1, this.distanceOutBufferSize) );
            this.distance.push( new AveragingFilter(avgSz, avgOutBufferSize) ); //normal one for this application

            this.scaledX.push(new AveragingFilter(avgSz, avgOutBufferSize));
            this.scaledY.push(new AveragingFilter(avgSz, avgOutBufferSize));
        
            this.scaledxDx.push(new Derivative(avgSz, avgOutBufferSize)); 
            this.scaledyDx.push(new Derivative(avgSz, avgOutBufferSize));

            this.windowedVarianceDistanceX.push(new AveragingFilter(this.distanceOutBufferSize, avgOutBufferSize)); //fix
            this.windowedVarianceDistanceY.push(new AveragingFilter(this.distanceOutBufferSize, avgOutBufferSize)); //fix

        }

    }

    setMinConfidence(score : number) : void
    {
      this.minConfidence = score; 
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
            this.x[i].setWindowSize(sz, buffer2Size); 
            this.y[i].setWindowSize(sz, buffer2Size); 
            this.score[i].setWindowSize(sz, buffer2Size); 

            this.xDx[i].setWindowSize(sz, buffer2Size); 
            this.yDx[i].setWindowSize(sz, buffer2Size); 


            this.distance[i].setWindowSize(sz, buffer2Size); //normal


            this.xDxNOStill[i].setWindowSize(1, buffer2Size);
            this.yDxNOStill[i].setWindowSize(1, buffer2Size);
            this.xShort[i].setWindowSize(this.distanceOutBufferSize, buffer2Size);
            this.yShort[i].setWindowSize(this.distanceOutBufferSize, buffer2Size);

            // this.distanceOutBufferSize = sz;
            this.distanceForWindowedVar[i].setWindowSize(1, this.distanceOutBufferSize); //fix?
            this.windowedVarianceDistanceX[i].setWindowSize(this.distanceOutBufferSize, buffer2Size); 
            this.windowedVarianceDistanceY[i].setWindowSize(this.distanceOutBufferSize, buffer2Size); 

        }
    }

    update( keypoints : any[] ) : void
    {
        if( keypoints == null ) return; 
        let scaledKeypoints = PoseMatch.reScaleTo1(keypoints, this.width, this.height);

        let avgDx : number = 0; 
        let avgDy : number = 0; 


        for(let i=0; i<keypoints.length; i++){
            const keypoint = keypoints[i];
            const { y, x } = keypoint.position;
            this.part[i] = keypoint.part;

            this.x[i].update(x); 
            this.y[i].update(y);
            this.score[i].update(keypoint.score);


            if( keypoint.score > this.minConfidence )
            {


                //normalize
                this.xShort[i].update((x / this.width)*100); 
                this.yShort[i].update((y /this.height)*100);
                this.xShortDx[i].update(this.xShort[i].getNextWithShorterWindow(this.shortBufferSizeXY));
                this.yShortDy[i].update(this.yShort[i].getNextWithShorterWindow(this.shortBufferSizeXY));


                this.scaledX[i].update( scaledKeypoints[i].position.x ); 
                this.scaledY[i].update( scaledKeypoints[i].position.y ); 

                this.xDx[i].updateWithStillnessThresh( this.x[i].top(), this.stillnessThresh );
                this.yDx[i].updateWithStillnessThresh( this.y[i].top(), this.stillnessThresh ); 

                this.xDxNOStill[i].updateWithStillnessThresh( this.xShort[i].top(), this.stillnessThresh  );
                this.yDxNOStill[i].updateWithStillnessThresh( this.yShort[i].top(), this.stillnessThresh  );
    

                this.scaledxDx[i].update(this.scaledX[i].top());
                this.scaledyDx[i].update(this.scaledY[i].top());

                if( this.xShortDx[i].length() > 1 )
                {
                    //took longer to do the correct conversion than to just implement my own dist.


                    // let distb4Sqrt : number = xs*xs + xy*xy; 
                    // let dist = Math.sqrt(distb4Sqrt); 

                    //

                    // this.distanceForWindowedVar[i].update( dist ); //ok, this is distance but just the magnititude btw positions. Its still pretty good.
                    
                    
                    this.windowedVarianceDistanceX[i].update( math.variance( this.xShortDx[i].getOutputContents() ) ); 
                    this.windowedVarianceDistanceY[i].update( math.variance( this.xShortDx[i].getOutputContents() ) ); 

                    //distance for touch
                    let dist2 = this.getDist(this.xDx[i].top(), this.yDx[i].top());
                    this.distance[i].update( dist2 );
                }   
            }
            else 
            {   
                // this.xDx[i].updateWithStillnessThresh( 0, this.stillnessThresh );
                // this.yDx[i].updateWithStillnessThresh( 0, this.stillnessThresh );

                avgDx += this.xDx[i].top(); 
                avgDy += this.yDx[i].top(); 
                this.windowedVarianceDistanceX[i].update(0); //since this is a measure of movement, it should set to 0... hmm maybe dx & dy as well
                this.windowedVarianceDistanceY[i].update(0); //since this is a measure of movement, it should set to 0... hmm maybe dx & dy as well
            }
        }

        avgDx /= keypoints.length; 
        avgDy /= keypoints.length; 

        if( avgDx > this.maxDx )
            this.maxDx = avgDx; 

        if( avgDy > this.maxDy  )
            this.maxDy = avgDy; 
    }

    getWindowedVariance(index:number) : number
    {
         let x = this.windowedVarianceDistanceX[index].getNextWithShorterWindow(this.shortBufferSizeWinVar);
         let y = this.windowedVarianceDistanceX[index].getNextWithShorterWindow(this.shortBufferSizeWinVar);
         return (x + y) / 2;
    }

    getDist(dx : number, dy : number) : number
   {
        let distb4Sqrt : number = (dx*dx) + (dy*dy); 
        let dist = Math.sqrt(distb4Sqrt); 

        return dist; 
    }

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

    getTopDx(i : number) : number
    {
        return this.xDx[i].top();
    }

    getTopDy(i : number) : number
    {
        return this.yDx[i].top();
    }

    top()
    {
        let keypoints : any[] = [];

        for(let i=0; i<PoseIndex.posePointCount; i++)
        {
            var keypoint = { position: {y: this.getTopY(i), x: this.getTopX(i)}, score: this.score[i].top(), part:this.part[i] };
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

    getScaledDXBuffer() : Derivative[]
    {
        return this.scaledxDx; 
    }

    getScaledDYBuffer() : Derivative[]
    {
        return this.scaledyDx; 
    }

    getY( i : number )
    {
        return this.y[i].getOutputContents(); 
    }

    getDX( i : number )
    {
        return this.xDx[i].getOutputContents(); 
    }

    getDY( i : number )
    {
        return this.yDx[i].getOutputContents(); 
    }

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
    getAvgScore(index) : number
    {
        return this.score[index].top(); 
    }

}

