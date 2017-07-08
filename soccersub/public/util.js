/** @param {string} type */
function storageAvailable(type) {
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
}

/**
 * @param {!Element} element
 * @param {function()} func
 */
function handleTouch(element, func) {
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
}

/** @return {number} */
function currentTimeMs() {
  return new Date().getTime() + 0;
}

/**
 * @param {number} timeMs
 * @return {string}
 */
function formatTime(timeMs) {
  var timeSec = Math.floor(timeMs / 1000);
  var minutes = Math.floor(timeSec / 60);
  var seconds = timeSec % 60;
  if (seconds < 10) {
    seconds = '0' + seconds;
  }
  return '' + minutes + ':' + seconds;
}

