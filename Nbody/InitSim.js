/*
* Copyright (C) 2011 Samsung Electronics Corporation. All rights reserved.
* 
* Redistribution and use in source and binary forms, with or without
* modification, are permitted provided the following conditions
* are met:
* 
* 1.  Redistributions of source code must retain the above copyright
*     notice, this list of conditions and the following disclaimer.
* 
* 2.  Redistributions in binary form must reproduce the above copyright
*     notice, this list of conditions and the following disclaimer in the
*     documentation and/or other materials provided with the distribution.
* 
* THIS SOFTWARE IS PROVIDED BY SAMSUNG ELECTRONICS CORPORATION AND ITS
* CONTRIBUTORS "AS IS", AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING
* BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
* FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL SAMSUNG
* ELECTRONICS CORPORATION OR ITS CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
* INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES(INCLUDING
* BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
* DATA, OR PROFITS, OR BUSINESS INTERRUPTION), HOWEVER CAUSED AND ON ANY THEORY
* OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT(INCLUDING
* NEGLIGENCE OR OTHERWISE ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
* EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
 
// particles are in the cube: x:[-1,1], y:[-1,1], z:[-1,1]
// 
function InitRandomParticles() { 
    for (var i=0; i < NBODY; i++)  {
        var x = RANDM1TO1();
        var y = RANDM1TO1();
        var z = RANDM1TO1();
        var vx = 0;
        var vy = 0;
        var vz = 0;
        InitParticle(i, x, y, z, vx, vy, vz)
    }
}

// particles are on the surface on the sphere C=(0,0,0), r=0.5
//
function InitParticlesOnSphere() {
    for (var i=0; i < NBODY; i++)  {
        var r = 0.5;
        var theta = Math.PI * RAND0TO1();
        var phi = 2 * Math.PI * RAND0TO1();
        
        var x = r * Math.sin(theta) * Math.cos(phi);
        var y = r * Math.sin(theta) * Math.sin(phi);
        var z = r * Math.cos(theta);
        var vx = 0;
        var vy = 0;
        var vz = 0;
        InitParticle(i, x, y, z, vx, vy, vz);
    }
}

// particles are on disc in z=0 plane,  C=(0,0,0), r=0.5
//
function InitParticlesOnDisc() {
    for (var i=0; i < NBODY; i++)  {
        var r = 0.5 * RAND0TO1();
        var theta = 2 * Math.PI * Math.random();
        
        var x = r * Math.sin(theta);
        var y = r * Math.cos(theta);
        var z = 0;
        var vx = 0;
        var vy = 0;
        var vz = 0;
        InitParticle(i, x, y, z, vx, vy, vz);        
    }
}

// particles are on disc in z=0 plane,  C=(0,0,0), r=0.5
//
function InitParticlesOnSpinningDisc() {
    for (var i=0; i < NBODY; i++)  {
        var r = 0.5 * RAND0TO1();
        var theta = 2 * Math.PI * Math.random();
        
        var pos = [0, 0, 0];
        pos[0] = r * Math.sin(theta);
        pos[1] = r * Math.cos(theta);
        pos[2] = 0;
        
        var vel = [0, 0, 0];
        Vector3.normalize(vel, pos);
        
        // rotate 90 ccwise
        var tmp = vel[0];
        vel[0] = - vel[1];
        vel[1] = tmp;
        
        // scale
        Vector3.scale(vel, vel, 20 * (r/0.5));

        InitParticleV(i, pos, vel);        
    }
}


// particles are on the edge of a ring in z=0 plane,  C=(0,0,0), r=0.5
//
function InitParticlesOnRing() {
    for (var i=0; i < NBODY; i++)  {
        var r = 0.5;
        var theta = 2 * Math.PI * Math.random();
        
        var x = r * Math.sin(theta);
        var y = r * Math.cos(theta);
        var z = 0;
        var vx = 0;
        var vy = 0;
        var vz = 0;
        InitParticle(i, x, y, z, vx, vy, vz);        
    }
}

// two particles, separated by unit distance
//
function InitTwoParticles() {
    var  x; var  y; var  z;
    var vx; var vy; var vz;
    
    if(NBODY != 2) {
        console.error("Error: InitTwoParticles with NBODY != 2");
        return;
    }
    
    vx = vy = vz = 0;
    
    x = -0.5;
    y = 0;
    z = 0;
    InitParticle(0, x, y, z, vx, vy, vz);
            
    x = 0.5;
    y = 0;
    z = 0;
    InitParticle(1, x, y, z, vx, vy, vz);       
}

// four particles, separated by unit distance
//
function InitFourParticles() {
    if(NBODY != 4) {
        console.error("Error: InitTwoParticles with NBODY != 4");
        return;
    }
    
    var vx, vy, vz;
    vx = vy = vz = 0;
    
    InitParticle(0, -0.5, 0, 0, vx, vy, vz);
    InitParticle(1,  0.5, 0, 0, vx, vy, vz);   
    InitParticle(2, 0, -0.5, 0, vx, vy, vz);
    InitParticle(3, 0,  0.5, 0, vx, vy, vz);     
}


function InitParticle(i, x, y, z, vx, vy, vz) {
    var curPos = userData.curPos;
    var curVel = userData.curVel;
    var ii = 4*i;
    
    curPos[ii + 0] = x;
    curPos[ii + 1] = y;
    curPos[ii + 2] = z;
    curPos[ii + 3] = 500;
    
    curVel[ii + 0] = vx;
    curVel[ii + 1] = vy;
    curVel[ii + 2] = vz;
}

function InitParticleV(i, pos, vel) {
    var curPos = userData.curPos;
    var curVel = userData.curVel;
    var ii = 4*i;
    
    curPos[ii + 0] = pos[0];
    curPos[ii + 1] = pos[1];
    curPos[ii + 2] = pos[2];
    curPos[ii + 3] = 500;
    
    curVel[ii + 0] = vel[0];
    curVel[ii + 1] = vel[1];
    curVel[ii + 2] = vel[2];
}

var Vector3 = {};

Vector3.dot = function(a, b) {
    return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
};

Vector3.scale = function(out, a, s) {
    out[0] = s * a[0];
    out[1] = s * a[1];
    out[2] = s * a[2];
};

Vector3.diff = function(out, a, b) {
    out[0] = a[0] = b[0];
    out[1] = a[1] = b[1];
    out[2] = a[2] = b[2];
};

Vector3.normalize = function(out, a) {
    var r = Math.sqrt(a[0]*a[0] + a[1]*a[1] + a[2]*a[2]);
    out[0] = a[0]/r;
    out[1] = a[1]/r;
    out[2] = a[2]/r;
};

Vector3.cross = function(out, a, b) {
    out[0] = a[1]*b[2] - a[2]*b[1]; // a2b3 - a3b2
    out[1] = a[2]*b[0] - a[0]*b[2]; // a3b1 - a1b3
    out[2] = a[0]*b[1] - a[1]*b[0]; // a1b2 - a2b1
};
