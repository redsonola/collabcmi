const { PeerServer } = require('peer');
const fs = require("fs");

const peerServer = PeerServer({
  debug: true,
  port: 9000,
  ssl: {
    key: fs.readFileSync('./localhost-key.pem'),
    cert: fs.readFileSync('./localhost.pem')
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
