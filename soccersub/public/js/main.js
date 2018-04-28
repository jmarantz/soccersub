goog.module('soccersubMain');

const SoccerSub = goog.require('soccersub.SoccerSub');
const Lineup = goog.require('soccersub.Lineup');

var famousPlayerNames = [
  'Messi',
  'Ronaldo',
  'Pelé',
  'Chinaglia',
  'Beckenbauer',
  'Marcelo',
  'Ronaldino',
  'Willian',
  'Rooney',
  'Kane',
  'Pogba',
];

var defaultPlayerNames = famousPlayerNames;

const soccersubMain = () => {
  const lineup = new Lineup(5, defaultPlayerNames);
  new SoccerSub(lineup);
};
goog.exportSymbol('soccersubMain', soccersubMain);
window['soccersubMain'] = soccersubMain;
