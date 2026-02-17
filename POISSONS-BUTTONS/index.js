// import { Column } from "../src/display-board.js";
import {} from "../src/Resources/basic-scene.js";
import { ZIPLoader } from "../src/Resources/Three/Loaders/ZIPLoader.js";
import { Button } from "../src/FallingButtons/button.js";
import * as THREE from "../src/Resources/Three/three.js";

import { ObjectControls } from "../src/Resources/Three/Controls/control.js";

export class Column {
    _gap = 0;
    _pos = [0, 0];
    constructor() {
        this._meshes = []
    }
   

    add(mesh) {
        this._meshes.push(mesh);
        if (mesh.geometry instanceof THREE.BufferGeometry) {
            mesh.geometry.computeBoundingBox();
        } else {
            console.warn("Mesh geometry is not a BufferGeometry. Size may not be calculated correctly.");
        }
    }


    get meshes() {
        return [...this._meshes];
    }

    getMeshSize(mesh) {
        if (mesh.tempSize) return mesh.tempSize;
        const box = new THREE.Box3().setFromObject(mesh);
        const size = new THREE.Vector3();
        box.getSize(size);
        mesh.oldSize = [size.x, size.y];
        return [size.x, size.y];
    }

    // _orderMeshes() {
    //     let [x0, y0] = this._pos;
    //     let y = 0;
    //     const widths = [];
    //     for (let mesh of this.meshes) {
    //         const [width, height] = this.getMeshSize(mesh);
    //         mesh.position.set(x0, y0-(y + height / 2), 0);
    //         y += height + this.gap;
    //         widths.push(width);
    //     }
    //     this._height = y - this.gap;
    //     this._width = Math.max(...widths);
    // }

    orderMeshes(height, gap) {
        let meshSizes = this.meshes.map(mesh => this.getMeshSize(mesh));
        let desiredMeshHeight = height - gap * (meshSizes.length - 1);
        let actualMeshHeigth = meshSizes.reduce((sum, [_, h]) => sum + h, 0);
        let scale = desiredMeshHeight / actualMeshHeigth;

        let width = Math.max(...meshSizes.map(([w, _]) => w)) * scale;

        let [x0, y0] = [this._pos[0], this._pos[1]];
        let y = 0
        this.meshes.forEach((mesh, i) => {
            let [w, h] = meshSizes[i];
            let nH = h * scale;
            if (!mesh.onDisplay) {
                mesh.cScale *= scale
                mesh.position.set(x0, y0 - (y + nH/2), 0);
            }
            y += gap + nH;
        })

        return width;
    }

    set position([x,y]) {
        let [x0, y0] = this._pos;
        let dx = x - x0;
        let dy = y - y0;
        for (let mesh of this.meshes) {
            if (!mesh.onDisplay) {
                mesh.position.x += dx;
                mesh.position.y += dy;
            }
        }
        this._pos = [x, y]
    }

    // set gap(gap) {
    //     this._gap = gap;
    //     this._orderMeshes();
    // }
    // get gap() {
    //     return this._gap;
    // }

    // set height(h) {
    //     let scale = h / (this.height);
    //     for (let mesh of this.meshes) {
    //         mesh.cScale = scale;
    //     }
    //     this.gap = this.gap * scale;
    // }


    // set width(w) {
    //     let scale = w / (this.width);
    //     for (let mesh of this.meshes) {
    //         mesh.cScale = scale;
    //     }
    //     this.gap = this.gap;
    // }

    // get height() {
    //     return this._height;
    // }

    // get width() {
    //     return this._width;
    // }

    // set position([x,y]) {
    //     this._pos = [x, y]
    //     this._orderMeshes();
    // }
    // get position() {
    //     return [...this._pos];   
    // }

}

class Button2 extends Button {
    _cScale = 1;

    set hScale(scale) {
        this._hScale = scale;
        this.scale.setScalar(this.cScale * scale);
    }
    get hScale() {
        return this._hScale;
    }
    set cScale(scale) {
        this._cScale = scale;
        this.scale.set(scale, scale, scale);
    }
    get cScale() {
        return this._cScale;
    }
}


const scene = document.querySelector("three-scene");
scene.cameraNear = 100;
scene.cameraFar = 2000;
scene.camera.position.set(0, 0, 500);
scene.controls = null;


const buttons = await Button2.loadFromZip("../Assets/poissonButtonsComplete.zip", {
    material: new THREE.MeshPhysicalMaterial({
        color: 0xf3ecec,
        metalness: 1,
        roughness: 0,
        reflectivity: 1,
        flatShading: true,
    })
});




const column = new Column();

for (let name in buttons) {
    const button = buttons[name];
    button.rotation.z = -Math.PI / 2;
    scene.add(button);
    column.add(button);
}

function resizeColumn(gap = 20) {
    const [w, h] = scene.getViewSizeAtZ(0);
    console.log(w, h);
    const width = column.orderMeshes(h - 2*gap, gap*5);
    column.position = [width/2 + gap - w/2, h/2-gap];
    return (width + 2*gap) / w;
}

let CWidth = resizeColumn();

let rGroup = new THREE.Group();
rGroup.position.set(0, 0, -1000);
scene.add(rGroup);
let mGroup = new THREE.Group();
rGroup.add(mGroup);
rGroup.scale.setScalar(6);

scene.addEventListener("resize", () => {
    CWidth = resizeColumn();
})

let selected = null;

window.addEventListener("mousemove", (e) => {
    let xRel = e.x / scene.clientWidth;
    if (xRel < CWidth) {
        let intersects = scene.rayCast(e.x, e.y, column.meshes);
        
        for (let button of column.meshes) {
            if (!button.onDisplay) {
                let scale = intersects[0]?.object === button ? 1.2 : 1;
                button.hScale = scale;
            }
        }
        e.preventDefault();
    } else {

    }
})




window.addEventListener("click", (e) => {
    let xRel = e.x / scene.clientWidth;
    if (xRel < CWidth) {
        let intersects = scene.rayCast(e.x, e.y, column.meshes);
        if (intersects.length > 0 && intersects[0].object !== selected) {
            if (selected) {
                scene.add(selected);
            }
            for (let button of column.meshes) {
                button.onDisplay = false;
                button.hScale = 1;
                button.rotation.set(0, 0, -Math.PI/2);
            }
            resizeColumn();
            let button = intersects[0].object;
            button.tempSize = button.oldSize;
            button.position.set(0, 0, 0);
            button.onDisplay = true;
            mGroup.add(button);
            selected = button;
        }
        e.preventDefault();
    }
});


const controls = new ObjectControls(scene, false);
scene.beforeRender = () => {
    if (selected) {
        controls.update(mGroup);
    }
}