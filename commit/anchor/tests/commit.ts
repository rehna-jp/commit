// Comprehensive Anchor test suite for the commit habit-stake protocol.
// Uses anchor-bankrun for fast local testing with clock manipulation.
// Ed25519 attestations are signed with a deterministic test verifier keypair
// whose public key matches VERIFIER_PUBKEY in lib.rs.

import * as anchor from "@coral-xyz/anchor";
import { BankrunProvider, startAnchor } from "anchor-bankrun";
import { Clock, ProgramTestContext } from "solana-bankrun";
import { Program, BN } from "@coral-xyz/anchor";
import { Commit } from "../target/types/commit";
import {
  Keypair,
  PublicKey,
  Transaction,
  Ed25519Program,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  createMintToInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  getAccount as getTokenAccount,
  getMint,
  ExtensionType,
  getExtensionTypes,
  MINT_SIZE,
} from "@solana/spl-token";
import * as nacl from "tweetnacl";
import { expect } from "chai";

// ─── Test verifier keypair ────────────────────────────────────────────────────
// Seed = 0x2A repeated 32 times. Matching VERIFIER_PUBKEY in lib.rs.
const VERIFIER_SEED = Buffer.alloc(32, 42);
const verifierKp = nacl.sign.keyPair.fromSeed(VERIFIER_SEED);
const VERIFIER_PK = Buffer.from(verifierKp.publicKey); // 32 bytes

const PROGRAM_ID = new PublicKey("3Gd8xHLKGjj8evBtwQUTnawSTwWdbeAxZmtVyxMPm29G");

// Timing constants
const BASE_TS = 1_000_000;    // arbitrary base unix timestamp
const ONE_DAY = 86_400;
const TWO_DAYS = 172_800;

// Stake config
const STAKE_AMOUNT = new BN(1_000_000);   // 1 USDC (6 decimals)
const PENALTY_PCT = 20;
const DURATION = 3;                        // 3-day streak for happy-path tests

// ─── 171-byte attestation message builder ─────────────────────────────────────
function buildAttestation(
  user: PublicKey,
  streak: PublicKey,
  day: number,
  photoHash: Buffer,  // 32 bytes
  phash: bigint,
  verdict: boolean,
  reasonHash: Buffer, // 32 bytes
): Buffer {
  const msg = Buffer.alloc(171);
  VERIFIER_PK.copy(msg, 0);
  Buffer.from(user.toBytes()).copy(msg, 32);
  Buffer.from(streak.toBytes()).copy(msg, 64);
  msg.writeUInt16LE(day, 96);
  photoHash.copy(msg, 98);
  msg.writeBigUInt64LE(phash, 130);
  msg[138] = verdict ? 1 : 0;
  reasonHash.copy(msg, 139);
  return msg;
}

// Build the ed25519 sigverify instruction (must be at tx index 0).
function ed25519Ix(msg: Buffer): { ix: anchor.web3.TransactionInstruction; sig: Buffer } {
  const sig = Buffer.from(nacl.sign.detached(msg, verifierKp.secretKey));
  const ix = Ed25519Program.createInstructionWithPublicKey({
    publicKey: VERIFIER_PK,
    message: msg,
    signature: sig,
  });
  return { ix, sig };
}

// ─── Bankrun helpers ──────────────────────────────────────────────────────────

async function getBlockhash(ctx: ProgramTestContext): Promise<string> {
  return (await ctx.banksClient.getLatestBlockhash())![0];
}

async function sendTx(
  ctx: ProgramTestContext,
  ixs: anchor.web3.TransactionInstruction[],
  signers: Keypair[],
): Promise<void> {
  const tx = new Transaction();
  tx.add(...ixs);
  tx.recentBlockhash = await getBlockhash(ctx);
  tx.feePayer = signers[0].publicKey;
  tx.sign(...signers);
  await ctx.banksClient.processTransaction(tx);
}

// Assert that a transaction fails with a specific Anchor error name in program logs.
async function expectAnchorError(
  ctx: ProgramTestContext,
  ixs: anchor.web3.TransactionInstruction[],
  signers: Keypair[],
  errorName: string,
): Promise<void> {
  const tx = new Transaction();
  tx.add(...ixs);
  tx.recentBlockhash = await getBlockhash(ctx);
  tx.feePayer = signers[0].publicKey;
  tx.sign(...signers);
  const res = await ctx.banksClient.tryProcessTransaction(tx);
  expect(res.result, `expected ${errorName} error but transaction succeeded`).to.not.be.null;
  const logs = res.meta?.logMessages?.join("\n") ?? "";
  expect(logs, `expected logs to contain "${errorName}"`).to.include(errorName);
}

async function setTs(ctx: ProgramTestContext, ts: number): Promise<void> {
  const c = await ctx.banksClient.getClock();
  ctx.setClock(new Clock(c.slot, c.epochStartTimestamp, c.epoch, c.leaderScheduleEpoch, BigInt(ts)));
}

async function advanceTs(ctx: ProgramTestContext, seconds: number): Promise<void> {
  const c = await ctx.banksClient.getClock();
  ctx.setClock(new Clock(
    c.slot, c.epochStartTimestamp, c.epoch, c.leaderScheduleEpoch,
    c.unixTimestamp + BigInt(seconds),
  ));
}

// ─── Token helpers ────────────────────────────────────────────────────────────

async function makeMint(ctx: ProgramTestContext, payer: Keypair, authority: PublicKey): Promise<Keypair> {
  const kp = Keypair.generate();
  const rent = await ctx.banksClient.getRent();
  await sendTx(ctx, [
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: kp.publicKey,
      lamports: Number(rent.minimumBalance(BigInt(MINT_SIZE))),
      space: MINT_SIZE,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMintInstruction(kp.publicKey, 6, authority, null),
  ], [payer, kp]);
  return kp;
}

