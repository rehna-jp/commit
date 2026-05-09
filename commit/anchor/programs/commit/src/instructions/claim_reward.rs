// Return stake + pool share, mint a soulbound Token-2022 NFT, create StreakProof.
use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, program::invoke_signed, system_instruction};
use anchor_spl::associated_token::{self, AssociatedToken, Create};
use anchor_spl::token::{self, Mint as SplMint, Token, TokenAccount, Transfer};
use anchor_spl::token_2022::Token2022;
use spl_token_2022::{
    extension::{metadata_pointer, ExtensionType},
    instruction as token_2022_ix,
    state::Mint as T22Mint,
};
use spl_token_metadata_interface::instruction as metadata_ix;
use crate::state::{HabitType, Participant, Streak, StreakProof};
use crate::errors::CommitError;

// Max TLV bytes for TokenMetadata content (name≤72, symbol=6, uri=0, 4 fields, framing).
const METADATA_TLV_MAX: usize = 350;

#[derive(Accounts)]
pub struct ClaimReward<'info> {
    #[account(mut)]
    pub streak: Box<Account<'info, Streak>>,

    #[account(
        mut,
        has_one = streak,
        seeds = [b"participant", streak.key().as_ref(), user.key().as_ref()],
        bump = participant.bump,
    )]
    pub participant: Box<Account<'info, Participant>>,

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

    pub usdc_mint: Account<'info, SplMint>,

    /// CHECK: new Token-2022 mint — created in handler via CPI
    #[account(mut)]
    pub completion_mint: Signer<'info>,

    /// CHECK: user's Token-2022 ATA — created in handler via associated_token CPI
    #[account(mut)]
    pub user_nft_ata: UncheckedAccount<'info>,

    #[account(
        init,
        payer = user,
        space = StreakProof::space(streak.duration_days),
        seeds = [b"proof", streak.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub streak_proof: Account<'info, StreakProof>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub token_2022_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<ClaimReward>) -> Result<()> {
    let participant = &ctx.accounts.participant;
    let streak = &ctx.accounts.streak;

    require!(participant.is_active, CommitError::ParticipantInactive);
    require!(!participant.has_claimed, CommitError::AlreadyClaimed);
    require!(
        participant.current_streak >= streak.duration_days as u16,
        CommitError::StreakIncomplete
    );

    let pool_share = if streak.active_count > 0 {
        streak.total_pool / streak.active_count as u64
    } else {
        0
    };

    let total_payout = participant
        .stake_locked
        .checked_add(pool_share)
        .ok_or(CommitError::Overflow)?;

    // Copy fields needed for signer seeds before borrowing streak mutably
    let streak_bump = streak.bump;
    let streak_creator = streak.creator;
    let streak_name = streak.name.clone();
    let streak_duration = streak.duration_days;
    let streak_stake = participant.stake_locked;
    let streak_habit = streak.habit_type;

    let streak_seeds: &[&[u8]] = &[
        b"streak",
        streak_creator.as_ref(),
        streak_name.as_bytes(),
        &[streak_bump],
    ];
    let signer_seeds = &[streak_seeds];

    // Return stake + pool share to user
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.escrow_token_account.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.streak.to_account_info(),
            },
            signer_seeds,
        ),
        total_payout,
    )?;

    mint_soulbound_nft(&ctx, signer_seeds, &streak_name, streak_habit)?;

    let now = Clock::get()?.unix_timestamp;

    let proof = &mut ctx.accounts.streak_proof;
    proof.owner = ctx.accounts.user.key();
    proof.mint = ctx.accounts.completion_mint.key();
    proof.streak = ctx.accounts.streak.key();
    proof.habit_name = streak_name;
    proof.duration_days = streak_duration;
    proof.stake_lamports = streak_stake;
    proof.pool_share_lamports = pool_share;
    proof.completed_at = now;
    proof.attestation_hashes = Vec::new();
    proof.disputes_filed_against = ctx.accounts.participant.disputes_filed_against;
    proof.disputes_upheld = ctx.accounts.participant.disputes_upheld;
    proof.bump = ctx.bumps.streak_proof;

    let participant = &mut ctx.accounts.participant;
    participant.has_claimed = true;
    participant.is_active = false;

    ctx.accounts.streak.total_pool = ctx
        .accounts
        .streak
        .total_pool
        .saturating_sub(pool_share);
    ctx.accounts.streak.active_count = ctx.accounts.streak.active_count.saturating_sub(1);
    ctx.accounts.streak.completed_count = ctx
        .accounts
        .streak
        .completed_count
        .checked_add(1)
        .ok_or(CommitError::Overflow)?;

    Ok(())
}

