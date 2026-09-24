/**
 * Production-Ready Polar SVG Morpher for 2D Numerical Coordinate Arrays
 * Input Structure: Array of subpaths -> Array of raw numbers: [P0x, P0y, P1x, P1y, P2x, P2y, P3x, P3y, ...]
 */
export class ArraySVGMorpher {
  constructor(sourceSubpaths, targetSubpaths, originSpec = "50% 50%") {
    if (sourceSubpaths.length !== targetSubpaths.length) {
      throw new Error(
        "Source and target must have the same number of subpaths.",
      );
    }

    this.originSpec = originSpec;
    this.subpathMorphers = [];

    // Calculate global bounding box across ALL subpaths to establish a unified origin
    this.origin = this.resolveGlobalOrigin(
      sourceSubpaths,
      targetSubpaths,
      originSpec,
    );

    // Prepare each subpath independently using the shared origin
    for (let s = 0; s < sourceSubpaths.length; s++) {
      const srcRaw = sourceSubpaths[s];
      const tgtRaw = targetSubpaths[s];

      const srcSegs = this.parseRawArrayToSegments(srcRaw);
      const tgtSegs = this.parseRawArrayToSegments(tgtRaw);

      this.subpathMorphers.push(this.precomputeSubpathData(srcSegs, tgtSegs));
    }
  }

  /**
   * Converts flat coordinate array into structured cubic segment objects
   */
  parseRawArrayToSegments(raw) {
    if (raw.length < 2) return { startP0: { x: 0, y: 0 }, segments: [] };

    const startP0 = { x: raw[0], y: raw[1] };
    const segments = [];
    let currentPoint = { ...startP0 };

    for (let i = 2; i < raw.length; i += 6) {
      const seg = {
        p0: { ...currentPoint },
        p1: { x: raw[i], y: raw[i + 1] },
        p2: { x: raw[i + 2], y: raw[i + 3] },
        p3: { x: raw[i + 4], y: raw[i + 5] },
      };
      segments.push(seg);
      currentPoint = { ...seg.p3 };
    }

    return { startP0, segments };
  }

  /**
   * Resolves percentage origin against global bounding box of all points
   */
  resolveGlobalOrigin(srcSubpaths, tgtSubpaths, originSpec) {
    const allXs = [];
    const allYs = [];

    const collect = (subpaths) => {
      subpaths.forEach((raw) => {
        for (let i = 0; i < raw.length; i += 2) {
          allXs.push(raw[i]);
          allYs.push(raw[i + 1]);
        }
      });
    };

    collect(srcSubpaths);
    collect(tgtSubpaths);

    const minX = Math.min(...allXs),
      maxX = Math.max(...allXs);
    const minY = Math.min(...allYs),
      maxY = Math.max(...allYs);

    const parts = originSpec.split(" ");
    const pctX = parseFloat(parts[0]) / 100;
    const pctY = parseFloat(parts[1]) / 100;

    return {
      x: minX + (maxX - minX) * pctX,
      y: minY + (maxY - minY) * pctY,
    };
  }

  /**
   * Calculates shortest polar angle transition to eliminate 360-degree spins
   */
  normalizeAngle(targetAngle, sourceAngle) {
    const delta =
      ((targetAngle - sourceAngle + Math.PI) % (2 * Math.PI)) - Math.PI;
    return sourceAngle + (delta < -Math.PI ? delta + 2 * Math.PI : delta);
  }

