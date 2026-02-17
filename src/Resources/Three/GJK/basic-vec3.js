/**
 * @typedef {[number, number, number]} Vec3
 */

/**
 * @param {Vec3} a
 * @param {Vec3} b
 * 
 * @return {number}
 */
function dot(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }

/**
 * @param {Vec3} a
 * @param {Vec3} b
 * 
 * @return {Vec3}
 */
function cross(a,b){ return [a[1]*b[2]-b[1]*a[2], b[0]*a[2]-a[0]*b[2], a[0]*b[1]-b[0]*a[1]] }

/**
 * @param {Vec3} a
 * 
 * @return {number}
 */
function norm(a) { return (a[0]**2 + a[1]**2 + a[2]**2)**0.5; }

/**
 * @param {Vec3} a
 * 
 * @return {Vec3}
 */
function normalise(a) {
    let n = norm(a);
    return [a[0]/n, a[1]/n, a[2]/n]
}

/**
 * @param {Vec3|number} a
 * @param {Vec3|number} b
 * 
 * @return {Vec3}
 */
function add(a, b){
    switch((typeof a === "number" ? 'n' : 'v') + (typeof b === "number" ? 'n' : 'v')) {
        case "vv": return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
        case "nv": return [a + b[0], a + b[1], a + b[2]];
        case "vn": return [a[0] + b, a[1] + b, a[2] + b];
        case "nn": return [a+b, a+b, a+b];
    }
}

/**
 * @param {Vec3|number} a
 * @param {Vec3|number} b
 * 
 * @return {Vec3}
 */
function sub(a, b){
    switch((typeof a === "number" ? 'n' : 'v') + (typeof b === "number" ? 'n' : 'v')) {
        case "vv": return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
        case "nv": return [a - b[0], a - b[1], a - b[2]];
        case "vn": return [a[0] - b, a[1] - b, a[2] - b];
        case "nn": return [a-b, a-b, a-b];
    }
}

/**
 * @param {Vec3|number} a
 * @param {Vec3|number} b
 * 
 * @return {Vec3}
 */
function mul(a, b){
    switch((typeof a === "number" ? 'n' : 'v') + (typeof b === "number" ? 'n' : 'v')) {
        case "vv": return [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
        case "nv": return [a * b[0], a * b[1], a * b[2]];
        case "vn": return [a[0] * b, a[1] * b, a[2] * b];
        case "nn": return [a*b, a*b, a*b];
    }
}

/**
 * @param {Vec3|number} a
 * @param {Vec3|number} b
 * 
 * @return {Vec3}
 */
function div(a, b){
    switch((typeof a === "number" ? 'n' : 'v') + (typeof b === "number" ? 'n' : 'v')) {
        case "vv": return [a[0] / b[0], a[1] / b[1], a[2] / b[2]];
        case "nv": return [a / b[0], a / b[1], a / b[2]];
        case "vn": return [a[0] / b, a[1] / b, a[2] / b];
        case "nn": return [a/b, a/b, a/b];
    }
}



export {dot, cross, norm, normalise, add, sub, div, mul}
