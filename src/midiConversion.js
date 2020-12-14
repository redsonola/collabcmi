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
            console.log("playing sound?");

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

//this is the main backbone of the beats implemetnted.
export class LoadMidiFilePlayground extends LoadMidiFile {

     
    constructor(mainVolume)
    {
        super(); 

        this.playgroundSampler = new Tone.Sampler({
            urls: {
            "C2" : "Metal Surface-08.mp3",
            "A#2" : "Chain Shake-08.wav",
            "B2" : "Chain Shake Soft-05.wav",
            "C3" : "Metal Surface-08.wav",
            "C#3" : "Metal Surface-05.wav",
            "D3" : "Metal Surface Soft-08.wav",
            "D#3" : "Metal Surface Soft-09.wav",
            "F#3" : "Metal Tube 2-08.wav",
            "G3" : "Metal Tube 2-05.wav",
            "A#3" : "Stairs Hits Various-04.wav",
            "B3" : "Stairs Hits Various-05.wav",
            "E4" : "Steps-04.wav",
            "F4" : "Steps-05.wav",
            "G#3" : "Seesaw-04.wav",
            "A4" : "Trash Bin 2-05.wav",
            "A#4" : "Wood Hand Palm-04.wav",
            "C4" : "Stairs Palm Hit-08.wav",
            "D#4" : "Stairs Palm Hit 2-08.wav",
            "G#4" : "Trash Bin 2-08.wav",
            "E5" : "Wood Knock 2-08.wav"
        },
        // release : 1,
        baseUrl : "./audio_samples/playground_samples/"
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

    //synchroncityMeasure should be 0-1 ish
    findStartTimeMagnetic( synchronityMeasure, origTime )
    {
        let curSchedule = this.scheduledAhead + origTime; //loops start playhing in 2 measures 

        let quant = "32nd";
        let quantMult = 2; 
        let notesPerLoop = 64; 

        if(synchronityMeasure > 0.3)
        {
            quant = "16n";
            quantMult = 1; 
        }

        let offset = 0;
        if(synchronityMeasure < 0.55)
        {

            //how many 32nd notes leeway?
            let offsetDistChooser = Scale.linear_scale( synchronityMeasure, 0, 1, 0, notesPerLoop, true )  ;
             offset =  Math.floor(  Scale.linear_scale(Math.random(), 0, 1, -offsetDistChooser, offsetDistChooser) );

            //if synch is greater than 65, then the quantization is 16th notes... else 32nd more chaotic
            if(quant === "16n")
                offset = Math.floor( offset / 2 ) * 2;

            //xfer the offset to seconds
            offset = offset * (this.noteQuarterLen/4);

            // console.log("synchronityMeasure: "  + synchronityMeasure  + " offset:" + offset  );
        }

        curSchedule = curSchedule + offset; 

        return curSchedule; 

    }

    startLoop()
    {
        this.looping = true; 
        Tone.Transport.start();
        this.startTime = Tone.now(); 
    }

    stopLoop()
    {
        this.looping = false; 
        Tone.Transport.stop();
    }



    //also add additional notes for super budy & subtract more... on a scale.
    chooseWhichFileIndexBasedOnIndividualActivity( windowedVarScore )
    {
        let midiIndex = 0; 

        // console.log("windowedVarScore:" + midiIndex); 

        //just to start
        if( windowedVarScore < 0.2 )
        {
            midiIndex = 0; 
        }
        else if( windowedVarScore < 0.35 )
        {
            midiIndex = 1; 
        }
        else //if( windowedVarScore < 0.5 )
        {
            midiIndex = 2; 
        }
        // else if( windowedVarScore < 0.7 )
        // {
        //     midiIndex = 3; 
        // }
        // else
        // {
        //     midiIndex = 4;
        // }
        console.log("windowedVarScore: " + windowedVarScore + " , " + midiIndex); 

        return midiIndex;
    }

    createVolumeCurve(  windowedVarScore )
    {
        let vol = 0;
        if( windowedVarScore < 0.1 )  
            vol = Scale.linear_scale( windowedVarScore, 0, 1, -60, 0 ); 
        else if (  windowedVarScore ) 
        {
            vol = Scale.linear_scale( windowedVarScore, 0, 1, -20, 0 ); 
        }

        return vol; 
    }


    //ok, I took out the magnetic part
    magneticPlay( synchronityMeasure, windowedVarScore )
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
            let vol = this.createVolumeCurve(  windowedVarScore );
            this.playgroundSampler.volume.value = vol; 

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
                    let humanizePitch = Math.round(Scale.linear_scale( Math.random(), 0, 1, -5, 5 )); 

                    //TODO make this a sliding scale too
                    // if( synchronityMeasure > 0.6 )
                    // {
                    //     humanize = Scale.linear_scale( Math.random(), 0, 1, -0.05, 0.05 ); 
                    //     humanizePitch = 0;
                    // }

                    let pitch = Tone.Frequency(note.name).toMidi() + humanizePitch; 

                    this.playgroundSampler.triggerAttackRelease(
                        Tone.Frequency(pitch-12, "midi").toNote(),
                        note.duration,
                        note.time + this.findStartTimeMagnetic( synchronityMeasure, now ), //don't do magnetic
                        note.velocity + humanize);
                });
                    
            });
            this.startTime = now; 
    }

    play() {
        if (this.playing && this.currentMidi) {
            console.log("playing sound?");

            const now = Tone.now() + 0.5;
            this.currentMidi.tracks.forEach((track) => {

                //sampler is already created.
                //create a synth for each track
                // const synth = new Tone.PolySynth(Tone.Synth, {
                //     envelope: {
                //         attack: 0.02,
                //         decay: 0.1,
                //         sustain: 0.3,
                //         release: 1,
                //     },
                // }).toDestination();

                // this.synths.push(synth);

                //schedule all of the events
                track.notes.forEach((note) => {
                    this.playgroundSampler.triggerAttackRelease(
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
