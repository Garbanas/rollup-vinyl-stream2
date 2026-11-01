const files = {
  './entry.js': 'import x from "./x.js"; console.log(x);',
  './x.js': 'export default "Hello, World!";'
};

export default {
  input: './entry.js',
  output: {
    format: 'es',
  },
  plugins: [{
    name: 'virtual',
    resolveId: (id) => (id in files ? id : null),
    load: (id) => (id in files ? files[id] : null),
  }]
};
