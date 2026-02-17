import {
	BufferAttribute,
	BufferGeometry,
	FileLoader,
} from "../three.js";
import { LoaderPlus } from "./loader.js";

const DEBUG = false;
function log(...args) {
    args = args.map(a => a+"").join(" ");
    if (DEBUG) console.log("%c" + args, "background: #222; color: #bada55; padding: 5px; border-radius: 5px");
}

/**
 * VNFLoader - loads VNF files, which are a custom binary format for storing 3D models. The format is as follows:
 * - 79 byte: header
 * - 1 byte: flags 
 *      - bit 0 = useU16:  uint16 for vertex indices (if not set, uint32 is used).
 *      - bit 1 =  useVN:  includes vertex normals.
 * 
 * - (2|4) bytes: number of vertices (uint16|uint32, depending on flag)
 * - (2|4) bytes: number of faces (uint16|uint32, depending on flag)
 * 
 * - vertex data
 *    - 12 bytes: vertex position (float32 x 3)
 * 
 * - if useVN flag is set, vertex normal data follows vertex position data
 *   - 12 bytes: vertex normal (float32 x 3)
 * 
 * - face data
 *  - 3 * (2|4) bytes: vertex indices for each face (uint16|uint32, depending on flag)
 * 
 */


// function getFloat32LE(buffer, byteOffset, count) {
//     return new Float32Array(buffer, byteOffset, count);

//     const view = new DataView(buffer, byteOffset);
//     const out = new Float32Array(count);
//     for (let i = 0; i < count; i++) {
//         out[i] = view.getFloat32(i * 4, true);
//     }
    
//     return out;
// }

class VNFLoader extends LoaderPlus {

	constructor( manager ) {
		super( manager );
	}

	load( url, onLoad, onProgress, onError ) {
		const scope = this;
		const loader = new FileLoader( this.manager );
		loader.setPath( this.path );
		loader.setResponseType( 'arraybuffer' );
		loader.setRequestHeader( this.requestHeader );
		loader.setWithCredentials( this.withCredentials );
		loader.load( url, function ( text ) {
			try {
				onLoad( scope.parse( text ) );
			} catch ( e ) {
				if ( onError ) {
					onError( e );
				} else {
					console.error( e );
				}
				scope.manager.itemError( url );
			}
		}, onProgress, onError );
	}


    // ensureBinary( buffer ) {
    //     if ( typeof buffer === 'string' ) {
    //         const array_buffer = new Uint8Array( buffer.length );
    //         for ( let i = 0; i < buffer.length; i ++ ) {
    //             array_buffer[ i ] = buffer.charCodeAt( i ) & 0xff; // implicitly assumes little-endian
    //         }
    //         return array_buffer.buffer || array_buffer;
    //     } else {
    //         return buffer;
    //     }
    // }

	parse( data ) {
        if (!(data instanceof ArrayBuffer) && !(data instanceof Uint8Array)) {
            throw new Error("VNFLoader: data must be an ArrayBuffer or Uint8Array");
        }

        const reader = new DataView( data );

        const flagByte = reader.getUint8(79, true);
        const useU16 = (flagByte & 1) !== 0;
        const useVN = (flagByte & 2) !== 0;
        const cS = useU16 ? 2 : 4;
        const getCountType = useU16 ? reader.getUint16.bind(reader) : reader.getUint32.bind(reader);
        
        const nV = getCountType(80, true);
        const nF = getCountType(80 + cS, true);

        log(`countType: ${useU16 ? "uint16" : "uint32"}`)
        log(`useVertexNormals: ${useVN}`)
        log(`vertexCount: ${nV}`);
        log(`faceCount: ${nF}`);
        const hE = (80+2*cS);


        const vertices = new Float32Array(data, hE, nV * 3);

        const normals = useVN ? new Float32Array(data, hE + nV * 12, nV * 3) : null;

        const cI = hE + nV * 12 * (useVN ? 2 : 1);

        const indices = new (useU16 ? Uint16Array : Uint32Array)(data, cI, nF * 3);

        const geometry = new BufferGeometry();
        geometry.setAttribute( 'position', new BufferAttribute( vertices, 3 ) );

        log("Created geometry with vertex count:", vertices.length / 3);

        if (normals) {
            geometry.setAttribute("normal", new BufferAttribute(normals, 3));
            log("Added normals to geometry with count:", normals.length / 3);
        }

        geometry.setIndex(new BufferAttribute(indices, 1));
        log("Added indices to geometry with count:", indices.length);

        geometry.computeBoundingSphere();
        geometry.computeBoundingBox();

        geometry.header = data.slice(0, 79);

        return geometry;
	}
}

export {  VNFLoader };