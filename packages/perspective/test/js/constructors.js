/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

import _  from "underscore";
import papaparse from "papaparse";
import moment from "moment";

var data = [
    {'x': 1, 'y':'a', 'z': true},
    {'x': 2, 'y':'b', 'z': false},
    {'x': 3, 'y':'c', 'z': true},
    {'x': 4, 'y':'d', 'z': false}
];

var meta = {
    'x': "integer",
    'y': "string",
    'z': "boolean"
};

var data_2 = [
    {'x': 3, 'y':'c', 'z': false},
    {'x': 4, 'y':'d', 'z': true},
    {'x': 5, 'y':'g', 'z': false},
    {'x': 6, 'y':'h', 'z': true},
];

var data_3 = [
    {'w': 1.5, 'x': 1, 'y':'a', 'z': true},
    {'w': 2.5, 'x': 2, 'y':'b', 'z': false},
    {'w': 3.5, 'x': 3, 'y':'c', 'z': true},
    {'w': 4.5, 'x': 4, 'y':'d', 'z': false}
];

var meta_3 = {
    'w': 'float',
    'x': "integer",
    'y': "string",
    'z': "boolean"
};

import arrow from "../arrow/test-null.arrow";

var arrow_result = [
    {"f32": 1.5, "f64": 1.5, "i64": 1, "i32": 1, "i16": 1, "i8": 1, "bool": true,  "char": "a", "dict": "a", "datetime": +(new Date("2018-01-25"))},
    {"f32": 2.5, "f64": 2.5, "i64": 2, "i32": 2, "i16": 2, "i8": 2, "bool": false, "char": "b", "dict": "b", "datetime": +(new Date("2018-01-26"))},
    {"f32": 3.5, "f64": 3.5, "i64": 3, "i32": 3, "i16": 3, "i8": 3, "bool": true,  "char": "c", "dict": "c", "datetime": +(new Date("2018-01-27"))},
    {"f32": 4.5, "f64": 4.5, "i64": 4, "i32": 4, "i16": 4, "i8": 4, "bool": false, "char": "d", "dict": "d", "datetime": +(new Date("2018-01-28"))},
    {"f32": null, "f64": null, "i64": null, "i32": null, "i16": null, "i8": null, "bool": null,  "char": null, "dict": null, "datetime": null}
];

var dt = new Date();
var data_4 = [
   {'v': dt}
];

var data_5 = [
    {'v': '11-09-2017'}
];

var meta_4 = {'v' : 'date'};

var csv = "x,y,z\n1,a,true\n2,b,false\n3,c,true\n4,d,false";

module.exports = (perspective) => {

 describe("Execute", function () {

    it("serialized functions in a worker", async function () {
            var table = perspective.table({
                'x': "integer",
                'y': "string",
                'z': "boolean"
            });
            table.execute(t => {
                t.update([
                    {'x': 1, 'y':'a', 'z': true},
                    {'x': 2, 'y':'b', 'z': false},
                    {'x': 3, 'y':'c', 'z': true},
                    {'x': 4, 'y':'d', 'z': false}
                ]);
            });
            let js = await table.view({}).to_json();
            expect(js).toEqual([
                {'x': 1, 'y':'a', 'z': true},
                {'x': 2, 'y':'b', 'z': false},
                {'x': 3, 'y':'c', 'z': true},
                {'x': 4, 'y':'d', 'z': false}
            ]);
        });

    });   

    describe("Constructors", function() {

        it("JSON constructor", async function () {
            var table = perspective.table(data);
            var view = table.view();
            let result = await view.to_json();
            expect(data).toEqual(result);
        });

        it("Arrow constructor", async function () {
            var table = perspective.table(arrow);
            var view = table.view();
            let result = await view.to_json();
            expect(arrow_result).toEqual(result);
        });

        it("CSV constructor", async function () {
            var table = perspective.table(csv);
            var view = table.view();
            let result = await view.to_json();
            expect(papaparse.parse(csv, {header: true, dynamicTyping: true}).data).toEqual(result);
        });

        it("Meta constructor", async function () {
            var table = perspective.table(meta);
            var view = table.view();
            let result = await view.to_json();
            expect([]).toEqual(result);
        });

        it("Handles floats", async function () {
            var table = perspective.table(data_3);
            var view = table.view();
            let result = await view.to_json();
            expect(data_3).toEqual(result);
        });

        it("has correct size", async function () {
            var table = perspective.table(data);
            let result = await table.size();
            expect(result).toEqual(4);
        });

        it("has a schema", async function () {
            var table = perspective.table(data);
            let result = await table.schema();
            expect(result).toEqual(meta);
        });

        it("has columns", async function () {
            var table = perspective.table(data);
            let result = await table.columns();
            expect(result).toEqual(['x', 'y', 'z']);
        });

        it("Handles floats schemas", async function () {
            var table = perspective.table(data_3);
            let result = await table.schema();
            expect(meta_3).toEqual(result);
        });

        it("Generates correct date schemas", async function () {
            var table = perspective.table(data_4);
            let result = await table.schema();
            expect(meta_4).toEqual(result);
        });

        it("Handles date udpates when constructed from a schema", async function () {
            var table = perspective.table(meta_4);
            table.update(data_4)
            let result = await table.view({}).to_json();
            expect([{'v': +data_4[0]['v']}]).toEqual(result);
        });

        it("Handles date values", async function () {
            var table = perspective.table(data_4);
            let result2 = await table.view({}).to_json();
            expect([{'v': +data_4[0]['v']}]).toEqual(result2);
        });

        it("Handles date strings", async function () {
            var table = perspective.table(data_5);
            let result2 = await table.view({}).to_json();
            expect([{'v': +(moment(data_5[0]['v'], "MM-DD-YYYY"))}]).toEqual(result2);
        });


    });


};

