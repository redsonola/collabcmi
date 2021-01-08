<script lang="ts">
  import { slide } from 'svelte/transition';
  import type { Readable } from 'svelte/store';
  import type { PeerCommands, PeerEvents, PeerMessageReceived, SendPeerMessage } from '../peerJs';
  import type { PeerConnections, PeerMessageStore, PoseMessage } from "./PoseMessages";
  import PrintPose from './PrintPose.svelte';

  export let debugPanelExpanded = false;

  export let messages: Readable<PeerMessageStore>;
  export let peerConnections: PeerConnections = {};
  export let myId: string | undefined;

  function toggleDebugPanel () {
    debugPanelExpanded = !debugPanelExpanded;
  }

  function isPoseEvent (action: PeerEvents<any> | PeerCommands<any>): action is PeerMessageReceived<PoseMessage> {
    return action.type === "PeerMessageReceived" && action.message.type === "Pose";
  }

  function isPoseCommand (action: PeerEvents<any> | PeerCommands<any>): action is SendPeerMessage<PoseMessage> {
    return action.type === "SendPeerMessage" && action.message.type === "Pose";
  }

  const getMyPose = (messages: PeerMessageStore) => Object.values(messages)
    .filter(isPoseCommand)
    .map(action => action.message.pose);

  const getTheirPose = (messages: PeerMessageStore) => Object.values(messages)
    .filter(isPoseEvent)
    .map(action => action.message.pose);

  let debugPanelSection = 'all';
  const setDebugPanelSection = section => () => {
    debugPanelExpanded = true;
    debugPanelSection = section;
  };

  const debugSectionNames = {
    all: "All",
    passedIn: "Passed in",
    call: "Call",
    myPose: "My pose",
    theirPose: "Their pose"
  };

  const isDebugPanelSection = (debugPanelExpanded, debugPanelSection, section) => (
    debugPanelExpanded && (debugPanelSection === section || debugPanelSection === "all")
  );

  function getDebugSections (debugPanelExpanded, debugPanelSection) {
    return {
      all: isDebugPanelSection(debugPanelExpanded, debugPanelSection, 'all'),
      passedIn: isDebugPanelSection(debugPanelExpanded, debugPanelSection, 'passedIn'),
      call: isDebugPanelSection(debugPanelExpanded, debugPanelSection, 'call'),
      myPose: isDebugPanelSection(debugPanelExpanded, debugPanelSection, 'myPose'),
      theirPose: isDebugPanelSection(debugPanelExpanded, debugPanelSection, 'theirPose'),
    }
  }

  let debugSections = getDebugSections(debugPanelExpanded, debugPanelSection);

  // update debugSections in response to debugPanelExpanded & debugPanelSection changing
  $: debugSections = getDebugSections(debugPanelExpanded, debugPanelSection);

  function showJson (obj, replacer = null, spaces = '  ') {
    return JSON.stringify(obj, replacer, spaces)
      .split(/\n/g)
      .slice(1, -1)
      .map(line => line.slice(spaces.length))
      .join('\n');
  }

</script>

<style>
  .devPanel {
    position: absolute;
    top: 0;
    right: 0;
  }

  .devPanel pre {
    white-space: pre-wrap;
  }

  .devPanel-title {
    width: 100%;
    text-align: right;
    cursor: pointer;
    font-family: monospace;
  }

  .devPanel-title span {
    margin-left: 1em;
  }

  .devPanel-title .active {
    text-decoration: underline;
  }

  .devPanel-container {
    font-size: 10px;
    line-height: 1.1em;
    color: rgba(241, 234, 234, 0.7);
    height: 1em;
    height: fit-content;
  }

  .devPanel-container:hover {
    background-color: rgba(255,255,255,0.8);
    color: #333333;
  }

  .title {
    text-align: right;
    font-size: 15px;
    line-height: 1em;
    font-weight: bold;
  }
</style>

<div class="devPanel">
  <div class="devPanel-container">
    <div class="devPanel-title">
      {#each Object.entries(debugSectionNames) as [name, label] (name)}
        <span class:active={debugPanelSection === name} on:click={setDebugPanelSection(name)}>{label}</span>
      {/each}
      <span on:click={toggleDebugPanel}>{#if debugPanelExpanded}-{:else}+{/if}</span>
    </div>
    {#if debugPanelExpanded}
      <div transition:slide>
        {#if debugSections.call}
          <div class="title">Call Info</div>
          <div>
            My ID: <code>{myId}</code><br/>
            <pre>{showJson(peerConnections)}</pre>
          </div>
        {/if}
        {#if debugSections.passedIn}
          <div class="title">Passed in</div>
          <slot></slot>
        {/if}
        {#if debugSections.all}
          <div class="title">Other messages</div>
          {#each Object.entries($messages)
            .filter(([, msg]) => !isPoseEvent(msg) && !isPoseCommand(msg))
            as [key, message] (key)}
            <pre>{showJson(message)}</pre>
          {/each}
        {/if}
        {#if debugSections.myPose}
          <div class="title">My last pose</div>
          {#each getMyPose($messages) as pose}<PrintPose pose={pose} />{/each}
        {/if}
        {#if debugSections.theirPose}
          <div class="title">Their last pose</div>
          {#each getTheirPose($messages) as pose}<PrintPose pose={pose} />{/each}
        {/if}
    </div>
    {/if}
  </div>
</div>