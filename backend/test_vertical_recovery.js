/**
 * Automated Verification Script for Vertical Elevation & Floor-Aware Navigation Recovery
 * Tests all 8 mandatory corrections:
 * 1. No unconditional 0.54m fallback; strict priority hierarchy ending in null/unknown
 * 2. floorLevel = 0 does NOT mean hasValidElevation = true
 * 3. Staircase direction is route-relative (UP: 0->1, DOWN: 1->0) with physical lower/upper geometry
 * 4. Step progress safeguards (local step counter reset, debounce, clamp [0,1], endpoint snapping)
 * 5. PositionProvider / PositionEngine single canonical lifecycle
 * 6. Invariant 6: Default/uncalibrated values NEVER overwrite valid state
 * 7. One normalized staircase connector structure across backend and frontend
 * 8. Horizontal navigation and graph building preserved
 */

const assert = require('assert');
const { buildGraph, reconstructPath, extractStaircaseConnectors } = require('./utils/pathfinding');

console.log('====================================================');
console.log('🚀 RUNNING NAVX VERTICAL ELEVATION RECOVERY SUITE');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(err);
  }
}

// ── Test 1: Priority Hierarchy & No Unconditional 0.54m Fallback ──
test('Priority 1 & 2: Unknown elevation is null/false, not 0.54m; floorLevel=0 != valid elevation', () => {
  const dummyNodes = [
    { _id: 'node_ground_unknown', x: 18.46, y: 83.66, floorLevel: 0, floorId: 'f0', z: 0, hasValidElevation: false },
    { _id: 'node_floor1_explicit', x: 18.47, y: 83.67, floorLevel: 1, floorId: 'f1', z: 4.04, hasValidElevation: true, elevationSource: 'node' },
    { _id: 'node_outdoor', x: 18.48, y: 83.68, z: 0, hasValidElevation: false }
  ];
  const dummyFloors = [
    { _id: 'f0', level: 0, name: 'Ground Floor' }, // no explicit elevation
    { _id: 'f1', level: 1, name: 'First Floor', elevation: 4.04 }
  ];

  const graph = buildGraph(dummyNodes, [], dummyFloors);

  // Reconstruct path with node_ground_unknown
  const res0 = reconstructPath(graph, { node_ground_unknown: null }, 'node_ground_unknown', 'node_ground_unknown', { node_ground_unknown: 0 });
  assert.strictEqual(res0.path.length, 1);
  const n0 = res0.path[0];

  // Invariant 1: Unknown elevation must be null / hasValidElevation=false, NOT 0.54
  assert.strictEqual(n0.hasValidElevation, false, 'floorLevel=0 with no explicit geometry must NOT have valid elevation');
  assert.strictEqual(n0.elevationSource, 'unknown', 'elevationSource must be unknown');
  assert.strictEqual(n0.z, null, 'z must be null, never silently defaulted to 0.54m');

  // Node with authoritative floor elevation
  const res1 = reconstructPath(graph, { node_floor1_explicit: null }, 'node_floor1_explicit', 'node_floor1_explicit', { node_floor1_explicit: 0 });
  const n1 = res1.path[0];
  assert.strictEqual(n1.hasValidElevation, true);
  assert.strictEqual(n1.z, 4.04);
  assert.strictEqual(n1.elevationSource, 'node');
});

