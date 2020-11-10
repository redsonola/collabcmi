/* 
    Sampler
    Tone.Player
    Convolver
    Reverb
    Tremelo
    Filter
*/
import * as Tone from "tone";
import * as avgFilter from "./averagingFilter.js"; //this starts initialized. 
import * as scale from "./scale.ts"

export class SonifierWithTuba {

    constructor() {

        this.lastCheckTime = 0;
        this.lastCheckTimeVolume = 0;

        this.loaded = false;

        this.noteIndex = 0;
        this.tubaNoteArray1 = ["A3", "C3", "B2", "A3", "F3", "G3"];

        //this doesn't load
        this.fanSample1 = new Tone.Player({
            url: "./fan_sounds/fan.wav",
            loop: true,
            autostart: true,
            onload: () => { console.log("loaded"); }
        });

        //this also doesn't load
        this.tubaSampler1 = new Tone.Sampler({	
            "E0": "028_Tuba_E0_Normal.wav",	
            "G0": "031_Tuba_G0_Normal.wav",
            "C1": "036_Tuba_C1_Normal.wav",
            "Eb1": "039_Tuba_Eb1_Normal.wav",
            "F1": "041_Tuba_F1_Normal.wav",
            "A1": "045_Tuba_A1_Normal.wav",
            "C2": "048_Tuba_C2_Normal.wav",
            "E2": "052_Tuba_E2_Normal.wav",
            "G2": "055_Tuba_G2_Normal.wav",
            "A2": "057_Tuba_A2_Normal.wav",
            "Eb3": "063_Tuba_Eb3_Normal.wav"
        },
        {
            baseUrl: "./Tuba_samples/Tuba_Long/Normal/"
        });

        // tubaSampler2 = new Tone.Sampler({
        //     "D0" : "./tuba_samples/Tuba Long/Normal/026_Tuba_D0_Normal.aif",	
        //     "G0" : "./tuba_samples/Tuba Long/Normal/031_Tuba_G0_Normal.aif",	
        //     "C1" : "./tuba_samples/Tuba Long/Normal/036_Tuba_C1_Normal.aif",	
        //     "F1" : "./tuba_samples/Tuba Long/Normal/041_Tuba_F1_Normal.aif",	
        //     "Bb1" : "./tuba_samples/Tuba Long/Normal/046_Tuba_Bb1_Normal.aif",	
        //     "Eb2" : "./tuba_samples/Tuba Long/Normal/051_Tuba_Eb2_Normal.aif",	
        //     "Ab2" : "./tuba_samples/Tuba Long/Normal/056_Tuba_Ab2_Normal.aif",	
        //     "Db3" : "./tuba_samples/Tuba Long/Normal/061_Tuba_Db3_Normal.aif",
        //     "Eb0" : "./tuba_samples/Tuba Long/Normal/027_Tuba_Eb0_Normal.aif",	
        //     "Ab0" : "./tuba_samples/Tuba Long/Normal/032_Tuba_Ab0_Normal.aif",	
        //     "Db1" : "./tuba_samples/Tuba Long/Normal/037_Tuba_Db1_Normal.aif",	
        //     "Gb1" : "./tuba_samples/Tuba Long/Normal/042_Tuba_Gb1_Normal.aif",	
        //     "B1" : "./tuba_samples/Tuba Long/Normal/047_Tuba_B1_Normal.aif	",
        //     "E2" : "./tuba_samples/Tuba Long/Normal/052_Tuba_E2_Normal.aif	",
        //     "A2" : "./tuba_samples/Tuba Long/Normal/057_Tuba_A2_Normal.aif	",
        //     "D3" : "./tuba_samples/Tuba Long/Normal/062_Tuba_D3_Normal.aif",
        //     "E0" : "./tuba_samples/Tuba Long/Normal/028_Tuba_E0_Normal.aif	",
        //     "A0" : "./tuba_samples/Tuba Long/Normal/033_Tuba_A0_Normal.aif	",
        //     "D1" : "./tuba_samples/Tuba Long/Normal/038_Tuba_D1_Normal.aif",	
        //     "G1" : "./tuba_samples/Tuba Long/Normal/043_Tuba_G1_Normal.aif",	
        //     "C2" : "./tuba_samples/Tuba Long/Normal/048_Tuba_C2_Normal.aif",	
        //     "F2" : "./tuba_samples/Tuba Long/Normal/053_Tuba_F2_Normal.aif",	
        //     "Bb2" : "./tuba_samples/Tuba Long/Normal/058_Tuba_Bb2_Normal.aif",	
        //     "Eb3" : "./tuba_samples/Tuba Long/Normal/063_Tuba_Eb3_Normal.aif",
        //     "F0" : "./tuba_samples/Tuba Long/Normal/029_Tuba_F0_Normal.aif",	
        //     "Bb0" : "./tuba_samples/Tuba Long/Normal/034_Tuba_Bb0_Normal.aif",	
        //     "Eb1" : "./tuba_samples/Tuba Long/Normal/039_Tuba_Eb1_Normal.aif",	
        //     "Ab1" : "./tuba_samples/Tuba Long/Normal/044_Tuba_Ab1_Normal.aif",	
        //     "Db2" : "./tuba_samples/Tuba Long/Normal/049_Tuba_Db2_Normal.aif",	
        //     "Gb2" : "./tuba_samples/Tuba Long/Normal/ 054_Tuba_Gb2_Normal.aif",	
        //     "B2" : "./tuba_samples/Tuba Long/Normal/059_Tuba_B2_Normal.aif",
        //     "Gb0" : "./tuba_samples/Tuba Long/Normal/030_Tuba_Gb0_Normal.aif",	
        //     "B0" : "./tuba_samples/Tuba Long/Normal/035_Tuba_B0_Normal.aif",	
        //     "E1" : "./tuba_samples/Tuba Long/Normal/040_Tuba_E1_Normal.aif",	
        //     "A1" : "./tuba_samples/Tuba Long/Normal/045_Tuba_A1_Normal.aif",	
        //     "D2" : "./tuba_samples/Tuba Long/Normal/050_Tuba_D2_Normal.aif",	
        //     "G2" : "./tuba_samples/Tuba Long/Normal/055_Tuba_G2_Normal.aif",	
        //     "C3" : "./tuba_samples/Tuba Long/Normal/060_Tuba_C3_Normal.aif"
        // });

        this.convolver1 = new Tone.Convolver("./fan_sounds/cng_fan1.wav");
        this.convolver2 = new Tone.Convolver("./fan_sounds/fan4.wav");
        this.tubaSampleCompressor1 = new Tone.Compressor(-5, 9);

        // convolver2 = new Tone.Convolver(tubaSampler2); 

        //  fanSample1Reverb = new Tone.Freeverb();
        //  fanSample1Reverb.dampening.value = 1000;

        // fanSample2Reverb = new Tone.Freeverb().toMaster();
        // fanSample2Reverb.dampening.value = 1000;

        this.tubaSampler1.volume.rampTo(-15);

        this.tubaSampler1.chain(this.convolver1, this.convolver2, this.tubaSampleCompressor1, Tone.Destination);


        // fanSample2.chain(convolver2, fanSample2Reverb, Tone.Master );


    }

