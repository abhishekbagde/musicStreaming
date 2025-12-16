import { Html, Head, Main, NextScript } from 'next/document'
import type { ReactElement } from 'react'

export default function Document(): ReactElement {
  return (
    <Html lang="en">
      <Head>
        {/* Favicon - Music Note Emoji */}
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='75' font-size='90' fill='%23a855f7'>🎵</text></svg>" />
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
