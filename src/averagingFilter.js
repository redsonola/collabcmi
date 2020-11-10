import * as math from 'mathjs';


var sig = []; 
var windowSize = 16; 

export function setWindowSize(sz)
{
    windowSize = sz; 
}

export function add(s)
{
    sig.push(s); 

    if(sig.length>windowSize)
    {
        sig.shift();
    }
}

export function getAvg()
{
    if(sig.length>0){
        var av = math.mean(sig);
        if(av == 0.0){
            return 0;
        }
        else return av; 
    }
    else return 0; //ok put this hack outside. 
}