// Ed25519 attestation verification and perceptual hash utilities.
use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::instructions::load_instruction_at_checked;
use crate::errors::CommitError;

pub const ATTESTATION_MSG_LEN: usize = 171;

// ed25519 sigverify native program ID (Ed25519SigVerify111111111111111111111111111)
pub fn ed25519_program_id() -> Pubkey {
    use std::str::FromStr;
    Pubkey::from_str("Ed25519SigVerify111111111111111111111111111")
        .expect("valid ed25519 program id")
}

/// (a ^ b).count_ones() — number of differing bits between two pHashes.
pub fn hamming_distance(a: u64, b: u64) -> u32 {
    (a ^ b).count_ones()
}

/// Parse the ed25519 instruction at index 0 and verify the attestation.
///
/// Layout of ed25519 instruction data:
///   [0..2]  num_signatures (u16 LE, effectively u8 count + padding)
///   [2..4]  signature_offset (u16 LE)
///   [4..6]  signature_instruction_index (u16 LE) — 0xFFFF = this ix
///   [6..8]  public_key_offset (u16 LE)
///   [8..10] public_key_instruction_index (u16 LE)
///   [10..12] message_data_offset (u16 LE)
///   [12..14] message_data_size (u16 LE)
///   [14..16] message_instruction_index (u16 LE)
///   [16..]  inline data: sig (64) || pubkey (32) || message (171) in offset order
///
/// Returns the 171-byte attestation message if valid.
pub fn verify_ed25519_ix(
    ix_sysvar: &AccountInfo,
    expected_pubkey: &[u8; 32],
) -> Result<[u8; ATTESTATION_MSG_LEN]> {
    let ed25519_ix = load_instruction_at_checked(0, ix_sysvar)
        .map_err(|_| CommitError::MissingSigVerify)?;

    require_keys_eq!(
        ed25519_ix.program_id,
        ed25519_program_id(),
        CommitError::MissingSigVerify
    );

    let data = &ed25519_ix.data;
    require!(data.len() >= 16, CommitError::InvalidSignature);

    let num_sigs = u16::from_le_bytes([data[0], data[1]]);
    require!(num_sigs >= 1, CommitError::InvalidSignature);

    // Offsets for first signature entry
    let pk_offset = u16::from_le_bytes([data[6], data[7]]) as usize;
    let msg_offset = u16::from_le_bytes([data[10], data[11]]) as usize;
    let msg_size = u16::from_le_bytes([data[12], data[13]]) as usize;

    require!(msg_size == ATTESTATION_MSG_LEN, CommitError::InvalidSignature);
    require!(pk_offset + 32 <= data.len(), CommitError::InvalidSignature);
    require!(msg_offset + msg_size <= data.len(), CommitError::InvalidSignature);

    // Verify this signature was from the expected verifier pubkey
    let pk_bytes = &data[pk_offset..pk_offset + 32];
    require!(pk_bytes == expected_pubkey.as_slice(), CommitError::InvalidSignature);

    let mut msg = [0u8; ATTESTATION_MSG_LEN];
    msg.copy_from_slice(&data[msg_offset..msg_offset + ATTESTATION_MSG_LEN]);
    Ok(msg)
}

/// Parsed attestation message fields.
pub struct AttestationMsg {
    pub verifier_pubkey: [u8; 32],
    pub user: Pubkey,        // participant.user
    pub streak: Pubkey,      // streak pubkey
    pub day_index: u16,
    pub photo_hash: [u8; 32],
    pub phash: u64,
    pub verdict: bool,
    pub reason_hash: [u8; 32],
}

/// Deserialize the 171-byte message.
/// Layout: verifier_pk(32) || user(32) || streak(32) || day(2) || photo_hash(32) || phash(8) || verdict(1) || reason(32)
pub fn parse_attestation_msg(data: &[u8; ATTESTATION_MSG_LEN]) -> AttestationMsg {
    let mut verifier_pubkey = [0u8; 32];
    verifier_pubkey.copy_from_slice(&data[0..32]);

    let mut user_bytes = [0u8; 32];
    user_bytes.copy_from_slice(&data[32..64]);

    let mut streak_bytes = [0u8; 32];
    streak_bytes.copy_from_slice(&data[64..96]);

    let day_index = u16::from_le_bytes([data[96], data[97]]);

    let mut photo_hash = [0u8; 32];
    photo_hash.copy_from_slice(&data[98..130]);

    let phash = u64::from_le_bytes(data[130..138].try_into().unwrap());
    let verdict = data[138] != 0;

    let mut reason_hash = [0u8; 32];
    reason_hash.copy_from_slice(&data[139..171]);

    AttestationMsg {
        verifier_pubkey,
        user: Pubkey::from(user_bytes),
        streak: Pubkey::from(streak_bytes),
        day_index,
        photo_hash,
        phash,
        verdict,
        reason_hash,
    }
}
