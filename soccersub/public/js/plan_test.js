/**
 * @fileoverview Test for plan.js.
 */

goog.module('soccersub.PlanTest');

const Lineup = goog.require('soccersub.Lineup');
const Plan = goog.require('soccersub.Plan');
const TestUtil = goog.require('soccersub.TestUtil');

exports = {
  'getTestName': () => {
    return 'PlanTest';
  },

  'testFreshenPlayers': () => {
    const lineup = new Lineup(5, ['a', 'b', 'c', 'd']);
    const plan = new Plan(lineup, () => {}, console.log);
    plan.reset();
  },
};
