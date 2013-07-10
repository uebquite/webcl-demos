var DATA_SIZE = 1024;

var err;                                    // error code returned from API calls
var dataWidth   = 4;
var dataHeight  = 4;
var NINTS       = dataWidth * dataHeight;

var text        = "1234567890123456";
var textUint    = new Uint8Array(NINTS);
var encData     = new Uint8Array(NINTS);
var decData     = new Uint8Array(NINTS);

var KEYSIZE     = 176;      // (rounds +1) * 128/8 = 11*16
var roundKey    = new Uint8Array(KEYSIZE); // 176 bytes -> 44 words

var cl;                                     // OpenCL context
var platform_ids;                           // array of compue platform ids
var platform_id;                            // compute platform id
var device_ids;                             // array of device ids
var device_id;                              // compute device id
var context;                                // compute context
var queue;                                  // compute command queue
var program;                                // compute program
var kernelEncrypt;                          // compute kernel
var kernelDecrypt;                          // compute kernel

var freeBuf;                                // compute buffer
var encBuf;                                 // compute buffer
var decBuf;                                 // compute buffer
var roundKeyBuf;                            // compute buffer

var DIM = 1;
var globalThreads = new Int32Array(DIM);      // global thread count
var localThreads  = new Int32Array(DIM);      // workgroup thread count

var tStart;
var tEnd;

function encryptCL(rounds) {

    try {
        tStart = new Date().valueOf();

        // Write our plain text into the input array in device memory
        queue.enqueueWriteBuffer(freeBuf, true, 0, NINTS, textUint);
        queue.enqueueWriteBuffer(roundKeyBuf, true, 0, KEYSIZE, roundKey);

        // Set the arguments to our compute kernel
        kernelEncrypt.setArg(0, encBuf);
        kernelEncrypt.setArg(1, freeBuf);
        kernelEncrypt.setArg(2, roundKeyBuf);
        kernelEncrypt.setArg(3, rounds, WebCLKernelArgumentTypes.UINT);

        // Execute the kernel
        queue.enqueueNDRangeKernel(kernelEncrypt, null, globalThreads, localThreads);

        // Wait for the command queue to get serviced before reading back results
        queue.finish();
        onEncryptComplete();
    } catch (e) {
        console.error("Encrypt Error", e.message);
    }
}

function onEncryptComplete() {

    // Read back the encrypt text from the device
    queue.enqueueReadBuffer(encBuf, true, 0, NINTS, encData);
    tEnd = new Date().valueOf();

    showResults(tStart, tEnd);
}

function decryptCL(rounds) {

    try {
        tStart = new Date().valueOf();

        // Write our encrypt text into the input array in device memory
        queue.enqueueWriteBuffer(encBuf, true, 0, NINTS, encData);
        queue.enqueueWriteBuffer(roundKeyBuf, true, 0, KEYSIZE, roundKey);

        // Set the arguments to our compute kernel
        kernelDecrypt.setArg(0, decBuf);
        kernelDecrypt.setArg(1, encBuf);
        kernelDecrypt.setArg(2, roundKeyBuf);
        kernelDecrypt.setArg(3, rounds, WebCLKernelArgumentTypes.UINT);

        // Execute the kernel over the entire range of our 2d input data set
        queue.enqueueNDRangeKernel(kernelDecrypt, 0, globalThreads, localThreads);

        // Wait for the command queue to get serviced before reading back results
        queue.finish();
        onDecryptComplete();
    } catch(e) {
        console.error("Decrypt Error", e.message);
    }
}

function onDecryptComplete() {
    var i;
    var badCnt;

    // Read back the decrypt text from the device to verify the output
    queue.enqueueReadBuffer(decBuf, true, 0, NINTS, decData);
    tEnd = new Date().valueOf();

    showResults(tStart, tEnd);

    // validate
    badCnt = 0;
    for (i = 0; i < NINTS; i++) {
        if (textUint[i] !== decData[i]) {
            badCnt++;
        }
    }

    if(badCnt !== 0) {
        console.error("AES fails");
    }
    console.log("total: " + NINTS + ", bad: " + badCnt);
}

// get kernel source
function getKernel(id) {
    var kernelScript = document.getElementById( id );
    if(kernelScript === null || kernelScript.type !== "x-kernel")
        return null;

    return kernelScript.firstChild.textContent;
}

function initCL() {
    var gpu = false;
    var contextProperties;
    var kernelSource;

    if(webcl === "undefined") {
        console.error("WebCL is yet to be undefined");
        return null;
    }
    cl = webcl;

    platform_ids = cl.getPlatforms();
    if(platform_ids.length === 0) {
        console.error("No platforms available");
        return;
    }
    platform_id = platform_ids[0];

    device_ids = platform_id.getDevices(gpu ? cl.DEVICE_TYPE_GPU : cl.DEVICE_TYPE_CPU);
    if(device_ids.length === 0) {
        console.error("No devices available");
        return;
    }
    device_id = device_ids[0];

    contextProperties = {platform: platform_id, devices: [device_id],
                         deviceType: gpu ? cl.DEVICE_TYPE_GPU : cl.DEVICE_TYPE_CPU};
    context = cl.createContext(contextProperties);
    if (!context)
    {
        console.error("Failed to create a WebCL context");
        return;
    }

    try {
        queue = context.createCommandQueue(device_id);

        kernelSource = getKernel("AESEncryptDecrypt");
        if (kernelSource === null) {
            console.error("No kernel named: " + "AESEncryptDecrypt");
            return;
        }

        program = context.createProgram(kernelSource);
        program.build(device_id);

        kernelEncrypt = program.createKernel("AESEncrypt");
        kernelDecrypt = program.createKernel("AESDecrypt");

        freeBuf = context.createBuffer(cl.MEM_READ_ONLY,  NINTS);
        encBuf  = context.createBuffer(cl.MEM_READ_WRITE, NINTS);
        decBuf  = context.createBuffer(cl.MEM_WRITE_ONLY, NINTS);
        roundKeyBuf = context.createBuffer(cl.MEM_READ_ONLY, KEYSIZE);

        globalThreads[0] = Math.ceil(text.length / 16);
        localThreads = null;
    } catch(e) {
        console.error("Error", e.message);
    }

    hideResults();
    encryptCL(10);
    decryptCL(10);
}

// return the hexadecimal representation in just one byte
function getBytes(num) {
    var bytes = [];
    var i;

    for (i = 0; i < 1; i++) {
        bytes[i] = (num & 255).toString(16);
        num >>= 8;
    }

    return bytes[0];
}

function initVars() {
    var tmp;
    var i;

    // get all ASCII code from the text's character
    for (i = 0; i < text.length; i++) {
        textUint[i] = text.charCodeAt(i);
    }

    // Fill round keys
    for(i = 0; i < KEYSIZE; i++) {
        roundKey[i] = i;
    }

    for(var i = 0; i < NINTS; i++) {
        encData[i] = 0;
        decData[i] = 0;
    }
}

function init() {
    initVars();
    initCL();
}
