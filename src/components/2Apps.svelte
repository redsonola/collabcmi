<script lang="ts">
  let leftIframe;
  let leftIframeRefreshing = false;
  let friendURL;
  let rightIframeUrl;
  let rightIframeRefreshing = false;

  let leftIframeURL: string;
  $: {
    leftIframeURL = leftIframeRefreshing ? "about: blank" : "/?debug=true";
  }

  $: {
    rightIframeUrl = rightIframeRefreshing ? "about: blank" : "/?debug=true";
    // rightIframeUrl =
    //   !friendURL || rightIframeRefreshing ? "about:blank" : friendURL;
  }

  // $: if (leftIframe?.contentWindow) {
  //   leftIframe.contentWindow.addEventListener(
  //     "message",
  //     (event) => {
  //       if (event.origin !== window.location.origin) return;
  //       console.log("message listener:", event);
  //       if (event.data.name === "call-call-link-changed") {
  //         const url = new URL(event.data.url);
  //         url.searchParams.set("debug", "true");
  //         friendURL = url.href;
  //       }
  //     },
  //     false
  //   );
  // }
</script>

<div class="appSide left">
  <div class="appDebug">
    <input
      type="button"
      on:click={() => {
        leftIframeRefreshing = true;
        setTimeout(() => {
          leftIframeRefreshing = false;
        }, 1);
      }}
      value="refresh"
    />
    <span class="iframeUrl">{leftIframeURL}</span>
  </div>
  <iframe class="app" bind:this={leftIframe} title="left" src={leftIframeURL} />
</div>

<div class="appSide right">
  <div class="appDebug">
    <input
      type="button"
      on:click={() => {
        rightIframeRefreshing = true;
        setTimeout(() => {
          rightIframeRefreshing = false;
        }, 1);
      }}
      value="refresh"
    />
    <span class="iframeUrl">{rightIframeUrl}</span>
  </div>
  <iframe class="app" title="right" src={rightIframeUrl} />
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
