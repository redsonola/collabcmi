import * as Tone from 'tone';
import { Midi } from '@tonejs/midi'
import * as Scale from './scale.ts';
import { SoundMessage, InstrumentID, SamplerWithID, getAmplitude, AmplitudeSoundMessage } from './xcorrSonify'

//controls all the volumes. ALL sound needs to be connected to this before going to destination.
export class MainVolume
{
    constructor(setVolMeter)
    {
        this.mainVolume = new Tone.Volume(-150).toDestination(); //set a master global volume control.
        this.mainVolume.volume.mute = true; 

        this.meter = new Tone.Meter();
        this.mainVolume.connect(this.meter);

        const update = () => {
            let val = Scale.linear_scale(this.meter.getValue(), -100, 10, 0, 1)
            if (isFinite(val)) {
                setVolMeter(val);
            }
            requestAnimationFrame(update);
        }
        update();        
    }

    getVolume()
    {
        return this.mainVolume; 
    }

    //expects 0 to 1
    set(vol)
    {

        if(vol <= 0.02)
        {
            this.mainVolume.volume.value = -100; 
            this.mainVolume.volume.mute = true; 
        }
        else
        {
            this.mainVolume.volume.mute = false; 
            let volume = Scale.linear_scale(vol, 0, 1, -60, 40);
            this.mainVolume.volume.value = volume; 
        }
    }
}

//modified from the Tonejs example of reading a midi file. all other classes that read midi files will inherit from this
export class LoadMidiFile {
    constructor() {
        this.currentMidi = [];
        this.synths = [];
        this.playing = false;

        let context = Tone.getContext(); 
        console.log(context.sampleRate); 


    }

    parseFile(file) {
        //read the file
        return fetch(file).then(response => response.blob()).then(heresUrBlob => {
            return new Promise((pass, fail) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.currentMidi.push(new Midi(e.target.result) );
                    pass();
                };
                reader.readAsArrayBuffer(heresUrBlob);
            });
        });
    }

    setPlaying(p) {
        this.playing = p;
    }

    ready() {
        return this.currentMidi.length != 0;
    }

    play(which = 0, curTime) {
        // window.isPlaying = this.playing;
        // window.currentMidi = this.currentMidi;

        

        if (this.playing && this.currentMidi.length>0) {

            const now = Tone.now() + 0.5;
            this.currentMidi[0].tracks.forEach((track) => {
                //create a synth for each track
                const synth = new Tone.PolySynth(Tone.Synth, {
                    envelope: {
                        attack: 0.02,
                        decay: 0.1,
                        sustain: 0.3,
                        release: 1,
                    },
                }).toDestination();

                this.synths.push(synth);

                //schedule all of the events
                track.notes.forEach((note) => {
                    synth.triggerAttackRelease(
                        note.name,
                        note.duration,
                        note.time + now,
                        note.velocity
                    );
                });
            });

        } else {
            //dispose the synth and make a new one
            while (this.synths.length) {
                const synth = this.synths.shift();
                synth.disconnect();
            }
        }
    }

}

/************************* */
//super class for all midi files
/************************* */

export class DynamicMovementMidi extends LoadMidiFile {

    constructor(mainVolume) {
        super();

        window.players = this.players;
        this.myloop = null;

        this.measureLen = Tone.Time("1n").toSeconds();
        this.noteQuarterLen = Tone.Time("4n").toSeconds();

        this.scheduledAhead = this.measureLen; //default 2 measures
        this.looping = false;
        this.startTime = Tone.now();
        this.magneticLoopStarted = 0;
        this.midiIndex = 0; 
        this.firstTimePlayed = true;
        
        this.soundMessages = [];
        this.amplitudeSoundMessages = [];
        this.waveForms = [];
    }

    parseAllFiles() {
    }

            //not magnetic anymore      
    findStartTime(origTime) {
        let curSchedule = this.scheduledAhead + origTime; //loops start playhing in 2 measures 
        return curSchedule;
    }

    //hmmm 
    startLoop() {
        this.looping = true;
        this.startTime = Tone.now();
    }

    //hmmm
    stopLoop() {
        this.looping = false;
        Tone.Transport.stop();
    }

    chooseWhichFileIndexBasedOnIndividualActivity(windowedVarScore) {
    }

    createVolumeCurve(  windowedVarScore )
    {
        let vol = -5;
        // if( windowedVarScore < 0.05 )  
        //     vol = Scale.linear_scale( windowedVarScore, 0, 1, -60, 0 ); 
        // else 
        // if (  windowedVarScore ) 
        // {
            vol = Scale.linear_scale( windowedVarScore, 0, 1, -15, 0 ); 
        // }

        return vol; 
    }