fn mint_soulbound_nft(
    ctx: &Context<ClaimReward>,
    signer_seeds: &[&[&[u8]]],
    streak_name: &str,
    habit_type: HabitType,
) -> Result<()> {
    let mint_key = ctx.accounts.completion_mint.key();
    let streak_key = ctx.accounts.streak.key();
    let user_key = ctx.accounts.user.key();
    let t22_program = ctx.accounts.token_2022_program.key();

    let nft_name = format!("commit: {}", streak_name);
    let nft_symbol = "COMMIT".to_string();
    let nft_uri = String::new();

    let habit_str = match habit_type {
        HabitType::Code => "Code",
        HabitType::Read => "Read",
        HabitType::Write => "Write",
        HabitType::Design => "Design",
        HabitType::Gym => "Gym",
    };

    // Exact byte count for Mint + NonTransferable(type=9) + MetadataPointer(type=18):
    //   165 (Account::LEN base) + 1 (AccountType byte) + 4 (NonTransferable TLV hdr) +
    //   4 (MetadataPointer TLV hdr) + 64 (MetadataPointer data: 2×Pubkey) = 238.
    // spl-token-2022 v8.0.1 try_calculate_account_len omits the AccountType byte (returns 237);
    // we hard-code the correct value so the on-chain Token-2022 program accepts the account.
    let base_size: usize = 238;

    let rent = Rent::get()?;
    let base_lamports = rent.minimum_balance(base_size);

    // 1. Create the mint account with the exact base extension size.
    invoke(
        &system_instruction::create_account(
            &user_key,
            &mint_key,
            base_lamports,
            base_size as u64,
            &t22_program,
        ),
        &[
            ctx.accounts.user.to_account_info(),
            ctx.accounts.completion_mint.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;

    // 2. Initialize NonTransferable extension (type=9) — must come before MetadataPointer (type=18)
    //    Token-2022 requires extensions to be initialized in ascending ExtensionType order.
    invoke(
        &token_2022_ix::initialize_non_transferable_mint(&t22_program, &mint_key)
            .map_err(|_| CommitError::Overflow)?,
        &[ctx.accounts.completion_mint.to_account_info()],
    )?;

    // 3. Initialize MetadataPointer (points to mint itself, update authority = streak PDA)
    invoke(
        &metadata_pointer::instruction::initialize(
            &t22_program,
            &mint_key,
            Some(streak_key),
            Some(mint_key),
        )
        .map_err(|_| CommitError::Overflow)?,
        &[ctx.accounts.completion_mint.to_account_info()],
    )?;

    // 4. Initialize mint (0 decimals = NFT), mint authority = streak PDA
    invoke(
        &token_2022_ix::initialize_mint2(&t22_program, &mint_key, &streak_key, None, 0)
            .map_err(|_| CommitError::Overflow)?,
        &[ctx.accounts.completion_mint.to_account_info()],
    )?;

    // 4b. Pre-fund the mint account with enough lamports to cover TokenMetadata TLV expansion.
    //     The metadata instructions will realloc the account; we pay the extra rent upfront.
    let metadata_lamports = rent.minimum_balance(base_size + METADATA_TLV_MAX);
    let extra_lamports = metadata_lamports.saturating_sub(base_lamports);
    if extra_lamports > 0 {
        invoke(
            &system_instruction::transfer(&user_key, &mint_key, extra_lamports),
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.completion_mint.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
    }

    // 5. Initialize TokenMetadata
    invoke_signed(
        &metadata_ix::initialize(
            &t22_program,
            &mint_key,
            &streak_key,
            &mint_key,
            &streak_key,
            nft_name,
            nft_symbol,
            nft_uri,
        ),
        &[
            ctx.accounts.completion_mint.to_account_info(),
            ctx.accounts.streak.to_account_info(),
        ],
        signer_seeds,
    )?;

    // 6. Add additional metadata key-value pairs
    let fields = [
        ("streak", streak_key.to_string()),
        ("duration_days", ctx.accounts.streak.duration_days.to_string()),
        ("stake_amount", ctx.accounts.streak.stake_amount.to_string()),
        ("habit_type", habit_str.to_string()),
    ];

    for (key, value) in &fields {
        invoke_signed(
            &metadata_ix::update_field(
                &t22_program,
                &mint_key,
                &streak_key,
                spl_token_metadata_interface::state::Field::Key(key.to_string()),
                value.clone(),
            ),
            &[
                ctx.accounts.completion_mint.to_account_info(),
                ctx.accounts.streak.to_account_info(),
            ],
            signer_seeds,
        )?;
    }

    // 7. Create user's Token-2022 ATA
    associated_token::create(
        CpiContext::new(
            ctx.accounts.associated_token_program.to_account_info(),
            Create {
                payer: ctx.accounts.user.to_account_info(),
                associated_token: ctx.accounts.user_nft_ata.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
                mint: ctx.accounts.completion_mint.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                token_program: ctx.accounts.token_2022_program.to_account_info(),
            },
        ),
    )?;

    // 8. Mint 1 token to user's ATA, signed by streak PDA
    invoke_signed(
        &token_2022_ix::mint_to(
            &t22_program,
            &mint_key,
            &ctx.accounts.user_nft_ata.key(),
            &streak_key,
            &[],
            1,
        )
        .map_err(|_| CommitError::Overflow)?,
        &[
            ctx.accounts.completion_mint.to_account_info(),
            ctx.accounts.user_nft_ata.to_account_info(),
            ctx.accounts.streak.to_account_info(),
        ],
        signer_seeds,
    )?;

    // 9. Revoke mint authority (permanently soulbound — no further minting)
    invoke_signed(
        &token_2022_ix::set_authority(
            &t22_program,
            &mint_key,
            None,
            token_2022_ix::AuthorityType::MintTokens,
            &streak_key,
            &[],
        )
        .map_err(|_| CommitError::Overflow)?,
        &[
            ctx.accounts.completion_mint.to_account_info(),
            ctx.accounts.streak.to_account_info(),
        ],
        signer_seeds,
    )?;

    Ok(())
}
