export function relURL(url, meta) {
    const urlrel = new URL(url, meta.url);
    return urlrel.href;
}