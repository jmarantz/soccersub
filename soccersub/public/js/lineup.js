goog.module('soccersub.Lineup');

const util = goog.require('soccersub.util');

// To make it easier to maniplate plans without having to awkwardly
// type too much on phones, we statically define a set of positions to
// accomodate several different team configurations given a number of
// players (e.g. 9v9, 11v11, 5v5 for Futsal).  More can be added, e.g. if
// this is used for a 7v7 team.
//
// 

/**
 * A position is associated with a row, where the keeper is row 0, first
 * line of defense is row 1, etc.  Some rows may be empty in a given
 * configuration, accomodating optional diamond-configs at defense or mid.
 * @typedef {!Array<!Array<string>>}
 */
let Positions;

/**
 * Maps the number of allowed players (e.g. 5, 9, 11) into a list of positions
 * for that game.  The UI can display the abbreviated forms of positions, which
 * are also maintained here.
 *
 * @type {!Object<number, !Positions>}
 */
const configurations = {
  5: [['Keeper'],
      ['Left Back', 'Center Back', 'Right Back'],
      ['Left Mid', 'Right Mid'],
      ['Left Forward', 'Striker', 'Right Forward']],
  9: [['Keeper'],
      ['Left Back', 'Center Back', 'Right Back'],
      ['Left Mid', 'Center Mid', 'Right Mid'],
      ['Left Forward', 'Striker', 'Right Forward']],
  11: [['Keeper'],
       ['Sweeper'],
       ['Left Back', 'Left Center Back', 'Right Center Back', 'Right Back'],
       ['Stopper'],
       ['Center Defensive Mid'],
       ['Left Mid', 'Center Mid', 'Right Mid'], ['Center Attacking Mid'],
       ['Left Forward', 'Striker', 'Right Forward']],
};
// TODO(jmarantz): add more positions to 9v9 configuration.

// Abbreviations used for terse display on the game field.\
const abbrevs = {
  'Center Attacking Mid': 'CAM',
  'Center Back': 'CB',
  'Center Defending Mid': 'CDM',
  'Center Mid': 'CM',
  'Keeper': 'GK',
  'Left Back': 'LB',
  'Left Center Back': 'LCB',
  'Left Forward': 'LF',
  'Left Mid': 'LM',
  'Right Back': 'RB',
  'Right Center Back': 'LCB',
  'Right Forward': 'RF',
  'Right Mid': 'RM',
  'Stopper': 'Sp',
  'Striker': 'Sk',
  'Sweeper': 'Sw',
};

class Lineup {
  /**
   * @param {number} defaultNumberOfPlayers
   * @param {!Array<string>} defaultPlayerNames
   */
  constructor(defaultNumberOfPlayers, defaultPlayerNames) {
    this.defaultPlayerNames = defaultPlayerNames;
    /** @private {!Set<string>} */
    this.activePositionNames_ = new Set();
    this.playerNames = defaultPlayerNames;
    this.unavailablePlayerNames = [];
    /** @private {number} */
    this.numberOfPlayers_ = defaultNumberOfPlayers;
    util.setupButton('5v5', () => this.setNumberOfPlayers_(5));
    util.setupButton('9v9', () => this.setNumberOfPlayers_(9));
    util.setupButton('11v11', () => this.setNumberOfPlayers_(11));
    this.positionsDiv = goog.dom.getRequiredElement('positions');
    this.statusDiv = goog.dom.getRequiredElement('positions-status');
    this.render();
    //this.defaultPositionNames = [];
  }

  /*reset() {
    this.positionNames = this.defaultPositionNames;
    this.playerNames = this.defaultPlayerNames;
  }*/

