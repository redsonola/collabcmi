
const fs = require("fs");
const { promisify } = require("util");
const path = require("path");
const bodyParser = require("body-parser");
const readdir = promisify(fs.readdir);
const writeFile = promisify(fs.writeFile);
const express = require("express");
// require('../scripts/devPeerServer');
var https = require('https');
const OSC = require('osc-js');

const app = express();


// API for files
const recordingsDir = path.resolve(path.join("public", "recordings"));
const recordingsListFile = path.resolve(path.join("src", "stories", "recordingFileList.json"));

const safeFileName = str => {
  if (!str) return;
  const sanatized = str.match(/\w+/g)?.join('__');
  return sanatized
    ? sanatized + '.json'
    : null;
}

async function updateFileList() {
  const files = await readdir(recordingsDir);
  const filteredFiles = files.filter(file => file.endsWith(".json"));
  console.log('updating file list', files);
  await writeFile(
    recordingsListFile,
    JSON.stringify(filteredFiles, null, " ")
  );
  console.log('updated file list');
  return filteredFiles;
}
updateFileList();

let osc; 
function oscForMax()
{
  const options = {
    open: {
      port: 9988
    }
  };
  osc = new OSC({ plugin: new OSC.DatagramPlugin(options) });
  osc.open();
}
oscForMax(); 
osc?.send( new OSC.Message( "/testMessage"), { port: 8998 } ); 


app.post("/api/init-osc", () => {
  console.log( "osc initialized" ); 
});

app.use(bodyParser.urlencoded({ extended: false, limit: "4gb" }));

app.use(bodyParser.json({ limit: "4gb" }));;

app.post("/api/write-recording", async (req, res) => {
	let fileName = safeFileName(req.query.filename) || Date.now() + ".json";
	const data = JSON.stringify(req.body);

	try {
		await writeFile(path.join(recordingsDir, fileName), data);
		const filteredFiles = await updateFileList();
		res.json(filteredFiles);
	} catch (ex) {
		res.send(err);
	}
});

app.post("/api/send-osc", async (req, res) => {
  osc?.send( new OSC.Message( '/verticalityCorr', req.query.argument), { port: 8998 } ); 
  console.log( "sending......." ); 
  res.send("OK"); 
});

app.get("/send-osc", function(httpRequest, httpResponse, next)
{ 
  osc?.send( new OSC.Message( httpRequest.query.addr, httpRequest.query.argument), { port: 8998 } ); 
  console.log("sending the OSC message....");
  httpResponse.send(true);
});


const cert = fs.readFileSync('./snowpack.crt');
const key = fs.readFileSync('./snowpack.key');

https.createServer({ cert, key }, app)
	.listen(3000, (...args) => {
		console.log('server started', ...args);

	});

