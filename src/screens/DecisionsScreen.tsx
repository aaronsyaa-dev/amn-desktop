import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useProfiles } from '../state/ProfilesContext';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useUndo } from '../state/UndoContext';
import type { ReportDraft } from '../state/useReports';
import { StaggerGroup, StaggerItem } from '../components/Stagger';
import { RegistreDesPourquoi } from '../components/collectif/RegistreDesPourquoi';
import { SkeletonList } from '../components/Skeleton';

interface DecisionData {
  title: string;
  detail: string;
  authorEmail: string;
  createdAt: string;
}

type SyncDecision = DecisionData & { id: string; updatedAt: string };

/** Pre-fills a report draft from a decision (B1). */
function decisionReportDraft(decision: Omit<SyncDecision, 'updatedAt'>, authorName: string): ReportDraft {
  const date = decision.createdAt
    ? new Date(decision.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const lines: string[] = [`**Décidé par :** ${authorName}`];
  if (date) lines.push(`**Le :** ${date}`);
  lines.push('', decision.detail?.trim() ? decision.detail.trim() : '_Pas de détail._');
  return {
    type: 'decision',
    title: decision.title ? `Rapport — ${decision.title}` : 'Rapport de décision',
    body: lines.join('\n'),
    links: [{ kind: 'decision', id: decision.id, label: decision.title || 'Décision' }],
  };
}

export function DecisionsScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { profileFor } = useProfiles();
  const { upsert, remove, ready } = useSync();
  const { isPending, scheduleDelete } = useUndo();
  const decisionsRaw = useCollection<DecisionData>('decisions');
  const decisions = useMemo(
    () =>
      [...decisionsRaw]
        .filter((d) => !isPending(`decisions:${d.id}`))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [decisionsRaw, isPending],
  );

  const removeDecision = (id: string, title: string) =>
    scheduleDelete({
      key: `decisions:${id}`,
      label: title ? `Décision « ${title} »` : 'Décision',
      commit: () => remove('decisions', id),
    });

  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [expanded, setExpanded] = useState(false);

  const submit = () => {
    if (!title.trim() || !user) return;
    upsert('decisions', uid('dec'), {
      title: title.trim(),
      detail: detail.trim(),
      authorEmail: user.email,
      createdAt: new Date().toISOString(),
    });
    setTitle('');
    setDetail('');
    setExpanded(false);
  };

  return (
    <StaggerGroup className="flex flex-col gap-6">
      <StaggerItem>
        <ScreenHeader
          eyebrow="Poste de travail · Décisions"
          title="Journal de décisions"
          description="Les choix techniques et business, horodatés — et pourquoi ils ont été pris."
          stats={[
            { label: 'Entrées', value: decisions.length },
            /*
              Ce mois-ci, parce que c'est la question qu'on se pose devant un
              journal : « qu'est-ce qu'on a tranché récemment ». Le total seul
              ne bouge presque jamais et n'apprend rien.
            */
            {
              label: 'Ce mois-ci',
              value: decisions.filter((d) => (d.createdAt ?? '').slice(0, 7) === new Date().toISOString().slice(0, 7))
                .length,
            },
          ]}
        />
      </StaggerItem>

      <StaggerItem>
        <div className="border border-border-strong bg-surface p-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onFocus={() => setExpanded(true)}
            placeholder="Quelle décision venez-vous de prendre ?"
            className="input-focus w-full border border-border bg-bg px-3 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-muted"
          />
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.2 }}
              className="mt-2 flex flex-col gap-2 overflow-hidden"
            >
              <textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="Contexte, raisonnement… (optionnel)"
                rows={2}
                className="input-focus resize-none border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setExpanded(false);
                    setTitle('');
                    setDetail('');
                  }}
                  className="px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-text-muted hover:text-text-secondary"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!title.trim()}
                  className="flex items-center gap-1.5 bg-accent px-3 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40"
                >
                  <Plus size={14} strokeWidth={2.25} />
                  Ajouter au journal
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </StaggerItem>

      <StaggerItem>
        {!ready ? (
          <SkeletonList rows={3} />
        ) : decisions.length === 0 ? (
          <p className="border border-border bg-surface p-6 text-center text-sm text-text-secondary">
            Aucune décision consignée pour l’instant.
          </p>
        ) : (
          /* L'objet de l'écran : la décision ET son motif, côte à côte, le manque dessiné. */
          <RegistreDesPourquoi
            decisions={decisions}
            nomDe={(email) => profileFor(email).name}
            onRapport={(d) => navigate('/reports', { state: { reportDraft: decisionReportDraft(d, profileFor(d.authorEmail).name) } })}
            onSupprimer={(d) => removeDecision(d.id, d.title)}
          />
        )}
      </StaggerItem>
    </StaggerGroup>
  );
}
