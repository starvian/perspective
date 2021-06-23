/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

import {wasm} from "../../dist/esm/@finos/perspective-vieux";
import "./plugins.js";
import "./polyfill.js";

import {bindTemplate, json_attribute, array_attribute, invertPromise, throttlePromise, getExpressionAlias, findExpressionByAlias} from "./utils.js";
import "./row.js";

import template from "../html/viewer.html";

import view_style from "../less/viewer.less";
import default_style from "../less/default.less";

import {ActionElement} from "./viewer/action_element.js";

/**
 * Module for the `<perspective-viewer>` custom element.
 *
 * This module has no exports, but importing it has a side
 * effect: the {@link module:perspective_viewer~PerspectiveViewer} class is
 * registered as a custom element, after which it can be used as a standard DOM
 * element.
 *
 * The documentation in this module defines the instance structure of a
 * `<perspective-viewer>` DOM object instantiated typically, through HTML or any
 * relevent DOM method e.g. `document.createElement("perspective-viewer")` or
 * `document.getElementsByTagName("perspective-viewer")`.
 *
 * @module perspective-viewer
 */

const PERSISTENT_ATTRIBUTES = ["selectable", "editable", "plugin", "expressions", "row-pivots", "column-pivots", "aggregates", "filters", "sort", "columns"];

// There is no way to provide a default rejection handler within a promise and
// also not lock the await-er, so this module attaches a global handler to
// filter out cancelled query messages.
window.addEventListener("unhandledrejection", event => {
    if (event.reason?.message === "View method cancelled") {
        event.preventDefault();
    }
});

/**
 * The HTMLElement class for `<perspective-viewer>` custom element.
 *
 * This class is not exported, so this constructor cannot be invoked in the
 * typical manner; instead, instances of the class are created through the
 * Custom Elements DOM API.
 *
 * Properties of an instance of this class, such as
 * {@link module:perspective_viewer~PerspectiveViewer#columns}, are reflected on
 * the DOM element as Attributes, and should be accessed as such - e.g.
 * `instance.setAttribute("columns", JSON.stringify(["a", "b"]))`.
 *
 * @class PerspectiveViewer
 * @extends {HTMLElement}
 * @example
 * // Create a new `<perspective-viewer>`
 * const elem = document.createElement("perspective-viewer");
 * elem.setAttribute("columns", JSON.stringify(["a", "b"]));
 * document.body.appendChild(elem);
 *
 */
@bindTemplate(template, view_style, default_style) // eslint-disable-next-line no-unused-vars
class PerspectiveViewer extends ActionElement {
    constructor() {
        super();
        this._show_config = true;
        this._show_warnings = true;
        this.__render_times = [];
        this._resize_handler = this.notifyResize.bind(this);
        this._edit_port = null;
        this._edit_port_lock = invertPromise();
        this._vieux = document.createElement("perspective-vieux");
        this._vieux.setAttribute("id", "app");
        window.addEventListener("resize", this._resize_handler);
    }

    connectedCallback() {
        this.toggleAttribute("settings", false);
        this._register_ids();
        this._register_callbacks();
        this._check_loaded_table();
    }

    /**
     * Sets this `perspective.table.view`'s `sort` property, an Array of column
     * names.
     *
     * @kind member
     * @type {Array<String>} Array of arrays tuples of column name and
     * direction, where the possible values are "asc", "desc", "asc abs", "desc
     * abs" and "none".
     * @fires PerspectiveViewer#perspective-config-update
     * @example <caption>via Javascript DOM</caption>
     * let elem = document.getElementById('my_viewer');
     * elem.setAttribute('sort', JSON.stringify([["x","desc"]));
     * @example <caption>via HTML</caption>
     * <perspective-viewer sort='[["x","desc"]]'></perspective-viewer>
     */
    @array_attribute
    sort(sort) {
        if (sort === null || sort === undefined || sort.length === 0) {
            if (this.hasAttribute("sort")) {
                this.removeAttribute("sort");
            }
            sort = [];
        }
        var inner = this._sort.querySelector("ul");
        this._update_column_list(
            sort,
            inner,
            (s, expressions) => {
                let dir = "asc";
                if (Array.isArray(s)) {
                    dir = s[1];
                    s = s[0];
                }
                // either the whole expression string or undefined
                let expression = findExpressionByAlias(s, expressions);
                return this._new_row(s, false, false, false, dir, expression);
            },
            (sort, node) => {
                if (Array.isArray(sort)) {
                    return node.getAttribute("name") === sort[0] && node.getAttribute("sort-order") === sort[1];
                }
                return node.getAttribute("name") === sort;
            }
        );
        this.dispatchEvent(new Event("perspective-config-update"));
        this._debounce_update();
    }

