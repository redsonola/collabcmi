//Programmer: Courtney Brown 
// Date: Sept 2020
// Desc: draws a hatched line

//TODO: optimitize 

import * as Scale from './scale'
// import * as posenet1 from '@tensorflow-models/posenet';
import { ctransposeDependencies } from 'mathjs';
import * as PoseIndex from './poseConstants.js'
import * as THREE from 'three';
// import { assert } from 'console';

//draw all the lines to a canvas that you save and then .......


export class HatchedLine
{
   x1 : number; 
   y1 : number; 
   x2 : number; 
   y2 : number; 
  //  color_str : string;
  
  constructor( x1_ : number,  y1_ : number,  x2_ : number,  y2_: number)  
  {
    this.x1 = x1_; 
    this.y1 = y1_;
    this.x2 = x2_;
    this.y2 = y2_ ;


    // let r1 = Math.round(Scale.linear_scale(Math.random(), 0, 1, 0, 9));
    // let r2 = Math.round(Scale.linear_scale(Math.random(), 0, 1, 0, 9));
    // let g1 = Math.round(Scale.linear_scale(Math.random(), 0, 1, 0, 9));
    // let g2 = Math.round(Scale.linear_scale(Math.random(), 0, 1, 0, 9));
    // let b1 = Math.round(Scale.linear_scale(Math.random(), 0, 1, 0, 9));
    // let b2 = Math.round(Scale.linear_scale(Math.random(), 0, 1, 0, 9));

    // this.color_str = "#" + r1.toString() + r2.toString() + g1.toString() + g2.toString() + b1.toString() +  b2.toString();

  }
  
  set( x1_ : number,  y1_ : number,  x2_ : number,  y2_: number) : void 
  {   
    this.x1 = x1_; 
    this.y1 = y1_;
    this.x2 = x2_;
    this.y2 = y2_ ;
  }
  
   draw(ctx : any) : void 
  {
    this.drawHatchedLine1(ctx, this.x1, this.y1, this.x2, this.y2);
  }

  //note: only stroking saved some but not a lot - could save the lines of the color & draw at once.
  //use more than one canvas it speeds it up.
  //clearRect()?
  drawLine(ctx:any,  x1_ : number,  y1_ : number,  x2_ : number,  y2_: number, strokeStyle : string, lineWidth:number=1)
  {
    ctx.beginPath();
    ctx.moveTo(x1_ , y1_);
    ctx.lineTo(x2_, y2_);
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 1;
    ctx.stroke();

  }
  
   drawHatchedLine1( ctx : any, x : number,  y : number,  vx2 : number,  vy2 : number) : void
  {


    // let color_str = "#" + r1.toString() + r2.toString() + g1.toString() + g2.toString() + b1.toString() +  b2.toString();
    // console.log(color_str);



    // // //find bitwise hack for Math.round
      this.drawLine(ctx, x, y-3, vx2+2, vy2+1, "#4B05FF");
  
    // // // stroke(120, 15, 255);
      this.drawLine(ctx, x-1, y-2, vx2-2, vy2-2, "#780FFF");

    // // // stroke(100, 40, 200);
      this.drawLine(ctx, x, y, vx2+3, vy2+3, "#6428C8");

    // // // stroke(50, 15, 150);
      this.drawLine(ctx, x+5, y+2, vx2+2, vy2+6, "#320F96");

    


    // // // //find bitwise hack for Math.round
    //  this.drawLine(ctx, x, y-3, vx2+2, vy2+1, this.color_str);
  
    // // // // stroke(120, 15, 255);
    //  this.drawLine(ctx, x-1, y-2, vx2-2, vy2-2, this.color_str);

    // // // // stroke(100, 40, 200);
    //  this.drawLine(ctx, x, y, vx2+3, vy2+3, this.color_str);

    // // // stroke(50, 15, 150);

  }
  
}

//********************************** */

export class HatchedRandomLine
{
    x1 : number; 
    y1 : number; 
    x2 : number; 
    y2 : number; 
  
   origX2: number; 
   origY2: number; 

   dx: number; 
   dy: number; 
  
