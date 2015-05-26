/**
 * Stores an activationPattern bit history.
 *
 * @author David Ray
 * @author Jeff Fohl (Javascript port)
 * @see CLAClassifier
 */

 /**
 * Constructs a new {@code BitHistory}
 *
 * @param classifier  instance of the {@link CLAClassifier} that owns us
 * @param bitNum    activation pattern bit number this history is for,
   *                    used only for debug messages
 * @param nSteps    number of steps of prediction this history is for, used
   *                    only for debug messages
 */

var BitHistory = function(classifier, bitNum, nSteps) {
  this.classifier = classifier;
  this.id = String.format("%d[%d]", bitNum, nSteps);
  this.stats = [];
};

BitHistory.prototype = {
  classifier : null,
  id : "",
  stats : null,
  lastTotalUpdate : -1,
  DUTY_CYCLE_UPDATE_INTERVAL : Number.MAX_VALUE,

  /**
   * Store a new item in our history.
   * <p>
   * This gets called for a bit whenever it is active and learning is enabled
   * <p>
   * Save duty cycle by normalizing it to the same iteration as
     * the rest of the duty cycles which is lastTotalUpdate.
   * <p>
     * This is done to speed up computation in inference since all of the duty
     * cycles can now be scaled by a single number.
   * <p>
     * The duty cycle is brought up to the current iteration only at inference and
     * only when one of the duty cycles gets too large (to avoid overflow to
     * larger data type) since the ratios between the duty cycles are what is
     * important. As long as all of the duty cycles are at the same iteration
     * their ratio is the same as it would be for any other iteration, because the
     * update is simply a multiplication by a scalar that depends on the number of
     * steps between the last update of the duty cycle and the current iteration.
     *
   * @param iteration   the learning iteration number, which is only incremented
     *                  when learning is enabled
   * @param bucketIdx   the bucket index to store
   */
  store : function(iteration, bucketIdx) {
    // If lastTotalUpdate has not been set, set it to the current iteration.
    if(this.lastTotalUpdate == -1) {
      this.lastTotalUpdate = iteration;
    }

    // Get the duty cycle stored for this bucket.
    var statsLen = this.stats.length - 1;
    if(bucketIdx > statsLen) {
      this.stats.push(bucketIdx - statsLen);
    }

    // Update it now.
      // duty cycle n steps ago is dc{-n}
      // duty cycle for current iteration is (1-alpha)*dc{-n}*(1-alpha)**(n)+alpha
    var dc = this.stats[bucketIdx];

    // To get the duty cycle from n iterations ago that when updated to the
      // current iteration would equal the dc of the current iteration we simply
      // divide the duty cycle by (1-alpha)**(n). This results in the formula
      // dc'{-n} = dc{-n} + alpha/(1-alpha)**n where the apostrophe symbol is used
      // to denote that this is the new duty cycle at that iteration. This is
      // equivalent to the duty cycle dc{-n}
    var denom = Math.pow((1.0 - this.classifier.alpha), (iteration - this.lastTotalUpdate));

    var dcNew = 0;
    if(denom > 0) dcNew = dc + (this.classifier.alpha / denom);

    // This is to prevent errors associated with infinite rescale if too large
    if(denom === 0 || dcNew > this.DUTY_CYCLE_UPDATE_INTERVAL) {
      var exp = Math.pow((1.0 - this.classifier.alpha), (iteration - this.lastTotalUpdate));
      var dcT = 0;
      for(var i = 0; i < stats.length; i++) {
        dcT *= exp;
        this.stats[i] = dcT;
      }

      // Reset time since last update
      this.lastTotalUpdate = iteration;

      // Add alpha since now exponent is 0
      dc = this.stats[bucketIdx] + this.classifier.alpha;
    } else {
      dc = dcNew;
    }

    this.stats[bucketIdx] = dc;
    if(this.classifier.verbosity >= 2) {
      console.log(String.format("updated DC for %s,  bucket %d to %f", this.id, bucketIdx, dc));
    }
  },

  /**
   * Look up and return the votes for each bucketIdx for this bit.
   *
   * @param iteration   the learning iteration number, which is only incremented
     *                  when learning is enabled
   * @param votes     array, initialized to all 0's, that should be filled
     *                  in with the votes for each bucket. The vote for bucket index N
     *                  should go into votes[N].
   */
  infer: function(iteration, votes) {
    // Place the duty cycle into the votes and update the running total for
      // normalization
    var total = 0;
    for(var i = 0; i < this.stats.length; i++) {
      var dc = this.stats[i];
      if(dc > 0) {
        votes[i] = dc;
        total += dc;
      }
    }

    // Experiment... try normalizing the votes from each bit
    if(total > 0) {
      var temp = ArrayUtils.divide(votes, total);
      for(var j = 0;j < temp.length;j++) {
        votes[j] = temp[j];
      }
    }

    if(this.classifier.verbosity >= 2) {
      console.log(String.format("bucket votes for %s:", id, votes.toString()));
    }
  }
};

module.exports = BitHistory;
