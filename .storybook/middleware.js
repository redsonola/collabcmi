const fs = require("fs");
const { promisify } = require("util");
const path = require("path");
const bodyParser = require("body-parser");
const readdir = promisify(fs.readdir);
const writeFile = promisify(fs.writeFile);
require('../scripts/devPeerServer');

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

const expressMiddleWare = router => {
  router.use(bodyParser.urlencoded({ extended: false, limit: "4gb" }));

  router.use(bodyParser.json({ limit: "4gb" }));;

  router.post("/api/write-recording", async (req, res) => {
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
};


module.exports = expressMiddleWare;