    startX: number;
    endX: number; 
    startY: number; 
    endY: number; 
    directionX: number = 1; 
    directionY: number = 1; 

    comingBack: boolean = false;
  
    MAX_OLD_LINES : number = 300;

    savedCanvasCtx : any; 
    savedCanvas  : any; 

    width:number; 
    height:number;
    canvas : any;

    dxDivisor : number; 

    keyPointIndex : number[]; 
    minConfidence : number; 
    curConfidence : number;

    clearEveryFrame : boolean = true; 

    // scene : any = null; 
    // camera : any = null; 
    // renderer : any = null; 

  constructor( offsetx : number,  offsety: number,  offsetx2 : number,  offsety2: number, canvas_ : any, w : number = 640, h: number = 480, minConfidence : number = 0.15)
  {
    this.x1 = offsetx; 
    this.y1 = offsety;

    //defaults to change (well the end points)
    this.startX =  this.x1; 
    this.startY =  this.y1;
    this.endX = offsetx2;
    this.endY = offsety2;
    
    this.dx= this.endX - this.startX; 
    this.dy= this.endY - this.startY;  

    this.x2 = this.x1; 
    this.y2 = this.y1; 

    this.origX2 = this.x1;
    this.origY2 = this.y1;

    this.directionX = 1;
    this.directionY = 1;


    this.savedCanvas = document.createElement("canvas");
    this.width = w; 
    this.height = h; 

    this.setCanvasDimensions(canvas_);
    this.savedCanvasCtx = this.savedCanvas.getContext("2d");
    this.canvas = canvas_;
    this.keyPointIndex = [1, -1]; 

    this.dxDivisor = 200; 

    this.minConfidence = minConfidence; 
    this.curConfidence = 1;

    this.clearEveryFrame = true; 

    //this.initThreejs(canvas_);
  }

  //um don't do anything yet
  initThreejs(canvas : any)
  {
    // this.scene = new THREE.Scene();
    // this.camera = new THREE.PerspectiveCamera( 75, canvas.width / canvas.height, 0.1, 1000 );

    // this.renderer = new THREE.WebGLRenderer();
    // this.renderer.setSize( canvas.width, canvas.height );
    // document.body.appendChild( this.renderer.domElement );

  }


  setClearFrame( should: boolean ) : void 
  {
    this.clearEveryFrame = should;
  }


  setCanvasDimensions(canvas_)
  {
    this.savedCanvas.width = canvas_.width; 
    this.savedCanvas.height = canvas_.height; 
    this.savedCanvas.x  = canvas_.x; 
    this.savedCanvas.y = canvas_.y; 
  }


  update( offsetx : number,  offsety: number,  offsetx2 : number,  offsety2: number, curConfidence : number ) : void
  {    
    
    //defaults to change (well the end points)
    // this.startX =  this.x1; 
    // this.startY =  this.y1;

    let ctx = this.canvas.getContext("2d");

    this.startX = offsetx;
    this.startY = offsety;

    this.endX = offsetx2;
    this.endY = offsety2;

    this.curConfidence = curConfidence; 

    // ctx.beginPath();
    // ctx.moveTo(this.startX, this.startY);
    // ctx.lineTo(this.endX, this.endY);
    // ctx.lineWidth = 9;
    // ctx.strokeStyle = "#FF00FF";
    // ctx.stroke();
    // console.log(this.startX.toString() + " , " + this.startY.toString() + " , " +  this.endX.toString() + " , " +  this.endY.toString()+ " , " +  this.curConfidence.toString());


    this.dx= this.endX - this.startX; 
    this.dy= this.endY - this.startY;  

    this.x1 = this.startX;
    this.y1 = this.startY;


    this.origX2 = this.x1;
    this.origY2 = this.y1;

    //to do: separate x, y -- oh well lol.

    
  }

  setKeypointIndex(keyPointIndex : number[])
  {
    this.keyPointIndex = keyPointIndex;
  }

  getKeypointIndex() : number[]
  {
    return this.keyPointIndex; 
  }