    /**
     * The set of visible columns.
     *
     * @kind member
     * @type {Array<String>}
     * @param {Array} columns An Array of strings, the names of visible columns.
     * @fires PerspectiveViewer#perspective-config-update
     * @example <caption>via Javascript DOM</caption>
     * let elem = document.getElementById('my_viewer');
     * elem.setAttribute('columns', JSON.stringify(["x", "y'"]));
     * @example <caption>via HTML</caption>
     * <perspective-viewer columns='["x", "y"]'></perspective-viewer>
     */
    @array_attribute
    columns(show) {
        if (show === null || show === undefined || show.length === 0) {
            if (this.hasAttribute("columns")) {
                if (this._initial_col_order) {
                    this.setAttribute("columns", JSON.stringify(this._initial_col_order));
                } else {
                    this.removeAttribute("columns");
                }
            }
            show = (this._initial_col_order || []).slice();
        }
        this._update_column_view(show, true);
        this.dispatchEvent(new Event("perspective-config-update"));
        this._debounce_update();
    }

    /**
     * DEPRECATED: use the expressions API instead.
     *
     * @kind member
     * @type {Array<Object>}
     * @param {Array<Object>} computed-columns DEPRECATED - use the
     * "expressions" API instead.
     * @deprecated
     */
    @array_attribute
    "computed-columns"() {
        console.error("[PerspectiveViewer] the `computed-columns` attribute is deprecated - use the `expressions` attribute instead.");
    }

    /**
     * Sets this `perspective.table.view`'s `expressions` property, which will
     * output new columns from the given expressions.
     *
     * @kind member
     * @type {Array<String>}
     * @param {Array<String>} expressions An array of string expressions to
     * be calculated by Perspective.
     * @fires PerspectiveViewer#perspective-config-update
     *
     * @example <caption>via Javascript DOM</caption>
     * let elem = document.getElementById('my_viewer');
     * elem.setAttribute('expressions', JSON.stringify(['"x" + ("y" + 20)']));
     * @example <caption>via HTML</caption>
     * <perspective-viewer expressions='[\'"x" + 10\']'></perspective-viewer>
     */
    @array_attribute
    expressions(expressions) {
        const resolve = this._set_updating();

        (async () => {
            if (expressions === null || expressions === undefined || expressions.length === 0) {
                // Remove expression columns from the DOM, and reset the config
                // to exclude all expression columns.
                if (this.hasAttribute("expressions")) {
                    this.removeAttribute("expressions");
                    this._reset_expressions_view();
                    return;
                }

                resolve();
            }

            let expression_schema = {};

            if (this.table) {
                const validation_results = await this.table.validate_expressions(expressions);
                expression_schema = validation_results.expression_schema;
                const errors = validation_results.errors;
                const validated_expressions = {};

                /**
                 * Clear the expressions attribute if the validation fails at
                 * any point. This validation gets triggered in two scenarios:
                 *
                 * 1. When a user types an expression and clicks save,
                 *  where the expression has already been checked. In
                 *  this case, there should be no failure of the
                 *  validation as the expression has already been
                 *  checked and validated.
                 *
                 * 2. When a user calls setAttribute() or restore()
                 *  with a config that contains expressions, in which case
                 *  the existing expressions are cleared already, and so
                 *  there is no need to preserve the array.
                 */
                let clear_expressions = false;

                for (const expression of expressions) {
                    let alias = getExpressionAlias(expression);

                    // Each expression from the editor should already have
                    // an alias set. While we can auto-generate aliases, we
                    // would need to setAttribute again and risk entering an
                    // infinite recursion, so just let it fall into the error
                    // state and clear the expressions.
                    if (expression_schema[alias]) {
                        validated_expressions[alias] = expression;
                    } else {
                        if (alias === undefined) {
                            console.warn(`Failed to set "expressions" attribute: "${expression}" does not have an alias, i.e: // Expression Alias \n "x" + "y"`);
                        } else {
                            // alias is guaranteed to be in the errors map
                            console.warn(`Error in expression "${alias}": ${errors[alias]}\nFailed to set "expressions" attribute: expression "${expression}" is invalid.`);
                        }
                        clear_expressions = true;
                    }
                }

                if (clear_expressions) {
                    // recurses one level down but will not make any calls
                    // to Perspective.
                    this.setAttribute("expressions", null);
                }

                // Need to remove old expressions from the viewer DOM and
                // config so they don't mess up state. To do this, we need
                // to get the expression columns that are currently in the DOM,
                // as this callback runs after the attribute is already set
                // with the new value.
                const active_expressions = this._get_view_active_columns()
                    .filter(x => x.classList.contains("expression"))
                    .map(x => x.getAttribute("expression"));
                const inactive_expressions = this._get_view_inactive_columns()
                    .filter(x => x.classList.contains("expression"))
                    .map(x => x.getAttribute("expression"));

                const old_expressions = active_expressions.concat(inactive_expressions);
                const to_remove = this._diff_expressions(old_expressions, expressions);

                if (to_remove.length > 0) {
                    this._reset_expressions_view(to_remove);
                }

                expressions = Object.values(validated_expressions);
                this.setAttribute("expressions", JSON.stringify(expressions));
            } else {
                console.warn(`Applying unvalidated expressions: ${expressions} because the viewer does not have a Table attached!`);
            }

            this._update_expressions_view(expressions, expression_schema);
            this.dispatchEvent(new Event("perspective-config-update"));
            await this._debounce_update();
            resolve();
        })();
    }

