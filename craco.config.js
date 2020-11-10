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
      return webpackConfig;
    }
  }
}


