<script lang="ts">
  // copied from https://loading.io/css/ w/ CC0 (no rights reserved) license
  export let progress: string | null = null;
</script>
<div class="loading-ring"><div /><div /><div /><div />
{#if progress !== null}<span class="label">{progress}</span>{/if}
</div>

<style>
  .loading-ring {
    display: inline-block;
    position: absolute;
    width: 80px;
    height: 80px;
    left: calc(50% - 40px);
    top: calc(50% - 40px);
  }
  .loading-ring div {
    box-sizing: border-box;
    display: block;
    position: absolute;
    width: 64px;
    height: 64px;
    margin: 8px;
    border: 8px solid #55c;
    border-radius: 50%;
    animation: loading-ring 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
    border-color: #55c transparent transparent transparent;
    z-index: -1;
  }

  .loading-ring div:nth-child(1) {
    animation-delay: -0.45s;
  }

  .loading-ring div:nth-child(2) {
    animation-delay: -0.3s;
  }

  .loading-ring div:nth-child(3) {
    animation-delay: -0.15s;
  }

  .label {
    display: block;
    color: rgb(6, 155, 224);
    line-height: 80px;
    width: 100%;
    text-align: center;
    font-family: monospace;
  }

  @keyframes loading-ring {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>
