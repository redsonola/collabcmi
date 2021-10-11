import type Peer from 'peerjs';
import axios from 'axios'; //TODO: https://github.com/axios/axios

// const REACT_APP_PEER_SERVER_HOST = "spacebtw-peerserver.herokuapp.com";
// const REACT_APP_PEER_SERVER_PORT = "443";
// const REACT_APP_PEER_SERVER_PATH = "/";

const REACT_APP_PEER_SERVER_HOST = "skinhunger-telematic-install.herokuapp.com";
const REACT_APP_PEER_SERVER_PORT = "443";
const REACT_APP_PEER_SERVER_PATH = "/signaling";

// const REACT_APP_PEER_SERVER_HOST = "localhost";
// const REACT_APP_PEER_SERVER_PORT = "9000";

//TODO: will need to make the express server secure
export const peerServerParams: Peer.PeerJSOption = {
  host: REACT_APP_PEER_SERVER_HOST || window.location.hostname,
  port: REACT_APP_PEER_SERVER_PORT ? parseInt(REACT_APP_PEER_SERVER_PORT) : 9000,
  path: REACT_APP_PEER_SERVER_PATH || "/",
  secure: true,

  // secure: true,
  // iceTransportPolicy: "relay"
};

//TODO we: receive the disconnect event and try to reconnect when that happens or have some UI about asking user what to do.

//just gonna have to ignore this framework... -- this is called to find a chat partner
export function findChatRoulettePartner(myId: string): Promise<string | null>
{
  console.log("calling chat roulette.....")

  return axios({
    method: 'get',
    url: "https://skinhunger-telematic-install.herokuapp.com/find?id=" + myId,
    responseType: 'text', 
    proxy:false,
  })

    .then(function (response) {
      const theirID = response.data;
      console.log("Got their id! :" + theirID);
      return theirID;
    })

    .catch(function (error) {
      // handle error
      console.log(error);
      return null;
    });
}
