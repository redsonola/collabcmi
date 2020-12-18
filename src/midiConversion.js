import * as Tone from 'tone';
import { Midi } from '@tonejs/midi'
import * as Scale from './scale.ts';
import { isConstructorDeclaration } from 'typescript';
import { getValidInputResolutionDimensions } from '@tensorflow-models/posenet/dist/util';

//controls all the volumes. ALL sound needs to be connected to this before going to destination.
export class MainVolume
{
    constructor()
    {
        this.mainVolume = new Tone.Volume(-150).toDestination(); //set a master global volume control.
        this.mainVolume.volume.mute = true; 

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

    play(which = 0) {
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

        this.scheduledAhead = this.measureLen + this.measureLen; //default 2 measures
        this.looping = false;
        this.startTime = Tone.now();
        this.magneticLoopStarted = 0;
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
        Tone.Transport.start();
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

    play(windowedVarScore) 
    {
    }

    reset()
    {
        this.looping = true; 
        this.startTime = Tone.now(); 
    }
}



//https://www.musicradar.com/news/drums/1000-free-drum-samples
//got the drum samples from there.
//ok this is just a drum kit
export class Tango332Riffs extends DynamicMovementMidi {

     
    constructor(mainVolume)
    {
        super(); 

        this.playgroundSampler = new Tone.Sampler({
            urls: {
            "G2" : "CYCdh_K2room_Kick-01.wav",
            "A2" : "CYCdh_K2room_Kick-02.wav",
            "B2" : "CYCdh_K2room_Kick-03.wav",
            "C3" : "CYCdh_K2room_Kick-04.wav",
            "D3" : "CYCdh_K2room_Kick-05.wav",
            "E3" : "CYCdh_K2room_Kick-06.wav",

            "F3" : "CYCdh_K2room_SdSt-07.wav",
            "G3" : "CYCdh_K2room_SdSt-06.wav",
            "A3" : "CYCdh_K2room_SdSt-05.wav",
            "B3" : "CYCdh_K2room_SdSt-04.wav",
            "C4" : "CYCdh_K2room_SdSt-03.wav",
            "C#4" : "CYCdh_K2room_SdSt-01.wav",

            "D4" : "CYCdh_K2room_ClHat-01.wav",
            "E4" : "CYCdh_K2room_ClHat-02.wav",
            "F4" : "CYCdh_K2room_ClHat-03.wav",
            "G4" : "CYCdh_K2room_ClHat-04.wav",
            "A4" : "CYCdh_K2room_ClHat-05.wav",
            "B4" : "CYCdh_K2room_ClHat-06.wav",
            "C5" : "CYCdh_K2room_ClHat-07.wav",
        },
        // release : 1,
        baseUrl : "./audio_samples/Kit_2_Acoustic_room/"
        }).connect(mainVolume.getVolume());

        this.synths.push(this.playgroundSampler);
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
        let midiIndex = 0; 

        //just to start
        if( windowedVarScore < 0.2 )
        {
            midiIndex = 0; 
        }
        else if( windowedVarScore < 0.4 )
        {
            midiIndex = 1; 
        }
        else if( windowedVarScore < 0.6 )
        {
            midiIndex = 2; 
        }
        else if( windowedVarScore < 0.8 )
        {
            midiIndex = 3; 

        }
        else 
        {
            midiIndex = 4; 
        }

        return midiIndex;
    }
    
    //ok, I took out the magnetic part
    play( windowedVarScore )
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
           this.playgroundSampler.volume.value = -3; 


            //do a volume thing 2?
            // if( windowedVarScore < 0.07)
            // {
            //     return;
            // }

            let now = Tone.now();

            let secs = now-this.startTime ;
            if(  ( secs) <  this.scheduledAhead )
            {

                return;
            }
            // console.log("secs: " + secs + " tone.now: " + now + " start: " + this.startTime ) ; 

            //also map velocity?

            let midiIndex = this.chooseWhichFileIndexBasedOnIndividualActivity( windowedVarScore );
            this.currentMidi[midiIndex].tracks.forEach((track) => {

                //schedule all of the events
                track.notes.forEach((note) => {

                    let humanize = Scale.linear_scale( Math.random(), 0, 1, -0.5, 0.1 ); 
                    let humanizePitch = Math.round(Scale.linear_scale( Math.random(), 0, 1, -1, 3 )); 

                    //TODO make this a sliding scale too
                    // if( synchronityMeasure > 0.6 )
                    // {
                    //     humanize = Scale.linear_scale( Math.random(), 0, 1, -0.05, 0.05 ); 
                    //     humanizePitch = 0;
                    // }

                    let pitch = Tone.Frequency(note.name).toMidi() + humanizePitch; 

                    this.playgroundSampler.triggerAttackRelease(
                        Tone.Frequency(pitch, "midi").toNote(),
                        note.duration,
                        note.time + this.findStartTime( now ), //don't do magnetic
                        note.velocity + humanize);

                });
                    
            });
            this.startTime = now; 
    }
}
