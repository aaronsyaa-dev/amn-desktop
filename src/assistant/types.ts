/**
 * Types for the built-in AI assistant.
 *
 * The assistant is deliberately structured around a small set of data types so
 * that the mock engine used today and the real Claude-backed engine used later
 * are interchangeable. In particular, generated content is expressed as an
 * array of {@link ReportBlock} rather than a raw string: this renders richly in
 * the UI, prints cleanly to PDF, and is exactly the shape a real model can be
 * asked to emit (structured JSON output).
 */

export type ReportMode = 'internal' | 'client';
export type ReportScope = 'site' | 'global';

export type BlockTone = 'default' | 'success' | 'warning' | 'danger';

/** A single renderable piece of assistant output. */
export type ReportBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | {
      type: 'kpis';
      items: Array<{ label: string; value: string; tone?: BlockTone }>;
    };

/** A fully generated report, ready to render or export. */
export interface AssistantReport {
  id: string;
  scope: ReportScope;
  siteId?: string;
  mode: ReportMode;
  title: string;
  subtitle: string;
  /** ISO timestamp */
  generatedAt: string;
  blocks: ReportBlock[];
}

/** Everything needed to (re)generate a report — e.g. when toggling the mode. */
export interface ReportRequest {
  scope: ReportScope;
  siteId?: string;
  mode: ReportMode;
}

/**
 * The result of a single assistant turn: either a full report or a free-text
 * answer. Both use {@link ReportBlock} so the chat view has one renderer.
 */
export type AssistantTurn =
  | { kind: 'report'; request: ReportRequest; report: AssistantReport }
  | { kind: 'answer'; blocks: ReportBlock[] };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  /** Present for user messages. */
  text?: string;
  /** Present for assistant messages. */
  turn?: AssistantTurn;
  createdAt: string;
}

export interface DailySummary {
  /** ISO timestamp — simulated to be "this morning". */
  generatedAt: string;
  headline: string;
  blocks: ReportBlock[];
}

export type WatchCategory =
  | 'Cybersécurité'
  | 'Vulnérabilité'
  | 'IA'
  | 'Anthropic';

// WatchItem is now sourced from real RSS feeds (see src/main/watch.ts). The
// canonical shape lives in shared/api so the bridge and the UI agree on it.
export type { WatchItem } from '../shared/api';

export interface Suggestion {
  id: string;
  title: string;
  detail: string;
  severity: 'critical' | 'warning' | 'info';
  siteId?: string;
}

export interface Insight {
  id: string;
  title: string;
  body: string;
  tone: 'positive' | 'neutral' | 'warning';
  siteId?: string;
}
