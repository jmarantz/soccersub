/**
 * @fileoverview Test for lineup.js.
 */

goog.module('soccersub.Lineup_test');
goog.setTestOnly('soccersub.Lineup_test');

const Lineup = goog.require('soccersub.Lineup');
const testSuite = goog.require('goog.testing.testSuite');

testSuite({
  testConstruction() {
    const lineup = new Lineup(5, ['jim', 'joe', 'fred', 'harvey', 'frank']);
    assertTrue(lineup.playerNames.has('jim'));
  },
});
