import {
  BoxGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshPhongMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type Material,
  type MeshLambertMaterialParameters,
} from 'three'
import {
  EQUIPMENT_3D_SLOTS,
  shadeColor,
  type Equipment3DDescriptor,
  type Equipment3DPalette,
  type EquipmentSlot3D,
  type RgbColor,
  type SpiderPersonaPalette,
  type SpiderStarterGarmentKind,
} from './avatar3dTypes'
import { SPIDER_PERSONA_PALETTE, resolveEquipmentPalette } from './avatar3dPalettes'
import { SPIDER_STARTER_GARMENT_SPECS, getGarmentGroupName } from './spiderStarterGarments'

/**
 * Procedural spider-persona model builder.
 *
 * Pure three.js scene-graph construction — no GL context is touched here, so the
 * whole model is unit-testable in Node. The character is assembled from rounded
 * low-poly primitives in the JoyJoin black-purple identity:
 *
 *   root
 *   ├─ ground-shadow            (soft ellipse, outside the rotating character)
 *   └─ character                (yaw target)
 *      ├─ body                  (torso, hips, belly)
 *      ├─ head                  (head sphere, 2 big + 4 small eyes, fangs, cheeks)
 *      ├─ fur                   (head tufts, back spikes)
 *      ├─ arms                  (2 humanoid arms with hands)
 *      ├─ legs                  (2 humanoid legs with feet)
 *      ├─ spider-legs           (6 articulated back legs — the persona signature)
 *      ├─ underwear             (PERMANENT vest + safety shorts, never toggled)
 *      └─ equipment             (slot groups, each pre-built with its garments)
 *         ├─ equipment-top      └─ garment-spider-bomber-jacket ( eggplant bomber:
 *         │                       full sleeves, front zipper, ribbed collar/cuffs/hem,
 *         │                       sleeve zip pocket, front pocket seams )
 *         ├─ equipment-bottom   └─ garment-spider-cargo-shorts ( black-grey cargos:
 *         │                       waistband/button/fly, belt loops, pocket seams,
 *         │                       3D right cargo pocket with flap/strap/buckle )
 *         ├─ equipment-shoes    └─ garment-spider-high-top-sneakers ( purple-black
 *         │                       high-tops: ankle collar, toe cap, tongue, laces,
 *         │                       layered cream soles )
 *         └─ equipment-accessory └─ garment-spider-web-device ( silver web with gem
 *                                 + purple-black comm device with a spider emblem,
 *                                 parented INTO the torso mesh → rides the chest )
 *
 * Every spider starter garment is PRE-BUILT at model construction. Dressing or
 * undressing only flips `garment.visible` (and the slot's applied assetKey) —
 * meshes are never created, destroyed or disposed at runtime, so wardrobe taps
 * are instant and texture/geometry ownership stays with the model until
 * `dispose()` runs once.
 */

export const SPIDER_MODEL_GROUP_NAMES = {
  root: 'spider-persona-root',
  character: 'spider-persona',
  body: 'body',
  head: 'head',
  fur: 'fur',
  arms: 'arms',
  legs: 'legs',
  spiderLegs: 'spider-legs',
  underwear: 'underwear',
  equipment: 'equipment',
} as const

/** Groups that must stay visible no matter what the outfit says. */
export const PERMANENT_AVATAR_GROUPS: readonly string[] = [
  SPIDER_MODEL_GROUP_NAMES.body,
  SPIDER_MODEL_GROUP_NAMES.head,
  SPIDER_MODEL_GROUP_NAMES.fur,
  SPIDER_MODEL_GROUP_NAMES.arms,
  SPIDER_MODEL_GROUP_NAMES.legs,
  SPIDER_MODEL_GROUP_NAMES.spiderLegs,
  SPIDER_MODEL_GROUP_NAMES.underwear,
] as const

export function getEquipmentGroupName(slot: EquipmentSlot3D): string {
  return `equipment-${slot}`
}

export interface SpiderPersonaModel {
  root: Group
  character: Group
  groups: {
    body: Group
    head: Group
    fur: Group
    arms: Group
    legs: Group
    spiderLegs: Group
    underwear: Group
    equipment: Group
  }
  equipmentGroups: Record<EquipmentSlot3D, Group>
  /** Continuous yaw in radians — unbounded, rotates the whole character. */
  setYaw: (yaw: number) => void
  getYaw: () => number
  /**
   * Dress/undress one slot. `descriptor === null` hides every garment of the
   * slot (underwear stays). A descriptor flips on the ONE pre-built garment
   * whose assetKey matches — no meshes are created, destroyed or disposed.
   */
  applyEquipment: (slot: EquipmentSlot3D, descriptor: Equipment3DDescriptor | null) => void
  /** Currently applied assetKey per slot (null = bare). */
  getAppliedAssetKey: (slot: EquipmentSlot3D) => string | null
  dispose: () => void
}

// ---------------------------------------------------------------------------
// Small construction helpers
// ---------------------------------------------------------------------------

type AnyMaterial = MeshLambertMaterial | MeshPhongMaterial | MeshBasicMaterial

function lambert(color: RgbColor, extra?: MeshLambertMaterialParameters): MeshLambertMaterial {
  return new MeshLambertMaterial({ color: new Color(color.r, color.g, color.b), flatShading: true, ...extra })
}

function phong(color: RgbColor, shininess = 40): MeshPhongMaterial {
  return new MeshPhongMaterial({
    color: new Color(color.r, color.g, color.b),
    flatShading: true,
    shininess,
    specular: new Color(0.55, 0.55, 0.6),
  })
}

function addMesh(
  parent: Group | Mesh,
  name: string,
  geometry: SphereGeometry | CylinderGeometry | ConeGeometry | TorusGeometry | BoxGeometry | CircleGeometry,
  material: AnyMaterial,
  position: [number, number, number],
  scale?: [number, number, number],
): Mesh {
  const mesh = new Mesh(geometry, material)
  mesh.name = name
  mesh.position.set(position[0], position[1], position[2])
  if (scale) mesh.scale.set(scale[0], scale[1], scale[2])
  parent.add(mesh)
  return mesh
}

/**
 * Cylinder segment stretched between two points — used for arms, humanoid legs
 * and the 6 spider legs so limbs read as articulated limbs, not floating sticks.
 */
