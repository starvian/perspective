/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

import papaparse from "papaparse";

const jsonFormatter = {
    initDataValue: () => [],
    initRowValue: () => ({}),
    initColumnValue: (data, row, colName) => row[colName] = [],
    setColumnValue: (data, row, colName, value) => row[colName] = value,
    addColumnValue: (data, row, colName, value) => row[colName].unshift(value),
    addRow: (data, row) => data.push(row),
    formatData: data => data,
    slice: (data, start, length) => data.slice(start, length)
};

const csvFormatter = Object.assign({}, jsonFormatter, {
    formatData: (data, config) => papaparse.unparse(data, config)
});

const jsonTableFormatter = {
    initDataValue: () => new Object(),
    initRowValue: () => {},
    setColumnValue: (data, row, colName, value) => {
        data[colName] = data[colName] || [];
        data[colName].push(value)
    },
    addColumnValue: (data, row, colName, value) => {
        data[colName] = data[colName] || [];
        data[colName][data[colName].length - 1].unshift(value);
    },
    initColumnValue: (data, row, colName) => {
        data[colName] = data[colName] || [];
        data[colName].push([]);
    },
    addRow: (data, row) => {},
    formatData: data => data,
    slice: (data, start, length) => {
        for (let x in data) {
            data[x].splice(start, length);
        }
        return data;
    }
}

export default {
    jsonFormatter,
    jsonTableFormatter,
    csvFormatter
};
