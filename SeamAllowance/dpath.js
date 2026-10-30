import { LinkItem, LinkList } from "./linklist.js";

let DecimalPlaces = 5;

const ZERO_TOLERENCE = 1e-8;

function sqr(v){return v*v}
const {abs, sqrt, sin, cos, ceil, floor, pow} = Math;
const {isNaN } = Number;
const { isArray } = Array;
function isNonNullObject(o){return o != null && typeof o === "object"}
function isNumber(v){return typeof v === "number"}
function isNonNaNNumber(v){return isNumber(v) && !isNaN(v)}
function round(num, dp = 0){
  let pow = isNonNaNNumber(dp) ? Math.pow(10, dp) : 1;
  return Math.round(num*pow)/pow;
}
function parseNumber(num) {
  return isNumber(num) ? num : parseFloat(num);
}

function isZero(num) {
  return abs(num) < ZERO_TOLERENCE;
}


function isNonEmptyString(string) {
  return typeof string === "string" && string.length > 0
}


const NUMBER_REGEX = /[\s,]*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/y;
const FLAG_REGEX = /[\s,]*([01])/y;

// Parses the parameters of a single path command. Arc flags may be written
// without separators (e.g. "a1 1 0 0110 10"), so they are read as single digits.
function parseParams(string, type) {
  let params = [];
  let isArc = isNonEmptyString(type) && type.toUpperCase() === "A";
  let pos = 0;
  while (true) {
    let regex = isArc && [3, 4].includes(params.length % 7) ? FLAG_REGEX : NUMBER_REGEX;
    regex.lastIndex = pos;
    let match = regex.exec(string);
    if (!match) break;
    params.push(parseFloat(match[1]));
    pos = regex.lastIndex;
  }

  if (/[^\s,]/.test(string.slice(pos))) {
    throw `Invalid path parameters: "${string}"`
  }

  return params;
}


function parseVector(x, y = x) {
  if (x instanceof Vector) {
    return x;
  } else {
    return new Vector(x, y);
  }
}

function isNonNaNVector(v) {
  return v instanceof Vector && !v.isNaN;
}

function cap(num, min, max) {
  if (num < min) num = min;
  if (num > max) num = max;
  return num;
}

function dotExt(constants, vectors) {
  let sum = new Vector(0);
  let i = 0;
  for (let constant of constants) {
    let v = parseVector(vectors[i]);
    sum = sum.add(v.mul(constant));
    i++;
  }
  return sum;
}


class NaNError extends Error {
  constructor(name, p = "'s") {
    super(`${name} of NaN vector${p}`)
  }
}

class Vector {
  constructor(x = 0, y = x){
    if (isArray(x)) {
      let i = isNonNaNNumber(y) ? y : 0;
      y = x[i+1];
      x = x[i];
    } else if (isNonNullObject(x)) {
      y = x.y;
      x = x.x;
    }

    this.x = x;
    this.y = y;
  }

  add(x = 0, y = x) {
    let v = parseVector(x, y);
    if (this.isNaN || v.isNaN)
      throw new NaNError("Addition")
    return new Vector(this._x + v.x, this._y + v.y)
  }
  sub(x = 0, y = x) {
    let v = parseVector(x, y);
    if (this.isNaN || v.isNaN)
      throw new NaNError("Subtraction");
    return new Vector(this._x - v.x, this._y - v.y)
  }
  mul(x = 0, y = x) {
    let v = parseVector(x, y);
    if (this.isNaN || v.isNaN)
      throw new NaNError("Multiplication");
    return new Vector(this._x * v.x, this._y * v.y)
  }
  div(x = 0, y = x) {
    let v = parseVector(x, y);
    if (this.isNaN || v.isNaN)
      throw new NaNError("Division");

    if (isZero(v.x) || isZero(v.y))
      throw new Error("Division by zero containing vector.");

    return new Vector(this._x / v.x, this._y / v.y)
  }
  dot(x = 0, y = x){
    let v = parseVector(x, y);
    if (this.isNaN || v.isNaN)
      throw new NaNError("Dot Product");
    return this._x * v.x + this._y * v.y
  }
  angleBetween(x = 0, y = x){
    let v = parseVector(x, y);
    let a = this.norm()
    let b = v.norm()
    let c = this.distance(v)
    if (isZero(a)|| isZero(b) || isZero(c)){
      return 0
    }
    return Math.acos((sqr(c) - sqr(a) - sqr(b))/(-2*a*b))
  }
  distance(x = 0, y = x){
    let v = parseVector(x, y);
    return v.sub(this).norm();
  }
  dist(x = 0, y = x){
    return this.distance(x, y)
  }
  addV(d) {
    d = parseNumber(d);
    if (isNaN(d) || this.isNaN)
      throw new NaNError("Vertical Addition");
    return new Vector(this._x, this._y + d);
  }
  addH(d) {
    d = parseNumber(d);
    if (isNaN(d) || this.isNaN)
      throw new NaNError("Horizontal Addition");
    return new Vector(this._x + d, this._y)
  }

