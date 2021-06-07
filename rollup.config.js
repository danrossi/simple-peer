import { terser } from 'rollup-plugin-terser';

//import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
//import babel from '@rollup/plugin-babel';

export default [
    {
        input: 'src/simple-peer.js',
        plugins: [
            nodeResolve({ browser:true, preferBuiltins: true })/*,
            commonjs({
                            include: './node_modules/**',
                            transformMixedEsModules: true
                        })*/
        ],
        output: [
            {
                 external: [
                    'global',
                    'global/window',
                    'global/document'
                ],
                globals: {
                    'global': 'window',
                    'global/window': 'window',
                    'global/document': 'document'
                },
                format: 'umd',
                name: 'SimplePeer',
                file: 'build/simple-peer.js',
                indent: '\t'
            }
        ]
    },
    {
        input: 'src/simple-peer.js',
        plugins: [
            nodeResolve({ browser:true, preferBuiltins: true }),/*
            commonjs({
                            include: './node_modules/**',
                            transformMixedEsModules: true

                        }),*/
            terser()
        ],
        output: [
            {
                 external: [
                    'global',
                    'global/window',
                    'global/document'
                ],
                globals: {
                    'global': 'window',
                    'global/window': 'window',
                    'global/document': 'document'
                },
                format: 'umd',
                name: 'SimplePeer',
                file: 'build/simple-peer.min.js'
            }
        ]
    },
    {
        options: {
             
        },
        input: 'src/simple-peer.js',
        plugins: [
            nodeResolve({ browser:true, preferBuiltins: true }),
            /*commonjs({
                            include: './node_modules/**',
                            transformMixedEsModules: true

                        }),*/
          
        ],
        output: [
            {
                external: [
                    'global',
                    'global/window',
                    'global/document'
                ],
                globals: {
                    'global': 'window',
                    'global/window': 'window',
                    'global/document': 'document'
                },
                format: 'esm',
                name: 'SimplePeer',
                file: 'build/simple-peer.es.js'
            }
        ]
    }
];