    /* eslint-enable max-len */

    /**
     * The set of column aggregate configurations.
     *
     * @kind member
     * @type {Object}
     * @param {Object} aggregates A dictionary whose keys are column names, and
     * values are valid aggregations. The `aggregates` attribute works as an
     * override; in lieu of a key for a column supplied by the developers, a
     * default will be selected and reflected to the attribute based on the
     * column's type.  See {@link perspective/src/js/defaults.js}
     * @fires PerspectiveViewer#perspective-config-update
     * @example <caption>via Javascript DOM</caption>
     * let elem = document.getElementById('my_viewer');
     * elem.setAttribute('aggregates', JSON.stringify({x: "distinct count"}));
     * @example <caption>via HTML</caption>
     * <perspective-viewer aggregates='{"x": "distinct count"}'>
     * </perspective-viewer>
     */
    @json_attribute
    aggregates(show) {
        if (show === null || show === undefined || Object.keys(show).length === 0) {
            if (this.hasAttribute("aggregates")) {
                this.removeAttribute("aggregates");
            }
            show = {};
        }

        let lis = this._get_view_dom_columns();
        lis.map(x => {
            let agg = show[x.getAttribute("name")];
            if (agg) {
                x.setAttribute("aggregate", Array.isArray(agg) ? JSON.stringify(agg) : agg);
            }
        });
        this.dispatchEvent(new Event("perspective-config-update"));
        this._debounce_update();
    }

    /**
     * The set of column filter configurations.
     *
     * @kind member
     * @type {Array<Array>} filters An Array of filter configs. A filter
     * config is an Array of three elements: * The column name. * The filter
     * operation as a String. See
     * {@link perspective/src/js/config/constants.js} * The filter argument, as
     * a String, float or Array<String> as the filter operation demands.
     * @fires PerspectiveViewer#perspective-config-update
     * @example <caption>via Javascript DOM</caption>
     * let filters = [
     *     ["x", "<", 3],
     *     ["y", "contains", "abc"]
     * ];
     * let elem = document.getElementById('my_viewer');
     * elem.setAttribute('filters', JSON.stringify(filters));
     * @example <caption>via HTML</caption>
     * <perspective-viewer filters='[["x", "<", 3], ["y", "contains", "abc"]]'>
     * </perspective-viewer>
     */
    @array_attribute
    filters(filters) {
        if (filters === null || filters === undefined || filters.length === 0) {
            if (this.hasAttribute("filters")) {
                this.removeAttribute("filters");
            }
            filters = [];
        }
        if (!this._updating_filter) {
            var inner = this._filters.querySelector("ul");
            this._update_column_list(
                filters,
                inner,
                (filter, expressions) => {
                    const fterms = JSON.stringify({
                        operator: filter[1],
                        operand: filter[2]
                    });
                    const name = filter[0];
                    // either the whole expression string or undefined
                    let expression = findExpressionByAlias(name, expressions);
                    return this._new_row(name, undefined, undefined, fterms, undefined, expression);
                },
                (filter, node) =>
                    node.getAttribute("name") === filter[0] &&
                    node.getAttribute("filter") ===
                        JSON.stringify({
                            operator: filter[1],
                            operand: filter[2]
                        })
            );
        }
        this.dispatchEvent(new Event("perspective-config-update"));
        this._debounce_update();
    }

