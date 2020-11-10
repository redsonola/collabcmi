<script lang="ts">
  import files from '../stories/recordingFileList.json';

  function makeFile(filename, data) {
    return fetch(`/api/write-recording?filename=${filename}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
  }

  function randomString () {
    return Math.random().toString(36).substring(7).replace(/\d/g, '');
  }
</script>


<div>
  <p>
    There is an api in .storybook/middleware.js that takes some json data, and saves
    it as `Date.now() + '.json'`. There is also an api to list the files in that folder.
  </p>
  <p>
    That way, you can record the points from the tf model, and play them back in a storybook
    story and use them to draw stuff. It saves in the repo so you can commit the files, and rename
    them if you want.
  </p>
</div>
<ol>
  {#each files as fileName (fileName)}
    <li>{fileName}</li>
  {/each}
</ol>
<input type="button" value="make file" on:click={() => {
  makeFile(`test${randomString()}`, { 'mock': 'data' });
}} />