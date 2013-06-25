/**
 * @author Matias Piispanen
 */

var timerConsole;
var selected = 0;
var matrixStack = [];
var canvas;
var canvasContext;
var viewer;
var dim = 16;
var numCells;
var shaderProgram;
var gl;

var platforms = [];
var devices = [];
var cl;
var clSrc;
var clQueue;
var devices;
var platforms;
var selectedPlatform;
var scalarProgram;
var vectorProgram;
var wgSize;
var localThreads;
var globalThreads;

var scalarAddKernel;
var scalarCopyKernel;
var scalarDiffusionKernel;
var scalarAdvectionKernel;
var scalarBoundariesKernel;
var volumeRayMarchingKernel;

var vectorAddKernel;
var vectorCopyKernel;
var vectorDiffusionKernel;
var vectorAdvectionKernel;
var vectorInitFieldKernel;
var vectorBoundariesKernel;
var vectorProjectionFirst;
var vectorProjectionSecond;
var vectorProjectionThird;
var vectorVorticityFirstKernel;
var vectorVorticitySecondKernel;

var scalarField;
var vectorField;
var scalarAddField;

var scalarBuffer;
var scalarSourceBuffer;
var scalarTempBuffer;
var scalarSecondTempBuffer;

var vectorBuffer;
var vectorSourceBuffer;
var vectorTempBuffer;

var pixelBuffer;
var pixelCount;
var pixels;

var scalarSrc;
var vectorSrc;

var mouseX = 0;
var mouseY = 0;
var mouseButton = 0;
var mousePressed = 0;

var dirX;
var dirY;

var clTime = 0;
var clMemTime = 0;
var jsTime = 0;
var raymarchTime = 0;
var prevTime = 0;

var viscosity = 0.00001;
var dt = 0.033;
var ds = 1.0;

var running = false;

requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
    window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;

//var start = window.mozAnimationStartTime;  // Only supported in FF. Other browsers can use something like Date.now().
var start = Date.now();

function webclfluid() {
    var box = null, i, j, k;
    var boundaries = [];

    numCells = (dim + 2) * (dim + 2) * (dim + 2);

    timerConsole = document.getElementById("test");
    canvas = document.getElementById("sim_canvas");

    document.getElementById("dt").value = dt;
    document.getElementById("ds").value = ds;
    document.getElementById("viscosity").value = viscosity;

    // Get WebGL context
    gl = initWebGL("sim_canvas", "2d");
    if (!gl) {
        return false;
    }

    gl.viewport(0, 0, canvas.width, canvas.height);

    pixelCount = canvas.width * canvas.height;

    // create scalar and vector fields
    scalarField = new ScalarField(dim, viscosity, dt, boundaries, box);
    vectorField = new VectorField(dim, viscosity, dt, boundaries);

    viewer = new Viewer(gl, shaderProgram, scalarField);

    scalarSrc = getKernel("scalar_kernels.cl");
    vectorSrc = getKernel("vector_kernels.cl");

    // Init empty scalar and vector fields used as source fields
    scalarAddField = new Float32Array(numCells);
    vectorAddField = new Float32Array(numCells * 3);

    for (i = 0; i < dim + 2; i++) {
        for (j = 0; j < dim + 2; j++) {
            for (k = 0; k < dim + 2; k++) {
                scalarAddField[index(i, j, k, dim)] = 0.0;
                vectorAddField[vindex(i, j, k, 0, dim)] = 0.0;
                vectorAddField[vindex(i, j, k, 1, dim)] = 0.0;
                vectorAddField[vindex(i, j, k, 2, dim)] = 0.0;
            }
        }
    }

    // Density and Velocity added to the simulation on each cycle
    scalarAddField[index(dim / 2, dim - 1, dim / 2, dim)] = 1000.0;
    vectorAddField[vindex(dim / 2, dim - 2, dim / 2, 1, dim)] = -200.0;

    if (setupWebCL() === false) {
        return false;
    }

    canvas.addEventListener('mousemove', mouse_move, false);
    canvas.addEventListener('mouseenter', mouse_enter, false);
    canvas.addEventListener('mouseleave', mouse_leave, false);
    canvas.addEventListener('mousedown', mouse_down, false);
    canvas.addEventListener('mouseup', mouse_up, false);
    mousePressed = 0;

    running = true;
    prevTime = Date.now();
    requestAnimationFrame(step, canvas);
}

