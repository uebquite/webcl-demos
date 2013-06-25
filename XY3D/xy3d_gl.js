//From: http://www.ibiblio.org/e-notes/webcl/mc/xy3d_gl.js

function getShader(gl, id) {
    var shaderScript = document.getElementById(id);
    var str = "";
    var k = shaderScript.firstChild;
    while (k) {
        if (k.nodeType === 3) {
            str += k.textContent;
        }
        k = k.nextSibling;
    }
    var shader;
    if (shaderScript.type === "x-shader/x-fragment") {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else {
        if (shaderScript.type === "x-shader/x-vertex") {
            shader = gl.createShader(gl.VERTEX_SHADER);
        } else {
            return null;
        }
    }
    gl.shaderSource(shader, str);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) === 0) {
        alert(gl.getShaderInfoLog(shader));
    }
    return shader;
}

requestAnimFrame = (function () {
    return window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        function (callback, element) {
            window.setTimeout(callback, 1000 / 60);
        };
})();

var gl, canvas, c_w, c_h, prog, tex_gl, mvMat, mvMatLoc, rotMat,
    transl = -2, xOffs = 0, yOffs = 0, drag = 0, xRot = 0, yRot = 0;

function init_gl() {
    c_w = window.innerWidth - 50;
    c_h = window.innerHeight - 10;
    canvas.width = c_w;
    canvas.height = c_h;
    var err = "Your browser does not support ";
    if (!window.WebGLRenderingContext) {
        alert(err + "WebGL");
        return;
    }
    try {
        gl = canvas.getContext("experimental-webgl");
    } catch (e) {}

    if (!gl) {
        alert("Can't get WebGL");
        return;
    }
    if (gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) === 0) {
        alert(err + "Vertex texture");
        return;
    }

    prog  = gl.createProgram();
    gl.attachShader(prog, getShader(gl, "shader-vs"));
    gl.attachShader(prog, getShader(gl, "shader-fs"));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    gl.uniform1f(gl.getUniformLocation(prog, "pSize"), 5);
    gl.uniform1i(gl.getUniformLocation(prog, "spin"), 1);

    var vertices = [];
    var z, y, x;
    for (z = 0; z < n; z++) {
        for (y = 0; y < n; y++) {
            for (x = 0; x < n; x++) {
                vertices.push(x / n, y / n, z / n);
            }
        }
    }
    var aPosLoc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPosLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.vertexAttribPointer(aPosLoc, 3, gl.FLOAT, false, 0, 0);

    tex_gl = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex_gl);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    var prMatrix = new CanvasMatrix4();
    prMatrix.perspective(45, c_w / c_h, 0.1, 100);
    gl.uniformMatrix4fv(gl.getUniformLocation(prog, "prMatrix"),
        false, new Float32Array(prMatrix.getAsArray()));
    mvMatrix = new CanvasMatrix4();
    rotMat = new CanvasMatrix4();
    rotMat.makeIdentity();
    mvMatLoc = gl.getUniformLocation(prog, "mvMatrix");

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clearDepth(1);
    gl.clearColor(0, 0, 0, 1);

    canvas.resize = function () {
        c_w = window.innerWidth - 50;
        c_h = window.innerHeight - 10;
        canvas.width = c_w;
        canvas.height = c_h;
        prMatrix.makeIdentity();
        prMatrix.perspective(45, c_w / c_h, 0.1, 100);
        gl.uniformMatrix4fv(gl.getUniformLocation(prog, "prMatrix"),
            false, new Float32Array(prMatrix.getAsArray()));
        draw();
    };

    canvas.onmousedown = function (ev) {
        drag = 1;
        xOffs = ev.clientX;
        yOffs = ev.clientY;
    };

    canvas.onmouseup = function (ev) {
        drag  = 0;
        xOffs = ev.clientX;
        yOffs = ev.clientY;
    };

    canvas.onmousemove = function (ev) {
        if (drag === 0) {
            return;
        }
        if (ev.shiftKey) {
            transl *= 1 + (ev.clientY - yOffs) / 300;
            yRot = -xOffs + ev.clientX;
        } else {
            yRot = -xOffs + ev.clientX;
            xRot = -yOffs + ev.clientY;
        }
        xOffs = ev.clientX;
        yOffs = ev.clientY;
        draw();
    };

    var wheelHandler = function (ev) {
        var del = 1.1;
        if (ev.shiftKey) {
            del = 1.01;
        }
        var ds = ((ev.detail || ev.wheelDelta) > 0) ? del : (1 / del);
        transl *= ds;
        draw();
        ev.preventDefault();
    };

    canvas.addEventListener('DOMMouseScroll', wheelHandler, false);
    canvas.addEventListener('mousewheel', wheelHandler, false);
}

function draw() {
    rotMat.rotate(xRot / 3, 1, 0, 0);
    rotMat.rotate(yRot / 3, 0, 1, 0);
    yRot = 0;
    xRot = 0;
    mvMatrix.makeIdentity();
    mvMatrix.translate(-0.5, -0.5, -0.5);
    mvMatrix.multRight(rotMat);
    mvMatrix.translate(0, 0, transl);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(mvMatLoc, false,
        new Float32Array(mvMatrix.getAsArray()));

    gl.drawArrays(gl.POINTS, 0, n * n * n);
    gl.flush();
}
