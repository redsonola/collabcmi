<script lang="ts">
  /**
   * Run mediapipe & show the result on an SVG.
   */

  import { videoSubscription } from '../threejs/cameraVideoElement';
  import type { Keypoint } from '@tensorflow-models/posenet';
  import KeypointSVG from "./KeypointSVG.svelte";

  /* import one of the following */
  // import { initPosenet } from "../threejs/posenetcopy";
  import { initPosenet } from "../threejs/mediapipePose";
  // import { initPosenet } from "../threejs/posenetMock";

  let keypoints: Keypoint[] | undefined = undefined;
  let size = { width: 1, height: 1 };

  const posenet = initPosenet();
  const webcamVideo = videoSubscription("webcam");

  let posenetVideoSet = false;
  $: if ($webcamVideo) {
    if (posenetVideoSet) throw new Error('Trying to set video again!');
    posenetVideoSet = true;
    posenet.updateVideo($webcamVideo);
  }

  let loading = true;
  posenet.onResults((result) => {
    loading = false;
    size = posenet.getSize();
    keypoints = result.keypoints;
  });
</script>

{#if loading}
  Loading...
{/if}
{#if keypoints && size}
  <KeypointSVG {keypoints} {size} />
{/if}
<pre>{JSON.stringify(size)}</pre>
<pre>{JSON.stringify(keypoints, null, '  ')}</pre>