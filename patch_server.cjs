const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

// 1. Root redirect and legacy static
const legacyRoutes = `
// Legacy Terminal Routes
app.use('/t', express.static(path.join(APP_ROOT, 'public-legacy')));
app.get('/t', (req, res) => {
    res.sendFile(path.join(APP_ROOT, 'public-legacy', 'index.html'));
});

app.get('/', (req, res) => {
    res.redirect('/t');
});

// Legacy Terminal Upload/Download
const legacyUpload = multer({ dest: os.tmpdir() });
app.post('/upload', legacyUpload.any(), async (req, res) => {
    try {
        const cwd = req.query.cwd || process.env.HOME || '/root';
        if (!fs.existsSync(cwd)) {
            fs.mkdirSync(cwd, { recursive: true });
        }
        for (const file of req.files) {
            const destPath = path.join(cwd, file.originalname);
            await fs.promises.copyFile(file.path, destPath);
            await fs.promises.unlink(file.path);
        }
        res.json({ success: true });
    } catch (e) {
        console.error('Upload error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/download', (req, res) => {
    const cwd = process.env.HOME || '/root';
    const tarProcess = spawn('tar', [
        '-czf', '-', 
        '--exclude=node_modules', 
        '--exclude=.npm', 
        '--exclude=.cache', 
        '--exclude=project', 
        '-C', cwd, 
        '.'
    ]);
    
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', 'attachment; filename="workspace.tar.gz"');
    tarProcess.stdout.pipe(res);
});

`;

// Insert after app.use(express.urlencoded(...))
code = code.replace(/app\.use\(express\.urlencoded\(\{ limit: '50mb', extended: true \}\)\);/, `app.use(express.urlencoded({ limit: '50mb', extended: true }));\nconst multer = require('multer');\n${legacyRoutes}`);

// 2. Change express.static(dist) to /ui
code = code.replace(
    /app\.use\(express\.static\(path\.join\(APP_ROOT, 'dist'\)/g,
    "app.use('/ui', express.static(path.join(APP_ROOT, 'dist')"
);

// 3. Change app.get('*') to app.get('/ui*')
code = code.replace(/app\.get\('\*', \(req, res\) => \{/g, "app.get('/ui*', (req, res) => {");
code = code.replace(/res\.redirect\(\`\$\{req\.protocol\}:\/\/\$\{redirectHost\}:\$\{VITE_PORT\}\`\);/g, "res.redirect(`${req.protocol}://${redirectHost}:${VITE_PORT}/ui`);");

// 4. Run git-sync script at startup
const startupLogic = `
        // Run initial scripts
        try {
            fs.chmodSync(path.join(APP_ROOT, 'scripts', 'git-sync.sh'), 0o755);
            fs.chmodSync(path.join(APP_ROOT, 'scripts', 'init-project.sh'), 0o755);
            fs.chmodSync(path.join(APP_ROOT, 'scripts', 'shell-setup.sh'), 0o755);
            fs.chmodSync(path.join(APP_ROOT, 'scripts', 'sync-daemon.sh'), 0o755);
        } catch(e) { console.error('Failed to chmod scripts', e); }
`;
code = code.replace(/async function startServer\(\) \{/, `async function startServer() {\n${startupLogic}`);

fs.writeFileSync('server/index.js', code);
