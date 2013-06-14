var DATA_SIZE = 1024;

// Global data (moved out of main function so can access in clFinish callback),
// this should be moved to a UserData object...

// Note - Uint8, Uint32 do not work with our WebCL implementation of enqueueRead/Write buffer

var err;									// error code returned from API calls
var dataWidth   = 512;
var dataHeight  = 512;
var NINTS       = dataWidth * dataHeight;

var freeData    = new Int32Array(NINTS);
var encData     = new Int32Array(NINTS);
var decData     = new Int32Array(NINTS);

//var KEYSIZE     = 256;
var KEYSIZE     = 176;      // (rounds +1) * 128/8 = 11*16
var roundKey    = new Int32Array(KEYSIZE/4);

var cl;										// OpenCL context
var platform_ids;							// array of compue platform ids
var platform_id;							// compute platform id
var device_ids;								// array of device ids
var device_id;								// compute device id
var context;								// compute context
var queue;									// compute command queue
var program;								// compute program
var kernelEncrypt;                          // compute kernel
var kernelDecrypt;                          // compute kernel

var freeBuf;								// compute buffer
var encBuf;                                 // compute buffer
var decBuf;                                 // compute buffer
var roundKeyBuf;                            // compute buffer

var globalThreads = new Int32Array(2);      // global thread count
var localThreads  = new Int32Array(2);      // workgroup thread count

var tStart;
var tEnd;


