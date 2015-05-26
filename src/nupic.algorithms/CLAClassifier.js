/**
 * A CLA classifier accepts a binary input from the level below (the
 * "activationPattern") and information from the sensor and encoders (the
 * "classification") describing the input to the system at that time step.
 *
 * When learning, for every bit in activation pattern, it records a history of the
 * classification each time that bit was active. The history is weighted so that
 * more recent activity has a bigger impact than older activity. The alpha
 * parameter controls this weighting.
 *
 * For inference, it takes an ensemble approach. For every active bit in the
 * activationPattern, it looks up the most likely classification(s) from the
 * history stored for that bit and then votes across these to get the resulting
 * classification(s).
 *
 * This classifier can learn and infer a number of simultaneous classifications
 * at once, each representing a shift of a different number of time steps. For
 * example, say you are doing multi-step prediction and want the predictions for
 * 1 and 3 time steps in advance. The CLAClassifier would learn the associations
 * between the activation pattern for time step T and the classifications for
 * time step T+1, as well as the associations between activation pattern T and
 * the classifications for T+3. The 'steps' constructor argument specifies the
 * list of time-steps you want.
 *
 * @author Numenta
 * @author David Ray
 * @see BitHistory
 */

/**
 * Container for the results of a classification computation by the
 * {@link CLAClassifier}
 *
 * @author David Ray
 * @author Ralf Seliger (port to JavaScript)
 *
 * @param <T>
 */

var Deque = require('collections/deque');
var Tuple = require('../nupic.util/Tuple.js');
var ClassifierResult = require('./ClassifierResult.js');
var BitHistory = require('./BitHistory.js');
var ArrayUtils = require('../nupic.util/ArrayUtils.js');

/**
 * Constructor for the CLA classifier
 *
 * @param steps       sequence of the different steps of multi-step predictions to learn
 * @param alpha       The alpha used to compute running averages of the bucket duty
 *                  cycles for each activation pattern bit. A lower alpha results
 *                  in longer term memory.
 * @param actValueAlpha
 * @param verbosity     verbosity level, can be 0, 1, or 2
 */

var CLAClassifier = function(steps, alpha, actValueAlpha, verbosity) {
  steps = steps || [];
  alpha = alpha || 0.001;
  actValueAlpha = actValueAlpha || 0.3;
  verbosity = verbosity || 0;
  this.steps = steps;
  this.alpha = alpha;
  this.actValueAlpha = actValueAlpha;
  this.verbosity = verbosity;
  this.actualValues.push(null);
  this.patternNZHistory = new Deque([], steps.length + 1);
};

