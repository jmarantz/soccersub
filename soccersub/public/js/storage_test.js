/**
 * @fileoverview Test for storage.js.
 */

goog.module('soccersub.Storage_test');
goog.setTestOnly('soccersub.Storage_test');

const Storage = goog.require('soccersub.Storage');
goog.require('goog.testing.jsunit');
goog.require('goog.testing.TestCase');

function testMapLocalStorage() {
  const storage = new Storage('storagetest');
  const section = storage.addMapSection('mapSection');
  let foo = 10;
  section.addValue('foo', () => foo, (v) => foo = v);
  let bar = 15;
  section.addValue('bar', () => bar, (v) => bar = v);
  storage.saveToLocalStorage();

  foo = 0;
  bar = 0;
  
  storage.restoreFromLocalStorage();
  assertEquals(10, foo);
  assertEquals(15, bar);
}

function testArrayLocalStorage() {
  const storage = new Storage('storagetest');
  const section = storage.addArraySection('arraySection');
  section.addColumn('foo', (m) => m['foo'], (m, v) => m['foo'] = v);
  section.addColumn('bar', (m) => m['bar'], (m, v) => m['bar'] = v);

  let a = {'foo': 1, 'bar': 2};
  section.addInstance('a', a);
  let b = {'foo': 3, 'bar': 7};
  section.addInstance('b', b);

  storage.saveToLocalStorage();

  a['foo'] = 0;
  a['bar'] = 0;
  b['foo'] = 0;
  b['bar'] = 0;

  storage.restoreFromLocalStorage();

  assertObjectEquals({'foo': 1, 'bar': 2}, a);
  assertObjectEquals({'foo': 3, 'bar': 7}, b);
}

window.onload = () => {
  const testCase = new goog.testing.TestCase('storage_test');
  testCase.addNewTest('testMapLocalStorage', 
                      testMapLocalStorage);
  testCase.addNewTest('testArrayLocalStorage', 
                      testArrayLocalStorage);
  goog.testing.TestCase.initializeTestRunner(testCase);
};