async function fundedAta(
  ctx: ProgramTestContext,
  payer: Keypair,
  mint: PublicKey,
  mintAuth: Keypair,
  owner: PublicKey,
  amount: bigint,
): Promise<PublicKey> {
  const ata = getAssociatedTokenAddressSync(mint, owner);
  await sendTx(ctx, [
    createAssociatedTokenAccountInstruction(payer.publicKey, ata, owner, mint),
    createMintToInstruction(mint, ata, mintAuth.publicKey, amount),
  ], [payer, mintAuth]);
  return ata;
}

// ─── PDA derivation helpers ───────────────────────────────────────────────────

function streakPDA(creator: PublicKey, name: string): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("streak"), creator.toBuffer(), Buffer.from(name)],
    PROGRAM_ID,
  )[0];
}

function participantPDA(streak: PublicKey, user: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("participant"), streak.toBuffer(), user.toBuffer()],
    PROGRAM_ID,
  )[0];
}

function attestationPDA(participant: PublicKey, day: number): PublicKey {
  const dayBuf = Buffer.alloc(2);
  dayBuf.writeUInt16LE(day, 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("attestation"), participant.toBuffer(), dayBuf],
    PROGRAM_ID,
  )[0];
}

function phashRegistryPDA(streak: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("phash"), streak.toBuffer()],
    PROGRAM_ID,
  )[0];
}

function escrowPDA(streak: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), streak.toBuffer()],
    PROGRAM_ID,
  )[0];
}

function proofPDA(streak: PublicKey, user: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("proof"), streak.toBuffer(), user.toBuffer()],
    PROGRAM_ID,
  )[0];
}

// ─── High-level instruction builders ─────────────────────────────────────────

