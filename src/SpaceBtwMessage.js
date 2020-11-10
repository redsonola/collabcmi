//this organizes data send via peerjs 
//its like OSC but with no / and thus no structured data. but. you know.
//Programmer: Courtney Brown, June 2020

export const STRING_MESSAGE = "string";
export const KEYPOINTS_MESSAGE = "keypoints";
export const VIDEOSIZE_MESSAGE = "videoSize";

export function size2d (width = 0, height = 0) {
  return {
    width,
    height
  };
}
export function spBtwMessage(dataType, data) {
  return {
    dataType,
    data
  };
}
