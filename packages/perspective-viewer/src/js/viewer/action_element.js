/******************************************************************************
 *
 * Copyright (c) 2018, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

import {dragend, column_dragend, column_dragleave, column_dragover, column_drop, drop, dragenter, dragover, dragleave} from "./dragdrop.js";
import {DomElement} from "./dom_element.js";
import {findExpressionByAlias, throttlePromise} from "../utils.js";

export class ActionElement extends DomElement {
    async _toggle_config(event) {
        if (!event || event.button !== 2) {
            this._show_config = !this._show_config;
            const panel = this.shadowRoot.querySelector("#pivot_chart_container");
            if (!this._show_config) {
                await this._pre_resize(
                    panel.clientWidth + this._side_panel().clientWidth,
                    panel.clientHeight + this._top_panel.clientHeight,
                    () => {
                        this._app.classList.remove("settings-open");
                        this.removeAttribute("settings");
                    },
                    () => this.dispatchEvent(new CustomEvent("perspective-toggle-settings", {detail: this._show_config}))
                );
            } else {
                await this._post_resize(
                    () => {
                        this.toggleAttribute("settings", true);
                    },
                    () => {
                        this._app.classList.add("settings-open");
                        this.dispatchEvent(new CustomEvent("perspective-toggle-settings", {detail: this._show_config}));
                    }
                );
            }
        }
    }

    /**
     * Given a targe `width` and `height`, pre-size the plugin before modifying
     * the HTML to reduce visual tearing.
     *
     * @private
     * @param {*} width
     * @param {*} height
     * @param {*} post Function to run once action is complete
     * @param {*} [pre=undefined] Function to run once visual effects have been
     * applied.  This may be before `post`, as pre-sizing will be delayed when
     * the target size is a sub-window of the current view.
     * @memberof ActionElement
     */
    async _pre_resize(width, height, post, pre = undefined) {
        this._datavis.style.width = `${width}px`;
        this._datavis.style.height = `${height}px`;
        try {
            if (!document.hidden && this.offsetParent) {
                let plugin = await this._vieux.get_plugin();
                await plugin.resize();
            }
        } finally {
            pre?.();
            this._datavis.style.width = "100%";
            this._datavis.style.height = "100%";
            post();
        }
    }

    async _post_resize(post, pre) {
        pre?.();
        try {
            if (!document.hidden && this.offsetParent) {
                let plugin = await this._vieux.get_plugin();
                await plugin.resize();
            }
        } finally {
            post();
        }
    }

    /**
     * Display the expressions editor.
     *
     * @param {*} event
     */
    _open_expression_editor(event) {
        event.stopImmediatePropagation();
        this._vieux._open_expression_editor(this._add_expression_button);
        this._add_expression_button.classList.toggle("expr_editor_open", true);
    }

    _close_expression_editor(event) {
        event.stopImmediatePropagation();
        this._add_expression_button.classList.toggle("expr_editor_open", false);
    }

    _save_expression(expression) {
        const expressions = this._get_view_expressions();
        expressions.push(expression);
        this.setAttribute("expressions", JSON.stringify(expressions));
    }

    async _type_check_expression(event) {
        const {expression, alias} = event.detail;
        const expressions = this._get_view_expressions();
        const is_duplicate = findExpressionByAlias(alias, expressions);

        if (expressions.includes(expression) || is_duplicate) {
            console.warn(`Cannot apply duplicate expression: "${expression}"`);
            const result = {
                expression_schema: {},
                errors: {}
            };
            result.errors[alias] = "Value Error - Cannot apply duplicate expression.";
            this._expression_editor.type_check_expression(result);
            return;
        }

        if (!expression || expression.length === 0) {
            this._expression_editor.type_check_expression({});
            return;
        }

        this._expression_editor.type_check_expression(await this._table.validate_expressions([expression]));
    }

    @throttlePromise
    async _column_visibility_clicked(_ev) {
        const parent = _ev.currentTarget;
        const shiftKey = _ev.detail.shiftKey;
        let plugin = await this._vieux.get_plugin();
        if (!parent || !parent.parentElement) {
            return;
        }

        const is_active = parent.parentElement.getAttribute("id") === "active_columns";

        if (is_active) {
            const min_columns = plugin.initial?.count || 1;
            if (this._get_view_active_valid_column_count() === min_columns) {
                return;
            }
            if (shiftKey) {
                for (let child of Array.prototype.slice.call(this._active_columns.children)) {
                    if (child !== parent) {
                        this._active_columns.removeChild(child);
                    }
                }
            } else {
                const index = Array.prototype.slice.call(this._active_columns.children).indexOf(parent);
                if (index < plugin.initial?.count) {
                    return;
                } else if (index < plugin.initial?.names?.length - 1) {
                    this._active_columns.insertBefore(this._new_row(null), parent);
                }
                this._active_columns.removeChild(parent);
            }
        } else {
            if ((shiftKey && plugin.selectMode === "toggle") || (!shiftKey && plugin.selectMode === "select")) {
                for (let child of Array.prototype.slice.call(this._active_columns.children)) {
                    this._active_columns.removeChild(child);
                }
            }
            let row = this._new_row(parent.getAttribute("name"), parent.getAttribute("type"), undefined, undefined, undefined, parent.getAttribute("expression"));
            const cols = this._get_view_active_columns();
            let i = cols.length - 1;
            if (!cols[i] || !cols[i]?.classList.contains("null-column")) {
                this._active_columns.appendChild(row);
            } else
                while (i-- > 0) {
                    if (!cols[i].classList.contains("null-column")) {
                        this._active_columns.replaceChild(row, cols[i + 1]);
                        break;
                    }
                }
        }
        this._check_responsive_layout();
        this._update_column_view();
    }

    _column_aggregate_clicked() {
        let aggregates = this.get_aggregate_attribute();
        let new_aggregates = this._get_view_aggregates();
        for (let aggregate of aggregates) {
            let updated_agg = new_aggregates.find(x => x.column === aggregate.column);
            if (updated_agg) {
                aggregate.op = updated_agg.op;
            }
        }
        this.set_aggregate_attribute(aggregates);
        this._update_column_view();
        this._debounce_update();
    }

    _column_filter_clicked() {
        let new_filters = this._get_view_filters();
        this._updating_filter = true;
        this.setAttribute("filters", JSON.stringify(new_filters));
        this._updating_filter = false;
        this._debounce_update();
    }

    _increment_sort(sort, column_sorting, abs_sorting) {
        let sort_orders = ["asc", "desc"];
        if (column_sorting) {
            sort_orders.push("col asc", "col desc");
        }
        if (abs_sorting) {
            sort_orders = sort_orders.map(x => `${x} abs`);
        }
        sort_orders.push("none");
        return sort_orders[(sort_orders.indexOf(sort) + 1) % sort_orders.length];
    }

    _sort_order_clicked(event) {
        const row = event.target;
        const abs_sorting = event.detail.shiftKey && row.getAttribute("type") !== "string";
        const new_sort_order = this._increment_sort(row.getAttribute("sort-order"), this._get_view_column_pivots().length > 0, abs_sorting);
        row.setAttribute("sort-order", new_sort_order);

        const sort = this._get_view_sorts();
        this.setAttribute("sort", JSON.stringify(sort));
    }

    // edits state
    _transpose() {
        const has_row = this.hasAttribute("row-pivots");
        const has_col = this.hasAttribute("column-pivots");
        if (has_row && has_col) {
            let row_pivots = this.getAttribute("row-pivots");
            this.setAttribute("row-pivots", this.getAttribute("column-pivots"));
            this.setAttribute("column-pivots", row_pivots);
        } else if (has_row) {
            let row_pivots = this.getAttribute("row-pivots");
            this.removeAttribute("row-pivots");
            this.setAttribute("column-pivots", row_pivots);
        } else if (has_col) {
            let column_pivots = this.getAttribute("column-pivots");
            this.removeAttribute("column-pivots");
            this.setAttribute("row-pivots", column_pivots);
        } else {
            this.removeAttribute("column-pivots");
            this.removeAttribute("row-pivots");
        }
    }

    _vis_selector_changed(plugin) {
        this._cached_plugin = plugin;
        let plugin_name = this.getAttribute("plugin");
        if (plugin_name !== plugin.name) {
            this._setAttributeSafe("plugin", plugin.name);
        }

        this._plugin_information.classList.add("hidden");
        this._active_columns.classList.remove("one_lock", "two_lock");
        const classname = ["one_lock", "two_lock"][plugin.initial?.count - 1];
        if (classname) {
            this._active_columns.classList.add(classname);
        }

        this._set_row_styles(plugin);
        this._set_column_defaults(plugin);
        this.dispatchEvent(new Event("perspective-config-update"));
        this._debounce_update();
    }

    // most of these are drag and drop handlers - how to clean up?
    _register_callbacks() {
        this._sort.addEventListener("drop", drop.bind(this));
        this._sort.addEventListener("dragend", dragend.bind(this));
        this._sort.addEventListener("dragenter", dragenter.bind(this));
        this._sort.addEventListener("dragover", dragover.bind(this));
        this._sort.addEventListener("dragleave", dragleave.bind(this));
        this._row_pivots.addEventListener("drop", drop.bind(this));
        this._row_pivots.addEventListener("dragend", dragend.bind(this));
        this._row_pivots.addEventListener("dragenter", dragenter.bind(this));
        this._row_pivots.addEventListener("dragover", dragover.bind(this));
        this._row_pivots.addEventListener("dragleave", dragleave.bind(this));
        this._column_pivots.addEventListener("drop", drop.bind(this));
        this._column_pivots.addEventListener("dragend", dragend.bind(this));
        this._column_pivots.addEventListener("dragenter", dragenter.bind(this));
        this._column_pivots.addEventListener("dragover", dragover.bind(this));
        this._column_pivots.addEventListener("dragleave", dragleave.bind(this));
        this._filters.addEventListener("drop", drop.bind(this));
        this._filters.addEventListener("dragend", dragend.bind(this));
        this._filters.addEventListener("dragenter", dragenter.bind(this));
        this._filters.addEventListener("dragover", dragover.bind(this));
        this._filters.addEventListener("dragleave", dragleave.bind(this));
        this._active_columns.addEventListener("drop", column_drop.bind(this));
        this._active_columns.addEventListener("dragenter", dragenter.bind(this));
        this._active_columns.addEventListener("dragend", column_dragend.bind(this));
        this._active_columns.addEventListener("dragover", column_dragover.bind(this));
        this._active_columns.addEventListener("dragleave", column_dragleave.bind(this));
        this._add_expression_button.addEventListener("click", this._open_expression_editor.bind(this));
        this._add_expression_button.addEventListener("-perspective-close-expression", this._close_expression_editor.bind(this));
        this._transpose_button.addEventListener("click", this._transpose.bind(this));
        this._vieux.addEventListener("perspective-vieux-reset", () => this.reset());
        this._vieux.addEventListener("-perspective-plugin-changed", ({detail}) => this._vis_selector_changed(detail));
        this._vieux.addEventListener("-perspective-add-expression", ({detail}) => this._save_expression(detail));

        this._plugin_information_action.addEventListener("click", async () => {
            let plugin = await this._vieux.get_plugin();
            this._debounce_update({ignore_size_check: true, limit_points: false});
            this._plugin_information.classList.add("hidden");
            plugin.render_warning = false;
        });
    }
}
