const terminalContainer = document.getElementById('terminal-container');
const pathname = window.location.pathname;

// Update nav active state
if (pathname === '/ui') {
  document.getElementById('nav-ui').classList.add('active');
} else {
  document.getElementById('nav-t').classList.add('active');
}

function initTerminal() {
  const term = new Terminal({
    cursorBlink: true,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
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

  try {
    const webLinksAddon = new WebLinksAddon.WebLinksAddon();
    term.loadAddon(webLinksAddon);
  } catch (e) {
    console.warn('WebLinks addon could not be loaded', e);
  }

  term.open(terminalContainer);
  fitAddon.fit();

  try {
    const webglAddon = new WebglAddon.WebglAddon();
    term.loadAddon(webglAddon);
  } catch (e) {
    console.warn('WebGL addon could not be loaded, falling back to DOM/Canvas renderer', e);
  }

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const typeParam = pathname === '/ui' ? 'claude' : 'bash';
  const wsUrl = `${protocol}//${location.host}/terminal?type=${typeParam}`;
  
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
    term.write('\r\n\r\nConnection error.');
  };

  term.onData(data => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send('0' + data);
    }
  });

  term.onTitleChange(title => {
    if (title.startsWith('__UPLOAD__:')) {
      const parts = title.split(':');
      const randomSuffix = parts.pop();
      const prefix = parts.shift();
      const uploadPath = parts.join(':');

      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.multiple = true;
      fileInput.style.display = 'none';

      fileInput.addEventListener('change', async () => {
        if (!fileInput.files || fileInput.files.length === 0) return;
        const formData = new FormData();
        for (const file of fileInput.files) {
          formData.append('files', file);
        }

        try {
          term.write(`\r\nUploading ${fileInput.files.length} file(s) to ${uploadPath}...\r\n`);
          const res = await fetch(`/upload?cwd=${encodeURIComponent(uploadPath)}`, {
            method: 'POST',
            body: formData
          });
          if (res.ok) {
            term.write('Upload complete.\r\n');
          } else {
            term.write(`Upload failed: ${res.statusText}\r\n`);
          }
        } catch (e) {
          term.write(`Upload error: ${e.message}\r\n`);
        }
      });
      document.body.appendChild(fileInput);
      fileInput.click();
      document.body.removeChild(fileInput);
    } else if (title.startsWith('__DOWNLOAD__:')) {
      window.location.href = '/download';
    }
  });

  window.addEventListener('resize', () => {
    fitAddon.fit();
    if (ws.readyState === WebSocket.OPEN) {
      ws.send('1' + JSON.stringify({ cols: term.cols, rows: term.rows }));
    }
  });
}

initTerminal();
