use anchor_lang::prelude::*;

#[account]
pub struct Streak {
    pub creator: Pubkey,
    pub name: String,           // max 64 chars
    pub habit_type: HabitType,
    pub habit_prompt: String,   // max 256 chars — sent to AI verifier
    pub duration_days: u8,
    pub stake_amount: u64,      // USDC base units (6 decimals)
    pub penalty_percent: u8,    // 1–100
    pub max_participants: u32,
    pub start_timestamp: i64,
    pub total_pool: u64,        // accumulated slashed funds
    pub participant_count: u32,
    pub active_count: u32,
    pub completed_count: u32,
    pub escrow_token_account: Pubkey,
    pub phash_registry: Pubkey,
    pub bump: u8,
}

impl Streak {
    pub const MAX_NAME_LEN: usize = 64;
    pub const MAX_PROMPT_LEN: usize = 256;
    // 8 disc + 32 + (4+64) + 1 + (4+256) + 1 + 8 + 1 + 4 + 8 + 8 + 4 + 4 + 4 + 32 + 32 + 1
    pub const LEN: usize = 8 + 32 + (4 + 64) + 1 + (4 + 256) + 1 + 8 + 1 + 4 + 8 + 8 + 4 + 4 + 4 + 32 + 32 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum HabitType {
    Code,
    Read,
    Write,
    Design,
    Gym,
}
