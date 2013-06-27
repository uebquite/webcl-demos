/**
 * @author Matias Piispanen
 */
var M_PI = 3.14159265358979323846;
var maxint = 2147483647;

var selected = 0;
var selectedPlatform;
var canvas;
var canvasContext;
var cl;
var clQueue;
var clSrc;
var clProgram;
var clKernel;
var wgSize;

var sphereCount;
var pixelCount;
var currentSample = 0;
var testarray;
var htmlConsole;
var spheres = [];
var currentSphere = 0;
var camera;
var scene;

var sphereBuffer;
var cameraBuffer;
var pixelBuffer;
var colorBuffer;
var seedBuffer;

var pixels;
var canvasContent;
var pixel8View;
var pBuffer;

var clTime = 0;
var jsTime = 0;
var clMemTime = 0;
var elapsedTime = 0;
var prevTime = 0;

var running = true;

var useGPU = true;

function xhrLoad(uri) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", uri, false);
    xhr.send();
    // HTTP reports success with a 200 status, file protocol reports
    // success with a 0 status
    if (xhr.status === 200 || xhr.status === 0) {
        return xhr.responseText;
    }

    return null;
}

requestAnimationFrame = window.requestAnimationFrame ||
                            window.mozRequestAnimationFrame ||
                            window.webkitRequestAnimationFrame ||
                            window.msRequestAnimationFrame;


var start = window.mozAnimationStartTime;  // Only supported in FF. Other browsers can use something like Date.now(). 

function toogleDevice(device) {
    useGPU = (device === 'CPU') ? false : true;
    initWebCL();
}

function initPathTracing() {
    initUI();

    initWebCL();

    updateRendering();
    running = true;
    prevTime = Date.now();
    requestAnimationFrame(step, canvas);
}

function step(timestamp) {
    if (running === true) {
        jsTime = Date.now() - prevTime - clTime - clMemTime - elapsedTime;
        prevTime = Date.now();
        htmlConsole.innerHTML = "webcl (ms): " + clTime + "<br>webcl memory transfer (ms): " + clMemTime + "<br>JS (ms): " + jsTime;
        clTime = 0;
        jsTime = 0;
        clMemTime = 0;
        updateRendering();
        requestAnimationFrame(step, canvas);
    }
}

function initUI() {
    htmlConsole = document.getElementById("console");
    canvas = document.getElementById("canvas");
    canvasContext = canvas.getContext("2d");
    canvasContent = canvasContext.createImageData(canvas.width, canvas.height);

    scene = new Scene();
    spheres = scene.getBuffer();
    camera = new Camera();

    camera.orig.set([50.0, 45.0, 205.6]);
    camera.target.set([50.0, 45.0 - 0.042612, 204.6]);

    setupCamera();
}

function setupCamera() {
    vec3.subtract(camera.target, camera.orig, camera.dir);
    vec3.normalize(camera.dir);

    //NOTE: changed up direction from 1.0 to -1.0
    var up = vec3.create([0.0, -1.0, 0.0]);
    var fov = (M_PI / 180.0) * 45.0;
    vec3.cross(camera.dir, up, camera.x);
    vec3.normalize(camera.x);
    vec3.scale(camera.x, canvas.width * fov / canvas.height, camera.x);

    vec3.cross(camera.x, camera.dir, camera.y);
    vec3.normalize(camera.y);
    vec3.scale(camera.y, fov, camera.y);
}

function reInitScene() {
    currentSample = 0;

    var bufSize = 11 * 4 * sphereCount;
    clQueue.enqueueWriteBuffer(sphereBuffer, true, 0, bufSize, scene.getBuffer());
}

function reInit() {
    currentSample = 0;

    setupCamera();

    var bufSize = 15 * 4;
    clQueue.enqueueWriteBuffer(cameraBuffer, true, 0, bufSize, camera.getBuffer());
}

function drawPixels() {
    pixel8View = new Uint8ClampedArray(pBuffer);
    canvasContent.data.set(pixel8View);
    canvasContext.putImageData(canvasContent, 0, 0);
}