  grad(){
    if (this.isNaN)
      throw new NaNError("Gradient", "")

    if (isZero(this._x)) return Infinity
    return this._y / this._x;
  }
  sqrt() {
    if (this.isNaN)
      throw new NaNError("Square Root", "");
    return new Vector(sqrt(this._x), sqrt(this._y))
  }
  norm(){
    if (this.isNaN)
      throw new NaNError("Normal length", "")
    return sqrt(sqr(this._y) + sqr(this._x))
  }
  arg(){
    if (this.isNaN)
      throw new NaNError("Argument", "")
    return Math.atan2(this._y, this._x);
  }
  dir(){
    let norm = this.norm();
    if(isZero(norm)) {
      return new Vector(0,0)
    }
    return this.div(norm)
  }
  rotate(theta){
    theta = parseNumber(theta);
    if (this.isNaN || isNaN(theta))
    throw new NaNError("Rotation", "")
    return new Vector(this._x*cos(theta) - this._y*sin(theta), this._x*sin(theta) + this._y*cos(theta))
  }
  lurpTo(v, d){
    v = parseVector(v);
    d = parseNumber(d);
    if (isNaN(d)) d = 0;
    if (d < 0) d = 0;
    if (d > 1) d = 1;

		return this.mul(1 - d).add(v.mul(d));
	}
  distToLine(p1, p2){
    p2 = parseVector(p2);
    let line = p2.sub(p1).rotate(Math.PI/2)
    let d = line.dot(this.sub(p1))/line.norm()
    return abs(d)
  }
  reflect(direction = 'V'){
    let newVector = null
    direction = direction.toUpperCase();
    if ( direction.indexOf('V') !== -1 ){
      newVector = this.mul(new Vector(1, -1));
    }

      if( direction.indexOf('H') !== -1 ){
      newVector = this.mul(new Vector(-1, 1));
    }
    return newVector;
  }

  floor(){
    return new Vector(floor(this._x), floor(this._y))
  }
  ceil(){
    return new Vector(ceil(this._x), ceil(this._y))
  }
  abs(){
    return new Vector(abs(this._x), abs(this._y))
  }

  round(n){
    return new Vector(round(this._x, n), round(this._y, n))
  }

  clone() {return new Vector(this._x, this._y)};

  toString(n = DecimalPlaces) {
    return `${round(this._x, n)},${round(this._y, n)}`
  }

  set x(v){
    let n = parseNumber(v);
    // console.log(n);
    this._x = n;
  }
  get x(){return this._x;}
  set y(v){ this._y = parseNumber(v); }
  get y(){return this._y;}
  get isNaN() {return isNaN(this._x) || isNaN(this._y)}
  get isZero(){return (isZero(this._x) && isZero(this._y))}

