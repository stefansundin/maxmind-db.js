const path = require('path');

module.exports = {
  mode: 'production',
  entry: './src/MaxMindDB.ts',
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts'],
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'MaxMindDB.min.js',
    library: {
      type: 'self',
      name: 'MaxMindDB',
      export: 'default',
    },
  },
  // optimization: {
  //   minimize: false,
  //   mangleExports: false,
  // },
};
