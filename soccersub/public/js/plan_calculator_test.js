goog.module('soccersub.PlanCalculatorTest');

const Lineup = goog.require('soccersub.Lineup');
const PlanCalculator = goog.require('soccersub.PlanCalculator');
const TestUtil = goog.require('soccersub.TestUtil');
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

  'testInitialAssignments': () => {
    const lineup = new Lineup(5, ['jim', 'joe', 'fred', 'harvey', 'frank']);
    const calculator = new PlanCalculator(lineup, () => {}, console.log);
    assertEquals(5, calculator.updatePlayers());
    TestUtil.touch('position:Keeper');
    TestUtil.touch('position:Left Back');
    TestUtil.touch('position:Right Back');
    TestUtil.touch('position:Left Forward');
    TestUtil.touch('position:Right Forward');
    calculator.setupPositions();
    calculator.makeInitialAssignments();
    assertEquals('Left Forward', calculator.playerPosition('jim'));
    assertEquals('Right Forward', calculator.playerPosition('joe'));
    assertEquals('Left Back', calculator.playerPosition('fred'));
    assertEquals('Right Back', calculator.playerPosition('harvey'));
    assertEquals('Keeper', calculator.playerPosition('frank'));
    assertEquals(null, calculator.playerPosition('unknown'));
  },

  'testGameTiming': () => {
    /*
    const lineup = new Lineup(5, ['jim', 'joe', 'fred', 'harvey', 'frank']);
    const calculator = new PlanCalculator(lineup, () => {}, console.log);
    */
  },
};
