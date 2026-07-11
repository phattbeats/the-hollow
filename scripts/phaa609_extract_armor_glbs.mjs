// PHAA-502 T2b armor mesh authoring.
//
// The KayKit Rig_Medium Knight GLB ships every armor accessory as a skinned
// mesh on the shared rig: Knight_Helmet + Knight_HelmetVisor (the plate
// helm), Knight_Cape (the chest cape), Knight_LegLeft + Knight_LegRight
// (the leg plates). Each is a separate skinned mesh on its own skin joint
// list that points back at the same Rig_Medium armature, so a stand-alone
// armor GLB is just a re-export with the rest of the body stripped.
//
// T2b sources these from the already-licensed-and-vendored KayKit Rig_Medium
// Knight pack (CC0, credited in CREDITS.md) and re-exports them as separate
// GLBs under public/models/armor/. This is the "asset-search hit from a
// pack already in the tree" path of the dual-track plan: nothing new is
// downloaded, nothing is paid, and the GLB the player model carries is the
// literal KayKit geometry normalized through this extraction pass (the
// shared rig stays intact, attach-points line up via the existing
// `head` / `chest` / `upperleg.*` bones, the GLB is re-encoded through
// @gltf-transform/extensions which transparently handles the source's
// EXT_meshopt_compression encoding). No Blender session is needed: the
// meshopt decoding happens inside @gltf-transform on read, the re-export
// re-encodes it for the loader to consume at runtime.
//
// Outputs:
//   public/models/armor/helm_plate.glb    (Knight_Helmet + Knight_HelmetVisor)
//   public/models/armor/chest_cape.glb    (Knight_Cape)
//   public/models/armor/legs_plate.glb    (Knight_LegLeft + Knight_LegRight)
//
// Idempotent: re-running overwrites with deterministic output.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

// Script lives at <root>/scripts/phaa609_extract_armor_glbs.mjs, so the
// repo root is one `..` up from the script's directory.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'public/models/chars/players/knight.glb');
const OUT_DIR = path.join(ROOT, 'public/models/armor');
fs.mkdirSync(OUT_DIR, { recursive: true });

// @gltf-transform needs the meshopt decoder registered to read source files
// that use EXT_meshopt_compression (the KayKit build does). The shared repo
// build_assets.mjs already pulls in meshoptimizer; we inline the decoder
// registration here so this script is self-contained.
let MeshoptDecoder;
try {
  ({ MeshoptDecoder } = await import('meshoptimizer'));
} catch {
  // meshoptimizer not available: fall through. The script will fail at
  // read() time if the source is meshopt-compressed, which is a loud
  // signal to install the dep.
}

