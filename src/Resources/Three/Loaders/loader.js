import {
	Loader,
} from "../three.js";

class LoaderPlus extends Loader {

    constructor( manager ) {
        super( manager );
    }

    static async load(url, onProgress) {
        const loader = new this();
        return await loader.loadAsync(url, onProgress)
    }
}

export { LoaderPlus };