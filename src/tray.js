import * as THREE from "./Resources/Three/three.js";
import { STLLoader } from "./Resources/Three/Loaders/STLLoader.js";
import { VNFLoader } from "./Resources/Three/Loaders/VNFLoader.js";
// import { ZIPLoader } from "../Resources/Three/Loaders/ZIPLoader.js";

const defaultMaterial = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.6, flatShading: true, iridescence: 0.5, side: THREE.DoubleSide });
const iSize = 10;
const iPad = 1;


export class Tray extends THREE.Mesh {
    constructor(trayGeometry, material) {
        if (!(material instanceof THREE.Material)) {
            material = defaultMaterial;
        }
        super(trayGeometry, material);

        this.trayVerts = trayGeometry.attributes.position.array;

        if (trayGeometry.header instanceof ArrayBuffer) {
            const u16 = new Uint16Array(trayGeometry.header.slice(0, 16));
            this.regionSizes = Array.from(u16);
            // cumulative sizes for easier indexing
            this.regionLocs = this.regionSizes.reduce((acc, size) => {
                acc.push((acc.length > 0 ? acc[acc.length - 1] : 0) + size);
                return acc;
            }, []);
        }
    }




    setSize(width, height, radius, padding) {
        const wR = width/radius;
        const hR = height/radius;
        const pR = padding/radius;

        const adjX = (wR - iSize) / 2;
        const adjY = (hR - iSize) / 2;
        const adjR = (iPad - pR) ;

        const l = this.regionLocs
        let isIn = (i, ri) => ri == 0 ? i < l[0] : i >= l[ri-1] && i < l[ri];

        let isRight = (i) => isIn(i, 0) || isIn(i, 3) || isIn(i, 4) || isIn(i, 7);
        let isLeft = (i) => isIn(i, 1) || isIn(i, 2) || isIn(i, 5) || isIn(i, 6);

        let isBottom = (i) => isIn(i, 2) || isIn(i, 3) || isIn(i, 6) || isIn(i, 7);
        let isTop = (i) => isIn(i, 0) || isIn(i, 1) || isIn(i, 4) || isIn(i, 5);

        let isRadP = (i) => i < l[3];

        let newVerts = new Float32Array(this.trayVerts.length);
        for (let i = 0; i < this.trayVerts.length / 3; i++) {
            let x = this.trayVerts[i*3];
            let y = this.trayVerts[i*3 + 1];
            let z = this.trayVerts[i*3 + 2];
            
            const ird = isRadP(i)
            if (isRight(i)) x += adjX + adjR * (ird ? 1 : 0);
            if (isLeft(i)) x -= adjX + adjR * (ird ? 1 : 0);
            if (isTop(i)) y += adjY + adjR * (ird ? 1 : 0);
            if (isBottom(i)) y -= adjY + adjR * (ird ? 1 : 0);
            
            newVerts[i*3] = x;
            newVerts[i*3 + 1] = y;
            newVerts[i*3 + 2] = z;
        }
        this.geometry.setAttribute("position", new THREE.BufferAttribute(newVerts, 3));
        this.geometry.attributes.position.needsUpdate = true;
    }


    static async loadFile(url, options = {}) {
        if (typeof options !== "object" || options === null) options = {};

        let ext = url.split(".").slice(-1)[0].toLowerCase();
        let loader = null;
        switch (ext) {
            case "stl": loader = new STLLoader(); break;
            case "vnf": loader = new VNFLoader(); break;
            default:
                throw new Error("Unsupported file format: " + ext);
        }
        let geometry = await loader.loadAsync(url, options.onProgress);

        return new Tray(geometry, options.material);
    }
}