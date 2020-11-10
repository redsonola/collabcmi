<script lang="ts">
  import type { Keypoint, Pose } from '@tensorflow-models/posenet';
  
  export let pose: Pose | undefined = undefined;
  export let keypoints: Keypoint[] = pose?.keypoints || [];

  function round(number, digits = 3): string {
    if (typeof number === 'number')
      return number.toFixed(digits);
    else
      return '';
  }

  const x = keypoint => round(keypoint.position.x, 1);
  const y = keypoint => round(keypoint.position.y, 1);
</script>

<style>
  table {
    width: 100%;
  }

  .part {
    width: 0px; /* as small as possible */
  }

  .coords {
    width: 8em;
    font-family: monospace;
  }

  .score-bar-row {
    width: 100px;
  }

  .score-bar {
    text-align: left;
    font-size: 9px;
    line-height: 1rem;
    font-weight: 100;
    margin: 0;
    padding: 0;
    font-family: monospace;
    height: 1rem;
    background-color: cyan;
    box-sizing: border-box;
    border: solid rgba(0, 0, 0, 0.5) 1px;
  }
</style>

{#if keypoints}
  <table>
    {#if pose}
      <thead>
        <th class="score-bar-row" colspan="3">
          <div class="score-bar" style={`width: ${pose.score * 100}%`}>&nbsp;{round(pose.score)}</div>
        </th>
      </thead>
    {/if}
    <tbody>
      {#each keypoints as keypoint (keypoint.part)}
        <tr>
          <td class="part">{keypoint.part}</td>
          <td class="coords">{x(keypoint)}, {y(keypoint)}</td>
          <!-- <td class="score">{round(keypoint.score)}</td> -->
          <td class="score-bar-row">
            <div class="score-bar" style={`width: ${keypoint.score * 100}%`}>&nbsp;{round(keypoint.score)}</div>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}