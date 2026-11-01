import { defineConfig } from 'vite';
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

// If local certs exist (created with `npm run mkcert`), serve over https so
// the webcam works when testing from another device on the network.
// On plain http://localhost the browser still allows camera access.
const certFile = path.join(root, 'localhost.pem');
const keyFile = path.join(root, 'localhost-key.pem');
const https =
  fs.existsSync(certFile) && fs.existsSync(keyFile)
    ? { cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) }
    : undefined;

export default defineConfig({
  plugins: [
    svelte({ preprocess: vitePreprocess() }),
    // Serve the @mediapipe/pose package at /mediapipe/pose/ (dev and build).
    // pose.js is a Closure-compiled classic script that attaches `Pose` to
    // `this`/window, so it is loaded with a plain <script> tag in index.html
    // rather than imported as a module. The wasm/model files next to it can
    // be used instead of the jsdelivr CDN (see locateFile in src/mediaPipePose.ts).
    // Note: the path must not start with /@ because Vite reserves that prefix.
    viteStaticCopy({
      targets: [{ src: 'node_modules/@mediapipe/pose/*', dest: 'mediapipe/pose', rename: { stripBase: true } }],
    }),
  ],
  server: {
    port: 8080,
    https,
    open: false,
  },
  preview: {
    port: 8080,
    https,
  },
  build: {
    outDir: 'build',
    target: 'es2020',
    sourcemap: true,
  },
});
