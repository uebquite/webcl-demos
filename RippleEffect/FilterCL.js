var err;                                    // error code returned from API calls

var region;
var origin;

var cl;                                     // OpenCL context
var platform_ids;                           // array of OpenCL platform ids
var platform_id;                            // OpenCL platform id
var device_ids;                             // array of OpenCL device ids
var device_id;                              // OpenCL device id

var context         = null;                 // OpenCL context
var queue           = null;                 // OpenCL command queue
var filterProgram   = null;                 // OpenCL program
var filterKernel    = null;                 // OpenCL kernel
var inputBuffer     = null;                 // OpenCL buffer
var outputBuffer    = null;                 // OpenCL buffer

var nRGBAvals;
var nBytes;
var data;                                   // Float32Array (Uint8 does not work)

var blockSizeX = 64;                        // for ripple
var blockSizeY = 64;                        // for ripple

var globalThreads = new Int32Array(2);
var localThreads = new Int32Array(2);

var isCLActive = false;                     // prevent requeuing while still active


function InitCL() {
    try {
        cl = new WebCLComputeContext();
    }
    catch (e) {
        console.log(e.message);
        return false;
    }

    if (cl === null) {
        console.error("Failed to create WebCL context");
        return false;
    }

    // Select a compute device
    //
    platform_ids = cl.getPlatformIDs();
    if (cl.getError() !== cl.SUCCESS) {
        console.error("Failed to get platform IDs");
        return false;
    }
    if (platform_ids.length === 0) {
        console.error("No platforms available");
        return false;
    }
    platform_id = platform_ids[0];

    // Select a compute device
    //
    var gpu = false;
    device_ids = cl.getDeviceIDs(platform_id, gpu ? cl.DEVICE_TYPE_GPU : cl.DEVICE_TYPE_CPU);
    if (cl.getError() !== cl.SUCCESS) {
        console.error("Failed to get device IDs");
        return false;
    }
    if (device_ids.length === 0) {
        console.error("No devices available");
        return false;
    }
    device_id = device_ids[0];

    // Create a compute context
    //
    context = cl.createContext(null, device_id, null, null);
    if (cl.getError() !== cl.SUCCESS) {
        console.error("Failed to create a compute context");
        return false;
    }

    // Create a command queue
    //
    queue = cl.createCommandQueue(context, device_id, null);
    if (cl.getError() !== cl.SUCCESS) {
        console.error("Failed to create a command queue");
        return false;
    }

    // Create the compute program from the source buffer
    //
    var kernelSource = getKernel("Ripple_kernel");
    if (kernelSource === null) {
        console.error("No kernel named: " + "Ripple_kernel");
        return false;
    }

    filterProgram = cl.createProgramWithSource(context, kernelSource);
    if (cl.getError() !== cl.SUCCESS) {
        console.error("Failed to create compute program");
        return;
    }

    // Build the program executable
    //
    cl.buildProgram(filterProgram, null, null, null);
    if (cl.getError() !== cl.SUCCESS) {
        console.error("Failed to build program executable");
        var info = cl.getProgramBuildInfo(filterProgram, device_id, cl.PROGRAM_BUILD_LOG);
        console.log(info);
        return false;
    }

    // Create the compute kernel in the program we wish to run
    //
    filterKernel = cl.createKernel(filterProgram, "Ripple_kernel");
    if (cl.getError() !== cl.SUCCESS) {
        console.error("Failed to create compute kernel");
        return false;
    }

    // Get the maximum work group size for executing the various kernels on the device
    //
    var maxWorkGroupSize = cl.getKernelWorkGroupInfo(filterKernel, device_id, cl.KERNEL_WORK_GROUP_SIZE);
    if (cl.getError() !== cl.SUCCESS) {
        console.error("Failed to retrieve kernel work group info");
        return false;
    }
    console.log("maxWorkGroupSize: " + maxWorkGroupSize);

    while (blockSizeX * blockSizeY > maxWorkGroupSize) {
        blockSizeX = blockSizeX / 2;
        blockSizeY = blockSizeY / 2;
    }
    console.log("blockSizeX: " + blockSizeX);
    console.log("blockSizeY: " + blockSizeY);

    // Image has loaded so create OpenCL buffer objects
    //
    nRGBAvals = width * height * 4;
    nBytes = nRGBAvals * Float32Array.BYTES_PER_ELEMENT;

    inputBuffer = cl.createBuffer(context, cl.MEM_READ_ONLY, nBytes, null);
    outputBuffer = cl.createBuffer(context, cl.MEM_WRITE_ONLY, nBytes, null);
    data = new Float32Array(nRGBAvals);

    if (inputBuffer === null) {
        console.error("Failed to create input buffer");
        return false;
    }

    if (outputBuffer === null) {
        console.error("Failed to create output buffer");
        return false;
    }

    // Write our image into the input array in device memory
    //
    var inputPixels = inputContext.getImageData(0, 0, width, height).data;
    for (var i=0; i<nRGBAvals; i++)
        data[i] = inputPixels[i];

    cl.enqueueWriteBuffer(queue, inputBuffer, true, 0, nBytes, data, null);
    if (cl.getError() !== cl.SUCCESS) {
        console.error("Failed to write to source image");
        return false;
    }

    return true;
}

