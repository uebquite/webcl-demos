
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

var t = 0;
var cx = 0;
var cy = 0;
var diag = 0;
var touchDown = false;

window.requestAnimFrame = (function(){
          return  window.requestAnimationFrame       ||
                  window.webkitRequestAnimationFrame ||
                  window.mozRequestAnimationFrame    ||
                  window.oRequestAnimationFrame      ||
                  window.msRequestAnimationFrame     ||
                  function(/* function */ callback, /* DOMElement */ element){
                    window.setTimeout(callback, 1000 / 60);
                  };
    })();


function Load()
{
    // Start load of an image from a file
    //
    jsInputImage = new Image();
    jsInputImage.src = "pebble.jpg";
    jsInputImage.onload = LoadComplete;
}

function UnLoad()
{
    if(isCLenabled) releaseBuffers();
}

function LoadComplete()
{
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
    outputCanvas.addEventListener("touchstart", function(e) { e.preventDefault(); }, false);
    outputCanvas.addEventListener("touchend",   function(e) { e.preventDefault(); }, false);
    outputCanvas.addEventListener("touchmove",  function(e) { e.preventDefault(); }, false);

    // handle change of center
    outputCanvas.addEventListener("mousedown", function(e) { touchDown = true;  }, false);
    outputCanvas.addEventListener("mouseup",   function(e) { touchDown = false; }, false);
    outputCanvas.addEventListener("mousemove", OnMouseMove, false);
    outputCanvas.addEventListener("touchstart", function(e) { touchDown = true;  }, false);
    outputCanvas.addEventListener("touchend",   function(e) { touchDown = false; }, false);
    outputCanvas.addEventListener("touchmove",  OnTouchMove, false);

    var b1 = new FastButton(document.getElementById("run"),    ToggleRunning);
    var b2 = new FastButton(document.getElementById("filter"), ToggleFilter);

    isRunning = false;
    isCLenabled = InitCL();
    useJS = !isCLenabled;

    ShowRunState();
    ShowFilterState();
    HideResults();
}

function OnMouseMove (e) {
    if (touchDown) {
        var nx = Math.floor(e.offsetX);
        var ny = Math.floor(e.offsetY);
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            cx = nx;
            cy = ny;
        }
    }
}

function OnTouchMove (e) {
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

function ToggleRunning()
{
    isRunning = !isRunning;
    ShowRunState();

    if (isRunning) {
        requestAnimFrame(RunFilter);
    }
    else {
        HideResults();
    }
}

function ShowRunState()
{
    document.getElementById("run").firstChild.nodeValue = isRunning ? "Press to Stop" : "Press to Start";
}

function ToggleFilter()
{
    if (!isCLenabled)
        return;

    useJS = !useJS;
    ShowFilterState();
}

function ShowFilterState()
{
    document.getElementById("filter").firstChild.nodeValue = useJS ? "JavaScript" : "WebCL";
}

function RunFilter()
{
    if (!isRunning) {
        outputContext.drawImage(jsInputImage, 0, 0);
        return;
    }

    // Reset output image data
    var imageData = outputContext.getImageData(0, 0, width, height);
    for (var i=0; i<imageData.data.length; i++)
        imageData.data[i] = 0;

    outputContext.putImageData(imageData, 0, 0);

    if (useJS)
        RunFilterJS(t, cx, cy, diag);
    else
        RunFilterCL(t, cx, cy, diag);

    t++;
    requestAnimFrame(RunFilter);
}

function ShowResults()
{
    var delta = Math.max(1, tEnd - tStart);
    var fps = Math.floor(1000 / delta);

    document.getElementById("msec").firstChild.nodeValue = fps + " fps"
    document.getElementById("msec").style.visibility = "visible";
}

function HideResults()
{
    document.getElementById("msec").style.visibility = "hidden";
}
