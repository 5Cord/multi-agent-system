import { StrictMode } from 'react';

import { createRoot } from 'react-dom/client';
import { createCtx } from '@reatom/core';
import { reatomContext } from '@reatom/npm-react';

import App from 'app/App';

const ctx = createCtx();

const container = document.getElementById('root');
const root = createRoot(container as HTMLDivElement);

root.render(
  <StrictMode>
    <reatomContext.Provider value={ctx}>
      <App />
    </reatomContext.Provider>
  </StrictMode>
);
