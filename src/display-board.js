import * as THREE from './Resources/Three/three.js';

class PerspectiveBox extends THREE.Group {
    constructor(start, size, zPos) {
        super()
        this.start = start;
        this.size = size;

        
    }
}


export class Column extends THREE.Group {
    _gap = 0;
    constructor() {
        super();
        this._meshes = new THREE.Group();
        super.add(this._meshes);

        // Create rectangle to visualize column bounds
        const rectGeometry = new THREE.BufferGeometry();
        const vertices = new Float32Array([
            0, 0, 0,
            1, 0, 0,
            1, 1, 0,
            0, 1, 0,
        ]);
        rectGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        const rectMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
        const rect = new THREE.LineLoop(rectGeometry, rectMaterial);
        super.add(rect);
        this.rect = rect;
    }

    set gap(gap) {
        this._gap = gap;
        this._orderMeshes();
    }
    get gap() {
        return this._gap;
    }

    add(mesh) {
        this._meshes.add(mesh);
        if (mesh.geometry instanceof THREE.BufferGeometry) {
            mesh.geometry.computeBoundingBox();
            this._orderMeshes();
        } else {
            console.warn("Mesh geometry is not a BufferGeometry. Size may not be calculated correctly.");
        }
    }


    get meshes() {
        return [...this._meshes.children];
    }


    getMeshSize(mesh) {
        const box = new THREE.Box3().setFromObject(mesh);
        const size = new THREE.Vector3();
        box.getSize(size);
        return [size.x, size.y];
    }

    _orderMeshes() {
        let y = 0;
        const widths = [];
        for (let mesh of this.meshes) {
            const [width, height] = this.getMeshSize(mesh);
            mesh.position.set(0, -(y + height / 2), 0);
            y += height + this.gap;
            widths.push(width);
        }
        this._height = y - this.gap;
        this._width = Math.max(...widths);

        // Update rectangle to match column bounds
        this.rect.scale.set(this._width, -this._height, 1);
        this.rect.position.set(-this._width / 2, 0, 0);
    }

    get height() {
        return this._height;
    }

    get width() {
        return this._width;
    }
}


// export class SideShelf extends THREE.Group {
//     width = 10;
//     height = 100;
//     currentY = 0;
//     constructor() {
//         super();
//     }

//     add(mesh) {
//         super.add(mesh);
//         if (mesh.geometry instanceof THREE.BufferGeometry) {
//             mesh.geometry.computeBoundingBox();
//             const box = mesh.geometry.boundingBox;
//             const size = new THREE.Vector3();
//             box.getSize(size);
//             this.size = [size.x, size.y];
//             let scale = size.x / this.width;
//             mesh.scale.set(scale, scale, scale);
//         }
//     }

//     set size([width, height]) {
//         this.width = width;
//         this.height = height;
//     }

// }


// class DisplayBoard extends ThreeScene {
//     constructor() {
//         super();

//         this.load();
//         this.camera.position.set(0, 0, 300);
//         this.camera.lookAt(0, 0, 0);
//     }

//     load() {

//     }

//     getViewSizeAtZ(z) {
//         const viewSize = new THREE.Vector2(); // Target vector to store the result
//         camera.getViewSize(this.camera.position.z - z, viewSize);
//         return [viewSize.x, viewSize.y];
//     }
// }