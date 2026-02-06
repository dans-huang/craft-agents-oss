import { describe, it, expect } from 'bun:test';
import { buildZendeskSystemPrompt } from '../system-prompt.ts';

describe('buildZendeskSystemPrompt', () => {
  it('includes ticket context', () => {
    const prompt = buildZendeskSystemPrompt({
      ticketId: 12345,
      subject: 'Spark 40 not turning on',
      customerName: 'John',
      productTags: ['spark', 'amp'],
      conversationHistory: 'Customer: My Spark 40 won\'t turn on...',
    });
    expect(prompt).toContain('12345');
    expect(prompt).toContain('Spark 40 not turning on');
    expect(prompt).toContain('John');
  });

  it('includes phase instructions', () => {
    const prompt = buildZendeskSystemPrompt({
      ticketId: 1,
      subject: 'test',
      customerName: 'test',
      productTags: [],
      conversationHistory: '',
    });
    expect(prompt).toContain('Phase 1: Intake');
    expect(prompt).toContain('Phase 2: Diagnostic');
    expect(prompt).toContain('Phase 3: Resolution');
  });

  it('joins product tags with comma separator', () => {
    const prompt = buildZendeskSystemPrompt({
      ticketId: 1,
      subject: 'test',
      customerName: 'test',
      productTags: ['spark', 'amp', 'firmware'],
      conversationHistory: '',
    });
    expect(prompt).toContain('spark, amp, firmware');
  });

  it('shows "none" when product tags are empty', () => {
    const prompt = buildZendeskSystemPrompt({
      ticketId: 1,
      subject: 'test',
      customerName: 'test',
      productTags: [],
      conversationHistory: '',
    });
    expect(prompt).toContain('none');
  });

  it('shows fallback when conversation history is empty', () => {
    const prompt = buildZendeskSystemPrompt({
      ticketId: 1,
      subject: 'test',
      customerName: 'test',
      productTags: [],
      conversationHistory: '',
    });
    expect(prompt).toContain('(No prior messages)');
  });

  it('includes conversation history when provided', () => {
    const history = 'Customer: Help me please\nAgent: Sure, what is the issue?';
    const prompt = buildZendeskSystemPrompt({
      ticketId: 1,
      subject: 'test',
      customerName: 'test',
      productTags: [],
      conversationHistory: history,
    });
    expect(prompt).toContain(history);
  });

  it('includes loaded skills when provided', () => {
    const prompt = buildZendeskSystemPrompt({
      ticketId: 1,
      subject: 'test',
      customerName: 'test',
      productTags: [],
      conversationHistory: '',
      skills: ['Skill A content', 'Skill B content'],
    });
    expect(prompt).toContain('Loaded Skills');
    expect(prompt).toContain('Skill A content');
    expect(prompt).toContain('Skill B content');
  });

  it('omits skills section when no skills provided', () => {
    const prompt = buildZendeskSystemPrompt({
      ticketId: 1,
      subject: 'test',
      customerName: 'test',
      productTags: [],
      conversationHistory: '',
    });
    expect(prompt).not.toContain('Loaded Skills');
  });

  it('includes safety rules', () => {
    const prompt = buildZendeskSystemPrompt({
      ticketId: 1,
      subject: 'test',
      customerName: 'test',
      productTags: [],
      conversationHistory: '',
    });
    expect(prompt).toContain('NEVER send replies directly');
  });
});
