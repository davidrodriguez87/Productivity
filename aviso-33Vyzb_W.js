import{da as e,l as t}from"./ui-DEqFv_aM.js";import{G as n,J as r,V as i,nt as a,q as o,rt as s,tt as c}from"./index-Cqv3YaJX.js";var l=`.github/workflows/aviso-diario.yml`,u=`aviso/enviar.mjs`,d=`aviso/config.json`;function f(e,t){let n=Object.fromEntries(new Intl.DateTimeFormat(`en-US`,{timeZone:e,hourCycle:`h23`,year:`numeric`,month:`numeric`,day:`numeric`,hour:`numeric`,minute:`numeric`}).formatToParts(t).map(e=>[e.type,e.value])),r=Date.UTC(Number(n.year),Number(n.month)-1,Number(n.day),Number(n.hour)%24,Number(n.minute)),i=Math.floor(t.getTime()/6e4)*6e4;return Math.round((r-i)/6e4/15)*15/60}function p(e){return Array.from({length:8},(t,n)=>(e+n*3)%24)}var m=(e,t)=>new Set([f(e,new Date(t,0,15,12)),f(e,new Date(t,6,15,12))]),h=(e,t)=>Math.floor(((e-t)%24+24)%24),g=e=>[...e].sort((e,t)=>e-t);function _(e,t,n=new Date().getFullYear()){let r=new Set;for(let i of m(t,n))for(let t of p(e))r.add(h(t,i));return g(r)}function v(e,t,n=new Date().getFullYear()){let r=new Set;for(let i of m(t,n))for(let t of[0,1])r.add(h(e+t,i));return g(r)}function y(e,t){return`# Creado por Productivity. A la hora elegida y luego cada 3 horas manda al iPhone el número de cosas del día.
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
const leerJSON = (ruta) => JSON.parse(fs.readFileSync(ruta, 'utf8'))
// Los datos van por partes en la carpeta datos/ (una por tabla y mes); los repositorios de antes, en un solo archivo.
let viejo = {}
try { viejo = leerJSON('productivity-datos.json') } catch {}
const tabla = (t) => {
  const carpeta = 'datos/' + t
  if (!fs.existsSync(carpeta)) return (viejo.datos || {})[t] || {}
  const out = {}
  for (const f of fs.readdirSync(carpeta)) if (f.endsWith('.json')) Object.assign(out, leerJSON(carpeta + '/' + f))
  return out
}
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
const lista = (t) => Object.values(tabla(t))
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

let titulo = total === 0 ? 'Hoy no tienes nada que hacer' : total === 1 ? 'Hoy tienes 1 cosa que hacer' : 'Hoy tienes ' + total + ' cosas que hacer'
let cuerpo = total === 0 ? 'El día es tuyo para elegir tus tres.' : textos[0] + (total > 1 ? ' y ' + (total - 1) + ' más' : '')

// Tarjetas de crédito: desde 5 días antes del pago y del cierre, el aviso lo dice («pagar en 4 días», «pasado
// mañana», «mañana», «hoy»); a un día o menos, el título dice «Urgente». Repite a propósito recordatoriosTarjeta
// (src/logica/finanzas.ts).
const tarjetas = recordatoriosTarjetas()
if (tarjetas.length) {
  const urgentes = tarjetas.filter((t) => t.urgente)
  if (urgentes.length) {
    cuerpo = tarjetas.map((t) => t.texto).join(' · ') + ' · ' + titulo
    titulo = urgentes.length === 1 ? 'Urgente: paga tu tarjeta «' + urgentes[0].nombre + '»' : 'Urgente: paga tus tarjetas de crédito'
  } else cuerpo = tarjetas.map((t) => t.texto).join(' · ') + ' · ' + cuerpo
}

function recordatoriosTarjetas() {
  const DIAS = 5
  const cuando = (n) => n === 0 ? 'hoy' : n === 1 ? 'mañana' : n === 2 ? 'pasado mañana' : n > 2 ? 'en ' + n + ' días' : n === -1 ? 'ayer' : 'hace ' + (-n) + ' días'
  const dinero = (c) => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const dosD = (n) => String(n).padStart(2, '0')
  const enMes = (y, m0, dia) => {
    const b = new Date(Date.UTC(y, m0, 1))
    const yy = b.getUTCFullYear()
    const mm = b.getUTCMonth()
    const ultimo = new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate()
    return yy + '-' + dosD(mm + 1) + '-' + dosD(Math.min(dia, ultimo))
  }
  const partes = (f) => f.split('-').map(Number)
  const proxima = (dia) => { const [y, m] = partes(hoy); const f = enMes(y, m - 1, dia); return f >= hoy ? f : enMes(y, m, dia) }
  const ultimoCierre = (dia) => { const [y, m] = partes(hoy); const f = enMes(y, m - 1, dia); return f <= hoy ? f : enMes(y, m - 2, dia) }
  const pagoDe = (dia, cierre) => { const [y, m] = partes(cierre); const f = enMes(y, m - 1, dia); return f > cierre ? f : enMes(y, m, dia) }
  const dias = (f) => Math.round((Date.parse(f + 'T00:00:00Z') - Date.parse(hoy + 'T00:00:00Z')) / 86400000)
  const efecto = (m, id) => {
    if (m.tipo === 'gasto') return m.cuentaId === id ? -m.monto : 0
    if (m.tipo === 'ingreso') return m.cuentaId === id ? m.monto : 0
    return (m.cuentaDestinoId === id ? m.monto : 0) - (m.cuentaId === id ? m.monto : 0)
  }
  const movs = lista('movimientos').filter((m) => m && !m.eliminadoEn)
  const out = []
  for (const c of lista('cuentas')) {
    if (!vivo(c) || c.tipo !== 'tarjeta' || !c.tarjeta) continue
    const t = c.tarjeta
    let saldo = c.saldoInicial || 0
    for (const m of movs) saldo += efecto(m, c.id)
    const deuda = Math.max(0, -saldo)
    const cierre = t.diaCierre ? ultimoCierre(t.diaCierre) : null
    const pago = t.diaPago ? (cierre ? pagoDe(t.diaPago, cierre) : proxima(t.diaPago)) : null
    const escrito = cierre && t.estado && t.estado.cierre === cierre ? t.estado : null
    let delEstado = null
    if (escrito && escrito.total != null) delEstado = escrito.total
    else if (cierre && cierre >= c.fechaInicial) {
      let s = c.saldoInicial || 0
      for (const m of movs) if (m.fecha <= cierre) s += efecto(m, c.id)
      delEstado = Math.max(0, -s)
    }
    let pagado = 0
    if (cierre) for (const m of movs) {
      if (m.fecha <= cierre || m.fecha > hoy) continue
      if (m.tipo === 'traspaso' && m.cuentaDestinoId === c.id) pagado += m.monto
      else if (m.tipo === 'ingreso' && m.cuentaId === c.id && !m.ajuste) pagado += m.monto
    }
    const falta = delEstado === null ? null : Math.min(deuda, Math.max(0, delEstado - pagado))
    const faltaMinimo = escrito && escrito.minimo != null ? Math.min(deuda, Math.max(0, escrito.minimo - pagado)) : null
    const porPagar = (falta || 0) > 0 || (faltaMinimo || 0) > 0 || (falta === null && deuda > 0)
    const partes = []
    let urgente = false
    if (pago && porPagar) {
      const n = dias(pago)
      if (n <= DIAS) {
        const monto = falta === null ? deuda : falta
        const que = n < 0 ? 'venció ' + cuando(n) : 'pagar ' + cuando(n)
        partes.push(faltaMinimo && faltaMinimo > 0 && faltaMinimo !== monto ? que + ', mínimo ' + dinero(faltaMinimo) + ', para no pagar intereses ' + dinero(monto) : que + ', ' + dinero(monto))
        if (n <= 1) urgente = true
      }
    }
    if (t.diaCierre && deuda > 0) {
      const n = dias(proxima(t.diaCierre))
      if (n <= DIAS) {
        partes.push('cierra ' + cuando(n) + ', debes ' + dinero(deuda))
        if (n <= 1) urgente = true
      }
    }
    if (partes.length) out.push({ nombre: c.nombre, urgente, texto: '«' + c.nombre + '»: ' + partes.join('; ') })
  }
  return out
}
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
`,x=e({activarAviso:()=>A,avisoActivoAqui:()=>T,avisoDisponible:()=>w,desactivarAviso:()=>j,revisarAviso:()=>M}),S=e=>btoa(String.fromCharCode(...e)).replace(/\+/g,`-`).replace(/\//g,`_`).replace(/=+$/,``),C=e=>Uint8Array.from(atob(e.replace(/-/g,`+`).replace(/_/g,`/`)+`===`.slice((e.length+3)%4)),e=>e.charCodeAt(0));function w(){return typeof window<`u`&&`serviceWorker`in navigator&&`PushManager`in window&&typeof Notification<`u`}function T(){return i()}async function E(){let e=await crypto.subtle.generateKey({name:`ECDSA`,namedCurve:`P-256`},!0,[`sign`,`verify`]),t=new Uint8Array(await crypto.subtle.exportKey(`raw`,e.publicKey)),n=(await crypto.subtle.exportKey(`jwk`,e.privateKey)).d;return{publico:S(t),privado:n}}async function D(e){let t=await s(e,d);if(!t)return{conf:null,sha:null};try{return{conf:JSON.parse(t.texto),sha:t.sha}}catch{return{conf:null,sha:t.sha}}}async function O(e,t,n,r){let i=await s(e,t);i?.texto!==n&&await a(e,t,n,i?.sha??null,r)}function k(e){return e instanceof c&&(e.codigo===`sin_permiso`||e.codigo===`no_encontrado`)?Error(`La llave necesita también el permiso «Workflows: Read and write». Añádeselo a la llave en GitHub (Settings → Developer settings → Fine-grained tokens → Productivity → Edit) y vuelve a tocar «Activar».`):e instanceof Error?e:Error(`No se pudo activar.`)}async function A(e){let i=n();if(!i)throw Error(`Primero conecta este aparato en Ajustes → Sincronizar.`);if(!w())throw Error(`Aquí no se puede. En el iPhone, abre la app desde su icono de la pantalla de inicio.`);if(Notification.permission!==`granted`&&await Notification.requestPermission()!==`granted`)throw Error(`El iPhone no dio el permiso. Ajustes del iPhone → Notificaciones → Productivity: activa «Permitir notificaciones» y «Globos».`);let s=Intl.DateTimeFormat().resolvedOptions().timeZone||`America/New_York`,c=new URL(`./`,location.href).href;try{await O(i,l,y(e,s),`Aviso diario: horario`),await O(i,u,b,`Aviso diario: script`)}catch(e){throw k(e)}let{conf:f,sha:p}=await D(i),m=f?.vapid??await E(),h=await navigator.serviceWorker.ready,g=await h.pushManager.getSubscription(),_=C(m.publico);g&&!(e=>{let t=e.options?.applicationServerKey;return!!t&&S(new Uint8Array(t))===m.publico})(g)&&(await g.unsubscribe().catch(()=>{}),g=null),g||=await h.pushManager.subscribe({userVisibleOnly:!0,applicationServerKey:_});let v=g.toJSON(),x={version:1,url:c,zona:s,hora:e,vapid:m,aparatos:{...f?.aparatos??{},[o()]:{endpoint:v.endpoint,keys:v.keys}}};await a(i,d,JSON.stringify(x,null,2)+`
`,p,`Aviso diario: ${o()}`),t({numeroEnIcono:!0}),await r({endpoint:v.endpoint,hora:e})}async function j(){let e=n();if(await(await(`serviceWorker`in navigator?await navigator.serviceWorker.ready:null)?.pushManager.getSubscription())?.unsubscribe().catch(()=>{}),e){let{conf:t,sha:n}=await D(e);t&&t.aparatos[o()]&&(delete t.aparatos[o()],await a(e,d,JSON.stringify(t,null,2)+`
`,n,`Aviso diario: sin ${o()}`))}await r(null)}async function M(){let e=n();if(!e)return;try{let{conf:t}=await D(e);t&&typeof t.hora==`number`&&t.zona&&(await O(e,u,b,`Aviso diario: script`),await O(e,l,y(t.hora,t.zona),`Aviso diario: horario`))}catch{}let t=i();if(t&&w())try{let e=await(await navigator.serviceWorker.ready).pushManager.getSubscription();if(e&&e.endpoint===t.endpoint||Notification.permission!==`granted`)return;await A(t.hora)}catch{}}export{j as a,x as i,T as n,p as o,w as r,A as t};