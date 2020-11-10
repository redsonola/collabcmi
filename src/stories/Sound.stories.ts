import * as Tone from "tone";

import * as soundDesign from '../soundDesignSpaceBtwSketch1';
import { LoadMidiFile } from '../midiConversion';
import Sound from './Sound.svelte';

export default {
  title: 'Audio/Sketches',
  component: Sound,
  // argTypes: { backgroundColor: { control: 'color' }, },
};

export const Sketch1 = () => ({
  Component: Sound,
  props: {
    init: async () => {
      await Tone.start();
      console.log('audio is ready');

      /************ TESTING SOUND *************/
      let midiFile = new LoadMidiFile();
      await midiFile.parseFile('/perc_midi/base_sound.mid');
      midiFile.setPlaying(true);
      midiFile.play();


      /************** END TESTING SOUND *******************/
      // soundpart.startSound(); 
      soundDesign.setup();

      // cleanup
      return () => {
        // except this doesn't work?
        midiFile.setPlaying(false);
      };
    }
  },
});

export const Sketch2 = () => ({
  Component: Sound,
  props: {
    init: async () => {
      await Tone.start();
      console.log('audio is ready');

      /************ TESTING SOUND *************/
      let midiFile = new LoadMidiFile();
      await midiFile.parseFile('/perc_midi/base_sound.mid');
      midiFile.setPlaying(true);
      midiFile.play();


      /************** END TESTING SOUND *******************/
      // soundpart.startSound(); 
      soundDesign.setup();

      // cleanup
      return () => {
        // except this doesn't work?
        midiFile.setPlaying(false);
      };
    }
  }
});