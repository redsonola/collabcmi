<script lang="ts">
  import { Router, Route } from "yrv";
</script>

<Router>
  <!-- <Route
    path="/:myid/:theirid"
    component={import("./App2.svelte")}
    let:router
  /> -->
  <Route
    fallback
    component={import("./App2.svelte")}
    let:router
  />
</Router>

<style>
  :global(body) {
    box-sizing: border-box;
  }

  :global(*) {
    box-sizing: inherit;
  }

</style>
