#!/bin/bash
#
# This file processes a manifest generated from
#   $(CLOSURE_LIB)/closure/bin/build/closurebuilder.py \
#     --root=$(CLOSURE_LIB)/ \
#     --root=public/js \
#     --namespace="soccersubMain"
# finds the module in each JS file, and generates calls to
#    addDep(filename, module)
# That function is assumed to be defined already.

set -e
set -u

echo "(() => {"
echo "  const opts = {'module': 'goog', 'lang': 'es6'};"
echo "  const modules = [];"
echo "  const addDep = (file, module) => {"
echo "    modules.push(module);"
echo "    goog.addDependency('$PREFIX/js/' + file, [module], [], opts);"
echo "  };"
echo ""

for file in $(grep -v closure-library/); do
    module=$(grep goog.module "$file" | cut -f2 -d\')
    base=$(basename $file)
    echo "  addDep('$base', '$module');"
done

echo ""
echo "  return modules;"
echo "})().forEach(goog.require);"
