<script lang="ts">
  export let myId;

  let linkUrl;
  let inputElement;
  let done = false;

  $: {
    // strip out iframe.html from storybook
    const { href } = window.location;
    const url = new URL(href);
    url.searchParams.delete('myid');
    url.searchParams.set('callid', myId);
    linkUrl = url.href;
  }

  let lastTimeout;

  function copyToClipboard (e) {
    console.log('copying')
    inputElement.focus();
    inputElement.select();
    document.execCommand('copy');
    clearTimeout(lastTimeout);
    lastTimeout = setTimeout(() => { done = false }, 20000);
    done = true;
  }
</script>

<style>
  [for=share-link], #share-link {
    cursor: pointer;
  }
</style>

{#if myId}
  <label on:click={copyToClipboard} for="share-link">Click to copy share link</label><br/>
  <input type="text" id="share-link" readonly
    bind:this={inputElement}
    value={linkUrl}
    on:click={copyToClipboard}
  />
    {#if done}
      Copied!
  {/if}
{/if}