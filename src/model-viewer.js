console.log("defining new element");
import {ThreeScene} from "./Resources/basic-scene.js";
import * as THREE from "./Resources/Three/three.js";
import { ObjectControls } from "./Resources/Three/Controls/control.js";
import { TransitionGroup } from "./transition.js";

export class Column {
    _gap = 0;
    _pos = [0, 0];
    constructor() {
        this._objects = []
    }

    add(object) {
        this._objects.push(object);
        if (object.geometry instanceof THREE.BufferGeometry) {
            object.geometry.computeBoundingBox();
        }
    }


    get objects() {
        return [...this._objects];
    }

    getMeshSize(mesh) {
        if (mesh.tempSize) return mesh.tempSize;
        const box = new THREE.Box3().setFromObject(mesh);
        const size = new THREE.Vector3();
        box.getSize(size);
        mesh.oldSize = [size.x, size.y];
        return [size.x, size.y];
    }

    orderObjects(height, gap) {
        let meshSizes = this.objects.map(mesh => this.getMeshSize(mesh));
        let desiredMeshHeight = height - gap * (meshSizes.length - 1);
        let actualMeshHeigth = meshSizes.reduce((sum, [_, h]) => sum + h, 0);
        let scale = desiredMeshHeight / actualMeshHeigth;
        let maxScale = 0;
        let width = Math.max(...meshSizes.map(([w, _]) => w)) * scale;

        let [x0, y0] = [this._pos[0], this._pos[1]];
        let y = 0
        this.objects.forEach((mesh, i) => {
            let [w, h] = meshSizes[i];
            let nH = h * scale;
            if (!mesh.onDisplay) {
                mesh.scale.setScalar(mesh.scale.x * scale)
                mesh.position.set(x0, y0 - (y + nH/2), 0);
                maxScale = Math.max(maxScale, mesh.scale.x);
            }
            y += gap + nH;
        })

        this.maxObjectScale = maxScale;

        return width;
    }

    set position([x,y]) {
        let [x0, y0] = this._pos;
        let dx = x - x0;
        let dy = y - y0;
        for (let mesh of this.objects) {
            if (!mesh.onDisplay) {
                mesh.position.x += dx;
                mesh.position.y += dy;
            }
        }
        this._pos = [x, y]
    }
}

class ModelSelectionEvent extends Event {
    constructor(model) {
        super("model-selected");
        this.model = model;
    }
}

function cosT(t) {
    return (1 - Math.cos(t * Math.PI)) / 2;
}
export class ModelViewer extends ThreeScene {
    constructor() {
        super();
        this.camera.position.set(0, 0, 500);
        this.controls = null;

        this.backgroundScene = this.scene.clone();
        this.foregroundScene = this.scene.clone();

        this.backgroundRoot = this.backgroundScene.children.find(child => child instanceof THREE.Group);
        this.foregroundRoot = this.foregroundScene.children.find(child => child instanceof THREE.Group);

        this.foregroundControls = new ObjectControls(this, false);
        this.selectedContainer = new THREE.Group();
        this.foregroundRoot.add(this.selectedContainer);

        this.addEventListener("mousemove", this.onMouseMove.bind(this))
        this.addEventListener("click", this.onMouseClick.bind(this))
    }

    addModels(models) {
        const column = new Column();
        for (const model of models) {
            const modelContainer = new THREE.Group();
            const modelTransitioner = new TransitionGroup(0.05);
            modelTransitioner.transitionFunction = cosT;

            modelContainer.model = model;
            modelContainer.modelTransitioner = modelTransitioner;
            modelTransitioner.model = model;

            modelContainer.add(modelTransitioner);
            modelTransitioner.add(model);
            this.add(modelContainer);
            column.add(modelContainer);
        }
        this.column = column;
        this.resizeColumn(20);
    }


