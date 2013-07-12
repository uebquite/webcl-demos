var DATA_SIZE = 1024;

var err;                                    // error code returned from API calls
var NINTS       = NBYTES;

var text        = "1234567890123456";
var textUint;
var encData;
var decData;

var rounds      = 10;
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
var realText;

function readTest(num) {

    if (num == 0) {
        document.getElementById("inputText").value = "";
        document.getElementById("inputKey").value = "";
    }
    else {
        document.getElementById("inputText").value = tests["test" + num];
        document.getElementById("inputKey").value = tests["key" + num];
    }
}

function hexToString(hex) {
    var text;
    var i;

    text = [];
    hex = hex.split(" ");
    for (i = 0; i < hex.length; i++) {
        text[i] = parseInt(hex[i], 16);
    }

    return text;
}

function getInputText() {
    var text;
    var key;
    var textObject;
    var keyObject;
    var isPlainText;
    var len; // textUint length: it's a multiple of 16 bytes
             // padding zeros are add if necessary

    /* Get Text */

    textObject = document.getElementById("inputText");
    if (textObject === null) {
        return null;
    }

    text = textObject.value;
    if (!text) {
        return null;
    }

    isPlainText = document.getElementById("plainText").checked;
    if (isPlainText) {
        // get all ASCII code from the text's character
        len = 16 * Math.ceil(text.length / 16);
        textUint = new Uint8Array(len);
        for (i = 0; i < text.length; i++) {
            textUint[i] = text.charCodeAt(i);
        }
    }
    else {
        text = hexToString(text);
        len = 16 * Math.ceil(text.length / 16);
        textUint = new Uint8Array(len);
        for (i = 0; i < text.length; i++) {
            textUint[i] = text[i];
        }
    }

    /* Get Secret Key */

    keyObject = document.getElementById("inputKey");
    if (keyObject === null) {
        return null;
    }

    key = keyObject.value;
    if (!key) {
        return null;
    }

    if (isPlainText) {
        if (key.length != 16) {
            return null;
        }
        for (i = 0; i < 16; i++) {
            roundKey[i] = key.charCodeAt(i);
        }
    }
    else {
        key = hexToString(key);
        len = 16 * Math.ceil(key.length / 16);
        for (i = 0; i < 16; i++) {
            roundKey[i] = key[i];
        }
    }

    for (i = 16; i < KEYSIZE; i++) {
        roundKey[i] = i;
    }

    /*
    for (i = 0; i < KEYSIZE; i++) {
        roundKey[i] = i;
    }
    */

    return textUint;
}

function encryptCL() {
    var numBytes;

    // uncomment this to read from input
    //textUint = getInputText();
    if (!textUint) {
        alert("Invalid Text or Key Size");
        return;
    }

    try {
        tStart = new Date().valueOf();
        numBytes = textUint.length;

        // Initialize buffers
        freeBuf = context.createBuffer(cl.MEM_READ_ONLY,  numBytes);
        encBuf  = context.createBuffer(cl.MEM_READ_WRITE, numBytes);

        // Write our plain text into the input array in device memory
        queue.enqueueWriteBuffer(freeBuf, true, 0, numBytes, textUint);
        queue.enqueueWriteBuffer(roundKeyBuf, true, 0, KEYSIZE, roundKey);

        // Set the arguments to our compute kernel
        kernelEncrypt.setArg(0, encBuf);
        kernelEncrypt.setArg(1, freeBuf);
        kernelEncrypt.setArg(2, roundKeyBuf);
        kernelEncrypt.setArg(3, rounds, WebCLKernelArgumentTypes.UINT);

        // Execute the kernel
        globalThreads[0] = Math.ceil(numBytes / 16);
        queue.enqueueNDRangeKernel(kernelEncrypt, null, globalThreads, localThreads);

        // Wait for the command queue to get serviced before reading back results
        queue.finish();
        onEncryptComplete();
    } catch (e) {
        console.error("Encrypt Error", e.message);
    }
}

function onEncryptComplete() {
    var i;
    var encData;
    var strResult;
    var bytesToRead;
    var isPlainText;

    // variable to hold the results from the device
    bytesToRead = textUint.length;
    encData = new Uint8Array(bytesToRead);

    // Read back the encrypt text from the device
    queue.enqueueReadBuffer(encBuf, true, 0, bytesToRead, encData);
    tEnd = new Date().valueOf();

    // handle result
    strResult = "";
    isPlainText = document.getElementById("plainText").checked;
    if (isPlainText) {
        for (i = 0; i < encData.length; i++) {
            strResult += String.fromCharCode(encData[i]);
        }
    }
    else {
        for (i = 0; i < encData.length; i++) {
            strResult += getBytes(encData[i]);
            if (i+1 < encData.length) {
                strResult += " ";
            }
        }
    }

    // uncomment this to write in output
    //showResults(tStart, tEnd, "Encrypt Text", strResult);
    showResults(tStart, tEnd, "Encryption CL", "");

    realText = textUint;
    textUint = encData;
}

