// Post a USDC bond and mark an attestation as Disputed.
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::state::{AttestationState, CheckinAttestation, Participant, Streak};
use crate::errors::CommitError;
use crate::{DISPUTE_BOND_PERCENT, DISPUTE_WINDOW_SECONDS};

#[derive(Accounts)]
pub struct DisputeCheckin<'info> {
    pub streak: Account<'info, Streak>,

    /// The participant whose check-in is being disputed
    pub target_participant: Account<'info, Participant>,

    #[account(
        mut,
        has_one = streak,
        seeds = [b"attestation", target_participant.key().as_ref(), &attestation.day_index.to_le_bytes()],
        bump = attestation.bump,
    )]
    pub attestation: Account<'info, CheckinAttestation>,

    /// The disputer's own Participant account in this streak
    #[account(
        has_one = streak,
        constraint = disputer_participant.user == disputer_user.key() @ CommitError::InvalidSignature,
        constraint = disputer_participant.key() != target_participant.key() @ CommitError::NotADifferentParticipant,
    )]
    pub disputer_participant: Account<'info, Participant>,

    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = disputer_user,
    )]
    pub disputer_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"escrow", streak.key().as_ref()],
        bump,
        token::mint = usdc_mint,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(mut)]
    pub disputer_user: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<DisputeCheckin>) -> Result<()> {
    let disputer_participant = &ctx.accounts.disputer_participant;
    let attestation = &mut ctx.accounts.attestation;
    let streak = &ctx.accounts.streak;

    require!(disputer_participant.is_active, CommitError::ParticipantInactive);
    require!(
        attestation.state == AttestationState::Pending,
        CommitError::AttestationNotPending
    );
    require!(
        Clock::get()?.unix_timestamp < attestation.dispute_window_ends,
        CommitError::DisputeWindowClosed
    );

    let dispute_bond = streak
        .stake_amount
        .checked_mul(DISPUTE_BOND_PERCENT)
        .ok_or(CommitError::Overflow)?
        .checked_div(100)
        .ok_or(CommitError::Overflow)?;

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.disputer_token_account.to_account_info(),
                to: ctx.accounts.escrow_token_account.to_account_info(),
                authority: ctx.accounts.disputer_user.to_account_info(),
            },
        ),
        dispute_bond,
    )?;

    let now = Clock::get()?.unix_timestamp;
    attestation.state = AttestationState::Disputed;
    attestation.disputer = Some(ctx.accounts.disputer_user.key());
    attestation.dispute_bond = dispute_bond;
    // Extend window by another 24h from now
    attestation.dispute_window_ends = now
        .checked_add(DISPUTE_WINDOW_SECONDS)
        .ok_or(CommitError::Overflow)?;

    Ok(())
}
