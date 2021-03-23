import Peer from 'peerjs';
import type { DataConnection, MediaConnection } from 'peerjs';
import { waitFor } from './threejs/promiseHelpers';
import axios from 'axios'; //TODO: https://github.com/axios/axios

// const REACT_APP_PEER_SERVER_HOST = "spacebtw-peerserver.herokuapp.com";
// const REACT_APP_PEER_SERVER_PORT = "443";
// const REACT_APP_PEER_SERVER_PATH = "/";

const REACT_APP_PEER_SERVER_HOST = "skinhunger-peerserver.herokuapp.com";
const REACT_APP_PEER_SERVER_PORT = "443";
const REACT_APP_PEER_SERVER_PATH = "/signaling";

// const REACT_APP_PEER_SERVER_HOST = "localhost";
// const REACT_APP_PEER_SERVER_PORT = "9000";

function ajaxRequestObject()
{
  var request; 
  if(window.XMLHttpRequest)
  {
  request = new XMLHttpRequest();
  }
  //is this for internet explorer? hmm
  // else if(window.ActiveXObject)
  // {
  // try
  // {
  //   request = new ActiveXObject('Msxml2.XMLHTTP');
  // }
  // catch (e)
  // {
  // request = new ActiveXObject('Microsoft.XMLHTTP');
  // }
// }

  return new XMLHttpRequest();
}


//TODO: will need to make the express server secure
export const peerServerParams: Peer.PeerJSOption = {
  host: REACT_APP_PEER_SERVER_HOST || window.location.hostname,
  port: REACT_APP_PEER_SERVER_PORT ? parseInt(REACT_APP_PEER_SERVER_PORT) : 9000,
  path: REACT_APP_PEER_SERVER_PATH || "/",
  secure: true,

  // secure: true,
  // iceTransportPolicy: "relay"
};

export interface MyId {
  myId: string;
}

export interface TheirId {
  theirId: string;
}

export type PeerIdPair = MyId & TheirId;

export interface PeerOpen extends MyId {
  type: 'PeerOpen';
}

export interface ConnectionOpen extends PeerIdPair {
  type: 'ConnectionOpen';
}

export interface SendPeerMessage<T> extends PeerIdPair {
  type: 'SendPeerMessage';
  message: T;
}

export interface CallPeer extends PeerIdPair {
  type: 'CallPeer';
  mediaStream: MediaStream;
}

export interface ConnectToPeer extends PeerIdPair {
  type: 'ConnectToPeer';
}

export interface ConnectingToPeer extends PeerIdPair {
  type: 'ConnectingToPeer';
}

export interface ConnectionClosed extends PeerIdPair {
  type: 'ConnectionClosed';
}

export interface ReceivedCall extends PeerIdPair {
  type: 'ReceivedCall';
}

export interface AnswerCall extends PeerIdPair {
  type: 'AnswerCall';
  mediaStream: MediaStream;
}

export interface CallAnswered extends PeerIdPair {
  type: 'CallAnswered';
  mediaStream: MediaStream;
}

export interface PeerMessageReceived<T> extends PeerIdPair {
  type: 'PeerMessageReceived';
  message: T;
}

export interface ChatRouletteFindPartner extends PeerIdPair
{
  type: 'ChatRouletteFindPartner'; 
}



export interface DisconnectData extends TheirId {
  type: 'DisconnectData';
}

export interface DisconnectMedia extends TheirId {
  type: 'DisconnectMedia';
}

export interface DisconnectEverything {
  type: 'DisconnectEverything';
}

export interface PeerError extends MyId {
  type: 'PeerError';
  error: Error;
}

export interface ConnectionError extends PeerIdPair {
  type: 'ConnectionError';
  error: Error;
}

export interface CallEnded extends PeerIdPair {
  type: 'CallEnded';
}


export type PeerCommands<T> =
  | SendPeerMessage<T>
  | CallPeer
  | ConnectToPeer
  | AnswerCall
  | DisconnectData
  | DisconnectMedia
  | DisconnectEverything
  | ChatRouletteFindPartner
  ;

  //TODO we: receive the disconnect event and try to reconnect when that happens or have some UI about asking user what to do.
export type PeerEvents<T> =
  | PeerOpen
  | ConnectingToPeer
  | PeerMessageReceived<T>
  | CallAnswered
  | CallEnded
  | ReceivedCall
  | PeerError
  | ConnectionError
  | ConnectionOpen
  | ConnectionClosed;

function byTheirId(command: TheirId) {
  return c => c.peer === command.theirId;
}

