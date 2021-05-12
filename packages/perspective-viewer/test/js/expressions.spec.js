/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

const utils = require("@finos/perspective-test");
const path = require("path");

const add_expression = async (page, expression) => {
    const viewer = await page.$("perspective-viewer");
    await page.waitForSelector("perspective-viewer:not([updating])");
    await page.shadow_click("perspective-viewer", "#add-expression");
    await page.shadow_type(expression, "perspective-viewer", "perspective-expression-editor", ".perspective-expression-editor__edit_area");
    // a little hacky around waiting for the UI, etc. to render final state
    await page.waitFor(200);
    await page.evaluate(element => {
        const editor = element.shadowRoot.querySelector("perspective-expression-editor");
        const button = editor.shadowRoot.querySelector("#psp-expression-editor-button-save");
        button.removeAttribute("disabled");
        button.click();
    }, viewer);
    await page.waitForSelector("perspective-viewer:not([updating])");
};

utils.with_server({}, () => {
    describe.page(
        "superstore.html",
        () => {
            test.capture("click on add column button opens the expression UI.", async page => {
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                await page.$("perspective-viewer");
                await page.shadow_click("perspective-viewer", "#add-expression");
            });

            test.capture("click on close button closes the expression UI.", async page => {
                const viewer = await page.$("perspective-viewer");
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                await page.$("perspective-viewer");
                await page.shadow_click("perspective-viewer", "#add-expression");
                await page.shadow_click("perspective-viewer", "perspective-expression-editor", "#psp-expression-editor-close");
                await page.evaluate(element => element.setAttribute("columns", JSON.stringify(["Sales", "Profit"])), viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
            });

            // Functionality - make sure the UI will validate error cases so
            // the engine is not affected.
            test.capture("An expression with unknown symbols should disable the save button", async page => {
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                await page.$("perspective-viewer");
                await page.shadow_click("perspective-viewer", "#add-expression");
                await page.shadow_type("abc", "perspective-viewer", "perspective-expression-editor", ".perspective-expression-editor__edit_area");
                await page.waitForSelector("perspective-viewer:not([updating])");
            });

            test.capture("A type-invalid expression should disable the save button", async page => {
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                await page.$("perspective-viewer");
                await page.shadow_click("perspective-viewer", "#add-expression");
                await page.shadow_type("$'Sales' + $'Category'", "perspective-viewer", "perspective-expression-editor", ".perspective-expression-editor__edit_area");
                await page.waitForSelector("perspective-viewer:not([updating])");
            });

            test.capture("An expression with invalid input columns should disable the save button", async page => {
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                await page.$("perspective-viewer");
                await page.shadow_click("perspective-viewer", "#add-expression");
                await page.shadow_type("$'aaaa' + $'Sales'", "perspective-viewer", "perspective-expression-editor", ".perspective-expression-editor__edit_area");
                await page.waitForSelector("perspective-viewer:not([updating])");
            });

            test.capture("Typing enter should save a valid expression", async page => {
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                await page.$("perspective-viewer");
                await page.shadow_click("perspective-viewer", "#add-expression");
                await page.shadow_type("$'Sales' + 10", "perspective-viewer", "perspective-expression-editor", ".perspective-expression-editor__edit_area");
                await page.waitForSelector("perspective-viewer:not([updating])");
                await page.keyboard.press("Enter");
                await page.waitForSelector("perspective-viewer:not([updating])");
            });

            test.capture("Typing enter should not save an invalid expression", async page => {
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                await page.$("perspective-viewer");
                await page.shadow_click("perspective-viewer", "#add-expression");
                await page.shadow_type("definitely not valid", "perspective-viewer", "perspective-expression-editor", ".perspective-expression-editor__edit_area");
                await page.waitForSelector("perspective-viewer:not([updating])");
                await page.keyboard.press("Enter");
                await page.waitForSelector("perspective-viewer:not([updating])");
            });

            test.skip("Typing a large expression in the textarea should work even when pushed down to page bottom.", async page => {
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                await page.$("perspective-viewer");
                await page.shadow_click("perspective-viewer", "#add-expression");
                await page.shadow_type("1 + 2 + 3 + 4 + 5 + 6 + 7".repeat(10), "perspective-viewer", "perspective-expression-editor", ".perspective-expression-editor__edit_area");
            });

            // Remove
            test.capture("Removing expressions should reset active columns, pivots, sort, and filter.", async page => {
                const viewer = await page.$("perspective-viewer");
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                await add_expression(page, "$'Sales' + 10");
                await page.waitForSelector("perspective-viewer:not([updating])");
                await add_expression(page, "$'Profit' / $'Row ID'");
                await page.waitForSelector("perspective-viewer:not([updating])");
                await add_expression(page, "1 + 2");
                await page.waitForSelector("perspective-viewer:not([updating])");
                await page.evaluate(element => element.setAttribute("row-pivots", JSON.stringify(["State"])), viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
                await page.evaluate(element => element.setAttribute("columns", JSON.stringify(["1 + 2", "$'Profit' / $'Row ID'", "Sales"])), viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
                await page.evaluate(element => element.setAttribute("column-pivots", JSON.stringify(["$'Sales' + 10"])), viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
                await page.evaluate(
                    element =>
                        element.setAttribute(
                            "sort",
                            JSON.stringify([
                                ["$'Profit' / $'Row ID'", "desc"],
                                ["State", "desc"]
                            ])
                        ),
                    viewer
                );
                await page.waitForSelector("perspective-viewer:not([updating])");
                await page.evaluate(
                    element =>
                        element.setAttribute(
                            "filters",
                            JSON.stringify([
                                ["$'Sales' + 10", ">", 0],
                                ["State", "==", "Texas"]
                            ])
                        ),
                    viewer
                );
                await page.waitForSelector("perspective-viewer:not([updating])");
                await page.evaluate(element => element.removeAttribute("expressions"), viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
            });

            // reset
            test.capture("Resetting the viewer with expressions should place columns in the inactive list.", async page => {
                const viewer = await page.$("perspective-viewer");
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                await add_expression(page, "$'Sales' + 10");
                await page.waitForSelector("perspective-viewer:not([updating])");
                await add_expression(page, "$'Profit' / $'Row ID'");
                await page.waitForSelector("perspective-viewer:not([updating])");
                await add_expression(page, "1 + 2");
                await page.waitForSelector("perspective-viewer:not([updating])");
                await page.evaluate(element => element.reset(), viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
            });

            test.capture("Resetting the viewer with columns in active columns should reset columns but not delete columns.", async page => {
                const viewer = await page.$("perspective-viewer");
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                await add_expression(page, "$'Sales' + 10");
                await page.waitForSelector("perspective-viewer:not([updating])");
                await add_expression(page, "$'Profit' / $'Row ID'");
                await page.waitForSelector("perspective-viewer:not([updating])");
                await add_expression(page, "1 + 2");
                await page.waitForSelector("perspective-viewer:not([updating])");
                await page.evaluate(element => element.setAttribute("columns", JSON.stringify(["$'Sales' + 10", "1 + 2", "Sales"])), viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
                await page.evaluate(element => element.reset(), viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
            });

            test.capture("Resetting the viewer with columns set as pivots should reset pivots but not delete columns.", async page => {
                const viewer = await page.$("perspective-viewer");
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                await add_expression(page, "$'Sales' + 10");
                await page.waitForSelector("perspective-viewer:not([updating])");
                await add_expression(page, "$'Profit' / $'Row ID'");
                await page.waitForSelector("perspective-viewer:not([updating])");
                await add_expression(page, "1 + 2");
                await page.waitForSelector("perspective-viewer:not([updating])");
                await page.evaluate(element => element.setAttribute("row-pivots", JSON.stringify(["1 + 2"])), viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
                await page.evaluate(element => element.setAttribute("column-pivots", JSON.stringify(["$'Profit' / $'Row ID'"])), viewer);
                await page.evaluate(element => element.reset(), viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
            });

            test.capture("Resetting the viewer with columns set as filters should reset filters but not delete columns.", async page => {
                const viewer = await page.$("perspective-viewer");
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                await add_expression(page, "$'Sales' + 10");
                await page.waitForSelector("perspective-viewer:not([updating])");
                await add_expression(page, "$'Profit' / $'Row ID'");
                await page.waitForSelector("perspective-viewer:not([updating])");
                await add_expression(page, "1 + 2");
                await page.waitForSelector("perspective-viewer:not([updating])");
                await page.evaluate(
                    element =>
                        element.setAttribute(
                            "filters",
                            JSON.stringify([
                                ["$'Sales' + 10", ">", 100],
                                ["State", "==", "Texas"]
                            ])
                        ),
                    viewer
                );
                await page.evaluate(element => element.reset(), viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
            });

            test.capture("Resetting the viewer with columns set as sort should reset sort but not delete columns.", async page => {
                const viewer = await page.$("perspective-viewer");
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                await add_expression(page, "$'Sales' + 10");
                await page.waitForSelector("perspective-viewer:not([updating])");
                await add_expression(page, "$'Profit' / $'Row ID'");
                await page.waitForSelector("perspective-viewer:not([updating])");
                await add_expression(page, "1 + 2");
                await page.waitForSelector("perspective-viewer:not([updating])");
                await page.evaluate(element => element.setAttribute("sort", JSON.stringify([["$'Sales' + 10", "desc"][("Sales", "desc")]])), viewer);
                await page.evaluate(element => element.reset(), viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
            });

            // save
            test.capture("saving without an expression should fail as button is disabled.", async page => {
                const viewer = await page.$("perspective-viewer");
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                await page.shadow_click("perspective-viewer", "#add-expression");
                await page.evaluate(
                    element =>
                        element.shadowRoot
                            .querySelector("perspective-expression-editor")
                            .shadowRoot.querySelector("#psp-expression-editor-button-save")
                            .click(),
                    viewer
                );
            });

            test.capture("saving a single expression should add it to inactive columns.", async page => {
                const viewer = await page.$("perspective-viewer");
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                await add_expression(page, "$'Sales' * sqrt($'Profit')");
                await page.evaluate(element => element.setAttribute("columns", JSON.stringify(["Sales", "Profit"])), viewer);
            });

            test.skip("saving a duplicate expression should disable the save button.", async page => {
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                await add_expression(page, "$'Sales' * sqrt($'Profit')");
                await add_expression(page, "$'Sales' * sqrt($'Profit')");
            });

            // Transforms
            test.capture("Expression columns should persist when new views are created.", async page => {
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                await add_expression(page, "$'Sales' + $'Profit'");
                const viewer = await page.$("perspective-viewer");
                await page.evaluate(element => element.setAttribute("row-pivots", '["State", "City"]'), viewer);
                await page.evaluate(element => element.setAttribute("columns", JSON.stringify(["State", "City"])), viewer);
            });

            test.capture("Expression columns should persist when new columns are added.", async page => {
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                await add_expression(page, "$'Sales' + $'Profit'");
                await add_expression(page, "$'Sales' % $'Profit'");
                const viewer = await page.$("perspective-viewer");
                await page.evaluate(element => element.setAttribute("columns", JSON.stringify(["Sales", "Profit"])), viewer);
            });

            // usage
            test.capture("aggregates by expression column.", async page => {
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                await add_expression(page, "$'Sales' / $'Profit'");
                const viewer = await page.$("perspective-viewer");
                await page.evaluate(element => {
                    element.setAttribute("aggregates", JSON.stringify({"$'Sales' / $'Profit'": "avg"}));
                }, viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
                await page.evaluate(element => element.setAttribute("row-pivots", '["State"]'), viewer);
                await page.evaluate(element => element.setAttribute("columns", JSON.stringify(["$'Sales' / $'Profit'"])), viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
            });

            test.capture("row pivots by expression column.", async page => {
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                await add_expression(page, "1 + 2");
                const viewer = await page.$("perspective-viewer");
                await page.evaluate(element => element.setAttribute("row-pivots", '["1 + 2"]'), viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
                await page.evaluate(element => element.setAttribute("columns", JSON.stringify(["1 + 2"])), viewer);
            });

            test.capture("column pivots by expression column.", async page => {
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                await add_expression(page, "1 + 2");
                const viewer = await page.$("perspective-viewer");
                await page.evaluate(element => element.setAttribute("column-pivots", '["1 + 2"]'), viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
                await page.evaluate(element => element.setAttribute("columns", JSON.stringify(["1 + 2"])), viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
            });

            test.capture("row and column pivots by expression column.", async page => {
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                await add_expression(page, "$'Sales' / $'Profit'");
                await page.waitForSelector("perspective-viewer:not([updating])");
                await add_expression(page, "1 + 2");
                await page.waitForSelector("perspective-viewer:not([updating])");
                const viewer = await page.$("perspective-viewer");
                await page.evaluate(element => element.setAttribute("row-pivots", "[\"$'Sales' / $'Profit'\"]"), viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
                await page.evaluate(element => element.setAttribute("column-pivots", '["1 + 2"]'), viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
                await page.evaluate(element => element.setAttribute("columns", JSON.stringify(["Sales", "Profit"])), viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
            });

            test.capture("sorts by expression column.", async page => {
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                await add_expression(page, "$'Sales' / $'Profit'");
                const viewer = await page.$("perspective-viewer");
                await page.evaluate(element => element.setAttribute("sort", JSON.stringify([["$'Sales' / $'Profit'", "desc"]])), viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
                await page.evaluate(element => element.setAttribute("columns", JSON.stringify(["$'Sales' / $'Profit'"])), viewer);
            });

            test.capture("filters by expression column.", async page => {
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                await add_expression(page, "$'Sales' + $'Profit'");
                const viewer = await page.$("perspective-viewer");
                await page.evaluate(element => element.setAttribute("filters", JSON.stringify([["$'Sales' + $'Profit'", ">", 100]])), viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
                await page.evaluate(element => element.setAttribute("columns", JSON.stringify(["$'Sales' + $'Profit'"])), viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
            });

            test.capture("expression column aggregates should persist.", async page => {
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                await add_expression(page, "$'Sales' + $'Profit'");
                const viewer = await page.$("perspective-viewer");
                await page.evaluate(element => element.setAttribute("row-pivots", '["Quantity"]'), viewer);
                await page.evaluate(element => element.setAttribute("columns", JSON.stringify(["$'Sales' + $'Profit'", "Row ID", "Quantity"])), viewer);
                await page.evaluate(element => element.setAttribute("aggregates", "{\"$'Sales' + $'Profit'\": \"avg\"}"), viewer);
                await page.evaluate(element => element.setAttribute("columns", JSON.stringify(["Quantity"])), viewer);
                await page.evaluate(element => element.setAttribute("columns", JSON.stringify(["$'Sales' + $'Profit'", "Row ID", "Quantity"])), viewer);
            });

            // Attributes
            test.capture("adds expression via attribute", async page => {
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                const viewer = await page.$("perspective-viewer");
                await page.evaluate(element => {
                    element.setAttribute("expressions", JSON.stringify(["$'Sales' + $'Profit'", "if ($'Sales' > 100) true; else false"]));
                }, viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
                await page.evaluate(element => element.setAttribute("columns", JSON.stringify(["Sales", "if ($'Sales' > 100) true; else false"])), viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
            });

            test.capture("setting expression attribute resets old expressions", async page => {
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                const viewer = await page.$("perspective-viewer");
                await page.evaluate(element => {
                    element.setAttribute("expressions", JSON.stringify(["$'Sales' + $'Profit'"]));
                }, viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
                await page.evaluate(element => element.setAttribute("columns", JSON.stringify(["$'Sales' + $'Profit'"])), viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
                await page.evaluate(element => {
                    element.setAttribute("expressions", JSON.stringify(["$'Sales' / $'Profit'"]));
                }, viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
                await page.evaluate(element => element.setAttribute("columns", JSON.stringify(["$'Sales' / $'Profit'"])), viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
            });

            test.capture("removing expression attribute resets expressions", async page => {
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                const viewer = await page.$("perspective-viewer");
                await page.evaluate(element => {
                    element.setAttribute("expressions", JSON.stringify(["$'Sales' + $'Profit'"]));
                }, viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
                await page.evaluate(element => element.setAttribute("columns", JSON.stringify(["$'Sales' + $'Profit'"])), viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
                await page.evaluate(element => {
                    element.removeAttribute("expressions");
                }, viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
            });

            // Save and restore
            test.capture("expressions are saved without changes", async page => {
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                await add_expression(page, "if ($'Sales' > 100) true; else false");
                await add_expression(page, "$'Sales' + $'Profit'");
                const viewer = await page.$("perspective-viewer");
                await page.waitForSelector("perspective-viewer:not([updating])");
                await page.evaluate(element => {
                    const config = element.save();
                    const result = JSON.stringify(config.expressions);
                    const expected = JSON.stringify(["if ($'Sales' > 100) true; else false", "$'Sales' + $'Profit'"]);
                    if (result !== expected) {
                        throw new Error(`Expected ${expected} but received ${result}`);
                    }
                }, viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
                await page.evaluate(element => element.setAttribute("columns", JSON.stringify(["if ($'Sales' > 100) true; else false", "$'Sales' + $'Profit'"])), viewer);
            });

            test.skip("expressions are restored without changes", async page => {
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                await page.waitForSelector("perspective-viewer:not([updating])");
                const viewer = await page.$("perspective-viewer");
                await page.waitForSelector("perspective-viewer:not([updating])");
                await page.evaluate(element => {
                    return element.restore({
                        columns: ["Order Date", "Ship Date"],
                        expressions: ["if ($'Sales' > 100) true; else false", "$'Sales' + $'Profit'"]
                    });
                }, viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
            });

            test.capture("restoring computed-columns is a no-op", async page => {
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                await page.waitForSelector("perspective-viewer:not([updating])");
                const viewer = await page.$("perspective-viewer");
                await page.evaluate(async element => {
                    const config = {
                        columns: ["Order Date", "Ship Date"],
                        "computed-columns": ['day_of_week("Order Date") as "Computed"', 'month_of_year("Ship Date") as "Computed2"']
                    };
                    await element.restore(config);
                }, viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
                await page.evaluate(element => element.setAttribute("columns", JSON.stringify(["Sales"])), viewer);
            });

            test.skip("On restore, expressions in the active columns list are restored correctly.", async page => {
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                await page.waitForSelector("perspective-viewer:not([updating])");
                const viewer = await page.$("perspective-viewer");
                await page.evaluate(async element => {
                    const config = {
                        columns: ["Sales", "Profit", "$'Sales' + $'Profit'"],
                        expressions: ["$'Sales' + $'Profit'"]
                    };
                    await element.restore(config);
                }, viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
            });

            test.skip("On restore, expressions in pivots are restored correctly.", async page => {
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                await page.waitForSelector("perspective-viewer:not([updating])");
                const viewer = await page.$("perspective-viewer");
                await page.evaluate(async element => {
                    const config = {
                        "row-pivots": ["$'Sales' + $'Profit'"],
                        "column-pivots": ["$'Sales' + $'Profit'"],
                        columns: ["Sales", "Profit", "$'Sales' + $'Profit'"],
                        expressions: ["$'Sales' + $'Profit'"]
                    };
                    await element.restore(config);
                }, viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
            });

            test.skip("On restore, expressions in filter are restored correctly.", async page => {
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                await page.waitForSelector("perspective-viewer:not([updating])");
                const viewer = await page.$("perspective-viewer");
                await page.evaluate(async element => {
                    const config = {
                        filters: [["$'Sales' + $'Profit'", ">", 100]],
                        columns: ["Sales", "Profit", "$'Sales' + $'Profit'"],
                        expressions: ["$'Sales' + $'Profit'"]
                    };
                    await element.restore(config);
                }, viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
            });

            test.skip("On restore, expressions in sort are restored correctly.", async page => {
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                await page.waitForSelector("perspective-viewer:not([updating])");
                const viewer = await page.$("perspective-viewer");
                await page.evaluate(async element => {
                    const config = {
                        sort: [["$'Sales' + $'Profit'", "desc"]],
                        columns: ["Sales", "Profit", "$'Sales' + $'Profit'"],
                        expressions: ["$'Sales' + $'Profit'"]
                    };
                    await element.restore(config);
                }, viewer);
                await page.waitForSelector("perspective-viewer:not([updating])");
            });

            test.skip("On restore, user defined aggregates are maintained on expression columns", async page => {
                await page.evaluate(async () => await document.querySelector("perspective-viewer").toggleConfig());
                const viewer = await page.$("perspective-viewer");
                await page.evaluate(async element => {
                    const config = {
                        aggregates: {"$'Sales' + $'Profit'": "mean"},
                        columns: ["Sales", "Profit", "$'Sales' + $'Profit'"],
                        expressions: ["$'Sales' + $'Profit'"],
                        "row-pivots": ["Category"]
                    };
                    await element.restore(config);
                }, viewer);
                await page.$("perspective-viewer:not([updating])");
            });
        },
        {
            root: path.join(__dirname, "..", ".."),
            name: "Expressions"
        }
    );
});
