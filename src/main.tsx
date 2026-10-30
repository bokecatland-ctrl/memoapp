import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Root } from './Root';
import './styles.css';

// 画面のファイルを端末にためて、電波がなくてもすぐ開けるようにする(開発中は使わない)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // 登録できなくても、ふつうのページとして動く
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
