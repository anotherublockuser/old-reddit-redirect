import TestRunner from "./TestRunner.js";

const TEST_TITLE = "reddit: the front page of the internet";
let success = false;

const runner = new TestRunner();

try {
    await runner.start();
    await runner.navigate();
    const title = await runner.evaluate("document.title");
    success = title === TEST_TITLE;
    console.log(`Test: test-title ${success ? "passed" : "failed"}`)
} catch (err) {
    console.error(err);
} finally {
    await runner.exit();
    process.exitCode = success ? 0 : 1;
}

