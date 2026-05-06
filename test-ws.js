import { WebSocket } from 'ws';

const ws = new WebSocket('ws://127.0.0.0:3000/terminal?token=password');

ws.on('open', () => {
  console.log('Connected!');
  ws.send(JSON.stringify({ type: 'data', data: 'echo Hello\n' }));
});

ws.on('message', (data) => {
  console.log('Received: %s', data);
  if (data.toString().includes('Hello')) {
    console.log('Success!');
    ws.close();
    process.exit(0);
  }
});

ws.on('error', (err) => {
  console.error('Error:', err);
  process.exit(1);
});

ws.on('close', () => {
  console.log('Closed');
});