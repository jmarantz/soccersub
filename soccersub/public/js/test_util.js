goog.module('soccersub.TestUtil');

const testSuite = goog.require('goog.testing.testSuite');
const util = goog.require('soccersub.util');

let currentSuite = null;
const setUpMap = new Map();
const tearDownMap = new Map();

let buttonFunctionMap;
util.addHandleTouchHook((element, func, label) => {
  buttonFunctionMap.set(label, func);
});

exports.touch = (label) => {
  const func = buttonFunctionMap.get(label);
  assertTrue('No touch handler for ' + label, !!func);
  func();
};

const mergedTests = {
  'getTestName': () => {
    return 'SoccersubTest';
  },
  
  'setUp': () => {
    buttonFunctionMap = new Map();
  },

  'tearDown': () => {
    buttonFunctionMap = null;
  },
};

exports.addTestSuite = (suite) => {
  let suiteName = null;
  for (const testName of Object.keys(suite)) {
    const fn = suite[testName];
    if (testName == 'getTestName') {
      suiteName = fn();
      if (suiteName.endsWith('Test')) {
        suiteName = suiteName.substring(0, suiteName.length - 4);
      }
    } else {
      if (!suiteName) {
        console.log('getTestName must be called first');
        suiteName = '???';
      }
      if (testName == 'setUp') {
        setUpMap.set(suiteName, fn);
      } else if (testName == 'tearDown') {
        tearDownMap.set(suiteName, fn);
      } else if (testName.startsWith('test')) {
        mergedTests['test' + suiteName + testName.substring(4)] = fn;
      } else {
        console.log(suiteName + ': unexpected method: ' + testName);
      }
    }
  }
};

exports.runTestSuite = () => {
  testSuite(mergedTests);
};
