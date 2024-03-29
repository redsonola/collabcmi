/* 
    Sampler
    Tone.Player
    Convolver
    Reverb
    Tremelo
    Filter
*/

import * as Tone from "tone";
import { Frequency } from "tone";
import { AveragingFilter } from "./averagingFilterV2"; //this starts initialized. 
import * as Scale from "./scale"
import type { Participant } from "./participant"
import * as PoseIndex from "./poseConstants"
import type { DynamicMovementMidi, MainVolume } from "./midiConversion.js";
import type { NormalRange, Time } from "tone/build/esm/core/type/Units";



export enum InstrumentID
{
    tuba = 0,
    longTuba,
    cello, 
    pluckedcello,
    clayDrum, 
    mutedcanPercussion, 
    dumbekPercussion
}

export enum SoundMessageType
{
    noteOn = 0, 
    amplitude
}

//note: these are all note-ons, no note-offs yet
//basic one includes pitch, hmm ok -- it is noteOn
export class SoundMessage
{
    id : InstrumentID = 0 ; 
    pitch : number = 0;
    velocity : number = 0; //this is not really implemented yet-
    messageType : SoundMessageType = SoundMessageType.noteOn;
    

    constructor(id : InstrumentID, pitch : number, velocity : number = 0)
    {
        this.id = id; 
        this.pitch = pitch; 
    }

    toString() : string
    {
        return "SoundMessage --> id: " + this.id + " pitch: " + this.pitch ; 
    }

}

export class AmplitudeSoundMessage extends SoundMessage
{
    amplitude : number; 
    constructor(id : InstrumentID, amplitude: number)
    {
        super(id, -1, -1); 
        this.amplitude = amplitude;
        this.messageType = SoundMessageType.amplitude; 
    }
    toString() : string
    {
        return "SoundMessage --> id: " + this.id + " amplitude: " + this.amplitude ; 
    }
}

//this class is a helper class that translates between different Tone.Transport time values.
//it also will quantize the given time & test if incoming time is the same beat as current.
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

//this just allows sampliers to have a unique id 
export class SamplerWithID extends Tone.Sampler
{
    id : InstrumentID = -1;
}

class SamplerFactory 
{
    type : string = ""; 
    constructor(  ) 
    {
    }

    loadAllSamplers() : SamplerWithID[]
    {
        let samplers : SamplerWithID[];
        samplers = 
        [
            this.loadSampler("normal tuba" ),
            this.loadSampler("loud tuba" ),
            this.loadSampler("soft tuba" ),
            this.loadSampler("soft cello" ),
            this.loadSampler("loud cello" ),
            this.loadSampler("cello stabs" ), 
            this.loadSampler("clay drum" ),
            this.loadSampler("plucked cello"),
            this.loadSampler("plucked cello"),
            this.loadSampler("plucked cello"),
            this.loadSampler("plucked cello")
        ];
        return samplers;
    }

    loadSampler( type : string ) : SamplerWithID
    {
        this.type = type;
        if( this.type === "normal tuba" )
        {
            return this.loadTubaLoudSampler();
        }
        else if( this.type === "loud tuba" )
        {
            return this.loadTubaLoudSampler();
        }
        else if( this.type === "soft tuba" )
        {
            return this.loadTubaSoftSampler();
        }
        else if( this.type === "soft cello" )
        {
            return this.loadCelloSoftSampler();
        }
        else if( this.type === "cello stabs" )
        {
            return this.loadCelloStabSampler();
        }
        else if( this.type === "plucked cello" )
        {
            return this.loadPluckedCelloSampler();
        }
        else if( this.type == "clay drum" )
        {
            return this.loadClayDrumSampler(); 
        }
        else 
        {
            return this.loadCelloLoudSampler();
        }
    }

