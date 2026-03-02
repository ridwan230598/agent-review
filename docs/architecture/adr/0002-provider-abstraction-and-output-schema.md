# ADR-0002: Provider Abstraction and Output Schema

- Status: Accepted
- Date: 2026-03-01

## Context

The platform needs to support multiple model backends while preserving consistent downstream review artifacts and deterministic validation behavior.

## Decision

Define a shared provider interface and enforce canonical output contracts through `review-types` schemas.

- Providers implement `capabilities()` + `run(input)`
- Core normalization always produces `ReviewResult`
- Structured output schema (`RawModelOutputSchema`) is preferred
- Fallback text parsing is allowed for non-structured providers

## Consequences

### Positive

- Provider swaps and additions do not alter core API contracts
- Strong runtime validation at boundary reduces malformed output impact
- Uniform reporter pipeline across providers

### Negative

- Additional conversion/normalization logic required
- Providers with weak structured output need fallback handling and may reduce fidelity

## Alternatives Considered

- Provider-specific result formats: rejected due to downstream complexity and incompatibility with shared artifact/rendering path.
