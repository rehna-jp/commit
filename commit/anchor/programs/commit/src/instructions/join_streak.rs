// Transfer stake from participant into escrow and create their Participant account.
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::state::{Participant, Streak};
use crate::errors::CommitError;

#[derive(Accounts)]
pub struct JoinStreak<'info> {
    #[account(mut)]
    pub streak: Account<'info, Streak>,

    #[account(
        init,
        payer = user,
        space = Participant::LEN,
        seeds = [b"participant", streak.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub participant: Account<'info, Participant>,

    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = user,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"escrow", streak.key().as_ref()],
        bump,
        token::mint = usdc_mint,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<JoinStreak>) -> Result<()> {
    let streak = &mut ctx.accounts.streak;

    require!(
        Clock::get()?.unix_timestamp < streak.start_timestamp,
        CommitError::StreakAlreadyStarted
    );
    require!(
        streak.participant_count < streak.max_participants,
        CommitError::StreakFull
    );

    let stake_amount = streak.stake_amount;

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token_account.to_account_info(),
                to: ctx.accounts.escrow_token_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        stake_amount,
    )?;

    let participant = &mut ctx.accounts.participant;
    participant.user = ctx.accounts.user.key();
    participant.streak = streak.key();
    participant.stake_locked = stake_amount;
    participant.current_streak = 0;
    participant.last_finalized_day = 0;
    participant.last_checkin_timestamp = 0;
    participant.is_active = true;
    participant.has_claimed = false;
    participant.disputes_filed_against = 0;
    participant.disputes_upheld = 0;
    participant.bump = ctx.bumps.participant;

    streak.participant_count = streak
        .participant_count
        .checked_add(1)
        .ok_or(CommitError::Overflow)?;
    streak.active_count = streak
        .active_count
        .checked_add(1)
        .ok_or(CommitError::Overflow)?;

    Ok(())
}
