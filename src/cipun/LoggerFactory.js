/*
 * Just to be syntactically consistent with htm.java,
 * might be specialized in the future ...
 */

var Logger = function() {
  this.trace = function(arg) {
    console.log(arg);
  };

  this.info = function(arg) {
    console.log(arg);
  };
};

var LoggerFactory = {
  getLogger: function() {
    return new Logger();
  }
};

module.exports = LoggerFactory;
