'use strict';

const expect = require('chai').expect;
const rollup = require('..');
const path = require('path');
const stream = require('stream');
const File = require('vinyl');
const realRollup = require('rollup');

const rollupVersion = realRollup.VERSION.split('.').map(Number);

/**
 * Whether the installed Rollup is at least the given version. The tests run
 * against every supported Rollup major (see .github/workflows/test.yml), so
 * tests for features that older Rollup versions lack are skipped there.
 */
function rollupAtLeast(major, minor) {
  return rollupVersion[0] > major
    || (rollupVersion[0] === major && rollupVersion[1] >= (minor || 0));
}

/**
 * Minimal virtual file system plugin, replacing rollup-plugin-hypothetical.
 */
function virtual(files) {
  const modules = {};
  Object.keys(files).forEach(function(file) {
    modules[path.resolve(file)] = files[file];
  });
  return {
    name: 'virtual',
    resolveId: function(id, importer) {
      const resolved = path.resolve(importer ? path.dirname(importer) : '.', id);
      return Object.prototype.hasOwnProperty.call(modules, resolved) ? resolved : null;
    },
    load: function(id) {
      return Object.prototype.hasOwnProperty.call(modules, id) ? modules[id] : null;
    }
  };
}

const helloWorld = {
  resolveId: function(id) {
    return id;
  },
  load: function() {
    return 'console.log("Hello, World!");';
  }
};

function collect(stream) {
  return new Promise(function(resolve, reject) {
    let files = [];
    let data = '';
    stream.on('end', function() {
      resolve({ files, data });
    });
    stream.on('error', function(err) {
      reject(err);
    });
    stream.on('data', function(file) {
      files.push(file);
      data += file.contents.toString();
    });
  });
}


describe("rollup-vinyl-stream2", function() {
  it("should export a function", function() {
    expect(rollup).to.be.a('function');
  });

  it("should return a stream", function() {
    const s = rollup();
    s.on('error', function(err) {});
    expect(s).to.be.an.instanceof(stream);
  });

  it("should return a stream of vinyl files", function() {
    const options = {
      input : './entry.js',
      output: {
        format: 'es',
      },
      plugins: [virtual({
        './entry.js': 'import x from "./x.js"; console.log(x);',
        './x.js': 'export default "Hello, World!";'
      })]
    };
    const s = rollup(options);

    return collect(s)
      .then(function (result) {
        result.files.forEach(function(file){
          expect(file).to.be.an.instanceof(File);
        })
      });
  });

  it("should return a stream of buffered vinyl files", function() {
    const options = {
      input : './entry.js',
      output: {
        format: 'es',
      },
      plugins: [virtual({
        './entry.js': 'import x from "./x.js"; console.log(x);',
        './x.js': 'export default "Hello, World!";'
      })]
    };
    const s = rollup(options);

    return collect(s)
      .then(function (result) {
        result.files.forEach(function(file){
          expect(file.isBuffer()).to.equal(true);
        })
      });
  });

  it("should emit an error if options isn't passed", function(done) {
    const s = rollup();

    s.on('error', function(err) {
      expect(err.message).to.equal("You must supply options.input to rollup");
      done();
    });

    s.on('data', function() {
      done(Error("No error was emitted."));
    });
  });

  it("should emit an error if options.input isn't present", function(done) {
    const s = rollup({});

    s.on('error', function(err) {
      expect(err.message).to.equal("You must supply options.input to rollup");
      done();
    });

    s.on('data', function() {
      done(Error("No error was emitted."));
    });
  });

  it("should take a snapshot of options when the function is called", function() {
    const options = {
      input : './entry.js',
      output: {
        format: 'es',
      },
      plugins: [virtual({
        './entry.js': 'import x from "./x.js"; console.log(x);',
        './x.js': 'export default "Hello, World!";'
      })]
    };
    const s = rollup(options);
    options.input = './nonexistent.js';

    return collect(s)
      .then(function(result) {
        expect(result.data).to.have.string('Hello, World!');
      });
  });

  it("should use a custom Rollup if options.rollup is passed", function() {
    const options = {
      rollup: {
        rollup: function(options) {
          expect(options).to.equal(options);
          return Promise.resolve({
            generate: function(options) {
              expect(options).to.equal(options);
              return Promise.resolve({ code: 'fake code' });
            }
          });
        }
      }
    };

    return collect(rollup(options))
      .then(function(result) {
        expect(result.data).to.equal('fake code');
      });
  });

  it("should accept Buffer code from a custom Rollup", function() {
    const options = {
      rollup: {
        rollup: function() {
          return Promise.resolve({
            generate: function() {
              return Promise.resolve({ code: Buffer.from('fake code') });
            }
          });
        }
      }
    };

    return collect(rollup(options))
      .then(function(result) {
        expect(result.data).to.equal('fake code');
      });
  });

  it("shouldn't raise an alarm when options.rollup is passed", function() {
    return collect(
      rollup({
        input : './entry.js',
        output: {
          format: 'es',
        },
        rollup: require('rollup'),
        plugins: [{
          resolveId: function(id) {
            return id;
          },
          load: function() {
            return 'console.log("Hello, World!");';
          }
        }]
      })
    )
    .then(function(result) {
      expect(result.data).to.have.string('Hello, World!');
    });
  });

  it("should import config from the specified file if options is a string", function() {
    return collect(rollup('test/fixtures/config.js')).then(function(result) {
      expect(result.data).to.have.string('Hello, World!');
    });
  });

  it("should reject with any error thrown by the config file", function(done) {
    const s = rollup('test/fixtures/throws.js');

    s.on('error', function(err) {
      expect(err.message).to.include("bah! humbug");
      done();
    });

    s.on('data', function() {
      done(Error("No error was emitted."));
    });
  });

  it("should emit a 'bundle' event when the bundle is output", function(done) {
    const s = rollup({
      input : './entry.js',
      output: {
        format: 'es',
      },
      plugins: [{
        resolveId: function(id) {
          return id;
        },
        load: function() {
          return 'console.log("Hello, World!");';
        }
      }]
    });

    let bundled = false;
    s.on('bundle', function(bundle) {
      bundled = true;
      bundle.generate({ format: 'es' }).then(function(result) {
        if (/Hello, World!/.test(result.output[0].code)) {
          done();
        } else {
          done(Error("The bundle doesn't contain the string \"Hello, World!\""));
        }
      }).catch(done.fail);
    });

    s.on('error', function(err) {
      done(Error(err));
    });

    s.on('data', function() {
      if (!bundled) {
        done(Error("No 'bundle' event was emitted."));
      }
    });
  });
});

