import { relURL } from "../relURL.js";

import { ThreeScene } from "../Resources/basic-scene.js";
import * as THREE from "../Resources/Three/three.js";
import { Button } from "./button.js";


const ZipedShapes = relURL("../../Assets/poissonButtons.zip", import.meta);

class FallingButtons  extends ThreeScene {

    boxWidth = 150;
    boxDepth = 0;
    boxLength = 150;


    clones = 2;

    cameraFOV = 45;

    heightPadding = 20;
    zRange = [0, 150]
    count = 0;
    constructor() {
        super();
        this.load();
        this.camera.position.set(0, 0, 300);
        this.camera.lookAt(0, 0, 0);
        this.addDragControls();
        // this.createBloomPass();
    }


    // async createBloomPass() {
    //     console.log("Creating bloom pass...");
    //     const { EffectComposer } = await import("../Resources/Three/Effects/postprocessing/EffectComposer.js");
    //     const { RenderPass } = await import("../Resources/Three/Effects/postprocessing/RenderPass.js");
    //     const { UnrealBloomPass } = await import("../Resources/Three/Effects/postprocessing/UnrealBloomPass.js");
     
    //     this.composer = new EffectComposer(this.renderer);
    //     this.renderPass = new RenderPass(this.scene, this.camera);

    //     this.bloomPass = new UnrealBloomPass(
    //         new THREE.Vector2(this.innerWidth, this.innerHeight),
    //         1.5,
    //         0.4,
    //         0.9
    //     );
    //     this.composer.setSize(this.clientWidth, this.clientHeight);
    //     this.ready = this.clientHeight > 0 && this.clientWidth > 0;

    //     this.composer.addPass(this.renderPass);
    //     this.composer.addPass(this.bloomPass);
    // }

    connectedCallback() {
        super.connectedCallback();
        this.stop();
    }


    /**
     * Handles resizing of the scene, ensuring that the camera and bloom pass are updated
     * 
     */
    resize() {
        super.resize();
        this.camera.lookAt(0, 0, 0);
        this.resizeLogo();
    }

    resizeLogo() {
        const {logo} = this;
        if (logo) {
            if (!logo.geometry.boundingBox) {
                logo.geometry.computeBoundingBox();
            }
            const box = logo.geometry.boundingBox;
            const size = box.getSize(new THREE.Vector3());
            console.log(size.x, size.y);
            const [w, h] = this.getSizeAtZ(0);
            logo.scale.setScalar(0.222 * w/size.x);
            logo.position.y = 0.0825* w
            logo.position.x = 0.0055 * w
            logo.rotation.z = -Math.PI / 2;
            this.add(logo);
        }
    }

    renderScene() {
        if (this.ready && this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }

    getSizeAtZ(z) {
        let camZ = this.camera.position.z;
        let zDist = camZ - z;
        let fovRad = this.cameraFOV * Math.PI / 180;

        let heightAtZ = 2 * Math.tan(fovRad / 2) * zDist;
        let widthAtZ = heightAtZ * (this.camera.aspect || 1);
        return [widthAtZ, heightAtZ];
    }



    randomPosAtTop(p = 1) {
        let randomZ = Math.random() * (this.zRange[1] - this.zRange[0]) + this.zRange[0];
        let [widthAtZ, heightAtZ] = this.getSizeAtZ(randomZ);
        heightAtZ = heightAtZ + this.heightPadding * 2
        let randomX = (Math.random() - 0.5) * widthAtZ;
        let y = (p - 0.5) * heightAtZ;
        return [randomX, y, randomZ];
    }


    beforeRender() {
        this.iStart += 0.01;
        (this.shapeMeshes||[]).forEach((mesh, i) => {
            if (i < this.iStart) {
                mesh.upate();
                let heightAtZ = this.getSizeAtZ(mesh.position.z)[1] + this.heightPadding * 2;
                if (mesh.position.y < -heightAtZ / 2) {
                    mesh.reset(this.randomPosAtTop());
                }
            }
        })
    }

    attachDeviceMotion() {
        window.addEventListener("devicemotion", (event) => {
            // const acc = event.acceleration; // m/s², without gravity
            const accG = event.accelerationIncludingGravity; // m/s², includes gravity
            if (accG.x !== null && accG.y !== null) {
                for (let mesh of this.shapeMeshes || []) {

                    // if (mesh.floating) {
                        mesh.a[0] = accG.x * 0.0002; // Adjust sensitivity as needed
                        mesh.a[1] = accG.y * 0.0002; // Invert Y-axis for natural feel
                    // }
                }
            }
        });
    }

    addDragControls() {
        let selectedMesh = null;
        let selected = {};
        let idleTouches = {};
        

        let onSelect = (x, y, id = "m") => {
            let intersects = this.rayCast(x, y);
            if (intersects.length > 0) {
                const mesh = intersects[0].object;
                if (!mesh.floating) {
                    mesh.floating = true;
                    selected[id] = {
                        startPos: [x, y],
                        lastDelta: [0, 0],
                        mesh
                    }
                }
                return true;
            }
            return false;
        }

        let onMove = (x, y, id = "m") => {
            if (id in selected) {
                const { startPos, lastDelta, mesh } = selected[id];
                let deltapX = x - startPos[0];
                let deltapY = y - startPos[1];
                let deltaX =  (deltapX / this.clientWidth);
                let deltaY =  -(deltapY / this.clientHeight);
                let z = mesh.position.z;
                let [widthAtZ, heightAtZ] = this.getSizeAtZ(z);
                mesh.floatOffset = [deltaX * widthAtZ, deltaY * heightAtZ, 0];
                let v = [(deltaX - lastDelta[0]) * 50, (deltaY - lastDelta[1]) * 50, 0];
                mesh.v = v;
                selected[id].lastDelta = [deltaX, deltaY];
            }
        }

        let onDeselect = (id = "m") => {
            if (id in selected) {
                selected[id].mesh.floating = false;
                delete selected[id];
            }
        }


        window.addEventListener("mousedown", (e) => onSelect(e.clientX, e.clientY));
        window.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY));
        window.addEventListener("mouseup", (e) => onDeselect());


