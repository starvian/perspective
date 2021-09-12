/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

import getCellConfig from "./getCellConfig";

async function clickListener(table, viewer, event) {
    const meta = table.getMeta(event.target);
    if (!meta) return;
    const {x, y} = meta;

    const {row, column_names, config} = await getCellConfig(this, y, x);

    viewer.dispatchEvent(
        new CustomEvent("perspective-click", {
            bubbles: true,
            composed: true,
            detail: {
                row,
                column_names,
                config,
            },
        })
    );
}

export function configureClick(table, viewer) {
    table.addEventListener("click", clickListener.bind(this, table, viewer));
}
