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
import * as scale from "./scale"
import type { Participant } from "./participant"
import * as PoseIndex from "./poseConstants"
import type { MainVolume } from "./midiConversion.js";

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

    constructor( p : Participant, mainVolume : MainVolume ) {

        this.participant = p; 
        this.tubaSampler = this.loadTubaSampler();
        this.masterCompressor = new Tone.Compressor(-5, 1);

        //set up the signal chain for the fx/synthesis
        this.convolver1 = new Tone.Convolver("./fan_sounds/cng_fan1.wav");
        this.convolver2 =  new Tone.Convolver("./fan_sounds/fan4.wav") 
        this.tubaSampler.chain(this.convolver1, this.convolver2, this.masterCompressor);
        this.masterCompressor.connect(mainVolume.getVolume());

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

        return sampler; 
    }

    connectSamplers(sampler, convolver1, convolver2, compressor, masterCompressor)
    {
        sampler.volume.rampTo(-15);
        sampler.chain(convolver1, convolver2, compressor, this.masterCompressor);
    }

    areSamplersLoaded() : boolean
    {
        // if(this.samplersLoaded) return true; //prob put this somewhere else

        // let loaded : boolean = true; 
        // let i = 0; 
        // while( i<this.tubaSamplers.length && loaded )
        // {
        //     loaded = loaded && this.tubaSamplers[i].loaded;
        //     i++;
        // }

        // this.samplersLoaded = loaded;
        // return loaded; 
        return true; 
    }

    //TODO: fix
    // export const bodyPartArray = [head, torso, leftArm, rightArm, leftLeg, rightLeg];
    createTubaNotes()
    {
        // this.tubaNoteArray.push( ["A4", "C4", "B3", "A4", "F4", "G5", "C5"] ); //head
        // this.tubaNoteArray.push( ["A0", "C0", "B0", "A0", "F0", "G1"] ); //torso
        // this.tubaNoteArray.push( ["B2", "F3", "G3", "E3", "D3", "E2"] ); //leftArm
        // this.tubaNoteArray.push( ["A3", "D3", "F2", "A3", "F3", "D3"] ); //rightArm
        // this.tubaNoteArray.push( ["B3", "F4", "G4", "E4", "D4", "E3"] );//leftLeg
        // this.tubaNoteArray.push( ["A3", "C3", "B2", "A3", "F3", "G3"] ); //rightleg
    }

    play() : void {
        // if (!this.areSamplersLoaded()) {
        //     console.log("not loaded");
        //     return;
        // }

        // (window as any).participant = this.participant; 

        // if(this.participant != null)
        // {
        //     if(!this.participant.isFriendPartcipantNull() && this.participant.getXCorrLength() > 0 && this.participant.getDistXCorrMaxLength() > 0 )
        //     {
        //         //TODO: put a fade in when participant xcorr isn't 0

        //         // console.log("friend participant is not null");

        //         let elapsed : number = Date.now() - this.lastCheckTime;

        //         let matchScore = scale.linear_scale(this.participant.getMatchScore(),0, 0.25, 0, 1, true); //this on my measurements shows greatest variation btw high & low
        //         Tone.Destination.volume.rampTo(40*matchScore); 

               
        //         for(let i=0; i<PoseIndex.bodyPartArray.length; i++)
        //         {
               
        //             // xCorr = scale.exp_scale(this.participant.getAverageBodyPartXCorrSynchronicity(PoseIndex.bodyPartArray[i]), -1, 1, 0, 1) ; //needs to be adjusted
        //             let xCorr = matchScore * scale.exp_scale(this.participant.getAverageBodyPartXCorrVelocitySynchronicity(PoseIndex.bodyPartArray[i]), -1, 1, 0, 1); //needs to be adjusted

        //             if(xCorr < this.xCorrMin)
        //                 this.xCorrMin = xCorr;
        //             else if(xCorr > this.xCorrMax )
        //                 this.xCorrMax = xCorr; 


        //             (window as any).xCorrMin = this.xCorrMin; 
        //             (window as any).xCorrMax = this.xCorrMax; 


        //             //for now don't change the volume
        //             this.changeVolume(xCorr, i);
        //         }

        //         if (elapsed > 250) {
        //             for(let i=0; i<PoseIndex.bodyPartArray.length; i++)
        //             {
        //                 //TODO: stagger note onsets... create some kind of rhythm... thingy? maybe that changes with movement as well?
                    
        //                 //set the volume for each part
                             
        //                 //create staggered attacks --note: could also create more attacks with higher match values
        //                 //for now random
        //                 let when : number = Math.random() * 0.7; 

        //                 this.tubaSamplers[i].triggerAttackRelease(this.tubaNoteArray[i][this.noteIndex], "8n", Tone.now() + when);
        //                 this.noteIndex++;
        //                 if (this.noteIndex > this.tubaNoteArray[i].length - 1)
        //                     this.noteIndex = 0;
        //             }
        //             this.lastCheckTime = Date.now();
        //         }
        //     }
        // }
    }

    ///TODO
    playSampler(index : number) : void
    {
        
    }

    changeVolume(volumeMod : number, index : number) : void {

        // //-20 to 100
        // let lowVol : number = -50;
        // let hiVol : number = 30;

        // //for match value
        // // let volModMin = 0; 
        // // let volModMax = 1; 

        // //for velocity matching
        // // let volModMin = 0.003; 
        // // let volModMax = 0.3; 

        // //velocity + posematch
        // let volModMin = 0; 
        // let volModMax = 0.1; 

        // let vol : number = scale.linear_scale(volumeMod, volModMin, volModMax, lowVol, hiVol);
        // //clamp lower volumes to zero bc they are close to noise
        // if(vol < -35) vol = -100;
        // if(vol > 5) vol = 5;
        // //this.avgFilter[index].update(vol); //try exp. scale for now 
        // //var newVol : number = this.avgFilter[index].top();

        //  console.log("vol " + vol.toString());


        // this.tubaSamplers[index].volume.rampTo(vol);       
    }


}