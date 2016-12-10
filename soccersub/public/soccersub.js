var bencosnersPlayerNames = [
  'ryan',
  'ellis',
  'fredrik',
  'teddy',
  'will',
  'brandon',
  'elias',
  'owen',
  'hunter',
  'luca',
  'tommy',
  'josh'
];

var chscPlayerNames = [
  'Elizabeth F',
  'Gwyneth M',
  'Hannah K',
  'Hannah S',
  'India S',
  'Kaesha M',
  'Magdalena G',
  'Netta',
  'Rossella G',
  'Sarah S',
  'Sophia F',
  'Sophie N'
];

var santosRedPlayerNames = [
  'Levi',
  'Eli G',
  'Jeremy',
  'Griffen',
  'Ethan',
  'Declan',
  'Eli T',
  'Dante',
  'Goalie'
];

//var defaultPlayerNames = santosRedPlayerNames;
var defaultPlayerNames = bencosnersPlayerNames;
//var defaultPlayerNames = chscPlayerNames;

var defaultPositionNames = [
  'keeper',
  'left_back',
  'right_back',
  'left_wing',
  'right_wing'
];

var SHOW_TIMES_AT_POSITION = false;
var DEBUG_SORTING = false;


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

/**
 * @constructor
 * @param {string} name
 */
var Team = function(name) {
  this.name = name;
  this.playerNames = [];
  this.playerEntry = document.getElementById('player-entry');
};

var teamList = [];

/**
 * @param {string} name
 * @param {!Element} headRow
 * @param {!Game} game
 * @constructor 
 */
var Position = function(name, headRow, game) {
  this.name = name;
  this.currentPlayer = null;

  // The position shows up twice in the DOM, once in the field
  // layout, and once as a table header for the players, so we 
  // can see how long they've played at each position.  First
  // the field layout, which will be sensitive to touch events
  // for player assignment, and we will write the player in there
  // when assigned.
  var element = document.getElementById(name);

  // Rebuild the element in case this is a 'reset' and the HTML element
  // already has a touch handler.
  this.element = element.cloneNode(true);
  var parent = element.parentNode;
  parent.removeChild(element);
  parent.appendChild(this.element);

  this.element.style.lineHeight = 'normal';
  this.render();
  handleTouch(this.element, game.bind(game.assignPosition, this));
  
  // Now the table header entry, which we are just going to automatically
  // populate, and don't need to reference it after that.
  if (SHOW_TIMES_AT_POSITION) {
    var th = document.createElement('th');
    th.textContent = name;
    headRow.appendChild(th);
  }
};

/**
 * @return {void}
 */
Position.prototype.render = function() {
  var text = '<b>' + this.name + ':</b><br/>';
  if (this.currentPlayer) {
    text += '' + this.currentPlayer.renderAtPosition();
  } else {
    text += '<i><b>NEEDS PLAYER</b></i>';
  }
  this.element.innerHTML = text;
};

/** @param {string} color */
Position.prototype.setBackgroundColor = function(color) {
  this.element.style.backgroundColor = color;
  // this.element.style.opacity = 0.5;
};

/** @param {?Player} player */
Position.prototype.restorePlayer = function(player) {
  this.currentPlayer = player;
  this.render();
};

/** @param {?Player} player */
Position.prototype.setPlayer = function(player) {
  if (this.currentPlayer != player) {
    if (this.currentPlayer != null) {
      var oldPlayer = this.currentPlayer;
      this.currentPlayer = null;
      oldPlayer.setPosition(null);
    }
    this.restorePlayer(player);
  }
};

/** @param {number} timeMs */
Position.prototype.addTimeToShift = function(timeMs) {
  if (this.currentPlayer != null) {
    this.currentPlayer.addTimeToShift(timeMs);
    this.render();
  }
};

/**
 * @param {string} name
 * @param {Game} game
 * @constructor 
 */
var Player = function(name, game) {
  this.name = name;
  this.game = game;
  this.reset();
};