  /**
   * Precomputes Tier-1 (Origin) and Tier-2 (Handle) polar parameters for a subpath
   */
  precomputeSubpathData(srcData, tgtData) {
    const srcSegs = srcData.segments;
    const tgtSegs = tgtData.segments;
    const N = srcSegs.length;

    // Handle collapsed dummy subpaths (0 segments)
    if (N === 0) {
      const startSrc = srcData.startP0;
      const startTgt = tgtData.startP0;

      const R_src = Math.hypot(
        startSrc.x - this.origin.x,
        startSrc.y - this.origin.y,
      );
      const Phi_src = Math.atan2(
        startSrc.y - this.origin.y,
        startSrc.x - this.origin.x,
      );

      const R_tgt = Math.hypot(
        startTgt.x - this.origin.x,
        startTgt.y - this.origin.y,
      );
      const Phi_tgt = this.normalizeAngle(
        Math.atan2(startTgt.y - this.origin.y, startTgt.x - this.origin.x),
        Phi_src,
      );

      return {
        isDummy: true,
        startAnchor: { R_src, R_tgt, Phi_src, Phi_tgt },
        joints: [],
      };
    }

    const joints = [];

    for (let i = 0; i < N; i++) {
      const srcCurr = srcSegs[i];
      const srcNext = srcSegs[(i + 1) % N];
      const tgtCurr = tgtSegs[i];
      const tgtNext = tgtSegs[(i + 1) % N];

      const anchorSrc = srcCurr.p3;
      const anchorTgt = tgtCurr.p3;

      // Tier 1: Anchor point relative to Global Origin O
      const R_src = Math.hypot(
        anchorSrc.x - this.origin.x,
        anchorSrc.y - this.origin.y,
      );
      const Phi_src = Math.atan2(
        anchorSrc.y - this.origin.y,
        anchorSrc.x - this.origin.x,
      );

      const R_tgt = Math.hypot(
        anchorTgt.x - this.origin.x,
        anchorTgt.y - this.origin.y,
      );
      let Phi_tgt = Math.atan2(
        anchorTgt.y - this.origin.y,
        anchorTgt.x - this.origin.x,
      );
      Phi_tgt = this.normalizeAngle(Phi_tgt, Phi_src);

      // Tier 2: Handles relative to Anchor
      const srcIn = {
        x: srcCurr.p2.x - anchorSrc.x,
        y: srcCurr.p2.y - anchorSrc.y,
      };
      const srcOut = {
        x: srcNext.p1.x - anchorSrc.x,
        y: srcNext.p1.y - anchorSrc.y,
      };

      const r_in_src = Math.hypot(srcIn.x, srcIn.y);
      const r_out_src = Math.hypot(srcOut.x, srcOut.y);
      const theta_in_src = Math.atan2(srcIn.y, srcIn.x);
      const theta_out_src = Math.atan2(srcOut.y, srcOut.x);

      const tgtIn = {
        x: tgtCurr.p2.x - anchorTgt.x,
        y: tgtCurr.p2.y - anchorTgt.y,
      };
      const tgtOut = {
        x: tgtNext.p1.x - anchorTgt.x,
        y: tgtNext.p1.y - anchorTgt.y,
      };

      const r_in_tgt = Math.hypot(tgtIn.x, tgtIn.y);
      const r_out_tgt = Math.hypot(tgtOut.x, tgtOut.y);
      let theta_in_tgt = Math.atan2(tgtIn.y, tgtIn.x);
      let theta_out_tgt = Math.atan2(tgtOut.y, tgtOut.x);

      // Smoothness check (Collinear handles check)
      const isSmoothSrc =
        r_in_src > 0.001 &&
        r_out_src > 0.001 &&
        Math.abs(Math.abs(theta_out_src - theta_in_src) - Math.PI) < 0.05;

      if (isSmoothSrc) {
        theta_in_tgt = this.normalizeAngle(theta_in_tgt, theta_in_src);
        theta_out_tgt = theta_in_tgt + Math.PI;
      } else {
        theta_in_tgt = this.normalizeAngle(theta_in_tgt, theta_in_src);
        theta_out_tgt = this.normalizeAngle(theta_out_tgt, theta_out_src);
      }

      joints.push({
        isSmooth: isSmoothSrc,
        R_src,
        R_tgt,
        Phi_src,
        Phi_tgt,
        r_in_src,
        r_in_tgt,
        r_out_src,
        r_out_tgt,
        theta_in_src,
        theta_in_tgt,
        theta_out_src,
        theta_out_tgt,
        segmentCount: N,
      });
    }

    // Start anchor P0 precomputation
    const startSrc = srcData.startP0;
    const startTgt = tgtData.startP0;
    const start_R_src = Math.hypot(
      startSrc.x - this.origin.x,
      startSrc.y - this.origin.y,
    );
    const start_Phi_src = Math.atan2(
      startSrc.y - this.origin.y,
      startSrc.x - this.origin.x,
    );
    const start_R_tgt = Math.hypot(
      startTgt.x - this.origin.x,
      startTgt.y - this.origin.y,
    );
    const start_Phi_tgt = this.normalizeAngle(
      Math.atan2(startTgt.y - this.origin.y, startTgt.x - this.origin.x),
      start_Phi_src,
    );

    return {
      isDummy: false,
      joints,
      startAnchor: {
        R_src: start_R_src,
        R_tgt: start_R_tgt,
        Phi_src: start_Phi_src,
        Phi_tgt: start_Phi_tgt,
      },
    };
  }

