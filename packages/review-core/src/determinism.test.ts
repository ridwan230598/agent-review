import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { ReviewProvider } from '@review-agent/review-types';
import { describe, expect, it } from 'vitest';
import { runReview } from './index.js';

const execFileAsync = promisify(execFile);

async function runGit(cwd: string, args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd });
}

async function makeRepo(): Promise<{
  cwd: string;
  cleanup: () => Promise<void>;
}> {
  const cwd = await mkdtemp(join(tmpdir(), 'review-core-determinism-'));
  await runGit(cwd, ['init', '--initial-branch=main']);
  await runGit(cwd, ['config', 'user.name', 'Tester']);
  await runGit(cwd, ['config', 'user.email', 'tester@example.com']);
  await writeFile(join(cwd, 'file.ts'), 'export const value = 1;\n', 'utf8');
  await runGit(cwd, ['add', 'file.ts']);
  await runGit(cwd, ['commit', '-m', 'base']);
  await writeFile(join(cwd, 'file.ts'), 'export const value = 2;\n', 'utf8');

  return {
    cwd,
    cleanup: async () => {
      await rm(cwd, { recursive: true, force: true });
    },
  };
}

function makeProvider(cwd: string): ReviewProvider {
  return {
    id: 'codexDelegate',
    capabilities: () => ({
      jsonSchemaOutput: true,
      reasoningControl: false,
      streaming: false,
    }),
    run: async () => ({
      raw: {
        findings: [
          {
            title: '[P1] Value constant changed without tests',
            body: 'This change modifies behavior and should include a test update.',
            confidence_score: 0.9,
            priority: 1,
            code_location: {
              absolute_file_path: join(cwd, 'file.ts'),
              line_range: { start: 1, end: 1 },
            },
          },
        ],
        overall_correctness: 'patch is incorrect',
        overall_explanation: 'A likely regression exists.',
        overall_confidence_score: 0.85,
      },
      text: '',
    }),
  };
}

describe('core determinism and lifecycle metadata', () => {
  it('produces deterministic fingerprints and artifacts', async () => {
    const repo = await makeRepo();
    try {
      const provider = makeProvider(repo.cwd);
      const providers = {
        codexDelegate: provider,
        openaiCompatible: provider,
      };

      const first = await runReview(
        {
          cwd: repo.cwd,
          target: { type: 'uncommittedChanges' },
          provider: 'codexDelegate',
          outputFormats: ['json', 'sarif', 'markdown'],
          model: 'fixed-model',
        },
        { providers }
      );
      const second = await runReview(
        {
          cwd: repo.cwd,
          target: { type: 'uncommittedChanges' },
          provider: 'codexDelegate',
          outputFormats: ['json', 'sarif', 'markdown'],
          model: 'fixed-model',
        },
        { providers }
      );

      expect(first.result.findings[0]?.fingerprint).toBe(
        second.result.findings[0]?.fingerprint
      );
      expect(first.artifacts.json).toBe(second.artifacts.json);
      expect(first.artifacts.sarif).toBe(second.artifacts.sarif);
      expect(first.artifacts.markdown).toBe(second.artifacts.markdown);
    } finally {
      await repo.cleanup();
    }
  });

  it('emits correlation metadata on every lifecycle event', async () => {
    const repo = await makeRepo();
    try {
      const provider = makeProvider(repo.cwd);
      const providers = {
        codexDelegate: provider,
        openaiCompatible: provider,
      };

      const events: Parameters<
        NonNullable<Parameters<typeof runReview>[1]['onEvent']>
      >[0][] = [];
      await runReview(
        {
          cwd: repo.cwd,
          target: { type: 'uncommittedChanges' },
          provider: 'codexDelegate',
          outputFormats: ['json'],
        },
        {
          providers,
          onEvent: (event) => events.push(event),
        }
      );

      expect(events.length).toBeGreaterThan(0);
      const reviewId = events[0]?.meta.correlation.reviewId;
      expect(reviewId).toBeTruthy();
      for (const event of events) {
        expect(event.meta.eventId.length).toBeGreaterThan(0);
        expect(event.meta.timestampMs).toBeGreaterThan(0);
        expect(event.meta.correlation.reviewId).toBe(reviewId);
      }
    } finally {
      await repo.cleanup();
    }
  });

  it('keeps mirror-write failures non-blocking', async () => {
    const repo = await makeRepo();
    try {
      const provider = makeProvider(repo.cwd);
      const providers = {
        codexDelegate: provider,
        openaiCompatible: provider,
      };

      const result = await runReview(
        {
          cwd: repo.cwd,
          target: { type: 'uncommittedChanges' },
          provider: 'codexDelegate',
          outputFormats: ['json'],
        },
        { providers },
        {
          mirrorWrite: async () => {
            throw new Error('bridge unavailable');
          },
        }
      );

      expect(result.result.findings).toHaveLength(1);
      expect(result.artifacts.json).toContain('overallCorrectness');
    } finally {
      await repo.cleanup();
    }
  });
});
