<script lang="ts">
  import { Line3, Vector3 } from 'three';

  // Given a function f that takes a number x and returns a number y
  // find a point along that function where y = 0
  function newtonRaphson(
    guess: number,
    increment: number,
    iteration: number,
    eps: number,
    f: (x: number) => number
  ) {
    let rootFound = false;

    let i;
    for (i = 0; i < iteration + 1; i++) {
      let fPrime = (f(guess + increment / 2) - f(guess - increment / 2)) / increment;
      guess += -f(guess) / fPrime;
      if (Math.abs(f(guess)) <= eps) {
        rootFound = true;
        break;
      }
    }

    return { value: guess, converged: rootFound, i };
  }

  // takes a position (x) along the first line (to be used with https://threejs.org/docs/index.html?q=vec#api/en/math/Line3.at )
  // return that point's distance to the line (y) -- it's 0 if they intersect.
  function distanceBetweenLines(position, lineA, lineB) {
    const current = lineA.at(position, new Vector3());
    const closestToB = lineB.closestPointToPoint(current, false, new Vector3()); // or closestPointToPointParameter? I don't know what the difference is
    return current.distanceTo(closestToB);
  }

  let lineA = new Line3(new Vector3(0, 0, 0), new Vector3(10, 10, 0));
  let lineB = new Line3(new Vector3(50, 0, 0), new Vector3(0, 50, 0));


  // placeholders
  let result = { converged: false, value: -1 };
  let lineAResult = new Vector3();
  let lineBResult = new Vector3();

  // this weird $ label thing marks the block as reactive, i.e. when any referenced
  // variable is assigned to, this block reruns.
  $: {
    /**
     * HERE!!!
     * This is the main thing!!! 
     */
    result = newtonRaphson(
      0.5, // initial guess, start in the middle
      0.0001, // increment
      50, // max iterations
      0.001, // tolerance -- how close it has to get
      (position) => distanceBetweenLines(position, lineA, lineB) // a function
    );

    lineAResult = lineA.at(result.value, new Vector3());
    lineBResult = lineB.closestPointToPoint(lineAResult, true, new Vector3());
  }

  // index is for the Vector3, x=0, y=1, z=2
  function changeLine(line: number, endpoint: 'start' | 'end', index: number) {
    return (e) => {
      const value = parseInt(e.currentTarget.value);
      const threeLine = line === 0 ? lineA : lineB;
      threeLine[endpoint].setComponent(index, value);
      if (line === 0) {
        lineA = threeLine;
      } else {
        lineB = threeLine;
      }
    }
  }

</script>

<label> aStartX: <input type="number" value={lineA.start.x} on:change={changeLine(0, 'start', 0)} on:keypress={changeLine(0, 'start', 0)} /> </label>
<label> aStartY: <input type="number" value={lineA.start.y} on:change={changeLine(0, 'start', 1)} on:keypress={changeLine(0, 'start', 1)} /> </label><br/>
<label> aEndX:   <input type="number" value={lineA.end.x}   on:change={changeLine(0, 'end', 0)}   on:keypress={changeLine(0, 'end', 0)} /> </label>
<label> aEndY:   <input type="number" value={lineA.end.y}   on:change={changeLine(0, 'end', 1)}   on:keypress={changeLine(0, 'end', 1)} /> </label><br/>
<br />

<label> bStartX: <input type="number" value={lineB.start.x} on:change={changeLine(1, 'start', 0)} on:keypress={changeLine(1, 'start', 0)} /> </label>
<label> bStartY: <input type="number" value={lineB.start.y} on:change={changeLine(1, 'start', 1)} on:keypress={changeLine(1, 'start', 1)} /> </label><br/>
<label> bEndX:   <input type="number" value={lineB.end.x}   on:change={changeLine(1, 'end', 0)}   on:keypress={changeLine(1, 'end', 0)} /> </label>
<label> bEndY:   <input type="number" value={lineB.end.y}   on:change={changeLine(1, 'end', 1)}   on:keypress={changeLine(1, 'end', 1)} /> </label><br/>

<svg class="graph" viewBox="-100, -100, 200, 200" xmlns="http://www.w3.org/2000/svg">
  <circle stroke="pink" fill="pink" r="0.1rem" cx={lineA.start.x} cy={lineA.start.y} />
  <circle stroke="pink" fill="pink" r="0.1rem" cx={lineA.end.x} cy={lineA.end.y} />
  <line stroke-linecap="round" x1={lineA.start.x} y1={lineA.start.y} x2={lineA.end.x} y2={lineA.end.y} stroke="#333" stroke-width=1 />

  <circle stroke="pink" fill="pink" r="0.1rem" cx={lineB.start.x} cy={lineB.start.y} />
  <circle stroke="pink" fill="pink" r="0.1rem" cx={lineB.end.x} cy={lineB.end.y} />
  <line stroke-linecap="round" x1={lineB.start.x} y1={lineB.start.y} x2={lineB.end.x} y2={lineB.end.y} stroke="#333" stroke-width=1 />

  <circle stroke="pink" fill="pink" r="0.1rem" cx={lineAResult.x} cy={lineAResult.y} />
</svg>

<pre class="results">
converged: {result.converged}
value: {result.value.toFixed(5)}

lineA.at(value) = ({lineAResult.toArray()})
lineB.closestPointToPoint( lineA.at(value) ) = ({lineBResult.toArray()})
</pre>

<style>
  .graph {
    width: 400px;
    height: 400px;
  }
</style>