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
    fontFamily: '"Fira Code", "JetBrains Mono", Consolas, "Courier New", monospace',
    fontSize: 14,
    theme: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#aeafad',
      black: '#000000',
      red: '#cd3131',
      green: '#0dbc79',
      yellow: '#e5e510',
      blue: '#2472c8',
      magenta: '#bc3fbc',
      cyan: '#11a8cd',
      white: '#e5e5e5',
      brightBlack: '#666666',
      brightRed: '#f14c4c',
      brightGreen: '#23d18b',
      brightYellow: '#f5f543',
      brightBlue: '#3b8eea',
      brightMagenta: '#d670d6',
      brightCyan: '#29b8db',
      brightWhite: '#e5e5e5'
    }
  });

  const fitAddon = new FitAddon.FitAddon();
  term.loadAddon(fitAddon);

  term.open(terminalContainer);
  fitAddon.fit();

  try {
    const webglAddon = new WebglAddon.WebglAddon();
    term.loadAddon(webglAddon);
  } catch (e) {
    console.warn('WebGL addon could not be loaded, falling back to DOM/Canvas renderer', e);
  }

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${location.host}/terminal?token=${encodeURIComponent(password)}`;
  
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    ws.send('1' + JSON.stringify({ cols: term.cols, rows: term.rows }));
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
      ws.send('0' + data);
    }
  });

  window.addEventListener('resize', () => {
    fitAddon.fit();
    if (ws.readyState === WebSocket.OPEN) {
      ws.send('1' + JSON.stringify({ cols: term.cols, rows: term.rows }));
    }
  });
}
