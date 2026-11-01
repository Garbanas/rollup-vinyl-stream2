'use strict';

const expect = require('chai').expect;
const rollup = require('..');
const stream = require('stream');
const File = require('vinyl');

/** Minimal in-memory module plugin (replaces rollup-plugin-hypothetical) */
function virtual(options) {
  const files = options.files;
  return {
    name: 'virtual',
    resolveId: (id) => (Object.prototype.hasOwnProperty.call(files, id) ? id : null),
    load: (id) => (Object.prototype.hasOwnProperty.call(files, id) ? files[id] : null),
  };
}

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
      plugins: [virtual({
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
      plugins: [virtual({
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
      }).catch(done);
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

describe("rollup 4 output handling", function() {
  const path = require('path');
  const files = {
    './entry.js': 'import x from "./x.js"; console.log(x); import("./lazy.js");',
    './x.js': 'export default "Hello, World!";',
    './lazy.js': 'console.log("lazy");'
  };

  it("should not emit a separate .map file or sourceMappingURL comment", function() {
    return collect(rollup({
      input: './x.js',
      output: { format: 'es', sourcemap: true },
      plugins: [virtual({ files })]
    })).then(function(result) {
      expect(result.files).to.have.lengthOf(1);
      expect(result.data).to.not.include('sourceMappingURL');
      expect(result.files[0].sourceMap).to.include.keys('version', 'mappings', 'sources', 'file');
    });
  });

  it("should emit all chunks into output.dir", function() {
    return collect(rollup({
      input: './entry.js',
      output: { format: 'es', dir: 'dist', chunkFileNames: 'chunks/[name].js' },
      plugins: [virtual({ files })]
    })).then(function(result) {
      const paths = result.files.map((file) => path.relative(process.cwd(), file.path)).sort();
      expect(paths).to.deep.equal([path.join('dist', 'chunks', 'lazy.js'), path.join('dist', 'entry.js')]);
    });
  });

  it("should emit assets as vinyl files", function() {
    return collect(rollup({
      input: './x.js',
      output: { format: 'es', dir: 'dist' },
      plugins: [virtual({ files }), {
        name: 'asset',
        generateBundle() {
          this.emitFile({ type: 'asset', fileName: 'hello.txt', source: 'Hello asset' });
        }
      }]
    })).then(function(result) {
      const asset = result.files.find((file) => file.basename === 'hello.txt');
      expect(asset).to.be.an.instanceof(File);
      expect(asset.contents.toString()).to.equal('Hello asset');
    });
  });

  it("should support multiple outputs with output.file", function() {
    return collect(rollup({
      input: './x.js',
      output: [
        { file: 'dist/x.es.js', format: 'es' },
        { file: 'dist/x.cjs.js', format: 'cjs' }
      ],
      plugins: [virtual({ files })]
    })).then(function(result) {
      const paths = result.files.map((file) => path.relative(process.cwd(), file.path)).sort();
      expect(paths).to.deep.equal([path.join('dist', 'x.cjs.js'), path.join('dist', 'x.es.js')]);
    });
  });

  it("should close the bundle after generating", function() {
    let bundle;
    return collect(
      rollup({ input: './x.js', plugins: [virtual({ files })] })
        .on('bundle', function(b) { bundle = b; })
    ).then(function() {
      expect(bundle.closed).to.equal(true);
      expect(bundle.cache).to.be.an('object');
    });
  });
});
