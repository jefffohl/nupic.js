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
 * Contains a snapshot of the state attained during one computational
 * call to the {@link TemporalMemory}. The {@code TemporalMemory} uses
 * data from previous compute cycles to derive new data for the current cycle
 * through a comparison between states of those different cycles, therefore
 * this state container is necessary.
 *
 * @author David Ray
 * @author Ralf Seliger (port to JavaScript)
 * @author Jeff Fohl (port to JavaScript)
 */

var Connections = require('../nupic/Connections.js');
var Cell = require('../nupic.model/Cell.js');
var Column = require('../nupic.model/Column.js');
var DistalDendrite = require('../nupic.model/DistalDendrite.js');
var Synapse = require('../nupic.model/Synapse.js');


var ComputeCycle = function() {
  this.activeCells = new Set();
  this.winnerCells = new Set();
  this.predictiveCells = new Set();
  this.predictedColumns = new Set();
  this.activeSegments = new Set();
  this.learningSegments = new Set();
  this.activeSynapsesForSegment = new Map();
};

ComputeCycle.prototype = {

  /**
   * Returns the current {@link Set} of active cells
   *
   * @return  the current {@link Set} of active cells
   */
  getActiveCells: function() {
    return this.activeCells;
  },

  /**
   * Returns the current {@link Set} of winner cells
   *
   * @return  the current {@link Set} of winner cells
   */
  getWinnerCells: function() {
    return this.winnerCells;
  },

  /**
   * Returns the {@link Set} of predictive cells.
   * @return
   */
  getPredictiveCells: function() {
    return this.predictiveCells;
  },

  /**
   * Returns the current {@link Set} of predicted columns
   *
   * @return  the current {@link Set} of predicted columns
   */
  getPredictedColumns: function() {
    return this.predictedColumns;
  },

  /**
   * Returns the Set of learning {@link DistalDendrite}s
   * @return
   */
  getLearningSegments: function() {
    return this.learningSegments;
  },

  /**
   * Returns the Set of active {@link DistalDendrite}s
   * @return
   */
  getActiveSegments: function() {
    return this.activeSegments;
  },

  /**
   * Returns the mapping of Segments to active synapses in t-1
   * @return
   */
  getActiveSynapsesForSegment: function() {
    return this.activeSynapsesForSegment;
  }

};

module.exports = ComputeCycle;
