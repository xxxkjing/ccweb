import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import { spawn } from 'node-pty';
import cron from 'node-cron';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = Fastify({ logger: true });

app.register(fastifyStatic, {
  root: path.join(__dirname, 'public'),
});

app.register(fastifyWebsocket);

const PASSWORD = process.env.TERMINAL_PASSWORD || 'password';
let activeConnection = null;

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

// Auto-sync every 5 minutes
cron.schedule('*/5 * * * *', syncWorkspace);

app.register(async function (fastify) {
  fastify.get('/terminal', { websocket: true }, (connection, req) => {
    const token = req.query.token;

    if (token !== PASSWORD) {
      connection.socket.close(1008, 'Invalid password');
      return;
    }

    if (activeConnection) {
      connection.socket.send('Another user is already connected.\r\n');
      connection.socket.close(1008, 'Max connections reached');
      return;
    }

    activeConnection = connection;

    const ptyProcess = spawn('bash', [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: '/workspace/project',
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor'
      }
    });

    ptyProcess.onData(data => {
      connection.socket.send(data);
    });

    connection.socket.on('message', message => {
      try {
        const msg = JSON.parse(message.toString());
        if (msg.type === 'resize') {
          ptyProcess.resize(msg.cols, msg.rows);
        } else if (msg.type === 'data') {
          ptyProcess.write(msg.data);
        }
      } catch (e) {
        // Fallback for raw data if needed
        ptyProcess.write(message.toString());
      }
    });

    connection.socket.on('close', () => {
      activeConnection = null;
      ptyProcess.kill();
      syncWorkspace();
    });
  });
});

const start = async () => {
  try {
    // Ensure scripts are executable
    fs.chmodSync(path.join(__dirname, 'scripts', 'git-sync.sh'), 0o755);
    fs.chmodSync(path.join(__dirname, 'scripts', 'init-project.sh'), 0o755);
    fs.chmodSync(path.join(__dirname, 'scripts', 'shell-setup.sh'), 0o755);
    
    // Create workspace project directory if it doesn't exist
    fs.mkdirSync('/workspace/project', { recursive: true });
    
    await app.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' });
    console.log(`Server listening on ${app.server.address().port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
