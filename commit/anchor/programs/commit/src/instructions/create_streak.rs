// Initialize a new Streak, PhashRegistry, and USDC escrow token account.
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use crate::state::{HabitType, PhashRegistry, Streak};
use crate::errors::CommitError;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CreateStreakArgs {
    pub name: String,
    pub habit_type: HabitType,
    pub habit_prompt: String,
    pub duration_days: u8,
    pub stake_amount: u64,
    pub penalty_percent: u8,
    pub start_timestamp: i64,
    pub max_participants: u32,
}

#[derive(Accounts)]
#[instruction(args: CreateStreakArgs)]
pub struct CreateStreak<'info> {
    #[account(
        init,
        payer = creator,
        space = Streak::LEN,
        seeds = [b"streak", creator.key().as_ref(), args.name.as_bytes()],
        bump
    )]
    pub streak: Account<'info, Streak>,

    #[account(
        init,
        payer = creator,
        space = PhashRegistry::space(args.duration_days, args.max_participants),
        seeds = [b"phash", streak.key().as_ref()],
        bump
    )]
    pub phash_registry: Account<'info, PhashRegistry>,

    #[account(
        init,
        payer = creator,
        token::mint = usdc_mint,
        token::authority = streak,
        seeds = [b"escrow", streak.key().as_ref()],
        bump
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<CreateStreak>, args: CreateStreakArgs) -> Result<()> {
    require!(args.name.len() <= Streak::MAX_NAME_LEN, CommitError::NameTooLong);
    require!(args.habit_prompt.len() <= Streak::MAX_PROMPT_LEN, CommitError::PromptTooLong);
    require!(args.duration_days >= 1 && args.duration_days <= 90, CommitError::InvalidDuration);
    require!(
        args.penalty_percent >= 1 && args.penalty_percent <= 100,
        CommitError::InvalidPenaltyPercent
    );
    require!(args.stake_amount > 0, CommitError::InvalidStakeAmount);
    require!(
        args.max_participants >= 2 && args.max_participants <= 50,
        CommitError::InvalidMaxParticipants
    );
    require!(
        args.start_timestamp > Clock::get()?.unix_timestamp,
        CommitError::InvalidStartTime
    );

    let streak = &mut ctx.accounts.streak;
    streak.creator = ctx.accounts.creator.key();
    streak.name = args.name;
    streak.habit_type = args.habit_type;
    streak.habit_prompt = args.habit_prompt;
    streak.duration_days = args.duration_days;
    streak.stake_amount = args.stake_amount;
    streak.penalty_percent = args.penalty_percent;
    streak.max_participants = args.max_participants;
    streak.start_timestamp = args.start_timestamp;
    streak.total_pool = 0;
    streak.participant_count = 0;
    streak.active_count = 0;
    streak.completed_count = 0;
    streak.escrow_token_account = ctx.accounts.escrow_token_account.key();
    streak.phash_registry = ctx.accounts.phash_registry.key();
    streak.bump = ctx.bumps.streak;

    let phash_registry = &mut ctx.accounts.phash_registry;
    phash_registry.streak = streak.key();
    phash_registry.hashes = Vec::new();
    phash_registry.bump = ctx.bumps.phash_registry;

    Ok(())
}
