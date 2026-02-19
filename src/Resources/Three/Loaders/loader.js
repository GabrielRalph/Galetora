import {
	Loader,
} from "../three.js";

class LoaderPlus extends Loader {

    constructor( manager ) {
        super( manager );
    }

    async loadAsync(url, onProgress) {
        return new Promise((resolve, reject) => {
            this.load(url, resolve, onProgress, reject);
        });
    }


    static async load(url, onProgress) {
        const loader = new this();
        return await loader.loadAsync(url, onProgress)
    }
}

export { LoaderPlus };