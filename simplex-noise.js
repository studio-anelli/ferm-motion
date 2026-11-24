/* simplex-noise 4.0.3 */
/*
 * A fast javascript implementation of simplex noise by Jonas Wagner

Based on a speed-improved simplex noise algorithm for 2D, 3D and 4D in Java.
Which is based on example code by Stefan Gustavson (stegu@itn.liu.se).
With Optimisations by Peter Eastman (peastman@drizzle.stanford.edu).
Better rank ordering method by Stefan Gustavson in 2012.

 Copyright (c) 2024 Jonas Wagner

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all
 copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 SOFTWARE.
 */
var OrganicMotionNoise=(()=>{var D=Object.defineProperty;var U=Object.getOwnPropertyDescriptor;var W=Object.getOwnPropertyNames;var v=Object.prototype.hasOwnProperty;var B=(s,o)=>{for(var n in o)D(s,n,{get:o[n],enumerable:!0})},C=(s,o,n,t)=>{if(o&&typeof o=="object"||typeof o=="function")for(let c of W(o))!v.call(s,c)&&c!==n&&D(s,c,{get:()=>o[c],enumerable:!(t=U(o,c))||t.enumerable});return s};var E=s=>C(D({},"__esModule",{value:!0}),s);var J={};B(J,{createNoise2D:()=>R});var q=Math.sqrt(3),Q=Math.sqrt(5),H=.5*(q-1),g=(3-q)/6,L=1/3,O=1/6,V=(Q-1)/4,_=(5-Q)/20,X=s=>Math.floor(s)|0,Y=new Float64Array([1,1,-1,1,1,-1,-1,-1,1,0,-1,0,1,0,-1,0,0,1,0,-1,0,1,0,-1]);function R(s=Math.random){let o=I(s),n=new Float64Array(o).map(c=>Y[c%12*2]),t=new Float64Array(o).map(c=>Y[c%12*2+1]);return function(l,u){let S=0,h=0,M=0,N=(l+u)*H,d=X(l+N),F=X(u+N),T=(d+F)*g,Z=d-T,P=F-T,r=l-Z,i=u-P,x,w;r>i?(x=1,w=0):(x=0,w=1);let j=r-x+g,k=i-w+g,z=r-1+2*g,A=i-1+2*g,G=d&255,b=F&255,a=.5-r*r-i*i;if(a>=0){let e=G+o[b],m=n[e],y=t[e];a*=a,S=a*a*(m*r+y*i)}let f=.5-j*j-k*k;if(f>=0){let e=G+x+o[b+w],m=n[e],y=t[e];f*=f,h=f*f*(m*j+y*k)}let p=.5-z*z-A*A;if(p>=0){let e=G+1+o[b+1],m=n[e],y=t[e];p*=p,M=p*p*(m*z+y*A)}return 70*(S+h+M)}}function I(s){let n=new Uint8Array(512);for(let t=0;t<512/2;t++)n[t]=t;for(let t=0;t<512/2-1;t++){let c=t+~~(s()*(256-t)),l=n[t];n[t]=n[c],n[c]=l}for(let t=256;t<512;t++)n[t]=n[t-256];return n}return E(J);})();