function addSegment(
  parent: Group,
  name: string,
  from: Vector3,
  to: Vector3,
  radiusFrom: number,
  radiusTo: number,
  material: AnyMaterial,
): Mesh {
  const direction = new Vector3().subVectors(to, from)
  const length = direction.length()
  const geometry = new CylinderGeometry(radiusTo, radiusFrom, length, 10, 1)
  const mesh = new Mesh(geometry, material)
  mesh.name = name
  mesh.position.copy(from).addScaledVector(direction, 0.5)
  mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize())
  parent.add(mesh)
  return mesh
}

function addJoint(parent: Group, name: string, at: Vector3, radius: number, material: AnyMaterial): Mesh {
  return addMesh(parent, name, new SphereGeometry(radius, 12, 10), material, [at.x, at.y, at.z])
}

function disposeMaterial(material: Material): void {
  // Model-owned materials only: every texture map (if any were ever added) is
  // created with the material that references it, so disposing here can never
  // free a shared/external texture. Session-level GL resources are released by
  // the session, never by this traversal.
  const withMap = material as MeshLambertMaterial
  if (withMap.map) withMap.map.dispose()
  material.dispose()
}

/** Recursively dispose geometries + materials (deduped) under `object`. */
export function disposeObject3D(object: { traverse: (cb: (node: any) => void) => void }): void {
  const geometries = new Set<{ dispose: () => void }>()
  const materials = new Set<Material>()
  object.traverse((node: any) => {
    if (node?.geometry) geometries.add(node.geometry)
    if (node?.material) {
      if (Array.isArray(node.material)) node.material.forEach((m: Material) => materials.add(m))
      else materials.add(node.material)
    }
  })
  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => disposeMaterial(material))
}

// ---------------------------------------------------------------------------
// Body part builders
// ---------------------------------------------------------------------------

/**
 * Reference-locked anatomy for the approved spider persona: a tall humanoid
 * silhouette with a narrow waist, long legs and six back limbs. Garments use
 * the same anchors so equipment never changes the underlying body shape.
 */
const TORSO_SCALE: [number, number, number] = [1, 1, 0.86]
const TORSO_POSITION: [number, number, number] = [0, 2.28, 0]
const HIPS_POSITION: [number, number, number] = [0, 1.62, 0]
const HEAD_POSITION: [number, number, number] = [0, 3.43, 0.01]

interface ArmPose {
  shoulder: Vector3
  elbow: Vector3
  wrist: Vector3
}

function getArmPose(side: 'left' | 'right'): ArmPose {
  // Match the reference stance: viewer-left hand raised beside the face,
  // viewer-right hand resting at the waist. Jacket sleeves reuse these bones.
  if (side === 'left') {
    return {
      shoulder: new Vector3(-0.51, 2.7, 0.12),
      elbow: new Vector3(-0.82, 2.34, 0.22),
      wrist: new Vector3(-0.61, 3.18, 0.36),
    }
  }
  return {
    shoulder: new Vector3(0.51, 2.7, 0.12),
    elbow: new Vector3(0.86, 2.16, 0.22),
    wrist: new Vector3(0.52, 1.79, 0.36),
  }
}

function buildBodyGroup(palette: SpiderPersonaPalette): { group: Group; torso: Mesh } {
  const group = new Group()
  group.name = SPIDER_MODEL_GROUP_NAMES.body

  const bodyMat = lambert(palette.body)
  const bellyMat = lambert(palette.belly)

  const torso = addMesh(
    group,
    'torso',
    new CylinderGeometry(0.51, 0.34, 1.2, 14),
    bodyMat,
    TORSO_POSITION,
    TORSO_SCALE,
  )
  addMesh(group, 'hips', new SphereGeometry(1, 14, 10), bodyMat, HIPS_POSITION, [0.47, 0.34, 0.41])
  addMesh(group, 'neck', new CylinderGeometry(0.17, 0.21, 0.31, 12), bodyMat, [0, 2.98, 0])
  addMesh(group, 'waist', new SphereGeometry(1, 14, 10), bodyMat, [0, 1.83, 0], [0.32, 0.24, 0.3])
  // A tiny modelling patch adds depth without creating the former robot-like oval.
  addMesh(group, 'belly', new SphereGeometry(1, 14, 10), bellyMat, [0, 2.29, 0.43], [0.075, 0.095, 0.02])

  return { group, torso }
}

