(() => {
  const opts = {'module': 'goog', 'lang': 'es6'};
  const modules = [];
  const addDep = (file, module) => {
    modules.push(module);
    goog.addDependency('../../../js/' + file, [module], [], opts);
  };

  addDep('util.js', 'soccersub.util');
  addDep('lineup.js', 'soccersub.Lineup');
  addDep('drag.js', 'soccersub.Drag');
  addDep('assignment.js', 'soccersub.Assignment');
  addDep('plan.js', 'soccersub.Plan');
  addDep('position.js', 'soccersub.Position');
  addDep('player.js', 'soccersub.Player');
  addDep('map_section.js', 'soccersub.MapSection');
  addDep('array_section.js', 'soccersub.ArraySection');
  addDep('storage.js', 'soccersub.Storage');
  addDep('game.js', 'soccersub.Game');
  addDep('soccersub.js', 'soccersub.SoccerSub');
  addDep('main.js', 'soccersubMain');

  for (const [file, module] of window.testDeps || []) {
    addDep(file, module);
  }

  return modules;
})().forEach(goog.require);
