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
};

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

var Player = function(name, game) {
  this.name = name;
  this.game = game;
  this.available = false;
  this.timeInGameMs = 0;
  this.timeInShiftMs = 0;
  this.timeAtPositionMs = {};
  if (SHOW_TIMES_AT_POSITION) {
    this.elementAtPosition = {};
  }
  this.currentPosition = null;
  this.selected = false;
  for (var i = 0; i < positionNames.length; ++i) {
    var positionName = positionNames[i];
    this.timeAtPositionMs[positionName] = 0;
  }
};

Player.prototype.isPlaying = function() {
  return this.currentPosition != null;
};

// Compare two players in terms of play-time, returning the difference
// in milliseconds between the amount the two players have played in the
// game.  If the game-times are equal, return the difference beween the
// shift-times in milliseconds.
Player.comparePlayingTimeMs = function(player1, player2) {
  if (player1.timeInGameMs != player2.timeInGameMs) {
    return player1.timeInGameMs - player2.timeInGameMs;
  }
  return player1.timeInShiftMs - player2.timeInShiftMs;
};

Player.compare = function(player1, player2) {
  var cmp = Player.comparePlayingTimeMs(player1, player2);
  if (cmp == 0) {
    if (player1.name < player2.name) {
      cmp = -1;
    } else if (player1.name > player2.name) {
      cmp = 1;
    }
  }
  return cmp;
};

Player.prototype.render = function(tableBody) {
  var row = document.createElement('tr');
  this.nameElement = document.createElement('td');
  handleTouch(this.nameElement, this.game.selectPlayer.bind(this.game, this));
  this.nameElement.textContent = this.name;
  row.appendChild(this.nameElement);
  this.gameTimeElement = document.createElement('td');
  this.gameTimeElement.textContent = formatTime(this.timeInGameMs);
  row.appendChild(this.gameTimeElement);
  if (SHOW_TIMES_AT_POSITION) {
    for (var i = 0; i < positionNames.length; ++i) {
      var positionName = positionNames[i];
      var td = document.createElement('td');
      row.appendChild(td);
      this.elementAtPosition[positionName] = td;
    }
  }
  this.updateColor();
  tableBody.appendChild(row);
};

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
  for (var i = 0; i < playerNames.length; ++i) {
    var player = new Player(playerNames[i], this);
    this.players.push(player);
  }
  this.sortAndRenderPlayers();
  this.gameClockElement = document.getElementById('game_clock');
  //handleTouch(this.gameClockElement, this.toggleClock.bind(this));
  this.toggleClockButton = document.getElementById('clock_toggle');
  handleTouch(this.toggleClockButton, this.toggleClock.bind(this));
  this.statusBar = document.getElementById('status_bar');
  this.statusBarWriteMs = 0;

  this.update();
};    

Game.prototype.sortAndRenderPlayers = function() {
  this.players.sort(Player.compare);
  var tableBody = document.getElementById('table-body');
  tableBody.innerHTML = '';
  for (var i = 0; i < this.players.length; ++i) {
    var player = this.players[i];
    player.render(tableBody);
  }
  this.sortDelayMs = 0;
  for (var i = 1; i < this.players.length; ++i) {
    if (this.players[i - 1].isPlaying() && !this.players[i].isPlaying()) {
      var delayMs = Player.comparePlayingTimeMs(this.players[i], this.players[i - 1]);
      this.sortDelayMs = Math.max(this.sortDelayMs, delayMs);
    }
  }
  if (this.sortDelayMs == 0) {
    this.sortDelayMs = Number.MAX_VALUE;
  }
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
  this.sortAndRenderPlayers();
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
    if (this.sortDelayMs == Number.MAX_VALUE) {
      this.writeStatus('no re-sort will occur');
    } else {
      this.sortDelayMs -= timeSinceLastUpdate;
      if (this.sortDelayMs <= 0) {
        this.writeStatus('resorting...');
        this.sortAndRenderPlayers();
      } else {
        this.writeStatus('next sort in ' + this.sortDelayMs / 1000 + ' sec');
      }
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

