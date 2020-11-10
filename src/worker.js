const useMockRectFinder = true;

// how should this part work????

import { loadWasmRectFinder } from './findRects';
// import '../src/build/myopencv.js';
// https://www.codepool.biz/use-webassembly-node-js.html

const findRects = loadWasmRectFinder(useMockRectFinder);
// end unknown part


// listen for the data,
// find the rectangles,
// send them back to the main thread.
self.addEventListener('message', (event) => {
  const { videoData, width, height } = event.data;

  findRects(videoData, width, height, result => {
    self.postMessage({ result });
  });
});


