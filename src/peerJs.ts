import type { PeerJSOption } from 'peerjs';
import axios from 'axios'; //TODO: https://github.com/axios/axios
import { getLogger } from './logger';

const logger = getLogger('peerJs.ts');

// const REACT_APP_PEER_SERVER_HOST = "spacebtw-peerserver.herokuapp.com";
// const REACT_APP_PEER_SERVER_PORT = "443";
// const REACT_APP_PEER_SERVER_PATH = "/";

const REACT_APP_PEER_SERVER_HOST = "skinhunger-telematic-install.herokuapp.com";
const REACT_APP_PEER_SERVER_PORT = "443";
const REACT_APP_PEER_SERVER_PATH = "/signaling";

const REACT_APP_CYCLING_SERVER = "https://skinhunger-telematic-install.herokuapp.com";
// const REACT_APP_CYCLING_SERVER = "http://localhost:9000";

// const REACT_APP_PEER_SERVER_HOST = "https://192.168.1.4";
// const REACT_APP_PEER_SERVER_PORT = "9000";

//TODO: will need to make the express server secure
export const peerServerParams: PeerJSOption = {
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
  logger.log("calling chat roulette.....")

  return axios({
    method: 'get',
    url: `${REACT_APP_CYCLING_SERVER}/connectAndCycle?id=${myId}`,
    responseType: 'text',
    proxy: false,
  })

    .then(function (response)
    {
      const theirID = response.data;
      let id: string = "" + theirID;
      logger.log("Got their id! :" + theirID);
      if (id !== "-1")
      {
        return "" + theirID;
      }
      else return null;
    })

    .catch(function (error)
    {
      // handle error
      // logger.log(error);
      return null;
    });
}

//just gonna have to ignore this framework... -- this is called to find a chat partner
export function updateConnection(myId: string): Promise<string | null>
{
  logger.log("updating connection....." + myId)

  return axios({
    method: 'get',
    url: `${REACT_APP_CYCLING_SERVER}/updateConnection?id=${myId}`,
    responseType: 'text',
    proxy: false,
  })

    .then(function (response)
    {
      const theirID = response.data;
      let id: string = "" + theirID;
      if (id !== "-1")
      {
        logger.log("Got their id! :" + theirID);
        return "" + theirID;
      }
      else return null;
    })

    .catch(function (error)
    {
      // handle error
      // logger.log(error);
      return null;
    });
}

export function disconnectID(myId: string): Promise<string | null>
{
  logger.log("disconnecting ID.....")

  return axios({
    method: 'get',
    url: `${REACT_APP_CYCLING_SERVER}/disconnectId?id=${myId}`,
    responseType: 'text',
    proxy: false,
  })

    .then(function (response)
    {
      const theirID = response.data;
      let id: string = theirID as string;
      logger.log("Got their id! :" + theirID);

      if (id !== "-1")
      {
        return theirID as string;
      }
      else return null;
    })

    .catch(function (error)
    {
      // handle error
      // logger.log(error);
      return null;
    });
}

export function getIceServers(): Promise<RTCIceServer[]>
{
  logger.log("getIceServers");

  return axios({
    method: 'get',
    url: `${REACT_APP_CYCLING_SERVER}/ice-servers`,
    responseType: 'json',
    proxy: false,
  }).then(res =>
  {
    logger.log('getIceServers res', res, res.data);
    return res.data as RTCIceServer[];
  });
}