  static parseVector(...args) {return parseVector(...args);}
  static intersection(a1, b1, a2, b2, onSegment = true) {
    a1 = parseVector(a1);
    b1 = parseVector(b1);
    a2 = parseVector(a2);
    b2 = parseVector(b2);

  	// m = y/x
  	let m1 = b1.sub(a1).grad();
  	let m2 = b2.sub(a2).grad();
  	// c = y - mx
  	let c1 = a1.dot(-m1, 1);
  	let c2 = a2.dot(-m2, 1);

    let isec = new Vector(null);
    if (!isZero(m1 - m2)) {
      let x = (c2 - c1) / (m1 - m2);
      let y = m1 * x + c1;
      isec = new Vector(x, y);
    }

		if (!isec.isNaN) {
			let ab = b1.sub(a1);
			let ac = isec.sub(a1);
			let kac = ab.dot(ac);
			let kab = ab.dot(ab);
			if (!(kac > 0 && kab > kac) && onSegment) {
				isec = null;
			}
		} else {
      isec = null
    }

  	return isec;
  }
}




class CubicBezier {
  constructor(p1, t1, t2, p2) {
    this.points = [p1, t1, t2, p2];
  }

  getPoint(t) {
    try {
      let sum = new Vector(0);
      // compute constants
      t = cap(t, 0, 1);
      let t_1 = 1 - t;
      let tC = [
        pow(t_1, 3),
        3 * pow(t_1, 2) * t,
        3 * pow(t, 2) * t_1,
        pow(t, 3)
      ];

      sum = dotExt(tC, this.points);
      return sum;
    } catch (e) {
      return null;
    }
  }

  getGradient(t) {
    let sum = new Vector(0);
    try {
      // compute constants
      t = cap(t, 0, 1);
      let t_1 = 1 - t;

      let tC = [
         -3*pow(t_1, 2),
         -6*t*t_1 + 3*pow(t_1, 2),
         6*t*t_1 - 3*pow(t, 2),
         3*pow(t, 2)
      ];

      sum = dotExt(tC, this.points)
      return sum;
    } catch (e) {
      // console.log(e);
      return null;
    }

  }

  // Splits the curve at t using de Casteljau's algorithm.
  split(t) {
    let [p0, p1, p2, p3] = this.points.map(p => parseVector(p));
    let a = p0.lurpTo(p1, t), b = p1.lurpTo(p2, t), c = p2.lurpTo(p3, t);
    let d = a.lurpTo(b, t), e = b.lurpTo(c, t);
    let f = d.lurpTo(e, t);
    return [new CubicBezier(p0, a, d, f), new CubicBezier(f, e, c, p3)];
  }

  /* Cubic beziers approximating an absolute arc CPoint, one per quarter turn
     or less (see the svg spec's endpoint to center arc conversion). */
  static parseArc(cpoint) {
    if (!(cpoint instanceof CPoint) || !cpoint.isAbsolute) return [];

    let start = cpoint.last instanceof CPoint ? cpoint.last.p : new Vector(0);
    let end = cpoint.p;
    let line = new CubicBezier(start, start.lurpTo(end, 1/3), start.lurpTo(end, 2/3), end);
    if (start.sub(end).isZero) return [];

    let {x: rx, y: ry} = cpoint.r.abs();
    if (isZero(rx) || isZero(ry)) return [line];

    let phi = cpoint.x_axis_rotation * Math.PI / 180;
    let d = start.sub(end).div(2).rotate(-phi);

    // scale up radii that are too small to span the end points
    let lambda = sqr(d.x) / sqr(rx) + sqr(d.y) / sqr(ry);
    if (lambda > 1) {
      rx *= sqrt(lambda);
      ry *= sqrt(lambda);
    }

    let num = sqr(rx * ry) - sqr(rx * d.y) - sqr(ry * d.x);
    let den = sqr(rx * d.y) + sqr(ry * d.x);
    let k = sqrt(Math.max(0, num / den));
    if (cpoint.large_arc_flag === cpoint.sweep_flag) k = -k;

    let cp = new Vector(k * rx * d.y / ry, -k * ry * d.x / rx);
    let center = cp.rotate(phi).add(start.add(end).div(2));

    let u = new Vector((d.x - cp.x) / rx, (d.y - cp.y) / ry);
    let v = new Vector((-d.x - cp.x) / rx, (-d.y - cp.y) / ry);
    let theta = u.arg();
    let dtheta = Math.atan2(u.x * v.y - u.y * v.x, u.dot(v));
    if (!cpoint.sweep_flag && dtheta > 0) dtheta -= 2 * Math.PI;
    if (cpoint.sweep_flag && dtheta < 0) dtheta += 2 * Math.PI;

    let n = Math.max(1, ceil(abs(dtheta) / (Math.PI / 2) - 1e-9));
    let delta = dtheta / n;
    let alpha = 4 / 3 * Math.tan(delta / 4);
    let point = (t) => center.add(new Vector(rx * cos(t), ry * sin(t)).rotate(phi));
    let tangent = (t) => new Vector(-rx * sin(t), ry * cos(t)).rotate(phi).mul(alpha);

    let cubics = [];
    for (let i = 0; i < n; i++) {
      let t1 = theta + i * delta, t2 = t1 + delta;
      let p1 = i === 0 ? start : point(t1);
      let p2 = i === n - 1 ? end : point(t2);
      cubics.push(new CubicBezier(p1, p1.add(tangent(t1)), p2.sub(tangent(t2)), p2));
    }
    return cubics;
  }

