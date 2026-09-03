// api/lotes-disponibles.js
// GET /api/lotes-disponibles            -> todos los lotes con su estado real
// GET /api/lotes-disponibles?mz=A       -> solo la manzana A

const LOTES = require('./lotes.json');

const KV_URL = process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function getTodosLosEstados() {
  if (!KV_URL || !KV_TOKEN) return {};
  try {
    // MGET de todas las claves estado:XX en una sola llamada
    const keys = LOTES.map(l => `estado:${l.lote}`);
    const res = await fetch(`${KV_URL}/mget/${keys.join('/')}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || !data.result) return {};
    const map = {};
    LOTES.forEach((l, i) => { map[l.lote] = data.result[i]; });
    return map;
  } catch (e) {
    return {}; // si algo falla, mostramos los estados de fábrica en vez de caernos
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { mz } = req.query;

  const estados = await getTodosLosEstados();
  let data = LOTES.map(l => ({ ...l, estado: estados[l.lote] || l.estado || 'disponible' }));
  if (mz) data = data.filter(l => l.mz.toUpperCase() === mz.toUpperCase());

  res.status(200).json({ total: data.length, lotes: data });
};