    isPlaying()
    {
        return this.playing;
    }

    play(windowedVarScore, curTime) 
    {
    }

    reset(curTime)
    {
        this.looping = true; 
        this.startTime = curTime; 
        this.firstTimePlayed = true; 
    }

    getWaveForms() {
        return this.waveForms;
    }

    updateAmplitude()
    {
        if(this.waveForms.length <= 0)
        {
            console.log("ERROR: Dynamic midi file has no waveform");
            return; 
        }

        let out = getAmplitude( this.waveForms );
        this.amplitudeSoundMessages.push( new AmplitudeSoundMessage( this.playgroundSamplers[0].id, out ) );
    }

    getAmplitudeSoundMessages()
    {
        return this.amplitudeSoundMessages; 
    }

    getSoundMessages() 
    {
        return this.soundMessages; 
    }
    clearMessages()
    {
        this.soundMessages = []; 
        this.amplitudeSoundMessages = []; 
    }
}



//https://www.musicradar.com/news/drums/1000-free-drum-samples
//got the drum samples from there.
//ok this is just a drum kit
export class Tango332Riffs extends DynamicMovementMidi {

     
    constructor(mainVolume)
    {
        super(); 

        // this.playgroundSampler = new Tone.Sampler({
        //     urls: {
        //     "G2" : "CYCdh_K2room_Kick-01.wav",
        //     "A2" : "CYCdh_K2room_Kick-02.wav",
        //     "B2" : "CYCdh_K2room_Kick-03.wav",
        //     "C3" : "CYCdh_K2room_Kick-04.wav",
        //     "D3" : "CYCdh_K2room_Kick-05.wav",
        //     "E3" : "CYCdh_K2room_Kick-06.wav",

        //     "F3" : "CYCdh_K2room_SdSt-07.wav",
        //     "G3" : "CYCdh_K2room_SdSt-06.wav",
        //     "A3" : "CYCdh_K2room_SdSt-05.wav",
        //     "B3" : "CYCdh_K2room_SdSt-04.wav",
        //     "C4" : "CYCdh_K2room_SdSt-03.wav",
        //     "C#4" : "CYCdh_K2room_SdSt-01.wav",

        //     "D4" : "CYCdh_K2room_ClHat-01.wav",
        //     "E4" : "CYCdh_K2room_ClHat-02.wav",
        //     "F4" : "CYCdh_K2room_ClHat-03.wav",
        //     "G4" : "CYCdh_K2room_ClHat-04.wav",
        //     "A4" : "CYCdh_K2room_ClHat-05.wav",
        //     "B4" : "CYCdh_K2room_ClHat-06.wav",
        //     "C5" : "CYCdh_K2room_ClHat-07.wav",
        // },
        // // release : 1,
        // baseUrl : "./audio_samples/Kit_2_Acoustic_room/"
        // }).connect(mainVolume.getVolume());

        this.playgroundSamplers = [
            new SamplerWithID({
                urls: {
                "G3" : "MC_Set1.wav",
                "A3" : "MC_Set3.wav"
            },
            // release : 1,
            baseUrl : "./audio_samples/Muted_Can/"
            }).connect( mainVolume.getVolume() ),

            new SamplerWithID({
                urls: {
                "G3" : "MC_Set1-01.wav",
                "A3" : "MC_Set3-01.wav"
            },
            // release : 1,
            baseUrl : "./audio_samples/Muted_Can/"
            }).connect( mainVolume.getVolume() ),

            new SamplerWithID({
                urls: {
                "G3" : "MC_Set1-02.wav",
                "A3" : "MC_Set3-02.wav"
            },
            // release : 1,
            baseUrl : "./audio_samples/Muted_Can/"
            }).connect( mainVolume.getVolume() ),

            new SamplerWithID({
                urls: {
                "G3" : "MC_Set1-03.wav",
                "A3" : "MC_Set3-03.wav"
            },
            // release : 1,
            baseUrl : "./audio_samples/Muted_Can/"
            }).connect( mainVolume.getVolume() ),

            new SamplerWithID({
                urls: {
                "G3" : "MC_Set1-04.wav",
                "A3" : "MC_Set2-04.wav"
            },
            // release : 1,
            baseUrl : "./audio_samples/Muted_Can/"
            }).connect( mainVolume.getVolume() )
        ];

        this.playgroundSamplers.forEach( (sampler) => {
            sampler.id = InstrumentID.mutedcanPercussion; 
            let waveForm = new Tone.Waveform(); 
            this.waveForms.push( waveForm );
            sampler.connect(waveForm); 
        });

        this.synths.push(this.playgroundSamplers);
        window.players = this.players; 
        this.myloop = null; 

        const measureLen = Tone.Time("1n").toSeconds();
        this.noteQuarterLen = Tone.Time("4n").toSeconds();

        this.scheduledAhead = measureLen; 
        this.looping = false; 
        this.startTime = Tone.now(); 
        this.magneticLoopStarted = 0; 
    }

