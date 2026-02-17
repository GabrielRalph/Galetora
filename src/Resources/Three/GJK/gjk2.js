import * as THREE from "../three.js"
var MAX_ITERATIONS = 64;


///////////////////////////////////
// GJK algorithm
///////////////////////////////////
let supportTime = 0;
let itterCount = 0;
export function GJK(sup1, sup2)
{
    function support(_d) {
        let t0 = performance.now();
        // Get some point on the minkowski sum (difference really)
        // Do this by getting the farthest point in d
        var dir = _d.clone().normalize();

        var p1 = sup1(dir);
        var p2 = sup2(dir.negate());

        let res =  p1.clone().sub(p2);
        supportTime += performance.now() - t0;
        return res;
    }

    // Keep track of how many vertices of the simplex are known
    var simplex = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    var n = 2;

    // Use some arbitrary initial direction
    var d = new THREE.Vector3(1, 0, 0);
    simplex[1] = support(d);

    
    // If no points are beyond the origin, the origin is outside the minkowski sum
    // No collision is possible
    if(simplex[1].dot(d) < 0)
            return false;

    // Get another point in the opposite direction of the first
    d = simplex[1].clone().negate();
    simplex[0] = support(d);

    // Same story as above
    if(simplex[0].dot(d) < 0)
            return false;

    // Pick a direction perpendiclar to the line
    var tmp = simplex[1].clone().sub(simplex[0]);
    var tmp2 = simplex[0].clone().negate();
    d = tmp.clone().cross(tmp2).cross(tmp);
    

    // We have two points, now we start iterating to get the simplex closer
    // and closer to the origin of the minkowski sum
    // Also we're dealing with floating point numbers and erros, so cap
    // the maximum number of iterations to deal with weird cases
    for(var i = 0; i < MAX_ITERATIONS; ++i)
    {
        itterCount++;
        var a = support(d);

        // Dejavu
        if(a.dot(d) < 0) {
            return false;
        }


        // We still only have a triangle
        // Our goal is to find another point to get a tetrahedron that might
        // enclose the origin
        if(n == 2)
        {
            var aO = a.clone().negate();

            // Edges we'll be testing and the triangle's normal
            var ab = simplex[0].clone().sub(a);
            var ac = simplex[1].clone().sub(a);
            var abc = ab.clone().cross(ac);

            var abp = ab.clone().cross(abc);

            if(abp.dot(aO) > 0)
            {
                // Origin lies outside near edge ab
                simplex[1] = simplex[0];
                simplex[0] = a.clone();
                d = ab.clone().cross(aO).cross(ab);

                continue;
            }

            var acp = abc.clone().cross(ac);

            if(acp.dot(aO) > 0)
            {
                // Origin lies outside near edge ac
                simplex[0] = a.clone();
                d = ac.clone().cross(aO).cross(ac);

                continue;
            }

            // At this point the origin must be within the triangle
            // However we need to know if it is above or below
            if(abc.dot(aO) > 0)
            {
                simplex[2] = simplex[1];
                simplex[1] = simplex[0];
                simplex[0] = a.clone();
                d = abc.clone();
            }
            else
            {
                simplex[2] = simplex[0];
                simplex[0] = a.clone();
                d = abc.clone().negate();
            }

            // We do however need a tetrahedron to eclose the origin
            n = 3;
            continue;
        }

        // By now we do have a tetrahedron, start checking if it contains the origin
        var aO = a.clone().negate();
        var ab = simplex[0].clone().sub(a);
        var ac = simplex[1].clone().sub(a);
        var ad = simplex[2].clone().sub(a);

        var abc = ab.clone().cross(ac);
        var acd = ac.clone().cross(ad);
        var adb = ad.clone().cross(ab);

        // Here come some generalized functions that are called by all cases
        // Each case simply rotates the order of the vertices accordingly
        var face = function()
        {
            if(ab.clone().cross(abc).dot(aO) > 0)
            {
                // In the region of AB
                simplex[1] = simplex[0];
                simplex[0] = a.clone();
                d = ab.clone().cross(aO).cross(ab);
                n = 2;
            }
            else
            {
                // In the region of ABC
                simplex[2] = simplex[1];
                simplex[1] = simplex[0];
                simplex[0] = a.clone();
                d = abc.clone();
            }
        }

        var oneFace = function()
        {
            if(abc.clone().cross(ac).dot(aO) > 0)
            {
                // In the region of AC
                simplex[0] = a.clone();
                d = ac.clone().cross(aO).cross(ac);
                n = 2;
            }

            else face();
        }

        var twoFaces = function()
        {
            if(abc.clone().cross(ac).dot(aO) > 0)
            {
                // Origin is beyond AC from ABCs view
                // Only need to test ACD
                simplex[0] = simplex[1];
                simplex[1] = simplex[2].clone();

                ab = ac;
                ac = ad.clone();
                abc = acd.clone();

                oneFace();
            }

            // At this point we're over ABC or over AB
            // Revert back to a single face
            else face();
        }

        // Check if the point is inside the tetrahedron
        var ABC = 0x1;
        var ACD = 0x2;
        var ADB = 0x4;
        var tests =
            (abc.dot(aO) > 0 ? ABC : 0) |
            (acd.dot(aO) > 0 ? ACD : 0) |
            (adb.dot(aO) > 0 ? ADB : 0);

        // Behind all three faces, collision!
        if(tests == 0)
            return true;

        // Behind one face
        if(tests == ABC)
            oneFace();

        else if(tests == ACD)
        {
            // Rotate ACD into ABC
            simplex[0] = simplex[1];
            simplex[1] = simplex[2].clone();

            ab = ac;
            ac = ad.clone();
            abc = acd.clone();

            oneFace();
        }

        else if(tests == ADB)
        {
            // Rotate ADB into ABC
            simplex[1] = simplex[0];
            simplex[0] = simplex[2].clone();

            ac = ab;
            ab = ad.clone();
            abc = adb.clone();

            oneFace();
        }

        // Behind two faces
        else if(tests == ABC | ACD)
            twoFaces();

        else if(tests == ACD | ADB)
        {
            // Rotate ACD, ADB into ABC, ACD
            tmp = simplex[0];
            simplex[0] = simplex[1];
            simplex[1] = simplex[2];
            simplex[2] = tmp;

            tmp = ab;
            ab = ac;
            ac = ad;
            ad = tmp;

            abc = acd;
            acd = adb.clone();

            twoFaces();
        }

        else if(tests == ADB | ABC)
        {
            // Rotate ADB, ABC into ABC, ACD
            tmp = simplex[1];
            simplex[1] = simplex[0];
            simplex[0] = simplex[2];
            simplex[2] = tmp;

            tmp = ac;
            ac = ab;
            ab = ad;
            ad = tmp;

            acd = abc;
            abc = adb.clone();

            twoFaces();
        }

        // Well this shouldn't happen
        // What the hell happened here
        // Shitty floating point numbers being shitty I suppose
        // Let's just say things collided
        else return true;
    }

    // Out of iterations, but we're so damn close, let's just say it's a hit
    return true;
}

