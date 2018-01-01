// This file is auto-generated by ./gentest.sh -- do not edit.
goog.module('soccersubTest');
goog.setTestOnly('soccersubTest');

const TestUtil = goog.require('soccersub.TestUtil');

const LineupTest = goog.require('soccersub.LineupTest');
const PlanCalculatorTest = goog.require('soccersub.PlanCalculatorTest');
const PlanTest = goog.require('soccersub.PlanTest');
const StorageTest = goog.require('soccersub.StorageTest');
const UtilTest = goog.require('soccersub.UtilTest');

const soccersubTest = () => {
  TestUtil.addTestSuite(LineupTest);
  TestUtil.addTestSuite(PlanCalculatorTest);
  TestUtil.addTestSuite(PlanTest);
  TestUtil.addTestSuite(StorageTest);
  TestUtil.addTestSuite(UtilTest);
  TestUtil.runTestSuite();
}

goog.exportSymbol('soccersubTest', soccersubTest);
