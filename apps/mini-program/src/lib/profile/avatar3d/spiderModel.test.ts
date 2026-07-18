import { describe, expect, it, vi } from 'vitest'
import { Group, Mesh, type BufferGeometry, type Material } from 'three'
import {
  PERMANENT_AVATAR_GROUPS,
  SPIDER_MODEL_GROUP_NAMES,
  buildSpiderPersonaModel,
  disposeObject3D,
  getEquipmentGroupName,
  type SpiderPersonaModel,
} from './spiderModel'
import { resolveEquipment3DDescriptor } from './equipment3dMapping'
import { SPIDER_STARTER_GARMENT_SPECS, getGarmentGroupName } from './spiderStarterGarments'
import { EQUIPMENT_3D_SLOTS, type EquipmentSlot3D } from './avatar3dTypes'

function findByName(root: { getObjectByName: (name: string) => any }, name: string): any {
  return root.getObjectByName(name)
}

function allMeshes(root: Group): Mesh[] {
  const meshes: Mesh[] = []
  root.traverse((node: any) => {
    if (node?.isMesh) meshes.push(node as Mesh)
  })
  return meshes
}

function allMaterials(root: Group): Set<Material> {
  const materials = new Set<Material>()
  root.traverse((node: any) => {
    if (node?.material) {
      for (const m of Array.isArray(node.material) ? node.material : [node.material]) {
        materials.add(m as Material)
      }
    }
  })
  return materials
}

function descriptorFor(slot: EquipmentSlot3D) {
  const descriptor = resolveEquipment3DDescriptor({
    assetKey: `equipment/starter/spider/${slot}/v1`,
    slot,
    rarity: 'common',
  })
  if (!descriptor) throw new Error(`descriptor missing for ${slot}`)
  return descriptor
}

/** The ONE pre-built garment group inside a slot group (never added/removed). */
function garmentOf(model: SpiderPersonaModel, slot: EquipmentSlot3D): Group {
  const garment = model.equipmentGroups[slot].children.find((child) => child.name.startsWith('garment-'))
  if (!garment) throw new Error(`no pre-built garment in slot ${slot}`)
  return garment as Group
}

function collectDisposableSpies(model: SpiderPersonaModel) {
  const geometries = new Set<BufferGeometry>()
  model.root.traverse((node: any) => {
    if (node?.geometry) geometries.add(node.geometry as BufferGeometry)
  })
  const materials = allMaterials(model.root)
  return {
    geoSpies: [...geometries].map((g) => vi.spyOn(g, 'dispose')),
    matSpies: [...materials].map((m) => vi.spyOn(m, 'dispose')),
    geometryCount: geometries.size,
  }
}