    loadTubaNormalSampler() : SamplerWithID
    {
        let sampler : SamplerWithID; 

        sampler = new SamplerWithID({
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
        sampler.id = InstrumentID.tuba;
        return sampler; 
    }

    loadTubaSoftSampler() : SamplerWithID
    {
        let sampler : SamplerWithID; 

        sampler = new SamplerWithID({
            "F1": "041_Tuba_F1_Soft.mp3",
            "A1": "045_Tuba_A1_Soft.mp3",
            "C2": "048_Tuba_C2_Soft.mp3",
            "E2": "052_Tuba_E2_Soft.mp3",	
            "G2": "055_Tuba_G2_Soft.mp3",
            "A2": "057_Tuba_A2_Soft.mp3",
            "C3" : "061_Tuba_C3_Soft.mp3",
        },
        {
            baseUrl: "./Tuba_samples/Tuba_Long/Soft/"
        });
        sampler.id = InstrumentID.tuba;
        return sampler; 
    }

    loadTubaLoudSampler() : SamplerWithID
    {
        let sampler : SamplerWithID; 

        sampler = new SamplerWithID({
            "F1": "041_Tuba_F1_Loud.mp3",
            "A1": "045_Tuba_A1_Loud.mp3",
            "C2": "048_Tuba_C2_Loud.mp3",
            "E2": "052_Tuba_E2_Loud.mp3",	
            "G2": "055_Tuba_G2_Loud.mp3",
            "A2": "057_Tuba_A2_Loud.mp3",
            "C3": "060_Tuba_C3_Loud.mp3" 
        },
        {
            baseUrl: "./Tuba_samples/Tuba_Long/Loud/"
        });
        sampler.id = InstrumentID.tuba;
        return sampler; 
    }

    loadCelloLoudSampler() : SamplerWithID
    {
        let sampler : SamplerWithID; 

        sampler = new SamplerWithID({

            "C1": "Cello_loudC1.wav",
            "A1": "Cello_loudA1.wav",
            "C2": "Cello_loudC2.wav",
            "A2": "Cello_loudA2.wav",
            "C3": "Cello_loudC3.wav",
            "A3": "Cello_loudA3.wav",
            "C4": "Cello_loudC4.wav",
            "A4": "Cello_loudA4.wav"
        },
        {
            baseUrl: "./audio_samples/Cello_Loud/"
        });
        sampler.id = InstrumentID.cello;
        sampler.volume.rampTo(9); 

        return sampler; 
    }

    loadCelloSoftSampler() : SamplerWithID
    {
        let sampler : SamplerWithID; 

        sampler = new SamplerWithID({

            "C1": "Cello_softC1.wav",
            "A1": "Cello_softA1.wav",
            "C2": "Cello_softC2.wav",
            "A2": "Cello_softA2.wav",
            "C3": "Cello_softC3.wav",
            "A3": "Cello_softA3.wav",
            "C4": "Cello_softC4.wav",
            "A4": "Cello_softA4.wav"
        },
        {
            baseUrl: "./audio_samples/Cello_Soft/"
        });
        sampler.volume.rampTo(9); 
        sampler.id = InstrumentID.cello;


        return sampler; 
    }

    loadCelloStabSampler() : SamplerWithID
    {
        let sampler : SamplerWithID; 

        sampler = new SamplerWithID({

            "C1": "Cello_stabsC1.wav",
            "A1": "Cello_stabsA1.wav",
            "C2": "Cello_stabsC2.wav",
            "A2": "Cello_stabsA2.wav",
            "C3": "Cello_stabsC3.wav",
            "A3": "Cello_stabsA3.wav",
            "C4": "Cello_stabsC4.wav",
            "A4": "Cello_stabsA4.wav"
        },
        {
            baseUrl: "./audio_samples/Cello_Stabs/"
        });
        sampler.id = InstrumentID.cello;
        //don't set volume, loud enough
        return sampler; 
    }

    loadClayDrumSampler() : SamplerWithID
    {
        let sampler : SamplerWithID; 

        sampler = new SamplerWithID({

            "C1": "Large_Clay_Drum_Mute_1.wav",
            "A1": "Large_Clay_Drum_Mute_2.wav",
            "C2": "Large_Clay_Drum_Mute_3.wav",
            "A2": "Large_Clay_Drum_Mute_4.wav",
            "C3": "Large_Clay_Drum_2.wav",
            "C4": "Large_Clay_Drum_3.wav",
        },
        {
            baseUrl: "./audio_samples/Large_Clay_Drum/"
        });
        sampler.id = InstrumentID.clayDrum;
        //don't set volume, loud enough
        return sampler; 
    }

    loadPluckedCelloSampler() : SamplerWithID
    {
        let sampler : SamplerWithID; 

        sampler = new SamplerWithID({
            "C1": "Cello_pluckC1.wav",
            "A1": "Cello_pluckA1.wav",
            "C2": "Cello_pluckC2.wav",
            "A2": "Cello_pluckA2.wav",
            "C3": "Cello_pluckC3.wav",
            "A3": "Cello_pluckA3.wav",
            "C4": "Cello_pluckC4.wav",
            "A4": "Cello_pluckA4.wav"
        },
        {
            baseUrl: "./audio_samples/Cello_Pluck/"
        });
        sampler.id = InstrumentID.pluckedcello;
        sampler.volume.rampTo(7); 
        return sampler; 
    }
}

//get amplitude from waveforms
export function getAmplitude(waveForms : Tone.Waveform[]) : number
{
    let out = 0; 
    for( let i=0; i<waveForms.length; i++ )
    {
        let outArray = waveForms[i].getValue();
        let sum = 0;
        for( let i=0; i<outArray.length; i++ )
        {
            sum += Math.abs( outArray[i] ); 
        }
        if( outArray.length <= 0 )
        {
            sum = 0;
        }
        else
        {
            sum /= outArray.length;
            sum /= 2; //convert from -1 to 1 waveform to 0 to 1 amplitude
        }
        out += sum; 
    }
    return out; 
}



//this is the long note when participants touch
class LongPlayingNoteSampler
{

    TUBA_MAX_LENGTH : number = 3.5; //4sec before hard click -- WTF MATE
    curLongIndex : number = 0;

    lastAttackTime : number[] = []; //that means its not attacking
    longPlayingNote : number[] = []; 

    longEnv : Tone.AmplitudeEnvelope[]; 
    longSampler : SamplerWithID[];
    compressors : Tone.Limiter[];
    longVibrato : Tone.Vibrato[];
    waveForms : Tone.Waveform[]; 

    curYToPitch : number = 0; 

    isCello : boolean = false; 
    name : string;

    TIME_WAIT_BEFORE_RELEASE = 0.5;
    playing : boolean = false; 

    LOWEST_WHILST_TOUCHING : number = -15;
    HIGH_VOL_FOR_SCALE : number = 18; 
    VOLUME_CAP : number = 1; 

    instrumentID : InstrumentID = -1; 

    // maxAmp: number = 0; 

    samplerFactory : SamplerFactory = new SamplerFactory(); 

    constructor( mainVolume : MainVolume, name:string ) 
    {
        this.name = name;

        this.longSampler = [
            this.samplerFactory.loadSampler(this.name), 
            this.samplerFactory.loadSampler(this.name), 
            this.samplerFactory.loadSampler(this.name), 
            this.samplerFactory.loadSampler(this.name)
        ];
        this.instrumentID = InstrumentID.longTuba;   


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
        this.waveForms = [];
        this.longSampler.forEach(
            (tuba) =>
            {
                let newEnv = this.createLongEnv();
                this.longEnv.push(newEnv); 
                this.longPlayingNote.push(-1); 
                this.lastAttackTime.push(-1); 
                let vib = new Tone.Vibrato(0, 1); 
                this.longVibrato.push(vib);
                
                let waveForm = new Tone.Waveform(); 
                this.waveForms.push(waveForm); 

                //new Tone.Convolver("./fan_sounds/fan4.wav"), new Tone.Convolver("./fan_sounds/cng_fan1.wav"), 

                //TODO: convolve the tuba files offline with the fan files. 
                tuba.chain(vib, newEnv, mainVolume.getVolume()); 
                newEnv.connect( waveForm ); 
            }
        );
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
        return this.playing;
    }

    update(now : number, yToPitch:number, touchingXCorr : number)
    {
        if( this.isPlaying() )
        {
            this.longSampler.forEach( (sampler)=>
            {
                let vol = Scale.linear_scale( touchingXCorr, 0.099, 0.66, this.LOWEST_WHILST_TOUCHING, this.HIGH_VOL_FOR_SCALE );
                vol = Math.min( vol, this.VOLUME_CAP ); //try capping at 15
                sampler.volume.rampTo( vol );
                
                // console.log( "touchingXCorr: " + touchingXCorr + " volume :" + sampler.volume.value );
            });

            if(( now - this.lastAttackTime[this.curLongIndex] >= this.TUBA_MAX_LENGTH ) )
            {
                let curPitch = this.longPlayingNote[this.curLongIndex]; 
                this.triggerRelease(true, 0);

                if( this.curLongIndex < this.lastAttackTime.length-1 ){
                    this.curLongIndex++; 
                }
                else
                {
                    this.curLongIndex = 0;  
                }

                this.curYToPitch = yToPitch; 
                this.triggerAttack(touchingXCorr, -1, yToPitch, now, true); 
            }
                    //change volume based on touching xcorr


        }
        else //ok, overkill but
        {
            this.longSampler.forEach( (sampler)=>
            {
                sampler.volume.rampTo( -90);
            // console.log( "touchingXCorr: " + touchingXCorr + " volume :" + sampler.volume.value );
            });
        }


    }

    triggerAttack(touchingXCorr:number, pitch : number = -1, yToPitchClass = 0.5, curTime = -1, isForHeld=false) : number
    {
        this.curYToPitch = yToPitchClass;
        if(!isForHeld) //note DO NOT SET FALSE!
        {
            this.playing = true; 
        }

        //maybe I don't need this here. check later.
        this.longSampler.forEach( (sampler)=>
        {
            // sampler.volume.rampTo( Scale.linear_scale( touchingXCorr, 0.099, 0.66, this.LOWEST_WHILST_TOUCHING, 20 ) );
            let vol = Scale.linear_scale( touchingXCorr, 0.099, 0.66, this.LOWEST_WHILST_TOUCHING, this.HIGH_VOL_FOR_SCALE );
            vol = Math.min( vol, this.VOLUME_CAP ); //try capping at 15
            sampler.volume.rampTo( vol );

            // console.log( "touchingXCorr: " + touchingXCorr + " volume :" + sampler.volume.value );
        });

        // //for now pick a random note in key of C --> maybe put in melody, like in a midi file whatever.
        if( this.longPlayingNote[this.curLongIndex] !== -1)
        {
            return -1;  //this is monophone! bc I they won't let me put release curves on separate notes >_<
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

        //note -- it could be not done releasing when I start the next note.
        //there is an error with the triggerAttack method in here. 
        //using try/catch to carry on but looking into it & also will do more sound design
        let index =0;
        try
        {
            if(pitch === -1)
            {
                let keyOfCPitchClass4 = [ 48, 50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 68, 69, 71, 72, 74, 76, 77, 79, 80, 81, 83, 84 ]; // try higher notes
                let randNote = Math.random();
                index = Math.round( Scale.linear_scale( yToPitchClass, 0, 1, 1, keyOfCPitchClass4.length ) );
                index = keyOfCPitchClass4.length - index; //flip
                this.longPlayingNote[this.curLongIndex] = keyOfCPitchClass4[index] - 12;
                pitch = keyOfCPitchClass4[index] - 12;

                // console.log( "this long playing note:" + this.longPlayingNote[this.curLongIndex] + "   yToPitchClass " + yToPitchClass );

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
            console.log( "LONG NOTE: Likely this buffer was not set: " + this.name + "->" + this.longPlayingNote[this.curLongIndex] + " pitch: " 
                + pitch + "  index: " + index );

            // console.log(e);
        }
        return pitch; 
    }

    triggerRelease(forHeldNote : boolean = false, waitBeforeReleasing=0)
    {
        if( this.longPlayingNote[this.curLongIndex] === -1)
            return; //do nothing if there is no playing note
        else
        {
            // this.tubaSampler.triggerRelease(Tone.Frequency(this.playingNote, "midi").toNote());
            if(waitBeforeReleasing!==0)
            {
                this.longEnv[this.curLongIndex].triggerRelease(Tone.now() + waitBeforeReleasing); 
            }
            else
            {
                this.longEnv[this.curLongIndex].triggerRelease(); 
            }
            //this.longTuba.triggerRelease(Tone.Frequency(this.longPlayingNote, "midi").toNote(), "+2.0");

            //this.tubaSampler.releaseAll(); 
            this.longPlayingNote[this.curLongIndex] = -1; //nothing is playing
            this.lastAttackTime[this.curLongIndex] = -1;

            // console.log("release triggered")
        }
        
        if( !forHeldNote )
        {
            for(let i=0; i<this.longSampler.length; i++)
            {
                this.longPlayingNote[i] = -1;
                this.lastAttackTime[i] = -1;
                this.longSampler[i].volume.rampTo(-90);
                this.longEnv[i].triggerRelease();
            }
            this.playing = false; 
        }
    }

    setVibrato(freq : number, depth : number)
    {
        
        this.longVibrato.forEach(( vibrato )=>{
            vibrato.frequency.rampTo(freq, 0.1); 
            vibrato.depth.rampTo(depth); 
        });
    }

    getAmplitude() : number
    {
        return getAmplitude(this.waveForms); 
    }

}

class LongPlayingNoteTuba extends LongPlayingNoteSampler
{
    constructor( mainVolume : MainVolume )
    {
        super(mainVolume, "normal tuba"); 
    }
}

class LongPlayingNoteTubaSoft extends LongPlayingNoteSampler
{
    constructor( mainVolume : MainVolume )
    {
        super(mainVolume, "soft tuba"); 
    }
}

class LongPlayingNoteTubaLoud extends LongPlayingNoteSampler
{
    constructor( mainVolume : MainVolume )
    {
        super(mainVolume, "loud tuba");   
    }
}

//************** Not using cello for long notes now ******************/
class LongPlayingNoteCelloLoud extends LongPlayingNoteSampler
{
    constructor( mainVolume : MainVolume )
    {
        super(mainVolume, "loud cello");     
        this.TUBA_MAX_LENGTH = 2.5; //ok so its not a tuba anymore sue me.
        this.isCello = true; 
        this.instrumentID = InstrumentID.cello;  
    }
}

class LongPlayingNoteCelloSoft extends LongPlayingNoteSampler
{
    constructor( mainVolume : MainVolume )
    {
        super(mainVolume, "soft cello");  
        this.TUBA_MAX_LENGTH = 2.5; 
        this.isCello = true; 
        this.instrumentID = InstrumentID.cello;  
    }
}

//********************************************************************/


//This class manages sound creation - manages the long note samplers and also manages to some extent, the short-playing notes.
export class SonifierWithTuba {

    participant : Participant;
    samplers : SamplerWithID[];
    samplersWaveForms : Tone.Waveform[]; 
    nonCanSamplerCountNumber : number; //not using can samplers for this now hmmm

    // tubeSampler2 :  Tone.Sampler; 
    masterCompressor : Tone.Compressor;
    convolver1s : Tone.Convolver[];
    // convolver2s : Tone.Convolver[];
    samplersLoaded : boolean = false; 
    playingNote : number = -1;

    vibratos : Tone.Vibrato[];

    ampEnvs : Tone.AmplitudeEnvelope[];

    limiter : Tone.Limiter;

    longPlayingNoteSamplers : LongPlayingNoteSampler[]; 
    whichIsPlayingIndex : number = 0; 

    soundMessages : SoundMessage[] = [];
    amplitudeMessages : AmplitudeSoundMessage[] = [];  


    constructor( p : Participant, mainVolume : MainVolume ) {

        this.participant = p;
        
        const samplerFactory : SamplerFactory = new SamplerFactory(); 
        this.samplers = samplerFactory.loadAllSamplers(); 
        this.nonCanSamplerCountNumber = this.samplers.length; 
        this.samplers.push( ...samplerFactory.loadAllSamplers() ); 
        // this.samplers.push(...samplerFactory.loadCanSamplers() ); 
        
        //only tuba!
        this.longPlayingNoteSamplers = [new LongPlayingNoteTuba(mainVolume), 
                                        // new LongPlayingNoteCelloLoud(mainVolume), 
                                        // new LongPlayingNoteCelloSoft(mainVolume), 
                                        new LongPlayingNoteTuba(mainVolume), 
                                        new LongPlayingNoteTuba(mainVolume)];

        this.masterCompressor = new Tone.Compressor(-20, 1);
        this.limiter = new Tone.Limiter(-6);

        this.ampEnvs = [];
        this.convolver1s = [];
        this.vibratos = [];
        this.samplersWaveForms = []; 
        let i = 0;  
        this.samplers.forEach( (sampler)=>
        {
            let ampEnv = new Tone.AmplitudeEnvelope({
                attack: 0.2,
                decay: 0.2,
                sustain: 0.5,
                release: 0.2
            });
            this.ampEnvs.push( ampEnv ); 

            let convolver1 = new Tone.Convolver("./fan_sounds/cng_fan1.wav");
            //this.convolver2 =  new Tone.Convolver("./fan_sounds/fan4.wav") 
            this.convolver1s.push( convolver1 ); 

            let vibrato = new Tone.Vibrato(0, 1);
            this.vibratos.push( vibrato );

            //TODO: finish connections here -- separate instruments for convolved or not??
            let waveForm = new Tone.Waveform(); 
            this.samplersWaveForms.push( waveForm );

            if( i < this.nonCanSamplerCountNumber )
            {
                sampler.chain(convolver1, vibrato, ampEnv, mainVolume.getVolume() );
            }
            else
            {
                sampler.chain(vibrato, ampEnv, mainVolume.getVolume() );
            }
            ampEnv.connect( waveForm );
            // const SEQUENCER_VOLUME_VALUE = 0; //move to top
            // sampler.volume.value = SEQUENCER_VOLUME_VALUE;  

            i++; 
        });

        this.masterCompressor.connect(mainVolume.getVolume());
        // this.testSynth = new Tone.Synth().connect(mainVolume.getVolume());

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

    updateAmplitudeMessages()
    {
        //this is kind of cludgy -- perhaps change this?
        //this gets the amplitude messages of sequenced short notes
        for( let i=0; i<this.nonCanSamplerCountNumber; i++  )
        {
            let out = 0;
            out += getAmplitude( [this.samplersWaveForms[i]] ); 
            out += getAmplitude( [this.samplersWaveForms[ i+this.nonCanSamplerCountNumber ]] );
            this.amplitudeMessages.push( new AmplitudeSoundMessage( this.samplers[i].id, out ) );
        }
    }

    updateLongSamplerAmplitudeMessages()
    {
        //update long playing notes
        let out = 0;
        this.longPlayingNoteSamplers.forEach( (sampler) =>
        {
            out += sampler.getAmplitude(); 
        }); 

        //all long playing note samplers are the same instrument now
        this.amplitudeMessages.push( new AmplitudeSoundMessage( this.longPlayingNoteSamplers[0].instrumentID, out ) );
    }

    //this is totally a cludge... I need to separate these 2 things into 2 different classes but ok.
    update(yToPitch : number, touchingXCorr : number, startedTouching : boolean, stoppedTouching : boolean, howLongTouch : number)
    {
        // this.soundMessages = []; //clear previous messages

        let now : number = Tone.now(); 

        if( startedTouching )
        {
            this.triggerAttack(touchingXCorr, -1, yToPitch);
        }
        else if( stoppedTouching )
        {
            this.triggerRelease();
        }

        this.setVibrato(howLongTouch);

        this.longPlayingNoteSamplers.forEach( (sampler) =>
            {
                sampler.update( now, yToPitch, touchingXCorr );
            }
        );

        // disabled for now
        // this.updateLongSamplerAmplitudeMessages();
    }

    triggerAttackRelease(pitch : number = -1, yToPitchClass=0, whichInstrument=0) : number[]
    {

        //note -- it could be not done releasing when I start the next note.
        //there is an error with the triggerAttack method in here. 
        //using try/catch to carry on but looking into it & also will do more sound design
        let index = 0;
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
                index = Math.floor( Scale.linear_scale( randNote, 0, 1, 0, keyOfCPitchClass4.length ) );

                let pitchClass = Math.round( Scale.linear_scale( yToPitchClass, 0, 1, -5, -2, true ));
                this.playingNote = keyOfCPitchClass4[index]+(12*pitchClass);

                whichInstrument = Math.floor( Scale.linear_scale( Math.random(), 0, 1, 0, this.samplers.length ));
            }

            //TODO: an array of different 'tuba' sounds
            let humanize = Scale.linear_scale( Math.random(), 0, 1, 0.4, 1 ); 


            let noteDurDecider = Math.random(); 
            if( noteDurDecider > 0.8 )
            {
                this.samplers[whichInstrument].triggerAttackRelease(Tone.Frequency(this.playingNote, "midi").toNote(), "4n", Tone.now(), humanize);
                this.ampEnvs[whichInstrument].triggerAttackRelease("8n");
            }
            else if( noteDurDecider > 0.4 )
            {
                this.samplers[whichInstrument].triggerAttackRelease(Tone.Frequency(this.playingNote, "midi").toNote(), "8n", Tone.now(), humanize);
                this.ampEnvs[whichInstrument].triggerAttackRelease("16n");
            }
            else    
            {
                this.samplers[whichInstrument].triggerAttackRelease(Tone.Frequency(this.playingNote, "midi").toNote(), "16n", Tone.now(), humanize);
                this.ampEnvs[whichInstrument].triggerAttackRelease("32n");
            }

            let msg : SoundMessage = new SoundMessage( this.samplers[whichInstrument].id, this.playingNote );
            this.soundMessages.push( msg );
            
        }
        catch(e)
        {
            // console.log(e);
            console.log( "SHORT NOTE: Likely this buffer was not set: " + whichInstrument + "->" + this.playingNote + " pitch: " 
                + pitch + "  index: " + index );        
        }


        return [this.playingNote, whichInstrument]; 
    }

    triggerRelease(forHeldNote : boolean = false)
    {
        if( this.longPlayingNoteSamplers[this.whichIsPlayingIndex].isPlaying() )
        {
            this.whichIsPlayingIndex = Scale.linear_scale( Math.random(), 0, 1, 0, this.longPlayingNoteSamplers.length-1 ); 
            this.whichIsPlayingIndex = Math.round( this.whichIsPlayingIndex ); 
        }

        //trigger release for ALL
        this.longPlayingNoteSamplers.forEach( sampler => {
            sampler.triggerRelease(forHeldNote); 
        });
    }

    triggerAttack(xcorr: number, pitch : number = -1, yTopitchClass = -1)
    {
        let playedpitch : number = this.longPlayingNoteSamplers[this.whichIsPlayingIndex].triggerAttack(xcorr, pitch, yTopitchClass);

        let msg : SoundMessage = new SoundMessage( this.longPlayingNoteSamplers[this.whichIsPlayingIndex].instrumentID, playedpitch );
        if( playedpitch > -1 )
        {
            this.soundMessages.push( msg );
        }
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

        this.vibratos.forEach( (vibrato)=> 
        {
            vibrato.frequency.rampTo(freq, 0.1); 
            vibrato.depth.rampTo(depth); 
        });



        this.longPlayingNoteSamplers.forEach( ( sampler ) =>
            {
                sampler.setVibrato(freq, depth); 
            });
    }

    getSoundMessages() : SoundMessage[]
    {
        return this.soundMessages; 
    }

    getAmplitudeMessages() : AmplitudeSoundMessage[]
    {
        return this.amplitudeMessages; 
    }

    clearMessages() : void
    {
        this.soundMessages = [];
        this.amplitudeMessages = []; 
    }

}

//one short note onset in the sequencer. 
class PitchOnset extends TransportTime
{
    pitch : number; 
    yToPitchClass : number = 1;
    relativeBar : number;
    whichInstrument : number = -1;  

    constructor(time : TransportTime, yToPitchClass : number, relativeBar: number)
    {
        super(); 
        this.pitch = -1; 
        this.bars = time.bars;
        this.beats = time.beats; 
        this.sixteenths = time.sixteenths; 
        this.yToPitchClass = yToPitchClass;
        this.relativeBar = relativeBar; 

    }
    hasPitch()
    {
        return this.pitch !== -1; 
    }

    sameBeat(time : TransportTime)
    {
        return ( super.sameBeat(time) && ( (time.bars - this.bars) % (this.relativeBar+1)==0 ) );
    }
}

//one recorded loop of variable measures of pitch onsets playing in the sequencer 
export class MusicSequencerLoop
{
    onsets : PitchOnset[]; 
    tuba : SonifierWithTuba; 
    bar : number; //what is the starting bar of the recording?
    loopLengthInBars : number; //how long the loop is -- in bars

    //todo: take in an instrument (?)
    constructor(tuba : SonifierWithTuba, loopLengthInBars: number)
    {
       this.onsets = []; 
       this.tuba = tuba; 
       this.bar = -1; 
       this.loopLengthInBars = loopLengthInBars; 
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
        if(this.bar === -1)
        {
            this.bar = on.bars; 
        }
        this.onsets.push(new PitchOnset(on, yToPitchClass,  on.bars % this.bar ));
        let returnArray = this.tuba.triggerAttackRelease();
        this.onsets[ this.onsets.length-1 ].pitch = returnArray[0];  
        this.onsets[ this.onsets.length-1 ].whichInstrument = returnArray[1];  
        
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
            if( onset.sameBeat(now) )
            {
                if(!onset.hasPitch())
                {
                    let returnArray = this.tuba.triggerAttackRelease();
                    onset.pitch = returnArray[0]; 
                    onset.whichInstrument = returnArray[1]; 
                }
                else
                {
                    this.tuba.triggerAttackRelease(onset.pitch, onset.yToPitchClass, onset.whichInstrument);
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
    MAX_BARS : number = 20;
    MAX_TIME_ALIVE : number = 30; //should max time alive also be controlled by win var? 5 to 25?
    curPlayingBars : number = 10; 
    lastBar : number = 0; //the last bar we were on 

    percSoundFile : DynamicMovementMidi[];
    currentPercIndex : number;

    percSoundFileBass : DynamicMovementMidi[];
    currentPercIndexBass : number = 0;

    windowedvar : number;
    
    lastChangedPercLoop : TransportTime; 

    lengthOfLoopInBars : number = 1;
    MAX_BARS_TO_LOOP : number = 8; 

    soundMessages : SoundMessage[] = [];
    amplitudeSoundMessages : AmplitudeSoundMessage[] = []; 
 
    constructor(tuba : SonifierWithTuba, percLoop : DynamicMovementMidi[], percBass : DynamicMovementMidi[] )
    {
        this.bars = []; 
        this.tuba = tuba; 
        this.curRecordingBar = new MusicSequencerLoop(this.tuba, this.lengthOfLoopInBars); 

        this.percSoundFile = percLoop;
        this.windowedvar = 0; 
        this.currentPercIndex = 0; 
        this.lastChangedPercLoop = new TransportTime();
        this.lastChangedPercLoop.setPosition( Tone.Transport.position.toString() );

        this.percSoundFileBass = percBass; 
        this.currentPercIndexBass = 0;



    }

    updateBars(now : TransportTime)
    {
        if( now.bars <= this.lastBar + (this.lengthOfLoopInBars-1) )
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
            this.lengthOfLoopInBars = Math.floor( Scale.linear_scale( Math.random(), 0, 1, 0, this.MAX_BARS_TO_LOOP ) )  ;
            this.curRecordingBar = new MusicSequencerLoop(this.tuba, this.lengthOfLoopInBars);
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
        this.percSoundFileBass[this.currentPercIndexBass].setPlaying( this.bars.length > 0 );

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
        this.MAX_TIME_ALIVE = Scale.linear_scale( this.windowedvar, 0, 1, 5, 30 );


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
            
            //TODO: how 'sticky' should rhythmic patterns be? -- this switches which pattern
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

                this.percSoundFileBass[this.currentPercIndexBass].reset(nowInSeconds); 
                this.percSoundFileBass[this.currentPercIndexBass].setPlaying(true); 
            }

            //calling play with 100% match &  windowedVar //NOTE: TURNED IT OFF!
            
            this.percSoundFileBass[this.currentPercIndexBass].play( this.windowedvar, nowInSeconds );  
            this.percSoundFile[this.currentPercIndex].play( this.windowedvar, nowInSeconds );

        }
        // this.collectSoundMessagesFromMidi(this.percSoundFile);
        // this.collectSoundMessagesFromMidi(this.percSoundFileBass);

    }

    collectSoundMessagesFromMidi( midi : DynamicMovementMidi[] )
    {

        midi.forEach( ( mid ) => {
            mid.updateAmplitude(); 
            this.soundMessages.push( ...mid.getSoundMessages() ); 
            this.amplitudeSoundMessages.push(  ...mid.getAmplitudeSoundMessages() )
        });
        this.clearMidiMessages( midi );
    }

    getSoundMessages() : SoundMessage[]
    {
        return this.soundMessages; 
    }

    getAmplitudeMessages() : AmplitudeSoundMessage[]
    {
        return this.amplitudeSoundMessages; 
    }

    clearMidiMessages( midi : DynamicMovementMidi[] )
    {
        midi.forEach( ( mid ) => {
            mid.clearMessages(); 
        }); 
    }

    clearMessages() : void
    {
        this.soundMessages = [];
        this.amplitudeSoundMessages = []; 
    }
}

