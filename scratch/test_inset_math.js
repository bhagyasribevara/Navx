// Test geometric calculations for insetting, partition walls, and doors
const testRing = [
  [83.6611864, 18.4653085],
  [83.6611961, 18.4653774],
  [83.6612669, 18.4653670],
  [83.6612575, 18.4653003],
  [83.6611864, 18.4653085]
];

function getPolygonArea(ring) {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    area += ring[i][0] * ring[i+1][1] - ring[i+1][0] * ring[i][1];
  }
  return area / 2;
}

function insetPolygon(ring, distanceMeters = 0.18) {
  if (!ring || ring.length < 4) return ring;
  const area = getPolygonArea(ring);
  const isCCW = area > 0;

  const mToLat = 1 / 111139;
  const avgLat = ring[0][1];
  const mToLng = 1 / (111139 * Math.cos(avgLat * Math.PI / 180));

  const dLat = distanceMeters * mToLat;
  const dLng = distanceMeters * mToLng;

  const n = ring.length - 1; // unique vertices
  const inset = [];

  for (let i = 0; i < n; i++) {
    const prev = ring[(i - 1 + n) % n];
    const curr = ring[i];
    const next = ring[(i + 1) % n];

    // Edge vectors in meters
    const v1x = (curr[0] - prev[0]) / mToLng;
    const v1y = (curr[1] - prev[1]) / mToLat;
    const l1 = Math.hypot(v1x, v1y) || 1e-6;
    const u1x = v1x / l1, u1y = v1y / l1;

    const v2x = (next[0] - curr[0]) / mToLng;
    const v2y = (next[1] - curr[1]) / mToLat;
    const l2 = Math.hypot(v2x, v2y) || 1e-6;
    const u2x = v2x / l2, u2y = v2y / l2;

    // Inward normals
    const n1x = isCCW ? -u1y : u1y;
    const n1y = isCCW ? u1x : -u1x;

    const n2x = isCCW ? -u2y : u2y;
    const n2y = isCCW ? u2x : -u2x;

    // Bisector normal
    let bx = n1x + n2x;
    let by = n1y + n2y;
    const blen = Math.hypot(bx, by);
    if (blen > 1e-6) {
      bx /= blen;
      by /= blen;
    } else {
      bx = n1x;
      by = n1y;
    }

    // Scale by 1 / sin(theta / 2) = 1 / (bx * n1x + by * n1y), clamped
    const dot = bx * n1x + by * n1y;
    const scale = Math.min(Math.max(dot > 1e-4 ? 1 / dot : 1, 1), 2.0);

    const shiftX = bx * distanceMeters * scale * mToLng;
    const shiftY = by * distanceMeters * scale * mToLat;

    inset.push([curr[0] + shiftX, curr[1] + shiftY]);
  }
  // Close the ring
  inset.push([inset[0][0], inset[0][1]]);
  return inset;
}

const insetRing = insetPolygon(testRing, 0.2);
console.log('Original ring:', testRing);
console.log('Inset ring:', insetRing);
const origArea = Math.abs(getPolygonArea(testRing));
const insetArea = Math.abs(getPolygonArea(insetRing));
console.log('Original area vs Inset area:', { origArea, insetArea, shrunk: insetArea < origArea });
if (insetArea >= origArea) {
  throw new Error('Inset did not shrink area!');
}
console.log('✔ Inset algorithm verified');
