'use strict';

const path = require('path');
const { PassThrough } = require('stream');
const requireFromString = require('require-from-string');
const File = require('vinyl');

const streamKeys = ['rollup', 'vinyl', 'config'];

function loadOptions(options, rollup, streamEmit) {
  const filteredOptions = {};
  Object
    .keys(options)
    .filter((key) => (-1 === streamKeys.indexOf(key)))
    .forEach((key) => {
      filteredOptions[key] = options[key];
    });

  const config = options.config
    ? loadRollupConfig(path.resolve(options.config), rollup, streamEmit)
    : Promise.resolve({});

  return config
    .then((config) => Object.assign(config, filteredOptions));
}

async function loadRollupConfig(input, rollup, streamEmit) {
  const ignorable = (log) => log.code === 'UNRESOLVED_IMPORT';
  const onwarn    = (warning) => ignorable(warning) || console.warn(warning.toString());

  const bundle = await rollup.rollup({ input, onwarn });
  try {
    const result = await bundle.generate({ format: 'cjs', exports: 'auto' });
    const config = requireFromString(result.output[0].code, input);
    streamEmit('config')(config);
    return Object.assign({}, config);
  } finally {
    await closeBundle(bundle);
  }
}

function closeBundle(bundle) {
  return (bundle && typeof bundle.close === 'function' && !bundle.closed)
    ? bundle.close()
    : Promise.resolve();
}

/**
 * Converts a Rollup SourceMap into the plain object format vinyl / gulp-sourcemaps expect.
 */
function toVinylSourceMap(map) {
  const sourceMap = (typeof map === 'string') ? JSON.parse(map) : JSON.parse(JSON.stringify(map));
  sourceMap.file    = (sourceMap.file || '').replace(/\\/g, '/');
  sourceMap.sources = (sourceMap.sources || []).map((source) => source.replace(/\\/g, '/'));
  return sourceMap;
}

function resolveFilePath(fileName, output) {
  // This is multiple inputs
  if (output.dir) {
    return path.resolve(output.dir, fileName);
  }
  // This is multiple and / or named outputs
  if (output.file) {
    return path.resolve(path.dirname(output.file), fileName || path.basename(output.file));
  }
  // Just a single input -> output
  if (fileName) {
    return path.resolve(fileName);
  }
  // This should never happen :)
  return path.resolve('./main.js');
}

/**
 * @param {import('rollup').OutputChunk | import('rollup').OutputAsset | {code: string, map?: object}} outputFile
 * @param {object} vinylOpts
 * @param {string} fileName
 * @param {object} output
 * @return {File}
 */
function createVinylFile(outputFile, vinylOpts, fileName, output) {
  let contents;
  let sourceMap;

  if (outputFile.type === 'asset') {
    contents = Buffer.from(outputFile.source);
  } else {
    let code = outputFile.code;
    sourceMap = outputFile.map;
    // Rollup >= 3 appends a reference to a separate .map file. The map is attached to the
    // vinyl file instead (as in previous versions), so the reference is removed again.
    if (sourceMap && outputFile.sourcemapFileName) {
      const comment = `//# sourceMappingURL=${path.basename(outputFile.sourcemapFileName)}\n`;
      if (code.endsWith(comment)) {
        code = code.slice(0, -comment.length);
      }
    }
    contents = Buffer.from(code);
  }

  const file = new File(Object.assign({}, vinylOpts, {
    path: resolveFilePath(fileName, output),
    contents,
  }));

  if (sourceMap) {
    file.sourceMap = toVinylSourceMap(sourceMap);
  }

  return file;
}

function createOutputBundler(bundle, opts, vinylOpts) {
  return async (output) => {
    const result = await bundle.generate(Object.assign({}, output));

    // Custom rollup implementations may return a single chunk-like object
    if (!result.output) {
      const fileName = (typeof opts.input === 'string') ? path.basename(opts.input) : undefined;
      return [createVinylFile(result, vinylOpts, fileName, output)];
    }

    // Source maps attached to their chunk don't need to be emitted as separate files
    const attachedMaps = new Set(result.output
      .filter((item) => item.type !== 'asset' && item.map && item.sourcemapFileName)
      .map((chunk) => chunk.sourcemapFileName));

    return result.output
      .filter((item) => !(item.type === 'asset' && attachedMaps.has(item.fileName)))
      .map((item) => createVinylFile(item, vinylOpts, item.fileName, output));
  };
}

module.exports = function rollupVinylStream(options) {
  options = (typeof options !== 'undefined') ? options : {};
  if (typeof options === 'string') {
    options = {
      config: options,
    };
  }

  const stream     = new PassThrough({ objectMode: true });
  const streamEmit = (name) => (obj) => { stream.emit(name, obj); return obj; };
  const rollup     = options.rollup || require('rollup');
  const vinylOpts  = options.vinyl || {};

  (async () => {
    const opts = await loadOptions(options, rollup, streamEmit);
    const bundle = await rollup.rollup(opts);
    try {
      streamEmit('bundle')(bundle);
      const outputs = opts.output
        ? (Array.isArray(opts.output) ? opts.output : [opts.output])
        : [{}];
      const bundleOutputs = await Promise.all(outputs.map(createOutputBundler(bundle, opts, vinylOpts)));
      bundleOutputs.forEach((files) => files.forEach((file) => stream.push(file)));
    } finally {
      await closeBundle(bundle);
    }
    stream.push(null);
  })().catch(streamEmit('error'));

  return stream;
};
