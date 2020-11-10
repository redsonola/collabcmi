<script>
  import { onMount } from 'svelte';
  import { init } from '../main';
  // import { init } from './main2.js';

  let sliderValue = 0.9;
  onMount(init);
</script>

<style>
  #videoElement {
    display: none;
    /* width: 50%; */
    /* width: 500px; */
    /* height: 375px; */
  }

  #videoElementCalled {
    display: none;
    /* width: 500px; */
    /* height: 375px; */
  }

  #testVideo {
    display: none; 
    /* width: 500px; */
    /* height: 375px; */
    /* width: 50%; */


  }

  #outputImage {
    /* the element's width & height attributes set the
        width & height that the drawing context uses.
        if you set the size in css, it doesn't affect how
        it draws, it just changes the size that it shows
        it to you. */
    width: 100%;
    height:100%;
    transform: scaleX(-1);
  }
  #dxID {
    white-space: pre;
  }
  body { margin: 0; }
  canvas { display: block; }
</style>

<!-- <img id="image1" src="./image.jpg"/> -->
<label for="yourID">Your ID:</label> 
<input type="text" id="yourID" name="yourID">

<label for="callingID">Calling ID:</label> 
<input type="text" id="callingID" name="callingID"><br><br>
<button id="callButton">Call the Calling ID</button>
<button id="submitButton">Enter your User ID to Answer Calls.</button><br><br>
<label for="status">Status:</label> <label id="status">Loading... </label> <br><br>
<label for="messages">Messages:</label> <label id="messages"> </label><br><br>
<label for="sendMessages">Type your text here to send:</label> 
<div class="slidecontainer">
  <input type="range" min="0" max="10" bind:value={sliderValue} class="slider" id="minimimThresSlider" step="0.1">
  <label>{sliderValue}</label>
</div>
<input type="text" id="sendMessages" name="yourID">    <button id="sendButton">Send</button>
<h2> Current dx: <code id="dxID"></code></h2>
<br><br>


<img id="image2" />
<table>
  <tr><td>
    <canvas id="outputImage"></canvas>
</td><td>
  <canvas id="outputImage2"></canvas>
</td></tr></table>
<button id="playTestButton">Use Test Video</button>
<video autoplay="false" id="testVideo" controls>
<source src="./spacebtwTest.mp4" type="video/mp4">
</video>
<video autoplay="true" id="videoElement"></video>
<video autoplay="true" id="videoElementCalled"></video>
