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
  return new MeshLambertMaterial({ color: new Color(color.r, color.g, color.b), ...extra })
}

function phong(color: RgbColor, shininess = 40): MeshPhongMaterial {
  return new MeshPhongMaterial({
    color: new Color(color.r, color.g, color.b),
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

const TORSO_SCALE: [number, number, number] = [0.95, 1.02, 0.8]
const TORSO_POSITION: [number, number, number] = [0, 1.55, 0]
const HIPS_SCALE: [number, number, number] = [0.82, 0.62, 0.72]
const HIPS_POSITION: [number, number, number] = [0, 0.88, 0]
const HEAD_POSITION: [number, number, number] = [0, 2.8, 0.02]

function buildBodyGroup(palette: SpiderPersonaPalette): { group: Group; torso: Mesh } {
  const group = new Group()
  group.name = SPIDER_MODEL_GROUP_NAMES.body

  const bodyMat = lambert(palette.body)
  const bellyMat = lambert(palette.belly)

  const torso = addMesh(
    group,
    'torso',
    new SphereGeometry(1, 22, 16),
    bodyMat,
    TORSO_POSITION,
    TORSO_SCALE,
  )
  addMesh(group, 'hips', new SphereGeometry(1, 18, 14), bodyMat, HIPS_POSITION, HIPS_SCALE)
  // Belly patch — lighter oval on the front of the torso.
  addMesh(group, 'belly', new SphereGeometry(1, 16, 12), bellyMat, [0, 1.5, 0.58], [0.5, 0.6, 0.24])

  return { group, torso }
}

function buildHeadGroup(palette: SpiderPersonaPalette): Group {
  const group = new Group()
  group.name = SPIDER_MODEL_GROUP_NAMES.head

  const furMat = lambert(palette.fur)
  const eyeWhiteMat = phong(palette.eyeWhite, 80)
  const irisMat = phong(palette.eyeIris, 90)
  const pupilMat = phong(palette.pupil, 100)
  const fangMat = lambert(palette.fang)
  const blushMat = lambert(palette.blush)

  addMesh(group, 'head-sphere', new SphereGeometry(0.78, 24, 18), furMat, HEAD_POSITION, [1, 0.94, 0.9])

  // Two big front eyes — the persona's face. Positioned proud of the head shell.
  const eyeY = 2.86
  for (const side of ['left', 'right'] as const) {
    const s = side === 'left' ? -1 : 1
    const eyeX = 0.28 * s
    addMesh(group, `eye-${side}`, new SphereGeometry(0.23, 18, 14), eyeWhiteMat, [eyeX, eyeY, 0.66])
    addMesh(group, `iris-${side}`, new SphereGeometry(0.115, 14, 10), irisMat, [eyeX, eyeY, 0.85], [1, 1, 0.55])
    addMesh(group, `pupil-${side}`, new SphereGeometry(0.06, 12, 8), pupilMat, [eyeX, eyeY, 0.92], [1, 1, 0.5])
    // Catchlight dot for a lively read.
    addMesh(group, `eye-sparkle-${side}`, new SphereGeometry(0.026, 8, 6), eyeWhiteMat, [eyeX - 0.035 * s, eyeY + 0.045, 0.965])
    // Four small secondary spider eyes arc across the forehead.
    addMesh(group, `mini-eye-inner-${side}`, new SphereGeometry(0.05, 10, 8), pupilMat, [0.14 * s, 3.16, 0.55])
    addMesh(group, `mini-eye-outer-${side}`, new SphereGeometry(0.045, 10, 8), pupilMat, [0.34 * s, 3.08, 0.5])
    // Fangs under the eyes.
    const fang = addMesh(group, `fang-${side}`, new ConeGeometry(0.055, 0.18, 10), fangMat, [0.14 * s, 2.48, 0.6])
    fang.rotation.x = Math.PI
    // Soft cheeks.
    addMesh(group, `cheek-${side}`, new SphereGeometry(0.09, 10, 8), blushMat, [0.45 * s, 2.62, 0.5], [1, 0.7, 0.45])
  }

  return group
}

function buildFurGroup(palette: SpiderPersonaPalette): Group {
  const group = new Group()
  group.name = SPIDER_MODEL_GROUP_NAMES.fur
  const furMat = lambert(palette.fur)

  // Head tufts.
  const tuftSpecs: Array<{ pos: [number, number, number]; radius: number; height: number; tiltX: number; tiltZ: number }> = [
    { pos: [0, 3.42, 0], radius: 0.13, height: 0.32, tiltX: -0.22, tiltZ: 0 },
    { pos: [-0.2, 3.36, -0.04], radius: 0.11, height: 0.26, tiltX: -0.3, tiltZ: 0.28 },
    { pos: [0.2, 3.36, -0.04], radius: 0.11, height: 0.26, tiltX: -0.3, tiltZ: -0.28 },
  ]
  tuftSpecs.forEach((spec, index) => {
    const tuft = addMesh(group, `fur-tuft-${index}`, new ConeGeometry(spec.radius, spec.height, 8), furMat, spec.pos)
    tuft.rotation.x = spec.tiltX
    tuft.rotation.z = spec.tiltZ
  })

  // Back spikes marching down the spine — visible proof the back view is different.
  const spikeSpecs: Array<{ y: number; height: number; radius: number }> = [
    { y: 2.45, height: 0.3, radius: 0.09 },
    { y: 2.05, height: 0.34, radius: 0.1 },
    { y: 1.65, height: 0.3, radius: 0.09 },
    { y: 1.25, height: 0.24, radius: 0.08 },
  ]
  spikeSpecs.forEach((spec, index) => {
    const spike = addMesh(
      group,
      `back-spike-${index}`,
      new ConeGeometry(spec.radius, spec.height, 8),
      furMat,
      [0, spec.y, -0.68],
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
    const s = side === 'left' ? -1 : 1
    const shoulder = new Vector3(0.85 * s, 2.1, 0.02)
    const elbow = new Vector3(1.12 * s, 1.55, 0.12)
    const wrist = new Vector3(1.05 * s, 1.06, 0.28)
    addSegment(group, `arm-${side}-upper`, shoulder, elbow, 0.17, 0.15, bodyMat)
    addJoint(group, `arm-${side}-elbow`, elbow, 0.155, bodyMat)
    addSegment(group, `arm-${side}-fore`, elbow, wrist, 0.15, 0.13, bodyMat)
    addJoint(group, `hand-${side}`, wrist, 0.2, furMat)
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
    const hip = new Vector3(0.3 * s, 0.92, 0)
    const ankle = new Vector3(0.33 * s, 0.3, 0.02)
    addSegment(group, `leg-${side}`, hip, ankle, 0.22, 0.18, bodyMat)
    // Foot — small ellipsoid pointing forward.
    addMesh(group, `foot-${side}`, new SphereGeometry(1, 14, 10), furMat, [0.33 * s, 0.15, 0.12], [0.24, 0.15, 0.38])
  }

  return group
}

function buildSpiderLegsGroup(palette: SpiderPersonaPalette): Group {
  const group = new Group()
  group.name = SPIDER_MODEL_GROUP_NAMES.spiderLegs
  const legMat = lambert(palette.spiderLeg)
  const jointMat = lambert(palette.spiderLegJoint)
  const clawMat = lambert(palette.fang)

  // Root / knee / tip triples per leg index (mirrored per side). Roots sit on the
  // BACK of the torso (-z), so the rear view is unmistakably a spider.
  const legSpecs: Array<{ root: [number, number, number]; knee: [number, number, number]; tip: [number, number, number] }> = [
    { root: [0.5, 2.0, -0.5], knee: [1.18, 2.92, -0.78], tip: [1.58, 1.72, -0.5] },
    { root: [0.62, 1.6, -0.6], knee: [1.38, 2.18, -0.88], tip: [1.78, 0.9, -0.58] },
    { root: [0.5, 1.22, -0.5], knee: [1.22, 1.5, -0.82], tip: [1.62, 0.34, -0.44] },
  ]

  for (const side of ['left', 'right'] as const) {
    const s = side === 'left' ? -1 : 1
    legSpecs.forEach((spec, index) => {
      const root = new Vector3(spec.root[0] * s, spec.root[1], spec.root[2])
      const knee = new Vector3(spec.knee[0] * s, spec.knee[1], spec.knee[2])
      const tip = new Vector3(spec.tip[0] * s, spec.tip[1], spec.tip[2])
      addJoint(group, `spider-leg-${side}-${index}-root`, root, 0.1, jointMat)
      addSegment(group, `spider-leg-${side}-${index}-femur`, root, knee, 0.09, 0.068, legMat)
      addJoint(group, `spider-leg-${side}-${index}-knee`, knee, 0.105, jointMat)
      addSegment(group, `spider-leg-${side}-${index}-tibia`, knee, tip, 0.068, 0.042, legMat)
      // Claw tip pointing down-out.
      const claw = addMesh(
        group,
        `spider-leg-${side}-${index}-claw`,
        new ConeGeometry(0.05, 0.16, 8),
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
    new SphereGeometry(1.035, 22, 14, 0, Math.PI * 2, Math.PI * 0.3, Math.PI * 0.38),
    vestMat,
    TORSO_POSITION,
    TORSO_SCALE,
  )
  vest.userData.permanent = true

  // Shoulder straps.
  for (const side of ['left', 'right'] as const) {
    const s = side === 'left' ? -1 : 1
    const strap = addMesh(
      group,
      `underwear-strap-${side}`,
      new BoxGeometry(0.16, 0.34, 0.5),
      trimMat,
      [0.42 * s, 2.28, 0.06],
    )
    strap.rotation.z = -0.35 * s
    strap.rotation.x = 0.12
  }

  // Safety shorts — hip shell, waist to mid-thigh.
  const shorts = addMesh(
    group,
    'underwear-shorts',
    new SphereGeometry(1.045, 18, 12, 0, Math.PI * 2, Math.PI * 0.25, Math.PI * 0.45),
    shortsMat,
    HIPS_POSITION,
    HIPS_SCALE,
  )
  shorts.userData.permanent = true
  // Waistband trim ring.
  const waistband = addMesh(
    group,
    'underwear-waistband',
    new TorusGeometry(0.68, 0.045, 8, 24),
    trimMat,
    [0, 1.3, 0],
  )
  waistband.rotation.x = Math.PI / 2
  waistband.scale.set(1.02, 0.82, 1)

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
  const ribMat = lambert(palette.secondary)
  const zipperMat = phong(palette.trim, 70)

  // Jacket body — torso shell from shoulders to just under the waist.
  addMesh(
    garment,
    'bomber-body',
    new SphereGeometry(1.06, 22, 14, 0, Math.PI * 2, Math.PI * 0.16, Math.PI * 0.56),
    bodyMat,
    TORSO_POSITION,
    [0.98, 1.05, 0.84],
  )

  for (const side of ['left', 'right'] as const) {
    const s = side === 'left' ? -1 : 1
    // Full-length sleeves hugging the arms, shoulder → wrist.
    const shoulder = new Vector3(0.88 * s, 2.08, 0.02)
    const wrist = new Vector3(1.03 * s, 1.12, 0.26)
    addSegment(garment, `bomber-sleeve-${side}`, shoulder, wrist, 0.25, 0.2, sleeveMat)
    // Ribbed cuffs around the wrists.
    const cuff = addMesh(
      garment,
      `bomber-cuff-${side}`,
      new TorusGeometry(0.21, 0.055, 8, 18),
      ribMat,
      [wrist.x, wrist.y, wrist.z],
    )
    cuff.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), wrist.clone().sub(shoulder).normalize())
    // Slanted front pocket stitch lines on the lower front panels.
    addBox(garment, `bomber-pocket-seam-${side}`, [0.03, 0.26, 0.02], zipperMat, [0.42 * s, 1.45, 0.78], [-0.08, 0, 0.5 * s])
  }

  // Ribbed stand collar around the neck.
  addMesh(garment, 'bomber-collar', new CylinderGeometry(0.42, 0.46, 0.16, 18), ribMat, [0, 2.32, 0.03])
  // Ribbed hem band around the waist.
  const hem = addMesh(garment, 'bomber-hem', new TorusGeometry(0.93, 0.06, 8, 24), ribMat, [0, 1.32, 0])
  hem.rotation.x = Math.PI / 2
  hem.scale.set(1, 0.86, 1)

  // Front zipper slanted to follow the chest, with a pull tab at the bottom.
  addBox(garment, 'bomber-zipper-front', [0.055, 1.05, 0.035], zipperMat, [0, 1.8, 0.72], [-0.2, 0, 0])
  addBox(garment, 'bomber-zipper-pull', [0.09, 0.1, 0.05], zipperMat, [0, 1.32, 0.82], [-0.15, 0, 0])

  // Zip pocket on the left upper sleeve — the bomber signature.
  addBox(garment, 'bomber-sleeve-pocket-left', [0.17, 0.2, 0.07], ribMat, [-1.06, 1.92, 0.18], [0, -0.2, 0.3])
  addBox(garment, 'bomber-sleeve-pocket-zipper-left', [0.03, 0.15, 0.02], zipperMat, [-1.09, 1.93, 0.225], [0, -0.2, 0.3])

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
    new SphereGeometry(1.07, 18, 12, 0, Math.PI * 2, Math.PI * 0.2, Math.PI * 0.5),
    clothMat,
    HIPS_POSITION,
    [0.86, 0.66, 0.76],
  )

  for (const side of ['left', 'right'] as const) {
    const s = side === 'left' ? -1 : 1
    // Short legs hugging the thighs, ending in rolled cuffs.
    addMesh(garment, `cargo-leg-${side}`, new CylinderGeometry(0.34, 0.37, 0.5, 14), clothMat, [0.32 * s, 0.58, 0.01])
    const cuff = addMesh(garment, `cargo-leg-cuff-${side}`, new TorusGeometry(0.36, 0.05, 8, 18), darkMat, [0.32 * s, 0.34, 0.01])
    cuff.rotation.x = Math.PI / 2
    // Curved front pocket stitch lines.
    addBox(garment, `cargo-front-pocket-seam-${side}`, [0.03, 0.26, 0.02], darkMat, [0.4 * s, 1.02, 0.74], [-0.1, 0, 0.65 * s])
  }

  // Waistband with button + fly + four belt loops.
  const waistband = addMesh(garment, 'cargo-waistband', new TorusGeometry(0.68, 0.075, 8, 24), darkMat, [0, 1.36, 0])
  waistband.rotation.x = Math.PI / 2
  waistband.scale.set(1, 0.88, 1)
  const button = addMesh(garment, 'cargo-button', new CylinderGeometry(0.05, 0.05, 0.035, 12), metalMat, [0, 1.4, 0.62])
  button.rotation.x = Math.PI / 2
  addBox(garment, 'cargo-fly', [0.055, 0.24, 0.03], darkMat, [0, 1.18, 0.64], [-0.12, 0, 0])
  const beltLoops: ReadonlyArray<readonly [number, number, number, number]> = [
    [-0.3, 1.4, 0.56, 0],
    [0.3, 1.4, 0.56, 0],
    [-0.62, 1.36, 0.2, 0.5],
    [0.62, 1.36, 0.2, -0.5],
  ]
  beltLoops.forEach(([x, y, z, rotateY], index) => {
    addBox(garment, `cargo-belt-loop-${index}`, [0.075, 0.15, 0.045], darkMat, [x, y, z], [0, rotateY, 0])
  })

  // 3D cargo pocket on the RIGHT thigh: pouch + flap + hanging strap + buckle.
  addBox(garment, 'cargo-pocket-right', [0.24, 0.28, 0.14], darkMat, [0.6, 0.62, 0.14], [0, -0.15, 0])
  addBox(garment, 'cargo-pocket-flap-right', [0.26, 0.09, 0.16], darkMat, [0.6, 0.8, 0.14], [0, -0.15, 0])
  addBox(garment, 'cargo-pocket-strap-right', [0.07, 0.22, 0.035], darkMat, [0.6, 0.64, 0.23], [0, -0.15, 0])
  addBox(garment, 'cargo-pocket-buckle-right', [0.09, 0.09, 0.04], metalMat, [0.6, 0.7, 0.24], [0, -0.15, 0])

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
    const x = 0.33 * s
    // Shoe body wrapping the whole foot.
    addMesh(garment, `hightop-${side}-body`, new SphereGeometry(1, 16, 12), bodyMat, [x, 0.18, 0.13], [0.31, 0.21, 0.5])
    // High-top collar hugging the ankle.
    addMesh(garment, `hightop-${side}-ankle-collar`, new CylinderGeometry(0.27, 0.3, 0.34, 14), bodyMat, [x, 0.4, 0.03])
    // Purple toe cap + outer ankle panel + tongue.
    addMesh(garment, `hightop-${side}-toe-cap`, new SphereGeometry(1, 14, 10), panelMat, [x, 0.15, 0.45], [0.29, 0.15, 0.22])
    addMesh(garment, `hightop-${side}-ankle-panel`, new SphereGeometry(1, 12, 10), panelMat, [x + 0.19 * s, 0.4, 0.05], [0.12, 0.16, 0.2])
    addBox(garment, `hightop-${side}-tongue`, [0.2, 0.24, 0.07], panelMat, [x, 0.33, 0.3], [-0.35, 0, 0])
    // Three crossed lace bars climbing the instep.
    for (let index = 0; index < 3; index += 1) {
      addBox(
        garment,
        `hightop-${side}-laces-${index}`,
        [0.22, 0.04, 0.035],
        panelMat,
        [x, 0.26 + index * 0.06, 0.36 - index * 0.04],
        [-0.4, 0, (index % 2 === 0 ? 1 : -1) * 0.22],
      )
    }
    // Layered cream soles (mid layer slightly darker + wider).
    addMesh(garment, `hightop-${side}-sole-base`, new CylinderGeometry(0.32, 0.32, 0.08, 16), soleMat, [x, 0.05, 0.13], [1, 1, 1.5])
    addMesh(garment, `hightop-${side}-sole-mid`, new CylinderGeometry(0.33, 0.33, 0.05, 16), soleMidMat, [x, 0.015, 0.13], [1, 1, 1.52])
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

  const silverMat = phong(palette.primary, 90)
  const deviceMat = phong(palette.secondary, 45)
  const gemMat = phong(palette.trim, 100)

  // --- Silver web on the left chest: gem center, 2 rings, 8 spokes ---
  const webCenter = new Vector3(-0.4, 0.2, 1.0)
  addMesh(garment, 'web-center-gem', new SphereGeometry(0.075, 14, 10), gemMat, [webCenter.x, webCenter.y, 1.02])
  addMesh(garment, 'web-ring-inner', new TorusGeometry(0.11, 0.014, 6, 20), silverMat, [webCenter.x, webCenter.y, 1.0])
  addMesh(garment, 'web-ring-outer', new TorusGeometry(0.21, 0.014, 6, 24), silverMat, [webCenter.x, webCenter.y, 0.99])
  for (let index = 0; index < 8; index += 1) {
    const angle = (index * Math.PI) / 4
    const direction = new Vector3(Math.cos(angle), Math.sin(angle), 0)
    addSegment(garment, `web-spoke-${index}`, webCenter, webCenter.clone().addScaledVector(direction, 0.225), 0.014, 0.011, silverMat)
  }

  // --- Purple-black comm device on the right chest ---
  addBox(garment, 'comm-body', [0.28, 0.38, 0.08], deviceMat, [0.36, 0.02, 1.0])
  addBox(garment, 'comm-top-band', [0.28, 0.07, 0.085], gemMat, [0.36, 0.175, 1.0])
  // Tiny spider emblem riding the device face (body + head + 8 legs).
  addMesh(garment, 'comm-spider-body', new SphereGeometry(0.05, 12, 10), silverMat, [0.36, 0.0, 1.05], [1, 1.35, 0.5])
  addMesh(garment, 'comm-spider-head', new SphereGeometry(0.032, 10, 8), silverMat, [0.36, 0.085, 1.05])
  for (let index = 0; index < 8; index += 1) {
    const s = index < 4 ? -1 : 1
    const row = index % 4
    const y0 = 0.045 - row * 0.03
    const from = new Vector3(0.36 + 0.04 * s, y0, 1.05)
    const to = new Vector3(0.36 + 0.1 * s, y0 + (row < 2 ? 0.03 : -0.03), 1.05)
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
  equipmentGroups.accessory.position.set(0, 0.12, 1.04)
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
