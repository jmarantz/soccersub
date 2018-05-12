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

/** @param {function(string, string, Object):void} gtag */
const soccersubMain = (gtag) => {
  const lineup = new Lineup(5, defaultPlayerNames);
  new SoccerSub(lineup, gtag);
};
goog.exportSymbol('soccersubMain', soccersubMain);
window['soccersubMain'] = soccersubMain;