function mouse_move(e) {
    var i, start;
    var bufSize = 4 * numCells;

    dirX = (e.layerX - mouseX) * 100;
    mouseX = e.layerX;

    dirY = (e.layerY - mouseY) * 100;
    mouseY = e.layerY;

    if (mousePressed === 1) {
        var simX = Math.floor(e.layerX * (dim / canvas.clientWidth));
        var simY = Math.floor(e.layerY * (dim / canvas.clientHeight));

        if (dirX > 1000.0) {
            dirX = 1000.0;
        } else if (dirX < -1000.0) {
            dirX = -1000.0;
        }

        if (dirY > 1000.0) {
            dirY = 1000.0;
        } else if (dirY < -1000.0) {
            dirY = -1000.0;
        }

        for (i = 1; i < dim + 1; i++) {
            vectorAddField[vindex(simX, simY, i, 0, dim)] = dirX;
            vectorAddField[vindex(simX, simY, i, 1, dim)] = dirY;
        }

        start = Date.now();

        clQueue.enqueueWriteBuffer(vectorSourceBuffer, true, 0, bufSize * 3, vectorAddField, []);
        clMemTime = Date.now() - start;

        for (i = 1; i < dim + 1; i++) {
            vectorAddField[vindex(simX, simY, i, 0, dim)] = 0.0;
            vectorAddField[vindex(simX, simY, i, 1, dim)] = 0.0;
        }
    } else {
        start = Date.now();
        clQueue.enqueueWriteBuffer(vectorSourceBuffer, true, 0, bufSize * 3, vectorAddField, []);
        clMemTime = Date.now() - start;
    }
}

function mouse_enter(e) {
    mouseX = e.layerX;
    mouseY = e.layerY;
}

function mouse_leave(e) {
    mouseX = e.layerX;
    mouseY = e.layerY;
}

function mouse_down(e) {
    mouseX = e.layerX;
    mouseY = e.layerY;
    mousePressed = 1;
}

function mouse_up(e) {
    mouseX = e.layerX;
    mouseY = e.layerY;
    mousePressed = 0;
}

function step() {
    var timeElapsed;
    if (running === true) {
        timeElapsed = Date.now() - prevTime;
        prevTime = Date.now();
        timerConsole.innerHTML = "<br>FPS: " + ((1 / timeElapsed) * 1000).toFixed();

        jsTime = 0;
        clTime = 0;
        raymarchTime = 0;
        clMemTime = 0;
        scalarField.step(scalarAddField);
        vectorField.step(vectorAddField);
        viewer.draw();

        requestAnimationFrame(step, canvas);
    }
}

function clDeviceQuery() {
    var deviceList = [], devices = [], p, plat, d, x, availableDevice;
    var platforms = (WebCLCommon.getPlatforms());

    for (p = 0; p < platforms.length; p++) {
        plat = platforms[p];
        devices = [];
        devices.push(plat.getDevices(webcl.DEVICE_TYPE_CPU));
        devices.push(plat.getDevices(webcl.DEVICE_TYPE_GPU));

        for (d = 0; d < devices.length; d++) {
            for (x = 0; x < devices[d].length; x++) {
                if (devices[d][x].getInfo(webcl.DEVICE_AVAILABLE) === true) {
                    availableDevice = { 'device' : devices[d][x],
                                        'type' : devices[d][x].getInfo(webcl.DEVICE_TYPE) ===  webcl.DEVICE_TYPE_CPU ? 'CPU' : 'GPU',
                                        'name' : devices[d][x].getInfo(webcl.DEVICE_TYPE) ===  webcl.DEVICE_TYPE_CPU ? 'CPU' : 'GPU',
                                        'version' : devices[d][x].getInfo(webcl.DEVICE_VERSION),
                                        'vendor' : 'Apple',
                                        'platform' : 'MAC' };
                    deviceList.push(availableDevice);
                }
            }
        }
    }

    return deviceList;
}

