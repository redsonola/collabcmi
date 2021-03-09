module.exports = {

  webpack: {
    alias: {},
    plugins: [],
    configure: { /* Any webpack configuration options: https://webpack.js.org/configuration */ },
    configure: (webpackConfig, { env, paths }) => {
      // console.log(webpackConfig.module.rules[2]);
      const svelteRule = {
        test: /\.svelte$/,
        use: {
          loader: 'svelte-loader',
          options: {
            emitCss: true,
            hotReload: false,
            preprocess: require('svelte-preprocess')([]),
          },
        },
      };
      const rule = webpackConfig.module.rules[2];
      rule.oneOf = [svelteRule, ...rule.oneOf];
      // webpackConfig.module.rules[2].oneOf.push(svelteRule);
      // webpackConfig.module.rules = [svelteRule, ...webpackConfig.module.rules];
      // fs.writeFileSync('webpackConfig.json',JSON.stringify(webpackConfig, null, '    '))
      // return;
      // webpackConfig.mode = "development";
      // webpackConfig.plugins[2].NODE_ENV = "development";
      // webpackConfig.plugins[4].definitions["process.env"].NODE_ENV = "\"development\"";

      // webpackConfig.optimization = false;
      webpackConfig.optimization.minimize = false;
      webpackConfig.optimization.runtimeChunk = false;
      webpackConfig.optimization.splitChunks = false;

      return webpackConfig;
    }
  }
}


