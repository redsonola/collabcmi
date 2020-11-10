

export function linear_scale(in1 : number, inMin : number, inMax: number, outMin: number, outMax: number, flipIt : boolean = false) : number
{
    //take it to 0. to 1.
    let output = (in1 - inMin) / (inMax - inMin);

    //flip it
    if(flipIt)
    {
        //clamp to 1. &  0. for the flip
        if(output > 1.) output = 1.; 
        if(output < 0.) output = 0.

        //actually flip
        output = 1. - output;
    }

    //put it into the new scale
    output = (output  * ( outMax - outMin) ) + outMin; 

    //clamp to min and max
    if(output > outMax) output = outMax
    else if(output < outMin ) output = outMin; 

    return output; 

}


export function exp_scale(in1 : number, inMin : number, inMax: number, outMin: number, outMax: number) : number
{
    let lo = -2; 
    let hi = 1; 

    //take it to 0.001 to 1.
    let out = linear_scale(in1, inMin, inMax, lo, hi);
    out= 10**out; 

    //put it into the new scale
    let output = linear_scale(out, 10**lo, 10**hi, outMin, outMax);

    //clamp to min and max
    if(output > outMax) output = outMax
    else if(output < outMin ) output = outMin; 

    return output; 
}

export function log_scale(in1 : number, inMin : number, inMax: number, outMin: number, outMax: number) : number
{
    let lo = 0; 
    let hi = 1000; 

    //take it to 0.001 to 1.
    let out = linear_scale(in1, inMin, inMax, lo, hi);
    out= Math.log(out); 

    //put it into the new scale
    let output = linear_scale(out, Math.log( lo ) , Math.log( hi ) , outMin, outMax);

    //clamp to min and max
    if(output > outMax) output = outMax
    else if(output < outMin ) output = outMin; 

    return output; 
}