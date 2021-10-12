import * as Scale  from './scale'
import { clone } from "lodash";

//old
// export const scaleDataClose = require('./dataAnalysisForScaling/eyeDistanceCloseDataFrame1Analysis.json');
// export const scaleDataMedium = require('./dataAnalysisForScaling/eyeDistanceMediumDataFrame1Analysis.json');

//new
import scaleDataClose2 from './dataAnalysisForScaling/eyeDistanceCloseDataFrame1Analysis2.json';
import scaleDataFar from './dataAnalysisForScaling/eyeDistanceFarDataFrame1Analysis.json';
import scaleDataMedium2 from './dataAnalysisForScaling/eyeDistanceMediumDataFrameAnalysis2.json';

//for midi play. windowedVar actually seems like a good 0 to 1 (ish)
import midiSynchDxData from './dataAnalysisForScaling/midiSynchScoreAndDx_noOutliers.json'; 
export { scaleDataClose2, scaleDataFar, scaleDataMedium2, midiSynchDxData };

const UPPER_LIMIT = 0.7; 

function getScaleData( eyeDistance : number )
{
    //old data
    const eyeDistanceClose : number = 73;
    const eyeDistanceMedium : number = 27;

    //new data
    const eyeDistanceClose2 : number = 81;
    const eyeDistanceMedium2 : number = 20.482;
    const eyeDistanceFar : number = 11.99

    // console.log(eyeDistance); 

    if( eyeDistance >= eyeDistanceClose2 )
    {
        return scaleDataClose2; 
    }
    else if( eyeDistance <= eyeDistanceFar )
    {
        return scaleDataFar; 
    }
    else if (eyeDistance === eyeDistanceMedium2)
    {
        return scaleDataMedium2;
    }
    else if( eyeDistance < eyeDistanceClose2 && eyeDistance > eyeDistanceMedium2 )
    {
        //TODO: refactor
        let percentage = Scale.linear_scale( eyeDistance, eyeDistanceMedium2, eyeDistanceClose2, 0, 1 );
        let scale = clone( scaleDataMedium2 );

        let scaleArrays : number[][] = Object.values(scale);
        let closeArrays : number[][] = Object.values(scaleDataClose2);

        for( let i=0; i<scaleArrays.length; i++ )
        {
            let curArray = scaleArrays[i];
            let curCloseArray = closeArrays[i]; 
            for( let j=0; j<curArray.length; j++ )
            {
                curArray[j] = curArray[j] + curCloseArray[j] * percentage;
            }
        }
        return scale; 
    }
    else //eyeDistance must be between medium and far
    {
        let percentage = Scale.linear_scale( eyeDistance, eyeDistanceFar, eyeDistanceMedium2, 0, 1 );
        let scale = clone( scaleDataFar );

        let scaleArrays : number[][] = Object.values(scale);
        let closeArrays : number[][] = Object.values(scaleDataMedium2);

        for( let i=0; i<scaleArrays.length; i++ )
        {
            let curArray = scaleArrays[i];
            let curCloseArray = closeArrays[i]; 
            for( let j=0; j<curArray.length; j++ )
            {
                curArray[j] = curArray[j] + curCloseArray[j] * percentage;
            }
        }
        return scale; 
    }

}

//Note: this formula works for dx, dy but not sure about other parameters
function scaleIt( input: number, keypointIndex: number, typeData : string, scaleData : any )
{
    let propertyStringMedian = typeData + "Median";
    let propertyStringMean = typeData + "Mean";
    let propertyStringMax = typeData + "Max";
    let propertyStringMin = typeData + "Min";

    let output;

    if( input < scaleData[propertyStringMedian][keypointIndex] )
    {
        output = Scale.linear_scale(input,scaleData[propertyStringMin][keypointIndex], scaleData[propertyStringMean][keypointIndex], 0, 0.5 ); 
    }
    else
    {
        output = Scale.linear_scale(input, scaleData[propertyStringMean][keypointIndex], scaleData[propertyStringMean][keypointIndex]*2, 0.5, 1 ); 
        //output = Scale.linear_scale( output, 0.5, UPPER_LIMIT, 0.5, 1 ); 
    }

    return output; 
}
 
export function scaleDx(input : number, keypointIndex: number, curEyeDistance : number )
{
    let scaleData = getScaleData( curEyeDistance );
    return scaleIt( input, keypointIndex, "dx", scaleData );
}

export function scaleDy(input : number, keypointIndex: number, curEyeDistance : number  )
{
    let scaleData = getScaleData( curEyeDistance );
    return scaleIt( input, keypointIndex, "dy", scaleData );
}

export function scaleWindowedVarX(input : number, keypointIndex: number, curEyeDistance : number  )
{

    let scaleData = getScaleData( curEyeDistance );
    return scaleIt( input, keypointIndex, "winVarX", scaleData );}

export function scaleWindowedVarY(input : number, keypointIndex: number, curEyeDistance : number  )
{
    let scaleData = getScaleData( curEyeDistance );
    return scaleIt( input, keypointIndex, "winVarY", scaleData );
}

export function scaleAccelX(input : number, keypointIndex: number, curEyeDistance : number  )
{
    let scaleData = getScaleData( curEyeDistance );
    return scaleIt( input, keypointIndex, "jerkX", scaleData );
}

export function scaleAccelY(input : number, keypointIndex: number, curEyeDistance : number  )
{
    let scaleData = getScaleData( curEyeDistance );
    return scaleIt( input, keypointIndex, "jerkY", scaleData );
}

//this is with 140bpm, note: not scaling the min, since I think it is ok.
export function scaleMidiSynchScore( input : number ) : number
{
    return Scale.linear_scale(input, midiSynchDxData.synchScoreMin[0], midiSynchDxData.synchScoreMax[0], 0, 1); 
}

//this is with 140bpm, note: not scaling the min, since I think it is ok.
export function scaleMidiDxScore( input : number ) : number
{
    return Scale.linear_scale(input, midiSynchDxData.windowedVarScoreMin[0], midiSynchDxData.windowedVarScoreMax[0], 0, 1); 
}

export function getMidiFileMedianSynchScore() : number
{
    return midiSynchDxData.synchScoreMedian[0]; 
}

export function getMidiFileMaxSynchScore() : number
{
    return midiSynchDxData.synchScoreMax[0]; 
}

export function getMidiFileDxMax() : number
{
    return midiSynchDxData.windowedVarScoreMax[0]; 
}

export function getMidiFileSynchScoreMidwayBtwMaxAndMedian() : number
{
    return ( midiSynchDxData.synchScoreMax[0] + midiSynchDxData.synchScoreMedian[0] ) / 2; 
}

export function getMidiFileDxMidwayBtwMaxAndMedian() : number
{
    return ( midiSynchDxData.windowedVarScoreMax[0] + midiSynchDxData.windowedVarScoreMedian[0] ) / 2; 
}


