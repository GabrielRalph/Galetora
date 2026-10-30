import { getSegments } from "./segments.js";
import { offsetSubpath } from "./offset.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const DEFAULT_TOLERANCE = 20; // degrees
const DEFAULT_OFFSET = 10; // mm

// Paths in these elements are not drawn directly, so they are left untouched.
const NON_RENDERED = "defs, clipPath, mask, symbol, marker, pattern";

const LINE_STYLE = [
  "fill:none",
  "stroke-width:2px",
  "stroke-linecap:round",
  "stroke-linejoin:round",
  "vector-effect:non-scaling-stroke",
].join(";");

const LABEL_STYLE = [
  "font-family:system-ui,sans-serif",
  "font-weight:600",
  "text-anchor:middle",
  "dominant-baseline:central",
  "stroke-linejoin:round",
  "paint-order:stroke",
].join(";");


/* -------------------------------- Units -------------------------------- */

const MM_PER = { mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72, pc: 25.4 / 6, px: 25.4 / 72, "": 25.4 / 72 };
const LENGTH_REGEX = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*(mm|cm|in|pt|pc|px)?\s*$/i;

// An svg length attribute in mm, or null for relative units (%, em) or none.
function lengthInMm(value) {
  let match = LENGTH_REGEX.exec(value || "");
  if (match == null) return null;
  let mm = parseFloat(match[1]) * MM_PER[(match[2] || "").toLowerCase()];
  return mm > 0 ? mm : null;
}

function parseViewBox(svg) {
  let box = (svg.getAttribute("viewBox") || "").split(/[\s,]+/).map(parseFloat);
  return box.length === 4 && !box.some(Number.isNaN) && box[2] > 0 && box[3] > 0 ? box : null;
}

// The svg's viewBox, or one from its width and height if it has none.
function viewBoxOf(svg) {
  let box = parseViewBox(svg);
  if (box != null) return box;
  let width = lengthInMm(svg.getAttribute("width"));
  let height = lengthInMm(svg.getAttribute("height"));
  return width != null && height != null ? [0, 0, width * UNITS_PER_MM, height * UNITS_PER_MM] : null;
}

// Size of a millimetre in svg user units (points, 72 per inch).
const UNITS_PER_MM = 72 / 25.4;

/* Scale from an element's coordinates to the root svg's user units, from the
   transforms on it and its ancestors. Non-uniform scales are averaged. */
function transformScale(element, root) {
  let scale = 1;
  for (let e = element; e != null && e !== root; e = e.parentNode) {
    let matrix = e.transform?.baseVal?.consolidate()?.matrix;
    if (matrix) scale *= Math.sqrt(Math.abs(matrix.a * matrix.d - matrix.b * matrix.c));
  }
  return scale > 0 ? scale : 1;
}


/* ------------------------------ Segments ------------------------------ */

// Evenly spread hues using the golden angle so neighbours contrast.
function segmentColor(i) {
  return `hsl(${(i * 137.508) % 360}, 80%, 45%)`;
}

function cubicPoint([p0, p1, p2, p3], t) {
  let u = 1 - t;
  let a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
}

