goog.module('soccersub.PlanCalculatorTest');

const Lineup = goog.require('soccersub.Lineup');
const PlanCalculator = goog.require('soccersub.PlanCalculator');
const util = goog.require('soccersub.util');

exports = {
  'getTestName': () => {
    return 'PlanCalculatorTest';
  },

  'testConstruction': () => {
    const lineup = new Lineup(5, ['jim', 'joe', 'fred', 'harvey', 'frank']);
    const calculator = new PlanCalculator(lineup, () => {}, console.log);
    assertEquals(5, calculator.updatePlayers());
    assertEquals(0, calculator.updatePlayers());
  },

  'testPickInitial': () => {
    const lineup = new Lineup(5, ['jim', 'joe', 'fred', 'harvey', 'frank']);
    const calculator = new PlanCalculator(lineup, () => {}, console.log);
    assertEquals(5, calculator.updatePlayers());
    assertEquals('jim', calculator.pickNextPlayer());  // FIFO to start, not abc.
  },

  'testGameTiming': () => {
    const lineup = new Lineup(5, ['jim', 'joe', 'fred', 'harvey', 'frank']);
    const calculator = new PlanCalculator(lineup, () => {}, console.log);
  },
};
