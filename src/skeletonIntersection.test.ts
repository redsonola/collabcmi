import { expectArrayBuffersEqual } from '@tensorflow/tfjs-core/dist/test_util';
import { Line3, Vector3 } from 'three';
import { LimbIntersect } from './skeletonIntersection';

test('perpendicular intersection', () => {
    const intersection = new LimbIntersect();
    const line1 = new Line3(new Vector3(0, 0, 0), new Vector3(1, 0, 0));
    const line2 = new Line3(new Vector3(0, 0, 0), new Vector3(0, 0, 1));
    const result = intersection.intersectsLine(line1, line2);
    expect(result).toEqual(true);
});

test('parallel intersection', () => {
    const intersection = new LimbIntersect();
    const line1 = new Line3(new Vector3(0, 0, 0), new Vector3(5, 0, 5));
    const line2 = new Line3(new Vector3(3, 0, 0), new Vector3(5, 0, 2));
    const result = intersection.intersectsLine(line1, line2);
    expect(result).toEqual(false);
});

test('coming together intersection', () => {
    const intersection = new LimbIntersect();
    const line1 = new Line3(new Vector3(0, 0, 0), new Vector3(2, 0, 5));
    const line2 = new Line3(new Vector3(0, 0, 5), new Vector3(3, 0, 5));
    const result = intersection.intersectsLine(line1, line2);
    expect(result).toEqual(false);
});

//note start has to be less than the end
test('coming together intersection 2', () => {
    const intersection = new LimbIntersect();
    const line1 = new Line3(new Vector3(0.067,0.38, 2), new Vector3(0.067,0.7, 2));
    const line2 = new Line3(new Vector3(0.49,0.38, 2), new Vector3(0.49,0.7, 2));
    const result = intersection.intersectsLine(line1, line2);
    expect(result).toEqual(false);
});

//note start has to be less than the end
test('coming together intersection 2', () => {
    const intersection = new LimbIntersect();
    const line1 = new Line3(new Vector3(0.067,0.7, 2), new Vector3(0.067,0.38, 2) );
    const line2 = new Line3(new Vector3(0.49,0.7, 2), new Vector3(0.49,0.38, 2));
    const result = intersection.intersectsLine(line1, line2);
    expect(result).toEqual(false);
});

// //note start has to be less than the end
// test('intersection 3', () => {
//     const intersection = new LimbIntersect();
//     const line1 = new Line3(new Vector3(0.64, 0.29, 2), new Vector3(0.64,0.68, 2)  );
//     const line2 = new Line3(new Vector3(-0.31,0.29 , 2), new Vector3(-0.025,0.29, 2));
//     const result = intersection.intersectsLine(line1, line2);
//     expect(result).toEqual(false);
// });
