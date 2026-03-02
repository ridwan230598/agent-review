import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { ReviewProvider } from '@review-agent/review-types';
import { describe, expect, it } from 'vitest';
import {
  InvalidFindingLocationError,
  computeExitCode,
  runReview,
} from './index.js';

const execFileAsync = promisify(execFile);

async function runGit(cwd: string, args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd });
}

async function makeRepo(): Promise<{
  cwd: string;
  cleanup: () => Promise<void>;
}> {
  const cwd = await mkdtemp(join(tmpdir(), 'review-core-test-'));
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

function makeProvider(raw: unknown): ReviewProvider {
  return {
    id: 'codexDelegate',
    capabilities: () => ({
      jsonSchemaOutput: true,
      reasoningControl: false,
      streaming: false,
    }),
    run: async () => ({ raw, text: JSON.stringify(raw) }),
  };
}

describe('runReview', () => {
  it('runs and emits artifacts', async () => {
    const repo = await makeRepo();
    try {
      const raw = {
        findings: [
          {
            title: '[P1] Value constant changed without tests',
            body: 'This change modifies behavior and should include a test update.',
            confidence_score: 0.9,
            priority: 1,
            code_location: {
              absolute_file_path: join(repo.cwd, 'file.ts'),
              line_range: { start: 1, end: 1 },
            },
          },
        ],
        overall_correctness: 'patch is incorrect',
        overall_explanation: 'A likely regression exists.',
        overall_confidence_score: 0.85,
      };

      const review = await runReview(
        {
          cwd: repo.cwd,
          target: { type: 'uncommittedChanges' },
          provider: 'codexDelegate',
          outputFormats: ['json', 'sarif', 'markdown'],
        },
        {
          providers: {
            codexDelegate: makeProvider(raw),
            openaiCompatible: makeProvider(raw),
          },
        }
      );

      expect(review.result.findings).toHaveLength(1);
      expect(review.artifacts.json).toContain('overallCorrectness');
      expect(review.artifacts.sarif).toContain('"runs"');
      expect(review.artifacts.markdown).toContain('# Review Report');
      expect(computeExitCode(review.result, 'p1')).toBe(1);
    } finally {
      await repo.cleanup();
    }
  });

  it('rejects findings outside changed lines', async () => {
    const repo = await makeRepo();
    try {
      const raw = {
        findings: [
          {
            title: '[P1] Bad location',
            body: 'Outside changed lines.',
            confidence_score: 0.8,
            priority: 1,
            code_location: {
              absolute_file_path: join(repo.cwd, 'file.ts'),
              line_range: { start: 99, end: 99 },
            },
          },
        ],
        overall_correctness: 'patch is incorrect',
        overall_explanation: 'Bad.',
        overall_confidence_score: 0.8,
      };

      await expect(
        runReview(
          {
            cwd: repo.cwd,
            target: { type: 'uncommittedChanges' },
            provider: 'codexDelegate',
            outputFormats: ['json'],
          },
          {
            providers: {
              codexDelegate: makeProvider(raw),
              openaiCompatible: makeProvider(raw),
            },
          }
        )
      ).rejects.toBeInstanceOf(InvalidFindingLocationError);
    } finally {
      await repo.cleanup();
    }
  });
});
