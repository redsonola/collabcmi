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
import type { MainVolume } from "./midiConversion"
import * as MovementData from './scaleBasedOnMovementData';
import { InstrumentID, SamplerWithID, SamplerFactory } from './xcorrSonify';

let TAKE_OUT_HIGH_CPU_CALLS : boolean = true; 

// class SamplerFactory 
// {
//     type : string = ""; 
//     constructor(  ) 
//     {
//     }

    // loadAllSamplers() : SamplerWithID[]
    // {
    //     let samplers : SamplerWithID[];
    //     samplers = 
    //     [
    //         this.loadSampler( "flute" ), 
    //         this.loadSampler( "contrabassoon" ),
    //         this.loadSampler( "clarinet" ), 
    //     ];
    //     return samplers;
    // }
    //     if( this.type === "bamboo flute" )
    //     {
    //         return this.loadTubaLoudSampler();
    //     }
    // }


// }
                                    // g  ab  bb  c   d   eb   f   g  ab   bb   c  
const keyOfCPitchClass4 : number[] = [55, 56, 58, 60, 62, 63, 65, 67, 68, 70, 72];//, 77, 79, 80, 81, 83, 84 ]; // try higher notes

//this has some repeated code with xcorrSonify.ts due to legacy not being the same. 
//TODO: get rid of all the repeats -- not sure what is same/different now -- the update function I think is different.
//so probably need to inherit.
class LongPlayingNoteSamplerSpaceBtw
{
    TUBA_MAX_LENGTH : number = Tone.Time("2n").toSeconds(); //4sec before hard click -- WTF MATE
    timeBtwAttacks : number = 0; 
    curLongIndex : number = 0;

    lastAttackTime : number[] = []; //that means its not attacking
    longPlayingNote : number[] = [];
    lastPitchCheck : number = 0;

    longEnv : Tone.AmplitudeEnvelope[]; 
    longSampler : SamplerWithID[];
    compressors : Tone.Limiter[];
    longVibrato : Tone.Vibrato[];
    waveForms : Tone.Waveform[];
    // feedBackFilters: Tone.FeedbackCombFilter[]; 

    curYToPitch : number = 0; 

    isCello : boolean = false; 
    name : string;

    TIME_WAIT_BEFORE_RELEASE = 0.5;
    playing : boolean = false; 

    LOWEST_WHILST_TOUCHING : number = -90; //changed from -60

    instrumentID : InstrumentID = -1; 

    // maxAmp: number = 0; 

    samplerFactory : SamplerFactory = new SamplerFactory(); 

    last16thNote : number = 0;

    MAX_VOLUME : number = 2; //maybe change even higher         //was 4
    FLUTE_MAX_VOLUME : number =6; //maybe change even higher   //was 30
    BASSOON_MAX_VOLUME : number = 2; //was 4
    REALMAXVOL : number = -18; 

