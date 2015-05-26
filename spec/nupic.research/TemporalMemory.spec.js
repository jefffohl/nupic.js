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

var TemporalMemory = require('../../src/nupic.research/TemporalMemory.js');
var Connections = require('../../src/nupic/Connections.js');
var ComputeCycle = require('../../src/nupic.research/ComputeCycle.js');
var util = require('../../src/cipun/util.js');

/**
 * Basic unit test for {@link TemporalMemory}
 *
 * @author Chetan Surpur
 * @author David Ray
 * @author Jeff Fohl (Javascript version)
 */
describe('TemporalMemory Test Suite', function() {

  /* this is not working
  describe('Activate correctly predictive cells', function() {

    var tm, cn, c, activeCells, winnerCells, predictedColumns, prevPredictiveCells, activeColumns, expectedActiveWinners, expectedPredictCols, idx;

    prevPredictiveCells = new Set();
    util.setAddAll(prevPredictiveCells, [ 0, 237, 1026, 26337, 26339, 55536 ]);
    activeColumns = new Set();
    util.setAddAll(activeColumns, [ 32, 47, 823 ]);
    expectedActiveWinners = new Set();
    util.setAddAll(expectedActiveWinners, [ 1026, 26337, 26339 ]);
    expectedPredictCols = new Set();
    util.setAddAll(expectedPredictCols, [ 32, 823 ]);
    tm = new TemporalMemory();
    cn = new Connections();
    tm.init(cn);
    c = new ComputeCycle();
    tm.activateCorrectlyPredictiveCells(c, cn.getCellSet(prevPredictiveCells), cn.getColumnSet(activeColumns));
    activeCells = cn.getActiveCells();
    winnerCells = cn.getWinnerCells();
    predictedColumns = cn.getPredictedColumns();

    it('Active cells should equal expected active winners', function() {
      idx = 0;
      activeCells.forEach(function(cell){
        console.log(cell);
        expect(expectedActiveWinners[idx++]).toEqual(cell.getIndex());
      });
    });

    it('Winner cells should equal expected active winners', function() {
      idx = 0;
      winnerCells.forEach(function(cell){
        expect(expectedActiveWinners[idx++]).toEqual(cell.getIndex());
      });
    });

    it('Predicted columns should equal expected predicted columns', function() {
      idx = 0;
      predictedColumns.forEach(function(col){
        expect(expectedPredictCols[idx++]).toEqual(col.getIndex());
      });
    });

  });
  */

  describe('Test that activateCorrectlyPredictiveCells() with empty prevPredictiveCells are empty', function() {

    var tm = new TemporalMemory();
    var cn = new Connections();
    tm.init(cn);

    var c = new ComputeCycle();

    var prevPredictiveCells = new Set();
    var activeColumns = new Set();
    util.setAddAll(activeColumns, [ 32, 47, 823 ]);

    tm.activateCorrectlyPredictiveCells(c, cn.getCellSet(prevPredictiveCells), cn.getColumnSet(activeColumns));
    var activeCells = c.getActiveCells();
    var winnerCells = c.getWinnerCells();
    var predictedColumns = c.getPredictedColumns();
    var newSet = new Set();

    it('expects activeCells to be empty', function() {
      expect(activeCells).toEqual(newSet);
    });

    it('expects winnerCells to be empty', function() {
      expect(winnerCells).toEqual(newSet);
    });

    it('expects predictedColumns to be empty', function() {
      expect(predictedColumns).toEqual(newSet);
    });

  });

  describe('Test that activateCorrectlyPredictiveCells() with empty activeColumns are empty', function() {
    var tm = new TemporalMemory();
    var cn = new Connections();
    tm.init(cn);
    var c = new ComputeCycle();

    var prevPredictiveCells = new Set();
    util.setAddAll(prevPredictiveCells, [0, 237, 1026, 26337, 26339, 55536]);
    var activeColumns = new Set();

    tm.activateCorrectlyPredictiveCells(c, cn.getCellSet(prevPredictiveCells), cn.getColumnSet(activeColumns));
    var activeCells = c.getActiveCells();
    var winnerCells = c.getWinnerCells();
    var predictedColumns = c.getPredictedColumns();
    var newSet = new Set();

    it('expects activeCells to be empty', function() {
      expect(activeCells).toEqual(newSet);
    });

    it('expects winnerCells to be empty', function() {
      expect(winnerCells).toEqual(newSet);
    });

    it('expects predictedColumns to be empty', function() {
      expect(predictedColumns).toEqual(newSet);
    });

  });

});
