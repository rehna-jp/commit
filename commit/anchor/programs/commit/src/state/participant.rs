use anchor_lang::prelude::*;

#[account]
pub struct Participant {
    pub user: Pubkey,
    pub streak: Pubkey,
    pub stake_locked: u64,
    pub current_streak: u16,            // consecutive finalized days
    pub last_finalized_day: u16,
    pub last_checkin_timestamp: i64,
    pub is_active: bool,
    pub has_claimed: bool,
    pub disputes_filed_against: u16,
    pub disputes_upheld: u16,
    pub bump: u8,
}

impl Participant {
    // 8 + 32 + 32 + 8 + 2 + 2 + 8 + 1 + 1 + 2 + 2 + 1
    pub const LEN: usize = 8 + 32 + 32 + 8 + 2 + 2 + 8 + 1 + 1 + 2 + 2 + 1;
}
