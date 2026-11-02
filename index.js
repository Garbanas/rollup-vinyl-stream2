'use strict';

const through2 = require('through2').obj;
const path = require('path');
const requireFromString = require('require-from-string');
const File = require('vinyl');
const applySourceMap = require('vinyl-sourcemaps-apply');

const streamKeys = ['rollup', 'vinyl', 'config'];

/**
 * Top-level options that are only meaningful to rollup.rollup() and must not
 * be inherited by bundle.generate(). This is a deny-list on purpose: Rollup
 * keeps adding output options (e.g. hashCharacters, sourcemapDebugIds in 4.x)
 * and an allow-list would silently drop the next one. A new input-only option
 * that is missing here only causes an "Unknown output options" warning on
 * Rollup 3+; Rollup 1 and 2 ignore unknown output keys anyway.
 *
 * Deliberately NOT listed: inlineDynamicImports, manualChunks and
 * preserveModules. They are input options on Rollup 1 but output options on
 * Rollup 3+, so they have to reach both rollup() and generate().
 */
const inputOnlyKeys = [
  'acorn',
  'acornInjectPlugins',
  'cache',
  'chunkGroupingSize',
  'context',
  'experimentalCacheExpiry',
  'experimentalLogSideEffects',
  'experimentalOptimizeChunks',
  'experimentalTopLevelAwait',
  'external',
  'fs',
  'input',
  'jsx',
  'logLevel',
  'makeAbsoluteExternalsRelative',
  'maxParallelFileOps',
  'maxParallelFileReads',
  'moduleContext',
  'onLog',
  'onwarn',
  'output',
  'perf',
  // Input plugins must not be passed on as output plugins (#7)
  'plugins',
  'preserveEntrySignatures',
  'preserveSymlinks',
  'shimMissingExports',
  'strictDeprecations',
  'treeshake',
  'watch',
];

function pickOutputOptions(options) {
  const outputOptions = {};
  Object
    .keys(options)
    .filter((key) => (-1 === inputOnlyKeys.indexOf(key)))
    .forEach((key) => {
      outputOptions[key] = options[key];
    });
  return outputOptions;
}

function closeBundle(bundle) {
  return (bundle && typeof bundle.close === 'function')
    ? Promise.resolve().then(() => bundle.close())
    : Promise.resolve();
}

function loadOptions(options, rollup, streamEmit) {
  const filteredOptions = {};
  Object
    .keys(options)
    .filter((key) => (-1 === streamKeys.indexOf(key)))
    .forEach((key) => {
      filteredOptions[key] = options[key]
    });

  const config = options.config
    ? loadRollupConfig(path.resolve(options.config), rollup, streamEmit)
    : Promise.resolve({});

  return config
    .then((config) => Object.assign(config, filteredOptions));
}

function loadRollupConfig(input, rollup, streamEmit) {
  const ignorable = (error) => error.code === 'UNRESOLVED_IMPORT';
  const onwarn    = (error) => ignorable(error) || console.warn(error.toString());

  return rollup
    .rollup({ input, onwarn })
    .then((bundle) => bundle
      .generate({ format: 'cjs' })
      .then(
        (result) => closeBundle(bundle).then(() => result),
        (error) => closeBundle(bundle).then(() => { throw error; }, () => { throw error; })
      )
    )
    .then((result) => requireFromString(result.output[0].code, input))
    .then(streamEmit('config'))
    .then((config) => (Object.assign({}, config)))
    ;
}

/**
 * @param {OutputChunk | OutputFile} outputFile
 * @param vinylOpts
 * @param {string} fileName
 * @param output
 * @return {File}
 */
function createVinylFile(outputFile, vinylOpts, fileName, output) {
  vinylOpts = (typeof vinylOpts !== 'undefined') ? vinylOpts : {};
  output = (typeof output !== 'undefined') ? output : {};

  // Assets (e.g. from this.emitFile) carry `source` instead of `code`
  const isAsset = typeof outputFile === 'object'
    && !Buffer.isBuffer(outputFile)
    && 'source' in outputFile
    && !('code' in outputFile);

  let filePath;
  // This is multiple inputs
  if (output.dir) {
    filePath = path.resolve(output.dir, fileName);
  // Assets are placed next to output.file, like Rollup's write() does
  } else if (output.file && isAsset) {
    filePath = path.resolve(path.dirname(output.file), fileName);
  // This is multiple and / or named outputs
  } else if (output.file) {
    filePath = path.resolve(output.file);
  // Just a single input -> output
  } else if (fileName) {
    filePath = path.resolve(path.basename(fileName));
  // This should never happen :)
  } else {
    filePath = path.resolve('./main.js');
  }

  let bufferedFileContent;
  let sourceMap;
  if (typeof outputFile === 'string') {
    bufferedFileContent = Buffer.from(outputFile);
  } else if (Buffer.isBuffer(outputFile)) {
    bufferedFileContent = outputFile;
  } else if (isAsset) { // It's an OutputAsset!
    bufferedFileContent = Buffer.from(outputFile.source);
  } else { // It's an OutputChunk!
    bufferedFileContent = Buffer.from(outputFile.code);
    sourceMap = outputFile.map;
  }

  const file = new File(Object.assign({}, vinylOpts, {
    path:     filePath,
    contents: bufferedFileContent,
  }));

  if (sourceMap) {
    applySourceMap(file, sourceMap);
  }

  return file;
}

