goog.module('soccersub.util');

const PriorityQueue = goog.require('goog.structs.PriorityQueue');
const asserts = goog.require('goog.asserts');

/** @param {string} type */
exports.storageAvailable = (type) => {
  try {
    var storage = window[type],
	x = '__storage_test__';
    storage.setItem(x, x);
    storage.removeItem(x);
    return true;
  }
  catch(e) {
    return false;
  }
};

/**
 * Finds a button by ID, and binds a callback to it, and returns the
 * element.
 * @param {string} id
 * @param {!function():undefined} callback
 * @return {!Element}
 */
exports.setupButton = (id, callback) => {
  const button = goog.dom.getRequiredElement(id);
  exports.handleTouch(button, callback, id);
  return button;
};

/** @type {!Array<function(!Element, function(), string)>} */
let handleTouchHooks = [];

/**
 * Establishes a touch-handler that provides button behavior on both click
 * and touch events, so an app can work on mobile and desktop.  Allows for
 * test methods to track all the handlers established so the buttons can
 * be easily clicked from unit tests via label.
 *
 * @param {!Element} element
 * @param {function()} func
 * @param {string} label
 */
exports.handleTouch = (element, func, label) => {
  for (let i = 0; i < handleTouchHooks.length; ++i) {
    const hook = handleTouchHooks[i];
    hook(element, func, label);
  }

  /**
   * @param {!Event} event
   */
  function handler(event) {
    func();
    event.preventDefault();
  }

  element.addEventListener('touchstart', handler);
                           ///** @type {boolean} */ ({'passive': true}));
  element.addEventListener('click', handler);
                           ///** @type {boolean} */ ({'passive': true}));
};

/**
 * Provides a mechanism to track all touch-handlers established for
 * an application. This is intended for testing, so unit-test methods
 * can trigger the touch handlers by calling the function directoy, without
 * messing with events, or being able to find the element.
 *
 * @param {function(!Element, function(), string)} func
 */
exports.addHandleTouchHook = (func) => {
  handleTouchHooks.push(func);
};

/** @return {number} */
exports.currentTimeMs = () => {
  return new Date().getTime() + 0;
};

/**
 * @param {number} timeMs
 * @return {string}
 */
exports.formatTime = (timeMs) => {
  var timeSec = Math.floor(timeMs / 1000);
  var minutes = Math.floor(timeSec / 60);
  var seconds = timeSec % 60;
  if (seconds < 10) {
    seconds = '0' + seconds;
  }
  return '' + minutes + ':' + seconds;
};

/**
 * @param {number} x
 * @param {number} y
 * @param {?ClientRect} box
 * @return {boolean}
 */
exports.inside = (x, y, box) => {
  if (!box) {
    return false;
  }
  return (x >= box.left) && (y >= box.top) && 
    (x <= box.right) && (y <= box.bottom);
}

/**
 * @param {!Element} parent
 * @return {!Element} 
 */
exports.makeSingleRowTable = (parent) => {
  const table = document.createElement('table');
  table.className = 'field-row';
  parent.appendChild(table);
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);
  const tr = document.createElement('tr');
  tbody.appendChild(tr);
  return tr;
};

/**
 * @template T
 * @param {!Array<T>} array
 */
exports.shuffle = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/**
 * Inefficient implementation of upper-bound functionality a la STL.  Returns
 * Index of largest index where lessThan(array[index]) is true.
 * if !lessThan(array[0]), then 0 is returned.
 * If lessThan(array[array.length - 1]) then -1 is returned.
 *
 * Assumes array is sorted via lessThan.
 * 
 * TODO(jmarantz): replace current linear impl with binary search.
 *
 * @template T
 * @param {!Array<T>} array
 * @param {function(T): boolean} lessThan
 * @return {number}
 */
exports.upperBound = (array, lessThan) => {
  for (let i = 0; i < array.length; ++i) {
    if (!lessThan(array[i])) {
      return i;
    }
  }
  return -1;
};

