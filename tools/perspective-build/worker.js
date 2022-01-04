const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

exports.WorkerPlugin = function WorkerPlugin(inline) {
    function setup(build) {
        build.onResolve({filter: /worker.js$/}, (args) => {
            if (args.namespace === "worker-stub") {
                const outfile = `build/worker/` + path.basename(args.path);
                const subbuild = esbuild.build({
                    target: ["es2021"],
                    entryPoints: [require.resolve(args.path)],
                    outfile,
                    define: {
                        global: "self",
                    },
                    entryNames: "[name]",
                    chunkNames: "[name]",
                    assetNames: "[name]",
                    minify: !process.env.PSP_DEBUG,
                    bundle: true,
                    sourcemap: true,
                });

                return {
                    path: args.path,
                    namespace: "worker",
                    pluginData: {
                        outfile,
                        subbuild,
                    },
                };
            }

            return {
                path: args.path,
                namespace: "worker-stub",
            };
        });

        build.onLoad({filter: /.*/, namespace: "worker-stub"}, async (args) => {
            if (inline) {
                return {
                    contents: `
                        import worker from ${JSON.stringify(args.path)};
                        export const initialize = async function () {
                            const blob = new Blob([worker], {type: 'application/javascript'});
                            const url = URL.createObjectURL(blob);
                            return new Worker(url, {type: "module"});
                        };

                        export default initialize;
                    `,
                };
            }

            return {
                contents: `
                    import worker from ${JSON.stringify(args.path)};
                    async function get_worker_code() {
                        const url = new URL(worker, import.meta.url);
                        const req = await fetch(url);
                        const code = await req.text();
                        return code;
                    };

                    const code_promise = get_worker_code();
                    export const initialize = async function () {
                        const code = await code_promise;
                        const blob = new Blob([code], {type: 'application/javascript'});
                        const url2 = URL.createObjectURL(blob);
                        return new Worker(url2, {type: "module"});
                    };

                    export default initialize;
                `,
            };
        });

        build.onLoad({filter: /.*/, namespace: "worker"}, async (args) => {
            // Get the subbuild output and delete the temp file
            await args.pluginData.subbuild;
            contents = await fs.promises.readFile(args.pluginData.outfile);

            // Copy the sourcemaps also
            const mapfile = args.pluginData.outfile + ".map";
            sourcemap = await fs.promises.readFile(mapfile);

            const outpath =
                build.initialOptions.outdir ||
                path.dirname(build.initialOptions.outfile);

            if (!fs.existsSync(outpath)) {
                fs.mkdirSync(outpath, {recursive: true});
            }

            await fs.promises.writeFile(
                path.join(outpath, path.basename(args.path) + ".map"),
                sourcemap
            );

            return {
                contents,
                loader: inline ? "text" : "file",
            };
        });
    }

    return {
        name: "webworker",
        setup,
    };
};
