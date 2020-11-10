//Programmer: Courtney Brown, June 2020
//This class is your basic cyclical buffer of size -- window size

export class CircularBuffer {
    constructor(windowSize = 24) {
        this.windowSize = windowSize; 
        this.buffer = [];
    }

    add(data)
    {
        this.buffer.push(data); 

        if( this.buffer.length > windowSize )
        {
            this.buffer.shift(); 
        }
    }

    pop()
    {
        return this.buffer.pop();
    }

    at(index)
    {
        return this.buffer[index];
    }
}

