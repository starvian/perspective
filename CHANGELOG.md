# Changelog

# [0.2.22] - 2019-04-10
### Added
* [#511](https://github.com/jpmorganchase/perspective/pull/511) Sunburst charts for `perspective-viewer-d3fc`, as well as support for perspective themes.
* [#517](https://github.com/jpmorganchase/perspective/pull/517) Added `options` parameter to `view.on_update` method, and new `rows`, `none` and `pkey` update modes.
* [#527](https://github.com/jpmorganchase/perspective/pull/527) Split `aggregate` view config option into `columns` and `aggregates` ala `<perspective-viewer>`, and named other properties like `row_pivots` consistently as well.  Old properties emit warnings.
* [#531](https://github.com/jpmorganchase/perspective/pull/531) `perspective.table` can now be sorted by columns not in the `columns` list.
* [#532](https://github.com/jpmorganchase/perspective/pull/532) Added `save()` and `restore()` methods to the `<perspective-viewer>` plugin API.
* [#534](https://github.com/jpmorganchase/perspective/pull/534) Resizable Legends for `perspective-viewer-d3fc`, plus multiple bug fixes.

### Fixes
* [#521](https://github.com/jpmorganchase/perspective/pull/521) Fixed Hypergrid scroll stuttering on wide tables.
* [#523](https://github.com/jpmorganchase/perspective/pull/523) Fixed row count on column-only pivots.
* [#529](https://github.com/jpmorganchase/perspective/pull/529) Fixed column sorting regression.
* [#538](https://github.com/jpmorganchase/perspective/pull/538) Fixed issue which caused Hypergrid to freeze when the column set changed during `update()`

### Internal
* [#537](https://github.com/jpmorganchase/perspective/pull/537) Upgraded Emscripten to 1.38.29 `perspective/emsdk:latest`.
* [#539](https://github.com/jpmorganchase/perspective/pull/539) Upgraded Puppeteer `perspective/puppeteer:latest`.
* [#520](https://github.com/jpmorganchase/perspective/pull/520) Updated `docs/` build and integrated into `master` branch.

# [0.2.21] - 2019-04-03
### Added
* [#488](https://github.com/jpmorganchase/perspective/pull/488) Candlestick and OHLC charts for `perspective-viewer-d3fc`.
* [#479](https://github.com/jpmorganchase/perspective/pull/479) Added zooming, label rotation and new scatter types to `perspective-viewer-d3fc`.
* [#498](https://github.com/jpmorganchase/perspective/pull/498) Bollinger bands, moving averages, draggable legends for `perspective-viewer-d3fc`.
* [#489](https://github.com/jpmorganchase/perspective/pull/489) Header sort indicator for `perspective-viewer-hypergrid`.
* [#506](https://github.com/jpmorganchase/perspective/pull/506) Header click-to-sort for `perspective-viewer-hypergrid`, improved scroll performance.
* [#516](https://github.com/jpmorganchase/perspective/pull/516) New `perspective-cli` package for convenient Perspective operations from the command line.
* [#483](https://github.com/jpmorganchase/perspective/pull/483) Performance improvement for `perspective.to_*` methods.
* [#485](https://github.com/jpmorganchase/perspective/pull/485) Added window support to `to_arrow()` method.
* [#486](https://github.com/jpmorganchase/perspective/pull/486) Disabled delta calculation for `on_update` method by default, improving update performance.
* [#503](https://github.com/jpmorganchase/perspective/pull/503) Added `get_config()` API to `perspective.table`.
* [#512](https://github.com/jpmorganchase/perspective/pull/512) Column context labels are now configurable via the plugin API.

### Fixes
* [#478](https://github.com/jpmorganchase/perspective/pull/478) Fixed broken filtering on `date` type columns.
* [#486](https://github.com/jpmorganchase/perspective/pull/486) Fixed un-pivoted `view.to_schema()` method to only show visible columns.
* [#490](https://github.com/jpmorganchase/perspective/pull/490) Fixed bug which removed filter columns when dragged from active columns list.
* [#491](https://github.com/jpmorganchase/perspective/pull/491) Fixed `perspective-webpack-plugin` load_path issue when `perspective-*` modules are not at the top-level of `node_modules`.
* [#493](https://github.com/jpmorganchase/perspective/pull/493) Fixed `sum abs` aggregate type.
* [#501](https://github.com/jpmorganchase/perspective/pull/501) Fixed pivot on categories containing nulls bug.
* [#502](https://github.com/jpmorganchase/perspective/pull/502) Fixed expand/collapse on 2-sided contexts bug.

### Internal
* [#497](https://github.com/jpmorganchase/perspective/pull/497) Added local puppeteer mode for testing.
  
## [0.2.20] - 2019-03-07
### Added
* [#463](https://github.com/jpmorganchase/perspective/pull/463) D3FC plugin features Area and Heatmap charts, hierarchial axes have been added to all chart types, as well as a host of additioanl improvements.
* [#473](https://github.com/jpmorganchase/perspective/pull/473) Performance improvement to `to_*()` output methods.
* [#469](https://github.com/jpmorganchase/perspective/pull/469) `open()` in the node.js API now takes a `table()` argument so it may be retained in the invoking code.
* [#475](https://github.com/jpmorganchase/perspective/pull/475) Added `not in` filter type to `<perspective-viewer>`.
  
### Fixes
* [#470](https://github.com/jpmorganchase/perspective/pull/470) Fixed Jupyterlab extension dist
* [#471](https://github.com/jpmorganchase/perspective/pull/471) Fixed CSV parse issue when converting `integer` to `string` via schema.

### Internal
* [#468](https://github.com/jpmorganchase/perspective/pull/468) Perspective JS can now be built on Windows (with Docker).

## [0.2.19] - 2019-03-01
### Fixes
* [#461](https://github.com/jpmorganchase/perspective/pull/461) Fixed click event bugs in `perspective-viewer-hypergrid` and `perspective-viewer-highcharts`

## [0.2.18] - 2019-02-27
### Added
* [#420](https://github.com/jpmorganchase/perspective/pull/420) New plugin based on D3FC - `perspective-viewer-d3fc`.
* [#439](https://github.com/jpmorganchase/perspective/pull/439) Added `perspective-click` event for all plugins, which in addition to the basic click details also generates the reciprocal filter matching the rows in any aggregate, such that `<perspective-viewer>`s can be linked.

### Fixes
* [#445](https://github.com/jpmorganchase/perspective/pull/445) Fixed expand/collapse bug.
* [#448](https://github.com/jpmorganchase/perspective/pull/448) Fixed 'Invalid Date' axis issue in `perspective-viewer-highcharts` plugin.
* [#450](https://github.com/jpmorganchase/perspective/pull/450) Fixed `perspective-jupyterlab` plugin to inexplicably build to `dist/`.
* [#453](https://github.com/jpmorganchase/perspective/pull/453) Fixed missing type definition for `shared_worker` in `perspective`.
* [#451](https://github.com/jpmorganchase/perspective/pull/451) Fixed github-reported dependency vulnerabilites.

## [0.2.16] - 2019-02-19
### Added
* [#431](https://github.com/jpmorganchase/perspective/pull/431) Added `clear()` and `replace()` APIs to `perspective` and `<perspective-viewer>`.
* [#435](https://github.com/jpmorganchase/perspective/pull/435) Added `to_arrow()` method to `view()` for writing Apache Arrow `ArrayBuffer`s.
* [#436](https://github.com/jpmorganchase/perspective/pull/436) New module `perspective-phosphor`, which adds bindings for the Phosphor.js framework.

### Fixes
* [#434](https://github.com/jpmorganchase/perspective/pull/434) Deprecated `[column]` sort syntax for `perspective` and `<perspective-viewer>`.

### Internal
* [#426](https://github.com/jpmorganchase/perspective/pull/426) Refactored C++ projects into separate repo structure.
* [#413](https://github.com/jpmorganchase/perspective/pull/413) Moved structure of `view()` to C++.

## [0.2.15] - 2019-02-07
### Fixes
* [#416](https://github.com/jpmorganchase/perspective/pull/416) Fixed highcharts bug which caused `null` groups to not render.
* [#419](https://github.com/jpmorganchase/perspective/pull/419) Fixed regression in cross-origin loading.
* [#421](https://github.com/jpmorganchase/perspective/pull/421) Fixed JSON/CSV loading when columns contain mixed numeric/string values.

## [0.2.14] - 2019-02-04
### Added
* [#408](https://github.com/jpmorganchase/perspective/pull/408) Added `flush()` method to `<perspective-viewer>`

### Fixes
* [#409](https://github.com/jpmorganchase/perspective/pull/409) Fixed `perspective-webpack-plugin` conflicts with external loaders.

## [0.2.13] - 2019-02-04
### Added
* [#399](https://github.com/jpmorganchase/perspective/pull/399) New package `perspective-webpack-plugin` for webpack integration
* [#394](https://github.com/jpmorganchase/perspective/pull/394) Websocket server supports reconnects/heartbeat.

### Fixes
* [#407](https://github.com/jpmorganchase/perspective/pull/407) Slightly better date parsing.
* [#403](https://github.com/jpmorganchase/perspective/pull/403) Fixed webpack cross path loading.

## [0.2.12] - 2019-01-18
### Added
* [#356](https://github.com/jpmorganchase/perspective/pull/356) Perspective for Python!
* [#381](https://github.com/jpmorganchase/perspective/pull/381) Perspective for C++ Linux, MacOS and Windows!
* [#375](https://github.com/jpmorganchase/perspective/pull/375) Filter validation UX for `<perspective-viewer>`.

### Fixes
* [#353](https://github.com/jpmorganchase/perspective/pull/353) Substantial performance improvements for CSV/JSON data loading.
* [#355](https://github.com/jpmorganchase/perspective/pull/355) Reduced asset size & removed unnecesary abstraction.
* [#357](https://github.com/jpmorganchase/perspective/pull/357) Removed regenerator plugin for smaller bundle & better performance.
* [#359](https://github.com/jpmorganchase/perspective/pull/359) Added missing package.json dependencies.
* [#367](https://github.com/jpmorganchase/perspective/pull/367) Performance optimization for parsing int/float ambiguous columns.
* [#370](https://github.com/jpmorganchase/perspective/pull/370) Fixed regression in inferrence for numeric columns.
    
### Internal
* [#351](https://github.com/jpmorganchase/perspective/pull/351) Test coverage for Jupyterlab plugin.
* [#352](https://github.com/jpmorganchase/perspective/pull/352) JS data parsing API ported to C++ for portability.
* [#383](https://github.com/jpmorganchase/perspective/pull/383) Tests for C++.
* [#386](https://github.com/jpmorganchase/perspective/pull/386) Strict builds for C++

## [0.2.11] - 2018-12-20
### Added
* [#345](https://github.com/jpmorganchase/perspective/pull/345) Direct load Apache Arrow support added to Jupyterlab plugin

### Fixes
* [#343](https://github.com/jpmorganchase/perspective/pull/343) Fixed regression in type inference for empty string columns
* [#344](https://github.com/jpmorganchase/perspective/pull/344) Fixed UI lock when invalid filters applied

### Internal
* [#350](https://github.com/jpmorganchase/perspective/pull/350) New benchmark suite

## [0.2.10] - 2018-12-09
### Fixes
* [#328](https://github.com/jpmorganchase/perspective/pull/328) Fixed `<perspective-viewer>` `delete()` method memory leak.
* [#338](https://github.com/jpmorganchase/perspective/pull/338) Fixed UI interaction quirks.

### Internal
* [#337](https://github.com/jpmorganchase/perspective/pull/337) Test suite performance improvements, supports `-t` and `--saturate` flags.

## [0.2.9] - 2018-11-25
### Added
* [#325](https://github.com/jpmorganchase/perspective/pull/325) API and UX for column sorting on arbitrary columns.
* [#326](https://github.com/jpmorganchase/perspective/pull/326) Fun animations!
* [#327](https://github.com/jpmorganchase/perspective/pull/327) Render warnings show dataset size.

### Internal
* [#320](https://github.com/jpmorganchase/perspective/pull/320) Switched to `yarn`.

## [0.2.8] - 2018-11-21
### Added
* [#317](https://github.com/jpmorganchase/perspective/pull/317) Applying 'column-pivots' now preserves the sort order.
* [#319](https://github.com/jpmorganchase/perspective/pull/319) Sorting by a column in 'column-pivots' will apply the sort to column order.

### Fixes
* [#306](https://github.com/jpmorganchase/perspective/pull/306) Fixed Jupyterlab plugin, updating it to work with the newest [perspective-python 0.1.1](https://github.com/timkpaine/perspective-python/tree/v0.1.1).

## [0.2.7] - 2018-11-12
### Fixes
* [#304](https://github.com/jpmorganchase/perspective/pull/304) Fixed missing file in NPM package.

## [0.2.6] - 2018-11-12
### Fixes
* [#303](https://github.com/jpmorganchase/perspective/pull/303) Fixed `webpack-plugin` babel-loader configuration issue.

## [0.2.5] - 2018-11-09
### Fixes
* [#301](https://github.com/jpmorganchase/perspective/pull/301) Fixed missing `webpack-plugin` export and `babel-polyfill` import.

## [0.2.4] - 2018-11-08
### Added
* [#299](https://github.com/jpmorganchase/perspective/pull/299) Added a new Menu bar (accessible via right-click on the config button) for `reset`, `copy` and `download` actions, and an API for `download()` (`copy()` and `reset()` already exist).
* [#295](https://github.com/jpmorganchase/perspective/pull/295) `@jpmorganchase/perspective` now exports `wepback-plugin` for easy integration with WebPack, [example](https://github.com/jpmorganchase/perspective/blob/master/examples/webpack/webpack.config.js).  Webpacked builds are overall smaller as well. 
* [#290](https://github.com/jpmorganchase/perspective/pull/290) Large aggregate datasets now trigger a render warning before attempting to render.

### Fixes
* [#298](https://github.com/jpmorganchase/perspective/pull/298) Fixed Material dark theming readbility for hovers and dropdowns.

## [0.2.3] - 2018-10-25
### Added
* [#286](https://github.com/jpmorganchase/perspective/pull/286) Ported `<perspective-viewer>` to utilize Shadow DOM.
* [#271](https://github.com/jpmorganchase/perspective/pull/271) Added support for `date` type in addition to `datetime` (formerly `date`).  `date`s can be specified in a `schema` or inferred from inputs.
* [#273](https://github.com/jpmorganchase/perspective/pull/273) Added `col_to_js_typed_array` method to `view()`.
* [#284](https://github.com/jpmorganchase/perspective/pull/284) Updated Jupyterlab support to 0.35.x
* [#287](https://github.com/jpmorganchase/perspective/pull/287) `restore()` is now a `Promise`.
  
### Fixes
* [#280](https://github.com/jpmorganchase/perspective/pull/280) Fixed pivotting on columns with `null` values.
* [#288](https://github.com/jpmorganchase/perspective/pull/288) Fixed issue which caused Hypergrid plugin to fail on empty or `schema` only data.
* [#289](https://github.com/jpmorganchase/perspective/pull/289) Fixed issue which caused one-sided charts to not update when their axes grew.
* [#283](https://github.com/jpmorganchase/perspective/pull/283) Fixed multiple computed column UX issues.
* [#274](https://github.com/jpmorganchase/perspective/pull/274) Fixed delta updates to support computed columns.
* [#279](https://github.com/jpmorganchase/perspective/pull/279) Fixed Typescript types for `update` and `view` methods.
* [#277](https://github.com/jpmorganchase/perspective/pull/277) Fixed row-expansion to work correctly with updates, and modified semantics for expand-to-depth.

## [0.2.2] - 2018-10-08
### Added
* Hypergrid foreground color, background color, font, and positive/negative variations are styleable via CSS.
* "not in" filter type added.
* `<perspective-viewer>` `load()` method takes the same options objects as `table()`.
* `perspective` library classes now bind their methods to their class instances.
* New CLI example project.
* New Citibike live examples.
* Added support for chunked Arrows.
* Added support/proper errors for un-decodeable strings.
  
### Fixes
* Fixed a bug which de-registered updates when a computed column was added.
* Fixed source-maps for Web Workers.
* Fixed aggregate bug which caused partial updates without aggregate to incorrectly apply to aggregate.
* Fixed flapping tooltip test #210.
* Fixed CSS regression in Chrome Canary 71.
