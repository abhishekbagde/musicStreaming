import { Html, Head, Main, NextScript } from 'next/document'
import type { ReactElement } from 'react'

export default function Document(): ReactElement {
  return (
    <Html lang="en">
      <Head>
        {/* Favicon - Music Note Emoji */}
        <link rel="icon" href="data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext x='50' y='75' text-anchor='middle' font-size='75'%3E🎵%3C/text%3E%3C/svg%3E" />
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#0f172a" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
