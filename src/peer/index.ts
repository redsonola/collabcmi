import Peer from 'peerjs';
import { peerServerParams } from "../peerJs";
import { writable, Writable } from 'svelte/store';

const log = console.log.bind(console, 'PeerConnections');

export class PeerIds
{
  ids: string[] = [];
  idsStore: Writable<string[]>;
  type: 'data' | 'media';

  constructor(type: 'data' | 'media')
  {
    this.type = type;
    this.idsStore = writable(this.ids);
  }

  private updatePeerIds()
  {
    this.idsStore.set(this.ids);
  }

  resetPeerIds()
  {
    log('resetPeerIds', this.type);
    this.ids = [];
    this.updatePeerIds();
  }

  removePeerId(id: string)
  {
    log('removePeerId', this.type, id);
    this.ids = this.ids.filter((id) => id !== id);
    this.updatePeerIds();
  }

  addPeerId(id: string)
  {
    {
      if (!this.ids.includes(id))
      {
        log('addPeerId', this.type, id);
        this.ids.push(id); //so that other things work -- plugging the hole in the dam. -CDB
        this.updatePeerIds();
      } else
      {
        log('addPeerId, but it was already added', this.type, id);
      }
    }
  }

}

export class PeerConnections
{
  peer: Peer;
  myId: string | undefined;
  dataPeerIds = new PeerIds('data');
  mediaPeerIds = new PeerIds('media');

  constructor()
  {
    this.peer = new Peer(this.myId, peerServerParams);
    this.peer.on('open', id => this.setMyId(id));
  }

  setMyId(id: string)
  {
    log("setMyId", id);
    this.myId = id;
  }
}