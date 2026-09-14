/**
 * Monte Carlo group-formation harness — shared constants.
 *
 * Extracted verbatim from run-group-monte-carlo.ts (behaviour-preserving).
 */
import type { TraitKey } from '../../../packages/shared/src/personality/types';
import { SHRINKAGE_EXCESS_SCALE, SHRINKAGE_ERROR_FLOOR } from '../../../packages/shared/src/personality/traitShrinkage';

const ALL_TRAITS: TraitKey[] = ['A', 'C', 'E', 'O', 'X', 'P'];

/** Item 6 population mixture (locked 2026-09-09, see run-recovery-harness.ts). */
const CENTROID_MIXTURE_WEIGHT = 0.6;
const CENTROID_TRAIT_SD = 10;
const GENERAL_TRAIT_MEAN = 50;
const GENERAL_TRAIT_SD = 15;
const TRAIT_MIN = 5;
const TRAIT_MAX = 95;

/** Pool generation. */
const POOL_SIZE_MIN = 12;
const POOL_SIZE_MAX = 60;
const MIN_GROUP_SIZE = 4;
const MAX_GROUP_SIZE = 6;
/** Share of pool members bound into duo atomic units (双人成行 penetration). */
const DUO_MEMBER_SHARE = 0.15;

/**
 * PROVISIONAL composition thresholds (measurement-only; Item 5 locks the
 * final values against this baseline). Each names the literature prior it
 * operationalises — see plan Item 5 (Bell 2007; Barrick et al. 1998).
 */
/** (i) Stability floor: a group violates when its minimum reported E falls below. */
const PROV_STABILITY_FLOOR_MIN_E = 25;
/** (ii) Viability floor: a group violates when its mean reported A falls below. */
const PROV_MEAN_A_FLOOR = 45;
/** (iii) Spark definition: member with reported X ≥ threshold OR P ≥ threshold. */
const PROV_SPARK_TRAIT_THRESHOLD = 70;
/** (iv) X-variance cap: group var(X) above is a violation (std ≈ 20 mirrors harmonyScore's natural-stdDev ≤ 20). */
const PROV_X_VARIANCE_CAP = 400;
/** (v) Clone group: max pairwise 6D Euclidean distance below this = clone. */
const PROV_CLONE_MIN_MAX_DISTANCE = 15;

/** M11 (LOCKED, AC-9.4): ≥50% reduction in mean per-trait group-mean delta. */
const M11_REDUCTION_TARGET = 0.5;
/** Below this deltaOff the injection moved nothing and the reduction is vacuous. */
const M11_MIN_DELTA_OFF = 0.5;
/**
 * Mechanical stabilization ceiling of the shipped Item-3 mechanic: with
 * K = SHRINKAGE_EXCESS_SCALE the worst-confidence weight is
 * w_min = 1 − (err(0.578⁻) − SHRINKAGE_ERROR_FLOOR) / K where the calibration
 * clamps below-domain confidence to err = 17.57, so w_min ≈ 0.879 and any
 * first-order per-trait group-mean delta can shrink by at most ≈12.1%.
 * Printed alongside the M11 verdict so the ≥50% target-vs-mechanic tension
 * is explicit in the artifact.
 */
const M11_CALIBRATION_WORST_ERR = 17.57;
const M11_MIN_WEIGHT_SHIPPED = 1 - (M11_CALIBRATION_WORST_ERR - SHRINKAGE_ERROR_FLOOR) / SHRINKAGE_EXCESS_SCALE;
const M11_FIRST_ORDER_CEILING = 1 - M11_MIN_WEIGHT_SHIPPED;

export {
  ALL_TRAITS,
  CENTROID_MIXTURE_WEIGHT,
  CENTROID_TRAIT_SD,
  GENERAL_TRAIT_MEAN,
  GENERAL_TRAIT_SD,
  TRAIT_MIN,
  TRAIT_MAX,
  POOL_SIZE_MIN,
  POOL_SIZE_MAX,
  MIN_GROUP_SIZE,
  MAX_GROUP_SIZE,
  DUO_MEMBER_SHARE,
  PROV_STABILITY_FLOOR_MIN_E,
  PROV_MEAN_A_FLOOR,
  PROV_SPARK_TRAIT_THRESHOLD,
  PROV_X_VARIANCE_CAP,
  PROV_CLONE_MIN_MAX_DISTANCE,
  M11_REDUCTION_TARGET,
  M11_MIN_DELTA_OFF,
  M11_CALIBRATION_WORST_ERR,
  M11_MIN_WEIGHT_SHIPPED,
  M11_FIRST_ORDER_CEILING,
};
