//Based on: http://www.ibiblio.org/e-notes/webcl/cl_gl.js

// The linearFiltering parameter indicates which type of filtering will be used in WebGL.
// If true, gl.LINEAR filter will be used, if false gl.NEAREST will be used.

function init_gl( canvas, linearFiltering ) {
   gl = canvas.getContext("experimental-webgl");
   if (!gl) {
      alert("Unfortunately your system does not support WebGL");
      return;
   }

   init_shaders();
   init_buffers( linearFiltering );
}

var vertexShaderSrc =
"  attribute vec2 aPos;"+
"  attribute vec2 aTexCoord;"+
"  varying   vec2 vTC;"+
"void main(void) {"+
"   gl_Position = vec4(aPos, 0., 1.);"+
"   vTC = aTexCoord;"+
"}";

var fragmentShaderSrc =
"#ifdef GL_ES \n"+
"precision highp float; \n"+
"#endif \n"+
"  uniform sampler2D samp;"+
"  varying vec2 vTC;"+
"void main(void) {"+
"   gl_FragColor = texture2D(samp, vTC);"+
"}";
var prog;
function init_shaders() {
   prog = gl.createProgram();
   var shader = gl.createShader(gl.VERTEX_SHADER);
   gl.shaderSource(shader, vertexShaderSrc);
   gl.compileShader(shader);
   if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) == 0)
      alert(gl.getShaderInfoLog(shader));
   gl.attachShader(prog, shader);

   shader = gl.createShader ( gl.FRAGMENT_SHADER );
   gl.shaderSource(shader, fragmentShaderSrc);
   gl.compileShader(shader);
   if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) == 0)
      alert(gl.getShaderInfoLog(shader));
   gl.attachShader(prog, shader);
   gl.linkProgram(prog);
   gl.useProgram(prog);
}

function init_buffers( linearFiltering ) {
   var aPosLoc = gl.getAttribLocation(prog, "aPos");
   var aTexLoc = gl.getAttribLocation(prog, "aTexCoord");
   gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
   gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(
      [-1,-1,0,0, 1,-1,1,0, 1,1,1,1, -1,1,0,1]), gl.STATIC_DRAW);
   gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 16, 0);
   gl.vertexAttribPointer(aTexLoc, 2, gl.FLOAT, false, 16, 8);
   gl.enableVertexAttribArray( aPosLoc );
   gl.enableVertexAttribArray( aTexLoc );
   var texture = gl.createTexture();
   gl.bindTexture(gl.TEXTURE_2D, texture);
   gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
   if(linearFiltering) {
     gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
     gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
   } else {
     gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
     gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
   }
   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

function draw_gl(nx, ny, pixels) {
   gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, nx, ny, 0,
     gl.RGBA, gl.UNSIGNED_BYTE, pixels);
   gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
}