/**
 * Finds the highest-priority n items in arr and moves them to the
 * front of the array in sorted order (highest first).  The remainder
 * of the array remains unsorted.
 *
 * The worse-case runtime for this should be O(arr.length * log N).
 * However, typically it will be O(arr.length + N * log N).  We use
 * "+" instead of "*" because typically our arrays are mostly sorted
 * coming into this function, with only incremental changes expected,
 * and we have an early-exit for array elements that have no chance of
 * being inserted into the high-priority list.
 *
 * The worse-case performance comes if the array is sorted in reverse
 * order.
 *
 * @template T
 * @param {!Array<T>} arr
 * @param {number} n
 * @param {!function(T):number} getPriority
 */
exports.sortTopN = (arr, n, getPriority) => {
  if (n == 0) {
    return;
  }
  /** @type {!PriorityQueue<!{value: T, index: number}>} */
  const pqueue = new PriorityQueue();

  // Keep track of the minimum priority in the queue, and don't bother
  // to insert anything less than that.  This is a common case because
  // our priorities don't change much from run to run, so if we have 1M
  // entries and rarely get below a few hundred of them we should be able
  // tackle most of them in linear time.
  let minPriority = NaN;
  for (let i = 0; i < arr.length; ++i) {
    /** @type {T} */
    const value = arr[i];
    const priority = getPriority(value);
    if ((pqueue.getCount() < n) || (priority > minPriority)) {
      pqueue.enqueue(priority, {value: value, index: i});
      if (pqueue.getCount() > n) {
        pqueue.dequeue();
      }
      minPriority = getPriority(pqueue.peek().value);
    }
  }

  // Pull the priority-queue of top N slots into a set for easier lookup.
  // type {!Array<T>}
  const topNArray = pqueue.getValues().map(({value, index}) => value);
  // type {!Set<T>}
  const topN = new Set(topNArray);

  // Hold onto all values we are evicting from the top N slots in the array,
  // so we can swap them into the slots vacated by top N entries.  Note that
  // there can be fewer than N of these because some of the top N entries may
  // already have been in the top N slots.
  const evictedValues = [];
  let evictedValuesIndex = 0;
  for (let i = 0; i < n; ++i) {
    const value = arr[i];
    if (!topN.has(value)) {
      evictedValues.push(value);
    }
  }

  // Pull the sorted N entries out of the priority queue and put them
  // back into the first N entries of the array, moving the evicted items
  // into higher-numbered slots previously inhabited by the top N entries.
  // We are pulling the lowest priority elements out of the pqueue first so
  // we fill the array from n-1 to 0.
  for (let i = n - 1; i >= 0; --i) {
    /** @type {!{value: T, index: number}} */
    const valueIndex = pqueue.dequeue();  // NTI
    const index = valueIndex.index;
    if (index >= n) {
      arr[index] = evictedValues[evictedValuesIndex];
      ++evictedValuesIndex;
    }
    arr[i] = valueIndex.value;
  }

  // All of the evictedValues must be put back into the array, otherwise
  // we will lose them when the topN values take over their top slots.
  asserts.assert(evictedValuesIndex == evictedValues.length);
};

/**
 * @template Key, Value
 * @param {!Map<Key, Value>} map
 * @return {!{keys: !Array<Key>, values: !Array<Value>}}
 */
exports.saveMap = (map) => {
  const /** !Array<Key> */ keys = [];
  const /** !Array<Value> */ values = [];
  map.forEach((/** Value */ value, /** Key */ key) => {
    keys.push(key);
    values.push(value);
  });
  return {keys, values};
};

/**
 * @template Key, Value
 * @param {!{keys: Array<Key>, values: !Array<Value>}} array
 * @param {!Map<Key, Value>} mapOut
 * @return {boolean}
 */
exports.restoreMap = (array, mapOut) => {
  mapOut.clear();
  if (array.keys.length != array.values.length) {
    return false
  }
  for (let i = 0; i < array.keys.length; ++i) {
    mapOut.set(array.keys[i], array.values[i]);
  }
  return true;
};
