import{l as e,lr as t}from"./ui-Bn4ngc5Y.js";import{D as n,O as r,S as i,h as a,k as o,x as s,y as c}from"./index-D5vxleW2.js";var l=`.github/workflows/aviso-diario.yml`,u=`aviso/enviar.mjs`,d=`aviso/config.json`;function f(e,t){let n=(new Intl.DateTimeFormat(`en-US`,{timeZone:e,timeZoneName:`longOffset`}).formatToParts(t).find(e=>e.type===`timeZoneName`)?.value??`GMT`).match(/GMT([+-])(\d{2}):?(\d{2})?/);if(!n)return 0;let r=Number(n[2])+Number(n[3]??0)/60;return n[1]===`-`?-r:r}function p(e,t,n=new Date().getFullYear()){let r=new Set([f(t,new Date(n,0,15)),f(t,new Date(n,6,15))]),i=new Set;for(let t of r){let n=Math.floor(((e-t)%24+24)%24);i.add(n),i.add((n+1)%24)}return[...i].sort((e,t)=>e-t)}function m(e,t){return`# Creado por Productivity. Cada mañana manda al iPhone el número de cosas del día.
# Para probarlo: pestaña Actions → «Número del día» → Run workflow.
name: Número del día
on:
  schedule:
${p(e,t).map(e=>`    - cron: '7 ${e} * * *'`).join(`
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
      - uses: actions/checkout@v4
      - run: npm install --no-save --no-package-lock --no-audit --no-fund web-push@3.6.7
      - run: node ${u}
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          FORZAR: \${{ github.event_name == 'workflow_dispatch' && 'si' || 'no' }}
`}var h=`// Creado por Productivity. Lo ejecuta GitHub cada mañana (ver ${l}).
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
if (enviados && process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY) {
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
`,g=t({activarAviso:()=>T,avisoActivoAqui:()=>b,avisoDisponible:()=>y,desactivarAviso:()=>E,revisarAviso:()=>D}),_=e=>btoa(String.fromCharCode(...e)).replace(/\+/g,`-`).replace(/\//g,`_`).replace(/=+$/,``),v=e=>Uint8Array.from(atob(e.replace(/-/g,`+`).replace(/_/g,`/`)+`===`.slice((e.length+3)%4)),e=>e.charCodeAt(0));function y(){return typeof window<`u`&&`serviceWorker`in navigator&&`PushManager`in window&&typeof Notification<`u`}function b(){return a()}async function x(){let e=await crypto.subtle.generateKey({name:`ECDSA`,namedCurve:`P-256`},!0,[`sign`,`verify`]),t=new Uint8Array(await crypto.subtle.exportKey(`raw`,e.publicKey)),n=(await crypto.subtle.exportKey(`jwk`,e.privateKey)).d;return{publico:_(t),privado:n}}async function S(e){let t=await o(e,d);if(!t)return{conf:null,sha:null};try{return{conf:JSON.parse(t.texto),sha:t.sha}}catch{return{conf:null,sha:t.sha}}}async function C(e,t,n,i){let a=await o(e,t);a?.texto!==n&&await r(e,t,n,a?.sha??null,i)}function w(e){return e instanceof n&&(e.codigo===`sin_permiso`||e.codigo===`no_encontrado`)?Error(`La llave necesita también el permiso «Workflows: Read and write». Añádeselo a la llave en GitHub (Settings → Developer settings → Fine-grained tokens → Productivity → Edit) y vuelve a tocar «Activar».`):e instanceof Error?e:Error(`No se pudo activar.`)}async function T(t){let n=c();if(!n)throw Error(`Primero conecta este aparato en Ajustes → Sincronizar.`);if(!y())throw Error(`Aquí no se puede. En el iPhone, abre la app desde su icono de la pantalla de inicio.`);if(Notification.permission!==`granted`&&await Notification.requestPermission()!==`granted`)throw Error(`El iPhone no dio el permiso. Ajustes del iPhone → Notificaciones → Productivity: activa «Permitir notificaciones» y «Globos».`);let a=Intl.DateTimeFormat().resolvedOptions().timeZone||`America/New_York`,o=new URL(`./`,location.href).href;try{await C(n,l,m(t,a),`Aviso diario: horario`),await C(n,u,h,`Aviso diario: script`)}catch(e){throw w(e)}let{conf:f,sha:p}=await S(n),g=f?.vapid??await x(),b=await navigator.serviceWorker.ready,T=await b.pushManager.getSubscription(),E=v(g.publico);T&&!(e=>{let t=e.options?.applicationServerKey;return!!t&&_(new Uint8Array(t))===g.publico})(T)&&(await T.unsubscribe().catch(()=>{}),T=null),T||=await b.pushManager.subscribe({userVisibleOnly:!0,applicationServerKey:E});let D=T.toJSON(),O={version:1,url:o,zona:a,hora:t,vapid:g,aparatos:{...f?.aparatos??{},[s()]:{endpoint:D.endpoint,keys:D.keys}}};await r(n,d,JSON.stringify(O,null,2)+`
`,p,`Aviso diario: ${s()}`),e({numeroEnIcono:!0}),await i({endpoint:D.endpoint,hora:t})}async function E(){let e=c();if(await(await(`serviceWorker`in navigator?await navigator.serviceWorker.ready:null)?.pushManager.getSubscription())?.unsubscribe().catch(()=>{}),e){let{conf:t,sha:n}=await S(e);t&&t.aparatos[s()]&&(delete t.aparatos[s()],await r(e,d,JSON.stringify(t,null,2)+`
`,n,`Aviso diario: sin ${s()}`))}await i(null)}async function D(){let e=a(),t=c();if(e&&t&&y()){await C(t,u,h,`Aviso diario: script`).catch(()=>{});try{let t=await(await navigator.serviceWorker.ready).pushManager.getSubscription();if(t&&t.endpoint===e.endpoint||Notification.permission!==`granted`)return;await T(e.hora)}catch{}}}export{E as a,g as i,b as n,y as r,T as t};