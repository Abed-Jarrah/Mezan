const MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8';
const MAX_QUESTIONS = 5;
const WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_QUESTION_LENGTH = 300;
const MAX_CONTEXT_LENGTH = 1500;

const SYSTEM_PROMPT = {
  ar: 'أنت مساعد داخل تطبيق ميزان لإدارة الموازنة الشخصية. تجاوب فقط عن أسئلة المستخدم المتعلقة ببياناته المالية المرفقة أدناه: الدخل، المصاريف، الميزانيات، وأهداف التوفير. إذا سأل عن أي موضوع آخر، اعتذر بأدب واطلب منه السؤال عن وضعه المالي داخل ميزان فقط. كن مختصراً ومباشراً وودوداً، وأجب بالعربية.',
  en: 'You are an assistant inside Mezan, a personal budgeting app. Only answer questions about the user financial data provided below: income, expenses, budgets, and savings goals. If asked about anything else, politely decline and ask them to ask about their finances in Mezan only. Be concise, direct, and friendly. Answer in English.'
};

const LIMIT_MESSAGE = {
  ar: 'وصلت للحد الأقصى من الأسئلة المجانية لهذا اليوم: 5 أسئلة كل 24 ساعة. يمكنك المحاولة لاحقاً.',
  en: 'You have reached the free daily limit: 5 questions every 24 hours. Please try again later.'
};

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

function jsonResponse(request, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request) }
  });
}

async function readRateLimit(kv, userId) {
  const now = Date.now();
  const raw = await kv.get(userId);
  const record = raw ? JSON.parse(raw) : null;
  if (!record || now - record.firstQuestionAt > WINDOW_MS) {
    return { allowed: true, record: { count: 0, firstQuestionAt: now } };
  }
  return { allowed: record.count < MAX_QUESTIONS, record };
}

async function incrementRateLimit(kv, userId, record) {
  await kv.put(userId, JSON.stringify({
    count: record.count + 1,
    firstQuestionAt: record.firstQuestionAt
  }), { expirationTtl: 90000 });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(request) });
    }
    if (request.method !== 'POST') {
      return jsonResponse(request, { error: 'method_not_allowed' }, 405);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse(request, { error: 'invalid_json' }, 400);
    }

    const userId = typeof payload.userId === 'string' ? payload.userId.slice(0, 64) : '';
    const question = typeof payload.question === 'string' ? payload.question.trim().slice(0, MAX_QUESTION_LENGTH) : '';
    const financialContext = typeof payload.financialContext === 'string' ? payload.financialContext.slice(0, MAX_CONTEXT_LENGTH) : '';
    const lang = payload.lang === 'en' ? 'en' : 'ar';

    if (!env.AI || !env.RATE_LIMIT) {
      return jsonResponse(request, { error: 'worker_not_configured' }, 500);
    }
    if (!userId || !question) {
      return jsonResponse(request, { error: 'missing_fields' }, 400);
    }

    const rateLimit = await readRateLimit(env.RATE_LIMIT, userId);
    if (!rateLimit.allowed) {
      return jsonResponse(request, { message: LIMIT_MESSAGE[lang] }, 429);
    }

    try {
      const result = await env.AI.run(MODEL, {
        messages: [
          { role: 'system', content: SYSTEM_PROMPT[lang] },
          { role: 'user', content: `${financialContext}\n\n${question}` }
        ]
      });
      await incrementRateLimit(env.RATE_LIMIT, userId, rateLimit.record);
      return jsonResponse(request, { answer: result.response || '' });
    } catch {
      return jsonResponse(request, { error: 'ai_error' }, 502);
    }
  }
};
