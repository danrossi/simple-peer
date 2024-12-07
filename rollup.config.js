import { terser } from 'rollup-plugin-terser';

import { nodeResolve } from '@rollup/plugin-node-resolve';

export default [
    {
        input: 'src/simple-peer.js',
        plugins: [
            nodeResolve({ browser:true, preferBuiltins: true })
        ],
        external: [
                    'global',
                    'global/window',
                    'global/document'
                ],
        output: [
            {
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
            nodeResolve({ browser:true, preferBuiltins: true }),
            terser()
        ],
        external: [
                    'global',
                    'global/window',
                    'global/document'
                ],
        output: [
            {
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
        input: 'src/simple-peer.js',
        plugins: [
            nodeResolve({ browser:true, preferBuiltins: true })
        ],
        external: [
                    'global',
                    'global/window',
                    'global/document',
                    'event-emitter'
                ],
        output: [
            {
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
    },
    {
        input: 'src/simple-peer.js',
        plugins: [
            nodeResolve({ browser:true, preferBuiltins: true }),
            terser()
          
        ],
        external: [
                    'global',
                    'global/window',
                    'global/document',
                    'event-emitter'
                ],
        output: [
            {
                 globals: {
                    'global': 'window',
                    'global/window': 'window',
                    'global/document': 'document'
                },
                format: 'esm',
                name: 'SimplePeer',
                file: 'build/simple-peer.es.min.js'
            }
        ]
    }
];