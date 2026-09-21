import { bitable } from '@lark-base-open/js-sdk';

const L = window.L;
const FIELD = {
  uf: 'uf_destino', receita: 'receita', pedidos: 'pedidos', pedidos5kg: 'Pedidos_5kg',
  ano: 'ano', mes: 'mes', executivo: 'executivo', time: 'time'
};
const REQUIRED = [FIELD.uf, FIELD.receita, FIELD.pedidos];
const GEOJSON_URLS = [
  './estados.geojson',
  'https://raw.githubusercontent.com/henriquemalvar/br-geojson/main/dist/estados.geojson',
  'https://cdn.jsdelivr.net/gh/henriquemalvar/br-geojson@main/dist/estados.geojson'
];
const state = { rows: [], metric: 'ticket', filters: { ano:'', mes:'', executivo:'', time:'' }, map:null, layer:null, geojson:null };

const app = document.querySelector('#app');
app.innerHTML = `<main>
<header><div><h1>Mapa Comercial Brasil <small style="font-size:12px;color:#2563eb">V5</small></h1><p>Indicadores consolidados por UF</p></div><button id="reload">Atualizar dados</button></header>
<section class="controls">
<label>Indicador<select id="metric"><option value="ticket">Ticket Médio</option><option value="receita">Receita</option><option value="pedidos">Pedidos</option><option value="pedidos5kg">Pedidos 5kg</option></select></label>
<label>Ano<select id="ano"><option value="">Todos</option></select></label>
<label>Mês<select id="mes"><option value="">Todos</option></select></label>
<label>Executivo<select id="executivo"><option value="">Todos</option></select></label>
<label>Time<select id="time"><option value="">Todos</option></select></label>
</section>
<section class="cards"><div><span>Ticket médio</span><strong id="kpiTicket">—</strong></div><div><span>Receita</span><strong id="kpiReceita">—</strong></div><div><span>Pedidos</span><strong id="kpiPedidos">—</strong></div><div><span>UFs com dados</span><strong id="kpiUfs">—</strong></div></section>
<div id="status">Carregando dados do Feishu…</div><div id="mapWrap"><div id="map"></div><div id="legend"></div></div></main>`;

const num = v => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  if (typeof v === 'object' && 'value' in v) return num(v.value);
  let s = String(v).trim().replace(/[^0-9,.-]/g, '');
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g,'').replace(',','.') : s.replace(/,/g,'');
  else if (s.includes(',')) s = s.replace(',','.');
  const n = Number(s); return Number.isFinite(n) ? n : 0;
};
const text = v => {
  if (Array.isArray(v)) return v.map(text).filter(Boolean).join(', ');
  if (v && typeof v === 'object') return String(v.text ?? v.name ?? v.value ?? '');
  return v == null ? '' : String(v);
};
const brl = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);
const integer = v => new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(v||0);
const diagLines = [];
function diag(label, value='') {
  let out;
  try { out = typeof value === 'string' ? value : JSON.stringify(value, (k,v)=> typeof v === 'function' ? '[function]' : v, 2); }
  catch { out = String(value); }
  diagLines.push(`${label}: ${out}`);
  const el = document.querySelector('#diag'); if (el) el.textContent = diagLines.join('\n');
}
function errText(e){ return `${e?.name||'Error'}: ${e?.message||String(e)}`; }

async function getAllRecords(table) {
  // Prefer the SDK's record list; fall back to IDs + getRecord when necessary.
  if (typeof table.getRecords === 'function') {
    const first = await table.getRecords({ pageSize: 5000 });
    if (Array.isArray(first?.records)) {
      const out = [...first.records];
      let token = first.pageToken;
      while (first.hasMore && token) {
        const page = await table.getRecords({ pageSize: 5000, pageToken: token });
        out.push(...(page.records || []));
        if (!page.hasMore || !page.pageToken || page.pageToken === token) break;
        token = page.pageToken;
      }
      return out;
    }
  }
  const ids = await table.getRecordIdList();
  return Promise.all(ids.map(id => table.getRecordById ? table.getRecordById(id) : table.getRecord(id)));
}

