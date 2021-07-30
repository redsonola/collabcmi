// Courtney Brown, July 2021
// These are functions to send OSC to a port on localhost. Used for prototyping sound in Max 8 
// To use, you must run the file recording server. That's how it goes.
// npm run file-recording-server

import axios from 'axios'; //TODO: https://github.com/axios/axios


export function initOSC()
{
  fetch(`/api/init-osc`);
}

let connectionRefused : boolean = false; 

//ok, will change later, but actually doesn't use the address. 
export function sendOSC(addr: string, arg:number)
{
  if( arg < 0.0001 )
  {
    arg = 0; //don't send things in sci. notation. just say its 0. hack hack ahck
  }

  if(! connectionRefused)
  {
    try {
      axios({
        method: 'get',
        url: "https://localhost:3000/send-osc?addr=" + addr + "&argument=" + arg,
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
      catch(e)
      {
        connectionRefused = true; 
        console.log(e);
        console.log("Turning off OSC sending");
      }
  }
}