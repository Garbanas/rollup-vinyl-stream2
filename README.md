# rollup-vinyl-stream2 [![npm][npm-image]][npm-url] [![Dependency Status][david-image]][david-url] [![Build Status][travis-image]][travis-url]

**Fork from https://github.com/Garbanas/rollup-vinyl-stream2**

This is a wrapper around [Rollup] that returns a readable vinyl stream and
makes using Rollup with [gulp] easier.

This package is based on [rollup-stream] and [rollup-vinyl-stream], and has been
modified to include [Rollup] as a peer-dependency as well as to support
multiple outputs with the [Rollup] output options and / or the new experimental
option `experimentalCodeSplitting`.

The options object is passed to Rollup's rollup() and generate() methods. This
currently works because there's no overlap between the names of the options
those methods take. Hopefully that won't change any time soon!

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
      format: 'umd',
    },
    experimentalCodeSplitting: true,
    inlineDynamicImports: true,
  })
  // Output to ./dist/main.js
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
    experimentalCodeSplitting: true,
    inlineDynamicImports: true,
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
  .on('bundle', (bundle) => cache = bundle)
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
  .on('bundle', (bundle) => options.cache = bundle)
  .pipe(gulp.dest('./dist'))
);
```


[npm-url]: https://npmjs.org/package/rollup-vinyl-stream2
[npm-image]: https://img.shields.io/npm/v/rollup-vinyl-stream2.svg
[david-url]: https://david-dm.org/Garbanas/rollup-vinyl-stream2
[david-image]: https://img.shields.io/david/Garbanas/rollup-vinyl-stream2/master.svg
[travis-url]: https://travis-ci.org/Garbanas/rollup-vinyl-stream2
[travis-image]: https://img.shields.io/travis/Garbanas/rollup-vinyl-stream2/master.svg

[Rollup]: https://www.npmjs.com/package/rollup
[gulp]: http://gulpjs.com/
[rollup-stream]: https://github.com/Permutatrix/rollup-stream
[rollup-vinyl-stream]: https://github.com/AdamHerrmann/rollup-vinyl-stream