// ── Test 2: Route-Relative Staircase Connector Direction (UP vs DOWN) ──
test('Priority 3 & 7: Authoritative physical geometry + route-relative direction (UP & DOWN)', () => {
  const floorG = { _id: 'f_ground', level: 0, elevation: 0.54, name: 'Ground' };
  const floor1 = { _id: 'f_one', level: 1, elevation: 4.04, name: 'Floor 1' };
  const floors = [floorG, floor1];

  // Route 1: Ground -> Floor 1 (Ascending)
  const ascendingPath = [
    { _id: 'g_corr', x: 18.460, y: 83.660, floorId: 'f_ground', floorLevel: 0, z: 0.54, hasValidElevation: true },
    { _id: 'stair_entry_bottom', x: 18.461, y: 83.661, floorId: 'f_ground', floorLevel: 0, z: 0.54, hasValidElevation: true, isStaircase: true },
    { _id: 'stair_exit_top', x: 18.462, y: 83.662, floorId: 'f_one', floorLevel: 1, z: 4.04, hasValidElevation: true, isStaircase: true },
    { _id: 'f1_corr', x: 18.463, y: 83.663, floorId: 'f_one', floorLevel: 1, z: 4.04, hasValidElevation: true }
  ];

  const upConnectors = extractStaircaseConnectors(ascendingPath, floors);
  assert.strictEqual(upConnectors.length, 1, 'Should find 1 staircase connector for ascending route');
  const upC = upConnectors[0];

  assert.strictEqual(upC.direction, 'UP', 'Direction must be UP');
  assert.strictEqual(upC.lowerFloorId, 'f_ground', 'lowerFloorId must be f_ground');
  assert.strictEqual(upC.upperFloorId, 'f_one', 'upperFloorId must be f_one');
  assert.strictEqual(upC.lowerElevation, 0.54, 'lowerElevation must be 0.54');
  assert.strictEqual(upC.upperElevation, 4.04, 'upperElevation must be 4.04');
  assert.strictEqual(upC.startElevation, 0.54);
  assert.strictEqual(upC.endElevation, 4.04);
  assert.strictEqual(upC.totalSteps, 20); // (4.04 - 0.54) / 0.175 ≈ 20

  // Route 2: Floor 1 -> Ground (Descending)
  const descendingPath = [
    { _id: 'f1_corr', x: 18.463, y: 83.663, floorId: 'f_one', floorLevel: 1, z: 4.04, hasValidElevation: true },
    { _id: 'stair_exit_top', x: 18.462, y: 83.662, floorId: 'f_one', floorLevel: 1, z: 4.04, hasValidElevation: true, isStaircase: true },
    { _id: 'stair_entry_bottom', x: 18.461, y: 83.661, floorId: 'f_ground', floorLevel: 0, z: 0.54, hasValidElevation: true, isStaircase: true },
    { _id: 'g_corr', x: 18.460, y: 83.660, floorId: 'f_ground', floorLevel: 0, z: 0.54, hasValidElevation: true }
  ];

  const downConnectors = extractStaircaseConnectors(descendingPath, floors);
  assert.strictEqual(downConnectors.length, 1, 'Should find 1 staircase connector for descending route');
  const downC = downConnectors[0];

  assert.strictEqual(downC.direction, 'DOWN', 'Direction must be DOWN');
  assert.strictEqual(downC.lowerFloorId, 'f_ground', 'Physical lower floor must remain f_ground even when descending');
  assert.strictEqual(downC.upperFloorId, 'f_one', 'Physical upper floor must remain f_one even when descending');
  assert.strictEqual(downC.lowerElevation, 0.54, 'Physical lower elevation must remain 0.54');
  assert.strictEqual(downC.upperElevation, 4.04, 'Physical upper elevation must remain 4.04');
  assert.strictEqual(downC.startElevation, 4.04, 'startElevation is route start node (Floor 1)');
  assert.strictEqual(downC.endElevation, 0.54, 'endElevation is route end node (Ground)');
});

// ── Test 3: Frontend VerticalTracker Step Progress & Safeguards ──
test('Priority 4: VerticalTracker progress estimator with safeguards and endpoint snapping', () => {
  // Test using a simulated VerticalTracker logic matching user/src/navigation/VerticalTracker.js
  const connector = {
    connectorId: 'conn_1',
    direction: 'UP',
    lowerFloorId: 'f_ground',
    upperFloorId: 'f_one',
    lowerFloorLevel: 0,
    upperFloorLevel: 1,
    lowerElevation: 0.54,
    upperElevation: 4.04,
    startElevation: 0.54,
    endElevation: 4.04,
    totalSteps: 10,
    startNode: { x: 18.461, y: 83.661, nodeId: 'n_start' },
    endNode: { x: 18.462, y: 83.662, nodeId: 'n_end' }
  };

  // Simulating VerticalTracker
  const VerticalTracker = require('../user/src/navigation/VerticalTracker').default;
  const tracker = new VerticalTracker();

  // 1. Activation
  tracker.activate(connector);
  assert.strictEqual(tracker.state.isActive, true);
  assert.strictEqual(tracker.state.direction, 'UP');
  assert.strictEqual(tracker.state.smoothProgress, 0.0);
  assert.strictEqual(tracker.state.currentPosition.z, 0.54);

  // 2. Safeguard: Pre-activation step rejection
  tracker.onStep({}, tracker.state.activatedAt - 500);
  assert.strictEqual(tracker.state.stepsClimbed, 0, 'Must ignore steps detected prior to activation');

  // 3. Safeguard: Duplicate debounce (< 220ms)
  const t0 = tracker.state.activatedAt + 100;
  tracker.onStep({}, t0);
  assert.strictEqual(tracker.state.stepsClimbed, 1);

  tracker.onStep({}, t0 + 50); // only 50ms later -> duplicate
  assert.strictEqual(tracker.state.stepsClimbed, 1, 'Duplicate step within 50ms must be debounced');

  // 4. Climbs with steps
  let t = t0;
  for (let i = 2; i <= 10; i++) {
    t += 350;
    tracker.onStep({}, t);
  }

  // 5. Endpoint snap
  assert.strictEqual(tracker.state.floorReached, true, 'Floor must be reached after 10 steps');
  assert.strictEqual(tracker.state.smoothProgress, 1.0, 'Progress must be snapped to 1.0');
  const pos = tracker.getPosition();
  assert.strictEqual(pos.z, 4.04, 'Z must snap exactly to upperElevation (4.04m)');
  assert.strictEqual(pos.floorId, 'f_one');
  assert.strictEqual(pos.floorLevel, 1);

  // 6. Clean deactivation
  tracker.deactivate();
  assert.strictEqual(tracker.state.isActive, false);
  assert.strictEqual(tracker.getPosition(), null);
});

