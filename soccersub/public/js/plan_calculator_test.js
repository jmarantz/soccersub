goog.module('soccersub.PlanCalculatorTest');

const Assignment = goog.require('soccersub.Assignment2');
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

/** @return {!PlanCalculator} */
const makeInitialAssignments = (...players) => {
  const lineup = new Lineup(5, players);
  const calculator = new PlanCalculator(lineup, () => {}, TestUtil.consoleLog);
  assertEquals(players.length, calculator.updatePlayers());
  futsalTwoTwoFormation();
  calculator.setupPositions();
  calculator.reset();
  //calculator.makeInitialAssignments();
  calculator.makeInitialAssignments();
  return calculator;
};

/**
 * @param {Assignment} assignment
 * @return {string}
 */
const assignmentToString = (assignment) => {
  return util.formatTime(Math.max(0, assignment.timeSec * 1000)) + ' ' +
    assignment.positionName + '=' + assignment.playerName + 
    (assignment.executed ? ' (executed)' : ' (pending)');
};

const playerTimeToString = (playerTimeMap) => {
  let out = '';
  playerTimeMap.forEach((/** !PlanCalculator.PlayerTiming */ timing,
    /** string */ player) => {
    out += player + ': ' + JSON.stringify(timing) + '\n';
  });
  return out;
};

const assertAssignsEqual = (expectedAssignStrings, assigns) => {
  const assignStrings = assigns.map(assignmentToString);
  const minLength = Math.min(assignStrings.length, 
                             expectedAssignStrings.length);
  // If the arrays are the same length then it's nicer to compare string
  // by string and point out which ones are different.
  for (let i = 0; i < minLength; ++i) {
    if (expectedAssignStrings[i] != assignStrings[i]) {
      console.log('[' + i + '] EXPECTED: ' + expectedAssignStrings[i]
                  + ' ACTUAL: ' + assignStrings[i]);
    }
  }
  assertArrayEquals(expectedAssignStrings, assignStrings);
};

