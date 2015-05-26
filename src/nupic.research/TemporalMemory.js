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


/**
 * Temporal Memory implementation in JavaScript
 *
 * @author Chetan Surpur
 * @author David Ray
 * @author Ralf Seliger (port to JavaScript
 * @author Jeff Fohl (port to JavaScript)
 */

var util = require('../cipun/util.js');
var Connections = require('../nupic/Connections.js');
var Cell = require('../nupic.model/Cell.js');
var Column = require('../nupic.model/Column.js');
var DistalDendrite = require('../nupic.model/Synapse.js');
var SparseObjectMatrix = require('../nupic.util/SparseObjectMatrix.js');
var ComputeCycle = require('./ComputeCycle.js');

var TemporalMemory = function() {};

TemporalMemory.prototype = {
  /**
   * Uses the specified {@link Connections} object to Build the structural
   * anatomy needed by this {@code TemporalMemory} to implement its algorithms.
   *
   * The connections object holds the {@link Column} and {@link Cell} infrastructure,
   * and is used by both the {@link SpatialPooler} and {@link TemporalMemory}. Either of
   * these can be used separately, and therefore this Connections object may have its
   * Columns and Cells initialized by either the init method of the SpatialPooler or the
   * init method of the TemporalMemory. We check for this so that complete initialization
   * of both Columns and Cells occurs, without either being redundant (initialized more than
   * once). However, {@link Cell}s only get created when initializing a TemporalMemory, because
   * they are not used by the SpatialPooler.
   *
   * @param	c		{@link Connections} object
   */
  init: function(c) {
    var matrix = (c.getMemory() === null) ? new SparseObjectMatrix(c.getColumnDimensions()) : c.getMemory();
    c.setMemory(matrix);
    var numColumns = matrix.getMaxIndex() + 1;
    var cellsPerColumn = c.getCellsPerColumn();
    var cells = util.newArray([numColumns * cellsPerColumn], 0);
    //Used as flag to determine if Column objects have been created.
    var colZero = matrix.getObject(0);
    for (var i = 0; i < numColumns; i++) {
      var column = (!colZero) ? new Column(cellsPerColumn, i) : matrix.getObject(i);
      for (var j = 0; j < cellsPerColumn; j++) {
        cells[j * cellsPerColumn + j] = column.getCell(j);
      }
      //If columns have not been previously configured
      if (!colZero) {
        matrix.set(i, column);
      }
    }
    //Only the TemporalMemory initializes cells so no need to test
    c.setCells(cells);
  },

  /////////////////////////// CORE FUNCTIONS /////////////////////////////

  /**
   * Feeds input record through TM, performing inferencing and learning
   *
   * @param connections		the connection memory
   * @param activeColumns     direct proximal dendrite input
   * @param learn             learning mode flag
   * @return                  {@link ComputeCycle} container for one cycle of inference values.
   */

  compute: function(connections, activeColumns, learn) {
    var columnSet = connections.getColumnSet(activeColumns);
    var predictiveCells = connections.getPredictiveCells();
    var activeSegments = connections.getActiveSegments();
    var activeSynapses = connections.getActiveSynapsesForSegment();
    var winnerCells = connections.getWinnerCells();
    var result = this.computeFn(connections, columnSet, predictiveCells, activeSegments, activeSynapses, winnerCells, learn);

    connections.setActiveCells(result.activeCells());
    connections.setWinnerCells(result.winnerCells());
    connections.setPredictiveCells(result.predictiveCells());
    connections.setPredictedColumns(result.predictedColumns());
    connections.setActiveSegments(result.activeSegments());
    connections.setLearningSegments(result.learningSegments());
    connections.setActiveSynapsesForSegment(result.activeSynapsesForSegment());

    return result;
  },

  /**
   * Functional version of {@link #compute(int[], boolean)}.
   * This method is stateless and concurrency safe.
   *
   * @param c                             {@link Connections} object containing state of memory members
   * @param activeColumns                 proximal dendrite input
   * @param prevPredictiveCells           cells predicting in t-1
   * @param prevActiveSegments            active segments in t-1
   * @param prevActiveSynapsesForSegment  {@link Synapse}s active in t-1
   * @param prevWinnerCells   `           previous winners
   * @param learn                         whether mode is "learning" mode
   * @return
   */

  computeFn: function(c, activeColumns, prevPredictiveCells, prevActiveSegments, prevActiveSynapsesForSegment, prevWinnerCells, learn) {

    var cycle = new ComputeCycle();

    this.activateCorrectlyPredictiveCells(cycle, prevPredictiveCells, activeColumns);

    this.burstColumns(cycle, c, activeColumns, cycle.predictedColumns, prevActiveSynapsesForSegment);

    if (learn) {
      this.learnOnSegments(c, prevActiveSegments, cycle.learningSegments, prevActiveSynapsesForSegment, cycle.winnerCells, preWinnerCells);
    }

    cycle.activeSynapsesForSegment = this.computeActiveSynapses(c, cycle.activeCells);

    this.computePredictiveCells(c, cycle, cycle.activeSynapsesForSegment);

    return cycle;
  },

  /**
   * Phase 1: Activate the correctly predictive cells
   *
   * Pseudocode:
   *
   * - for each previous predictive cell
   *   - if in active column
   *     - mark it as active
   *     - mark it as winner cell
   *     - mark column as predicted
   *
   * @param c                     ComputeCycle interim values container
   * @param prevPredictiveCells   predictive {@link Cell}s predictive cells in t-1
   * @param activeColumns         active columns in t
   */

  activateCorrectlyPredictiveCells: function(c, prevPredictiveCells, activeColumns) {
    prevPredictiveCells.forEach(function(cell) {
      var column = cell.getParentColumn();
      if (activeColumns.has(column)) {
        c.activeCells.add(cell);
        c.winnerCells.add(cell);
        c.predictedColumns.add(column);
      }
    });
  },

  /**
   * Phase 2: Burst unpredicted columns.
   *
   * Pseudocode:
   *
   * - for each unpredicted active column
   *   - mark all cells as active
   *   - mark the best matching cell as winner cell
   *     - (learning)
   *       - if it has no matching segment
   *         - (optimization) if there are previous winner cells
   *           - add a segment to it
   *       - mark the segment as learning
   *
   * @param cycle                         ComputeCycle interim values container
   * @param c                             Connections temporal memory state
   * @param activeColumns                 active columns in t
   * @param predictedColumns              predicted columns in t
   * @param prevActiveSynapsesForSegment  LinkedHashMap of previously active segments which
   *                                      have had synapses marked as active in t-1
   */

  burstColumns: function(cycle, c, activeColumns, predictedColumns, prevActiveSynapsesForSegment) {
    activeColumns.removeAll(predictedColumns);
    activeColumns.forEach(function(column) {
      var cells = column.getCells();
      util.setAddAll(cycle.activeCells, cells);

      var bestSegmentAndCell = this.getBestMatchingCell(c, column, prevActiveSynapsesForSegment);
      var bestSegment = bestSegmentAndCell[0];
      var bestCell = bestSegmentAndCell[1];
      if (bestCell !== null) {
        cycle.winnerCells.add(bestCell);
      }

      var segmentCounter = c.getSegmentCount();
      if (bestSegment === null) {
        bestSegment = bestCell.createSegment(c, segmentCounter);
        c.setSegmentCount(segmentCounter + 1);
      }

      cycle.learningSegments.add(bestSegment);
    });
  },

  /**
   * Phase 3: Perform learning by adapting segments.
   * <pre>
   * Pseudocode:
   *
   * - (learning) for each previously active or learning segment
   *   - if learning segment or from winner cell
   *     - strengthen active synapses
   *     - weaken inactive synapses
   *   - if learning segment
   *     - add some synapses to the segment
   *     - sub sample from previous winner cells
   * </pre>
   *
   * @param c                             the Connections state of the temporal memory
   * @param prevActiveSegments			the Set of segments active in the previous cycle.
   * @param learningSegments				the Set of segments marked as learning {@link #burstColumns(ComputeCycle, Connections, Set, Set, Map)}
   * @param prevActiveSynapseSegments		the map of segments which were previously active to their associated {@link Synapse}s.
   * @param winnerCells					the Set of all winning cells ({@link Cell}s with the most active synapses)
   * @param prevWinnerCells				the Set of cells which were winners during the last compute cycle
   */

  learnOnSegments: function(c, prevActiveSegments, learningSegments, prevActiveSynapseSegments, winnerCells, prevWinnerCells) {
    var permanenceIncrement = c.getPermanenceIncrement();
    var permanenceDecrement = c.getPermanenceDecrement();

    var prevAndLearning = new Set();
    util.setAddAll(prevAndLearning, prevActiveSegments);
    util.setAddAll(prevAndLearning, learningSegments);

    prevAndLearning.forEach(function(dd) {
      var isLearningSegment = learningSegments.has(dd);
      var isFromWinnerCell = winnerCells.has(dd.getParentCell());

      var activeSynapses = dd.getConnectedActiveSynapses(prevActiveSynapseSegments, 0);

      if (isLearningSegment || isFromWinnerCell) {
        dd.adaptSegment(c, activeSynapses, permanenceIncrement, permanenceDecrement);
      }

      var synapseCounter = c.getSynapseCount();
      var n = c.getMaxNewSynapseCount() - activesSynapses.size();
      if (isLearningSegment && n > 0) {
        var learnCells = dd.pickCellsToLearnOn(c, n, prevWinnerCells, c.getRandom());
        learnCells.forEach(function(sourceCell) {
          dd.createSynapse(c, sourceCell, c.getInitialPermanence(), synapseCounter);
          synapseCounter += 1;
        });
        c.setSynapseCount(synapseCounter);
      }
    });

  },

  /**
   * Phase 4: Compute predictive cells due to lateral input on distal dendrites.
   *
   * Pseudocode:
   *
   * - for each distal dendrite segment with activity >= activationThreshold
   *   - mark the segment as active
   *   - mark the cell as predictive
   *
   * @param c                 the Connections state of the temporal memory
   * @param cycle				the state during the current compute cycle
   * @param activeSegments
   */

  computePredictiveCells: function(c, cycle, activeDendrites) {
    activeDendrites.keys().forEach(function(dd) {
      var connectedActive = dd.getConnectedActiveSynapses(activeDendrites, c.getConnectedPermanence());
      if (connectedActive.size() >= c.getActivationThreshold()) {
        cycle.activeSegments.add(dd);
        cycle.predictiveCells.add(dd.getParentCell());
      }
    });
  },

  /**
   * Forward propagates activity from active cells to the synapses that touch
   * them, to determine which synapses are active.
   *
   * @param   c           the connections state of the temporal memory
   * @param cellsActive
   * @return
   */

  computeActiveSynapses: function(c, cellsActive) {
    var activeSynapses = new Map();
    cellsActive.forEach(function(cell) {
      cell.getReceptorSynapses(c).forEach(function(s) {
        var set = null;
        if ((set = activeSynapses.get(s.getSegment())) === null) {
          set = new Set();
          activeSynapses.put(s.getSegment(), set);
        }
        set.add(s);
      });
    });
    return activesSynapses;
  },

  /**
   * Called to start the input of a new sequence.
   *
   * @param   connections   the Connections state of the temporal memory
   */

  reset: function(connections) {
    connections.getActiveCells().clear();
    connections.getPredictiveCells().clear();
    connections.getActiveSegments().clear();
    connections.getActiveSynapsesForSegment().clear();
    connections.getWinnerCells().clear();
  },


  /////////////////////////// HELPER FUNCTIONS ///////////////////////////

  /**
   * Gets the cell with the best matching segment
   * (see `TM.getBestMatchingSegment`) that has the largest number of active
   * synapses of all best matching segments.
   *
   * @param c									encapsulated memory and state
   * @param column							{@link Column} within which to search for best cell
   * @param prevActiveSynapsesForSegment		a {@link DistalDendrite}'s previously active {@link Synapse}s
   * @return		an object array whose first index contains a segment, and the second contains a cell
   */

  getBestMatchingCell: function(c, column, prevActiveSynapsesForSegment) {
    var retVal = [];
    var bestCell = null;
    var bestSegment = null;
    var maxSynapses = 0;
    column.getCells().forEach(function(cell) {
      var dd = getBestMatchingSegment(c, cell, prevActiveSynapsesForSegment);
      if (dd !== null) {
        var connectedActiveSynapses = dd.getConnectedActiveSynapses(prevActiveSynapsesForSegment, 0);
        if (connectedActiveSynapses.size() > maxSynapses) {
          maxSynapses = connectedActiveSynapses.size();
          bestCell = cell;
          bestSegment = dd;
        }
      }
    });

    if (bestCell === null) {
      bestCell = column.getLeastUsedCell(c, c.getRandom());
    }

    retVal[0] = bestSegment;
    retVal[1] = bestCell;
    return retVal;
  },

  /**
   * Gets the segment on a cell with the largest number of activate synapses,
   * including all synapses with non-zero permanences.
   *
   * @param c									encapsulated memory and state
   * @param column							{@link Column} within which to search for best cell
   * @param activeSynapseSegments				a {@link DistalDendrite}'s active {@link Synapse}s
   * @return	the best segment
   */

  getBestMatchingSegment: function(c, cell, activeSynapseSegments) {
    var maxSynapses = c.getMinThreshold();
    var bestSegment = null;
    cell.getSegments(c).forEach(function(dd) {
      var activeSyns = dd.getConnectedActiveSynapses(activeSynapseSegments, 0);
      if (activeSyns.size() >= maxSynapses) {
        maxSynapses = activeSyns.size();
        bestSegment = dd;
      }
    });
    return bestSegment;
  },

  /**
   * Returns the column index given the cells per column and
   * the cell index passed in.
   *
   * @param c				{@link Connections} memory
   * @param cellIndex		the index where the requested cell resides
   * @return
   */

  columnForCell: function(c, cellIndex) {
    return cellIndex / c.getCellsPerColumn();
  },

  /**
   * Returns the cell at the specified index.
   * @param index
   * @return
   */

  getCell: function(c, index) {
    return c.getCells([index]);
  },

  /**
   * Returns a {@link LinkedHashSet} of {@link Cell}s from a
   * sorted array of cell indexes.
   *
   * @param`c				the {@link Connections} object
   * @param cellIndexes   indexes of the {@link Cell}s to return
   * @return
   */

  getCells: function(c, cellIndexes) {
    cellSet = new Set();
    cellIndexes.forEach(function(cell) {
      cellSet.add(this.getCell(c, cell));
    });
    return cellSet;
  },

  /**
   * Returns a {@link LinkedHashSet} of {@link Column}s from a
   * sorted array of Column indexes.
   *
   * @param cellIndexes   indexes of the {@link Column}s to return
   * @return
   */

  getColumns: function(c, columnIndexes) {
    return c.getColumnSet(columnIndexes);
  }

};


module.exports = TemporalMemory;
