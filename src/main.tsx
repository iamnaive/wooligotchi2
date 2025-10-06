// src/main.tsx
// All comments in English only.
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { WagmiProvider } from './wagmi';
import { config } from './wagmi';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <App />
    </WagmiProvider>
  </React.StrictMode>
);
