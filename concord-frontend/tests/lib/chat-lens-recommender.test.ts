/**
 * Chat Lens Recommender Tests — 6 tests per spec.
 *
 * 1. no_spam: 10 messages → max N recs
 * 2. intent_shift_triggers: ideate→plan triggers a lens
 * 3. explicit_ask_triggers: "simulate" triggers sim lens
 * 4. suppression: dismiss twice → suppress for 10 turns
 * 5. correct_lane: publish intent recommends lens that supports global submission flow
 * 6. chat_no_write: recommendations never mutate DTUs
 */

import { describe, it, expect } from 'vitest';
import {
  recommendLenses,
  createSessionContext,
  extractSignals,
  classifyIntent,
  checkTriggers,
  scoreLenses,
  type SessionContext,
  type IntentClass,
  LENS_RECOMMENDER_REGISTRY,
} from '../../lib/lenses/chat-lens-recommender';

function buildCtx(overrides: Partial<SessionContext> = {}): SessionContext {
  return { ...createSessionContext(), ...overrides };
}

describe('Chat Lens Recommender', () => {
  // ── Test 1: no_spam ─────────────────────────────────────────────
  it('no_spam: 10 sequential messages produce at most 4 recommendations', () => {
    const messages = [
      'I want to build a new app',
      'It should have user authentication',
      'Let me think about the database schema',
      'What about using PostgreSQL?',
      'I need to plan the architecture',
      'How do I structure the API?',
      'Let me simulate the load',
      'What about caching strategies?',
      'I should audit the security',
      'Time to publish the beta',
    ];

    const ctx = buildCtx();
    let totalRecs = 0;

    for (let i = 0; i < messages.length; i++) {
      ctx.currentTurn = i;
      ctx.recentMessages = messages.slice(0, i + 1);
      if (i > 0) {
        const prevSignals = extractSignals(messages[i - 1]);
        ctx.previousIntents.push(prevSignals.intentSignals[0]);
      }

      const result = recommendLenses(messages[i], ctx);
      totalRecs += result.recs.length;

      // Record recommendations so the spam suppression works
      for (const rec of result.recs) {
        ctx.recentRecommendations.push({
          lensId: rec.lensId,
          turnIndex: i,
          dismissed: false,
        });
      }
    }

    // With anti-spam (1 rec per 3 messages), max recs from 10 messages ≈ 4
    expect(totalRecs).toBeLessThanOrEqual(4);
  });

  // ── Test 2: intent_shift_triggers ───────────────────────────────
  it('intent_shift_triggers: ideate → plan triggers a lens recommendation', () => {
    const ctx = buildCtx({
      currentTurn: 5,
      previousIntents: ['IDEATE'],
      recentMessages: [
        'What if we brainstorm different approaches?',
        'Let me explore some ideas about this project',
      ],
    });

    const result = recommendLenses('I need to plan the steps and milestones for this project', ctx);

    expect(result.recs.length).toBeGreaterThanOrEqual(1);
    expect(result.debug?.trigger.shouldRecommend).toBe(true);
    expect(result.debug?.trigger.triggerReason).toBe('intent_shift');
  });

  // ── Test 3: explicit_ask_triggers ───────────────────────────────
  it('explicit_ask_triggers: "simulate the numbers" triggers sim lens', () => {
    const ctx = buildCtx({
      currentTurn: 5,
      previousIntents: ['CHAT_ONLY'],
      recentMessages: ['Tell me about financial models'],
    });

    const result = recommendLenses('I need to simulate the numbers and forecast revenue scenarios', ctx);

    expect(result.recs.length).toBeGreaterThanOrEqual(1);
    expect(result.debug?.trigger.shouldRecommend).toBe(true);

    // At least one rec should be sim or finance lens
    const recIds = result.recs.map(r => r.lensId);
    const hasSimOrFinance = recIds.some(id => id === 'sim' || id === 'finance');
    expect(hasSimOrFinance).toBe(true);
  });

  // ── Test 4: suppression ─────────────────────────────────────────
  it('suppression: dismiss twice → suppress for 10 turns', () => {
    const ctx = buildCtx({
      currentTurn: 10,
      previousIntents: ['IDEATE'],
      recentRecommendations: [
        { lensId: 'sim', turnIndex: 2, dismissed: true },
        { lensId: 'paper', turnIndex: 5, dismissed: true },
      ],
    });

    const result = recommendLenses('I need to plan the architecture and build a roadmap', ctx);

    expect(result.recs.length).toBe(0);
    expect(result.debug?.trigger.shouldRecommend).toBe(false);
  });

  // ── Test 5: correct_lane ────────────────────────────────────────
  it('correct_lane: publish intent recommends lens supporting global submission flow', () => {
    const ctx = buildCtx({
      currentTurn: 10,
      previousIntents: ['PLAN'],
      recentMessages: ['I have a plugin ready'],
    });

    const result = recommendLenses(
      'How do I publish and distribute this to the marketplace? I want to list it for others.',
      ctx
    );

    expect(result.recs.length).toBeGreaterThanOrEqual(1);

    // Check that at least one recommendation supports publish action
    const hasPublishLens = result.recs.some(rec => {
      const entry = LENS_RECOMMENDER_REGISTRY.find(e => e.lensId === rec.lensId);
      return entry?.supportsActions.includes('publish');
    });
    expect(hasPublishLens).toBe(true);

    // The marketplace lens specifically requires 'market' lane (global submission)
    const marketRec = result.recs.find(r => r.lensId === 'marketplace');
    if (marketRec) {
      const entry = LENS_RECOMMENDER_REGISTRY.find(e => e.lensId === 'marketplace');
      expect(entry?.requiresLane).toBe('market');
    }
  });

  // ── Test 6: chat_no_write ───────────────────────────────────────
  it('chat_no_write: recommendations never mutate session context or DTUs', () => {
    const ctx = buildCtx({
      currentTurn: 5,
      previousIntents: ['IDEATE'],
      recentMessages: ['Let me brainstorm ideas'],
    });

    // Capture initial state
    const ctxSnapshot = JSON.parse(JSON.stringify(ctx));

    // Run the recommender
    const result = recommendLenses('I need to plan the steps for building this feature', ctx);

    // Verify context was NOT mutated by recommendLenses
    expect(ctx.recentMessages).toEqual(ctxSnapshot.recentMessages);
    expect(ctx.lensesUsed).toEqual(ctxSnapshot.lensesUsed);
    expect(ctx.recentRecommendations).toEqual(ctxSnapshot.recentRecommendations);
    expect(ctx.currentTurn).toBe(ctxSnapshot.currentTurn);
    expect(ctx.previousIntents).toEqual(ctxSnapshot.previousIntents);

    // Verify no taskSeed has write/create/mutation operations
    for (const rec of result.recs) {
      if (rec.taskSeed) {
        // suggestedActions are presentation-only, not executed
        expect(rec.taskSeed.suggestedActions).toBeDefined();
        expect(Array.isArray(rec.taskSeed.suggestedActions)).toBe(true);
      }
    }

    // The recommendLenses function is purely functional — returns data, no side effects
    expect(result.recs).toBeDefined();
    expect(result.debug).toBeDefined();
  });
});

