
//holds canvas for processing and result
class ImageCanvas {
  constructor( path ) {
    this.canvas = document.querySelector( path );
    this.context = this.canvas.getContext( '2d' );
  }
}

export class ImageProcessWorkerHelperClass {
  constructor (Module) {

    this.myModule = Module;
    this.outputImage = null;


    //note> note grayscale.js...
    this.worker = new Worker( 'workerImage.js' );
    this.worker.addEventListener( 'message', ( evt ) => doWorkerMessage( evt ) );

    this.input = new ImageCanvas( '#input' );
    this.output = new ImageCanvas( '#output' );

    //TODO: refactor into the current code setup
    this.video = document.querySelector( '#videoElement' );
    navigator.mediaDevices.getUserMedia({video: true, audio: false} )
      .then( ( stream ) => {
        this.video.srcObject = stream;
        this.video.play();

        this.draw();
        this.process();
      } )
      .catch( ( err ) => {
        console.log( err );
      } );
  }

  //change for my own purposes
  draw() {
    if( this.outputImage !== null ) {
      console.log(this.outputImage);
      this.output.context.putImageData(
        this.outputImage, //the output image
        0,
        0
      );

      self.addEventListener( 'message', ( evt ) => {
        let pixels = evt.data;
        var uintArray = pixels; // imageData.data;

        const uint8_t_ptr = myModule._malloc(uintArray.length);
        myModule.HEAPU8.set(uintArray, uint8_t_ptr);

        var v = myModule.findRectangle(uint8_t_ptr, image.width, image.height);

        var points_array = [];
        for(var i=0;i<4;i++){
          points_array.push(v.get(i).get(0));
          points_array.push(v.get(i).get(1));
        }
        console.log(points_array);

        myModule._free(uint8_t_ptr);

        var x1 = v.get(0).get(0);
        var y1 = v.get(0).get(1);
        var x2,y2;
        for(var i=1;i<=4;i++){


          if(i===4){
            x2 = v.get(0).get(0);
            y2 = v.get(0).get(1);
          }
          else{
            x2 = v.get(i).get(0);
            y2 = v.get(i).get(1);
          }

          this.drawLine(ctx, x1,y1,x2,y2);
          x1 = x2;
          y1 = y2;
        }


        self.postMessage( pixels );
      } );
    }

    requestAnimationFrame( () => {return this.draw();} );
  }

  //change for my own purposes
  //TODO: see if bitmap is implemented and switch to that way.
  process() {
    this.input.context.drawImage( this.video, 0, 0 );

    const pixels = this.input.context.getImageData(
      0,
      0,
      this.input.canvas.clientWidth,
      this.input.canvas.clientHeight
    );

    this.worker.postMessage( pixels );
  }

  doWorkerMessage( evt ) {
    this.outputImage = evt.data;
    this.process();
  }

  drawLine(context, x1,y1,x2,y2) {

    context.beginPath();
    context.moveTo(x1,y1);
    context.lineTo(x2,y2);
    context.lineWidth = 10;
    context.strokeStyle = '#00FF00';
    context.stroke();
  }
}
