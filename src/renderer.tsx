import { jsxRenderer } from 'hono/jsx-renderer'

export const renderer = jsxRenderer(({ children }) => {
  return (
    <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#4f46e5" />
        <title>Journey Tracker</title>
        <link rel="manifest" href="/static/manifest.json" />
        <link rel="icon" type="image/svg+xml" href="/static/icon.svg" />
        <link rel="apple-touch-icon" href="/static/icon-192.png" />
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css" rel="stylesheet" />
        <link href="/static/style.css" rel="stylesheet" />
      </head>
      <body class="bg-gray-50 text-gray-800 overscroll-none">
        {children}
        <script src="/static/db.js"></script>
        <script src="/static/app.js"></script>
      </body>
    </html>
  )
})
