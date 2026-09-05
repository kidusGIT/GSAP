function getCubicDerivative(p, t) {
  const mt = 1 - t;
  return {
    x:
      3 * mt * mt * (p[1].x - p[0].x) +
      6 * mt * t * (p[2].x - p[1].x) +
      3 * t * t * (p[3].x - p[2].x),
    y:
      3 * mt * mt * (p[1].y - p[0].y) +
      6 * mt * t * (p[2].y - p[1].y) +
      3 * t * t * (p[3].y - p[2].y),
  };
}

function getCubicSpeed(p, t) {
  const d = getCubicDerivative(p, t);
  return Math.sqrt(d.x * d.x + d.y * d.y);
}

function getCubicArcLength(p, t1 = 0, t2 = 1) {
  const legendrePoints = [
    { w: 0.5688888889, x: 0.0 },
    { w: 0.4786286705, x: -0.5384693101 },
    { w: 0.4786286705, x: 0.5384693101 },
    { w: 0.2369268851, x: -0.9061798459 },
    { w: 0.2369268851, x: 0.9061798459 },
  ];

  const halfLength = (t2 - t1) / 2;
  const midPoint = (t1 + t2) / 2;
  let length = 0;

  for (const pt of legendrePoints) {
    const t = midPoint + halfLength * pt.x;
    length += pt.w * getCubicSpeed(p, t);
  }

  return halfLength * length;
}

function parseCubicBezierArray(coords) {
  if (!Array.isArray(coords) || coords.length < 8) {
    return { curves: [], isClosed: false };
  }

  const curves = [];
  let currentPoint = { x: coords[0], y: coords[1] };

  // Loop through points, stepping by 6 coordinates (3 points: control1, control2, endPoint)
  for (let i = 2; i + 5 < coords.length; i += 6) {
    const p1 = { x: coords[i], y: coords[i + 1] };
    const p2 = { x: coords[i + 2], y: coords[i + 3] };
    const p3 = { x: coords[i + 4], y: coords[i + 5] };

    const curvePoints = [currentPoint, p1, p2, p3];
    const length = getCubicArcLength(curvePoints, 0, 1);

    curves.push({ points: curvePoints, length });
    currentPoint = p3;
  }

  // Check if the end point connects back to the starting point
  const firstPoint = { x: coords[0], y: coords[1] };
  const isClosed =
    Math.hypot(currentPoint.x - firstPoint.x, currentPoint.y - firstPoint.y) <
    1e-4;

  return { curves, isClosed };
}

function getProportion(part, total) {
  if (total === 0) return 0;
  return part / total;
}

// De Casteljau's algorithm to split a cubic Bezier
function splitCubicBezier(p, t) {
  t = Math.max(0, Math.min(1, t)); // Clamp t to [0, 1]

  const lerp = (pA, pB, t) => ({
    x: pA.x + (pB.x - pA.x) * t,
    y: pA.y + (pB.y - pA.y) * t,
  });

  const p01 = lerp(p[0], p[1], t);
  const p12 = lerp(p[1], p[2], t);
  const p23 = lerp(p[2], p[3], t);

  const p012 = lerp(p01, p12, t);
  const p123 = lerp(p12, p23, t);

  const p0123 = lerp(p012, p123, t);

  const leftCurve = [p[0], p01, p012, p0123];
  const rightCurve = [p0123, p123, p23, p[3]];

  return [leftCurve, rightCurve];
}

function convertNestedCurvesToArray(nestedCurves) {
  if (!nestedCurves || nestedCurves.length === 0) return [];

  const result = [];

  // Start point from the first curve
  result.push(nestedCurves[0][0].x, nestedCurves[0][0].y);

  // Control points & end point for each curve segment
  for (let i = 0; i < nestedCurves.length; i++) {
    const curve = nestedCurves[i];
    result.push(
      curve[1].x,
      curve[1].y,
      curve[2].x,
      curve[2].y,
      curve[3].x,
      curve[3].y,
    );
  }

  return result;
}

