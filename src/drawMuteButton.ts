// https://codepen.io/duhaime/pen/jaYdLg
import * as THREE from 'three';

export class MuteButton
{
  loader : THREE.TextureLoader[];
  material : THREE.MeshLambertMaterial[];
  geometry : THREE.PlaneGeometry;
  mesh : THREE.Mesh;
  x : number; 
  y : number;
  z : number; 
  selected : number = 0; 

  constructor(){

    this.loader = [new THREE.TextureLoader(), new THREE.TextureLoader()];

// Load an image file into a custom material
    this.material = [
      new THREE.MeshLambertMaterial({ map: this.loader[0].load('./icons/noun_mic_283245.png'), opacity: 1}), 
      new THREE.MeshLambertMaterial({ map: this.loader[1].load('./icons/noun_Mute_2692102.png'), opacity: 1})  ];

    this.geometry = new THREE.PlaneGeometry(10, 10*.75);

    this.mesh = new THREE.Mesh(this.geometry, this.material[this.selected]);
    this.mesh.position.set(0.5,0.5,2);
  }

  setPosition( x:number, y: number, z:number )
  {
    this.mesh.position.set(x, y, z); 
    this.x = x; 
    this.y = y; 
    this.z = z; 
  }

  getMesh() : THREE.Mesh
  {
    return this.mesh; 
  }

  muted( mute: boolean )
  {
    let prev : number = this.selected; 
    if( mute )
    {
      this.selected = 1; 
    } 
    else
    {  
      this.selected = 0;
    }

    if( prev !== this.selected )
    {
      this.mesh = new THREE.Mesh(this.geometry, this.material[this.selected]);
      this.mesh.position.set(this.x,this.y,this.z)
    }
  }

}