    parseAllFiles()
    {
        this.parseFile('./collab_perc_midi/milongaPatternSparser.mid');
        this.parseFile('./collab_perc_midi/milongaPatternBase.mid');
        this.parseFile('./collab_perc_midi/milongaPatternBaseBusier.mid');
        this.parseFile('./collab_perc_midi/milongaPatternBaseBusiest2.mid');
        this.parseFile('./collab_perc_midi/milongaPatternBaseBusiest3.mid');
    }

    //also add additional notes for super budy & subtract more... on a scale.
    chooseWhichFileIndexBasedOnIndividualActivity( windowedVarScore )
    {

        //just to start
        // if( windowedVarScore < 0.2 )
        // {
        //     this.midiIndex = 0; 
        // }
        // else if( windowedVarScore < 0.4 )
        // {
        //     this.midiIndex = 1; 
        // }
        // else if( windowedVarScore < 0.6 )
        // {
        //     this.midiIndex = 2; 
        // }
        // else if( windowedVarScore < 0.8 )
        // {
        //     this.midiIndex = 3; 

        // }
        // else 
        // {
        //     this.midiIndex = 4; 
        // }

        let prevIndex = this.midiIndex;

        //first create the scaling
        this.midiIndex = Scale.linear_scale( windowedVarScore, 0, 1, 0, this.currentMidi.length );
        this.midiIndex = Math.round(this.midiIndex);  

        //only change by 1 step at a time
        if(prevIndex > this.midiIndex )
        {
            this.midiIndex = prevIndex - 1;
        }
        else if( prevIndex < this.midiIndex )
        {
            this.midiIndex = prevIndex + 1; 
        }

        return this.midiIndex;
    }
    
    //ok, I took out the magnetic part
    play( windowedVarScore, curTime )
    {
        
            if ( this.currentMidi.length <= 0 ) 
            {
                return; 
            }

            if ( ! this.looping )
            {
                return; 
            }


            //need to implement -- if you put a lot of energy in then it lasts longer... !!
            //DISABLED for now
            // let vol = this.createVolumeCurve( windowedVarScore );
        //    this.playgroundSampler.volume.value = vol;    
            

           this.playgroundSamplers.forEach( (sampler) =>
           {
                sampler.volume.value = -15; 
           });


            let secs = curTime-this.startTime ;
            if(  ( secs) <  this.scheduledAhead && !this.firstTimePlayed )
            {
                // console.log(" what are secs then? " +secs + "curTime: "+ curTime + "this.startTime " + this.startTime);
                return;
            }

            this.firstTimePlayed = false; //don't need to schedule ahead if 1st time.

            let midiIndex = this.chooseWhichFileIndexBasedOnIndividualActivity( windowedVarScore );
            midiIndex--; 
            if( midiIndex < 0 )
            {
                return; 
            }
            // console.log(midiIndex);
            let midiNoteEvents = []; 
            let times = [];
            this.currentMidi[midiIndex].tracks.forEach((track) => {

                //schedule all of the events
                track.notes.forEach((note) => {

                    let humanize = Scale.linear_scale( Math.random(), 0, 1, -0.3, 0.1 ); 
                    let humanizePitch = Math.round(Scale.linear_scale( Math.random(), 0, 1, -1, 3 )); 

                    let pitch = Tone.Frequency(note.name).toMidi() + humanizePitch; 

                    //makes it less "tinny" & humanizes.
                    let samplerIndex = Scale.linear_scale( Math.random(), 0, 1, 0, this.playgroundSamplers.length-1 );
                    samplerIndex = Math.round( samplerIndex );

                    let midiNoteEvent = new Tone.ToneEvent(((time, thisnote) => {
                        // the note as well as the exact time of the event
                        // are passed in as arguments to the callback function
                        let vel = note.velocity + humanize;
                        this.playgroundSamplers[samplerIndex].triggerAttackRelease(thisnote, note.duration, time, vel);
                        this.soundMessages.push( new SoundMessage( this.playgroundSamplers[samplerIndex].id, Tone.Frequency(pitch, "midi").toNote(), vel ) );
                    }), [Tone.Frequency(pitch, "midi").toNote()]);
                    midiNoteEvents.push(midiNoteEvent);
                    times.push( note.time + this.findStartTime( curTime ) );

                    // this.playgroundSamplers[samplerIndex].triggerAttackRelease(
                    //     Tone.Frequency(pitch, "midi").toNote(),
                    //     note.duration,
                    //     note.time + this.findStartTime( curTime ), //don't do magnetic
                    //     note.velocity + humanize);

                });


                for( let i=0; i<midiNoteEvents.length; i++ )
                {
                    midiNoteEvents[i].start( times[i] ) ;
                }
                    
            });
            this.startTime = curTime; 
    }


}


