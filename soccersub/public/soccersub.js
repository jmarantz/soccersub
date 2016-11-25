var playerNames = [
  'ryan',
  'ellis',
  'fredrik',
  'teddy',
  'will',
  'brandon',
  'elias',
  'owen',
  'hunter',
  'luca'
];

var positionNames = [
  'keeper',
  'left_back',
  'right_back',
  'left_wing',
  'right_wing'
];

var SHOW_TIMES_AT_POSITION = false;

function handleTouch(element, func) {
  element.addEventListener('touchstart', func, {passive: true});
}

function currentTimeMs() {
  return new Date().getTime() + 0;
}

function formatTime(timeMs) {
  var timeSec = Math.floor(timeMs / 1000);
  var minutes = Math.floor(timeSec / 60);
  var seconds = timeSec % 60;
  if (seconds < 10) {
    seconds = '0' + seconds;
  }
  return '' + minutes + ':' + seconds;
}

var Position = function(name, index, headRow, game) {
  this.name = name;
  this.currentPlayer = null;
  this.index = index;

  // The position shows up twice in the DOM, once in the field
  // layout, and once as a table header for the players, so we 
  // can see how long they've played at each position.  First
  // the field layout, which will be sensitive to touch events
  // for player assignment, and we will write the player in there
  // when assigned.
  this.element = document.getElementById(name);
  this.element.style.lineHeight = 'normal';
  this.render();
  handleTouch(this.element, game.assignPosition.bind(game, this));
  
  // Now the table header entry, which we are just going to automatically
  // populate, and don't need to reference it after that.
  if (SHOW_TIMES_AT_POSITION) {
    var th = document.createElement('th');
    th.textContent = name;
    headRow.appendChild(th);
  }
};

Position.prototype.render = function() {
  var text = '<b>' + this.name + ':</b><br/>';
  if (this.currentPlayer) {
    text += '' + this.currentPlayer.renderAtPosition();
  } else {
    text += '<i><b>NEEDS PLAYER</b></i>';
  }
  this.element.innerHTML = text;
}

Position.prototype.setPlayer = function(player) {
  if (this.currentPlayer != player) {
    if (this.currentPlayer != null) {
      var oldPlayer = this.currentPlayer;
      this.currentPlayer = null;
      oldPlayer.setPosition(null);
    }
    this.currentPlayer = player;
    this.render();
  }
};

Position.prototype.addTimeToShift = function(timeMs) {
  if (this.currentPlayer != null) {
    this.currentPlayer.addTimeToShift(timeMs);
    this.render();
  }
};

var Player = function(name, tableBody, game) {
  this.name = name;
  //this.game = game;
  this.available = false;
  this.timeInGameMs = 0;
  this.timeInShiftMs = 0;
  this.timeAtPositionMs = {};
  if (SHOW_TIMES_AT_POSITION) {
    this.elementAtPosition = {};
  }
  this.currentPosition = null;
  this.selected = false;
  var row = document.createElement('tr');
  this.nameElement = document.createElement('td');
  handleTouch(this.nameElement, game.selectPlayer.bind(game, this));
  this.nameElement.textContent = name;
  row.appendChild(this.nameElement);
  this.gameTimeElement = document.createElement('td');
  this.gameTimeElement.textContent = formatTime(0);
  row.appendChild(this.gameTimeElement);
  for (var i = 0; i < positionNames.length; ++i) {
    var positionName = positionNames[i];
    this.timeAtPositionMs[positionName] = 0;
    if (SHOW_TIMES_AT_POSITION) {
      var td = document.createElement('td');
      row.appendChild(td);
      this.elementAtPosition[positionName] = td;
    }
  }
  tableBody.appendChild(row);
};

Player.prototype.setPosition = function(position) {
  if (this.currentPosition != position) {
    if (this.currentPosition != null) {
      var oldPos = this.currentPosition;
      this.currentPosition = null;
      oldPos.setPlayer(null);
    }
    this.currentPosition = position;
    this.timeInShift = 0;
    this.updateColor();
  }
};

Player.prototype.updateColor = function() {
  var color = 'white';
  if (this.currentPosition != null) {
    color = this.selected ? 'red' : 'yellow';
  } else if (this.selected) {
    color = 'blue';
  }
  this.nameElement.style.backgroundColor = color;
};

