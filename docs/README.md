# Documentation Index

This directory contains canonical product and architecture documentation for the current implementation.

## Top-Level Docs

- [PRD](./PRD.md)
- [Architecture Requirements](./architecture/requirements.md)
- [Release Checklist](./release/release-checklist.md)

## Architecture Specifications

- [System Overview](./architecture/spec/system-overview.md)
- [CLI Contract](./architecture/spec/cli-contract.md)
- [Review Service API](./architecture/spec/review-service-api.md)
- [Schema and Provider Contracts](./architecture/spec/schema-and-provider-contracts.md)
- [Sandbox, Detached Execution, and Mirroring](./architecture/spec/sandbox-detached-and-mirroring.md)

## Architecture Decision Records

- [ADR-0001 Runtime Topology](./architecture/adr/0001-runtime-topology.md)
- [ADR-0002 Provider Abstraction and Output Schema](./architecture/adr/0002-provider-abstraction-and-output-schema.md)
- [ADR-0003 Detached Execution and Fallback](./architecture/adr/0003-detached-execution-and-fallback.md)

## Source of Truth

Implementation contracts are defined in code and mirrored here:

- Shared schemas/types: `packages/review-types/src/index.ts`
- Core orchestration: `packages/review-core/src/index.ts`
- CLI surface: `apps/review-cli/src/index.ts`
- Service surface: `apps/review-service/src/index.ts`
- Detached execution: `apps/review-worker/src/index.ts`