// ── Test 4: VerticalTracker Descending (DOWN) Direction ──
test('Priority 4: VerticalTracker DESCENDING (DOWN) progress (1.0 -> 0.0) and lower snap', () => {
  const downConnector = {
    connectorId: 'conn_down',
    direction: 'DOWN',
    lowerFloorId: 'f_ground',
    upperFloorId: 'f_one',
    lowerFloorLevel: 0,
    upperFloorLevel: 1,
    lowerElevation: 0.54,
    upperElevation: 4.04,
    startElevation: 4.04,
    endElevation: 0.54,
    totalSteps: 10,
    startNode: { x: 18.462, y: 83.662, nodeId: 'n_top' },
    endNode: { x: 18.461, y: 83.661, nodeId: 'n_bottom' }
  };

  const VerticalTracker = require('../user/src/navigation/VerticalTracker').default;
  const tracker = new VerticalTracker();

  tracker.activate(downConnector);
  assert.strictEqual(tracker.state.isActive, true);
  assert.strictEqual(tracker.state.direction, 'DOWN');
  assert.strictEqual(tracker.state.smoothProgress, 1.0, 'DOWN progress starts at 1.0');
  assert.strictEqual(tracker.state.currentPosition.z, 4.04, 'DOWN starting Z is upperElevation (4.04)');

  let t = tracker.state.activatedAt + 100;
  for (let i = 1; i <= 10; i++) {
    t += 350;
    tracker.onStep({}, t);
  }

  assert.strictEqual(tracker.state.floorReached, true);
  assert.strictEqual(tracker.state.smoothProgress, 0.0, 'DOWN progress must end at 0.0');
  const pos = tracker.getPosition();
  assert.strictEqual(pos.z, 0.54, 'DOWN ending Z must snap exactly to lowerElevation (0.54)');
  assert.strictEqual(pos.floorId, 'f_ground');
  assert.strictEqual(pos.floorLevel, 0);
});

// ── Test 5: Invariant 6 - Non-destructive State Protection ──
test('Priority 6: Invariant 6 - GPS/uncalibrated updates NEVER overwrite valid indoor/elevation state', () => {
  const { PositionEngine } = require('../user/src/positioning');
  const engine = new PositionEngine();

  // Simulate calibrated indoor state on Floor 1 with elevation
  engine.updatePosition({
    x: 18.4615,
    y: 83.6625,
    floorId: 'floor_1_chem',
    floorLevel: 1,
    hasValidFloor: true,
    floorSource: 'qr_code',
    z: 4.04,
    hasValidElevation: true,
    elevationSource: 'staircase_connector',
    isIndoor: true
  });

  assert.strictEqual(engine.position.floorLevel, 1);
  assert.strictEqual(engine.position.z, 4.04);
  assert.strictEqual(engine.position.hasValidElevation, true);

  // Now incoming uncalibrated GPS update with floor = 0, z = 0, hasValidElevation = false
  engine.processGPSUpdate(18.4616, 83.6626, 10);

  // Verify Invariant: Valid indoor floor and elevation must NOT be overwritten
  assert.strictEqual(engine.position.floorId, 'floor_1_chem', 'GPS must NOT wipe valid floorId');
  assert.strictEqual(engine.position.floorLevel, 1, 'GPS must NOT reset floorLevel to 0');
  assert.strictEqual(engine.position.hasValidFloor, true);
  assert.strictEqual(engine.position.z, 4.04, 'GPS must NOT reset elevation to 0 or null');
  assert.strictEqual(engine.position.hasValidElevation, true, 'GPS must NOT reset hasValidElevation');
  assert.strictEqual(engine.position.elevationSource, 'staircase_connector');
});

