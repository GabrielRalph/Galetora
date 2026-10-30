import { DPath } from "./dpath.js";

function firstNonZero(...vectors) {
  return vectors.find(v => !v.isZero) || null;
}

/* Tangent directions at the start and end of a cubic, or nulls if it has no
   length. Falls back through the control points so that coincident control
   points still give the true limiting tangent. */
export function cubicTangents(cubic) {
  let [p0, p1, p2, p3] = cubic.points;
  return [
    firstNonZero(p1.sub(p0), p2.sub(p0), p3.sub(p0)),
    firstNonZero(p3.sub(p2), p3.sub(p1), p3.sub(p0)),
  ];
}

// Length of a cubic's control polygon, an upper bound on its arc length.
function hullLength(cubic) {
  let [p0, p1, p2, p3] = cubic.points;
  return p0.dist(p1) + p1.dist(p2) + p2.dist(p3);
}

/* Length below which curves are ignored, relative to the size of the path.
   Rounded coordinates often leave a tiny gap that Z closes with a sliver of
   a line, which would otherwise become a segment of its own. */
const MIN_LENGTH_RATIO = 1e-5;

function minLength(cubics) {
  let xs = cubics.flatMap(c => c.points.map(p => p.x));
  let ys = cubics.flatMap(c => c.points.map(p => p.y));
  if (xs.length === 0) return 0;
  let size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  return size * MIN_LENGTH_RATIO;
}

// Turning angle in degrees from direction a to direction b.
export function turnAngle(a, b) {
  let cross = a.x * b.y - a.y * b.x;
  return Math.abs(Math.atan2(cross, a.dot(b))) * 180 / Math.PI;
}

/* Splits path data into segments joined at corners, i.e. where the tangent
   turns by more than tolerance degrees. On a closed subpath with no corner at
   its start, the first and last segments are joined.
   Returns the subpaths: [{ closed, segments: [{ d, cubics }] }], where d is
   the segment's path data and cubics the absolute curves tracing it. */
export function getSegments(d, tolerance) {
  let path = new DPath(d).makeAbsolute();
  let points = [...path];
  let all = points.map(p => p.cubics);
  let min = minLength(all.flat());
  let cubics = all.map(cs => cs.filter(c => cubicTangents(c)[0] != null && hullLength(c) > min));
  let subpaths = [];
  let subpath = null;

  const isCorner = (a, b) => turnAngle(a, b) > tolerance;
  const draws = ([a, b]) => b - a > 1 || points[a].cmd_TYPE !== "M";
  const toSegment = ([a, b]) => ({
    d: path.slice(a, b).toString(),
    cubics: cubics.slice(a, b).flat(),
  });

  const endSubpath = () => {
    if (subpath == null) return;
    let { ranges, firstIn, lastOut, closed } = subpath;
    let segments = ranges.filter(draws).map(toSegment);

    if (closed && segments.length > 1 && !isCorner(lastOut, firstIn)) {
      let first = segments.shift();
      let last = segments.pop();
      segments.unshift({
        // the first segment begins with the subpath's move, which is dropped
        d: last.d + first.d.replace(/^M[^A-Za-z]*/, ""),
        cubics: [...last.cubics, ...first.cubics],
      });
    }

    if (segments.length > 0) subpaths.push({ closed, segments });
    subpath = null;
  };

  points.forEach((point, i) => {
    let type = point.cmd_TYPE;
    if (type === "M") endSubpath();

    if (subpath == null) {
      subpath = { ranges: [[i, i + 1]], firstIn: null, lastOut: null, closed: false };
      if (type === "M") return;
    }

    let range = subpath.ranges[subpath.ranges.length - 1];
    if (cubics[i].length > 0) {
      let tin = cubicTangents(cubics[i][0])[0];
      let tout = cubicTangents(cubics[i][cubics[i].length - 1])[1];
      if (subpath.lastOut && isCorner(subpath.lastOut, tin)) {
        range = [i, i];
        subpath.ranges.push(range);
      }
      subpath.firstIn ??= tin;
      subpath.lastOut = tout;
    }
    range[1] = i + 1;

    if (type === "Z") {
      subpath.closed = subpath.firstIn != null;
      endSubpath();
    }
  });
  endSubpath();

  return subpaths;
}
