import{Zr as e,l as t}from"./ui-D0WuxJB7.js";import{E as n,F as r,I as i,O as a,P as o,S as s,k as c}from"./index-crR_IW6V.js";var l=`.github/workflows/aviso-diario.yml`,u=`aviso/enviar.mjs`,d=`aviso/config.json`;function f(e,t){let n=Object.fromEntries(new Intl.DateTimeFormat(`en-US`,{timeZone:e,hourCycle:`h23`,year:`numeric`,month:`numeric`,day:`numeric`,hour:`numeric`,minute:`numeric`}).formatToParts(t).map(e=>[e.type,e.value])),r=Date.UTC(Number(n.year),Number(n.month)-1,Number(n.day),Number(n.hour)%24,Number(n.minute)),i=Math.floor(t.getTime()/6e4)*6e4;return Math.round((r-i)/6e4/15)*15/60}var p=[7,37];function m(e,t,n=new Date().getFullYear()){let r=new Set([f(t,new Date(n,0,15,12)),f(t,new Date(n,6,15,12))]),i=new Set;for(let t of r){let n=Math.floor(((e-t)%24+24)%24);for(let e=0;e<3;e++)i.add((n+e)%24)}return[...i].sort((e,t)=>e-t)}function h(e,t){return`# Creado por Productivity. Cada mañana manda al iPhone el número de cosas del día.
# Para probarlo: pestaña Actions → «Número del día» → Run workflow.
name: Número del día
on:
  schedule:
${`    - cron: '${p.join(`,`)} ${m(e,t).join(`,`)} * * *'`}
  workflow_dispatch:
permissions:
  contents: write
concurrency: aviso-diario
jobs:
  enviar:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - run: npm install --no-save --no-package-lock --no-audit --no-fund web-push@3.6.7
      - run: node ${u}
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          FORZAR: \${{ github.event_name == 'workflow_dispatch' && 'si' || 'no' }}
`}var g=`// Creado por Productivity. Lo ejecuta GitHub cada mañana (ver ${l}).
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

let ultimo = ''
try { ultimo = fs.readFileSync('aviso/ultimo.txt', 'utf8').trim() } catch {}
if (!forzar && (hora < conf.hora || ultimo === hoy)) {
  console.log('Todavía no toca o ya se envió hoy.', { hoy, hora, ultimo })
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

// Apunta el día para no repetirlo si GitHub vuelve a despertar más tarde.
// Las pruebas a mano (Run workflow) no cuentan: el aviso de la mañana sigue llegando ese día.
if (enviados && !forzar && process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY) {
  for (let intento = 0; intento < 3; intento++) {
    const r = await fetch(api, { headers: cabeceras })
    const sha = r.ok ? (await r.json()).sha : undefined
    const w = await fetch(api, {
      method: 'PUT',
      headers: { ...cabeceras, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Aviso del ' + hoy + ' enviado', content: Buffer.from(hoy).toString('base64'), sha }),
    })
    if (w.ok) break
    console.log('Reintento al apuntar el día:', w.status)
  }
}
`,_=e({activarAviso:()=>E,avisoActivoAqui:()=>x,avisoDisponible:()=>b,desactivarAviso:()=>D,revisarAviso:()=>O}),v=e=>btoa(String.fromCharCode(...e)).replace(/\+/g,`-`).replace(/\//g,`_`).replace(/=+$/,``),y=e=>Uint8Array.from(atob(e.replace(/-/g,`+`).replace(/_/g,`/`)+`===`.slice((e.length+3)%4)),e=>e.charCodeAt(0));function b(){return typeof window<`u`&&`serviceWorker`in navigator&&`PushManager`in window&&typeof Notification<`u`}function x(){return s()}async function S(){let e=await crypto.subtle.generateKey({name:`ECDSA`,namedCurve:`P-256`},!0,[`sign`,`verify`]),t=new Uint8Array(await crypto.subtle.exportKey(`raw`,e.publicKey)),n=(await crypto.subtle.exportKey(`jwk`,e.privateKey)).d;return{publico:v(t),privado:n}}async function C(e){let t=await i(e,d);if(!t)return{conf:null,sha:null};try{return{conf:JSON.parse(t.texto),sha:t.sha}}catch{return{conf:null,sha:t.sha}}}async function w(e,t,n,a){let o=await i(e,t);o?.texto!==n&&await r(e,t,n,o?.sha??null,a)}function T(e){return e instanceof o&&(e.codigo===`sin_permiso`||e.codigo===`no_encontrado`)?Error(`La llave necesita también el permiso «Workflows: Read and write». Añádeselo a la llave en GitHub (Settings → Developer settings → Fine-grained tokens → Productivity → Edit) y vuelve a tocar «Activar».`):e instanceof Error?e:Error(`No se pudo activar.`)}async function E(e){let i=n();if(!i)throw Error(`Primero conecta este aparato en Ajustes → Sincronizar.`);if(!b())throw Error(`Aquí no se puede. En el iPhone, abre la app desde su icono de la pantalla de inicio.`);if(Notification.permission!==`granted`&&await Notification.requestPermission()!==`granted`)throw Error(`El iPhone no dio el permiso. Ajustes del iPhone → Notificaciones → Productivity: activa «Permitir notificaciones» y «Globos».`);let o=Intl.DateTimeFormat().resolvedOptions().timeZone||`America/New_York`,s=new URL(`./`,location.href).href;try{await w(i,l,h(e,o),`Aviso diario: horario`),await w(i,u,g,`Aviso diario: script`)}catch(e){throw T(e)}let{conf:f,sha:p}=await C(i),m=f?.vapid??await S(),_=await navigator.serviceWorker.ready,x=await _.pushManager.getSubscription(),E=y(m.publico);x&&!(e=>{let t=e.options?.applicationServerKey;return!!t&&v(new Uint8Array(t))===m.publico})(x)&&(await x.unsubscribe().catch(()=>{}),x=null),x||=await _.pushManager.subscribe({userVisibleOnly:!0,applicationServerKey:E});let D=x.toJSON(),O={version:1,url:s,zona:o,hora:e,vapid:m,aparatos:{...f?.aparatos??{},[a()]:{endpoint:D.endpoint,keys:D.keys}}};await r(i,d,JSON.stringify(O,null,2)+`
`,p,`Aviso diario: ${a()}`),t({numeroEnIcono:!0}),await c({endpoint:D.endpoint,hora:e})}async function D(){let e=n();if(await(await(`serviceWorker`in navigator?await navigator.serviceWorker.ready:null)?.pushManager.getSubscription())?.unsubscribe().catch(()=>{}),e){let{conf:t,sha:n}=await C(e);t&&t.aparatos[a()]&&(delete t.aparatos[a()],await r(e,d,JSON.stringify(t,null,2)+`
`,n,`Aviso diario: sin ${a()}`))}await c(null)}async function O(){let e=n();if(!e)return;try{let{conf:t}=await C(e);t&&typeof t.hora==`number`&&t.zona&&(await w(e,u,g,`Aviso diario: script`),await w(e,l,h(t.hora,t.zona),`Aviso diario: horario`))}catch{}let t=s();if(t&&b())try{let e=await(await navigator.serviceWorker.ready).pushManager.getSubscription();if(e&&e.endpoint===t.endpoint||Notification.permission!==`granted`)return;await E(t.hora)}catch{}}export{D as a,_ as i,x as n,b as r,E as t};