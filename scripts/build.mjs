import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const webpack = require('webpack');
const root = fileURLToPath(new URL('../', import.meta.url));
const compiler = webpack({
    mode: 'production',
    context: root,
    entry: './index.js',
    target: ['web', 'es2022'],
    devtool: false,
    experiments: { outputModule: true },
    output: {
        path: path.join(root, 'src'),
        filename: 'runtime.bundle.js',
        library: { type: 'module' },
    },
    module: { parser: { javascript: { url: false, importMeta: false } } },
    externalsType: 'import',
    externals: [({ request }, callback) => {
        if (request === '/script.js' || request?.startsWith('/scripts/')) callback(null, request);
        else callback();
    }],
    optimization: { splitChunks: false, runtimeChunk: false },
    performance: { hints: false },
});

try {
    const stats = await new Promise((resolve, reject) => {
        compiler.run((error, result) => error ? reject(error) : resolve(result));
    });
    const report = stats.toString({ all: false, assets: true, errors: true, warnings: true });
    if (report) console.log(report);
    if (stats.hasErrors()) process.exitCode = 1;
} finally {
    await new Promise((resolve, reject) => compiler.close(error => error ? reject(error) : resolve()));
}
