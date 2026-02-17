

import * as THREE from "./three.js";
function parseRGBA(rgb, width, height) {
    if (!(rgb instanceof Uint8Array)) {
        if (Array.isArray(rgb)) {
            if (Array.isArray(rgb[0])) {
                let i = 0;
                let data = new Uint8Array(width * height * 4);
                for (let row of rgb) {
                    for (let col of row) {
                        data[i++] = col[0];
                        data[i++] = col[1];
                        data[i++] = col[2];
                        data[i++] = (col.length > 3) ? col[3] : 255;
                    }
                }
            } else if (typeof rgb[0] === 'number') {
                rgb = new Uint8Array(rgb);
            } else {
                throw new Error('Invalid rgb array format.');
            }
        } else {
            throw new Error('rgb data must be a Uint8Array or an array.');
        }
    } 
    
    if (rgb.length !== width * height * 4) {
        throw new Error('RGBA array length must match width * height * 4.');
    }

    return rgb;
}

function createGradientFunction(gradient) { 
    return (t) => {
        for (let i = 1; i < gradient.locations.length; i++) {
            if (t <= gradient.locations[i].stop) {
                let loc0 = gradient.locations[i - 1];
                let loc1 = gradient.locations[i];
                let ratio = (t - loc0.stop) / (loc1.stop - loc0.stop);
                let r = Math.round(loc0.color[0] + ratio * (loc1.color[0] - loc0.color[0]));
                let g = Math.round(loc0.color[1] + ratio * (loc1.color[1] - loc0.color[1]));
                let b = Math.round(loc0.color[2] + ratio * (loc1.color[2] - loc0.color[2]));
                return [r, g, b];
            }
        }
        return gradient.locations[gradient.locations.length - 1].color;
    }
}

const HEATMAPS = {
    HEAT: createGradientFunction({
        locations: [
            {
                color: [0, 0, 0],
                stop: 0.0
            },
            {
                color: [255, 0, 0],
                stop: 0.45
            },
            {
                color: [248, 214, 52],
                stop: 0.75
            },
            {
                color: [252, 253, 244],
                stop: 1.0
            }
        ]
    })
}

const COLOR_MODES = {
    "RGBA": 0,
    0: "RGBA",
    "RGB": 1,
    1: "RGB",
    "Gray": 2,
    2: "Gray",
    "Heat": 3,
    3: "Heat"
}
export class ThreeImage extends THREE.Mesh {
    constructor(rgbData, width, height) {
        let rgba = parseRGBA(rgbData, width, height);
        
        const geometry = new THREE.PlaneGeometry( width, height );
        const texture = new THREE.DataTexture( rgba, width, height );
        const material = new THREE.MeshBasicMaterial( { map: texture, side: THREE.DoubleSide } );
        texture.needsUpdate = true;
        super( geometry, material );
    }

    setImageData(rgbData, width, height) {
        let rgba = parseRGBA(rgbData, width, height);
        this.geometry.dispose();
        this.geometry = new THREE.PlaneGeometry( width, height );
        this.material.map.image.data = rgba;
        this.material.map.image.width = width;
        this.material.map.image.height = height;
        this.material.map.needsUpdate = true;
    }

    static fromBuffer(uint8) {
        return new ThreeImage(...ThreeImage.extractFromBuffer(uint8));
    }

    static extractFromBuffer(uint8) {
        let dv = new DataView(uint8.buffer);
        let width = dv.getUint32(0, true);
        let height = dv.getUint32(4, true);
        let mode = dv.getUint8(8);
        console.log("%cImage width: " + width + ", height: " + height + ", mode: " + mode, "background: #222; color: #bada55");
        let rgba = null;
        if (!(mode in COLOR_MODES)) {
            throw new Error("Unsupported color mode: " + mode);
        } else {
            console.log("%cColor mode: " + COLOR_MODES[mode], "background: #222; color: #bada55");
            switch (COLOR_MODES[mode]) {
                case "RGBA":
                    rgba = uint8.slice(9);
                    break;

                case "RGB":
                    let rgb = uint8.slice(9);
                    rgba = new Uint8Array(width * height * 4);
                    for (let i = 0, j = 0; i < rgb.length; i += 3, j += 4) {
                        rgba[j] = rgb[i];
                        rgba[j + 1] = rgb[i + 1];
                        rgba[j + 2] = rgb[i + 2];
                        rgba[j + 3] = 255;
                    }
                    break;

                case "Gray":
                    let gray = uint8.slice(9);
                    rgba = new Uint8Array(width * height * 4);
                    for (let i = 0, j = 0; i < gray.length; i++, j += 4) {
                        rgba[j] = gray[i];
                        rgba[j + 1] = gray[i];
                        rgba[j + 2] = gray[i];
                        rgba[j + 3] = 255;
                    }
                    break;

                case "Heat":
                    let heat = new Float32Array(uint8.slice(9).buffer);
                    rgba = new Uint8Array(width * height * 4);
                    let heatmapFunc = HEATMAPS.HEAT;
                    for (let i = 0, j = 0; i < heat.length; i++, j += 4) {
                        let [r, g, b] = heatmapFunc(heat[i]);
                        rgba[j] = r;
                        rgba[j + 1] = g;
                        rgba[j + 2] = b;
                        rgba[j + 3] = 255;
                    }
            }
        }
        return [rgba, width, height];
    }
}