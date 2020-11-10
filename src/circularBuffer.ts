//Programmer: Courtney Brown, June 2020
//This class is your basic cyclical buffer of size -- window size

export class CircularBuffer<T> {
    windowSize : number; 
    buffer : T[]; 
    constructor(windowSize: number = 8) {
        this.windowSize = windowSize; 
        this.buffer = [];
    }

    add(data : T) : void
    {
        this.buffer.push(data); 

        while( this.buffer.length > this.windowSize )
        {
            this.buffer.shift(); 
        }
    }

    setWindowSize(n : number) : void
    {
        this.windowSize = n; 

        //reduce to the lower window size immediately.
        while( this.buffer.length > this.windowSize )
        {
            this.buffer.shift(); 
        }
    }

    top() : T
    {
        return this.buffer[this.buffer.length-1];
    }

    at(index: number) : T
    {
        return this.buffer[index];
    }

    getContents() : T[]
    {
        return this.buffer;
    }

    length() : number
    {
        return this.buffer.length; 
    }
}

