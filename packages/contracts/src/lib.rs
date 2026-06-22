//! Helm Casper contracts.
//!
//! The treasury-vault contract is the on-chain anchor of Helm: it stores the
//! active policy reference, records approved rebalances, supports pause/resume
//! and owner-gated access control, and emits audit events for every action.

pub mod vault;
