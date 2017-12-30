goog.module('soccersub.Lineup_test');
/*goog.setTestOnly('soccersub.Lineup_test');*/

const Lineup = goog.require('soccersub.Lineup');
const TestUtil = goog.require('soccersub.TestUtil');

exports = {
  'getTestName': () => {
    return 'LineupTest';
  },

  'testAddPlayers': () => {
    const lineup = new Lineup(5, ['jim', 'joe', 'fred', 'harvey', 'frank']);
    assertTrue(lineup.playerNames.has('jim'));
    assertFalse(lineup.playerNames.has('carol'));
    lineup.addPlayers('bob\n carol  \n ted\nalice');
    assertTrue(lineup.playerNames.has('carol'));
    assertTrue(lineup.playerNames.has('alice'));
  },

  'testRotatePlayerState': () => {
    const lineup = new Lineup(5, ['jim', 'joe', 'fred', 'harvey', 'frank']);

    // Rotate fred through his three states, bringing him back into the roster.
    assertTrue(lineup.playerNames.has('fred'));
    assertFalse(lineup.unavailablePlayerNames.has('fred'));
    TestUtil.touch('player:fred');
    assertFalse(lineup.playerNames.has('fred'));
    assertTrue(lineup.unavailablePlayerNames.has('fred'));
    TestUtil.touch('player:fred');
    assertFalse(lineup.playerNames.has('fred'));
    assertFalse(lineup.unavailablePlayerNames.has('fred'));
    TestUtil.touch('player:fred');
    assertTrue(lineup.playerNames.has('fred'));
    assertFalse(lineup.unavailablePlayerNames.has('fred'));
  },
};