Player.prototype.reset = function() {
  this.timeInGameMs = 0;
  this.timeInShiftMs = 0;
  this.availableForGame = true;  
  this.timeAtPositionMs = {};
  if (SHOW_TIMES_AT_POSITION) {
    this.elementAtPosition = {};
  }
  /** @type {?Position} */
  this.currentPosition = null;
  this.selected = false;
  for (var i = 0; i < this.game.positionNames.length; ++i) {
    var positionName = this.game.positionNames[i];
    this.timeAtPositionMs[positionName] = 0;
  }
};

Player.prototype.computePercentageInGameNotKeeper = function() {
  var timeAsKeeperMs = this.timeAtPositionMs['keeper'];
  var totalInGameWhenThisPlayerWasNotKeeperMs = this.game.elapsedTimeMs -
      timeAsKeeperMs;
  if (!totalInGameWhenThisPlayerWasNotKeeperMs) {
    return 0;
  }
  var playtimeTimeWhileNotKeeper = this.timeInGameMs - timeAsKeeperMs;
  return 100 * playtimeTimeWhileNotKeeper /
    totalInGameWhenThisPlayerWasNotKeeperMs;
};

/**
 * @return {void}
 */
Player.prototype.writeStatus = function() {
  var msg = this.name + ': [';
  if (this.currentPosition != null) {
    msg += this.currentPosition.name + ': ' +
      formatTime(this.timeAtPositionMs[this.currentPosition.name]);
  } else if (this.availableForGame) {
    msg += 'available';
  } else { 
    msg += 'unavailable';
  }
  msg += ']';
  for (var i = 0; i < this.game.positionNames.length; ++i) {
    var positionName = this.game.positionNames[i];
    if ((this.currentPosition == null) ||
        (this.currentPosition.name != positionName)) {
      var timeMs = this.timeAtPositionMs[positionName];
      if (timeMs && (timeMs != 0)) {
        msg += " " + positionName + ": " + formatTime(timeMs);
      }
    }
  }
  this.game.writeStatus(msg);
};


/**
 * @param {string} field
 * @param {Object.<string, string>} storage
 * @return {string}
 */
Player.prototype.getStorage = function(field, storage) {
  return storage['Player:' + this.name + ':' + field];
};

/**
 * @param {string} field
 * @param {string} value
 * @param {Object.<string, string>} storage
 */
Player.prototype.setStorage = function(field, value, storage) {
  storage['Player:' + this.name + ':' + field] = value;
};

/**
 * @param {Object} gameMap
 * @return {void}
 */
Player.prototype.restore = function(gameMap) {
  var playerMap = gameMap[this.name];
  if (!playerMap) {
    this.reset();
    return;
  }
  this.timeInGameMs = playerMap.timeInGameMs;
  this.timeInShiftMs = playerMap.timeInShiftMs;
  this.availableForGame = playerMap.availableForGame;
  // timeAtPositionMs ...
  this.currentPosition = this.game.findPosition(playerMap.currentPosition);
  if (this.currentPosition != null) {
    this.currentPosition.restorePlayer(this);
  }
  this.timeAtPositionMs = {};
  for (var i = 0; i < this.game.positionNames.length; ++i) {
    var positionName = this.game.positionNames[i];
    var timeMs = playerMap[positionName];
    this.timeAtPositionMs[positionName] = timeMs ? timeMs : 0;
  }
};

/**
 * @param {Object} gameMap
 * @return {void}
 */
Player.prototype.save = function(gameMap) {
  var playerMap = {};
  gameMap[this.name] = playerMap;
  playerMap.timeInGameMs = this.timeInGameMs;
  playerMap.timeInShiftMs = this.timeInShiftMs;
  playerMap.availableForGame = this.availableForGame;
  playerMap.currentPosition = this.currentPosition
    ? this.currentPosition.name : null;
  for (var i = 0; i < this.game.positionNames.length; ++i) {
    var positionName = this.game.positionNames[i];
    var timeMs = this.timeAtPositionMs[positionName];
    if (timeMs) {
      playerMap[positionName] = timeMs;
    }
  }
};

/** @return {boolean} */
Player.prototype.isPlaying = function() {
  return this.currentPosition != null;
};

