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
