/**
 * Some WebCL functions to help with some common or repeated tasks
 * like get context using CPU or GPU, build program and
 * create commandQueue
 *
 * Eg:
 *
 *  WebCLCommon.init("ALL");
 *  var ctx = WebCLCommon.createContext();
 *  var program = WebCLCommon.createProgramBuild(kernelSrc);
 *  var cmdQueue = WebCLCommon.createCommandQueue();
 *
 * @author Alexandre Rocha <alerock@gmail.com>
 */

window.WebCLCommon = (function(debug){

    var NO_WEBCL_FOUND = "Unfortunately your system does not support WebCL";
    var NO_PLATFORM_FOUND = "No WebCL platform found in your system";
    var NO_DEVICE_FOUND = "No WebCL device found in your system";
    var INVALID_SEQUENCE = "Context is null, you must create a context " +
    		"before call createWebCLProgram";

    /* Global vars */
    var platforms=[], devices=[], context = null, program = null, debug = false;

    /**
     * Return devices according required type
     *
     * @param {CLenum} type - CLenum that represents a device type
     */
    var getDevicesPerType = function(type) {
        var deviceList = [];

        try {
            for (var i=0; i<platforms.length; i++) {
                addElementsFormList(platform[i].getDevices(type), deviceList);
            }
        } catch(e) {
            if (debug) console.error(e);
            throw e;
        }

        return deviceList;
    };

    /**
     * Populate target with source content
     *
     * @param {Array} source - Array with elements to be copied
     * @param {Array} target - Array where the elements will be placed
     */
    var addElementsFromList = function(source, target) {

        if (!source instanceof Array) {
            throw new Error ("[source] must be an Array");
        }

        if (!target instanceof Array) {
            throw new Error ("[target] must be an Array");
        }

        for (var i=0; i<source.length; i++) {
            target.push(source[i]);
        }
    };

    /* API */
    return {

        /**
         * Check if WebCL is available and populate
         * platforms and devices. Type can be ALL, CPU or GPU.
         *
         */
        init : function(type) {

            if (window.webcl == undefined) {
                throw new Error(NO_WEBCL_FOUND);
              }

            platforms = webcl.getPlatforms();

            if (platforms.length === 0) {
                throw new Error(NO_PLATFORM_FOUND);
            }

            devices = []; //clear device list

            for (var i=0; i<platforms.length; i++) {
                switch (type) {
                case "CPU":
                    addElementsFromList(platforms[i].getDevices(webcl.DEVICE_TYPE_CPU), devices);
                    break;

                case "GPU":
                    addElementsFromList(platforms[i].getDevices(webcl.DEVICE_TYPE_GPU), devices);
                    break;

                case "ALL":
                    /* It is importante keep DEVICE_TYPE_CPU always above to make it
                     * default device (devices[0]) */
                    addElementsFromList(platforms[i].getDevices(webcl.DEVICE_TYPE_GPU), devices);
                    addElementsFromList(platforms[i].getDevices(webcl.DEVICE_TYPE_CPU), devices);
                    break;

                default:
                    throw new Error("Unexpected type " + type + " for devices");
                }
            }

            if (devices.length === 0) {
                throw new Error(NO_DEVICE_FOUND);
            }

        },

        /**
         * Create a WebCLContex
         *
         * @param {WebCLContextProperties} props
         * @returns {WebCLContext} context
         */
        createContext : function(props){
            var ctxProps = {};

            /* Populate ctxProps with default values */
            ctxProps.platform = (props && props.platform) ? props.platform : platforms[0];
            ctxProps.devices = (props && props.devices) ? props.devices : [devices[0]];
            ctxProps.deviceType = (props && props.deviceType) ? props.deviceType :  webcl.DEVICE_TYPE_GPU;
            ctxProps.shareGroup = (props && props.shareGroup) ? props.shareGroup : 0;
            ctxProps.hint = (props && props.hint) ? props.hint : null;

            try {
                context = webcl.createContext(ctxProps);
            } catch (e) {
                if (debug) console.error(e);
                throw e;
            }

            return context;
        },

        /**
         * Return a device list according required type
         * ALL, CPU or GPU are valid inputs
         *
         * @param {String} type - CPU, GPU
         * @returns {WebCLDevice[]} devices
         */
        getDevices : function(type) {

            switch (type) {

            case "ALL":
                return devices;
                break;

            case "CPU":
                return getDevicesPerType(webcl.DEVICE_TYPE_CPU);
                break;

            case "GPU":
                return getDevicesPerType(webcl.DEVICE_TYPE_GPU);
                break;

            default:
                throw new Error("Unknow device type " + type);
            }

            return devices;
        },

        /**
         * Return all platforms available
         *
         * @return {WebCLPlatforms[]} platforms
         */
        getPlatforms : function() {
            return platforms;
        },

        /**
         * Create WebCLProgram using the global WebCLCommon context
         *
         * @param {String} src - OpenCL code source
         * @returns {WebCLProgram} program
         */
        createProgram : function(src) {

            try {
                if (!context) {
                    throw new Error(INVALID_SEQUENCE);
                }

                program = context.createProgram(src);

            } catch (e) {
                if (debug) console.error(e);
                throw e;
            }

            return program;
        },

        createCommandQueue : function(device){

            var cmdQueue;

            try {
                cmdQueue = context.createCommandQueue(device || devices[0]);
            } catch (e) {
                if (debug) console.error(e);
                throw e;
            }

            return cmdQueue;
        },

        /**
         * Create WebCLProgram using the global WebCLCommon context
         * and buid the kernel source
         *
         * @param {String} src - OpenCL code source
         * @param {WebCLDevice[]} deviceList - Optional. If null, devices[0] will be used
         * @returns {WebCLProgram} program
         */
        createProgramBuild : function(src, deviceList) {
            var program;

            try {
                program  = this.createProgram(src);
                program.build(deviceList || [devices[0]]);
            } catch (e) {
                if (debug) console.error(e);
                throw e;
            }

            return program;
        },

        /**
         * Set global WebCLCommon.debug to true
         *
         */
        setDebugOn : function() {
            debug = true;
        },

        /**
         * Set global WebCLCommon.debug to false
         *
         */
        setDebugOff : function(){
            debug = false;
        }
    };

}());