/**
 * Compare two players in terms of play-time, returning the difference
 * in milliseconds between the amount the two players have played in the
 * game.  If the game-times are equal, return the difference beween the
 * shift-times in milliseconds.
 *
 * @param {!Player} player1
 * @param {!Player} player2
 * @return {number}
 */
Player.comparePlayingTimeMs = function(player1, player2) {
  var cmp = player1.computePercentageInGameNotKeeper() -
      player2.computePercentageInGameNotKeeper();
  if (cmp == 0) {
    cmp = player1.timeInGameMs - player2.timeInGameMs;
    if (cmp == 0) {
      cmp = player1.timeInShiftMs - player2.timeInShiftMs;
    }
  }
  return cmp;
}

/**
 * @param {!Player} player1
 * @param {!Player} player2
 * @return {number}
 */
Player.compare = function(player1, player2) {
  if (player1.availableForGame && !player2.availableForGame) {
    return -1;
  } else if (player2.availableForGame && !player1.availableForGame) {
    return 1;
  }
  var cmp = Player.comparePlayingTimeMs(player1, player2);
  if (cmp == 0) {
    if (player1.name < player2.name) {
      cmp = -1;
    } else if (player1.name > player2.name) {
      cmp = 1;
    }
  }
  return cmp;
}

/**
 * @param {!Element} tableBody
 */
Player.prototype.render = function(tableBody) {
  var row = document.createElement('tr');
  this.nameElement = document.createElement('td');
  handleTouch(this.nameElement, this.game.bind(this.game.selectPlayer, this));
  this.nameElement.textContent = this.name;
  row.appendChild(this.nameElement);
  this.gameTimeElement = document.createElement('td');
  this.renderGameTime();
  row.appendChild(this.gameTimeElement);
  if (SHOW_TIMES_AT_POSITION) {
    for (var i = 0; i < this.game.positionNames.length; ++i) {
      var positionName = this.game.positionNames[i];
      var td = document.createElement('td');
      row.appendChild(td);
      this.elementAtPosition[positionName] = td;
    }
  }
  this.updateColor();
  tableBody.appendChild(row);
};

/**
 * @param {Position} position
 */
Player.prototype.setPosition = function(position) {
  if (this.currentPosition != position) {
    if (this.currentPosition != null) {
      var oldPos = this.currentPosition;
      this.currentPosition = null;
      oldPos.setPlayer(null);
    } else {
      this.timeInShiftMs = 0;
    }
    this.currentPosition = position;
    this.timeInShift = 0;
    this.updateColor();
    this.writeStatus();
    //this.save();
  }
};

/**
 * @return {void}
 */
Player.prototype.updateColor = function() {
  var color = 'white';
  if (!this.availableForGame) {
    color = 'lightblue';
  } else if (this.currentPosition != null) {
    if (this.currentPosition == this.game.positionWithLongestShift) {
      color = 'orange';
    } else if (this.currentPosition.name == 'keeper') {
      color = 'bisque';
    } else {
      color = 'aquamarine';
    }
  }
  
  if (this.selected) {
    this.nameElement.style.backgroundColor = 'black';
    this.nameElement.style.color = color;
  } else {
    this.nameElement.style.backgroundColor = color;
    this.nameElement.style.color = 'black';
  }
};

/**
 * @return {string}
 */
Player.prototype.renderAtPosition = function() {
  if (this.selected) {
    this.writeStatus();
  }
  return this.name + ' ' + formatTime(this.timeInShiftMs);
};

Player.prototype.renderGameTime = function() {
  this.gameTimeElement.textContent = formatTime(this.timeInGameMs) + ' ('
    + Math.round(this.computePercentageInGameNotKeeper()) + '%)';
};

/**
 * @param {number} timeMs
 */
Player.prototype.addTimeToShift = function(timeMs) {
  this.timeInShiftMs += timeMs;
  this.timeInGameMs += timeMs;
  this.timeAtPositionMs[this.currentPosition.name] += timeMs;
  this.renderGameTime();
  //if (SHOW_TIMES_AT_POSITION) {
    //var positionMs = ...;
    //var elt = this.elementAtPosition[this.currentPosition.name];
    //elt.textContent = formatTime(positionMs);
  //}
};

