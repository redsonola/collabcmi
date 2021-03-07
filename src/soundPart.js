import * as Tone from "tone";
import * as avgFilter from "./averagingFilter.js"; //this starts initialized. 
import * as math from 'mathjs';

var fatOsc = null;
const hiCloseUp = 10.0; 
var volume = new Tone.Volume(-12);
var synth = new Tone.Synth().toDestination();
var samplesToChangeVol = 6; 
var curSamples = 0; 

var started = false; 

var volumeSignal; 
var norm;
var expNormVol;
var mult;
var sig; 

export function startSound()
{
    // fatOsc = new Tone.FatOscillator("Ab3", "sine", 40);

    // curPitch = "Ab3"; 
    // synth = new Tone.Synth().toMaster();
    synth = new Tone.FatOscillator("Ab3", "sine", 2).toDestination();
    // norm = new Tone.Normalize(-35, 60);
    // expNormVol = new Tone.ScaleExp(-35, 60, 1);
    // volumeSignal = new Tone.Signal(0).connect(expNormVol); 
    // mult = new Tone.Multiply();
    // synth.connect(mult, 0, 0);
    // expNormVol.connect(mult, 0, 1);
    // mult.toMaster(); 



    // synth.chain(expNormVol, Tone.Master); 



    // synth.chain(volume, Tone.Master);
}

export function playSound(noseLocation, volumeMod)
{
    if(synth == null) return; 

    if(!started)
    {
        synth.start();
        started = true; 
    }

    //change the pitch based on noseLocation along x axis, so scale pixels into midi
    const lownote = 48; //a low C
    const highnote = 84; //a high C; 
    const inputHigh = window.screen.availWidth; 
    var midiNote = noseLocation/window.screen.availWidth; // convert 0. to 1. 
    midiNote = (midiNote * (highnote-lownote)) + lownote; //convert to lownote to highnote, linearly.

    //create a synth and connect it to the master output (your speakers)
    // const synth = new Tone.Synth().toMaster();

    //play a middle 'C' for the duration of an 8th note
    // synth.triggerAttack(Tone.Frequency(midiNote, "midi").toNote());

    //create a fat osc -- a detuned spread
    //-20 to 100
    var lowVol = -30; 
    var hiVol = 50; 
    var vol = ((volumeMod/hiCloseUp) * (hiVol-lowVol)) + lowVol;
    if(vol > 30)  vol = 30; // for now


    avgFilter.add(vol);

    if(curSamples == 0)
    {
        var newVol = avgFilter.getAvg(); //math.round(avgFilter.getAvg()); 
        console.log(newVol); 
        // volumeSignal.rampTo(-60);
        //console.log(expNormVol); 


        synth.volume.rampTo (newVol);
        // synth.volume.rampTo (expNormVol.value);
        // console.log(expNormVol.getValueAtTime());

    }
    curSamples++; 
    if(curSamples > samplesToChangeVol)
    {
        curSamples = 0; 
    }

    // console.log(midiNote); 

    // synth.setNote(Tone.Frequency(midiNote, "midi").toNote());
    synth.frequency.rampTo(Tone.Frequency(midiNote, "midi"));


    // var newNote = Tone.Frequency(midiNote, "midi").toNote(); 
    // if(newNote != curPitch){
    //     synth.frequency.rampTo(newNote);
    //     curPitch = newNote;  
    // }
}

