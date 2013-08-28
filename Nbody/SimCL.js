/*
 * Copyright (C) 2011 Samsung Electronics Corporation. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided the following conditions
 * are met:
 *
 * 1.  Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 *
 * 2.  Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in the
 *     documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY SAMSUNG ELECTRONICS CORPORATION AND ITS
 * CONTRIBUTORS "AS IS", AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING
 * BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
 * FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL SAMSUNG
 * ELECTRONICS CORPORATION OR ITS CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
 * INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES(INCLUDING
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS, OR BUSINESS INTERRUPTION), HOWEVER CAUSED AND ON ANY THEORY
 * OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT(INCLUDING
 * NEGLIGENCE OR OTHERWISE ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
 * EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

// local OpenCL info
var context;                                // OpenCL context
var queue;                                  // OpenCL command queue
var program;                                // OpenCL program
var kernel;                                 // OpenCL kernel

var curPosBuffer;                           // OpenCL buffer created from GL VBO (if sharing)
var curVelBuffer;                           // OpenCL buffer created from GL VBO (if sharing)
var nxtPosBuffer;                           // OpenCL buffer
var nxtVelBuffer;                           // OpenCL buffer

var bufferSize = null;

var globalWorkSize = new Int32Array(1);
var localWorkSize = new Int32Array(1);
var workGroupSize = null;
var bodyCountPerGroup;

function getKernel(id) {
  var kernelScript = document.getElementById(id);
  if (kernelScript === null || kernelScript.type !== "x-kernel")
    return null;

  return kernelScript.firstChild.textContent;
}

function InitCL() {
    var cl = null;

    // Just disable CL-GL interop when CPU is being used
    if (!userData.gpu) {
        userData.isGLCLshared = false;
    } else {
        userData.isGLCLshared = true;
    }

    try {
        if (typeof(webcl) === "undefined") {
            console.error("WebCL is yet to be defined");
            return null;
        }
        cl = webcl;
        if (cl === null) {
            console.error("No webcl object available");
            return null;
        }

        var platforms = cl.getPlatforms();
        if (platforms.length === 0) {
            console.error("No platforms available");
            return null;
        }
        var platform = platforms[0];

        var devices = platform.getDevices(userData.gpu ? cl.DEVICE_TYPE_GPU : cl.DEVICE_TYPE_CPU);
        if (devices.length === 0) {
            console.error("No devices available");
            return null;
        }
        var device = devices[0];

        var extension = null;
        if(userData.isGLCLshared) {
            extension = cl.getExtension("KHR_GL_SHARING");

            if (extension === null)
                userData.isGLCLshared = false;
        }

        if(userData.isGLCLshared)
            context = extension.createContext({platform:platform, devices:devices, deviceType: userData.gpu ? cl.DEVICE_TYPE_GPU : cl.DEVICE_TYPE_CPU, sharedContext:null});
        else
            context = cl.createContext({platform:platform, devices:devices, deviceType: userData.gpu ? cl.DEVICE_TYPE_GPU : cl.DEVICE_TYPE_CPU});
        if(context === null) {
            console.error("createContext fails");
            return null;
        }

        var kernelSource = userData.gpu ? getKernel("nbody_kernel_GPU") : getKernel("nbody_kernel_CPU");
        if (kernelSource === null) {
            console.error("No kernel named: " + "nbody_kernel");
            return null;
        }

        queue = context.createCommandQueue(devices, null);
        program = context.createProgram(kernelSource);
        program.build([device]); //,"-cl-auto-vectorize-enable");
        kernel = userData.gpu ? program.createKernel("nbody_kernel_GPU") : program.createKernel("nbody_kernel_CPU");

        bufferSize = NBODY * POS_ATTRIB_SIZE * Float32Array.BYTES_PER_ELEMENT;

        if(userData.isGLCLshared) {
            // Create CL buffers from GL VBOs
            // (Initial load of positions is via gl.bufferData)
            curPosBuffer = context.createFromGLBuffer(cl.MEM_READ_WRITE, userData.curPosVBO);
            if (curPosBuffer === null) {
                console.error("Failed to allocate device memory");
                return null;
            }

            curVelBuffer = context.createFromGLBuffer(cl.MEM_READ_WRITE, userData.curVelVBO);
            if (curVelBuffer === null) {
                console.error("Failed to allocate device memory");
                return null;
            }
        } else {
            curPosBuffer = context.createBuffer(cl.MEM_READ_WRITE, bufferSize);
            if(curPosBuffer === null) {
                console.error("Failed to allocate device memory");
                return null;
            }

            curVelBuffer = context.createBuffer(cl.MEM_READ_WRITE, bufferSize);
            if(curVelBuffer === null) {
                console.error("Failed to allocate device memory");
                return null;
            }
        }

        // Create CL working buffers (will be copied to current buffers after computation)
        nxtPosBuffer = context.createBuffer(cl.MEM_READ_WRITE, bufferSize);
        if (nxtPosBuffer === null) {
            console.error("Failed to allocate device memory");
            return null;
        }

        nxtVelBuffer = context.createBuffer(cl.MEM_READ_WRITE, bufferSize);
        if (nxtVelBuffer === null) {
            console.error("Failed to allocate device memory");
            return null;
        }

        // Initial load of position and velocity data
        if(userData.isGLCLshared) {
            queue.enqueueAcquireGLObjects([curPosBuffer]);
            queue.enqueueAcquireGLObjects([curVelBuffer]);
        }

        queue.enqueueWriteBuffer(curPosBuffer, true, 0, bufferSize, userData.curPos);
        queue.enqueueWriteBuffer(curVelBuffer, true, 0, bufferSize, userData.curVel);

        if(userData.isGLCLshared) {
            queue.enqueueReleaseGLObjects([curPosBuffer]);
            queue.enqueueReleaseGLObjects([curVelBuffer]);
        }

        queue.finish();

        if (userData.gpu) {
            globalWorkSize[0] = NBODY;
        }

        localWorkSize[0] = userData.gpu ? Math.min(workGroupSize, NBODY) : 1;
        bodyCountPerGroup = NBODY / globalWorkSize[0];

        var nWorkGroups = Math.floor(NBODY/workGroupSize);
        if(NBODY % workGroupSize != 0)
            nWorkGroups += 1;

        console.log("NBODY:             " + NBODY);
        console.log("workGroupSize:     " + workGroupSize);
        console.log("nWorkGroups:       " + nWorkGroups);
        console.log("localWorkSize[0]:  " + localWorkSize[0]);
        console.log("globalWorkSize[0]: " + globalWorkSize[0]);
        console.log("bodyCountPerGroup: " + bodyCountPerGroup);
        console.log("kernel:            " + kernel.getInfo(cl.KERNEL_FUNCTION_NAME));
    } catch (e) {
        console.error("Nbody Demo Failed, Message: "+ e.message);
    }
    return cl;
}

function SimulateCL(cl) {
    if (cl === null) {
        return;
    }

    try {
        if (userData.isGLCLshared) {
            queue.enqueueAcquireGLObjects([curPosBuffer]);
            queue.enqueueAcquireGLObjects([curVelBuffer]);
        }
        var karg = WebCLKernelArgumentTypes;
        kernel.setArg(0, curPosBuffer);
        kernel.setArg(1, curVelBuffer);
        kernel.setArg(2, NBODY, karg.INT);
        kernel.setArg(3, DT, karg.FLOAT);
        kernel.setArg(4, EPSSQR, karg.INT);
        //5 set below, depends on CPU or GPU
        kernel.setArg(6, nxtPosBuffer);
        kernel.setArg(7, nxtVelBuffer);

        if (userData.gpu) {
            var localMemSize = localWorkSize[0] * POS_ATTRIB_SIZE * Float32Array.BYTES_PER_ELEMENT;
            kernel.setArg(5, localMemSize, karg.LOCAL_MEMORY_SIZE);
            queue.enqueueNDRangeKernel(kernel, null, globalWorkSize, null);
        } else {
            kernel.setArg(5, bodyCountPerGroup, karg.INT);
            queue.enqueueNDRangeKernel(kernel, null, globalWorkSize, localWorkSize);
        }

        queue.finish();

        queue.enqueueCopyBuffer(nxtPosBuffer, curPosBuffer, 0, 0, bufferSize);
        queue.enqueueCopyBuffer(nxtVelBuffer, curVelBuffer, 0, 0, bufferSize);

        if (userData.isGLCLshared) {
            queue.enqueueReleaseGLObjects([curPosBuffer]);
            queue.enqueueReleaseGLObjects([curVelBuffer]);
        }

        // read back if buffers not shared or using non-GL draw mode
        if (!userData.isGLCLshared || userData.drawMode === JS_DRAW_MODE) {
            queue.enqueueReadBuffer(curPosBuffer, true, 0, bufferSize, userData.curPos);
            queue.enqueueReadBuffer(curVelBuffer, true, 0, bufferSize, userData.curVel);
        }
    } catch (e) {
        console.error("Nbody Demo Failed, Message: "+ e.message);
    }
}

function GetWorkGroupSize() {
    if(workGroupSize !== null)
        return workGroupSize;
    try {
        if (typeof(webcl) === "undefined") {
            console.error("WebCL is yet to be defined");
            return null;
        }
        cl = webcl;
        if (cl === null) {
            console.error("No webcl object available");
            return null;
        }

        var platforms = cl.getPlatforms();
        if (platforms.length === 0) {
            console.error("No platforms available");
            return null;
        }
        var platform = platforms[0];

        var devices = platform.getDevices(userData.gpu ? cl.DEVICE_TYPE_GPU : cl.DEVICE_TYPE_CPU);
        if (devices.length === 0) {
            console.error("No devices available");
            return null;
        }
        var device = devices[0];

        workGroupSize = device.getInfo(cl.DEVICE_MAX_WORK_GROUP_SIZE);
        globalWorkSize[0] = device.getInfo(cl.DEVICE_MAX_COMPUTE_UNITS);
    } catch (e) {
        console.error("Nbody Demo Failed, Message: "+ e.message);
        workGroupSize = null;
    }
    return workGroupSize;
}
