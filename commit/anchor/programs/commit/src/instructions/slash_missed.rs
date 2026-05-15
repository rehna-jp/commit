// Permissionless: slash a participant who missed a check-in once the day has fully elapsed.
use anchor_lang::prelude::*;
use crate::state::{Participant, Streak};
use crate::errors::CommitError;

#[derive(Accounts)]
pub struct SlashMissed<'info> {
    #[account(mut)]
    pub streak: Account<'info, Streak>,

    #[account(
        mut,
        has_one = streak,
        seeds = [b"participant", streak.key().as_ref(), participant.user.as_ref()],
        bump = participant.bump,
    )]
    pub participant: Account<'info, Participant>,

    /// Optional attestation for the day being slashed.
    /// If it exists and is Pending or Disputed the slash is blocked — the participant
    /// submitted on time and the outcome is not yet settled.
    /// CHECK: PDA seeds verified in handler; account may not exist yet.
    #[account()]
    pub day_attestation: UncheckedAccount<'info>,

    /// Permissionless — anyone can slash after the grace period
    pub caller: Signer<'info>,
}

pub fn handler(ctx: Context<SlashMissed>) -> Result<()> {
    let participant = &ctx.accounts.participant;
    let streak = &ctx.accounts.streak;

    require!(participant.is_active, CommitError::ParticipantInactive);

    let now = Clock::get()?.unix_timestamp;
    let expected_day = ((now - streak.start_timestamp) / 86_400) as u16;

    // current_streak = total days finalized; expected_day = total days elapsed.
    // A gap means at least one day was missed, even if the participant later resumed.
    require!(
        participant.current_streak < expected_day,
        CommitError::TooEarlyToSlash
    );

    // Slash callable once the next un-checked day has fully elapsed.
    // current_streak is the count of finalized days, so the first missed slot is
    // day index current_streak, which ends at startTimestamp + (current_streak + 1) * 86400.
    let slash_eligible_from = streak
        .start_timestamp
        .checked_add((participant.current_streak as i64 + 1) * 86_400)
        .ok_or(CommitError::Overflow)?;
    require!(now >= slash_eligible_from, CommitError::TooEarlyToSlash);

    // Guard: if an attestation exists for the day being slashed and is still
    // Pending or Disputed, the participant submitted on time — block the slash.
    let day_acct_empty = ctx.accounts.day_attestation.data_is_empty();
    if !day_acct_empty {
        // Verify the account is the correct PDA before trusting its data.
        let participant_key = ctx.accounts.participant.key();
        let day_bytes = participant.current_streak.to_le_bytes();
        let expected_seeds: &[&[u8]] = &[
            b"attestation",
            participant_key.as_ref(),
            &day_bytes,
        ];
        let (expected_pda, _) = Pubkey::find_program_address(expected_seeds, ctx.program_id);
        require_keys_eq!(ctx.accounts.day_attestation.key(), expected_pda, CommitError::InvalidSignature);

        // Read state byte directly. Layout (after 8-byte disc):
        // participant(32) streak(32) day_index(2) photo_hash(32) phash(8)
        // verifier_sig(64) verdict(1) reason_hash(32) created_at(8)
        // dispute_window_ends(8) → state at byte 227.
        // Borsh enum: Pending=0, Disputed=1, Finalized=2, Overturned=3.
        const STATE_OFFSET: usize = 227;
        let data = ctx.accounts.day_attestation.try_borrow_data()?;
        require!(data.len() > STATE_OFFSET, CommitError::InvalidSignature);
        let state_byte = data[STATE_OFFSET];
        drop(data);
        // Pending or Disputed — submission is still in flight
        require!(state_byte != 0 && state_byte != 1, CommitError::AttestationStillActive);
    }

    let slash = participant
        .stake_locked
        .checked_mul(streak.penalty_percent as u64)
        .ok_or(CommitError::Overflow)?
        .checked_div(100)
        .ok_or(CommitError::Overflow)?;

    let participant = &mut ctx.accounts.participant;
    participant.stake_locked = participant
        .stake_locked
        .checked_sub(slash)
        .ok_or(CommitError::Overflow)?;

    // Advance current_streak to mark this missed day as penalised.
    // Prevents double-slashing the same missed slot.
    participant.current_streak = participant
        .current_streak
        .checked_add(1)
        .ok_or(CommitError::Overflow)?;

    if participant.stake_locked == 0 {
        participant.is_active = false;
        ctx.accounts.streak.active_count = ctx.accounts.streak.active_count.saturating_sub(1);
    }

    ctx.accounts.streak.total_pool = ctx
        .accounts
        .streak
        .total_pool
        .checked_add(slash)
        .ok_or(CommitError::Overflow)?;

    Ok(())
}
