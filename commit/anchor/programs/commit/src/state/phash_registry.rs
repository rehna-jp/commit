use anchor_lang::prelude::*;

#[account]
pub struct PhashRegistry {
    pub streak: Pubkey,
    pub hashes: Vec<u64>,
    pub bump: u8,
}

impl PhashRegistry {
    pub fn space(duration_days: u8, max_participants: u32) -> usize {
        // 8 disc + 32 streak + 4 vec_len + (8 * max_hashes) + 1 bump
        8 + 32 + 4 + (8 * duration_days as usize * max_participants as usize) + 1
    }
}