describe('spider persona model — scene graph structure', () => {
  it('builds independent groups for every body part + equipment slot', () => {
    const model = buildSpiderPersonaModel()
    const names = SPIDER_MODEL_GROUP_NAMES
    for (const key of ['body', 'head', 'fur', 'arms', 'legs', 'spiderLegs', 'underwear', 'equipment'] as const) {
      const group = model.groups[key]
      expect(group, `group ${key} missing`).toBeTruthy()
      expect(group.name).toBe(names[key])
      // independent group: actually parented into the character subtree
      expect(model.character.getObjectByName(names[key])).toBe(group)
    }
    for (const slot of EQUIPMENT_3D_SLOTS) {
      expect(model.equipmentGroups[slot].name).toBe(getEquipmentGroupName(slot))
    }
    expect(model.root.name).toBe('spider-persona-root')
    model.dispose()
  })

  it('is made of real 3D geometry, not flat planes', () => {
    const model = buildSpiderPersonaModel()
    const meshes = allMeshes(model.root)
    expect(meshes.length).toBeGreaterThan(40)
    for (const mesh of meshes) {
      // The ground shadow is the one intentionally flat ellipse in the scene.
      if (mesh.name === 'ground-shadow') continue
      const geometry = mesh.geometry as BufferGeometry
      const position = geometry.getAttribute('position')
      expect(position, `${mesh.name} has no position attribute`).toBeTruthy()
      // genuine volume: vertices must span non-trivial ranges on x, y AND z
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity
      for (let i = 0; i < position.count; i++) {
        minX = Math.min(minX, position.getX(i)); maxX = Math.max(maxX, position.getX(i))
        minY = Math.min(minY, position.getY(i)); maxY = Math.max(maxY, position.getY(i))
        minZ = Math.min(minZ, position.getZ(i)); maxZ = Math.max(maxZ, position.getZ(i))
      }
      expect(maxX - minX, `${mesh.name} is x-flat`).toBeGreaterThan(0.001)
      expect(maxY - minY, `${mesh.name} is y-flat`).toBeGreaterThan(0.001)
      expect(maxZ - minZ, `${mesh.name} is z-flat (plane suspected)`).toBeGreaterThan(0.001)
    }
    model.dispose()
  })

  it('uses a shaped humanoid torso instead of the former stacked-sphere blob', () => {
    const model = buildSpiderPersonaModel()
    expect(findByName(model.groups.body, 'torso').geometry.type).toBe('CylinderGeometry')
    expect(findByName(model.groups.underwear, 'underwear-vest').geometry.type).toBe('CylinderGeometry')
    expect(findByName(model.groups.underwear, 'underwear-short-leg-left')).toBeTruthy()
    expect(findByName(model.groups.underwear, 'underwear-short-leg-right')).toBeTruthy()
    model.dispose()
  })

  it('front and back views are genuinely different (eyes front, spider legs back)', () => {
    const model = buildSpiderPersonaModel()
    // Eyes/face live on +z
    for (const name of ['eye-left', 'eye-right', 'fang-left', 'fang-right']) {
      const mesh = findByName(model.character, name)
      expect(mesh, `${name} missing`).toBeTruthy()
      expect(mesh.position.z).toBeGreaterThan(0.4)
    }
    // Spider legs originate on the back (-z) and swing out sideways
    for (const side of ['left', 'right']) {
      for (let index = 0; index < 3; index++) {
        const rootJoint = findByName(model.character, `spider-leg-${side}-${index}-root`)
        expect(rootJoint, `spider-leg-${side}-${index}-root missing`).toBeTruthy()
        expect(rootJoint.position.z).toBeLessThan(0)
        const claw = findByName(model.character, `spider-leg-${side}-${index}-claw`)
        expect(Math.abs(claw.position.x)).toBeGreaterThan(1.2)
      }
    }
    // Back spikes also live behind the torso
    expect(findByName(model.character, 'back-spike-0').position.z).toBeLessThan(-0.4)
    model.dispose()
  })

  it('keeps a complete head: big eyes, secondary eyes, fangs, cheeks, fur tufts', () => {
    const model = buildSpiderPersonaModel()
    const expected = [
      'head-sphere',
      'eye-left', 'eye-right', 'iris-left', 'iris-right', 'pupil-left', 'pupil-right',
      'mini-eye-inner-left', 'mini-eye-inner-right', 'mini-eye-outer-left', 'mini-eye-outer-right',
      'fang-left', 'fang-right', 'cheek-left', 'cheek-right',
      'fur-tuft-0', 'fur-tuft-1', 'fur-tuft-2',
    ]
    for (const name of expected) {
      expect(findByName(model.character, name), `${name} missing`).toBeTruthy()
    }
    model.dispose()
  })
})

describe('permanent underwear', () => {
  it('is built visible and marked permanent', () => {
    const model = buildSpiderPersonaModel()
    const underwear = model.groups.underwear
    expect(underwear.visible).toBe(true)
    expect(underwear.userData.permanent).toBe(true)
    expect(findByName(underwear, 'underwear-vest')).toBeTruthy()
    expect(findByName(underwear, 'underwear-shorts')).toBeTruthy()
    expect(PERMANENT_AVATAR_GROUPS).toContain('underwear')
    model.dispose()
  })

  it('stays visible after dressing and fully undressing every slot', () => {
    const model = buildSpiderPersonaModel()
    for (const slot of EQUIPMENT_3D_SLOTS) {
      model.applyEquipment(slot, descriptorFor(slot))
    }
    for (const slot of EQUIPMENT_3D_SLOTS) {
      model.applyEquipment(slot, null)
    }
    expect(model.groups.underwear.visible).toBe(true)
    expect(findByName(model.groups.underwear, 'underwear-vest').visible).toBe(true)
    expect(findByName(model.groups.underwear, 'underwear-shorts').visible).toBe(true)
    // Every pre-built garment is hidden — never removed from the graph.
    for (const slot of EQUIPMENT_3D_SLOTS) {
      expect(model.equipmentGroups[slot].children.length).toBe(1)
      expect(garmentOf(model, slot).visible).toBe(false)
    }
    model.dispose()
  })
})

