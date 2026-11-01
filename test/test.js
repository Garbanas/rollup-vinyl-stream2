'use strict';

const expect = require('chai').expect;
const rollup = require('..');
const path = require('path');
const stream = require('stream');
const File = require('vinyl');
const hypothetical = require('rollup-plugin-hypothetical');

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
      plugins: [hypothetical({
        files: {
          './entry.js': 'import x from "./x.js"; console.log(x);',
          './x.js': 'export default "Hello, World!";'
        }
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
      plugins: [hypothetical({
        files: {
          './entry.js': 'import x from "./x.js"; console.log(x);',
          './x.js': 'export default "Hello, World!";'
        }
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
      plugins: [hypothetical({
        files: {
          './entry.js': 'import x from "./x.js"; console.log(x);',
          './x.js': 'export default "Hello, World!";'
        }
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
      bundle.generate({ output: { format: 'es' } }).then(function(result) {
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
