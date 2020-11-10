import anysort from 'anysort';
import "@tensorflow/tfjs-backend-webgl";
// import "@tensorflow/tfjs-backend-cpu";
import "@storybook/addon-console";
// import { setConsoleOptions } from "@storybook/addon-console";

// setConsoleOptions({ panelExclude: [], });

export const parameters = {
  actions: { argTypesRegex: "^on[A-Z].*" },
  layout: 'fullscreen',
  options: {
    showRoots: true,
    storySort: (previous, next) => {
      return anysort(previous[1].kind, next[1].kind, [
        'Space Between',
        'Audio/*',
        'Video/*',
        'Utils/*',
        'Components/*',
      ]);
    }
  }
}