describe('pre-built spider starter garments', () => {
  it('pre-builds exactly the four registered garments, hidden until worn', () => {
    expect(SPIDER_STARTER_GARMENT_SPECS.length).toBe(4)
    const model = buildSpiderPersonaModel()
    for (const slot of EQUIPMENT_3D_SLOTS) {
      expect(model.equipmentGroups[slot].children.length).toBe(1)
      expect(model.equipmentGroups[slot].userData.appliedAssetKey).toBeNull()
    }
    for (const spec of SPIDER_STARTER_GARMENT_SPECS) {
      const garment = garmentOf(model, spec.slot)
      expect(garment.name).toBe(getGarmentGroupName(spec.garmentKind))
      expect(garment.userData.assetKey).toBe(spec.assetKey)
      expect(garment.userData.garmentKind).toBe(spec.garmentKind)
      expect(garment.visible).toBe(false)
    }
    model.dispose()
  })

  it('contains every registered recognizable detail mesh', () => {
    const model = buildSpiderPersonaModel()
    for (const spec of SPIDER_STARTER_GARMENT_SPECS) {
      const garment = garmentOf(model, spec.slot)
      expect(spec.detailMeshes.length, `${spec.garmentKind} needs recognizable details`).toBeGreaterThanOrEqual(8)
      for (const meshName of spec.detailMeshes) {
        expect(
          garment.getObjectByName(meshName),
          `${spec.garmentKind} is missing detail mesh '${meshName}'`,
        ).toBeTruthy()
      }
    }
    model.dispose()
  })

  it('makes each garment read as its real item: zipper front, right cargo pocket, toe caps, chest web', () => {
    const model = buildSpiderPersonaModel()
    // Bomber: zipper runs down the chest front; zip pocket on the LEFT sleeve.
    expect(findByName(model.equipmentGroups.top, 'bomber-zipper-front').position.z).toBeGreaterThan(0.5)
    expect(findByName(model.equipmentGroups.top, 'bomber-sleeve-pocket-left').position.x).toBeLessThan(-0.8)
    // Cargo: the 3D pouch sits on the RIGHT thigh.
    expect(findByName(model.equipmentGroups.bottom, 'cargo-pocket-right').position.x).toBeGreaterThan(0.4)
    // High-tops: toe cap covers the front of each foot.
    expect(findByName(model.equipmentGroups.shoes, 'hightop-right-toe-cap').position.z).toBeGreaterThan(0.3)
    expect(findByName(model.equipmentGroups.shoes, 'hightop-left-toe-cap').position.z).toBeGreaterThan(0.3)
    // Web device: both halves ride the chest inside the torso subtree.
    const web = findByName(model.equipmentGroups.accessory, 'web-center-gem')
    expect(web).toBeTruthy()
    let node: any = web
    let ridesTorso = false
    while (node) {
      if (node.name === 'torso') { ridesTorso = true; break }
      node = node.parent
    }
    expect(ridesTorso).toBe(true)
    expect(findByName(model.equipmentGroups.accessory, 'comm-body')).toBeTruthy()
    model.dispose()
  })

  it('uses zero textures anywhere — garments are solid-palette procedural meshes', () => {
    const model = buildSpiderPersonaModel()
    const materials = allMaterials(model.root)
    expect(materials.size).toBeGreaterThan(10)
    for (const material of materials) {
      expect(
        (material as any).map ?? null,
        `${material.name || material.type} must not carry a texture map`,
      ).toBeNull()
    }
    model.dispose()
  })
})

