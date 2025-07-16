import Throttle from 'throttle'
import Client from 'ssh2-sftp-client'
import fs from 'fs/promises'
import fsSync from 'fs'
import nodePath from 'path'

export class Sync {
  static upload = async (args: {
    path: string
    remotePath: string
    move: boolean
    throttleKbps?: number
    login: {
      host: string
      username: string
      password: string
    }
  }): Promise<{ ok: boolean }> => {
    const config = {
      host: args.login.host,
      username: args.login.username,
      password: args.login.password,
      timeout: 30 * 1000,
      throttle: {
        bps: args.throttleKbps ? args.throttleKbps * 1000 : undefined,
      } as Throttle.Options,
    }

    console.log('UPLOAD', args.path)

    const client = new Client()

    let input: Throttle | Buffer
    if (args.throttleKbps) {
      input = new Throttle(config.throttle)
      const readStream = fsSync.createReadStream(args.path)
      readStream.pipe(input)
    } else {
      try {
        input = await fs.readFile(args.path)
      } catch (error) {
        console.error('file to be uploaded is not found at!')
      }
      return { ok: false }
    }

    return client
      .connect(config)
      .then(() => {
        return client.mkdir(nodePath.dirname(args.remotePath), true)
      })
      .then(() => {
        return client.put(input, args.remotePath)
      })
      .then(() => {
        return client.end()
      })
      .then(args.move ? () => fs.unlink(args.path) : () => {})
      .then(() => {
        console.log('upload completed ->', nodePath.basename(args.path))
        return { ok: true }
      })
      .catch((err) => {
        console.error('upload errored ->', err.message)
        return { ok: false }
      })
  }
}
