/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */
import { seriesCanvasPoint } from "d3fc";
import { withOpacity, withoutOpacity } from "./seriesColors";
import { groupFromKey } from "./seriesKey";
import { fromDomain } from "./seriesSymbols";
import { toValue } from "../tooltip/selectionData";

export function pointSeriesCanvas(
    settings,
    seriesKey,
    size,
    color,
    label,
    symbols,
    scale_factor = 1
) {
    let series = seriesCanvasPoint()
        .crossValue((d) => d.x)
        .mainValue((d) => d.y);

    if (size) {
        series.size((d) => Math.round(scale_factor * size(d.size)));
    }
    if (symbols) {
        series.type(symbols(seriesKey));
    }

    series.decorate((context, d) => {
        const colorValue = color(
            d.colorValue !== undefined ? d.colorValue : seriesKey
        );
        const opacity = settings.colorStyles && settings.colorStyles.opacity;

        if (label) {
            context.fillStyle = settings.textStyles.color;
            context.font = settings.textStyles.font;
            const { type } = settings.mainValues.find((x) => x.name === label);
            const value = toValue(type, d.row[label]);
            const offset = size
                ? Math.round(scale_factor * size(d.size)) * (15 / 1000) + 10
                : 10;

            context.fillText(value, offset, 4);
        }

        context.strokeStyle = withoutOpacity(colorValue);
        context.fillStyle = withOpacity(colorValue, opacity);
    });

    return series;
}

export function symbolTypeFromGroups(settings) {
    const col =
        settings.data && settings.data.length > 0 ? settings.data[0] : {};
    const domain = [];
    Object.keys(col).forEach((key) => {
        if (key !== "__ROW_PATH__") {
            const group = groupFromKey(key);
            if (!domain.includes(group)) {
                domain.push(group);
            }
        }
    });
    return fromDomain(domain);
}
