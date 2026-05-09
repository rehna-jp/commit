// POST /api/verify-github — GitHub activity auto-verification for the Code habit
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { Octokit } from '@octokit/rest';
import { sha256, buildAttestationMessage, signAttestation, getVerifierPubkeyBytes, decodeBase58Pubkey } from '@/app/lib/attestation';
import { withX402Payment, type RouteHandler } from '@/app/lib/x402-middleware';
import bs58 from 'bs58';

interface GitHubRequest {
  participant_pubkey: string;
  streak_pubkey: string;
  day_index: number;
  github_username: string;
}

interface GitHubEvent {
  id: string;
  type: string;
  created_at: string | null;
  repo: { name: string };
  payload: {
    action?: string;
    pull_request?: { merged?: boolean };
    ref_type?: string;
    commits?: Array<{ sha: string; message: string; url: string }>;
  };
}

interface RepoInfo {
  created_at: string | null;
}

interface CommitFile {
  filename: string;
}

interface CommitDetail {
  files?: CommitFile[];
}

async function handler(req: NextRequest): Promise<NextResponse> {
  let body: GitHubRequest;
  try {
    body = (await req.json()) as GitHubRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { participant_pubkey, streak_pubkey, day_index, github_username } = body;

  if (!participant_pubkey || !streak_pubkey || day_index === undefined || !github_username) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const octokit = new Octokit({ auth: process.env.GITHUB_APP_TOKEN });
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  let events: GitHubEvent[];
  try {
    const { data } = await octokit.rest.activity.listPublicEventsForUser({
      username: github_username,
      per_page: 100,
    });
    events = data as unknown as GitHubEvent[];
  } catch {
    return NextResponse.json(
      { verdict: false, reason: 'Could not fetch GitHub events for this user', verifier_signature: null }
    );
  }

  const recentEvents = events.filter((e) => {
    if (!e.created_at) return false;
    return new Date(e.created_at).getTime() >= cutoff;
  });

  let qualifyingEventId: string | null = null;

  for (const event of recentEvents) {
    if (event.type === 'PushEvent') {
      const commits = event.payload.commits ?? [];
      if (commits.length === 0) continue;

      // Anti-cheat: skip pushes where ALL commits only touch README.md in a repo created < 24h ago
      const [owner, repo] = event.repo.name.split('/');
      let isNewRepo = false;
      try {
        const { data: repoData } = await octokit.rest.repos.get({ owner, repo }) as { data: RepoInfo };
        if (repoData.created_at) {
          isNewRepo = new Date(repoData.created_at).getTime() >= cutoff;
        }
      } catch {
        // If we can't fetch the repo, assume it's not new
      }

      if (isNewRepo) {
        let allReadme = true;
        for (const commit of commits) {
          try {
            const { data: commitData } = await octokit.rest.repos.getCommit({
              owner,
              repo,
              ref: commit.sha,
            }) as { data: CommitDetail };
            const files = commitData.files ?? [];
            const onlyReadme = files.every((f) => f.filename.toLowerCase() === 'readme.md');
            if (!onlyReadme) {
              allReadme = false;
              break;
            }
          } catch {
            allReadme = false;
            break;
          }
        }
        if (allReadme) continue;
      }

      qualifyingEventId = event.id;
      break;
    }

    if (event.type === 'PullRequestEvent') {
      const action = event.payload.action;
      const merged = event.payload.pull_request?.merged;
      if (action === 'opened' || (action === 'closed' && merged)) {
        qualifyingEventId = event.id;
        break;
      }
    }

    if (event.type === 'CreateEvent') {
      const refType = event.payload.ref_type;
      if (refType === 'repository' || refType === 'branch') {
        qualifyingEventId = event.id;
        break;
      }
    }
  }

  if (!qualifyingEventId) {
    return NextResponse.json({
      verdict: false,
      reason: 'No qualifying GitHub activity in the last 24 hours',
      verifier_signature: null,
    });
  }

  // Deterministic hashes seeded from the event ID
  const eventSeed = Buffer.from(qualifyingEventId, 'utf-8');
  const seedHash = createHash('sha256').update(eventSeed).digest();
  const photoHash = seedHash;
  // phash = first 8 bytes of sha256(eventId) interpreted as u64 LE
  const phashView = new DataView(seedHash.buffer, seedHash.byteOffset, 8);
  const phash = phashView.getBigUint64(0, true);
  const phashHex = phash.toString(16).padStart(16, '0');

  const reason = `Qualifying GitHub activity detected (event ${qualifyingEventId})`;
  const reasonHash = sha256(reason);
  const verifierPubkeyBytes = getVerifierPubkeyBytes();
  const participantBytes = decodeBase58Pubkey(participant_pubkey);
  const streakBytes = decodeBase58Pubkey(streak_pubkey);

  const message = buildAttestationMessage({
    verifierPubkey: verifierPubkeyBytes,
    participantPubkey: participantBytes,
    streakPubkey: streakBytes,
    dayIndex: day_index,
    photoHash,
    phash,
    verdict: true,
    reasonHash,
  });

  const signature = signAttestation(message);

  return NextResponse.json({
    verdict: true,
    reason,
    photo_hash: Buffer.from(photoHash).toString('hex'),
    phash: phashHex,
    reason_hash: Buffer.from(reasonHash).toString('hex'),
    verifier_signature: Buffer.from(signature).toString('hex'),
    verifier_pubkey: bs58.encode(verifierPubkeyBytes),
  });
}

export const POST: RouteHandler = withX402Payment(handler, {
  amount: 1000,
  recipient: process.env.VERIFICATION_FEE_WALLET ?? '',
  description: 'GitHub activity verification for coding habit check-in',
});
