<script lang="ts">
  import { Router, Route } from "yrv";
</script>

<Router>
  <!-- <Route exact fallback component={() => import("./SkinHunger.svelte")} /> -->
  <Route exact fallback path="/" component={() => import("./App2.svelte")} let:router />
  <Route exact path="/call" component={() => import("./CallScreen.svelte")} let:router />
</Router>

<style>
  :global(body) {
    box-sizing: border-box;
  }

  :global(*) {
    box-sizing: inherit;
  }
</style>
