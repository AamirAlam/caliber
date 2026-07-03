//! Deploy CaliberVault to a live Casper network (testnet) via Odra's Livenet
//! integration. Run with:
//!
//!   cargo run --bin caliber_vault_on_livenet --features livenet
//!
//! Requires these env vars (see packages/contracts/.env.example):
//!   ODRA_CASPER_LIVENET_NODE_ADDRESS   e.g. https://node.testnet.casper.network/rpc
//!   ODRA_CASPER_LIVENET_CHAIN_NAME     casper-test
//!   ODRA_CASPER_LIVENET_SECRET_KEY_PATH  path to a funded secret_key.pem
//!
//! On success it prints the deployed contract PACKAGE hash — copy it into
//! apps/services/.env (CALIBER_VAULT_CONTRACT_HASH) and apps/web/.env.local
//! (NEXT_PUBLIC_VAULT_CONTRACT_HASH).

#[cfg(feature = "livenet")]
fn main() {
    use caliber_contracts::vault::{CaliberVault, CaliberVaultInitArgs};
    use odra::host::Deployer;
    use odra::prelude::Addressable;

    let env = odra_casper_livenet_env::env();
    let owner = env.caller();

    // Gas budget for the install deploy (motes). Installs are expensive; tune if rejected.
    env.set_gas(300_000_000_000u64);

    let contract = CaliberVault::deploy(
        &env,
        CaliberVaultInitArgs { owner, policy_ref: "policy:demo".to_string() },
    );

    println!("\n✅ CaliberVault deployed.");
    println!("   owner:        {owner:?}");
    println!("   package hash: {}", contract.address().to_formatted_string());
    println!("\nCopy the package hash into:");
    println!("   apps/services/.env       CALIBER_VAULT_CONTRACT_HASH");
    println!("   apps/web/.env.local      NEXT_PUBLIC_VAULT_CONTRACT_HASH");
}

#[cfg(not(feature = "livenet"))]
fn main() {
    eprintln!("Rebuild with the livenet feature: cargo run --bin caliber_vault_on_livenet --features livenet");
}