function buildHeadGroup(palette: SpiderPersonaPalette): Group {
  const group = new Group()
  group.name = SPIDER_MODEL_GROUP_NAMES.head

  const furMat = lambert(palette.fur)
  const faceMat = lambert(palette.belly)
  // Catchlights are painted as unlit warm pixels. Lighting them with Phong
  // made the tiny meshes disappear after the black eye surface was flattened.
  const eyeWhiteMat = new MeshBasicMaterial({
    color: new Color(palette.eyeWhite.r, palette.eyeWhite.g, palette.eyeWhite.b),
    toneMapped: false,
  })
  // Keep the dark eye surfaces flat and paint the two catchlights explicitly.
  // A shiny black Phong surface produced uncontrolled white blooms on WeChat,
  // which made the official glossy pixel eyes read like plastic googly eyes.
  const irisMat = lambert(palette.eyeIris)
  const eyeSocketMat = lambert(shadeColor(palette.eyeIris, 0.52))
  const pupilMat = lambert(palette.pupil)
  const fangMat = lambert(palette.pupil)
  const blushMat = lambert(palette.blush)

  addMesh(group, 'head-sphere', new SphereGeometry(0.6, 18, 13), furMat, HEAD_POSITION, [1.05, 0.94, 0.87])
  addMesh(group, 'face-mask', new SphereGeometry(1, 16, 11), faceMat, [0, 3.39, 0.49], [0.44, 0.36, 0.05])

  // Match the official 2D profile face: two dominant glossy black eyes with a
  // purple lower crescent, then four much smaller black eyes in an upper arc.
  // The earlier pale, equal-sized eye cluster read as a different character.
  const mainEyeY = 3.35
  for (const side of ['left', 'right'] as const) {
    const s = side === 'left' ? -1 : 1
    const eyeX = 0.175 * s
    addMesh(group, `eye-${side}`, new SphereGeometry(0.151, 14, 10), eyeSocketMat, [eyeX, mainEyeY, 0.535], [0.96, 1.08, 0.34])
    addMesh(group, `pupil-${side}`, new SphereGeometry(0.137, 14, 10), pupilMat, [eyeX, mainEyeY, 0.574], [0.96, 1.06, 0.31])
    addMesh(group, `iris-${side}`, new SphereGeometry(0.101, 12, 9), irisMat, [eyeX, mainEyeY - 0.044, 0.613], [0.9, 0.72, 0.24])
    addMesh(group, `iris-mask-${side}`, new SphereGeometry(0.081, 12, 9), pupilMat, [eyeX, mainEyeY + 0.004, 0.634], [0.92, 1.02, 0.2])
    // Both catchlights sit toward the shared upper-left light source, exactly
    // like the glossy eyes in the 2D pixel sheet.
    addMesh(group, `eye-sparkle-${side}`, new SphereGeometry(0.042, 9, 7), eyeWhiteMat, [eyeX - 0.043, mainEyeY + 0.062, 0.678], [0.82, 1.06, 0.22])
    addMesh(group, `eye-sparkle-small-${side}`, new SphereGeometry(0.01, 7, 5), eyeWhiteMat, [eyeX + 0.035, mainEyeY + 0.012, 0.68], [0.9, 1, 0.22])

    const smallEyes = [
      { key: 'inner', x: 0.105, y: 3.64, radius: 0.05 },
      { key: 'outer', x: 0.345, y: 3.555, radius: 0.047 },
    ] as const
    smallEyes.forEach(({ key, x, y, radius }) => {
      const signedX = x * s
      addMesh(group, `mini-eye-${key}-${side}`, new SphereGeometry(radius, 10, 8), pupilMat, [signedX, y, 0.555], [0.96, 1.04, 0.34])
      addMesh(group, `mini-eye-${key}-pupil-${side}`, new SphereGeometry(Math.max(0.014, radius * 0.24), 7, 5), eyeWhiteMat, [signedX - 0.011, y + 0.014, 0.598], [0.88, 1, 0.22])
    })

    // The profile sheet has only tiny, tucked-away fangs; keep the spider cue
    // without turning the friendly mouth into a vampire grin.
    const fang = addMesh(group, `fang-${side}`, new ConeGeometry(0.008, 0.022, 7), fangMat, [0.05 * s, 3.17, 0.551])
    fang.rotation.x = Math.PI
    addMesh(group, `cheek-${side}`, new SphereGeometry(0.04, 9, 7), blushMat, [0.31 * s, 3.2, 0.514], [1.15, 0.42, 0.24])
  }

  // One quiet U-curve matches the approved portrait. The previous double arc
  // collapsed into four black dots at the intentionally low render buffer.
  const smile = addMesh(group, 'mouth-smile', new TorusGeometry(0.054, 0.006, 5, 16, Math.PI), pupilMat, [0, 3.17, 0.558])
  smile.rotation.z = Math.PI
  smile.scale.y = 0.58

  return group
}

function buildFurGroup(palette: SpiderPersonaPalette): Group {
  const group = new Group()
  group.name = SPIDER_MODEL_GROUP_NAMES.fur
  const furMat = lambert(palette.fur)

  // Head tufts.
  const tuftSpecs: Array<{ pos: [number, number, number]; radius: number; height: number; tiltX: number; tiltZ: number }> = [
    { pos: [0, 4.025, -0.01], radius: 0.052, height: 0.115, tiltX: -0.16, tiltZ: 0 },
    { pos: [-0.17, 3.995, -0.025], radius: 0.05, height: 0.11, tiltX: -0.2, tiltZ: 0.3 },
    { pos: [0.17, 3.995, -0.025], radius: 0.05, height: 0.11, tiltX: -0.2, tiltZ: -0.3 },
    { pos: [-0.34, 3.885, -0.03], radius: 0.048, height: 0.105, tiltX: -0.16, tiltZ: 0.68 },
    { pos: [0.34, 3.885, -0.03], radius: 0.048, height: 0.105, tiltX: -0.16, tiltZ: -0.68 },
    { pos: [-0.5, 3.695, -0.025], radius: 0.046, height: 0.1, tiltX: -0.08, tiltZ: 1.12 },
    { pos: [0.5, 3.695, -0.025], radius: 0.046, height: 0.1, tiltX: -0.08, tiltZ: -1.12 },
    { pos: [-0.555, 3.43, -0.015], radius: 0.044, height: 0.095, tiltX: -0.04, tiltZ: 1.48 },
    { pos: [0.555, 3.43, -0.015], radius: 0.044, height: 0.095, tiltX: -0.04, tiltZ: -1.48 },
    // Short jaw tufts break the smooth ball silhouette and reproduce the
    // shaggy lower edge visible in the approved 2D spider portrait.
    { pos: [-0.46, 3.14, -0.02], radius: 0.043, height: 0.09, tiltX: 0.05, tiltZ: 1.92 },
    { pos: [-0.25, 2.99, -0.025], radius: 0.042, height: 0.088, tiltX: 0.08, tiltZ: 2.56 },
    { pos: [0, 2.94, -0.03], radius: 0.043, height: 0.09, tiltX: 0.08, tiltZ: Math.PI },
    { pos: [0.25, 2.99, -0.025], radius: 0.042, height: 0.088, tiltX: 0.08, tiltZ: -2.56 },
    { pos: [0.46, 3.14, -0.02], radius: 0.043, height: 0.09, tiltX: 0.05, tiltZ: -1.92 },
  ]
  tuftSpecs.forEach((spec, index) => {
    const tuft = addMesh(group, `fur-tuft-${index}`, new ConeGeometry(spec.radius, spec.height, 8), furMat, spec.pos)
    tuft.rotation.x = spec.tiltX
    tuft.rotation.z = spec.tiltZ
  })

  for (const side of ['left', 'right'] as const) {
    const s = side === 'left' ? -1 : 1
    const cheekTuft = addMesh(group, `fur-cheek-tuft-${side}`, new ConeGeometry(0.047, 0.105, 7), furMat, [0.55 * s, 3.27, -0.015])
    cheekTuft.rotation.z = (-Math.PI / 2) * s
    const templeTuft = addMesh(group, `fur-temple-tuft-${side}`, new ConeGeometry(0.045, 0.1, 7), furMat, [0.51 * s, 3.71, -0.03])
    templeTuft.rotation.z = -1.2 * s

    const shoulderTuft = addMesh(group, `fur-shoulder-tuft-${side}`, new ConeGeometry(0.1, 0.26, 7), furMat, [0.5 * s, 2.79, -0.05])
    shoulderTuft.rotation.z = -1.2 * s
  }

  // Back spikes marching down the spine — visible proof the back view is different.
  const spikeSpecs: Array<{ y: number; height: number; radius: number }> = [
    { y: 2.78, height: 0.27, radius: 0.075 },
    { y: 2.43, height: 0.31, radius: 0.085 },
    { y: 2.08, height: 0.28, radius: 0.078 },
    { y: 1.78, height: 0.22, radius: 0.065 },
  ]
  spikeSpecs.forEach((spec, index) => {
    const spike = addMesh(
      group,
      `back-spike-${index}`,
      new ConeGeometry(spec.radius, spec.height, 8),
      furMat,
      [0, spec.y, -0.43],
    )
    spike.rotation.x = -0.72 // lean backward out of the torso
  })

  return group
}

