// Lightweight public endpoint to export reconcile CSV (bypasses tools router)
export const config = { runtime: 'nodejs' };

import { createClient } from '@supabase/supabase-js';

function need(k){ const v = process.env[k]; if(!v) throw new Error(`missing_env:${k}`); return v; }

export default async function handler(req, res){
  try{
    const supa = createClient(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'));

    const { data: mapRows, error: mapErr } = await supa
      .from('v_event_product_final_enhanced')
      .select('event_url,subtype,product_url,product_title,price_gbp,availability,date_start,date_end,start_time,end_time')
      .limit(5000);
    if (mapErr) return res.status(500).json({ error:'supabase_error', detail: mapErr.message });

    const { data: evRows, error: evErr } = await supa
      .from('v_events_for_chat')
      .select('event_url,date_start,date_end,start_time,end_time')
      .limit(5000);
    if (evErr) return res.status(500).json({ error:'supabase_error', detail: evErr.message });

    const evByUrl = new Map((evRows||[]).map(r => [r.event_url, r]));
    const header = [
      'event_url','subtype','product_url','product_title','price_gbp','availability',
      'export_date_start','export_date_end','export_start_time','export_end_time',
      'csv_date_start','csv_date_end','csv_start_time','csv_end_time',
      'date_mismatch','time_mismatch'
    ];
    const esc = v => { const s = v==null?'':String(v); return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; };
    const rows = (mapRows||[]).map(m => {
      const ev = evByUrl.get(m.event_url) || {};
      const dateMismatch = (String(m.date_start||'') !== String(ev.date_start||'')) || (String(m.date_end||'') !== String(ev.date_end||''));
      const timeMismatch = (String(m.start_time||'') !== String(ev.start_time||'')) || (String(m.end_time||'') !== String(ev.end_time||''));
      const r = [
        m.event_url, m.subtype, m.product_url, m.product_title, m.price_gbp, m.availability,
        m.date_start, m.date_end, m.start_time, m.end_time,
        ev.date_start||'', ev.date_end||'', ev.start_time||'', ev.end_time||'',
        dateMismatch ? '1':'0', timeMismatch ? '1':'0'
      ];
      return r.map(esc).join(',');
    });
    const csv = [header.join(',')].concat(rows).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="reconcile-event-mapping.csv"');
    return res.status(200).send(csv);
  }catch(e){
    return res.status(500).json({ error:'server_error', detail: String(e?.message||e) });
  }
}


