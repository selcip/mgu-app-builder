// Gives the document model the vendored engine's checks (its widget validator and palettes), which it can't import
// itself (ADR 0005; model/engine-checks.ts). Imported once by main.tsx.
import cluster from 'virtual:cluster-engine';
import { setEngineChecks } from './model/engine-checks.ts';

setEngineChecks(cluster.checks);