async function extract(meshNames, outPath) {
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

  const doc = await io.read(SRC);
  const root = doc.getRoot();

  const keepMeshes = root.listMeshes().filter((m) => meshNames.includes(m.getName()));
  if (keepMeshes.length === 0) {
    throw new Error(`no meshes matched ${meshNames.join(', ')} in ${SRC}`);
  }
  if (keepMeshes.length !== meshNames.length) {
    const found = keepMeshes.map((m) => m.getName());
    const missing = meshNames.filter((n) => !found.includes(n));
    throw new Error(`missing source meshes: ${missing.join(', ')}`);
  }

  // 1. Collect every skin that drives a kept mesh (the kept meshes each own
  //    one skin, and every skin on the rig shares the same 23-bone joint
  //    list, so dropping all the unused skins keeps the rig happy without
  //    breaking attachment at `head` / `chest` / `upperleg.*`).
  const keepSkinIds = new Set();
  for (const mesh of keepMeshes) {
    for (const node of root.listNodes()) {
      const meshRef = node.getMesh();
      if (meshRef === mesh) {
        const skin = node.getSkin();
        if (skin) keepSkinIds.add(skin);
      }
    }
  }

  // 2. Build a fresh scene that contains only the kept meshes' owning nodes
  //    (the skinned mesh nodes) plus the entire rig skeleton (every joint
  //    they reference). Walking `skin.listJoints()` covers the bones the
  //    extracted mesh needs to deform against.
  const keepJoints = new Set();
  for (const skin of keepSkinIds) {
    for (const joint of skin.listJoints()) keepJoints.add(joint);
  }
  const keepMeshNodes = new Set();
  for (const node of root.listNodes()) {
    if (keepMeshes.includes(node.getMesh())) keepMeshNodes.add(node);
  }

  // 3. Build the output document. The skinned-mesh nodes are reparented
  //    under a fresh rig root that carries the original root bone so the
  //    glTF scene graph matches a standard "skinned mesh + skeleton" tree.
  //    We drop every other node and prune unused textures/materials.
  //
  //    Easiest path: create a new document, copy the kept meshes + their
  //    skins + their owning nodes + the bones they reference, then dispose
  //    the source document.
  const out = new (await import('@gltf-transform/core')).Document();
  const outIO = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  // Every accessor needs to live in a buffer; create one on the new doc.
  out.createBuffer();

  // Buffer in a temp scene graph: we copy references directly. The buffer
  // table itself is created implicitly by the writes.
  const nodeMap = new Map();
  for (const joint of keepJoints) {
    const name = joint.getName();
    const t = joint.getTranslation();
    const r = joint.getRotation();
    const s = joint.getScale();
    const n = out.createNode(name)
      .setTranslation(t)
      .setRotation(r)
      .setScale(s);
    nodeMap.set(joint, n);
  }
  // rebuild joint hierarchy from the source skin joints
  for (const joint of keepJoints) {
    const outNode = nodeMap.get(joint);
    for (const child of joint.listChildren()) {
      if (nodeMap.has(child)) outNode.addChild(nodeMap.get(child));
    }
  }

  // duplicate materials + textures used by the kept meshes.
  // Texture.setImage() takes the raw Uint8Array of the image bytes
  // (image/jpeg, image/png, image/webp, etc.); mimeType + size are set
  // separately on the new Texture.
  const matMap = new Map();
  const texMap = new Map();
  for (const mesh of keepMeshes) {
    for (const prim of mesh.listPrimitives()) {
      const srcMat = prim.getMaterial();
      if (!srcMat || matMap.has(srcMat)) continue;
      const m = out.createMaterial(srcMat.getName() || 'knight')
        .setDoubleSided(srcMat.getDoubleSided());
      if (srcMat.getBaseColorFactor()) {
        m.setBaseColorFactor(srcMat.getBaseColorFactor());
      }
      if (srcMat.getRoughnessFactor() != null) m.setRoughnessFactor(srcMat.getRoughnessFactor());
      if (srcMat.getMetallicFactor() != null) m.setMetallicFactor(srcMat.getMetallicFactor());
      const base = srcMat.getBaseColorTexture();
      if (base) {
        let newTex = texMap.get(base);
        if (!newTex) {
          const imgBytes = base.getImage();
          const mime = base.getMimeType() || 'image/webp';
          const size = base.getSize();
          newTex = out.createTexture().setName(base.getName() || 'knight_texture');
          newTex.setImage(imgBytes).setMimeType(mime);
          // size is read from the Uint8Array's byteLength at write time;
          // no explicit setSize on Texture in this version of @gltf-transform.
          texMap.set(base, newTex);
        }
        m.setBaseColorTexture(newTex);
      }
      matMap.set(srcMat, m);
    }
  }

  // duplicate skins + their IBM accessors. The IBM accessor cannot be moved
  // across documents (the property-graph edge is bound to the source doc);
  // create a fresh accessor in the new doc and copy the typed-array bytes.
  const skinMap = new Map();
  for (const skin of keepSkinIds) {
    const outSkin = out.createSkin(skin.getName() || 'Rig_Medium');
    for (const joint of skin.listJoints()) {
      outSkin.addJoint(nodeMap.get(joint));
    }
    const srcIbm = skin.getInverseBindMatrices();
    if (srcIbm) {
      const srcArr = srcIbm.getArray(); // Float32Array, 16 floats per MAT4
      const dstAcc = out
        .createAccessor(srcIbm.getName() || 'ibm')
        .setType('MAT4')
        .setArray(srcArr.slice());
      outSkin.setInverseBindMatrices(dstAcc);
    }
    skinMap.set(skin, outSkin);
  }

  // duplicate the kept meshes (with their primitives). Primitive attribute
  // and indices accessors also can't cross documents: read their typed
  // arrays out and write them into fresh accessors on the new document.
  const meshMap = new Map();
  function cloneAccessor(srcAcc) {
    const dst = out.createAccessor(srcAcc.getName() || '');
    if (srcAcc.getType()) dst.setType(srcAcc.getType());
    const arr = srcAcc.getArray();
    if (arr) dst.setArray(arr.slice());
    return dst;
  }
  for (const mesh of keepMeshes) {
    const outMesh = out.createMesh(mesh.getName() || 'armor');
    for (const prim of mesh.listPrimitives()) {
      const outPrim = out.createPrimitive();
      if (prim.getIndices()) outPrim.setIndices(cloneAccessor(prim.getIndices()));
      for (const sem of prim.listSemantics()) {
        outPrim.setAttribute(sem, cloneAccessor(prim.getAttribute(sem)));
      }
      const srcMat = prim.getMaterial();
      if (srcMat) outPrim.setMaterial(matMap.get(srcMat));
      outMesh.addPrimitive(outPrim);
    }
    meshMap.set(mesh, outMesh);
  }

  // duplicate the skinned-mesh nodes (parented to the corresponding bone)
  for (const node of keepMeshNodes) {
    const outNode = out.createNode(node.getName() || 'skinned')
      .setTranslation(node.getTranslation() || [0, 0, 0])
      .setRotation(node.getRotation() || [0, 0, 0, 1])
      .setScale(node.getScale() || [1, 1, 1]);
    outNode.setMesh(meshMap.get(node.getMesh()));
    const skin = node.getSkin();
    if (skin) outNode.setSkin(skinMap.get(skin));
    // attach under the bone that owns this mesh in the original rig
    // (Rig_Medium groups every skinned mesh as a child of the rig root
    // bone, not under the joint they deform against, so we mirror that).
    const rootBone = nodeMap.get(
      skin && skin.listJoints()[0], // first joint = rig root in this pack
    );
    if (rootBone) rootBone.addChild(outNode);
    else {
      // fallback: hang under any joint to keep it in the scene graph
      const anyJoint = [...keepJoints][0];
      if (anyJoint) nodeMap.get(anyJoint).addChild(outNode);
    }
  }

  // scene root contains every joint (no extra root node; the loader treats
  // the joint list as the scene's transform hierarchy).
  const scene = out.createScene('Scene');
  for (const joint of keepJoints) scene.addChild(nodeMap.get(joint));

  // Annotate the asset block with the source pack + mesh provenance so a
  // later audit can trace these GLBs back to the KayKit Knight rig.
  const asset = out.getRoot().getAsset();
  asset.generator = 'phaa609_extract_armor_glbs.mjs';
  asset.copyright = 'KayKit Rig_Medium Knight (CC0, see CREDITS.md)';
  asset.extras = {
    ...(asset.extras || {}),
    phaa609: {
      source: 'public/models/chars/players/knight.glb',
      sourceMeshes: meshNames,
      extractedAt: new Date().toISOString().slice(0, 10),
    },
  };

  await outIO.write(outPath, out);

  // stats
  const outRoot = out.getRoot();
  const stat = fs.statSync(outPath);
  const meshCount = outRoot.listMeshes().length;
  const skinCount = outRoot.listSkins().length;
  const nodeCount = outRoot.listNodes().length;
  console.log(
    `wrote ${path.relative(ROOT, outPath)} (${stat.size} bytes, ` +
      `${meshCount} mesh(es), ${skinCount} skin(s), ${nodeCount} node(s))`,
  );
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`missing source: ${SRC}`);
    process.exit(1);
  }
  await extract(['Knight_Helmet', 'Knight_HelmetVisor'], path.join(OUT_DIR, 'helm_plate.glb'));
  await extract(['Knight_Cape'], path.join(OUT_DIR, 'chest_cape.glb'));
  await extract(['Knight_LegLeft', 'Knight_LegRight'], path.join(OUT_DIR, 'legs_plate.glb'));
}

main().catch((e) => {
  console.error(e.stack || e.message || e);
  process.exit(1);
});
