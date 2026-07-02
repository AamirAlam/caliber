//! Helm Casper contracts.
//!
//! The treasury-vault contract is the on-chain anchor of Helm: it stores the
//! active policy reference, records approved rebalances, supports pause/resume
//! and owner-gated access control, and emits audit events for every action.
#![cfg_attr(not(test), no_std)]
#![cfg_attr(not(test), no_main)]
extern crate alloc;

pub mod vault;
