import * as THREE from './three.js';

async function loadShader(url) {
    let shader = null;
    let res = await fetch(url);
    if (res.ok) {
        let text = await res.text();
        let values = text.split(/\/\/\s*~~(\w+)~~/g);
        
        shader = {};
        for (let i = 1; i < values.length; i+=2) {
            shader[values[i]] = values[i + 1].trim();
        }
    }
    return shader;
}


const shaders = {
    vertexShader: `
precision highp float;

uniform vec3 uLightDir;
uniform mat4 modelMatrixInverse;

attribute vec3 iPosition;
attribute vec3 iNormal;
attribute vec3 iColor;

varying vec3 vNorm;     // Provided normal of point
varying vec3 sNorm;     // Normal of sphere shape
varying vec3 vLightDir; // Direction to light source
varying vec3 vColor;    // Provided color of point

void main() {
    vNorm = normalize(iNormal);
    sNorm = normalize(normal);
    vColor = iColor;
    vLightDir = normalize((modelMatrixInverse * vec4(uLightDir, 0.0)).xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4( iPosition + position, 1.0 );
}
    `,
    fragmentShader: `
float lerp(float a, float b, float t) {
    return a + (b - a) * t;
}

precision highp float;

uniform vec3 uColor;    // Default color if no per-point color is provided
uniform float ambient; // ambient light intensity
uniform float lightIntensity; // directional light intensity
uniform int mode; // bit 0: 1 = use point color attribute, 0 = use default color uniform
                  // bit 1: 1 = use atribute and sphere normals, 0 = use sphere normals only

varying vec3 vNorm;     // Provided normal of point
varying vec3 sNorm;     // Normal of sphere shape
varying vec3 vLightDir; // Direction to light source
varying vec3 vColor;    // Provided color of point

void main() {
    float vnInt = ((mode & 1) == 0) ? lightIntensity : lerp(ambient, lightIntensity, clamp(dot(vNorm, vLightDir), 0.0, 1.0));

    float snInt = (1.0 + round(max(dot(sNorm, vLightDir), 0.0) * 2.0)) / 3.0; 
    // float snInt = clamp(dot(sNorm, vLightDir), 0.0, 1.0);
    float lInt = vnInt * snInt;

    vec4 shadedColor = vec4(0, 0, 0, (0.5 - lInt) / 0.5);
    if (lInt > 0.5) {
        shadedColor = vec4(1.0, 1.0, 1.0, (lInt - 0.5) / 0.5);
    }

    vec3 litColor = ((mode & 2) == 0) ? mix(uColor, shadedColor.rgb, shadedColor.a) : mix(vColor, shadedColor.rgb, shadedColor.a);
    
    gl_FragColor = vec4(litColor, 1.0);
}`
}

function parseVectors(points) {
    if (!(points instanceof Float32Array)) {
        if (Array.isArray(points)) {
            if (Array.isArray(points[0])) {
                points = new Float32Array(points.flat());
            } else if (typeof points[0] === 'number') {
                points = new Float32Array(points);
            } else {
                throw new Error('Invalid points array format.');
            }
        } else {
            throw new Error('Points must be a Float32Array or an array.');
        }
    }

    if (points.length % 3 !== 0) {
        throw new Error('Points array length must be a multiple of 3.');
    }

    return points;
}

class PointCloudGeometry extends THREE.InstancedBufferGeometry {
    constructor(points, normals, colors, pointGeometry) {
        super();
        this.copy(pointGeometry); 
        this.instanceCount = points.length / 3;
        if (!(points instanceof THREE.InstancedBufferAttribute)) {
            points = new THREE.InstancedBufferAttribute(points, 3);
        }
        if (!(normals instanceof THREE.InstancedBufferAttribute)) {
            normals = new THREE.InstancedBufferAttribute(normals, 3);
        }
        if (!(colors instanceof THREE.InstancedBufferAttribute)) {
            colors = new THREE.InstancedBufferAttribute(colors, 3);
        }
        this.setAttribute('iPosition', points);
        this.setAttribute('iNormal', normals);
        this.setAttribute('iColor', colors);
    }
}

const VOXEL_SHAPE_MESH = {
    vertices: [3,3,-5,3,5,-3,5,3,-3,-3,3,-5,-5,3,-3,-3,5,-3,3,-3,-5,5,-3,-3,3,-5,-3,3,3,5,5,3,3,3,5,3,-3,-3,-5,-3,-5,-3,-5,-3,-3,-3,3,5,-3,5,3,-5,3,3,3,-3,5,3,-5,3,5,-3,3,-3,-3,5,-5,-3,3,-3,-5,3],
    faces: [0,1,2,3,4,5,6,7,8,9,10,11,10,2,11,11,2,1,12,13,14,15,16,17,16,5,17,17,5,4,18,19,20,19,8,20,20,8,7,10,9,20,20,9,18,21,22,23,13,23,14,14,23,22,18,21,19,19,21,23,22,21,17,17,21,15,15,9,16,16,9,11,4,3,14,14,3,12,12,6,13,13,6,8,7,6,2,2,6,0,0,3,1,1,3,5,16,11,5,5,11,1,7,2,20,20,2,10,9,15,18,18,15,21,22,17,14,14,17,4,13,8,23,23,8,19,3,0,12,12,0,6],
}
const PointGeometries = {
    sphere(size, res = 16) {
        return new THREE.SphereGeometry(size, res, res);
    },
    voxel(size) {
        const geometry = new THREE.BufferGeometry();
        const vertices = new Float32Array(VOXEL_SHAPE_MESH.vertices.map(n => n * size / 10));
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geometry.setIndex(VOXEL_SHAPE_MESH.faces);
        geometry.computeVertexNormals();
        return geometry;
    }
}