  /**
   * @param {!Object} map
   * @return {boolean}
   */
  restore(map) {
    this.playerNames = map.playerNames;
    this.activePositionNames_.clear();
    this.numberOfPlayers_ = map.numberOfPlayers || 5;
    for (const row of map.positionNames) {
      for (const positionName of row) {
        this.activePositionNames_.add(positionName);
      }
    }
    this.annotateStatus();
    this.render();
    this.unavailablePlayerNames = map.unavailablePlayerNames || [];
    if ((this.playerNames.length == 0) || 
        (this.activePositionNames_.size == 0)) {
      return false;
    }
    return true;
  }

  annotateStatus() {
    if (this.activePositionNames_.size == this.numberOfPlayers_) {
      this.statusDiv.style.backgroundColor = 'lightgreen';
    } else {
      this.statusDiv.style.backgroundColor = 'pink';
    }
    this.statusDiv.textContent = '' + this.activePositionNames_.size + ' of ' +
      this.numberOfPlayers_ + ' positions defined.';
  }

  /**
   * @param {!Object} map
   */
  save(map) {
    map.playerNames = this.playerNames;
    map.positionNames = this.getActivePositionNames();
    map.unavailablePlayerNames = this.unavailablePlayerNames;
    map.numberOfPlayers = this.numberOfPlayers_;
  }

  /**
   * @return {string}
   */
  getPlayersAsText() {
    let names = this.playerNames.sort().join('\n');
    if (this.unavailablePlayerNames.length) {
      names += (this.playerNames.length ? '\n#' : '#');
      names += this.unavailablePlayerNames.sort().join('\n#');
    }
    return names;
  }

  /**
   * @param {string} names
   */
  setPlayersFromText(names) {
    this.playerNames = [];
    this.unavailablePlayerNames = [];
    for (let player of names.split('\n')) {
      if (player) {
        if (player[0] == '#') {
          player = player.substring(1);
          if (player) {
            this.unavailablePlayerNames.push(player);
          }
        } else {
          this.playerNames.push(player);
        }
      }
    }
  }

  /**
   * @return {!Array<!Array<string>>}
   */
  getActivePositionNames() {
    const a = [];
    const rows = configurations[this.numberOfPlayers_];
    if (rows) {
      for (var r = rows.length - 1; r >= 0; --r) {
        const row = rows[r];
        const ra = [];
        for (const positionName of row) {
          if (this.activePositionNames_.has(positionName)) {
            ra.push(positionName);
          }
        }
        a.push(ra);
      }
    }
    return a;
  }

  /**
   * Renders into a div all the possible players for the given configuration.
   */
  render() {
    this.positionsDiv.innerHTML = '';
    const rows = configurations[this.numberOfPlayers_];
    const legalPositionsForConfig = new Set();
    if (rows) {
      for (var r = rows.length - 1; r >= 0; --r) {
        const row = rows[r];
        const tableRow = util.makeSingleRowTable(this.positionsDiv);
        for (const positionName of row) {
          legalPositionsForConfig.add(positionName);
          const td = document.createElement('td');
          //td.className = 'player';
          //td.id = name;
          tableRow.appendChild(td);
          td.textContent = positionName + '(' + abbrevs[positionName] + ')';
          if (!this.activePositionNames_.has(positionName)) {
            td.style.color = 'lightgray';
          }              
          util.handleTouch(td, () => {
            if (this.activePositionNames_.has(positionName)) {
              td.style.color = 'lightgray';
              this.activePositionNames_.delete(positionName);
            } else {
              td.style.color = 'black';
              this.activePositionNames_.add(positionName);
            }
            this.annotateStatus();
          });
        }
      }
    }
    this.activePositionNames_ = new Set([...legalPositionsForConfig].filter(
      positionName => this.activePositionNames_.has(positionName)));
  }

  /**
   * Renders into a div all the possible players for the given configuration.
   * @param {number} numberOfPlayers
   * @private
   */
  setNumberOfPlayers_(numberOfPlayers) {
    this.numberOfPlayers_ = numberOfPlayers;
    this.render();
    this.annotateStatus();
  }
}

exports = Lineup;
