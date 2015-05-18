
var ArrayUtils = require('./nupic.util/ArrayUtils.js');

var SetTest = function() {
    var set = new Set();
    for (var i = 0; i < 10; i++) {
        set.add(i);
    }
    var arr = ArrayUtils.iterable2Array(set);
    console.log(JSON.stringify(arr));
};

var MapTest = function() {
    var map = new Map();
    for (var i = 0; i < 10; i++) {
        var key = {
            "key" : "key" + i
        };
        map.set(key,i);
    }
    var arr = ArrayUtils.iterable2Array(map);
    console.log(JSON.stringify(arr));
};

SetTest();
MapTest();