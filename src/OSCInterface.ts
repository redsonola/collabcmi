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

export function fixSci( arg:number )
{
  if( arg < 0.0001 )
  {
    return 0; //don't send things in sci. notation. just say its 0. hack hack ahck
  }
  else if( isNaN(arg) )
  {
    return 0;
  }
  else
  {
    return arg; 
  }
}

//ok, will change later, but actually doesn't use the address. 
// export function sendOSC(addr: string, arg:number)
export function sendOSC(
  verticalityCorr: number,
  touchVelocity:number,
  touchXPos: number,
  touchYPos:number,
  localParticipant_jerk:number,
  touchPointCorrelation:number,
  howLongTouch:number,
  self_noseX:number,
  self_noseY:number,
  friend_noseX:number,
  friend_noseY:number,
  combinedDxDy:number,
  synchScore:number,
  howLongTouchScaled : number, 
  maxTouchingDx : number
)
{
  // if( arg < 0.0001 )
  // {
  //   arg = 0; //don't send things in sci. notation. just say its 0. hack hack ahck
  // }
  // else if( isNaN(arg) )
  // {
  //   return;
  // }

  if(! connectionRefused)
  {
    let t = fixSci( howLongTouch )
    try {
      axios.post("https://localhost:3000/send-osc", 
      {
        verticalityCorr: fixSci( verticalityCorr ),
        touchVelocity: fixSci( touchVelocity ),
        touchXPos:  fixSci( touchXPos ),
        touchYPos: fixSci( touchYPos ),
        localParticipant_jerk: fixSci( localParticipant_jerk ),
        touchPointCorrelation: fixSci( touchPointCorrelation ),
        howLongTouch: fixSci( howLongTouch ),
        self_noseX: fixSci( self_noseX ),
        self_noseY: fixSci( self_noseY ),
        friend_noseX: fixSci( friend_noseX ),
        friend_noseY: fixSci( friend_noseY ),
        combinedDxDy: fixSci( combinedDxDy ),
        synchScore: fixSci( synchScore ),
        howLongTouchScaled: fixSci( howLongTouchScaled ), 
        maxTouchingDx: fixSci( maxTouchingDx )
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

    // try {
    //   axios({
    //     method: 'get',
    //     url: "https://10.8.124.132:3000/send-osc?addr=" + addr + "&argument=" + arg,
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
}
