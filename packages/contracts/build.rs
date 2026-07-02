//! Odra's contract build script. Reads the ODRA_MODULE env var (set by
//! cargo-odra) to select which module to build into wasm.
pub fn main() {
    odra_build::build();
}
