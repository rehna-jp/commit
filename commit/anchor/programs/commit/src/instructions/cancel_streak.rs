// Close an empty streak and recover rent. Two paths:
// — Creator before start_timestamp: voluntary cancel (e.g. changed mind, no takers yet).
// — Anyone after start_timestamp: permissionless garbage collection; rent still goes to creator.
// Both paths require participant_count == 0 — once someone stakes, the streak is immutable.
use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount};
use crate::state::{PhashRegistry, Streak};
use crate::errors::CommitError;

#[derive(Accounts)]
pub struct CancelStreak<'info> {
    #[account(
        mut,
        close = creator,
        seeds = [b"streak", streak.creator.as_ref(), streak.name.as_bytes()],
        bump = streak.bump,
    )]
    pub streak: Account<'info, Streak>,

    #[account(
        mut,
        close = creator,
        seeds = [b"phash", streak.key().as_ref()],
        bump = phash_registry.bump,
    )]
    pub phash_registry: Account<'info, PhashRegistry>,

    #[account(
        mut,
        seeds = [b"escrow", streak.key().as_ref()],
        bump,
        token::mint = usdc_mint,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,

    /// CHECK: receives all rent from the three closed accounts; verified == streak.creator
    #[account(mut, address = streak.creator)]
    pub creator: AccountInfo<'info>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CancelStreak>) -> Result<()> {
    let streak = &ctx.accounts.streak;
    let now = Clock::get()?.unix_timestamp;

    require!(streak.participant_count == 0, CommitError::HasParticipants);

    // Before start: only the creator may cancel.
    // After start with zero participants: anyone may trigger cleanup.
    if now < streak.start_timestamp {
        require!(
            ctx.accounts.signer.key() == streak.creator,
            CommitError::OnlyCreatorCanCancelBeforeStart,
        );
    }

    // Close the escrow token account (empty — no participants means zero balance).
    // Use the streak PDA as the authority; it is closed by Anchor after this handler returns.
    let streak_name = streak.name.clone();
    let streak_creator = streak.creator;
    let streak_bump = streak.bump;

    let signer_seeds: &[&[u8]] = &[
        b"streak",
        streak_creator.as_ref(),
        streak_name.as_bytes(),
        &[streak_bump],
    ];

    token::close_account(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            CloseAccount {
                account: ctx.accounts.escrow_token_account.to_account_info(),
                destination: ctx.accounts.creator.to_account_info(),
                authority: ctx.accounts.streak.to_account_info(),
            },
            &[signer_seeds],
        ),
    )?;

    Ok(())
}
