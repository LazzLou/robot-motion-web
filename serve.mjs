import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('./dist/',import.meta.url);
const allowed=new Set(['index.html','style.css','app.js','geometry.js']);
http.createServer(async(req,res)=>{const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';if(!allowed.has(name)){res.writeHead(404);res.end('Not found');return;}try{const body=await readFile(new URL(name,root));res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(body);}catch{res.writeHead(500);res.end('Unable to load file');}}).listen(4173,'127.0.0.1',()=>console.log('Local URL: http://127.0.0.1:4173'));
