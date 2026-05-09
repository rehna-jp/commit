// Permissionless: after 24h dispute window closes, lock in the check-in and append pHash.
use anchor_lang::prelude::*;
use crate::state::{AttestationState, CheckinAttestation, Participant, PhashRegistry};
use crate::errors::CommitError;

#[derive(Accounts)]
pub struct FinalizeCheckin<'info> {
    #[account(mut)]
    pub attestation: Account<'info, CheckinAttestation>,

    #[account(
        mut,
        seeds = [b"participant", attestation.streak.as_ref(), participant.user.as_ref()],
        bump = participant.bump,
        has_one = streak @ CommitError::InvalidSignature,
    )]
    pub participant: Account<'info, Participant>,

    /// CHECK: streak pubkey stored in attestation
    #[account(address = attestation.streak)]
    pub streak: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"phash", attestation.streak.as_ref()],
        bump = phash_registry.bump,
    )]
    pub phash_registry: Account<'info, PhashRegistry>,

    /// Permissionless — anyone can finalize after the window
    pub caller: Signer<'info>,
}

pub fn handler(ctx: Context<FinalizeCheckin>) -> Result<()> {
    let attestation = &mut ctx.accounts.attestation;

    require!(
        attestation.state == AttestationState::Pending,
        CommitError::AttestationNotPending
    );
    require!(
        Clock::get()?.unix_timestamp >= attestation.dispute_window_ends,
        CommitError::DisputeWindowOpen
    );

    attestation.state = AttestationState::Finalized;
    attestation.final_verdict = Some(true);

    ctx.accounts.phash_registry.hashes.push(attestation.phash);

    let participant = &mut ctx.accounts.participant;
    participant.current_streak = participant
        .current_streak
        .checked_add(1)
        .ok_or(CommitError::Overflow)?;
    participant.last_finalized_day = attestation.day_index;

    Ok(())
}
