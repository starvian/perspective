/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

import {getOrCreateElement} from "../../utils/utils";
import template from "../../../html/parent-controls.html";

export function parentControls(container) {
    let onClick = null;
    let text = null;
    let hide = true;

    const parent = getOrCreateElement(container, ".parent-controls", () =>
        container
            .append("div")
            .attr("class", "parent-controls")
            .style("display", hide ? "none" : "")
            .html(template)
    );

    const controls = () => {
        parent
            .style("display", hide ? "none" : "")
            .select("#goto-parent")
            .html(`⇪ ${text}`)
            .on("click", () => onClick());
    };

    controls.hide = (...args) => {
        if (!args.length) {
            return hide;
        }
        hide = args[0];
        return controls;
    };

    controls.text = (...args) => {
        if (!args.length) {
            return text;
        }
        text = args[0];
        return controls;
    };

    controls.onClick = (...args) => {
        if (!args.length) {
            return onClick;
        }
        onClick = args[0];
        return controls;
    };

    return controls;
}
