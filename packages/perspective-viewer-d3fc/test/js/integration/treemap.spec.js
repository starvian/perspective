/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

const path = require("path");

const utils = require("@finos/perspective-test");
const simple_tests = require("@finos/perspective-viewer/test/js/simple_tests.js");

const {withTemplate} = require("./simple-template");
withTemplate("treemap", "d3_treemap", {columns: ["Quantity", "Profit"]});

utils.with_server({}, () => {
    describe.page(
        "treemap.html",
        () => {
            simple_tests.default();

            test.capture(
                "with column position 1 set to null.",
                async page => {
                    const viewer = await page.$("perspective-viewer");
                    await page.shadow_click("perspective-viewer", "#config_button");
                    await page.evaluate(element => element.setAttribute("row-pivots", '["State"]'), viewer);
                    await page.evaluate(element => element.setAttribute("columns", '["Sales", null, "Quantity"]'), viewer);
                    const columns = JSON.parse(await page.evaluate(element => element.getAttribute("columns"), viewer));
                    expect(columns).toEqual(["Sales", null, "Quantity"]);
                },
                {preserve_hover: true}
            );

            test.capture(
                "tooltip columns works",
                async page => {
                    const viewer = await page.$("perspective-viewer");
                    await page.shadow_click("perspective-viewer", "#config_button");
                    await page.evaluate(element => element.setAttribute("row-pivots", '["State"]'), viewer);
                    await page.evaluate(element => element.setAttribute("columns", '["Sales", "Profit", "State"]'), viewer);
                    const columns = JSON.parse(await page.evaluate(element => element.getAttribute("columns"), viewer));
                    expect(columns).toEqual(["Sales", "Profit", "State"]);
                    await page.waitForSelector("perspective-viewer:not([updating])");
                    await page.mouse.move(0, 0);
                    await page.mouse.move(500, 200);
                    await page.waitFor(
                        element => {
                            const elem = element.shadowRoot.querySelector("perspective-d3fc-chart").shadowRoot.querySelector(".tooltip");
                            if (elem) {
                                return window.getComputedStyle(elem).opacity === "0.9";
                            }
                            return false;
                        },
                        {},
                        viewer
                    );
                },
                {preserve_hover: true}
            );

            test.capture(
                "treemap label shows formatted date",
                async page => {
                    const viewer = await page.$("perspective-viewer");
                    await page.shadow_click("perspective-viewer", "#config_button");
                    await page.evaluate(element => element.setAttribute("row-pivots", '["Ship Date"]'), viewer);
                    await page.evaluate(element => element.setAttribute("columns", '["Sales", "Profit"]'), viewer);
                    await page.waitForSelector("perspective-viewer:not([updating])");
                    await page.waitFor(
                        element => {
                            let elem = element.shadowRoot.querySelector("perspective-d3fc-chart").shadowRoot.querySelector(".top");
                            if (elem) {
                                return elem.textContent === "6/14/2011, 12:00:00 AM";
                            }
                        },
                        {},
                        viewer
                    );
                },
                {preserve_hover: true}
            );

            test.run("treemap parent button shows formatted date", async page => {
                const viewer = await page.$("perspective-viewer");
                await page.shadow_click("perspective-viewer", "#config_button");
                await page.evaluate(element => element.setAttribute("row-pivots", '["Ship Date", "City"]'), viewer);
                await page.evaluate(element => element.setAttribute("columns", '["Sales", "Profit"]'), viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
                await page.mouse.click(500, 200);
                const result = await page.waitFor(
                    element => {
                        let elem = element.shadowRoot.querySelector("perspective-d3fc-chart").shadowRoot.querySelector("#goto-parent");
                        if (elem) {
                            return elem.textContent.includes("9/21/2012, 12:00:00 AM");
                        }
                    },
                    {},
                    viewer
                );
                return !!result;
            });
        },
        {reload_page: false, root: path.join(__dirname, "..", "..", "..")}
    );
});