function CloseCL() {
    if (outputBuffer !== null)
        cl.releaseMemObject(outputBuffer);
    if (inputBuffer !== null)
        cl.releaseMemObject(inputBuffer);
    if (filterKernel !== null)
        cl.releaseKernel(filterKernel);
    if (filterProgram !== null)
        cl.releaseProgram(filterProgram);
    if (queue !== null)
        cl.releaseCommandQueue(queue);
    if (context !== null)
        cl.releaseContext(context);
}

function RunFilterCL(t, cx, cy, diag) {
    if (isCLActive)
        return;

    isCLActive = true;
    RunRippleCL(t, cx, cy, diag);
}

function RunRippleCL(t, cx, cy, diag) {
    // Set the arguments to our compute kernel
    //
    err = 0;
    err  |= cl.setKernelArgGlobal(filterKernel, 0, inputBuffer);
    err  |= cl.setKernelArgGlobal(filterKernel, 1, outputBuffer);
    err  |= cl.setKernelArg(filterKernel, 2, width,  cl.KERNEL_ARG_INT);
    err  |= cl.setKernelArg(filterKernel, 3, height, cl.KERNEL_ARG_INT);
    err  |= cl.setKernelArg(filterKernel, 4, diag, cl.KERNEL_ARG_FLOAT);
    err  |= cl.setKernelArg(filterKernel, 5, t,  cl.KERNEL_ARG_INT);
    err  |= cl.setKernelArg(filterKernel, 6, cx, cl.KERNEL_ARG_INT);
    err  |= cl.setKernelArg(filterKernel, 7, cy, cl.KERNEL_ARG_INT);

    if (err !== cl.SUCCESS) {
        console.error("RunRippleCL: Failed to set kernel arguments");
        return;
    }

    globalThreads[0] = width;
    globalThreads[1] = height;
    localThreads[0] = blockSizeX;
    localThreads[1] = blockSizeY;

    tStart = new Date().valueOf();
    cl.enqueueNDRangeKernel(queue, filterKernel, 2, 0, globalThreads, localThreads, null);
    if (cl.getError() !== cl.SUCCESS) {
        console.error("RunRippleCL: Failed to execute kernel");
        return;
    }

    // Wait for the command queue to get serviced before reading back results
    //
    cl.finish(queue, GetResults, cl);
}

function  GetResults(userData) {
    tEnd = new Date().valueOf();

    // Read back the results from the device to verify the output
    //
    cl.enqueueReadBuffer(queue, outputBuffer, true, 0, nBytes, data, null);
    if (err !== cl.SUCCESS) {
        console.error("Failed to read output array");
        return;
    }
    isCLActive = false;

    // NOTE enqueueReadImage should do outputContext.putImageData(outputImageData, 0, 0);
    //
    var outputImageData = outputContext.getImageData(0, 0, width, height);
    var outputPixels = outputImageData.data;

    for (var i=0; i<nRGBAvals; i++)
        outputPixels[i] = data[i];

    outputContext.putImageData(outputImageData, 0, 0);

    ShowResults();
}
