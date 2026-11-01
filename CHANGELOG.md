# rollup-vinyl-stream2 changelog

## 2.0.0
*2026-11-01*

* [BREAKING] Upgraded [Rollup] peer dependency to `^4.59.0`. This fixes the
  Rollup security advisories [GHSA-gcx4-mw62-g8wm] (DOM clobbering XSS) and
  [GHSA-mw96-cpmx-2vgc] (path traversal file write).
* [BREAKING] Requires Node.js `^20.19.0 || >=22.12.0`
* [BREAKING] Only the `output` options are passed to `bundle.generate()`. Output
  options (e.g. `format`, `sourcemap`, `inlineDynamicImports`) must be put into
  `output` instead of the top level of the options object.
* [BREAKING] The bundle is closed (`bundle.close()`) once all outputs have been
  generated. `bundle.cache` stays usable, but `bundle.generate()` / `bundle.write()`
  can no longer be called later from a `bundle` event listener.
* Emitted assets are now passed through the stream as vinyl files
* Chunk file names (e.g. `chunkFileNames: 'chunks/[name].js'`) are preserved
  instead of being reduced to their base name
* Source maps stay attached to the vinyl file (`file.sourceMap`); the separate
  `.map` asset and `sourceMappingURL` comment that Rollup 4 generates are
  dropped, so the output stays compatible with gulp-sourcemaps
* Replaced `through2` with Node's `stream.PassThrough` and
  `vinyl-sourcemaps-apply` with a built-in conversion; upgraded `vinyl` to 3.x
* Tests: replaced `rollup-plugin-hypothetical` with an inline plugin, upgraded
  mocha to 12 and chai to 6
* Replaced Travis CI with GitHub Actions (Node.js 20, 22 and 24) and added
  `package-lock.json`

## 1.2.1
*2019-07-08*

* Fixed the import of custom rollup config files

## 1.2.0
*2019-07-06*

* [BREAKING] Upgraded [Rollup] peer dependency to version 1.16.6
* Filename fix
* Updated Readme

## 1.1.0
*2018-06-07*

* [BREAKING] Upgraded [Rollup] peer dependency to version 0.60.1
* Adapted code to handle the new return types of [Rollup] 0.60.1
* Added CHANGELOG.md

## 1.0.1
*2018-03-29*

* First release capable of doing the intended job
* Upgraded [Rollup] peer dependency to version 0.57.1

## 1.0.0
*2018-03-28*

* Initial commit

[Rollup]: https://www.npmjs.com/package/rollup
[GHSA-gcx4-mw62-g8wm]: https://github.com/advisories/GHSA-gcx4-mw62-g8wm
[GHSA-mw96-cpmx-2vgc]: https://github.com/advisories/GHSA-mw96-cpmx-2vgc
