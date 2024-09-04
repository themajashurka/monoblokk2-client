import arp from '@network-utils/arp-lookup'
import ping from 'ping'
import sudoPrompt from 'sudo-prompt'

export const getLocalDevices = async () => {
  const refreshArpTable = async () => {
    const promises = () =>
      Array(255)
        .fill(0)
        .map((_, i) => {
          return ping.promise.probe('192.168.12.' + i)
        })
    for (let i = 0; i < 1; i++) {
      for (const promise of promises()) {
        const result = await promise
        //console.log(result.host, result.time);
      }
    }
    console.log('ready')
    return await arp.getTable()
  }

  return await new Promise<Awaited<ReturnType<typeof refreshArpTable>>>(
    (res) => {
      const arpCacheFlushCommand =
        process.platform === 'win32'
          ? 'netsh interface ip delete arpcache'
          : 'ip -s -s neigh flush all'

      sudoPrompt.exec(
        arpCacheFlushCommand,
        { name: 'Electron' },
        async (error, stdout, stderr) => {
          console.error(error, stderr)
          res(await refreshArpTable())
        }
      )
    }
  )
}
