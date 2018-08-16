/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

const utils = require('@jpmorganchase/perspective-viewer/test/js/utils.js');

const simple_tests = require('@jpmorganchase/perspective-viewer/test/js/simple_tests.js');

const axis_tests = require('./axis_tests.js');

utils.with_server({}, () => {

    describe.page("line.html", () => {

        simple_tests.default();

        axis_tests.default();
       
        describe('tooltip tests', () => {
            const series = 'path.highcharts-graph';
            const tooltip_selector = '.highcharts-label.highcharts-tooltip';
            const text = tooltip_selector + ' > text';

            test.capture('tooltip shows on hover.', async page => {
                await page.click('#config_button');
                await page.$('perspective-viewer');
                await utils.invoke_tooltip(series, page);
            });

            test.run('tooltip shows proper column labels.', async page => {
                await page.click('#config_button');
                await page.$('perspective-viewer');
                await utils.invoke_tooltip(series, page);
                return await page.$eval(text,
                    element => element.textContent.includes('Order Date') &&
                        element.textContent.includes('Profit'));
            });

            test.run('tooltip shows pivot labels.', async page => {
                await page.click('#config_button');
                const viewer = await page.$('perspective-viewer');

                // set a row pivot and a column pivot
                await page.evaluate(element => element.setAttribute('row-pivots', '["State"]'), viewer);
                await page.waitForSelector('perspective-viewer:not([updating])');
                await page.evaluate(element => element.setAttribute('column-pivots', '["Category"]'), viewer);
                await page.waitForSelector('perspective-viewer:not([updating])');

                await utils.invoke_tooltip(series, page);
                return await page.$eval(
                    text, element => {
                    return element.textContent.includes('State') &&
                        element.textContent.includes('Category');
                    });
            });
        });


    });

});
