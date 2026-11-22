import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Tipografías incluidas en la app (funcionan sin conexión).
import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/fraunces/full-italic.css';
import '@fontsource-variable/lora/wght.css';
import '@fontsource-variable/lora/wght-italic.css';
import '@fontsource-variable/caveat/wght.css';

import './styles/tokens.css';
import './styles/base.css';
import './styles/textures.css';
import './styles/animations.css';

import { App } from './app/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
