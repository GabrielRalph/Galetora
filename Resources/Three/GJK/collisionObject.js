import {Matrix3, Vector3, Matrix4} from "../three.js"
import { GJK } from "./gjk2.js";
// import { gjk } from "./gjk.js";

export class CollisionObject extends Float32Array{
    safetyMargin = 0.5;

    /** @param {{geomtry: Geometry}} obj */
    constructor(obj) {
        const positionAttribute = obj.geometry.getAttribute( 'position' );
        const n = positionAttribute.count;
        super(n * 3);

        let c = [0,0,0]
        for (let i = 0; i < n; i++) {
            let p = new Vector3();
            p.fromBufferAttribute( positionAttribute, i );
            // obj.localToWorld( p );
            this[i * 3] = p.x;
            this[i * 3 + 1] = p.y;
            this[i * 3 + 2] = p.z;
            c[0] += p.x;
            c[1] += p.y;
            c[2] += p.z;
        }
        c[0] /= n;
        c[1] /= n;
        c[2] /= n;

        let r = null;
        for (let i = 0; i < n; i++) {
            let r0 =  ((this[i * 3] - c[0])**2 + (this[i * 3+1] - c[1])**2 + (this[i * 3+2] - c[2])**2) ** 0.5;
            r = r == null || r0 > r ? r0 : r;
        }

        this.geometry=obj;
        this.count = n;
        this.c = new Vector3(...c);
        this.r = r;
        this.transform = new Matrix4().identity();
    }

    /** @param {Matrix4} m */
    set transform(m) {
        if (m instanceof Matrix4) {
            this._transform = m.clone();
            
        }
    }
    /** @returns {Matrix4} */
    get transform() {
        return this._transform;
    }

    /** @returns {Matrix3} */
    get inverseRotation(){
        let e = this.transform.elements;
        let rotation = new Matrix3();
        rotation.set(
            e[0], e[1], e[2],
            e[4], e[5], e[6],
            e[8], e[9], e[10]
        );
        return rotation;
    }

    /** @returns {Vector3} */
    get center(){
        let c = this.c.clone();
        c.applyMatrix4(this.transform);
        return c;
    }

    /** @returns {number} */
    get radius(){
        return this.r;
    }

    /** 
     * @param {CollisionObject} other 
     * @returns {boolean}
     * */
    checkRadialCollision(other) {
        let d = this.center.distanceTo(other.center);
        return d < (this.r + other.r);
    }

    /**
     *  @param {Vector3} dir 
     *  @returns {Vector3}
    */
    support(dir){
        dir = new Vector3(...dir);
        dir.applyMatrix3(this.inverseRotation);

        let maxDot = -Infinity;
        let mi = null;
        for (let i = 0; i < this.count; i++) {
            let dot = dir.x * this[i*3] + dir.y * this[i*3+1] + dir.z * this[i*3+2]
            if (dot > maxDot) {
                maxDot = dot;
                mi = i;
            }
        }

        let maxPoint = new Vector3(this[mi*3], this[mi*3+1], this[mi*3+2])
        maxPoint.applyMatrix4(this.transform);
        maxPoint = maxPoint.add(dir.clone().multiplyScalar(this.safetyMargin));
        return maxPoint; //[maxPoint.x, maxPoint.y, maxPoint.z] 
    }

    minDistance(other) {
        let minDist = null;
        for (let i = 0; i < this.count; i++) {
            let p1 = new Vector3(this[i*3], this[i*3+1], this[i*3+2]);
            p1.applyMatrix4(this.transform);
            for (let j = 0; j < other.count; j++) {
                let p2 = new Vector3(other[j*3], other[j*3+1], other[j*3+2]);
                p2.applyMatrix4(other.transform);
                let d = p1.distanceTo(p2);
                if (minDist == null || d < minDist) {
                    minDist = d;
                }
            }
        }
        return minDist
    }

    /**
     * @param {CollisionObject} other
     * @returns {boolean}
     */
    checkCollision(other) {
        if (this.checkRadialCollision(other)) {
            let support1 = this.support.bind(this);
            let support2 = other.support.bind(other);
            
            if (GJK(support1, support2)) {
                return true;
            }
        }
        return false;
    }

    async highlightGeometry(time = 2000) {
        let mesh = this.geometry
        mesh.material.opacity = 0.5;
        await new Promise((r) => setTimeout(r, time));
        mesh.material.opacity = 0;
    }

    /** @param {boolean} value */
    set highlight(value) {
        this.geometry.material.opacity = value ? 0.5 : 0;
    }
}
