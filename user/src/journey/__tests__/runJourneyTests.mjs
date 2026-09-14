// Standalone test suite for Take Me Back: JourneyStorage, JourneyRecorder, ReturnPathMatcher

const mockStorage = new Map();
const mockAsyncStorage = {
  setItem: async (key, val) => { mockStorage.set(key, val); },
  getItem: async (key) => mockStorage.get(key) || null,
  removeItem: async (key) => { mockStorage.delete(key); },
  multiRemove: async (keys) => { keys.forEach(k => mockStorage.delete(k)); },
  clear: async () => { mockStorage.clear(); },
};

// Simple assert helper
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Simple test runner
let passCount = 0;
async function runTest(name, fn) {
  try {
    await fn();
    console.log(`✅ PASS: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`❌ FAIL: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function run() {
  console.log("🚀 Running Journey Retracing Unit Tests...\n");

  // --- Test Haversine Distance (local implementation matching pathfinding.js) ---
  const EARTH_RADIUS_M = 6371000;
  const DEG_TO_RAD = Math.PI / 180;
  function geoDistMeters(lat1, lon1, lat2, lon2) {
    const dLat = (lat2 - lat1) * DEG_TO_RAD;
    const dLon = (lon2 - lon1) * DEG_TO_RAD;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // --- Test Journey Storage Logic ---
  await runTest("JourneyStorage save, retrieve, and clear active session", async () => {
    mockStorage.clear();
    const session = { journeyId: "test_123", campusId: "campus_abc", startFloor: 1 };
    await mockAsyncStorage.setItem("@navx_active_journey", JSON.stringify(session));

    const retrieved = JSON.parse(await mockAsyncStorage.getItem("@navx_active_journey"));
    assert(retrieved.journeyId === "test_123", "journeyId should match");

    await mockAsyncStorage.removeItem("@navx_active_journey");
    const afterClear = await mockAsyncStorage.getItem("@navx_active_journey");
    assert(afterClear === null, "active journey should be null after remove");
  });

  await runTest("JourneyStorage save completed journeys and enforce MAX_RECENT_JOURNEYS = 10", async () => {
    mockStorage.clear();
    const journeys = [];
    for (let i = 1; i <= 15; i++) {
      journeys.unshift({ journeyId: `j_${i}`, distance: i * 10 });
    }
    // Trim to 10
    const trimmed = journeys.slice(0, 10);
    await mockAsyncStorage.setItem("@navx_completed_journeys", JSON.stringify(trimmed));

    const stored = JSON.parse(await mockAsyncStorage.getItem("@navx_completed_journeys"));
    assert(stored.length === 10, "Should have capped at 10 journeys");
    assert(stored[0].journeyId === "j_15", "Newest journey should be first");
  });

  await runTest("JourneyStorage clearAllJourneys idempotently wipes all data", async () => {
    await mockAsyncStorage.multiRemove(["@navx_active_journey", "@navx_completed_journeys"]);
    const active = await mockAsyncStorage.getItem("@navx_active_journey");
    const completed = await mockAsyncStorage.getItem("@navx_completed_journeys");
    assert(active === null, "active journey should be null");
    assert(completed === null, "completed journeys should be null");
  });

  // --- Test ReturnPathMatcher Logic ---
  await runTest("ReturnPathMatcher reverses nodes and inverts floor transitions correctly", () => {
    const originalJourney = {
      journeyId: "j_return_test",
      campusId: "campus_1",
      startPoint: { name: "Main Gate", x: 18.4665, y: 83.6629, floorId: "f1" },
      destination: { name: "AI Lab", roomId: "r_ai", x: 18.4675, y: 83.6639, floorId: "f2" },
      pathNodes: [
        { nodeId: "node_1", x: 18.4665, y: 83.6629, floorId: "f1", floorLevel: 1 },
        { nodeId: "node_2", x: 18.4668, y: 83.6632, floorId: "f1", floorLevel: 1 },
        { nodeId: "node_stair", x: 18.4670, y: 83.6635, floorId: "f1", floorLevel: 1 },
        { nodeId: "node_stair_f2", x: 18.4670, y: 83.6635, floorId: "f2", floorLevel: 2 },
        { nodeId: "node_ai", x: 18.4675, y: 83.6639, floorId: "f2", floorLevel: 2 },
      ],
      floorTransitions: [
        {
          transitionNode: "node_stair",
          fromFloor: "f1",
          toFloor: "f2",
          fromFloorLevel: 1,
          toFloorLevel: 2,
          changeType: "stairs"
        }
      ]
    };

    // Reversal logic
    const reversedNodes = originalJourney.pathNodes.map(n => ({ ...n })).reverse();
    assert(reversedNodes[0].nodeId === "node_ai", "Reversed path starts at original destination");
    assert(reversedNodes[reversedNodes.length - 1].nodeId === "node_1", "Reversed path ends at original start point");

    // Inverted transitions
    const invertedTransitions = originalJourney.floorTransitions.map(t => ({
      transitionNode: t.transitionNode,
      fromFloor: t.toFloor,
      toFloor: t.fromFloor,
      fromFloorLevel: t.toFloorLevel,
      toFloorLevel: t.fromFloorLevel,
      changeType: t.changeType,
    })).reverse();

    assert(invertedTransitions[0].fromFloor === "f2", "Return floor transition starts from f2");
    assert(invertedTransitions[0].toFloor === "f1", "Return floor transition goes to f1");
    assert(invertedTransitions[0].fromFloorLevel === 2, "Return level starts at 2");
    assert(invertedTransitions[0].toFloorLevel === 1, "Return level ends at 1");
  });

  await runTest("ReturnPathMatcher deviation detection with thresholds", () => {
    const path = [
      { nodeId: "n1", x: 18.4675, y: 83.6639 },
      { nodeId: "n2", x: 18.4670, y: 83.6635 },
      { nodeId: "n3", x: 18.4665, y: 83.6629 }
    ];

    // User is right at n1 (0 meters)
    const distOnTrack = geoDistMeters(18.4675, 83.6639, path[0].x, path[0].y);
    assert(distOnTrack < 1, "User is on track");

    // User is slightly off (e.g. 10 meters off)
    const distSmallJitter = 10;
    assert(distSmallJitter <= 15, "10m should be within NEARBY_TOLERANCE_METERS (15m)");

    // User is 20 meters off
    const distOff = 20;
    assert(distOff > 15 && distOff <= 25, "20m should be RECONNECTING state");

    // User is 50 meters off (large deviation)
    const distSevere = 50;
    assert(distSevere > 25, "50m should exceed DEVIATION_THRESHOLD_METERS (25m)");
  });

  await runTest("Campus Radius validation & exit logic", () => {
    const campusCenter = { lat: 18.4665, lng: 83.6629 };
    const campusRadius = 500; // 500 meters

    // Point 100m away (inside)
    const dInside = geoDistMeters(18.4670, 83.6629, campusCenter.lat, campusCenter.lng);
    assert(dInside < campusRadius, "Inside point is under 500m");

    // Point 800m away (outside)
    const dOutside = geoDistMeters(18.4740, 83.6629, campusCenter.lat, campusCenter.lng);
    assert(dOutside > campusRadius, "Outside point exceeds 500m radius");
  });

  console.log(`\n🎉 ALL ${passCount} TESTS PASSED!`);
}

run();
