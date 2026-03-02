import { computeExitCode } from '@review-agent/review-core';
import type { ReviewResult } from '@review-agent/review-types';

export type EvalCase = {
  name: string;
  result: ReviewResult;
  threshold?: 'p0' | 'p1' | 'p2' | 'p3';
  expectedExitCode: number;
};

export type EvalOutcome = {
  name: string;
  passed: boolean;
  expectedExitCode: number;
  actualExitCode: number;
};

export function runEvalCases(cases: EvalCase[]): EvalOutcome[] {
  return cases.map((item) => {
    const actualExitCode = computeExitCode(item.result, item.threshold);
    return {
      name: item.name,
      passed: actualExitCode === item.expectedExitCode,
      expectedExitCode: item.expectedExitCode,
      actualExitCode,
    };
  });
}
