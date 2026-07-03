//! Caliber treasury-vault contract (Odra).
//!
//! CaliberVault is the on-chain anchor of Caliber: it stores a reference to the active
//! treasury policy and records every approved rebalance decision, emitting an
//! audit event each time. `record_rebalance` is the transaction-producing entry
//! point the off-chain agent calls after deterministic policy checks and human
//! approval. The contract does not custody RWA tokens — it is the verifiable
//! decision/audit anchor.

use odra::prelude::*;

/// Emitted whenever an approved rebalance is recorded on-chain.
#[odra::event]
pub struct RebalanceRecorded {
    pub rebalance_id: String,
    pub policy_version: u32,
}

/// Emitted when the vault is paused or resumed.
#[odra::event]
pub struct PausedSet {
    pub paused: bool,
}

/// Contract errors. Discriminants must stay unique across the project.
#[odra::odra_error]
pub enum Error {
    /// Caller is not the configured owner.
    NotOwner = 1,
    /// Action attempted while the vault is paused.
    Paused = 2,
}

#[odra::module(events = [RebalanceRecorded, PausedSet], errors = Error)]
pub struct CaliberVault {
    /// Owner account permitted to administer the vault (access control).
    owner: Var<Address>,
    /// Hash/reference of the active treasury policy.
    policy_ref: Var<String>,
    /// Monotonic policy version, bumped on each policy update.
    policy_version: Var<u32>,
    /// When true, no rebalances may be recorded.
    paused: Var<bool>,
    /// Count of rebalances recorded, used as a simple audit index.
    rebalance_count: Var<u32>,
}

#[odra::module]
impl CaliberVault {
    /// One-time constructor: set the owner and initial policy reference.
    pub fn init(&mut self, owner: Address, policy_ref: String) {
        self.owner.set(owner);
        self.policy_ref.set(policy_ref);
        self.policy_version.set(1);
        self.paused.set(false);
        self.rebalance_count.set(0);
    }

    /// Update the active policy reference (owner only). Bumps the version.
    pub fn set_policy(&mut self, policy_ref: String) {
        self.assert_owner();
        self.policy_ref.set(policy_ref);
        self.policy_version.set(self.policy_version.get_or_default() + 1);
    }

    /// Pause/resume the vault (owner only). Emits `PausedSet`.
    pub fn set_paused(&mut self, paused: bool) {
        self.assert_owner();
        self.paused.set(paused);
        self.env().emit_event(PausedSet { paused });
    }

    /// Record an approved rebalance on-chain (owner only — the agent key is the
    /// owner). The transaction-producing entry point. Reverts if paused.
    pub fn record_rebalance(&mut self, rebalance_id: String) {
        self.assert_owner();
        if self.paused.get_or_default() {
            self.env().revert(Error::Paused);
        }
        self.rebalance_count.set(self.rebalance_count.get_or_default() + 1);
        self.env().emit_event(RebalanceRecorded {
            rebalance_id,
            policy_version: self.policy_version.get_or_default(),
        });
    }

    /// Read the current paused flag.
    pub fn is_paused(&self) -> bool {
        self.paused.get_or_default()
    }

    /// Read the number of rebalances recorded so far.
    pub fn rebalance_count(&self) -> u32 {
        self.rebalance_count.get_or_default()
    }

    /// Read the active policy version.
    pub fn policy_version(&self) -> u32 {
        self.policy_version.get_or_default()
    }

    /// Revert unless the caller is the configured owner.
    fn assert_owner(&self) {
        if self.env().caller() != self.owner.get_or_revert_with(Error::NotOwner) {
            self.env().revert(Error::NotOwner);
        }
    }
}
