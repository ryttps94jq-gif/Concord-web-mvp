// E2E Journey 1: First Launch
// Install → Generate identity → Download genesis seeds → Sync lattice → First chat → First DTU

describe('Journey 1: First Launch', () => {
  beforeAll(async () => {
    // Launch app from clean state
  });

  test('app launches without crash', async () => {
    // Verify loading screen appears
    // Verify "Concord" title visible
    // Verify "Initializing device identity..." text visible
  });

  test('device identity generated on first launch', async () => {
    // Verify identity store has identity after init
    // Verify public key is non-empty string
    // Verify key algorithm is Ed25519
    // Verify linkedDevices is empty array
  });

  test('hardware capabilities detected', async () => {
    // Verify hardware store populated
    // Verify platform is 'ios' or 'android'
    // Verify at least some sensors available
  });

  test('genesis seed DTUs downloaded', async () => {
    // Verify lattice store genesis complete flag
    // Verify DTU count >= 2001
    // Verify each seed DTU passes integrity check
  });

  test('first chat message with local model', async () => {
    // Navigate to Chat tab
    // Type a message
    // Send message
    // Verify response appears
    // Verify routedTo indicator shows 'local' or 'server'
  });

  test('first DTU created and stored locally', async () => {
    // Verify DTU appears in lattice store
    // Verify DTU has valid header
    // Verify DTU passes integrity check
  });

  test('all screens render without crash', async () => {
    // Navigate to each tab: Chat, Lenses, Marketplace, Wallet, Mesh
    // Verify each renders without error
    // Navigate to Settings
    // Verify Settings renders
    // Navigate to Atlas
    // Verify Atlas renders
  });
});
