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

class StorageTable {
  /**
   * A section can be defined with columns, in which case it will be
   * accessed with the RowColumn
   *
   * @param {string} name
   * @param {!Array<string>} columns
   */
  constructor(name, columns) {
    this.name = name;

    /** @type {!Map<string, number>} columns */
    this.columns = new Map();
    
    for (let index = 0; index < columns.length(); ++index) {
      this.columns.set(columns[index], index);
    }

    /** @type {?Array<!Array<*>>} */
    this.map;
  }

  save(map) {
    this.array = [];
    map[this.name] = this.array;
  }

  restore(map) {
    this.array = /** @type {!Array<!Array<*>>} */ (map[this.name]);
  }

  /**
   * @type {number} row
   * @type {string} columnName
   * @type {*} value
   */
  set(row, columnName, value) {
    while (this.array.length <= row) {
      const rowValues = [];
      for (let i = 0; i < this.columns.size; ++i) {
        rowValues.push(null);
      }
      this.array.push(rowValues);
    }
    this.array[row][this.columns.get(columnName)] = value;
  }

  /**
   * @type {number} row
   * @type {string} columnName
   * @return {*}
   */
  get(row, columnName) {
    return this.array[row][this.columns.get(columnName)];
  }
}

class StorageMap {
  constructor(name) {
    this.name = name;
    this.map;
  }

  save(map) {
    this.map = {};
    map[this.name] = this.map;
  }

  restore(map) {
    this.map = /** @type {!Object<string, *>} */ (map[this.name]);
  }

  /**
   * @type {string} name
   * @type {*} value
   */
  setValue(name, value) {
    this.map[name] = value;
  }

  /**
   * @type {string} name
   * @return {*}
   */
  getValue(name, value) {
    return this.map[name];
  }
}

class Storage {
  constructor(name) {
    this.name = name;
    this.map;
    this.sections = [];
  }

  /** @return {boolean} */
  restore() {
    try {
      this.map = /** @type {!Object} */ (
        JSON.parse(window.localStorage[this.name]));
      for (section of this.sections) {
        this.section.restore(this.map);
      }
      return true;
    } catch (err) {
      console.log(err);
    }
    return false;
  }

  save() {
    this.map = {};
    for (section of this.sections) {
      this.section.save(this.map);
    }
  }
}

class LocalStorage implements Storage {
  /** @param {string} name */
  constructor(name, writeMode) {
    this.name = name;
    this.map = writeMode ? {} : 
  }

  save() {
    window.localStorage[this.name] = JSON.stringify(this.map);
  }
  restore() {
    this.map = /** @type {!Object} */ (JSON.parse(storedGame));


    window.localStorage[this.name] = JSON.stringify(this.map);
  }
}
