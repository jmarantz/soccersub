# Tools needed:
#   closure compiler: https://dl.google.com/closure-compiler/compiler-latest.zip
#   java runtime: sudo apt-get install jvm-7-avian-jre
#   node.js
#   npm
#   firebase

deploy : deploy.timestamp
compile : public/soccersub.min.js

.PHONY: deploy compile

public/soccersub.min.js : public/soccersub.js Makefile
	java -jar $(HOME)/bin/closure-compiler-v20161024.jar \
		--compilation_level=ADVANCED_OPTIMIZATIONS \
		--warning_level=VERBOSE \
		--js $< --js_output_file $@

deploy.timestamp : public/soccersub.min.js public/soccersub.css public/soccersub.html
	/usr/local/bin/firebase deploy --only hosting
	touch $@

git_setup :
	git remote set-url origin git@github.com:jmarantz/quickstart-js.git
