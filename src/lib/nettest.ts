import { baseFetch } from './baseFetch'
import { TrayMenu } from './trayMenu'
import { exec } from 'child_process'
import path from 'path'

export class Nettest {
  trayMenu: TrayMenu
  inProgress = false
  basicResults:
    | {
        downloadSpeedInMbps: number
        uploadSpeedInMbps: number
        pingInMs: number
      }
    | undefined
  nextMeasurement: Date | undefined
  lastMeasurement: Date | undefined

  public get speedtestBinaryPath() {
    const speedtestBinaryDir = this.trayMenu.dev
      ? 'speedtest_binary'
      : process.resourcesPath
    const speedtestBinaryFile = `speedtest_${process.platform}${
      process.platform === 'win32' ? '.exe' : ''
    }` //darwin, linux, win32
    return path.join(speedtestBinaryDir, speedtestBinaryFile)
  }

  constructor(trayMenu: TrayMenu) {
    this.trayMenu = trayMenu
  }

  static parseDate = (date: Date) => {
    const slice = (number: number) => ('00' + number).slice(-2)
    return `${slice(date.getHours())}:${slice(date.getMinutes())}:${slice(
      date.getSeconds()
    )}`
  }

  test = async () => {
    console.log(new Date(), 'speedtest begin')
    return new Promise((res, rej) => {
      this.inProgress = true
      this.trayMenu.make()
      exec(
        this.speedtestBinaryPath + ' --format json-pretty',
        (error, stdout, stderr) => {
          if (error || stderr) rej((error ?? stderr).toString())
          else {
            const results = JSON.parse(stdout)
            this.basicResults = {
              downloadSpeedInMbps: results.download.bandwidth / 125000,
              uploadSpeedInMbps: results.upload.bandwidth / 125000,
              pingInMs: results.ping.latency,
            }
            this.lastMeasurement = new Date()
            res(results)
          }
          console.log(new Date(), 'speedtest end')
          this.inProgress = false
          this.trayMenu.make()
        }
      )
    })
  }

  testAndSubmit = async (currentInterval?: number) => {
    try {
      const results = await this.test()
      if (!process.env.BYPASS_SERVER_COMMUNICATION)
        await this.submitTestResults(results)
      if (currentInterval) {
        const currentIntervalInMinutes = currentInterval / 1000 / 60
        console.log(
          `next test in -> ${currentIntervalInMinutes.toFixed(2)} minutes`
        )
        this.nextMeasurement = new Date()
        this.nextMeasurement.setMinutes(
          this.nextMeasurement.getMinutes() + currentIntervalInMinutes
        )
      }
    } catch (error) {
      console.error(error)
    }
  }

  submitTestResults = async (results: any) => {
    await baseFetch(
      this.trayMenu.settings.getMacIp().mac,
      '/api/external/local-client/upload-speedtest-results',
      { results },
      this.trayMenu
    )
  }

  beginTesting = () => {
    const interval = (this.trayMenu.dev ? 5 : 30) * 60 * 1000 //minutes
    const randomness = (this.trayMenu.dev ? 0 : 1) * 60 * 1000 //minutes

    const nextInterval = () => {
      const _interval = interval + (Math.random() * randomness - randomness / 2)

      return _interval
    }

    const nextTest = async () => {
      const currentInterval = nextInterval()
      setTimeout(nextTest, currentInterval)
      await this.testAndSubmit(currentInterval)
    }

    nextTest()
  }
}