    constructor( mainVolume : MainVolume, name:string ) 
    {
        this.name = name;

        this.longSampler = [
            this.samplerFactory.loadSampler(this.name), 
            this.samplerFactory.loadSampler(this.name), 
            this.samplerFactory.loadSampler(this.name), 
            this.samplerFactory.loadSampler(this.name)
        ];
        this.instrumentID = this.longSampler[0].id;   


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
        // this.feedbackDelays = []; 
        // this.chorus = [];
        // this.feedBackFilters = [];
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

                tuba.chain( vib, newEnv, mainVolume.getVolume() ); 
                newEnv.connect( waveForm ); 
            }
        );
    }

    getOut()
    {
        return this.longEnv; 
    }

    createLongEnv()
    {
        return new Tone.AmplitudeEnvelope({
            attack: 0.001,
            decay: 0.7,
            sustain: 0.2,
            release: 1.2
        });
    }

    isPlaying() : boolean
    {
        return this.playing;
    }

    setMaxVolume(vol: number)
    {
        this.MAX_VOLUME = vol;
    }

    setMaxVolumeFlute(flute: number)
    {
        this.FLUTE_MAX_VOLUME = flute; 
    }

    setMaxVolumeBassoon(bassoon: number)
    {
        this.BASSOON_MAX_VOLUME = bassoon; 
    }

    setRealMaxVolume(vol:number)
    {
        this.REALMAXVOL = vol;
    }

    //just changed to stay the same pitch
    updateNoRetrigger(dx : number) : void
    {
        if( isNaN( dx ) )
        {
            return ;
        }

        //change volume based on xcorr
        let i=0; 
        this.longSampler.forEach( (sampler)=>
        {
            let vol; 
            if( sampler.id === InstrumentID.flute )
            {
                vol = Scale.linear_scale( dx, 0, MovementData.getMidiFileDxMax(), 0, this.FLUTE_MAX_VOLUME )
            }
            else if( sampler.id === InstrumentID.contrabassoon )
            {
                vol = Scale.linear_scale( dx, 0, MovementData.getMidiFileDxMax(), 0, this.BASSOON_MAX_VOLUME );
            }
            else
            {
                vol = Scale.linear_scale( dx, 0, MovementData.getMidiFileDxMax(), 0, this.MAX_VOLUME );
            }

            vol = Math.min(vol, this.REALMAXVOL);                     
            sampler.volume.rampTo(vol);

        });
    }

    setAmplitudeAttack( accel : number )
    {
        if(accel === 0 )
            return; 

        //this accel avg doesn't account for confidence, etc. probably need to calc on participant side
        //TODO OMFG FIX THIS AFTER SUBMISSION DEADLINE
        accel = Scale.linear_scale( accel, 0, 0.4, 0, 1 );
        let attack = Math.max(1 - accel, 0.1); //just try

        // console.log({accel: accel, attack:attack});

        // "linear"
        // "exponential"
        // "sine"
        // "cosine"
        // "bounce"
        // "ripple"
        // "step"

        // let attackCurveArray = ["linear", "exponential", "bounce"]; 
        // let index = 0; 
        // if(attack < 0.7)
        // {
        //     index = 1
        // }
        // else if( attack )
        // {

        // }

        this.longEnv.forEach( (env) => {
            env.attack = attack; 
            env.release = attack; 
        });
    }

    getLastPitch()
    {
        return this.longPlayingNote[ this.curLongIndex ]; 
    }

    //just changed to stay the same pitch
    update(now : number, xToPitch: number, yToPitch:number, xcorr : number, lastPitch : number, isforArm : boolean = false, accel: number[]) : number
    {
        if( this.isPlaying() )
        {
            //change volume based on xcorr
            let i=0; 
            this.longSampler.forEach( (sampler)=>
            {
                if(xcorr < 0.166)
                {
                    if( sampler.id === InstrumentID.flute )
                    {
                        sampler.volume.rampTo(Scale.linear_scale( xcorr, 0.166, 1, this.LOWEST_WHILST_TOUCHING,this.FLUTE_MAX_VOLUME  ));
                    }
                    else if( sampler.id === InstrumentID.contrabassoon )
                    {
                        sampler.volume.rampTo(Scale.linear_scale( xcorr, 0.166, 1, this.LOWEST_WHILST_TOUCHING, this.BASSOON_MAX_VOLUME ));    
                    }
                    else
                    {
                        sampler.volume.rampTo(Scale.linear_scale( xcorr, 0.166, 1, this.LOWEST_WHILST_TOUCHING, this.MAX_VOLUME  ));
                    }
                }
                else
                {

                    let vol; 
                    let longerFadeout = 0; 
                    if( i===2 || i===3 )
                    {
                        longerFadeout = 0; 
                    }
                    if( sampler.id === InstrumentID.flute )
                    {
                        vol = Scale.linear_scale( xcorr, 0.166, 1, -13, this.FLUTE_MAX_VOLUME );
                    }
                    else if( sampler.id === InstrumentID.contrabassoon )
                    {
                        vol = Scale.linear_scale( xcorr, 0.166, 1, -13, this.BASSOON_MAX_VOLUME );
                    }
                    else
                    {
                        vol = Scale.linear_scale( xcorr, 0.166, 1, -13, this.MAX_VOLUME ) ;
                    }
                    vol = Math.min(vol, this.REALMAXVOL);
                    if( vol <= longerFadeout && vol < sampler.volume.value && accel[i] < 0.4 ) 
                    {
                        vol = sampler.volume.value - 0.5; 
                    }
                    sampler.volume.rampTo(vol);
                    // console.log(i + " vol: " + vol); 
                }
                //this.feedBackFilters[i].delayTime.value =  Scale.linear_scale( xcorr, 0.099, 1, 0.001, 0.5 )  ;
                i++;
                // console.log( "touchingXCorr: " + touchingXCorr + " volume :" + sampler.volume.value );
            });

            //just reduced the wait btw release time 
            let releaseTime : number = this.timeBtwAttacks;

            if(( now - this.lastAttackTime[this.curLongIndex] >= this.TUBA_MAX_LENGTH ) && !this.longSampler[this.curLongIndex].playNote )
            {
                // console.log( "new release :" + now, this.TUBA_MAX_LENGTH );
                this.triggerRelease(true, 0);

                if( this.curLongIndex < this.lastAttackTime.length-1 ){
                    this.curLongIndex++; 
                }
                else
                {
                    this.curLongIndex = 0;  
                }

                this.longSampler[this.curLongIndex].playNote = true;
                this.longSampler[this.curLongIndex].timeReleased = now; 
            }
            else if(this.longSampler[this.curLongIndex].playNote &&  (now - this.longSampler[this.curLongIndex].timeReleased >= releaseTime ) )
            {
                // console.log( "new attack: releaseTime, timeReleased, now", releaseTime,  this.longSampler[this.curLongIndex].timeReleased, now );
                
                //try start
                this.curYToPitch = yToPitch; 
                lastPitch = this.triggerAttack(xcorr, lastPitch, xToPitch, yToPitch, now, true, isforArm); 
                this.lastPitchCheck = now; 
                this.longSampler[this.curLongIndex].playNote = false; 
                this.longSampler[this.curLongIndex].timeReleased = 0; 
            }

            // else if( now-this.lastPitchCheck >= Tone.Time("4n").toSeconds() ) //ok need to fix this part - also check if changes pitch
            // {
            //     this.lastPitchCheck = now; 
            //     this.triggerRelease(true, 0);
            //     this.triggerAttack(xcorr, -1, xToPitch, yToPitch, now, true)
            // }  
        }
        else //ok, overkill but
        {
            this.longSampler.forEach( (sampler)=>
            {
                sampler.volume.rampTo( -90);
            // console.log( "touchingXCorr: " + touchingXCorr + " volume :" + sampler.volume.value );
            });
        }

        return lastPitch; 
    }

    triggerAttack(touchingXCorr:number, pitch : number = -1, xToPitchClass = 0.5, yToPitch = 0, curTime = -1, isForHeld=false, isForArm=false) : number
    {
        this.curYToPitch = yToPitch;
        if(!isForHeld) //note DO NOT SET FALSE!
        {
            this.playing = true; 
        }

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
        let index = 0;
        try{

            if( isForArm )
            {
                //do nothing for now.            d  eb   f  g   a                                   b   c   d   eb  f   g  ab  bb  c
                // let keyOfCScale : number[] = [48, 50, 51,53, 55, 56, 58, 60, 62, 63, 65, 67, 68, 71, 72, 74, 75, 77, 79, 80, 82, 84 ]; // try higher notes
                //more notes inbetween when busier???
                let keyOfCScale : number[] = [48, 50, 53, 56, 60, 62, 63, 65, 67, 68, 71, 72, 74, 80, 84 ]; // try higher notes

                let scaleToUse = keyOfCScale;

                if(this.instrumentID = InstrumentID.cello )
                {
                    keyOfCScale.forEach( (note)=> note -= 12 ); //take it down an octave if it is a cello
                }

                //add an octave before and after. TODO -- only when partner joins
                // let scale = [74, 75, 77, 79, 80, 82, 84];
                // scale.forEach( (key)=> key+=12);
                // keyOfCScale.push( ...scale );
                // let scaleToUse = [48, 50, 51,53, 55, 56, 58]; 
                // scaleToUse.forEach( (key)=> key-=12);
                // scaleToUse.push( ...keyOfCScale ); 

                let index = Scale.linear_scale(1-yToPitch, 0, 1, 0, scaleToUse.length-1);
                index = Math.round(index); 
                pitch = scaleToUse[index];
                this.longPlayingNote[this.curLongIndex] = pitch;
            }
            else if(pitch === -1)
            {
                //let keyOfCPitchClass4 = [43, 44, 46, 48, 50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 68, 71, 72, 74, 76];//, 77, 79, 80, 81, 83, 84 ]; // try higher notes

                let randNote = Math.random();
                //now not using x but instead, random.
                index = Math.round( Scale.linear_scale( randNote, 0, 1, 1, keyOfCPitchClass4.length ) );
                //index = keyOfCPitchClass4.length - index; //flip

                //ok just trying this.
                // let whichOctave = Math.round( Scale.linear_scale( 1-yToPitchClass, 0, 1, -1, 1 ) );
                let whichOctave = Math.round( Scale.linear_scale( Math.random(), 0, 1, -1, 1 ) );


                pitch = keyOfCPitchClass4[index-1] + whichOctave*12;
                this.longPlayingNote[this.curLongIndex] = pitch;


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
            console.log(e);
            console.log( "LONG NOTE triggerAttack: Likely this buffer was not set: " + this.name + "->" + this.longPlayingNote[this.curLongIndex] + " pitch: " 
                + pitch + "  index: " + index );

            // console.log(e);
        }
        return pitch; 
    }

    triggerAttackRelease(pitch : number = -1, whichOctave : number, curTime = -1, howLongHeld : number, startTime : number) : {pitch : number, whichOctave : number }
    {
        let index = 0;
        try
        {
            if(pitch === -1)
            {
                //let keyOfCPitchClass4 = [43, 44, 46, 48, 50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 68, 71, 72, 74, 76];//, 77, 79, 80, 81, 83, 84 ]; // try higher notes

                let randNote = Math.random();
                //now not using x but instead, random.
                index = Math.round( Scale.linear_scale( randNote, 0, 1, 1, keyOfCPitchClass4.length-1 ) );
                //index = keyOfCPitchClass4.length - index; //flip

                //ok just trying this.
                pitch = keyOfCPitchClass4[index];
                this.longPlayingNote[this.curLongIndex] = pitch + whichOctave*12;

                // console.log( "this long playing note:" + this.longPlayingNote[this.curLongIndex] + "   yToPitchClass " + yToPitchClass );
            }

            this.longPlayingNote[this.curLongIndex] = pitch + whichOctave*12;
            
            // console.log(" triggering attack: ", pitch, startTime, howLongHeld, this.longSampler[this.curLongIndex].volume.value);
            this.longSampler[this.curLongIndex].triggerAttackRelease(Tone.Frequency(this.longPlayingNote[this.curLongIndex], "midi").toNote(), howLongHeld, curTime+startTime);
            this.longEnv[this.curLongIndex].triggerAttackRelease(howLongHeld, curTime+startTime); 
            // console.log("attack triggered")

            this.curLongIndex++; 
            if(this.curLongIndex >= this.longSampler.length)
            {
                this.curLongIndex = 0;
            }

        }
        catch(e)
        {
            console.log(e);
            console.log( "LONG NOTE triggerAttackRelease: Likely this buffer was not set: " + this.name + "->" + this.longPlayingNote[this.curLongIndex] + " pitch: " 
                + pitch + "  index: " + index );

            // console.log(e);
        }
        return {pitch: pitch, whichOctave: whichOctave}; 
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

}

class LongPlayingNoteBassClarinetHarmonics
 extends LongPlayingNoteSamplerSpaceBtw
{
    constructor( mainVolume : MainVolume )
    {
        super(mainVolume, "bass clarinet harmonics"); 
    }
}

class LongPlayingNoteFlute
 extends LongPlayingNoteSamplerSpaceBtw
{
    constructor( mainVolume : MainVolume )
    {
        super(mainVolume, "flute");
    }
}

class MelodiesForBusierTimes
{
    highWinVarLongPlayingNoteSamplers : LongPlayingNoteSamplerSpaceBtw[];
    highWinVarLongPlayingNoteSamplersPlaying : boolean = false; 
    highWinVarLongPlayingNoteSamplersStartTime : number = 0; 
    highWinVarLongPlayLastOnset : number = 0; 
    lastMelodyPitch : number = -1; 
    whichOctave : number = 0; 
    curAvgDx : number = 0;15
    feedbackDelay : Tone.FeedbackDelay[];

    maxXcorrAvg : number = 0; 
    maxXcorrCount : number = 0;
    TIME_WITH_HIGH_XCORR = 2.5; //5 seconds?
    dxCutOff : number;
 

    constructor(mainVolume : MainVolume, whichOctave : number = 0)
    {
        this.highWinVarLongPlayingNoteSamplers = []; 
        //this.highWinVarLongPlayingNoteSamplers.push( new LongPlayingNoteSampler( mainVolume, "contrabassoon" ) ); 
        // this.highWinVarLongPlayingNoteSamplers.push( new LongPlayingNoteSampler( mainVolume, "clarinet" ) ); 
        this.highWinVarLongPlayingNoteSamplers.push( new LongPlayingNoteSamplerSpaceBtw( mainVolume, "flute" ) ); 

        if( !TAKE_OUT_HIGH_CPU_CALLS )
        {
            this.highWinVarLongPlayingNoteSamplers.push( new LongPlayingNoteSamplerSpaceBtw( mainVolume, "flute" ) ); 
            this.highWinVarLongPlayingNoteSamplers.push( new LongPlayingNoteSamplerSpaceBtw( mainVolume, "flute" ) ); 
            this.highWinVarLongPlayingNoteSamplers.push( new LongPlayingNoteSamplerSpaceBtw( mainVolume, "flute" ) ); 
        }

        this.whichOctave = whichOctave;
        this.dxCutOff = MovementData.getMidiFileDxMidwayBtwMaxAndMedian(); 

        //TOOK THIS OUT -- maybe put back for later
        if( !TAKE_OUT_HIGH_CPU_CALLS )
        {
            this.feedbackDelay = [];
            let delayTimes = ["2n", "4n", "8n", "16n"];
            for( let i=0; i<delayTimes.length; i++ ){
                this.feedbackDelay.push( new Tone.FeedbackDelay(delayTimes[i], 0.5) );
                this.feedbackDelay[i].wet.value = 0; 
                this.highWinVarLongPlayingNoteSamplers.forEach((sampler)=>{
                    sampler.getOut().forEach( (out)=> {out.connect(this.feedbackDelay[i]).connect( mainVolume.getVolume() ) }); 
                });
            }
            this.setMaxVolume(2);
            this.setMaxVolumeFlute(18); //15
            this.setMaxVolumeBassoon(2)
            this.setRealMax(8);
        }
    }

    setDXCutOff( cutOff : number )
    {
        this.dxCutOff = cutOff; 
    }

    setMaxVolume(vol: number)
    {
        this.highWinVarLongPlayingNoteSamplers.forEach(sampler => {
            sampler.setMaxVolume( vol )  ; 
        });
    }

    setRealMax(vol: number)
    {
        this.highWinVarLongPlayingNoteSamplers.forEach(sampler => {
            sampler.setRealMaxVolume( vol )  ; 
        });
    }

    setMaxVolumeFlute(flute: number)
    {
        this.highWinVarLongPlayingNoteSamplers.forEach(sampler => {
            sampler.setMaxVolumeFlute( flute )  ; 
        });
    }

    setMaxVolumeBassoon(bassoon: number)
    {
        this.highWinVarLongPlayingNoteSamplers.forEach(sampler => {
            sampler.setMaxVolumeBassoon( bassoon )  ; 
        });
    }

        //just an idea to try                    g  ab   bb   c   d  eb  f   g   ab  bb   c
    //const keyOfCPitchClass4 : number[] = [55, 56, 58, 60, 62, 63, 65, 67, 68, 69, 72];
    chooseRandomAccompanimentPitch(pitch : number) : number
    {
        let intervals : number[] = [ -4, -2, 2, 4, 5 ]; 
        let interval = Math.round( Scale.linear_scale( Math.random(), 0, 1, 0, intervals.length-1 ) ); 

        let pitch_index = keyOfCPitchClass4.indexOf(pitch);
        let newPitchIndex = pitch_index + interval; 
        if( newPitchIndex >= keyOfCPitchClass4.length )
        {
            newPitchIndex = newPitchIndex - keyOfCPitchClass4.length; 
        }
        else if(newPitchIndex < 0)
        {
            newPitchIndex = newPitchIndex + keyOfCPitchClass4.length; 
        }

        //avoid the tritone! 
        if( newPitchIndex - pitch_index === 6 || newPitchIndex - pitch_index === -6 )
        {
            newPitchIndex++; 
        }

        return keyOfCPitchClass4[newPitchIndex]; 
    }

    setStartPitch(lastMelodyPitch : number = -1)
    {
        this.lastMelodyPitch = lastMelodyPitch; 
    }

    getLastPitch()
    {
        return this.lastMelodyPitch; 
    }

    //const keyOfCPitchClass4 : number[] = [55, 56, 58, 60, 62, 63, 65, 67, 68, 69, 72];//, 77, 79, 80, 81, 83, 84 ]; // try higher notes

    chooseMelodyPitch(pitch : number, lastDirection : number = 0) : number
    {
        if(pitch === -1)
        {
            let index = Math.round( Scale.linear_scale( Math.random(), 0, 1, 0, keyOfCPitchClass4.length-1 ) );
            return keyOfCPitchClass4[index]; 
        }

        let decision : number = Math.random(); 
        let continueInSameDirection : number = Math.random(); 
        if( decision < 0.2 )
        {
            return this.chooseRandomAccompanimentPitch( pitch );
        }
        else 
        {
            let newPitchIndex = keyOfCPitchClass4.indexOf(pitch) ; 
            //if step-wise motion keep the step-wise motion
            //Todo, if there was a jump, then go the opposite way
            if(
                ( ( decision < 0.65 && continueInSameDirection===0 ) || ( continueInSameDirection < 0.85 && lastDirection ===1 ) ) &&
                !( continueInSameDirection < 0.85 && lastDirection === -1  ))
            {
                newPitchIndex = newPitchIndex + 1;
                if( newPitchIndex >= keyOfCPitchClass4.length )
                {
                    newPitchIndex = newPitchIndex - 2; 
                }
            }
            else
            {
                newPitchIndex = newPitchIndex - 1;
                if( newPitchIndex < 0 )
                {
                    newPitchIndex = newPitchIndex + 2; 
                }
            }

            return keyOfCPitchClass4[newPitchIndex]+12; //we're using flute, so this really needs to be higher
        }
        
    }

        //this.highWinVarLongPlayingNoteSamplers = []; 
    //this function is a mess surely there is a cleaner way to do this
    updateHighWinVarLongPlayingNoteSamplers( now : number, xcorr : number[], curAvgDx:number, startTime : number, timeToUpdate : boolean )
    {       
        this.curAvgDx = curAvgDx; 
        let maxXcorr = Math.max(...xcorr);
        this.maxXcorrAvg += maxXcorr; 
        this.maxXcorrCount++;

        //this aren't actually long playing notes, hmmm... need to refactor
        this.highWinVarLongPlayingNoteSamplers.forEach( (sampler) =>
        {
            sampler.updateNoRetrigger(this.curAvgDx);
        });

        //only check on the 16th note -- for quantizing.
        if(!timeToUpdate)
        {
            return; 
        }

        if(this.maxXcorrCount > 0)
        {
            this.maxXcorrAvg /= this.maxXcorrCount; 
            this.maxXcorrCount = 0; 
        }

        const XCORR_TO_START_LONG_PLAYING = MovementData.getMidiFileSynchScoreMidwayBtwMaxAndMedian(); 
        const TIME_BETWEEN_ONSETS = Tone.Time("2n").toSeconds(); //TODO -- vary this btw 16 8 4


        if( this.maxXcorrAvg >=  XCORR_TO_START_LONG_PLAYING )
        {

            if( !this.highWinVarLongPlayingNoteSamplersPlaying )
            {
                if( this.highWinVarLongPlayingNoteSamplersStartTime === 0 )
                {
                    this.highWinVarLongPlayingNoteSamplersStartTime = now; 
                }
                else
                {
                    let timeInterval = now - this.highWinVarLongPlayingNoteSamplersStartTime
                    this.highWinVarLongPlayingNoteSamplersPlaying = ( timeInterval >= this.TIME_WITH_HIGH_XCORR )
                        && this.curAvgDx > MovementData.getMidiFileDxMidwayBtwMaxAndMedian() ; 
                }
            }

            if( this.highWinVarLongPlayingNoteSamplersPlaying )
            {
                if( now - this.highWinVarLongPlayLastOnset >= TIME_BETWEEN_ONSETS )
                {
                    console.log("playing notes");

                    //how many notes to trigger
                    let howManyNotes = Scale.linear_scale(Math.random(), 0, 1, 1, 4);
                    howManyNotes = Math.round(howManyNotes);
                    
                    //when to start?
                    let startDelayArray = [0, "16n", "4n", "2n"];
                    let startDelay = Scale.linear_scale(Math.random(), 0, 1, 0, startDelayArray.length-1);
                    startDelay = Math.round(startDelay);

                    let index = Scale.linear_scale(Math.random(), 0, 1, 0, this.highWinVarLongPlayingNoteSamplers.length-1);
                    index = Math.round(index); 


                    startTime += startDelay; 
                    for(let i=0; i<howManyNotes; i++)
                    {
                        //get random instrument and duration

                        let duration : number = TIME_BETWEEN_ONSETS / howManyNotes;
                        // duration = note16 * Math.round(duration); 
                        let lastDirection = 0;

                        //trigger
                        // console.log( "triggering note" );
                        let prevPitch : number =  this.lastMelodyPitch ;

                        //this.highWinVarLongPlayingNoteSamplers[index].longSampler.forEach
                        let pitch :{ pitch:number, whichOctave:number } = this.highWinVarLongPlayingNoteSamplers[index].triggerAttackRelease(this.lastMelodyPitch, this.whichOctave, now, duration, startTime); 
                        this.lastMelodyPitch = pitch.pitch; 
                        this.whichOctave = pitch.whichOctave; 

                        this.lastMelodyPitch  = this.chooseMelodyPitch(  this.lastMelodyPitch  ); //pitches are related to prev.

                        startTime = duration + startTime;
                        if( prevPitch !== -1 )
                        {
                            lastDirection = this.lastMelodyPitch - prevPitch;
                        }
                    }
                    this.highWinVarLongPlayLastOnset = now; 
                }
            }
        }
        else
        {
            this.highWinVarLongPlayingNoteSamplersPlaying = false; 
            this.highWinVarLongPlayingNoteSamplers.forEach( (sampler)=>{ sampler.triggerRelease() }); 
            this.highWinVarLongPlayingNoteSamplersStartTime = 0;
            this.highWinVarLongPlayLastOnset = 0; 
        }
        this.maxXcorrAvg = 0;
    }
}

//sonifies each bodypart
export class SynchSonifier {

    participant : Participant;
    samplers : SamplerWithID[];
    samplersWaveForms : Tone.Waveform[]; 
    // nonCanSamplerCountNumber : number; //not using can samplers for this now hmmm

    longPlayingNoteSamplers : LongPlayingNoteSamplerSpaceBtw[]; 
    octaves : number[]; 

    feedbackDelay : Tone.FeedbackDelay[]; //the array of feedback delays 
    chorus : Tone.Chorus[]; //array of choruses

    // reverb : Tone.Freeverb; 


    // tubeSampler2 :  Tone.Sampler; 
    samplersLoaded : boolean = false; 
    playingNote : number = -1;

    vibratos : Tone.Vibrato[];

    ampEnvs : Tone.AmplitudeEnvelope[];

    whichIsPlayingIndex : number = 0; 
    measureLen : number; 
    lastTimeCheckedDxMax : number; 
    curAvgDx : number; 
    sumDx : number; 
    dxCount : number; 

    // soundMessages : SoundMessage[] = [];
    // amplitudeMessages : AmplitudeSoundMessage[] = [];  
    last16thNote : number = 0;

    marimbaVolume : number = 30;

    melodiesForBusierTimes : MelodiesForBusierTimes[] = []; 

    constructor( p : Participant, mainVolume : MainVolume ) {

        this.participant = p;
        
        const samplerFactory : SamplerFactory = new SamplerFactory(); 
        //TODO: FIX THIS SHIT
        this.samplers = [];
        
        //adds for each body part!
        this.longPlayingNoteSamplers = []; 
        this.longPlayingNoteSamplers.push( new LongPlayingNoteSamplerSpaceBtw( mainVolume, "contrabassoon" ) ); //head 
        this.longPlayingNoteSamplers.push( new LongPlayingNoteSamplerSpaceBtw( mainVolume, "clarinet" ) ); //torso 
        this.longPlayingNoteSamplers.push( new LongPlayingNoteSamplerSpaceBtw( mainVolume, "trumpet" ) ); //arm 
        this.longPlayingNoteSamplers.push( new LongPlayingNoteSamplerSpaceBtw( mainVolume, "cello" ) ); //arm 
        this.longPlayingNoteSamplers.push( new LongPlayingNoteSamplerSpaceBtw( mainVolume, "flute" ) ); //leg 
        this.longPlayingNoteSamplers.push( new LongPlayingNoteSamplerSpaceBtw( mainVolume, "flute" ) ); //leg 

        //ok, just try it.
        
        this.feedbackDelay = [];
        let delayTimes = ["2n", "4n", "8n", "16n"];
        for( let i=0; i<delayTimes.length; i++ )
        {
            this.feedbackDelay.push( new Tone.FeedbackDelay(delayTimes[i], 0.5) );
            this.feedbackDelay[i].wet.value = 0; 
            let j=0; 
            this.longPlayingNoteSamplers.forEach((sampler)=>{
                if(j!==2 && j!==3) //no delay on trumpets
                    sampler.getOut().forEach( (out)=> {out.connect(this.feedbackDelay[i]) }); 
                j++;
            });
        }

        //bc not going through delays, have to be louder
        this.longPlayingNoteSamplers[2].setMaxVolume( 30 ); 
        this.longPlayingNoteSamplers[3].setRealMaxVolume( -10 ); 


        //ugh bs
                //TOOK THIS OUT -- maybe put back for later            
        let startOctave = -1; 
        let endOctave = 1;
        if( !TAKE_OUT_HIGH_CPU_CALLS )
        {
            startOctave = -1; 
            endOctave = 1;
        }
        else
        {
            startOctave = 0;
            endOctave = 0;
        }

        this.melodiesForBusierTimes = [];
        for(let i=startOctave; i<=endOctave; i++)
        {
            this.melodiesForBusierTimes.push( new MelodiesForBusierTimes(mainVolume, i) );
        }
 
        this.ampEnvs = [];
        this.vibratos = [];
        this.samplersWaveForms = []; 
        let i = 0;  
        this.samplers = [];
        for(let i=0; i<6; i++)
        {
            this.samplers.push( samplerFactory.loadSampler( "marimba" ) ); 
            this.samplers[i].connect( mainVolume.getVolume() ); 
        }

        // this.masterCompressor.connect(mainVolume.getVolume());
        // this.testSynth = new Tone.Synth().connect(mainVolume.getVolume());


        //TODO: ugh, this replicates what is in midiFile -- refactor this out
        this.measureLen = Tone.Time("4n").toSeconds() * 4;
        this.lastTimeCheckedDxMax = 0; 
        this.curAvgDx = 0;
        this.sumDx = 0; 
        this.dxCount = 0; 
    }

    //need to update this, since bpm could change
    updateMeasureLength()
    {
        this.measureLen = Tone.Time("4n").toSeconds() * 4;
    }

    //arg this duplicates in midifile. just refactor out later
    updateAvgDx(now : number, dx : number) : void
    {
        this.sumDx += dx; 
        this.dxCount++; 

        if( now - this.lastTimeCheckedDxMax >= this.measureLen )
        {
            this.curAvgDx = this.sumDx / this.dxCount; 
            this.sumDx = 0; 
            this.dxCount = 0; 
            this.lastTimeCheckedDxMax = now; 
        }
    }


    setMaxVolume(vol: number)
    {
        this.longPlayingNoteSamplers.forEach(sampler => {
            sampler.setMaxVolume( vol )  ; 
        });

        this.melodiesForBusierTimes.forEach(melody => {
            melody.setMaxVolume( vol )  ; 
        });
    }

    setMaxVolumeFlute(flute: number)
    {
        this.longPlayingNoteSamplers.forEach(sampler => {
            sampler.setMaxVolumeFlute( flute )  ; 
        });

        this.melodiesForBusierTimes.forEach(melody => {
            melody.setMaxVolumeFlute( flute )  ; 
        });
    }

    setMaxVolumeBassoon(bassoon: number)
    {
        this.longPlayingNoteSamplers.forEach(sampler => {
            sampler.setMaxVolumeBassoon( bassoon )  ; 
        });

        this.melodiesForBusierTimes.forEach(melody => {
            melody.setMaxVolumeBassoon( bassoon )  ; 
        });
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

    // updateAmplitudeMessages()
    // {
    //     //this is kind of cludgy -- perhaps change this?
    //     //this gets the amplitude messages of sequenced short notes
    //     for( let i=0; i<this.nonCanSamplerCountNumber; i++  )
    //     {
    //         let out = 0;
    //         out += getAmplitude( [this.samplersWaveForms[i]] ); 
    //         out += getAmplitude( [this.samplersWaveForms[ i+this.nonCanSamplerCountNumber ]] );
    //         this.amplitudeMessages.push( new AmplitudeSoundMessage( this.samplers[i].id, out ) );
    //     }
    // }

    // updateLongSamplerAmplitudeMessages()
    // {
    //     //update long playing notes
    //     let out = 0;
    //     this.longPlayingNoteSamplers.forEach( (sampler) =>
    //     {
    //         out += sampler.getAmplitude(); 
    //     }); 

    //     //all long playing note samplers are the same instrument now
    //     this.amplitudeMessages.push( new AmplitudeSoundMessage( this.longPlayingNoteSamplers[0].instrumentID, out ) );
    // }

    //just an idea to try                    g  ab  bb  c   d   eb  f   g   ab  bb   c
    //const keyOfCPitchClass4 : number[] = [55, 56, 58, 60, 62, 63, 65, 67, 68, 69, 72];
    chooseRandomAccompanimentPitch(pitch : number) : number
    {
        let intervals : number[] = [ -4, -2, 2, 4, 5 ]; 
        let interval = Math.round( Scale.linear_scale( Math.random(), 0, 1, 0, intervals.length-1 ) ); 

        let pitch_index = keyOfCPitchClass4.indexOf(pitch);
        let newPitchIndex = pitch_index + interval; 
        if( newPitchIndex >= keyOfCPitchClass4.length )
        {
            newPitchIndex = newPitchIndex - keyOfCPitchClass4.length; 
        }
        else if(newPitchIndex < 0)
        {
            newPitchIndex = newPitchIndex + keyOfCPitchClass4.length; 
        }

        //avoid the tritone! 
        if( newPitchIndex - pitch_index === 6 || newPitchIndex - pitch_index === -6 )
        {
            newPitchIndex++; 
        }

        return keyOfCPitchClass4[newPitchIndex]; 
    }

    updateFeedbackDelay(timeToUpdate : boolean, accel : number[])
    {
        if(!timeToUpdate)
        {
            return ; 
        }

        let delayTimes = ["2n", "4n", "8n", "16n"];
        let delayIndex = Math.round( Scale.linear_scale( this.curAvgDx, 0, 1, 0, delayTimes.length-1  ) ); 
        let decay = Scale.linear_scale( this.curAvgDx, 0, 1, 0.1, 0.7 )
        
        let avg = 0; 
        let count = 0; 
        for( let i=0; i<accel.length; i++ )
        {
            if(accel[i] > 0)
            {
                avg += accel[i];
                count++;
            }
        }

        if(count === 0)
        {
            avg = 0;
        }
        else avg = avg / count;
        let delayTimes2 = ["2n", "4n", "8n", "16n"];
        // console.log("accel:"  + avg); 

        if(avg < 0.6 && avg > 0.8 ) // && this.feedbackDelay.delayTime.value !== 0 )
        {
            for(let i=0; i<this.feedbackDelay.length; i++)
            {
                   this.feedbackDelay[i].wet.rampTo(0, "16n"); 
            }
        }
        else
        {
            let delayIndex2 = Math.round( Scale.linear_scale(avg, 0.6, 1, 0, this.feedbackDelay.length-1  ) ); 
            this.feedbackDelay[delayIndex2].wet.rampTo(1, "16n");
            // this.feedbackDelay[delayIndex2].feedback.rampTo(decay, "16"); 
            // console.log("normal feedback on:" + delayIndex2 + " decay: " + decay);

            for(let i=0; i<this.feedbackDelay.length; i++)
            {
                if(i!==delayIndex2 && this.feedbackDelay[i].wet.value !== 0)
                    this.feedbackDelay[i].wet.rampTo(0, "16n"); 
            }
        }

        // this.melodiesForBusierTimes.forEach( (melody)=> {
        //     melody.feedbackDelay[delayIndex].wet.rampTo(1, "16n");
        //     // melody.feedbackDelay[delayIndex].feedback.rampTo(decay, "16");
        //     // console.log("busier feedback on:" + delayIndex + " decay: " + decay);


        //     for(let i=0; i<this.feedbackDelay.length; i++)
        //     {
        //         if(i!==delayIndex)
        //             melody.feedbackDelay[i].wet.rampTo(0, "16n"); 
        //     }
        // });
    }

    updateChorus(timeToUpdate : boolean, match : number)
    {
        if(!timeToUpdate)
        {
            return ; 
        }

        if(match  < 0.1 ) // && this.feedbackDelay.delayTime.value !== 0 )
        {
            for(let i=0; i<this.chorus.length; i++)
            {
                this.chorus[i].wet.rampTo(0, 0.1); 
            }
        }
        else
        {
            let chorusIndex = Math.round( Scale.linear_scale(match, 0, 1, 0, this.chorus.length-1 ) ); 
            this.chorus[chorusIndex].wet.rampTo(1, 0.1);
            //  console.log("chorus  on:" + chorusIndex );

            for(let i=0; i<this.chorus.length; i++)
            {
                if(i!==chorusIndex)
                    this.chorus[i].wet.rampTo(0, 0.1); 
            }
        }

        // this.melodiesForBusierTimes.forEach( (melody)=> {
        //     melody.feedbackDelay[delayIndex].delayTime.rampTo(delayTimes[delayIndex]);
        //     melody.feedbackDelay[delayIndex].feedback.rampTo(decay);
        //     // console.log("busier feedback on:" + delayIndex + " decay: " + decay);


        //     for(let i=0; i<this.feedbackDelay.length; i++)
        //     {
        //         if(i!==delayIndex)
        //             this.feedbackDelay[i].wet.rampTo(0, 0.1); 
        //     }
        // });
    }

    updateAmpEnvelopes(timeToUpdate : boolean, accel : number[])
    {
        if( !timeToUpdate )
        {
            return ; 
        }

        //try this

        let avgAccel : number = accel.reduce((a, b) => a + b) / accel.length ;

        for( let i=0; i<this.longPlayingNoteSamplers.length; i++ )
        {
            this.longPlayingNoteSamplers[i].setAmplitudeAttack( accel[i] ); 

            let durations = [Tone.Time("1n").toSeconds()*2, "1n", "2n", "4n", "8n", "16n"];
            let accelIndex = Math.round(Scale.linear_scale( accel[i], 0, 1, 0, durations.length -1 ) );
            if( accelIndex < 3 )
            {
                this.longPlayingNoteSamplers[i].timeBtwAttacks = 0.125;
            }
            else
            {
                this.longPlayingNoteSamplers[i].timeBtwAttacks = 0;
            }

            this.longPlayingNoteSamplers[i].TUBA_MAX_LENGTH = Tone.Time(durations[accelIndex]).toSeconds(); 
        }

        //refactor
        for( let i=0; i<this.melodiesForBusierTimes.length; i++ )
        {
            for( let j=0; j<this.melodiesForBusierTimes[i].highWinVarLongPlayingNoteSamplers.length; j++ )
            {
                this.longPlayingNoteSamplers[i].setAmplitudeAttack( avgAccel ); 
            }
        }
    }

    triggerJerkMarimba( now:number, timeToUpdate:boolean , jerk : number[], friendJerk : number[] )
    {
        const marimbaThresholdTrigger = 0.75; 

        for( let i=0; i < jerk.length; i++ )
        {
            if( jerk[i] >= marimbaThresholdTrigger && friendJerk[i] >= marimbaThresholdTrigger )
            {
                this.samplers[i].playNote = this.samplers[i].playNote || true;
            }
            else if( jerk[i] < 0.05 && friendJerk[i] < 0.05  )
            {
                this.samplers[i].justPlayed = false; //turn off when it goes back
            }
            this.samplers[i].volume.rampTo( this.marimbaVolume ); 
        }

        if( timeToUpdate )
        {
            let marimbaStartTime = 0; 
            let noteCount = 0; //only 3 at once
            for( let i=0; i < this.samplers.length; i++ )
            {
                if( this.samplers[i].playNote && !this.samplers[i].justPlayed )
                {
                    noteCount++;

                    if(noteCount < 3){
                        this.triggerAttackRelease(-1, 0, i, now, marimbaStartTime);
                    }
                    this.samplers[i].playNote = false; 
                    this.samplers[i].justPlayed = true; 

                    let rhythmArray = ["8n", "16n"]; 
                    let rhyIndex = Math.round(Scale.linear_scale( Math.random(), 0, 1, 0, rhythmArray.length-1 )); 
                    marimbaStartTime += Tone.Time(rhythmArray[rhyIndex]).toSeconds();
                }
            }
        }

    }

    triggerMelodiesForBusierTimes(now : number, xcorr : number[], lastPitch : number, timeToUpdate : boolean)
    {
        if(!timeToUpdate)
        {
            return;
        }

        //if time, randomize the indices
        let howBusy = 1; 
        if(this.curAvgDx > MovementData.getMidiFileDxMidwayBtwMaxAndMedian() )
        {
          howBusy = Scale.linear_scale(this.curAvgDx,  MovementData.getMidiFileDxMidwayBtwMaxAndMedian() , MovementData.getMidiFileDxMax(), 1, this.melodiesForBusierTimes.length-1 );
        }
         let startTime = 0;  
        let timeIncrement = [Tone.Time("8n").toSeconds(), Tone.Time("8n").toSeconds()*1.5, Tone.Time("8n").toSeconds()*1.75, Tone.Time("8n").toSeconds()*2]; 
        for(let i=0; i<Math.round(howBusy); i++)
        {
            this.melodiesForBusierTimes[i].setStartPitch(lastPitch);
            this.melodiesForBusierTimes[i].updateHighWinVarLongPlayingNoteSamplers(now, xcorr,this.curAvgDx, startTime, timeToUpdate); 
            
            lastPitch = this.chooseRandomAccompanimentPitch(this.melodiesForBusierTimes[i].getLastPitch());
            startTime = startTime + timeIncrement[i]
        }
    }

    triggerXcorrLongNotes(now, pitchLoc, xcorr : number[], accel: number[], timeToUpdate : boolean) : number
    {
        const thresholdTrigger = 0.09; 
        const thresholdStop = 0.001; 

        let lastPitch = -1; 
        for(let i=0; i<xcorr.length; i++)
        {
            if( xcorr[i] > thresholdTrigger  )
            {
                if( !this.longPlayingNoteSamplers[i].isPlaying() ) //changed to spare things
                {
                    lastPitch = this.triggerAttack( xcorr[i], lastPitch, pitchLoc[i].x, pitchLoc[i].y, i );
                    lastPitch = this.chooseRandomAccompanimentPitch( lastPitch ); 
                }
            }
            else if( xcorr[i] < thresholdStop )
            {
                this.triggerRelease(false, i); 
            }

            // if(timeToUpdate) {
            let isArm = i === 3 || i===2;
            lastPitch = this.longPlayingNoteSamplers[i].update( now, pitchLoc[i].x, pitchLoc[i].y, xcorr[i], lastPitch, isArm, accel ); 
            // }
            // else{
            //     lastPitch = this.longPlayingNoteSamplers[i].getLastPitch();
            // }
            lastPitch = this.chooseRandomAccompanimentPitch( lastPitch ); 
        }

        return lastPitch; 
    }

    //this is totally a cludge... I need to separate these 2 things into 2 different classes but ok.
    // update(yToPitch : number, touchingXCorr : number, startedTouching : boolean, stoppedTouching : boolean, howLongTouch : number)
    update( match: number, pitchLoc : {x:number, y:number}[], xcorr : number[], jerk : number[], friendJerk : number[], dx : number[] = [], avgDx : number, accel : number[] )
    {
        // this.soundMessages = []; //clear previous messages

        let now : number = Tone.now(); 
        let note16 = Tone.Time("16n").toSeconds();
        let timeToUpdate : boolean = false; 
        if( Tone.Transport.nextSubdivision("16n") <= 0.001 || now-this.last16thNote > note16 )
        {
            this.last16thNote = now; 
            timeToUpdate = true; 
        }

        this.updateMeasureLength(); 
        this.updateAvgDx(now, avgDx); 
        this.updateFeedbackDelay(timeToUpdate, accel);
        // this.updateChorus(timeToUpdate, match); 
        this.updateAmpEnvelopes(timeToUpdate, accel);

        //TODO: quantize
        let lastPitch = this.triggerXcorrLongNotes( now, pitchLoc, xcorr, accel, timeToUpdate ); //just to test
        this.triggerMelodiesForBusierTimes(now, xcorr, lastPitch, timeToUpdate );
        this.triggerJerkMarimba( now, timeToUpdate, jerk, friendJerk); 
        this.setVibrato(this.curAvgDx);

        // disabled for now
        // this.updateLongSamplerAmplitudeMessages();
    }

    setMarimbaVolume( vol : number )
    {
        this.marimbaVolume = vol; 
    }

    triggerAttackRelease(pitch : number = -1, yToPitchClass=0, whichInstrument=0, now : number, startTime : number = 0) : number[]
    {

        //note -- it could be not done releasing when I start the next note.
        //there is an error with the triggerAttack method in here. 
        //using try/catch to carry on but looking into it & also will do more sound design
        let index = 0;
        let noteLength = this.measureLen; //just let the natural dye out
        try
        {
            if( pitch !== -1 )
            {
                this.playingNote = pitch; 
            }
            else
            {
                let keyOfCPitchClass4 = [ 65, 67, 68, 70, 72, 74, 75, 77, 79, 80, 82, 84, 86, 87 ]; // try higher notes
                let randNote = Math.random();
                index = Math.floor( Scale.linear_scale( randNote, 0, 1, 0, keyOfCPitchClass4.length ) );

                let pitchClass = -2;//Math.round( Scale.linear_scale( yToPitchClass, 0, 1, -2, -1, true ));
                this.playingNote = keyOfCPitchClass4[index]+(12*pitchClass);

                //whichInstrument = Math.floor( Scale.linear_scale( Math.random(), 0, 1, 0, this.samplers.length ));
            }

            //TODO: an array of different 'tuba' sounds
            let humanize = Scale.linear_scale( Math.random(), 0, 1, 0.4, 1 ); 

            this.samplers[whichInstrument].triggerAttackRelease(Tone.Frequency(this.playingNote, "midi").toNote(), noteLength, now+startTime, humanize);

            // this.ampEnvs[whichInstrument].triggerAttackRelease("8n");
            // }
            // else if( noteDurDecider > 0.4 )
            // {
            //     this.samplers[whichInstrument].triggerAttackRelease(Tone.Frequency(this.playingNote, "midi").toNote(), "8n", Tone.now(), humanize);
            //     this.ampEnvs[whichInstrument].triggerAttackRelease("16n");
            // }
            // else    
            // {
            //     this.samplers[whichInstrument].triggerAttackRelease(Tone.Frequency(this.playingNote, "midi").toNote(), "16n", Tone.now(), humanize);
            //     this.ampEnvs[whichInstrument].triggerAttackRelease("32n");
            // }

            // let msg : SoundMessage = new SoundMessage( this.samplers[whichInstrument].id, this.playingNote );
            // this.soundMessages.push( msg );
            
        }
        catch(e)
        {
            // console.log(e);
            console.log( "SHORT NOTE: Likely this buffer was not set: " + whichInstrument + "->" + this.playingNote + " pitch: " 
                + pitch + "  index: " + index );        
        }


        return [this.playingNote, whichInstrument]; 
    }

    triggerRelease(forHeldNote : boolean = false, index : number)
    {
        // if( this.longPlayingNoteSamplers[index].isPlaying() )
        // {
        //     this.whichIsPlayingIndex = Scale.linear_scale( Math.random(), 0, 1, 0, this.longPlayingNoteSamplers.length-1 ); 
        //     this.whichIsPlayingIndex = Math.round( this.whichIsPlayingIndex ); 
        // }
        this.longPlayingNoteSamplers[index].triggerRelease(forHeldNote); 

        //trigger release for ALL
        // this.longPlayingNoteSamplers.forEach( sampler => {
        //     sampler.triggerRelease(forHeldNote); 
        // });
    }

    triggerAttack(xcorr: number, pitch : number = -1, xToPitchClass=-1, y : number = 0, index: number) : number 
    {
        let isArm = (index === 2 || index ===3 );
        let playedpitch : number = this.longPlayingNoteSamplers[ index ].triggerAttack(xcorr, pitch, xToPitchClass, y, 0, false, isArm);
        return playedpitch;

        // let msg : SoundMessage = new SoundMessage( this.longPlayingNoteSamplers[this.whichIsPlayingIndex].instrumentID, playedpitch );
        // if( playedpitch > -1 )
        // {
        //     this.soundMessages.push( msg );
        // }
    }

    setVibrato(avgdx:number)
    {
        let freq = 0;
        let depth = 0;
        
        depth = Scale.linear_scale(avgdx,0, MovementData.getMidiFileDxMax(), 0, 0.1);
        let maxFreq;
        this.longPlayingNoteSamplers.forEach( ( sampler ) =>
            {
                let maxFreq = Scale.linear_scale(Math.random(), 0, 1, 4, 8); 
                freq = Scale.linear_scale(avgdx, 0, MovementData.getMidiFileDxMax(), 0, maxFreq);        
                sampler.setVibrato(freq, depth); 
            });

        depth = Scale.linear_scale(avgdx,0, MovementData.getMidiFileDxMax(), 0, 0.125);
        this.melodiesForBusierTimes.forEach( (melody) =>
            { 
                melody.highWinVarLongPlayingNoteSamplers.forEach(sampler => {
                    let maxFreq = Scale.linear_scale(Math.random(), 0, 1, 5, 9); 
                    freq = Scale.linear_scale(avgdx, 0, MovementData.getMidiFileDxMax(), 0, maxFreq);   
                    sampler.setVibrato(freq, depth);     
                });
            });

        // this.highWinVarLongPlayingNoteSamplers.forEach( ( sampler ) =>
        //     {
        //         sampler.setVibrato(freq, depth); 
        //     });
    }

    // getSoundMessages() : SoundMessage[]
    // {
    //     return this.soundMessages; 
    // }

    // getAmplitudeMessages() : AmplitudeSoundMessage[]
    // {
    //     return this.amplitudeMessages; 
    // }

    // clearMessages() : void
    // {
    //     this.soundMessages = [];
    //     this.amplitudeMessages = []; 
    // }

}