        let zoomStartDistance = null;
        let zoomStartScale = null;
        window.addEventListener("touchstart", async (e) => {
            console.log("tstart: ", [...e.touches].map(t => t.identifier).join(", "));
            let noHits = 0;

            for (let touch of e.touches) {
                if (!(touch.identifier in selected)) {
                    noHits += onSelect(touch.clientX, touch.clientY, touch.identifier) ? 0 : 1;
                }
            }
            
            if (noHits === 1 && Object.keys(selected).length === 1) {
                // If one button is selected and the user tapped somewhere else
                let t1 = e.touches[0];
                let t2 = e.touches[1];
                zoomStartDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
                zoomStartScale = selected[Object.keys(selected)[0]].mesh.scale.x;
            } else {
                zoomStartDistance = null;
            }
        });

        


        window.addEventListener("touchmove", (e) => {
            for (let touch of e.touches) {
                onMove(touch.clientX, touch.clientY, touch.identifier);
            }

            if (zoomStartDistance !== null && e.touches.length === 2) {
                let t1 = e.touches[0];
                let t2 = e.touches[1];
                let distance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
                let zoomFactor = zoomStartScale * distance / zoomStartDistance;
                selected[Object.keys(selected)[0]].mesh.scale.set(zoomFactor, zoomFactor, zoomFactor);
            }
        });
        window.addEventListener("touchend", (e) => {
            for (let touch of e.changedTouches) {
                onDeselect(touch.identifier);
                delete idleTouches[touch.identifier];
            }
            zoomStartDistance = null;
        });
        this.attachDeviceMotion();
    }


    rayCast(x, y) {
        let mouse = new THREE.Vector2(
            (x / this.clientWidth) * 2 - 1,
            -(y / this.clientHeight) * 2 + 1
        );
        let raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);
        let intersects = raycaster.intersectObjects(this.shapeMeshes || []);
        return intersects;
    }

    

    async loadTest() {
        const meshes = await Button.loadFromZip(ZipedShapes);
        const n = Object.keys(meshes).length;
        const rows = Math.round(n ** 0.5);
        const cols = Math.ceil(n / rows);

        Object.values(meshes).forEach((mesh, i) => {
            const row = Math.floor(i / cols);
            const col = i % cols;

            mesh.position.set(
                (col - cols / 2 + 0.5) * 25,
                (row - rows / 2 + 0.5) * 25,
                0
            );
            this.add(mesh);
        })
    }
     
    async load() {
        this.controls = null;
        const meshes = [];

        // Load meshes from zip
        const [logo, meshesOG] = await Promise.all([
            this.addLoadPromise(
                async (url, onP) => await Button.loadFile(url, { onProgress: onP }), 
                relURL("../../Assets/logo.vnf", import.meta)
            ),
            this.addLoadPromise(
                (url, onP) => Button.loadFromZip(url, { onProgress: onP }),
                ZipedShapes
            )
        ]);

        await this.waitForLoad();

        this.logo = logo;
        this.resizeLogo();
        // Clone meshes according to this.clones
        for (let key in meshesOG) {
            meshes.push(meshesOG[key]);
            for (let i = 0; i < this.clones; i++) {
                meshes.push(meshesOG[key].clone());
            }
        }
        
        // Reset and add all meshes
        meshes.sort(() => Math.random() - 0.5);
        meshes.forEach((m,i) => {
            m.reset(this.randomPosAtTop());
            this.add(m);
        });

        this.iStart = 1;

        this.shapeMeshes = meshes;

        document.body.toggleAttribute("loaded", true)
    }
  

    set ["z-range"](val) {
        let values = val.split(",").map((p) => parseFloat(p.trim()));
        this.zRange =  values.slice(0,2);
    }

    static get observedAttributes() {
        return ['environment', 'z-range'];
    }
}


let queryParams = new URLSearchParams(window.location.search);
if (queryParams.has("rotate")) {
    let attachAccelerometerDone = false;
    window.addEventListener("click", async (e) => {
        if (!attachAccelerometerDone && window.DeviceMotionEvent) {
            attachAccelerometerDone = true;
            if( typeof DeviceMotionEvent.requestPermission === "function") {
                try {
                    const response = await DeviceMotionEvent.requestPermission();
                } catch (error) {
                    console.log("Denied permission to access device motion.", error);
                }
            } 
        }
    })
    
    let ewaX = 0;
    let ewaY = 0;
    window.addEventListener("devicemotion", (event) => {
        // const acc = event.acceleration; // m/s², without gravity
        const accG = event.accelerationIncludingGravity; // m/s², includes gravity
        if (accG.x !== null && accG.y !== null) {
            ewaX = ewaX * 0.9 + accG.x * 0.1;
            ewaY = ewaY * 0.9 + accG.y * 0.1;
            let accDir = Math.atan2(ewaX, ewaY);
            document.body.style.setProperty("--angle", accDir * 180 / Math.PI + "deg");
        }
    });
}
customElements.define('falling-buttons', FallingButtons);