function buildArmsGroup(palette: SpiderPersonaPalette): Group {
  const group = new Group()
  group.name = SPIDER_MODEL_GROUP_NAMES.arms
  const bodyMat = lambert(palette.body)
  const furMat = lambert(palette.fur)

  for (const side of ['left', 'right'] as const) {
    const { shoulder, elbow, wrist } = getArmPose(side)
    addJoint(group, `arm-${side}-shoulder`, shoulder, 0.15, bodyMat)
    addSegment(group, `arm-${side}-upper`, shoulder, elbow, 0.145, 0.12, bodyMat)
    addJoint(group, `arm-${side}-elbow`, elbow, 0.12, lambert(palette.spiderLegJoint))
    addSegment(group, `arm-${side}-fore`, elbow, wrist, 0.12, 0.085, bodyMat)
    addMesh(group, `hand-${side}`, new SphereGeometry(1, 12, 9), furMat, [wrist.x, wrist.y, wrist.z], [0.13, 0.17, 0.115])

    // Three tapered fingers make the raised-hand / hand-on-hip pose readable
    // even at the deliberately small pixel-art render resolution.
    const fingerTips = side === 'left'
      ? [
          wrist.clone().add(new Vector3(-0.08, 0.18, 0.015)),
          wrist.clone().add(new Vector3(0, 0.22, 0.045)),
          wrist.clone().add(new Vector3(0.08, 0.17, 0.025)),
        ]
      : [
          wrist.clone().add(new Vector3(-0.08, -0.15, 0.025)),
          wrist.clone().add(new Vector3(0, -0.19, 0.045)),
          wrist.clone().add(new Vector3(0.08, -0.14, 0.02)),
        ]
    fingerTips.forEach((tip, index) => {
      const base = wrist.clone().add(new Vector3((index - 1) * 0.025, side === 'left' ? 0.045 : -0.035, 0.025))
      addSegment(group, `hand-${side}-finger-${index}`, base, tip, 0.035, 0.014, furMat)
    })
  }

  return group
}

function buildLegsGroup(palette: SpiderPersonaPalette): Group {
  const group = new Group()
  group.name = SPIDER_MODEL_GROUP_NAMES.legs
  const bodyMat = lambert(palette.body)
  const furMat = lambert(palette.fur)

  for (const side of ['left', 'right'] as const) {
    const s = side === 'left' ? -1 : 1
    const hip = new Vector3(0.24 * s, 1.66, 0)
    const knee = new Vector3((side === 'left' ? 0.37 : 0.25) * s, side === 'left' ? 0.9 : 0.84, side === 'left' ? 0.08 : -0.015)
    const ankle = new Vector3((side === 'left' ? 0.25 : 0.36) * s, 0.2, 0.07)
    addSegment(group, `leg-${side}`, hip, knee, 0.23, 0.18, bodyMat)
    addJoint(group, `leg-${side}-knee`, knee, 0.17, lambert(palette.spiderLegJoint))
    addSegment(group, `leg-${side}-lower`, knee, ankle, 0.17, 0.11, bodyMat)
    const thighCenter = hip.clone().lerp(knee, 0.5)
    const thighContour = addMesh(
      group,
      `leg-${side}-thigh-contour`,
      new SphereGeometry(1, 12, 9),
      bodyMat,
      [thighCenter.x, thighCenter.y, thighCenter.z],
      [0.215, 0.34, 0.18],
    )
    thighContour.rotation.z = side === 'left' ? -0.12 : 0.03
    const calfCenter = knee.clone().lerp(ankle, 0.46)
    const calfContour = addMesh(
      group,
      `leg-${side}-calf-contour`,
      new SphereGeometry(1, 12, 9),
      bodyMat,
      [calfCenter.x, calfCenter.y, calfCenter.z],
      [0.15, 0.28, 0.14],
    )
    calfContour.rotation.z = side === 'left' ? 0.08 : -0.08
    // Long, narrow feet preserve the human silhouette from the reference.
    const foot = addMesh(group, `foot-${side}`, new SphereGeometry(1, 12, 9), furMat, [ankle.x, 0.08, 0.18], [0.21, 0.13, 0.38])
    foot.rotation.y = side === 'left' ? -0.08 : 0.1
    foot.rotation.z = side === 'left' ? 0.06 : -0.04
  }

  return group
}