async function loadRows() {
  diagLines.length = 0;
  setStatus('Carregando dados do Feishu…');
  diag('Versão', 'V5');
  diag('SDK bitable', !!bitable);
  diag('base disponível', !!bitable?.base);
  let table = null;
  let selection = null;

  try {
    selection = await bitable.base.getSelection();
    diag('getSelection()', selection);
  } catch (e) { diag('getSelection() ERRO', errText(e)); }

  try {
    if (typeof bitable.base.getActiveTable === 'function') {
      table = await bitable.base.getActiveTable();
      diag('getActiveTable()', table ? 'objeto de tabela retornado' : 'null/undefined');
    } else diag('getActiveTable()', 'método indisponível');
  } catch (e) { diag('getActiveTable() ERRO', errText(e)); }

  // Importante: só usa getTableById se o tableId realmente existir.
  if (!table && selection?.tableId) {
    try {
      table = await bitable.base.getTableById(selection.tableId);
      diag('getTableById(selection.tableId)', 'OK');
    } catch (e) { diag('getTableById(selection.tableId) ERRO', errText(e)); }
  }

  // Enumera as tabelas para diagnosticar o contexto e, se possível, localizar pelos campos.
  try {
    if (typeof bitable.base.getTableMetaList === 'function') {
      const tables = await bitable.base.getTableMetaList();
      diag('getTableMetaList()', (tables || []).map(t => ({id:t.id, name:t.name})));
      if (!table) {
        for (const meta of tables || []) {
          try {
            const candidate = await bitable.base.getTableById(meta.id);
            const candidateFields = await candidate.getFieldMetaList();
            const names = candidateFields.map(f => f.name);
            diag(`Campos tabela ${meta.name || meta.id}`, names);
            if (REQUIRED.every(name => names.includes(name))) { table = candidate; diag('Tabela escolhida por campos', meta.name || meta.id); break; }
          } catch (e) { diag(`Tabela ${meta.name || meta.id} ERRO`, errText(e)); }
        }
      }
    } else diag('getTableMetaList()', 'método indisponível');
  } catch (e) { diag('getTableMetaList() ERRO', errText(e)); }

  if (!table) throw new Error('Não consegui identificar a tabela do Base. Abra a tabela com os campos uf_destino, receita e pedidos e clique em Atualizar dados.');

  diag('Tabela resolvida', 'SIM');
  const metas = await table.getFieldMetaList();
  diag('Campos da tabela resolvida', metas.map(m=>({name:m.name,id:m.id,type:m.type})));
  const byName = Object.fromEntries(metas.map(m => [m.name, m.id]));
  const missing = REQUIRED.filter(n => !byName[n]);
  if (missing.length) throw new Error(`Campos obrigatórios não encontrados: ${missing.join(', ')}`);
  const records = await getAllRecords(table);
  diag('Registros retornados', records.length);
  state.rows = records.map(r => {
    const f = r.fields || r.record?.fields || {};
    const value = name => byName[name] ? f[byName[name]] : '';
    return {
      uf: text(value(FIELD.uf)).trim().toUpperCase(), receita: num(value(FIELD.receita)), pedidos: num(value(FIELD.pedidos)),
      pedidos5kg: num(value(FIELD.pedidos5kg)), ano: text(value(FIELD.ano)), mes: text(value(FIELD.mes)),
      executivo: text(value(FIELD.executivo)), time: text(value(FIELD.time))
    };
  }).filter(r => /^[A-Z]{2}$/.test(r.uf));
  fillFilters(); await render(); setStatus(`${state.rows.length} registros carregados`);
}

