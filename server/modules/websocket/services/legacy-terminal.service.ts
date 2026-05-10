import { spawn } from 'node-pty';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// __dirname is server/modules/websocket/services, project root is ../../../..
const projectRoot = path.join(__dirname, '..', '..', '..', '..');

const PASSWORD = process.env.TERMINAL_PASSWORD || 'password';
const ptySessions = {
  bash: { process: null, history: [], connection: null },
  claude: { process: null, history: [], connection: null }
};

const syncWorkspace = () => {
  console.log('Running git sync...');
  exec('bash scripts/git-sync.sh', { cwd: projectRoot }, (error, stdout, stderr) => {
    if (error) {
      console.error(`Git sync error: ${error.message}`);
      return;
    }
    if (stderr) console.error(`Git sync stderr: ${stderr}`);
    console.log(`Git sync stdout: ${stdout}`);
  });
};

export function handleLegacyTerminalConnection(ws: any, req: any) {
  // Extract query from URL
  const url = new URL(req.url || '', 'http://localhost');
  const type = url.searchParams.get('type') === 'claude' ? 'claude' : 'bash';
  const session = ptySessions[type] as any;

  if (session.connection) {
    ws.send('Another user is already connected.\r\n');
    ws.close(1008, 'Max connections reached');
    return;
  }

  session.connection = ws;
  let authenticated = false;
  let passwordBuffer = '';
  let cachedResizeMsg: string | null = null;

  ws.send('Password: ');

  ws.on('message', (message: any) => {
    const msgStr = message.toString();
    
    if (!authenticated) {
      if (msgStr.startsWith('1')) {
        cachedResizeMsg = msgStr.slice(1);
        return;
      }

      if (msgStr.startsWith('0')) {
        const char = msgStr.slice(1);
        if (char === '\r') {
          ws.send('\r\n');
          if (passwordBuffer === PASSWORD) {
            authenticated = true;
            (ws as any).authenticated = true;

            if (!session.process) {
              const command = type === 'claude' ? 'npx' : 'bash';
              const args = type === 'claude' ? ['claude'] : [];
              session.process = spawn(command, args, {
                name: 'xterm-256color',
                cols: 80,
                rows: 24,
                cwd: process.env.HOME || '/root',
                env: {
                  ...process.env,
                  TERM: 'xterm-256color',
                  COLORTERM: 'truecolor'
                } as any
              });

              session.process.onData((data: string) => {
                session.history.push(data);
                if (session.history.length > 5000) {
                  session.history.shift();
                }
                if (session.connection) {
                  session.connection.send(data);
                }
              });

              session.process.onExit(() => {
                session.process = null;
                session.history = [];
                if (session.connection) {
                  session.connection.close();
                }
              });
            } else {
              for (const chunk of session.history) {
                ws.send(chunk);
              }
            }

            if (cachedResizeMsg) {
              try {
                const msg = JSON.parse(cachedResizeMsg);
                session.process.resize(msg.cols, msg.rows);
              } catch (e) {
                // ignore
              }
            }
          } else {
            ws.send('Access Denied\r\n');
            ws.close(1008, 'Invalid password');
          }
        } else if (char === '\b' || char === '\x7f') {
          if (passwordBuffer.length > 0) {
            passwordBuffer = passwordBuffer.slice(0, -1);
          }
        } else {
          passwordBuffer += char;
        }
      }
      return;
    }

    if (msgStr.startsWith('0')) {
      session.process?.write(msgStr.slice(1));
    } else if (msgStr.startsWith('1')) {
      try {
        const msg = JSON.parse(msgStr.slice(1));
        session.process?.resize(msg.cols, msg.rows);
      } catch (e) {
        console.error('Failed to parse resize message', e);
      }
    } else {
      try {
        const msg = JSON.parse(msgStr);
        if (msg.type === 'resize') {
          session.process?.resize(msg.cols, msg.rows);
        } else if (msg.type === 'data') {
          session.process?.write(msg.data);
        }
      } catch (e) {
        session.process?.write(msgStr);
      }
    }
  });

  ws.on('close', () => {
    session.connection = null;
    syncWorkspace();
  });
}
