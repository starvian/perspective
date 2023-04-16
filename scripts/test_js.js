/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

const {
    bash,
    execute,
    getarg,
    execute_throw,
    run_with_scope,
    bash_with_scope,
    PACKAGE_MANAGER,
} = require("./script_utils.js");
const minimatch = require("minimatch");
const fs = require("fs");

const PACKAGE = process.env.PACKAGE;
const DEBUG_FLAG = getarg("--debug") ? "" : "--silent";
const IS_WRITE = !!getarg("--write") || process.env.WRITE_TESTS;
const IS_LOCAL_PUPPETEER = fs.existsSync("node_modules/puppeteer"); // puppeteer is no longer needed. Remove this.

// Unfortunately we have to handle parts of the Jupyter test case here,
// as the Jupyter server needs to be run outside of the main Jest process.
const IS_JUPYTER =
    getarg("--jupyter") && minimatch("perspective-jupyterlab", PACKAGE);

if (IS_WRITE) {
    console.log("-- Running the test suite in Write mode");
}

if (getarg("--saturate")) {
    console.log("-- Running the test suite in saturate mode");
}

if (getarg("--debug")) {
    console.log(
        "-- Running tests in debug mode - all console.log statements are preserved."
    );
}

if (getarg("--runInBand")) {
    console.log("-- Running tests in single-threaded mode.");
}

function silent(x) {
    return bash`output=$(${x}); ret=$?; echo "\${output}"; exit $ret`;
}

/**
 * Run tests for all packages in parallel.
 */
function jest_all() {
    return bash`
        PSP_SATURATE=${!!getarg("--saturate")}
        PSP_PAUSE_ON_FAILURE=${!!getarg("--interactive")}
        WRITE_TESTS=${IS_WRITE}
        TZ=UTC
        npx jest
        --rootDir=.
        --config=tools/perspective-test/jest.all.config.js
        --color
        ${getarg("--bail") && "--bail"}
        ${getarg("--debug") || "--silent 2>&1 --noStackTrace"} 
        ${getarg("--runInBand") && "--runInBand"} 
        --testNamePattern="${get_regex()}"`;
}

/**
 * Run tests, both integration and unit.
 */
function playwright_all() {
    console.log(`-- Running "${PACKAGE}" Playwright test suite`);
    return bash`__JUPYTERLAB_PORT__=6538 PACKAGE=${PACKAGE} npx playwright test --config=tools/perspective-test/playwright.config.ts`;
}

/**
 * Run tests for a single package.
 */
function jest_single(cmd) {
    console.log(`-- Running "${PACKAGE}" test suite`);
    const RUN_IN_BAND =
        getarg("--interactive") || getarg("--runInBand") || IS_JUPYTER
            ? "--runInBand"
            : "";
    const x = bash`
        PSP_SATURATE=${!!getarg("--saturate")}
        PSP_PAUSE_ON_FAILURE=${!!getarg("--interactive")}
        WRITE_TESTS=${IS_WRITE}
        IS_LOCAL_PUPPETEER=${IS_LOCAL_PUPPETEER}
        TZ=UTC
        ${bash_with_scope`
            ${cmd ? cmd : "test:run"}
            -- ${DEBUG_FLAG} ${RUN_IN_BAND} --testNamePattern="${get_regex()}"`}`;

    return x;
}

function get_regex() {
    const regex = getarg`-t`;
    if (regex) {
        console.log(`-- Qualifying search '${regex}'`);
        return regex.replace(/ /g, ".");
    }
}

async function run() {
    try {
        // must be executed from top-level (without scope) in order to respect the
        // `--screenshots` flag.
        execute`${PACKAGE_MANAGER} run clean -- --screenshots`;

        if (!IS_JUPYTER) {
            // test:build irrelevant for jupyter tests
            await run_with_scope`test:build`;
        }

        // if (!PACKAGE || minimatch("perspective-viewer", PACKAGE)) {
        //     console.log("-- Running Rust tests");
        //     execute`yarn lerna --scope=@finos/perspective-viewer exec yarn test:run:rust`;
        // }

        if (getarg("--quiet")) {
            // Run all tests with suppressed output.
            console.log("-- Running jest in quiet mode");
            execute(silent(jest_all()));
        } else if (process.env.PACKAGE) {
            // Run tests for a single package.

            if (IS_JUPYTER) {
                // Jupyterlab is guaranteed to have started at this point, so
                // copy the test files over and run the tests.
                await run_with_scope`test:jupyter:build`;
                execute_throw(jest_single("test:jupyter:run"));
                process.exit(0);
            }

            // TODO: Tests now use Playwright (UI tests) and Jest (unit tests).
            // only run jest_single if we are running unit tests, e.g. the perspective package
            execute(jest_single());
        } else {
            // Run all tests with full output.
            console.log("-- Running jest in fast mode");
            execute(jest_all());
            execute(playwright_all());
        }
        // }
    } catch (e) {
        console.log(e.message);
        process.exit(1);
    }
}

run();
