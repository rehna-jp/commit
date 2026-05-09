use anchor_lang::prelude::*;

#[account]
pub struct StreakProof {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub streak: Pubkey,
    pub habit_name: String,             // max 64
    pub duration_days: u8,
    pub stake_lamports: u64,
    pub pool_share_lamports: u64,
    pub completed_at: i64,
    pub attestation_hashes: Vec<[u8; 32]>,
    pub disputes_filed_against: u16,
    pub disputes_upheld: u16,
    pub bump: u8,
}

impl StreakProof {
    pub fn space(duration_days: u8) -> usize {
        // 8 disc + 32 + 32 + 32 + (4+64) + 1 + 8 + 8 + 8 + (4 + 32*duration_days) + 2 + 2 + 1
        8 + 32 + 32 + 32 + (4 + 64) + 1 + 8 + 8 + 8 + (4 + 32 * duration_days as usize) + 2 + 2 + 1
    }
}