// function support(d) // vertices of shape 1 and 2 and direction
// {
//     let t0 = performance.now();
//     // Get some point on the minkowski sum (difference really)
//     // Do this by getting the farthest point in d
//     var dir = d.clone().normalize();

//     var p1 = getFarthestPoint(shape1, dir);
//     var p2 = getFarthestPoint(shape2, dir.negate());

//     let res =  p1.clone().sub(p2);
//     supportTime += performance.now() - t0;
//     return res;
// }

export function getSupportTimes() {
    return [supportTime, itterCount];
}
export function resetSupportTimes() {
    supportTime = 0;
    itterCount = 0;
}
// function getFarthestPoint(shape, d){ // vertices of shape and direction (normalized)

//     // console.log(shape);
    
//     const positionAttribute = shape.geometry.getAttribute( 'position' );
//     const n = positionAttribute.count;
    
//     let getP = (i) => {
//         let p = new THREE.Vector3();
//         p.fromBufferAttribute( positionAttribute, i );
//         shape.localToWorld( p );
//         return p;
//     }

//     // Project all vertices onto shape and get the longest
//     var p = getP(0);
//     var l = p.dot(d);

//     for(var i = 1; i < n; ++i)
//     {
//         var q = getP(i);
//         var proj = q.dot(d);

//         if(proj > l){
//             p = q;
//             l = proj;
//         }
//     }

//     return p;
// }