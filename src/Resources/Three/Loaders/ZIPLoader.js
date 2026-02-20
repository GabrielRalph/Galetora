import { FileLoader } from "../three.js";
import { LoaderPlus } from "./loader.js";
import {STLLoader} from "./STLLoader.js";
import {OBJLoader} from "./OBJLoader.js";
import { VNFLoader } from "./VNFLoader.js";
import {
    Uint8ArrayWriter,
    Uint8ArrayReader,
    BlobReader,
    ZipReader,
} from "../zip/index.js";

const loaders = {
    "stl": STLLoader,
    "obj": OBJLoader,
    "vnf": VNFLoader,
}

const DEBUG = true;
function log(...args) {
    args = args.map(a => a+"").join(" ");
    if (DEBUG) console.log("%c" + args, "background: #222; color: #e0782e; padding: 5px; border-radius: 5px");
}

/**
 * ZIPLoader - loads ZIP files containing 3D models.
 */
class ZIPLoader extends LoaderPlus {

	constructor( manager ) {

		super( manager );

	}

	load( url, onLoad, onProgress, onError ) {
		const scope = this;
		const loader = new FileLoader( this.manager );
		loader.setPath( this.path );
		loader.setResponseType( 'blob' );
		loader.setRequestHeader( this.requestHeader );
		loader.setWithCredentials( this.withCredentials );
		loader.load( url, async function ( data ) {
			try {
				onLoad( await scope.parse( data ) );
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


	async parse( data ) {
        let zipFileReader = null;
		if (data instanceof Blob) {
            zipFileReader = new BlobReader(data);
        } else if (data instanceof ArrayBuffer) {
            const uint8Array = new Uint8Array(data);
            zipFileReader = new Uint8ArrayReader(uint8Array);
        } else {
            throw new Error("Unsupported data type for ZIPLoader: " + (typeof data));
        }


        const zipReader = new ZipReader(zipFileReader);
        const entries = await zipReader.getEntries();
        const files = entries.filter(entry => {
            if (entry.directory || entry.filename.startsWith("__MACOSX/")) return false;
            let lowercase = entry.filename.toLowerCase();
            let ext = lowercase.split(".").slice(-1)[0];
            entry.extension = ext;
            return ext in loaders;
        });

        let fileObjects = {};
        await Promise.all(files.map(async (entry) => {
            let name = entry.filename;
            let ext = entry.extension;
            let shortName = name.split("/").slice(-1)[0].replace(/\.[^/.]+$/, ""); // filename without extension
            let longName = name.split("/").slice(0, -1).join("/") + "/" + shortName; // path + filename without extension
            
            name = longName in fileObjects ? longName : shortName; // use short name if no conflict, otherwise use long name
            let fileData = await entry.getData(new Uint8ArrayWriter());
            let loader = new loaders[ext]();
            let object = await loader.parse(fileData.buffer);
            fileObjects[name] = object;
        }));
        return fileObjects;      
	}
}

export {  ZIPLoader };