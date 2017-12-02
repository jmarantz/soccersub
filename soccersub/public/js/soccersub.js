goog.module('soccersub.SoccerSub');
const Dialog = goog.require('goog.ui.Dialog');
const googDom = goog.require('goog.dom');
const Game = goog.require('soccersub.Game');
const Lineup = goog.require('soccersub.Lineup');
const Plan = goog.require('soccersub.Plan');
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

    const saver = () => this.save();
    this.game = new Game(lineup, (text) => this.writeStatus(text),
                         (text) => this.log(text), saver);
    setTimeout(SoccerSub.clearVersionDisplay, 2000);
    
    /** @private {!Array<!Element>} */
    this.panels_ = [
      this.game.gameDiv,
      goog.dom.getRequiredElement('log-panel'),
      goog.dom.getRequiredElement('positions-panel'),
      goog.dom.getRequiredElement('roster-panel'),
      goog.dom.getRequiredElement('plan-panel'),
    ];
    this.logText = goog.dom.getRequiredElement('log-text');
    this.started = false;

    util.setupButton('show-game', () => this.showPanel_('game'));
    util.setupButton('show-roster', () => this.showPanel_('roster'));
    util.setupButton('show-positions', () => this.showPanel_('positions'));
    util.setupButton('show-log', () => this.showLog_());
    util.setupButton('show-plan', () => this.showPanel_('plan'));
    
    /** @type {!Lineup} */
    this.lineup = lineup;
    /** @type {string} */
    this.log_ = '';
    /** @type {!Plan} */
  this.plan_ = new Plan(lineup, saver);

    this.game.constructPlayersAndPositions();
    if (!this.restore()) {
      this.game.reset();
      this.plan_.reset();
      this.plan_.render();
    }
  }

  nsave() {
    //this.storage.saveToLocalStorage();
  }

  static clearVersionDisplay() {
    const version = goog.dom.getRequiredElement('soccersub-version');
    version.style.display = 'none';
  }

  /** 
    * @private
    * @param {string} name
    */
  showPanel_(name) {
    if (this.lineup.modified) {
      // This little dance with save/construct/restore is needed to
      // keep assignment continuity across change in roster or
      // position. However we don't have to persist this -- we can
      // just use a temp map.  Then we save everything fully including
      // a revised plan below.
      const map = {};
      this.game.save(map);
      this.game.constructPlayersAndPositions();
      this.game.restore(map);
      this.plan_.render();
      this.save();
    }

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

  save() {
    var map = {};
    this.game.save(map);
    this.plan_.save(map);
    window.localStorage['game'] = JSON.stringify(map);
  }

  /**
   * @return {boolean}
   */
  restore() {
    if (!util.storageAvailable('localStorage')) {
      this.log('restore failed: local storage not available');
      return false;
    }

    try {
      var storedGame = window.localStorage['game'];
      if (!storedGame) {
        this.log('restore failed: no "game" entry in localStorage');
        return false;
      }
      var map = /** @type {!Object} */ (JSON.parse(storedGame));
      return this.game.restore(map) && this.plan_.restore(map);
    } catch (err) {
      this.log('restore failed: exception caught: ' + err);
    }
    return false;
  }
}

exports = SoccerSub;
