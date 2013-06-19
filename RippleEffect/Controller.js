var jsInputImage;                           // JavaScript image
var width;
var height;

var inputCanvas;
var outputCanvas;
var inputContext;
var outputContext;

var tStart;                                 // start filter timestamp
var tEnd;                                   // end filter timestamp
var isRunning   = null;
var useJS       = null;
var isCLenabled = false;
var useGPU      = true;

var t = 0;
var cx = 0;
var cy = 0;
var diag = 0;
var touchDown = false;

function getKernel(fileName) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", fileName, false);
    xhr.send();
    // HTTP reports success with a 200 status, file protocol reports
    // success with a 0 status
    if (xhr.status == 200 || xhr.status == 0) {
        return xhr.responseText;
    } else {
        return null;
    }
};

window.requestAnimFrame = (function () {
          return  window.requestAnimationFrame       ||
                  window.webkitRequestAnimationFrame ||
                  window.mozRequestAnimationFrame    ||
                  window.oRequestAnimationFrame      ||
                  window.msRequestAnimationFrame     ||
                  function(/* function */ callback, /* DOMElement */ element){
                      window.setTimeout(callback, 1000 / 60);
                  };
    })();


function init() {
    // Start load of an image from a file
    //
    jsInputImage = new Image();
    jsInputImage.src = "pebble.jpg";
    jsInputImage.onload = loadComplete;
}

function release() {
    if (isCLenabled)
        releaseBuffers();
}

function loadComplete() {
    width = jsInputImage.width;
    height = jsInputImage.height;

    // Canvas initialization
    inputCanvas = document.getElementById("inputCanvas");
    inputCanvas.width = width;
    inputCanvas.height = height;
    inputContext = inputCanvas.getContext("2d");
    inputContext.drawImage(jsInputImage, 0, 0);

    outputCanvas = document.getElementById("outputCanvas");
    outputCanvas.width = width;
    outputCanvas.height = height;
    outputContext = outputCanvas.getContext("2d");
    outputContext.drawImage(jsInputImage, 0, 0);

    diag = Math.sqrt(width*width + height*height);
    // attempt to hide URL bar
    window.scrollTo(0, 1);

    // attempt to prevent scrolling
    outputCanvas.addEventListener("touchstart", function (e) { e.preventDefault(); }, false);
    outputCanvas.addEventListener("touchend",   function (e) { e.preventDefault(); }, false);
    outputCanvas.addEventListener("touchmove",  function (e) { e.preventDefault(); }, false);

    // handle change of center
    outputCanvas.addEventListener("mousedown", function (e) { touchDown = true;  }, false);
    outputCanvas.addEventListener("mouseup",   function (e) { touchDown = false; }, false);
    outputCanvas.addEventListener("mousemove", onMouseMove, false);
    outputCanvas.addEventListener("touchstart", function (e) { touchDown = true;  }, false);
    outputCanvas.addEventListener("touchend",   function (e) { touchDown = false; }, false);
    outputCanvas.addEventListener("touchmove",  onTouchMove, false);

    var b1 = new FastButton(document.getElementById("run"),    toggleRunning);
    var b2 = new FastButton(document.getElementById("filter"), toggleFilter);
    var b3 = new FastButton(document.getElementById("toggleDevice"), toggleDevice);

    isRunning = false;
    isCLenabled = initCL();
    useJS = !isCLenabled;

    showRunState();
    showFilterState();
}

function onMouseMove (e) {
    if (touchDown) {
        var nx = Math.floor(e.offsetX);
        var ny = Math.floor(e.offsetY);
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            cx = nx;
            cy = ny;
        }
    }
}

function onTouchMove (e) {
    if (touchDown  && e.targetTouches.length === 1) {
        var touch = e.targetTouches[0];
        var nx = touch.clientX;
        var ny = touch.clientY;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            cx = nx;
            cy = ny;
        }
    }
}

function toggleRunning() {
    isRunning = !isRunning;
    showRunState();

    if (isRunning) {
        requestAnimFrame(runFilter);
    }
}

function toggleDevice() {
    if (!useJS) {
        useGPU = !useGPU;
        showFilterState();
        initCL();
        requestAnimFrame(runFilter);
        }
}

function showRunState() {
    document.getElementById("run").firstChild.nodeValue = isRunning ? "Press to Stop" : "Press to Start";
}

function toggleFilter() {
    if (!isCLenabled)
        return;

    useJS = !useJS;
    useGPU = useJS ? false : useGPU;
    showFilterState();
}

function showFilterState() {
    document.getElementById("filter").firstChild.nodeValue = useJS ? "JavaScript" : "WebCL";
    document.getElementById("toggleDevice").firstChild.nodeValue = useGPU ? "GPU" : "CPU";
}

function runFilter() {
    if (!isRunning) {
        outputContext.drawImage(jsInputImage, 0, 0);
        return;
    }

    var imageData = outputContext.getImageData(0, 0, width, height);
    for (var i = 0; i < imageData.data.length; i++)
        imageData.data[i] = 0;

    outputContext.putImageData(imageData, 0, 0);

    if (useJS)
        runFilterJS(t, cx, cy, diag);
    else
        runFilterCL(t, cx, cy, diag);

    t++;
    requestAnimFrame(runFilter);
}

function showResults() {
    var delta = Math.max(1, tEnd - tStart);
    var fps = Math.floor(1000 / delta);

    document.getElementById("msec").firstChild.nodeValue = fps + " fps"
    document.getElementById("msec").style.visibility = "visible";
}

function hideResults() {
    document.getElementById("msec").style.visibility = "hidden";
}
