
function getKernel (id ) {
    var kernelScript = document.getElementById( id );
    if(kernelScript === null || kernelScript.type !== "x-kernel")
        return null;

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

var globalWorkSize = null;
var localWorkSize = null;
var types = WebCLKernelArgumentTypes;


function InitCL(useGpu)
{
    try {

        // Create the compute program from the source buffer
        //
        var kernelSource = getKernel("sobel_filter");
        var deviceType = useGpu ? "GPU" : "CPU";
        
        if (kernelSource === null) {
            console.error("No kernel named: " + "sobel_filter");
            return null;
        }

        
        
        WebCLCommon.init(deviceType);
        device_ids = WebCLCommon.getDevices(deviceType);
        device_id = device_ids[0];
        context = WebCLCommon.createContext();
        program = WebCLCommon.createProgramBuild(kernelSource);
        queue = WebCLCommon.createCommandQueue();

        // Create the compute kernel in the program we wish to run
        //
        kernel = program.createKernel("sobel_filter");

        return webcl;

    } catch (e) {
        console.error("Error on InitWebCL = " + e.message);
        throw e;
    }
}

function SobelCL(cl, inputCanvas, outputCanvas, inputContext, outputContext)
{
    try {
        // Image has loaded so create OpenCL memory objects
        //
        var imageData = inputContext.getImageData(0, 0, inputCanvas.width, inputCanvas.height);
        var nPixels = imageData.data.length;

        if(inputData === null) {
            inputData = new Float32Array(nPixels);
        }
        for (var i=0; i < nPixels; i++) {
            inputData[i] = imageData.data[i];
        }

        if(inputBuffer === null) {
            inputBuffer = context.createBuffer(cl.MEM_READ_ONLY,
                Float32Array.BYTES_PER_ELEMENT * nPixels);
        }

        if(outputBuffer === null) {
            outputBuffer = context.createBuffer(cl.MEM_WRITE_ONLY,
                Float32Array.BYTES_PER_ELEMENT * nPixels);
        }

        if(inputBuffer === null || outputBuffer === null) {
            console.error("Failed to create buffers");
            return;
        }

        // Write our image into the input array in device memory
        //
        queue.enqueueWriteBuffer(inputBuffer, true, 0,
            Float32Array.BYTES_PER_ELEMENT * nPixels, inputData);


        var w = inputCanvas.width;
        var h = inputCanvas.height;

        // Set the arguments to our compute kernel
        //
        kernel.setArg(0, inputBuffer);
        kernel.setArg(1, outputBuffer);
        kernel.setArg(2, w, types.UINT);
        kernel.setArg(3, h, types.UINT);

        if(globalWorkSize === null || localWorkSize == null) {
            // Get the maximum work group size for executing the kernel on the device
            //
            var workGroupSize = kernel.getWorkGroupInfo(device_id, cl.KERNEL_WORK_GROUP_SIZE);
            if(workGroupSize < inputCanvas.width) {
                console.error("Max work group size is too small: " + workGroupSize);
                return;
            }

            // Execute the kernel over the entire range of our 2d input data set
            // using the maximum number of work group items for this device
            //
            blockSizeX = inputCanvas.width;
            blockSizeY = 1;
            if(blockSizeX * blockSizeY > workGroupSize) {
                console.error("Block sizes are too big");
                return;
            }

            globalWorkSize = new Int32Array([w, h]);
            localWorkSize = new Int32Array([blockSizeX, blockSizeY]);
        }

        queue.enqueueNDRangeKernel(kernel, 0, globalWorkSize, localWorkSize);

        // Wait for the command queue to get serviced before reading back results
        //
        queue.finish();

        imageData = outputContext.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
        nPixels = imageData.data.length;

        if(outputData === null) {
            outputData = new Float32Array(nPixels);
        }

        // Read back the results from the device to verify the output
        //

        queue.enqueueReadBuffer(outputBuffer, true, 0,
            Float32Array.BYTES_PER_ELEMENT * nPixels, outputData);
        queue.finish();

        for (var i = 0; i < nPixels; i+=4) {
            imageData.data[i] = outputData[i];
            imageData.data[i+1] = outputData[i+1];
            imageData.data[i+2] = outputData[i+2];
            imageData.data[i+3] = 255;
        }

        outputContext.putImageData(imageData, 0, 0);
    } catch(e) {
        console.error("Error on SobelCL = " + e.message);
        throw e;
    }
}

function resetBuffersCL() {
    inputBuffer = null;
    outputBuffer = null;
}
