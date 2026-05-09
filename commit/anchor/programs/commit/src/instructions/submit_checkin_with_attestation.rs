// Verify ed25519 attestation, check pHash, create Pending CheckinAttestation.
use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar;
use crate::state::{AttestationState, CheckinAttestation, Participant, PhashRegistry, Streak};
use crate::errors::CommitError;
use crate::utils::{parse_attestation_msg, verify_ed25519_ix, ATTESTATION_MSG_LEN};
use crate::{DISPUTE_WINDOW_SECONDS, PHASH_HAMMING_THRESHOLD, VERIFIER_PUBKEY};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct SubmitCheckinArgs {
    pub day_index: u16,
    pub photo_hash: [u8; 32],
    pub phash: u64,
    pub verdict: bool,
    pub reason_hash: [u8; 32],
    pub verifier_signature: [u8; 64],
}

#[derive(Accounts)]
#[instruction(args: SubmitCheckinArgs)]
pub struct SubmitCheckinWithAttestation<'info> {
    pub streak: Box<Account<'info, Streak>>,

    #[account(
        mut,
        seeds = [b"participant", streak.key().as_ref(), participant_user.key().as_ref()],
        bump = participant.bump,
        has_one = streak,
    )]
    pub participant: Box<Account<'info, Participant>>,

    #[account(
        init,
        payer = participant_user,
        space = CheckinAttestation::LEN,
        seeds = [b"attestation", participant.key().as_ref(), &args.day_index.to_le_bytes()],
        bump
    )]
    pub attestation: Account<'info, CheckinAttestation>,

    #[account(
        seeds = [b"phash", streak.key().as_ref()],
        bump = phash_registry.bump,
        has_one = streak,
    )]
    pub phash_registry: Account<'info, PhashRegistry>,

    #[account(mut)]
    pub participant_user: Signer<'info>,

    /// CHECK: instructions sysvar, verified by address constraint
    #[account(address = sysvar::instructions::ID)]
    pub instructions_sysvar: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<SubmitCheckinWithAttestation>, args: SubmitCheckinArgs) -> Result<()> {
    let participant = &ctx.accounts.participant;
    let streak = &ctx.accounts.streak;

    require!(participant.is_active, CommitError::ParticipantInactive);
    require_keys_eq!(participant.user, ctx.accounts.participant_user.key(), CommitError::InvalidSignature);
    require!(args.verdict, CommitError::VerdictWasReject);

    // Verify the expected day index matches elapsed time
    let elapsed_days = ((Clock::get()?.unix_timestamp - streak.start_timestamp) / 86400) as u16;
    require!(args.day_index == elapsed_days, CommitError::InvalidDayIndex);

    // Verify ed25519 instruction at index 0
    let msg = verify_ed25519_ix(
        &ctx.accounts.instructions_sysvar.to_account_info(),
        &VERIFIER_PUBKEY,
    )?;

    let attest = parse_attestation_msg(&msg);

    // Verify message first 32 bytes are the verifier pubkey itself (anti-replay binding)
    require!(attest.verifier_pubkey == VERIFIER_PUBKEY, CommitError::InvalidSignature);
    // Verify message fields match the submitting participant and streak
    require_keys_eq!(attest.user, ctx.accounts.participant_user.key(), CommitError::InvalidSignature);
    require_keys_eq!(attest.streak, streak.key(), CommitError::InvalidSignature);
    require!(attest.day_index == args.day_index, CommitError::InvalidSignature);
    require!(attest.photo_hash == args.photo_hash, CommitError::InvalidSignature);
    require!(attest.phash == args.phash, CommitError::InvalidSignature);
    require!(attest.verdict == args.verdict, CommitError::InvalidSignature);
    require!(attest.reason_hash == args.reason_hash, CommitError::InvalidSignature);

    // pHash Hamming distance check against registry
    for &existing in &ctx.accounts.phash_registry.hashes {
        let dist = crate::utils::hamming_distance(existing, args.phash);
        require!(dist > PHASH_HAMMING_THRESHOLD, CommitError::PhotoReuseDetected);
    }

    let now = Clock::get()?.unix_timestamp;
    let dispute_window_ends = now
        .checked_add(DISPUTE_WINDOW_SECONDS)
        .ok_or(CommitError::Overflow)?;

    let attestation = &mut ctx.accounts.attestation;
    attestation.participant = ctx.accounts.participant.key();
    attestation.streak = streak.key();
    attestation.day_index = args.day_index;
    attestation.photo_hash = args.photo_hash;
    attestation.phash = args.phash;
    attestation.verifier_signature = args.verifier_signature;
    attestation.verdict = args.verdict;
    attestation.reason_hash = args.reason_hash;
    attestation.created_at = now;
    attestation.dispute_window_ends = dispute_window_ends;
    attestation.state = AttestationState::Pending;
    attestation.disputer = None;
    attestation.dispute_bond = 0;
    attestation.final_verdict = None;
    attestation.bump = ctx.bumps.attestation;

    let participant = &mut ctx.accounts.participant;
    participant.last_checkin_timestamp = now;

    Ok(())
}
