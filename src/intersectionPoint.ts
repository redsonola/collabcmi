//Brent Brimhall wrote this code
//8/3/2022
import { Line3, Vector3 } from 'three';
  
  // Given a function f that takes a number x and returns a number y
  // find a point along that function where y = 0
  export function newtonRaphson(
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
  export function distanceBetweenLines(position, lineA, lineB) {
    const current = lineA.at(position, new Vector3());
    const closestToB = lineB.closestPointToPoint(current, false, new Vector3()); // or closestPointToPointParameter? I don't know what the difference is
    return current.distanceTo(closestToB);
  }