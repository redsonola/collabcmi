const { PeerServer } = require('peer');
const fs = require("fs");

const peerServer = PeerServer({
  debug: true,
  port: 9000,
  ssl: {
    key: fs.readFileSync('../snowpack.key'),
    cert: fs.readFileSync('../snowpack.crt')
  },
  path: '/peerServer'
});

let peerCount = 0;
peerServer.on('connection', (client) => {
  console.log('Peer connected, currently ', ++peerCount);
});
peerServer.on('disconnect', (client) => {
  console.log('Peer disconnected, currently ', --peerCount);
});
