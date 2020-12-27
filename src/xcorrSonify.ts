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
import type { DynamicMovementMidi, MainVolume } from "./midiConversion.js";
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

class LongPlayingNoteSampler
{

    TUBA_MAX_LENGTH : number = 3.5; //4sec before hard click -- WTF MATE
    curLongIndex : number = 0;

    lastAttackTime : number[] = []; //that means its not attacking
    longPlayingNote : number[] = []; 

    longEnv : Tone.AmplitudeEnvelope[]; 
    longSampler : Tone.Sampler[];
    compressors : Tone.Limiter[];
    longVibrato : Tone.Vibrato[]; 

    isCello : boolean = false; 
    name : string = "generic";

    TIME_WAIT_BEFORE_RELEASE = 0.5; 

    constructor( mainVolume : MainVolume ) 
    {
        this.longSampler = [
            this.loadSampler(), 
            this.loadSampler(),
            this.loadSampler(),
            this.loadSampler() ];

        this.compressors = 
        [
            new Tone.Limiter(-20),
            new Tone.Limiter(-20),
            new Tone.Limiter(-20)
        ];

        this.longEnv = [];
        this.longPlayingNote = []; 
        this.lastAttackTime = [];
        this.longVibrato = []; 
        this.longSampler.forEach(
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
    }

    loadSampler() : Tone.Sampler
    {
        return new Tone.Sampler(); 
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

    isPlaying() : boolean
    {
        return ( this.lastAttackTime[this.curLongIndex] > -1 );
    }

    update(now : number)
    {
        if( this.isPlaying() )
        {
            if( now - this.lastAttackTime[this.curLongIndex] >= this.TUBA_MAX_LENGTH )
            {
                let curPitch = this.longPlayingNote[this.curLongIndex]; 
                this.triggerRelease(true, this.TIME_WAIT_BEFORE_RELEASE);

                if( this.curLongIndex < this.lastAttackTime.length-1 ){
                    this.curLongIndex++; 
                }
                else
                {
                    this.curLongIndex = 0;  
                }

                this.triggerAttack(curPitch, now); 
            }
        }
    }

    triggerAttack(pitch : number = -1, yToPitchClass = 0.5, curTime = -1)
    {
        // //for now pick a random note in key of C --> maybe put in melody, like in a midi file whatever.
        if( this.longPlayingNote[this.curLongIndex] !== -1)
        {
            return;  //this is monophone! bc I they won't let me put release curves on separate notes >_<
            //this.triggerRelease();
        }

        if( curTime === -1 )
        {
            this.lastAttackTime[this.curLongIndex] = Tone.now(); //gawd I need to pass IN the time this is horrendous. refactor.
        }
        else
        {
            this.lastAttackTime[this.curLongIndex] = curTime; 
        }
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
                let keyOfCPitchClass4 = [ 72, 74, 76, 77, 79, 81, 83 ]; // try higher notes
                let randNote = Math.random();
                let index = Math.floor( Scale.linear_scale( randNote, 0, 1, 0, keyOfCPitchClass4.length ) );
                let pitchClass = Math.round(Scale.linear_scale(yToPitchClass, 0, 1, 2, 4 )); 
                this.longPlayingNote[this.curLongIndex] = keyOfCPitchClass4[index] - (pitchClass*12);

                console.log( "this long playing note:" + this.longPlayingNote[this.curLongIndex] + "   yToPitchClass " + yToPitchClass );


                //ok I know this is sloppy but production code time!
                if( this.isCello )
                {
                    this.longPlayingNote[this.curLongIndex] = this.longPlayingNote[this.curLongIndex] + 12; 
                }

            }
            else 
            {
                this.longPlayingNote[this.curLongIndex] = pitch;
            }
            
            this.longSampler[this.curLongIndex].triggerAttack(Tone.Frequency(this.longPlayingNote[this.curLongIndex], "midi").toNote());
            this.longEnv[this.curLongIndex].triggerAttack(); 
            // console.log("attack triggered")

        }
        catch(e)
        {
            console.log( "Likely this buffer was not set: " + this.name + "->" +this.longPlayingNote[this.curLongIndex] );

            console.log(e);
        }
    }

