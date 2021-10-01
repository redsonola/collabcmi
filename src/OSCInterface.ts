// Courtney Brown, July 2021
// These are functions to send OSC to a port on localhost. Used for prototyping sound in Max 8 
// To use, you must run the file recording server. That's how it goes.
// npm run file-recording-server

import axios from 'axios'; //TODO: https://github.com/axios/axios


export function initOSC()
{
  // fetch(`/api/init-osc`);

  // try {
  //   axios({
  //     method: 'get',
  //     url: "https://localhost:3000/api/init-osc",
  //     proxy:false,
  //   })
  //     .then(function (response) {
  //       console.log("osc initialized"); 
  //     })
  //     .catch(function (error) {
  //       // handle error
  //       console.log(error);
  //       console.log("error with init osc"); 
  //       return null;
  //     });
  //   }
  //   catch(e)
  //   {
  //     connectionRefused = true; 
  //     console.log(e);
  //     console.log("Turning off OSC sending");
  //   }

}

let connectionRefused : boolean = false; 

//ok, will change later, but actually doesn't use the address. 
export function sendOSC(addr: string, arg:number)
{
  if( arg < 0.0001 )
  {
    arg = 0; //don't send things in sci. notation. just say its 0. hack hack ahck
  }
  else if( isNaN(arg) )
  {
    return;
  }

  // if(! connectionRefused)
  // {
    // try {
    //   axios({
    //     method: 'post',
    //     url: "https://10.8.124.132:3000/send-osc",
    //     responseType: 'text', 
    //     proxy: false
    //   })
    //     .then(function (response) {

    //     })
    //     .catch(function (error) {
    //       // handle error
    //       connectionRefused = true; 
    //       console.log(error);
    //       console.log("error"); 
    //       return null;
    //     });
    //   }
    //   catch(e)
    //   {
    //     connectionRefused = true; 
    //     console.log(e);
    //     console.log("Turning off OSC sending");
    //   }
  // }

    try {
      axios({
        method: 'get',
        url: "https://10.8.124.132:3000/send-osc?addr=" + addr + "&argument=" + arg,
        responseType: 'text', 
        proxy: false
      })
        .then(function (response) {

        })
        .catch(function (error) {
          // handle error
          connectionRefused = true; 
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