CLAClassifier.prototype = {
  verbosity: 0,
  /**
   * The alpha used to compute running averages of the bucket duty
   * cycles for each activation pattern bit. A lower alpha results
   * in longer term memory.
   */
  alpha: 0.001,
  actValueAlpha: 0.3,
  /**
   * The bit's learning iteration. This is updated each time store() gets
   * called on this bit.
   */
  learnIteration: null,
  /**
   * This contains the offset between the recordNum (provided by caller) and
   * learnIteration (internal only, always starts at 0).
   */
  recordNumMinusLearnIteration: -1,
  /**
   * This contains the value of the highest bucket index we've ever seen
   * It is used to pre-allocate fixed size arrays that hold the weights of
   * each bucket index during inference
   */
  maxBucketIdx: 0,
  /** The sequence different steps of multi-step predictions */
  steps: [],
  /**
   * History of the last _maxSteps activation patterns. We need to keep
   * these so that we can associate the current iteration's classification
   * with the activationPattern from N steps ago
   */
  patternNZHistory: new Deque(),
  /**
   * These are the bit histories. Each one is a BitHistory instance, stored in
   * this dict, where the key is (bit, nSteps). The 'bit' is the index of the
   * bit in the activation pattern and nSteps is the number of steps of
   * prediction desired for that bit.
   */
  activeBitHistory: new Map(),
  /**
   * This keeps track of the actual value to use for each bucket index. We
   * start with 1 bucket, no actual value so that the first infer has something
   * to return
   */
  actualValues: [],

  g_debugPrefix: "CLAClassifier",

  history: null,

  /**
   * Process one input sample.
   * This method is called by outer loop code outside the nupic-engine. We
   * use this instead of the nupic engine compute() because our inputs and
   * outputs aren't fixed size vectors of reals.
   *
   * @param recordNum     Record number of this input pattern. Record numbers should
   *                  normally increase sequentially by 1 each time unless there
   *                  are missing records in the dataset. Knowing this information
   *                  insures that we don't get confused by missing records.
   * @param classification  {@link Map} of the classification information:
   *                      bucketIdx: index of the encoder bucket
   *                      actValue:  actual value going into the encoder
   * @param patternNZ     list of the active indices from the output below
   * @param learn       if true, learn this sample
   * @param infer       if true, perform inference
   *
   * @return          dict containing inference results, there is one entry for each
   *                  step in steps, where the key is the number of steps, and
   *                  the value is an array containing the relative likelihood for
   *                  each bucketIdx starting from bucketIdx 0.
   *
   *                  There is also an entry containing the average actual value to
   *                  use for each bucket. The key is 'actualValues'.
   *
   *                  for example:
   *                    {
   *                      1 :             [0.1, 0.3, 0.2, 0.7],
   *                      4 :             [0.2, 0.4, 0.3, 0.5],
   *                      'actualValues': [1.5, 3,5, 5,5, 7.6],
   *                    }
   */

  compute: function(recordNum, classification, patternNZ, learn, infer) {
    var retVal = new ClassifierResult();
    var nSteps;
    // var actualValues = this.actualValues;

    // Save the offset between recordNum and learnIteration if this is the first compute
    if (this.recordNumMinusLearnIteration == -1) {
      this.recordNumMinusLearnIteration = recordNum - this.learnIteration;
    }

    // Update the learn iteration
    this.learnIteration = recordNum - this.recordNumMinusLearnIteration;

    if (this.verbosity >= 1) {
      console.log(String.format("\n%s: compute ", this.g_debugPrefix));
      console.log(" recordNum: " + recordNum);
      console.log(" learnIteration: " + this.learnIteration);
      console.log(String.format(" patternNZ(%d): ", patternNZ.length, patternNZ));
      console.log(" classificationIn: " + classification);
    }

    this.patternNZHistory.append(new Tuple(this.learnIteration, patternNZ));

    //------------------------------------------------------------------------
    // Inference:
    // For each active bit in the activationPattern, get the classification
    // votes
    //
    // Return value dict. For buckets which we don't have an actual value
    // for yet, just plug in any valid actual value. It doesn't matter what
    // we use because that bucket won't have non-zero likelihood anyways.
    if (infer) {
      // NOTE: If doing 0-step prediction, we shouldn't use any knowledge
      // of the classification input during inference.
      var defaultValue;
      if (this.steps[0] === 0) {
        defaultValue = 0;
      } else {
        defaultValue = classification.get("actValue");
      }

      var actValues = [];
      for (var i = 0; i < this.actualValues.length; i++) {
        actValues[i] = (this.actualValues[i] === null) ? defaultValue : this.actualValues[i];
      }

      retVal.setActualValues(actValues);

      // For each n-step prediction...
      for (var n = 0; n < this.steps.length; n++) {
        nSteps = this.steps[n];
        // Accumulate bucket index votes and actValues into these arrays
        var sumVotes = this.maxBucketIdx + 1;
        var bitVotes = this.maxBucketIdx + 1;

        for (var b = 0; b < patternNZ.length; b++) {
          var bit = patternNZ[b];
          var key = new Tuple(bit, nSteps);
          this.history = this.activeBitHistory.get(key);
          if (this.history === null) {
            continue;
          }
          this.history.infer(this.learnIteration, bitVotes);
          sumVotes = ArrayUtils.d_add(sumVotes, bitVotes);
        }

        // Return the votes for each bucket, normalized
        var total = ArrayUtils.sum(sumVotes);
        if (total > 0) {
          sumVotes = ArrayUtils.divide(sumVotes, total);
        } else {
          // If all buckets have zero probability then simply make all of the
          // buckets equally likely. There is no actual prediction for this
          // timestep so any of the possible predictions are just as good.
          if (sumVotes.length > 0) {
            sumVotes.fill(1);
            sumVotes = ArrayUtils.divide(sumVotes, sumVotes.length);
          }
        }

        retVal.setStats(nSteps, sumVotes);
      }
    }

    // ------------------------------------------------------------------------
    // Learning:
    // For each active bit in the activationPattern, store the classification
    // info. If the bucketIdx is None, we can't learn. This can happen when the
    // field is missing in a specific record.
    if (learn && classification.get("bucketIdx") !== null) {
      // Get classification info
      var bucketIdx = classification.get("bucketIdx");
      var actValue = classification.get("actValue");

      // Update maxBucketIndex
      this.maxBucketIdx = Math.max(maxBucketIdx, bucketIdx);

      // Update rolling average of actual values if it's a scalar. If it's
      // not, it must be a category, in which case each bucket only ever
      // sees one category so we don't need a running average.
      while (this.maxBucketIdx > actualValues.length - 1) {
        this.actualValues.push(null);
      }
      if (this.actualValues[bucketIdx] === null) {
        this.actualValues[bucketIdx] = actValue;
      } else {
        if (typeof actValue === "number") {
          var val = ((1 - actValueAlpha) * (actualValues[bucketIdx] + actValueAlpha * actValue));
          actualValues[bucketIdx] = val;
        } else {
          actualValues[bucketIdx] = actValue;
        }
      }

      // Train each pattern that we have in our history that aligns with the
      // steps we have in steps
      nSteps = -1;
      var iteration = 0;
      var learnPatternNZ = null;
      for (var x = 0; x < this.steps.length; x++) {
        nSteps = x;
        // Do we have the pattern that should be assigned to this classification
        // in our pattern history? If not, skip it
        var found = false;

        for (var y = 0; y < this.patternNZHistory.length; y++) {
          var t = this.patternNZHistory[y];
          iteration = t.get(0);
          learnPatternNZ = t.get(1);
          if (iteration === this.learnIteration - nSteps) {
            break;
          }
          iteration++;
        }

        if (!found) continue;

        // Store classification info for each active bit from the pattern
        // that we got nSteps time steps ago.
        for (var z = 0; z < learnPatternNZ.length; z++) {
          var zbit = learnPatternNZ[z];
          // Get the history structure for this bit and step
          var zkey = new Tuple(zbit, nSteps);
          this.history = activeBitHistory.get(zkey);
          if (this.history === null) {
            this.history = new BitHistory(this, zbit, nSteps);
            this.activeBitHistory.put(zkey, history);
          }
          this.history.store(learnIteration, bucketIdx);
        }
      }
    }

    if (infer && verbosity >= 1) {
      console.log(" inference: combined bucket likelihoods:");
      console.log("   actual bucket values: " + retVal.getActualValues());
      for (var sKey in retVal.stepSet()) {
        if (retVal.getActualValue(sKey) === null) {
          continue;
        }
        var actual = retVal.getActualValue(sKey);
        console.log(String.format("  %d steps: ", sKey, array.toString()));
        var bestBucketIdx = retVal.getMostProbableBucketIndex(sKey);
        console.log(String.format("   most likely bucket idx: %d, value: %s ", bestBucketIdx, retVal.getActualValue(bestBucketIdx)));
      }
    }
    return retVal;
  }
};

module.exports = CLAClassifier;
