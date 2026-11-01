# rollup-vinyl-stream2 [![npm][npm-image]][npm-url] [![Test][ci-image]][ci-url]
This is a wrapper around [Rollup] that returns a readable vinyl stream and
makes using Rollup with [gulp] easier.

This package is based on [rollup-stream] and [rollup-vinyl-stream], and has been
modified to include [Rollup] as a peer-dependency as well as to support
multiple inputs (code splitting) and multiple outputs.

Version 2.x requires Rollup 4 (`^4.59.0`) and Node.js `^20.19.0 || >=22.12.0`.
Use version 1.x for Rollup 1.

The options object is passed to Rollup's `rollup()` method, and each entry of
its `output` option (a single object or an array) is passed to
`bundle.generate()`. Output options such as `format` or `sourcemap` therefore
belong into `output`. Every generated chunk and asset is pushed into the stream
as a vinyl file. Once all outputs are generated, the bundle is closed.

## Installation
```bash
npm install --save-dev rollup rollup-vinyl-stream2
```

or

```bash
yarn add rollup rollup-vinyl-stream2
```

## Basic usage
```js
const gulp         = require('gulp');
const rollupStream = require('rollup-vinyl-stream2');

gulp.task('rollup', () =>
  rollupStream({
    input: './src/main.js',
    output: {
      format: 'umd',
    },
  })
  // Output to ./dist/main.js
  .pipe(gulp.dest('./dist'))
);
```


## Multiple inputs with code splitting
```js
const gulp         = require('gulp');
const rollupStream = require('rollup-vinyl-stream2');

gulp.task('rollup', () =>
  rollupStream({
    input: [
      './src/main.js',
      './src/entry2.js',
      './src/entry3.js'
    ],
    output: {
      dir:    'chunks',
      format: 'es',
    },
  })
  // Output to ./dist/chunks/main.js, ./dist/chunks/entry2.js, ...
  .pipe(gulp.dest('./dist'))
);
```

## Multiple outputs
```js
const gulp         = require('gulp');
const rollupStream = require('rollup-vinyl-stream2');

gulp.task('rollup', () =>
  rollupStream({
    input:  './src/index.js',
    output: [
      {
        file:   'index.es.js',
        format: 'es',
      },
      {
        file:   'index.system.js',
        format: 'system',
      },
    ],
  })
  .pipe(gulp.dest('./dist'))
);
```

## Multiple inputs and multiple targets
```js
const gulp         = require('gulp');
const rollupStream = require('rollup-vinyl-stream2');

gulp.task('rollup', () =>
  rollupStream({
    input:  [
      './src/main.js',
      './src/entry2.js',
      './src/entry3.js'
    ],
    output: [
      {
        dir:   'js2015',
        format: 'es',
      },
      {
        dir:   'js',
        format: 'system',
      },
    ],
  })
  .pipe(gulp.dest('./dist'))
);
```

## Usage with sourcemaps
```js
const gulp         = require('gulp');
const rollupStream = require('rollup-vinyl-stream2');
const sourcemaps   = require('gulp-sourcemaps');

gulp.task('rollup', () =>
  rollupStream({
    input: './src/main.js',
    output: {
      sourcemap: true,
    },
  })

  // tell gulp-sourcemaps to load the sourcemaps produced by rollup-vinyl-stream2.
  .pipe(sourcemaps.init({ loadMaps: true }))

  // write the sourcemap alongside the output file.
  .pipe(sourcemaps.write('.'))

  // and output to ./dist/main.js as normal.
  .pipe(gulp.dest('./dist'))
);
```

## Usage with Rollup config file
```js
const gulp         = require('gulp');
const rollupStream = require('rollup-vinyl-stream2');

gulp.task('rollup', () =>
  rollupStream({ config: './rollup.config.js' })
  .pipe(gulp.dest('./dist'))
);
```

or for compatibility with [rollup-stream]

```js
const gulp         = require('gulp');
const rollupStream = require('rollup-vinyl-stream2');

gulp.task('rollup', () =>
  rollupStream('./rollup.config.js')
  .pipe(gulp.dest('./dist'))
);
```

## Usage with caching
```js
const gulp         = require('gulp');
const rollupStream = require('rollup-vinyl-stream2');
let   cache;

gulp.task('rollup', () =>
  rollupStream({
    input: './src/main.js',
    cache,
  })
  .on('bundle', (bundle) => cache = bundle.cache)
  .pipe(gulp.dest('./dist'))
);

gulp.task('watch', () => {
  gulp.watch('./src/**/*.js', gulp.series('rollup'));
});
```

## Cache Options

```js
const gulp         = require('gulp');
const rollupStream = require('rollup-vinyl-stream2');
let   options      = { config: './rollup.config.js' };

gulp.task('rollup', () =>
  rollupStream(options)
  .on('config', (config) => options = config)
  .on('bundle', (bundle) => options.cache = bundle.cache)
  .pipe(gulp.dest('./dist'))
);
```


[npm-url]: https://npmjs.org/package/rollup-vinyl-stream2
[npm-image]: https://img.shields.io/npm/v/rollup-vinyl-stream2.svg
[ci-url]: https://github.com/Garbanas/rollup-vinyl-stream2/actions/workflows/test.yml
[ci-image]: https://github.com/Garbanas/rollup-vinyl-stream2/actions/workflows/test.yml/badge.svg

[Rollup]: https://www.npmjs.com/package/rollup
[gulp]: http://gulpjs.com/
[rollup-stream]: https://github.com/Permutatrix/rollup-stream
[rollup-vinyl-stream]: https://github.com/AdamHerrmann/rollup-vinyl-stream
