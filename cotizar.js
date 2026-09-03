// api/cotizar.js
// GET /api/cotizar?lote=A1&pago=financiado&inicial=15000&meses=24

const LOTES = require('./lotes.json');

const BONO_FINANCIAMIENTO = 5000;
const INICIAL_MINIMA = 10000;
const MESES_DEFECTO = 36;

// --- Conexión a la base de datos (Upstash Redis, gratis) ---
// Estas dos variables las configuras en Vercel (ver README-DESPLIEGUE.md).
// Si no están configuradas, la API sigue funcionando pero usando el estado
// "de fábrica" (todo disponible) en vez del estado real y compartido.
const KV_URL = process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function getEstadoGuardado(loteCode) {
  if (!KV_URL || !KV_TOKEN) return null;
  const res = await fetch(`${KV_URL}/get/estado:${loteCode}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` }
  });
  const data = await res.json();
  return data.result; // null si nunca se guardó nada para ese lote
}

function cotizarBase(loteCode) {
  return LOTES.find(l => l.lote.toUpperCase() === String(loteCode).toUpperCase());
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { lote, pago = 'contado', inicial = INICIAL_MINIMA, meses = MESES_DEFECTO } = req.query;

  if (!lote) {
    res.status(400).json({ error: 'Falta el parámetro "lote", ej: ?lote=A1' });
    return;
  }

  const base = cotizarBase(lote);
  if (!base) {
    res.status(404).json({ error: `Lote "${lote}" no existe` });
    return;
  }

  const estadoGuardado = await getEstadoGuardado(base.lote);
  const estado = estadoGuardado || base.estado || 'disponible';

  if (estado === 'vendido') {
    res.status(409).json({ error: `Lote "${lote}" ya fue vendido`, estado });
    return;
  }

  const financiado = base.contado + BONO_FINANCIAMIENTO;

  if (pago === 'contado') {
    res.status(200).json({
      lote: base.lote, mz: base.mz, area: base.area, ubicacion: base.ubicacion, estado,
      tipo_pago: 'contado', precio: base.contado
    });
    return;
  }

  const inicialNum = Math.max(INICIAL_MINIMA, Number(inicial) || INICIAL_MINIMA);
  const mesesNum = Math.max(1, Number(meses) || MESES_DEFECTO);
  const saldo = financiado - inicialNum;
  const cuota = saldo / mesesNum;

  res.status(200).json({
    lote: base.lote, mz: base.mz, area: base.area, ubicacion: base.ubicacion, estado,
    tipo_pago: 'financiado', precio_financiado: financiado,
    inicial: inicialNum, saldo, meses: mesesNum, cuota_mensual: Math.round(cuota * 100) / 100
  });
};
