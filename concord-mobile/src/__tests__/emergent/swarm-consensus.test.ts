import {
  proposeConsensus,
  processVote,
  checkQuorum,
  expireProposals,
} from '../../emergent/swarm-consensus';
import type {
  ConsensusProposal,
} from '../../emergent/swarm-consensus';
import type { MeshPeer, PeerCapabilities, PeerReputation } from '../../utils/types';

// ── Test Helpers ─────────────────────────────────────────────────────────────

function makePeer(id: string): MeshPeer {
  const capabilities: PeerCapabilities = {
    bluetooth: true,
    wifiDirect: false,
    nfc: false,
    lora: false,
    internet: true,
  };
  const reputation: PeerReputation = {
    validDTUs: 10,
    invalidDTUs: 0,
    totalRelays: 5,
    score: 0.9,
  };
  return {
    id,
    publicKey: `pk-${id}`,
    name: `Peer ${id}`,
    transport: 3, // BLUETOOTH
    rssi: -50,
    lastSeen: Date.now(),
    capabilities,
    reputation,
    authenticated: true,
  };
}

function makePeers(count: number): MeshPeer[] {
  return Array.from({ length: count }, (_, i) => makePeer(`peer-${i}`));
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('swarm-consensus', () => {
  // ── proposeConsensus ─────────────────────────────────────────────────────

  describe('proposeConsensus', () => {
    it('creates a proposal with correct topic and value', () => {
      const peers = makePeers(5);
      const proposal = proposeConsensus('firmware-version', '2.1.0', peers);

      expect(proposal.topic).toBe('firmware-version');
      expect(proposal.value).toBe('2.1.0');
    });

    it('generates a unique proposal ID', () => {
      const peers = makePeers(3);
      const p1 = proposeConsensus('topic-a', 'val-a', peers);
      const p2 = proposeConsensus('topic-b', 'val-b', peers);

      expect(p1.id).toBeTruthy();
      expect(p2.id).toBeTruthy();
      expect(p1.id).not.toBe(p2.id);
      expect(p1.id.startsWith('csp_')).toBe(true);
    });

    it('sets status to pending with empty votes', () => {
      const proposal = proposeConsensus('test', 'value', makePeers(4));

      expect(proposal.status).toBe('pending');
      expect(proposal.votes).toEqual([]);
    });

    it('sets expected voters from mesh peers', () => {
      const peers = makePeers(6);
      const proposal = proposeConsensus('test', 'value', peers);

      expect(proposal.expectedVoters).toHaveLength(6);
      expect(proposal.expectedVoters).toContain('peer-0');
      expect(proposal.expectedVoters).toContain('peer-5');
    });

    it('sets quorum threshold to approximately 2/3', () => {
      const proposal = proposeConsensus('test', 'value', makePeers(3));
      expect(proposal.quorumThreshold).toBeCloseTo(2 / 3, 5);
    });

    it('sets a future expiry time', () => {
      const before = Date.now();
      const proposal = proposeConsensus('test', 'value', makePeers(3));
      const after = Date.now();

      expect(proposal.expiresAt).toBeGreaterThan(before);
      expect(proposal.createdAt).toBeGreaterThanOrEqual(before);
      expect(proposal.createdAt).toBeLessThanOrEqual(after);
      // Default TTL is 5 minutes
      expect(proposal.expiresAt - proposal.createdAt).toBe(5 * 60 * 1000);
    });

    it('handles empty peer list', () => {
      const proposal = proposeConsensus('solo-topic', 'value', []);

      expect(proposal.expectedVoters).toHaveLength(0);
      expect(proposal.status).toBe('pending');
    });
  });

  // ── processVote ──────────────────────────────────────────────────────────

  describe('processVote', () => {
    it('records a yes vote from an expected voter', () => {
      const proposal = proposeConsensus('test', 'value', makePeers(3));
      const updated = processVote(proposal, 'peer-0', true);

      expect(updated.votes).toHaveLength(1);
      expect(updated.votes[0].peerId).toBe('peer-0');
      expect(updated.votes[0].vote).toBe(true);
    });

    it('records a no vote from an expected voter', () => {
      const proposal = proposeConsensus('test', 'value', makePeers(3));
      const updated = processVote(proposal, 'peer-1', false);

      expect(updated.votes).toHaveLength(1);
      expect(updated.votes[0].vote).toBe(false);
    });

    it('ignores votes from unknown peers', () => {
      const proposal = proposeConsensus('test', 'value', makePeers(3));
      const updated = processVote(proposal, 'unknown-peer', true);

      expect(updated.votes).toHaveLength(0);
    });

    it('ignores duplicate votes from the same peer', () => {
      const proposal = proposeConsensus('test', 'value', makePeers(3));
      const after1 = processVote(proposal, 'peer-0', true);
      const after2 = processVote(after1, 'peer-0', false);

      expect(after2.votes).toHaveLength(1);
      expect(after2.votes[0].vote).toBe(true); // first vote stands
    });

    it('does not modify the original proposal', () => {
      const proposal = proposeConsensus('test', 'value', makePeers(3));
      const originalVoteCount = proposal.votes.length;
      processVote(proposal, 'peer-0', true);

      expect(proposal.votes.length).toBe(originalVoteCount);
    });

    it('marks proposal as accepted when quorum is reached with yes votes', () => {
      const peers = makePeers(3); // need ceil(3 * 2/3) = 2 yes votes
      let proposal = proposeConsensus('test', 'value', peers);

      proposal = processVote(proposal, 'peer-0', true);
      expect(proposal.status).toBe('pending');

      proposal = processVote(proposal, 'peer-1', true);
      expect(proposal.status).toBe('accepted');
    });

    it('marks proposal as rejected when acceptance becomes impossible', () => {
      const peers = makePeers(3); // need 2 yes votes, only 3 voters
      let proposal = proposeConsensus('test', 'value', peers);

      proposal = processVote(proposal, 'peer-0', false);
      proposal = processVote(proposal, 'peer-1', false);
      // Now only peer-2 is left, max possible yes = 1, but we need 2
      expect(proposal.status).toBe('rejected');
    });

    it('ignores votes on already accepted proposals', () => {
      const peers = makePeers(3);
      let proposal = proposeConsensus('test', 'value', peers);
      proposal = processVote(proposal, 'peer-0', true);
      proposal = processVote(proposal, 'peer-1', true);
      expect(proposal.status).toBe('accepted');

      // Late vote should be ignored
      const afterLate = processVote(proposal, 'peer-2', false);
      expect(afterLate.votes).toHaveLength(2);
      expect(afterLate.status).toBe('accepted');
    });

    it('ignores votes on expired proposals', () => {
      const peers = makePeers(3);
      let proposal = proposeConsensus('test', 'value', peers);
      // Force expiry
      proposal = { ...proposal, expiresAt: Date.now() - 1000 };

      const updated = processVote(proposal, 'peer-0', true);
      expect(updated.status).toBe('expired');
      expect(updated.votes).toHaveLength(0);
    });

    it('records the receivedAt timestamp for each vote', () => {
      const proposal = proposeConsensus('test', 'value', makePeers(3));
      const before = Date.now();
      const updated = processVote(proposal, 'peer-0', true);
      const after = Date.now();

      expect(updated.votes[0].receivedAt).toBeGreaterThanOrEqual(before);
      expect(updated.votes[0].receivedAt).toBeLessThanOrEqual(after);
    });
  });

  // ── checkQuorum ──────────────────────────────────────────────────────────

  describe('checkQuorum', () => {
    it('reports quorum not reached when no votes cast', () => {
      const proposal = proposeConsensus('test', 'value', makePeers(5));
      const result = checkQuorum(proposal);

      expect(result.reached).toBe(false);
      expect(result.accepted).toBe(false);
      expect(result.yesVotes).toBe(0);
      expect(result.noVotes).toBe(0);
      expect(result.totalVotes).toBe(0);
      expect(result.missingVoters).toHaveLength(5);
    });

    it('reports quorum reached and accepted with sufficient yes votes', () => {
      const peers = makePeers(6); // need ceil(6 * 2/3) = 4 yes votes
      let proposal = proposeConsensus('test', 'value', peers);
      proposal = processVote(proposal, 'peer-0', true);
      proposal = processVote(proposal, 'peer-1', true);
      proposal = processVote(proposal, 'peer-2', true);
      proposal = processVote(proposal, 'peer-3', true);

      const result = checkQuorum(proposal);
      expect(result.reached).toBe(true);
      expect(result.accepted).toBe(true);
      expect(result.yesVotes).toBe(4);
    });

    it('reports quorum reached and rejected when acceptance is impossible', () => {
      const peers = makePeers(6); // need 4 yes votes
      let proposal = proposeConsensus('test', 'value', peers);
      proposal = processVote(proposal, 'peer-0', false);
      proposal = processVote(proposal, 'peer-1', false);
      proposal = processVote(proposal, 'peer-2', false);
      // 3 nos, 3 remaining, max possible yes = 3 < 4 required

      const result = checkQuorum(proposal);
      expect(result.reached).toBe(true);
      expect(result.accepted).toBe(false);
      expect(result.noVotes).toBe(3);
    });

    it('correctly lists missing voters', () => {
      const peers = makePeers(4);
      let proposal = proposeConsensus('test', 'value', peers);
      proposal = processVote(proposal, 'peer-0', true);
      proposal = processVote(proposal, 'peer-2', true);

      const result = checkQuorum(proposal);
      expect(result.missingVoters).toContain('peer-1');
      expect(result.missingVoters).toContain('peer-3');
      expect(result.missingVoters).not.toContain('peer-0');
      expect(result.missingVoters).not.toContain('peer-2');
    });

    it('includes expected voter count and threshold', () => {
      const peers = makePeers(9);
      const proposal = proposeConsensus('test', 'value', peers);
      const result = checkQuorum(proposal);

      expect(result.expectedVoters).toBe(9);
      expect(result.quorumThreshold).toBeCloseTo(2 / 3, 5);
    });

    it('handles single voter needing unanimous approval', () => {
      const peers = makePeers(1); // ceil(1 * 2/3) = 1
      let proposal = proposeConsensus('test', 'value', peers);
      proposal = processVote(proposal, 'peer-0', true);

      const result = checkQuorum(proposal);
      expect(result.reached).toBe(true);
      expect(result.accepted).toBe(true);
    });

    it('handles proposal with no expected voters', () => {
      const proposal = proposeConsensus('test', 'value', []);
      const result = checkQuorum(proposal);

      // With 0 expected voters, quorum threshold = ceil(0 * 2/3) = 0
      // 0 yes votes >= 0 required => accepted
      expect(result.reached).toBe(true);
      expect(result.accepted).toBe(true);
      expect(result.expectedVoters).toBe(0);
    });
  });

  // ── expireProposals ──────────────────────────────────────────────────────

  describe('expireProposals', () => {
    it('returns empty array when no proposals are expired', () => {
      const proposals = new Map<string, ConsensusProposal>();
      const p = proposeConsensus('test', 'value', makePeers(3));
      proposals.set(p.id, p);

      const expired = expireProposals(proposals, Date.now());
      expect(expired).toEqual([]);
    });

    it('returns IDs of expired pending proposals', () => {
      const proposals = new Map<string, ConsensusProposal>();

      const p1 = proposeConsensus('topic-1', 'val-1', makePeers(3));
      const expiredP1: ConsensusProposal = {
        ...p1,
        expiresAt: Date.now() - 10000,
      };
      proposals.set(expiredP1.id, expiredP1);

      const p2 = proposeConsensus('topic-2', 'val-2', makePeers(3));
      proposals.set(p2.id, p2); // still valid

      const expired = expireProposals(proposals, Date.now());
      expect(expired).toHaveLength(1);
      expect(expired).toContain(expiredP1.id);
    });

    it('does not return already accepted proposals even if past expiry', () => {
      const proposals = new Map<string, ConsensusProposal>();

      const p = proposeConsensus('test', 'value', makePeers(3));
      const acceptedP: ConsensusProposal = {
        ...p,
        status: 'accepted',
        expiresAt: Date.now() - 10000,
      };
      proposals.set(acceptedP.id, acceptedP);

      const expired = expireProposals(proposals, Date.now());
      expect(expired).toEqual([]);
    });

    it('does not return already rejected proposals', () => {
      const proposals = new Map<string, ConsensusProposal>();

      const p = proposeConsensus('test', 'value', makePeers(3));
      const rejectedP: ConsensusProposal = {
        ...p,
        status: 'rejected',
        expiresAt: Date.now() - 10000,
      };
      proposals.set(rejectedP.id, rejectedP);

      const expired = expireProposals(proposals, Date.now());
      expect(expired).toEqual([]);
    });

    it('does not return already expired proposals', () => {
      const proposals = new Map<string, ConsensusProposal>();

      const p = proposeConsensus('test', 'value', makePeers(3));
      const alreadyExpired: ConsensusProposal = {
        ...p,
        status: 'expired',
        expiresAt: Date.now() - 10000,
      };
      proposals.set(alreadyExpired.id, alreadyExpired);

      const expired = expireProposals(proposals, Date.now());
      expect(expired).toEqual([]);
    });

    it('handles empty proposals map', () => {
      const expired = expireProposals(new Map(), Date.now());
      expect(expired).toEqual([]);
    });

    it('returns multiple expired proposal IDs', () => {
      const proposals = new Map<string, ConsensusProposal>();
      const pastTime = Date.now() - 100000;

      for (let i = 0; i < 5; i++) {
        const p = proposeConsensus(`topic-${i}`, `val-${i}`, makePeers(3));
        const expired: ConsensusProposal = {
          ...p,
          expiresAt: pastTime,
        };
        proposals.set(expired.id, expired);
      }

      const expired = expireProposals(proposals, Date.now());
      expect(expired).toHaveLength(5);
    });

    it('uses the provided now timestamp, not Date.now()', () => {
      const proposals = new Map<string, ConsensusProposal>();
      const p = proposeConsensus('test', 'value', makePeers(3));
      proposals.set(p.id, p);

      // Check with a time far in the future
      const farFuture = Date.now() + 10 * 60 * 1000;
      const expired = expireProposals(proposals, farFuture);
      expect(expired).toHaveLength(1);
      expect(expired).toContain(p.id);
    });
  });
});