describe("plugins", function() {
  it("should not run input plugins as output plugins", function() {
    let renderChunkCalls = 0;
    const warnings = [];

    return collect(
      rollup({
        input: './entry.js',
        output: {
          format: 'es',
        },
        onwarn: function(warning) {
          warnings.push(warning);
        },
        plugins: [{
          resolveId: function(id) {
            return id;
          },
          load: function() {
            return 'console.log("Hello, World!");';
          },
          renderChunk: function() {
            renderChunkCalls++;
            return null;
          }
        }]
      })
    )
    .then(function() {
      expect(renderChunkCalls).to.equal(1);
      expect(warnings.map(String).join('\n')).to.not.include('output plugin');
    });
  });

  it("should still run output plugins", function() {
    // Output plugins exist since Rollup 1.27
    if (!rollupAtLeast(1, 27)) {
      this.skip();
    }
    return collect(
      rollup({
        input: './entry.js',
        output: {
          format: 'es',
          plugins: [{
            renderChunk: function(code) {
              return code + '\n// output plugin was here';
            }
          }]
        },
        plugins: [{
          resolveId: function(id) {
            return id;
          },
          load: function() {
            return 'console.log("Hello, World!");';
          }
        }]
      })
    )
    .then(function(result) {
      expect(result.data).to.have.string('// output plugin was here');
    });
  });
});

describe("assets", function() {
  const assetPlugin = {
    resolveId: function(id) {
      return id;
    },
    load: function() {
      return 'console.log("Hello, World!");';
    },
    buildStart: function() {
      this.emitFile({ type: 'asset', fileName: 'style.css', source: 'body { color: red; }' });
    }
  };

  beforeEach(function() {
    // this.emitFile exists since Rollup 1.21
    if (!rollupAtLeast(1, 21)) {
      this.skip();
    }
  });

  it("should emit assets as vinyl files", function() {
    return collect(
      rollup({
        input: './entry.js',
        output: {
          format: 'es',
          dir: 'dist',
        },
        plugins: [assetPlugin]
      })
    )
    .then(function(result) {
      const asset = result.files.find(function(file) {
        return file.basename === 'style.css';
      });
      expect(asset).to.be.an.instanceof(File);
      expect(asset.contents.toString()).to.equal('body { color: red; }');
      expect(asset.path).to.equal(path.resolve('dist', 'style.css'));
    });
  });

  it("should place assets next to output.file", function() {
    return collect(
      rollup({
        input: './entry.js',
        output: {
          format: 'es',
          file: 'dist/bundle.js',
        },
        plugins: [assetPlugin]
      })
    )
    .then(function(result) {
      const paths = result.files.map(function(file) {
        return file.path;
      });
      expect(paths).to.have.members([
        path.resolve('dist/bundle.js'),
        path.resolve('dist/style.css'),
      ]);
    });
  });
});