  /**
   * Evaluates frame at progress t in [0, 1] and outputs standard SVG Path string
   */
  evaluate(t) {
    let fullPathStr = "";

    for (const subpath of this.subpathMorphers) {
      const { isDummy, joints, startAnchor } = subpath;

      // Evaluate initial Start Anchor P0
      const R_start = (1 - t) * startAnchor.R_src + t * startAnchor.R_tgt;
      const Phi_start = (1 - t) * startAnchor.Phi_src + t * startAnchor.Phi_tgt;
      const P0_curr = {
        x: this.origin.x + R_start * Math.cos(Phi_start),
        y: this.origin.y + R_start * Math.sin(Phi_start),
      };

      fullPathStr += `M ${P0_curr.x.toFixed(4)} ${P0_curr.y.toFixed(4)}`;

      if (isDummy) continue;

      const N = joints.length;
      let prevAnchor = P0_curr;

      for (let i = 0; i < N; i++) {
        const joint = joints[i];

        // Anchor rotation around Origin
        const R = (1 - t) * joint.R_src + t * joint.R_tgt;
        const Phi = (1 - t) * joint.Phi_src + t * joint.Phi_tgt;
        const P3_curr = {
          x: this.origin.x + R * Math.cos(Phi),
          y: this.origin.y + R * Math.sin(Phi),
        };

        // Handle lengths & angles
        const r_in = (1 - t) * joint.r_in_src + t * joint.r_in_tgt;
        const theta_in = (1 - t) * joint.theta_in_src + t * joint.theta_in_tgt;

        const P2_curr = {
          x: P3_curr.x + r_in * Math.cos(theta_in),
          y: P3_curr.y + r_in * Math.sin(theta_in),
        };

        const prevJoint = joints[(i - 1 + N) % N];
        const prev_r_out =
          (1 - t) * prevJoint.r_out_src + t * prevJoint.r_out_tgt;
        const prev_theta_out =
          (1 - t) * prevJoint.theta_out_src + t * prevJoint.theta_out_tgt;

        const P1_curr = {
          x: prevAnchor.x + prev_r_out * Math.cos(prev_theta_out),
          y: prevAnchor.y + prev_r_out * Math.sin(prev_theta_out),
        };

        fullPathStr += ` C ${P1_curr.x.toFixed(4)} ${P1_curr.y.toFixed(4)}, ${P2_curr.x.toFixed(4)} ${P2_curr.y.toFixed(4)}, ${P3_curr.x.toFixed(4)} ${P3_curr.y.toFixed(4)}`;
        prevAnchor = P3_curr;
      }
    }

    return fullPathStr;
  }
}

export function pathString(rawPath = [], rnd = 100, space = " ") {
  let s = "";
  for (let j = 0; j < rawPath.length; j++) {
    const segment = rawPath[j];
    const l = segment.length;
    s +=
      "M" +
      ((segment[0] * rnd) | 0) / rnd +
      space +
      ((segment[1] * rnd) | 0) / rnd +
      " C";
    for (let i = 2; i < l; i++) {
      //this is actually faster than just doing a join() on the array, possibly because the numbers have so many decimal places
      s += ((segment[i] * rnd) | 0) / rnd + space;
    }
  }
  return s;
}
