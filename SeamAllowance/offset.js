import { CubicBezier, Vector } from "./dpath.js";
import { cubicTangents } from "./segments.js";

const MAX_DEPTH = 6;    // subdivisions of a cubic while fitting its offset
const MITER_LIMIT = 4;  // longest corner extension, in multiples of the offset
const EPS = 1e-6;

function cross(a, b) {
  return a.x * b.y - a.y * b.x;
}

// Normal of a tangent: the right hand side of travel in svg's y down space.
function normal(tangent) {
  return new Vector(-tangent.y, tangent.x).dir();
}

function offsetPoint(cubic, t, d) {
  let gradient = cubic.getGradient(t);
  if (gradient == null || gradient.isZero) return null;
  return cubic.getPoint(t).add(normal(gradient).mul(d));
}

// Distance from point q to the cubic, searching parameters near t.
function distanceNear(cubic, q, t, window = 0.25) {
  let best = { s: t, dist: cubic.getPoint(t).dist(q) };
  for (let step = window / 4; step > 1e-4; step /= 4) {
    let centre = best.s;
    for (let k = -4; k <= 4; k++) {
      let s = Math.min(1, Math.max(0, centre + k * step));
      let dist = cubic.getPoint(s).dist(q);
      if (dist < best.dist) best = { s, dist };
    }
  }
  return best.dist;
}

/* Approximates the offset of a cubic by distance d with cubics. The end points
   are offset exactly, the handles keep their directions and are scaled to
   match the offset at the midpoint. Halves the curve until every sampled
   point of the fit lies within tolerance of distance |d| from the curve. */
function offsetCubic(cubic, d, tolerance, depth = 0) {
  if (d === 0) return [cubic];

  let [p0, p1, p2, p3] = cubic.points;
  let [t0, t3] = cubicTangents(cubic);
  if (t0 == null) return [];

  let q0 = p0.add(normal(t0).mul(d));
  let q3 = p3.add(normal(t3).mul(d));
  let h0 = p1.sub(p0), h3 = p2.sub(p3);

  let scale = 1;
  let mid = offsetPoint(cubic, 0.5, d);
  let h = h0.add(h3);
  if (mid != null && h.dot(h) > EPS) {
    scale = mid.sub(q0.lurpTo(q3, 0.5)).dot(h) / (0.375 * h.dot(h));
  }

  let fit = new CubicBezier(q0, q0.add(h0.mul(scale)), q3.add(h3.mul(scale)), q3);

  if (depth < MAX_DEPTH) {
    let error = 0;
    for (let t of [0.2, 0.4, 0.6, 0.8]) {
      let dist = distanceNear(cubic, fit.getPoint(t), t);
      error = Math.max(error, Math.abs(dist - Math.abs(d)));
    }

    if (error > tolerance) {
      let [a, b] = cubic.split(0.5);
      return [
        ...offsetCubic(a, d, tolerance, depth + 1),
        ...offsetCubic(b, d, tolerance, depth + 1),
      ];
    }
  }

  return [fit];
}

function sample(cubic, n) {
  let points = [];
  for (let i = 0; i <= n; i++) points.push(cubic.getPoint(i / n));
  return points;
}

// Parameters [t, u] where line segments p1p2 and q1q2 cross, or null.
function segmentIntersection(p1, p2, q1, q2) {
  let r = p2.sub(p1), s = q2.sub(q1);
  let den = cross(r, s);
  if (Math.abs(den) < 1e-12) return null;
  let pq = q1.sub(p1);
  let t = cross(pq, s) / den;
  let u = cross(pq, r) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [t, u] : null;
}

/* Where the end of chain a crosses the start of chain b, searching the last
   and first few cubics of each. Picks the crossing nearest the joint. */
function findCrossing(a, b, pieces = 4, n = 16) {
  let best = null;
  for (let i = a.length - 1; i >= Math.max(0, a.length - pieces); i--) {
    let pa = sample(a[i], n);
    for (let j = 0; j < Math.min(b.length, pieces); j++) {
      let pb = sample(b[j], n);
      for (let x = 0; x < n; x++) {
        for (let y = 0; y < n; y++) {
          let hit = segmentIntersection(pa[x], pa[x + 1], pb[y], pb[y + 1]);
          if (hit == null) continue;
          let ta = (x + hit[0]) / n, tb = (y + hit[1]) / n;
          let score = (a.length - 1 - i) + (1 - ta) + j + tb;
          if (best == null || score < best.score) best = { i, j, ta, tb, score };
        }
      }
    }
  }
  return best;
}

