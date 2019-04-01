/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

import {select} from "d3";
import {treeData} from "../data/treeData";
import {clickHandler} from "../interaction/clickHandler";
import {drawArc, arcVisible} from "../series/arcSeries";
import {labelVisible, labelTransform, cropLabel} from "../axis/sunburstLabel";
import {colorRangeLegend} from "../legend/colorRangeLegend";
import {tooltip} from "../tooltip/tooltip";

function sunburst(container, settings) {
    const sunburstData = treeData(settings);
    const {width: containerWidth, height: containerHeight} = container.node().getBoundingClientRect();

    const minSize = 500;
    const cols = sunburstData.length === 1 ? 1 : Math.floor(containerWidth / minSize);
    const rows = Math.ceil(sunburstData.length / cols);
    container.style("grid-template-columns", `repeat(${cols}, ${containerWidth / cols}px)`);
    container.style("grid-template-rows", `repeat(${rows}, ${containerHeight / cols}px)`);

    const sunburstDiv = container.selectAll("div.sunburst-container").data(treeData(settings), d => d.split);
    sunburstDiv.exit().remove();

    const sunburstEnter = sunburstDiv
        .enter()
        .append("div")
        .attr("class", "sunburst-container");

    const sunburstContainer = sunburstEnter
        .append("svg")
        .append("g")
        .attr("class", "sunburst");

    sunburstContainer.append("text").attr("class", "title");

    sunburstContainer
        .append("circle")
        .attr("fill", "none")
        .attr("pointer-events", "all");

    sunburstContainer.append("text").attr("class", "parent");
    sunburstEnter
        .merge(sunburstDiv)
        .select("svg")
        .select("g.sunburst")
        .attr("transform", `translate(${containerWidth / 2 / cols}, ${containerHeight / 2 / cols})`)
        .each(function({split, data, color}) {
            const sunburstElement = select(this);
            const svgNode = this.parentNode;
            const {width, height} = svgNode.getBoundingClientRect();

            const title = sunburstElement.select("text.title").text(split);
            title.attr("transform", `translate(0, ${-(height / 2 - 5)})`);

            const radius = (Math.min(width, height) - 100) / 6;
            data.each(d => {
                d.current = d;
                d.mainValues = settings.mainValues.length === 1 ? d.value : [d.value, d.data.color];
                d.crossValue = d
                    .ancestors()
                    .slice(0, -1)
                    .reverse()
                    .map(cross => cross.data.name)
                    .join("|");
                d.key = split;
            });

            const segment = sunburstElement.selectAll("g.segment").data(data.descendants().slice(1));
            const segmentEnter = segment
                .enter()
                .append("g")
                .attr("class", "segment");

            segmentEnter.append("path");
            segmentEnter
                .append("text")
                .attr("class", "segment")
                .attr("dy", "0.35em");
            const segmentMerge = segmentEnter.merge(segment);

            const path = segmentMerge
                .select("path")
                .attr("fill", d => color(d.data.color))
                .attr("fill-opacity", d => (arcVisible(d.current) ? 0.8 : 0))
                .attr("user-select", d => (arcVisible(d.current) ? "initial" : "none"))
                .attr("pointer-events", d => (arcVisible(d.current) ? "initial" : "none"))
                .attr("d", d => drawArc(radius)(d.current));

            const label = segmentMerge
                .select("text")
                .attr("fill-opacity", d => +labelVisible(d.current))
                .attr("transform", d => labelTransform(d.current, radius))
                .text(d => d.data.name)
                .each(function(d) {
                    cropLabel.call(this, d, radius);
                });

            const parentTitle = sunburstElement.select("text.parent");
            const parent = sunburstElement
                .select("circle")
                .attr("r", radius)
                .datum(data);

            const onClick = clickHandler(data, sunburstElement, parent, parentTitle, path, label, radius, split, settings);
            if (settings.sunburstLevel) {
                const currentLevel = data.descendants().find(d => d.data.name === settings.sunburstLevel[split]);
                currentLevel && onClick(currentLevel, true);
            } else {
                settings.sunburstLevel = {};
            }
            parent.on("click", d => onClick(d, false));
            path.filter(d => d.children)
                .style("cursor", "pointer")
                .on("click", d => onClick(d, false));

            const legend = colorRangeLegend().scale(color);
            select(svgNode.parentNode)
                .call(legend)
                .select("div.legend-container");

            tooltip().settings(settings)(sunburstElement.selectAll("g.segment"));
        });
}
sunburst.plugin = {
    type: "d3_sunburst",
    name: "[D3] Sunburst",
    max_size: 25000,
    initial: {
        type: "number",
        count: 2
    }
};

export default sunburst;
