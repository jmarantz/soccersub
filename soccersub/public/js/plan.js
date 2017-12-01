goog.module('soccersub.Plan');
const Lineup = goog.require('soccersub.Lineup');
const googDom = goog.require('goog.dom');
const util = goog.require('soccersub.util');

class Plan {
  /** @param {!Lineup} lineup */
  constructor(lineup) {
    /** @type {!Lineup} lineup */
    this.lineup = lineup;
    /** @type {number} */
    this.minutesRemainingInHalf = 24;
    /** @type {number} */
    this.minutesRemainingInGame = 48;
    /** @type {number} */
    this.numFieldPositions = lineup.getNumPositions();
    /** @type {number} */
    this.fieldPlayers = this.lineup.getNumPlayers() - 1;
    /** @type {number} */
    this.shiftDurationMinutes = this.minutesRemainingInHalf / this.fieldPlayers;
  }

  render() {
    const thead = googDom.getRequiredElement('player-matrix-head');
    thead.innerHTML = '';
    const tbody = googDom.getRequiredElement('player-matrix-body');
    tbody.innerHTML = '';

    const addTextElement = (parent, text, type) => {
      const item = document.createElement(type);
      item.textContent = text;
      parent.appendChild(item);
    };

    addTextElement(thead, 'Time', 'th');
    //addTextElement(thead, 'Time-', 'th');

    // Put the abbreviated position names into the table head, in one row.
    for (const row of this.lineup.getActivePositionNames()) {
      for (const positionName of row) {
        if (positionName) {
          addTextElement(thead, Lineup.abbrev(positionName), 'th');
        }
      }
    }

    // Pick a player ordering at random.
    const players = [...this.lineup.playerNames];
    util.shuffle(players);
    const shiftSec = Math.ceil(this.shiftDurationMinutes * 60);
    const numPositions = this.lineup.getActivePositionNames().length;
    
    const assignments = players.slice(0, numPositions);
    let positionToSwap = 0;
    let nextPlayer = numPositions % players.length;
    
    const halfSec = 60 * this.minutesRemainingInHalf;
    for (let sec = 0; sec < halfSec; sec += shiftSec) {
      const tr = document.createElement('tr');
      tbody.appendChild(tr);
      let td = document.createElement('td');
      tr.appendChild(td);
      td.textContent = util.formatTime(sec * 1000);
      for (let i = 0; i < numPositions; ++i) {
        td = document.createElement('td');
        tr.appendChild(td);
        td.textContent = assignments[i];
      }
      assignments[positionToSwap] = players[nextPlayer];
      positionToSwap = (positionToSwap + 1) % numPositions;
      nextPlayer = (nextPlayer + 1) % players.length;
    }
  }

  compute() {
    // Strategy:
    //  1. goalies divide time evenly.
    //  2. a percentage of time played during the game exclusive of
    //     goalie is computed.  So if the first-half keeper plays gets
    //     half the minutes in the second half, his percentage is 50%,
    //     even though you could argue he was in 75% of the game
    //     overall.
    //  3. Each player plays half his minutes at forward and half his
    //     minutes at defense.
    //  4. Certain players may be paired with each other, and an
    //     attempt can be made to accomodate that if it's in the model.
    //  5. Cetain players may prefer playing on right or left, and this
    //     can be factored in as well.
    //  6. the plan can be recomputed at any time during the game, and
    //     does the best job possible of evening out the time given what's
    //     happened so far, even if that was not according to plan, or even
    //     if the set of available players changed.
    //  7. In general a perfect solution is not possible, and arbitrary
    //     points are assigned to the goals above, and we try to find the
    //     max point-score overall for the team.

    // Ignore goalies for now.  Focus on field players.
    
  }

}

exports = Plan;
