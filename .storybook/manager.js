// .storybook/manager.js

import { addons } from '@storybook/addons';

if (process.env.NODE_ENV === 'production')
  addons.setConfig({
    isFullscreen: false,
    showNav: true,
    showPanel: false,
    panelPosition: 'right',
    sidebarAnimations: true,
    enableShortcuts: true,
    isToolshown: false,
    initialActive: 'canvas',
    showRoots: true,
  });