    play() {
        if (!this.tubaSampler1.loaded) {
            console.log("not loaded");
            return;
        }

        var elapsed = Date.now() - this.lastCheckTime;
        if (elapsed > 250) {
            this.tubaSampler1.triggerAttackRelease(this.tubaNoteArray1[this.noteIndex], "8n");
            this.noteIndex++;
            if (this.noteIndex > this.tubaNoteArray1.length - 1)
                this.noteIndex = 0;
            this.lastCheckTime = Date.now();
        }

    }

    changeVolume(volumeMod) {

        //expectation is that volumeMod is 0. - 1. 

        //-20 to 100
        var lowVol = -50;
        var hiVol = 10;
        var vol = ((volumeMod) * (hiVol - lowVol)) + lowVol;
        if (vol > 0) vol = 0; // for now
        this.avgFilter.update(vol);

        var elapsed = Date.now() - this.lastCheckTimeVolume;
        if (elapsed > 100) {
            var newVol = avgFilter.getNext();
            this.tubaSampler1.volume.rampTo(newVol);
            var mainMult = 1;
            if (newVol < -48) {
                Tone.Destination.volume.rampTo(-40, "4n");
            }
            else {
                Tone.Destination.volume.rampTo(-5, "8n");
            }


            // console.log(avgFilter.getAvg());
            this.lastCheckTimeVolume = Date.now();
        }
    }

}