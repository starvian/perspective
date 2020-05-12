/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */
const _ = require("underscore");

const data = {
    w: [1.5, 2.5, 3.5, 4.5],
    x: [1, 2, 3, 4],
    y: ["a", "b", "c", "d"],
    z: [true, false, true, false]
};

const get_random_int = function(min, max) {
    // liberally copied from stack
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

module.exports = perspective => {
    describe("ports", function() {
        it("Should create port IDs in incremental order", async function() {
            const table = perspective.table(data);
            const port_ids = [];
            for (let i = 0; i < 10; i++) {
                port_ids.push(await table.make_and_get_input_port());
            }
            expect(port_ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
            table.delete();
        });

        it("Should create port IDs in incremental order and allow updates on each port", async function() {
            const table = perspective.table(data);
            const port_ids = [];

            for (let i = 0; i < 10; i++) {
                port_ids.push(await table.make_and_get_input_port());
            }

            expect(port_ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

            for (const port_id of port_ids) {
                table.update(
                    {
                        w: [1.5],
                        x: [port_id],
                        y: ["d"],
                        z: [true]
                    },
                    {port_id}
                );
            }

            const view = table.view();
            const output = await view.to_columns();

            expect(await table.size()).toEqual(14);

            const expected = {
                w: [1.5, 2.5, 3.5, 4.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5],
                x: [1, 2, 3, 4, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                y: ["a", "b", "c", "d", "d", "d", "d", "d", "d", "d", "d", "d", "d", "d"],
                z: [true, false, true, false, true, true, true, true, true, true, true, true, true, true]
            };

            expect(output).toEqual(expected);

            view.delete();
            table.delete();
        });

        it("Should create port IDs in incremental order and allow updates on each port, indexed", async function() {
            const table = perspective.table(data, {index: "w"});
            const port_ids = [];

            for (let i = 0; i < 10; i++) {
                port_ids.push(await table.make_and_get_input_port());
            }

            expect(port_ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

            for (const port_id of port_ids) {
                table.update(
                    {
                        w: [1.5],
                        x: [1],
                        y: ["a"],
                        z: [true]
                    },
                    {port_id}
                );
            }

            expect(await table.size()).toEqual(4);

            const view = table.view();
            const output = await view.to_columns();
            expect(output).toEqual(data);

            view.delete();
            table.delete();
        });

        it("Should create port IDs in incremental order and allow random arbitrary updates on each port, indexed", async function() {
            const table = perspective.table(data, {index: "w"});
            const port_ids = [];

            for (let i = 0; i < 10; i++) {
                port_ids.push(await table.make_and_get_input_port());
            }

            expect(port_ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

            for (const port_id of port_ids) {
                table.update(
                    {
                        w: [1.5],
                        x: [1],
                        y: ["a"],
                        z: [true]
                    },
                    {port_id}
                );
            }

            expect(await table.size()).toEqual(4);

            const view = table.view();
            const output = await view.to_columns();
            expect(output).toEqual(data);

            // arbitarily update from a random port, force append with new pkey
            const port = get_random_int(1, 9);
            const update_data = {
                w: [5.5],
                x: [5],
                y: ["e"],
                z: [true]
            };

            table.update(update_data, {port_id: 0});

            const output2 = await view.to_columns();
            expect(output2).toEqual({
                w: [1.5, 2.5, 3.5, 4.5, 5.5],
                x: [1, 2, 3, 4, 5],
                y: ["a", "b", "c", "d", "e"],
                z: [true, false, true, false, true]
            });

            // and do it again but this time with null as pkey
            let port2 = get_random_int(1, 9);

            if (port2 === port) {
                port2 = get_random_int(1, 9);
            }

            const update_data2 = {
                w: [null],
                x: [6],
                y: ["f"],
                z: [true]
            };

            table.update(update_data2, {port_id: port2});
            const output3 = await view.to_columns();
            expect(output3).toEqual({
                w: [null, 1.5, 2.5, 3.5, 4.5, 5.5],
                x: [6, 1, 2, 3, 4, 5],
                y: ["f", "a", "b", "c", "d", "e"],
                z: [true, true, false, true, false, true]
            });

            view.delete();
            table.delete();
        });

        describe("View notifications from different ports", function() {
            it("All views should be notified by appends on all ports", async function() {
                const table = perspective.table(data);
                const port_ids = [];

                for (let i = 0; i < 10; i++) {
                    port_ids.push(await table.make_and_get_input_port());
                }

                expect(port_ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

                const view = table.view();

                const view2 = table.view({
                    row_pivots: ["w"]
                });

                const view3 = table.view({
                    row_pivots: ["w"],
                    column_pivots: ["x"]
                });

                for (const port_id of port_ids) {
                    table.update(
                        {
                            w: [1.5],
                            x: [port_id],
                            y: ["d"],
                            z: [true]
                        },
                        {port_id}
                    );
                }

                const output = await view.to_columns();

                expect(await table.size()).toEqual(14);

                const expected = {
                    w: [1.5, 2.5, 3.5, 4.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5],
                    x: [1, 2, 3, 4, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                    y: ["a", "b", "c", "d", "d", "d", "d", "d", "d", "d", "d", "d", "d", "d"],
                    z: [true, false, true, false, true, true, true, true, true, true, true, true, true, true]
                };

                expect(output).toEqual(expected);

                const output2 = await view2.to_columns();
                expect(output2).toEqual({
                    __ROW_PATH__: [[], [1.5], [2.5], [3.5], [4.5]],
                    w: [27, 16.5, 2.5, 3.5, 4.5],
                    x: [65, 56, 2, 3, 4],
                    y: [14, 11, 1, 1, 1],
                    z: [14, 11, 1, 1, 1]
                });

                const output3 = await view3.to_columns();
                expect(output3).toEqual({
                    __ROW_PATH__: [[], [1.5], [2.5], [3.5], [4.5]],
                    "1|w": [3, 3, null, null, null],
                    "1|x": [2, 2, null, null, null],
                    "1|y": [2, 2, null, null, null],
                    "1|z": [2, 2, null, null, null],
                    "2|w": [4, 1.5, 2.5, null, null],
                    "2|x": [4, 2, 2, null, null],
                    "2|y": [2, 1, 1, null, null],
                    "2|z": [2, 1, 1, null, null],
                    "3|w": [5, 1.5, null, 3.5, null],
                    "3|x": [6, 3, null, 3, null],
                    "3|y": [2, 1, null, 1, null],
                    "3|z": [2, 1, null, 1, null],
                    "4|w": [6, 1.5, null, null, 4.5],
                    "4|x": [8, 4, null, null, 4],
                    "4|y": [2, 1, null, null, 1],
                    "4|z": [2, 1, null, null, 1],
                    "5|w": [1.5, 1.5, null, null, null],
                    "5|x": [5, 5, null, null, null],
                    "5|y": [1, 1, null, null, null],
                    "5|z": [1, 1, null, null, null],
                    "6|w": [1.5, 1.5, null, null, null],
                    "6|x": [6, 6, null, null, null],
                    "6|y": [1, 1, null, null, null],
                    "6|z": [1, 1, null, null, null],
                    "7|w": [1.5, 1.5, null, null, null],
                    "7|x": [7, 7, null, null, null],
                    "7|y": [1, 1, null, null, null],
                    "7|z": [1, 1, null, null, null],
                    "8|w": [1.5, 1.5, null, null, null],
                    "8|x": [8, 8, null, null, null],
                    "8|y": [1, 1, null, null, null],
                    "8|z": [1, 1, null, null, null],
                    "9|w": [1.5, 1.5, null, null, null],
                    "9|x": [9, 9, null, null, null],
                    "9|y": [1, 1, null, null, null],
                    "9|z": [1, 1, null, null, null],
                    "10|w": [1.5, 1.5, null, null, null],
                    "10|x": [10, 10, null, null, null],
                    "10|y": [1, 1, null, null, null],
                    "10|z": [1, 1, null, null, null]
                });

                view3.delete();
                view2.delete();
                view.delete();
                table.delete();
            });

            it("All views should be notified by partial updates on all ports", async function() {
                const table = perspective.table(data, {index: "w"});
                const port_ids = [];

                for (let i = 0; i < 10; i++) {
                    port_ids.push(await table.make_and_get_input_port());
                }

                expect(port_ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

                const view = table.view();

                const view2 = table.view({
                    row_pivots: ["w"]
                });

                const view3 = table.view({
                    row_pivots: ["w"],
                    column_pivots: ["x"]
                });

                for (const port_id of port_ids) {
                    table.update(
                        {
                            w: [1.5],
                            x: [port_id],
                            y: ["d"],
                            z: [false]
                        },
                        {port_id}
                    );
                }

                const output = await view.to_columns();

                expect(await table.size()).toEqual(4);

                const expected = {
                    w: [1.5, 2.5, 3.5, 4.5],
                    x: [10, 2, 3, 4],
                    y: ["d", "b", "c", "d"],
                    z: [false, false, true, false]
                };

                expect(output).toEqual(expected);

                const output2 = await view2.to_columns();
                expect(output2).toEqual({
                    __ROW_PATH__: [[], [1.5], [2.5], [3.5], [4.5]],
                    w: [12, 1.5, 2.5, 3.5, 4.5],
                    x: [19, 10, 2, 3, 4],
                    y: [4, 1, 1, 1, 1],
                    z: [4, 1, 1, 1, 1]
                });

                const output3 = await view3.to_columns();
                expect(output3).toEqual({
                    __ROW_PATH__: [[], [1.5], [2.5], [3.5], [4.5]],
                    "2|w": [2.5, null, 2.5, null, null],
                    "2|x": [2, null, 2, null, null],
                    "2|y": [1, null, 1, null, null],
                    "2|z": [1, null, 1, null, null],
                    "3|w": [3.5, null, null, 3.5, null],
                    "3|x": [3, null, null, 3, null],
                    "3|y": [1, null, null, 1, null],
                    "3|z": [1, null, null, 1, null],
                    "4|w": [4.5, null, null, null, 4.5],
                    "4|x": [4, null, null, null, 4],
                    "4|y": [1, null, null, null, 1],
                    "4|z": [1, null, null, null, 1],
                    "10|w": [1.5, 1.5, null, null, null],
                    "10|x": [10, 10, null, null, null],
                    "10|y": [1, 1, null, null, null],
                    "10|z": [1, 1, null, null, null]
                });

                view3.delete();
                view2.delete();
                view.delete();
                table.delete();
            });
        });

        describe("on_update notifications from different ports", function() {
            it("All calls to on_update should contain the port ID", async function(done) {
                const table = perspective.table(data);
                const port_ids = [];

                for (let i = 0; i < 10; i++) {
                    port_ids.push(await table.make_and_get_input_port());
                }

                expect(port_ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

                const view = table.view();

                let last_port_id = 0;
                view.on_update(function(updated) {
                    expect(updated.port_id).toEqual(last_port_id);
                    if (last_port_id == 10) {
                        view.delete();
                        table.delete();
                        done();
                    } else {
                        last_port_id++;
                    }
                });

                for (const port_id of port_ids) {
                    table.update(
                        {
                            w: [1.5],
                            x: [1],
                            y: ["a"],
                            z: [true]
                        },
                        {port_id}
                    );
                }
            });

            it("All ports should be notified in on_update regardless of which port was updated.", async function(done) {
                const table = perspective.table(data);
                const port_ids = [];

                for (let i = 0; i < 10; i++) {
                    port_ids.push(await table.make_and_get_input_port());
                }

                expect(port_ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

                const view = table.view();

                let last_port_id = 0;
                view.on_update(function(updated) {
                    expect(updated.port_id).toEqual(last_port_id);
                    if (last_port_id == 10) {
                        view.delete();
                        table.delete();
                        done();
                    } else {
                        last_port_id++;
                    }
                });

                const port_id = get_random_int(1, 9);
                table.update(
                    {
                        w: [1.5],
                        x: [1],
                        y: ["a"],
                        z: [true]
                    },
                    {port_id}
                );
            });

            it("All ports should be notified in creation order, regardless of what order the update is called.", async function(done) {
                const table = perspective.table(data);
                const port_ids = [];

                for (let i = 0; i < 10; i++) {
                    port_ids.push(await table.make_and_get_input_port());
                }

                expect(port_ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

                const view = table.view();

                let last_port_id = 0;
                let num_updates = 0;

                view.on_update(function(updated) {
                    expect(updated.port_id).toEqual(last_port_id);
                    if (last_port_id == 10 && num_updates === 10) {
                        view.delete();
                        table.delete();
                        done();
                    } else {
                        num_updates++;
                        last_port_id++;
                    }
                });

                const update_order = _.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

                for (const port_id of update_order) {
                    table.update(
                        {
                            w: [1.5],
                            x: [1],
                            y: ["a"],
                            z: [true]
                        },
                        {port_id}
                    );
                }
            });

            it("On update callbacks should be able to ignore updates from certain ports.", async function(done) {
                const table = perspective.table(data);
                const update_table = perspective.table(await table.schema());
                const port_ids = [];

                for (let i = 0; i < 10; i++) {
                    port_ids.push(await table.make_and_get_input_port());
                }

                expect(port_ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

                const view = table.view();

                let last_port_id = 0;
                let num_updates = 0;

                view.on_update(
                    async function(updated) {
                        expect(updated.port_id).toEqual(last_port_id);

                        if (![0, 5, 7, 8, 9].includes(updated.port_id)) {
                            update_table.update(updated.delta);
                        }

                        if (last_port_id == 10 && num_updates === 10) {
                            expect(await update_table.size()).toEqual(6);
                            const update_view = update_table.view();
                            const result = await update_view.to_columns();
                            expect(result).toEqual({
                                w: [1.5, 1.5, 1.5, 1.5, 1.5, 1.5],
                                x: [1, 2, 3, 4, 6, 10],
                                y: ["a", "a", "a", "a", "a", "a"],
                                z: [true, true, true, true, true, true]
                            });
                            update_view.delete();
                            update_table.delete();
                            view.delete();
                            table.delete();
                            done();
                        } else {
                            num_updates++;
                            last_port_id++;
                        }
                    },
                    {mode: "row"}
                );

                const update_order = _.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

                for (const port_id of update_order) {
                    table.update(
                        {
                            w: [1.5],
                            x: [port_id],
                            y: ["a"],
                            z: [true]
                        },
                        {port_id}
                    );
                }
            });
        });
    });
};
