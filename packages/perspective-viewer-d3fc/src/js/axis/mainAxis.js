/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */
import * as d3 from "d3";
import * as fc from "d3fc";
import {linearExtent} from "../d3fc/extent/extent";

export const scale = () => d3.scaleLinear();

export const domain = () => {
    let valueName = "mainValue";

    const extentLinear = linearExtent()
        .pad([0, 0.1])
        .padUnit("percent");

    const _domain = function(data) {
        const extent = getDataExtentFromArray(data, valueName);
        return extentLinear(extent);
    };

    fc.rebindAll(_domain, extentLinear);

    _domain.valueName = (...args) => {
        if (!args.length) {
            return valueName;
        }
        valueName = args[0];
        return _domain;
    };

    return _domain;
};

const getDataExtentFromArray = (array, valueName) => {
    const dataExtent = array.map(v => getDataExtentFromValue(v, valueName));
    const extent = flattenExtent(dataExtent);
    return extent;
};

const getDataExtentFromValue = (value, valueName) => {
    if (Array.isArray(value)) {
        return getDataExtentFromArray(value, valueName);
    }
    return [value[valueName], value[valueName]];
};

export const label = settings => settings.mainValues.map(v => v.name).join(", ");

function flattenExtent(array) {
    const withUndefined = fn => (a, b) => {
        if (a === undefined) return b;
        if (b === undefined) return a;
        return fn(a, b);
    };
    return array.reduce((r, v) => [withUndefined(Math.min)(r[0], v[0]), withUndefined(Math.max)(r[1], v[1])], [undefined, undefined]);
}

export const styleAxis = (chart, prefix, settings) => {
    chart[`${prefix}Label`](label(settings));
};
