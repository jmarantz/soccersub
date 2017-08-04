goog.module('soccersub.ArraySection');

// An ArrayStorageValue can be declared by an application, specifying
// how values can be saved from, or restored to, active state.
class ArrayStorageValue {
  /**
   * @param {string} name
   * @param {function(*):*} getter
   * @param {function(*, *):undefined} setter
   */
  constructor(name, getter, setter) {
    /** @type {string} */
    this.name = name;
    /** @type {function(*):*} getter */
    this.getter = getter;
    /** @type {function(*, *):undefined} setter */
    this.setter = setter;
  }
}

class ArraySection {
  /** @param {string} name */
  constructor(name) {
    /** @type {string} */
    this.name = name;
    /** @type {Map<string, !ArrayStorageValue>} */
    this.columns = new Map();
    /** @type {!Map<string, *> } */
    this.instances = new Map();
  }

  /**
   * @param {string} name
   * @param {function(*):*} getter
   * @param {function(*, *):undefined} setter
   */
  addColumn(name, getter, setter) {
    this.columns.set(name, new ArrayStorageValue(name, getter, setter));
  }

  /**
   * @param {string} name
   * @param {*} instance
   */
  addInstance(name, instance) {
    this.instances.set(name, instance);
  }

  /** @return {!Array<!Array<*>>} array */
  save() {
    const array = [];
    const header = [''];
    for (const column of this.columns.values()) {
      header.push(column.name);
    }
    array.push(header);
    for (const name of this.instances.keys()) {
      const instance = this.instances.get(name);
      const row = [];
      row.push(name);
      for (const column of this.columns.values()) {
        row.push(column.getter(instance));
      }
      array.push(row);
    }
    return array;
  }

  /** @param {!Array<!Array<*>>} array */
  restore(array) {
    // The saved columns may not match exactly the expected columns.
    // We will not attempt to restore any saved columns we don't expect,
    // and we will store null into any columns missing from the storage.
    //
    // We will also null out any columns for instances that are
    // missing.

    const columnNameToIndexMap = new Map();
    const instanceNameToRowMap = new Map();

    if (array && (array.length > 0)) {
      const header = array[0];
      for (let i = 1; i < header.length; ++i) {
        if (header[i]) {
          columnNameToIndexMap.set(header[i], i);
        }
      }

      for (let i = 1; i < array.length; ++i) {
        const row = array[i];
        const instanceName = (row.length > 0) ? row[0] : '';
        if (instanceName) {
          instanceNameToRowMap.set(instanceName, i);
        }
      }
    }

    for (const name of this.instances.keys()) {
      const instance = this.instances.get(name);
      const rowIndex = instanceNameToRowMap.get(name);
      const row = rowIndex ? array[rowIndex] : null;
      for (const column of this.columns.values()) {
        let value = null;
        if (row) {
          const colIndex = columnNameToIndexMap.get(column.name);
          if (colIndex) {
            value = row[colIndex];
          }
        }
        column.setter(instance, value);
      }
    }
  }
}

exports = ArraySection;
