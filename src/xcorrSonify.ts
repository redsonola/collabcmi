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
import type { LoadMidiFilePlayground, MainVolume } from "./midiConversion.js";
import type { Time } from "tone/build/esm/core/type/Units";

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
    longVibrato : Tone.Vibrato[]; 
    feedbackDelay : Tone.FeedbackDelay; 

    testSynth : Tone.Synth; 

    ampEnv : Tone.AmplitudeEnvelope;
    ampEnv2 : Tone.AmplitudeEnvelope;

    longEnv : Tone.AmplitudeEnvelope[]; 
    longPlayingNote : number[]; 
    longTuba : Tone.Sampler[];
    lastAttackTime : number[]; //that means its not attacking
    TUBA_MAX_LENGTH : number = 3.5; //4sec before hard click -- WTF MATE
    curLongTubaIndex : number = 0; 


    compressors : Tone.Limiter[];
    limiter : Tone.Limiter;


    constructor( p : Participant, mainVolume : MainVolume ) {

        this.participant = p; 
        this.tubaSampler = this.loadTubaSampler();
        this.tubeSampler2 = this.loadTubaSampler();

        //create 4 to start
        this.longTuba = [
            this.loadTubaSampler(), 
            this.loadTubaSampler(),
            this.loadTubaSampler(),
            this.loadTubaSampler() ];

        this.masterCompressor = new Tone.Compressor(-20, 1);
        this.compressors = 
        [
            new Tone.Limiter(-20),
            new Tone.Limiter(-20),
            new Tone.Limiter(-20)
        ];
        this.limiter = new Tone.Limiter(-6);

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

        this.longEnv = [];
        this.longPlayingNote = []; 
        this.lastAttackTime = [];
        this.longVibrato = []; 
        this.longTuba.forEach(
            (tuba) =>
            {
                let newEnv = this.createLongEnv();
                this.longEnv.push(newEnv); 
                this.longPlayingNote.push(-1); 
                this.lastAttackTime.push(-1); 
                let vib = new Tone.Vibrato(0, 1); 
                this.longVibrato.push(vib); 

                //new Tone.Convolver("./fan_sounds/fan4.wav"), new Tone.Convolver("./fan_sounds/cng_fan1.wav"), 

                //TODO: convolve the tuba files offline with the fan files. 
                tuba.chain(vib, newEnv, mainVolume.getVolume()); 
            }
        );

        //set up the signal chain for the fx/synthesis
        this.convolver1 = new Tone.Convolver("./fan_sounds/cng_fan1.wav");
        this.convolver2 =  new Tone.Convolver("./fan_sounds/fan4.wav") 
        // this.tubaSampler.chain(this.convolver1, this.convolver2, this.masterCompressor);
        this.vibrato = new Tone.Vibrato(0, 1); 
        this.feedbackDelay = new Tone.FeedbackDelay("8n", 0.25);

        // this.tubaSampler.chain(this.convolver1, this.vibrato, this.feedbackDelay, this.masterCompressor);
        this.tubaSampler.chain(this.convolver1, this.vibrato, this.ampEnv, mainVolume.getVolume() );
        this.tubeSampler2.chain(this.ampEnv2, mainVolume.getVolume());
        //this.longTuba.chain(this.convolver2, this.vibrato, this.longEnv, mainVolume.getVolume());

        //this.convolver2 -- let's see

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

    createLongEnv()
    {
        return new Tone.AmplitudeEnvelope({
            attack: 1.0,
            decay: 0.2,
            sustain: 0.2,
            release: 0.8
        });
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

    //this is totally a cludge... I need to separate these 2 things into 2 different classes but ok.
    update()
    {
        let now : number = Tone.now(); 
        if( this.lastAttackTime[this.curLongTubaIndex] > -1 )
        {
            if( now - this.lastAttackTime[this.curLongTubaIndex] >= this.TUBA_MAX_LENGTH )
            {
                let curPitch = this.longPlayingNote[this.curLongTubaIndex]; 
                this.triggerRelease();

                if( this.curLongTubaIndex < this.lastAttackTime.length-1 ){
                    this.curLongTubaIndex++; 
                }
                else
                {
                    this.curLongTubaIndex = 0;  
                }

                this.triggerAttack(curPitch); 
            }
        }
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
            let humanize = Scale.linear_scale( Math.random(), 0, 1, 0.4, 1 ); 
            if( Math.random() > 0.5 )
            {
                this.tubaSampler.triggerAttackRelease(Tone.Frequency(this.playingNote, "midi").toNote(), "8n", Tone.now(), humanize);
                this.ampEnv.triggerAttackRelease("16n");
            }
            else 
            {
                this.tubeSampler2.triggerAttackRelease(Tone.Frequency(this.playingNote, "midi").toNote(), "8n", Tone.now(), humanize);
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

    setVibrato(howLongTouch:number)
    {
        let freq = 0;
        let depth = 0; 

        if(howLongTouch >= 2)
        {
            if( howLongTouch > 10){
                howLongTouch = 10 - (howLongTouch % 10);  
            }

            freq = Scale.linear_scale(howLongTouch, 2, 9, 0, 4);
            depth = Scale.linear_scale(howLongTouch, 2, 9, 0, 0.3);

        }

        this.vibrato.frequency.rampTo(freq, 0.1); 
        this.vibrato.depth.rampTo(depth); 

        this.longVibrato.forEach(( vibrato )=>{
            vibrato.frequency.rampTo(freq, 0.1); 
            vibrato.depth.rampTo(depth); 
        });
    }

    triggerAttack(pitch : number = -1)
    {
        // //for now pick a random note in key of C --> maybe put in melody, like in a midi file whatever.
        if( this.longPlayingNote[this.curLongTubaIndex] !== -1)
        {
            return;  //this is monophone! bc I they won't let me put release curves on separate notes >_<
            //this.triggerRelease();
        }

        this.lastAttackTime[this.curLongTubaIndex] = Tone.now(); //gawd I need to pass IN the time this is horrendous. refactor.

        // let i = 0; 
        // let found = false; 
        // while (!found && i<this.longPlayingNote.length)
        // {
        //     found = this.longPlayingNote[]
        //     i++; 
        // }

        //note -- it could be not done releasing when I start the next note.
        //there is an error with the triggerAttack method in here. 
        //using try/catch to carry on but looking into it & also will do more sound design
        try
        {
            if(pitch === -1)
            {
                let keyOfCPitchClass4 = [ 72, 74, 76, 77, 79, 81, 83, 84 ]; // try higher notes
                let randNote = Math.random();
                let index = Math.floor( Scale.linear_scale( randNote, 0, 1, 0, keyOfCPitchClass4.length ) );
                this.longPlayingNote[this.curLongTubaIndex] = keyOfCPitchClass4[index]-24;
            }
            else 
            {
                this.longPlayingNote[this.curLongTubaIndex] = pitch;
            }
            
            this.longTuba[this.curLongTubaIndex].triggerAttack(Tone.Frequency(this.longPlayingNote[this.curLongTubaIndex], "midi").toNote());
            this.longEnv[this.curLongTubaIndex].triggerAttack(); 
            // console.log("attack triggered")

        }
        catch(e)
        {
            console.log(e);
            // console.log( this.longPlayingNote );
        }
    }

    triggerRelease(forHeldNote : boolean = false)
    {
        if( this.longPlayingNote[this.curLongTubaIndex] === -1)
            return; //do nothing if there is no playing note
        else
        {
            // this.tubaSampler.triggerRelease(Tone.Frequency(this.playingNote, "midi").toNote());
            this.longEnv[this.curLongTubaIndex].triggerRelease(); 
            //this.longTuba.triggerRelease(Tone.Frequency(this.longPlayingNote, "midi").toNote(), "+2.0");

            //this.tubaSampler.releaseAll(); 
            this.longPlayingNote[this.curLongTubaIndex] = -1; //nothing is playing
            this.lastAttackTime[this.curLongTubaIndex] = -1;

            // console.log("release triggered")
        }
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

    play( now : TransportTime) : boolean
    {
        //number notes at the same time
        let played = false; 
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
                played = true;
            }
         } );
         return played; 
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
    MAX_BARS : number = 10;
    MAX_TIME_ALIVE : number = 20; //should max time alive also be controlled by win var? 5 to 25?
    curPlayingBars : number = 10; 
    lastBar : number = 0; //the last bar we were on 

    percSoundFile : LoadMidiFilePlayground;
    windowedvar : number; 


    constructor(tuba : SonifierWithTuba, percLoop : LoadMidiFilePlayground)
    {
        this.bars = []; 
        this.tuba = tuba; 
        this.curRecordingBar = new MusicSequencerLoop(this.tuba); 

        this.percSoundFile = percLoop;
        this.windowedvar = 0; 
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
        //perhaps always relate the midi file to the bars?
        this.percSoundFile.setPlaying( this.bars.length > 0 );
    }

    getNow() : TransportTime
    {

        let now : TransportTime = new TransportTime(); 
        now.setPosition( Tone.Transport.position.toString() ); 
        // console.log( now.getPosition() ); 
        return now; 
    }

    update(touch : boolean, windowedVarScore : number) : void
    {
        //temp fix I need propogate windowedVar stuff from other project.
        this.windowedvar = windowedVarScore; //Scale.linear_scale(windowedVarScore, 0, 0.6, 0, 1); 
        this.curPlayingBars = Scale.linear_scale( this.windowedvar, 0, 1, 5, this.MAX_BARS );

        this.updateBars( this.getNow() );

        if(touch)
        {
            this.curRecordingBar.onset(); 
        }

    }

    play()
    {
        let now : TransportTime = this.getNow();
        let numberOfOnsets = 0;
        let MAX_ONSETS = 2; 
        let played : boolean = false; 
        for( let i=0; i<this.curPlayingBars && i<this.bars.length; i++ )
        {
            played = played || this.bars[i].play(now); 
        }
        // this.bars.forEach((bar) => {
            // if( numberOfOnsets < MAX_ONSETS )
            // {
            //     if( bar.play(now) )
            //     { numberOfOnsets++; }
            // }
        //});

        if( played )
        {
            if(!this.percSoundFile.isPlaying())
            {
                this.percSoundFile.reset(); 
                this.percSoundFile.setPlaying(true); 
            }

            //calling play with 100% match &  windowedVar
            this.percSoundFile.magneticPlay( 1, this.windowedvar ); 
        }
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