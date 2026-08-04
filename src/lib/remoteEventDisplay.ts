import type { ComponentType } from 'react';
import {
  Bug,
  CreditCard,
  Globe,
  Heart,
  KeyRound,
  LogIn,
  ShieldAlert,
} from 'lucide-react';
import type { RemoteEvent } from '../shared/api';

type IconType = ComponentType<{ size?: number; strokeWidth?: number }>;

const PATTERN_LABEL: Record<string, string> = {
  'sql-union-select': 'Injection SQL',
  'sql-drop-table': 'Injection SQL',
  'sql-tautology': 'Injection SQL',
  'nosql-operator': 'Injection NoSQL',
  'xss-script-tag': 'Tentative XSS',
  'path-traversal': 'Path traversal',
};

/** Human label for a real amn-api event, informed by type + payload shape. */
export function remoteEventLabel(event: RemoteEvent): string {
  if (event.message) return event.message;

  if (event.type === 'security_alert') {
    const pattern = event.payload?.pattern;
    if (typeof pattern === 'string' && PATTERN_LABEL[pattern]) {
      return PATTERN_LABEL[pattern];
    }
    return 'Alerte de sécurité';
  }

  switch (event.type) {
    case 'connection':
      return event.payload?.success ? 'Connexion réussie' : 'Échec de connexion';
    case 'payment':
      return event.payload?.status === 'failed' ? 'Paiement échoué' : 'Paiement traité';
    case 'heartbeat':
      return 'Heartbeat';
    case 'request':
      return 'Requête bloquée';
    default:
      return 'Événement';
  }
}

/** One-line detail (IP, path, identifiant...) extracted from the payload. */
export function remoteEventDetail(event: RemoteEvent): string {
  const p = event.payload ?? {};
  const parts: string[] = [];
  if (typeof p.identifier === 'string') parts.push(String(p.identifier));
  if (typeof p.ip === 'string' && !parts.includes(String(p.ip))) parts.push(`IP ${p.ip}`);
  if (typeof p.path === 'string') parts.push(String(p.path));
  if (typeof p.amount === 'number') parts.push(`${p.amount} ${p.currency ?? ''}`.trim());
  if (typeof p.attempts === 'number') parts.push(`${p.attempts} tentatives`);
  return parts.join(' · ');
}

export function remoteEventIcon(event: RemoteEvent): IconType {
  if (event.type === 'security_alert') {
    const pattern = event.payload?.pattern;
    if (typeof pattern === 'string' && pattern.startsWith('sql')) return Bug;
    if (pattern === 'nosql-operator') return Bug;
    if (pattern === 'xss-script-tag' || pattern === 'path-traversal') return Bug;
    if (event.message?.includes('Force brute')) return KeyRound;
    return ShieldAlert;
  }
  switch (event.type) {
    case 'connection':
      return LogIn;
    case 'payment':
      return CreditCard;
    case 'heartbeat':
      return Heart;
    case 'request':
      return Globe;
    default:
      return ShieldAlert;
  }
}
