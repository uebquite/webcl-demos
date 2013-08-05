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
 
function InitJS(canvasName) {
    var canvas = document.getElementById(canvasName);
    var ctx = canvas.getContext("2d");
    
    if(ctx === null) {
        console.error("Failed to create Canvas2D context");
        return null;
    }
    
    // needed
    canvas.width  = WINW;
    canvas.height = WINH;
    
    return ctx;
}
 
function DrawJS(ctx) {
    if(ctx === null)
        return;
        
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.fillRect(0, 0, WINW, WINH);
        
    ctx.fillStyle = 'rgba(255,255,0,1)';

    for (var i=0; i < NBODY; i++)  {
        var x = userData.curPos[4*i+0];
        var y = userData.curPos[4*i+1];
        var z = userData.curPos[4*i+2];
        
        // use GL orientation
        y = -y;

        var px = (WINW + (x * WINW))/2;
        var py = (WINH + (y * WINH))/2;
        var pz = (WINH + (z * WINH))/2;
        var pr = 4 * (pz/WINH);
        
        if(pr < 0) pr = 1;
        if(pr > 4) pr = 4;
        
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI*2, true);
        ctx.closePath();
        ctx.fill(); 
    }
}