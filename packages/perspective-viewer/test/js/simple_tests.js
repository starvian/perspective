/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

const {drag_drop} = require("./utils");

exports.default = function() {
    test.capture("shows a grid without any settings applied.", async () => {});

    test.capture("pivots by a row.", async page => {
        const viewer = await page.$("perspective-viewer");
        await page.shadow_click("perspective-viewer", "#config_button");
        await page.evaluate(element => element.setAttribute("row-pivots", '["State"]'), viewer);
    });

    test.capture("pivots by two rows.", async page => {
        const viewer = await page.$("perspective-viewer");
        await page.shadow_click("perspective-viewer", "#config_button");
        await page.evaluate(element => element.setAttribute("row-pivots", '["Category","Sub-Category"]'), viewer);
    });

    test.capture("pivots by a column.", async page => {
        const viewer = await page.$("perspective-viewer");
        await page.shadow_click("perspective-viewer", "#config_button");
        await page.evaluate(element => element.setAttribute("column-pivots", '["Category"]'), viewer);
    });

    test.capture("pivots by a row and a column.", async page => {
        const viewer = await page.$("perspective-viewer");
        await page.shadow_click("perspective-viewer", "#config_button");
        await page.evaluate(element => element.setAttribute("row-pivots", '["State"]'), viewer);
        await page.waitForSelector("perspective-viewer:not([updating])");
        await page.evaluate(element => element.setAttribute("column-pivots", '["Category"]'), viewer);
    });

    test.capture("pivots by two rows and two columns.", async page => {
        const viewer = await page.$("perspective-viewer");
        await page.shadow_click("perspective-viewer", "#config_button");
        await page.evaluate(element => element.setAttribute("row-pivots", '["Region","State"]'), viewer);
        await page.waitForSelector("perspective-viewer:not([updating])");
        await page.evaluate(element => element.setAttribute("column-pivots", '["Category","Sub-Category"]'), viewer);
    });

    test.capture("sorts by a hidden column.", async page => {
        const viewer = await page.$("perspective-viewer");
        await page.shadow_click("perspective-viewer", "#config_button");
        await page.evaluate(element => element.setAttribute("columns", '["Row ID","Quantity"]'), viewer);
        await page.evaluate(element => element.setAttribute("sort", '[["Sales", "asc"]]'), viewer);
    });

    test.capture("sorts by a numeric column.", async page => {
        const viewer = await page.$("perspective-viewer");
        await page.shadow_click("perspective-viewer", "#config_button");
        await page.evaluate(element => element.setAttribute("sort", '[["Sales", "asc"]]'), viewer);
    });

    test.capture("filters by a numeric column.", async page => {
        const viewer = await page.$("perspective-viewer");
        await page.shadow_click("perspective-viewer", "#config_button");
        await page.evaluate(element => element.setAttribute("filters", '[["Sales", ">", 500]]'), viewer);
    });

    test.capture("filters by a datetime column.", async page => {
        const viewer = await page.$("perspective-viewer");
        await page.shadow_click("perspective-viewer", "#config_button");
        await page.evaluate(element => element.setAttribute("filters", '[["Order Date", ">", "01/01/2012"]]'), viewer);
    });

    test.capture("highlights invalid filter.", async page => {
        const viewer = await page.$("perspective-viewer");
        await page.shadow_click("perspective-viewer", "#config_button");
        await page.evaluate(element => element.setAttribute("filters", '[["Sales", "==", null]]'), viewer);
    });

    test.capture("sorts by an alpha column.", async page => {
        const viewer = await page.$("perspective-viewer");
        await page.shadow_click("perspective-viewer", "#config_button");
        await page.evaluate(element => element.setAttribute("sort", '[["State", "asc"]]'), viewer);
    });

    test.capture("displays visible columns.", async page => {
        const viewer = await page.$("perspective-viewer");
        await page.shadow_click("perspective-viewer", "#config_button");
        await page.evaluate(element => element.setAttribute("columns", '["Discount","Profit","Sales","Quantity"]'), viewer);
    });

    test.skip("pivots by row when drag-and-dropped.", async page => {
        await page.shadow_click("perspective-viewer", "#config_button");
        await drag_drop(page, "perspective-row[name=Category]", "#row_pivots");
    });
};
