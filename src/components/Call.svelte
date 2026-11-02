<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher<{
    "call-link-changed": { url: string }
  }>();

  export let myId;
  export let turnUpVolume;
  export let loadMusic;
  export let mainVolume; 
  export let compact = false; //phone layout: one row with a Copy button


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
    loadMusic( mainVolume );

    console.log("copying");
    inputElement.focus();
    inputElement.select();
    inputElement.setSelectionRange(0, 99999); //iOS needs this to select the whole link
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(linkUrl).catch(() => document.execCommand("copy"));
    } else {
      document.execCommand("copy");
    }
    clearTimeout(lastTimeout);
    lastTimeout = setTimeout(() => {
      done = false;
    }, 20000);
    done = true;
  }
</script>

{#if myId}
  {#if compact}
    <div class="compactRow">
      <input class="compactInput"
        type="text"
        id="share-link"
        aria-label="Link to share"
        readonly
        bind:this={inputElement}
        value={linkUrl}
        on:click={copyToClipboard}
      />
      <button type="button" class="copyButton" on:click={copyToClipboard}>{done ? "Copied!" : "Copy link"}</button>
    </div>
  {:else}
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

  .compactRow {
    display: flex;
    gap: 10px;
    width: 100%;
  }

  .compactInput {
    flex: 1;
    min-width: 0;
    height: 48px;
    box-sizing: border-box;
    border-radius: 8px;
    border: 1px solid #4a4150;
    background: #fff;
    color: #222;
    font-size: 16px; /* 16px stops iOS from zooming the page when the field is focused */
    padding: 0 12px;
  }

  .copyButton {
    height: 48px;
    min-width: 96px;
    border: 0;
    border-radius: 24px;
    background: #37233b;
    color: #d2c8c8;
    font-size: 16px;
    font-weight: 600;
    font-family: inherit;
    padding: 0 18px;
  }

</style>
