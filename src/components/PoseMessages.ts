import { writable } from 'svelte/store';

import type { Pose } from "@tensorflow-models/posenet";
import type { PeerCommands, PeerEvents } from "../peerJs";

export interface PeerConnection {
  theirId: string;
  ready: boolean;
  data: boolean;
  media: boolean;
}

export interface PeerConnections {
  [theirId: string]: PeerConnection;
}

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

export interface PeerMessageStore {
  [key: string]: PeerEvents<PeerMessage> | PeerCommands<PeerMessage>
}

export function peerMessageStore<T>() {
  const { subscribe, update } = writable({});

  const addMessage = (source: string, type: string, message: PeerEvents<T> | PeerCommands<T>) => {
    const actionKey = [source, type, message.type].join(':');
    update(a => ({ ...a, [actionKey]: message }));
  }

  return {
    subscribe,

    peerAction(message: PeerEvents<T>) {
      if (message.type === "PeerError" || message.type === "PeerOpen") {
        addMessage('*', 'evt', message);
      } else {
        addMessage(message.theirId, 'evt', message);
      }
    },

    peerCommand(message: PeerCommands<T>) {
      if (message.type === "DisconnectEverything") {
        addMessage('*', 'cmd', message);
      } else {
        addMessage(message.theirId, 'cmd', message);
      }
    }
  }
}
