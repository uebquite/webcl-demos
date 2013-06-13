
function getKernel (id ) {
    var kernelScript = document.getElementById( id );
    if(kernelScript === null || kernelScript.type !== "x-kernel")
        return null;

    //if(kernelScript.text !== null) return kernelScript.text; // old IE

    return kernelScript.firstChild.textContent;
}


var err;                                    // error code returned from API calls

var blockSizeX;
var blockSizeY;

var platform_ids;                           // array of OpenCL platform ids
var platform_id;                            // OpenCL platform id
var device_ids;                             // array of OpenCL device ids
var device_id;                              // OpenCL device id
var context;                                // OpenCL context
var queue;                                  // OpenCL command queue
var program;                                // OpenCL program
var kernel;                                 // OpenCL kernel
var inputBuffer = null;                     // OpenCL buffer
var outputBuffer = null;                    // OpenCL buffer

var inputData = null;                       // Float32Array
var outputData = null;                      // Float32Array

var globalThreads = null;
var ocalThreads = null;


function InitCL()
{
    if(typeof(WebCLComputeContext) === "undefined")
    {
        console.error("WebCLComputeContext is yet to be defined");
        return null;
    }
    
    cl = new WebCLComputeContext();

    if(cl === null)
    {
        console.error("Failed to create WebCL context");
        return null;
    }

    // Select a compute device
    //
    platform_ids = cl.getPlatformIDs();
    if (cl.getError() !== cl.SUCCESS)
    {
        console.error("Failed to get platform IDs");
        return null;
    }
    if(platform_ids.length === 0)
    {
        console.error("No platforms available");
        return null;
    }
    platform_id = platform_ids[0];

    // Select a compute device
    //
    var gpu = true;
    device_ids = cl.getDeviceIDs(platform_id, gpu ? cl.DEVICE_TYPE_GPU : cl.DEVICE_TYPE_CPU);
    if (cl.getError() !== cl.SUCCESS)
    {
        console.error("Failed to get device IDs");
        return null;
    }
    if(device_ids.length === 0)
    {
        console.error("No devices available");
        return null;
    }
    device_id = device_ids[0];

    // Create a compute context
    //
    context = cl.createContext(null, device_id, null, null);
    if (cl.getError() !== cl.SUCCESS)
    {
        console.error("Failed to create a compute context");
        return null;
    }

    // Create a command queue
    //
    queue = cl.createCommandQueue(context, device_id, null);
    if (cl.getError() !== cl.SUCCESS)
    {
        console.error("Failed to create a command queue");
        return;
    }

    // Create the compute program from the source buffer
    //
    var kernelSource = getKernel("sobel_filter");
    if (kernelSource === null)
    {
        console.error("No kernel named: " + "sobel_filter");
        return null;
    }

    program = cl.createProgramWithSource(context, kernelSource);
    if (cl.getError() !== cl.SUCCESS)
    {
        console.error("Failed to create compute program");
        return null;
    }

    // Build the program executable
    //
    err = cl.buildProgram(program, null, null, null);
    if (err !== cl.SUCCESS)
    {
        console.error("Failed to build program executable");
        var info = cl.getProgramBuildInfo(program, device_id, cl.PROGRAM_BUILD_LOG);
        console.log(info);
        return null;
    }

    // Create the compute kernel in the program we wish to run
    //
    kernel = cl.createKernel(program, "sobel_filter");
    if (cl.getError() !== cl.SUCCESS)
    {
        console.error("Failed to create compute kernel");
        return null;
    }
    
    return cl;
}

function SobelCL(cl, inputCanvas, outputCanvas, inputContext, outputContext)
{
    // Image has loaded so create OpenCL memory objects
    //
    var imageData = inputContext.getImageData(0, 0, inputCanvas.width, inputCanvas.height);
    var nPixels = imageData.data.length;
    
    if(inputData === null)
    {
        inputData = new Float32Array(nPixels);
    }
    for (var i=0; i < nPixels; i++) {
        inputData[i] = imageData.data[i];
    }
    
    if(inputBuffer === null)
    {
        inputBuffer = cl.createBuffer(context, cl.MEM_READ_ONLY, Float32Array.BYTES_PER_ELEMENT * nPixels, null);
    }
    
    if(outputBuffer === null)
    {
        outputBuffer = cl.createBuffer(context, cl.MEM_WRITE_ONLY, Float32Array.BYTES_PER_ELEMENT * nPixels, null);
    }

    if(inputBuffer === null || outputBuffer === null)
    {
        console.error("Failed to create buffers");
        return;
    }

    // Write our image into the input array in device memory
    //
    cl.enqueueWriteBuffer(queue, inputBuffer, true, 0, Float32Array.BYTES_PER_ELEMENT * nPixels, inputData, null);
    if (cl.getError() !== cl.SUCCESS)
    {
        console.error("Failed to write to source image");
        return;
    }

    var w = inputCanvas.width;
    var h = inputCanvas.height;

    // Set the arguments to our compute kernel
    //
    err = 0;
    err  |= cl.setKernelArg(kernel, 0, inputBuffer);
    err  |= cl.setKernelArg(kernel, 1, outputBuffer);
    err  |= cl.setKernelArg(kernel, 2, w);
    err  |= cl.setKernelArg(kernel, 3, h);
    if (err !== cl.SUCCESS)
    {
        console.error("Failed to set kernel arguments");
        return;
    }
    
    if(globalThreads === null || localThreads == null)
    {
        // Get the maximum work group size for executing the kernel on the device
        //
        var workGroupSize = cl.getKernelWorkGroupInfo(kernel, device_id, cl.KERNEL_WORK_GROUP_SIZE);
        if (cl.getError() !== cl.SUCCESS)
        {
            console.error("Failed to retrieve kernel work group info");
            return;
        }
        if(workGroupSize < inputCanvas.width) {
            console.error("Max work group size is too small: " + workGroupSize);
            return;
        }
    
        // Execute the kernel over the entire range of our 2d input data set
        // using the maximum number of work group items for this device
        //
        blockSizeX = inputCanvas.width;
        blockSizeY = 1;
        if(blockSizeX * blockSizeY > workGroupSize)
        {
            console.error("Block sizes are too big");
            return;
        }
        
        globalThreads = [w, h];
        localThreads = [blockSizeX, blockSizeY];
    }
    
    cl.enqueueNDRangeKernel(queue, kernel, 2, 0, new Int32Array(globalThreads), new Int32Array(localThreads), null);
    if (cl.getError() !== cl.SUCCESS)
    {
        console.error("Failed to execute kernel");
        return;
    }

    // Wait for the command queue to get serviced before reading back results
    //
    //cl.finish(queue, null, GetResults);
    cl.finish(queue, null, null);

    imageData = outputContext.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
    nPixels = imageData.data.length;
    
    if(outputData === null)
    {
        outputData = new Float32Array(nPixels);
    }

    // Read back the results from the device to verify the output
    //
    cl.enqueueReadBuffer(queue, outputBuffer, true, 0, Float32Array.BYTES_PER_ELEMENT * nPixels, outputData, null);

    if (err !== cl.SUCCESS)
    {
        console.error("Failed to read output array");
        return;
    }

    for (var i = 0; i < nPixels; i+=4) {
        imageData.data[i] = outputData[i];
        imageData.data[i+1] = outputData[i+1];
        imageData.data[i+2] = outputData[i+2];
        imageData.data[i+3] = 255;
    }

    outputContext.putImageData(imageData, 0, 0);
}
