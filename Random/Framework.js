/**************************************
 *
 */

//TODO: Find a way to set the scripts dir
/* Load scripts/modules */
(function(scripts){

    var script;

    for(var i = 0; i < scripts.length; i++){
        script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = scripts[i];

        var heads = document.getElementsByTagName('head');
        heads[0].appendChild(script);
    }

})(['Metrics.js']);

Framework = (function(){

     /* Private */
    /* Constants */
    var LABEL_LIST_PLATFORMS = 'Choose platform';
    var LABEL_LIST_DEVICES = 'Choose devices';
    var DIV_LIST_PLATFORMS = 'listWebCLPlatforms';
    var DIV_LIST_DEVICES   = 'listWebCLDevices';
    var INPUT_ITERATIONS = 'inputIterations';
    var METRICS_INTERVAL = '100';
    var CONTEXT_PROPERTIES = {};

    /* Methods */

    var _changeStatus = function(/* boolean isRunning*/ isRunning){
        if(document.getElementById('showStatus')) {
            document.getElementById('showStatus').innerHTML = (isRunning) ? 'Running' : '';
        }
    };

    var _createAndBuildProgram = function(/* String methodName */ method){

        var start, end, duration;

        try{
            if(typeof(method) != 'function') {
                throw new Error('You must create a function into "clCreateCode"');
            }

            start = new Date();
            eval('(' + method + ')()');
            end = new Date();

            duration = end.getTime() - start.getTime();

            console.log('Create and build kernel duration: ' + duration + '(ms)');
        } catch(e) {
            throw e;
        }

    };

    var _runCode = function(/*String methodName */ method){
        var start, end, duration, iterations, trigger, i;

        API.running = true;

        try{

            //this.running = true;
            i = 0;

            iterations = parseInt(document.getElementById(INPUT_ITERATIONS).value);

            if(isNaN(iterations)) {
                throw new Error('Iterations value must be numeric');
            }

            if(typeof(method) != 'function') {
                throw new ReferenceError('You have to create a anonymous function into a var called ' +
                        method);
            }

            Metrics.init(METRICS_INTERVAL);

            trigger = function(){
                start = new Date();

                /* Execute de js code from tag script */
                eval('(' + method + ')()');
                end = new Date();
                duration = end.getTime() - start.getTime();

                Metrics.addDuration(duration);

                i++;

                setTimeout(function(){
                    if(i < iterations && API.running) {
                        trigger();
                    } else {
                        Metrics.calculate();
                        Metrics.showMetrics();
                        _changeStatus(false);
                    }
                }, 1);
            };

            setTimeout(function(){
                trigger();
            }, 1);


        } catch(e) {
                console.log('Error _runCode: ' + e);
                throw e;
        }
    };

    /**
     * Create a select list with available devices in
     * selected WebCLPlatform
     *
     * @param {WebCLPlatform} Selected WebCLPlatform
     */
    var _createDevicesList = function(/* WebCLPlatform */ platform){
        var elm, elmSelect, option;

        elm = document.getElementById(DIV_LIST_DEVICES);

        if(elm == undefined) {
            throw new Error('You must create a DIV with id = ' + DIV_LIST_DEVICES);
        }

        API.selectedPlatform = platform;

        /* Reset DIV */
        elm.innerHTML = '';

        /* Get available devices */
        API.devices = (platform != null) ? platform.getDevices() : null;

        elmSelect = document.createElement('select');

        /* Add event listener to set selected device */
        elmSelect.addEventListener('change', function(evt){

            if(evt.target.selectedIndex > 0) {
                API.selectedDevice = API.devices[evt.target.selectedIndex - 1];
            }

        });

        option = document.createElement('option');
        option.setAttribute('value', '');
        option.setAttribute('label', '-----');

        elmSelect.appendChild(option);

        for (var i in API.devices) {
            option = document.createElement('option');
            option.setAttribute('value', i);
            option.setAttribute('label', i + '- ' + API.devices[i].getInfo(webcl.DEVICE_PROFILE) +
                    ' - ' + API.getDeviceType(API.devices[i]));

            elmSelect.appendChild(option);
        }

        elm.appendChild(document.createTextNode(LABEL_LIST_DEVICES));
        elm.appendChild(elmSelect);
    };

    var _setContextProperties = function(/* obj {platform: , devices: , deviceType: } */
            properties) {


        //console.log(API);
        if(API.selectedPlatform == null || API.selectedDevice == null) {
            throw new Error('You must choose platform and device');
        }

        CONTEXT_PROPERTIES.platform = ((properties && properties.platform) || this.platforms[0]);
        CONTEXT_PROPERTIES.devices = ((properties && properties.devices) || this.platforms[0].getDevices());
        CONTEXT_PROPERTIES.deviceType = ((properties && properties.deviceType) || webcl.DEVICE_TYPE_ALL);
    };

    /**
     * Create a select list with available platforms
     */
    var _createPlatformsList = function(/* Array <WebCLPlatforms> */ platforms){
        var elm, elmSelect, option;
        var _this = this;

        elm = document.getElementById(DIV_LIST_PLATFORMS);

        if(elm == undefined) {
            throw new Error('You must create a DIV with id = ' + DIV_LIST_PLATFORMS);
        }

        elmSelect = document.createElement('select');

        /* Listen platform list changes */
        elmSelect.addEventListener('change',
                function(evt){

                    if(evt.target.selectedValue != '') {
                        _createDevicesList(_this.platforms[evt.target.value]);
                    }
                }
        );

        option = document.createElement('option');
        option.setAttribute('value', '');
        option.setAttribute('label', '-----');

        elmSelect.appendChild(option);

        for (var i in platforms) {
            option = document.createElement('option');
            option.setAttribute('value', i);
            option.setAttribute('label', i + ' - ' + platforms[i].getInfo(webcl.PLATFORM_PROFILE));

            elm.appendChild(document.createTextNode(LABEL_LIST_PLATFORMS + ' '));
            elmSelect.appendChild(option);
        }

        elm.appendChild(elmSelect);
    };

    /* Public */
    var API = {

        /* properties */
        clCode: null,
        jsCode: null,
        clCreateCode: null,
        compileKernel: null,
        createBuffers: null,
        platforms :  null,
        selectedPlatform: null,
        devices : null,
        selectedDevice: null,
        context: null,
        running : false,
        timer : null,
        kernel: null,
        kernelSource : null,
        program : null,
        queue : null,

        /**
         *
         * @param device
         * @returns {String}
         */
        getDeviceType: function(/*WebCLDevice */ device) {

            switch(device.getInfo(webcl.DEVICE_TYPE)) {
                case webcl.DEVICE_TYPE_CPU:
                    return 'CPU';

                case webcl.DEVICE_TYPE_GPU:
                    return 'GPU';

                default:
                    return 'undefined';
            }
        },

        createBuffer : function(/*CLenum */ memFlag, /* CLuint */ sizeInBytes){

            return this.context.createBuffer(memFlag, sizeInBytes);

        },

        /**
         *
         * @param args
         */
        setKernelArgs: function(/* ArrayBuffers args */ args){

            try {
                for(var i in args) {

                    if(args[i] instanceof Array) {
                        this.kernel.setArg(i, args[i][0], args[i][1]);
                    } else {
                        this.kernel.setArg(i, args[i]);
                    }
                }
            } catch(e) {
                console.log(e.message);
                throw e;
            }
        },

        //TODO: Create other function with kernel, globalWorkOffset and locallWorkSize as input parameter
        enqueueNDRangeKernel: function(/* CLuint[3] */ globalWorkSize) {

            /* Get local work size */
            var localWorkSize = new Int32Array(1);
            localWorkSize[0] = this.kernel.getWorkGroupInfo(this.selectedDevice, webcl.KERNEL_WORK_GROUP_SIZE);

            try {
                this.queue.enqueueNDRangeKernel(this.kernel, null, globalWorkSize, localWorkSize);
            } catch (e) {
                console.log(e.message);
                throw e;
            }

        },

        //TODO: Create method using CLboolean blockingRead, CLuint bufferOffset
        readBuffer: function(/* WebCLBuffer */ buffer, /* CLuint */ numBytes, /* ArrayBuffer*/ hostPtr ){

            /* Setting default values */
            var blockingRead = false;
            var bufferOffSet = 0;

            this.queue.enqueueReadBuffer(buffer, blockingRead, bufferOffSet, numBytes, hostPtr);

        },

        //TODO: Create method using blockingWrite, offset, numBytes and events
        writeBuffer : function(/*  WebCLBuffer */ buffer, /* CLuint */ sizeInBytes, /* ArrayBuffer */ hostPtr){

            /* Setting default values */
            var blockingWrite = true;
            var offset = 0;

            if(this.queue == null) {
                throw new Error('You must create a commandQueue before try to write a buffer');
            }

            this.queue.enqueueWriteBuffer(buffer, blockingWrite, offset, sizeInBytes, hostPtr);

        },

        loadCLSource : function(/* String script tag ID */ idSrc) {
            if(document.getElementById(idSrc) == undefined) {
                throw new Error('No tag found with id ' + idSrc);
            }

            this.kernelSource = document.getElementById(idSrc).firstChild.textContent;
        },

        createContext : function(/* obj {platform: , devices, deviceType } */
                properties){

            _setContextProperties(properties);

            this.context = webcl.createContext(CONTEXT_PROPERTIES);
        },

        createProgram : function(/*String scritp tag ID */ idSrc) {

            try {

                if(this.selectedDevice == null) {
                    throw new Error('You must select a WebCL platform and device');
                }

                this.loadCLSource(idSrc);
                this.createContext(null);
                this.program = this.context.createProgram(this.kernelSource);
                this.program.build([this.selectedDevice]);

                /* Reset queue (it will be created again) */
                this.queue = null;

            } catch(e) {
                alert(e.message);
                console.log(this.program.getBuildInfo(this.selectedDevice, webcl.PROGRAM_BUILD_LOG));
                return;
            }
        },

        createKernel : function(/* String kernel name */ kernelName){

            try{

                if(this.program == null){
                    throw new Error('You must call createProgram before try run createKernel');
                }

                this.kernel = this.program.createKernel(kernelName);

            } catch(e) {
                alert(e.message);
            }


        },

        /**
         *
         */
        createCommandQueue : function(){

            if(this.selectedDevice == null) {
                throw new Error('You must choose a platform and a device to run WebCL code');
            }

            this.queue = this.context.createCommandQueue(this.selecetdDevice, null);

        },

        /**
         * Init environment
         */
        initEnv : function(){
            var _this = this;
            var btIds = ['btJS', 'btCL'];

            try {

                for(var i in btIds) {
                    if(document.getElementById(btIds[i]) == null){
                        throw new Error('You must create a button with ID = ' + btIds[i]);
                    }
                }

                /* Add listeners to buttons */
                document.getElementById('btJS').addEventListener('click', function(){_this.runJSCode();});
                document.getElementById('btCL').addEventListener('click', function(){_this.runCLCode();});
                document.getElementById('btStop').addEventListener('click', function(){ _this.stop();});

                /* Get available platforms */
                platforms = webcl.getPlatforms();

                if(platforms.length < 1) {
                    throw new Error('WebCL platform not found');
                }

                /* Create platforms combo */
                _createPlatformsList(platforms);

                /* Create devices combos for first platform */
                _createDevicesList();

            } catch(e) {
                alert(e.message);
            }
        },

        /**
         * Buttom stop
         */
        stop : function(){
          this.running = false;
          _changeStatus(false);
        },

        /**
         * Buttom RunJS
         */
        runJSCode : function() {
            try {
                _changeStatus(true);
                _runCode(this.jsCode);
            } catch(e) {
                alert(e.message);
                this.stop();
            }
        },

        /**
         * Buttom RunWebCL
         */
        runCLCode : function() {
            try {
                _changeStatus(true);
                _createAndBuildProgram(this.clCreateCode);
                _runCode(this.clCode);
            } catch(e) {
                alert(e.message);
                this.stop();
            }
        },

        //TODO: Call WebCL Objects release methods
        finish: function() {
            this.queue.finish();
        }

    };

    return API;

})();
