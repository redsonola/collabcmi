# collabcmi / Skin Hunger

Networked, pose-tracking audiovisual installation. Two participants connect over
WebRTC (PeerJS), their poses are tracked in the browser with MediaPipe Pose, and
synchrony between them drives three.js visuals and Tone.js music.

Updated October 2026: the build moved from Snowpack (unmaintained) to
[Vite](https://vite.dev), Svelte 3 to Svelte 5, TypeScript 4 to 5.

## Requirements

- Node.js 20.19+ (tested with Node 25). https://nodejs.org or `nvm install --lts`
- A browser with webcam access. Camera access works on `http://localhost`
  without HTTPS. HTTPS (see mkcert below) is only needed when opening the dev
  server from another device on your network.

## Available scripts

### `npm install`

Installs dependencies.

### `npm start` (or `npm run dev`)

Runs the app in development mode at http://localhost:8080 with hot reloading.
If `localhost.pem` / `localhost-key.pem` exist in the project root the server
uses HTTPS instead (https://localhost:8080).

### `npm run build`

Builds a static copy of the site into `build/`. This is what `scripts/deploy.sh`
uploads.

### `npm run preview`

Serves the contents of `build/` locally on port 8080, the same way the production
server would. `npm run test-build` does a clean install, build and preview.

### `npm run check`

Runs `svelte-check` (TypeScript type checking for `.ts` and `.svelte` files).
There are a handful of long-standing type complaints that do not affect running
the app.

### `npm run mkcert` (optional, for HTTPS)

Needs [mkcert](https://github.com/FiloSottile/mkcert) (`brew install mkcert` on
macOS). Creates and trusts `localhost.pem` / `localhost-key.pem`, which both the
Vite dev server and the helper servers below pick up automatically.

### `npm run peer-server` / `npm run file-recording-server`

Optional local helper servers (a local PeerJS signaling server and a server that
saves pose recordings). Both need the mkcert certificates above. By default the
app uses the hosted signaling server configured in `src/peerJs.ts`.

### `npm run deploy`

Builds and syncs `build/` to S3 / CloudFront. Needs AWS credentials.

## Code

Main component is `src/components/App.svelte` (router) and
`src/components/App2.svelte` (the installation itself).
`goLoop(async ())` is the main update function, calling `keypointsUpdated()`.
In `keypointsUpdated`, motion analysis measures get updated and `three?.dispatch(...)`
calls the three.js drawing code.

- `src/draw3js.ts` and `src/threejs/` hold the drawing code (skeleton, video).
- `src/participant.ts` holds the synchrony measures and data for each participant.
  Only the calling participant has the synch info.
- `src/mediaPipePose.ts` wraps MediaPipe Pose. `pose.js` is loaded as a classic
  `<script>` in `index.html` (it defines `window.Pose`), and the package's
  wasm/model files are served at `/mediapipe/pose/` by `vite.config.ts`. By
  default the model files are fetched from the jsdelivr CDN; switch the
  `locateFile` in `src/mediaPipePose.ts` to use the local copy instead.
- `src/main.js` is an old, deprecated entry point. Only `findRadiusOfKeypoint`
  is still used from it.

### Sound levels

The master gain is set in `MainVolume` (`src/midiConversion.js`). The volume
slider (0 to 0.75) maps onto `MASTER_MIN_DB`..`MASTER_MAX_DB` (currently -60 dB
to +10 dB), and a `Tone.Limiter` at `LIMITER_THRESHOLD_DB` (-1 dBFS) sits just
before the output. The summed instruments peak around +9 dBFS *before* the
master gain, so the old ceiling of +40 dB (+6 dB at the default slider
position) hard-clipped the output and sounded scratchy. Raise `MASTER_MAX_DB`
for a louder default; the limiter prevents clipping but will start to pump if
pushed far above 0 dB.

### Microphone controls

Once a call is connected, each video gets a round Zoom-style button under its
corner (`.muteButton` in `App2.svelte`; the slashed icon means muted). Yours
mutes your microphone by disabling the local audio track, so the other
participant receives silence, and it sends the `Mute` data-channel message so
their icon updates. The other button mutes the remote participant's playback
on your side only. Your own microphone is never played back locally: the local
webcam element is muted, and the remote participant's store
(`videoSubscription(null)`) no longer opens a second webcam. The button size is
duplicated in `draw3js.ts` (`MUTE_BUTTON_SIZE_PX`) for positioning.

### Layout

The videos are scaled up as far as the window allows while staying between two
reserved strips, so they never sit under the HTML controls:
`CONTROLS_RESERVE_TOP_PX` (music panel, call panel), `CONTROLS_RESERVE_BOTTOM_PX`
(mute buttons above the links) and `CONTROLS_SIDE_MARGIN_PX` in `src/draw3js.ts`
(see `fitContent` in `createOrthographicCamera.ts`). If you add taller controls
at the top or bottom, raise those numbers. The fit is recomputed when a video is
added, not on window resize.

### Phones

`App2.svelte` picks one of three layouts (`layoutMode`) and re-picks it on
resize or rotation: `desktop`, `portrait` (a phone held upright) or `landscape`
(a phone held sideways). A phone is a touch screen whose short side is 600px or
less. Add `?layout=portrait`, `?layout=landscape` or `?layout=desktop` to the
URL to try one on a computer.

- **Portrait:** the two videos overlap on a diagonal, and the music slider, mic,
  mute-partner and end-call buttons sit in a bottom bar. While waiting alone the
  bar becomes an invite sheet (copy link, random partner).
- **Landscape:** the videos overlap side by side as on desktop, with the music
  slider on top, mute buttons in a left rail, end call in a right rail, and the
  invite panel on the right while waiting alone.
- **Dragging:** videos move with a mouse or a finger (pointer events). On a
  phone the page never scrolls or zooms. Phone drags stay on that phone, and
  phones ignore the other person's `MoveVideo` messages.
- The layouts are fitted in `src/draw3js.ts` (`setLayout`, `layoutVideos`,
  `reserveFor`). If you change the height of the phone controls, update the
  reserved pixels there.

### Dependency notes

- `three` is pinned to 0.120.1. The creature code in `src/PByte3/` and
  `src/Organism01.ts` uses `THREE.Geometry` and the `*BufferGeometry` classes,
  which were removed in later three.js releases. Upgrading three requires
  porting that code to `BufferGeometry`.
- The audio stack is pinned to the exact versions the piece was composed
  against: `tone` 14.7.77, `@tonejs/midi` 2.0.27, and (via `overrides` in
  `package.json`) `standardized-audio-context` 25.2.7, `automation-events` 4.0.2
  and `midi-file` 1.1.2. Tone 14.9.17 and the newer MIDI parser were tested and
  parse the MIDI files identically, but the pins keep playback behavior
  identical to the 2021 build. Remove the pins and overrides to try newer
  versions.
- `yrv` (router) declares a Svelte 3 peer dependency but works with Svelte 5;
  `package.json` has an `overrides` entry for it.
- `@tensorflow-models/posenet` / `@tensorflow/tfjs` are only used for their
  types and the optional PoseNet fallback in `src/threejs/posenetcopy.ts`.
