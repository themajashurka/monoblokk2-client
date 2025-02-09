import { app } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import { Sync } from './sync'
import { TrayMenu } from './trayMenu'

export class Log {
  static sync = async (trayMenu: TrayMenu) => {
    const date = new Date().toISOString()
    const dir = path.join(app.getPath('userData'), 'logs')
    const logs = await fs.readdir(dir)
    for (const log of logs.map((l) => path.join(dir, l))) {
      const _log = path.basename(log, '.txt') + date + '.txt'
      /* await Sync.upload({
        path: log,
        cleanPath: log,
        move: false,
        remotePath: `/home/marci/logs/${trayMenu.locationName}/${_log}`,
        login: {
          host: process.env.SFTP_HOST!,
          username: process.env.SFTP_USER!,
          password: process.env.SFTP_PWD!,
        },
      }) */
    }
  }
}
