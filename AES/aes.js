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

    if(webcl === "undefined") {
        console.error("WebCL is yet to be undefined");
        return null;
    }

    cl = webcl;

	if(cl === null)
	{
		console.error("Failed to create WebCL context");
		return;
	}
    console.log("WebCL created");

	platform_ids = cl.getPlatforms();
	if(platform_ids.length === 0)
	{
		console.error("No platforms available");
		return;
	}
	platform_id = platform_ids[0];

	// Connect to a compute device
	//
	var gpu = true;
	device_ids = platform_id.getDevices(gpu ? cl.DEVICE_TYPE_GPU : cl.DEVICE_TYPE_CPU);
	if(device_ids.length === 0)
	{
		console.error("No devices available");
		return;
	}
	device_id = device_ids[0];

	// Create a compute context
	//
    var contextProperties = {platform: platform_id, devices: device_id,
                             deviceType: gpu ? cl.DEVICE_TYPE_GPU : cl.DEVICE_TYPE_CPU,
                             shareGroup: 0, hint: null};
	context = cl.createContext(contextProperties);
	if (!context)
	{
		console.error("Failed to create a WebCL context");
		return;
	}

	// Create a command queue
	//
	queue = context.createCommandQueue(device_id);
	if (!queue)
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
	program = context.createProgram(kernelSource);
	if (!program)
	{
		console.error("Failed to create WebCL program");
		return;
	}

	// Build the program executable
	//
    try {
        program.build(device_id);
    } catch(e) {
        console.error("Failed to build WebCL program. Error: " +
        program.getBuildInfo(device_id, cl.PROGRAM_BUILD_LOG));
        return;
    }

	// Create compute kernels in the program we wish to run
	//
    kernelEncrypt = program.createKernel("AESEncrypt");
	if (!kernelEncrypt)
	{
        console.error("Failed to create AESEncrypt kernel");
		return;
	}
    console.log("WebCL: kernelEncrypt created");

    kernelDecrypt = program.createKernel("AESDecrypt");
    if (!kernelDecrypt)
    {
        console.error("Failed to create AESDecrypt kernel");
        return;
    }
    console.log("WebCL: kernelDecrypt created");

	// Create the memory buffers for our calculation
	//
    freeBuf = context.createBuffer(cl.MEM_READ_ONLY,  Int32Array.BYTES_PER_ELEMENT * NINTS);
    encBuf  = context.createBuffer(cl.MEM_READ_WRITE, Int32Array.BYTES_PER_ELEMENT * NINTS);
    decBuf  = context.createBuffer(cl.MEM_WRITE_ONLY, Int32Array.BYTES_PER_ELEMENT * NINTS);
    if (freeBuf === null || encBuf === null || decBuf === null)
	{
        console.error("Failed to allocate freeBuf or encBuf or decBuf");
		return;
	}

    roundKeyBuf = context.createBuffer(cl.MEM_READ_ONLY, KEYSIZE);
    if (roundKeyBuf === null)
    {
        console.error("Failed to allocate roundKeyBuf");
        return;
    }

    // Get the maximum work group size for executing the kernel on the device
    //
    var maxWorkGroupSize = kernelEncrypt.getWorkGroupInfo(device_id, cl.KERNEL_WORK_GROUP_SIZE);
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
    queue.enqueueWriteBuffer(freeBuf, true, 0, Int32Array.BYTES_PER_ELEMENT * NINTS, freeData);

    queue.enqueueWriteBuffer(roundKeyBuf, true, 0, KEYSIZE, roundKey);
    console.log("WebCL-enc: OK enqueueWriteBuffer");

	// Set the arguments to our compute kernel
	//
    kernelEncrypt.setArg(0, encBuf);
    kernelEncrypt.setArg(1, freeBuf);
    kernelEncrypt.setArg(2, roundKeyBuf);

    kernelEncrypt.setArg(3, localThreads[0] * localThreads[1] * 4);  // from AMD code
    kernelEncrypt.setArg(4, localThreads[0] * localThreads[1] * 4);  // from AMD code

    kernelEncrypt.setArg(5, rounds, WebCLKernelArgumentTypes.UINT);

	// Execute the kernel over the entire range of our 2d input data set
	//
    queue.enqueueNDRangeKernel(kernelEncrypt, 0, globalThreads, localThreads);
    console.log("WebCL-enc: OK enqueueNDRangeKernel");

	// Wait for the command queue to get serviced before reading back results
	//
    queue.finish();
    OnEncryptComplete();
}

function  OnEncryptComplete()
{
	// Read back the results from the device to verify the output
	//
    queue.enqueueReadBuffer(encBuf, true, 0, Int32Array.BYTES_PER_ELEMENT * NINTS, encData);
    queue.finish();
    tEnd = new Date().valueOf();
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
    queue.enqueueWriteBuffer(encBuf, true, 0, Int32Array.BYTES_PER_ELEMENT * NINTS, encData);

    queue.enqueueWriteBuffer(roundKeyBuf, true, 0, KEYSIZE, roundKey);
    console.log("WebCL-dec: OK enqueueWriteBuffer");

    // Set the arguments to our compute kernel
    //
    kernelDecrypt.setArg(0, decBuf);
    kernelDecrypt.setArg(1, encBuf);
    kernelDecrypt.setArg(2, roundKeyBuf);

    kernelDecrypt.setArg(3, localThreads[0] * localThreads[1] * 4);  // from AMD code
    kernelDecrypt.setArg(4, localThreads[0] * localThreads[1] * 4);  // from AMD code

    kernelDecrypt.setArg(5, rounds, WebCLKernelArgumentTypes.UINT);

    // Execute the kernel over the entire range of our 2d input data set
    //
    queue.enqueueNDRangeKernel(kernelDecrypt, 0, globalThreads, localThreads);
    console.log("WebCL-dec: OK enqueueNDRangeKernel");

    // Wait for the command queue to get serviced before reading back results
    //
    queue.finish();
    OnDecryptComplete();
}

function  OnDecryptComplete()
{
    // Read back the results from the device to verify the output
    //
    queue.enqueueReadBuffer(decBuf, true, 0, Int32Array.BYTES_PER_ELEMENT * NINTS, decData);
    queue.finish();
    tEnd = new Date().valueOf();
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

