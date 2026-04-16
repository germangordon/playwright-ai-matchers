import type { EvalResult } from './providers/base';

export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly model?: string,
    public readonly raw?: unknown,
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

export function formatMatcherMessage(args: {
  header: string;
  received: string;
  result: EvalResult;
}): string {
  const { header, received, result } = args;
  const lines = [
    header,
    `Model:     ${result.model} (effort: ${result.effort})`,
    `Reason:    ${result.reason}`,
  ];
  if (result.reasoning && result.reasoning.trim().length > 0) {
    lines.push(`Reasoning: ${truncate(result.reasoning, 400)}`);
  }
  lines.push(`Received:  ${received}`);
  return lines.join('\n');
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}
