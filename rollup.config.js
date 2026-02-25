import terser from '@rollup/plugin-terser';

import fs from 'fs';
import path from 'path';

const outputDir = 'POISSONS-BUTTONS/build';



// Delete all files in dist (synchronously)
if (fs.existsSync(outputDir)) {
  fs.readdirSync(outputDir).forEach(file => {
    const filePath = path.join(outputDir, file);
    fs.unlinkSync(filePath);
  });
}

export default {
	input: 'POISSONS-BUTTONS/index.js',
	output: {
		dir: outputDir,
		format: 'es',
        plugins: [terser()]
	},
};
