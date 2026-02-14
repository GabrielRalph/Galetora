import { ThreeScene } from "./Resources/basic-scene.js";
import { STLLoader } from "./Resources/Three/Loaders/STLLoader.js";
import * as THREE from "./Resources/Three/three.js";
import { VNFLoader } from "./Resources/Three/Loaders/VNFLoader.js";
import { ZIPLoader } from "./Resources/Three/Loaders/ZIPLoader.js";

const ZipedShapes = "./Assets/poissonButtons.zip";


class FallingMesh extends THREE.Mesh {
    gravity = -0.001;
    maxDrag = 0.01;
    maxRotAcc = [0.001, 0.01, 0.001];
    initialRotation = [0, 0, -Math.PI/2];

    constructor(geometry, material) {
        if (!(material instanceof THREE.Material)) {
            material = new THREE.MeshPhysicalMaterial({ 
                color: 0xf3ecec,
                metalness: 1,
                roughness: 0,
                reflectivity: 1,
            });
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
        geometry = mergeVertices(geometry);
        return new FallingMesh(geometry, options.material);
    }

    static async loadFromZip(url, options = {}) {
        if (typeof options !== "object" || options === null) options = {};

        const zipLoader = new ZIPLoader();
        console.log("Loading zip file:", url);
        const data = await zipLoader.loadAsync(url, options.onProgress);
        console.log("Zip file loaded:", data);
        const meshes = {}
        for (let fileName in data) {
            meshes[fileName] = new FallingMesh(data[fileName], options.material);
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


class FallingButtons  extends ThreeScene {

    boxWidth = 150;
    boxDepth = 0;
    boxLength = 150;


    clones = 2;

    cameraFOV = 45;

    heightPadding = 20;
    zRange = [0, 150]

    constructor() {
        super();
        this.load();
        this.camera.position.set(0, 0, 300);
        this.camera.lookAt(0, 0, 0);
        this.addDragControls();
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

    resize() {
        super.resize();
        this.camera.lookAt(0, 0, 0);
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
        let startPos = [0, 0];
        let lastDelta = [0, 0];

        let onSelect = async (x, y) => {
            let intersects = this.rayCast(x, y);
            if (intersects.length > 0) {
                selectedMesh = intersects[0].object;
                selectedMesh.floating = true;
                startPos = [x, y];
            }
        }

        let onMove = (x, y) => {
            if (selectedMesh) {
                let deltapX = x - startPos[0];
                let deltapY = y - startPos[1];
                let deltaX =  (deltapX / this.clientWidth);
                let deltaY =  -(deltapY / this.clientHeight);
                let z = selectedMesh.position.z;
                let [widthAtZ, heightAtZ] = this.getSizeAtZ(z);
                selectedMesh.floatOffset = [deltaX * widthAtZ, deltaY * heightAtZ, 0];
                let v = [(deltaX - lastDelta[0]) * 50, (deltaY - lastDelta[1]) * 50, 0];
                selectedMesh.v = v;
                lastDelta = [deltaX, deltaY];
            }
        }

        let onDeselect = () => {
            if (selectedMesh) {
                selectedMesh.floating = false;
                selectedMesh = null;
            }
        }


        window.addEventListener("mousedown", (e) => onSelect(e.clientX, e.clientY));
        window.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY));
        window.addEventListener("mouseup", (e) => onDeselect());

        window.addEventListener("touchstart", async (e) => {
            if (e.touches.length > 0) {
                onSelect(e.touches[0].clientX, e.touches[0].clientY);
            }
        });

        

        window.addEventListener("touchmove", (e) => {
            if (e.touches.length > 0) {
                onMove(e.touches[0].clientX, e.touches[0].clientY);
            }
        });
        window.addEventListener("touchend", (e) => onDeselect());
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

    parseEnvironmentTexture(texture) {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.mapping = THREE.EquirectangularReflectionMapping;
        this.scene.environment = texture;
    }

    async loadTest() {
        const meshes = await FallingMesh.loadFromZip(ZipedShapes);
        const n = Object.keys(meshes).length;
        const rows = Math.round(n ** 0.5);
        const cols = Math.ceil(n / rows);

        Object.values(meshes).forEach((mesh, i) => {
            const row = Math.floor(i / cols);
            const col = i % cols;

            console.log((col - cols / 2 + 0.5) * 25,
                (row - rows / 2 + 0.5) * 25)
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
        const meshesOG = await FallingMesh.loadFromZip(ZipedShapes);

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
    }
  

    set ["z-range"](val) {
        let values = val.split(",").map((p) => parseFloat(p.trim()));
        this.zRange =  values.slice(0,2);
    }

    static get observedAttributes() {
        return ['environment', 'z-range'];
    }
}

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
    console.log("Device motion event:", event);
    const accG = event.accelerationIncludingGravity; // m/s², includes gravity
    if (accG.x !== null && accG.y !== null) {
        ewaX = ewaX * 0.9 + accG.x * 0.1;
        ewaY = ewaY * 0.9 + accG.y * 0.1;
        let accDir = Math.atan2(ewaX, ewaY);
        document.body.style.setProperty("--angle", accDir * 180 / Math.PI + "deg");
    }
});
customElements.define('falling-buttons', FallingButtons);