//! Contract tests for HelmVault, run against Odra's in-memory test backend.
//! Run with: `cargo odra test`

use helm_contracts::vault::{Error, HelmVault, HelmVaultHostRef, HelmVaultInitArgs, RebalanceRecorded};
use odra::host::{Deployer, HostEnv};

fn deploy() -> (HostEnv, HelmVaultHostRef) {
    let env = odra_test::env();
    let owner = env.get_account(0);
    env.set_caller(owner);
    let contract =
        HelmVault::deploy(&env, HelmVaultInitArgs { owner, policy_ref: "policy:demo".to_string() });
    (env, contract)
}

#[test]
fn starts_unpaused_with_no_rebalances() {
    let (_env, contract) = deploy();
    assert!(!contract.is_paused());
    assert_eq!(contract.rebalance_count(), 0);
    assert_eq!(contract.policy_version(), 1);
}

#[test]
fn records_rebalance_and_emits_event() {
    let (env, mut contract) = deploy();
    contract.record_rebalance("reb_1".to_string());
    assert_eq!(contract.rebalance_count(), 1);
    assert!(env.emitted_event(
        &contract,
        RebalanceRecorded { rebalance_id: "reb_1".to_string(), policy_version: 1 },
    ));
}

#[test]
fn set_policy_bumps_version() {
    let (_env, mut contract) = deploy();
    contract.set_policy("policy:v2".to_string());
    assert_eq!(contract.policy_version(), 2);
}

#[test]
fn record_rebalance_reverts_when_paused() {
    let (_env, mut contract) = deploy();
    contract.set_paused(true);
    assert_eq!(
        contract.try_record_rebalance("reb_x".to_string()).unwrap_err(),
        Error::Paused.into()
    );
}

#[test]
fn non_owner_cannot_set_policy() {
    let (env, mut contract) = deploy();
    env.set_caller(env.get_account(1));
    assert_eq!(
        contract.try_set_policy("policy:hack".to_string()).unwrap_err(),
        Error::NotOwner.into()
    );
}
