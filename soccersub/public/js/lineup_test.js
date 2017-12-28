/**
 * @fileoverview Test for lineup.js.
 */

goog.module('soccersub.Lineup_test');
goog.setTestOnly('soccersub.Lineup_test');

const Lineup = goog.require('soccersub.Lineup');
const util = goog.require('soccersub.util');
const testSuite = goog.require('goog.testing.testSuite');

let buttonFunctionMap;
const utilHandleTouch = util.handleTouch;
util.handleTouch = (element, func, label) => {
  buttonFunctionMap.set(label, func);
};
const touch = (label) => {
  const func = buttonFunctionMap.get(label);
  assertNotNull('No touch handler for ' + label, func);
  func();
};

testSuite({
  getTestName() {
    return 'LineupTest';
  },

  setUp() {
    buttonFunctionMap = new Map();
  },

  tearDown() {
    buttonFunctionMap = null;
  },

  testAddPlayers() {
    const lineup = new Lineup(5, ['jim', 'joe', 'fred', 'harvey', 'frank']);
    assertTrue(lineup.playerNames.has('jim'));
    assertFalse(lineup.playerNames.has('carol'));
    lineup.addPlayers('bob\n carol  \n ted\nalice');
    assertTrue(lineup.playerNames.has('carol'));
    assertTrue(lineup.playerNames.has('alice'));
  },

  testRotatePlayerState() {
    const lineup = new Lineup(5, ['jim', 'joe', 'fred', 'harvey', 'frank']);

    // Rotate fred through his three states, bringing him back into the roster.
    assertTrue(lineup.playerNames.has('fred'));
    assertFalse(lineup.unavailablePlayerNames.has('fred'));
    touch('player:fred');
    assertFalse(lineup.playerNames.has('fred'));
    assertTrue(lineup.unavailablePlayerNames.has('fred'));
    touch('player:fred');
    assertFalse(lineup.playerNames.has('fred'));
    assertFalse(lineup.unavailablePlayerNames.has('fred'));
    touch('player:fred');
    assertTrue(lineup.playerNames.has('fred'));
    assertFalse(lineup.unavailablePlayerNames.has('fred'));
  },
});
