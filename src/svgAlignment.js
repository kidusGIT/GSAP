function pairPoints(arr) {
  const pairs = [];
  for (let i = 0; i < arr.length; i += 2) {
    pairs.push({ x: arr[i], y: arr[i + 1] });
  }
  return pairs;
}

export function reverseCurve(coords) {
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

export function getCurveDirection(points) {
  let area = 0;
  for (let i = 0; i < points.length - 1; i++) {
    area += points[i].x * points[i + 1].y;
    area -= points[i + 1].x * points[i].y;
  }
  // Last point to first
  area += points[points.length - 1].x * points[0].y;
  area -= points[0].x * points[points.length - 1].y;

  return area > 0 ? 1 : -1; // 1 = CCW, -1 = CW
}

export function ensureSameDirection(source, target) {
  const srcDir = getCurveDirection(pairPoints(source));
  const tgtDir = getCurveDirection(pairPoints(target));

  if (srcDir !== tgtDir) {
    // Reverse target to match direction
    return reverseCurve(source);
  }
  return source;
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

export function findBestAlignment(source, target) {
  let minDist = Infinity;
  let minIndex = 0;

  source = ensureSameDirection(source, target);
  const targetCentroid = getCentroid(target);

  for (let i = 0; i < source.length; i += 6) {
    const dx = targetCentroid.x - source[i];
    const dy = targetCentroid.y - source[i + 1];
    const dist = Math.hypot(dx, dy);

    if (dist < minDist) {
      minDist = dist;
      minIndex = i;
    }
  }

  return minIndex;
}

function centerCurve(curve) {
  const points = pairPoints(curve);
  let cx = 0,
    cy = 0;

  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  cx /= points.length;
  cy /= points.length;

  const centered = [];
  for (const p of points) {
    centered.push(p.x - cx, p.y - cy);
  }
  return centered;
}

export function prepareForMorphing(source, target) {
  // 1. Ensure same number of points
  let src = source;
  let tgt = target;

  // 2. Match direction
  tgt = ensureSameDirection(src, tgt);

  // 3. Find best starting alignment
  const offset = findBestAlignment(src, tgt);
  tgt = rotatePoints(tgt, offset);

  // // 4. Center both curves
  // src = centerCurve(src);
  // tgt = centerCurve(tgt);

  return { source: src, target: tgt };
}

function rotatePoints(curve, offset) {
  const points = pairPoints(curve);
  const rotated = [];
  for (let i = 0; i < points.length; i++) {
    const idx = (i + offset) % points.length;
    rotated.push(points[idx].x, points[idx].y);
  }
  return rotated;
}

function morphPoints(source, target, progress) {
  const result = [];

  // Ensure both arrays have same length
  const count = Math.min(source.length, target.length);

  for (let i = 0; i < count; i++) {
    const srcVal = source[i];
    const tgtVal = target[i];
    // const easedProgress = easeInOut(progress);
    result.push(srcVal + (tgtVal - srcVal) * progress);
  }

  return result;
}

// Usage
export function animateMorph(sourceArray, targetArray, progress) {
  const prepared = prepareForMorphing(sourceArray, targetArray);
  return morphPoints(prepared.source, prepared.target, progress);
}

function reorderArray(arr, shiftCoords) {
  const len = arr.length;
  const result = new Array(len);
  for (let i = 0; i < len; i += 2) {
    const srcIdx = (i + shiftCoords) % len;
    result[i] = arr[srcIdx];
    result[i + 1] = arr[srcIdx + 1];
  }
  return result;
}

const source = [
  53.2635, 68.6401, 54.7436, 74.6341, 54.7436, 85.0683, 46.677, 92.3204,
  37.5743, 100.609, 28.9156, 95.7245, 30.7657, 93.9484, 32.2459, 92.3944,
  41.3486, 89.8784, 34.392, 78.9262, 30.6177, 80.7762, 28.3976, 80.6282,
  27.2135, 79.4442, 25.6593, 77.8902, 24.1052, 76.3362, 22.5511, 74.7821,
  21.367, 73.6721, 21.293, 71.3781, 23.0691, 67.678, 12.1163, 60.6479, 9.60009,
  69.7501, 8.11997, 71.3041, 6.26983, 73.0801, 1.38545, 64.422, 9.6741, 55.3198,
  16.9267, 47.2537, 27.3615, 47.2537, 33.356, 48.7337, 37.5003, 42.2216,
  42.2366, 35.8575, 47.4911, 30.6034, 65.4005, 12.6951, 81.1637, 10.6971,
  86.7881, 12.5471, 89.4523, 9.8831, 92.1165, 7.21905, 94.7807, 4.55501,
  95.5208, 3.815, 96.7049, 3.815, 97.445, 4.55501, 98.185, 5.29502, 98.185,
  6.47904, 97.445, 7.21906, 94.7808, 9.8831, 92.1166, 12.5471, 89.4523, 15.2112,
  91.3025, 20.8353, 89.3043, 36.5975, 71.3949, 54.5058, 66.1405, 59.7599,
  59.776, 64.496, 53.2635, 68.6401,
];

const target = [
  47.1, 0.8, 51.46666666666667, 0.8, 55.833333333333336, 0.8, 60.2, 0.8,
  64.56666666666666, 0.8, 68.93333333333334, 0.8, 73.3, 0.8, 71.4,
  6.866666666666667, 69.5, 12.933333333333335, 67.6, 19.000000000000004,
  65.69999999999999, 25.06666666666667, 63.8, 31.133333333333336, 61.9, 37.2,
  63.58888888888889, 37.2, 65.27777777777777, 37.2, 66.96666666666665, 37.2,
  68.65555555555554, 37.2, 70.34444444444443, 37.2, 72.03333333333333, 37.2,
  73.72222222222221, 37.2, 75.4111111111111, 37.2, 77.1, 37.2,
  69.36666666666666, 47.56666666666667, 61.633333333333326, 57.93333333333334,
  53.89999999999999, 68.30000000000001, 46.166666666666664, 78.66666666666667,
  38.43333333333333, 89.03333333333333, 30.7, 99.4, 32.37777777777778,
  94.12222222222222, 34.05555555555556, 88.84444444444445, 35.733333333333334,
  83.56666666666668, 37.41111111111111, 78.28888888888889, 39.08888888888889,
  73.01111111111112, 40.766666666666666, 67.73333333333333, 42.44444444444444,
  62.455555555555556, 44.12222222222222, 57.17777777777778, 45.8, 51.9, 43,
  51.9, 40.2, 51.9, 37.400000000000006, 51.9, 34.6, 51.9, 31.8, 51.9, 29, 51.9,
  31.01111111111111, 46.22222222222222, 33.02222222222222, 40.544444444444444,
  35.03333333333333, 34.86666666666667, 37.044444444444444, 29.18888888888889,
  39.05555555555556, 23.511111111111113, 41.06666666666667, 17.833333333333336,
  43.07777777777778, 12.155555555555559, 45.08888888888889, 6.47777777777778,
  47.1, 0.8,
];

function convertFlatArrayToSVGPath(flatArray) {
  if (!flatArray || flatArray.length < 2) return "";

  let path = `M ${flatArray[0]} ${flatArray[1]}`;

  for (let i = 2; i < flatArray.length; ) {
    const px1 = flatArray[i++];
    const py1 = flatArray[i++];

    const px2 = flatArray[i++];
    const py2 = flatArray[i++];

    const px3 = flatArray[i++];
    const py3 = flatArray[i++];

    path += ` C ${px1} ${py1} ${px2} ${py2} ${px3} ${py3}`;
  }

  // 4. Close the path
  path += " Z";

  return path;
}

// console.log(convertFlatArrayToSVGPath(target));
// const index = findBestAlignment(source, getCentroid(target));
// console.log(index, " -> ", source[index], source[index + 1]);

function convertSVGPathToFlatArray(pathString) {
  if (typeof pathString !== "string" || !pathString.trim()) {
    return [];
  }

  // Extract all numbers (including decimals and negatives) from the string
  const numberRegex = /-?\d+(?:\.\d+)?/g;
  const matches = pathString.match(numberRegex);

  if (!matches) return [];

  // Convert string representations of numbers to float primitives
  return matches.map(Number);
}

function getCubicAnchorPoints(flatArray, format = "tuples") {
  if (
    !Array.isArray(flatArray) ||
    flatArray.length < 2 ||
    (flatArray.length - 2) % 6 !== 0
  ) {
    throw new Error(
      "Invalid Cubic Bézier array. Length must satisfy: 2 + 6 * N",
    );
  }

  const anchorPoints = [];

  anchorPoints.push([flatArray[0], flatArray[1]]);

  for (let i = 2; i < flatArray.length; i += 6) {
    const endX = flatArray[i + 4];
    const endY = flatArray[i + 5];
    anchorPoints.push([endX, endY]);
  }

  return format === "flat" ? anchorPoints.flat() : anchorPoints;
}

function getFastCubicCentroid(flatArray) {
  const len = flatArray.length;
  if (!len || len < 8 || (len - 2) % 6 !== 0) return { x: 0, y: 0 };

  let sumX = 0;
  let sumY = 0;
  let segmentCount = 0;

  // Single loop over each cubic segment (6 numbers = 3 point pairs)
  for (let i = 2; i < len; i += 6) {
    // Sum all 4 control points defining the current cubic segment: P0, P1, P2, P3
    const segX =
      flatArray[i - 2] + flatArray[i] + flatArray[i + 2] + flatArray[i + 4];
    const segY =
      flatArray[i - 1] + flatArray[i + 1] + flatArray[i + 3] + flatArray[i + 5];

    // Divide by 4 to get the segment's exact mean center
    sumX += segX * 0.25;
    sumY += segY * 0.25;
    segmentCount++;
  }

  return {
    x: sumX / segmentCount,
    y: sumY / segmentCount,
  };
}

export function findCoordinateDistance(source, target) {
  let minDist = Infinity,
    minIndex = 0;

  const targetCentroid = { x: target[0], y: target[1] };
  // source = ensureSameDirection(source, target);

  for (let i = 0; i < source.length; i += 6) {
    const dx = targetCentroid.x - source[i];
    const dy = targetCentroid.y - source[i + 1];
    const dist = Math.hypot(dx, dy);

    // result.push({ index: i, distance: dist, x: source[i], y: source[i + 1] });
    if (dist < minDist) {
      minDist = dist;
      minIndex = i;
    }
  }

  return minIndex;
  // return {result, minDist, minIndex};
}

const src = [
  20.1089, 77.0762, 21.737, 78.7042, 23.3652, 80.2582, 24.9193, 81.8863,
  24.9193, 81.8863, 24.676348074521464, 83.24944614985297, 23.337337027842576,
  85.01893627390409, 21.54095206421292, 87.39284159755368, 17.771851481483566,
  90.4980953394801, 9.97012, 92.0244, 12.7083, 78.4082, 20.1089, 77.0762,
  20.1089, 77.0762,
];

const tgt = [
  18.4409, 92.361, 14.1587, 77.9885, 9.94563, 63.5473, 5.66348, 49.1748,
  11.4651, 47.5244, 17.1977, 45.8052, 22.9993, 44.086, 27.2123, 58.4584,
  31.4945, 72.8997, 35.7766, 87.2722, 29.975, 88.9226, 24.1734, 90.6418,
  18.4409, 92.361,
];

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

function normalizeCentroid(points = []) {
  const { x, y } = getCentroid(points);
  const normalized = [];

  for (let index = 0; index < points.length; index += 2) {
    const nx = points[index] - x;
    const ny = points[index + 1] - y;
    normalized.push(nx, ny);
  }
  return normalized;
}

export function closestIndex(source = [], target = []) {
  if (!source.length || !target.length || source.length !== target.length) {
    return 0;
  }
  const N = source.length;

  let minDist = Infinity;
  let bestK = 0;

  const sourceNormalized = normalizeCentroid(source);
  const targetNormalized = normalizeCentroid(target);

  // k loops through each segment starting position (multiples of 6)
  for (let k = 0; k < N; k += 6) {
    let totalDist = 0;

    for (let i = 0; i < N; i += 6) {
      const index = (i + k) % N;
      const dx = sourceNormalized[index] - targetNormalized[i];
      const dy = sourceNormalized[index + 1] - targetNormalized[i + 1];

      totalDist += dx * dx + dy * dy;
    }

    if (totalDist < minDist) {
      minDist = totalDist;
      bestK = k;
    }
  }

  return bestK;
}

export function closestIndexRemake(source = [], target = []) {
  if (!source.length || !target.length || source.length !== target.length) {
    return 0;
  }
  const { x: sourceX, y: sourceY } = getCentroid(source);
  const { x: targetX, y: targetY } = getCentroid(target);

  const N = source.length;

  let minDist = Infinity;
  let bestK = 0;
  const offsetX = sourceX - targetX;
  const offsetY = sourceY - targetY;

  // k loops through each segment starting position (multiples of 6)
  for (let k = 0; k < N; k += 6) {
    let totalDist = 0;

    for (let i = 0; i < N; i += 6) {
      const index = (i + k) % N;

      // Distance between anchor points ONLY
      const dx = source[index] - (target[i] - offsetX);
      const dy = source[index + 1] - (target[i + 1] - offsetY);

      totalDist += dx * dx + dy * dy;
    }

    if (totalDist < minDist) {
      minDist = totalDist;
      bestK = k;
    }
  }

  return bestK;
}
