const overlay = document.getElementById('overlay');
const passwordInput = document.getElementById('password-input');
const terminalContainer = document.getElementById('terminal-container');

passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const password = passwordInput.value;
    overlay.style.display = 'none';
    initTerminal(password);
  }
});

function initTerminal(password) {
  const term = new Terminal({
    cursorBlink: true,
    fontFamily: 'monospace',
    theme: {
      background: '#000000'
    }
  });

  const fitAddon = new FitAddon.FitAddon();
  term.loadAddon(fitAddon);

  term.open(terminalContainer);
  fitAddon.fit();

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${location.host}/terminal?token=${encodeURIComponent(password)}`;
  
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
  };

  ws.onmessage = (event) => {
    term.write(event.data);
  };

  ws.onclose = () => {
    term.write('\r\n\r\nConnection closed.');
  };

  ws.onerror = () => {
    term.write('\r\n\r\nConnection error. Incorrect password?');
    setTimeout(() => {
      overlay.style.display = 'flex';
      passwordInput.value = '';
      passwordInput.focus();
    }, 2000);
  };

  term.onData(data => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'data', data }));
    }
  });

  window.addEventListener('resize', () => {
    fitAddon.fit();
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
    }
  });
}
