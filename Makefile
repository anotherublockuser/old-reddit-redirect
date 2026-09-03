.PHONY: run run-isolated clean purge install

old-reddit-redirect.zip:
	cp LICENSE.txt extension/dist/
	trap 'rm -f LICENSE.txt' EXIT; \
	cd extension/dist && zip -r ../../old-reddit-redirect.zip .


run:
	./node_modules/.bin/web-ext run \
		--start-url www.reddit.com \
		--devtools \
		--pref devtools.toolbox.selectedTool=webconsole

run-isolated:
	./node_modules/.bin/web-ext run \
		--start-url www.reddit.com \
		--devtools \
		--pref devtools.toolbox.selectedTool=webconsole \
		--pref privacy.firstparty.isolate=true \
		--pref privacy.userContext.enabled=true \
		--pref privacy.userContext.ui.enabled=true

clean:
	rm -f *.zip

purge:
	rm -rf node_modules

install:
	npm install --no-audit
