import { Client } from 'ssh2'
import type { SSHTunnel } from '../shared/types'

export interface TunnelHandle {
  localPort: number
  close: () => void
}

/**
 * 建立一条本地端口转发：把对 host:port 的连接通过 SSH 跳板转发。
 * 返回实际监听的本地端口，驱动层改为连接 127.0.0.1:localPort 即可。
 */
export function openTunnel(
  ssh: SSHTunnel,
  targetHost: string,
  targetPort: number
): Promise<TunnelHandle> {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    const server = require('net').createServer((socket: import('net').Socket) => {
      conn.forwardOut(
        '127.0.0.1',
        0,
        targetHost,
        targetPort,
        (err, stream) => {
          if (err) {
            socket.destroy()
            return
          }
          socket.pipe(stream).pipe(socket)
        }
      )
    })

    const connOpts: import('ssh2').ConnectOptions = {
      host: ssh.host,
      port: ssh.port,
      username: ssh.username
    }
    if (ssh.authType === 'password') {
      connOpts.password = ssh.password
    } else {
      connOpts.privateKey = ssh.privateKey
      if (ssh.passphrase) connOpts.passphrase = ssh.passphrase
    }

    conn.on('ready', () => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as import('net').AddressInfo
        resolve({
          localPort: addr.port,
          close: () => {
            server.close()
            conn.end()
          }
        })
      })
    })
    conn.on('error', reject)
    conn.connect(connOpts)
  })
}