  changeDirection()
  {
    //refactor OMG but ok, works
    if((this.x2 > this.endX && this.directionX >= 1 && this.dx >= 0) || (this.x2 < this.startX && this.directionX < 1 && this.dx >= 0)) 
    {
      this.directionX *= -1;
    }
    else if((this.x2 < this.endX && this.directionX >= 1 && this.dx < 0) || (this.x2 > this.startX && this.directionX < 1 && this.dx < 0)) 
    {
      this.directionX *= -1;
    }

    if((this.y2 > this.endY && this.directionY >= 1  && this.dy >= 0) || (this.y2 < this.startY && this.directionY < 1  && this.dy >= 0)) 
    {
        this.directionY *= -1;
    } 
    else if((this.y2 < this.endY && this.directionY >= 1  && this.dy < 0) || (this.y2 > this.startY && this.directionY < 1  && this.dy < 0)) 
    {
        this.directionY *= -1;
    } 
  }
  
   //speed up drawing.
  //https://stackoverflow.com/questions/13916066/speed-up-the-drawing-of-many-points-on-a-html5-canvas-element
  //https://www.creativebloq.com/how-to/speedy-javascript
  //https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
  //test with p5.js
  draw(ctx : any) : void
  {

      //will reset if I want to draw btw frames
      this.x1 = this.startX; 
      this.x2 = this.startX; 
      this.origX2 = this.startX; 
      this.y1 = this.startY; 
      this.y2 = this.startY; 
      this.origY2 = this.startY; 
      this.comingBack = false; 

      if(this.curConfidence < this.minConfidence) return; //if current confidence of keypoints level is lower than the min, don't draw

      if(this.clearEveryFrame)
      {
        this.savedCanvasCtx.clearRect(0, 0, this.savedCanvas.width, this.savedCanvas.height ); 
      }

      for(let k=0; k<this.MAX_OLD_LINES; k++)
      {  
        this.origX2 += (this.dx/this.dxDivisor) * this.directionX ;
        this.origY2 += (this.dy/this.dxDivisor) * this.directionY ;
    
        if(!this.comingBack)
        {
          this.x2 += (Math.round(this.dx/this.dxDivisor + Scale.linear_scale(Math.random(), 0, 1, -2, 2)) * this.directionX);
          this.y2 += (Math.round(this.dy/this.dxDivisor + Scale.linear_scale(Math.random(), 0, 1, -2, 2)) * this.directionY);

        // this.x2 += ((this.dx/100.0)  * this.directionX);
        // this.y2 += ((this.dy/100.0)  * this.directionY);

          this.comingBack = !( Math.abs(this.x2-this.origX2) <= 30 && Math.abs(this.y2-this.origY2) <= 30 );

        }
        else
        {
          this.comingBack = !( Math.abs(this.x2-this.origX2) <= 15 && Math.abs(this.y2-this.origY2) <= 15 );
          let backDx = ((this.origX2-this.x2)/this.dxDivisor) + Scale.linear_scale(Math.random(), 0, 1, -1, 1);
          let backDy = (this.origY2-this.y2)/this.dxDivisor + Scale.linear_scale(Math.random(), 0, 1, -1, 1);
        // let backDx = (this.origX2-this.x2)/100.0  * this.directionX;
        // let backDy = (this.origY2-this.y2)/100.0  * this.directionY;
          this.x2 += Math.round(backDx);
          this.y2 += Math.round(backDy);
        }
      
        //create the new line and draw it.
        let line1 : HatchedLine = new HatchedLine(this.x1, this.y1, this.x2, this.y2);
        line1.draw(this.savedCanvasCtx);

        this.changeDirection(); 
      
        this.x1 = this.x2;
        this.y1 = this.y2;
      
      }
      ctx.drawImage(this.savedCanvas, 0, 0);//, this.width, this.height);
    }  

    lastXY() : number[]
    {
      return [this.x2, this.y2];
    }


}

export class RandomHatchedHalo extends HatchedRandomLine
{
  radius : number; 
  percentAbove : number; 
  centerX : number; 
  centerY : number; 

  sampledEllipse : number = 6; //break the arc into 6 lines to draw

