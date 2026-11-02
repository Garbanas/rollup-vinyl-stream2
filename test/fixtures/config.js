const files = {
  'entry.js': 'import x from "./x.js"; console.log(x);',
  'x.js': 'export default "Hello, World!";'
};

export default {
  input: './entry.js',
  output: {
    format: 'es',
  },
  plugins: [{
    name: 'virtual',
    resolveId: (id) => id.replace(/^\.\//, ''),
    load: (id) => files[id],
  }]
};
