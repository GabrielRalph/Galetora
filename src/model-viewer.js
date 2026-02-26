console.log("defining new element");
import {ThreeScene} from "./Resources/basic-scene.js";
import * as THREE from "./Resources/Three/three.js";
import { ObjectControls } from "./Resources/Three/Controls/control.js";
import { TransitionGroup } from "./transition.js";

// import { EffectComposer } from "./Resources/Three/Effects/postprocessing/EffectComposer.js";
// import { RenderPass } from "./Resources/Three/Effects/postprocessing/RenderPass.js";
// import { OutlinePass } from "./Resources/Three/Effects/postprocessing/OutlinePass.js";
// import { FXAAShader } from "./Resources/Three/Effects/shaders/FXAAShader.js";
// import { ShaderPass } from "./Resources/Three/Effects/postprocessing/ShaderPass.js";

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

        // this.initComposer();
    }

    initComposer() {
        // this.composer = new EffectComposer(this.renderer);
        // this.renderPass = new RenderPass(this.foregroundScene, this.camera);
        // this.composer.addPass(this.renderPass);

        // this.outlinePass = new OutlinePass(
        //     new THREE.Vector2(10, 10),
        //     this.foregroundScene,
        //     this.camera
        // );

        // // Outline look
        // this.outlinePass.visibleEdgeColor.set(0x000000);
        // this.outlinePass.hiddenEdgeColor.set(0x000000);
        // this.outlinePass.edgeStrength = 6;
        // this.outlinePass.edgeThickness =2
        // this.outlinePass.pulsePeriod = 0; // no pulsing
        // this.outlinePass.edgeGlow = 0;

        // this.composer.addPass(this.outlinePass);

        // this.fxaaPass = new ShaderPass(FXAAShader);
        // this.composer.addPass(this.fxaaPass);
    }


    setOutlinedObject(obj) {
        if (!this.outlinePass) return;
        this.outlinePass.selectedObjects = obj ? [obj] : [];
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

            this.setOutlinedObject(selectedModelClone);

            // let outline = model.clone();
            // const outlineMat = new THREE.MeshBasicMaterial({
            //     color: 0x000000,
            //     side: THREE.BackSide, // draw backfaces
            // });
            // outline.scale.setScalar(1.03);
            // outline.material = outlineMat;
            // tGroup.add(outline);
        
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




    getViewSizeAtZ(z) {
        if (this.useOrtho) {
            return this.camera.__size || [this.clientWidth, this.clientHeight];
        } else {
            return super.getViewSizeAtZ(z);
        }
    }


    resize(e) {
        super.resize(e);
        let { width, height } = e[0].contentRect;
        this.resizeOrtho(width, height);
        this.resizeComposer(width, height);
        this.resizeColumn(20);
    }

    resizeOrtho(w, h) {
        if (this.useOrtho) {
            let oldCamPos = this.camera.position.toArray();
            this.camera = new THREE.OrthographicCamera(w / -2, w / 2, h / 2, h / -2, this.cameraNear, this.cameraFar);
            this.camera.position.set(...oldCamPos);
            this.camera.__size = [w, h];
        }
    }

    resizeComposer(w, h) {
        if (w > 0 && h > 0 && this.composer) {
            console.log(`Resizing composer to ${w}x${h}`);
            this._compReady = true;

            const dpr = Math.min(2, window.devicePixelRatio || 1);
            
            this.composer.setPixelRatio(dpr);
            this.composer.setSize(w, h);
            this.outlinePass.setSize(w, h);

            this.renderPass.camera = this.camera;
            this.outlinePass.renderCamera = this.camera;
            
          
            this.outlinePass.edgeThickness = 3* dpr;
            this.outlinePass.edgeStrength = 10;
            this.outlinePass.edgeGlow = 0;

            // FXAA needs inverse resolution in *pixels*
            if (this.fxaaPass?.material?.uniforms?.resolution) {
                this.fxaaPass.material.uniforms.resolution.value.set(
                1 / (w * dpr),
                1 / (h * dpr)
                );
            }
        }
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
        if (this.composer && !this._compReady) {
            return 
        }
        this.renderer.autoClear = false;
        this.renderer.clear();
        this.renderer.render(this.backgroundScene, this.camera);
        this.renderer.clearDepth(); // 🔑 key line
        if (this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.foregroundScene, this.camera);
        }
        this.renderer.clearDepth(); // 🔑 key line
        this.renderer.render(this.scene, this.camera);
    }

    set modelXRotation(value) {
        let m = new THREE.Matrix4().makeRotationX(value);
        this.selectedContainer.applyMatrix4(m);
    }
    get modelXRotation() {
        return 0;
    }

    set modelYRotation(value) {
        let m = new THREE.Matrix4().makeRotationY(value);
        this.selectedContainer.applyMatrix4(m);
    }
    get modelYRotation() {
        return 0;
    }

    set modelZRotation(value) {
        let m = new THREE.Matrix4().makeRotationZ(value);
        this.selectedContainer.applyMatrix4(m);
    }
    get modelZRotation() {
        return 0;
    }


}


customElements.define("model-viewer", ModelViewer)