// ── Test 6: Normalized Staircase Schema Compatibility ──
test('Priority 7: Frontend StaircaseExtractor normalizes both backend & client metadata to same schema', () => {
  const StaircaseExtractor = require('../user/src/navigation/StaircaseExtractor').default;

  const backendConnector = {
    connectorId: 'backend_stair_1',
    startNodeId: 'n1',
    endNodeId: 'n2',
    direction: 'UP',
    startElevation: 0.54,
    endElevation: 4.04,
    lowerFloorId: 'f0',
    upperFloorId: 'f1',
    totalSteps: 18
  };

  const normalized = StaircaseExtractor.normalizeConnector(backendConnector);
  assert.strictEqual(normalized.connectorId, 'backend_stair_1');
  assert.strictEqual(normalized.direction, 'UP');
  assert.strictEqual(normalized.lowerElevation, 0.54);
  assert.strictEqual(normalized.upperElevation, 4.04);
  assert.strictEqual(normalized.totalSteps, 18);
  assert.strictEqual(normalized.lowerFloorId, 'f0');
  assert.strictEqual(normalized.upperFloorId, 'f1');
});

// ── Test 7: Frontend StaircaseExtractor.resolveNodeElevation Hierarchy ──
test('Priority 1: StaircaseExtractor.resolveNodeElevation follows strict priority hierarchy', () => {
  const StaircaseExtractor = require('../user/src/navigation/StaircaseExtractor').default;
  const floors = [
    { _id: 'f0', level: 0 },
    { _id: 'f1', level: 1, elevation: 4.04 }
  ];
  const floorLevelMap = new Map([['f0', 0], ['f1', 1]]);

  // 1. Explicit node elevation
  const res1 = StaircaseExtractor.resolveNodeElevation(
    { z: 3.8, hasValidElevation: true, elevationSource: 'calibrated' },
    floorLevelMap,
    floors
  );
  assert.strictEqual(res1.z, 3.8);
  assert.strictEqual(res1.hasValidElevation, true);
  assert.strictEqual(res1.elevationSource, 'calibrated');

  // 2. Authoritative floor elevation
  const res2 = StaircaseExtractor.resolveNodeElevation(
    { floorId: 'f1', floorLevel: 1, z: 0, hasValidElevation: false },
    floorLevelMap,
    floors
  );
  assert.strictEqual(res2.z, 4.04);
  assert.strictEqual(res2.hasValidElevation, true);
  assert.strictEqual(res2.elevationSource, 'floor');

  // 3. Fallback for upper floor without explicit elevation
  const res3 = StaircaseExtractor.resolveNodeElevation(
    { floorId: 'f2_no_elev', floorLevel: 2 },
    new Map([['f2_no_elev', 2]]),
    []
  );
  assert.strictEqual(res3.z, 2 * 3.5 + 0.54);
  assert.strictEqual(res3.hasValidElevation, true);
  assert.strictEqual(res3.elevationSource, 'floor_fallback');

  // 4. Unknown ground floor (never silently converted to 0.54)
  const res4 = StaircaseExtractor.resolveNodeElevation(
    { floorId: 'f0', floorLevel: 0, z: 0, hasValidElevation: false },
    floorLevelMap,
    floors
  );
  assert.strictEqual(res4.z, null, 'Ground floor with no explicit elevation must resolve to null z');
  assert.strictEqual(res4.hasValidElevation, false, 'hasValidElevation must be false');
  assert.strictEqual(res4.elevationSource, 'unknown');
});

