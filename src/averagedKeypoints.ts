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

    constructor(avgSz : number = 12, avgOutBufferSize : number = 2, width=640, height=480)
    {
        this.stillnessThresh = 0.9; //found via experimentation Oct. 21

        this.x = [];
        this.y = []; 
        this.score = [];

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

        for(let i=0; i<PoseIndex.posePointCount; i++)
        {
            this.x.push(new AveragingFilter(avgSz, avgOutBufferSize));
            this.y.push(new AveragingFilter(avgSz, avgOutBufferSize));
            this.score.push(new AveragingFilter(avgSz, avgOutBufferSize));

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

    update( keypoints : any[] ) : void
    {
        if( keypoints == null ) return; 
        let scaledKeypoints = PoseMatch.reScaleTo1(keypoints, this.width, this.height);

        let avgDx : number = 0; 
        let avgDy : number = 0; 


        for(let i=0; i<keypoints.length; i++){
            const keypoint = keypoints[i];
            const { y, x } = keypoint.position;

            if( keypoint.score > 0.35 )
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
                    //took longer to do the correct conversion than to just implement my own dist.
                    let distb4Sqrt : number = this.xDx[i].top()*this.xDx[i].top() + this.yDx[i].top()*this.yDx[i].top(); 
                    let dist = Math.sqrt(distb4Sqrt); 

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
            var keypoint = { position: {y: this.getTopY(i), x: this.getTopX(i)}, score: this.score[i].top() };
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

}