  /* Cubic bezier of an absolute CPoint, starting at the end of the previous
     point in its path. Run DPath.makeAbsolute first so that H, V, Z, S and T
     points carry their full end point and implied control points.
     Returns null for moves, arcs (see parseArc) and relative points. */
  static parseCPoint(cpoint) {
    if (!(cpoint instanceof CPoint) || !cpoint.isAbsolute) return null;

    let start = cpoint.last instanceof CPoint ? cpoint.last.p : new Vector(0);
    let end = cpoint.p;
    switch (cpoint.cmd_TYPE) {
      case "M":
      case "A":
        return null;

      case "C":
      case "S":
        return new CubicBezier(start, cpoint.c1, cpoint.c2, end);

      // degree elevation of the quadratic
      case "Q":
      case "T":
        let q = cpoint.c1;
        return new CubicBezier(start, start.lurpTo(q, 2/3), end.lurpTo(q, 2/3), end);

      // L, H, V, Z: straight line
      default:
        return new CubicBezier(start, start.lurpTo(end, 1/3), start.lurpTo(end, 2/3), end);
    }
  }
}



class CPoint extends LinkItem {
  constructor(string){
    super();
    this.precision = 5;
    this.cmd_type = 'L';
    this._p = new Vector(0, 0);
    this._c1 = new Vector(0, 0);
    this._c2 = new Vector(0, 0);
    this._r = new Vector(0, 0);
    this._x_axis_rotation = 0;
    this._large_arc_flag = 0;
    this._sweep_flag = 0;
    this.cmd = string
  }

  clone(){
    let clone = new CPoint("Z");
    clone._p = this.p;
    clone._c1 = this.c1;
    clone._c2 = this.c2;
    clone._r = this.r;
    clone._x_axis_rotation = this._x_axis_rotation;
    clone._large_arc_flag = this._large_arc_flag;
    clone._sweep_flag = this._sweep_flag;
    clone.precision = this.precision;
    clone.cmd_type = this.cmd_type;
    return clone;
  }