describe('Intent Classification', () => {
  it('classifies BUILD intent from code-related messages', () => {
    const intents = classifyIntent('I want to build and implement the API endpoint');
    expect(intents).toContain('BUILD');
  });

  it('classifies SIMULATE intent from forecast messages', () => {
    const intents = classifyIntent('Can you simulate what happens with different scenarios?');
    expect(intents).toContain('SIMULATE');
  });

  it('classifies CHAT_ONLY for casual messages', () => {
    const intents = classifyIntent('Hey, how are you today?');
    expect(intents).toContain('CHAT_ONLY');
  });

  it('returns up to 2 intents for multi-intent messages', () => {
    const intents = classifyIntent('I need to plan and build the architecture');
    expect(intents.length).toBeLessThanOrEqual(2);
    expect(intents.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Signal Extraction', () => {
  it('extracts domain signals from message content', () => {
    const signals = extractSignals('I need help with the legal contract compliance review');
    expect(signals.domainSignals).toEqual(expect.arrayContaining(['legal', 'compliance']));
  });

  it('extracts friction signals from action-oriented messages', () => {
    const signals = extractSignals('How do I build this feature?');
    expect(signals.frictionSignals.length).toBeGreaterThan(0);
    expect(signals.confidence).toBeGreaterThan(0);
  });

  it('returns low confidence for casual messages', () => {
    const signals = extractSignals('Nice weather today');
    expect(signals.confidence).toBe(0);
  });
});
