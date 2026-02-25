import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";


function isLocalAsset(url, rootDir) {
    const absPath = path.relative(process.cwd(), path.resolve(rootDir, url));
    if (fs.existsSync(absPath)) {
        return absPath;
    }
    return null;
}

function isLocalJSModule(url, rootDir) {
    const absPath = path.relative(process.cwd(), path.resolve(rootDir, url));
    if (fs.existsSync(absPath) && path.extname(absPath) === '.js') {
        return absPath;
    }

    return null;
}

function findLocalScripts(string, rootDir) {
    let matches = string.matchAll(/\.{0,2}\/.+?\.js/g);
    if (matches) {
        return [...matches].map(match => {
            let absPath = isLocalJSModule(match[0], rootDir)
            if (absPath) {
                return {path: absPath, match: match[0]};
            } else {
                return null
            }
        }).filter(a => a);
    }
}

function lookForLocalScripts(html, fileName) {
    const dir = path.dirname(fileName);
    const $ = cheerio.load(html);
    const scripts = $("script");
    const localScripts = [];

    scripts.each((_, script) => {
        if (script.attribs.type === "module") {
            const src = script.attribs.src;
            if (src) {
                const localModule = isLocalJSModule(src, dir);
                if (localModule) {
                    localScripts.push({path: localModule, match: src});
                }
            } 

            const innerHTML = $(script).html();
            if (innerHTML) {
                const foundModules = findLocalScripts(innerHTML, dir);
                localScripts.push(...foundModules);
            }
        }
    });

    return localScripts;
}

function lookForLocalAssets(html, fileName) {
    const dir = path.dirname(fileName);
    const $ = cheerio.load(html);
    const localAssets = [];

    // look at every element except script tags
    $("*:not(script)").each((_, element) => {
        const attribs = element.attribs || {};
        for (const attr in attribs) {
            const value = attribs[attr];
            if (typeof value === "string") {
                const localAsset = isLocalAsset(value, dir);
                if (localAsset) {
                    localAssets.push({path: localAsset, match: value});
                }
            }
        }
    })

    $("style").each((_, style) => {
        const css = $(style).html();
        const urlRegex = /url\((.*?)\)/g;
        let match;
        while ((match = urlRegex.exec(css)) !== null) {
            const url = match[1].replace(/['"]/g, ""); // remove quotes
            const localAsset = isLocalAsset(url, dir);
            if (localAsset) {
                localAssets.push({path: localAsset, match: url});
            }
        }
    });

    return localAssets;
}

export function lookForLocalAssetsAndScripts(fileName) {
    const html = fs.readFileSync(fileName, "utf-8");
    return {
        assets: lookForLocalAssets(html, fileName),
        scripts: lookForLocalScripts(html, fileName)
    }
}

export function lookForAllHTMLFiles(dir, titleRegex = /^index$/) {
    let htmlFiles = [];
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            htmlFiles = htmlFiles.concat(lookForAllHTMLFiles(fullPath));
        } else if (path.extname(fullPath) === ".html") {
            let name = path.basename(fullPath, ".html");
            if (titleRegex.test(name)) {
                htmlFiles.push(path.relative(process.cwd(), fullPath));
            }
        }
    }
    return htmlFiles;
}

export function lookForAssetsInCSS(css, fileName) {
    const dir = path.dirname(fileName);
    const urlRegex = /url\((.*?)\)/g;
    let match;
    const localAssets = [];
    while ((match = urlRegex.exec(css)) !== null) {
        const url = match[1].replace(/['"]/g, ""); // remove quotes
        const localAsset = isLocalAsset(url, dir);
        if (localAsset) {
            localAssets.push({path: localAsset, match: url});
        }
    }
    return localAssets;
}