  /* Set Svg Command Point
  svg-path-command: String
  String Format:
  'M x, y' or 'm dx, dy'
  'L x, y' or 'l dx, dy'
  'H x' or 'h dx'
  'V y' or 'v dy'
  'C x1, y1, x2, y2, x, y' or 'c dx1, dy1, dx2, dy2, dx, dy'
  'Q x1, y1, x, y' or 'q dx1 dy1, dx dy'
  'S x, y' or 's dx, dy'
  'T x, y' or 't dx, dy'
  'A rx ry x-axis-rotation large-arc-flag sweep-flag x y' or 'a rx ry x-axis-rotation large-arc-flag sweep-flag dx dy' */
  set cmd(value){
    // parse input
    let type = null;
    let params = [];
    if (isNonEmptyString(value)) {
      value = value.trim();
      type = value[0];
      params = parseParams(value.slice(1), type);
    } else if (Array.isArray(value)) {
      for (let param of value) {
        if (type == null) {
          type = param;
        } else if (isNonNaNVector(param)) {
          params.push(param.x);
          params.push(param.y);
        } else if (isNonNaNNumber(param)) {
          params.push(param)
        }
      }
    }

    // check type validity
    let typea = null;
    if (CPoint.isType(type)) {
      typea = type.toUpperCase();
      let nparams = CPoint.CMDS[typea];
      if (params.length != nparams) {
        throw `Error setting cmd: ${value} invalid parameters\n\texpected ${nparams} but ${params.length} where found.`
      }
    } else {
      throw 'invalid cpoint type'
    }

    // fill parameters
    switch (typea) {
      case "C":
      this.c1 = new Vector(params);
      this.c2 = new Vector(params, 2);
      this.p = new Vector(params, 4);
      break;

      case "H":
      this.p = new Vector(params[0], 0);
      this.c1 = this.p
      this.c2 = this.p
      break;

      case "V":
      this.p = new Vector(0, params[0]);
      this.c1 = this.p
      this.c2 = this.p
      break;

      case "S":
      this.c2 = new Vector(params);
      this.p = new Vector(params, 2);
      break;

      case "Q":
      this.c1 = new Vector(params);
      this.c2 = new Vector(params);
      this.p = new Vector(params, 2);
      break;

      case "A":
      this.r = new Vector(params);
      this.x_axis_rotation = params[2];
      this.large_arc_flag = params[3];
      this.sweep_flag = params[4];
      this.p = new Vector(params, 5);
      break;

      default:
      this.p = new Vector(params);
      this.c1 = this.p
      this.c2 = this.p
    }

    //If inputs where valid set cmd_type
    this.cmd_type = type;
  }
  get cmd(){
    return this.toString()
  }

  set cmd_type(type){
    if (CPoint.isType(type)){
      this._cmd_type = type;
    }else{
      this._cmd_type = null;
    }
  }
  get cmd_type(){
    return this._cmd_type;
  }
  get cmd_TYPE(){return this.cmd_type.toUpperCase()}

  get p(){
    return this._p.clone();
  }
  set p(v){
    if (isNonNaNVector(v)){
      this._p = v;
    }
  }
  get c1(){
    return this._c1.clone();
  }
  set c1(v){
    if (isNonNaNVector(v)){
      this._c1 = v;
    }
  }
  get c2(){
    return this._c2.clone();
  }
  set c2(v){
    if (isNonNaNVector(v)){
      this._c2 = v;
    }
  }
  get r(){
    return this._r.clone();
  }
  set r(v){
    if (isNonNaNVector(v)){
      this._r = v;
    }
  }
  get x_axis_rotation(){
    return this._x_axis_rotation;
  }
  set x_axis_rotation(angle){
    if (isNonNaNNumber(angle)){
      this._x_axis_rotation = angle;
    }else{
      this._x_axis_rotation = 0;
    }
  }
  get large_arc_flag(){
    return this._large_arc_flag;
  }
  set large_arc_flag(bool){
    if (bool){
      this._large_arc_flag = 1;
    }else{
      this._large_arc_flag = 0;
    }
  }
  get sweep_flag(){
    return this._sweep_flag;
  }
  set sweep_flag(bool){
    if (bool){
      this._sweep_flag = 1;
    }else{
      this._sweep_flag = 0;
    }
  }

  add(x, y){
    this.p = this.p.add(x, y);
    this.c1 = this.c1.add(x, y);
    this.c2 = this.c2.add(x, y);
  }
  sub(x = 0, y = x){
    this.p = this.p.sub(x, y);
    this.c1 = this.c1.sub(x, y);
    this.c2 = this.c2.sub(x, y);
  }
  div(x = 0, y = x){
    this.p = this.p.div(x, y);
    this.c1 = this.c1.div(x, y);
    this.c2 = this.c2.div(x, y);
  }
  mul(x = 0, y = x){
    this.p = this.p.mul(x, y);
    this.c1 = this.c1.mul(x, y);
    this.c2 = this.c2.mul(x, y);
  }

