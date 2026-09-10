/**
 * GENERATED FILE — do not edit by hand.
 *
 * Fitted confidence-calibration artifact (Plan Item 12).
 * Regenerate deterministically (fixed seed 20260909):
 *
 *   npm run simulate:calibration
 *
 * The generator (`scripts/simulate/fit-confidence-calibration.ts`) runs the
 * recovery harness session export, fits isotonic curves, verifies M15, and
 * rewrites this file. Two runs at the same seed produce identical bytes.
 *
 * Fit provenance: natural-termination sessions of the latent-trait recovery
 * harness (seed 20260909, noise arms: clean + moderate),
 * 4000 sessions, PAVA isotonic regression, 6dp rounding.
 */

export const CALIBRATION_VERSION = 'v1-20260909';
export const CALIBRATION_SEED = 20260909;

export interface CalibrationCurveNode {
  /** Raw engine confidence at the isotonic block centroid (0..1). */
  x: number;
  /** Fitted probability / expected value at that centroid. */
  p: number;
}

export interface FittedConfidenceCalibration {
  version: string;
  fittedOnSeed: number;
  fitArm: 'natural';
  noiseArms: string[];
  sessionCount: number;
  /** Isotonic (PAVA) blocks: raw mean trait confidence -> observed top-1 agreement. */
  correctnessBlocks: Array<{ xMin: number; xMax: number; p: number; n: number }>;
  /** Monotone piecewise-linear nodes derived from the block centroids. */
  correctnessCurve: CalibrationCurveNode[];
  /** Per-trait confidence -> expected |trait error| (0-100 scale), decreasing. */
  traitErrorCurve: CalibrationCurveNode[];
}

export const FITTED_CONFIDENCE_CALIBRATION: FittedConfidenceCalibration = {
  "version": "v1-20260909",
  "fittedOnSeed": 20260909,
  "fitArm": "natural",
  "noiseArms": [
    "clean",
    "moderate"
  ],
  "sessionCount": 4000,
  "correctnessBlocks": [
    {
      "xMin": 0.753386,
      "xMax": 0.753386,
      "p": 0,
      "n": 1
    },
    {
      "xMin": 0.767798,
      "xMax": 0.788888,
      "p": 0.153846,
      "n": 13
    },
    {
      "xMin": 0.7938,
      "xMax": 0.836899,
      "p": 0.280576,
      "n": 139
    },
    {
      "xMin": 0.837039,
      "xMax": 0.908149,
      "p": 0.330088,
      "n": 2054
    },
    {
      "xMin": 0.908208,
      "xMax": 0.923861,
      "p": 0.340836,
      "n": 622
    },
    {
      "xMin": 0.923868,
      "xMax": 0.925087,
      "p": 0.372093,
      "n": 43
    },
    {
      "xMin": 0.925087,
      "xMax": 0.934295,
      "p": 0.404669,
      "n": 257
    },
    {
      "xMin": 0.934312,
      "xMax": 0.945096,
      "p": 0.448845,
      "n": 303
    },
    {
      "xMin": 0.945319,
      "xMax": 0.947911,
      "p": 0.449664,
      "n": 149
    },
    {
      "xMin": 0.947924,
      "xMax": 0.957928,
      "p": 0.464789,
      "n": 213
    },
    {
      "xMin": 0.95794,
      "xMax": 0.95794,
      "p": 0.5,
      "n": 6
    },
    {
      "xMin": 0.95794,
      "xMax": 0.95794,
      "p": 0.5,
      "n": 4
    },
    {
      "xMin": 0.95794,
      "xMax": 0.989384,
      "p": 0.535714,
      "n": 196
    }
  ],
  "correctnessCurve": [
    {
      "x": 0.753386,
      "p": 0
    },
    {
      "x": 0.776432,
      "p": 0.153846
    },
    {
      "x": 0.821675,
      "p": 0.280576
    },
    {
      "x": 0.878886,
      "p": 0.330088
    },
    {
      "x": 0.915302,
      "p": 0.340836
    },
    {
      "x": 0.924523,
      "p": 0.372093
    },
    {
      "x": 0.929511,
      "p": 0.404669
    },
    {
      "x": 0.939117,
      "p": 0.448845
    },
    {
      "x": 0.946341,
      "p": 0.449664
    },
    {
      "x": 0.951541,
      "p": 0.464789
    },
    {
      "x": 0.95794,
      "p": 0.5
    },
    {
      "x": 0.95794,
      "p": 0.5
    },
    {
      "x": 0.961964,
      "p": 0.535714
    }
  ],
  "traitErrorCurve": [
    {
      "x": 0.577883,
      "p": 17.57138
    },
    {
      "x": 0.603135,
      "p": 17.129659
    },
    {
      "x": 0.604651,
      "p": 16.807291
    },
    {
      "x": 0.612053,
      "p": 15.295106
    },
    {
      "x": 0.627138,
      "p": 14.273281
    },
    {
      "x": 0.634004,
      "p": 13.5164
    },
    {
      "x": 0.634368,
      "p": 13.122375
    },
    {
      "x": 0.777388,
      "p": 12.423111
    },
    {
      "x": 0.862824,
      "p": 11.337075
    },
    {
      "x": 0.870204,
      "p": 11.158806
    },
    {
      "x": 0.88422,
      "p": 11.147265
    },
    {
      "x": 0.966926,
      "p": 11.091966
    },
    {
      "x": 1,
      "p": 8.492476
    }
  ]
};