function buildSpiderLegsGroup(palette: SpiderPersonaPalette): Group {
  const group = new Group()
  group.name = SPIDER_MODEL_GROUP_NAMES.spiderLegs
  const legMat = lambert(palette.spiderLeg)
  const jointMat = lambert(palette.spiderLegJoint)
  const clawMat = lambert(palette.spiderLegJoint)

  // Three articulated segments give every back limb the hooked, organic arc
  // visible in the reference instead of reading as two straight rods.
  const legSpecs: Array<{
    root: [number, number, number]
    knee: [number, number, number]
    ankle: [number, number, number]
    tip: [number, number, number]
  }> = [
    { root: [0.39, 2.67, -0.36], knee: [0.86, 3.18, -0.41], ankle: [1.25, 2.92, -0.21], tip: [1.39, 2.39, -0.02] },
    { root: [0.42, 2.36, -0.38], knee: [1.02, 2.62, -0.44], ankle: [1.42, 2.03, -0.22], tip: [1.38, 1.52, -0.04] },
    { root: [0.39, 2.05, -0.36], knee: [1.03, 2.0, -0.42], ankle: [1.39, 1.2, -0.2], tip: [1.27, 0.68, 0] },
  ]

  for (const side of ['left', 'right'] as const) {
    const s = side === 'left' ? -1 : 1
    const xScale = side === 'left' ? 1.02 : 0.97
    const yOffsets = side === 'left' ? [0.035, -0.025, 0.045] : [-0.025, 0.035, -0.02]
    const zOffset = side === 'left' ? 0.015 : -0.015
    legSpecs.forEach((spec, index) => {
      const root = new Vector3(spec.root[0] * s, spec.root[1] + yOffsets[index] * 0.3, spec.root[2] + zOffset)
      const knee = new Vector3(spec.knee[0] * s * xScale, spec.knee[1] + yOffsets[index], spec.knee[2] + zOffset)
      const ankle = new Vector3(spec.ankle[0] * s * xScale, spec.ankle[1] + yOffsets[index] * 0.65, spec.ankle[2] + zOffset)
      const tip = new Vector3(spec.tip[0] * s * xScale, spec.tip[1] + yOffsets[index] * 0.45, spec.tip[2] + zOffset)
      addJoint(group, `spider-leg-${side}-${index}-root`, root, 0.14, jointMat)
      addSegment(group, `spider-leg-${side}-${index}-femur`, root, knee, 0.14, 0.112, legMat)
      addJoint(group, `spider-leg-${side}-${index}-knee`, knee, 0.13, jointMat)
      addSegment(group, `spider-leg-${side}-${index}-tibia`, knee, ankle, 0.112, 0.084, legMat)
      addJoint(group, `spider-leg-${side}-${index}-ankle`, ankle, 0.1, jointMat)
      addSegment(group, `spider-leg-${side}-${index}-tarsus`, ankle, tip, 0.084, 0.045, legMat)
      // Claw tip pointing down-out.
      const claw = addMesh(
        group,
        `spider-leg-${side}-${index}-claw`,
        new ConeGeometry(0.05, 0.15, 7),
        clawMat,
        [tip.x + 0.03 * s, tip.y - 0.06, tip.z],
      )
      claw.rotation.x = Math.PI
      claw.rotation.z = 0.35 * s
    })
  }

  return group
}

/**
 * Permanent underwear: fitted vest + safety shorts + shoulder straps.
 * This group is never hidden — taking off top/bottom must stay decent.
 */
function buildUnderwearGroup(palette: SpiderPersonaPalette): Group {
  const group = new Group()
  group.name = SPIDER_MODEL_GROUP_NAMES.underwear
  const vestMat = lambert(palette.underwearVest)
  const shortsMat = lambert(palette.underwearShorts)
  const trimMat = lambert(palette.underwearTrim)

  // Vest — torso shell, chest to waist, slightly proud of the body shell.
  const vest = addMesh(
    group,
    'underwear-vest',
    new CylinderGeometry(0.49, 0.33, 1.08, 14),
    vestMat,
    TORSO_POSITION,
    [1.03, 1, 0.88],
  )
  vest.userData.permanent = true

  // Shoulder straps.
  for (const side of ['left', 'right'] as const) {
    const s = side === 'left' ? -1 : 1
    const strap = addMesh(
      group,
      `underwear-strap-${side}`,
      new BoxGeometry(0.1, 0.35, 0.09),
      vestMat,
      [0.27 * s, 2.79, 0.42],
    )
    strap.rotation.z = -0.18 * s
    strap.rotation.x = -0.12
  }

  addMesh(group, 'underwear-chest-panel', new SphereGeometry(1, 14, 10), trimMat, [0, 2.39, 0.44], [0.06, 0.075, 0.018])
  addMesh(group, 'underwear-neckline', new TorusGeometry(0.21, 0.022, 6, 18), trimMat, [0, 2.77, 0.43], [1, 0.56, 1])
  for (const side of ['left', 'right'] as const) {
    const s = side === 'left' ? -1 : 1
    const seam = addMesh(
      group,
      `underwear-side-seam-${side}`,
      new BoxGeometry(0.025, 0.62, 0.022),
      trimMat,
      [0.37 * s, 2.25, 0.43],
    )
    seam.rotation.z = 0.12 * s
  }

  // Small woven-in spider mark: enough identity to feel intentional when all
  // removable equipment is off, without competing with the chest accessory.
  const emblemY = 2.32
  addMesh(group, 'underwear-emblem-body', new SphereGeometry(0.044, 10, 8), trimMat, [0, emblemY, 0.47], [1, 1.3, 0.42])
  addMesh(group, 'underwear-emblem-head', new SphereGeometry(0.028, 9, 7), trimMat, [0, emblemY + 0.07, 0.47])
  for (let index = 0; index < 8; index += 1) {
    const s = index < 4 ? -1 : 1
    const row = index % 4
    const from = new Vector3(0.028 * s, emblemY + 0.035 - row * 0.023, 0.47)
    const to = new Vector3(0.082 * s, emblemY + 0.058 - row * 0.038, 0.47)
    addSegment(group, `underwear-emblem-leg-${index}`, from, to, 0.007, 0.004, trimMat)
  }

  // Safety shorts — hip shell, waist to mid-thigh.
  const shorts = addMesh(
    group,
    'underwear-shorts',
    new CylinderGeometry(0.41, 0.48, 0.36, 12),
    shortsMat,
    HIPS_POSITION,
    [1.03, 1, 0.86],
  )
  shorts.userData.permanent = true
  for (const side of ['left', 'right'] as const) {
    const s = side === 'left' ? -1 : 1
    addMesh(
      group,
      `underwear-short-leg-${side}`,
      new CylinderGeometry(0.2, 0.225, 0.42, 11),
      shortsMat,
      [0.22 * s, 1.39, 0],
      [1, 1, 0.86],
    )
  }
  // Waistband trim ring.
  const waistband = addMesh(
    group,
    'underwear-waistband',
    new TorusGeometry(0.41, 0.032, 7, 20),
    trimMat,
    [0, 1.84, 0],
  )
  waistband.rotation.x = Math.PI / 2
  waistband.scale.set(1.02, 0.86, 1)

  for (const side of ['left', 'right'] as const) {
    const s = side === 'left' ? -1 : 1
    const opening = addMesh(group, `underwear-leg-opening-${side}`, new TorusGeometry(0.22, 0.02, 6, 16), trimMat, [0.22 * s, 1.18, 0.01])
    opening.rotation.x = Math.PI / 2
  }

  group.userData.permanent = true
  return group
}

// ---------------------------------------------------------------------------
// Spider starter garment builders — one UNIQUE garment per starter assetKey.
// Built once at model construction; dressing only flips `garment.visible`.
// Shapes follow the approved V2 layer art (see spiderStarterGarments.ts for
// the assetKey ↔ garment registry and the required detail mesh names).
// ---------------------------------------------------------------------------

