import { Buffer } from "buffer";
import { mount } from "svelte";
import App from "./components/App.svelte";

// Some audio/midi libraries expect a Node-style global Buffer.
(window as any).Buffer = Buffer;

const app = mount(App, {
	target: document.body,
});

export default app;