describe("sourcemaps", function() {
  it("should be added when options.sourcemap is true", function() {
    return collect(
      rollup({
        input: './entry.js',
        output: {
          format: 'es',
          sourcemap: true,
        },
        plugins: [{
          resolveId: function(id) {
            return id;
          },
          load: function() {
            return 'console.log("Hello, World!");';
          }
        }]
      })
    )
    .then(function (result) {
      result.files.forEach(function(file) {
        expect(file).to.have.property('sourceMap');
      });
    });
  });

  it("should not be added otherwise", function() {
    return collect(
      rollup({
        input: './entry.js',
        output: {
          format: 'es',
        },
        plugins: [{
          resolveId: function(id) {
            return id;
          },
          load: function() {
            return 'console.log("Hello, World!");';
          }
        }]
      })
    )
    .then(function(result) {
      result.files.forEach(function(file) {
        expect(file).to.not.have.property('sourceMap');
      });
    });
  });
});

describe("output options", function() {
  function captureGenerateOptions(options) {
    const calls = [];
    return collect(rollup(Object.assign({
      rollup: {
        rollup: function() {
          return Promise.resolve({
            generate: function(outputOptions) {
              calls.push(outputOptions);
              return Promise.resolve({ code: 'fake code' });
            }
          });
        }
      }
    }, options)))
    .then(function() {
      return calls;
    });
  }

  it("should pass top-level output options on to generate()", function() {
    const globals = { jquery: '$' };
    return captureGenerateOptions({
      input: './entry.js',
      format: 'umd',
      name: 'myBundle',
      sourcemap: true,
      globals: globals,
      inlineDynamicImports: true,
      manualChunks: { vendor: ['jquery'] },
      preserveModules: false,
    })
    .then(function(calls) {
      expect(calls).to.have.lengthOf(1);
      expect(calls[0]).to.include({
        format: 'umd',
        name: 'myBundle',
        sourcemap: true,
        globals: globals,
        inlineDynamicImports: true,
        preserveModules: false,
      });
      expect(calls[0]).to.have.property('manualChunks');
    });
  });

  it("should not pass input-only options on to generate()", function() {
    const plugin = { name: 'input-plugin' };
    return captureGenerateOptions({
      input: './entry.js',
      output: { format: 'es' },
      plugins: [plugin],
      external: ['jquery'],
      onwarn: function() {},
      cache: false,
      treeshake: false,
      context: 'window',
    })
    .then(function(calls) {
      expect(calls).to.have.lengthOf(1);
      expect(calls[0]).to.deep.equal({ format: 'es' });
    });
  });

  it("should let per-output options win and keep per-output plugins", function() {
    const outputPlugin = { name: 'output-plugin' };
    return captureGenerateOptions({
      input: './entry.js',
      format: 'cjs',
      plugins: [{ name: 'input-plugin' }],
      output: [
        { format: 'es', plugins: [outputPlugin] },
        { file: 'bundle.cjs' },
      ],
    })
    .then(function(calls) {
      expect(calls).to.have.lengthOf(2);
      expect(calls[0].format).to.equal('es');
      expect(calls[0].plugins).to.deep.equal([outputPlugin]);
      expect(calls[1]).to.deep.equal({ format: 'cjs', file: 'bundle.cjs' });
    });
  });

  it("should not cause unknown option warnings in generate()", function() {
    const warnings = [];
    return collect(
      rollup({
        input: './entry.js',
        format: 'es',
        output: { sourcemap: true },
        onwarn: function(warning) {
          warnings.push(String(warning.message || warning));
        },
        plugins: [helloWorld]
      })
    )
    .then(function() {
      warnings.forEach(function(warning) {
        expect(warning).to.not.include('Unknown output option');
      });
    });
  });
});

