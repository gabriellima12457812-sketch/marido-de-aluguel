// Vercel Serverless Function: /api/notify
// Disparo silencioso detalhado em segundo plano para o WhatsApp de Controle (5547999158919)

const DEFAULT_EVO_URL = process.env.EVOLUTION_API_URL || 'https://piffpaff-evolution-api.onrender.com';
const DEFAULT_EVO_KEY = process.env.EVOLUTION_API_KEY || 'PiffPaffEvoSecretKey2026!';
const DEFAULT_EVO_INSTANCE = process.env.EVOLUTION_INSTANCE || 'gabriel';
const DEFAULT_ADMIN_PHONE = '5547999158919';

function formatDirectWaLink(rawPhone) {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  if (!digits || digits.length < 10) return null;
  const withCountry = digits.startsWith('55') && digits.length >= 12 ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const adminPhone = String(body.adminPhone || DEFAULT_ADMIN_PHONE).replace(/\D/g, '') || DEFAULT_ADMIN_PHONE;
    const ticketId = body.ticketId || '#TCK-00000';
    const serviceName = body.serviceName || 'Serviço Geral';
    const clientName = body.clientName || 'Não informado';
    const clientPhone = body.clientPhone || 'Não informado';
    const clientWaLink = formatDirectWaLink(clientPhone);
    const propertyType = body.propertyType || 'Não informado';
    const location = body.location || 'Não informado';
    const address = body.address || '';
    const technicalDetails = Array.isArray(body.technicalDetails) ? body.technicalDetails : [];
    const selectedItems = Array.isArray(body.selectedItems) ? body.selectedItems : [];
    const notes = body.notes || '';
    const summaryText = body.summaryText || '';
    const customWebhook = body.customWebhook || '';
    const originUrl = body.originUrl || 'https://marido-de-aluguel-seven.vercel.app/';
    const timestamp = body.timestamp || new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    let controlMessage =
      `🔔 *RECIBO SILENCIOSO DE INDICAÇÃO — PIF PAF CONNECT*\n` +
      `🎫 *Ticket:* *${ticketId}*\n` +
      `🕒 *Data/Hora:* ${timestamp}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 *DADOS DO CLIENTE SOLICITANTE*\n` +
      `• *Nome:* *${clientName}*\n` +
      `• *Telefone / WhatsApp:* *${clientPhone}*\n`;

    if (clientWaLink) {
      controlMessage += `• *Chamar Cliente Direto:* ${clientWaLink}\n`;
    }

    controlMessage +=
      `• *Tipo de Imóvel:* ${propertyType}\n` +
      `• *Bairro / Cidade:* ${location}\n`;

    if (address) {
      controlMessage += `• *Endereço / Compl.:* ${address}\n`;
    }

    controlMessage +=
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🛠️ *DETALHAMENTO DO SERVIÇO SOLICITADO*\n` +
      `• *Especialidade:* ${serviceName}\n`;

    if (technicalDetails.length > 0) {
      for (const item of technicalDetails) {
        if (item && item.label) {
          controlMessage += `• *${item.label}:* ${item.value}\n`;
        }
      }
    }

    if (selectedItems.length > 0) {
      controlMessage += `\n📋 *Itens Marcados pelo Cliente (${selectedItems.length}):*\n`;
      selectedItems.forEach((srv, idx) => {
        controlMessage += `  ${idx + 1}. ${srv}\n`;
      });
    }

    if (notes) {
      controlMessage += `\n📝 *Descrição / Observações do Cliente:*\n"${notes}"\n`;
    }

    controlMessage +=
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📲 *RASTREIO DO REDIRECIONAMENTO*\n` +
      `• *Encaminhado para (Lalá):* +${body.lalaPhone || '5547999582239'}\n` +
      `• *Link de Origem:* ${originUrl}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📄 *Cópia Integral do Ticket Gerado:*\n${summaryText}`;

    const results = { evolution: null, customWebhook: null };

    // 1. Disparo silencioso via Evolution API para o número de controle (5547999158919)
    try {
      const evoResp = await fetch(`${DEFAULT_EVO_URL}/message/sendText/${DEFAULT_EVO_INSTANCE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: DEFAULT_EVO_KEY
        },
        body: JSON.stringify({
          number: adminPhone,
          text: controlMessage
        })
      });
      results.evolution = { status: evoResp.status, ok: evoResp.ok };
    } catch (evoErr) {
      results.evolution = { ok: false, error: evoErr.message };
    }

    // 2. Se o usuário configurou um Webhook externo adicional, encaminha também
    if (customWebhook && /^https?:\/\//i.test(customWebhook) && !customWebhook.includes('/api/notify')) {
      try {
        const whResp = await fetch(customWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...body,
            adminPhone,
            clientWaLink,
            controlMessage,
            sentAt: new Date().toISOString()
          })
        });
        results.customWebhook = { status: whResp.status, ok: whResp.ok };
      } catch (whErr) {
        results.customWebhook = { ok: false, error: whErr.message };
      }
    }

    return res.status(200).json({ ok: true, ticketId, results });
  } catch (err) {
    return res.status(200).json({ ok: false, error: err.message });
  }
}
