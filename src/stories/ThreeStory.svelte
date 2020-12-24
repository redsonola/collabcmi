<script lang="ts">
  import { onMount } from 'svelte';
  import type { ThreeSetupFunction } from './ThreeStoryTypes';

  /* Svelte components define a class instance. When you import this file
   * from a js or ts file, you can instantiate the default export.
   * https://svelte.dev/docs#Creating_a_component
   * e.g.
   * 
   *   import Component from './ThreeStory.svelte';
   *   const instance = new Component({
   *     target: document.getElementById('container'),
   *     props: {
   *       setup: () => {}, // setup function
   *       debugPanelExpanded: true
   *     }
   *   });
   * 
   * In another svelte component, you can use it in the html like this:
   *   
   *   <script lang="ts">
   *     import Component from './ThreeStory.svelte';
   *   < /script>
   * 
   *   <Component setup={() => { setup }} debugPanelExpanded={true} />
   * 
   * exported variables in a svelte component can be declared with a default value, e.g.
   * setup must be defined, but debugPanelExpanded defaults to false.
   */
  export let setup: ThreeSetupFunction;
  export let debugPanelExpanded = false;

  let canvas;
  let width: number;
  let height: number;
  const { devicePixelRatio } = window;

  // when you declare a variable in a svelte component, any HTML in the component
  // that uses it will be automatically updated.
  let debugData: any = null;

  /* To update the var, you have to assign to it -- e.g. if this was an
   * array, you would have to do this:
   *   debugData = [...debugData, data]
   * (which is the same as this)
   *   debugData = debugData.concat([data])
   * or even
   *   debugData.push(data);
   *   debugData = debugData;
   *
   * but not this:
   *   debugData.push(data);
   */
  function setDebugData(data) {
    debugData = data;
  }

  function onToggleDebugPanel () {
    debugPanelExpanded = !debugPanelExpanded;
  }


  /* Svelte has a few lifecycle hooks:
   * https://svelte.dev/docs#onMount
   */
  onMount(() => {
    const threeSetup = setup({ canvas, setDebugData });

    function onWindowResize() {
      width = canvas.parentElement.clientWidth;
      height = canvas.parentElement.clientWidth;
      // width = window.innerWidth;
      // height = window.innerHeight;
      threeSetup.updateCanvasSize(width, height);
    }
    onWindowResize();

    window.addEventListener('resize', onWindowResize, false);

    // onMount can return a cleanup function
    return () => {
      threeSetup.cleanup();
      window.removeEventListener('resize', onWindowResize);
    }
  });

</script>

<style>
  .devPanel {
    position: fixed;
    top: 0;
    right: 0;

    font-family: monospace;
    font-size: 10;
    line-height: 1.1em;
    color: rgba(0,0,0,0.7);
    background: #ffffff;
  }

  .devPanel-container {
    max-height: 100vh;
  }

  .devPanel-title {
    width: 100%;
    text-align: right;
    border: none;
    background: none;
    padding: 0.5em;
    font-family: inherit;
    color: inherit;
  }
</style>

<canvas bind:this={canvas} width={width * devicePixelRatio} height={height * devicePixelRatio}></canvas>

<div class="devPanel">
  <div class="devPanel-container">
    <button class="devPanel-title" on:click={onToggleDebugPanel}>
      dev {#if debugPanelExpanded}-{:else}+{/if}
    </button>
    {#if debugPanelExpanded}
      <pre>{JSON.stringify(debugData, null, '    ')}</pre>
    {/if}
  </div>
</div>

