var cl;                                     // WebCL context
var platforms;                              // array of WebCL platforms
var platform;                               // WebCL platform
var devices;                                // array of WebCL devices
var device;                                 // WebCL device

var context         = null;                 // WebCL context
var queue           = null;                 // WebCL command queue
var filterProgram   = null;                 // WebCL program
var filterKernel    = null;                 // WebCL kernel
var inputBuffer     = null;                 // WebCL buffer
var outputBuffer    = null;                 // WebCL buffer

var nRGBAvals;
var nBytes;
var data;                                   // Float32Array (Uint8 does not work)

var blockSizeX = 64;                        // for ripple
var blockSizeY = 64;                        // for ripple

var globalThreads = new Int32Array(2);
var localThreads = new Int32Array(2);

var isCLActive = false;                     // prevent requeuing while still active


function initCL() {
    try {

        var maxWorkGroupSize;
        var kernelSource;
        var deviceType = useGPU ? "GPU" : "CPU";

        cl = webcl;

        // Create the compute program from the source buffer
        //
        kernelSource = getKernel("ripple.cl");
        if (kernelSource === null) {
            console.error("No kernel named: " + "Ripple_kernel");
            return false;
        }

        WebCLCommon.init(deviceType);
        context = WebCLCommon.createContext();
        filterProgram = WebCLCommon.createProgramBuild(kernelSource);

        queue = context.createCommandQueue();

    } catch (e) {
        console.error(e.message, e);
        return false;
    }

    try {
        filterKernel = filterProgram.createKernel("Ripple_kernel");

        devices = WebCLCommon.getDevices(deviceType);

        maxWorkGroupSize = filterKernel.getWorkGroupInfo(devices[0], cl.KERNEL_WORK_GROUP_SIZE);

        while (blockSizeX * blockSizeY > maxWorkGroupSize) {
            blockSizeX = blockSizeX / 2;
            blockSizeY = blockSizeY / 2;
        }

        // Image has loaded so create WebCL buffer objects
        //
        nRGBAvals = width * height * 4;
        nBytes = nRGBAvals * Float32Array.BYTES_PER_ELEMENT;

    } catch (e) {
        console.error("ERROR: "+e.message, e);
        return false;
    }

    try {
        inputBuffer = context.createBuffer(cl.MEM_READ_ONLY, nBytes);
        outputBuffer = context.createBuffer(cl.MEM_WRITE_ONLY, nBytes);
        data = new Float32Array(nRGBAvals);

        // Write our image into the input array in device memory
        //
        var inputPixels = inputContext.getImageData(0, 0, width, height).data;
        for (var i = 0; i < nRGBAvals; i++) {
            data[i] = inputPixels[i];
        }

        queue.enqueueWriteBuffer(inputBuffer, true, 0, nBytes, data);

    } catch (e) {
        console.error("ERROR: "+e.message);
        return false;
    }

    return true;
}

function releaseBuffers() {
    try {
        outputBuffer.release();
        inputBuffer.release();
        filterKernel.release();
        filterProgram.release();
        queue.release();
        context.release();
    } catch (e) {
        console.error(e.message);
    }
}

function runFilterCL(t, cx, cy, diag) {
    if (isCLActive)
        return;

    isCLActive = true;
    runRippleCL(t, cx, cy, diag);
}

function runRippleCL(t, cx, cy, diag) {
    // Set the arguments to our compute kernel
    //
    var type = WebCLKernelArgumentTypes;
    filterKernel.setArg(0, inputBuffer);
    filterKernel.setArg(1, outputBuffer);
    filterKernel.setArg(2, width,  type.INT);
    filterKernel.setArg(3, height, type.INT);
    filterKernel.setArg(4, diag, type.FLOAT);
    filterKernel.setArg(5, t,  type.INT);
    filterKernel.setArg(6, cx, type.INT);
    filterKernel.setArg(7, cy, type.INT);

    globalThreads[0] = width;
    globalThreads[1] = height;
    localThreads[0] = blockSizeX;
    localThreads[1] = blockSizeY;

    tStart = new Date().valueOf();
    queue.enqueueNDRangeKernel(filterKernel, 0, globalThreads, null);

    // Wait for the command queue to get serviced before reading back results
    //
    queue.finish();
    getResults();
}

function getResults() {
    tEnd = new Date().valueOf();

    // Read back the results from the device to verify the output
    //
    queue.enqueueReadBuffer(outputBuffer, true, 0, nBytes, data);
    isCLActive = false;

    // NOTE enqueueReadImage should do outputContext.putImageData(outputImageData, 0, 0);
    //
    var outputImageData = outputContext.getImageData(0, 0, width, height);
    var outputPixels = outputImageData.data;

    for (var i = 0; i < nRGBAvals; i++)
        outputPixels[i] = data[i];

    outputContext.putImageData(outputImageData, 0, 0);

    showResults();
}
