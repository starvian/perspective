const path = require('path');
const common = require('./common.config.js');

module.exports = Object.assign({}, common(), {
    entry: './src/js/perspective.wasm.js',
    output: {
        filename: 'perspective.js',
        path: path.resolve(__dirname, '../../build/wasm_async')
    }
});