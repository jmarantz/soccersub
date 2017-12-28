/**
 * @fileoverview Test for lineup.js.
 */

goog.module('soccersub.Lineup_test');
goog.setTestOnly('soccersub.Lineup_test');

const Lineup = goog.require('soccersub.Lineup');
goog.require('goog.testing.jsunit');
goog.require('goog.testing.TestCase');

function testConstruction() {
  const lineup = new Lineup(5, ['jim', 'joe', 'fred', 'harvey', 'frank']);
  assertTrue(lineup.playerNames.has('jim'));
}

window.onload = () => {
  const testCase = new goog.testing.TestCase('lineup_test');
  testCase.addNewTest('testConstruction', testConstruction);
  goog.testing.TestCase.initializeTestRunner(testCase);
};
