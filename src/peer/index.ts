import Peer from 'peerjs';
import { peerServerParams } from "../peerJs";
import { writable, Writable } from 'svelte/store';

const log = console.log.bind('PeerConnections');

export class PeerConnections
{
  peer: Peer;
  myId: string | undefined;
  dataPeerIds: string[] = [];
  dataPeerIdsStore: Writable<string[]>;

  mediaPeerIds: string[] = [];
  mediaPeerIdsStore: Writable<string[]>;

  constructor()
  {
    this.peer = new Peer(this.myId, peerServerParams);
    this.peer.on('open', id => this.setMyId(id));
    this.dataPeerIdsStore = writable(this.dataPeerIds);
    this.mediaPeerIdsStore = writable(this.mediaPeerIds);
  }

  private updateMediaPeerIds () {
    this.mediaPeerIdsStore.set(this.mediaPeerIds);
  }

  // resetMediaPeerIds()
  // {
  //   log('resetMediaPeerIds');
  //   this.mediaPeerIds = [];
  //   this.updateMediaPeerIds();
  // }

  removeMediaPeerId(id: string)
  {
    log('removeMediaPeerId', id);
    this.mediaPeerIds = this.mediaPeerIds.filter((id) => id !== id);
    this.updateMediaPeerIds();
  }

  addMediaPeerId(id: string)
  {
    if (!this.mediaPeerIds.includes(id))
    {
      log('addMediaPeerId', id);
      this.mediaPeerIds.push(id); //so that other things work -- plugging the hole in the dam. -CDB
      this.updateMediaPeerIds();
    } else
    {
      log('addMediaPeerId, but it was already added', id);
    }
  }


  private updateDataPeerIds () {
    this.dataPeerIdsStore.set(this.dataPeerIds);
  }

  resetDataPeerIds()
  {
    log('resetDataPeerIds');
    this.dataPeerIds = [];
    this.updateDataPeerIds();
  }

  removeDataPeerId(id: string)
  {
    log('removeDataPeerId', id);
    this.dataPeerIds = this.dataPeerIds.filter((id) => id !== id);
    this.updateDataPeerIds();
  }

  addDataPeerId(id: string)
  {
  {
    if (!this.dataPeerIds.includes(id))
    {
      log('addDataPeerId', id);
      this.dataPeerIds.push(id); //so that other things work -- plugging the hole in the dam. -CDB
      this.updateDataPeerIds();
    } else
    {
      log('addDataPeerId, but it was already added', id);
    }
  }
  }

  setMyId(id: string)
  {
    log("setMyId", id);
    this.myId = id;
  }
}