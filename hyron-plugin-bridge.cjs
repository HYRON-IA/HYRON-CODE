// HYRONCODE Plugin Bridge, dev-only. Localhost-only, fixed operations, no arbitrary commands.
const http = require('node:http')
const { spawn } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')

const PORT = 43187
const ROOT = process.env.HYRONCODE_ROOT || process.cwd()
const CLI = path.join(ROOT, 'packages', 'cli', 'src', 'index.ts')
if (!fs.existsSync(CLI)) { console.error('CLI do HYRONCODE nao encontrado:', CLI); process.exit(2) }
const ORIGINS = new Set(['http://localhost:5173', 'http://127.0.0.1:5173'])
const pkgRE = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(?:@(?:[0-9][a-z0-9.+-]*|latest|next|beta))?$/i
const validPackage = v => typeof v === 'string' && v.length < 155 && pkgRE.test(v) && !v.includes('..') && !v.startsWith('-')
const configPath = path.join(os.homedir(), '.config', 'opencode', 'opencode.json')
let busy = false
const send = (res, status, data) => { res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' }); res.end(JSON.stringify(data)) }
function basePackage(spec) { return spec.replace(/@(?:latest|next|beta|[0-9][a-z0-9.+-]*)$/i, '') }
function isInstalled(name) {
  try {
    const data = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    if (!Array.isArray(data.plugins)) return false
    return data.plugins.some(p => typeof p === 'string' && basePackage(p) === basePackage(name) || p && typeof p === 'object' && typeof p.package === 'string' && basePackage(p.package) === basePackage(name))
  } catch { return false }
}
function execute(args) {
  return new Promise(resolve => {
    const child = spawn(process.platform === 'win32' ? 'bun.exe' : 'bun', ['run', '--cwd', 'packages/cli', 'src/index.ts', 'plugin', ...args], {
      cwd: ROOT, shell: false, windowsHide: true, env: { ...process.env, FORCE_COLOR:'0' }, stdio: ['ignore','pipe','pipe'],
    })
    let out = '', err = '', ended = false
    const append = (which, chunk) => { if (which === 'out') out = (out + String(chunk)).slice(-12000); else err = (err + String(chunk)).slice(-12000) }
    child.stdout.on('data', chunk => append('out', chunk))
    child.stderr.on('data', chunk => append('err', chunk))
    const finish = (ok, code) => { if (ended) return; ended = true; clearTimeout(timer); resolve({ ok, code, output: (out+'\n'+err).trim().slice(-16000) }) }
    const timer = setTimeout(() => { child.kill(); finish(false, 'TIMEOUT') }, 120000)
    child.on('error', error => finish(false, 'START_FAILED: ' + error.message))
    child.on('close', code => finish(code === 0, code))
  })
}
const server = http.createServer(async (req, res) => {
  const host = req.headers.host || ''
  if (host !== `127.0.0.1:${PORT}` && host !== `localhost:${PORT}`) return send(res, 403, { error:'Host invalido' })
  const origin = req.headers.origin
  if (!ORIGINS.has(origin)) return send(res, 403, { error:'Origem nao autorizada' })
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Hyroncode-Plugin-Store')
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok:true, version:3, busy })
  if (req.method === 'GET' && req.url.startsWith('/status?')) {
    const url = new URL(req.url, `http://${host}`)
    const name = url.searchParams.get('package')
    if (!validPackage(name)) return send(res, 400, {error:'Pacote invalido'})
    return send(res, 200, {ok:true, installed:isInstalled(name)})
  }
  if (req.method !== 'POST' || req.url !== '/action') return send(res, 404, {error:'Nao encontrado'})
  if (req.headers['content-type']?.split(';')[0] !== 'application/json' || req.headers['x-hyroncode-plugin-store'] !== '1') return send(res, 415, {error:'Requisicao invalida'})
  if (busy) return send(res, 409, {error:'Outra operacao esta em andamento'})
  let body = ''
  try {
    for await (const chunk of req) { body += chunk; if (body.length > 2048) throw Error('Corpo excede limite') }
    const payload = JSON.parse(body)
    const action = payload.action
    if (!['install','update','remove'].includes(action) || !validPackage(payload.package)) return send(res, 400, {error:'Acao ou pacote invalido'})
    // Do not let a search result remove an unrelated existing plugin.
    if ((action === 'remove' || action === 'update') && !isInstalled(payload.package)) return send(res, 409, {error:'Plugin nao consta na configuracao global'})
    if (action === 'install' && isInstalled(payload.package)) return send(res, 409, {error:'Plugin ja configurado'})
    busy = true
    const args = action === 'install' ? ['add',payload.package] : action === 'remove' ? ['remove',payload.package] : ['update',payload.package]
    const result = await execute(args)
    return send(res, result.ok ? 200 : 500, {...result, installed:isInstalled(payload.package)})
  } catch (error) { return send(res, 400, {error:String(error.message || error)}) }
  finally { busy = false }
})
server.listen(PORT, '127.0.0.1', () => console.log(`HYRONCODE Plugin Bridge v3 ativo em 127.0.0.1:${PORT}`))
server.on('error', error => { console.error('Falha na porta 43187:',error.message); process.exit(1) })
