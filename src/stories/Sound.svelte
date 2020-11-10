<script lang="ts">
  import { onMount } from 'svelte';

  export let init;

  onMount(() => {
    const promiseCleanup = init();
    return () => {
      promiseCleanup.then(cleanup => cleanup());
    }
  });
</script>

sound!!
