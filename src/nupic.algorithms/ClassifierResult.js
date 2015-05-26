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
 * @author Ralf Seliger (port to JavaScript)
 * @see BitHistory
 */

var _ = require("lodash");


var ClassifierResult = function() {

  this.actualValues = [];

  this.probabilities = new Map();

};

ClassifierResult.prototype = {
  /** Array of actual values */
  actualValues: null,

  /** Map of step count -to- probabilities */
  probabilities: null,
  /**
   * Utility method to copy the contents of a ClassifierResult.
   *
   * @return  a copy of this {@code ClassifierResult} which will not be affected
   * by changes to the original.
   */
  copy: function() {
    return _.clone(this, true);
  },

  /**
   * Returns the actual value for the specified bucket index
   *
   * @param bucketIndex
   * @return
   */
  getActualValue: function(bucketIndex) {
    if (this.actualValues === null || this.actualValues.length < bucketIndex + 1) {
      return null;
    }
    return this.actualValues[bucketIndex];
  },

  /**
   * Returns all actual values entered
   *
   * @return  array
   */
  getActualValues: function() {
    return this.actualValues;
  },

  /**
   * Sets the array of actual values being entered.
   *
   * @param values
   */
  setActualValues: function(values) {
    this.actualValues = values;
  },

  /**
   * Returns a count of actual values entered
   * @return
   */
  getActualValueCount: function() {
    return this.actualValues.length;
  },

  /**
   * Returns the probability at the specified index for the given step
   * @param step
   * @param bucketIndex
   * @return
   */
  getStat: function(step, bucketIndex) {
    return this.probabilities.get(step)[bucketIndex];
  },

  /**
   * Sets the array of probabilities for the specified step
   * @param step
   * @param votes
   */
  setStats: function(step, votes) {
    this.probabilities.put(step, votes);
  },

  /**
   * Returns the probabilities for the specified step
   * @param step
   * @return
   */
  getStats: function(step) {
    this.probabilities.get(step);
  },

  /**
   * Returns the input value corresponding with the highest probability
   * for the specified step.
   *
   * @param step    the step key under which the most probable value will be returned.
   * @return
   */
  getMostProbableValue: function(step) {
    var idx = -1;
    if (this.probabilities.get(step) === null || (idx = this.getMostProbableBucketIndex(step)) === -1) {
      return null;
    }
    return this.getActualValue(idx);
  },

  /**
   * Returns the bucket index corresponding with the highest probability
   * for the specified step.
   *
   * @param step    the step key under which the most probable index will be returned.
   * @return      -1 if there is no such entry
   */
  getMostProbableBucketIndex: function(step) {
    if (this.probabilities.get(step) === null) {
      return -1;
    }

    var max = 0;
    var bucketIdx = -1;
    var votes = this.probabilities.get(step);
    for (var i = 0; i < votes.length; i++) {
      if (votes[i] > max) {
        max = votes[i];
        bucketIdx = i;
      }
    }
    return bucketIdx;
  },

  /**
   * Returns the count of steps
   * @return
   */
  getStepCount: function() {
    return this.probabilities.size();
  },

  /**
   * Returns the count of probabilities for the specified step
   * @param the step indexing the probability values
   * @return
   */
  getStatCount: function(step) {
    return this.probabilities.get(step).length;
  },

  /**
   * Returns a set of steps being recorded.
   * @return
   */
  stepSet: function() {
    return util.iterable2Array(probabilities.keys());
  }

};

module.exports = ClassifierResult;
