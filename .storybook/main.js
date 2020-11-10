const { IgnorePlugin } = require('webpack');

module.exports = {
  webpackFinal: async  (config) => {
    // from https://github.com/storybookjs/storybook/issues/12754#issuecomment-708884287
    const svelteLoader = config.module.rules.find(
      (r) => r.loader && r.loader.includes("svelte-loader"),
    )
    svelteLoader.options.preprocess = require("svelte-preprocess")({})

    config.plugins = [
      new IgnorePlugin(/^fs$/),
      ...config.plugins
    ];

    return config;
  },
  "stories": [
    "../src/**/*.stories.mdx",
    // "../src/**/*.stories.@(js|jsx|ts|tsx)"
    "../src/**/*.stories.@(js|ts)"
  ],
  "addons": [
    "@storybook/addon-links",
    {
      name: '@storybook/addon-essentials',
      options: {
        docs: false,
        backgrounds: false,
      }
    },
    // "@storybook/preset-create-react-app"
  ]
}