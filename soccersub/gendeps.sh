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

# grep -v closure-library/

for file in $(grep -v /base.js); do
    if [[ "$file" == */closure-library/* ]]; then
      # Just add the require statement, without setting up the path.
      module=$(grep ^goog.provide "$file" | head -1 | cut -f2 -d\')
      if [ -z "$module" ]; then
        module=$(grep ^goog.module "$file" | head -1 | cut -f2 -d\')
      fi
      if [ -z "$module" ]; then
        echo "// Cannot find module for file: " $file
      else
        echo "  modules.push('$module');"
      fi
    else
      module=$(grep goog.module "$file" | cut -f2 -d\')
      base=$(basename $file)
      echo "  addDep('$base', '$module');"
    fi
done
echo ""
echo "  for (const [file, module] of window.testDeps || []) {"
echo "    addDep(file, module);"
echo "  }"
echo ""
echo "  return modules;"
echo "})().forEach(goog.require);"