async function buildSubmitIxs(
  program: Program<Commit>,
  streakKey: PublicKey,
  user: Keypair,
  day: number,
  photoHash: Buffer,
  phash: bigint,
): Promise<anchor.web3.TransactionInstruction[]> {
  const participantKey = participantPDA(streakKey, user.publicKey);
  const attestationKey = attestationPDA(participantKey, day);
  const reasonHash = Buffer.alloc(32);

  const msg = buildAttestation(user.publicKey, streakKey, day, photoHash, phash, true, reasonHash);
  const { ix: sigIx, sig } = ed25519Ix(msg);

  const programIx = await program.methods
    .submitCheckinWithAttestation({
      dayIndex: day,
      photoHash: Array.from(photoHash) as any,
      phash: new BN(phash.toString()),
      verdict: true,
      reasonHash: Array.from(reasonHash) as any,
      verifierSignature: Array.from(sig) as any,
    })
    .accounts({
      streak: streakKey,
      participant: participantKey,
      attestation: attestationKey,
      phashRegistry: phashRegistryPDA(streakKey),
      participantUser: user.publicKey,
      instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  return [sigIx, programIx];
}

async function buildResolveIxs(
  program: Program<Commit>,
  streakKey: PublicKey,
  targetUser: PublicKey,
  day: number,
  photoHash: Buffer,
  phash: bigint,
  counterVerdict: boolean,
  disputer: PublicKey,
  disputerAta: PublicKey,
  targetAta: PublicKey,
  resolver: Keypair,
  usdcMint: PublicKey,
): Promise<anchor.web3.TransactionInstruction[]> {
  const targetParticipant = participantPDA(streakKey, targetUser);
  const attestationKey = attestationPDA(targetParticipant, day);
  const reasonHash = Buffer.alloc(32);

  const msg = buildAttestation(targetUser, streakKey, day, photoHash, phash, counterVerdict, reasonHash);
  const { ix: sigIx, sig } = ed25519Ix(msg);

  const programIx = await program.methods
    .resolveDispute({
      counterVerdict: counterVerdict,
      counterReasonHash: Array.from(reasonHash) as any,
      counterSignature: Array.from(sig) as any,
    })
    .accounts({
      streak: streakKey,
      targetParticipant: targetParticipant,
      attestation: attestationKey,
      disputer: disputer,
      disputerTokenAccount: disputerAta,
      targetTokenAccount: targetAta,
      escrowTokenAccount: escrowPDA(streakKey),
      usdcMint: usdcMint,
      resolver: resolver.publicKey,
      instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  return [sigIx, programIx];
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared test context
// ─────────────────────────────────────────────────────────────────────────────

let ctx: ProgramTestContext;
let provider: BankrunProvider;
let program: Program<Commit>;
let payer: Keypair;
let usdcMintKp: Keypair;
let alice: Keypair;
let bob: Keypair;
let aliceAta: PublicKey;
let bobAta: PublicKey;

describe("commit", () => {
  before(async () => {
    ctx = await startAnchor(".", [], []);
    provider = new BankrunProvider(ctx);
    anchor.setProvider(provider);
    program = new anchor.Program<Commit>(
      require("../target/idl/commit.json"),
      provider,
    );
    payer = ctx.payer;

    alice = Keypair.generate();
    bob = Keypair.generate();

    for (const u of [alice, bob]) {
      ctx.setAccount(u.publicKey, {
        lamports: 10_000_000_000,
        data: Buffer.alloc(0),
        owner: SystemProgram.programId,
        executable: false,
      });
    }

    await setTs(ctx, BASE_TS);
    usdcMintKp = await makeMint(ctx, payer, payer.publicKey);

    aliceAta = await fundedAta(ctx, payer, usdcMintKp.publicKey, payer, alice.publicKey, 10_000_000n);
    bobAta   = await fundedAta(ctx, payer, usdcMintKp.publicKey, payer, bob.publicKey,   10_000_000n);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. HAPPY PATH
  // ──────────────────────────────────────────────────────────────────────────

  describe("happy path: full streak completion with NFT", () => {
    const NAME = "happy-streak";
    const START = BASE_TS + 200;
    let streakKey: PublicKey;

    it("creates a streak", async () => {
      await setTs(ctx, BASE_TS + 50);
      streakKey = streakPDA(alice.publicKey, NAME);

      await sendTx(ctx, [
        await program.methods
          .createStreak({
            name: NAME,
            habitType: { code: {} },
            habitPrompt: "Write code every day",
            durationDays: DURATION,
            stakeAmount: STAKE_AMOUNT,
            penaltyPercent: PENALTY_PCT,
            startTimestamp: new BN(START),
            maxParticipants: 10,
          })
          .accounts({
            streak: streakKey,
            phashRegistry: phashRegistryPDA(streakKey),
            escrowTokenAccount: escrowPDA(streakKey),
            usdcMint: usdcMintKp.publicKey,
            creator: alice.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .instruction(),
      ], [alice]);

      const s = await program.account.streak.fetch(streakKey);
      expect(s.name).to.equal(NAME);
      expect(s.durationDays).to.equal(DURATION);
      expect(s.stakeAmount.toNumber()).to.equal(STAKE_AMOUNT.toNumber());
      expect(s.participantCount).to.equal(0);
    });

    it("allows 2 participants to join before start", async () => {
      await setTs(ctx, START - 10);

      for (const [user, ata] of [[alice, aliceAta], [bob, bobAta]] as [Keypair, PublicKey][]) {
        await sendTx(ctx, [
          await program.methods
            .joinStreak()
            .accounts({
              streak: streakKey,
              participant: participantPDA(streakKey, user.publicKey),
              userTokenAccount: ata,
              escrowTokenAccount: escrowPDA(streakKey),
              usdcMint: usdcMintKp.publicKey,
              user: user.publicKey,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .instruction(),
        ], [user]);
      }

      const s = await program.account.streak.fetch(streakKey);
      expect(s.participantCount).to.equal(2);
      expect(s.activeCount).to.equal(2);

      // Each user staked 1 USDC; escrow should hold 2 USDC
      const escrow = await getTokenAccount(provider.connection, escrowPDA(streakKey));
      expect(escrow.amount.toString()).to.equal("2000000");
    });

    it("completes 3 daily check-ins and finalizes each after 24h", async () => {
      // Use widely-separated phash values: pairwise hamming distance = 64, 32, 32 bits > 8
      const PHASHES = [0xAAAAAAAAAAAAAAAAn, 0x5555555555555555n, 0x0F0F0F0F0F0F0F0Fn];

      for (let day = 0; day < DURATION; day++) {
        // Set clock to the start of this day
        await setTs(ctx, START + day * ONE_DAY);

        const photoHash = Buffer.alloc(32, day + 1);
        const phash = PHASHES[day];

        await sendTx(
          ctx,
          await buildSubmitIxs(program, streakKey, alice, day, photoHash, phash),
          [alice],
        );

        const attest = await program.account.checkinAttestation.fetch(
          attestationPDA(participantPDA(streakKey, alice.publicKey), day),
        );
        expect(attest.state).to.deep.equal({ pending: {} });
        expect(attest.verdict).to.be.true;
        expect(attest.dayIndex).to.equal(day);

        // Advance past the 24-hour dispute window
        await advanceTs(ctx, ONE_DAY + 1);

        await sendTx(ctx, [
          await program.methods
            .finalizeCheckin()
            .accounts({
              attestation: attestationPDA(participantPDA(streakKey, alice.publicKey), day),
              participant: participantPDA(streakKey, alice.publicKey),
              streak: streakKey,
              phashRegistry: phashRegistryPDA(streakKey),
              caller: payer.publicKey,
            })
            .instruction(),
        ], [payer]);

        const finalized = await program.account.checkinAttestation.fetch(
          attestationPDA(participantPDA(streakKey, alice.publicKey), day),
        );
        expect(finalized.state).to.deep.equal({ finalized: {} });
      }

      const p = await program.account.participant.fetch(participantPDA(streakKey, alice.publicKey));
      expect(p.currentStreak).to.equal(DURATION);
      expect(p.isActive).to.be.true;

      // pHash registry has 3 entries
      const reg = await program.account.phashRegistry.fetch(phashRegistryPDA(streakKey));
      expect(reg.hashes.length).to.equal(DURATION);
    });

    it("claims reward and mints a soulbound Token-2022 NFT", async () => {
      const completionMint = Keypair.generate();
      const userNftAta = getAssociatedTokenAddressSync(
        completionMint.publicKey,
        alice.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
      );

      const aliceUsdcBefore = BigInt((await getTokenAccount(provider.connection, aliceAta)).amount.toString());

      await sendTx(ctx, [
        await program.methods
          .claimReward()
          .accounts({
            streak: streakKey,
            participant: participantPDA(streakKey, alice.publicKey),
            escrowTokenAccount: escrowPDA(streakKey),
            userTokenAccount: aliceAta,
            usdcMint: usdcMintKp.publicKey,
            completionMint: completionMint.publicKey,
            userNftAta: userNftAta,
            streakProof: proofPDA(streakKey, alice.publicKey),
            user: alice.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            token2022Program: TOKEN_2022_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .instruction(),
      ], [alice, completionMint]);

      // Stake returned: alice USDC balance increased
      const aliceUsdcAfter = BigInt((await getTokenAccount(provider.connection, aliceAta)).amount.toString());
      expect(aliceUsdcAfter > aliceUsdcBefore).to.be.true;
      expect(aliceUsdcAfter - aliceUsdcBefore).to.equal(1_000_000n); // got her 1 USDC back

      // StreakProof PDA holds correct metadata
      const proof = await program.account.streakProof.fetch(proofPDA(streakKey, alice.publicKey));
      expect(proof.owner.toBase58()).to.equal(alice.publicKey.toBase58());
      expect(proof.durationDays).to.equal(DURATION);
      expect(proof.stakeLamports.toNumber()).to.equal(STAKE_AMOUNT.toNumber());

      // NFT ATA has exactly 1 token
      const nftAcct = await getTokenAccount(provider.connection, userNftAta, "confirmed", TOKEN_2022_PROGRAM_ID);
      expect(nftAcct.amount.toString()).to.equal("1");

      // Mint authority revoked (soulbound — no more tokens can be minted)
      const mintInfo = await getMint(provider.connection, completionMint.publicKey, "confirmed", TOKEN_2022_PROGRAM_ID);
      expect(mintInfo.mintAuthority).to.be.null;

      // Mint has the NonTransferable extension
      const exts = getExtensionTypes(mintInfo.tlvData);
      expect(exts).to.include(ExtensionType.NonTransferable);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. DISPUTE PATH — dispute succeeds (original check-in overturned)
  // ──────────────────────────────────────────────────────────────────────────

  describe("dispute path — dispute succeeds", () => {
    const NAME = "dispute-win-streak";
    const START = BASE_TS + 2_000;
    let streakKey: PublicKey;
    const photoHash = Buffer.alloc(32, 0xaa);
    const phash = 0xdeadbeefdeadn;

    before(async () => {
      await setTs(ctx, BASE_TS + 1_500);
      streakKey = streakPDA(alice.publicKey, NAME);

      await sendTx(ctx, [
        await program.methods
          .createStreak({
            name: NAME,
            habitType: { gym: {} },
            habitPrompt: "Go to the gym",
            durationDays: 7,
            stakeAmount: STAKE_AMOUNT,
            penaltyPercent: PENALTY_PCT,
            startTimestamp: new BN(START),
            maxParticipants: 10,
          })
          .accounts({
            streak: streakKey,
            phashRegistry: phashRegistryPDA(streakKey),
            escrowTokenAccount: escrowPDA(streakKey),
            usdcMint: usdcMintKp.publicKey,
            creator: alice.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .instruction(),
      ], [alice]);

      await setTs(ctx, START - 10);
      for (const [user, ata] of [[alice, aliceAta], [bob, bobAta]] as [Keypair, PublicKey][]) {
        await sendTx(ctx, [
          await program.methods
            .joinStreak()
            .accounts({
              streak: streakKey,
              participant: participantPDA(streakKey, user.publicKey),
              userTokenAccount: ata,
              escrowTokenAccount: escrowPDA(streakKey),
              usdcMint: usdcMintKp.publicKey,
              user: user.publicKey,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .instruction(),
        ], [user]);
      }
    });

    it("slashes target and pays disputer bond + bounty when dispute wins", async () => {
      await setTs(ctx, START);
      await sendTx(
        ctx,
        await buildSubmitIxs(program, streakKey, alice, 0, photoHash, phash),
        [alice],
      );

      const disputeBond = STAKE_AMOUNT.toNumber() / 10; // 100_000 (0.1 USDC)
      const bobBalBefore = BigInt((await getTokenAccount(provider.connection, bobAta)).amount.toString());

      await sendTx(ctx, [
        await program.methods
          .disputeCheckin()
          .accounts({
            streak: streakKey,
            targetParticipant: participantPDA(streakKey, alice.publicKey),
            attestation: attestationPDA(participantPDA(streakKey, alice.publicKey), 0),
            disputerParticipant: participantPDA(streakKey, bob.publicKey),
            disputerTokenAccount: bobAta,
            escrowTokenAccount: escrowPDA(streakKey),
            usdcMint: usdcMintKp.publicKey,
            disputerUser: bob.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction(),
      ], [bob]);

      // Bob paid the dispute bond
      const bobBalMid = BigInt((await getTokenAccount(provider.connection, bobAta)).amount.toString());
      expect(bobBalMid).to.equal(bobBalBefore - BigInt(disputeBond));

      const aliceStakeBefore = (await program.account.participant.fetch(
        participantPDA(streakKey, alice.publicKey),
      )).stakeLocked.toNumber();

      // counter_verdict = false → dispute wins, original overturned
      await sendTx(
        ctx,
        await buildResolveIxs(
          program, streakKey, alice.publicKey, 0, photoHash, phash,
          false, bob.publicKey, bobAta, aliceAta, payer, usdcMintKp.publicKey,
        ),
        [payer],
      );

      // Attestation state is Overturned
      const attest = await program.account.checkinAttestation.fetch(
        attestationPDA(participantPDA(streakKey, alice.publicKey), 0),
      );
      expect(attest.state).to.deep.equal({ overturned: {} });
      expect(attest.finalVerdict).to.equal(false);

      // Alice's stake was slashed by penalty_percent
      const aliceStakeAfter = (await program.account.participant.fetch(
        participantPDA(streakKey, alice.publicKey),
      )).stakeLocked.toNumber();
      const slash = Math.floor(aliceStakeBefore * PENALTY_PCT / 100); // 200_000
      expect(aliceStakeAfter).to.equal(aliceStakeBefore - slash);

      // Bob received dispute_bond + bounty (30% of slash)
      const bounty = Math.floor(slash * 30 / 100); // 60_000
      const bobBalAfter = BigInt((await getTokenAccount(provider.connection, bobAta)).amount.toString());
      expect(bobBalAfter).to.equal(bobBalMid + BigInt(disputeBond + bounty));

      // Pool grew by slash − bounty
      const s = await program.account.streak.fetch(streakKey);
      expect(s.totalPool.toNumber()).to.equal(slash - bounty); // 140_000
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. DISPUTE PATH — dispute fails (original check-in confirmed)
  // ──────────────────────────────────────────────────────────────────────────

  describe("dispute path — dispute fails", () => {
    const NAME = "dispute-lose-streak";
    const START = BASE_TS + 4_000;
    let streakKey: PublicKey;
    const photoHash = Buffer.alloc(32, 0xbb);
    const phash = 0xcafebabecafen;

    before(async () => {
      await setTs(ctx, BASE_TS + 3_500);
      streakKey = streakPDA(alice.publicKey, NAME);

      await sendTx(ctx, [
        await program.methods
          .createStreak({
            name: NAME,
            habitType: { read: {} },
            habitPrompt: "Read a book",
            durationDays: 5,
            stakeAmount: STAKE_AMOUNT,
            penaltyPercent: PENALTY_PCT,
            startTimestamp: new BN(START),
            maxParticipants: 10,
          })
          .accounts({
            streak: streakKey,
            phashRegistry: phashRegistryPDA(streakKey),
            escrowTokenAccount: escrowPDA(streakKey),
            usdcMint: usdcMintKp.publicKey,
            creator: alice.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .instruction(),
      ], [alice]);

      await setTs(ctx, START - 10);
      for (const [user, ata] of [[alice, aliceAta], [bob, bobAta]] as [Keypair, PublicKey][]) {
        await sendTx(ctx, [
          await program.methods
            .joinStreak()
            .accounts({
              streak: streakKey,
              participant: participantPDA(streakKey, user.publicKey),
              userTokenAccount: ata,
              escrowTokenAccount: escrowPDA(streakKey),
              usdcMint: usdcMintKp.publicKey,
              user: user.publicKey,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .instruction(),
        ], [user]);
      }
    });

    it("disputer loses bond; original participant credited and streak incremented", async () => {
      await setTs(ctx, START);
      await sendTx(
        ctx,
        await buildSubmitIxs(program, streakKey, alice, 0, photoHash, phash),
        [alice],
      );

      const disputeBond = STAKE_AMOUNT.toNumber() / 10;
      await sendTx(ctx, [
        await program.methods
          .disputeCheckin()
          .accounts({
            streak: streakKey,
            targetParticipant: participantPDA(streakKey, alice.publicKey),
            attestation: attestationPDA(participantPDA(streakKey, alice.publicKey), 0),
            disputerParticipant: participantPDA(streakKey, bob.publicKey),
            disputerTokenAccount: bobAta,
            escrowTokenAccount: escrowPDA(streakKey),
            usdcMint: usdcMintKp.publicKey,
            disputerUser: bob.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction(),
      ], [bob]);

      const bobBalMid  = BigInt((await getTokenAccount(provider.connection, bobAta)).amount.toString());
      const aliceBalBefore = BigInt((await getTokenAccount(provider.connection, aliceAta)).amount.toString());
      const aliceStreakBefore = (await program.account.participant.fetch(
        participantPDA(streakKey, alice.publicKey),
      )).currentStreak;

      // counter_verdict = true → dispute fails, original checkin confirmed
      await sendTx(
        ctx,
        await buildResolveIxs(
          program, streakKey, alice.publicKey, 0, photoHash, phash,
          true, bob.publicKey, bobAta, aliceAta, payer, usdcMintKp.publicKey,
        ),
        [payer],
      );

      // Attestation is Finalized (not Overturned)
      const attest = await program.account.checkinAttestation.fetch(
        attestationPDA(participantPDA(streakKey, alice.publicKey), 0),
      );
      expect(attest.state).to.deep.equal({ finalized: {} });

      // Bob did not get his bond back
      const bobBalAfter = BigInt((await getTokenAccount(provider.connection, bobAta)).amount.toString());
      expect(bobBalAfter).to.equal(bobBalMid);

      // Alice received the dispute bond as reward
      const aliceBalAfter = BigInt((await getTokenAccount(provider.connection, aliceAta)).amount.toString());
      expect(aliceBalAfter).to.equal(aliceBalBefore + BigInt(disputeBond));

      // Alice's streak count was incremented by the resolution
      const aliceStreakAfter = (await program.account.participant.fetch(
        participantPDA(streakKey, alice.publicKey),
      )).currentStreak;
      expect(aliceStreakAfter).to.equal(aliceStreakBefore + 1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. pHASH REJECTION
  // ──────────────────────────────────────────────────────────────────────────

  describe("pHash rejection: reused photo blocked on-chain", () => {
    const NAME = "phash-streak";
    const START = BASE_TS + 6_000;
    let streakKey: PublicKey;
    let dayOneTs: number;

    before(async () => {
      await setTs(ctx, BASE_TS + 5_500);
      streakKey = streakPDA(alice.publicKey, NAME);

      await sendTx(ctx, [
        await program.methods
          .createStreak({
            name: NAME,
            habitType: { write: {} },
            habitPrompt: "Write something",
            durationDays: 5,
            stakeAmount: STAKE_AMOUNT,
            penaltyPercent: PENALTY_PCT,
            startTimestamp: new BN(START),
            maxParticipants: 10,
          })
          .accounts({
            streak: streakKey,
            phashRegistry: phashRegistryPDA(streakKey),
            escrowTokenAccount: escrowPDA(streakKey),
            usdcMint: usdcMintKp.publicKey,
            creator: alice.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .instruction(),
      ], [alice]);

      await setTs(ctx, START - 10);
      await sendTx(ctx, [
        await program.methods
          .joinStreak()
          .accounts({
            streak: streakKey,
            participant: participantPDA(streakKey, alice.publicKey),
            userTokenAccount: aliceAta,
            escrowTokenAccount: escrowPDA(streakKey),
            usdcMint: usdcMintKp.publicKey,
            user: alice.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction(),
      ], [alice]);
    });

    it("submits and finalizes day 0 with phash 0x0000000000000000", async () => {
      const phash0 = 0x0000000000000000n;
      const photo0 = Buffer.alloc(32, 0x01);

      await setTs(ctx, START);
      await sendTx(
        ctx,
        await buildSubmitIxs(program, streakKey, alice, 0, photo0, phash0),
        [alice],
      );

      await advanceTs(ctx, ONE_DAY + 1);
      dayOneTs = START + ONE_DAY + 1;

      await sendTx(ctx, [
        await program.methods
          .finalizeCheckin()
          .accounts({
            attestation: attestationPDA(participantPDA(streakKey, alice.publicKey), 0),
            participant: participantPDA(streakKey, alice.publicKey),
            streak: streakKey,
            phashRegistry: phashRegistryPDA(streakKey),
            caller: payer.publicKey,
          })
          .instruction(),
      ], [payer]);

      const reg = await program.account.phashRegistry.fetch(phashRegistryPDA(streakKey));
      expect(reg.hashes.length).to.equal(1);
      // Stored hash is phash0
      expect(reg.hashes[0].toString()).to.equal("0");
    });

    it("rejects day 1 with phash differing by only 1 bit from day 0 (distance=1 ≤ 8)", async () => {
      // 0x0000000000000001 XOR 0x0000000000000000 = 1 → popcount = 1 ≤ 8
      const phashReuse = 0x0000000000000001n;
      const photo1 = Buffer.alloc(32, 0x02);

      await setTs(ctx, START + ONE_DAY);
      const ixs = await buildSubmitIxs(program, streakKey, alice, 1, photo1, phashReuse);
      await expectAnchorError(ctx, ixs, [alice], "PhotoReuseDetected");
    });

    it("accepts day 1 with phash 0xFFFFFFFFFFFFFFFF (distance=64 from day 0)", async () => {
      // 0xFFFFFFFFFFFFFFFF XOR 0x0000000000000000 = 0xFFFF...F → popcount=64 > 8
      const phashNew = 0xffffffffffffffffn;
      const photo1 = Buffer.alloc(32, 0x03);

      await setTs(ctx, START + ONE_DAY);
      await sendTx(
        ctx,
        await buildSubmitIxs(program, streakKey, alice, 1, photo1, phashNew),
        [alice],
      );

      const attest = await program.account.checkinAttestation.fetch(
        attestationPDA(participantPDA(streakKey, alice.publicKey), 1),
      );
      expect(attest.state).to.deep.equal({ pending: {} });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. SLASH PATH
  // ──────────────────────────────────────────────────────────────────────────

  describe("slash path: missed check-in after 48h grace period", () => {
    const NAME = "slash-streak";
    const START = BASE_TS + 8_000;
    let streakKey: PublicKey;

    before(async () => {
      await setTs(ctx, BASE_TS + 7_500);
      streakKey = streakPDA(bob.publicKey, NAME);

      await sendTx(ctx, [
        await program.methods
          .createStreak({
            name: NAME,
            habitType: { design: {} },
            habitPrompt: "Design something",
            durationDays: 7,
            stakeAmount: STAKE_AMOUNT,
            penaltyPercent: PENALTY_PCT,
            startTimestamp: new BN(START),
            maxParticipants: 10,
          })
          .accounts({
            streak: streakKey,
            phashRegistry: phashRegistryPDA(streakKey),
            escrowTokenAccount: escrowPDA(streakKey),
            usdcMint: usdcMintKp.publicKey,
            creator: bob.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .instruction(),
      ], [bob]);

      await setTs(ctx, START - 10);
      for (const [user, ata] of [[alice, aliceAta], [bob, bobAta]] as [Keypair, PublicKey][]) {
        await sendTx(ctx, [
          await program.methods
            .joinStreak()
            .accounts({
              streak: streakKey,
              participant: participantPDA(streakKey, user.publicKey),
              userTokenAccount: ata,
              escrowTokenAccount: escrowPDA(streakKey),
              usdcMint: usdcMintKp.publicKey,
              user: user.publicKey,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .instruction(),
        ], [user]);
      }
    });

    it("rejects slash_missed before 48h grace period elapses", async () => {
      // At START + ONE_DAY: elapsed=1, last_finalized_day=0, expected_day-1=0 → 0 < 0 is false
      await setTs(ctx, START + ONE_DAY);
      // Use alice as caller so the later successful-slash tx (using payer) has a distinct signature.
      const ixs = [
        await program.methods
          .slashMissed()
          .accounts({
            streak: streakKey,
            participant: participantPDA(streakKey, alice.publicKey),
            caller: alice.publicKey,
          })
          .instruction(),
      ];
      await expectAnchorError(ctx, ixs, [alice], "TooEarlyToSlash");
    });

    it("slashes alice after 48h+ with no check-in (permissionless)", async () => {
      // elapsed=2, last_finalized_day=0 < 2-1=1 ✓; last_checkin_timestamp=0 ✓
      await setTs(ctx, START + TWO_DAYS + 1);

      const stakeBefore = (await program.account.participant.fetch(
        participantPDA(streakKey, alice.publicKey),
      )).stakeLocked.toNumber();
      const poolBefore = (await program.account.streak.fetch(streakKey)).totalPool.toNumber();

      await sendTx(ctx, [
        await program.methods
          .slashMissed()
          .accounts({
            streak: streakKey,
            participant: participantPDA(streakKey, alice.publicKey),
            caller: payer.publicKey,
          })
          .instruction(),
      ], [payer]);

      const stakeAfter = (await program.account.participant.fetch(
        participantPDA(streakKey, alice.publicKey),
      )).stakeLocked.toNumber();
      const poolAfter = (await program.account.streak.fetch(streakKey)).totalPool.toNumber();

      const expectedSlash = Math.floor(stakeBefore * PENALTY_PCT / 100); // 200_000
      expect(stakeAfter).to.equal(stakeBefore - expectedSlash);
      expect(poolAfter).to.equal(poolBefore + expectedSlash);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. ERROR CASES
  // ──────────────────────────────────────────────────────────────────────────

  describe("error cases", () => {
    const NAME = "error-streak";
    const START = BASE_TS + 10_000;
    let streakKey: PublicKey;

    before(async () => {
      await setTs(ctx, BASE_TS + 9_500);
      streakKey = streakPDA(alice.publicKey, NAME);

      await sendTx(ctx, [
        await program.methods
          .createStreak({
            name: NAME,
            habitType: { code: {} },
            habitPrompt: "Code",
            durationDays: 7,
            stakeAmount: STAKE_AMOUNT,
            penaltyPercent: PENALTY_PCT,
            startTimestamp: new BN(START),
            maxParticipants: 10,
          })
          .accounts({
            streak: streakKey,
            phashRegistry: phashRegistryPDA(streakKey),
            escrowTokenAccount: escrowPDA(streakKey),
            usdcMint: usdcMintKp.publicKey,
            creator: alice.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .instruction(),
      ], [alice]);

      await setTs(ctx, START - 10);

      for (const [user, ata] of [[alice, aliceAta], [bob, bobAta]] as [Keypair, PublicKey][]) {
        await sendTx(ctx, [
          await program.methods
            .joinStreak()
            .accounts({
              streak: streakKey,
              participant: participantPDA(streakKey, user.publicKey),
              userTokenAccount: ata,
              escrowTokenAccount: escrowPDA(streakKey),
              usdcMint: usdcMintKp.publicKey,
              user: user.publicKey,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .instruction(),
        ], [user]);
      }
    });

    it("StreakAlreadyStarted: cannot join after streak has started", async () => {
      const charlie = Keypair.generate();
      ctx.setAccount(charlie.publicKey, {
        lamports: 10_000_000_000,
        data: Buffer.alloc(0),
        owner: SystemProgram.programId,
        executable: false,
      });
      const charlieAta = await fundedAta(
        ctx, payer, usdcMintKp.publicKey, payer, charlie.publicKey, 5_000_000n,
      );

      await setTs(ctx, START + 1); // past start

      const ixs = [
        await program.methods
          .joinStreak()
          .accounts({
            streak: streakKey,
            participant: participantPDA(streakKey, charlie.publicKey),
            userTokenAccount: charlieAta,
            escrowTokenAccount: escrowPDA(streakKey),
            usdcMint: usdcMintKp.publicKey,
            user: charlie.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction(),
      ];
      await expectAnchorError(ctx, ixs, [charlie], "StreakAlreadyStarted");
    });

    it("NotADifferentParticipant: cannot dispute your own attestation", async () => {
      await setTs(ctx, START);
      const photoHash = Buffer.alloc(32, 0xcc);
      const phash = 0xabcd1234abcdn;

      // Alice submits day 0
      await sendTx(
        ctx,
        await buildSubmitIxs(program, streakKey, alice, 0, photoHash, phash),
        [alice],
      );

      // Alice tries to dispute her own attestation
      const ixs = [
        await program.methods
          .disputeCheckin()
          .accounts({
            streak: streakKey,
            targetParticipant: participantPDA(streakKey, alice.publicKey),
            attestation: attestationPDA(participantPDA(streakKey, alice.publicKey), 0),
            disputerParticipant: participantPDA(streakKey, alice.publicKey), // same as target
            disputerTokenAccount: aliceAta,
            escrowTokenAccount: escrowPDA(streakKey),
            usdcMint: usdcMintKp.publicKey,
            disputerUser: alice.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction(),
      ];
      await expectAnchorError(ctx, ixs, [alice], "NotADifferentParticipant");
    });

    it("DisputeWindowOpen: cannot finalize before 24h window closes", async () => {
      // alice's day-0 attestation was just submitted — dispute window is still open
      const ixs = [
        await program.methods
          .finalizeCheckin()
          .accounts({
            attestation: attestationPDA(participantPDA(streakKey, alice.publicKey), 0),
            participant: participantPDA(streakKey, alice.publicKey),
            streak: streakKey,
            phashRegistry: phashRegistryPDA(streakKey),
            caller: payer.publicKey,
          })
          .instruction(),
      ];
      await expectAnchorError(ctx, ixs, [payer], "DisputeWindowOpen");
    });

    it("StreakNotEnded: cannot withdraw_failed before streak end time", async () => {
      // streak ends at START + 7 * ONE_DAY; current time is still within it
      const ixs = [
        await program.methods
          .withdrawFailed()
          .accounts({
            streak: streakKey,
            participant: participantPDA(streakKey, bob.publicKey),
            escrowTokenAccount: escrowPDA(streakKey),
            userTokenAccount: bobAta,
            usdcMint: usdcMintKp.publicKey,
            user: bob.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction(),
      ];
      await expectAnchorError(ctx, ixs, [bob], "StreakNotEnded");
    });

    it("StreakIncomplete: cannot claim reward before completing all days", async () => {
      // bob has never checked in (current_streak=0, duration_days=7)
      const completionMint = Keypair.generate();
      const userNftAta = getAssociatedTokenAddressSync(
        completionMint.publicKey,
        bob.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
      );

      const ixs = [
        await program.methods
          .claimReward()
          .accounts({
            streak: streakKey,
            participant: participantPDA(streakKey, bob.publicKey),
            escrowTokenAccount: escrowPDA(streakKey),
            userTokenAccount: bobAta,
            usdcMint: usdcMintKp.publicKey,
            completionMint: completionMint.publicKey,
            userNftAta: userNftAta,
            streakProof: proofPDA(streakKey, bob.publicKey),
            user: bob.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            token2022Program: TOKEN_2022_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .instruction(),
      ];
      await expectAnchorError(ctx, ixs, [bob, completionMint], "StreakIncomplete");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. WITHDRAW FAILED — unslashed stake returned after streak ends
  // ──────────────────────────────────────────────────────────────────────────

  describe("withdraw_failed: failed participant reclaims remaining stake", () => {
    const NAME = "withdraw-streak";
    const START = BASE_TS + 12_000;
    const DURATION_DAYS = 3;
    let streakKey: PublicKey;

    before(async () => {
      await setTs(ctx, BASE_TS + 11_500);
      streakKey = streakPDA(bob.publicKey, NAME);

      await sendTx(ctx, [
        await program.methods
          .createStreak({
            name: NAME,
            habitType: { gym: {} },
            habitPrompt: "Show gym activity",
            durationDays: DURATION_DAYS,
            stakeAmount: STAKE_AMOUNT,
            penaltyPercent: PENALTY_PCT,
            startTimestamp: new BN(START),
            maxParticipants: 10,
          })
          .accounts({
            streak: streakKey,
            phashRegistry: phashRegistryPDA(streakKey),
            escrowTokenAccount: escrowPDA(streakKey),
            usdcMint: usdcMintKp.publicKey,
            creator: bob.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .instruction(),
      ], [bob]);

      // alice and bob both join
      await setTs(ctx, START - 10);
      for (const [user, ata] of [[alice, aliceAta], [bob, bobAta]] as [Keypair, PublicKey][]) {
        await sendTx(ctx, [
          await program.methods
            .joinStreak()
            .accounts({
              streak: streakKey,
              participant: participantPDA(streakKey, user.publicKey),
              userTokenAccount: ata,
              escrowTokenAccount: escrowPDA(streakKey),
              usdcMint: usdcMintKp.publicKey,
              user: user.publicKey,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .instruction(),
        ], [user]);
      }

      // slash alice twice (day 0 and day 1 missed) — she ends with 64% of stake
      await setTs(ctx, START + TWO_DAYS + 1);
      await sendTx(ctx, [
        await program.methods
          .slashMissed()
          .accounts({
            streak: streakKey,
            participant: participantPDA(streakKey, alice.publicKey),
            caller: payer.publicKey,
          })
          .instruction(),
      ], [payer]);

      await setTs(ctx, START + TWO_DAYS + ONE_DAY + 1);
      await sendTx(ctx, [
        await program.methods
          .slashMissed()
          .accounts({
            streak: streakKey,
            participant: participantPDA(streakKey, alice.publicKey),
            caller: payer.publicKey,
          })
          .instruction(),
      ], [payer]);
    });

    it("rejects withdraw_failed before streak end time", async () => {
      // streak ends at START + DURATION_DAYS * ONE_DAY; we are still before that
      await setTs(ctx, START + TWO_DAYS);
      const ixs = [
        await program.methods
          .withdrawFailed()
          .accounts({
            streak: streakKey,
            participant: participantPDA(streakKey, alice.publicKey),
            escrowTokenAccount: escrowPDA(streakKey),
            userTokenAccount: aliceAta,
            usdcMint: usdcMintKp.publicKey,
            user: alice.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction(),
      ];
      await expectAnchorError(ctx, ixs, [alice], "StreakNotEnded");
    });

    it("returns unslashed remainder to alice after streak ends", async () => {
      // move past streak end
      await setTs(ctx, START + DURATION_DAYS * ONE_DAY + 1);

      const stakeBefore = (await program.account.participant.fetch(
        participantPDA(streakKey, alice.publicKey),
      )).stakeLocked.toNumber();

      const aliceBalBefore = BigInt((await getTokenAccount(provider.connection, aliceAta)).amount.toString());

      await sendTx(ctx, [
        await program.methods
          .withdrawFailed()
          .accounts({
            streak: streakKey,
            participant: participantPDA(streakKey, alice.publicKey),
            escrowTokenAccount: escrowPDA(streakKey),
            userTokenAccount: aliceAta,
            usdcMint: usdcMintKp.publicKey,
            user: alice.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction(),
      ], [alice]);

      const aliceBalAfter = BigInt((await getTokenAccount(provider.connection, aliceAta)).amount.toString());

      const participantAfter = await program.account.participant.fetch(
        participantPDA(streakKey, alice.publicKey),
      );

      // alice should have received exactly her remaining stake back
      expect(aliceBalAfter - aliceBalBefore).to.equal(BigInt(stakeBefore));
      expect(participantAfter.stakeLocked.toNumber()).to.equal(0);
      expect(participantAfter.isActive).to.equal(false);
      expect(participantAfter.hasClaimed).to.equal(true);
    });

    it("rejects a second withdraw_failed (already claimed)", async () => {
      const ixs = [
        await program.methods
          .withdrawFailed()
          .accounts({
            streak: streakKey,
            participant: participantPDA(streakKey, alice.publicKey),
            escrowTokenAccount: escrowPDA(streakKey),
            userTokenAccount: aliceAta,
            usdcMint: usdcMintKp.publicKey,
            user: alice.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction(),
      ];
      await expectAnchorError(ctx, ixs, [alice], "ParticipantInactive");
    });
  });
});
