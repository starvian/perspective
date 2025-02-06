// ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
// ┃ ██████ ██████ ██████       █      █      █      █      █ █▄  ▀███ █       ┃
// ┃ ▄▄▄▄▄█ █▄▄▄▄▄ ▄▄▄▄▄█  ▀▀▀▀▀█▀▀▀▀▀ █ ▀▀▀▀▀█ ████████▌▐███ ███▄  ▀█ █ ▀▀▀▀▀ ┃
// ┃ █▀▀▀▀▀ █▀▀▀▀▀ █▀██▀▀ ▄▄▄▄▄ █ ▄▄▄▄▄█ ▄▄▄▄▄█ ████████▌▐███ █████▄   █ ▄▄▄▄▄ ┃
// ┃ █      ██████ █  ▀█▄       █ ██████      █      ███▌▐███ ███████▄ █       ┃
// ┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
// ┃ Copyright (c) 2017, the Perspective Authors.                              ┃
// ┃ ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ ┃
// ┃ This file is part of the Perspective library, distributed under the terms ┃
// ┃ of the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0). ┃
// ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

import * as d3 from "d3";
import * as fc from "d3fc";
import { flattenArray } from "./flatten";
import { extentLinear as customExtent } from "../d3fc/extent/extentLinear";
import { getValueFormatterForRange } from "./valueFormatter";
import { getChartContainer } from "../plugin/root";
import {
    Component,
    ComponentData,
    Domain,
    PaddingStrategy,
    Settings,
    ValueName,
} from "../types";

export const scale = () => d3.scaleLinear();

export const domain = (): Domain => {
    const base = customExtent().pad([0, 0.1]).padUnit("percent");

    let valueNames: ValueName[] = ["crossValue"];

    const _domain: any = (data) => {
        base.accessors(valueNames.map((v) => (d) => parseFloat(d[v])));

        return getDataExtent(flattenArray(data));
    };

    fc.rebindAll(_domain, base);

    const getMinimumGap = (data) => {
        const gaps = valueNames.map((valueName) =>
            data
                .map((d) => d[valueName])
                .sort((a, b) => a - b)
                .filter((d, i, a) => i === 0 || d !== a[i - 1])
                .reduce((acc, d, i, src) =>
                    i === 0 || acc <= d - src[i - 1]
                        ? acc
                        : Math.abs(d - src[i - 1])
                )
        );

        return Math.min(...gaps);
    };

    const getDataExtent = (data: any[]): PaddingStrategy => {
        if (base.padUnit() == "domain") {
            const dataWidth = getMinimumGap(data);
            return base.pad([dataWidth / 2, dataWidth / 2])(data);
        } else {
            return base(data);
        }
    };

    _domain.valueName = (...args: ValueName[]): any => {
        if (!args.length) {
            return valueNames[0];
        }
        valueNames = [args[0]];
        return _domain;
    };

    _domain.valueNames = (...args: ValueName[][]): any => {
        if (!args.length) {
            return valueNames;
        }
        valueNames = args[0];
        return _domain;
    };

    return _domain;
};

export const labelFunction =
    (valueName) =>
    (d): string =>
        d[valueName][0];

export const tickFormatFunction = getValueFormatterForRange;

export const component = (_settings: Settings): Component => {
    let domain = null;
    let orient = "horizontal";
    let settingName = null;

    const getAxis = (s, data) => {
        try {
            const container = getChartContainer(s.node());
            const chart = container.querySelector(".cartesian-chart");
            const axis = chart.querySelector(`.${data}-axis`);
            return axis;
        } catch (e) {
            return null;
        }
    };

    // shrinks a given tick label
    const shrinkTickLabel = (node) => {
        const text = d3.select(node).select("text").node();
        (text as HTMLElement).style.fontSize = "80%";
    };

    // resizes ticks if they overflow the axis box
    const shrinkTicks = (axis, s) => {
        const axisBox = axis.getBoundingClientRect();
        s.each((d, i, nodes) => {
            const tickBox = d3.select(nodes[i]).node().getBoundingClientRect();

            // if the tick is bigger than the axis, resize it
            if (orient == "vertical" && axisBox.width < tickBox.width) {
                shrinkTickLabel(nodes[i]);
            } else if (
                orient == "horizontal" &&
                axisBox.height < tickBox.height
            ) {
                shrinkTickLabel(nodes[i]);
            }
        });
    };

    const decorate = (s, data, _index) => {
        const axis = getAxis(s, data);
        if (axis) {
            shrinkTicks(axis, s);
        }
    };

	// const getComponent: any = (): ComponentData => {
    //     const components = {
    //         bottom: fc.axisBottom,
    //         left: (scale) => {
    //             const axis = fc.axisLeft(scale);
                
    //             // 获取域的范围（最大值和最小值）
    //             const domain = scale.domain();
                
    //             // 自定义刻度生成器，只返回最大值和最小值
    //             axis.tickValues([domain[0], domain[1]])  // 只显示最大和最小值
    //                 .tickSize(0)  // 设置刻度线长度为0
    //                 .tickFormat((d) => {
    //                     // 使用合适的格式化函数处理数值
    //                     return d.toFixed(2);  // 保留两位小数，你可以根据需要调整格式
    //                 });
                
    //             return axis;
    //         },
    //         top: fc.axisTop,
    //         right: fc.axisRight,
    //         decorate,
    //     };
    //     return components;
    // };
	
	const getComponent: any = (): ComponentData => {
    const components = {
        bottom: fc.axisBottom,
        left: (scale) => {
            const axis = fc.axisLeft(scale);
            
            // 获取y轴配置
            const yAxisConfig = _settings?.plugin_config?.y_axis;
            
            // 只有明确设置为 false 时才完全隐藏刻度
            if (yAxisConfig?.showMinMaxTicks === false) {
                // 完全隐藏刻度
                axis.tickSize(0)
                    .tickFormat(() => '')
                    .ticks(0);
            } else {
                // 默认显示最大值和最小值刻度
                const domain = scale.domain();
                axis.tickValues([domain[0], domain[1]])
                    .tickSize(0)
                    .tickFormat((d) => d.toFixed(2));
            }
            
            // 添加处理column label的代码
            //if (yAxisConfig?.hideColumnLabels) {
                axis.tickFormat(() => '');
            //}
            
            return axis;
        },
        top: fc.axisTop,
        right: fc.axisRight,
        decorate,
    };
    return components;
};

	
    getComponent.domain = (...args) => {
        if (!args.length) {
            return domain;
        }
        domain = args[0];
        return getComponent;
    };

    getComponent.orient = (...args) => {
        if (!args.length) {
            return orient;
        }
        orient = args[0];
        return getComponent;
    };

    getComponent.settingName = (...args) => {
        if (!args.length) {
            return settingName;
        }
        settingName = args[0];
        return getComponent;
    };

    return getComponent;
};
