import type { Express } from 'express'
import fs from 'fs/promises'

export const welcome = async (express: Express) => {
  const welcomeScreen = await fs.readFile('index.html', { encoding: 'utf8' })
  express.get('/', async function (req, res) {
    res.send(welcomeScreen)
  })
}
