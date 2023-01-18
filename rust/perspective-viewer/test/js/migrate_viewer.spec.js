/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

const { convert } = require("../../dist/cjs/migrate.js");
const utils = require("@finos/perspective-test");
const path = require("path");

async function get_contents(page) {
    return await page.evaluate(async () => {
        const plugin = document.querySelector("perspective-viewer").children[0];
        if (plugin.tagName === "PERSPECTIVE-VIEWER-DATAGRID") {
            return plugin?.innerHTML || "MISSING";
        } else {
            return (
                plugin?.shadowRoot?.querySelector("#container")?.innerHTML ||
                "MISSING"
            );
        }
    });
}

const TESTS = [
    [
        "Bucket by year",
        {
            columns: ["Sales"],
            plugin: "d3_y_area",
            "computed-columns": ['month_bucket("Order Date")'],
            "row-pivots": ["month_bucket(Order Date)"],
            "column-pivots": ["Ship Mode"],
            filters: [["Category", "==", "Office Supplies"]],
            selectable: null,
            editable: null,
            aggregates: null,
            sort: null,
            plugin_config: {},
        },
        {
            plugin: "Y Area",
            plugin_config: {},
            group_by: ["bucket(\"Order Date\", 'M')"],
            split_by: ["Ship Mode"],
            columns: ["Sales"],
            filter: [["Category", "==", "Office Supplies"]],
            sort: [],
            expressions: ["bucket(\"Order Date\", 'M')"],
            aggregates: {},
        },
    ],
    [
        "Plugin config color mode",
        {
            columns: ["Sales"],
            plugin: "datagrid",
            "computed-columns": [],
            "row-pivots": [],
            "column-pivots": [],
            filters: [],
            selectable: null,
            editable: null,
            aggregates: null,
            sort: null,
            plugin_config: { Sales: { color_mode: "gradient", gradient: 10 } },
        },
        {
            plugin: "Datagrid",
            plugin_config: {
                columns: {
                    Sales: { number_bg_mode: "gradient", bg_gradient: 10 },
                },
                editable: false,
                scroll_lock: true,
            },
            group_by: [],
            split_by: [],
            columns: ["Sales"],
            filter: [],
            sort: [],
            expressions: [],
            aggregates: {},
        },
    ],
    [
        "New Datagrid style API",
        {
            plugin: "Datagrid",
            plugin_config: {
                columns: {
                    Sales: { number_color_mode: "gradient", gradient: 10 },
                },
                editable: false,
                scroll_lock: true,
            },
            group_by: [],
            split_by: [],
            columns: ["Sales"],
            filter: [],
            sort: [],
            expressions: [],
            aggregates: {},
        },
        {
            plugin: "Datagrid",
            plugin_config: {
                columns: {
                    Sales: {
                        bg_gradient: 10,
                        number_bg_mode: "gradient",
                    },
                },
                editable: false,
                scroll_lock: true,
            },
            group_by: [],
            split_by: [],
            columns: ["Sales"],
            filter: [],
            sort: [],
            expressions: [],
            aggregates: {},
        },
    ],
    [
        "New Datagrid style API with a bar and gradient",
        {
            plugin: "Datagrid",
            plugin_config: {
                columns: {
                    Sales: {
                        number_color_mode: "bar",
                        gradient: 10,
                        pos_color: "#115599",
                        neg_color: "#115599",
                    },
                },
                editable: false,
                scroll_lock: true,
            },
            group_by: [],
            split_by: [],
            columns: ["Sales"],
            filter: [],
            sort: [],
            expressions: [],
            aggregates: {},
        },
        {
            plugin: "Datagrid",
            plugin_config: {
                columns: {
                    Sales: {
                        fg_gradient: 10,
                        number_fg_mode: "bar",
                        neg_fg_color: "#115599",
                        pos_fg_color: "#115599",
                    },
                },
                editable: false,
                scroll_lock: true,
            },
            group_by: [],
            split_by: [],
            columns: ["Sales"],
            filter: [],
            sort: [],
            expressions: [],
            aggregates: {},
        },
    ],
    [
        "New API, reflexive (new API is unmodified)",
        {
            plugin: "Datagrid",
            plugin_config: {
                columns: {
                    Discount: {
                        neg_bg_color: "#780aff",
                        number_bg_mode: "color",
                        number_fg_mode: "disabled",
                        pos_bg_color: "#f5ac0f",
                    },
                    Profit: {
                        neg_bg_color: "#f50fed",
                        number_bg_mode: "color",
                        number_fg_mode: "disabled",
                        pos_bg_color: "#32cd82",
                    },
                    Sales: {
                        neg_bg_color: "#f5ac0f",
                        number_bg_mode: "color",
                        number_fg_mode: "disabled",
                        pos_bg_color: "#780aff",
                    },
                },
                editable: false,
                scroll_lock: true,
            },
            columns: [
                "Category",
                "Sales",
                "Discount",
                "Profit",
                "Sub-Category",
                "Order Date",
            ],
            sort: [["Sub-Category", "desc"]],
            aggregates: {},
            filter: [],
            group_by: [],
            expressions: [],
            split_by: [],
        },
        {
            plugin: "Datagrid",
            plugin_config: {
                columns: {
                    Discount: {
                        neg_bg_color: "#780aff",
                        number_bg_mode: "color",
                        number_fg_mode: "disabled",
                        pos_bg_color: "#f5ac0f",
                    },
                    Profit: {
                        neg_bg_color: "#f50fed",
                        number_bg_mode: "color",
                        number_fg_mode: "disabled",
                        pos_bg_color: "#32cd82",
                    },
                    Sales: {
                        neg_bg_color: "#f5ac0f",
                        number_bg_mode: "color",
                        number_fg_mode: "disabled",
                        pos_bg_color: "#780aff",
                    },
                },
                editable: false,
                scroll_lock: true,
            },
            columns: [
                "Category",
                "Sales",
                "Discount",
                "Profit",
                "Sub-Category",
                "Order Date",
            ],
            sort: [["Sub-Category", "desc"]],
            aggregates: {},
            filter: [],
            group_by: [],
            expressions: [],
            split_by: [],
        },
    ],
];

utils.with_server({}, () => {
    describe(
        "Viewer config migrations",
        () => {
            for (const [name, old, current] of TESTS) {
                test(`Migrate '${name}'`, () => {
                    expect(convert(old, { replace_defaults: true })).toEqual(
                        current
                    );
                });
            }
        },
        { root: path.join(__dirname, "..", "..") }
    );

    describe.page(
        "superstore-all.html",
        () => {
            describe("migrate", () => {
                for (const [name, old, current] of TESTS) {
                    test.skip(`restore '${name}'`, async (page) => {
                        const converted = convert(
                            JSON.parse(JSON.stringify(old))
                        );
                        const config = await page.evaluate(async (old) => {
                            const viewer =
                                document.querySelector("perspective-viewer");
                            await viewer.getTable();
                            old.settings = true;
                            await viewer.restore(old);
                            const current = await viewer.save();
                            current.settings = false;
                            return current;
                        }, converted);

                        expect(config.theme).toEqual("Material Light");
                        delete config["theme"];

                        expect(config.settings).toEqual(false);
                        delete config.settings;

                        expect(config).toEqual(current);
                        expect(
                            convert(old, { replace_defaults: true })
                        ).toEqual(current);
                        return await get_contents(page);
                    });
                }
            });
        },
        { root: path.join(__dirname, "..", "..") }
    );
});
