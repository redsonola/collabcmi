# collabcmi

> ✨ Bootstrapped with Create Snowpack App (CSA).

## Available Scripts

### npm start

Runs the app in the development mode.
Open https://localhost:8080 to view it in the browser.
If this is your first time running it, you'll need to run `npm run mkcert` to create
& install the local ssl certificates.

The page will reload if you make edits.
You will also see any lint errors in the console.

### npm run build

Builds a static copy of your site to the `build/` folder.
Your app is ready to be deployed!

### npm run test-build

Reinstalls the dependencies and builds the same way that the production pipeline does. 
Runs a static server using the same snowpack certs that are used in dev.

**For the best production performance:** Add a build bundler plugin like [@snowpack/plugin-webpack](https://github.com/snowpackjs/snowpack/tree/main/plugins/plugin-webpack) or [snowpack-plugin-rollup-bundle](https://github.com/ParamagicDev/snowpack-plugin-rollup-bundle) to your `snowpack.config.json` config file.

### Q: What about Eject?

No eject needed! Snowpack guarantees zero lock-in, and CSA strives for the same.

## Dependencies

### NodeJS

NPM version 6.* or 7.1.2 or greater (or less than 7 -- [Husky](https://www.npmjs.com/package/husky) doesn't work with npm 7.0.0 to 7.1.1)

### Using nvm as a package manager. 

If on Windows, use (& follow instructions here): https://github.com/coreybutler/nvm-windows
Update: apparently better to just use from nodejs website:https://nodejs.org/en/
Apparently: https://chocolatey.org is the Windows version of homebrew.

First Install nvm (node version manager)

https://github.com/nvm-sh/nvm#install--update-script

nvm install 15.1.0 //only on OS X. It should come with windows install.

### Install mkcert
eg. on OS X -- brew install mkcert
If you have homebrew, which I recommend. 

For windows, instructions here:
https://github.com/FiloSottile/mkcert

Then, on the command-line:

npm install

npm run mkcert

Then, to run/build:

npm run start


## Code

Main js file is: '/components/App2.svelte'. 
goLoop(async ()) -- is the main update function, calling the keypointsUpdated() function. In keypointsUpdated, motion analysis measures get updated & inside also the three?.dispatch(etc. etc.) is calling the threejs drawing code.

drawthreejs.ts has drawing code & also in the folder /threejs has more drawing code (eg. for skeleton & video)

participant.ts: holds all the synchroncity measures and data for each participant. Only the calling participant (participant) has the synch info. 

Note: Currently, it still has all the code for my audiovisual instrument so it will play a bit of music when it is opened if you move enough.

Note: There is an old main.js file but that is depreciated. & no longer used.

if you run

./scripts/deploy.sh

It will deploy to spacebetween.courtney-brown.net. You'll need an aws key to deploy, so just let me when you're ready to do that. 

Probably we should (well, we will) get a separate web space / aws acct, tho, for this project, since I am using that for my audiovisual instrument. But -- if you wanted to test something actually on the internet instead of localhost/network.