  constructor( offsetx : number,  offsety: number,  offsetx2 : number,  offsety2: number, canvas_ : any, percentCenterAbove: number = 0.2, w : number = 640, h: number = 480, minConfidence : number = 0.3)
  {
    //assert(offsetx > offsetx2 && offsety > offsety2); //left should be given before right (on the screen) -- it is not worth it to code for any eventuality at this point

    super(offsetx, offsety, offsetx2, offsety2, canvas_);

    //widen each side by given percent
    this.percentAbove = percentCenterAbove;//percentAbove;   

    //find the radius
    this.radius = Math.sqrt( (offsetx2-offsetx)*(offsetx2-offsetx) + (offsety2-offsety)*(offsety2-offsety) );
    this.radius = this.radius  / 2.0;

    this.dx = Math.PI; 
    this.dy = Math.PI;

    this.centerX = (this.endX + this.startX) / 2; 
    this.centerY = (this.endY + this.startY) / 2; 
    this.savedCanvasCtx.save();
 
  }

  update( offsetx : number,  offsety: number,  offsetx2 : number,  offsety2: number, curConfidence : number ) : void
  {    

    super.update(offsetx, offsety, offsetx2, offsety2, curConfidence );
    this.centerX = (this.endX + this.startX) / 2; 
    this.centerY = (this.endY + this.startY) / 2; 
    // this.addPercentAbove(); 

    //find the radius
    this.radius = this.getDistance(this.startX, this.startY, this.endX, this.endY);
    this.radius = this.radius  / 2.0;

    this.dx = Math.PI; 
    this.dy = Math.PI;
    
  }

