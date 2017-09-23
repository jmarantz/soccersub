# Tools needed:
#   closure compiler: https://dl.google.com/closure-compiler/compiler-latest.zip
#   java runtime: sudo apt-get install jvm-7-avian-jre
#   node.js
#   npm
#   firebase

export PATH := /usr/local/bin:$(PATH)
COMPILER_JAR = $(HOME)/bin/closure-compiler-v20161024.jar
CLOSURE_LIB = $(HOME)/dev/closure-library
BUILD = $(CLOSURE_LIB)/closure/bin/build/closurebuilder.py \
	  --root=$(CLOSURE_LIB)/ \
	  --root=public/js \
	  --namespace="soccersubMain"

deploy : deploy.timestamp
xcompile : public/soccersub.min.js

.PHONY: deploy compile jsopts

JSFILES = public/js/game.js public/js/position.js public/js/player.js \
	public/js/main.js public/js/util.js public/js/lineup.js \
	public/js/storage.js public/js/array_section.js public/js/map_section.js

jsopts : $(JSFILES) Makefile
	java -jar $(HOME)/bin/closure-compiler-v20161024.jar --help


deps :
	$(BUILD) | \
		grep -v closure-library/ | \
		sed -e s@public/@@g | \
		awk '{print "goog.loadModuleFromUrl(\"" $$1 "\");"}' \
		> public/loader.js

compile: public/soccersub.min.js
public/soccersub.min.js : $(JSFILES) Makefile
	$(BUILD) \
	  --compiler_jar=$(COMPILER_JAR) \
	  --compiler_flags="--compilation_level=ADVANCED_OPTIMIZATIONS" \
	  --output_mode=compiled \
	  --compiler_flags="--warning_level=VERBOSE" \
	  > $@

public/xxsoccersub.min.js : $(JSFILES) Makefile
	java -jar $(HOME)/bin/closure-compiler-v20161024.jar \
		--process_closure_primitives \
		--dependency_mode=LOOSE \
		--output_manifest=outfiles.list \
		--compilation_level=ADVANCED_OPTIMIZATIONS \
		--warning_level=VERBOSE \
		--js $(JSFILES) --js_output_file $@
	sed -e s@public/@@g <outfiles.list | \
		awk '{print "<script src=\"" $$1 "\"></script>"}'

SRCS = public/soccersub.min.js public/soccersub.css public/soccersub.html \
	public/futsal_floor.png

deploy.timestamp : $(SRCS)
	/usr/local/bin/firebase deploy --only hosting
	touch $@

git_setup :
	git remote set-url origin git@github.com:jmarantz/quickstart-js.git
