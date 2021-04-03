<script lang="ts">
  import { Router } from "yrv";

  export let myId = "123";

  export let router: Router;
  let linkUrl = window.location.href;
  let inputElement;
  let done = false;

  let lastTimeout;

  function copyToClipboard(e) {
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

  let videoSources = ["built in camera", "iphone"];
  let selectedVideoSource = videoSources[0];

  let devices: MediaDeviceInfo[] = [];
  navigator.mediaDevices.enumerateDevices().then((x) => (devices = x));
  $: console.log(devices);

  function hasInputDeviceInfo(d: MediaDeviceInfo): d is InputDeviceInfo {
    return typeof (d as InputDeviceInfo).getCapabilities === "function";
  }

  let capabilities: MediaTrackCapabilities[] = [];
  $: {
    capabilities = devices
      .filter(hasInputDeviceInfo)
      .map((d) => d.getCapabilities());
  }
</script>

<div>
  {#if myId}
    <label class="labelText" on:click={copyToClipboard} for="share-link"
      >Click to copy and share link!</label
    ><br />
    <input
      class="inputPos"
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
</div>

<div>
  <ul>
    {#each videoSources as source}
      <li>
        <input
          type="radio"
          bind:group={selectedVideoSource}
          id="videoSource-{source}"
          name="videoSource"
          value={source}
        />
        <label for="videoSource-{source}">{source}</label>
      </li>
    {/each}
  </ul>
</div>

<style>
  :global(body) {
    background-color: #050505;
    color: #928888;
  }

  [for="share-link"],
  #share-link {
    cursor: pointer;
  }

  .labelText {
    color: #928888;
  }

  .inputPos {
    position: relative;
    top: 8px;
  }
</style>