   drawPoint(ctx, y, x, r, color) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  }

  //law of cos sines
  getAngle(a, b, c) : number
  {
    let numerator = c*c - (a*a + b*b); 
    let denominator = -2 * a * b;

    let frac = numerator/denominator; 

    return Math.acos(frac) ; 

  }

  getDistance(x1_, y1_, x2_, y2_) : number
  {
    return Math.sqrt((x2_-x1_)*(x2_-x1_) + (y2_-y1_)*(y2_-y1_));
  }

  getAngleForCanvasRotation()
  {
    let a = this.getDistance( this.centerX, this.centerY, this.endX, this.endY );
    let b = this.getDistance( this.centerX, this.centerY, this.endX, this.centerY );
    let c = this.getDistance( this.endX, this.centerY, this.endX, this.endY );
    let angle =  this.getAngle(a, b, c); 
    
    if( this.startY < this.endY ) return -angle; 
    else return angle; 

  }

  draw(ctx : any) : void
  {
      // if(this.curConfidence < this.minConfidence) return; //if current confidence of keypoints level is lower than the min, don't draw


      let xRadius = this.radius + this.radius*this.percentAbove;
      let yRadius = this.radius + this.radius*this.percentAbove*2.5;

      //will reset if I want to draw btw frames
      this.x1  = Math.round(((xRadius * Math.cos((0) * this.directionX)) + this.centerX)); 
      this.x2 = this.endX; 
      this.y1 = Math.round(((yRadius * Math.sin((0) * this.directionY)) + this.centerY));; 
      this.y2 = this.endY; 


      let startDx = 0; 

      //this.drawPoint(ctx, this.y1, this.x1, 8, 'red');

      let pw = this.savedCanvas.width;
      let ph = this.savedCanvas.height;

      //  this.savedCanvas.width = pw*3;
      //  this.savedCanvas.height = ph*3;

       this.savedCanvasCtx.restore();
       this.savedCanvasCtx.clearRect(0, 0, this.savedCanvas.width, this.savedCanvas.height ); 
       this.savedCanvasCtx.save();
       this.savedCanvasCtx.translate(this.centerX, this.centerY);
       this.savedCanvasCtx.rotate(this.getAngleForCanvasRotation());
       this.savedCanvasCtx.translate(-this.centerX, -this.centerY);
      
      for(let angle=0; angle<=this.sampledEllipse; angle++)
      {
        let nextEndX = Math.round((xRadius * Math.cos(-((angle/this.sampledEllipse) * Math.PI )) ) + this.centerX);
        let nextEndY = Math.round((yRadius * Math.sin(-((angle/this.sampledEllipse) * Math.PI )) ) + this.centerY);

        //this.drawPoint(this.savedCanvasCtx, this.y1, this.x1, 8, 'red');

        // //draw the random hatched line
        let randomLine = new HatchedRandomLine(this.x1, this.y1, nextEndX, nextEndY, this.savedCanvas); 
        randomLine.setClearFrame(false); 
        randomLine.draw(this.savedCanvasCtx); 
        
        let xy = randomLine.lastXY(); 
        this.x1 = xy[0];
        this.y1 = xy[1];

        // this.x1 = nextEndX;
        // this.y1 = nextEndY;

      }
      // this.savedCanvasCtx.translate(-this.startX, -this.startY);

      // this.savedCanvas.width = pw;
      // this.savedCanvas.height = ph;
      ctx.drawImage(this.savedCanvas, 0, 0); 


  }  



}
  export class SkeletonHatchedLines
  {
    lines: HatchedRandomLine[] = [];
    halo : any = null; 
    halo2 : any = null; 

    linesPer : number = 1;
    canvas : any; 
    posenet: any; 

    constructor(){}

    init(keypoints:any, canvas1:any, posenet_:any)
    {

      this.posenet=posenet_;
      this.canvas = canvas1; 

      this.addToLines(keypoints);

      let index1 = PoseIndex.leftEar;
      let index2 = PoseIndex.rightEar;
      this.halo = new RandomHatchedHalo( keypoints[index1].position.x, keypoints[index1].position.y, keypoints[index2].position.x, keypoints[index2].position.y, this.canvas, 0.4); 
      // this.halo2 = new RandomHatchedHalo( keypoints[index1].position.x, keypoints[index1].position.y, keypoints[index2].position.x, keypoints[index2].position.y, this.canvas, 1.5); 

    }


    draw(ctx : any) : void
    {
        this.lines.forEach( (line) => {
            line.draw(ctx);
        });
        if(this.halo !== null) this.halo.draw(ctx); 
      //  if(this.halo2 !== null) this.halo2.draw(ctx); 

    }

    addToLines(keypoints)
    {
      for( let i=0; i<PoseIndex.skeletonLimbs.length; i++ )
      {
        let index1 = PoseIndex.skeletonLimbs[i][0];
        let index2 = PoseIndex.skeletonLimbs[i][1];

        for(let k=0; k<this.linesPer; k++)
        {
            this.lines.push(new HatchedRandomLine( keypoints[index1].position.x, keypoints[index1].position.y, keypoints[index2].position.x, keypoints[index2].position.y, this.canvas));

          }
      }
    }

    update(keypoints) {

      let j=0; 
      for( let i=0; i<PoseIndex.skeletonLimbs.length; i++ )
      {
        let line = PoseIndex.skeletonLimbs[i];
        let index1 = line[0];
        let index2 = line[1];

        let endLoop = j+this.linesPer ; 
        let avgConfidence = ( keypoints[index1].score + keypoints[index2].score ) / 2.0;

        while( j<endLoop && j<this.lines.length )
        {
          this.lines[j].update( keypoints[index1].position.x, keypoints[index1].position.y, keypoints[index2].position.x, keypoints[index2].position.y,  avgConfidence );
          j++;
        }
      }
      let index1 = PoseIndex.leftEar;
      let index2 = PoseIndex.rightEar;
      let index3 = PoseIndex.leftEye;
      let index4 = PoseIndex.rightEye;
      let avgConfidence = ( keypoints[index1].score + keypoints[index2].score ) / 2.0;
      if(this.halo !== null) 
        this.halo.update( keypoints[index1].position.x, keypoints[index1].position.y, keypoints[index2].position.x, keypoints[index2].position.y, avgConfidence); 
        // this.halo2.update( keypoints[index3].position.x, keypoints[index3].position.y, keypoints[index4].position.x, keypoints[index4].position.y, avgConfidence); 

    }
    

  }

