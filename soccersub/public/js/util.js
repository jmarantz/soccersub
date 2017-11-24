goog.module('soccersub.util');

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
  exports.handleTouch(button, callback);
  return button;
};

/**
 * @param {!Element} element
 * @param {function()} func
 */
exports.handleTouch = (element, func) => {
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
