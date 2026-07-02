import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0a0d0f" />
        <link rel="icon" href="data:," />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