function setStatus(s){ document.querySelector('#status').textContent = s; }
function fillFilters(){ ['ano','mes','executivo','time'].forEach(k=>{ const el=document.querySelector('#'+k), old=el.value; const values=[...new Set(state.rows.map(r=>r[k]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'pt-BR',{numeric:true})); el.innerHTML='<option value="">Todos</option>'+values.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join(''); el.value=values.includes(old)?old:''; state.filters[k]=el.value; }); }
function escapeHtml(v){ return String(v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function filtered(){ return state.rows.filter(r=>Object.entries(state.filters).every(([k,v])=>!v||r[k]===v)); }
function aggregate(){ const out={}; for(const r of filtered()){ const x=out[r.uf]??={uf:r.uf,receita:0,pedidos:0,pedidos5kg:0}; x.receita+=r.receita; x.pedidos+=r.pedidos; x.pedidos5kg+=r.pedidos5kg; } for(const x of Object.values(out)) x.ticket=x.pedidos?x.receita/x.pedidos:0; return out; }
function metricValue(x){ return x?.[state.metric] ?? 0; }
function color(v,min,max){ if(!v) return '#e5e7eb'; const t=max===min?0.65:(v-min)/(max-min); return `hsl(213 85% ${90-(t*48)}%)`; }
function featureUf(f){ return String(f.properties?.sigla ?? f.properties?.UF ?? f.properties?.uf ?? f.properties?.id ?? '').toUpperCase(); }
async function loadGeoJson(){
  let lastError = null;
  for (const url of GEOJSON_URLS) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features) || data.features.length < 27) throw new Error('GeoJSON inválido/incompleto');
      return data;
    } catch (e) { lastError = e; console.warn('Falha ao carregar mapa:', url, e); }
  }
  throw new Error('Não foi possível carregar os limites das UFs. ' + (lastError?.message || ''));
}
async function ensureMap(){
  if(state.map && state.geojson) return;
  if(!L) throw new Error('Leaflet não foi carregado.');
  if(!state.map) state.map=L.map('map',{zoomControl:true,attributionControl:false,minZoom:3,maxZoom:8,scrollWheelZoom:true}).setView([-14.5,-52.5],4);
  state.geojson = await loadGeoJson();
  setTimeout(()=>state.map.invalidateSize(), 50);
}
function updateLegend(min,max){
  const el=document.querySelector('#legend'); if(!el) return;
  const label={ticket:'Ticket Médio',receita:'Receita',pedidos:'Pedidos',pedidos5kg:'Pedidos 5kg'}[state.metric];
  const fmt=v=>state.metric==='ticket'||state.metric==='receita'?brl(v):integer(v);
  el.innerHTML=`<b>${label}</b><div class="legendScale"></div><div class="legendLabels"><span>${fmt(min)}</span><span>${fmt(max)}</span></div>`;
}

async function render(){
  const agg=aggregate(), vals=Object.values(agg).map(metricValue).filter(v=>v>0); const min=vals.length?Math.min(...vals):0, max=vals.length?Math.max(...vals):0;
  const totals=Object.values(agg).reduce((a,x)=>({receita:a.receita+x.receita,pedidos:a.pedidos+x.pedidos}),{receita:0,pedidos:0});
  document.querySelector('#kpiTicket').textContent=brl(totals.pedidos?totals.receita/totals.pedidos:0); document.querySelector('#kpiReceita').textContent=brl(totals.receita); document.querySelector('#kpiPedidos').textContent=integer(totals.pedidos); document.querySelector('#kpiUfs').textContent=Object.keys(agg).length;
  await ensureMap(); if(state.layer) state.layer.remove();
  state.layer=L.geoJSON(state.geojson,{style:f=>{const v=metricValue(agg[featureUf(f)]);return{fillColor:color(v,min,max),weight:1,color:'#fff',fillOpacity:.92};},onEachFeature:(f,l)=>{const uf=featureUf(f),x=agg[uf]||{receita:0,pedidos:0,pedidos5kg:0,ticket:0},name=f.properties?.nome||f.properties?.name||uf; l.bindTooltip(`<b>${escapeHtml(name)} (${escapeHtml(uf)})</b><br>Ticket médio: ${brl(x.ticket)}<br>Receita: ${brl(x.receita)}<br>Pedidos: ${integer(x.pedidos)}<br>Pedidos 5kg: ${integer(x.pedidos5kg)}`,{sticky:true}); l.on({mouseover:e=>e.target.setStyle({weight:2,color:'#111827'}),mouseout:e=>state.layer.resetStyle(e.target)});}}).addTo(state.map);
  if(state.layer.getBounds().isValid()) { state.map.invalidateSize(); state.map.fitBounds(state.layer.getBounds(),{padding:[18,18]}); } updateLegend(min,max);
}

document.querySelector('#metric').addEventListener('change',e=>{state.metric=e.target.value;render().catch(showError);});
['ano','mes','executivo','time'].forEach(k=>document.querySelector('#'+k).addEventListener('change',e=>{state.filters[k]=e.target.value;render().catch(showError);}));
document.querySelector('#reload').addEventListener('click',()=>loadRows().catch(showError));
function showError(e){ console.error(e); setStatus('Erro: '+(e?.message||e)); }
loadRows().catch(showError);
