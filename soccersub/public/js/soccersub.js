goog.module('soccersub.SoccerSub');
const Dialog = goog.require('goog.ui.Dialog');
const googDom = goog.require('goog.dom');
const Game = goog.require('soccersub.Game');
const Lineup = goog.require('soccersub.Lineup');
const Player = goog.require('soccersub.Player');
const Position = goog.require('soccersub.Position');
const Storage = goog.require('soccersub.Storage');
const util = goog.require('soccersub.util');

let deployTimestamp = window['deployTimestamp'] || 'dev';

/**
 * Overall state of the SoccerSub app, managing game state, positions,
 * roster, and the log.
 */
class SoccerSub {
  /**
   * @param {!Lineup} lineup
   */
  constructor(lineup) {
    /** @type {!Element} */
    this.statusBar = goog.dom.getRequiredElement('status_bar');

    this.game = new Game(lineup, (text) => this.writeStatus(text),
                         (text) => this.log(text));
    goog.dom.getRequiredElement('game_version').textContent = deployTimestamp;

    /** @private {!Array<!Element>} */
    this.panels_ = [
      this.game.gameDiv,
      goog.dom.getRequiredElement('log-panel'),
      goog.dom.getRequiredElement('positions-panel'),
      goog.dom.getRequiredElement('roster-panel'),
    ];
    this.logText = goog.dom.getRequiredElement('log-text');
    this.started = false;

    util.setupButton('show-game', () => this.showGame_());
    util.setupButton('show-roster', () => this.showPanel_('roster'));
    util.setupButton('show-positions', () => this.showPanel_('positions'));
    util.setupButton('show-log', () => this.showLog_());
    
    /** @type {!Lineup} */
    this.lineup = lineup;
    /** @type {string} */
    this.log_ = '';

    this.game.constructPlayersAndPositions();
    if (!this.game.restore()) {
      this.game.reset();
    }
  }

  nsave() {
    //this.storage.saveToLocalStorage();
  }

  /** 
    * @private
    * @param {string} name
    */
  showPanel_(name) {
    const panelId = name + '-panel';
    for (const panel of this.panels_) {
      panel.style.display = (panel.id == panelId) ? 'block' : 'none';
    }
    // Get all elements with class="tablinks" and remove the class "active"
    for (const tablink of document.getElementsByClassName('tablinks')) {
      tablink.className = tablink.className.replace(' active', '');
    }
    const buttonId = 'show-' + name;
    goog.dom.getRequiredElement(buttonId).className += ' active';
  }

  /** @private */
  showLog_() {
    this.showPanel_('log');
    window.scrollTo(0, document.body.scrollHeight);
  }

  /** @private */
  showGame_() {
    if (this.lineup.modified) {
      this.game.save();
      this.game.constructPlayersAndPositions();
      this.game.restore();
    }
    this.showPanel_('game');
  }

  log(text) {
    const msg = util.formatTime(this.game.elapsedTimeMs) + ': ' + text + '\n';
    //this.log_ += msg;
    this.logText.textContent += msg;
    this.writeStatus(msg);
  }

  /**
   * @param {string} text
   */
  writeStatus(text) {
    this.statusBar.textContent = text;
    //this.statusBarWriteMs = currentTimeMs();
  }
}

exports = SoccerSub;
