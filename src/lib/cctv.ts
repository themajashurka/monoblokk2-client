import { spawn, exec } from 'child_process'
import path from 'path'
import { TrayMenu } from './trayMenu'
const _fkill = import('fkill').then((x) => x.default)
import fs from 'fs/promises'
import { app } from 'electron'

export type CCTVObj = CCTV['cameraLogins'][number]

export class CCTV {
  private trayMenu: TrayMenu
  cameraLogins: {
    username: string
    password: string
    ip: string
  }[] = []
  port: number = 8891

  private get mediamtxBinaryPath() {
    const mediamtxBinaryDir = this.trayMenu.dev
      ? 'mediamtx_binary'
      : path.join(process.resourcesPath, 'mediamtx_binary')
    const mediamtxBinaryFile = `mediamtx_${process.platform}${
      process.platform === 'win32' ? '.exe' : ''
    }` //darwin, linux, win32
    return path.join(mediamtxBinaryDir, mediamtxBinaryFile)
  }

  setCameraLogins = async (x: CCTVObj[]) => {
    this.cameraLogins = x
    await this.rewriteConfig()
  }

  constructor(trayMenu: TrayMenu) {
    this.trayMenu = trayMenu
  }

  rewriteConfig = async () => {
    const templateConfigPath = this.trayMenu.dev
      ? 'mediamtx_template.yml'
      : path.join(process.resourcesPath, 'mediamtx_template.yml')
    const configPath = path.join(app.getAppPath(), 'mediamtx.yml')

    const config = await fs.readFile(templateConfigPath, { encoding: 'utf8' })

    let configArr: string[] = config.split('\n')

    for (const line of [
      'paths:',
      '#webrtcAddress:',
      '  #recordPath:',
    ] as const) {
      const insertionIndex = configArr.findIndex((x) => x === line)

      let value: string[] = ['']
      switch (line) {
        case 'paths:':
          value = this.cameraLogins
            .map((cl) => {
              return [
                `  ${cl.username}:`,
                `    source: rtsp://${cl.username}:${cl.password}@${cl.ip}:554/stream1`,
              ]
            })
            .flat()
          break
        case '#webrtcAddress:':
          value = [`webrtcAddress: :${this.port}`]
          break
        case '  #recordPath:':
          value = [
            `  recordPath: ${app.getPath(
              'userData'
            )}/recordings/%path/%Y-%m-%d_%H-%M-%S-%f`,
          ]
          break
      }

      console.log({
        resoucesPath: process.resourcesPath,
        insertionIndex,
        value,
        length: configArr.length,
      })

      configArr.splice(insertionIndex + 1, 0, value.join('\n'))
    }

    await fs.writeFile(configPath, configArr.join('\n'))
  }

  startService = async () => {
    await new Promise(() => {
      const { stdout, stderr } = spawn(this.mediamtxBinaryPath, {
        stdio: 'pipe',
        detached: true,
      })
      stdout.setEncoding('utf8')
      stderr.setEncoding('utf8')
      stdout.on('data', (data) => console.log(data))
      stderr.on('data', (data) => console.log(data))
    })
  }

  killService = async () => {
    const fkill = await _fkill
    let pid: string
    switch (process.platform) {
      case 'linux':
        try {
          pid = await new Promise((res, rej) => {
            exec('pgrep mediamtx', (error, stdout, stderr) => {
              if (stdout) res(stdout)
              if (error) rej(error)
              if (stderr) rej(stderr)
            })
          })
          if (pid!) {
            await fkill(Number(pid))
            console.log('killed mediamtx on:', pid)
          }
        } catch (error) {
          console.error(error)
        }
        break
      case 'win32':
        try {
          await new Promise((res, rej) => {
            exec(
              'taskkill /f /t /im mediamtx_win32.exe',
              (error, stdout, stderr) => {
                if (stdout) res(stdout)
                if (error) rej(error)
                if (stderr) rej(stderr)
              }
            )
          })
        } catch (error) {}
        break

      default:
        break
    }
  }
}
