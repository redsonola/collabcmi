<script lang="ts">
  import { onMount } from 'svelte';
  import type { ThreeSetupFunction } from './ThreeStoryTypes';

  export let setup: ThreeSetupFunction;
  export let debugPanelExpanded = false;

  let canvas;
  let width: number;
  let height: number;

  let debugData: any = null;

  function setDebugData(data) {
    debugData = data;
  }

  function onToggleDebugPanel () {
    debugPanelExpanded = !debugPanelExpanded;
  }


  onMount(() => {
    const threeSetup = setup({ canvas, setDebugData });

    function onWindowResize() {
      width = window.innerWidth;
      height = window.innerHeight;
      threeSetup.updateCanvasSize(width, height);
    }
    onWindowResize();

    window.addEventListener('resize', onWindowResize, false);

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
  }

  .devPanel-container {
    height: 1em;
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

<canvas bind:this={canvas} width={width} height={height}></canvas>

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

