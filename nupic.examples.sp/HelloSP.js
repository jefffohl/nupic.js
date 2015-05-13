var Parameters 		= require('../nupic/Parameters.js');
var Connections 	= require('../nupic/Connections.js');
var SpatialPooler 	= require('../nupic.research/SpatialPooler.js');
var ArrayUtils		= require('../nupic.util/ArrayUtils.js');
var util            = require('../cipun/util.js');

/**
 * A simple program that demonstrates the working of the spatial pooler
 * 
 * @author Neal Miller
 * @author Ralf Seliger (port to JavaScript)
 */
/**
 * 
 * @param inputDimensions         The size of the input.  {m, n} will give a size of m x n
 * @param columnDimensions        The size of the 2 dimensional array of columns
 */
var HelloSP = function(inputDimensions, columnDimensions) {

    this.parameters = null;
    this.inputArray = [];
    this.activeArray = [];
    this.inputSize = 1;
    this.columnNumber = 1;

    for (var i = 0; i < inputDimensions.length; i++) {
        this.inputSize *= inputDimensions[i];
    }

    for (var i = 0; i < columnDimensions.length; i++) {
        this.columnNumber *= columnDimensions[i];
    }

    this.activeArray = util.newArray([this.columnNumber], 0);

    this.parameters = new Parameters();
    var p = this.parameters.getSpatialDefaultParameters();

    p['INPUT_DIMENSIONS'] = inputDimensions;
    p['COLUMN_DIMENSIONS'] = columnDimensions;
    p['POTENTIAL_RADIUS'] = this.inputSize;
    p['GLOBAL_INHIBITIONS'] = true;
    p['NUM_ACTIVE_COLUMNS_PER_INH_AREA'] = 0.02 * this.columnNumber;
    p['SYN_PERM_ACTIVE_INC'] = 0.01;
    p['SYN_PERM_TRIM_THRESHOLD'] = 0.005;

    this.sp = new SpatialPooler();

    console.log("Setting up connections");
    this.mem = new Connections();
    this.parameters.apply(p, this.mem);
    console.log("Initializing spatial pooler (this will take some time)");
    this.sp.init(this.mem);
};

HelloSP.prototype = {
    /**
     * Create a random input vector
     */
    createInput: function() { // void(void)
        console.log("--------------------------------Creating a random input vector---------------------------------");

        this.inputArray = util.newArray([this.inputSize], 0);

        for (var i = 0; i < this.inputSize; i++) {
            // nextInt(2) returns 0 or 1
            this.inputArray[i] = Math.floor(Math.random() * 2);
        }
    },

    /**
     * Run the spatial pooler with the input vector
     */
    run: function() { // void(void)
        console.log("--------------------------------------Computing the SDR----------------------------------------");

        this.sp.compute(this.mem, this.inputArray, this.activeArray, true, true);

        var res = ArrayUtils.where(this.activeArray, function(n) {
            return n > 0;
        });
        console.log("" + res.toString() + "");

        if (arguments[0] === "done") {
            console.log("done");
        }
    },

    /**
     * Flip the value of a fraction of input bits (add noise)
     * @param noiseLevel        The percentage of total input bits that should be flipped
     */
    addNoise: function(noiseLevel) { // void(double)
        for (var i = 0; i < noiseLevel * this.inputSize; i++) {
            var randomPosition = Math.floor(Math.random() * this.inputSize);
            // Flipping the bit at the randomly picked position
            this.inputArray[randomPosition] = 1 - this.inputArray[randomPosition];
        }
    },

    main: function(args) { // void(String[])

        // Lesson 1
        console.log("Following columns represent the SDR",
                     "Different set of columns each time since we randomize the input",
                     "Lesson - different input vectors give different SDRs");

        //Trying random vectors
        for (var i = 0; i < 3; i++) {
            this.createInput();
            this.run();
        }

        //Lesson 2
        console.log("Identical SDRs because we give identical inputs",
                     "Lesson - identical inputs give identical SDRs");

        console.log("--------------------------------Using identical input vectors----------------------------------");

        //Trying identical vectors
        for (var i = 0; i < 2; i++) {
            this.run();
        }

        // Lesson 3
        console.log("Now we are changing the input vector slightly.",
                     "We change a small percentage of 1s to 0s and 0s to 1s.",
                     "The resulting SDRs are similar, but not identical to the original SDR",
                     "Lesson - Similar input vectors give similar SDRs");

        // Adding 10% noise to the input vector
        // Notice how the output SDR hardly changes at all
        console.log("---------------------------After adding 10% noise to the input vector--------------------------");
        this.addNoise(0.1);
        this.run();

        // Adding another 20% noise to the already modified input vector
        // The output SDR should differ considerably from that of the previous output
        console.log("-----------------------After adding another 20% noise to the input vector----------------------");
        this.addNoise(0.2);
        this.run("done");
    }
};

var example = new HelloSP([32, 32], [64, 64]);

example.main([]);

/*

onmessage = function(event) {
    var url = event.data.url;

    if (url.charAt(url.length - 1) !== "/") {
        url = url.slice(0, url.lastIndexOf("/") + 1);
    }

    importScripts(url + "cipun/util.js",
        url + "nupic/Connections.js",
        url + "nupic/Parameters.js",
        url + "nupic.util/MersenneTwister.js",
        url + "nupic.util/ArrayUtils.js",
        url + "nupic.util/SparseMatrix.js",
        url + "nupic.util/SparseBinaryMatrix.js",
        url + "nupic.util/SparseObjectMatrix.js",
        url + "nupic.model/Column.js",
        url + "nupic.model/Cell.js",
        url + "nupic.model/Column.js",
        url + "nupic.model/Segment.js",
        url + "nupic.model/ProximalDendrite.js",
        url + "nupic.model/DistalDendrite.js",
        url + "nupic.model/Pool.js",
        url + "nupic.model/Synapse.js",
        url + "nupic.research/SpatialPooler.js");

    var example = new HelloSP([32, 32], [64, 64]);

    example.main([]);
};

*/