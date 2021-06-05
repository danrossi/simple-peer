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
                format: 'umd',
                name: 'SimplePeer',
                file: 'build/simple-peer.min.js'
            }
        ]
    },
    {
        input: 'src/simple-peer.js',
        plugins: [
            nodeResolve({ browser:true, preferBuiltins: true }),
            /*commonjs({
                            include: './node_modules/**',
                            transformMixedEsModules: true

                        }),*/
            /*babel( {
                babelHelpers: 'bundled',
                babelrc: false,
                "presets": [
                    [
                      "@babel/preset-env",
                      {
                        "modules": false,
                        "targets": ">1%",
                        "loose": true,
                        "bugfixes": true
                      }
                    ]
                  ],
                  "plugins": [
                    [
                      "@babel/plugin-proposal-class-properties",
                      {
                        "loose": true
                      }
                    ]
                  ]
            } )*/
        ],
        output: [
            {
                format: 'iife',
                name: 'SimplePeer',
                file: 'build/simple-peer.es.js'
            }
        ]
    }
];