    selectModel(model) {
        if (model && this.selectedModel != model) {
            // clone model
            this.selectedModel = model;
            let selectedModelClone = model.clone();
    
            // get model matrix
            model.updateMatrixWorld();
            let mMi = model.matrix.clone().invert();
            let wmM = model.matrixWorld.clone().multiply(mMi);
    
    
            let tGroup = new TransitionGroup()
            this.selectedContainer.add(tGroup);
            tGroup.transitionTime = 0.5;
            tGroup.transitionFunction = cosT;
            tGroup.model = selectedModelClone;
            tGroup.add(selectedModelClone);
        
            this.selectedContainer.updateWorldMatrix(true, false); // ensure it's current
            const scMi = this.selectedContainer.matrixWorld.clone().invert();
            const Mx = scMi.multiply(wmM);
            tGroup.matrixPRS = Mx;
            
            let identity = new THREE.Matrix4().identity();
            tGroup.goalMatrix = identity;
            
            this.selectedGroup = tGroup;
            model.visible = false;

        } else {
            this.selectedModel = null;
        }
    }

    async deselectModel() {
        let {selectedModel, selectedGroup} = this;
    
        if (selectedGroup) {
            this.selectedGroup = null;
            const modelClone = selectedGroup.model;

            selectedGroup.updateMatrixWorld(true);
            const wmMc = selectedGroup.matrixWorld.clone();

            const tGroup = new TransitionGroup()
            tGroup.transitionTime = 0.5;
            tGroup.transitionFunction = cosT;
            tGroup.matrixPRS = wmMc;
            this.backgroundRoot.add(tGroup);
            tGroup.add(modelClone);

            this.selectedContainer.remove(selectedGroup);

            selectedModel.parent.updateMatrixWorld();
            let mM = selectedModel.parent.matrixWorld.clone();

            tGroup.goalMatrix = mM;
            await tGroup.waitTransition();
            this.backgroundRoot.remove(tGroup);
            selectedModel.visible = true;
        }
    }


    onMouseClick(e) {
        let xRel = e.x / this.clientWidth;
        if (xRel < this.columnWidth) {
            let intersects = this.rayCast(e.x, e.y, this.column.objects);
            const model = intersects[0]?.object;
            this.deselectModel()
            this.selectModel(model);
            this.dispatchEvent(new ModelSelectionEvent(this.selectedModel));
        } 
    }

    onMouseMove(e) {
        let xRel = e.x / this.clientWidth;
        if (xRel < this.columnWidth) {
            let intersects = this.rayCast(e.x, e.y, this.column.objects);
            const model = intersects[0]?.object;
            for (const object of this.column.objects) {
                const scale = object.model == model ? 1.2 : 1;
                object.modelTransitioner.goalScale = scale;
            }
        } 
    }


    resize() {
        super.resize();
        this.resizeColumn(20);
    }

    resizeColumn(gap) {
        if (this.column) {
            const [w, h] = this.getViewSizeAtZ(0);
            const width = this.column.orderObjects(h - 2*gap, gap*5);
            this.column.position = [width/2 + gap - w/2, h/2-gap];
            this.columnWidth =  (width + 2*gap) / w;

            let midX =(width + 2*gap)/4;
            this.foregroundRoot.scale.setScalar(this.column.maxObjectScale * 2);
            this.foregroundRoot.position.x = midX;

        }
    }

    beforeRender() {
        this.foregroundControls.update(this.selectedContainer)
    }

    parseEnvironmentTexture(texture) {
        super.parseEnvironmentTexture(texture);
        this.foregroundScene.environment = this.scene.environment;
        this.backgroundScene.environment = this.scene.environment;
    }

    renderScene() {
        this.renderer.autoClear = false;
        this.renderer.clear();
        this.renderer.render(this.backgroundScene, this.camera);
        this.renderer.clearDepth(); // 🔑 key line
        this.renderer.render(this.foregroundScene, this.camera);
        this.renderer.clearDepth(); // 🔑 key line
        this.renderer.render(this.scene, this.camera);
        // this.renderer.
    }


}


customElements.define("model-viewer", ModelViewer)