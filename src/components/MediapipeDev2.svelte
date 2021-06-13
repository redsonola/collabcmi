<script>
  /**
   * Basically the code that's running on the example codepen: https://codepen.io/mediapipe/pen/jOMbvxw?editors=1000
   * but it delays running the JS, and uses the local @mediapipe/pose package.
   */

  import "@mediapipe/pose/pose";

  setTimeout(() => {
    // Our input frames will come from here.
    const videoElement = document.getElementsByClassName('input_video')[0];
    const canvasElement = document.getElementsByClassName('output_canvas')[0];
    const controlsElement = document.getElementsByClassName('control-panel')[0];
    const canvasCtx = canvasElement.getContext('2d');

    // We'll add this to our control panel later, but we'll save it here so we can
    // call tick() each time the graph runs.
    const fpsControl = new FPS();

    // Optimization: Turn off animated spinner after its hiding animation is done.
    const spinner = document.querySelector('.loading');
    spinner.ontransitionend = () => {
      spinner.style.display = 'none';
    };

    function zColor(data) {
      return 'white';
    }

    function onResults(results) {
      // Hide the spinner.
      document.body.classList.add('loaded');

      // Update the frame rate.
      fpsControl.tick();

      // Draw the overlays.
      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      canvasCtx.drawImage(
          results.image, 0, 0, canvasElement.width, canvasElement.height);
      drawConnectors(
          canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
            visibilityMin: 0.65,
            color: 'white'
          });
      drawLandmarks(
          canvasCtx,
          Object.values(POSE_LANDMARKS_LEFT)
              .map(index => results.poseLandmarks[index]),
          {visibilityMin: 0.65, color: zColor, fillColor: 'rgb(255,138,0)'});
      drawLandmarks(
          canvasCtx,
          Object.values(POSE_LANDMARKS_RIGHT)
              .map(index => results.poseLandmarks[index]),
          {visibilityMin: 0.65, color: zColor, fillColor: 'rgb(0,217,231)'});
      drawLandmarks(
          canvasCtx,
          Object.values(POSE_LANDMARKS_NEUTRAL)
              .map(index => results.poseLandmarks[index]),
          {visibilityMin: 0.65, color: zColor, fillColor: 'white'});
      canvasCtx.restore();
    }

    const pose = new Pose({locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.3.1621277220/${file}`;
    }});
    pose.onResults(onResults);

    /**
     * Instantiate a camera. We'll feed each frame we receive into the solution.
     */
    const camera = new Camera(videoElement, {
      onFrame: async () => {
        await pose.send({image: videoElement});
      },
      width: 1280,
      height: 720
    });
    camera.start();

    // Present a control panel through which the user can manipulate the solution
    // options.
    new ControlPanel(controlsElement, {
          selfieMode: true,
          modelComplexity: 1,
          smoothLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        })
        .add([
          new StaticText({title: 'MediaPipe Pose'}),
          fpsControl,
          new Toggle({title: 'Selfie Mode', field: 'selfieMode'}),
          new Slider({
            title: 'Model Complexity',
            field: 'modelComplexity',
            discrete: ['Lite', 'Full', 'Heavy'],
          }),
          new Toggle({title: 'Smooth Landmarks', field: 'smoothLandmarks'}),
          new Slider({
            title: 'Min Detection Confidence',
            field: 'minDetectionConfidence',
            range: [0, 1],
            step: 0.01
          }),
          new Slider({
            title: 'Min Tracking Confidence',
            field: 'minTrackingConfidence',
            range: [0, 1],
            step: 0.01
          }),
        ])
        .on(options => {
          videoElement.classList.toggle('selfie', options.selfieMode);
          pose.setOptions(options);
        });
  }, 5000);
</script>

<svelte:head>
  <meta charset="utf-8">
  <link rel="icon" href="favicon.ico">
  <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/@mediapipe/control_utils@0.1/control_utils.css" crossorigin="anonymous">
  <link rel="stylesheet" type="text/css" href="demo.css" crossorigin="anonymous">
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3/camera_utils.js" crossorigin="anonymous"></script>
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/control_utils@0.3/control_utils.js" crossorigin="anonymous"></script>
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3/drawing_utils.js" crossorigin="anonymous"></script>
  <!-- <script src="https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.3.1621277220/pose.js" crossorigin="anonymous"></script> -->
</svelte:head>


<div class="container">
  <video class="input_video"></video>
  <canvas class="output_canvas" width="1280px" height="720px"></canvas>
  <div class="loading">
    <div class="spinner"></div>
    <div class="message">
      Loading
    </div>
  </div>
  <a class="abs logo" href="http://www.mediapipe.dev" target="_blank">
    <div style="display: flex;align-items: center;bottom: 0;right: 10px;">
      <img class="logo" src="logo_white.png" alt="" style="
        height: 50px;">
      <span class="title">MediaPipe</span>
    </div>
  </a>
  <div class="shoutout">
    <div>
      <a href="https://solutions.mediapipe.dev/pose">
        Click here for more info
      </a>
    </div>
  </div>
</div>
<div class="control-panel">
</div>

<style lang="scss">
  @keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.abs {
  position: absolute;
}

a {
  color: white;
  text-decoration: none;
  &:hover {
    color: lightblue;
  }
}

body {
  bottom: 0;
  font-family: 'Titillium Web', sans-serif;
  color: white;
  left: 0;
  margin: 0;
  position: absolute;
  right: 0;
  top: 0;
  transform-origin: 0px 0px;
  overflow: hidden;
}

.container {
  position: absolute;
  background-color: #596e73;
  height: 720px;
  width: 1280px;
}

.input_video {
  position:relative;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  &.selfie {
    transform: scale(-1, 1);
  }
}

.output_canvas {
  position:absolute;
  height: 720px;
  width: 1280px;
  left: 0;
  top: 0;
}

.logo {
  bottom: 10px;
  right: 20px;

  .title {
    color: white;
    font-size: 28px;
  }

  .subtitle {
    position: relative;
    color: white;
    font-size: 10px;
    left: -30px;
    top: 20px;
  }
}

.control-panel {
  position: absolute;
  left: 10px;
  top: 10px;
}

.loading {
  display: flex;
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  align-items: center;
  backface-visibility: hidden;
  justify-content: center;
  opacity: 1;
  transition: opacity 1s;

  .message {
    font-size: x-large;
  }

  .spinner {
    position: absolute;
    width: 120px;
    height: 120px;
    animation: spin 1s linear infinite;
    border: 32px solid #bebebe;
    border-top: 32px solid #3498db;
    border-radius: 50%;
  }
}

.loaded .loading {
  opacity: 0;
}

.shoutout {
  left: 0;
  right: 0;
  bottom: 40px;
  text-align: center;
  font-size: 24px;
  position: absolute;
}

</style>