function addBox(
  parent: Group | Mesh,
  name: string,
  size: [number, number, number],
  material: AnyMaterial,
  position: [number, number, number],
  rotation?: [number, number, number],
): Mesh {
  const mesh = addMesh(parent, name, new BoxGeometry(size[0], size[1], size[2]), material, position)
  if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2])
  return mesh
}

/**
 * Deep-eggplant bomber jacket: full body + full-length sleeves, front zipper,
 * ribbed stand collar / cuffs / hem, zip pocket on the left sleeve, slanted
 * front pocket stitch lines.
 */
function buildSpiderBomberJacket(palette: Equipment3DPalette): Group {
  const garment = new Group()
  garment.name = getGarmentGroupName('spider-bomber-jacket')

  const bodyMat = lambert(palette.primary, { side: DoubleSide })
  const sleeveMat = lambert(palette.primary)
  const panelMat = lambert(shadeColor(palette.primary, 1.16))
  const ribMat = lambert(palette.secondary)
  const zipperMat = phong(palette.trim, 70)

  // Jacket body — torso shell from shoulders to just under the waist.
  addMesh(
    garment,
    'bomber-body',
    new CylinderGeometry(0.56, 0.42, 1.25, 14),
    bodyMat,
    TORSO_POSITION,
    [1, 1, 0.89],
  )

  // Slightly raised front panels and folded lapels stop the jacket reading as
  // a single purple tube at pixel-art scale.
  for (const side of ['left', 'right'] as const) {
    const s = side === 'left' ? -1 : 1
    addMesh(
      garment,
      `bomber-front-panel-${side}`,
      new SphereGeometry(1, 12, 9),
      panelMat,
      [0.23 * s, 2.3, 0.49],
      [0.22, 0.46, 0.035],
    )
    addBox(
      garment,
      `bomber-lapel-${side}`,
      [0.14, 0.35, 0.035],
      ribMat,
      [0.11 * s, 2.66, 0.52],
      [-0.08, 0, 0.26 * s],
    )
  }

  for (const side of ['left', 'right'] as const) {
    const s = side === 'left' ? -1 : 1
    // Full-length sleeves hugging the arms, shoulder → wrist.
    const { shoulder, elbow, wrist } = getArmPose(side)
    addSegment(garment, `bomber-sleeve-${side}`, shoulder, elbow, 0.17, 0.145, sleeveMat)
    addJoint(garment, `bomber-sleeve-joint-${side}`, elbow, 0.15, sleeveMat)
    addSegment(garment, `bomber-sleeve-fore-${side}`, elbow, wrist, 0.145, 0.105, sleeveMat)
    addMesh(
      garment,
      `bomber-shoulder-cap-${side}`,
      new SphereGeometry(1, 12, 9),
      panelMat,
      [shoulder.x, shoulder.y, shoulder.z],
      [0.18, 0.15, 0.17],
    )
    // Ribbed cuffs around the wrists.
    const cuff = addMesh(
      garment,
      `bomber-cuff-${side}`,
      new TorusGeometry(0.105, 0.03, 7, 16),
      ribMat,
      [wrist.x, wrist.y, wrist.z],
    )
    cuff.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), wrist.clone().sub(shoulder).normalize())
    // Slanted front pocket stitch lines on the lower front panels.
    addBox(garment, `bomber-pocket-seam-${side}`, [0.02, 0.2, 0.02], zipperMat, [0.3 * s, 2.04, 0.51], [-0.08, 0, 0.5 * s])
  }

  // Ribbed stand collar around the neck.
  addMesh(garment, 'bomber-collar', new CylinderGeometry(0.23, 0.29, 0.16, 14), ribMat, [0, 2.93, 0.02])
  // Ribbed hem band around the waist.
  const hem = addMesh(garment, 'bomber-hem', new TorusGeometry(0.4, 0.045, 7, 20), ribMat, [0, 1.65, 0])
  hem.rotation.x = Math.PI / 2
  hem.scale.set(1, 0.89, 1)

  // Front zipper slanted to follow the chest, with a pull tab at the bottom.
  addBox(garment, 'bomber-zipper-front', [0.038, 1.02, 0.03], zipperMat, [0, 2.29, 0.53], [-0.08, 0, 0])
  addBox(garment, 'bomber-zipper-pull', [0.065, 0.08, 0.04], zipperMat, [0, 1.79, 0.55], [-0.08, 0, 0])

  // Zip pocket on the left upper sleeve — the bomber signature.
  addBox(garment, 'bomber-sleeve-pocket-left', [0.13, 0.17, 0.055], ribMat, [-0.63, 2.5, 0.13], [0, -0.15, 0.35])
  addBox(garment, 'bomber-sleeve-pocket-zipper-left', [0.022, 0.13, 0.018], zipperMat, [-0.65, 2.51, 0.17], [0, -0.15, 0.35])

  return garment
}

/**
 * Black-grey cargo shorts: waistband with button + fly, belt loops, curved
 * front pocket stitch lines, and the 3D cargo pocket on the RIGHT thigh
 * (pouch + flap + hanging strap + buckle).
 */
