import { test, expect } from '@playwright/test';
import { extractJson } from '../../src/utils/extractJson';

test.describe('extractJson', () => {
  test('returns plain JSON unchanged', () => {
    const input = '{"pass": true, "reason": "test"}';
    expect(extractJson(input)).toBe('{"pass": true, "reason": "test"}');
  });

  test('strips ```json fence', () => {
    const input = '```json\n{"pass": true, "reason": "test"}\n```';
    expect(extractJson(input)).toBe('{"pass": true, "reason": "test"}');
  });

  test('strips ``` fence without language tag', () => {
    const input = '```\n{"pass": false}\n```';
    expect(extractJson(input)).toBe('{"pass": false}');
  });

  test('strips ```JSON fence (case insensitive)', () => {
    const input = '```JSON\n{"pass": true}\n```';
    expect(extractJson(input)).toBe('{"pass": true}');
  });

  test('handles whitespace around fenced JSON', () => {
    const input = '  ```json\n{"pass": true}\n```  ';
    expect(extractJson(input)).toBe('{"pass": true}');
  });

  test('does not strip partial fences', () => {
    const input = '```json\n{"pass": true}';
    expect(extractJson(input)).toBe('```json\n{"pass": true}');
  });

  test('handles empty string', () => {
    expect(extractJson('')).toBe('');
  });

  test('handles whitespace-only string', () => {
    expect(extractJson('   \n  ')).toBe('');
  });

  test('preserves multi-line JSON content', () => {
    const input = '```json\n{\n  "pass": true,\n  "reason": "multi-line"\n}\n```';
    expect(extractJson(input)).toBe('{\n  "pass": true,\n  "reason": "multi-line"\n}');
  });
});