/**
 * Rollup 3+ returns the sourcemap of a chunk as an extra asset and appends a
 * sourceMappingURL comment pointing to it. The map is already applied to the
 * vinyl file (for gulp-sourcemaps), so drop that asset and that comment to
 * match the output of Rollup 1 and 2 and avoid duplicates. Other assets and
 * inline sourcemaps are left untouched.
 *
 * @param {Array} outputFiles generate() output of a single output
 * @return {Array}
 */
function removeAppliedSourcemapAssets(outputFiles) {
  const isChunkWithMap = (file) => file && typeof file.code === 'string' && file.map;
  const mapFileNameOf  = (chunk) => chunk.sourcemapFileName || (chunk.fileName + '.map');
  const isAsset        = (file) => file && 'source' in file && !('code' in file);

  const mapFileNames = outputFiles
    .filter(isChunkWithMap)
    .map(mapFileNameOf)
    .filter((mapFileName) => outputFiles.some((file) => isAsset(file) && file.fileName === mapFileName));

  if (mapFileNames.length === 0) {
    return outputFiles;
  }

  return outputFiles
    .filter((file) => !(isAsset(file) && -1 !== mapFileNames.indexOf(file.fileName)))
    .map((file) => {
      if (!isChunkWithMap(file) || -1 === mapFileNames.indexOf(mapFileNameOf(file))) {
        return file;
      }
      return Object.assign({}, file, {
        code: file.code.replace(/\/\/# sourceMappingURL=[^\n]*\n?$/, ''),
      });
    });
}

function createOutputBundler(bundle, opts, vinylOpts) {
  // Top-level output options (format, sourcemap, name, globals, ...) are
  // still inherited by every output for backwards compatibility.
  const inheritedOpts = pickOutputOptions(opts);

  return (output) => {
    return bundle
      .generate(Object.assign({}, inheritedOpts, output))
      .then((/** @type {{output: OutputBundle} | OutputChunk} */result) => {
        if (result.output) {
          const outputFiles = Array.isArray(result.output)
            ? removeAppliedSourcemapAssets(result.output)
            : result.output;
          const files = Object
            .keys(outputFiles)
            .map((index) => {
              const fileName = isNaN(index) ? index : outputFiles[index].fileName;
              return createVinylFile(outputFiles[index], vinylOpts, fileName, output)
            })
          ;
          return Promise.resolve(files);
        }
        return Promise.resolve([ createVinylFile(result, vinylOpts, opts.input, output) ]);
      })
      ;
  };
}

module.exports = function rollupVinylStream(options) {
  options = (typeof options !== 'undefined') ? options : {};
  if (typeof options === 'string') {
    options = {
      config: options,
    };
  }

  const stream     = through2();
  const streamEmit = (name) => (obj) => { stream.emit(name, obj); return obj; };
  const rollup     = options.rollup || require('rollup');
  const vinylOpts  = options.vinyl || {};
  const rollupOpts = loadOptions(options, rollup, streamEmit);

  rollupOpts
    .then((opts) =>
      rollup
      .rollup(opts)
      .then(streamEmit('bundle'))
      .then((bundle) => {
        const bundleOutput = createOutputBundler(bundle, opts, vinylOpts);
        let outputs;
        if (opts.output) {
          outputs = Array.isArray(opts.output) ? opts.output : [opts.output];
        } else {
          outputs = [{}];
        }
        // Free the resources of Rollup 2.23+ once all outputs are generated,
        // unless someone listens for the bundle and might still use it.
        const close = () => (stream.listenerCount('bundle') > 0)
          ? Promise.resolve()
          : closeBundle(bundle);
        return Promise.all(outputs.map(bundleOutput))
          .then(
            (bundleOutputs) => close().then(() => bundleOutputs),
            (error) => close().then(() => { throw error; }, () => { throw error; })
          );
      })
      .then((bundleOutputs) => {
        bundleOutputs.forEach(files => files.forEach(file => stream.push(file)));
        stream.push(null);
      })
    )
    .catch(streamEmit('error'))
  ;

  return stream;
};
