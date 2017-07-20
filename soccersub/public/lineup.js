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
    return this.positionNames.map((row) => row.join(', ')).join('\n');
  }

  /**
   * @param {string} names
   */
  setPositionsFromText(positions) {
    const rows = positions.split('\n');
    this.positionNames = rows.map((row) => row.split(',').map(
      (position) => position.trim()));
  }
}

exports = Lineup;