function setupWebCL() {

    WebCLCommon.init("ALL");
    var deviceList = clDeviceQuery();
    var i, htmlDeviceList, deviceselect, selectedDevice, selectedPlatform, ctxProps;

    if (deviceList.length === 0) {
        alert("Unfortunately your browser/system doesn't support WebCL.");
        return false;
    }

    try {
        htmlDeviceList = "";

        for (i = 0; i < deviceList.length; i++) {
            htmlDeviceList += "<option value=" + i + ">" + deviceList[i].vendor + ": " + deviceList[i].name + "</option>\n";
        }

        deviceselect = document.getElementById("devices");
        deviceselect.innerHTML = htmlDeviceList;
        deviceselect.selectedIndex = selected;

        selectedDevice = deviceList[selected].device;
        selectedPlatform = deviceList[selected].platform;

        ctxProps = {platform: selectedPlatform,
                        devices: [selectedDevice]};

        cl = WebCLCommon.createContext(ctxProps);
        clQueue = WebCLCommon.createCommandQueue(selectedDevice);

        allocateBuffers();
    } catch (err) {
        console.log(err);
        alert("Error initializing WebCL");
        return false;
    }

    try {
        scalarProgram = WebCLCommon.createProgramBuild(scalarSrc, [selectedDevice]);
        vectorProgram = WebCLCommon.createProgramBuild(vectorSrc, [selectedDevice]);

        scalarAddKernel = scalarProgram.createKernel("scalarAddField");
        scalarCopyKernel = scalarProgram.createKernel("scalarCopy");
        scalarDiffusionKernel = scalarProgram.createKernel("scalarDiffusion");
        scalarAdvectionKernel = scalarProgram.createKernel("scalarAdvection");
        scalarBoundariesKernel = scalarProgram.createKernel("scalarBoundaryDensities");
        volumeRayMarchingKernel = scalarProgram.createKernel("volumeRayMarching");

        vectorAddKernel = vectorProgram.createKernel("vectorAddField");
        vectorCopyKernel = vectorProgram.createKernel("vectorCopy");
        vectorAdvectionKernel = vectorProgram.createKernel("vectorAdvection");
        vectorDiffusionKernel = vectorProgram.createKernel("vectorDiffusion");
        vectorInitFieldKernel = vectorProgram.createKernel("vectorInitField");
        vectorBoundariesKernel = vectorProgram.createKernel("vectorBoundaries");
        vectorProjectionFirst = vectorProgram.createKernel("vectorProjectionFirst");
        vectorProjectionSecond = vectorProgram.createKernel("vectorProjectionSecond");
        vectorProjectionThird = vectorProgram.createKernel("vectorProjectionThird");
        vectorVorticityFirstKernel = vectorProgram.createKernel("vectorVorticityConfinementFirst");
        vectorVorticitySecondKernel = vectorProgram.createKernel("vectorVorticityConfinementSecond");
    } catch (e) {
        console.error(e);
        return false;
    }

    localThreads = (Math.ceil((dim + 2) / 32)) * 32;
}

function reset() {
    scalarField.reset();
    vectorField.reset();
}

function stop() {
    if (running) {
        running = false;
        document.getElementById("stop").innerHTML = "Start";
    } else {
        running = true;
        requestAnimationFrame(step, canvas);
        document.getElementById("stop").innerHTML = "Stop";
    }
}


function dtChanged(value) {
    if (!isNaN(value) && value > 0) {
        dt = value;
        scalarField.setTimestep(dt);
        vectorField.setTimestep(dt);
    } else {
        document.getElementById("dt").value = dt;
    }
}

function dsChanged(value) {
    if (!isNaN(value) && value > 0) {
        ds = value;
    } else {
        document.getElementById("ds").value = ds;
    }
}

function viscosityChanged(value) {
    if (!isNaN(value) && value > 0) {
        viscosity = value;
        scalarField.setViscosity(viscosity);
        vectorField.setViscosity(viscosity);
    } else {
        document.getElementById("viscosity").value = viscosity;
    }
}

