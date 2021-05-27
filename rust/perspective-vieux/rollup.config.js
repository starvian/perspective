import babel from "@rollup/plugin-babel";
import filesize from "rollup-plugin-filesize";
import postcss from "rollup-plugin-postcss";
import sourcemaps from "rollup-plugin-sourcemaps";
import path from "path";

export default () => {
    return [
        {
            input: `src/less/perspective-vieux.less`,
            output: {
                dir: "dist/css"
            },
            plugins: [
                postcss({
                    inject: false,
                    extract: path.resolve(`dist/css/perspective-vieux.css`),
                    minimize: {preset: "lite"}
                })
            ]
        },
        {
            input: `src/less/column-style.less`,
            output: {
                dir: "dist/css"
            },
            plugins: [
                postcss({
                    inject: false,
                    extract: path.resolve(`dist/css/column-style.css`),
                    minimize: {preset: "lite"}
                })
            ]
        },
        {
            input: `src/less/expression-editor.less`,
            output: {
                dir: "dist/css"
            },
            plugins: [
                postcss({
                    inject: false,
                    extract: path.resolve(`dist/css/expression-editor.css`),
                    minimize: {preset: "lite"}
                })
            ]
        },
        {
            input: "src/js/vieux.js",
            external: [/node_modules/, /pkg/, /monaco\-editor/],
            output: {
                sourcemap: true,
                dir: "dist/esm/"
            },
            plugins: [
                babel({
                    exclude: "node_modules/**",
                    babelHelpers: "bundled"
                }),
                filesize(),
                postcss({
                    inject: false,
                    sourceMap: true,
                    minimize: {mergeLonghand: false}
                }),
                sourcemaps()
            ].filter(x => x),
            watch: {
                clearScreen: false
            }
        }
    ];
};
