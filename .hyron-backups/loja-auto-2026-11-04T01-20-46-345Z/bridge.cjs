// HYRONCODE: companion service for installing native OpenCode plugins from the desktop UI.
// Local development only. Requests restricted by Origin, loopback, JSON content type, fixed commands and package names.
const http = require('node:http')
const { spawn } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')
const PORT = 43187
const ROOT = process.env.HYRONCODE_ROOT || process.cwd()
const CLI = path.join(ROOT, 'packages', 'cli', 'src', 'index.ts')
if (!fs.existsSync(CLI)) { console.error('CLI do HYRONCODE nao encontrado:', CLI); process.exit(2) }
const ORIGINS = new Set(['http://localhost:5173','http://127.0.0.1:5173'])
let busy = false
const nameRE = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(?:@(?:[0-9][a-z0-9.+-]*|latest|next|beta))?$/i
const spec = v => typeof v === 'string' && v.length < 155 && nameRE.test(v) && !v.includes('..') && !v.startsWith('-')
const json = (res,status,data) => {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
function execute(args) {
  return new Promise(resolve => {
    const child = spawn('bun', ['run', '--cwd', 'packages/cli', 'src/index.ts', 'plugin', ...args], {
      cwd: ROOT, shell: false, windowsHide: true, env: {...process.env, FORCE_COLOR:'0'},
      stdio: ['ignore','pipe','pipe'],
    })
    let out = ''
    let err = ''
    const append=(name,chunk)=>{if(name==='out')out=(out+chunk).slice(-16000);else err=(err+chunk).slice(-16000)}
    child.stdout.on('data', c=>append('out',String(c)))
    child.stderr.on('data', c=>append('err',String(c)))
    let ended = false
    const finish = (ok,code) => {if(ended)return;ended=true;clearTimeout(timer);resolve({ok,code,output:((out+'\n'+err).trim()).slice(-20000)})}
    const timer = setTimeout(()=>{child.kill();finish(false,'TIMEOUT')},120000)
    child.on('error',error=>finish(false,'START_FAILED: '+error.message))
    child.on('close',code=>finish(code===0,code))
  })
}
const server = http.createServer(async(req,res)=>{
  const host = req.headers.host || ''
  if (host !== `127.0.0.1:${PORT}` && host !== `localhost:${PORT}`) return json(res,403,{error:'Host invalido'})
  const origin = req.headers.origin
  if (!ORIGINS.has(origin)) return json(res,403,{error:'Origem nao autorizada'})
  res.setHeader('Access-Control-Allow-Origin',origin)
  res.setHeader('Vary','Origin')
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers','Content-Type, X-Hyroncode-Plugin-Store')
  if (req.method === 'OPTIONS') {res.writeHead(204);return res.end()}
  if (req.method === 'GET' && req.url === '/health') return json(res,200,{ok:true,version:1,busy})
  if (req.method !== 'POST' || req.url !== '/action') return json(res,404,{error:'Nao encontrado'})
  if (req.headers['content-type']?.split(';')[0] !== 'application/json' || req.headers['x-hyroncode-plugin-store'] !== '1') return json(res,415,{error:'Requisicao invalida'})
  if (busy) return json(res,409,{error:'Ja existe uma operacao em andamento'})
  let body = ''
  try {
    for await(const chunk of req) {body+=chunk;if(body.length>2048) throw new Error('Corpo excede limite')}
    const p=JSON.parse(body)
    const op=p.action
    if(!['install','remove','list','check','update'].includes(op)) return json(res,400,{error:'Acao desconhecida'})
    if(['install','remove','update'].includes(op) && !spec(p.package)) return json(res,400,{error:'Nome npm invalido'})
    busy=true
    const args = op==='list'?['list']:op==='check'?['check']:op==='install'?['add',p.package]:op==='remove'?['remove',p.package]:['update',p.package]
    const result=await execute(args)
    return json(res,result.ok?200:500,result)
  } catch(e) {return json(res,400,{error:String(e.message||e)})}
  finally {busy=false}
})
server.listen(PORT,'127.0.0.1',()=>console.log(`HYRONCODE Plugin Bridge ativo em 127.0.0.1:${PORT} (somente localhost).`))
server.on('error',e=>{console.error(e.message);process.exit(1)})
