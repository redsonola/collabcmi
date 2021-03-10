const preprocess = require('svelte-preprocess')();
const nodePolyfills = require('rollup-plugin-node-polyfills');

/** @type {import("snowpack").SnowpackUserConfig } */
module.exports = {
  mount: {
    "node_modules/@mediapipe/pose": { url: "/@mediapipe/pose", static: true, resolve: false },
    public: { url: '/', static: true, resolve: false },
    src: '/dist',
  },
  plugins: [
    ['@snowpack/plugin-svelte', {
      preprocess: {
        ...preprocess,
        scss: { includePaths: ['theme'] }
      }
    }],
    '@snowpack/plugin-typescript',
    '@snowpack/plugin-sass'
  ],
  routes: [
    /* Enable an SPA Fallback in development: */
    { "match": "routes", "src": ".*", "dest": "/index.html" },
  ],
  optimize: {
    /* Example: Bundle your final build: */
    // "bundle": true,
  },
  packageOptions: {
    polyfillNode: true,
    env: {
      REACT_APP_PEER_SERVER_HOST: "spacebtw-peerserver.herokuapp.com",
      REACT_APP_PEER_SERVER_PORT: "443",
      REACT_APP_PEER_SERVER_PATH: "/"
      // REACT_APP_PEER_SERVER_HOST: true,
      // REACT_APP_PEER_SERVER_PORT: true,
      // REACT_APP_PEER_SERVER_PATH: true
    }
    // knownEntrypoints: [
    //   "@tensorflow/tfjs-backend-webgl"
    // ]
    /* ... */
  },
  devOptions: {
    open: "none",
    output: "stream",
  },
  buildOptions: {
    /* ... */
  },
};