/* Joins chain a (an array of cubics) to chain b. Overlapping chains are
   trimmed where they cross, otherwise the gap is closed by extending both
   tangents to where they meet (within limit), or failing that a straight line.
   Returns the points to draw lines through from the end of a. */
function join(a, b, limit) {
  let pa = a[a.length - 1].points[3];
  let pb = b[0].points[0];
  if (pa.dist(pb) <= EPS) return [];

  if (a !== b) {
    let crossing = findCrossing(a, b);
    if (crossing != null) {
      let { i, j, ta, tb } = crossing;
      a.splice(i + 1);
      a[i] = a[i].split(ta)[0];
      b.splice(0, j);
      b[0] = b[0].split(tb)[1];
      return [];
    }
  }

  let ta = cubicTangents(a[a.length - 1])[1];
  let tb = cubicTangents(b[0])[0];
  if (ta != null && tb != null) {
    ta = ta.dir();
    tb = tb.dir();
    let den = cross(ta, tb);
    if (Math.abs(den) > 1e-9) {
      let x = pa.add(ta.mul(cross(pb.sub(pa), tb) / den));
      let forward = x.sub(pa).dot(ta) > -EPS && pb.sub(x).dot(tb) > -EPS;
      if (forward && x.dist(pa) <= limit && x.dist(pb) <= limit) return [x, pb];
    }
  }

  return [pb];
}

// Signed area of the closed loop through the cubics, positive if clockwise on screen.
function signedArea(cubics) {
  let points = cubics.flatMap(c => sample(c, 8).slice(0, -1));
  let area = 0;
  points.forEach((p, i) => area += cross(p, points[(i + 1) % points.length]));
  return area / 2;
}

function isStraight(cubic) {
  let [p0, p1, p2, p3] = cubic.points;
  let chord = p3.sub(p0);
  let length = chord.norm();
  if (length < EPS) return false;
  let tolerance = length * 1e-6;
  return Math.abs(cross(p1.sub(p0), chord)) / length < tolerance &&
         Math.abs(cross(p2.sub(p0), chord)) / length < tolerance;
}

/* Path data of a subpath (see getSegments) with each segment offset by the
   matching entry of offsets. Positive offsets go outward on closed subpaths
   and to the right of the drawing direction on open ones. */
export function offsetSubpath({ closed, segments }, offsets) {
  let sign = closed && signedArea(segments.flatMap(s => s.cubics)) > 0 ? -1 : 1;

  let chains = [];
  segments.forEach((segment, i) => {
    let d = sign * (offsets[i] || 0);
    let tolerance = Math.max(Math.abs(d) * 2e-3, 1e-3);
    for (let cubic of segment.cubics) {
      // drop curves that collapse to a point, e.g. an arc offset by its radius
      let cubics = offsetCubic(cubic, d, tolerance).filter(c => cubicTangents(c)[0] != null);
      if (cubics.length > 0) chains.push({ cubics, d });
    }
  });
  if (chains.length === 0) return "";

  let n = chains.length;
  let connectors = chains.map((chain, i) => {
    if (i === n - 1 && !closed) return [];
    let next = chains[(i + 1) % n];
    let limit = MITER_LIMIT * Math.max(Math.abs(chain.d), Math.abs(next.d));
    return join(chain.cubics, next.cubics, limit);
  });

  const f = (v) => v.toString(3);
  let d = `M${f(chains[0].cubics[0].points[0])}`;
  chains.forEach((chain, i) => {
    for (let cubic of chain.cubics) {
      let [, p1, p2, p3] = cubic.points;
      d += isStraight(cubic) ? `L${f(p3)}` : `C${f(p1)} ${f(p2)} ${f(p3)}`;
    }
    for (let x of connectors[i]) d += `L${f(x)}`;
  });
  if (closed) d += "Z";

  return d;
}