export function subdividePath(curves, targetLength) {
  const { curves: items, isClosed } = parseCubicBezierArray(curves);

  if (!Array.isArray(items) || items.length === 0) {
    return new Array(targetLength).fill(0);
  }

  //   if (!Number.isInteger(targetLength) || targetLength < items.length) {
  //     throw new RangeError("targetLength must be an integer >= items.length.");
  //   }

  let totalSum = 0;
  let maxValue = 0;

  for (let i = 0; i < items.length; i++) {
    const value = items[i].length;

    if (!Number.isFinite(value) || value < 0) {
      throw new TypeError(`items[${i}] must be finite and non-negative.`);
    }

    totalSum += value;

    if (value > maxValue) {
      maxValue = value;
    }
  }

  if (targetLength === items.length) {
    return items.slice();
  }

  if (totalSum === 0) {
    return convertNestedCurvesToArray(
      Array.from({ length: targetLength }, () => items[0].points),
    );
  }

  const K = targetLength - items.length;
  const seg = totalSum / (K + 0.5);

  if (!Number.isFinite(seg) || seg <= 0) {
    throw new RangeError("Unable to calculate a valid segment length.");
  }

  /*
   * Scale-aware tolerance.
   *
   * Number.EPSILON is the spacing around 1.0.
   * Multiplying it by the magnitude of the geometry gives
   * us a tolerance appropriate to the input scale.
   */
  const scale = Math.max(totalSum, maxValue, seg, 1);
  const EPSILON = Number.EPSILON * scale * 16;

  const result = [];
  let carryover = 0;

  for (let i = 0; i < items.length; i++) {
    let currentLength = items[i].length,
      points = items[i].points,
      right = null;

    /*
     * Complete a segment that started in the previous item.
     */
    if (carryover > EPSILON) {
      const consumed = Math.min(currentLength, carryover);
      const t = getProportion(consumed, currentLength);
      const [L, R] = splitCubicBezier(points, t);
      result.push(L);

      currentLength -= consumed;
      carryover -= consumed;

      if (Math.abs(currentLength) <= EPSILON) {
        currentLength = 0;
      }

      if (currentLength === 0) {
        continue;
      }

      right = R;
    }

    /*
     * Emit complete segments.
     */
    while (currentLength + EPSILON >= seg) {
      const curveToSplit = right || points;
      const t = getProportion(seg, currentLength);
      const [L, R] = splitCubicBezier(curveToSplit, t);

      result.push(L);
      right = R;
      currentLength -= seg;

      if (Math.abs(currentLength) <= EPSILON) {
        currentLength = 0;
        break;
      }
    }

    /*
     * Emit the remainder and carry the missing portion
     * into the next source item.
     */
    if (currentLength > EPSILON) {
      const curveToSplit = right || points;
      const t = getProportion(seg, currentLength);
      const [L] = splitCubicBezier(curveToSplit, t);
      result.push(L);
      carryover = seg - currentLength;

      if (carryover <= EPSILON) {
        carryover = 0;
      }
    } else {
      carryover = 0;
    }
  }

  if (result.length !== targetLength) {
    throw new Error(
      `Subdivision invariant violated: expected ` +
        `${targetLength} segments, got ${result.length}.`,
    );
  }

  return convertNestedCurvesToArray(result);
}

export function getClosestAnchor(point, paths) {
  let closest = null;
  let minDist = Infinity;

  for (const path of paths) {
    for (let i = 0; i < path.length; i += 6) {
      const dx = point.x - path[i];
      const dy = point.y - path[i + 1];
      const dist = Math.hypot(dx, dy);

      if (dist < minDist) {
        minDist = dist;
        closest = { x: path[i], y: path[i + 1] };
      }
    }
  }

  return closest;
}

export function reverseSegmentToArray(coords) {
  if (!Array.isArray(coords) || coords.length < 8) {
    return [];
  }

  function cleanNum(n) {
    return Math.round(n * 10000) / 10000;
  }

  const len = coords.length;

  // Auto-detect stride format
  let stride = 8;
  if (len % 8 !== 0) {
    if ((len - 2) % 6 === 0) {
      stride = 6;
    } else {
      console.warn(
        `[SVG Reverser]: Invalid array length ${len}. Must be a multiple of 8, or 2 + multiple of 6.`,
      );
      return [];
    }
  }

  const output = new Array(len);

  // Stride 8: [startX, startY, cp1X, cp1Y, cp2X, cp2Y, endX, endY]
  if (stride === 8) {
    let writeIdx = 0;
    for (let i = len - 8; i >= 0; i -= 8) {
      output[writeIdx++] = cleanNum(coords[i + 6]); // New startX = Old endX
      output[writeIdx++] = cleanNum(coords[i + 7]); // New startY = Old endY
      output[writeIdx++] = cleanNum(coords[i + 4]); // New cp1X   = Old cp2X
      output[writeIdx++] = cleanNum(coords[i + 5]); // New cp1Y   = Old cp2Y
      output[writeIdx++] = cleanNum(coords[i + 2]); // New cp2X   = Old cp1X
      output[writeIdx++] = cleanNum(coords[i + 3]); // New cp2Y   = Old cp1Y
      output[writeIdx++] = cleanNum(coords[i]); // New endX   = Old startX
      output[writeIdx++] = cleanNum(coords[i + 1]); // New endY   = Old startY
    }
  }

  // Stride 6: [startX, startY,  cp1X, cp1Y, cp2X, cp2Y, endX, endY, ...]
  else if (stride === 6) {
    // Initial start point of the reversed path is the end point of the last original segment
    output[0] = cleanNum(coords[len - 2]);
    output[1] = cleanNum(coords[len - 1]);

    let writeIdx = 2;
    for (let i = len - 6; i >= 2; i -= 6) {
      const prevX = i === 2 ? coords[0] : coords[i - 2];
      const prevY = i === 2 ? coords[1] : coords[i - 1];

      output[writeIdx++] = cleanNum(coords[i + 2]); // New cp1X = Old cp2X
      output[writeIdx++] = cleanNum(coords[i + 3]); // New cp1Y = Old cp2Y
      output[writeIdx++] = cleanNum(coords[i]); // New cp2X = Old cp1X
      output[writeIdx++] = cleanNum(coords[i + 1]); // New cp2Y = Old cp1Y
      output[writeIdx++] = cleanNum(prevX); // New endX = Old startX
      output[writeIdx++] = cleanNum(prevY); // New endY = Old startY
    }
  }

  return output;
}