/**
 * unselects player
 */
Player.prototype.unselect = function() {
  this.selected = false;
  this.updateColor();
};

/**
 * @return {void}
 */
Player.prototype.select = function() {
  this.selected = true;
  this.updateColor();
};

/** @constructor */
var Game = function() {
  // Set up HTML element connections & handlers.
  this.gameClockElement = document.getElementById('game_clock');
  /** @type {!Element} */
  this.toggleClockButton = 
    /** @type {!Element} */ (document.getElementById('clock_toggle'));
  handleTouch(this.toggleClockButton, this.bind(this.toggleClock));

  /** @type {Position} */
  this.positionWithLongestShift = null;

  this.statusBar = document.getElementById('status_bar');
  //this.statusBarWriteMs = 0;
  /** @type {boolean} */
  this.timeoutPending = false;
  this.resetTag = /** @type {!Element} */ (document.getElementById('reset'));
  handleTouch(this.resetTag, this.bind(this.confirmAndReset));
  this.started = false;
  this.unavailableButton = /** @type {!Element} */ 
      (document.getElementById('unavailable'));
  handleTouch(this.unavailableButton, this.bind(this.togglePlayerUnavailable));
  this.lightbox =  /** @type {!Element} */
      (document.getElementById('confirm'));
  handleTouch(/** @type {!Element} */ (document.getElementById('ok')), 
              this.bind(this.reset));
  handleTouch(/** @type {!Element} */ (document.getElementById('cancel')),
              this.bind(this.cancelReset));

  if (!this.restore()) {
    this.reset();
  }
};    


Game.prototype.bind = function(func, ...optArgs) {
  var game = this;
  return function(...laterArgs) {
    var args = optArgs.concat(laterArgs);
    var result = null;
    try {
      if (args.length) {
        result = func.apply(game, args);
      } else {
        result = func.apply(game);
      }
    } catch (err) {
      game.writeStatus('ERROR: ' + err + '\n' + err.stack);
    }
    return result;
  }
};

/**
 * @return {void}
 */
Game.prototype.confirmAndReset = function() {
  if (this.started) {
    this.lightbox.style.display = 'block';
  }
};

Game.prototype.cancelReset = function() {
  this.lightbox.style.display = 'none';
}

/**
 * @return {void}
 */
Game.prototype.reset = function() {
  this.lightbox.style.display = 'none';
  this.elapsedTimeMs = 0;
  this.timeOfLastUpdateMs = 0;
  this.rendered = false;
  this.positions = [];
  this.selectedPlayer = null;
  this.positionNames = defaultPositionNames;
  this.playerNames = defaultPlayerNames;
  this.constructPlayersAndPositions();
  this.sortAndRenderPlayers();
  this.timeRunning = false;
  this.started = false;
  this.update();
  this.updateAvailableButton();
};

/**
 * @return {void}
 */
Game.prototype.constructPlayersAndPositions = function() {
  var headRow = /** @type {!Element} */ (document.getElementById('table-head-row'));
  this.positions = [];
  for (var i = 0; i < this.positionNames.length; ++i) {
    this.positions.push(new Position(this.positionNames[i], headRow, this));
  }
  this.players = [];
  for (var i = 0; i < this.playerNames.length; ++i) {
    var player = new Player(this.playerNames[i], this);
    this.players.push(player);
  }
};

/**
 * @return {boolean}
 */
