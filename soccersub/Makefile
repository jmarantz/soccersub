# Tools needed:
#   closure compiler: https://dl.google.com/closure-compiler/compiler-latest.zip
#   java runtime: sudo apt-get install jvm-7-avian-jre
#   node.js
#   npm
#   firebase

export PATH := /usr/local/bin:$(PATH)
deploy : deploy.timestamp
compile : public/soccersub.min.js

.PHONY: deploy compile jsopts

JSFILES = public/position.js public/game.js public/player.js public/main.js public/util.js

jsopts : $(JSFILES) Makefile
	java -jar $(HOME)/bin/closure-compiler-v20161024.jar --help

public/soccersub.min.js : $(JSFILES) Makefile
	java -jar $(HOME)/bin/closure-compiler-v20161024.jar \
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
