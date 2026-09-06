import EventEmitter from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import webExt from "web-ext";
import pkg from "../package.json" with { type: "json" };

class TestRunner extends EventEmitter {
    #url;
    #options;

    #webExtCliOpts;
    #webExtNodeOpts = {
        shouldExitProgram: false
    };

    /** @type {WebSocket} */
    #ws;

    #isShuttingDown;
    #extensionRunner;

    #session;
    #browserContexts = [];

    #nextId = 1;
    #pendingCommands = {};

    constructor() {
        super();
        const envUrl = process.env.ORR_URL;
        try {
            const url = new URL(envUrl);
            const isReddit =
                url.hostname === "reddit.com" ||
                url.hostname.endsWith(".reddit.com");

            if (url.protocol !== "https:" || !isReddit) {
                throw new Error(
                    `The provided URL ${envUrl} is not an HTTPS URL on *.reddit.com!`
                );
            }

            this.#url = url;

            const envOptsFile = process.env.ORR_OPTS_FILE;
            if (envOptsFile) {
                const optionsPath = resolve(
                    import.meta.dirname, "options", envOptsFile
                );

                if (!existsSync(optionsPath)) {
                    throw new Error(`The file ${optionsPath} does not exist!`);
                }

                this.#options = JSON.parse(readFileSync(optionsPath));
            }

            this.#webExtCliOpts = {
                sourceDir: pkg.webExt.sourceDir,
                noReload: true,
                // When calling web-ext from Node, Firefox preferences must be provided
                // as `pref: { "a.preferen.ce": true }` or they are ignored!
                ...this.#options
            };

        } catch (error) {
            console.error("Invalid arguments:", error.message);
            process.exit(1);
        }
    }

    start = async () => {
        this.addListener("error", this.#handleError);
        await this.#startFirefox();
        await this.createBrowserContext();
    }

    createBrowserContext = async () => {
        const result = await this.#send(
            "browsingContext.create",
            {
                type: "tab"
            }
        );

        this.#browserContexts.push(result.context);

        return result.context;
    }

    navigate = async (url = this.#url) => {
        try {
            const result = await this.#send("browsingContext.navigate", {
                context: this.#browserContexts[0],
                url,
                wait: "complete"
            });

            return result;
        } catch (error) {
            this.emit("error", error);
            throw error;
        }
    }

    evaluate = async (expression) => {
        const result = await this.#send("script.evaluate", {
            expression,
            target: {
                context: this.#browserContexts[0]
            },
            awaitPromise: true
        });

        return result.result.value;
    }

    exit = async () => {
        if (this.#isShuttingDown) {
            return;
        }

        this.#isShuttingDown = true;

        try {
            if (this.#ws?.readyState === WebSocket.OPEN) {
                if (this.#session) {
                    await this.#send("session.end", {});
                }

                await new Promise((resolve) => {
                    this.#ws.addEventListener("close", resolve, { once: true });
                    this.#ws.close();
                });
            }
        } finally {
            await this.#extensionRunner?.exit();
        }
    }

    #startFirefox = async () => {
        const params = [
            {
                ...this.#webExtCliOpts,
                args: [
                    "--remote-debugging-port=9222",
                    "--headless"
                ]
            },
            this.#webExtNodeOpts
        ];

        this.#extensionRunner = await webExt.cmd.run(...params);

        await this.#connectWebsocket("ws://127.0.0.1:9222/session");

        const result = await this.#send("session.new", {
            capabilities: {
                alwaysMatch: {
                    browserName: "firefox",
                }
            }
        });

        this.#session = result.sessionId;
    }

    #connectWebsocket = async (url) => {
        this.#ws = new WebSocket(url);

        await new Promise((resolve, reject) => {
            this.#ws.addEventListener("open", resolve, { once: true });
            this.#ws.addEventListener(
                "error",
                () => reject(new Error("Could not establish WebSocket connection")),
                { once: true }
            );
        });

        this.#ws.addEventListener("message", this.#handleWsMessage);
        this.#ws.addEventListener("error", this.#handleWsError);
        this.#ws.addEventListener("close", this.#handleWsClose);
    }

    /**
     * @template {keyof import("webdriver-bidi-protocol").Commands} K
     * @param {K} method
     * @param {import("webdriver-bidi-protocol").Commands[K]["params"]} params
     * @returns {Promise<import("webdriver-bidi-protocol").Commands[K]["returnType"]>}
     */
    #send = (method, params) => {
        const id = this.#nextId++;

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                delete this.#pendingCommands[id];
                reject(new Error(`WebDriver BiDi command "${method}" timed out`));
            }, 10_000);

            this.#pendingCommands[id] = {
                resolve: (value) => {
                    clearTimeout(timeout);
                    resolve(value);
                },
                reject: (error) => {
                    clearTimeout(timeout);
                    reject(error);
                },
                method
            };

            this.#ws.send(JSON.stringify({
                id,
                method,
                params
            }));
        });
    }

    #handleWsMessage = (event) => {
        // Catch errors thrown in event handlers
        try {
            const message = JSON.parse(event.data);
            const command = this.#pendingCommands[message.id];

            if (!command) {
                return;
            }

            const { resolve, reject, method } = command;

            delete this.#pendingCommands[message.id];

            if (message.error) {
                const error = new Error(`Invalid WebDriver BiDi command "${method}"`, {
                    cause: message
                });
                reject(error);
                this.emit("error", error);
                return;
            }

            resolve(message.result);
        } catch (error) {
            this.emit("error", error);
        }
    }

    #handleWsClose = () => {
        if (this.#isShuttingDown) {
            return;
        }

        this.emit("error", new Error("WebSocket closed unexpectedly"));
    }

    #handleWsError = (event) => {
        this.emit("error", new Error("WebSocket error", {
            cause: event
        }));
    }

    #handleError = async (error) => {
        // Catch errors thrown in event handlers
        try {
            for (const { reject } of Object.values(this.#pendingCommands)) {
                reject(error);
            }

            this.#pendingCommands = {};
            await this.exit();
        } catch (error) {
            console.error("Error while handling error 💀:", error);
            process.exit(1);
        }
    }
}

export default TestRunner;