function reset() {
    reInit();
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

function resolutionChanged(resolution) {
    running = false;

    if (resolution === 0) {
        canvas.width = 320;
        canvas.height = 240;
    } else if (resolution === 1) {
        canvas.width = 640;
        canvas.height = 480;
    } else if (resolution === 2) {
        canvas.width = 800;
        canvas.height = 600;
    }

    releaseBuffers();
    initPathTracing();
    reInit();
}

function keyFunc(event) {
    var key = event.keyCode;
    var MOVE_STEP = 10.0;
    var ROTATE_STEP = 2.0 * M_PI / 180.0;

    var up = 38;
    var down = 40;
    var left = 39;
    var right = 37;

    var two = 50;
    var three = 51;
    var four = 52;
    var five = 53;
    var six = 54;
    var seven = 55;
    var eight = 56;
    var nine = 57;

    var plus = 107;
    var minus = 109;

    var w = 87;
    var a = 65;
    var s = 83;
    var d = 68;
    var r = 82;
    var f = 70;
    var t;
    var dir;
    var sArray;

    var pgup = 33;
    var pgdown = 34;

    switch (key) {
    case up:
        t = vec3.create(camera.target);
        vec3.subtract(t, camera.orig, t);
        t[1] = t[1] * Math.cos(-ROTATE_STEP) + t[2] * Math.sin(-ROTATE_STEP);
        t[2] = -t[1] * Math.sin(-ROTATE_STEP) + t[2] * Math.cos(-ROTATE_STEP);
        vec3.add(t, camera.orig, t);
        camera.target = t;
        reInit();
        break;
    case down:
        t = vec3.create(camera.target);
        vec3.subtract(t, camera.orig, t);
        t[1] = t[1] * Math.cos(ROTATE_STEP) + t[2] * Math.sin(ROTATE_STEP);
        t[2] = -t[1] * Math.sin(ROTATE_STEP) + t[2] * Math.cos(ROTATE_STEP);
        vec3.add(t, camera.orig, t);
        camera.target = t;
        reInit();
        break;
    case left:
        t = vec3.create(camera.target);
        vec3.subtract(t, camera.orig, t);
        t[0] = t[0] * Math.cos(-ROTATE_STEP) - t[2] * Math.sin(-ROTATE_STEP);
        t[2] = t[0] * Math.sin(-ROTATE_STEP) + t[2] * Math.cos(-ROTATE_STEP);
        vec3.add(t, camera.orig, t);
        camera.target = t;
        reInit();
        break;
    case right:
        t = vec3.create(camera.target);
        vec3.subtract(t, camera.orig, t);
        t[0] = t[0] * Math.cos(ROTATE_STEP) - t[2] * Math.sin(ROTATE_STEP);
        t[2] = t[0] * Math.sin(ROTATE_STEP) + t[2] * Math.cos(ROTATE_STEP);
        vec3.add(t, camera.orig, t);
        camera.target = t;
        reInit();
        break;
    case pgup:
        camera.target[1] += MOVE_STEP;
        reInit();
        break;
    case pgdown:
        camera.target[1] -= MOVE_STEP;
        reInit();
        break;
    case w:
        dir = vec3.create(camera.dir);
        vec3.scale(dir, MOVE_STEP);
        vec3.add(camera.orig, dir, camera.orig);
        vec3.add(camera.target, dir, camera.target);
        reInit();
        break;
    case a:
        dir = vec3.create(camera.x);
        vec3.normalize(dir);
        vec3.scale(dir, -MOVE_STEP);
        vec3.add(camera.orig, dir, camera.orig);
        vec3.add(camera.target, dir, camera.target);
        reInit();
        break;
    case s:
        dir = vec3.create(camera.dir);
        vec3.scale(dir, -MOVE_STEP);
        vec3.add(camera.orig, dir, camera.orig);
        vec3.add(camera.target, dir, camera.target);
        reInit();
        break;
    case d:
        dir = vec3.create(camera.x);
        vec3.normalize(dir);
        vec3.scale(dir, MOVE_STEP);
        vec3.add(camera.orig, dir, camera.orig);
        vec3.add(camera.target, dir, camera.target);
        reInit();
        break;
    case r:
        camera.orig[1] += MOVE_STEP;
        camera.target[1] += MOVE_STEP;
        reInit();
        break;
    case f:
        camera.orig[1] -= MOVE_STEP;
        camera.target[1] -= MOVE_STEP;
        reInit();
        break;
    case four:
        sArray = scene.getSpheres();
        sArray[currentSphere].p[0] -= 0.5 * MOVE_STEP;
        reInitScene();
        break;
    case six:
        sArray = scene.getSpheres();
        sArray[currentSphere].p[0] += 0.5 * MOVE_STEP;
        reInitScene();
        break;
    case eight:
        sArray = scene.getSpheres();
        sArray[currentSphere].p[2] -= 0.5 * MOVE_STEP;
        reInitScene();
        break;
    case two:
        sArray = scene.getSpheres();
        sArray[currentSphere].p[2] += 0.5 * MOVE_STEP;
        reInitScene();
        break;
    case nine:
        sArray = scene.getSpheres();
        sArray[currentSphere].p[1] += 0.5 * MOVE_STEP;
        reInitScene();
        break;
    case three:
        sArray = scene.getSpheres();
        sArray[currentSphere].p[1] -= 0.5 * MOVE_STEP;
        reInitScene();
        break;
    case plus:
        currentSphere = (currentSphere + 1) % sphereCount;
        reInitScene();
        break;
    case minus:
        currentSphere = (currentSphere + (sphereCount - 1)) % sphereCount;
        reInitScene();
        break;
    default:
        break;
    }
}

function releaseBuffers() {
    try {
        sphereBuffer.release();
        cameraBuffer.release();
        pixelBuffer.release();
        colorBuffer.release();
        seedBuffer.release();
        clQueue.release();
        clProgram.release();
        clKernel.release();
        cl.release();
    } catch (e) {
        console.log(e.message);
        //XXX Work around to solve the glitch when we change the canvas resolution
        //XXX Probably we are leaking on Javascript CL binding
        sphereBuffer = 0;
        cameraBuffer = 0;
        pixelBuffer = 0;
        colorBuffer = 0;
        seedBuffer = 0;

        clQueue = 0;
        clProgram = 0;
        clKernel = 0;
        cl = 0;
    }
}


function allocateBuffers() {
    // "sizeof(Sphere)"
    sphereCount = scene.getSphereCount();
    var bufSize = 11 * 4 * sphereCount;
    sphereBuffer = cl.createBuffer(webcl.MEM_READ_ONLY, bufSize);

    clQueue.enqueueWriteBuffer(sphereBuffer, true, 0, bufSize, spheres);

    //"sizeof(Camera)"
    bufSize = 15 * 4;
    cameraBuffer = cl.createBuffer(webcl.MEM_READ_ONLY, bufSize);

    clQueue.enqueueWriteBuffer(cameraBuffer, true, 0, bufSize, camera.getBuffer());

    pixelCount = canvas.width * canvas.height;

    pBuffer = new ArrayBuffer(4 * pixelCount);
    pixelArray = new Int32Array(pBuffer);

    var seeds = new Uint32Array(pixelCount * 2);
    var i;
    for (i = 0; i < pixelCount * 2; i++) {
        seeds[i] = Math.random() * maxint;

        if (seeds[i] < 2) {
            seeds[i] = 2;
        }
    }

    bufSize = 3 * 4 * pixelCount;
    colorBuffer = cl.createBuffer(webcl.MEM_READ_WRITE, bufSize);

    bufSize = 4 * pixelCount;
    pixelBuffer = cl.createBuffer(webcl.MEM_WRITE_ONLY, bufSize);

    bufSize = 4 * pixelCount * 2;
    seedBuffer = cl.createBuffer(webcl.MEM_READ_WRITE, bufSize);

    clQueue.enqueueWriteBuffer(seedBuffer, true, 0, bufSize, seeds);
}

function clDeviceQuery() {
    var deviceList = [];
    var platforms = (window.webcl && webcl.getPlatforms()) || [];
    var p;
    for (p = 0, i = 0; p < platforms.length; p++) {
        var plat = platforms[p];
        var devices = plat.getDevices(useGPU ? webcl.DEVICE_TYPE_GPU : webcl.DEVICE_TYPE_CPU);
        var d;
        for (d = 0; d < devices.length; d++, i++) {
            if (devices[d].getInfo(webcl.DEVICE_AVAILABLE) === true) {
                var availableDevice = { 'device' : devices[d],
                        'type' : devices[d].getInfo(webcl.DEVICE_TYPE),
                        'platform' : plat };
                deviceList.push(availableDevice);
            }
        }
    }

    return deviceList;
}

function initWebCL() {

    var deviceList = clDeviceQuery();

    if (deviceList.length === 0) {
        alert("Unfortunately your browser/system doesn't support WebCL.");
        return false;
    }

    try {
        var selectedDevice = deviceList[selected].device;
        var selectedPlatform = deviceList[selected].platform;
        var deviceType = deviceList[selected].type;

        var contextProperties = {platform: selectedPlatform,
                                    devices: [selectedDevice],
                                    deviceType: deviceType, shareGroup: 0,
                                    hint: null};

        cl = webcl.createContext(contextProperties);
        clQueue = cl.createCommandQueue(selectedDevice, null);
        allocateBuffers();
    } catch (e) {
        alert("Error initializing WebCL : " + e.message);
    }

    try {
        clSrc = xhrLoad("rendering_kernel.cl");
        clProgram = cl.createProgram(clSrc);
        clProgram.build(selectedDevice);
    } catch (err) {
        alert("Failed to build webcl program. Error " +
            clProgram.getBuildInfo(selectedDevice, webcl.PROGRAM_BUILD_STATUS) +
            ":  " + clProgram.getBuildInfo(selectedDevice, webcl.PROGRAM_BUILD_LOG));
        throw err;
    }

    clKernel = clProgram.createKernel("RadianceGPU");

    wgSize = clKernel.getWorkGroupInfo(selectedDevice, webcl.KERNEL_WORK_GROUP_SIZE);
}

function executeKernel() {
    var globalThreads = canvas.width * canvas.height;
    var globalWorkSize = new Int32Array(1);

    if (globalThreads % wgSize !== 0) {
        globalThreads = (Math.floor(globalThreads / wgSize) + 1) * wgSize;
    }

    globalWorkSize[0] = globalThreads;

    var localWorkSize = new Int32Array(1);
    localWorkSize[0] = wgSize;

    var types = WebCLKernelArgumentTypes;

    clKernel.setArg(0, colorBuffer);
    clKernel.setArg(1, seedBuffer);
    clKernel.setArg(2, sphereBuffer);
    clKernel.setArg(3, cameraBuffer);
    clKernel.setArg(4, sphereCount, types.UINT);
    clKernel.setArg(5, canvas.width, types.INT);
    clKernel.setArg(6, canvas.height, types.INT);
    clKernel.setArg(7, currentSample, types.INT);
    clKernel.setArg(8, pixelBuffer);

    try {
        var start = Date.now();
        clQueue.enqueueNDRangeKernel(clKernel, 0, globalWorkSize, localWorkSize);
        clQueue.finish();
        clTime += Date.now() - start;
    } catch (e) {
        htmlConsole.innerHTML = e.message;
    }
}

function updateRendering() {
    var startTime = Date.now();
    var startSampleCount = currentSample;

    if (currentSample < 20) {
        executeKernel();
        currentSample += 1;
    } else {
        var k = Math.min(currentSample - 20, 100) / 100.0;
        var thresholdTime = 0.5 * k;

        for (;;) {
            executeKernel();
            clQueue.finish();
            currentSample += 1;

            elapsedTime = Date.now() - startTime;
            if (elapsedTime > thresholdTime) {
                break;
            }
        }
    }

    var bufSize = (4 * pixelCount);

    var start = Date.now();
    clQueue.enqueueReadBuffer(pixelBuffer, true, 0, bufSize, pixelArray);
    clMemTime += Date.now() - start;

    elapsedTime = Date.now() - startTime;
    var samples = currentSample - startSampleCount;
    var sampleSec = samples * canvas.height * canvas.width / elapsedTime;

    htmlConsole.innerHTML += "<br>Rendering time " + elapsedTime + " ms (pass " + currentSample + ")<br>Sample/sec " + sampleSec.toFixed(2) + "K\n";

    drawPixels();
}

