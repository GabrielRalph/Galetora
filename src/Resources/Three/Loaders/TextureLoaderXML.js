import { ImageLoaderXML } from './ImageLoaderXML.js';
import { Texture } from '../three.js';
import { LoaderPlus } from './loader.js';

/**
 * Class for loading textures. Images are internally
 * loaded via {@link ImageLoader}.
 *
 * ```js
 * const loader = new THREE.TextureLoader();
 * const texture = await loader.loadAsync( 'textures/land_ocean_ice_cloud_2048.jpg' );
 *
 * const material = new THREE.MeshBasicMaterial( { map:texture } );
 * ```
 * Please note that `TextureLoader` has dropped support for progress
 * events in `r84`. For a `TextureLoader` that supports progress events, see
 * [this thread](https://github.com/mrdoob/three.js/issues/10439#issuecomment-293260145).
 *
 * @augments Loader
 */
class TextureLoaderXML extends LoaderPlus {

	/**
	 * Constructs a new texture loader.
	 *
	 * @param {LoadingManager} [manager] - The loading manager.
	 */
	constructor( manager ) {

		super( manager );

	}

	/**
	 * Starts loading from the given URL and pass the fully loaded texture
	 * to the `onLoad()` callback. The method also returns a new texture object which can
	 * directly be used for material creation. If you do it this way, the texture
	 * may pop up in your scene once the respective loading process is finished.
	 *
	 * @param {string} url - The path/URL of the file to be loaded. This can also be a data URI.
	 * @param {function(Texture)} onLoad - Executed when the loading process has been finished.
	 * @param {onProgressCallback} onProgress - Executed while the loading is in progresses. Argument will be an XMLHttpRequest instance, which contains total and loaded bytes.
	 * @param {onErrorCallback} onError - Executed when errors occur.
	 * @return {Texture} The texture.
	 */
	load( url, onLoad, onProgress, onError ) {

		const texture = new Texture();

		const loader = new ImageLoaderXML( this.manager );
		loader.setCrossOrigin( this.crossOrigin );
		loader.setPath( this.path );

		loader.load( url, function ( image ) {

			texture.image = image;
			texture.needsUpdate = true;

			if ( onLoad !== undefined ) {

				onLoad( texture );

			}

		}, onProgress, onError );

		return texture;

	}

}


export { TextureLoaderXML };
