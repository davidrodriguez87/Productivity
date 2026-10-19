import{l as e,ni as t}from"./ui-CUTBr3Ww.js";import{D as n,F as r,N as i,O as a,P as o,T as s,x as c}from"./index-DukgdEq9.js";var l=`.github/workflows/aviso-diario.yml`,u=`aviso/enviar.mjs`,d=`aviso/config.json`;function f(e,t){let n=Object.fromEntries(new Intl.DateTimeFormat(`en-US`,{timeZone:e,hourCycle:`h23`,year:`numeric`,month:`numeric`,day:`numeric`,hour:`numeric`,minute:`numeric`}).formatToParts(t).map(e=>[e.type,e.value])),r=Date.UTC(Number(n.year),Number(n.month)-1,Number(n.day),Number(n.hour)%24,Number(n.minute)),i=Math.floor(t.getTime()/6e4)*6e4;return Math.round((r-i)/6e4/15)*15/60}function p(e){return Array.from({length:8},(t,n)=>(e+n*3)%24)}var m=(e,t)=>new Set([f(e,new Date(t,0,15,12)),f(e,new Date(t,6,15,12))]),h=(e,t)=>Math.floor(((e-t)%24+24)%24),g=e=>[...e].sort((e,t)=>e-t);function _(e,t,n=new Date().getFullYear()){let r=new Set;for(let i of m(t,n))for(let t of p(e))r.add(h(t,i));return g(r)}function v(e,t,n=new Date().getFullYear()){let r=new Set;for(let i of m(t,n))for(let t of[0,1])r.add(h(e+t,i));return g(r)}function y(e,t){return`# Creado por Productivity. A la hora elegida y luego cada 3 horas manda al iPhone el número de cosas del día.
# Para probarlo: pestaña Actions → «Número del día» → Run workflow.
name: Número del día
on:
  schedule:
${[`    - cron: '7 ${_(e,t).join(`,`)} * * *'`,`    - cron: '37 ${v(e,t).join(`,`)} * * *'`].join(`
`)}
  workflow_dispatch:
permissions:
  contents: write
concurrency: aviso-diario
jobs:
  enviar:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      # Versiones fijas: los cambios de GitHub (Ubuntu nuevo, Node 20 retirado) no afectan al aviso.
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 22
      - run: npm install --no-save --no-package-lock --no-audit --no-fund web-push@3.6.7
      - run: node ${u}
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          FORZAR: \${{ github.event_name == 'workflow_dispatch' && 'si' || 'no' }}
`}var b=`// Creado por Productivity. Lo ejecuta GitHub a la hora elegida y luego cada 3 horas (ver ${l}).
import fs from 'node:fs'
import webpush from 'web-push'

const conf = JSON.parse(fs.readFileSync('${d}', 'utf8'))
const archivo = JSON.parse(fs.readFileSync('productivity-datos.json', 'utf8'))
const datos = archivo.datos || {}
const zona = conf.zona || 'America/New_York'
const p = Object.fromEntries(
  new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date())
    .map((x) => [x.type, x.value]),
)
const hoy = p.year + '-' + p.month + '-' + p.day
const hora = Number(p.hour)
const forzar = process.env.FORZAR === 'si'
const api = 'https://api.github.com/repos/' + process.env.GITHUB_REPOSITORY + '/contents/aviso/ultimo.txt'
const cabeceras = { Authorization: 'Bearer ' + process.env.GITHUB_TOKEN, Accept: 'application/vnd.github+json' }

// Las horas del aviso: la elegida y luego cada 3 horas, todo el día.
const CADA = 3
const horas = Array.from({ length: Math.floor(24 / CADA) }, (_, k) => (Number(conf.hora) + k * CADA) % 24)
const ayer = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day) - 1)).toISOString().slice(0, 10)
// El turno de ahora: la hora de aviso más reciente (a la 1:00, el de las 23:00 de ayer). Se envía una vez por turno.
let turno = ''
for (let atras = 0; atras < CADA && !turno; atras++) {
  const h = hora - atras
  if (horas.includes((h + 24) % 24)) turno = (h < 0 ? ayer : hoy) + ' ' + String((h + 24) % 24).padStart(2, '0') + ':00'
}
let ultimo = ''
try { ultimo = fs.readFileSync('aviso/ultimo.txt', 'utf8').trim() } catch {}
if (!forzar && (!turno || ultimo === turno)) {
  console.log('Este aviso ya se envió.', { hoy, hora, turno, ultimo })
  process.exit(0)
}

const vivo = (x) => x && !x.eliminadoEn && !x.archivadoEn
const lista = (t) => Object.values(datos[t] || {})
const textos = []
let total = 0
const vistas = new Set()
for (const a of lista('acciones')) {
  if (!vivo(a) || a.completadaEn || vistas.has(a.id)) continue
  if ((a.fechaObligatoria && a.fechaObligatoria <= hoy) || a.enHoyPara === hoy) {
    vistas.add(a.id)
    total++
    textos.push(a.texto)
  }
}
const creadas = new Set(lista('instancias').map((i) => i.recurrenteId + '~' + i.fecha))
for (const i of lista('instancias')) {
  if (vivo(i) && !i.completadaEn && i.fecha <= hoy) { total++; textos.push(i.texto) }
}
for (const t of lista('recurrentes')) {
  if (vivo(t) && t.proximaFecha <= hoy && !creadas.has(t.id + '~' + t.proximaFecha)) { total++; textos.push(t.texto) }
}

const titulo = total === 0 ? 'Hoy no tienes nada que hacer' : total === 1 ? 'Hoy tienes 1 cosa que hacer' : 'Hoy tienes ' + total + ' cosas que hacer'
const cuerpo = total === 0 ? 'El día es tuyo para elegir tus tres.' : textos[0] + (total > 1 ? ' y ' + (total - 1) + ' más' : '')
const mensaje = JSON.stringify({
  web_push: 8030,
  notification: { title: titulo, body: cuerpo, navigate: conf.url, silent: false, app_badge: String(total) },
})
console.log(hoy, titulo, '-', cuerpo)

webpush.setVapidDetails(conf.url, conf.vapid.publico, conf.vapid.privado)
let enviados = 0
for (const [nombre, sub] of Object.entries(conf.aparatos || {})) {
  try {
    await webpush.sendNotification(sub, mensaje, { TTL: 6 * 3600, urgency: 'high' })
    enviados++
    console.log('Enviado a', nombre)
  } catch (e) {
    console.log('No se pudo enviar a', nombre, e.statusCode || '', e.body || e.message)
  }
}

// Apunta el turno para no repetirlo si GitHub vuelve a despertar más tarde.
// Las pruebas a mano (Run workflow) no cuentan: los avisos de ese día siguen llegando.
if (enviados && !forzar && process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY) {
  for (let intento = 0; intento < 3; intento++) {
    const r = await fetch(api, { headers: cabeceras })
    const sha = r.ok ? (await r.json()).sha : undefined
    const w = await fetch(api, {
      method: 'PUT',
      headers: { ...cabeceras, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Aviso de las ' + turno + ' enviado', content: Buffer.from(turno).toString('base64'), sha }),
    })
    if (w.ok) break
    console.log('Reintento al apuntar el día:', w.status)
  }
}
`,x=t({activarAviso:()=>A,avisoActivoAqui:()=>T,avisoDisponible:()=>w,desactivarAviso:()=>j,revisarAviso:()=>M}),S=e=>btoa(String.fromCharCode(...e)).replace(/\+/g,`-`).replace(/\//g,`_`).replace(/=+$/,``),C=e=>Uint8Array.from(atob(e.replace(/-/g,`+`).replace(/_/g,`/`)+`===`.slice((e.length+3)%4)),e=>e.charCodeAt(0));function w(){return typeof window<`u`&&`serviceWorker`in navigator&&`PushManager`in window&&typeof Notification<`u`}function T(){return c()}async function E(){let e=await crypto.subtle.generateKey({name:`ECDSA`,namedCurve:`P-256`},!0,[`sign`,`verify`]),t=new Uint8Array(await crypto.subtle.exportKey(`raw`,e.publicKey)),n=(await crypto.subtle.exportKey(`jwk`,e.privateKey)).d;return{publico:S(t),privado:n}}async function D(e){let t=await r(e,d);if(!t)return{conf:null,sha:null};try{return{conf:JSON.parse(t.texto),sha:t.sha}}catch{return{conf:null,sha:t.sha}}}async function O(e,t,n,i){let a=await r(e,t);a?.texto!==n&&await o(e,t,n,a?.sha??null,i)}function k(e){return e instanceof i&&(e.codigo===`sin_permiso`||e.codigo===`no_encontrado`)?Error(`La llave necesita también el permiso «Workflows: Read and write». Añádeselo a la llave en GitHub (Settings → Developer settings → Fine-grained tokens → Productivity → Edit) y vuelve a tocar «Activar».`):e instanceof Error?e:Error(`No se pudo activar.`)}async function A(t){let r=s();if(!r)throw Error(`Primero conecta este aparato en Ajustes → Sincronizar.`);if(!w())throw Error(`Aquí no se puede. En el iPhone, abre la app desde su icono de la pantalla de inicio.`);if(Notification.permission!==`granted`&&await Notification.requestPermission()!==`granted`)throw Error(`El iPhone no dio el permiso. Ajustes del iPhone → Notificaciones → Productivity: activa «Permitir notificaciones» y «Globos».`);let i=Intl.DateTimeFormat().resolvedOptions().timeZone||`America/New_York`,c=new URL(`./`,location.href).href;try{await O(r,l,y(t,i),`Aviso diario: horario`),await O(r,u,b,`Aviso diario: script`)}catch(e){throw k(e)}let{conf:f,sha:p}=await D(r),m=f?.vapid??await E(),h=await navigator.serviceWorker.ready,g=await h.pushManager.getSubscription(),_=C(m.publico);g&&!(e=>{let t=e.options?.applicationServerKey;return!!t&&S(new Uint8Array(t))===m.publico})(g)&&(await g.unsubscribe().catch(()=>{}),g=null),g||=await h.pushManager.subscribe({userVisibleOnly:!0,applicationServerKey:_});let v=g.toJSON(),x={version:1,url:c,zona:i,hora:t,vapid:m,aparatos:{...f?.aparatos??{},[n()]:{endpoint:v.endpoint,keys:v.keys}}};await o(r,d,JSON.stringify(x,null,2)+`
`,p,`Aviso diario: ${n()}`),e({numeroEnIcono:!0}),await a({endpoint:v.endpoint,hora:t})}async function j(){let e=s();if(await(await(`serviceWorker`in navigator?await navigator.serviceWorker.ready:null)?.pushManager.getSubscription())?.unsubscribe().catch(()=>{}),e){let{conf:t,sha:r}=await D(e);t&&t.aparatos[n()]&&(delete t.aparatos[n()],await o(e,d,JSON.stringify(t,null,2)+`
`,r,`Aviso diario: sin ${n()}`))}await a(null)}async function M(){let e=s();if(!e)return;try{let{conf:t}=await D(e);t&&typeof t.hora==`number`&&t.zona&&(await O(e,u,b,`Aviso diario: script`),await O(e,l,y(t.hora,t.zona),`Aviso diario: horario`))}catch{}let t=c();if(t&&w())try{let e=await(await navigator.serviceWorker.ready).pushManager.getSubscription();if(e&&e.endpoint===t.endpoint||Notification.permission!==`granted`)return;await A(t.hora)}catch{}}export{j as a,x as i,T as n,p as o,w as r,A as t};