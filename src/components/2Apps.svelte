<script lang="ts">
  import { onMount } from 'svelte';
  import App2 from "./App2.svelte";
  import { v4 as uuid } from 'uuid';

  const callerId = uuid();
  // const callerId = "caller-id";
  let size = { width: window.innerWidth / 2, height: window.innerHeight };

  onMount(() => {
    function onWindowResize() {
      size = { width: window.innerWidth / 2, height: window.innerHeight };
    }

    window.addEventListener('resize', onWindowResize, false);

    return () => {
      window.removeEventListener('resize', onWindowResize, false);
    }
  });
</script>

<style>
  .appSide {
    width: 49%;
    box-sizing: border-box;
    display: inline-block;
    position: relative;
  }
  
  .left {
    background: aliceblue;
  }

  .right {
    background: deeppink;
  }
</style>

<div class="appSide left">
<App2 myId={callerId} size={size} />
</div>
<div class="appSide right">
<App2 idToCall={callerId} size={size} />
</div>