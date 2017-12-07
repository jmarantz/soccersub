/**
 * @fileoverview Test for plan.js.
 */

goog.module('soccersub.Plan_test');
goog.setTestOnly('soccersub.Plan_test');

const Lineup = goog.require('soccersub.Lineup');
const Plan = goog.require('soccersub.Plan');
goog.require('goog.testing.jsunit');
goog.require('goog.testing.TestCase');

function testFreshen() {
  const lineup = new Lineup(
    5, ["Sue", "Fredrick", "Will", "George", "tommy", "Fred", "Ao"]);
  const plan = new Plan(lineup, () => {});
}

function testPlayers() {
  const plan = new Plan([], []);
  const playerText = ['a', 'b', '#c', 'd'].join('\n');
  plan.setPlayersFromText(playerText)
  assertArrayEquals(['a', 'b', 'd'], plan.playerNames);
  assertArrayEquals(['c'], plan.unavailablePlayerNames);
  // The unavailable players are moved to the end when rendering
  // as text, so we can't compare against the exact input text.
  assertEquals(['a', 'b', 'd'].join('\n') + '\n#c', plan.getPlayersAsText());
}

window.onload = () => {
  const testCase = new goog.testing.TestCase('plan_test');
  testCase.addNewTest('testPlan', testPositions);
  testCase.addNewTest('testPlayers', testPlayers);
  goog.testing.TestCase.initializeTestRunner(testCase);
};
