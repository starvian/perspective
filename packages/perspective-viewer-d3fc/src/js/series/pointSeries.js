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
import {tooltip} from "../tooltip/tooltip";
import {groupFromKey} from "../series/seriesKey";

const symbols = [d3.symbolCircle, d3.symbolCross, d3.symbolDiamond, d3.symbolSquare, d3.symbolStar, d3.symbolTriangle, d3.symbolWye];

export function pointSeries(settings, seriesKey, size, colour, symbols) {
    let series = fc
        .seriesSvgPoint()
        .crossValue(d => d.x)
        .mainValue(d => d.y);

    if (size) {
        series.size(d => size(d.size));
    }
    if (symbols) {
        series.type(symbols(seriesKey));
    }

    series.decorate(selection => {
        tooltip()(selection, settings);
        if (colour) {
            selection.style("stroke", () => withOutOpacity(colour(seriesKey))).style("fill", () => colour(seriesKey));
        }
    });

    return series;
}

function withOutOpacity(colour) {
    const lastComma = colour.lastIndexOf(",");
    return lastComma !== -1 ? `${colour.substring(0, lastComma)})` : colour;
}

export function symbolTypeFromGroups(settings) {
    const col = settings.data && settings.data.length > 0 ? settings.data[0] : {};
    const domain = [];
    Object.keys(col).forEach(key => {
        if (key !== "__ROW_PATH__") {
            const group = groupFromKey(key);
            if (!domain.includes(group)) {
                domain.push(group);
            }
        }
    });
    return fromDomain(domain);
}

function fromDomain(domain) {
    return domain.length > 1
        ? d3
              .scaleOrdinal()
              .domain(domain)
              .range(symbols)
        : null;
}
