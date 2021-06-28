<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher<{
    "call-link-changed": { url: string }
  }>();

  export let myId;
  export let turnUpVolume;
  // export let loadMusic;
  // export let mainVolume; 


  let linkUrl;
  let inputElement;
  let done = false;

  $: {
    // strip out iframe.html from storybook
    const { href } = window.location;
    const url = new URL(href);
    url.searchParams.delete("myid");
    url.searchParams.set("callid", myId);
    linkUrl = url.href;
    dispatch('call-link-changed', { url: linkUrl });
  }

  let lastTimeout;

  function copyToClipboard(e) {
    turnUpVolume();//not sure if this will stay here... hmm... gah
    // loadMusic( mainVolume );

    console.log("copying");
    inputElement.focus();
    inputElement.select();
    document.execCommand("copy");
    clearTimeout(lastTimeout);
    lastTimeout = setTimeout(() => {
      done = false;
    }, 20000);
    done = true;
  }
</script>

{#if myId}
    <label class="labelText" on:click={copyToClipboard} for="share-link"
      >Click to copy and share link!</label
    ><br />
    <input class="inputPos"
      type="text"
      id="share-link"
      readonly
      bind:this={inputElement}
      value={linkUrl}
      on:click={copyToClipboard}
    />
  {#if done}
    Copied!
  {/if}
{/if}

<style>
  [for="share-link"],
  #share-link {
    cursor: pointer;
  }

  .labelText {
    color: #928888;
  }

  .inputPos{
    position: relative; 
    top: 8px;
  }

</style>
