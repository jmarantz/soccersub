goog.module('soccersub.PlanCalculatorTest');

const Lineup = goog.require('soccersub.Lineup');
const PlanCalculator = goog.require('soccersub.PlanCalculator');
const TestUtil = goog.require('soccersub.TestUtil');
const util = goog.require('soccersub.util');

const futsalTwoTwoFormation = () => {
  TestUtil.touch('position:Keeper');
  TestUtil.touch('position:Left Back');
  TestUtil.touch('position:Right Back');
  TestUtil.touch('position:Left Forward');
  TestUtil.touch('position:Right Forward');
};

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
    assertArrayEquals(['jim', 'joe'], calculator.pickNextPlayers(2));
  },

  'testComputeShiftTime': () => {
    const lineup = new Lineup(5, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']);
    futsalTwoTwoFormation();
    const calculator = new PlanCalculator(lineup, () => {}, console.log);
    calculator.setupPositions();
    assertEquals(9, calculator.updatePlayers());

    // With 9 players, 1 in goal leaves 8 players for 4 positions.  So we can
    // rotate everyone through with 3 minutes shifts.
    assertEquals(3 * 60, calculator.shiftTimeSec());

    // But if we remove a player, the shifts are around 3 minutes 25 seconds,
    // +/- a second.
    TestUtil.touch('player:b'); // makes player b sick.
    assertEquals(-1, calculator.updatePlayers());
    assertRoughlyEquals(3 * 60 + 25, calculator.shiftTimeSec(), 1.0);

    // TODO(jmarantz): test what happens if players arrive/depart after the game
    // has started.  This will surely not work, so make it so.
  },


  'testInitialAssignments': () => {
    const lineup = new Lineup(5, ['jim', 'joe', 'fred', 'harvey', 'frank']);
    const calculator = new PlanCalculator(lineup, () => {}, console.log);
    assertEquals(5, calculator.updatePlayers());
    futsalTwoTwoFormation();
    calculator.setupPositions();
    calculator.makeInitialAssignments();
    // This order corresponds to the configurations structure in lineup.js,
    // for a 5v5 game, as well as the order of the default player-set passed
    // in above to the lineup ctor.
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
