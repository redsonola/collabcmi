import { CircularBuffer } from './circularBuffer';
import { AveragingFilter, UGEN, Derivative } from './averagingFilterV2';
import * as PoseIndex from './poseConstants.js';
import * as math from 'mathjs'
import * as PoseMatch from './poseMatching';

//represents one touch between 2 skeletons
export class SkeletonTouch
{
    touching : boolean; 
    prevTouching : boolean = false;//touching before last update?

    //these are arrays of indices into keypoints

    indicesTouching : Array<Array<number>>;

    startedTouching : number; 

    constructor()
    {
        this.touching = false; 
        this.indicesTouching = [];
        this.startedTouching = 0; 
    }

    reset()
    {
        this.startedTouching = 0; 
        this.indicesTouching = [];
    }

    //expecting keypoints for each
    addTouch(mine:number, theirs:number) : void
    {
        let index = this.indexOf(mine, theirs); 
        if( index === -1 )
        {
            this.indicesTouching.push( [mine, theirs] );
            if(this.startedTouching === 0)
            {
                this.startedTouching = performance.now();
            }
        }
        // console.log("touching!"); 
        // console.log(this.indicesTouching); 
    }

    indexOf(mine:number, theirs:number) : number
    {
        let tuple  : Array<number>; 
        tuple = [mine, theirs];
        const isInArray = (element) => element[0] === mine && element[1] === theirs;
        return this.indicesTouching.findIndex( isInArray );
    }

    //set to not touching
    removeTouch(mine:number, theirs:number)  : void
    {
        let index = this.indexOf(mine, theirs); 
        if( index !== -1 )
            this.indicesTouching.splice(index, 1);
    }

    updateTouching() : void
    {
        this.prevTouching = this.touching; 
        this.touching = this.indicesTouching.length > 0;
        if( !this.touching )
        {
            this.startedTouching = 0; 
        }
    }

    areTouching() : boolean
    {
        return this.touching; 
    }

    justStartedTouching() : boolean
    {
        return ( !this.prevTouching && this.touching ); 
    }

    justStoppedTouching() : boolean
    {
        return(  this.prevTouching && !this.touching );
    }

    howLong()
    {
        if(this.touching)
            return (performance.now() - this.startedTouching ) / 1000.0; //just return seconds for now 
        else return 0; 
    }

    whereTouching() : any[]
    {
        return this.indicesTouching;
    }

    //percent of total skeleton touching, disregarding confidence at the moment
    howMuchTouching() : number
    {
        return this.indicesTouching.length / PoseIndex.posePointCount;
    }

}


//a class that averages all the pose keypoints and keeps them all handy.
//try drawing these instead to test
export class AverageFilteredKeyPoints 
{

    x : AveragingFilter[];
    y : AveragingFilter[];

    xDx : Derivative[]; 
    yDx : Derivative[];
    
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

    windowedVarianceDistance : AveragingFilter[]; //maybe don't take the average for now

    minConfidence : number; 
    part : string[];

