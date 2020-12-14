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
    tubeSampler2 :  Tone.Sampler; 
    masterCompressor : Tone.Compressor;
    convolver1 : Tone.Convolver;
    convolver2 : Tone.Convolver;
    samplersLoaded : boolean = false; 
    playingNote : number = -1;

    vibrato : Tone.Vibrato; 
    feedbackDelay : Tone.FeedbackDelay; 

    testSynth : Tone.Synth; 

    ampEnv : Tone.AmplitudeEnvelope;
    ampEnv2 : Tone.AmplitudeEnvelope;


    constructor( p : Participant, mainVolume : MainVolume ) {

        this.participant = p; 
        this.tubaSampler = this.loadTubaSampler();
        this.tubeSampler2 = this.loadTubaSampler();
        this.masterCompressor = new Tone.Compressor(-5, 1);

        this.ampEnv = new Tone.AmplitudeEnvelope({
                attack: 0.1,
                decay: 0.2,
                sustain: 1.0,
                release: 0.8
            });

        this.ampEnv2  = new Tone.AmplitudeEnvelope({
            attack: 0.1,
            decay: 0.2,
            sustain: 1.0,
            release: 0.8
        });

        //set up the signal chain for the fx/synthesis
        this.convolver1 = new Tone.Convolver("./fan_sounds/cng_fan1.wav");
        this.convolver2 =  new Tone.Convolver("./fan_sounds/fan4.wav") 
        // this.tubaSampler.chain(this.convolver1, this.convolver2, this.masterCompressor);
        this.vibrato = new Tone.Vibrato(0, 1); 
        this.feedbackDelay = new Tone.FeedbackDelay("8n", 0.25);

        // this.tubaSampler.chain(this.convolver1, this.vibrato, this.feedbackDelay, this.masterCompressor);
        this.tubaSampler.chain(this.convolver1, this.vibrato, this.ampEnv, this.masterCompressor);
        this.tubeSampler2.chain(this.ampEnv2, this.masterCompressor);

        this.masterCompressor.connect(mainVolume.getVolume());
        // this.tubaSampler.release = 0.25; 
        // this.tubaSampler.curve = "exponential"; 

        this.testSynth = new Tone.Synth().connect(mainVolume.getVolume());

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

    triggerAttackRelease(pitch : number = -1) : number
    {

        //note -- it could be not done releasing when I start the next note.
        //there is an error with the triggerAttack method in here. 
        //using try/catch to carry on but looking into it & also will do more sound design
        try
        {
            if( pitch !== -1 )
            {
                this.playingNote = pitch; 
            }
            else
            {
                let keyOfCPitchClass4 = [ 72, 74, 76, 77, 79, 81, 83, 84 ]; // try higher notes
                let randNote = Math.random();
                let index = Math.floor( Scale.linear_scale( randNote, 0, 1, 0, keyOfCPitchClass4.length ) );
                this.playingNote = keyOfCPitchClass4[index]-24;
            }

            //TODO: an array of different 'tuba' sounds
            if( Math.random() > 0.5 )
            {
                this.tubaSampler.triggerAttackRelease(Tone.Frequency(this.playingNote, "midi").toNote(), "16n");
                this.ampEnv.triggerAttackRelease("16n");
            }
            else 
            {
                this.tubeSampler2.triggerAttackRelease(Tone.Frequency(this.playingNote, "midi").toNote(), "16n");
                this.ampEnv2.triggerAttackRelease("16n");
            }
           // this.testSynth.triggerAttackRelease(Tone.Frequency(this.playingNote, "midi").toNote(), "16n");
        }
        catch(e)
        {
            console.log(e);
            console.log( this.playingNote );
        }

        return this.playingNote
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
            this.playingNote = keyOfCPitchClass4[index];
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
        this.bars = parseFloat(timeStr.substring(0, barsIndex));


        let beatStr = timeStr.substring(barsIndex+1, timeStr.length-1);
        let beatIndex : number = beatStr.indexOf(":"); 
        this.beats =  parseFloat(beatStr.substring(0, beatIndex));

        let str16th = beatStr.substring(beatIndex+1, timeStr.length-1);
        this.sixteenths = parseFloat(str16th);

        // console.log(timeStr);
        // console.log(beatStr); 
        // console.log(beatStr.substring(0, beatIndex)); 

        //could quantize to the 32nd
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

    sameBeat(time : TransportTime)
    {
        return ( this.beats === time.beats && this.sixteenths === time.sixteenths );
    }
}

class PitchOnset extends TransportTime
{
    pitch : number; 
    constructor(time : TransportTime)
    {
        super(); 
        this.pitch = -1; 
        this.bars = time.bars;
        this.beats = time.beats; 
        this.sixteenths = time.sixteenths; 
    }
    hasPitch()
    {
        return this.pitch !== -1; 
    }
}

export class MusicSequencerLoop
{
    onsets : PitchOnset[]; 
    tuba : SonifierWithTuba; 
    bar : number; //what is the starting bar of the recording?

    //todo: take in an instrument (?)
    constructor(tuba : SonifierWithTuba)
    {
       this.onsets = []; 
       this.tuba = tuba; 
       this.bar = -1; 
    }

    //record an onset
    onset()
    {
        let on : TransportTime = new TransportTime(); 
        on.setPosition( Tone.Transport.position.toString() ); 

        //don't add repeats.
        // if( !this.isRepeatedBeat(on) ) {
        //     this.onsets.push(new PitchOnset(on));
        // }
        this.onsets.push(new PitchOnset(on));
        if(this.bar === -1)
        {
            this.bar = on.bars; 
        }
    }

    isRepeatedBeat( on : TransportTime )
    {
        let repeatedIndex = this.onsets.findIndex( (element) => { element.sameBeat(on); } );
        return (repeatedIndex !== -1); 
    }

    getBarNumber()
    {
        return this.bar; 
    }

    play( now : TransportTime)
    {
        this.onsets.forEach( (onset) => {  
            if( onset.sameBeat(now)  )
            {
                if(!onset.hasPitch())
                {
                    let pitch = this.tuba.triggerAttackRelease();
                    onset.pitch = pitch; 
                }
                else
                {
                    this.tuba.triggerAttackRelease(onset.pitch);
                }
            }
         } );
    }

    //number of onsets
    length()
    {
        return this.onsets.length; 
    }
}

export class TouchPhrasesEachBar
{
    bars : MusicSequencerLoop[]; 
    tuba : SonifierWithTuba;
    curRecordingBar : MusicSequencerLoop; 
    MAX_BARS : number = 5;
    MAX_TIME_ALIVE : number = 10
    lastBar : number = 0; //the last bar we were on 


    constructor(tuba : SonifierWithTuba)
    {
        this.bars = []; 
        this.tuba = tuba; 
        this.curRecordingBar = new MusicSequencerLoop(this.tuba); 
    }

    updateBars(now : TransportTime)
    {
        if( now.bars <= this.lastBar )
        {
            return;  //just get out if we don't need to update the bar
        }
        else
        {
            this.lastBar = now.bars; 
        }

        if( this.curRecordingBar.length() > 0 )
        {
            this.bars.push(this.curRecordingBar); 
            this.curRecordingBar = new MusicSequencerLoop(this.tuba);
        }

        //trim based on the length
        if( this.bars.length > this.MAX_BARS )
        {
            this.bars.shift();  
        }

        //trim based on length of bars alive
        for( let i= this.bars.length-1; i>=0; i--  )
        {
            if(now.bars - this.bars[i].getBarNumber() >= this.MAX_TIME_ALIVE )
            {
                this.bars.splice(i, 1); 
            }
        }
    }

    getNow() : TransportTime
    {

        let now : TransportTime = new TransportTime(); 
        now.setPosition( Tone.Transport.position.toString() ); 
        // console.log( now.getPosition() ); 
        return now; 
    }

    update(touch : boolean) : void
    {
        this.updateBars( this.getNow() );

        if(touch)
        {
            this.curRecordingBar.onset(); 
        }
    }

    play()
    {
        let now : TransportTime = this.getNow();
        this.bars.forEach((bar) => {
            bar.play(now); 
        });
    }

}

//     magneticPlay( synchronityMeasure, windowedVarScore )
//     {
        
//             if ( this.currentMidi.length <= 0 ) 
//             {
//                 return; 
//             }

//             if ( ! this.looping )
//             {
//                 return; 
//             }

//             //need to implement -- if you put a lot of energy in then it lasts longer... !!
//             let vol = this.createVolumeCurve(  windowedVarScore );
//             this.playgroundSampler.volume.value = vol; 

//             //do a volume thing 2?
//             if( windowedVarScore < 0.07)
//             {
//                 return;
//             }

//             let now = Tone.now();

//             let secs = now-this.startTime ;
//             if(  ( secs) <  this.scheduledAhead )
//             {

//                 return;
//             }
//             // console.log("secs: " + secs + " tone.now: " + now + " start: " + this.startTime ) ; 

//             //also map velocity?

//             let midiIndex = this.chooseWhichFileIndexBasedOnIndividualActivity( windowedVarScore );
//             this.currentMidi[midiIndex].tracks.forEach((track) => {

//                 //schedule all of the events
//                 track.notes.forEach((note) => {

//                     let humanize = Scale.linear_scale( Math.random(), 0, 1, -0.5, 0.1 ); 
//                     let humanizePitch = Scale.linear_scale( Math.random(), 0, 1, -5, 30 ); 

//                     //TODO make this a sliding scale too
//                     if( synchronityMeasure > 0.6 )
//                     {
//                         humanize = Scale.linear_scale( Math.random(), 0, 1, -0.05, 0.05 ); 
//                         humanizePitch = 0;
//                     }

//                     let pitch = Tone.Frequency(note.name).toMidi() + humanizePitch; 

//                         this.playgroundSampler.triggerAttackRelease(
//                         Tone.Frequency(pitch, "midi").toNote(),
//                         note.duration,
//                         note.time + this.findStartTimeMagnetic( synchronityMeasure, Tone.now() ),
//                         note.velocity + humanize);
//                         // console.log("velocity:" +note.velocity); 
//                     }
//                 );
                    
//             });
//             this.startTime = now; 
//     }

// }