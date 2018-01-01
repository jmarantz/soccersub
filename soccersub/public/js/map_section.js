goog.module('soccersub.MapSection');

/**
 * A StorageValue can be declared by an application, specifying how values
 * can be saved from, or restored to, active state.
 *
 * @template T
 */
class StorageValue {
  /**
   * @param {string} name
   * @param {function():T} getter
   * @param {function(T):undefined} setter
   */
  constructor(name, getter, setter) {
    /** @type {string} */
    this.name = name;
    /** @type {function():T} getter */
    this.getter = getter;
    /** @type {function(T):undefined} setter */
    this.setter = setter;
  }
}

/** @template T */
class MapSection {
  /** @param {string} name */
  constructor(name) {
    /** @type {string} */
    this.name = name;
    /** @type {Map<string, !StorageValue<T>>} */
    this.values = new Map();
  }

  /**
   * @param {string} name
   * @param {function():T} getter
   * @param {function(T):undefined} setter
   */
  addValue(name, getter, setter) {
    const storageValue = new StorageValue(name, getter, setter);
    this.values.set(name, storageValue);
  }

  /** @return {!Object} map */
  save() {
    const map = {};
    for (const value of this.values.values()) {
      map[value.name] = value.getter();
    }
    return map;
  }

  /** @param {!Object} map */
  restore(map) {
    for (const value of this.values.values()) {
      value.setter(map[value.name]);
    }
  }
}

exports = MapSection;
