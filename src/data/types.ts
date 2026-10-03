import type { Lang, Paper } from '../export/layout';

export type Status = 'draft' | 'revised' | 'done';

export interface ProjectMeta {
  id: string;
  title: string;
  author: string;
  contact: string;
  dailyGoal: number;
  paper: Paper;
  lang: Lang;
  revisionOn: boolean;
  revisionGen: number;
  createdAt: number;
  updatedAt: number;
}

/** Senaryo belgesi (id = 'script') veya bir not */
export interface DocNode {
  id: string;
  kind: 'script' | 'note';
  title: string;
  order: number;
  /** ProseMirror JSON */
  doc: string | null;
  plainText: string;
  wordCount: number;
  updatedAt: number;
}

export interface SceneMeta {
  sid: string;
  synopsis: string;
  color: string | null;
  status: Status;
  /** Hikâye içi gün ("1. gün", "Pazartesi"…) — zaman çizelgesi */
  storyDay: string;
}

export interface CharacterProfile {
  name: string;
  description: string;
  color: string | null;
}

export interface Snapshot {
  id: string;
  nodeId: string;
  label: string;
  doc: string;
  wordCount: number;
  createdAt: number;
}

export interface ProjectData {
  meta: ProjectMeta;
  script: DocNode;
  notes: DocNode[];
  scenes: Record<string, SceneMeta>;
  characters: Record<string, CharacterProfile>;
}

export const STATUS_LABEL: Record<Status, string> = {
  draft: 'Taslak',
  revised: 'Revize',
  done: 'Bitti',
};

export const emptySceneMeta = (sid: string): SceneMeta => ({ sid, synopsis: '', color: null, status: 'draft', storyDay: '' });
