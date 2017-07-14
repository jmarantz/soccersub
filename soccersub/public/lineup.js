goog.module('soccersub.Lineup');

class Lineup {
  /**
   * @param {!Array<string>} defaultPositionNames
   * @param {!Array<string>} defaultPlayerNames
   */
  constructor(defaultPositionNames, defaultPlayerNames) {
    this.defaultPositionNames = defaultPositionNames;
    this.defaultPlayerNames = defaultPlayerNames;
    this.positionNames = defaultPositionNames;
    this.playerNames = defaultPlayerNames;
  }

  reset() {
    this.positionNames = this.defaultPositionNames;
    this.playerNames = this.defaultPlayerNames;
  }

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
}

exports = Lineup;
