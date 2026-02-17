
/**
 * @typedef {(Vec) => Vec} SupportFunction
 */

import { cross, dot, norm, normalise, add, sub, div, mul } from "./basic-vec3.js"

/**
 * @param {SupportFunction} s1
 * @param {SupportFunction} s2
 */
export function gjk(s1, s2) {
    let o = [0,0,0];
    let smd = (d) => sub(s1(d), s2(mul(d, -1)));
    let d0 = [1,0,0];
    console.log("here1");
    
    let A = smd(d0);
    
    let simplex = new Set([A]);
    d0 = sub(o, A);
    console.log(d0);
    

    let lineCase = () => {
        let [b, a] = simplex;
        let ab = sub(b, a);
        let ao = sub(o, a);
        d0 = cross(cross(ab, ao), ab)
        return false;
    }

    let triangleCase = () => {
        let [a, b, c] = simplex;
        let bc = sub(c, b);
        let ba = sub(a, b);
        let bp = cross(bc, ba);
        let bo = sub(o, b);
        let dir = dot(bo, d0);
        if (dir > 0) d0 = bp;
        else d0 = mul(bp, -1);
        return false
    }

    let tetrahedronCase = () => {
        let [a, b, c, d] = simplex;
        let abd = cross(sub(b,a), sub(d,a));
        let bcd = cross(sub(b,c), sub(d,c));
        let cad = cross(sub(c,a), sub(d,a));
        let d_o = sub(o, d);

        if(dot(abd, d_o) > 0) {
            // the origin is on the outside of triangle a-b-d
            simplex.delete(c)
            d0 = abd;
        } else if(dot(bcd, d_o) > 0) {
            // the origin is on the outside of triangle bcd
            simplex.delete(a);
            d0 = bcd;
        } else if(dot(cad, d_o) > 0) {
            // the origin is on the outside of triangle cad
            simplex.delete(b);
            d0 = cad;
        } else {
            // the origin is inside all of the triangles!
            return true
        }
    }


    let handleSimplex = () => {
        switch(simplex.size) {
            case 2: return lineCase(simplex)
            case 3: return triangleCase(simplex)
            case 4: return tetrahedronCase(simplex)
        }
    }

    for (let i = 0; i < 100; i++) {
        console.log("here2");
        A = smd(d0);
        if (dot(A, d0) < 0) {
            console.log("here", i);
            return false;
        }
        simplex.add(A);
        if (handleSimplex())
            return true
    }
    return true;
    console.log("gjk failed to converge");

}


// function argmax(arr) {
//     let maxi = 0;
//     for (let i = 0; i < arr.length; i++) {
//         if (arr[i] > arr[maxi]) maxi = i;
//     }
//     return maxi;
// }

// class Cylinder {
//     constructor(H, r, ttheta = 20, th = 3) {
//         this.vertices = []
//         for (let itheta = 0; itheta < ttheta; itheta++) {
//             let theta = itheta * Math.PI * 2 / ttheta;
//             for (let ih = 0; ih < th; ih++) {
//                 let h = H * ih / (th - 1);
//                 this.vertices.push([
//                     Math.cos(theta) * r,
//                     Math.sin(theta) * r,
//                     h
//                 ])
//             }
//         }
//     }

//     move(d) {
//         this.vertices = this.vertices.map(v => add(v, d))
//     }

//     getSupport() {
//         let {vertices} = this;
//         let sup = (d) => {
//             let i = argmax(vertices.map(v => dot(v, d)));
            
//             return vertices[i]
//         }
//         return sup
//     }
// }


// let c1 = new Cylinder(10, 2.5)
// c1.move([2,0,0])
// let c2 = new Cylinder(10, 2.5)

// // let s1 = c1.getSupport();
// // console.log(s1([-1, 0, 0]));



// console.log(gjk(c1.getSupport(), c2.getSupport()));