function getCentroid(flatCoords) {
  let sumX = 0;
  let sumY = 0;
  const totalCoords = flatCoords.length;

  for (let i = 0; i < totalCoords; i += 2) {
    sumX += flatCoords[i];
    sumY += flatCoords[i + 1];
  }

  const pointCount = totalCoords / 2;

  return {
    x: sumX / pointCount,
    y: sumY / pointCount,
  };
}

export function matchByPolarAngle(source, target) {
  const sourceLen = source.length;
  const targetLen = target.length;

  // SVG paths must have matching point counts for morphing
  if (sourceLen !== targetLen) {
    throw new Error(
      "Source and target point arrays must have the same length.",
    );
  }

  const centerA = getCentroid(source);
  const centerB = getCentroid(target);

  const numPoints = sourceLen / 2;
  const sourceAngles = new Float64Array(numPoints);
  const targetAngles = new Float64Array(numPoints);

  // 1. Calculate polar angles for both shapes relative to their centroids
  for (let i = 0; i < numPoints; i++) {
    const sX = source[i * 2] - centerA.x;
    const sY = source[i * 2 + 1] - centerA.y;
    sourceAngles[i] = Math.atan2(sY, sX);

    const tX = target[i * 2] - centerB.x;
    const tY = target[i * 2 + 1] - centerB.y;
    targetAngles[i] = Math.atan2(tY, tX);
  }

  // 2. Find the global index shift offset that minimizes total angular difference
  let bestShift = 0;
  let minTotalDiff = Infinity;

  for (let shift = 0; shift < numPoints; shift++) {
    let currentDiff = 0;

    for (let i = 0; i < numPoints; i++) {
      const targetIdx = (i + shift) % numPoints;

      let diff = Math.abs(sourceAngles[i] - targetAngles[targetIdx]);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;

      currentDiff += diff;
    }

    if (currentDiff < minTotalDiff) {
      minTotalDiff = currentDiff;
      bestShift = shift;
    }
  }

  // 3. Re-order target points preserves topology and fixes rotational alignment
  const result = new Array(sourceLen);

  for (let i = 0; i < numPoints; i++) {
    const targetIdx = (i + bestShift) % numPoints;
    result[i * 2] = target[targetIdx * 2];
    result[i * 2 + 1] = target[targetIdx * 2 + 1];
  }

  return result;
}

