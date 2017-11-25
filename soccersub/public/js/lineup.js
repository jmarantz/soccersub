goog.module('soccersub.Lineup');

const Prompt = goog.require('goog.ui.Prompt');
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
    /** @type {!Set<string>} */
    this.playerNames = new Set(defaultPlayerNames);
    /** @type {!Set<string>} */
    this.unavailablePlayerNames = new Set();
    /** @private {number} */
    this.numberOfPlayers_ = defaultNumberOfPlayers;
    util.setupButton('5v5', () => this.setNumberOfPlayers_(5));
    util.setupButton('9v9', () => this.setNumberOfPlayers_(9));
    util.setupButton('11v11', () => this.setNumberOfPlayers_(11));
    util.setupButton('add-players', () => this.addPlayers_());
    this.positionsDiv = goog.dom.getRequiredElement('positions');
    this.positionsStatusDiv = goog.dom.getRequiredElement('positions-status');
    this.playersTbody = goog.dom.getRequiredElement('players-tbody');
    this.renderPositions_();
    this.renderPlayers_();
  }

  /**
   * @param {!Object} map
   * @return {boolean}
   */
  restore(map) {
    this.playerNames = new Set(map.playerNames);
    this.unavailablePlayerNames = new Set(
      map.unavailablePlayerNames || []);
    this.activePositionNames_.clear();
    this.numberOfPlayers_ = map.numberOfPlayers || 5;
    for (const row of map.positionNames) {
      for (const positionName of row) {
        this.activePositionNames_.add(positionName);
      }
    }
    this.annotateStatus();
    this.renderPositions_();
    this.renderPlayers_();
    if ((this.playerNames.size == 0) || 
        (this.activePositionNames_.size == 0)) {
      return false;
    }
    return true;
  }

  annotateStatus() {
    if (this.activePositionNames_.size == this.numberOfPlayers_) {
      this.positionsStatusDiv.style.backgroundColor = 'lightgreen';
    } else {
      this.positionsStatusDiv.style.backgroundColor = 'pink';
    }
    this.positionsStatusDiv.textContent = '' + this.activePositionNames_.size +
      ' of ' + this.numberOfPlayers_ + ' positions defined.';
  }

  /**
   * @param {!Object} map
   */
  save(map) {
    map.playerNames = [...this.playerNames];
    map.unavailablePlayerNames = [...this.unavailablePlayerNames];
    map.positionNames = this.getActivePositionNames();
    map.numberOfPlayers = this.numberOfPlayers_;
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
   * @private
   */
  renderPositions_() {
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
    this.renderPositions_();
    this.annotateStatus();
  }

  /**
   * Renders into a div all the known players, in rows of 4.
   * @private
   */
  renderPlayers_() {
    this.playersTbody.innerHTML = '';
    const numColumns = 2;
    let index = 0;
    const allPlayers = [...this.playerNames].concat(
      [...this.unavailablePlayerNames]);
    let tr = null;
    for (const playerName of allPlayers) {
      let available = (index < this.playerNames.size);
      const addColumn = () => {
        const td = document.createElement('td');
        tr.appendChild(td);
        return td;
      };

      if ((index % numColumns) == 0) {
        tr = document.createElement('tr');
        this.playersTbody.appendChild(tr);
      } else {
        addColumn().style.width = '50px';
      }
      ++index;

      /** @type {!Element} */
      let playerElement;

      // Delete button.
      const addButton = (imageSrc, command, color) => {
        const img = document.createElement('img');
        img.src = imageSrc;
        img.width = 32;
        addColumn().appendChild(img);
        util.handleTouch(img, () => {
          if (command == 'enable') {
            this.playerNames.add(playerName);
          } else {
            this.playerNames.delete(playerName);
          }
          if (command == 'disable') {
            this.unavailablePlayerNames.add(playerName);
          } else {
            this.unavailablePlayerNames.delete(playerName);
          }
          playerElement.style.color = color;
        });
      };
      
      addButton('Red_X.png', 'delete', 'red');
      //addButton('Checkmark-Yellow-300x300.jpg', 'disable', 'gold');
      addButton('48px-Gnome-face-sick.svg.png', 'disable', 'gold');
      addButton('GreenCheck.png', 'enable', 'darkgreen');

      playerElement = document.createElement('td');
      tr.appendChild(playerElement);
      playerElement.textContent = playerName;
      playerElement.style.color = available ? 'green' : 'gold';
    }
  }

  /** @private */
  addPlayers_() {
    const prompt = new goog.ui.Prompt(
      'Add Players',
      'Entry names of players, one per line',
      (response) => {
        if (response) {
          let added = false;
          for (let name of response.split('\n')) {
            name = name.trim();
            if (name && !this.playerNames.has(name) && 
                !this.unavailablePlayerNames.has(name)) {
              added = true;
              this.playerNames.add(name);
            }
          }
          if (added) {
            this.renderPlayers_();
          }
        }
        prompt.dispose();
      });
    prompt.setRows(10);
    prompt.setVisible(true);
  }
}

exports = Lineup;
