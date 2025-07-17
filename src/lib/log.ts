import { app } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import { Sync } from './sync'
import { TrayMenu } from './trayMenu'

export class Log {
  static sync = async (trayMenu: TrayMenu) => {
    const dir = path.join(app.getPath('userData'), 'logs')
    const logs = await fs.readdir(dir)
    for (const log of logs.map((l) => path.join(dir, l))) {
      await Sync.upload({
        path: log,
        move: false,
        remotePath: `/home/mbene/logs/${trayMenu.locationName}/${log}`,
        login: {
          host: process.env.SFTP_HOST!,
          username: process.env.SFTP_USER!,
          password: process.env.SFTP_PWD!,
        },
      })
    }
  }
}
