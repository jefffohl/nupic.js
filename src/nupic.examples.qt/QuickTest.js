/* ---------------------------------------------------------------------
 * Numenta Platform for Intelligent Computing (NuPIC)
 * Copyright (C) 2014, Numenta, Inc.  Unless you have an agreement
 * with Numenta, Inc., for a separate license for this software code, the
 * following terms and conditions apply:
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see http://www.gnu.org/licenses.
 *
 * http://numenta.org/licenses/
 * ---------------------------------------------------------------------
 */

var Connections = require('../nupic/Connections.js');
var Parameters = require('../nupic/Parameters.js');
var CLAClassifier = require('../nupic.algorithms/CLAClassifier.js');
var ScalarEncoder = require('../nupic.encoders/ScalarEncoder.js');
var Cell = require('../nupic.model/Cell.js');
var ComputeCycle = require('../nupic.research/ComputeCycle.js');
var SpatialPooler = require('../nupic.research/SpatialPooler.js');
var TemporalMemory = require('../nupic.research/TemporalMemory.js');
var ArrayUtils = require('../nupic.util/ArrayUtils.js');

/**
 * Quick and dirty example of tying together a network of components.
 * This should hold off peeps until the Network API is complete.
 * (see: https://github.com/numenta/htm.java/wiki/Roadmap)
 *
 * <p>Warning: Sloppy sketchpad code, but it works!</p>
 *
 * <p><em><b>
 * To see the pretty printed test output and Classification results, uncomment all
 * the print out lines below
 * </b></em></p>
 *
 * @author PDove
 * @author cogmission
 */

var QuickTest = function() {

};

QuickTest.prototype = {

  main: function() {
    var params = this.getParameters();
    console.log("Parameters: ", params);
    var options = {
      "n" : 8,
      "w" : 3,
      "radius" : 1.0,
      "minVal" : 1.0,
      "maxVal" : 8,
      "periodic" : true,
      "forced" : true,
      "resolution" : 1
    };
    var encoder = new ScalarEncoder().build(options);
    var sp = new SpatialPooler();
    var tm = new TemporalMemory();
    var classifier = new CLAClassifier([1], 0.1, 0.3, 0);

    var layer = this.getLayer(params, encoder, sp, tm, classifier);

    for (var i = 1, x = 0; x < 10000; i = (i === 7) ? 1 : i + 1, x++) {
      if (i === 1) {
        tm.reset(layer.getMemory());
      }
      this.runThroughLayer(this.layer, i, i, x);
    }
  },

  getParameters: function() {
    this.parameters = new Parameters();
    var p = this.parameters.getAllDefaultParameters();

    p['INPUT_DIMENSIONS'] = [8];
    p['COLUMN_DIMENSIONS'] = [];
    p['CELLS_PER_COLUMN'] = 6;

    // SpatialPooler specific
    p['POTENTIAL_RADIUS'] = 12;
    p['POTENTIAL_PCT'] = 0.5;
    p['GLOBAL_INHIBITIONS'] = false;
    p['LOCAL_AREA_DENSITY'] = -1.0;
    p['NUM_ACTIVE_COLUMNS_PER_INH_AREA'] = 5.0;
    p['STIMULUS_THRESHOLD'] = 1.0;
    p['SYN_PERM_INACTIVE_DEC'] = 0.01;
    p['SYN_PERM_ACTIVE_INC'] = 0.1;
    p['SYN_PERM_TRIM_THRESHOLD'] = 0.05;
    p['SYN_PERM_CONNECTED'] = 0.1;
    p['MIN_PCT_OVERLAP_DUTY_CYCLE'] = 0.1;
    p['MIN_PCT_ACTIVE_DUTY_CYCLE'] = 0.1;
    p['DUTY_CYCLE_PERIOD'] = 10;
    p['MAX_BOOST'] = 10.0;
    p['SEED'] = 42;
    p['SP_VERBOSITY'] = 0;

    //Temporal Memory specific
    p['INITIAL_PERMANENCE'] = 0.2;
    p['CONNECTED_PERMANENCE'] = 0.8;
    p['MIN_THRESHOLD'] = 5;
    p['MAX_NEW_SYNAPSE_COUNT'] = 6;
    p['PERMANENCE_INCREMENT'] = 0.05;
    p['PERMANENCE_DECREMENT'] = 0.05;
    p['ACTIVATION_THRESHOLD'] = 4;

    return p;
  },

  runThroughLayer: function(l, input, recordNum, sequenceNum) {
    l.input(input, recordNum, sequenceNum);
  },

  getLayer: function(p, e, s, t, c) {
    var l = new Layer(p, e, s, t, c);
    return l;
  }

};


