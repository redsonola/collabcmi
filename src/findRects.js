export function loadWasmRectFinder (useMock = false) {
  if (useMock) {
    return (x, y, z, callback) => {
      const i = 50;
      const mid = i * 3;
      
      const flip = (middle, line) =>
        [mid * 2 - line[0], line[1], mid * 2 - line[2], line[3]];

      callback([
        [i * 2, i * 2, i * 3, i * 3],
        [i * 2, i * 2, i * 1, i * 3],
        [i * 1, i * 3, i * 3, i * 6],
      ].flatMap(line => [line, flip(i * 3, line)]));
    };
  }

  // load this js file without compiling it
  window.head.js('myopencv.js');

  let moduleLoaded = false;

  const Module = window.Module = {
    onRuntimeInitialized: () => { moduleLoaded = true; }
  };

  return function findRects (videoData, width, height, callback)
  {
    if (!moduleLoaded)
      return callback([]);

    const uint8_t_ptr = Module._malloc(videoData.length);
    Module.HEAPU8.set(videoData, uint8_t_ptr);

    var v = Module.findRectangle(uint8_t_ptr, width, height);

    var points_array = [];
    for(var i=0;i<4;i++){
      points_array.push(v.get(i).get(0));
      points_array.push(v.get(i).get(1));
    }
    // console.log(points_array);

    Module._free(uint8_t_ptr);

    var x1 = v.get(0).get(0);
    var y1 = v.get(0).get(1);
    var x2,y2;

    const rects = [];

    for(var i=1;i<=4;i++){
      if(i===4){
        x2 = v.get(0).get(0);
        y2 = v.get(0).get(1);
      }
      else{
        x2 = v.get(i).get(0);
        y2 = v.get(i).get(1);
      }

      rects.push([x1,y1,x2,y2]);
      x1 = x2;
      y1 = y2;
    }

    callback(rects);
  }
}
