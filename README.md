# collabcmi

Using nvm as a package manager. 
First Install nvm (node version manager)

https://github.com/nvm-sh/nvm#install--update-script

nvm install 15.1.0

Install mkcert
eg. on OS X -- brew install mkcert
If you have homebrew, which I recommend. 

Then, on the command-line:
npm install

npm run mkcert

Then, to run/build:
npm run start

Main js file is: App2.svelte

participant.js: holds all the synchroncity measures and data for each participant. Only the calling participant (participant) has the synch info. 

Note: Currently, it still has all the code for my audiovisual instrument so it will play a bit of music when it is opened if you move enough.

Note: There is an old main.js file but that is depreciated. & no longer used.

Brent has been using storybook to do prototyping, so if you like that:

npm run storybook

will run the the storybook files and you can use that.

if you run

./scripts/deploy.sh

It will deploy to spacebetween.courtney-brown.net. 

Probably we should get a separate web space, tho, for this project, since I am using that for my audiovisual instrument. But -- if you wanted to test something actually on the internet instead of localhost/network.



