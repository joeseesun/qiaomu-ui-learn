import type { UpdateEntry } from './update-notes';

// Prepend a version and user-facing changes for every release. Keep older entries for skipped updates.
export const UPDATE_ENTRIES: UpdateEntry[] = [
  { version: '1.0.3', items: ['introduced', 'revisit', 'control'] },
];
