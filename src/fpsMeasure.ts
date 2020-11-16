

export class FPSTracker
{
     times : number[] = [];
     fps : number = 0;

    constructor()
    {

    }

    refreshLoop() {
        //modified from here https://www.growingwiththeweb.com/2017/12/fast-simple-js-fps-counter.html
        const now = performance.now();
        while (this.times.length > 0 && this.times[0] <= now - 1000) {
            this.times.shift();
        }
        this.times.push(now);
        this.fps = this.times.length;
    }

    getFPS() : number
    {
        return this.fps; 
    }
}