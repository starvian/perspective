/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

import tar from "tar";
import fs from "fs";
import path from "path";

export default async function run() {
    const results = path.join(__dirname, "../../results.tar.gz");
    const debug_results = path.join(
        __dirname,
        `../../${!!process.env.CI ? "" : "dist/"}results.debug.tar.gz`
    );
    try {
        if (fs.existsSync(results)) {
            console.log("Using results.tar.gz");
            await tar.extract({ file: results, gzip: true });
        }
        if (fs.existsSync(debug_results)) {
            console.log("Using results.debug.tar.gz");
            await tar.extract({ file: debug_results, gzip: true });
        }
    } catch (e) {
        console.error("Failed to untar results archives");
        fs.unlinkSync(results);
    }
}