  get x(){
    return this.p.x;
  }
  set x(val){
    val = parseFloat(val);
    if (Number.isNaN(val)) return;
    this._p.x = val;
  }
  get y(){
    return this.p.y;
  }
  set y(val){
    val = parseFloat(val);
    if (Number.isNaN(val)) return;
    this._p.y = val;
  }
  dist(x, y){
    return this.p.dist(x, y);
  }

  get isAbsolute(){
    return (this.cmd_type && (this.cmd_type == this.cmd_type.toUpperCase()))
  }

  // only for absolute
  get cubic(){
    return CubicBezier.parseCPoint(this);
  }

  // only for absolute, as cubic but arcs may give several curves
  get cubics(){
    if (this.cmd_TYPE === "A") return CubicBezier.parseArc(this);
    let cubic = this.cubic;
    return cubic ? [cubic] : [];
  }
  
  toString(dp = 3){
    let p = this.p.round(dp);

    switch (this.cmd_type.toUpperCase()) {
      //    Move: x, y
      case 'M': return `${this.cmd_type}${p}`;

      //    Line: x, y
      case 'L': return `${this.cmd_type}${p}`;

      //    Horizontal Line: x
      case 'H': return `${this.cmd_type}${p.x}`;

      //    Vertical Line: y
      case 'V': return `${this.cmd_type}${p.y}`;

      //    Bézier Curve: x1, y1, x2, y2, x, y
      case 'C': return `${this.cmd_type}${this.c1.round(dp)},${this.c2.round(dp)},${p}`;

      //    Reflection Bézier: x2, y2, x, y
      case 'S': return `${this.cmd_type}${this.c2.round(dp)},${p}`;

      //    Quadratic Curve: x1, y1, x, y
      case 'Q': return `${this.cmd_type}${this.c1.round(dp)},${p}`;

      //    Quadratic Curve String: x, y
      case 'T': return `${this.cmd_type}${p}`;

      //    Arc: rx, ry, x-axis-rotation, large-arc-flag, sweep-flag, x, y
      case 'A': return `${this.cmd_type}${this.r.round(dp)},${this.x_axis_rotation},${this.large_arc_flag},${this.sweep_flag},${p}`;

      //    Close:
      case 'Z': return `${this.cmd_type}`
    }
  }

  static typeParamNum(type) {
    if (CPoint.isType(type)) {
      return CPoint.CMDS[type.toUpperCase()];
    } else {
      return null
    }
  }

  static isType(type) {
    return isNonEmptyString(type) && type.toUpperCase() in CPoint.CMDS;
  }

  static get CMDS() {return {
    "Z": 0,
    "M": 2,
    "L": 2,
    "T": 2,
    "C": 6,
    "H": 1,
    "V": 1,
    "S": 4,
    "Q": 4,
    "A": 7,
  }}
}






const CMD_REGEX = /([MLHVCSQTAZ])([^MLHVCSQTAZ]*)/gi;

// Reflection of the previous point's control point about the current point
// (used for the implied first control point of S and T commands).
function reflectControl(prev, cur, types, key) {
  if (prev instanceof CPoint && types.includes(prev.cmd_TYPE)) {
    return cur.mul(2).sub(prev[key]);
  }
  return cur;
}

class DPath extends LinkList {
  /* d: svg path data string, another DPath (deep copied),
        a CPoint or a CPoint array spec e.g. ["L", 10, 20] */
  constructor(d) {
    super();
    if (d instanceof DPath) {
      for (let point of d) this.push(point.clone());
    } else if (d != null) {
      this.push(d);
    }
  }

  // Also accepts path data strings and CPoint array specs.
  push(item) {
    if (isNonEmptyString(item)) {
      item = DPath.parse(item);
    } else if (isArray(item)) {
      item = new CPoint(item);
    }
    super.push(item);
  }

  clone() {
    return new DPath(this);
  }

