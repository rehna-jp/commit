// commit — habit-stake protocol on Solana.
// Verifiable AI attestations + on-chain pHash registry + soulbound completion NFTs.
use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;
pub mod utils;

use instructions::*;
use state::HabitType;

declare_id!("3Gd8xHLKGjj8evBtwQUTnawSTwWdbeAxZmtVyxMPm29G");

// Test keypair: nacl.sign.keyPair.fromSeed(Buffer.alloc(32, 42)).publicKey
// To regenerate for production: node anchor/scripts/gen-verifier-keypair.js
pub const VERIFIER_PUBKEY: [u8; 32] = [25, 127, 107, 35, 225, 108, 133, 50, 198, 171, 200, 56, 250, 205, 94, 167, 137, 190, 12, 118, 178, 146, 3, 52, 3, 155, 250, 139, 61, 54, 141, 97];

pub const DISPUTE_WINDOW_SECONDS: i64 = 60;           // 1 minute (devnet testing — restore to 86_400 for production)
pub const DISPUTE_BOND_PERCENT: u64 = 10;             // 10% of stake
pub const DISPUTE_BOUNTY_PERCENT: u64 = 30;           // 30% of slash amount
pub const PHASH_HAMMING_THRESHOLD: u32 = 8;
pub const SLASH_GRACE_PERIOD_SECONDS: i64 = 48 * 3600; // 48 hours

#[program]
pub mod commit {
    use super::*;

    pub fn create_streak(ctx: Context<CreateStreak>, args: CreateStreakArgs) -> Result<()> {
        instructions::create_streak::handler(ctx, args)
    }

    pub fn join_streak(ctx: Context<JoinStreak>) -> Result<()> {
        instructions::join_streak::handler(ctx)
    }

    pub fn submit_checkin_with_attestation(
        ctx: Context<SubmitCheckinWithAttestation>,
        args: SubmitCheckinArgs,
    ) -> Result<()> {
        instructions::submit_checkin_with_attestation::handler(ctx, args)
    }

    pub fn dispute_checkin(ctx: Context<DisputeCheckin>) -> Result<()> {
        instructions::dispute_checkin::handler(ctx)
    }

    pub fn resolve_dispute(ctx: Context<ResolveDispute>, args: ResolveDisputeArgs) -> Result<()> {
        instructions::resolve_dispute::handler(ctx, args)
    }

    pub fn finalize_checkin(ctx: Context<FinalizeCheckin>) -> Result<()> {
        instructions::finalize_checkin::handler(ctx)
    }

    pub fn slash_missed(ctx: Context<SlashMissed>) -> Result<()> {
        instructions::slash_missed::handler(ctx)
    }

    pub fn claim_reward(ctx: Context<ClaimReward>) -> Result<()> {
        instructions::claim_reward::handler(ctx)
    }

    pub fn withdraw_failed(ctx: Context<WithdrawFailed>) -> Result<()> {
        instructions::withdraw_failed::handler(ctx)
    }
}
