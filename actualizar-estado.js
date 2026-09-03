// api/actualizar-estado.js
// POST /api/actualizar-estado   body: { "lote": "A1", "estado": "vendido" }
// Estados válidos: disponible | preferencial | separado | vendido
//
// Este es el endpoint que usan los dispositivos de venta (celular, tablet,
// laptop) para marcar un lote. Al guardar en Upstash Redis, el cambio queda
// visible de inmediato para CUALQUIER otro dispositivo que consulte
// /api/cotizar o /api/lotes-disponibles — eso es lo que sincroniza a tu
// equipo de ventas entre sí.

const LOTES = require('./lotes.json');

const ESTADOS_VALIDOS = ['disponible', 'preferencial', 'separado', 'vendido'];
const KV_URL = process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Usa POST con { lote, estado }' });
    return;
  }
  if (!KV_URL || !KV_TOKEN) {
    res.status(500).json({ error: 'La base de datos no está configurada. Revisa las variables de entorno UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN en Vercel.' });
    return;
  }

  const { lote, estado } = req.body || {};
  if (!lote || !estado) {
    res.status(400).json({ error: 'Faltan campos: "lote" y "estado" son requeridos' });
    return;
  }
  if (!ESTADOS_VALIDOS.includes(estado)) {
    res.status(400).json({ error: `Estado inválido. Usa uno de: ${ESTADOS_VALIDOS.join(', ')}` });
    return;
  }
  const item = LOTES.find(l => l.lote.toUpperCase() === String(lote).toUpperCase());
  if (!item) {
    res.status(404).json({ error: `Lote "${lote}" no existe` });
    return;
  }

  await fetch(`${KV_URL}/set/estado:${item.lote}/${estado}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` }
  });

  res.status(200).json({ ok: true, lote: item.lote, estado_nuevo: estado });
};
