/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */
import {color, rgb} from "d3-color";

export const computedStyle = (container) => {
    if (window.ShadyCSS) {
        return (name, defaultValue) =>
            window.ShadyCSS.getComputedStyleValue(container, name) ||
            defaultValue;
    } else {
        const containerStyles = getComputedStyle(container);
        return (name, defaultValue) =>
            containerStyles.getPropertyValue(name) || defaultValue;
    }
};

export const toFillAndStroke = (col) => {
    const asColor = color(col);
    const stroke = `${asColor}`;
    asColor.opacity = 0.5;
    const fill = `${asColor}`;

    return {stroke, fill};
};

export const lightenRgb = (col, lighten) => {
    const source = Array.isArray(col) ? rgb(col) : color(col);
    const target = source.brighter(lighten);
    return `${target}`;
};
