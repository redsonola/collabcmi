// This class supports development
// of an 'independent' softbody organism.
// Project is being produced in collaboration with
// Courtney Brown, Melanie Clemmons & Brent Brimhall

// Creates Euler Tendrils - motion/springin based on speed

import * as THREE from 'three';
import { EulerNode } from './EulerNode';
import { EulerStick } from './EulerStick';
import { addVertToPositions } from './VerletNode'; //lol

//const tendrilCount: number = 20;
export class EulerStrand extends THREE.Group {
    public head: THREE.Vector3
    public tail: THREE.Vector3
    segmentCount: number;
    segments: EulerStick[];
    nodes: EulerNode[];
    // controls anchor ponts along strand
    //private anchorPointDetail: AnchorPoint;
    // controls spring tension between adjacent nodes
    elasticity: number;
    damping: number
    geometry = new THREE.BufferGeometry();
    material = new THREE.MeshBasicMaterial({ color: 0xffffff, });
    public tendril: THREE.Line;
    vertices : THREE.Vector3[] = []; 
    positions : Float32Array; 



    constructor(head: THREE.Vector3, tail: THREE.Vector3, segmentCount: number, elasticity: number = .5, damping: number = .725) {
        super();
        this.head = head;
        this.tail = tail;
        this.segmentCount = segmentCount;
        this.segments = new Array(segmentCount);
        this.nodes = new Array(segmentCount + 1);
        //  this.anchorPointDetail = anchorPointDetail;
        this.elasticity = elasticity;
        this.damping = damping;
        // encapsulaes stick data
        this.tendril = new THREE.Line();



        // local vars for segment calcuations
        let deltaVec = new THREE.Vector3();
        // get chain vector
        deltaVec.subVectors(this.tail, this.head);
        let chainLen = deltaVec.length();
        // get chain segment length
        let segLen = chainLen / this.segments.length;
        deltaVec.normalize();

        // Strand nodes
        for (var i = 0; i < this.nodes.length; i++) {
            this.nodes[i] = new EulerNode(new THREE.Vector3(this.head.x + deltaVec.x * segLen * i, this.head.y + deltaVec.y * segLen * i, this.head.z + deltaVec.z * segLen * i), THREE.MathUtils.randFloat(.002, .007), new THREE.Vector3(THREE.MathUtils.randFloatSpread(.01), THREE.MathUtils.randFloatSpread(.006), THREE.MathUtils.randFloatSpread(.008)));
            // show nodes
            this.add(this.nodes[i]);
        }

        for (var i = 0; i < this.segments.length; i++) {
            this.segments[i] = new EulerStick(this.nodes[i], this.nodes[i + 1], this.elasticity, this.damping);
            this.vertices.push( this.segments[i].start.position );
            if (i === this.segments.length - 1) { this.vertices.push(this.segments[i].end.position) }

            // this.geometry.vertices.push(this.segments[i].start.position);
            // if (i === this.segments.length - 1) { this.geometry.vertices.push(this.segments[i].end.position) }
        }


        const MAX_POINTS = this.vertices.length; 
        this.positions = new Float32Array( MAX_POINTS * 3 ); // 3 vertices per point
        this.geometry.setAttribute( 'position', new THREE.BufferAttribute( this.positions, 3 ) );
        this.geometry.setDrawRange( 0, MAX_POINTS ); 
        let curIndex : number = 0;

        const positions = this.geometry.attributes.positions.array; 
        for(let i=0; i<this.vertices.length; i++)
        {
            curIndex = addVertToPositions( this.positions, curIndex, this.vertices[i] );
        }
        this.geometry.attributes.position.needsUpdate = true; 

        let lineMaterial = new THREE.LineBasicMaterial({ color: 0x22ff22, linewidth: 5 });
        this.tendril = new THREE.Line(this.geometry, lineMaterial);
        //this.tendril.material.transparent = true; //annoying ide can't accurately track this
        let tenMat = this.tendril.material as THREE.Material // need assertion  
        tenMat.opacity = .25; //annoying ide can't accurately track this
        //this.tendril.
        this.add(this.tendril);
    }

    public move(isConstrained: boolean = true): void {
        for (var i = 0; i < this.segmentCount; i++) {
            // this.nodes[i].move();
        }
        this.nodes[0].move();
        if (isConstrained) {
            this.constrain();
        }
    }

    private constrain(): void {
        for (var i = 0; i < this.segmentCount; i++) {
            this.segments[i].constrainLen();
        }
        // this.geometry.verticesNeedUpdate = true;

        const positions = this.geometry.attributes.position.array; 
        let curIndex : number = 0; 
        for(let i=0; i<this.vertices.length; i++)
        {
            curIndex = addVertToPositions( positions, curIndex, this.vertices[i] );
        }
        this.geometry.attributes.position.needsUpdate = true; 
    }

    public constrainBounds(bounds: THREE.Vector3): void {
        for (var i = 0; i < this.nodes.length; i++) {
            this.nodes[i].constrainBounds(bounds);
        }
    }

}