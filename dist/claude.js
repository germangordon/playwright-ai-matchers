"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.evalMeansSomethingAbout = evalMeansSomethingAbout;
exports.evalSatisfies = evalSatisfies;
exports.evalHallucinates = evalHallucinates;
exports.evalIsHelpful = evalIsHelpful;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const MODEL = 'claude-haiku-4-5-20251001';
let _client = null;
function getClient() {
    if (!_client) {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            throw new Error('playwright-ai-matchers: ANTHROPIC_API_KEY environment variable is not set.');
        }
        _client = new sdk_1.default({ apiKey });
    }
    return _client;
}
async function callClaude(prompt) {
    const response = await getClient().messages.create({
        model: MODEL,
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('');
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error(`playwright-ai-matchers: Claude did not return valid JSON.\nResponse was: ${text}`);
    }
    const result = JSON.parse(jsonMatch[0]);
    if (typeof result !== 'object' ||
        result === null ||
        typeof result.pass !== 'boolean' ||
        typeof result.reason !== 'string') {
        throw new Error(`playwright-ai-matchers: Claude returned unexpected JSON structure: ${jsonMatch[0]}`);
    }
    return result;
}
async function evalMeansSomethingAbout(response, topic) {
    return callClaude(`You are evaluating whether an AI response meaningfully relates to a given topic.

AI Response:
"""
${response}
"""

Topic: "${topic}"

Does the AI response meaningfully relate to, discuss, or address this topic?

Respond with ONLY a JSON object — no extra text, no markdown — in this exact format:
{"pass": true, "reason": "brief explanation"}
or
{"pass": false, "reason": "brief explanation"}`);
}
async function evalSatisfies(response, criterion) {
    return callClaude(`You are evaluating whether an AI response satisfies a plain-language criterion.

AI Response:
"""
${response}
"""

Criterion: "${criterion}"

Does the AI response satisfy this criterion?

Respond with ONLY a JSON object — no extra text, no markdown — in this exact format:
{"pass": true, "reason": "brief explanation"}
or
{"pass": false, "reason": "brief explanation"}`);
}
async function evalHallucinates(response, context) {
    return callClaude(`You are evaluating whether an AI response invents or hallucinates facts not present in the provided context.

Context (the only ground truth):
"""
${context}
"""

AI Response:
"""
${response}
"""

Does the AI response assert specific facts, prices, names, or claims that are NOT present in or directly supported by the context? Ignore general background knowledge — focus on specific assertions that contradict or go beyond the provided context.

Respond with ONLY a JSON object — no extra text, no markdown — in this exact format:
{"pass": true, "reason": "describe what was hallucinated"}
or
{"pass": false, "reason": "explain why no hallucination was detected"}`);
}
async function evalIsHelpful(response) {
    return callClaude(`You are evaluating whether an AI response is genuinely helpful.

AI Response:
"""
${response}
"""

Is this response genuinely helpful — meaning it provides useful information, answers the question, solves the problem, or meaningfully assists the user? A response that is an error message, a flat refusal, an empty reply, or an irrelevant non-answer is NOT helpful.

Respond with ONLY a JSON object — no extra text, no markdown — in this exact format:
{"pass": true, "reason": "brief explanation"}
or
{"pass": false, "reason": "brief explanation"}`);
}
//# sourceMappingURL=claude.js.map