export class FourFloorRiffs extends Tango332Riffs {

    constructor(mainVolume)
    {
        super(mainVolume);
    }

    parseAllFiles()
    {
        this.parseFile('./collab_perc_midi/fourOntheFloorSparsest.mid');
        this.parseFile('./collab_perc_midi/fourOntheFloorSparser.mid');
        this.parseFile('./collab_perc_midi/fourOntheFloorBase.mid');
        this.parseFile('./collab_perc_midi/fourOntheFloorBusier.mid');
        this.parseFile('./collab_perc_midi/fourOntheFloorBusiest.mid');
        this.parseFile('./collab_perc_midi/fourOntheFloorBusiest2.mid');
    }

    // chooseWhichFileIndexBasedOnIndividualActivity( windowedVarScore )
    // {
    //     let midiIndex = Scale.linear_scale( windowedVarScore, 0, 1, 0, this.currentMidi.length );
    //     midiIndex = Math.round(midiIndex);  

    //     return midiIndex;
    // }

}

//just kidding its a Dumbek
export class BodhranTango332 extends Tango332Riffs
{
    constructor(mainVolume)
    {
        super(mainVolume);
        this.playgroundSamplers = []; 
        this.playgroundSamplers = [
            new SamplerWithID({
                urls: {
                    "A4" : "Dumbek_1_c.wav",
                    "G4" : "Dumbek_1_d.wav",
                },
                // release : 1,
                baseUrl : "./audio_samples/Dumbek/"
            }).connect(mainVolume.getVolume()),

            new SamplerWithID(
            {
                urls: {
                    "A4" : "Dumbek_2_c.wav",
                    "G4" : "Dumbek_2_d.wav",
                },
                // release : 1,
                baseUrl : "./audio_samples/Dumbek/"
            }).connect(mainVolume.getVolume()) ,

            new SamplerWithID({
                urls: {
                    "A4" : "Dumbek_1_a.wav",
                    "G4" : "Dumbek_1_b.wav",
                },
                // release : 1,
                baseUrl : "./audio_samples/Dumbek/"
            }).connect(mainVolume.getVolume()),

            new SamplerWithID({
                urls: {
                    "A4" : "Dumbek_2_a.wav",
                    "G4" : "Dumbek_2_b.wav",
                },
                // release : 1,
                baseUrl : "./audio_samples/Dumbek/"
            }).connect(mainVolume.getVolume())

        ]; 
        
        this.playgroundSamplers.forEach( (sampler) => {
            sampler.id = InstrumentID.dumbekPercussion;
            let waveForm = new Tone.Waveform(); 
            this.waveForms.push( waveForm );
            sampler.connect(waveForm); 
        }); 

        //let it play out
        this.currentMidi.forEach( ( currentMidi ) =>{
            currentMidi.tracks.forEach((track) => {
                track.notes.forEach((note) => {
                    //note.duration = "1n";
                    note.name = Tone.Frequency( Tone.Frequency(note.name).toMidi() - 12 , "midi").toNote();
                });
            });
        } );  
    }
    
    parseAllFiles()
    {
        this.parseFile('./collab_perc_midi/fourOntheFloorSparsestBass.mid');
        this.parseFile('./collab_perc_midi/fourOntheFloorSparserBass.mid');
        this.parseFile('./collab_perc_midi/fourOntheFloorBaseBass.mid');
        this.parseFile('./collab_perc_midi/milongaPatternSparserBass.mid');
        this.parseFile('./collab_perc_midi/milongaPatternBaseBass.mid');
    }

    play( windowedVarScore, curTime )
    {
        super.play(windowedVarScore, curTime);
        this.playgroundSamplers.forEach( (sampler) =>
        {
             sampler.volume.value = -10; 
        });
    }

    // chooseWhichFileIndexBasedOnIndividualActivity( windowedVarScore )
    // {
    //     let index = Math.round(Scale.linear_scale( windowedVarScore, 0, 1, 0, this.currentMidi.length )); 
    //     return index; 
    // }
}