// Point halfway along the curves, by approximate arc length.
function midpoint(cubics) {
  const STEPS = 16;
  let points = [cubicPoint(cubics[0].points, 0)];
  for (let cubic of cubics) {
    for (let i = 1; i <= STEPS; i++) points.push(cubicPoint(cubic.points, i / STEPS));
  }
  let lengths = [0];
  for (let i = 1; i < points.length; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  let half = lengths[lengths.length - 1] / 2;
  let i = lengths.findIndex(l => l >= half);
  if (i <= 0) return points[0];
  let t = (half - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1);
  let [a, b] = [points[i - 1], points[i]];
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

const SHAPES = "path, polygon, polyline";
const NUMBER_REGEX = /[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi;

/* Path data of a shape element. Polygons and polylines become a line through
   their points, closed for polygons. */
function shapeData(element) {
  if (element.localName === "path") return element.getAttribute("d") || "";

  let numbers = (element.getAttribute("points") || "").match(NUMBER_REGEX) || [];
  let points = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) points.push(`${numbers[i]},${numbers[i + 1]}`);
  if (points.length < 2) return "";
  return `M${points.join("L")}${element.localName === "polygon" ? "Z" : ""}`;
}

/* Parses the svg and replaces every path, polygon and polyline with a group of its segments, each
   stroked in its own colour. Returns the modified document, the groups with
   their subpaths and size of a mm in their coordinates, and a flat list of
   all segments. */
function buildModel(svgText, tolerance) {
  let doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  let svg = doc.documentElement;
  if (doc.querySelector("parsererror") || svg.localName !== "svg") {
    throw new Error("The selected file is not a valid SVG.");
  }

  let model = { doc, svg, paths: [], segments: [] };
  let paths = [...svg.querySelectorAll(SHAPES)].filter(p => !p.closest(NON_RENDERED));

  // label size in root user units, relative to the drawing's size
  let box = viewBoxOf(svg);
  let fontSize = box ? Math.max(box[2], box[3]) / 50 : 12;

  paths.forEach((path, pathIndex) => {
    let subpaths;
    try {
      subpaths = getSegments(shapeData(path), tolerance);
    } catch (e) {
      console.warn("Skipping path with invalid data:", path, e);
      return;
    }

    let unitsPerMm = UNITS_PER_MM / transformScale(path, svg);
    let group = doc.createElementNS(SVG_NS, "g");
    if (path.hasAttribute("transform")) {
      group.setAttribute("transform", path.getAttribute("transform"));
    }

    let labelSize = fontSize / transformScale(path, svg);
    let labels = [];
    let number = 1;
    for (let subpath of subpaths) {
      for (let segment of subpath.segments) {
        segment.index = model.segments.length;
        segment.color = segmentColor(segment.index);
        segment.label = `P${pathIndex + 1}-S${number++}`;
        model.segments.push(segment);

        let element = doc.createElementNS(SVG_NS, "path");
        element.setAttribute("d", segment.d);
        element.setAttribute("style", `${LINE_STYLE};stroke:${segment.color}`);
        element.setAttribute("data-segment", segment.index);
        group.append(element);

        if (segment.cubics.length > 0) {
          let { x, y } = midpoint(segment.cubics);
          let label = doc.createElementNS(SVG_NS, "text");
          label.setAttribute("x", x);
          label.setAttribute("y", y);
          label.setAttribute("style",
            `${LABEL_STYLE};font-size:${labelSize}px;stroke-width:${labelSize / 4}px;fill:${segment.color}`);
          label.setAttribute("data-segment", segment.index);
          label.textContent = segment.index + 1;
          labels.push(label);
        }
      }
    }
    // labels go above all of the path's lines
    group.append(...labels);

    path.replaceWith(group);
    model.paths.push({ path, group, subpaths, unitsPerMm });
  });

  return model;
}

/* Grows the svg's viewBox by pad on every side, returning a function that
   restores it. */
function padViewBox(svg, pad) {
  let original = svg.getAttribute("viewBox");
  let box = viewBoxOf(svg);

  if (box != null && pad > 0) {
    let [x, y, w, h] = box;
    svg.setAttribute("viewBox", `${x - pad} ${y - pad} ${w + 2 * pad} ${h + 2 * pad}`);
  }

  return () => {
    if (original == null) svg.removeAttribute("viewBox");
    else svg.setAttribute("viewBox", original);
  };
}

/* Serialized copy of the original svg with an offset path added after every
   path, each segment offset by offsets[segment.index] mm. */
function offsetSvg(model, offsets) {
  // show the original paths in place of their segment groups
  model.paths.forEach(({ path, group }) => group.replaceWith(path));

  let added = [];
  for (let { path, subpaths, unitsPerMm } of model.paths) {
    let d = "";
    for (let subpath of subpaths) {
      try {
        let distances = subpath.segments.map(s => (offsets[s.index] || 0) * unitsPerMm);
        d += offsetSubpath(subpath, distances);
      } catch (e) {
        console.warn("Could not offset subpath:", subpath, e);
      }
    }
    if (d === "") continue;

    let element = model.doc.createElementNS(SVG_NS, "path");
    element.setAttribute("d", d);
    element.setAttribute("style", `${LINE_STYLE};stroke:#111`);
    if (path.hasAttribute("transform")) {
      element.setAttribute("transform", path.getAttribute("transform"));
    }
    path.after(element);
    added.push(element);
  }

  let largest = Math.max(0, ...model.segments.map(s => Math.abs(offsets[s.index] || 0)));
  let restore = padViewBox(model.svg, largest * UNITS_PER_MM * 2);
  let text = new XMLSerializer().serializeToString(model.svg);
  restore();
  added.forEach(element => element.remove());
  model.paths.forEach(({ path, group }) => path.replaceWith(group));

  return { text, count: added.length };
}


/* --------------------------------- UI --------------------------------- */

let source = null; // { name, text } of the loaded svg
let model = null;
let offsets = [];

function el(tag, props = {}, children = []) {
  let element = Object.assign(document.createElement(tag), props);
  element.append(...children);
  return element;
}

// Object url for svg text, revoking the previous url held under key.
const urls = {};
function svgUrl(key, text) {
  if (urls[key]) URL.revokeObjectURL(urls[key]);
  urls[key] = text == null ? null : URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
  return urls[key];
}

function show(img, link, key, text, filename) {
  let url = svgUrl(key, text);
  if (url == null) {
    img?.removeAttribute("src");
    link.hidden = true;
  } else {
    if (img) img.src = url;
    link.href = url;
    link.download = filename;
    link.hidden = false;
  }
}

function baseName() {
  return source.name.replace(/\.svg$/i, "");
}

const fileInput = el("input", { type: "file", accept: ".svg,image/svg+xml", hidden: true });
const loadButton = el("button", { textContent: "Load SVG" });
const toleranceInput = el("input", {
  type: "number", min: 0, max: 180, step: 1, value: DEFAULT_TOLERANCE,
});
const status = el("span");

const originalImg = el("img", { alt: "Original SVG" });
const segmentsView = el("div", { className: "segments-view" });
const segmentsLink = el("a", { className: "download-link", hidden: true });
const offsetImg = el("img", { alt: "Offset SVG" });
const offsetLink = el("a", { className: "download-link", hidden: true });

const setAllInput = el("input", { type: "number", step: "any", value: DEFAULT_OFFSET });
const setAllButton = el("button", { textContent: "Set all" });
const offsetList = el("div", { className: "offset-list" });
const generateButton = el("button", { textContent: "Generate offset", disabled: true });


document.body.append(
  el("div", { className: "controls" }, [
    loadButton,
    fileInput,
    el("label", {}, ["Corner tolerance (°) ", toleranceInput]),
    status,
  ]),
  el("div", { className: "panels" }, [
    el("div", {className: "input"}, [el("h2", { textContent: "Original" }), originalImg]),
    el("div", {className: "segments"}, [el("h2", {}, ["Segments", segmentsLink]), segmentsView]),
    el("div", {className: "offsets"}, [
      el("h2", { textContent: "Offsets" }),
    //   el("p", {
    //     className: "hint",
    //     textContent: "Offsets are in millimetres (1 mm = 2.8346 SVG units). Positive " +
    //                  "offsets go outward on closed shapes and to the right of the " +
    //                  "drawing direction on open ones.",
    //   }),
      el("div", { className: "row" }, [el("label", {}, [setAllInput, " mm"]), setAllButton]),
      generateButton,
      offsetList,
    ]),
    el("div", {className: "output"}, [el("h2", {}, ["Offset path", offsetLink]), offsetImg]),
  ]),
);

let offsetInputs = [];

function renderOffsetList() {
  offsetInputs = [];
  offsetList.replaceChildren(...model.segments.map(segment => {
    let input = el("input", { type: "number", step: "any", value: offsets[segment.index] });
    input.addEventListener("input", () => {
      offsets[segment.index] = parseFloat(input.value) || 0;
    });
    offsetInputs[segment.index] = input;
    return el("label", {}, [
      el("span", {
        className: "swatch", style: `background:${segment.color}`, textContent: segment.index + 1,
      }),
    //   el("span", { textContent: segment.label }),
      input,
      "mm",
    ]);
  }));
}

/* Shows the model's svg inline so its segments can be clicked, with a wider
   invisible stroke behind each segment to make it easier to hit. */
function renderSegmentsView() {
  if (model == null) return segmentsView.replaceChildren();
  let svg = document.importNode(model.svg, true);
  let box = viewBoxOf(svg);
  if (box != null) svg.setAttribute("viewBox", box.join(" "));
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  for (let line of svg.querySelectorAll("path[data-segment]")) {
    let hit = line.cloneNode();
    hit.classList.add("hit");
    line.before(hit);
  }
  segmentsView.replaceChildren(svg);
}

segmentsView.addEventListener("click", event => {
  let target = event.target.closest("[data-segment]");
  let input = target && offsetInputs[target.getAttribute("data-segment")];
  if (input == null) return;
  input.scrollIntoView({ block: "nearest" });
  input.focus();
  input.select();
});

// Rebuilds the segments, keeping entered offsets by segment number.
function update() {
  if (source == null) return;

  let tolerance = parseFloat(toleranceInput.value);
  if (Number.isNaN(tolerance)) tolerance = DEFAULT_TOLERANCE;

  show(offsetImg, offsetLink, "offset", null);
  try {
    model = buildModel(source.text, tolerance);
    offsets = model.segments.map((_, i) => offsets[i] ?? 0);
    originalImg.src = svgUrl("original", source.text);
    let text = new XMLSerializer().serializeToString(model.svg);
    show(null, segmentsLink, "segments", text, `${baseName()}-segments.svg`);
    status.textContent = `${model.paths.length} paths, ${model.segments.length} segments`;
  } catch (e) {
    console.error(e);
    model = null;
    offsets = [];
    originalImg.removeAttribute("src");
    show(null, segmentsLink, "segments", null);
    status.textContent = e.message;
  }

  renderSegmentsView();
  if (model) renderOffsetList();
  else offsetList.replaceChildren();
  generateButton.disabled = model == null || model.segments.length === 0;
}

loadButton.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async () => {
  let file = fileInput.files[0];
  if (file == null) return;
  source = { name: file.name, text: await file.text() };
  offsets = [];
  fileInput.value = "";
  update();
});

toleranceInput.addEventListener("input", update);

setAllButton.addEventListener("click", () => {
  if (model == null) return;
  let value = parseFloat(setAllInput.value) || 0;
  offsets = offsets.map(() => value);
  renderOffsetList();
});

generateButton.addEventListener("click", () => {
  if (model == null) return;
  let { text, count } = offsetSvg(model, offsets);
  show(offsetImg, offsetLink, "offset", text, `${baseName()}-offset.svg`);
  status.textContent = `${model.paths.length} paths, ${model.segments.length} segments, ` +
                       `${count} offset paths`;
});