describe('dressing semantics — visibility flip only', () => {
  it('dressing a slot shows exactly its garment and records the assetKey', () => {
    const model = buildSpiderPersonaModel()
    model.applyEquipment('top', descriptorFor('top'))
    expect(garmentOf(model, 'top').visible).toBe(true)
    expect(model.getAppliedAssetKey('top')).toBe('equipment/starter/spider/top/v1')
    // other slots stay untouched
    for (const slot of ['bottom', 'shoes', 'accessory'] as const) {
      expect(garmentOf(model, slot).visible).toBe(false)
      expect(model.getAppliedAssetKey(slot)).toBeNull()
    }
    model.dispose()
  })

  it('undressing hides the garment without removing it from the graph', () => {
    const model = buildSpiderPersonaModel()
    model.applyEquipment('bottom', descriptorFor('bottom'))
    const slotGroup = model.equipmentGroups.bottom
    const childrenBefore = [...slotGroup.children]
    model.applyEquipment('bottom', null)
    expect(garmentOf(model, 'bottom').visible).toBe(false)
    expect(model.getAppliedAssetKey('bottom')).toBeNull()
    expect(slotGroup.children).toEqual(childrenBefore)
    model.dispose()
  })

  it('re-dressing a slot reuses the identical pre-built garment object', () => {
    const model = buildSpiderPersonaModel()
    const garmentBefore = garmentOf(model, 'shoes')
    model.applyEquipment('shoes', descriptorFor('shoes'))
    model.applyEquipment('shoes', null)
    model.applyEquipment('shoes', descriptorFor('shoes'))
    expect(garmentOf(model, 'shoes')).toBe(garmentBefore)
    expect(model.equipmentGroups.shoes.children.length).toBe(1)
    expect(garmentBefore.visible).toBe(true)
    model.dispose()
  })

  it('dressing never changes the scene mesh count', () => {
    const model = buildSpiderPersonaModel()
    const countBefore = allMeshes(model.root).length
    for (const slot of EQUIPMENT_3D_SLOTS) {
      model.applyEquipment(slot, descriptorFor(slot))
    }
    expect(allMeshes(model.root).length).toBe(countBefore)
    for (const slot of EQUIPMENT_3D_SLOTS) {
      model.applyEquipment(slot, null)
    }
    expect(allMeshes(model.root).length).toBe(countBefore)
    model.dispose()
  })

  it('never disposes geometry or material during dress/undress cycles', () => {
    const model = buildSpiderPersonaModel()
    const { geoSpies, matSpies, geometryCount } = collectDisposableSpies(model)
    expect(geometryCount).toBeGreaterThan(30)

    for (const slot of EQUIPMENT_3D_SLOTS) {
      model.applyEquipment(slot, descriptorFor(slot))
    }
    for (const slot of EQUIPMENT_3D_SLOTS) {
      model.applyEquipment(slot, null)
    }
    model.applyEquipment('top', descriptorFor('top'))

    for (const spy of [...geoSpies, ...matSpies]) {
      expect(spy, 'runtime dress/undress must not dispose anything').not.toHaveBeenCalled()
    }
    // The single authoritative disposal at teardown still releases everything once.
    model.dispose()
    for (const spy of geoSpies) expect(spy).toHaveBeenCalledTimes(1)
    for (const spy of matSpies) expect(spy).toHaveBeenCalledTimes(1)
  })

  it('attaches the chest accessory to the torso mesh so it rides the chest', () => {
    const model = buildSpiderPersonaModel()
    model.applyEquipment('accessory', descriptorFor('accessory'))
    const accessoryGroup = model.equipmentGroups.accessory
    // parent chain must include the torso mesh
    let node: any = accessoryGroup
    let foundTorso = false
    while (node) {
      if (node.name === 'torso') { foundTorso = true; break }
      node = node.parent
    }
    expect(foundTorso).toBe(true)
    // The torso is now a slim cylinder: the scaled badge clears both the
    // permanent tank and the bomber shell without floating far off the chest.
    expect(accessoryGroup.position.z).toBeGreaterThan(0.55)
    expect(accessoryGroup.position.z).toBeLessThan(0.7)
    model.dispose()
  })

  it('wraps shoes around the feet and shorts around the hips', () => {
    const model = buildSpiderPersonaModel()
    model.applyEquipment('shoes', descriptorFor('shoes'))
    const shoeBody = findByName(model.equipmentGroups.shoes, 'hightop-left-body')
    const foot = findByName(model.groups.legs, 'foot-left')
    expect(Math.abs(shoeBody.position.x - foot.position.x)).toBeLessThan(0.05)
    expect(Math.abs(shoeBody.position.y - foot.position.y)).toBeLessThan(0.1)
    // shoe is slightly larger than the foot
    expect(shoeBody.scale.x).toBeGreaterThan(foot.scale.x)

    model.applyEquipment('bottom', descriptorFor('bottom'))
    const shorts = findByName(model.equipmentGroups.bottom, 'cargo-shorts-body')
    const hips = findByName(model.groups.body, 'hips')
    expect(shorts.position.y).toBeCloseTo(hips.position.y, 5)
    model.dispose()
  })
})

describe('yaw application', () => {
  it('applies continuous yaw to the character group', () => {
    const model = buildSpiderPersonaModel()
    model.setYaw(Math.PI / 3)
    expect(model.getYaw()).toBeCloseTo(Math.PI / 3, 10)
    model.setYaw(Math.PI * 7) // beyond two full turns — no clamping
    expect(model.getYaw()).toBeCloseTo(Math.PI * 7, 10)
    model.setYaw(Number.NaN) // guarded
    expect(model.getYaw()).toBeCloseTo(Math.PI * 7, 10)
    model.dispose()
  })
})

describe('disposeObject3D', () => {
  it('disposes every geometry and material exactly once', () => {
    const model = buildSpiderPersonaModel()
    model.applyEquipment('top', descriptorFor('top'))
    const { geoSpies, matSpies, geometryCount } = collectDisposableSpies(model)

    model.dispose()

    for (const spy of geoSpies) expect(spy).toHaveBeenCalledTimes(1)
    for (const spy of matSpies) expect(spy).toHaveBeenCalledTimes(1)
    expect(geometryCount).toBeGreaterThan(30)
  })

  it('is idempotent', () => {
    const model = buildSpiderPersonaModel()
    model.dispose()
    expect(() => model.dispose()).not.toThrow()
    expect(() => disposeObject3D(model.root)).not.toThrow()
  })
})
