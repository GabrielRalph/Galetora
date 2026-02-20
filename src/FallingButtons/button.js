import { STLLoader } from "../Resources/Three/Loaders/STLLoader.js";
import * as THREE from "../Resources/Three/three.js";
import { VNFLoader } from "../Resources/Three/Loaders/VNFLoader.js";
import { ZIPLoader } from "../Resources/Three/Loaders/ZIPLoader.js";

const GlowMaterial = new THREE.MeshPhysicalMaterial({ 
    color: 0xf3ecec,
    metalness: 0.,
    roughness: 1,
    reflectivity: 0,
    iridescence: 0,
    emissive: 0xf78103, // #f78103
    emissiveIntensity: 1,
});
const MetalMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xf3ecec,
    metalness: 1,
    roughness: 0,
    reflectivity: 1,
});

export class Button extends THREE.Mesh {
    gravity = -0.001;
    maxDrag = 0.01;
    maxRotAcc = [0.001, 0.01, 0.001];
    initialRotation = [0, 0, -Math.PI/2];

    constructor(geometry, material) {
        if (!(material instanceof THREE.Material)) {
            material = MetalMaterial;
        }
        super(geometry, material);
        this.v = [0, 0, 0];
        this.a = [0, -0.001, 0];
        this.drag = [0, Math.random() * 0.01, 0];
        this.rot_acc = [Math.random() * 0.001, Math.random() * 0.01, Math.random() * 0.001];
    }


    set floatOffset(val) {
        this._floatOffset = val;
        let newPos = this._startPosition.map((p, i) => p + val[i]);
        this.position.set(...newPos);
    }

    set floating(val) {
        this._floating = val;
        if (val) {
            this.v = [0, 0, 0];
            this.a = [0, this.gravity, 0];
            this.rot_acc = this.maxRotAcc.map(r => Math.random() * r);
            this._startPosition = this.position.toArray();
        }
    }

    get floating() {
        return this._floating;
    }

    reset(pos) {
        this.position.set(...pos);

        // Reset rotation
        this.rotation.set(...this.initialRotation);

        this.scale.set(1, 1, 1);

        // Reset velocity, acceleration, drag, and rotational acceleration
        this.v = [0, 0, 0];
        this.a = [0, this.gravity, 0];
        this.drag = [0, Math.random() * this.maxDrag, 0];
        this.rot_acc = this.maxRotAcc.map(r => Math.random() * r);
    }

    upate() {
        if (!this.floating) {
            this.v = this.v.map((v, i) => v + this.a[i] - Math.sign(this.v[i]) * (this.v[i] ** 2) * this.drag[i]);
            let pos = this.position.toArray().map((p, i) => p + this.v[i])
            this.position.set(...pos);

            let rot = this.rotation.toArray().slice(0,3).map((r, i) => r + this.rot_acc[i]);
            this.rotation.set(...rot);
        }
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
        return new this(geometry, options.material);
    }

    static async loadFromZip(url, options = {}) {
        if (typeof options !== "object" || options === null) options = {};

        const zipLoader = new ZIPLoader();
        const data = await zipLoader.loadAsync(url, options.onProgress);
        const meshes = {}
        for (let fileName in data) {
            meshes[fileName] = new this(data[fileName], options.material);
        }
        return meshes;
    }

    clone() {
        let clone = super.clone();
        clone.v = [...this.v];
        clone.a = [...this.a];
        clone.drag = [...this.drag];
        clone.rot_acc = [...this.rot_acc];
        return clone;
    }
}