    triggerRelease(forHeldNote : boolean = false, waitBeforeReleasing=0)
    {
        if( this.longPlayingNote[this.curLongIndex] === -1)
            return; //do nothing if there is no playing note
        else
        {
            // this.tubaSampler.triggerRelease(Tone.Frequency(this.playingNote, "midi").toNote());
            this.longEnv[this.curLongIndex].triggerRelease(Tone.now() + waitBeforeReleasing); 
            //this.longTuba.triggerRelease(Tone.Frequency(this.longPlayingNote, "midi").toNote(), "+2.0");

            //this.tubaSampler.releaseAll(); 
            this.longPlayingNote[this.curLongIndex] = -1; //nothing is playing
            this.lastAttackTime[this.curLongIndex] = -1;

            // console.log("release triggered")
        }
    }

    setVibrato(freq : number, depth : number)
    {
        
        this.longVibrato.forEach(( vibrato )=>{
            vibrato.frequency.rampTo(freq, 0.1); 
            vibrato.depth.rampTo(depth); 
        });
    }


}

class LongPlayingNoteTuba extends LongPlayingNoteSampler
{
    constructor( mainVolume : MainVolume )
    {
        super(mainVolume);  
        this.name = "normal tuba";      
    }

    loadSampler()
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
}

class LongPlayingNoteTubaSoft extends LongPlayingNoteSampler
{
    constructor( mainVolume : MainVolume )
    {
        super(mainVolume);  
        this.name = "soft tuba";      
    }

    loadSampler()
    {
        let sampler : Tone.Sampler; 

        sampler = new Tone.Sampler({
            "F1": "041_Tuba_F1_Soft.mp3",
            "A1": "045_Tuba_A1_Soft.mp3",
            "C2": "048_Tuba_C2_Soft.mp3",
            "E2": "052_Tuba_E2_Soft.mp3",	
            "G2": "055_Tuba_G2_Soft.mp3",
            "A2": "057_Tuba_A2_Soft.mp3",
            "C3" : "060_Tuba_C3_Soft.mp3",
            "D3" : "062_Tuba_D3_Soft.mp3",
            "Eb3": "063_Tuba_Eb3_Soft.mp3"
        },
        {
            baseUrl: "./Tuba_samples/Tuba_Long/Soft/"
        });
        return sampler; 
    }
}

class LongPlayingNoteTubaLoud extends LongPlayingNoteSampler
{
    constructor( mainVolume : MainVolume )
    {
        super(mainVolume);  
        this.name = "loud tuba";      
      
    }

    loadSampler()
    {
        let sampler : Tone.Sampler; 

        sampler = new Tone.Sampler({
            "F1": "041_Tuba_F1_Loud.mp3",
            "A1": "045_Tuba_A1_Loud.mp3",
            "C2": "048_Tuba_C2_Loud.mp3",
            "E2": "052_Tuba_E2_Loud.mp3",	
            "G2": "055_Tuba_G2_Loud.mp3",
            "A2": "057_Tuba_A2_Loud.mp3",
            "C3" : "060_Tuba_C3_Loud.mp3",
            "D3" : "062_Tuba_D3_Loud.mp3",
            "Eb3": "063_Tuba_Eb3_Loud.mp3",
        },
        {
            baseUrl: "./Tuba_samples/Tuba_Long/Loud/"
        });
        return sampler; 
    }
}


class LongPlayingNoteCelloLoud extends LongPlayingNoteSampler
{
    constructor( mainVolume : MainVolume )
    {
        super(mainVolume);     
        this.TUBA_MAX_LENGTH = 2.5; //ok so its not a tuba anymore sue me.
        this.isCello = true; 
        this.name = "loud cello";      

    }

