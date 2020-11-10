import * as math from 'mathjs';


export class movingAverageSampleSize
{
    windowSize : number; 
    // buffer : CircularBuffer<number>;
    // outBuffer : CircularBuffer<number>;

    constructor( sz : number = 16, buffer2Size : number = 16  )
    {
        this.windowSize = sz;
        // this.buffer = new CircularBuffer(sz);
        // this.outBuffer = new CircularBuffer(buffer2Size); //most recent averaged 8

    }
}