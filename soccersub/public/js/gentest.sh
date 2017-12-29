#!/bin/bash

echo "goog.module('soccersubTest');"

for module in $*; do
    echo const $module = goog.require('soccersub.$module');
done

echo ""
echo "const soccersubTest = () => {"

for module in $*; do
    echo console.log('$module = goog.require('$module');
done

echo  console.log('tests: ' + LineupTest);
};
goog.exportSymbol('soccersubTest', soccersubTest);