    loadSampler() : Tone.Sampler
    {
        let sampler : Tone.Sampler; 

        sampler = new Tone.Sampler({

            "C1": "Cello loudC1.wav",
            "A1": "Cello loudA1.wav",
            "C2": "Cello loudC2.wav",
            "A2": "Cello loudA2.wav",
            "C3": "Cello loudC3.wav",
            "A3": "Cello loudA3.wav",
            "C4": "Cello loudC4.wav",
            "A4": "Cello loudA4.wav"
        },
        {
            baseUrl: "./audio_samples/Cello Loud/"
        });

        return sampler; 
    }
}

class LongPlayingNoteCelloSoft extends LongPlayingNoteSampler
{
    constructor( mainVolume : MainVolume )
    {
        super(mainVolume);  
        this.TUBA_MAX_LENGTH = 2.5; 
        this.isCello = true; 
        this.name = "soft cello";      
    }

    loadSampler()
    {
        let sampler : Tone.Sampler; 

        sampler = new Tone.Sampler({

            "C1": "Cello softC1.wav",
            "A1": "Cello softA1.wav",
            "C2": "Cello softC2.wav",
            "A2": "Cello softA2.wav",
            "C3": "Cello softC3.wav",
            "A3": "Cello softA3.wav",
            "C4": "Cello softC4.wav",
            "A4": "Cello softA4.wav"
        },
        {
            baseUrl: "./audio_samples/Cello Soft/"
        });

        return sampler; 
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
    // longVibrato : Tone.Vibrato[]; 
    feedbackDelay : Tone.FeedbackDelay; 

    testSynth : Tone.Synth; 

    ampEnv : Tone.AmplitudeEnvelope;
    ampEnv2 : Tone.AmplitudeEnvelope;

    limiter : Tone.Limiter;

    longPlayingNoteSamplers : LongPlayingNoteSampler[]; 
    whichIsPlayingIndex : number = 0; 


    constructor( p : Participant, mainVolume : MainVolume ) {

        this.participant = p; 
        this.tubaSampler = this.loadTubaSampler();
        this.tubeSampler2 = this.loadTubaSampler();

        
        this.longPlayingNoteSamplers = [new LongPlayingNoteTuba(mainVolume), 
                                        new LongPlayingNoteCelloLoud(mainVolume), 
                                        new LongPlayingNoteCelloSoft(mainVolume), 
                                        new LongPlayingNoteTubaLoud(mainVolume), 
                                        new LongPlayingNoteTubaSoft(mainVolume)];

        //create 4 to start
        // this.longTuba = [
        //     this.loadTubaSampler(), 
        //     this.loadTubaSampler(),
        //     this.loadTubaSampler(),
        //     this.loadTubaSampler() ];

        this.masterCompressor = new Tone.Compressor(-20, 1);
        // this.compressors = 
        // [
        //     new Tone.Limiter(-20),
        //     new Tone.Limiter(-20),
        //     new Tone.Limiter(-20)
        // ];
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

        this.masterCompressor.connect(mainVolume.getVolume());
        this.testSynth = new Tone.Synth().connect(mainVolume.getVolume());

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
        this.longPlayingNoteSamplers[this.whichIsPlayingIndex].update( now );

    }

    triggerAttackRelease(pitch : number = -1, yToPitchClass=0) : number
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

                let pitchClass = Math.round( Scale.linear_scale( yToPitchClass, 0, 1, -5, -2, true ));
                this.playingNote = keyOfCPitchClass4[index]+(12*pitchClass);
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

    triggerRelease(forHeldNote : boolean = false)
    {
        if( this.longPlayingNoteSamplers[this.whichIsPlayingIndex].isPlaying() )
        {
            this.whichIsPlayingIndex = Scale.linear_scale( Math.random(), 0, 1, 0, this.longPlayingNoteSamplers.length-1 ); 
            this.whichIsPlayingIndex = Math.round( this.whichIsPlayingIndex ); 
        }
        this.longPlayingNoteSamplers[this.whichIsPlayingIndex].triggerRelease(forHeldNote);
    }

    triggerAttack(pitch : number = -1, yTopitchClass = -1)
    {
        this.longPlayingNoteSamplers[this.whichIsPlayingIndex].triggerAttack(pitch, yTopitchClass); 
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

        this.longPlayingNoteSamplers.forEach( ( sampler ) =>
            {
                sampler.setVibrato(freq, depth); 
            });
    }


}

class PitchOnset extends TransportTime
{
    pitch : number; 
    yToPitchClass : number =1;

