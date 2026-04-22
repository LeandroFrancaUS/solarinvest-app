-- 0046_proposals_proposal_code_index.sql
-- Adds an index on proposals.proposal_code to speed up lookups by
-- human-readable code (e.g. "SLRV-124324") used in portfolioAutoFill
-- and getProposalById when source_proposal_id is not a UUID.

CREATE INDEX IF NOT EXISTS idx_proposals_proposal_code ON proposals (proposal_code);
