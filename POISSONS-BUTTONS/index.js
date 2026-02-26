import { ZIPLoader } from "../src/Resources/Three/Loaders/ZIPLoader.js";
import * as THREE from "../src/Resources/Three/three.js";
import { ModelViewer } from "../src/model-viewer.js";
import { relURL } from "../src/relURL.js";

/** @type {ModelViewer} */
const mViewer = document.querySelector("model-viewer");
mViewer.useOrtho = true;

const modelInfo = document.querySelector(".model-info");
const modelGeometries = await ZIPLoader.load(relURL("../Assets/poissonButtonsComplete.zip", import.meta));


// A grayscale ramp is the most reliable for MeshToonMaterial
const colors = new Uint8Array([
  10, 10, 10, 255,     // dark
  40, 40, 40, 255,     // dark
  140, 140, 140, 255,  // mid
  220, 220, 220, 255,  // mid
  255, 255, 255, 255   // light
]);

const gradientMap = new THREE.DataTexture(colors, 5, 1, THREE.RGBAFormat);
gradientMap.minFilter = THREE.NearestFilter;
gradientMap.magFilter = THREE.NearestFilter;
gradientMap.generateMipmaps = false;
gradientMap.needsUpdate = true;

// If your Three version supports it, ensure this is NOT treated as sRGB color data
if ("colorSpace" in gradientMap) {
  gradientMap.colorSpace = THREE.NoColorSpace;
}
const metal = new THREE.MeshPhysicalMaterial({
            color: 0xf3ecec,
            metalness: 1,
            roughness: 0,
            reflectivity: 1,
            flatShading: true,
})
window.metal = metal;
const models = Object.keys(modelGeometries).map(key => {
    const geometry = modelGeometries[key];
    const meshToon = new THREE.MeshToonMaterial({
            color: 0xffffff, // Retain original color
            gradientMap
    });
    
    const mesh = new THREE.Mesh(geometry, metal);
    // mesh.geometry.computeVertexNormals();
    mesh.name = key;
    mesh.rotation.z = -Math.PI / 2;
    return mesh;
})

const modelSTLs = {
    "star": {
        complete: relURL("../Assets/STLs/star-complete.stl", import.meta),
        shape: relURL("../Assets/STLs/star.stl", import.meta)
    },
    "heart": {
        complete: relURL("../Assets/STLs/heart-complete.stl", import.meta),
        shape: relURL("../Assets/STLs/heart.stl", import.meta)
    },
    "bolt": {
        complete: relURL("../Assets/STLs/bolt-complete.stl", import.meta),
        shape: relURL("../Assets/STLs/bolt.stl", import.meta)
    },
    "dia": {
        complete: relURL("../Assets/STLs/dia-complete.stl", import.meta),
        shape: relURL("../Assets/STLs/dia.stl", import.meta)
    }
}

mViewer.addModels(models);

window.addEventListener("mousedown", e => {
    document.body.toggleAttribute("interact", true);
})
window.addEventListener("keydown", e => {
    console.log(e.key);
    if (e.key === "ArrowLeft") {
        mViewer.modelYRotation += Math.PI / 4;
    } else if (e.key === "ArrowRight") {
        mViewer.modelYRotation -= Math.PI / 4;
    } else if (e.key === "ArrowUp") {
        mViewer.modelXRotation += Math.PI / 4;
    } else if (e.key === "ArrowDown") {
        mViewer.modelXRotation -= Math.PI / 4;
    }
})

document.body.setAttribute("loaded", true)

mViewer.addEventListener("model-selected", e => {
    let html = "";
    if (e?.model) {
        let name = e.model.name;
        const {complete, shape} = modelSTLs[name];
        html += `
        <div>Name:<b class="name">${name}</b></div>
        <a href="${complete}" download="${name}-button.stl" stl> button</a>
        <a href="${shape}" download="${name}-shape.stl" stl> shape</a>`
    }
    modelInfo.innerHTML = html;
});