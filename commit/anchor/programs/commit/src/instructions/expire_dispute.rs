// Permissionless: expire a dispute whose window has closed without a counter-attestation.
// The submitter failed to defend — treated as a dispute win. No verifier signature needed.
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::state::{AttestationState, CheckinAttestation, Participant, Streak};
use crate::errors::CommitError;
use crate::DISPUTE_BOUNTY_PERCENT;

#[derive(Accounts)]
pub struct ExpireDispute<'info> {
    #[account(mut)]
    pub streak: Box<Account<'info, Streak>>,

    #[account(mut)]
    pub target_participant: Box<Account<'info, Participant>>,

    #[account(
        mut,
        has_one = streak,
        seeds = [b"attestation", target_participant.key().as_ref(), &attestation.day_index.to_le_bytes()],
        bump = attestation.bump,
    )]
    pub attestation: Box<Account<'info, CheckinAttestation>>,

    /// CHECK: verified against attestation.disputer
    #[account(
        mut,
        constraint = Some(disputer.key()) == attestation.disputer @ CommitError::InvalidSignature
    )]
    pub disputer: UncheckedAccount<'info>,

    #[account(mut, token::mint = usdc_mint)]
    pub disputer_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"escrow", streak.key().as_ref()],
        bump,
        token::mint = usdc_mint,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,

    /// Permissionless — anyone can trigger expiry
    pub caller: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ExpireDispute>) -> Result<()> {
    require!(
        ctx.accounts.attestation.state == AttestationState::Disputed,
        CommitError::AttestationNotDisputed
    );

    let now = Clock::get()?.unix_timestamp;
    require!(
        now > ctx.accounts.attestation.dispute_window_ends,
        CommitError::DisputeWindowOpen
    );

    // Copy fields before mutable borrows
    let stake_locked = ctx.accounts.target_participant.stake_locked;
    let penalty_percent = ctx.accounts.streak.penalty_percent;
    let dispute_bond = ctx.accounts.attestation.dispute_bond;
    let streak_bump = ctx.accounts.streak.bump;
    let streak_creator = ctx.accounts.streak.creator;
    let streak_name = ctx.accounts.streak.name.clone();

    let slash = stake_locked
        .checked_mul(penalty_percent as u64)
        .ok_or(CommitError::Overflow)?
        .checked_div(100)
        .ok_or(CommitError::Overflow)?;

    let bounty = slash
        .checked_mul(DISPUTE_BOUNTY_PERCENT)
        .ok_or(CommitError::Overflow)?
        .checked_div(100)
        .ok_or(CommitError::Overflow)?;

    let disputer_payout = dispute_bond.checked_add(bounty).ok_or(CommitError::Overflow)?;
    let pool_addition = slash.saturating_sub(bounty);

    ctx.accounts.attestation.state = AttestationState::Overturned;
    ctx.accounts.attestation.final_verdict = Some(false);

    let p = &mut ctx.accounts.target_participant;
    p.stake_locked = p.stake_locked.checked_sub(slash).ok_or(CommitError::Overflow)?;
    p.disputes_filed_against = p.disputes_filed_against.checked_add(1).ok_or(CommitError::Overflow)?;
    p.disputes_upheld = p.disputes_upheld.checked_add(1).ok_or(CommitError::Overflow)?;

    if p.stake_locked == 0 {
        ctx.accounts.target_participant.is_active = false;
        ctx.accounts.streak.active_count = ctx.accounts.streak.active_count.saturating_sub(1);
    }

    ctx.accounts.streak.total_pool = ctx
        .accounts
        .streak
        .total_pool
        .checked_add(pool_addition)
        .ok_or(CommitError::Overflow)?;

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
                to: ctx.accounts.disputer_token_account.to_account_info(),
                authority: ctx.accounts.streak.to_account_info(),
            },
            &[signer_seeds],
        ),
        disputer_payout,
    )?;

    Ok(())
}
