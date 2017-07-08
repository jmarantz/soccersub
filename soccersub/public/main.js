var cosmosPlayerNames = [
  'ander',
  'andrew',
  'dylan',
  'fredrik',
  'jonas',
  'josh',
  'kenneth',
  'ryan',
  'spencer',
  'tommy',
  'will',
];

var bencosnersPlayerNames = [
  'ryan',
  'ellis',
  'fredrik',
  'teddy',
  'will',
  'brandon',
  'elias',
  'owen',
  'hunter',
  'luca',
  'tommy',
  'josh'
];

var chscPlayerNames = [
  'Elizabeth F',
  'Gwyneth M',
  'Hannah K',
  'Hannah S',
  'India S',
  'Kaesha M',
  'Magdalena G',
  'Netta',
  'Rossella G',
  'Sarah S',
  'Sophia F',
  'Sophie N'
];

var santosRedPlayerNames = [
  'Levi',
  'Eli G',
  'Jeremy',
  'Griffen',
  'Ethan',
  'Declan',
  'Eli T',
  'Dante',
  'Goalie'
];

//var defaultPlayerNames = santosRedPlayerNames;
//var defaultPlayerNames = bencosnersPlayerNames;
//var defaultPlayerNames = chscPlayerNames;
var defaultPlayerNames = cosmosPlayerNames;

var defaultPositionNames = [
  'keeper',
  'left_back',
  'right_back',
  'left_mid',
  'center_mid',
  'right_mid',
  'striker',
];

var game;
window.onload = function() {
  game = new Game(defaultPositionNames, defaultPlayerNames);
};