function cubicBezierArrayToPath(flatArray) {
  if (!flatArray || flatArray.length < 8) return "";

  // First point (x0, y0) is the start point (Move To)
  let path = `M ${flatArray[0]} ${flatArray[1]}`;

  // Process control points in groups of 6 (cp1x, cp1y, cp2x, cp2y, x, y)
  for (let i = 2; i < flatArray.length; i += 6) {
    const cp1x = flatArray[i];
    const cp1y = flatArray[i + 1];
    const cp2x = flatArray[i + 2];
    const cp2y = flatArray[i + 3];
    const x = flatArray[i + 4];
    const y = flatArray[i + 5];

    path += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${x} ${y}`;
  }

  return path;
}

function reanchorFlatBezierFast(coords, targetX, targetY, tolerance = 1e-5) {
  const len = coords.length;
  const numSegments = (len - 2) / 6;

  // 1. Find target segment index using modulo striding (step by 6)
  let targetSegIdx = -1;
  for (let i = 2; i < len; i += 6) {
    if (
      Math.abs(coords[i + 4] - targetX) < tolerance &&
      Math.abs(coords[i + 5] - targetY) < tolerance
    ) {
      targetSegIdx = (i - 2) / 6;
      break;
    }
  }

  if (targetSegIdx === -1) {
    throw new Error(`Target point (${targetX}, ${targetY}) not found.`);
  }

  // 2. Pre-allocate fixed-size output array
  const result = new Float64Array(len);

  // Set new start point
  result[0] = targetX;
  result[1] = targetY;

  // 3. Copy segments in reordered sequence using direct pointer arithmetic
  const startSegOffset = targetSegIdx + 1;

  for (let s = 0; s < numSegments; s++) {
    // Modulo % rotates segment index around the closed path seamlessly
    const srcSegIdx = (startSegOffset + s) % numSegments;

    const srcOffset = 2 + srcSegIdx * 6;
    const destOffset = 2 + s * 6;

    // Fast memory copy of 6 numbers per segment
    result[destOffset] = coords[srcOffset];
    result[destOffset + 1] = coords[srcOffset + 1];
    result[destOffset + 2] = coords[srcOffset + 2];
    result[destOffset + 3] = coords[srcOffset + 3];
    result[destOffset + 4] = coords[srcOffset + 4];
    result[destOffset + 5] = coords[srcOffset + 5];
  }

  return result;
}

const coords = [
  53.2635, 68.6401, 59.776, 64.496, 66.1405, 59.7599, 71.3949, 54.5058, 89.3043,
  36.5975, 91.3025, 20.8353, 89.4523, 15.2112, 92.1166, 12.5471, 94.7808,
  9.8831, 97.445, 7.21906, 98.185, 6.47904, 98.185, 5.29502, 97.445, 4.55501,
  96.7049, 3.815, 95.5208, 3.815, 94.7807, 4.55501, 92.1165, 7.21905, 89.4523,
  9.8831, 86.7881, 12.5471, 81.1637, 10.6971, 65.4005, 12.6951, 47.4911,
  30.6034, 42.2366, 35.8575, 37.5003, 42.2216, 33.356, 48.7337, 27.3615,
  47.2537, 16.9267, 47.2537, 9.6741, 55.3198, 1.38545, 64.422, 6.26983, 73.0801,
  8.11997, 71.3041, 9.60009, 69.7501, 12.1163, 60.6479, 23.0691, 67.678, 21.293,
  71.3781, 21.367, 73.6721, 22.5511, 74.7821, 24.1052, 76.3362, 25.6593,
  77.8902, 27.2135, 79.4442, 28.3976, 80.6282, 30.6177, 80.7762, 34.392,
  78.9262, 41.3486, 89.8784, 32.2459, 92.3944, 30.7657, 93.9484, 28.9156,
  95.7245, 37.5743, 100.609, 46.677, 92.3204, 54.7436, 85.0683, 54.7436,
  74.6341, 53.2635, 68.6401,
];

const curve = cubicBezierArrayToPath(
  reanchorFlatBezierFast(coords, 47.4911, 30.6034),
);

console.log(curve);
console.log(
  cubicBezierArrayToPath([
    47.4911, 30.6034, 65.4005, 12.6951, 81.1637, 10.6971, 86.7881, 12.5471,
    89.4523, 9.8831, 92.1165, 7.21905, 94.7807, 4.55501, 95.5208, 3.815,
    96.7049, 3.815, 97.445, 4.55501, 98.185, 5.29502, 98.185, 6.47904, 97.445,
    7.21906, 94.7808, 9.8831, 92.1166, 12.5471, 89.4523, 15.2112, 91.3025,
    20.8353, 89.3043, 36.5975, 71.3949, 54.5058, 66.1405, 59.7599, 59.776,
    64.496, 53.2635, 68.6401, 54.7436, 74.6341, 54.7436, 85.0683, 46.677,
    92.3204, 37.5743, 100.609, 28.9156, 95.7245, 30.7657, 93.9484, 32.2459,
    92.3944, 41.3486, 89.8784, 34.392, 78.9262, 30.6177, 80.7762, 28.3976,
    80.6282, 27.2135, 79.4442, 25.6593, 77.8902, 24.1052, 76.3362, 22.5511,
    74.7821, 21.367, 73.6721, 21.293, 71.3781, 23.0691, 67.678, 12.1163,
    60.6479, 9.60009, 69.7501, 8.11997, 71.3041, 6.26983, 73.0801, 1.38545,
    64.422, 9.6741, 55.3198, 16.9267, 47.2537, 27.3615, 47.2537, 33.356,
    48.7337, 37.5003, 42.2216, 42.2366, 35.8575, 47.4911, 30.6034,
  ]),
);
