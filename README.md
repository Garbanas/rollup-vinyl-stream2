# rollup-vinyl-stream2 [![npm][npm-image]][npm-url] [![CI][ci-image]][ci-url]
This is a wrapper around [Rollup] that returns a readable vinyl stream and
makes using Rollup with [gulp] easier.

This package is based on [rollup-stream] and [rollup-vinyl-stream], and has been
modified to include [Rollup] as a peer-dependency as well as to support
multiple outputs with the [Rollup] output options and / or the new experimental
option `experimentalCodeSplitting`.

The options object is passed to Rollup's `rollup()` method. Each entry of
`output` (an object or an array of objects) is passed to `bundle.generate()`,
together with the output options given at the top level (e.g. `format`,
`sourcemap`, `name`, `globals`), which are inherited by every output.
Input-only options such as `input`, `plugins`, `external`, `onwarn`, `cache` or
`treeshake` are not passed on to `generate()`. Plugins for a single output go
into `output.plugins`.

## Rollup compatibility

[Rollup] is a peer dependency, so you choose the version. Install it explicitly
in your project (`npm install --save-dev rollup@4`) instead of relying on npm
to pick one for you.

| rollup-vinyl-stream2 | Rollup        | Node (required by Rollup) | Notes                                                   |
| -------------------- | ------------- | ------------------------- | ------------------------------------------------------- |
| 1.3.x                | 4.x           | 18+                       | Recommended; use 4.59.0+ for all security fixes         |
| 1.3.x                | 3.x           | 14.18+                    | Use 3.30.0+ for all security fixes                      |
| 1.3.x                | 2.x           | 10+                       | Use 2.80.0+ for all security fixes                      |
| 1.3.x                | 1.16.6 – 1.x  | any                       | Affected by [GHSA-gcx4-mw62-g8wm] and [GHSA-mw96-cpmx-2vgc]; `this.emitFile` needs 1.21+, output plugins need 1.27+ |
| 1.2.x                | 1.16.6 – 1.x  | any                       |                                                         |

Every combination of Rollup 1.16.6, 1, 2, 3 and 4 with Node 20, 22, 24 and 26 is
tested in CI. `index.js` itself stays ES2015, so the Node version you can use
is limited by your Rollup version, not by this package.

On Rollup 2.23+ the bundle is closed (`bundle.close()`) once all outputs are
generated, unless you listen for the `bundle` event, in which case you may keep
using the bundle and closing it is up to you.

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
// gulpfile.js (gulp 4)
const { src, dest, watch, series } = require('gulp');
const rollupStream = require('rollup-vinyl-stream2');

function bundle() {
  return rollupStream({
    input: './src/main.js',
    output: {
      format: 'umd',
      name: 'myLibrary',
    },
  })
  // Output to ./dist/main.js
  .pipe(dest('./dist'));
}

function watchFiles() {
  watch('./src/**/*.js', bundle);
}

exports.bundle  = bundle;
exports.watch   = series(bundle, watchFiles);
exports.default = bundle;
```

The examples below use the older `gulp.task()` API, which still works in gulp 4.


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

## Assets and sourcemaps

Assets emitted by plugins (e.g. with `this.emitFile({ type: 'asset', ... })`)
are pushed into the stream as vinyl files as well. They are placed in
`output.dir`, or next to `output.file` if that is set.

With `sourcemap: true` or `sourcemap: 'hidden'`, the sourcemap of each chunk is
applied to its vinyl file (`file.sourceMap`), ready for [gulp-sourcemaps].
Rollup 3+ also returns the sourcemap as a separate `.map` asset and adds a
`//# sourceMappingURL` comment; both are removed so you don't end up with
duplicate sourcemaps, and the output is the same on every Rollup version. Use
`gulp-sourcemaps` to write the sourcemaps (see above). With `sourcemap:
'inline'`, Rollup 3+ keeps the inline sourcemap in the code.

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

### Known limitation

The config file has to export a single options object. Config files that
export an array of configs or a function (`export default (args) => ...`) are
not supported. Use one `rollupStream()` call per config instead.

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
[ci-url]: https://github.com/Garbanas/rollup-vinyl-stream2/actions/workflows/test.yml
[ci-image]: https://github.com/Garbanas/rollup-vinyl-stream2/actions/workflows/test.yml/badge.svg?branch=master

[Rollup]: https://www.npmjs.com/package/rollup
[gulp]: http://gulpjs.com/
[rollup-stream]: https://github.com/Permutatrix/rollup-stream
[rollup-vinyl-stream]: https://github.com/AdamHerrmann/rollup-vinyl-stream
[gulp-sourcemaps]: https://www.npmjs.com/package/gulp-sourcemaps
[GHSA-gcx4-mw62-g8wm]: https://github.com/advisories/GHSA-gcx4-mw62-g8wm
[GHSA-mw96-cpmx-2vgc]: https://github.com/advisories/GHSA-mw96-cpmx-2vgc
