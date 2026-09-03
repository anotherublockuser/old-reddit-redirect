.PHONY: build run run-isolated clean purge install

build:
	cp LICENSE.txt extension/dist/
	trap 'rm -f ./extension/dist/LICENSE.txt' EXIT; \
	./node_modules/.bin/web-ext build

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
	rm -rf artifacts

purge:
	rm -rf node_modules

install:
	npm install --no-audit
