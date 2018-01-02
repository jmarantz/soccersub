goog.module('soccersub.UtilTest');

const util = goog.require('soccersub.util');

/**
 * Checks to see whether arr has its top n elements in priority
 * order, and that there are no duplicates in the array.
 *
 * @template T
 * @param {!Array<T>} arr
 * @param {number} n
 * @param {!function(T):number} getPriority
 */
const sanityCheck = (arr, n, getPriority) => {
  const checker = new Set();
  for (let i = 0; i < arr.length; ++i) {
    const value = arr[i];
    if ((i < n) && (i > 0)) {
      assertTrue(getPriority(arr[i - 1]) > getPriority(value));
    }
    if (checker.has(value)) {
      debugger;
    }
    assertFalse('i=' + i, checker.has(value));
    checker.add(value);
  }
};

class IntWrapper {
  constructor(i) {
    this.i = i;
  }
}

exports = {
  'getTestName': () => {
    return 'UtilTest';
  },

  'testSortTopN': () => {
    const arr = [5, 9, 3, 4, 1, 2];
    util.sortTopN(arr, 3, (n) => n);

    // Top elements should be sorted.
    assertArrayEquals([9, 5, 4], arr.slice(0, 3));

    // It doesn't matter what order remaining elements are, but they need
    // to be present.
    assertArrayEquals([1, 2, 3], arr.slice(3, 6).sort());
  },

  'testChainedEviction': () => {
    // This testcase is meant to trigger a corner-case which broke an earlier
    // version of the topN algorithm, where we weren't properly finding a new
    // home for the '3' entry, because the '10' that replaced it was coming
    // from within the topN.
    const arr = [10, 3, 11, 9, 4, 5];
    util.sortTopN(arr, 3, (n) => n);

    // Top elements should be sorted.
    assertArrayEquals([11, 10, 9], arr.slice(0, 3));

    // It doesn't matter what order remaining elements are, but they need
    // to be present.
    assertArrayEquals([3, 4, 5], arr.slice(3, 6).sort());
  },

  'testSequential': () =>  {
    /** @type {!Array<!IntWrapper>} */
    const arr = [];
    for (let i = 0; i < 100; ++i) {
      arr.push(new IntWrapper(i));
    }
    util.sortTopN(arr, 5, (iw) => iw.i);
    sanityCheck(arr, 5, (iw) => iw.i);
  },

  'testRandom': () => {
    /** @type {!Array<!IntWrapper>} */
    const arr = [];
    for (let i = 0; i < 1000; ++i) {
      arr.push(new IntWrapper(Math.random()));
    }
    util.sortTopN(arr, 100, (iw) => iw.i);
    sanityCheck(arr, 100, (iw) => iw.i);
  },
};
