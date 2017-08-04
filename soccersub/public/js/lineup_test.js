/**
 * @fileoverview Test for lineup.js.
 */

goog.module('soccersub.Lineup_test');
goog.setTestOnly('soccersub.Lineup_test');

const Lineup = goog.require('soccersub.Lineup');
goog.require('goog.testing.jsunit');
goog.require('goog.testing.TestCase');

function testPositions() {
  const lineup = new Lineup([], []);
  const positionText = ['a, b', 'c, d, e', 'f, g', 'h'].join('\n')
  lineup.setPositionsFromText(positionText);
  assertArrayEquals([['a', 'b'], ['c', 'd', 'e'], ['f', 'g'], ['h']],
                    lineup.positionNames);

  assertEquals(positionText, lineup.getPositionsAsText());
}

function testPlayers() {
  const lineup = new Lineup([], []);
  const playerText = ['a', 'b', '#c', 'd'].join('\n');
  lineup.setPlayersFromText(playerText)
  assertArrayEquals(['a', 'b', 'd'], lineup.playerNames);
  assertArrayEquals(['c'], lineup.unavailablePlayerNames);
  // The unavailable players are moved to the end when rendering
  // as text, so we can't compare against the exact input text.
  assertEquals(['a', 'b', 'd'].join('\n') + '\n#c', lineup.getPlayersAsText());
}

window.onload = () => {
  const testCase = new goog.testing.TestCase('lineup_test');
  testCase.addNewTest('testLineup', testPositions);
  testCase.addNewTest('testPlayers', testPlayers);
  goog.testing.TestCase.initializeTestRunner(testCase);
};
