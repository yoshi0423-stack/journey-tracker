import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { renderer } from './renderer'
import { apiRoutes } from './api'

type Bindings = { DB: D1Database }
export type AppType = { Bindings: Bindings }

const app = new Hono<AppType>()

app.use('/api/*', cors())
app.use(renderer)

// --- API ---
app.route('/api', apiRoutes)

// --- SPA shell ---
app.get('/*', (c) => {
  return c.render(<div id="app"></div>)
})

export default app
