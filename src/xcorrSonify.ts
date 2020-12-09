/* 
    Sampler
    Tone.Player
    Convolver
    Reverb
    Tremelo
    Filter
*/

import * as Tone from "tone";
import { AveragingFilter } from "./averagingFilterV2"; //this starts initialized. 
import * as Scale from "./scale"
import type { Participant } from "./participant"
import * as PoseIndex from "./poseConstants"
import type { MainVolume } from "./midiConversion.js";
import type { Time } from "tone/build/esm/core/type/Units";

export class SonifierWithTuba {

    // lastCheckTime : number = 0;
    // lastCheckTimeVolume: number = 0;
    // loaded: boolean = false;
    // noteIndex : number = 0;
    // tubaNoteArray : string[][] = [];
    // // fanSample1 : Tone.Player; 

    // //have a different sample for each body part that is in synch
    // tubaSamplers : Tone.Sampler[] = []; 
    // convolver1s : Tone.Convolver[] =[];
    // convolver2s : Tone.Convolver[] = [];
    // compressors : Tone.Compressor[] = [];

    // avgFilter : AveragingFilter[] = [];

    // samplersLoaded : boolean = false; 

    participant : Participant;
    tubaSampler : Tone.Sampler; 
    masterCompressor : Tone.Compressor;
    convolver1 : Tone.Convolver;
    convolver2 : Tone.Convolver;
    samplersLoaded : boolean = false; 
    playingNote : number = -1;

    vibrato : Tone.Vibrato; 
    feedbackDelay : Tone.FeedbackDelay; 

    constructor( p : Participant, mainVolume : MainVolume ) {

        this.participant = p; 
        this.tubaSampler = this.loadTubaSampler();
        this.masterCompressor = new Tone.Compressor(-5, 1);

        //set up the signal chain for the fx/synthesis
        this.convolver1 = new Tone.Convolver("./fan_sounds/cng_fan1.wav");
        this.convolver2 =  new Tone.Convolver("./fan_sounds/fan4.wav") 
        // this.tubaSampler.chain(this.convolver1, this.convolver2, this.masterCompressor);
        this.vibrato = new Tone.Vibrato(0, 1); 
        this.feedbackDelay = new Tone.FeedbackDelay("4n", 0.25);

        this.tubaSampler.chain(this.convolver1, this.vibrato, this.feedbackDelay, this.masterCompressor);
        this.masterCompressor.connect(mainVolume.getVolume());
        this.tubaSampler.release = 0.25; 
        this.tubaSampler.curve = "exponential"; 

        // //set up the samplers
        // for(let i=0; i<PoseIndex.bodyPartArray.length; i++)
        // {
        //     this.tubaSamplers.push( this.loadTubaSampler() ); 
        //     this.convolver1s.push( new Tone.Convolver("./fan_sounds/cng_fan1.wav") );
        //     this.convolver2s.push( new Tone.Convolver("./fan_sounds/fan4.wav") );
        //     this.compressors.push( new Tone.Compressor(-5, 9) );
        //     this.connectSamplers( this.tubaSamplers[i], this.convolver1s[i], this.convolver2s[i], this.compressors[i], this.masterCompressor );
        //     this.avgFilter.push( new AveragingFilter(8, 2) );

        //     Tone.Destination.volume.rampTo(35); 
        // }

        // convolver2 = new Tone.Convolver(tubaSampler2); 
        //  fanSample1Reverb = new Tone.Freeverb();
        //  fanSample1Reverb.dampening.value = 1000;
        // fanSample2Reverb = new Tone.Freeverb().toMaster();
        // fanSample2Reverb.dampening.value = 1000;
        // fanSample2.chain(convolver2, fanSample2Reverb, Tone.Master );
    }

    loadTubaSampler()
    {
        let sampler : Tone.Sampler; 

        sampler = new Tone.Sampler({
            "F1": "041_Tuba_F1_Normal.wav",
            "A1": "045_Tuba_A1_Normal.wav",
            "C2": "048_Tuba_C2_Normal.wav",
            "E2": "052_Tuba_E2_Normal.wav",	
            "G2": "055_Tuba_G2_Normal.wav",
            "A2": "057_Tuba_A2_Normal.wav",
            "C3" : "060_Tuba_C3_Normal.wav",
            "D3" : "062_Tuba_D3_Normal.wav",
            "Eb3": "063_Tuba_Eb3_Normal.wav",
        },
        {
            baseUrl: "./Tuba_samples/Tuba_Long/Normal/"
        });

        return sampler; 
    }

    triggerAttack()
    {
        //for now pick a random note in key of C --> maybe put in melody, like in a midi file whatever.
        if( this.playingNote !== -1)
        {
            this.triggerRelease();
        }

        //note -- it could be not done releasing when I start the next note.
        //there is an error with the triggerAttack method in here. 
        //using try/catch to carry on but looking into it & also will do more sound design
        try
        {
            let keyOfCPitchClass4 = [ 72, 74, 76, 77, 79, 81, 83, 84 ]; // try higher notes
            let randNote = Math.random();
            let index = Math.floor( Scale.linear_scale( randNote, 0, 1, 0, keyOfCPitchClass4.length ) );
            this.playingNote = keyOfCPitchClass4[index]-24;
            let velocity = 120;
            this.tubaSampler.triggerAttack(Tone.Frequency(this.playingNote, "midi").toNote(), Tone.now(), velocity);
        }
        catch(e)
        {
            console.log(e);
            console.log( this.playingNote );
        }
    }

    setVibrato(freq: number, depth : number )
    {
        this.vibrato.frequency.value = freq; 
        this.vibrato.depth.value = depth; 
    }

    triggerRelease()
    {
        if( this.playingNote === -1)
            return; //do nothing if there is no playing note
        else
        {
            this.tubaSampler.triggerRelease(Tone.Frequency(this.playingNote, "midi").toNote());
            //this.tubaSampler.releaseAll(); 
            this.playingNote = -1; //nothing is playing
        }

    }

}

export class TransportTime
{
    bars : number =0; 
    beats : number=0; 
    sixteenths : number=0;
    quantize : boolean; 
    constructor( quantize : boolean = true )
    {
        this.quantize = quantize;
    }

    setPosition(timeStr : string) : void
    {
        let barsIndex : number = timeStr.indexOf(":"); 
        this.bars = parseFloat(timeStr.substring(0, barsIndex-1));

        let beatStr = timeStr.substring(barsIndex+1, timeStr.length-1);
        let beatIndex : number = beatStr.indexOf(":"); 
        this.beats =  parseFloat(beatStr.substring(0, beatIndex-1));

        let str16th = beatStr.substring(beatIndex+1, timeStr.length-1);
        this.sixteenths = parseFloat(str16th);

        if(this.quantize)
        {
            this.sixteenths = Math.round( this.sixteenths ); 
        }
    }

    getPosition() : string
    {
        return this.bars.toString() + ":" + this.beats.toString() + ":" + this.sixteenths.toString();
    }

    set( bars : number, beats : number, sixteenths : number )
    {
        this.bars = bars;
        this.beats = beats; 
        this.sixteenths = sixteenths; 
    }
}

export class MusicSequencerLoop
{
    onsets : TransportTime[]; 

    constructor()
    {
       this.onsets = []; 
    }

    //Tone.transport.scheduleRepeat

    //Tone.Transport.position

    //record an onset
    onset()
    {
        let on : TransportTime = new TransportTime(); 
        let timeStr : Time = Tone.Transport.position;
        on.setPosition( timeStr.toString() ); 
        this.onsets.push(on); 
    }


}