    /**
     * Sets the currently selected plugin, via its `name` field, and removes
     * any children the previous plugin may have left behind in the light DOM.
     *
     * @type {String}
     * @fires PerspectiveViewer#perspective-config-update
     */
    set plugin(v) {
        if (v === "null" || v === null || v === undefined) {
            this._vieux.set_plugin_default();
            return;
        }

        if (this.hasAttribute("plugin")) {
            let plugin = this.getAttribute("plugin");
            this._vieux.set_plugin(plugin);
        } else {
            this._vieux.set_plugin_default();
            return;
        }
    }

    /**
     * Sets this `perspective.table.view`'s `column_pivots` property.
     *
     * @kind member
     * @type {Array<String>} Array of column names
     * @fires PerspectiveViewer#perspective-config-update
     */
    @array_attribute
    "column-pivots"(pivots) {
        if (pivots === null || pivots === undefined || pivots.length === 0) {
            if (this.hasAttribute("column-pivots")) {
                this.removeAttribute("column-pivots");
            }
            pivots = [];
        }

        const inner = this._column_pivots.querySelector("ul");
        this._update_column_list(pivots, inner, (pivot, expressions) => {
            // either the whole expression string or undefined
            let expression = findExpressionByAlias(pivot, expressions);
            return this._new_row(pivot, undefined, undefined, undefined, undefined, expression);
        });
        this.dispatchEvent(new Event("perspective-config-update"));
        this._debounce_update();
    }

    /**
     * Sets this `perspective.table.view`'s `row_pivots` property.
     *
     * @kind member
     * @type {Array<String>} Array of column names
     * @fires PerspectiveViewer#perspective-config-update
     */
    @array_attribute
    "row-pivots"(pivots) {
        if (pivots === null || pivots === undefined || pivots.length === 0) {
            if (this.hasAttribute("row-pivots")) {
                this.removeAttribute("row-pivots");
            }
            pivots = [];
        }

        const inner = this._row_pivots.querySelector("ul");
        this._update_column_list(pivots, inner, (pivot, expressions) => {
            // either the whole expression string or undefined
            let expression = findExpressionByAlias(pivot, expressions);
            return this._new_row(pivot, undefined, undefined, undefined, undefined, expression);
        });
        this.dispatchEvent(new Event("perspective-config-update"));
        this._debounce_update();
    }

    /**
     * Determines whether this viewer is editable or not (though it is
     * ultimately up to the plugin as to whether editing is implemented).
     *
     * @kind member
     * @type {Boolean} Is this viewer editable?
     * @fires PerspectiveViewer#perspective-config-update
     */
    set editable(x) {
        if (x === "null") {
            if (this.hasAttribute("editable")) {
                this.removeAttribute("editable");
            }
        } else {
            this.toggleAttribute("editable", true);
        }
        this._debounce_update({force_update: true});
        this.dispatchEvent(new Event("perspective-config-update"));
    }

    /**
     * Determines the render throttling behavior. Can be an integer, for
     * millisecond window to throttle render event; or, if `undefined`,
     * will try to determine the optimal throttle time from this component's
     * render framerate.
     *
     * @kind member
     * @type {Number|String} The throttle rate - milliseconds (integer), or the
     * enum "adaptive" for a dynamic throttle based on render time.
     * @example
     * <!-- Only draws at most 1 frame/sec. -->
     * <perspective-viewer throttle="1000"></perspective-viewer>
     */
    set throttle(x) {
        if (x === "null") {
            if (this.hasAttribute("throttle")) {
                this.removeAttribute("throttle");
            }
        }
        // Returns the throttle time, but also perform validaiton - we only want
        // the latter here.
        this._calculate_throttle_timeout();
    }

    /*
     * Determines whether row selections is enabled on this viewer (though it is
     * ultimately up to the plugin as to whether selectable is implemented).
     *
     * @kind member
     * @type {Boolean} Is this viewer editable?
     * @fires PerspectiveViewer#perspective-config-update
     */
    set selectable(x) {
        if (x === "null") {
            if (this.hasAttribute("selectable")) {
                this.removeAttribute("selectable");
            }
        } else {
            this.toggleAttribute("selectable", true);
        }
        this._debounce_update({force_update: true});
        this.dispatchEvent(new Event("perspective-config-update"));
    }

