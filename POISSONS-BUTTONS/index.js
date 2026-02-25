import { ZIPLoader } from "../src/Resources/Three/Loaders/ZIPLoader.js";
import * as THREE from "../src/Resources/Three/three.js";
import { ModelViewer } from "./model-viewer.js";
import { mergeVertices } from "../src/Resources/Three/Utils/BufferGeometryUtils.js";

/** @type {ModelViewer} */
const mViewer = document.querySelector("model-viewer");
const modelInfo = document.querySelector(".model-info");
const modelGeometries = await ZIPLoader.load("../Assets/poissonButtonsComplete.zip");

const models = Object.keys(modelGeometries).map(key => {
    const geometry = modelGeometries[key];
    // const merged = mergeVertices(geometry);
    // merged.computeVertexNormals(5 * Math.PI / 180); // 30° crease angle
    const mesh = new THREE.Mesh(geometry, new THREE.MeshPhysicalMaterial({
            color: 0xf3ecec,
            metalness: 1,
            roughness: 0,
            reflectivity: 1,
            flatShading: true,
    }));
    // mesh.geometry.computeVertexNormals();
    mesh.name = key;
    mesh.rotation.z = -Math.PI / 2;
    return mesh;
})

mViewer.addModels(models);

document.body.setAttribute("loaded", true)

mViewer.addEventListener("model-selected", e => {
    let html = "";
    if (e?.model) {
        let name = e.model.name;
        html += `
        <div>Name:<b class="name">${name}</b></div>
        <a href="../Assets/STLs/${name}-complete.stl" download="${name}-button.stl"> button <img src ="../Assets/upload-stl.svg"/></a>
        <a href="../Assets/STLs/${name}.stl" download="${name}-shape.stl"> shape <img src ="../Assets/upload-stl.svg"/></a>`
    }
    modelInfo.innerHTML = html;
});