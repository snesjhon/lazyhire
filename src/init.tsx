import React from 'react';
import { render } from 'ink';
import { GigglesProvider } from 'giggles';
import Wizard from './init/wizard.js';

function Root() {
  return (
    <GigglesProvider>
      <Wizard />
    </GigglesProvider>
  );
}

render(<Root />);
