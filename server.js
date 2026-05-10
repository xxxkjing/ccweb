import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import fastifyMultipart from '@fastify/multipart';
import { spawn } from 'node-pty';
import { exec, spawn as cpSpawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { pipeline } from 'stream/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = Fastify({ logger: true });

app.register(fastifyStatic, {
  root: path.join(__dirname, 'public'),
});

app.register(fastifyMultipart);
app.register(fastifyWebsocket, { options: { perMessageDeflate: false } });

const PASSWORD = process.env.TERMINAL_PASSWORD || 'password';
let activeConnection = null;
let globalPtyProcess = null;
let ptyHistory = [];

const syncWorkspace = () => {
  console.log('Running git sync...');
  exec('bash scripts/git-sync.sh', { cwd: __dirname }, (error, stdout, stderr) => {
    if (error) {
      console.error(`Git sync error: ${error.message}`);
      return;
    }
    if (stderr) console.error(`Git sync stderr: ${stderr}`);
    console.log(`Git sync stdout: ${stdout}`);
  });
};

app.post('/upload', async (req, reply) => {
  const cwd = req.query.cwd || process.env.HOME || '/root';
  const parts = req.parts();
  for await (const part of parts) {
    if (part.file) {
      const dest = fs.createWriteStream(path.join(cwd, part.filename));
      await pipeline(part.file, dest);
    }
  }
  return { success: true };
});

app.get('/download', (req, reply) => {
  const cwd = process.env.HOME || '/root';
  const tarProcess = cpSpawn('tar', [
    '-czf', '-', 
    '--exclude=node_modules', 
    '--exclude=.npm', 
    '--exclude=.cache', 
    '--exclude=project', 
    '-C', cwd, 
    '.'
  ]);
  
  reply.header('Content-Type', 'application/gzip');
  reply.header('Content-Disposition', 'attachment; filename="workspace.tar.gz"');
  return reply.send(tarProcess.stdout);
});

app.register(async function (fastify) {
  fastify.get('/terminal', { websocket: true }, (connection, req) => {
    if (activeConnection) {
      connection.send('Another user is already connected.\r\n');
      connection.close(1008, 'Max connections reached');
      return;
    }

    activeConnection = connection;
    let authenticated = false;
    let passwordBuffer = '';
    let cachedResizeMsg = null;

    connection.send('Password: ');

    connection.on('message', message => {
      const msgStr = message.toString();
      
      if (!authenticated) {
        if (msgStr.startsWith('1')) {
          cachedResizeMsg = msgStr.slice(1);
          return;
        }

        if (msgStr.startsWith('0')) {
          const char = msgStr.slice(1);
          if (char === '\r') {
            connection.send('\r\n');
            if (passwordBuffer === PASSWORD) {
              authenticated = true;
              connection.authenticated = true;
              activeConnection = connection;

              if (!globalPtyProcess) {
                globalPtyProcess = spawn('bash', [], {
                  name: 'xterm-256color',
                  cols: 80,
                  rows: 24,
                  cwd: process.env.HOME || '/root',
                  env: {
                    ...process.env,
                    TERM: 'xterm-256color',
                    COLORTERM: 'truecolor'
                  }
                });

                globalPtyProcess.onData(data => {
                  ptyHistory.push(data);
                  if (ptyHistory.length > 5000) {
                    ptyHistory.shift();
                  }
                  if (activeConnection) {
                    activeConnection.send(data);
                  }
                });
              } else {
                for (const chunk of ptyHistory) {
                  connection.send(chunk);
                }
              }

              if (cachedResizeMsg) {
                try {
                  const msg = JSON.parse(cachedResizeMsg);
                  globalPtyProcess.resize(msg.cols, msg.rows);
                } catch (e) {
                  // ignore
                }
              }
            } else {
              connection.send('Access Denied\r\n');
              connection.close(1008, 'Invalid password');
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
        globalPtyProcess.write(msgStr.slice(1));
      } else if (msgStr.startsWith('1')) {
        try {
          const msg = JSON.parse(msgStr.slice(1));
          globalPtyProcess.resize(msg.cols, msg.rows);
        } catch (e) {
          console.error('Failed to parse resize message', e);
        }
      } else {
        try {
          const msg = JSON.parse(msgStr);
          if (msg.type === 'resize') {
            globalPtyProcess.resize(msg.cols, msg.rows);
          } else if (msg.type === 'data') {
            globalPtyProcess.write(msg.data);
          }
        } catch (e) {
          globalPtyProcess.write(msgStr);
        }
      }
    });

    connection.on('close', () => {
      activeConnection = null;
      syncWorkspace();
    });
  });
});

const start = async () => {
  try {
    fs.chmodSync(path.join(__dirname, 'scripts', 'git-sync.sh'), 0o755);
    fs.chmodSync(path.join(__dirname, 'scripts', 'init-project.sh'), 0o755);
    fs.chmodSync(path.join(__dirname, 'scripts', 'shell-setup.sh'), 0o755);
    fs.chmodSync(path.join(__dirname, 'scripts', 'sync-daemon.sh'), 0o755);
    
    await app.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' });
    console.log(`Server listening on ${app.server.address().port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