    constructor(avgSz : number = 12, avgOutBufferSize : number = 2, width=640, height=480)
    {
        this.stillnessThresh = 0.9; //found via experimentation Oct. 21

        this.x = [];
        this.y = []; 
        this.score = [];
        this.part = []

        this.xDx = [];
        this.yDx = [];

        this.distance = [];

        this.scaledX = [];
        this.scaledY = [];
    
        this.scaledxDx = []; 
        this.scaledyDx = [];

        this.width = width; 
        this.height = height; 

        this.maxDx = 0; 
        this.maxDy = 0;

        //for how many distance values to keep. need for the variance
        this.distanceOutBufferSize = avgSz; //try this, perhaps it is a ratio with this, or need to send in the fps
        this.windowedVarianceDistance = [];

        this.minConfidence = 0.35;

        for(let i=0; i<PoseIndex.posePointCount; i++)
        {
            this.x.push(new AveragingFilter(avgSz, avgOutBufferSize));
            this.y.push(new AveragingFilter(avgSz, avgOutBufferSize));
            this.score.push(new AveragingFilter(avgSz, avgOutBufferSize));
            this.part.push(""); 

            this.xDx.push(new Derivative(avgSz, avgOutBufferSize));
            this.yDx.push(new Derivative(avgSz, avgOutBufferSize));

            this.distance.push( new AveragingFilter(avgSz, this.distanceOutBufferSize) );

            this.scaledX.push(new AveragingFilter(avgSz, avgOutBufferSize));
            this.scaledY.push(new AveragingFilter(avgSz, avgOutBufferSize));
        
            this.scaledxDx.push(new Derivative(avgSz, avgOutBufferSize)); 
            this.scaledyDx.push(new Derivative(avgSz, avgOutBufferSize));

            this.windowedVarianceDistance.push(new AveragingFilter(avgSz, avgOutBufferSize)); //fix
        }

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

            this.distanceOutBufferSize = sz/2;
            this.distance[i].setWindowSize(sz, this.distanceOutBufferSize); //fix?
            this.windowedVarianceDistance[i].setWindowSize(sz, buffer2Size); 
        }
    }

    setMinConfidence(score : number) : void
    {
        this.minConfidence = score; 
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
            this.part[i] = keypoint.part; //todo: make so I only add this once sigh

            if( keypoint.score > this.minConfidence ) //dear god take in a minConfidence score instead of this hardcoded bs
            {
                this.x[i].update(x); 
                this.y[i].update(y);
                this.score[i].update(keypoint.score); 

                this.scaledX[i].update( scaledKeypoints[i].position.x ); 
                this.scaledY[i].update( scaledKeypoints[i].position.y ); 

                this.xDx[i].updateWithStillnessThresh( this.x[i].top(), this.stillnessThresh );
                this.yDx[i].updateWithStillnessThresh( this.y[i].top(), this.stillnessThresh );

                this.scaledxDx[i].update(this.scaledX[i].top());
                this.scaledyDx[i].update(this.scaledY[i].top());

                if( this.x[i].length() > 1 )
                {
                    // //took longer to do the correct conversion than to just implement my own dist.
                    // let distb4Sqrt : number = this.xDx[i].top()*this.xDx[i].top() + this.yDx[i].top()*this.yDx[i].top(); 
                    // let dist = Math.sqrt(distb4Sqrt); 

                    let dist = this.getDist(this.xDx[i].top(), this.yDx[i].top());

                    this.distance[i].update( dist );
                    this.windowedVarianceDistance[i].update(math.variance( this.distance[i].getOutputContents() )); 
                }   
            }
            else 
            {   
                // this.xDx[i].updateWithStillnessThresh( 0, this.stillnessThresh );
                // this.yDx[i].updateWithStillnessThresh( 0, this.stillnessThresh );

                avgDx += this.xDx[i].top(); 
                avgDy += this.yDx[i].top(); 
                this.windowedVarianceDistance[i].update(0); //since this is a measure of movement, it should set to 0... hmm maybe dx & dy as well
            }
        }

        avgDx /= keypoints.length; 
        avgDy /= keypoints.length; 

        if( avgDx > this.maxDx )
            this.maxDx = avgDx; 

        if( avgDy > this.maxDy  )
            this.maxDy = avgDy; 
    }

    getDist(dx : number, dy : number) : number
    {
        let distb4Sqrt : number = (dx*dx) + (dy*dy); 
        let dist = Math.sqrt(distb4Sqrt); 

        return dist; 
    }

    getWindowedVariance(index:number) : number
    {
        return this.windowedVarianceDistance[index].top();
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

    getDXBuffer() : AveragingFilter[]
    {
        return this.xDx; 
    }

    getDYBuffer() : AveragingFilter[]
    {
        return this.yDx; 
    }

    getScaledDXBuffer() : AveragingFilter[]
    {
        return this.scaledxDx; 
    }

    getScaledDYBuffer() : AveragingFilter[]
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

    //TODO: how much of the body & also for how long (scale?)
    //Then -- how fast before the touch? prob just windowedvar @ touch 
    //Then refine the touch measure so is less crude -- ie now it is just distance btw. keypoints but prob need to look at distance from skeleton/connecting line
    touching( keypointToTest: any, minDistanceTouching: number, sTouch: SkeletonTouch, w:number, h:number, 
        theirW:number, theirH:number, index:number, iAmSecond: boolean=false ) : SkeletonTouch
    {

        //TODO: ok this should be a passed in value -- but it is passed in via draw3js.ts line 84 
        let percentXOver = 0.66; 

       if( sTouch === undefined )
       {
           sTouch = new SkeletonTouch();
       }
       
        let {y:ty, x:tx } = keypointToTest.position; 
        let scaledTx = 1-( tx / theirW );
        if(!iAmSecond)
        {
            scaledTx -= percentXOver; //move the friend over, since that is the one that will be offset
        }
        let scaledTy = ty / theirH;

        let keypoints : any = this.top(); 

        let minConfidence = 0.4; //testing new minconfidences.
        

        for(let i=0; i<keypoints.length; i++){
            const keypoint = keypoints[i];
            const { y, x } = keypoint.position;
            let scaledX = 1-( x / w ); //x is flipped 
            if(iAmSecond)
            {
                scaledX -= percentXOver;
            }

            let scaledY = y / h;
            const score = keypoint.score; 

            // if(score >= minConfidence && keypointToTest.score >= minConfidence ){
            //     console.log( keypointToTest.part+ " scaledTx:" + scaledTx );//+ " scaledY:" + scaledY);
            // }

            let dist = this.getDist(scaledTx-scaledX, scaledTy-scaledY);
            if( dist < minDistanceTouching  && score >= minConfidence && keypointToTest.score >= minConfidence )
            {
                sTouch.addTouch( i, index );

                // console.log( "touching! dist: " + dist + " scaledX:" + scaledX + " scaledY:" + scaledY + 
                // " scaledTx:" + scaledTx + " scaledTy:" + scaledTy + " my index: " + keypoint.part + " their index: " + keypointToTest.part ); 

            //     console.log( "touching! dist: " + dist + " my score:" + score + " their score:" + keypointToTest.score + 
            //     " my index: " + keypoint.part + " their index: " + keypointToTest.part ); 

            //    console.log( "scaledX:" + scaledX + " scaledY:" + scaledY + 
            //     " scaledTx:" + scaledTx + " scaledTy:" + scaledTy + " my index: " + keypoint.part + " their index: " + keypointToTest.part ); 

 
            }
            else
            {
                sTouch.removeTouch( i, index );

                // console.log( "NOT TOUCHING! dist: " + dist + " scaledX:" + scaledX + " scaledY:" + scaledY + 
                // " scaledTx:" + scaledTx + " scaledTy:" + scaledTy + " my index: " + keypoint.part + " their index: " + keypointToTest.part ); 

            }
        }

        return sTouch; 

    }

}

