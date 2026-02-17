import {
	Loader,
} from "../three.js";

class LoaderPlus extends Loader {

    constructor( manager ) {
        super( manager );
    }

    async loadAsync( url, onProgress) {
        return new Promise((resolve, reject) => {
            this.load(url, resolve, onProgress, reject);
        });
    }
}

export { LoaderPlus };