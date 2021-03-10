// import '@tensorflow/tfjs-backend-webgl';
// import '@tensorflow/tfjs-backend-cpu';

import { Buffer } from "buffer";
import App from "./components/App.svelte";

(window as any).Buffer = Buffer;


const app = new App({
	target: document.body,
});

export default app;
