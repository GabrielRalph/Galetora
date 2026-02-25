import { ZIPLoader } from "../src/Resources/Three/Loaders/ZIPLoader.js";
import * as THREE from "../src/Resources/Three/three.js";
import { ModelViewer } from "../src/model-viewer.js";
import { relURL } from "../src/relURL.js";

/** @type {ModelViewer} */
const mViewer = document.querySelector("model-viewer");
const modelInfo = document.querySelector(".model-info");
const modelGeometries = await ZIPLoader.load(relURL("../Assets/poissonButtons.zip", import.meta));

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