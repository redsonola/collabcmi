<script lang="ts">
  import { onDestroy } from "svelte";
  let leftIframe;
  let rightIframe;

  let leftIframeRefreshing = false;
  let rightIframeRefreshing = false;

  let friendURL;
  let expectedRightIframeUrl;
  let rightIframeUrl;

  let leftIframeURL: string;
  $: leftIframeURL = leftIframeRefreshing ? "about: blank" : "/?debug=true";

  $: {
    expectedRightIframeUrl =
      !friendURL || rightIframeRefreshing ? "about:blank" : friendURL;
  }

  let leftIframeRefreshCount = 0;
  let rightIframeRefreshCount = 0;

  function refresh(side: "left" | "right") {
    if (side === "left") {
      leftIframeRefreshCount += 1;
      leftIframeRefreshing = true;
      setTimeout(() => {
        leftIframeRefreshing = false;
      }, 1);
    } else {
      rightIframeRefreshCount += 1;
      rightIframeRefreshing = true;
      setTimeout(() => {
        rightIframeRefreshing = false;
      }, 1);
    }
  }

  $: if (leftIframe?.contentWindow) {
    leftIframe.contentWindow.addEventListener(
      "message",
      (event) => {
        if (event.origin !== window.location.origin) return;
        console.log("message listener:", event);
        if (event.data.name === "call-call-link-changed") {
          const url = new URL(event.data.url);
          url.searchParams.set("debug", "true");
          friendURL = url.href;
        }
      },
      false
    );
  }

  const urlcheckerInterval = setInterval(() => {
    rightIframeUrl = rightIframe.contentDocument.location.href;
  }, 100);

  onDestroy(() => {
    clearInterval(urlcheckerInterval);
  });
</script>

<div class="appSide left">
  <div class="appDebug">
    <input type="button" on:click={() => refresh("left")} value="refresh {leftIframeRefreshCount}" />
    <span class="iframeUrl">{leftIframeURL}</span>
  </div>
  <iframe class="app" bind:this={leftIframe} title="left" src={leftIframeURL} />
</div>

<div class="appSide right">
  <div class="appDebug">
    <input type="button" on:click={() => refresh("right")} value="refresh {rightIframeRefreshCount}" />
    <span class="iframeUrl">{rightIframeUrl}</span>
  </div>
  <iframe
    class="app"
    title="right"
    bind:this={rightIframe}
    src={expectedRightIframeUrl}
  />
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-size: 12px;
  }

  .app {
    width: 100%;
    height: calc(100vh - 2px - 2rem);
    margin: 1px;
    border-style: double;
    border-width: 3px;
    box-sizing: border-box;
  }

  .appSide {
    width: calc(50vw - 2px);
    height: calc(100vh - 2px);
    box-sizing: border-box;
    display: inline-block;
  }

  .appDebug {
    height: 1rem;
    margin: 0.25rem 0 0.5rem 0;
  }

  .left {
    border-color: orchid;
    float: left;
    left: 0;
  }

  .right {
    border-color: plum;
    right: 0;
  }
</style>
