// Keep this below Cloudflare's 10,000-neuron free-tier cap to leave operational headroom.
export const DAILY_NEURON_BUDGET = 9_000;
// Per-user fairness ceiling (agreed clamp). The global DAILY_NEURON_BUDGET stays the
// authoritative hard cap; this just stops one user draining the shared pool. Dynamic
// per-user = budget/activeUsers division is a later step; with few users it clamps to this.
export const PER_USER_DAILY_QUESTIONS = 30;
export const MAX_IP_QUESTIONS = 60;
export const MAX_QUESTION_LENGTH = 300;
export const MAX_CONTEXT_LENGTH = 1_500;
export const MAX_HISTORY_MESSAGES = 6;
export const MAX_HISTORY_CHARS = 1_500;
export const MAX_OUTPUT_TOKENS = 512;

// Conservative accounting inputs. The system allowance includes message framing overhead.
export const MAX_SYSTEM_PROMPT_CHARS = 1_200;
export const CONSERVATIVE_CHARS_PER_TOKEN = 3;
export const MAX_INPUT_TOKENS = Math.ceil(
  (MAX_QUESTION_LENGTH + MAX_CONTEXT_LENGTH + MAX_SYSTEM_PROMPT_CHARS + MAX_HISTORY_CHARS) / CONSERVATIVE_CHARS_PER_TOKEN
);

// Cloudflare Workers AI published rates for llama-3.1-8b-instruct-fp8, per 1M tokens.
export const INPUT_NEURONS_PER_MILLION_TOKENS = 13_778;
export const OUTPUT_NEURONS_PER_MILLION_TOKENS = 26_128;

export function worstCaseNeurons(maxInputTokens = MAX_INPUT_TOKENS, maxOutputTokens = MAX_OUTPUT_TOKENS) {
  return Math.ceil((maxInputTokens / 1_000_000) * INPUT_NEURONS_PER_MILLION_TOKENS) +
    Math.ceil((maxOutputTokens / 1_000_000) * OUTPUT_NEURONS_PER_MILLION_TOKENS);
}

export const WORST_CASE_NEURONS = worstCaseNeurons();
// Per-user neuron allowance derived from the question ceiling; global budget stays authoritative.
export const PER_USER_DAILY_NEURON_BUDGET = PER_USER_DAILY_QUESTIONS * WORST_CASE_NEURONS;
