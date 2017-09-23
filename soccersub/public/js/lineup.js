goog.module('soccersub.Lineup');

class Lineup {
  /**
   * @param {!Array<!Array<string>>} defaultPositionNames
   * @param {!Array<string>} defaultPlayerNames
   */
  constructor(defaultPositionNames, defaultPlayerNames) {
    this.defaultPositionNames = defaultPositionNames;
    this.defaultPlayerNames = defaultPlayerNames;
    this.positionNames = defaultPositionNames;
    this.playerNames = defaultPlayerNames;
    this.unavailablePlayerNames = [];
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
    this.positionNames = map.positionNames;
    this.unavailablePlayerNames = map.unavailablePlayerNames || [];
    if ((this.playerNames.length == 0) || (this.positionNames.length == 0)) {
      return false;
    }
    return true;
  }

  /**
   * @param {!Object} map
   */
  save(map) {
    map.playerNames = this.playerNames;
    map.positionNames = this.positionNames;
    map.unavailablePlayerNames = this.unavailablePlayerNames;
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
   * @return {string}
   */
  getPositionsAsText() {
    const transformRow = (row) => {
      if (row instanceof Array) {
        return row.join(', ');
      }
      return '' + row;
    };
    return this.positionNames.map(transformRow).join('\n');
  }

  /**
   * @param {string} positions
   */
  setPositionsFromText(positions) {
    const rows = positions.split('\n');
    this.positionNames = rows.map((row) => row.split(',').map(
      (position) => position.trim()));
  }
}

exports = Lineup;