function buildSpiderCargoShorts(palette: Equipment3DPalette): Group {
  const garment = new Group()
  garment.name = getGarmentGroupName('spider-cargo-shorts')

  const clothMat = lambert(palette.primary, { side: DoubleSide })
  const darkMat = lambert(palette.secondary)
  const metalMat = phong(palette.trim, 80)

  // Shorts body — hip shell from waist to mid-thigh.
  addMesh(
    garment,
    'cargo-shorts-body',
    new CylinderGeometry(0.42, 0.5, 0.5, 12),
    clothMat,
    HIPS_POSITION,
    [1, 1, 0.86],
  )

  for (const side of ['left', 'right'] as const) {
    const s = side === 'left' ? -1 : 1
    // Short legs hugging the thighs, ending in rolled cuffs.
    addMesh(garment, `cargo-leg-${side}`, new CylinderGeometry(0.22, 0.245, 0.44, 12), clothMat, [0.22 * s, 1.31, 0.01], [1, 1, 0.86])
    const cuff = addMesh(garment, `cargo-leg-cuff-${side}`, new TorusGeometry(0.235, 0.035, 7, 16), darkMat, [0.22 * s, 1.09, 0.01])
    cuff.rotation.x = Math.PI / 2
    cuff.scale.set(1, 0.86, 1)
    // Curved front pocket stitch lines.
    addBox(garment, `cargo-front-pocket-seam-${side}`, [0.02, 0.18, 0.02], darkMat, [0.28 * s, 1.6, 0.44], [-0.08, 0, 0.62 * s])
  }

  // Waistband with button + fly + four belt loops.
  const waistband = addMesh(garment, 'cargo-waistband', new TorusGeometry(0.43, 0.048, 7, 20), darkMat, [0, 1.86, 0])
  waistband.rotation.x = Math.PI / 2
  waistband.scale.set(1, 0.86, 1)
  const button = addMesh(garment, 'cargo-button', new CylinderGeometry(0.035, 0.035, 0.03, 10), metalMat, [0, 1.88, 0.43])
  button.rotation.x = Math.PI / 2
  addBox(garment, 'cargo-fly', [0.04, 0.18, 0.025], darkMat, [0, 1.71, 0.44], [-0.1, 0, 0])
  const beltLoops: ReadonlyArray<readonly [number, number, number, number]> = [
    [-0.21, 1.88, 0.31, 0],
    [0.21, 1.88, 0.31, 0],
    [-0.38, 1.85, 0.1, 0.5],
    [0.38, 1.85, 0.1, -0.5],
  ]
  beltLoops.forEach(([x, y, z, rotateY], index) => {
    addBox(garment, `cargo-belt-loop-${index}`, [0.075, 0.15, 0.045], darkMat, [x, y, z], [0, rotateY, 0])
  })

  // 3D cargo pocket on the RIGHT thigh: pouch + flap + hanging strap + buckle.
  addBox(garment, 'cargo-pocket-right', [0.19, 0.23, 0.12], darkMat, [0.42, 1.3, 0.1], [0, -0.15, 0])
  addBox(garment, 'cargo-pocket-flap-right', [0.21, 0.075, 0.14], darkMat, [0.42, 1.44, 0.1], [0, -0.15, 0])
  addBox(garment, 'cargo-pocket-strap-right', [0.05, 0.18, 0.03], darkMat, [0.42, 1.31, 0.18], [0, -0.15, 0])
  addBox(garment, 'cargo-pocket-buckle-right', [0.07, 0.07, 0.035], metalMat, [0.42, 1.35, 0.19], [0, -0.15, 0])

  return garment
}

/**
 * Purple-black high-top sneakers per foot: black body + high ankle collar,
 * purple toe cap / outer ankle panel / tongue / three lace bars, and layered
 * cream soles.
 */
function buildSpiderHighTopSneakers(palette: Equipment3DPalette): Group {
  const garment = new Group()
  garment.name = getGarmentGroupName('spider-high-top-sneakers')

  const bodyMat = phong(palette.primary, 55)
  const panelMat = lambert(palette.secondary)
  const soleMat = lambert(palette.trim)
  const soleMidMat = lambert(shadeColor(palette.trim, 0.82))

  for (const side of ['left', 'right'] as const) {
    const s = side === 'left' ? -1 : 1
    const x = side === 'left' ? -0.25 : 0.36
    // Shoe body wrapping the whole foot.
    const shoe = addMesh(garment, `hightop-${side}-body`, new SphereGeometry(1, 14, 10), bodyMat, [x, 0.1, 0.18], [0.27, 0.18, 0.45])
    shoe.rotation.y = side === 'left' ? -0.08 : 0.1
    shoe.rotation.z = side === 'left' ? 0.06 : -0.04
    // High-top collar hugging the ankle.
    addMesh(garment, `hightop-${side}-ankle-collar`, new CylinderGeometry(0.205, 0.235, 0.31, 12), bodyMat, [x, 0.29, 0.06])
    // Purple toe cap + outer ankle panel + tongue.
    addMesh(garment, `hightop-${side}-toe-cap`, new SphereGeometry(1, 12, 9), panelMat, [x, 0.08, 0.46], [0.25, 0.12, 0.2])
    addMesh(garment, `hightop-${side}-ankle-panel`, new SphereGeometry(1, 11, 8), panelMat, [x + 0.15 * s, 0.29, 0.07], [0.1, 0.14, 0.17])
    addBox(garment, `hightop-${side}-tongue`, [0.18, 0.22, 0.06], panelMat, [x, 0.24, 0.31], [-0.35, 0, 0])
    // Three crossed lace bars climbing the instep.
    for (let index = 0; index < 3; index += 1) {
      addBox(
        garment,
        `hightop-${side}-laces-${index}`,
        [0.19, 0.03, 0.028],
        panelMat,
        [x, 0.19 + index * 0.05, 0.38 - index * 0.035],
        [-0.4, 0, (index % 2 === 0 ? 1 : -1) * 0.22],
      )
    }
    // Layered cream soles (mid layer slightly darker + wider).
    addMesh(garment, `hightop-${side}-sole-base`, new CylinderGeometry(0.28, 0.28, 0.07, 14), soleMat, [x, 0.025, 0.18], [1, 1, 1.58])
    addMesh(garment, `hightop-${side}-sole-mid`, new CylinderGeometry(0.29, 0.29, 0.04, 14), soleMidMat, [x, -0.005, 0.18], [1, 1, 1.6])
  }

  return garment
}

/**
 * Chest accessory — silver spider web with a purple gem (left chest) plus a
 * purple-black rectangular comm device carrying a tiny spider emblem (right
 * chest). Built in torso-local space; the slot group is parented into the
 * torso mesh so the whole piece rides the chest.
 */