// ── Test 8: Multi-floor Route Staircase Extraction (Floor 0 -> Floor 1 -> Floor 2) ──
test('Priority 3 & 7: Multi-floor route extracts multiple distinct authoritative connectors', () => {
  const floors = [
    { _id: 'f0', level: 0, elevation: 0.54 },
    { _id: 'f1', level: 1, elevation: 4.04 },
    { _id: 'f2', level: 2, elevation: 7.54 }
  ];

  const multiFloorPath = [
    { _id: 'n_f0', x: 18.460, y: 83.660, floorId: 'f0', floorLevel: 0, z: 0.54, hasValidElevation: true },
    { _id: 'stair1_bottom', x: 18.461, y: 83.661, floorId: 'f0', floorLevel: 0, z: 0.54, hasValidElevation: true, isStaircase: true },
    { _id: 'stair1_top', x: 18.462, y: 83.662, floorId: 'f1', floorLevel: 1, z: 4.04, hasValidElevation: true, isStaircase: true },
    { _id: 'n_f1', x: 18.463, y: 83.663, floorId: 'f1', floorLevel: 1, z: 4.04, hasValidElevation: true },
    { _id: 'stair2_bottom', x: 18.464, y: 83.664, floorId: 'f1', floorLevel: 1, z: 4.04, hasValidElevation: true, isStaircase: true },
    { _id: 'stair2_top', x: 18.465, y: 83.665, floorId: 'f2', floorLevel: 2, z: 7.54, hasValidElevation: true, isStaircase: true },
    { _id: 'n_f2', x: 18.466, y: 83.666, floorId: 'f2', floorLevel: 2, z: 7.54, hasValidElevation: true }
  ];

  const connectors = extractStaircaseConnectors(multiFloorPath, floors);
  assert.strictEqual(connectors.length, 2, 'Must extract exactly 2 connectors for 2 distinct stair flights');

  // Flight 1: 0 -> 1
  assert.strictEqual(connectors[0].direction, 'UP');
  assert.strictEqual(connectors[0].lowerFloorLevel, 0);
  assert.strictEqual(connectors[0].upperFloorLevel, 1);
  assert.strictEqual(connectors[0].lowerElevation, 0.54);
  assert.strictEqual(connectors[0].upperElevation, 4.04);

  // Flight 2: 1 -> 2
  assert.strictEqual(connectors[1].direction, 'UP');
  assert.strictEqual(connectors[1].lowerFloorLevel, 1);
  assert.strictEqual(connectors[1].upperFloorLevel, 2);
  assert.strictEqual(connectors[1].lowerElevation, 4.04);
  assert.strictEqual(connectors[1].upperElevation, 7.54);
});

// ── Test 9: Safeguard - Clamping and Extra Step Immunity ──
test('Priority 4: Extra steps beyond totalSteps do not overshoot progress or elevation', () => {
  const VerticalTracker = require('../user/src/navigation/VerticalTracker').default;
  const tracker = new VerticalTracker();

  tracker.activate({
    connectorId: 'conn_clamp',
    direction: 'UP',
    lowerFloorId: 'f0',
    upperFloorId: 'f1',
    lowerElevation: 0.54,
    upperElevation: 4.04,
    totalSteps: 5,
    startNode: { x: 1, y: 1 },
    endNode: { x: 2, y: 2 }
  });

  let t = tracker.state.activatedAt + 100;
  // User takes 15 steps (10 more than totalSteps = 5)
  for (let i = 1; i <= 15; i++) {
    t += 300;
    tracker.onStep({}, t);
  }

  assert.strictEqual(tracker.state.smoothProgress, 1.0, 'Progress must never exceed 1.0');
  assert.strictEqual(tracker.getPosition().z, 4.04, 'Elevation must never exceed upperElevation (4.04m)');
  assert.strictEqual(tracker.state.floorReached, true);
});

// ── Test 10: PositionEngine setFloor & reset lifecycle ──
test('Priority 5 & 2: PositionEngine setFloor with elevation validation and reset', () => {
  const { PositionEngine } = require('../user/src/positioning');
  const engine = new PositionEngine();

  // Ground floor with no elevation
  engine.setFloor('f0', 0, null, 'unknown');
  assert.strictEqual(engine.position.floorLevel, 0);
  assert.strictEqual(engine.position.hasValidElevation, false, 'floorLevel=0 without elevation must NOT set hasValidElevation=true');
  assert.strictEqual(engine.position.elevationSource, 'unknown');

  // Upper floor with known elevation
  engine.setFloor('f1', 1, 4.04, 'staircase_connector');
  assert.strictEqual(engine.position.floorLevel, 1);
  assert.strictEqual(engine.position.z, 4.04);
  assert.strictEqual(engine.position.hasValidElevation, true);
  assert.strictEqual(engine.position.elevationSource, 'staircase_connector');

  // Reset
  engine.reset();
  assert.strictEqual(engine.position.floorId, null);
  assert.strictEqual(engine.position.hasValidFloor, false);
  assert.strictEqual(engine.position.z, null);
  assert.strictEqual(engine.position.hasValidElevation, false);
  assert.strictEqual(engine.isCalibrated, false);
});

console.log('\n====================================================');
console.log(`TEST RESULTS: ${passedTests}/${totalTests} PASSED`);
console.log('====================================================');

if (passedTests !== totalTests) {
  process.exit(1);
} else {
  process.exit(0);
}