    /**
     * This element's `perspective.table` instance.
     *
     * @readonly
     */
    get table() {
        return this._table;
    }

    /**
     * This element's `perspective.table.view` instance. The instance itself
     * will change after every `PerspectiveViewer#perspective-config-update`
     * event.
     *
     * @readonly
     */
    get view() {
        return this._view;
    }

    /**
     * Load data. If `load` or `update` have already been called on this
     * element, its internal `perspective.table` will also be deleted.
     *
     * @async
     * @param {any} data The data to load, as a `perspective.Table` or
     * `Promise<perspective.Table>`.
     * @returns {Promise<void>} A promise which resolves once the data is loaded
     * and a `perspective.view` has been created.
     * @fires module:perspective_viewer~PerspectiveViewer#perspective-click
     * PerspectiveViewer#perspective-view-update
     * ]);
     * @example <caption>Load perspective.table</caption>
     * const my_viewer = document.getElementById('#my_viewer');
     * const tbl = await perspective.table("x,y\n1,a\n2,b");
     * my_viewer.load(tbl);
     * @example <caption>Load Promise<perspective.table></caption>
     * const my_viewer = document.getElementById('#my_viewer');
     * const tbl = async () => perspective.table("x,y\n1,a\n2,b");
     * my_viewer.load(tbl);
     */
    async load(data) {
        let table;
        const resolve = this._set_updating();

        if (data instanceof Promise) {
            this._vieux.load(data);
            table = await data;
        } else {
            if (data.type === "table") {
                this._vieux.load(Promise.resolve(data));
                table = data;
            } else {
                resolve();
                throw new Error(`Unrecognized input type ${typeof data}.  Please use a \`perspective.Table()\``);
            }
        }
        if (this.isConnected) {
            await this._load_table(table, resolve);
        } else {
            this._table = table;
            this._table_resolve = resolve;
        }
    }

    /**
     * Determine whether to reflow the viewer and redraw.
     *
     */
    @throttlePromise
    async notifyResize(immediate) {
        const resized = await this._check_responsive_layout();
        if (!resized && !document.hidden && this.offsetParent) {
            let plugin = await this._vieux.get_plugin();
            await plugin.resize(immediate);
        }
    }

    /**
     * Duplicate an existing `<perspective-element>`, including data and view
     * settings.  The underlying `perspective.table` will be shared between both
     * elements
     *
     * @param {any} widget A `<perspective-viewer>` instance to clone.
     */
    async clone(widget) {
        const resolve = this._set_updating();
        this._load_table(widget.table, resolve);
        this.restore(await widget.save());
    }

    /**
     * Deletes this element and clears it's internal state (but not its
     * user state).  This (or the underlying `perspective.view`'s equivalent
     * method) must be called in order for its memory to be reclaimed, as well
     * as the reciprocal method on the `perspective.table` which this viewer is
     * bound to.
     *
     * @returns {Promise<Boolean>} Whether or not this call resulted in the
     * underlying `perspective.table` actually being deleted.
     */
    delete() {
        let x = this._clear_state();
        this._vieux.get_plugin().then(plugin => {
            if (plugin?.delete) {
                plugin.delete();
            }
        });

        window.removeEventListener("resize", this._resize_handler);
        return x;
    }

    /**
     * Restyles the elements and to pick up any style changes
     */
    restyleElement() {
        this._restyle_plugin();
    }

    /**
     * Serialize this element's attribute/interaction state.
     *
     * @returns {object} a serialized element.
     */
    async save() {
        let obj = {};
        const cols = new Set(PERSISTENT_ATTRIBUTES);
        for (let key = 0; key < this.attributes.length; key++) {
            let attr = this.attributes[key];
            if (cols.has(attr.name)) {
                if (attr.value === "") {
                    obj[attr.name] = true;
                } else if (attr.name !== "plugin" && attr.value !== undefined && attr.value !== null) {
                    obj[attr.name] = JSON.parse(attr.value);
                } else {
                    obj[attr.name] = attr.value;
                }
                cols.delete(attr.name);
            }
        }
        for (const col of cols) {
            obj[col] = null;
        }
        let plugin = await this._vieux.get_plugin();
        if (plugin.save) {
            obj.plugin_config = plugin.save();
        }
        return obj;
    }

