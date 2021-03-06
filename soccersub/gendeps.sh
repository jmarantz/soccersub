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

main="$1"
deps_jsfile="$2"
deps_makefile="$3"
deps_makefile_var="$4"

rm -f "$deps_jsfile"
rm -f "$deps_makefile"

CLOSURE_LIB="$HOME/dev/closure-library"
CLOSURE_VERSION=v20171112
COMPILER_JAR="$HOME/bin/closure-compiler-$CLOSURE_VERSION.jar"
PREFIX="../../.."
BUILD="$CLOSURE_LIB/closure/bin/build/closurebuilder.py"

echo "$BUILD" --namespace="$main" --root="$CLOSURE_LIB/" --root=public/js
deps=$("$BUILD" --namespace="$main" --root="$CLOSURE_LIB/" --root=public/js)

echo "// This file is auto-generated by $0 -- do not edit."    >> "$deps_jsfile"
echo "(() => {"                                                >> "$deps_jsfile"
echo "  const opts = {'module': 'goog', 'lang': 'es6'};"       >> "$deps_jsfile"
echo "  const modules = [];"                                   >> "$deps_jsfile"
echo "  const addDep = (file, module) => {"                    >> "$deps_jsfile"
echo "    modules.push(module);"                               >> "$deps_jsfile"
echo "    goog.addDependency('$PREFIX/js/' + file, [module], [], opts);" >> "$deps_jsfile"
echo "  };"                                                    >> "$deps_jsfile"
echo ""                                                        >> "$deps_jsfile"

# grep -v closure-library/

for file in $(echo "$deps" | grep -v /base.js); do
    if [[ "$file" == */closure-library/* ]]; then
      # Just add the require statement, without setting up the path.
      module=$(grep ^goog.provide "$file" | head -1 | cut -f2 -d\')
      if [ -z "$module" ]; then
        module=$(grep ^goog.module "$file" | head -1 | cut -f2 -d\')
      fi
      if [ -z "$module" ]; then
        echo "// Cannot find module for file: " $file          >> "$deps_jsfile"
      else
        echo "  modules.push('$module');"                      >> "$deps_jsfile"
      fi
    else
      module=$(grep goog.module "$file" | cut -f2 -d\')
      base=$(basename $file)
      echo "  addDep('$base', '$module');" >> "$deps_jsfile"   >> "$deps_jsfile"
    fi
done
echo ""                                                        >> "$deps_jsfile"
echo "  for (const [file, module] of window.testDeps || []) {" >> "$deps_jsfile"
echo "    addDep(file, module);"                               >> "$deps_jsfile"
echo "  }"                                                     >> "$deps_jsfile"
echo ""                                                        >> "$deps_jsfile"
echo "  return modules;"                                       >> "$deps_jsfile"
echo "})().forEach(goog.require);"                             >> "$deps_jsfile"

echo "$deps_makefile_var = \\"                                > "$deps_makefile"
for file in $(echo "$deps" | grep -v /closure-library/); do
    echo "    $file \\"                                      >> "$deps_makefile"
done

