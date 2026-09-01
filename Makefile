.PHONY: run run-isolated clean

old-reddit-redirect.zip: *.json *.js *.html *.css img/* *.txt
	zip -r old-reddit-redirect.zip * -x .git/* -x img/screenshot.png -x .gitignore -x Makefile -x _metadata/** -x "_metadata/*"

run:
	npx web-ext run \
		--start-url www.reddit.com \
		--devtools \
		--pref devtools.toolbox.selectedTool=webconsole

run-isolated:
	npx web-ext run \
		--start-url www.reddit.com \
		--devtools \
		--pref devtools.toolbox.selectedTool=webconsole \
		--pref privacy.firstparty.isolate=true \
		--pref privacy.userContext.enabled=true \
		--pref privacy.userContext.ui.enabled=true

clean:
	rm -f *.zip
