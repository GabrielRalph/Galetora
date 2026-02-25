import terser from '@rollup/plugin-terser';

import fs from 'fs';
import path from 'path';
import { lookForAllHTMLFiles, lookForAssetsInCSS, lookForLocalAssetsAndScripts } from './build-scripts/search-html.js';
import { colorText, relURLAssetPlugin } from './build-scripts/relURLAssetPlugin.js';

const outputDir = 'public';

if (fs.existsSync(outputDir)) {
  fs.rmSync(outputDir, { recursive: true, force: true });
}
fs.mkdirSync(outputDir, { recursive: true });

const indexHTMLs = lookForAllHTMLFiles(process.cwd(), /^index$/);

// Map: inputFile -> desiredOutputPathInPublic
const scriptsToProcess = {};

function copyAssets(assets, outDir) {
  for (const e of assets) {
    const newAssetPath = path.join(outDir, e.match);
    const newAssetDir = path.dirname(newAssetPath);
    if (!fs.existsSync(newAssetPath)) {
      fs.mkdirSync(newAssetDir, { recursive: true });
      fs.copyFileSync(e.path, newAssetPath);
      console.log(`${colorText("Coppied asset", 212)}: ${e.path} -> ${newAssetPath}`);

      // If the asset is a CSS file, also look for assets referenced inside it and copy those
      if (path.extname(e.path).toLowerCase() === ".css") {
        const assets = lookForAssetsInCSS(fs.readFileSync(e.path, "utf-8"), e.path);
        copyAssets(assets, newAssetDir);
      }
    }
  }
}

for (let i = 0; i < indexHTMLs.length; i++) {
  const oldPath = indexHTMLs[i];
  const dir = path.dirname(oldPath);
  const newPath = path.join(outputDir, oldPath);
  const newDir = path.join(outputDir, dir);

  fs.mkdirSync(newDir, { recursive: true });
  fs.copyFileSync(oldPath, newPath);

  const { scripts, assets } = lookForLocalAssetsAndScripts(oldPath);

  // Track scripts (but do NOT build per-script)
  for (const e of scripts) {
    const desiredOutFile = path.join(newDir, e.match); // where it should land under /public
    scriptsToProcess[e.path] = desiredOutFile;
  }

  // Copy assets referenced directly in HTML (this is separate from relURL-emitted assets)
  copyAssets(assets, newDir);
}


// Build ONE input object whose keys encode the output path (relative to /public)
const input = Object.fromEntries(
  Object.entries(scriptsToProcess).map(([inFile, outFile]) => {
    // key becomes output "name"; Rollup will create folders from slashes in the name
    const name = path
      .relative(outputDir, outFile)
      .replace(/\\/g, '/')          // windows safety
      .replace(/\.js$/i, '');       // entryFileNames will add .js
    return [name, inFile];
  })
);

export default {
  input,

  output: {
    dir: outputDir,
    format: 'es',

    // write entries to their intended paths under /public
    entryFileNames: `[name].js`,

    // put shared code in ONE global place (prevents per-page duplicates)
    chunkFileNames: `src/chunks/[name]-[hash].js`,

    // put ALL emitted assets in ONE global place (prevents duplicates across entries)
    assetFileNames: `Assets/[name]-[hash][extname]`,

    // keep terser as output plugin if you want
    plugins: [terser()],
  },

  plugins: [relURLAssetPlugin()],
};