function buildSpiderWebDevice(palette: Equipment3DPalette): Group {
  const garment = new Group()
  garment.name = getGarmentGroupName('spider-web-device')
  garment.scale.set(0.55, 0.55, 0.55)

  const silverMat = phong(palette.primary, 90)
  const deviceMat = phong(palette.secondary, 45)
  const gemMat = phong(palette.trim, 100)

  // --- Silver web on the left chest: gem center, 2 rings, 8 spokes ---
  const webCenter = new Vector3(-0.38, 0.2, 0.04)
  addMesh(garment, 'web-center-gem', new SphereGeometry(0.075, 14, 10), gemMat, [webCenter.x, webCenter.y, 0.08])
  addMesh(garment, 'web-ring-inner', new TorusGeometry(0.11, 0.014, 6, 20), silverMat, [webCenter.x, webCenter.y, 0.05])
  addMesh(garment, 'web-ring-outer', new TorusGeometry(0.19, 0.014, 6, 24), silverMat, [webCenter.x, webCenter.y, 0.04])
  for (let index = 0; index < 8; index += 1) {
    const angle = (index * Math.PI) / 4
    const direction = new Vector3(Math.cos(angle), Math.sin(angle), 0)
    addSegment(garment, `web-spoke-${index}`, webCenter, webCenter.clone().addScaledVector(direction, 0.205), 0.014, 0.011, silverMat)
  }

  // --- Purple-black comm device on the right chest ---
  addBox(garment, 'comm-body', [0.23, 0.31, 0.08], deviceMat, [0.34, 0.02, 0.05])
  addBox(garment, 'comm-top-band', [0.23, 0.06, 0.085], gemMat, [0.34, 0.145, 0.055])
  // Tiny spider emblem riding the device face (body + head + 8 legs).
  addMesh(garment, 'comm-spider-body', new SphereGeometry(0.05, 12, 10), silverMat, [0.34, 0.0, 0.1], [1, 1.35, 0.5])
  addMesh(garment, 'comm-spider-head', new SphereGeometry(0.032, 10, 8), silverMat, [0.34, 0.085, 0.1])
  for (let index = 0; index < 8; index += 1) {
    const s = index < 4 ? -1 : 1
    const row = index % 4
    const y0 = 0.045 - row * 0.03
    const from = new Vector3(0.34 + 0.04 * s, y0, 0.1)
    const to = new Vector3(0.34 + 0.1 * s, y0 + (row < 2 ? 0.03 : -0.03), 0.1)
    addSegment(garment, `comm-spider-leg-${index}`, from, to, 0.009, 0.007, silverMat)
  }

  return garment
}

const SPIDER_STARTER_GARMENT_BUILDERS: Record<SpiderStarterGarmentKind, (palette: Equipment3DPalette) => Group> = {
  'spider-bomber-jacket': buildSpiderBomberJacket,
  'spider-cargo-shorts': buildSpiderCargoShorts,
  'spider-high-top-sneakers': buildSpiderHighTopSneakers,
  'spider-web-device': buildSpiderWebDevice,
}

// ---------------------------------------------------------------------------
// Model assembly
// ---------------------------------------------------------------------------

export interface BuildSpiderPersonaOptions {
  palette?: SpiderPersonaPalette
}

export function buildSpiderPersonaModel(options: BuildSpiderPersonaOptions = {}): SpiderPersonaModel {
  const palette = options.palette ?? SPIDER_PERSONA_PALETTE

  const root = new Group()
  root.name = SPIDER_MODEL_GROUP_NAMES.root

  // Soft ground shadow — cheap ellipse instead of shadow maps.
  const shadow = new Mesh(
    new CircleGeometry(1.35, 28),
    new MeshBasicMaterial({ color: new Color(0.16, 0.12, 0.2), transparent: true, opacity: 0.2 }),
  )
  shadow.name = 'ground-shadow'
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.01
  shadow.scale.set(1.1, 0.75, 1)
  root.add(shadow)

  const character = new Group()
  character.name = SPIDER_MODEL_GROUP_NAMES.character
  root.add(character)

  const { group: bodyGroup, torso } = buildBodyGroup(palette)
  const headGroup = buildHeadGroup(palette)
  const furGroup = buildFurGroup(palette)
  const armsGroup = buildArmsGroup(palette)
  const legsGroup = buildLegsGroup(palette)
  const spiderLegsGroup = buildSpiderLegsGroup(palette)
  const underwearGroup = buildUnderwearGroup(palette)

  const equipmentGroup = new Group()
  equipmentGroup.name = SPIDER_MODEL_GROUP_NAMES.equipment

  const equipmentGroups = {} as Record<EquipmentSlot3D, Group>
  for (const slot of EQUIPMENT_3D_SLOTS) {
    const slotGroup = new Group()
    slotGroup.name = getEquipmentGroupName(slot)
    slotGroup.userData.slot = slot
    slotGroup.userData.appliedAssetKey = null
    equipmentGroups[slot] = slotGroup
    equipmentGroup.add(slotGroup)
  }

  // Pre-build every spider starter garment ONCE (common palette; rare variants
  // only shift material tints and are not separate meshes). Dressing later only
  // flips `garment.visible` — nothing is created, destroyed or disposed at
  // runtime, so wardrobe taps are instant.
  for (const spec of SPIDER_STARTER_GARMENT_SPECS) {
    const garment = SPIDER_STARTER_GARMENT_BUILDERS[spec.garmentKind](
      resolveEquipmentPalette({ assetKey: spec.assetKey, slot: spec.slot, rarity: 'common' }),
    )
    garment.userData.assetKey = spec.assetKey
    garment.userData.garmentKind = spec.garmentKind
    garment.visible = false
    equipmentGroups[spec.slot].add(garment)
  }

  // The chest badge must ride the chest mesh, so the accessory group is parented
  // into the torso rather than floating beside it. Torso-local coordinates:
  // the unit sphere's chest front is ~(0, 0.12, 1.02).
  equipmentGroup.remove(equipmentGroups.accessory)
  equipmentGroups.accessory.position.set(0, 0.03, 0.58)
  torso.add(equipmentGroups.accessory)

  character.add(bodyGroup, headGroup, furGroup, armsGroup, legsGroup, spiderLegsGroup, underwearGroup, equipmentGroup)

  let disposed = false

  return {
    root,
    character,
    groups: {
      body: bodyGroup,
      head: headGroup,
      fur: furGroup,
      arms: armsGroup,
      legs: legsGroup,
      spiderLegs: spiderLegsGroup,
      underwear: underwearGroup,
      equipment: equipmentGroup,
    },
    equipmentGroups,

    setYaw(yaw: number) {
      if (!Number.isFinite(yaw)) return
      character.rotation.y = yaw
    },

    getYaw() {
      return character.rotation.y
    },

    applyEquipment(slot, descriptor) {
      if (disposed) return
      const slotGroup = equipmentGroups[slot]
      if (!slotGroup) return
      const targetKey = descriptor?.assetKey ?? null
      slotGroup.userData.appliedAssetKey = targetKey
      // Visibility flip only — garments were pre-built at construction.
      for (const garment of slotGroup.children) {
        garment.visible = targetKey !== null && garment.userData.assetKey === targetKey
      }
    },

    getAppliedAssetKey(slot) {
      return (equipmentGroups[slot]?.userData.appliedAssetKey as string | null) ?? null
    },

    dispose() {
      if (disposed) return
      disposed = true
      disposeObject3D(root)
    },
  }
}
