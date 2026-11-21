import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './styles/design-system.css'
import './styles/app-shell.css'

// 字体自托管（OFL 许可，@fontsource-variable 包）。family 名与 tokens.css 的
// --serif / --sans / --mono 保持一致（'Fraunces' / 'Instrument Sans' / 'JetBrains Mono'），
// 现有 CSS 引用无需任何改动即可命中本地 woff2（不再请求 Google Fonts）。
// Fraunces 取 opsz 轴变体（含 opsz + wght），与原 Google Fonts 加载的轴一致，
// 使 font-variation-settings:"opsz" 仍生效。
import frauncesNormalWoff2 from '@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2'
import frauncesItalicWoff2 from '@fontsource-variable/fraunces/files/fraunces-latin-opsz-italic.woff2'
import instrumentSansNormalWoff2 from '@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2'
import instrumentSansItalicWoff2 from '@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-italic.woff2'
import jetBrainsMonoNormalWoff2 from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2'
import jetBrainsMonoItalicWoff2 from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-italic.woff2'

const fontFaceAliases = [
  { family: 'Fraunces', weight: '100 900', normal: frauncesNormalWoff2, italic: frauncesItalicWoff2 },
  { family: 'Instrument Sans', weight: '400 700', normal: instrumentSansNormalWoff2, italic: instrumentSansItalicWoff2 },
  { family: 'JetBrains Mono', weight: '100 800', normal: jetBrainsMonoNormalWoff2, italic: jetBrainsMonoItalicWoff2 },
]
  .flatMap(({ family, weight, normal, italic }) => [
    `@font-face{font-family:'${family}';font-style:normal;font-display:swap;font-weight:${weight};src:url(${normal}) format('woff2-variations')}`,
    `@font-face{font-family:'${family}';font-style:italic;font-display:swap;font-weight:${weight};src:url(${italic}) format('woff2-variations')}`,
  ])
  .join('')

const selfHostedFonts = document.createElement('style')
selfHostedFonts.id = 'self-hosted-fonts'
selfHostedFonts.textContent = fontFaceAliases
document.head.appendChild(selfHostedFonts)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
