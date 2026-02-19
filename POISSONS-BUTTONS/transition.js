import * as THREE from "../src/Resources/Three/three.js";

function matrixToPRS(matrix) {
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    matrix.decompose(position, quaternion, scale);
    return [position, quaternion, scale];
}


class TransitionVariable {
    _progress = 1;
    _transitionTime = 1;
    name = "";
    _promiseResolvers = [];

    constructor(name) {this.name = name;}

    get t() {
        return this.transitionFunction instanceof Function ? 
                    this.transitionFunction(this._progress) : this._progress;
    }

    get value() {
        return this.copyValue(this._value);
    }

    get goal() {
        return this.copyValue(this._goal);
    }

    get start() {
        return this.copyValue(this._start);
    }

    copyValue(value) {
        return value;
    }

    parseValue(value) {
        return value;
    }

    isSameValue(a, b) {
        return a === b;
    }

    valueToString(value) {
        return value;
    }

    interpolateValue(start, goal, t) {
        return start + (goal - start) * t;
    }

    setGoal(goal, start, transitionTime = this._transitionTime) {
        this._transitionTime = transitionTime;
        goal = this.parseValue(goal);
        start = this.parseValue(start || this.value);

        let isSame = this.isSameValue(goal, this._goal);
        if (!isSame) {
            if (this.log) console.log(`Setting goal ${this.name}`, this.valueToString(goal), "from", this.valueToString(start));
            this._goal = goal;
            this._start = start;
            this._value = this.copyValue(start);
            this._progress = 0;
            this._lastTime = window.performance.now();
        }
    }

    update() {
        let updated = false;
        if (this._progress < 1) {
            let dt = (window.performance.now() - this._lastTime) / 1000;
            this._progress += dt / this._transitionTime;
            if (this._progress > 1) this._progress = 1;

            this._value = this.interpolateValue(this._start, this._goal, this.t);
            if (this.log) console.log(this.name, this.valueToString(this._value), "Progress", (this._progress * 100).toFixed(1) + "%");
            updated = true;

            if (this._progress === 1) {
                if (this.onComplete) this.onComplete();
                for (let resolver of this._promiseResolvers) {
                    resolver(this.value);
                }
                this._promiseResolvers = [];
                this._goal = null;
            }
        }
        this._lastTime = window.performance.now();
        return updated;
    }

    async waitTransition() {
        if (this._progress < 1) {
            await new Promise(resolve => {
                this._promiseResolvers.push(resolve);
            });
        }
    }
}


class TransitionVector3 extends TransitionVariable {
    copyValue(value) {
        return value ? value.clone() : null;
    }

    parseValue(value) {
       if (typeof value === "number") {
            return new THREE.Vector3(value, value, value);
        } else if (Array.isArray(value)) {
            return new THREE.Vector3(...value);
        } else if (value instanceof THREE.Vector3) {
            return value.clone();
        } else if (value instanceof THREE.Euler) {
            return new THREE.Vector3(value.x, value.y, value.z);
        }
        console.error("Invalid vector format", value);
        throw new Error("Invalid vector format");
    }

    isSameValue(a, b) {
        return a && b && a.distanceTo(b) < 1e-5;
    }

    valueToString(value) {
        return `(${value.x.toFixed(2)}, ${value.y.toFixed(2)}, ${value.z.toFixed(2)})`;
    }

    interpolateValue(start, goal, t) {
        return start.clone().lerp(goal, t);
    }
}

class TransitionQuaternion extends TransitionVariable {
    copyValue(value) {
        return value ? value.clone() : null;
    }

    parseValue(value) {
        if (value instanceof THREE.Quaternion) {
            return value.clone();
        } else if (Array.isArray(value) && value.length === 4) {
            return new THREE.Quaternion(...value);
        } else if (Array.isArray(value) && value.length === 3) {
            const euler = new THREE.Euler(...value);
            return new THREE.Quaternion().setFromEuler(euler);
        } else if (value instanceof THREE.Euler) {
            return new THREE.Quaternion().setFromEuler(value);
        } else if (value instanceof THREE.Vector3) {
            const euler = new THREE.Euler(value.x, value.y, value.z);
            return new THREE.Quaternion().setFromEuler(euler);
        }
        console.error("Invalid quaternion format", value);
        throw new Error("Invalid quaternion format");
    }

    isSameValue(a, b) {
        return a && b && 1 - Math.abs(a.dot(b)) < 1e-5;
    }

    valueToString(value) {
        return `(${value.x.toFixed(2)}, ${value.y.toFixed(2)}, ${value.z.toFixed(2)}, ${value.w.toFixed(2)})`;
    }

    interpolateValue(start, goal, t) {
        const result = new THREE.Quaternion();
        result.slerpQuaternions(start, goal, t);
        return result;
    }
}



export class TransitionGroup extends THREE.Group {
    transitionVariables = {
        position: new TransitionVector3("Position"),
        rotation: new TransitionQuaternion("Rotation"),
        scale: new TransitionVector3("Scale"),
    }

    transitionTime = 0.05;

    constructor(transitionTime) {
        super();
        if (transitionTime) this.transitionTime = transitionTime;
    }

    set goalPosition(pos) {
        this.transitionVariables.position.setGoal(pos, this.position, this.transitionTime);
    }

    set goalScale(scale) {
        this.transitionVariables.scale.setGoal(scale, this.scale, this.transitionTime);
    }

    set goalRotation(rot) {
        this.transitionVariables.rotation.setGoal(rot, this.quaternion, this.transitionTime);
    }

    set goalMatrix(matrix) {
        let [pos, rot, scale] = matrixToPRS(matrix);
        this.goalPosition = pos;
        this.goalRotation = rot;
        this.goalScale = scale;
    }

    set matrixPRS(matrix) {
        let [pos, rot, scale] = matrixToPRS(matrix);
        this.position.copy(pos);
        this.quaternion.copy(rot);
        this.scale.copy(scale);
    }

    set transitionFunction(func) {
        for (let key in this.transitionVariables) {
            this.transitionVariables[key].transitionFunction = func;
        }
    }


    async waitTransition() {
        await Promise.all(Object.values(this.transitionVariables).map(v => v.waitTransition()));
    }


    update() {
        const {position, rotation, scale} = this.transitionVariables;
        if (position.update()) this.position.copy(position.value);

        if (rotation.update()) {
            this.quaternion.copy(rotation.value);
        } 
        if (scale.update()) this.scale.copy(scale.value);
    }

    updateMatrixWorld(force) {
        this.update();
        super.updateMatrixWorld(force);
    }
}