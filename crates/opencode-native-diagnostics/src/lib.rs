const ABI_VERSION: u32 = 1;
const FNV_OFFSET_BASIS: u64 = 0xcbf2_9ce4_8422_2325;
const FNV_PRIME: u64 = 0x0000_0100_0000_01b3;

/// Return the C ABI version implemented by this library.
#[unsafe(no_mangle)]
pub extern "C" fn opencode_native_abi_version() -> u32 {
    ABI_VERSION
}

/// Compute a deterministic FNV-1a checksum over an input byte slice.
///
/// A null pointer is rejected with the reserved value `0`. Callers must still
/// pass a non-null pointer for an empty input and set `len` to zero.
///
/// # Safety
///
/// `data` must point to at least `len` readable bytes and remain valid for the
/// duration of this call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn opencode_native_fnv1a64(data: *const u8, len: usize) -> u64 {
    if data.is_null() {
        return 0;
    }

    // SAFETY: The caller provides the readable allocation described above.
    let bytes = unsafe { std::slice::from_raw_parts(data, len) };
    fnv1a64(bytes)
}

fn fnv1a64(bytes: &[u8]) -> u64 {
    bytes.iter().fold(FNV_OFFSET_BASIS, |hash, byte| {
        (hash ^ u64::from(*byte)).wrapping_mul(FNV_PRIME)
    })
}

#[cfg(test)]
mod tests {
    use super::{FNV_OFFSET_BASIS, fnv1a64, opencode_native_abi_version};

    #[test]
    fn reports_current_abi() {
        assert_eq!(opencode_native_abi_version(), 1);
    }

    #[test]
    fn hashes_known_payloads() {
        assert_eq!(fnv1a64(b""), FNV_OFFSET_BASIS);
        assert_eq!(fnv1a64(b"hello"), 0xa430_d846_80aa_bd0b);
    }
}