var Layer = function(p, e, s, t, c) {
  this.memory = new Connections();
  this.classification = new Map();

  this.params = p;
  this.encoder = e;
  this.spatialPooler = s;
  this.temporalMemory = t;

  this.params.apply(this.memory);
  this.spatialPooler.init(this.memory);
  this.temporalMemory.init(this.memory);

  this.columnCount = this.memory.getPotentialPools().getMaxIndex() + 1; //If necessary, flatten multi-dimensional index
  this.cellsPerColumn = this.memory.getCellsPerColumn();
};

Layer.prototype = {

  params: null,
  memory: null,
  encoder: null,
  spatialPooler: null,
  temporalMemory: null,
  classification: null,
  columnCount: null,
  cellsPerColumn: null,
  predictedColumns: null,
  actual: null,
  lastPredicted: null,

  input: function(value, recordNum, sequenceNum) {
    var output = [this.columnCount];
    //Input through encoder
    console.log("ScalarEncoder Input = " + value);
    var encoding = this.encoder.encode(value);
    console.log("ScalarEncoder Output = " + encoding.toString());
    var bucketIdx = this.encoder.getBucketIndices(value)[0];
    //Input through spatial pooler
    this.spatialPooler.compute(this.memory, this.encoding, output, true, true);
    console.log("SpatialPooler Output = " + output.toString());
    var input = this.actual = ArrayUtils.where(output, ArrayUtils.WHERE_1);
    //Input through temporal memory
    var cc = this.temporalMemory.compute(this.memory, input, true);
    this.lastPredicted = this.predictedColumns;
    this.predictedColumns = this.getSDR(cc.predictiveCells()); //Get the active column indexes
    console.log("TemporalMemory Input = " + input.toString());
    console.log("TemporalMemory Prediction = " + this.predictedColumns());
    this.classification.put("bucketIdx", bucketIdx);
    this.classification.put("actValue", value);
    var result = classifier.compute(recordNum, this.classification, this.predictedColumns, true, true);
    console.log("  |  CLAClassifier 1 step prob = " + result.getStats(1) + "\n");
    console.log("");
  },

  inflateSDR: function(SDR, len) {
    var retVal = [];
    for (var i = 0; i < len; i++) {
      if (SDR.indexOf(i) !== -1) {
        retVal[i] = 1;
      } else {
        retVal[i] = 0;
      }
    }
    return retVal;
  },

  getSDR: function(cells) {
    var retVal = [];
    var it = cells.iterator();
    for(var i = 0; i < cells.length; i++) {
      retVal[i] = it.next().getIndex();
      retVal[i] /= this.cellsPerColumn; // Get the column index
    }
    retVal.sort();
    retVal = ArrayUtils.unique(retVal);
    return retVal;
  },

  getPredicted: function() {
    return this.lastPredicted;
  },

  /**
   * Returns the actual columns in time t + 1 to compare
   * with {@link #getPrediction()} which returns the prediction
   * at time t for time t + 1.
   * @return
   */

  getActual: function() {
    return this.actual;
  },

  /**
   * Simple getter for external reset
   * @return
   */
  getMemory: function() {
          return memory;
  }

};

var qt = new QuickTest();

qt.main();
