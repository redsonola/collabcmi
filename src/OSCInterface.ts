// Courtney Brown, July 2021
// These are functions to send OSC to a port on localhost. Used for prototyping sound in Max 8 
// To use, you must run the file recording server. That's how it goes.
// npm run file-recording-server

import axios from 'axios'; //TODO: https://github.com/axios/axios


export function initOSC()
{
  fetch(`/api/init-osc`);
}

//ok, will change later, but actually doesn't use the address. 
export function sendOSC(addr: string, arg:number)
{
  axios({
    method: 'get',
    url: "https://localhost:3000/send-osc?argument=" + arg,
    responseType: 'text'
  })
    .then(function (response) {

    })
    .catch(function (error) {
      // handle error
      console.log(error);
      console.log("error"); 
      return null;
    });
}