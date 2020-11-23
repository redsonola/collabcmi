# collabcmi

Using nvm as a package manager. 

If on Windows, use: https://github.com/coreybutler/nvm-windows

First Install nvm (node version manager)

https://github.com/nvm-sh/nvm#install--update-script

nvm install 15.1.0

Install mkcert
eg. on OS X -- brew install mkcert
If you have homebrew, which I recommend. 

For windows, instructions here:
https://github.com/FiloSottile/mkcert

Then, on the command-line:

npm install

npm run mkcert

Then, to run/build:

npm run start

Main js file is: '/components/App2.svelte'. 
goLoop(async ()) -- is the main update function, calling the keypointsUpdated() function. In keypointsUpdated, motion analysis measures get updated & inside also the three?.dispatch(etc. etc.) is calling the threejs drawing code.

drawthreejs.ts has drawing code & also in the folder /threejs has more drawing code (eg. for skeleton & video)

participant.ts: holds all the synchroncity measures and data for each participant. Only the calling participant (participant) has the synch info. 

Note: Currently, it still has all the code for my audiovisual instrument so it will play a bit of music when it is opened if you move enough.

Note: There is an old main.js file but that is depreciated. & no longer used.

Brent has been using storybook to do prototyping, so if you like that:

npm run storybook

will run the the storybook files and you can use that.

if you run

./scripts/deploy.sh

It will deploy to spacebetween.courtney-brown.net. 

Probably we should (will) get a separate web space, tho, for this project, since I am using that for my audiovisual instrument. But -- if you wanted to test something actually on the internet instead of localhost/network.



