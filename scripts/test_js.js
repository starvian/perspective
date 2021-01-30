/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

const {bash, execute, execute_throw, getarg, docker} = require("./script_utils.js");
const fs = require("fs");

const DEBUG_FLAG = getarg("--debug") ? "" : "--silent";
const IS_PUPPETEER = !!getarg("--private-puppeteer");
const IS_WRITE = !!getarg("--write") || process.env.WRITE_TESTS;
const IS_LOCAL_PUPPETEER = fs.existsSync("node_modules/puppeteer");

const PACKAGE = process.env.PACKAGE;

if (IS_WRITE) {
    console.log("-- Running the test suite in Write mode");
}

if (getarg("--saturate")) {
    console.log("-- Running the test suite in saturate mode");
}

if (getarg("--debug")) {
    console.log("-- Running tests in debug mode - all console.log statements are preserved.");
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
        node_modules/.bin/jest 
        --rootDir=.
        --config=packages/perspective-test/jest.all.config.js 
        --color
        --verbose 
        --maxWorkers=50%
        --testPathIgnorePatterns='timezone'
        ${getarg("--bail") && "--bail"}
        ${getarg("--debug") || "--silent 2>&1 --noStackTrace"} 
        --testNamePattern="${get_regex()}"`;
}

/**
 * Run tests for a single package.
 */
function jest_single() {
    console.log(`-- Running "${PACKAGE}" test suite`);
    return bash`
        PSP_SATURATE=${!!getarg("--saturate")}
        PSP_PAUSE_ON_FAILURE=${!!getarg("--interactive")}
        WRITE_TESTS=${IS_WRITE}
        TZ=UTC 
        node_modules/.bin/lerna exec 
        --concurrency 1 
        --no-bail
        --scope="@finos/${PACKAGE}" 
        -- 
        yarn test:run
        ${DEBUG_FLAG}
        ${getarg("--interactive") && "--runInBand"}
        --testNamePattern="${get_regex()}"`;
}

/**
 * Run timezone tests in a new Node process.
 */
function jest_timezone() {
    console.log("-- Running Perspective.js timezone test suite");
    return bash`
        node_modules/.bin/lerna exec 
        --concurrency 1 
        --scope="@finos/perspective" 
        -- 
        yarn test_timezone:run
        ${DEBUG_FLAG}
        --testNamePattern="${get_regex()}"`;
}

function get_regex() {
    const regex = getarg`-t`;
    if (regex) {
        console.log(`-- Qualifying search '${regex}'`);
        return regex.replace(/ /g, ".");
    }
}

try {
    if (!IS_PUPPETEER && !IS_LOCAL_PUPPETEER) {
        execute`node_modules/.bin/lerna exec -- mkdir -p dist/umd`;
        execute`node_modules/.bin/lerna run test:build --stream --scope="@finos/${PACKAGE}"`;
        execute`yarn --silent clean --screenshots`;
        execute`${docker("puppeteer")} node scripts/test_js.js --private-puppeteer ${getarg()}`;
    } else {
        if (IS_LOCAL_PUPPETEER) {
            execute`yarn --silent clean --screenshots`;
            execute`node_modules/.bin/lerna exec -- mkdir -p dist/umd`;
            execute`node_modules/.bin/lerna run test:build --stream
                --scope="@finos/${PACKAGE}"`;
        }
        if (getarg("--quiet")) {
            // Run all tests with suppressed output.
            console.log("-- Running test suite in quiet mode");
            execute_throw(silent(jest_timezone()));
            execute(silent(jest_all()));
        } else if (process.env.PACKAGE) {
            // Run tests for a single package.
            if (PACKAGE === "perspective") {
                execute_throw(jest_timezone());
            }
            execute(jest_single());
        } else {
            // Run all tests with full output.
            console.log("-- Running test suite in fast mode");
            execute_throw(jest_timezone());
            execute(jest_all());
        }
    }
} catch (e) {
    console.log(e.message);
    process.exit(1);
}
