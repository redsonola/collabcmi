import App2Component from './App2.svelte';
import App2ComponentX2 from './2Apps.svelte';
import CallComponent from './Call.svelte';

export default {
  title: 'Components/App',
};

export const AppX2 = () => ({
  Component: App2ComponentX2
});

export const App2 = () => ({
  Component: App2Component
});


export const Call = () => ({
  Component: CallComponent,
  props: {
    myId: '123123'
  }
});