export class PointCloud extends THREE.Mesh {
    constructor(points, options, size = 0.1) {
        if (!options) options = {};
        points = parseVectors(points);
        let n = points.length / 3;
        
        let mode = 0;
        let colors = null;
        try { 
            colors = parseVectors(options.colors || []);
            if (colors.length !== n * 3) throw new Error('Colors array length must match number of points.');
            mode |= 2; // Use per-point colors
        } catch (e) {
            colors = new Float32Array(n * 3);
        }

        let normals = null;
        try {
            normals = parseVectors(options.normals || []);
            if (normals.length !== n * 3) throw new Error('Normals array length must match number of points.');
            mode |= 1; // Use provided normals
        } catch (e) {
            normals = new Float32Array(n * 3);
        }

        let makeGeometry = PointGeometries.sphere
        if (options.geometryType in PointGeometries) {
            makeGeometry = PointGeometries[options.geometryType]
        }

        let color = new THREE.Color(0xff0000);
        if (options.color) {
            if (options.color instanceof THREE.Color) {
                color.copy(options.color);
            } else if (Array.isArray(options.color)) {
                color.setRGB(...options.color);
            } else if (typeof options.color === "number") {
                color.setHex(options.color);
            }
        }
        
        const material = new THREE.ShaderMaterial({
            uniforms: {
                mode: { value: mode },
                uColor: { value: color },
                ambient: { value: 0.25 },
                lightIntensity: { value: 0.8 },
                modelMatrixInverse: { value: new THREE.Matrix4() },
                uLightDir: { value: new THREE.Vector3(1, 1, 1).normalize() },
            },
            ...shaders,
            transparent: true,
            depthWrite: true,
        });

        const sphereGeometry = makeGeometry(size);

        const geoRepeat = new PointCloudGeometry(points, normals, colors, sphereGeometry);
      
        super(geoRepeat, material);
        this._size = size;
        this._sphereGeometry = sphereGeometry;
        this.frustumCulled = false; // Prevent disappearing when zoomed out
        this._geometryMaker = makeGeometry
    }

    /**
     * Set the size of the point cloud spheres.
     * @param {number} size - The new size for the spheres.
     */
    set size(size) {
        // Create new sphere geometry with the updated size
        this._sphereGeometry = this._geometryMaker(size);
        
        // Dispose old geometry
        this.geometry.dispose();

        // Recreate instanced geometry with the same attributes
        this.geometry = new PointCloudGeometry(
            this.geometry.attributes.iPosition,
            this.geometry.attributes.iNormal,
            this.geometry.attributes.iColor,
            this._sphereGeometry
        );
    }

    set points(points) {
        points = parseVectors(points);
        this.geometry.dispose();
        this.geometry = new PointCloudGeometry(
            points,
            new Float32Array(points.length), 
            new Float32Array(points.length), 
            this._sphereGeometry
        );
        this.material.uniforms.mode.value = 0; // Reset mode since colors and normals are now gone
    }

    /**
     * Set the color of the point cloud.
     * @param {THREE.Color|Array} color - The new color for the point cloud.
     */
    set color(color) {
        if (!(color instanceof THREE.Color)) {
            color = new THREE.Color(...color);
        }
        this.material.uniforms.uColor.value.copy(color);
    }

    set colors(colors) {
        colors = parseVectors(colors);
        if (colors.length !== this.geometry.attributes.iColor.count * 3) {
            throw new Error('Colors array length must match number of points.');
        }
        this.geometry.setAttribute('iColor', new THREE.InstancedBufferAttribute(colors, 3));
        this.material.uniforms.mode.value |= 1; // Enable per-point colors
    }

    set normals(normals) {
        normals = parseVectors(normals);
        if (normals.length !== this.geometry.attributes.iNormal.count * 3) {
            throw new Error('Normals array length must match number of points.');
        }
        this.geometry.setAttribute('iNormal', new THREE.InstancedBufferAttribute(normals, 3));
        this.material.uniforms.mode.value |= 2; // Enable provided normals
    }

    /**
     * Set the light direction for the point cloud.
     * @param {THREE.Vector3|Array} dir - The new light direction.
     */
    set lightDirection(dir) {
        if (!(dir instanceof THREE.Vector3)) {
            dir = new THREE.Vector3(...dir);
        }
        this.material.uniforms.uLightDir.value.copy(dir).normalize();
    }

    update() {
        this.material.uniforms.modelMatrixInverse.value.copy(this.matrixWorld).invert();
    }
}
