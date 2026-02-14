
import * as THREE from "./Three/three.js";
import { ObjectControls } from './Three/Controls/control.js';
import { RGBELoader } from './Three/Loaders/RGBELoader.js'
import {STLLoader} from './Three/Loaders/STLLoader.js';
import { PointCloud } from "./Three/pc.js";


export function relURL(url, meta) {
    let root = meta.url;
    url = url.replace(/^\.\//, "/");
    if (url[0] != "/") url = "/" + url;
    return root.split("/").slice(0, -1).join("/") + url;
  }
export class ThreeScene extends HTMLElement {
    cameraFOV = 75;
    constructor() {
        super();
        this._viewScale = 3;
        this.sizeObserver = null;
        const scene = new THREE.Scene();
        this.scene = scene;

        if (this.cachedEnvironment) {
            this.parseEnvironmentTexture(this.cachedEnvironment);
        }


        const camera = new THREE.PerspectiveCamera(this.cameraFOV, this.innerWidth / this.innerHeight, 0.1, 1000);
        camera.position.set(0, 50, 100);

        // preserveDrawingBuffer ensures toDataURL works reliably for screenshots
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        renderer.setSize(this.innerWidth, this.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);

        
        const controls = new ObjectControls(renderer.domElement);
        let mat = this.getAttribute("mat");
        if (mat) {
            controls.isCached = false;
            let m = new THREE.Matrix4();
            m.fromArray(mat.split(",").map(e => parseFloat(e)));
            controls.matrix = m;
        }

        const light = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(light);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(1, 1, 10);
        scene.add(directionalLight);

        const root = new THREE.Group();
        scene.add(root);

        this.camera = camera;
        this.renderer = renderer;
        this.root = root;
        this.controls = controls;
    }
 

    addSphere(radius = 1, pos, color = 0x00ff00) {
        const geometry = new THREE.SphereGeometry(radius, 32, 32);
        const material = new THREE.MeshStandardMaterial({ color: color });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.set(...pos);
        this.root.add(sphere);
        return sphere;
    }

    resize() {
        if (this.renderer) {
            let { clientWidth, clientHeight } = this;
            let pos = this.camera.position.toArray();
            // this.camera.aspect = clientWidth / clientHeight;
            // this.camera.updateProjectionMatrix();
            this.renderer.setSize(clientWidth, clientHeight);
            this.renderer.setPixelRatio(window.devicePixelRatio);
            this.camera = new THREE.PerspectiveCamera(this.cameraFOV, clientWidth / clientHeight, 0.1, 1000);
            this.camera.position.set(...pos);
        }
    }

    connectedCallback() {
        this.appendChild(this.renderer.domElement);
        if (!this.sizeObserver) {
            this.sizeObserver = new ResizeObserver(this.resize.bind(this))
        }
        this.sizeObserver.observe(this);
        this.start();
        if (this.onconnected instanceof Function) {
            this.onconnected()
        }
    }


    disconnectedCallback() {
        this.stop();
        this.sizeObserver.disconnect();
        if (this.ondisconnected instanceof Function) {
            this.ondisconnected()
        }
    }


    addSTL(url) {
        return new Promise((resolve, reject) => {
            const loader = new STLLoader();
            loader.load(url, (geometry) => {
                const material = new THREE.MeshPhysicalMaterial({ 
                    color: 0xf3ecec,
                    metalness: 1,
                    roughness: 0,
                    reflectivity: 1,
                   
                });
                const mesh = new THREE.Mesh(geometry, material);
                this.root.add(mesh);
                resolve(mesh);
            }, undefined, (error) => {
                reject(error);
            });
        })
    }


    renderScene() {
        this.renderer.render(this.scene, this.camera);
    }


    async start() {
        let stop = false;
        this.stop = () => {
            stop = true;
        }
        while (!stop) {
            await new Promise(requestAnimationFrame)
            if (this.beforeRender instanceof Function) {
                this.beforeRender()
            }
            if (this.root && this.controls) this.controls.update(this.root);
            if (this.pointclouds) {
                for (let pc of this.pointclouds) {
                    pc.update();
                }
            }

            this.renderScene();

            if (this.afterRender instanceof Function) {
                this.afterRender()
            }
        }
    }

    stop() { }

    add(object) {

        if (object instanceof PointCloud) {
            if (!this.pointclouds) this.pointclouds = [];
            this.pointclouds.push(object);
        }
        this.root.add(object);
    }

    clear() {
        function disposeRecursive(obj) {
            for (const child of obj.children) disposeRecursive(child);
            if (obj.isMesh) {
                obj.geometry?.dispose();
                if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                else obj.material?.dispose();
            }
        }
        while (this.root.children.length) {
            const child = this.root.children[0];
            disposeRecursive(child);
            this.root.remove(child);
        }
    }


    parseEnvironmentTexture(texture) {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        this.scene.environment = texture;
    }


    set environment(env) {
        console.log("Setting environment:", env);
         // ✅ Load an HDRI environment for reflections

        let ext = env.split(".").slice(-1)[0].toLowerCase();

        let loader = null;
        switch (ext) {
            case "hdr":
                loader = new RGBELoader();
                break;
            case "jpg":
            case "jpeg":
            case "png":
                loader = new THREE.TextureLoader();
                break;
            default:
                console.warn("Unsupported environment map format:", ext);
                return;
        }
        loader.load(env, (texture) => {
            console.log("Environment loaded:", env);
            if (!this.scene) {
                this.cachedEnvironment = texture;
            } else {
                this.parseEnvironmentTexture(texture);
            }
        })
    }



    attributeChangedCallback(name, oldValue, newValue) {
        this[name] = newValue;
    }


    static get observedAttributes() {
        return ["environment"]
    }
}

customElements.define('three-scene', ThreeScene);