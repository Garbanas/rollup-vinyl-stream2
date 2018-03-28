'use strict';

const through2 = require('through2').obj;
const path = require('path');
const File = require('vinyl');

const streamKeys = ['rollup', 'vinyl', 'config'];

function loadOptions(options, rollup, streamEmit) {
  const filteredOptions = {};
  Object
    .keys(options)
    .filter(key => -1 === streamKeys.indexOf(key))
    .forEach(key => filteredOptions[key] = options[key]);

  const config = options.config ? loadRollupConfig(path.resolve(options.config), rollup, streamEmit) : Promise.resolve({});

  return config.then(config => Object.assign(config, filteredOptions));
}

function loadRollupConfig(input, rollup, streamEmit) {
  const ignorable = error => error.code === 'UNRESOLVED_IMPORT';
  const onwarn    = error => ignorable(error) || console.warn(error.toString());

  return rollup
    .rollup({ input, onwarn })
    .then(bundle => bundle.generate({ format: 'cjs' }))
    .then(result => requireRollupBundle(result, input))
    .then(streamEmit('config'))
    .then(config => (Object.assign({}, config)))
    ;
}

function requireRollupBundle(result, input) {
  // don't look at me. this is how Rollup does it.
  const defaultLoader = require.extensions['.js'];

  require.extensions['.js'] = (module, filename) => {
    if (filename === input) {
      module._compile(result.code, filename);
    } else {
      defaultLoader(module, filename);
    }
  };

  try     { return require(input); }
  finally { require.extensions['.js'] = defaultLoader; }
}

function createVinylFile(rollupSource, vinylOpts = {}, fileName, output = {}) {
  let filePath;
  // This is multiple inputs
  if (output.dir) {
    filePath = path.resolve(output.dir, fileName);
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

  const file = new File(Object.assign({}, vinylOpts, {
    path:     filePath,
    contents: Buffer.from(rollupSource.code),
  }));

  if (rollupSource.map) {
    file.sourceMap = rollupSource.map;
  }

  return file;
}

function createOutputBundler(bundle, opts, vinylOpts) {
  return (output) => {
    return bundle
      .generate(Object.assign({}, opts, output))
      .then(result => {
        let files;
        if (typeof result.code === 'undefined' && !result.map) {
          files = Object
            .keys(result)
            .map(chunkName => createVinylFile(result[chunkName], vinylOpts, chunkName, output))
            ;
        } else {
          files = [ createVinylFile(result, vinylOpts, opts.input, output) ];
        }
        return Promise.resolve(files);
      })
      ;
  };
}

module.exports = function rollupVinylStream(options = {}) {
  if (typeof options === 'string') {
    options = {
      config: options,
    };
  }

  const stream     = through2();
  const streamEmit = name => obj => { stream.emit(name, obj); return obj; };
  const rollup     = options.rollup || require('rollup');
  const vinylOpts  = options.vinyl || {};
  const rollupOpts = loadOptions(options, rollup, streamEmit);

  rollupOpts
    .then(opts => rollup
      .rollup(opts)
      .then(streamEmit('bundle'))
      .then(bundle => {
        const bundleOutput = createOutputBundler(bundle, opts, vinylOpts);
        let outputs;
        if (opts.output) {
          outputs = Array.isArray(opts.output) ? opts.output : [opts.output];
        } else {
          outputs = [{}];
        }
        return Promise.all(outputs.map(bundleOutput));
      })
      .then(bundleOutputs => {
        bundleOutputs.forEach(files => files.forEach(file => stream.push(file)));
        stream.push(null);
      })
    )
    .catch(streamEmit('error'))
  ;

  return stream;
};
