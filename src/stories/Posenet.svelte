<script lang="ts">
  import { onMount } from 'svelte';
  import type { Pose } from '@tensorflow-models/posenet';
  import { initPosenet } from "../threejs/posenet";
  import { makeVideoElement } from "../threejs/cameraVideoElement";
  import { PoseRecord, selectedFilePoseSource } from "../threejs/recordings";
  import { goLoop } from "../threejs/promiseHelpers";
  import type { PoseVideo } from "../draw3js";

  interface PoseVideoSrc {
    poseSource?: "posenet" | "record" | string;
    videoSrc?: "webcam" | string;
  }

  export let videos: PoseVideoSrc[];
  export let threeRenderCode;
  export let debugPanelExpanded = false;

  let posenetSize = { width: 0, height: 0 };
  let lastPose: Pose | null = null;
  let canvas;
  let isRecording: "recording" | "saving" | "ready" = "ready";
  let recordedPoses: PoseRecord[] = [];
  let poseTimes: number[] = [0];
  $: timePerPose = (poseTimes[poseTimes.length - 1] - poseTimes[0]) / poseTimes.length;

  async function init () {
    const futureVideos = videos
      .map(async ({ videoSrc, poseSource }, i): Promise<PoseVideo> => {
        let video;
        if (videoSrc === "webcam") {
          video = await makeVideoElement();
        } else if (videoSrc) {
          video = await makeVideoElement(videoSrc);
        }
        else throw new Error(`${videoSrc} isn't a valid videoSrc`);

        if (!poseSource) {
          return { video };
        } else {
          const makePoseThing = poseSource === "posenet"
            ? initPosenet
            : selectedFilePoseSource(poseSource);
          const posenet = await makePoseThing(video);

          const getPose = async () => {
            const pose = await posenet.getPose();
            poseTimes = [...poseTimes, performance.now()].slice(-5);
            posenetSize = posenet.getSize();
            lastPose = pose;
            if (isRecording === 'recording') {
              recordedPoses = [...recordedPoses, { pose, timestamp: performance.now() }];
            }
            return pose;
          }
          const patchedPosenet = { ...posenet, getPose };

          return { video, posenet: patchedPosenet };
        }
      });

    const { cleanup: cleanupRender, dispatch } = threeRenderCode({ canvas });
    let running = true;
    futureVideos.forEach(async (_video, i) => {
      const { posenet, video } = await _video;
      dispatch({ type: 'AddVideo', personId: '' + i, video });
      if (posenet) {
        goLoop(async () => {
          if (!running) return goLoop.STOP_LOOP;
          dispatch({
            type: 'UpdatePose',
            personId: '' + i,
            targetVideoId: '' + i,
            pose: await posenet.getPose(),
            size: posenet.getSize()
          });
        });
      }
    });

    return () => {
      running = false;
      cleanupRender();
      futureVideos.forEach(async (vid, i) => {
        const { video, posenet } = await vid;
        video?.stop();
        posenet?.cleanup();
      });
    };
  }

  onMount(() => {
    const promiseCleanup = init();
    return () => {
      promiseCleanup.then(cleanup => cleanup());
    }
  });

  function onToggleDebugPanel () {
    debugPanelExpanded = !debugPanelExpanded;
  }

  function round(number) {
    return number.toFixed(3);
  }
</script>

<style>
  .devPanel {
    position: fixed;
    top: 0;
    right: 0;
  }

  .devPanel-container {
    font-size: 10;
    line-height: 1.1em;
    color: rgba(0,0,0,0.7);
    height: 1em;
    max-height: 100vh;
  }

  .devPanel-title {
    text-align: right;
  }
</style>

<canvas bind:this={canvas}></canvas>

<div class="devPanel">
  <div class="devPanel-container">
    <pre class="devPanel-title" on:click={onToggleDebugPanel}>
      dev {#if debugPanelExpanded}-{:else}+{/if}
    </pre>
    {#if debugPanelExpanded}
      <!--<pre>{JSON.stringify(lastPose, null, '| ')}</pre>-->
<pre>
posenet {JSON.stringify(posenetSize)}
avg time per pose: {round(timePerPose)}
</pre>
      <pre>
{#if lastPose}{#each lastPose.keypoints as keypoint (keypoint.part)
}{keypoint.part} {round(keypoint.score)} ({
  round(keypoint.position.x)
}, {
  round(keypoint.position.y)
})<br />{/each}{/if}
      </pre>
    {/if}
  </div>
</div>
