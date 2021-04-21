import type { Pose } from "@tensorflow-models/posenet";

export interface Size {
  width: number;
  height: number;
}

export interface PoseMessage {
  type: 'Pose';
  pose: Pose;
  size: Size;
}

export interface TextMessage {
  type: 'Text';
  message: string;
}

export interface MuteMessage {
  type: 'Mute';
  which: number; //0 - self, 1 - them --> from POV of receiver not sender
  muted: boolean; //true - mute person, false -- unmute person

}

export type PeerMessage = PoseMessage | TextMessage | MuteMessage ;
