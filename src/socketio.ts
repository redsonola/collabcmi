import io from 'socket.io-client';
import { getLogger } from './logger';

const logger = getLogger('socketio');
const socket = io("wss://localhost:9000");

(window as any).socket = socket;

// export function makeToken(room: string)
// {
//   logger.log('getToken', { room, socket });

//   // join the "room" -- that means that the tokens etc. will be sent
//   // to other ppl who join that room.
//   socket.on('on ready', (e) =>
//   {
//     logger.log('ready to call', e)
//   });

//   socket.on('token', (token) =>
//   {
//     logger.log('on token', token);
//   });

//   socket.emit('join', room);
//   socket.emit('token');
// }

/**
 * fetch the list of turn servers from the server, return it in a Promise.
 * This whole thing actually didn't need to use a websocket, that was way
 * more complicated than it needed to be but hey
 * now the project has a websocket setup!
 * @returns 
 */
export function getIceServers(): Promise<RTCIceServer[]>
{
  logger.log('getIceServers');

  return new Promise((pass) =>
  {
    socket.once('token', (token) =>
    {
      // logger.log('getIceServers got them', token.iceServers);
      pass(token.iceServers);
    });
    socket.emit('token');
  })
}

// ice();

/**
 * next: send token to other person
 * then: use tokens in call
 */