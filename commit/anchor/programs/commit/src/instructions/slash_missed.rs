// Permissionless: slash a participant who missed a check-in after the 48h grace period.
use anchor_lang::prelude::*;
use crate::state::{Participant, Streak};
use crate::errors::CommitError;
use crate::SLASH_GRACE_PERIOD_SECONDS;

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

    /// Permissionless — anyone can slash after the grace period
    pub caller: Signer<'info>,
}

pub fn handler(ctx: Context<SlashMissed>) -> Result<()> {
    let participant = &ctx.accounts.participant;
    let streak = &ctx.accounts.streak;

    require!(participant.is_active, CommitError::ParticipantInactive);

    let now = Clock::get()?.unix_timestamp;
    let expected_day = ((now - streak.start_timestamp) / 86400) as u16;

    // Must have missed at least one full day
    require!(
        participant.last_finalized_day < expected_day.saturating_sub(1),
        CommitError::TooEarlyToSlash
    );

    // Must be past the 48h grace period since last check-in (or never checked in)
    let last_ts = participant.last_checkin_timestamp;
    require!(
        last_ts == 0 || now - last_ts > SLASH_GRACE_PERIOD_SECONDS,
        CommitError::TooEarlyToSlash
    );

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