function allocateBuffers() {
    var bufSize = 4 * numCells;

  // JavaScript buffers

    pixels = new Uint8Array(pixelCount * 4);

  // WebCL buffers



    pixelBuffer = cl.createBuffer(webcl.MEM_READ_ONLY, pixelCount * 4);

    /* Scalar Buffers */
    scalarBuffer = cl.createBuffer(webcl.MEM_READ_WRITE, bufSize);
    clQueue.enqueueWriteBuffer(scalarBuffer, false, 0, bufSize, scalarField.getField());

    scalarSourceBuffer = cl.createBuffer(webcl.MEM_READ_ONLY, bufSize);
    clQueue.enqueueWriteBuffer(scalarSourceBuffer, false, 0, bufSize, scalarAddField);

    scalarTempBuffer = cl.createBuffer(webcl.MEM_READ_WRITE, bufSize);
    scalarSecondTempBuffer = cl.createBuffer(webcl.MEM_READ_WRITE, bufSize);

    /* Vector Buffers */
    vectorBuffer = cl.createBuffer(webcl.MEM_READ_WRITE, bufSize * 3);
    clQueue.enqueueWriteBuffer(vectorBuffer, true, 0, bufSize * 3, vectorField.getField());

    vectorSourceBuffer = cl.createBuffer(webcl.MEM_READ_ONLY, bufSize * 3);
    clQueue.enqueueWriteBuffer(vectorSourceBuffer, true, 0, bufSize * 3, vectorAddField);

    vectorTempBuffer = cl.createBuffer(webcl.MEM_READ_WRITE, bufSize * 3);
}

function freeBuffers() {
    pixelBuffer.release();
    scalarBuffer.release();
    scalarSourceBuffer.release();
    scalarTempBuffer.release();
    scalarSecondTempBuffer.release();
    vectorBuffer.release();
    vectorSourceBuffer.release();
    vectorTempBuffer.release();

    cl.release();
    clQueue.release();
    scalarProgram.release();
    vectorProgram.release();

    vectorAddKernel.release();
    vectorCopyKernel.release();
    vectorDiffusionKernel.release();
    vectorAdvectionKernel.release();
    vectorInitFieldKernel.release();
    vectorBoundariesKernel.release();
    vectorProjectionFirst.release();
    vectorProjectionSecond.release();
    vectorProjectionThird.release();
    vectorVorticityFirstKernel.release();
    vectorVorticitySecondKernel.release();
}

function simResolutionChanged(resolution) {
    running = false;

    if (resolution === 0) {
        dim = 16;
    } else if (resolution === 1) {
        dim = 32;
    } else if (resolution === 2) {
        dim = 64;
    } else if (resolution === 3) {
        dim = 96;
    } else if (resolution === 4) {
        dim = 128;
    }

    //TODO: When WebCL release work, uncomment this line
    //freeBuffers();
    webclfluid();
}

function resolutionChanged(resolution) {
    running = false;

    if (!canvas) {
        return;
    }

    if (resolution === 0) {
        canvas.width = 320;
        canvas.height = 240;
    } else if (resolution === 1) {
        canvas.width = 640;
        canvas.height = 480;
    } else if (resolution === 2) {
        canvas.width = 800;
        canvas.height = 600;
    } else if (resolution === 3) {
        canvas.width = 1024;
        canvas.height = 768;
    }

    //TODO: When WebCL release work, uncomment this line
    //freeBuffers();
    webclfluid();
}

function deviceChanged(device) {
    running = false;

    //TODO: When WebCL release work, uncomment this line
    //freeBuffers();

    selected = device;

    webclfluid();
}

function pushMatrix(viewer) {
    var copy = mat4.create();
    mat4.set(viewer.mvMatrix, copy);
    matrixStack.push(copy);
}

function popMatrix(viewer) {
    if (matrixStack.length > 0) {
        viewer.mvMatrix = matrixStack.pop();
    }
}

function getKernel(src) {
    var xhr = new XMLHttpRequest(), ret = null;
    xhr.open("GET", src, false);
    xhr.send(null);
    if (xhr.status === 200 ||  //http protocol
            xhr.status === 0) { //file protocol
        ret = xhr.responseText;
    } else {
        console.log("XMLHttpRequest error!", xhr);
    }
    
    return ret;
}
