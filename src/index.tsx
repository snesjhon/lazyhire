import React from 'react';
import { render } from 'ink';
import { GigglesProvider } from 'giggles';
import App from './ui/App.js';

const initialScreen = process.argv.includes('--scan') ? 'scan' : 'dashboard';

function Root() {
  return (
    <GigglesProvider>
      <App initialScreen={initialScreen} />
    </GigglesProvider>
  );
}

render(<Root />);