Game.prototype.restore = function() {
  if (!storageAvailable('localStorage')) {
    return false;
  }

  try {
    var storedGame = window.localStorage.game;
    if (!storedGame) {
      return false;
    }
    var map = JSON.parse(storedGame);

    this.rendered = false;
    this.playerNames = map.playerNames;
    this.positionNames = map.positionNames;
    if ((this.playerNames.length == 0) || (this.positionNames.length == 0)) {
      return false;
    }
    this.constructPlayersAndPositions();
    for (var i = 0; i < this.players.length; ++i) {
      var player = this.players[i];
      player.restore(map);
    }
    /*
      for (var i = 0; i < this.positions.length; ++i) {
      var position = this.position[i];
      position.restore();
      }
    */
    this.elapsedTimeMs = map.elapsedTimeMs;
    this.timeRunning = map.timeRunning;
    this.started = map.started;
    this.timeOfLastUpdateMs = map.timeOfLastUpdateMs;
    this.sortAndRenderPlayers();
    for (var i = 0; i < this.players.length; ++i) {
      var player = this.players[i];
      player.updateColor();
    }
    this.update();
    this.updateAvailableButton();
    return true;
  } catch (err) {
    return false;
  }
};

/**
 * @param {string} name
 * @return {?Position}
 */
Game.prototype.findPosition = function(name) {
  for (var i = 0; i < this.positions.length; ++i) {
    var position = this.positions[i];
    if (position.name == name) {
      return position;
    }
  }
  return null;
}

/**
 * @return {void}
 */
Game.prototype.save = function() {
  var map = {};
  map.elapsedTimeMs = this.elapsedTimeMs;
  map.timeRunning = this.timeRunning;
  map.started = this.started;
  map.timeOfLastUpdateMs = this.timeOfLastUpdateMs;
  map.playerNames = this.playerNames;
  map.positionNames = this.positionNames;
  for (var i = 0; i < this.players.length; ++i) {
    var player = this.players[i];
    player.save(map);
  }
  window.localStorage.game = JSON.stringify(map);
};

/**
 * @return {void}
 */
Game.prototype.sortAndRenderPlayers = function() {
  this.computePositionWithLongestShift();
  var players = this.players.slice(0);
  players.sort(Player.compare);
  var changed = !this.rendered;
  for (var i = 0; !changed && (i < players.length); ++i) {
    changed = players[i] != this.players[i];
  }
  if (changed) {
    this.rendered = true;
    this.players = players;
    var tableBody = document.getElementById('table-body');
    tableBody.innerHTML = '';
    for (var i = 0; i < this.players.length; ++i) {
      var player = this.players[i];
      player.render(tableBody);
    }
  }
}

/**
 * @return {void}
 */
Game.prototype.toggleClock = function() {
  this.started = true;
  this.timeRunning = !this.timeRunning;
  this.timeOfLastUpdateMs = currentTimeMs();
  this.update();
};

/**
 * @return {void}
 */
Game.prototype.redrawClock = function() {
  if (this.timeRunning) {
    this.gameClockElement.style.backgroundColor = 'lightgreen';
    this.toggleClockButton.textContent = 'Stop Clock';
  } else {
    this.gameClockElement.style.backgroundColor = 'pink';
    this.toggleClockButton.textContent =
      (this.elapsedTimeMs == 0) ? 'Start Clock': 'Resume Clock';
  }
};


Game.prototype.togglePlayerUnavailable = function() {
  if (this.selectedPlayer != null) {
    this.selectedPlayer.availableForGame = !this.selectedPlayer.availableForGame;
    if (!this.selectedPlayer.availableForGame) {
      var position = this.selectedPlayer.currentPosition;
      if (position != null) {
        position.setPlayer(null);
        position.render();
      }
    }
    this.selectedPlayer.writeStatus();
    this.updateAvailableButton();
    this.sortAndRenderPlayers();
    this.redrawPositions();
    this.update();
  }
};

/**
 * @param {?Player} player
 */
Game.prototype.selectPlayer = function(player) {
  if (this.selectedPlayer == player) {
    // If current player is selected, simply unselect.
    this.selectedPlayer = null;
    if (player != null) {
      player.unselect();
    }
  } else {
    if (this.selectedPlayer != null) {
      this.selectedPlayer.unselect();
    }
    this.selectedPlayer = player;
    if (player != null) {
      player.select();
    }
  }
  if (this.selectedPlayer == null) {
    this.writeStatus(' ');
  } else {
    this.selectedPlayer.writeStatus();
  }
  this.updateAvailableButton();
  this.redrawPositions();
};

