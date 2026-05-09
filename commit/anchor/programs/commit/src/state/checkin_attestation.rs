use anchor_lang::prelude::*;

#[account]
pub struct CheckinAttestation {
    pub participant: Pubkey,
    pub streak: Pubkey,
    pub day_index: u16,
    pub photo_hash: [u8; 32],
    pub phash: u64,
    pub verifier_signature: [u8; 64],
    pub verdict: bool,
    pub reason_hash: [u8; 32],
    pub created_at: i64,
    pub dispute_window_ends: i64,
    pub state: AttestationState,
    pub disputer: Option<Pubkey>,   // 1 + 32
    pub dispute_bond: u64,
    pub final_verdict: Option<bool>, // 1 + 1
    pub bump: u8,
}

impl CheckinAttestation {
    // 8 + 32 + 32 + 2 + 32 + 8 + 64 + 1 + 32 + 8 + 8 + 1 + (1+32) + 8 + (1+1) + 1
    pub const LEN: usize = 8 + 32 + 32 + 2 + 32 + 8 + 64 + 1 + 32 + 8 + 8 + 1 + 33 + 8 + 2 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum AttestationState {
    Pending,
    Disputed,
    Finalized,
    Overturned,
}