export type PeerEventHandler<T> = (message: PeerEvents<T>) => void;

export function createMessagingPeer<T>(mySuppliedId: string | undefined, serverParams) {
  const peer = new Peer(mySuppliedId, serverParams);
  let listeners: PeerEventHandler<T>[] = [];
  function emit(message: PeerEvents<T>) {
    listeners
      .forEach(listener => listener(message));
  }

  let myId: string;

  const dataConnections: DataConnection[] = [];

  function listenToDataConnection(conn: DataConnection) {
    dataConnections.push(conn);
    const theirId = conn.peer;
    emit({ type: 'ConnectingToPeer', myId, theirId });

    conn.on('open', function () {
      emit({ type: 'ConnectionOpen', myId, theirId });
    });

    conn.on('data', function (data: T) {
      emit({ type: 'PeerMessageReceived', myId, theirId, message: data });
    });

    conn.on('close', function () {
      emit({ type: 'ConnectionClosed', myId, theirId });
    });

    conn.on('error', (error) => {
      emit({ type: 'ConnectionError', error, myId, theirId });
    })
  }

  let mediaConnectons: MediaConnection[] = [];

  function listenToMediaConnection(call: MediaConnection) {
    const theirId = call.peer;
    mediaConnectons.push(call);

    call.on('stream', function (mediaStream) {
      emit({ type: 'CallAnswered', myId, theirId, mediaStream });
    });

    call.on('close', function () {
      mediaConnectons = mediaConnectons.filter(c => c !== call);
      console.log('removing media connection', mediaConnectons);
      emit({ type: 'CallEnded', myId, theirId });
    });

    call.on('error', (error) => {
      emit({ type: 'ConnectionError', error, myId, theirId });
    })
  }

  peer.on('open', (id) => {
    myId = id;
    emit({ type: "PeerOpen", myId });
  });

  peer.on('error', function (error) {
    emit({ type: 'PeerError', error, myId });
  });

  // rec connection from caller
  peer.on('call', call => {
    const theirId = call.peer;
    listenToMediaConnection(call);
    emit({ type: 'ReceivedCall', myId, theirId });
  });

  peer.on('connection', listenToDataConnection);

  return {
    // peer,
    async getId() {
      return waitFor(() => myId || null);
    },

    listen(cb: PeerEventHandler<T>) {
      listeners.push(cb);
      return () => {
        listeners = listeners.filter(l => l !== cb);
      }
    },

    dispatch(command: PeerCommands<T>) {
      switch (command.type) {
        case "DisconnectEverything": {
          peer.disconnect();
          break;
        }

        case "DisconnectData": {
          dataConnections.find(byTheirId(command))?.close();
          console.log('removing data connection', command.theirId, mediaConnectons);
          break;
        }

        case "DisconnectMedia": {
          mediaConnectons.find(byTheirId(command))?.close();
          console.log('removing media connection', command.theirId, mediaConnectons);
          break;
        }

        case "SendPeerMessage": {
          const connection = dataConnections.find(byTheirId(command));
          if (!connection) {
            console.error(command);
            throw new Error(`Data connection for ${command.theirId} does not exist.`);
          }
          connection.send(command.message);
          break;
        }

        case "AnswerCall": {
          const connection = mediaConnectons.find(byTheirId(command));
          if (!connection) {
            console.groupCollapsed('Media Connection Error');
            console.error(command, mediaConnectons);
            console.groupEnd();
            throw new Error(`Media connection for ${command.theirId} does not exist.`);
          }
          connection.answer(command.mediaStream);
          break;
        }

        case "ConnectToPeer": {
          const conn = peer.connect(command.theirId, { label: command.theirId, serialization: 'json' });
          listenToDataConnection(conn);
          break;
        }

        case "CallPeer": {
          const call = peer.call(command.theirId, command.mediaStream);
          listenToMediaConnection(call);
          break;
        }

        case "ChatRouletteFindPartner":
        {
          console.log("calling chat roulette.....")

          //just to test......
          // var request = ajaxRequestObject(); 
          axios({
            method: 'get',
            url: "https://skinhunger-peerserver.herokuapp.com/find?id=" + command.myId,
            responseType: 'text'
          })
            .then(function (response) {
              console.log("Got their id! :" + response.data);
            });
          // request.open("GET", url);
          // request.addEventListener("load", function()
          // { 
          //   if(request.readyState === 4)
          //   {
          //     if(request.status === 200)
          //     {
          //       let theirID = request.responseText;
          //       console.log("Got their id! :" + theirID);
          //     }
          //   }
          // });
          break;
        }
      }
    }
  }
}
