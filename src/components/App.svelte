<script lang="ts">
  import { Router, Route } from "yrv";
</script>

<Router>
  <!-- <Route exact fallback component={() => import("./SkinHunger.svelte")} /> -->
  <Route exact fallback path="/" component={() => import("./App2.svelte")} let:router />
  <Route exact path="/call" component={() => import("./CallScreen.svelte")} let:router />
  <Route exact path="/about" component={() => import("./About.svelte")} />
  <Route exact path="/instructions" component={() => import("./Instructions.svelte")} />
  <Route exact path="/2apps" component={() => import("./2Apps.svelte")} let:router />
  <Route exact path="/mediapipe-dev" component={() => import("./MediapipeDev.svelte")} let:router />
  <Route exact path="/mediapipe-dev2" component={() => import("./MediapipeDev2.svelte")} let:router />
  <Route exact path="/newton-raphson" component={() => import("./NewtonRaphson.svelte")} let:router />
</Router>

<style>
  :global(body) {
    box-sizing: border-box;
  }

  :global(*) {
    box-sizing: inherit;
  }
</style>