describe("sourcemap assets", function() {
  function names(result) {
    return result.files.map(function(file) {
      return file.basename;
    }).sort();
  }

  it("should not emit Rollup's .map asset or sourceMappingURL when the map is applied", function() {
    return collect(
      rollup({
        input: './entry.js',
        output: { format: 'es', sourcemap: true },
        plugins: [helloWorld]
      })
    )
    .then(function(result) {
      expect(names(result)).to.deep.equal(['entry.js']);
      expect(result.files[0]).to.have.property('sourceMap');
      expect(result.data).to.have.string('Hello, World!');
      expect(result.data).to.not.include('sourceMappingURL');
    });
  });

  it("should not emit Rollup's .map asset for hidden sourcemaps", function() {
    return collect(
      rollup({
        input: './entry.js',
        output: { format: 'es', sourcemap: 'hidden' },
        plugins: [helloWorld]
      })
    )
    .then(function(result) {
      expect(names(result)).to.deep.equal(['entry.js']);
      expect(result.files[0]).to.have.property('sourceMap');
    });
  });

  it("should still emit other assets next to the sourcemapped chunk", function() {
    if (!rollupAtLeast(1, 21)) {
      this.skip();
    }
    return collect(
      rollup({
        input: './entry.js',
        output: { format: 'es', sourcemap: true, dir: 'dist' },
        plugins: [Object.assign({}, helloWorld, {
          buildStart: function() {
            this.emitFile({ type: 'asset', fileName: 'style.css', source: 'body { color: red; }' });
            this.emitFile({ type: 'asset', fileName: 'other.map', source: '{}' });
          }
        })]
      })
    )
    .then(function(result) {
      expect(names(result)).to.deep.equal(['entry.js', 'other.map', 'style.css']);
    });
  });

  it("should respect output.sourcemapFileNames", function() {
    // sourcemapFileNames exists since Rollup 3.29
    if (!rollupAtLeast(3, 29)) {
      this.skip();
    }
    return collect(
      rollup({
        input: './entry.js',
        output: { format: 'es', sourcemap: true, sourcemapFileNames: 'maps/[name].[hash].map' },
        plugins: [helloWorld]
      })
    )
    .then(function(result) {
      expect(names(result)).to.deep.equal(['entry.js']);
      expect(result.data).to.not.include('sourceMappingURL');
    });
  });

  it("should handle multiple outputs separately", function() {
    return collect(
      rollup({
        input: './entry.js',
        output: [
          { format: 'es', sourcemap: true, file: 'dist/a.js' },
          { format: 'cjs', file: 'dist/b.js' },
        ],
        plugins: [helloWorld]
      })
    )
    .then(function(result) {
      expect(names(result)).to.deep.equal(['a.js', 'b.js']);
      const files = {};
      result.files.forEach(function(file) {
        files[file.basename] = file;
      });
      expect(files['a.js']).to.have.property('sourceMap');
      expect(files['b.js']).to.not.have.property('sourceMap');
    });
  });
});

describe("bundle.close()", function() {
  function fakeRollup(log, options) {
    options = options || {};
    return {
      rollup: function() {
        return Promise.resolve({
          generate: function() {
            log.push('generate');
            return options.fail
              ? Promise.reject(new Error('generate failed'))
              : Promise.resolve({ code: 'fake code' });
          },
          close: function() {
            log.push('close');
            return options.closeFails
              ? Promise.reject(new Error('close failed'))
              : Promise.resolve();
          }
        });
      }
    };
  }

  it("should be called once after all outputs were generated", function() {
    const log = [];
    return collect(rollup({
      rollup: fakeRollup(log),
      output: [{ format: 'es' }, { format: 'cjs' }],
    }))
    .then(function(result) {
      expect(result.data).to.equal('fake codefake code');
      expect(log).to.deep.equal(['generate', 'generate', 'close']);
    });
  });

  it("should not be called while someone listens for the 'bundle' event", function() {
    const log = [];
    const s = rollup({ rollup: fakeRollup(log) });
    s.on('bundle', function() {});
    return collect(s)
      .then(function() {
        expect(log).to.deep.equal(['generate']);
      });
  });

  it("should be called when generating fails", function() {
    const log = [];
    return collect(rollup({ rollup: fakeRollup(log, { fail: true }) }))
      .then(function() {
        throw new Error('No error was emitted.');
      }, function(err) {
        expect(err.message).to.equal('generate failed');
        expect(log).to.deep.equal(['generate', 'close']);
      });
  });

  it("should emit an error when closing fails", function() {
    const log = [];
    return collect(rollup({ rollup: fakeRollup(log, { closeFails: true }) }))
      .then(function() {
        throw new Error('No error was emitted.');
      }, function(err) {
        expect(err.message).to.equal('close failed');
      });
  });

  it("should close the real bundle and the config bundle", function() {
    if (!rollupAtLeast(2, 23)) {
      this.skip();
    }
    let closed = 0;
    const countingRollup = {
      rollup: function(options) {
        return realRollup.rollup(options).then(function(bundle) {
          const close = bundle.close;
          bundle.close = function() {
            closed++;
            return close.apply(bundle, arguments);
          };
          return bundle;
        });
      }
    };
    return collect(rollup({ config: 'test/fixtures/config.js', rollup: countingRollup }))
      .then(function(result) {
        expect(result.data).to.have.string('Hello, World!');
        expect(closed).to.equal(2);
      });
  });

  it("should keep the bundle usable for deferred 'bundle' listeners", function(done) {
    const s = rollup({
      input: './entry.js',
      output: { format: 'es' },
      plugins: [helloWorld]
    });
    s.on('error', done);
    s.on('bundle', function(bundle) {
      setTimeout(function() {
        bundle.generate({ format: 'es' }).then(function(result) {
          expect(result.output[0].code).to.have.string('Hello, World!');
          done();
        }).catch(done);
      }, 20);
    });
    s.resume();
  });
});