  /* Returns a new absolute DPath of the points in [start, end) (negative
     indices count from the end, as in Array.slice). The slice is made drawable
     on its own: a move to the current position is prepended if needed, a
     leading S/T becomes C/Q, and closes whose subpath start lies before the
     slice become lines. */
  slice(start = 0, end = this.length) {
    let points = [...this.clone().makeAbsolute()];
    let n = points.length;
    let index = (i) => i < 0 ? Math.max(n + i, 0) : Math.min(i, n);
    start = index(start);
    end = index(end);

    let path = new DPath();
    if (start >= end) return path;

    let hasMove = points[start].cmd_TYPE === "M";
    if (!hasMove) {
      let from = start > 0 ? points[start - 1].p : new Vector(0);
      path.push(new CPoint(["M", from]));
    }

    for (let i = start; i < end; i++) {
      let point = points[i];
      switch (point.cmd_TYPE) {
        case "M": hasMove = true; break;
        case "S": if (i === start) point.cmd_type = "C"; break;
        case "T": if (i === start) point.cmd_type = "Q"; break;
        case "Z": if (!hasMove) point.cmd_type = "L"; break;
      }
      path.push(point);
    }

    return path;
  }

  /* Converts every point to absolute coordinates in place. Afterwards every
     point's p is its absolute end point (including H, V and Z), and S and T
     points hold their implied control point in c1. */
  makeAbsolute(){
    let cur = new Vector(0);
    let subpathStart = cur;
    let prev = null;

    for (let point of this) {
      let type = point.cmd_TYPE;
      let offset = point.isAbsolute ? new Vector(0) : cur;

      switch (type) {
        case "Z":
          point.p = subpathStart;
          point.c1 = subpathStart;
          point.c2 = subpathStart;
          break;

        case "H":
          point.p = new Vector(point.x + offset.x, cur.y);
          point.c1 = point.p;
          point.c2 = point.p;
          break;

        case "V":
          point.p = new Vector(cur.x, point.y + offset.y);
          point.c1 = point.p;
          point.c2 = point.p;
          break;

        default:
          point.add(offset);
      }

      if (type === "S") {
        point.c1 = reflectControl(prev, cur, ["C", "S"], "c2");
      } else if (type === "T") {
        point.c1 = reflectControl(prev, cur, ["Q", "T"], "c1");
        point.c2 = point.c1;
      }

      point.cmd_type = type;
      cur = point.p;
      if (type === "M") subpathStart = cur;
      prev = point;
    }

    return this;
  }

  // Converts every point to relative coordinates in place.
  makeRelative(){
    this.makeAbsolute();

    let cur = new Vector(0);
    for (let point of this) {
      let type = point.cmd_TYPE;
      let abs = point.p;

      switch (type) {
        case "H":
          point.p = new Vector(abs.x - cur.x, 0);
          point.c1 = point.p;
          point.c2 = point.p;
          break;

        case "V":
          point.p = new Vector(0, abs.y - cur.y);
          point.c1 = point.p;
          point.c2 = point.p;
          break;

        default:
          point.sub(cur);
      }

      point.cmd_type = type.toLowerCase();
      cur = abs;
    }

    return this;
  }

  toString(dp = 3){
    let d = "";
    for (let point of this) d += point.toString(dp);
    return d;
  }

  /* Parses svg path data into a new DPath. Repeated parameter sets are split
     into separate points, with those following a move becoming lines. */
  static parse(d) {
    let path = new DPath();
    for (let [, type, args] of d.matchAll(CMD_REGEX)) {
      let nparams = CPoint.typeParamNum(type);
      let params = parseParams(args, type);

      if (nparams === 0) {
        if (params.length > 0) throw `Invalid path data: "${type}${args}"`;
        path.push(new CPoint(type));
        continue;
      }

      if (params.length === 0 || params.length % nparams !== 0) {
        throw `Invalid path data: "${type}${args}"`;
      }

      for (let i = 0; i < params.length; i += nparams) {
        path.push(new CPoint([type, ...params.slice(i, i + nparams)]));
        if (type === "M") type = "L";
        else if (type === "m") type = "l";
      }
    }
    return path;
  }
}

export { Vector, CubicBezier, CPoint, DPath };
