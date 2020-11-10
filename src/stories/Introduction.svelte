<script lang="ts">
  import { onMount } from 'svelte';
  import mermaid from 'mermaid';

  let container;

  onMount(() => {
    mermaid.init({ startOnLoad:false }, container);
  });
</script>

<style>
  .page {
    margin: 1em;
  }

  .mermaid {
    margin: 1em;
  }
</style>

<div class="page">
  <h1>Welcome to Space Between</h1>

  Space Between is really amazing.

  <!--
    editor: https://mermaid-js.github.io/mermaid-live-editor/
    syntax: https://mermaid-js.github.io/mermaid/diagrams-and-syntax-and-examples/flowchart.html
  -->
  <div class="mermaid" bind:this={container}>
    flowchart TD
      start1((User 1))-->Call
      start2((User 2))--->Answer
      Call-->connect
      Call-.-Answer
      Answer-->connect
      connect((Create a creature by<br/>connecting through<br/>Sound & Movement))
  </div>
</div>