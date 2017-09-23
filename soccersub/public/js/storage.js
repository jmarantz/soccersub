goog.module('soccersub.Storage');

const ArraySection = goog.require('soccersub.ArraySection');
const MapSection = goog.require('soccersub.MapSection');

// Defines an abstract storage interface for saving game-state.  The
// storage has two somewhat divergent implementations: HTML
// localStorage and Google-Sheets.
// 
// localStorage simply stores the game as a giant JSON structure,
// which is easy to program but when done naively has some wasted
// space due to repetitive field names for the parameters for each
// player and position.  It's somewhat invisible because the total
// storage is small and it's fairly invisible to users.
//
// However, when saving the game to Google Sheets, we want to make the
// presentation reasonable for humans to look at directly in Sheets,
// so we really want to store positions and players as 2-D tables.
//
// We present a single storage API to the Position, Player, and Game
// classes, because that's the only way we're likely to capture all
// the state in both storage mechanisms.  We'll abstract these into
// sections (which might be rendered as different sheets in a
// spreadsheet).

class Storage {
  /** @param {string} name */
  constructor(name) {
    /** @type {string} */
    this.name = name;
    /** @type {!Array<!MapSection>} */
    this.mapSections = [];
    /** @type {!Array<!ArraySection>} */
    this.arraySections = [];
  }

  /** 
   * @param {string} name
   * @return {!MapSection}
   */
  addMapSection(name) {
    const mapSection = new MapSection(name);
    this.mapSections.push(mapSection);
    return mapSection;
  }

  /**
   * @param {string} name
   * @return {!ArraySection}
   */
  addArraySection(name) {
    const arraySection = new ArraySection(name);
    this.arraySections.push(arraySection);
    return arraySection;
  }

  saveToLocalStorage() {
    const map = {};
    for (const mapSection of this.mapSections) {
      map[mapSection.name] = mapSection.save();
    }
    for (const arraySection of this.arraySections) {
      map[arraySection.name] = arraySection.save();
    }
    window.localStorage[this.name] = JSON.stringify(map);
  }

  restoreFromLocalStorage() {
    const map = /** @type {!Object} */ (
      JSON.parse(window.localStorage[this.name]));
    for (const mapSection of this.mapSections) {
      mapSection.restore(map[mapSection.name]);
    }
    for (const arraySection of this.arraySections) {
      arraySection.restore(map[arraySection.name]);
    }
  }
}

exports = Storage;
