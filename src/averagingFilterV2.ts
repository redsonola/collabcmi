import * as math from 'mathjs';
import { CircularBuffer } from './circularBuffer';

export class UGEN
{
    windowSize : number; 
    buffer2Size : number; 
    buffer : CircularBuffer<number>;
    outBuffer : CircularBuffer<number>;

    constructor( sz : number = 16, buffer2Size : number = 16  )
    {
        this.windowSize = sz;
        this.buffer2Size = buffer2Size;
        this.buffer = new CircularBuffer(sz);
        this.outBuffer = new CircularBuffer(buffer2Size); //most recent averaged 8

    }

    setWindowSize( sz : number, buffer2Size : number = 8  ) : void {
        this.windowSize = sz;
        this.buffer2Size = buffer2Size;
        this.buffer.setWindowSize(sz); 
        this.outBuffer.setWindowSize(buffer2Size); 
    }

    update( s : number ) : void {
        this.buffer.add(s);
        
    }

    at(index: number) : number
    {
        return this.outBuffer.at(index);
    }

    getContents(sz : number = -1) : number[]
    {
        if(sz == -1 || sz >= this.buffer.length())
            return this.buffer.getContents();
        else 
        {
            let out = this.buffer.getContents();
            for(let i=0; i<out.length-sz; i++)
                out.shift();
            return out; 
        }
    }

    length() : number
    {
        return this.outBuffer.length(); 
    }

    inputLength() : number
    {
        return this.buffer.length(); 
    }

    getOutputContents(sz : number = -1) : number[]
    {
        if(sz == -1 || sz >= this.outBuffer.length()){

            // if(sz > this.outBuffer.length()) 
            // {
            //     console.log("UGEN: Warning! Asked for " + sz.toString() + "but only have " + this.outBuffer.length().toString());
            // }
            return this.outBuffer.getContents();
        }
        else 
        {
            let out = this.outBuffer.getContents();
            for(let i=0; i<out.length-sz; i++)
            {
                out.shift();
            }
            return out; 
        }
    }

    getNext() : number {
        return 0; 
    }

    input_top() : number
    {
        if( this.buffer.length() > 0 )
            return this.buffer.top(); 
        else return 0; 
    }

    top() : number
    {
        return this.outBuffer.top(); 
    }
}

export class AveragingFilter extends UGEN {

    constructor( sz : number = 8, buffer2Size : number = 16 )
    {
        super(sz, buffer2Size);
    }

    //just current total average of the filter
    getNext() : number {

        if (this.getContents().length > 0) {
            let mean : number = math.mean(this.getContents());
            console.assert(!isNaN(mean)); 
            return mean; 
        }
        else return 0;
    }

    update( s : number ) : void {
        console.assert(!isNaN(s)); 
        super.update(s);
        this.outBuffer.add(this.getNext());
    }

}   

export class Derivative extends UGEN 
{

    constructor(sz : number = 8, outBufferSize : number = 16)
    {
        super(sz, outBufferSize);
    }

    update( s : number ) : void {
        if(this.buffer.length() > 0 ){
            this.outBuffer.add(s - this.input_top());
        }
        super.update(s);
    }

    updateWithStillnessThresh(s : number, thresh : number)
    {
        if(this.buffer.length() > 0 ){
            let res : number;
            res = s - this.input_top();

            if(res < thresh && res > -thresh)
            { 
                res = 0; 
            }
            else if(res < 0)
            {
                res = res + thresh; 
            }
            else
            {
                res = res - thresh; 
            }

            console.assert(!isNaN(thresh));
            console.assert(!isNaN(this.input_top())); 
            console.assert(!isNaN(s)); 
            console.assert(!isNaN(res)); 

            this.outBuffer.add(res);
        }
        console.assert(!isNaN(s)); 
        super.update(s);

    }

}

