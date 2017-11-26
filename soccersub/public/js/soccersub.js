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

    this.game = new Game(lineup, (text) => this.log(text), 
                         (text) => this.writeStatus(text));
    goog.dom.getRequiredElement('game_version').textContent = deployTimestamp;

    /** @private {!Array<!Element>} */
    this.panels_ = [
      this.game.gameDiv,
      goog.dom.getRequiredElement('log'),
      goog.dom.getRequiredElement('positions-panel'),
      goog.dom.getRequiredElement('players-panel'),
    ];
    this.logText = goog.dom.getRequiredElement('log-text');
    this.started = false;

    util.setupButton('show-game1', () => this.showPanel_('game'));
    util.setupButton('show-game2', () => this.resetLineupAndShowGame_());
    util.setupButton('show-game3', () => this.resetLineupAndShowGame_());
    util.setupButton('adjust-roster', () => this.showPanel_('players-panel'));
    util.setupButton('adjust-positions',
                     () => this.showPanel_('positions-panel'));
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
    * @param {string} id
    */
  showPanel_(id) {
    for (const panel of this.panels_) {
      panel.style.display = (panel.id == id) ? 'block' : 'none';
    }
  }

  /** @private */
  showLog_() {
    this.showPanel_('log');
    window.scrollTo(0, document.body.scrollHeight);
  }

  /** @private */
  resetLineupAndShowGame_() {
    this.game.save();
    this.game.constructPlayersAndPositions();
    this.game.restore();
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
