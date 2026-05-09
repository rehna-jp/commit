// Counter-attestation resolves a disputed check-in and distributes bonds.
use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::state::{AttestationState, CheckinAttestation, Participant, Streak};
use crate::errors::CommitError;
use crate::utils::{parse_attestation_msg, verify_ed25519_ix};
use crate::{DISPUTE_BOUNTY_PERCENT, VERIFIER_PUBKEY};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ResolveDisputeArgs {
    pub counter_verdict: bool,
    pub counter_reason_hash: [u8; 32],
    pub counter_signature: [u8; 64],
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
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

    /// CHECK: disputer wallet — verified against attestation.disputer
    #[account(
        mut,
        constraint = Some(disputer.key()) == attestation.disputer @ CommitError::InvalidSignature
    )]
    pub disputer: UncheckedAccount<'info>,

    #[account(mut, token::mint = usdc_mint)]
    pub disputer_token_account: Account<'info, TokenAccount>,

    #[account(mut, token::mint = usdc_mint)]
    pub target_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"escrow", streak.key().as_ref()],
        bump,
        token::mint = usdc_mint,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,

    /// Anyone can call resolve — permissionless
    pub resolver: Signer<'info>,

    /// CHECK: instructions sysvar
    #[account(address = sysvar::instructions::ID)]
    pub instructions_sysvar: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ResolveDispute>, args: ResolveDisputeArgs) -> Result<()> {
    require!(
        ctx.accounts.attestation.state == AttestationState::Disputed,
        CommitError::AttestationNotDisputed
    );

    // Verify counter-attestation ed25519 instruction at index 0
    let msg = verify_ed25519_ix(
        &ctx.accounts.instructions_sysvar.to_account_info(),
        &VERIFIER_PUBKEY,
    )?;
    let counter = parse_attestation_msg(&msg);

    // Copy immutable fields before any mutable borrows
    let original_user = ctx.accounts.target_participant.user;
    let streak_key = ctx.accounts.streak.key();
    let attest_day_index = ctx.accounts.attestation.day_index;
    let attest_photo_hash = ctx.accounts.attestation.photo_hash;
    let attest_phash = ctx.accounts.attestation.phash;
    let dispute_bond = ctx.accounts.attestation.dispute_bond;
    let stake_locked = ctx.accounts.target_participant.stake_locked;
    let penalty_percent = ctx.accounts.streak.penalty_percent;
    let streak_bump = ctx.accounts.streak.bump;
    let streak_creator = ctx.accounts.streak.creator;
    let streak_name = ctx.accounts.streak.name.clone();

    // Validate counter-attestation binds to the same original check-in
    require_keys_eq!(counter.user, original_user, CommitError::CounterAttestationMismatch);
    require_keys_eq!(counter.streak, streak_key, CommitError::CounterAttestationMismatch);
    require!(counter.day_index == attest_day_index, CommitError::CounterAttestationMismatch);
    require!(counter.photo_hash == attest_photo_hash, CommitError::CounterAttestationMismatch);
    require!(counter.phash == attest_phash, CommitError::CounterAttestationMismatch);
    require!(counter.verdict == args.counter_verdict, CommitError::CounterAttestationMismatch);
    require!(counter.reason_hash == args.counter_reason_hash, CommitError::CounterAttestationMismatch);

    let streak_seeds: &[&[u8]] = &[
        b"streak",
        streak_creator.as_ref(),
        streak_name.as_bytes(),
        &[streak_bump],
    ];
    let signer_seeds = &[streak_seeds];

    if args.counter_verdict {
        // Dispute FAILS — original check-in confirmed valid. Bond goes to original participant.
        ctx.accounts.attestation.state = AttestationState::Finalized;
        ctx.accounts.attestation.final_verdict = Some(true);

        let p = &mut ctx.accounts.target_participant;
        p.current_streak = p.current_streak.checked_add(1).ok_or(CommitError::Overflow)?;
        p.last_finalized_day = attest_day_index;
        p.disputes_filed_against = p.disputes_filed_against.checked_add(1).ok_or(CommitError::Overflow)?;

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_token_account.to_account_info(),
                    to: ctx.accounts.target_token_account.to_account_info(),
                    authority: ctx.accounts.streak.to_account_info(),
                },
                signer_seeds,
            ),
            dispute_bond,
        )?;
    } else {
        // Dispute SUCCEEDS — original check-in overturned. Slash original; reward disputer.
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
        let now_inactive = p.stake_locked == 0;

        if now_inactive {
            ctx.accounts.target_participant.is_active = false;
            ctx.accounts.streak.active_count = ctx.accounts.streak.active_count.saturating_sub(1);
        }

        ctx.accounts.streak.total_pool = ctx
            .accounts
            .streak
            .total_pool
            .checked_add(pool_addition)
            .ok_or(CommitError::Overflow)?;

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_token_account.to_account_info(),
                    to: ctx.accounts.disputer_token_account.to_account_info(),
                    authority: ctx.accounts.streak.to_account_info(),
                },
                signer_seeds,
            ),
            disputer_payout,
        )?;
    }

    Ok(())
}