function decryptCL() {
    var numBytes;

    // uncomment this to read from input
    //textUint = getInputText();
    if (!textUint) {
        alert("Invalid Text");
        return;
    }

    try {
        tStart = new Date().valueOf();
        numBytes = textUint.length;

        // Initialize buffers
        encBuf  = context.createBuffer(cl.MEM_READ_ONLY, numBytes);
        decBuf = context.createBuffer(cl.MEM_READ_WRITE,  numBytes);

        // Write our encrypt text into the input array in device memory
        queue.enqueueWriteBuffer(encBuf, true, 0, numBytes, textUint);
        queue.enqueueWriteBuffer(roundKeyBuf, true, 0, KEYSIZE, roundKey);

        // Set the arguments to our compute kernel
        kernelDecrypt.setArg(0, decBuf);
        kernelDecrypt.setArg(1, encBuf);
        kernelDecrypt.setArg(2, roundKeyBuf);
        kernelDecrypt.setArg(3, rounds, WebCLKernelArgumentTypes.UINT);

        // Execute the kernel over the entire range of our 2d input data set
        globalThreads[0] = Math.ceil(numBytes / 16);
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
    var decData;
    var strResult;
    var bytesToRead;
    var isPlainText;

    // variable to hold the results from the device
    bytesToRead = textUint.length;
    decData = new Uint8Array(bytesToRead);

    // Read back the decrypt text from the device to verify the output
    queue.enqueueReadBuffer(decBuf, true, 0, bytesToRead, decData);
    tEnd = new Date().valueOf();

    // validate
    badCnt = 0;
    for (i = 0; i < NINTS; i++) {
        if (realText[i] !== decData[i]) {
            badCnt++;
        }
    }

    if(badCnt !== 0) {
        console.error("AES fails");
        console.error("Read: " + NINTS + ", Bad: " + badCnt);
    }
    else {
        console.log("AES Passed!");
    }

    // handle result
    strResult = "";
    isPlainText = document.getElementById("plainText").checked;
    if (isPlainText) {
        for (i = 0; i < decData.length; i++) {
            strResult += String.fromCharCode(decData[i]);
        }
    }
    else {
        for (i = 0; i < decData.length; i++) {
            strResult += getBytes(decData[i]);
            if (i+1 < decData.length) {
                strResult += " ";
            }
        }
    }

    // uncomment this to write in output
    //showResults(tStart, tEnd, "Decrypt Text", strResult);
    showResults(tStart, tEnd, "Decryption CL", "");
}

// get kernel source
function getKernel(id) {
    var kernelScript = document.getElementById( id );
    if(kernelScript === null || kernelScript.type !== "x-kernel")
        return null;

    return kernelScript.firstChild.textContent;
}

function initCLSettings() {
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

        roundKeyBuf = context.createBuffer(cl.MEM_READ_ONLY, KEYSIZE);

        globalThreads[0] = Math.ceil(text.length / 16);
        localThreads = null;
    } catch(e) {
        console.error("Error", e.message);
    }

    // TEMPORARY PART
    // Get the maximum work group size for executing the kernel on the device
    var maxWorkGroupSize = kernelEncrypt.getWorkGroupInfo(device_id, cl.KERNEL_WORK_GROUP_SIZE);
    console.error("WebCL: maxWorkGroupSize: " + maxWorkGroupSize);

    hideResults();
}

// return the hexadecimal representation in just one byte
function getBytes(num) {
    var bytes;
    var i;

    for (i = 0; i < 1; i++) {
        bytes = (num & 255).toString(16);
        num >>= 8;
    }

    return bytes;
}

function initCLVars() {
    var tmp;
    var len;
    var i;

    len = 16 * Math.ceil(NINTS / 16);
    textUint = new Uint8Array(len);
    for (i = 0; i < len; i++) {
        textUint[i] = i;
    }

    // Fill round keys
    for(i = 0; i < KEYSIZE; i++) {
        roundKey[i] = i;
    }
}

function initCL() {
    initCLVars();
    initCLSettings();
}
