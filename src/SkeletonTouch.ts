import * as PoseIndex from './poseConstants.js';
import type {WhereTouch} from './skeletonIntersection'

//represents one touch between 2 skeletons
export class SkeletonTouch
{
    touching : boolean; 
    prevTouching : boolean = false;//touching before last update?

    //these are arrays of indices into keypoints
    indicesTouching : Array<Array<number>>;
    startedTouching : number;
    
    //for a specific mapping in the music.
    positionWhereTouch : { x:number, y:number } = {x:-1, y:-1}; 
    distanceFrom : number = -1;
    // minYTouchIndex : number = -1; 

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
        // if( pt.y > 0 && (this.minYTouch < pt.y || this.minYTouch < 0 ) )
        // {
        //     this.minYTouch = pt.y;
        //     this.minYTouchIndex = this.indicesTouching.length-1; 
        // }
        // console.log("touching!"); 
        // console.log(this.indicesTouching); 
    }

    //try this for now.
    removeAllTouches()
    {
        this.indicesTouching = []; 
    }


    addWhereTouch(whereTouch : WhereTouch)
    {
        //dummy values
        this.positionWhereTouch = whereTouch.intersectPoint;
        this.distanceFrom = whereTouch.dist; 
        for(let i=0; i<whereTouch.myIndex.length; i++)
        {
            this.addTouch( whereTouch.myIndex[i], whereTouch.theirIndex[i] ); 
        }
    }

    getTouchPosition() : {x: number, y: number}
    {
        return this.positionWhereTouch; 
    }

    getDistanceFrom() : number
    {
        return this.distanceFrom; 
    }

    indexOf(mine:number, theirs:number) : number
    {
        let tuple  : Array<number>; 
        tuple = [mine, theirs];
        const isInArray = (element) => element[0] === mine && element[1] === theirs;
        return this.indicesTouching.findIndex( isInArray );
    }

    //update minY touching


    //set to not touching
    removeTouch(mine:number, theirs:number)  : void
    {
        let index = this.indexOf(mine, theirs); 
        if( index !== -1 ){
            this.indicesTouching.splice(index, 1);
            // if( index === this.minYTouchIndex )
            // {
            //     this.updateMinYTouching(); 
            // }
        }
    }

    //these are the keypoints of the intersecting limbs
    getTouchingKeypoints()
    {
        return this.indicesTouching; 
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