    /**
     * Restore this element to a state as generated by a reciprocal call to
     * `save` or `serialize`.
     *
     * @param {Object|String} config returned by `save` or `serialize`.
     * @returns {Promise<void>} A promise which resolves when the changes have
     * been applied.
     */
    async restore(config) {
        if (typeof config === "string") {
            config = JSON.parse(config);
        }

        for (const key of PERSISTENT_ATTRIBUTES) {
            if (config.hasOwnProperty(key)) {
                let val = config[key];
                if (val === true) {
                    this.toggleAttribute(key, true);
                } else if (val !== undefined && val !== null && val !== false) {
                    if (typeof val !== "string") {
                        val = JSON.stringify(val);
                    }
                    this.setAttribute(key, val);
                } else {
                    this.removeAttribute(key);
                }
            }
        }

        const plugin_promise = this._vieux.get_plugin();
        const update_promise = this._debounce_update();
        const plugin = await plugin_promise;
        if (plugin.restore && config.plugin_config) {
            plugin.restore(config.plugin_config);
        }

        await update_promise;
    }

    /**
     * Flush any pending attribute modifications to this element.
     *
     * @returns {Promise<void>} A promise which resolves when the current
     * attribute state has been applied.
     */
    async flush() {
        await Promise.all([this._updating_promise || Promise.resolve(), this.notifyResize.flush(this)]);
    }

    /**
     * Reset's this element's view state and attributes to default.  Does not
     * delete this element's `perspective.table` or otherwise modify the data
     * state.
     */
    reset() {
        this.removeAttribute("row-pivots");
        this.removeAttribute("column-pivots");
        this.removeAttribute("filters");
        this.removeAttribute("sort");
        this.removeAttribute("expressions");
        if (this._initial_col_order) {
            this.setAttribute("columns", JSON.stringify(this._initial_col_order));
        } else {
            this.removeAttribute("columns");
        }

        this.removeAttribute("plugin");
        this._vieux.get_plugin().then(plugin => {
            plugin.restore({});
        });

        this.dispatchEvent(new Event("perspective-config-update"));
    }

    /**
     * Download this element's data as a CSV file.
     *
     * @param {Boolean} [flat=false] Whether to use the element's current view
     * config, or to use a default "flat" view.
     * @memberof PerspectiveViewer
     */
    async download(flat = false) {
        const {download_flat, download} = await wasm;
        if (flat) {
            await download_flat(this._table);
        } else {
            await download(this._view);
        }
    }

    /**
     * Copies this element's view data (as a CSV) to the clipboard.  This method
     * must be called from an event handler, subject to the browser's
     * restrictions on clipboard access.  See
     * {@link https://www.w3.org/TR/clipboard-apis/#allow-read-clipboard}.
     */
    async copy(flat = false) {
        const {copy_flat, copy} = await wasm;
        if (flat) {
            await copy_flat(this._table);
        } else {
            await copy(this._view);
        }
    }

    /**
     * Opens/closes the element's config menu.
     *
     * @async
     */
    async toggleConfig(force) {
        await this._vieux.toggle_config(force);
    }

    /**
     * Returns a promise that resolves to the element's edit port ID, used
     * internally when edits are made using DataGrid.
     *
     * @async
     */
    async getEditPort() {
        return this._edit_port_lock;
    }
}

/**
 * `perspective-click` is fired whenever underlying `view`'s grid or chart are
 * clicked providing a detail that includes a `config`, `column_names` and
 * `row`.
 *
 * @event module:perspective_viewer~PerspectiveViewer#perspective-click
 * @type {object}
 * @property {Array} column_names - Includes a list of column names.
 * @property {object} config - Contains a property `filters` that can be applied
 * to a `<perspective-viewer>` through the use of `restore()` updating it to
 * show the filtered subset of data..
 * @property {Array} row - Includes the data row.
 */

/**
 * `perspective-config-update` is fired whenever an configuration attribute has
 * been modified, by the user or otherwise.
 *
 * @event module:perspective_viewer~PerspectiveViewer#perspective-config-update
 * @type {String}
 */

/**
 * `perspective-view-update` is fired whenever underlying `view`'s data has
 * updated, including every invocation of `load` and `update`.
 *
 * @event module:perspective_viewer~PerspectiveViewer#perspective-view-update
 * @type {String}
 */
