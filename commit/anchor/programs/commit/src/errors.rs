use anchor_lang::prelude::*;

#[error_code]
pub enum CommitError {
    #[msg("Cannot join after streak has started")]
    StreakAlreadyStarted,
    #[msg("Streak is full")]
    StreakFull,
    #[msg("Day index does not match elapsed time")]
    InvalidDayIndex,
    #[msg("Missing ed25519 sigverify instruction")]
    MissingSigVerify,
    #[msg("Signature verification failed")]
    InvalidSignature,
    #[msg("Verifier rejected the check-in")]
    VerdictWasReject,
    #[msg("Photo too similar to a previous check-in")]
    PhotoReuseDetected,
    #[msg("Dispute window has closed")]
    DisputeWindowClosed,
    #[msg("Dispute window is still open")]
    DisputeWindowOpen,
    #[msg("Cannot dispute your own attestation")]
    NotADifferentParticipant,
    #[msg("Attestation is not in Pending state")]
    AttestationNotPending,
    #[msg("Attestation is not in Disputed state")]
    AttestationNotDisputed,
    #[msg("Counter-attestation does not match original")]
    CounterAttestationMismatch,
    #[msg("Participant is not active")]
    ParticipantInactive,
    #[msg("Streak not yet complete")]
    StreakIncomplete,
    #[msg("Too early to slash — missed day has not fully elapsed yet")]
    TooEarlyToSlash,
    #[msg("Name too long (max 64)")]
    NameTooLong,
    #[msg("Prompt too long (max 256)")]
    PromptTooLong,
    #[msg("Invalid duration")]
    InvalidDuration,
    #[msg("Invalid penalty percent")]
    InvalidPenaltyPercent,
    #[msg("Invalid stake amount")]
    InvalidStakeAmount,
    #[msg("Invalid max participants")]
    InvalidMaxParticipants,
    #[msg("Start time must be in the future")]
    InvalidStartTime,
    #[msg("Already claimed")]
    AlreadyClaimed,
    #[msg("Streak has not ended yet")]
    StreakNotEnded,
    #[msg("Streak was completed — use claim_reward instead")]
    StreakComplete,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Cannot cancel a streak that has participants")]
    HasParticipants,
    #[msg("Only the creator can cancel before the streak starts")]
    OnlyCreatorCanCancelBeforeStart,
}