exports = {
  'getTestName': () => {
    return 'PlanCalculatorTest';
  },

  'testConstruction': () => {
    const lineup = new Lineup(5, ['jim', 'joe', 'fred', 'harvey', 'frank']);
    const calculator = new PlanCalculator(lineup, () => {}, 
                                          TestUtil.consoleLog);
    assertEquals(5, calculator.updatePlayers());
    assertEquals(0, calculator.updatePlayers());
  },

  'testPickInitial': () => {
    const lineup = new Lineup(5, ['jim', 'joe', 'fred', 'harvey', 'frank']);
    const calculator = new PlanCalculator(lineup, () => {}, 
                                          TestUtil.consoleLog);
    assertEquals(5, calculator.updatePlayers());
    assertArrayEquals(['jim', 'joe'], 
                      calculator.pickNextPlayers(['a', 'b'], null, new Set()));
  },

  'testComputeShiftTime': () => {
    const lineup = new Lineup(5, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']);
    futsalTwoTwoFormation();
    const calculator = new PlanCalculator(lineup, () => {}, TestUtil.consoleLog);
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
    const calculator = makeInitialAssignments(
      'jim', 'joe', 'fred', 'harvey', 'frank', 'bob');
    // This order corresponds to the configurations structure in lineup.js,
    // for a 5v5 game, as well as the order of the default player-set passed
    // in above to the lineup ctor.
    assertEquals('Left Forward', calculator.playerPosition('jim'));
    assertEquals('Right Forward', calculator.playerPosition('joe'));
    assertEquals('Left Back', calculator.playerPosition('fred'));
    assertEquals('Right Back', calculator.playerPosition('harvey'));
    assertEquals('Keeper', calculator.playerPosition('frank'));
    assertEquals(null, calculator.playerPosition('unknown'));
    const pinnedPlayers = new Set();
    assertArrayEquals(['bob'], calculator.pickNextPlayers(['a'], null, 
                                                          pinnedPlayers));
    assertArrayEquals([], calculator.pickNextPlayers([], null, pinnedPlayers));
  },

  'testComputePlan6': () => {
    const calculator = makeInitialAssignments(
      'jim', 'joe', 'fred', 'harvey', 'frank', 'bob');
    calculator.computePlan();
    const assigns = calculator.assignments().map(assignmentToString);
    assertArrayEquals([
      '0:00 Left Forward=jim (pending)',
      '0:00 Right Forward=joe (pending)',
      '0:00 Left Back=fred (pending)',
      '0:00 Right Back=harvey (pending)',
      '0:00 Keeper=frank (pending)',
      '4:48 Left Forward=bob (pending)',
      '9:36 Right Forward=jim (pending)',
      '14:24 Left Back=joe (pending)',
      '19:12 Right Back=fred (pending)',
      '24:00 Keeper=harvey (pending)',    // With 6 players, only keeper is subbed at half
      '28:48 Left Forward=frank (pending)',
      '33:36 Right Forward=bob (pending)',
      '38:24 Left Back=jim (pending)',
      '43:12 Right Back=joe (pending)',
    ], assigns);
  },

  'testComputePlan7': () => {
    const calculator = makeInitialAssignments(
      'jim', 'joe', 'fred', 'harvey', 'frank', 'bob', 'lance');
    calculator.computePlan();
    const assigns = calculator.assignments().map(assignmentToString);
    assertArrayEquals([
      '0:00 Left Forward=jim (pending)',
      '0:00 Right Forward=joe (pending)',
      '0:00 Left Back=fred (pending)',
      '0:00 Right Back=harvey (pending)',
      '0:00 Keeper=frank (pending)',
      '4:00 Left Forward=bob (pending)',
      '8:00 Right Forward=lance (pending)',
      '12:00 Left Back=jim (pending)',
      '16:00 Right Back=joe (pending)',
      '20:00 Left Forward=fred (pending)',
      '24:00 Keeper=harvey (pending)',
      '24:00 Right Forward=bob (pending)', // With 7, keeper + one other subbed at half
      '28:00 Left Back=frank (pending)',
      '32:00 Right Back=lance (pending)',
      '36:00 Left Forward=jim (pending)',
      '40:00 Right Forward=joe (pending)',
      '44:00 Left Back=fred (pending)',
    ], assigns);
  },

  'testExecute7OneSecondOff': () => {
    const calculator = makeInitialAssignments(
      'jim', 'joe', 'fred', 'harvey', 'frank', 'bob', 'lance');
    calculator.computePlan();
    const assignments = [calculator.makeAssignment('bob', 'Left Forward')];
    calculator.executeAssignments(assignments, 4*60 + 1);
    calculator.computePlan();
    const assigns = calculator.assignments().map(assignmentToString);
    assertArrayEquals([
      '0:00 Left Forward=jim (executed)',
      '0:00 Right Forward=joe (executed)',
      '0:00 Left Back=fred (executed)',
      '0:00 Right Back=harvey (executed)',
      '0:00 Keeper=frank (executed)',
      '4:01 Left Forward=bob (executed)',
      '8:00 Right Forward=lance (pending)',
      '12:00 Left Back=jim (pending)',
      '16:00 Right Back=joe (pending)',
      '20:00 Left Forward=fred (pending)',
      '24:00 Keeper=harvey (pending)',
      '24:00 Right Forward=bob (pending)', // With 7, keeper + one other subbed at half
      '28:00 Left Back=frank (pending)',
      '32:00 Right Back=lance (pending)',
      '36:00 Left Forward=jim (pending)',
      '40:00 Right Forward=joe (pending)',
      '44:00 Left Back=fred (pending)',
    ], assigns);
  },

  'testPinKeeper': () => {
    const calculator = makeInitialAssignments(
      'jim', 'joe', 'fred', 'harvey', 'frank', 'bob', 'lance');
    calculator.computePlan();
    calculator.pinPlayerPosition('jim', 'Keeper', 0, 0);
    
    assertAssignsEqual([
      '0:00 Left Forward=joe (pending)',
      '0:00 Right Forward=fred (pending)',
      '0:00 Left Back=harvey (pending)',
      '0:00 Right Back=frank (pending)',
      '0:00 Keeper=jim (pending)',
      '4:00 Left Forward=bob (pending)',
      '8:00 Right Forward=lance (pending)',
      '12:00 Left Back=joe (pending)',
      '16:00 Right Back=fred (pending)',
      '20:00 Left Forward=harvey (pending)',
      '24:00 Keeper=frank (pending)',
      '24:00 Right Forward=bob (pending)',
      '28:00 Left Back=jim (pending)',
      '32:00 Right Back=lance (pending)',
      '36:00 Left Forward=joe (pending)',
      '40:00 Right Forward=fred (pending)',
      '44:00 Left Back=harvey (pending)',
    ], calculator.assignments());
    assertEquals(
      'jim: {"percentInGame":-66.66666666666667,"benchTimeSec":-2400}\n' +
      'joe: {"percentInGame":50,"benchTimeSec":960}\n' +
      'fred: {"percentInGame":50,"benchTimeSec":960}\n' +
      'harvey: {"percentInGame":50,"benchTimeSec":960}\n' +
      'frank: {"percentInGame":66.66666666666667,"benchTimeSec":480}\n' +
      'bob: {"percentInGame":50,"benchTimeSec":-1920}\n' +
      'lance: {"percentInGame":50,"benchTimeSec":960}\n',
      playerTimeToString(
        calculator.computeGameTimingForAllPlayers()));
  },
};
