// Prévia estática local. Não executa pagamentos ou gravações no servidor.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const tipos = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.mp4':'video/mp4','.mp3':'audio/mpeg'};
http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400); return res.end(); }
    if (pathname.startsWith('/api/')) {
        res.setHeader('Content-Type', 'application/json');
        if (pathname === '/api/pagamento' && req.method === 'GET') return res.end('{"habilitado":false}');
        res.writeHead(503); return res.end('{"erro":"Operação indisponível na prévia local."}');
    }
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep) || path.relative(root, file).split(path.sep).some(p => p.startsWith('.'))) {
        res.writeHead(403); return res.end();
    }
    fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); return res.end(); }
        res.setHeader('Content-Type', tipos[path.extname(file)] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-store');
        res.end(req.method === 'HEAD' ? undefined : data);
    });
}).listen(5501, '127.0.0.1', () => console.log('Prévia em http://127.0.0.1:5501/'));
