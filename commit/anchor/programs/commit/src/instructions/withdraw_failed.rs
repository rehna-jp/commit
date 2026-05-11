// After a streak ends, a participant who did not complete can reclaim their remaining stake.
// Slash penalties already paid are forfeited; only the unslashed remainder is returned.
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::state::{Participant, Streak};
use crate::errors::CommitError;

#[derive(Accounts)]
pub struct WithdrawFailed<'info> {
    #[account(mut)]
    pub streak: Account<'info, Streak>,

    #[account(
        mut,
        has_one = streak,
        seeds = [b"participant", streak.key().as_ref(), user.key().as_ref()],
        bump = participant.bump,
    )]
    pub participant: Account<'info, Participant>,

    #[account(
        mut,
        seeds = [b"escrow", streak.key().as_ref()],
        bump,
        token::mint = usdc_mint,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = user,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<WithdrawFailed>) -> Result<()> {
    let streak = &ctx.accounts.streak;
    let participant = &ctx.accounts.participant;

    require!(participant.is_active, CommitError::ParticipantInactive);
    require!(!participant.has_claimed, CommitError::AlreadyClaimed);

    // Streak must have fully elapsed before withdrawing
    let streak_end = streak
        .start_timestamp
        .checked_add(streak.duration_days as i64 * 86_400)
        .ok_or(CommitError::Overflow)?;
    require!(
        Clock::get()?.unix_timestamp >= streak_end,
        CommitError::StreakNotEnded,
    );

    // Must not have completed — completers must use claim_reward
    require!(
        (participant.current_streak as u8) < streak.duration_days,
        CommitError::StreakComplete,
    );

    let refund = participant.stake_locked;

    let streak_name = streak.name.clone();
    let streak_creator = streak.creator;
    let streak_bump = streak.bump;

    let signer_seeds: &[&[u8]] = &[
        b"streak",
        streak_creator.as_ref(),
        streak_name.as_bytes(),
        &[streak_bump],
    ];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.escrow_token_account.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.streak.to_account_info(),
            },
            &[signer_seeds],
        ),
        refund,
    )?;

    let participant = &mut ctx.accounts.participant;
    participant.stake_locked = 0;
    participant.is_active = false;
    participant.has_claimed = true;

    ctx.accounts.streak.active_count = ctx.accounts.streak.active_count.saturating_sub(1);

    Ok(())
}