    constructor(time : TransportTime, yToPitchClass : number)
    {
        super(); 
        this.pitch = -1; 
        this.bars = time.bars;
        this.beats = time.beats; 
        this.sixteenths = time.sixteenths; 
        this.yToPitchClass = yToPitchClass;

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
    onset(yToPitchClass : number)
    {
        let on : TransportTime = new TransportTime(); 
        on.setPosition( Tone.Transport.position.toString() ); 

        //don't add repeats.
        // if( !this.isRepeatedBeat(on) ) {
        //     this.onsets.push(new PitchOnset(on));
        // }
        this.onsets.push(new PitchOnset(on, yToPitchClass));
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
                    this.tuba.triggerAttackRelease(onset.pitch, onset.yToPitchClass);
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

    percSoundFile : DynamicMovementMidi[];
    currentPercIndex : number;
    windowedvar : number;
    
    lastChangedPercLoop : TransportTime; 


    constructor(tuba : SonifierWithTuba, percLoop : DynamicMovementMidi[])
    {
        this.bars = []; 
        this.tuba = tuba; 
        this.curRecordingBar = new MusicSequencerLoop(this.tuba); 

        this.percSoundFile = percLoop;
        this.windowedvar = 0; 
        this.currentPercIndex = 0; 
        this.lastChangedPercLoop = new TransportTime();
        this.lastChangedPercLoop.setPosition( Tone.Transport.position.toString() );

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
        this.percSoundFile[this.currentPercIndex].setPlaying( this.bars.length > 0 );
    }

    getNow() : TransportTime
    {

        let now : TransportTime = new TransportTime(); 
        now.setPosition( Tone.Transport.position.toString() ); 
        // console.log( now.getPosition() ); 
        return now; 
    }

    update(touch : boolean, yToPitchClass:number, windowedVarScore : number) : void
    {
        //temp fix I need propogate windowedVar stuff from other project.
        this.windowedvar = windowedVarScore; //Scale.linear_scale(windowedVarScore, 0, 0.6, 0, 1); 
        this.curPlayingBars = Scale.linear_scale( this.windowedvar, 0, 1, 5, this.MAX_BARS );

        this.updateBars( this.getNow() );

        if(touch)
        {
            this.curRecordingBar.onset(yToPitchClass); 
        }

    }

    play()
    {
        let now : TransportTime = this.getNow();
        let nowInSeconds = Tone.now(); 
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
            let minWinVarTochange = 0.3 ;
            
            //TODO: how 'sticky' should rhythmic patterns be?
            if( this.windowedvar < minWinVarTochange && now.bars - this.lastChangedPercLoop.bars > 10 )
            {
                //turn off previous 
                let previousIndex = this.currentPercIndex;

                this.currentPercIndex = Scale.linear_scale( Math.random(), 0, 1, 0, this.percSoundFile.length-1 ); 
                this.currentPercIndex = Math.round(this.currentPercIndex); 

                if(previousIndex !== this.currentPercIndex)
                {
                    this.lastChangedPercLoop = now ;
                    this.percSoundFile[previousIndex].setPlaying(false);
                }
            }

            console.assert( this.currentPercIndex < this.percSoundFile.length ); 

            if(!this.percSoundFile[this.currentPercIndex].isPlaying())
            {
                this.percSoundFile[this.currentPercIndex].reset(nowInSeconds); 
                this.percSoundFile[this.currentPercIndex].setPlaying(true); 
            }


            //calling play with 100% match &  windowedVar
            this.percSoundFile[this.currentPercIndex].play( this.windowedvar, nowInSeconds ); 
        }
    }

}

