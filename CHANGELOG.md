# rollup-vinyl-stream2 changelog

## [1.3.0]
*2026-11-02*

* Added support for [Rollup] 2, 3 and 4 (peer dependency `>=1.16.6 <5`), so you can upgrade to a Rollup version without [GHSA-gcx4-mw62-g8wm] and [GHSA-mw96-cpmx-2vgc]. Rollup 1 users are not affected.
* Only output options are passed to `bundle.generate()`; top-level output options such as `format` or `sourcemap` are still inherited. Fixes "Unknown output options" warnings on Rollup 3+.
* On Rollup 3+, the extra `.map` asset and `sourceMappingURL` comment are dropped when the sourcemap is applied to the vinyl file, avoiding duplicate sourcemaps.
* On Rollup 2.23+, the bundle is closed after all outputs are generated, unless you listen for the `bundle` event.
* If you don't list `rollup` in your own `package.json`, npm 7+ may now install Rollup 4 (Node 18+) as the peer dependency. Add `rollup` to your devDependencies to control the version.

## [1.2.3]
*2026-11-01*

* Fixed a crash when plugins emit assets: assets are now passed on as vinyl files, placed next to `output.file` if set (#6, thanks @TongChia)
* Fixed input plugins also being run as output plugins (#7, thanks @kzar)

## [1.2.2]
*2019-11-15*

* Fixed sourcemaps not being applied to the vinyl files (#4, #5, thanks @TongChia)

## [1.2.1]
*2019-07-08*

* Fixed the import of custom rollup config files

## [1.2.0]
*2019-07-06*

* [BREAKING] Upgraded [Rollup] peer dependency to version 1.16.6
* Filename fix
* Updated Readme

## [1.1.0]
*2018-06-07*

* [BREAKING] Upgraded [Rollup] peer dependency to version 0.60.1
* Adapted code to handle the new return types of [Rollup] 0.60.1
* Added CHANGELOG.md

## [1.0.1]
*2018-03-29*

* First release capable of doing the intended job
* Upgraded [Rollup] peer dependency to version 0.57.1

## [1.0.0]
*2018-03-28*

* Initial commit

[1.3.0]: https://www.npmjs.com/package/rollup-vinyl-stream2/v/1.3.0
[1.2.3]: https://www.npmjs.com/package/rollup-vinyl-stream2/v/1.2.3
[1.2.2]: https://www.npmjs.com/package/rollup-vinyl-stream2/v/1.2.2
[1.2.1]: https://www.npmjs.com/package/rollup-vinyl-stream2/v/1.2.1
[1.2.0]: https://www.npmjs.com/package/rollup-vinyl-stream2/v/1.2.0
[1.1.0]: https://www.npmjs.com/package/rollup-vinyl-stream2/v/1.1.0
[1.0.1]: https://www.npmjs.com/package/rollup-vinyl-stream2/v/1.0.1
[1.0.0]: https://www.npmjs.com/package/rollup-vinyl-stream2/v/1.0.0

[Rollup]: https://www.npmjs.com/package/rollup
[GHSA-gcx4-mw62-g8wm]: https://github.com/advisories/GHSA-gcx4-mw62-g8wm
[GHSA-mw96-cpmx-2vgc]: https://github.com/advisories/GHSA-mw96-cpmx-2vgc