Player.prototype.renderAtPosition = function() {
  return this.name + ' ' + formatTime(this.timeInShiftMs);
};

Player.prototype.addTimeToShift = function(timeMs) {
  this.timeInShiftMs += timeMs;
  this.timeInGameMs += timeMs;
  this.gameTimeElement.textContent = formatTime(this.timeInGameMs);
  this.timeAtPositionMs[this.currentPosition.name] += timeMs;
  if (SHOW_TIMES_AT_POSITION) {
    //var positionMs = ...;
    var elt = this.elementAtPosition[this.currentPosition.name];
    elt.textContent = formatTime(positionMs);
  }
};

Player.prototype.render = function() {
  var text = this.name + ' ';
};

Player.prototype.unselect = function() {
  this.selected = false;
  this.updateColor();
};

Player.prototype.select = function() {
  this.selected = true;
  this.updateColor();
};

var Game = function() {
  this.elapsedTimeMs = 0;
  this.timeRunning = false;
  this.timeOfLastUpdateMs = 0;
  this.positions = [];
  this.selectedPlayer = null;
  var headRow = document.getElementById('table-head-row');
  for (var i = 0; i < positionNames.length; ++i) {
    this.positions.push(new Position(positionNames[i], i, headRow, this));
  }
  this.players = [];
  var tableBody = document.getElementById('table-body');
  for (var i = 0; i < playerNames.length; ++i) {
    this.players.push(new Player(playerNames[i], tableBody, this));
  }
  this.gameClockElement = document.getElementById('game_clock');
  //handleTouch(this.gameClockElement, this.toggleClock.bind(this));
  this.toggleClockButton = document.getElementById('clock_toggle');
  handleTouch(this.toggleClockButton, this.toggleClock.bind(this));
  this.statusBar = document.getElementById('status_bar');
  this.statusBarWriteMs = 0;

  this.update();
};    

Game.prototype.toggleClock = function() {
  this.timeRunning = !this.timeRunning;
  if (this.timeRunning) {
    this.timeOfLastUpdateMs = currentTimeMs();
    this.gameClockElement.style.backgroundColor = 'green';
    this.toggleClockButton.textContent = 'Stop Clock';
  } else {
    this.gameClockElement.style.backgroundColor = 'red';
    this.toggleClockButton.textContent = 'Resume Clock';
  }
  this.update();
};

Game.prototype.selectPlayer = function(player) {
  if (this.selectedPlayer == player) {
    // If current player is selected, simply unselect.
    this.selectedPlayer = null;
    player.unselect();
  } else {
    if (this.selectedPlayer != null) {
      this.selectedPlayer.unselect();
    }
    this.selectedPlayer = player;
    if (player != null) {
      player.select();
    }
  }
};

Game.prototype.assignPosition = function(position) {
  if (this.selectedPlayer == null) {
    this.writeStatus('Select a player before assigning a position');
  } else {
    this.selectedPlayer.setPosition(position);
    position.setPlayer(this.selectedPlayer);

    // Unselect the player so we are less likely to double-assign.
    this.selectPlayer(null);
  }
};

Game.prototype.writeStatus = function(text) {
  this.statusBar.textContent = text;
  this.statusBarWriteMs = currentTimeMs();
};

Game.prototype.update = function() {
  if (this.timeRunning) {
    var timeMs = currentTimeMs();
    var timeSinceLastUpdate = timeMs - this.timeOfLastUpdateMs;
    this.elapsedTimeMs += timeSinceLastUpdate;
    this.timeOfLastUpdateMs = timeMs;
    this.gameClockElement.innerHTML = '<b>Game Clock: </b>' +
      formatTime(this.elapsedTimeMs);
    for (var i = 0; i < this.positions.length; ++i) {
      this.positions[i].addTimeToShift(timeSinceLastUpdate);
    }

    window.setTimeout(this.update.bind(this), 1000);
  }
  if ((this.statusBarWriteMs != 0) &&
      (timeMs - this.statusBarWriteMs) > 5000) {
    this.statusBar.textContent = '';
    this.statusBarWriteMs = 0;
  }
};

var game;
window.onload = function() {
  game = new Game();
};