Game.prototype.updateAvailableButton = function() {
  if (this.selectedPlayer) {
    if (this.selectedPlayer.availableForGame) {
      this.unavailableButton.style.backgroundColor = 'white';
      this.unavailableButton.textContent = 'Make Unavailable';
    } else {
      this.unavailableButton.style.backgroundColor = 'lightgreen';
      this.unavailableButton.textContent = 'Make Available';
    }
  } else {
    this.unavailableButton.style.backgroundColor = 'lightgray';
    this.unavailableButton.textContent = 'Make Unavailable';
  }
};

/**
 * @return {void}
 */
Game.prototype.computePositionWithLongestShift = function() {
  var pos = null;
  for (var i = 0; i < this.positions.length; ++i) {
    var position = this.positions[i];
    if ((position.name != 'keeper') && (position.currentPlayer != null)) {
      if ((pos == null) || 
          (position.currentPlayer.timeInShiftMs > pos.currentPlayer.timeInShiftMs)) {
        pos = position;
      }
    }
  }
  this.positionWithLongestShift = pos;
  this.redrawPositions();
}

/**
 * @return {void}
 */
Game.prototype.redrawPositions = function() {
  var unavailable = (this.selectedPlayer != null) && !this.selectedPlayer.availableForGame;
  for (var i = 0; i < this.positions.length; ++i) {
    var position = this.positions[i];
    if (unavailable) {
      position.setBackgroundColor('lightgray');
    } else {
      if (position.currentPlayer == null) {
        position.setBackgroundColor('yellow');
      } else if (position.currentPlayer.selected) {
        position.setBackgroundColor('pink');
      } else if (position == this.positionWithLongestShift) {
        position.setBackgroundColor('orange');
      } else {
        position.setBackgroundColor('white');
      }
    }
  }
};

/**
 * @param {?Position} position
 */
Game.prototype.assignPosition = function(position) {
  if (this.selectedPlayer == null) {
    if (position.currentPlayer != null) {
      this.selectPlayer(position.currentPlayer);
    } else {
      this.writeStatus('Select a player before assigning a position');
    }
  } else if (this.selectedPlayer.availableForGame) {
    this.selectedPlayer.setPosition(position);
    if (position != null) {
      position.setPlayer(this.selectedPlayer);
    }
    
    // Unselect the player so we are less likely to double-assign.
    this.selectPlayer(null);
    this.sortAndRenderPlayers();
    this.started = true;
    this.update();
  }
};

/**
 * @param {string} text
 */
Game.prototype.writeStatus = function(text) {
  this.statusBar.textContent = text;
  //this.statusBarWriteMs = currentTimeMs();
};

Game.prototype.updateTimer = function() {
  this.timeoutPending = false;
  this.update();
};

/**
 * @return {void}
 */
Game.prototype.update = function() {
  if (this.timeRunning) {
    var timeMs = currentTimeMs();
    var timeSinceLastUpdate = timeMs - this.timeOfLastUpdateMs;
    if (timeSinceLastUpdate > 0) {
      this.elapsedTimeMs += timeSinceLastUpdate;
      this.timeOfLastUpdateMs = timeMs;
      for (var i = 0; i < this.positions.length; ++i) {
        this.positions[i].addTimeToShift(timeSinceLastUpdate);
      }
      this.sortAndRenderPlayers();
    }
    if (!this.timeoutPending) {
      this.timeoutPending = true;
      window.setTimeout(this.bind(this.updateTimer), 1000);
    }
  }
  /*if ((this.statusBarWriteMs != 0) &&
      (timeMs - this.statusBarWriteMs) > 5000) {
    this.statusBar.textContent = ' ';
    this.statusBarWriteMs = 0;
  }*/
  this.redrawClock();
  this.gameClockElement.innerHTML = '<b>Game Clock: </b>' +
    formatTime(this.elapsedTimeMs);
  this.save();
  this.resetTag.style.backgroundColor = this.started ? 'white': 'lightgray';
};

var game;
window.onload = function() {
  game = new Game();
};