function InitCL()
{
	// Fill our data with initial values
	//
    for(var i = 0; i < NINTS; i++) {
        freeData[i] = i;
        encData[i] = 0;
        decData[i] = 0;
    }
    
    // Fill our key with initial values
    //
    for(var i = 0; i < KEYSIZE/4; i++)
        roundKey[i] = i;

    if(typeof(WebCLComputeContext) === "undefined") {
        console.error("WebCLComputeContext is yet to be undefined");
        return null;
    }

	cl = new WebCLComputeContext();

	if(cl === null)
	{
		console.error("Failed to create WebCL context");
		return;
	}
    console.log("WebCL: WebCLComputeContext created");

	platform_ids = cl.getPlatformIDs();
	if (cl.getError() !== cl.SUCCESS)
	{
		console.error("Failed to get platform IDs");
		return;
	}
	if(platform_ids.length === 0)
	{
		console.error("No platforms available");
		return;
	}
	platform_id = platform_ids[0]; 

	// Connect to a compute device
	//
	var gpu = true;
	device_ids = cl.getDeviceIDs(platform_id, gpu ? cl.DEVICE_TYPE_GPU : cl.DEVICE_TYPE_CPU);
	if (cl.getError() !== cl.SUCCESS)
	{
		console.error("Failed to get device IDs");
		return;
	}
	if(device_ids.length === 0)
	{
		console.error("No devices available");
		return;
	}
	device_id = device_ids[0];

	// Create a compute context
	//
	context = cl.createContext(null, device_id, null, null);
	if (cl.getError() !== cl.SUCCESS)
	{
		console.error("Failed to create a compute context");
		return;
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
    var kernelSource = getKernel("AESEncryptDecrypt");
	if (kernelSource === null)
	{
        console.error("No kernel named: " + "AESEncryptDecrypt");
		return;
	}
	program = cl.createProgramWithSource(context, kernelSource);
	if (cl.getError() !== cl.SUCCESS)
	{
		console.error("Failed to create compute program");
		return;
	}

	// Build the program executable
	//
	cl.buildProgram(program, null, null, null);
	if (cl.getError() !== cl.SUCCESS)
	{
		console.error("Failed to build program executable");
		var info = cl.getProgramBuildInfo(program, device_id, cl.PROGRAM_BUILD_LOG);
		console.log(info);
		return;
	}

	// Create compute kernels in the program we wish to run
	//
    kernelEncrypt = cl.createKernel(program, "AESEncrypt");
	if (cl.getError() !== cl.SUCCESS)
	{
        console.error("Failed to create AESEncrypt kernel");
		return;
	}
    console.log("WebCL: kernelEncrypt created");
  
    kernelDecrypt = cl.createKernel(program, "AESDecrypt");
    if (cl.getError() !== cl.SUCCESS)
    {
        console.error("Failed to create AESDecrypt kernel");
        return;
    }
    console.log("WebCL: kernelDecrypt created");

	// Create the memory buffers for our calculation
	//
    freeBuf = cl.createBuffer(context, cl.MEM_READ_ONLY,  Int32Array.BYTES_PER_ELEMENT * NINTS, null);
    encBuf  = cl.createBuffer(context, cl.MEM_READ_WRITE, Int32Array.BYTES_PER_ELEMENT * NINTS, null);
    decBuf  = cl.createBuffer(context, cl.MEM_WRITE_ONLY, Int32Array.BYTES_PER_ELEMENT * NINTS, null);
    if (freeBuf === null || encBuf === null || decBuf === null)
	{
        console.error("Failed to allocate freeBuf or encBuf or decBuf");
		return;
	}
    
    roundKeyBuf = cl.createBuffer(context, cl.MEM_READ_ONLY, KEYSIZE, null);
    if (roundKeyBuf === null)
    {
        console.error("Failed to allocate roundKeyBuf");
        return;
    }
    
    // Get the maximum work group size for executing the kernel on the device
    //
    var maxWorkGroupSize = cl.getKernelWorkGroupInfo(kernelEncrypt, device_id, cl.KERNEL_WORK_GROUP_SIZE);
    if (cl.getError() !== cl.SUCCESS)
    {
        console.error("Failed to retrieve kernel work group info");
        return;
    }
    console.log("WebCL: maxWorkGroupSize: " + maxWorkGroupSize);

    globalThreads[0] = dataWidth;
    globalThreads[1] = dataHeight;
    
    localThreads[0] = 64;
    localThreads[1] = 4;
    
    if(localThreads[0] * localThreads[1] > maxWorkGroupSize)
    {
        console.error("Workgroup size too large");
        return;
    }
    
    HideResults();
}

function EncryptCL(rounds)
{
    tStart = new Date().valueOf();
    
    // Write our data set into the input array in device memory
	//
    cl.enqueueWriteBuffer(queue, freeBuf, true, 0, Int32Array.BYTES_PER_ELEMENT * NINTS, freeData, null);
	if (cl.getError() !== cl.SUCCESS)
	{
		console.error("Failed to write encbuf");
		return;
	}
    
    cl.enqueueWriteBuffer(queue, roundKeyBuf, true, 0, KEYSIZE, roundKey, null);
    if (cl.getError() !== cl.SUCCESS)
    {
        console.error("Failed to write roundKeyBuf");
        return;
    }
    console.log("WebCL-enc: OK enqueueWriteBuffer");

	// Set the arguments to our compute kernel
	//
    cl.setKernelArgGlobal(kernelEncrypt, 0, encBuf);
    cl.setKernelArgGlobal(kernelEncrypt, 1, freeBuf);
    cl.setKernelArgGlobal(kernelEncrypt, 2, roundKeyBuf);

    cl.setKernelArgLocal(kernelEncrypt, 3, localThreads[0] * localThreads[1] * 4);  // from AMD code
    cl.setKernelArgLocal(kernelEncrypt, 4, localThreads[0] * localThreads[1] * 4);  // from AMD code
    
    cl.setKernelArg(kernelEncrypt, 5, rounds, cl.KERNEL_ARG_UINT);
      
	if (cl.getError()!== cl.SUCCESS)
	{
		console.error("Failed to set kernel arguments");
		return;
	}

	// Execute the kernel over the entire range of our 2d input data set
	//
    cl.enqueueNDRangeKernel(queue, kernelEncrypt, 2, 0, globalThreads, localThreads, null);
	if (cl.getError() !== cl.SUCCESS)
	{
		console.error("Failed to execute kernel");
		return;
	}
    console.log("WebCL-enc: OK enqueueNDRangeKernel");

	// Wait for the command queue to get serviced before reading back results
	//
    cl.finish(queue, OnEncryptComplete, cl);
}

function  OnEncryptComplete(userData)
{
	// Read back the results from the device to verify the output
	//
    cl.enqueueReadBuffer(queue, encBuf, true, 0, Int32Array.BYTES_PER_ELEMENT * NINTS, encData, null);
    tEnd = new Date().valueOf();
	if (cl.getError() !== cl.SUCCESS)
	{
		console.error("Failed to read output array");
		return;
	}
    console.log("WebCL-enc: OK enqueueReadBuffer");
    
    //for(var i=0; i<10; i++)
    //    console.log("free[" + i + "]=" + freeData[i] + " enc[" + i + "]=" + encData[i] + " dec[" + i + "]=" + decData[i]);
        
    ShowResults();
}

function DecryptCL(rounds)
{
    tStart = new Date().valueOf();
    
    // Write our data set into the input array in device memory
    //
    cl.enqueueWriteBuffer(queue, encBuf, true, 0, Int32Array.BYTES_PER_ELEMENT * NINTS, encData, null);
    if (cl.getError() !== cl.SUCCESS)
    {
        console.error("Failed to write freebuf");
        return;
    }
    
    cl.enqueueWriteBuffer(queue, roundKeyBuf, true, 0, KEYSIZE, roundKey, null);
    if (cl.getError() !== cl.SUCCESS)
    {
        console.error("Failed to write roundKeyBuf");
        return;
    }
    console.log("WebCL-dec: OK enqueueWriteBuffer");

    // Set the arguments to our compute kernel
    //
    cl.setKernelArgGlobal(kernelDecrypt, 0, decBuf);
    cl.setKernelArgGlobal(kernelDecrypt, 1, encBuf);
    cl.setKernelArgGlobal(kernelDecrypt, 2, roundKeyBuf);

    cl.setKernelArgLocal(kernelDecrypt, 3, localThreads[0] * localThreads[1] * 4);  // from AMD code
    cl.setKernelArgLocal(kernelDecrypt, 4, localThreads[0] * localThreads[1] * 4);  // from AMD code
    
    cl.setKernelArg(kernelDecrypt, 5, rounds, cl.KERNEL_ARG_UINT);
      
    if (cl.getError()!== cl.SUCCESS)
    {
        console.error("Failed to set kernel arguments");
        return;
    }

    // Execute the kernel over the entire range of our 2d input data set
    //
    cl.enqueueNDRangeKernel(queue, kernelDecrypt, 2, 0, globalThreads, localThreads, null);
    if (cl.getError() !== cl.SUCCESS)
    {
        console.error("Failed to execute kernel");
        return;
    }
    console.log("WebCL-dec: OK enqueueNDRangeKernel");

    // Wait for the command queue to get serviced before reading back results
    //
    cl.finish(queue, OnDecryptComplete, cl);
}

function  OnDecryptComplete(userData)
{
    // Read back the results from the device to verify the output
    //
    cl.enqueueReadBuffer(queue, decBuf, true, 0, Int32Array.BYTES_PER_ELEMENT * NINTS, decData, null);
    tEnd = new Date().valueOf();
    if (cl.getError() !== cl.SUCCESS)
    {
        console.error("Failed to read output array");
        return;
    }
    console.log("WebCL-dec: OK enqueueReadBuffer");
    
    //for(var i=0; i<10; i++)
    //    console.log("free[" + i + "]=" + freeData[i] + " dec[" + i + "]=" + decData[i]);
        
    ShowResults();
    
    // validate
    var badCnt = 0;
    for(var i=0; i<NINTS; i++) {
        if(freeData[i] !== decData[i]) {
            badCnt++;
        }
    }
    
    if(badCnt !== 0) console.error("AES fails");
    
    console.log("total: " + NINTS + ", bad: " + badCnt);
}

function ShowResults()
{
    console.log("delta: " + (tEnd - tStart) + " msec");
    
    var delta = Math.max(1, tEnd - tStart);                             // msec
    var bps = 1000 * NINTS * Int32Array.BYTES_PER_ELEMENT / delta;      // bytes / sec
    var mbps = Math.floor(bps / (1024 * 1024));
    
    document.getElementById("bps").firstChild.nodeValue = mbps + " MB/sec";
    
    document.getElementById("res").style.visibility = "visible";
    document.getElementById("bps").style.visibility = "visible";
}

function HideResults()
{
    document.getElementById("res").style.visibility = "hidden";
    document.getElementById("bps").style.visibility = "hidden";
}


