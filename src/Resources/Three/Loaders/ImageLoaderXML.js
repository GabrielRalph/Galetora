import { FileLoader } from "../three.js";
import { LoaderPlus } from "./loader.js";


/**
 * ImageLoaderXML - loads images using XMLHttpRequest and creates HTMLImageElement objects.
 */
export class ImageLoaderXML extends LoaderPlus {
	constructor( manager ) {
		super( manager );
	}

	load( url, onLoad, onProgress, onError ) {
		const loader = new FileLoader( this.manager );
		loader.setPath( this.path );
		loader.setResponseType( 'blob' );
		loader.setRequestHeader( this.requestHeader );
		loader.setWithCredentials( this.withCredentials );
		loader.load( url, async function ( data ) {
            let image = new Image();
            let url = URL.createObjectURL(data);
            image.onload = () => {
                URL.revokeObjectURL(url);
                onLoad(image);
            }
            image.src = url;
			
		}, onProgress, onError );
	}
	
}