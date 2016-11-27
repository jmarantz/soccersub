deploy : deploy.timestamp
compile : public/soccersub.min.js

.PHONY: deploy compile

public/soccersub.min.js : public/soccersub.js Makefile
	java -jar /Users/jmarantz/bin/closure-compiler-v20161024.jar \
		--compilation_level=ADVANCED_OPTIMIZATIONS \
		--warning_level=VERBOSE \
		--js $< --js_output_file $@

deploy.timestamp : public/soccersub.min.js public/soccersub.css public/soccersub.html
	/usr/local/bin/firebase deploy --only hosting
	touch $@

git_setup :
	git remote set-url origin git@github.com:jmarantz/quickstart-js.git
