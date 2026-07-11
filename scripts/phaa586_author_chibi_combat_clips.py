# PHAA-586: author chibi combat clips (cast, 2 melee swings, ranged shoot,
# hit-react) directly as glTF animation data on the shared 78-joint Rigify DEF
# rig, and splice them into every chibi_female*.glb. Pure stdlib; no Blender.
#
# The rig ships only locomotion clips, so combat poses are keyed procedurally:
# full-body tracks start from the anim_iddle frame-0 pose (so unanimated limbs
# hold a natural stance instead of freezing mid-step during a crossfade), and
# gesture bones get world-axis rotation deltas layered on top via FK.
#
# Usage: python3 scripts/phaa586_author_chibi_combat_clips.py
# (run from repo root; rewrites public/models/chars/players/chibi_female*.glb)
import json
import math
import struct
import sys
from pathlib import Path

PLAYERS = Path('public/models/chars/players')
SOURCE = PLAYERS / 'chibi_female_basemesh.glb'
TARGETS = sorted(PLAYERS.glob('chibi_female*.glb'))

CT = {5126: ('f', 4), 5123: ('H', 2), 5125: ('I', 4)}
NCOMP = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def read_glb(path):
  d = path.read_bytes()
  magic, _ver, total = struct.unpack('<III', d[:12])
  assert magic == 0x46546C67 and total == len(d), path
  jlen, jtype = struct.unpack('<II', d[12:20])
  assert jtype == 0x4E4F534A
  gltf = json.loads(d[20:20 + jlen])
  off = 20 + jlen
  blen, btype = struct.unpack('<II', d[off:off + 8])
  assert btype == 0x004E4942
  bin_ = d[off + 8:off + 8 + blen]
  return gltf, bytearray(bin_)


def write_glb(path, gltf, bin_):
  jb = json.dumps(gltf, separators=(',', ':')).encode()
  jb += b' ' * (-len(jb) % 4)
  bb = bytes(bin_) + b'\x00' * (-len(bin_) % 4)
  total = 12 + 8 + len(jb) + 8 + len(bb)
  out = struct.pack('<III', 0x46546C67, 2, total)
  out += struct.pack('<II', len(jb), 0x4E4F534A) + jb
  out += struct.pack('<II', len(bb), 0x004E4942) + bb
  path.write_bytes(out)


def acc_read(gltf, bin_, idx):
  a = gltf['accessors'][idx]
  bv = gltf['bufferViews'][a['bufferView']]
  fmt, size = CT[a['componentType']]
  n = NCOMP[a['type']]
  off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
  stride = bv.get('byteStride', size * n)
  out = []
  for i in range(a['count']):
    o = off + i * stride
    out.append(struct.unpack_from('<' + fmt * n, bin_, o))
  return out


# --- tiny quaternion lib (x, y, z, w, glTF order) --------------------------
def qmul(a, b):
  ax, ay, az, aw = a
  bx, by, bz, bw = b
  return (
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  )


def qinv(q):
  return (-q[0], -q[1], -q[2], q[3])


def qnorm(q):
  m = math.sqrt(sum(c * c for c in q)) or 1.0
  return tuple(c / m for c in q)


def axis_angle(axis, deg):
  m = math.sqrt(sum(c * c for c in axis)) or 1.0
  h = math.radians(deg) / 2
  s = math.sin(h) / m
  return (axis[0] * s, axis[1] * s, axis[2] * s, math.cos(h))


def qrot(q, v):
  # rotate vector v by quaternion q
  x, y, z, w = q
  ux, uy, uz = x, y, z
  cx = uy * v[2] - uz * v[1]
  cy = uz * v[0] - ux * v[2]
  cz = ux * v[1] - uy * v[0]
  ccx = uy * cz - uz * cy
  ccy = uz * cx - ux * cz
  ccz = ux * cy - uy * cx
  return (
    v[0] + 2 * (w * cx + ccx),
    v[1] + 2 * (w * cy + ccy),
    v[2] + 2 * (w * cz + ccz),
  )


# --- rig model ---------------------------------------------------------------
class Rig:
  def __init__(self, gltf, bin_):
    self.nodes = gltf['nodes']
    skin = gltf['skins'][0]
    self.joints = skin['joints']
    self.names = [self.nodes[i].get('name', str(i)) for i in self.joints]
    self.by_name = dict(zip(self.names, self.joints))
    self.parent = {}
    for ni, n in enumerate(self.nodes):
      for c in n.get('children', []):
        self.parent[c] = ni
    # base pose: idle frame 0 (fall back to node TRS)
    anims = gltf['animations']
    idle = next(a for a in anims if a['name'] == 'anim_iddle')
    self.base_t, self.base_r, self.base_s = {}, {}, {}
    for ch in idle['channels']:
      tgt = ch['target']
      node = tgt['node']
      samp = idle['samplers'][ch['sampler']]
      vals = acc_read(gltf, bin_, samp['output'])
      p = tgt['path']
      if p == 'rotation':
        self.base_r[node] = qnorm(vals[0])
      elif p == 'translation':
        self.base_t[node] = vals[0]
      elif p == 'scale':
        self.base_s[node] = vals[0]
    for j in self.joints:
      n = self.nodes[j]
      self.base_t.setdefault(j, tuple(n.get('translation', (0, 0, 0))))
      self.base_r.setdefault(j, qnorm(tuple(n.get('rotation', (0, 0, 0, 1)))))
      self.base_s.setdefault(j, tuple(n.get('scale', (1, 1, 1))))

  def world(self, pose_r):
    # world rotation + position per joint given local rotations pose_r
    wr, wp = {}, {}
    def solve(ni):
      if ni in wr:
        return
      p = self.parent.get(ni)
      lr = pose_r.get(ni, self.base_r.get(ni, (0, 0, 0, 1)))
      lt = self.base_t.get(ni, tuple(self.nodes[ni].get('translation', (0, 0, 0))))
      if p is None:
        pr, pp = (0, 0, 0, 1), (0, 0, 0)
      else:
        solve(p)
        pr, pp = wr[p], wp[p]
      off = qrot(pr, lt)
      wr[ni] = qnorm(qmul(pr, lr))
      wp[ni] = (pp[0] + off[0], pp[1] + off[1], pp[2] + off[2])
    for j in self.joints:
      solve(j)
    return wr, wp


class Pose:
  """One keyframe: base pose + world-axis rotation deltas applied in FK order."""

  def __init__(self, rig):
    self.rig = rig
    self.local = dict(rig.base_r)

  def rot(self, bone, axis, deg):
    ni = self.rig.by_name[bone]
    wr, _ = self.rig.world(self.local)
    p = self.rig.parent.get(ni)
    pr = wr[p] if p is not None else (0, 0, 0, 1)
    delta = axis_angle(axis, deg)
    new_world = qmul(delta, wr[ni])
    self.local[ni] = qnorm(qmul(qinv(pr), new_world))
    return self


def main():
  gltf, bin_ = read_glb(SOURCE)
  rig = Rig(gltf, bin_)

  # rig axes from the rest skeleton (empirical, not assumed): forward = the way
  # the toes point; up = +Y or +Z, whichever separates head from foot.
  _, wp = rig.world({})
  head = wp[rig.by_name['DEF-spine.006']]
  foot = wp[rig.by_name['DEF-foot.L']]
  toe = wp[rig.by_name['DEF-toe.L']]
  handL = wp[rig.by_name['DEF-hand.L']]
  handR = wp[rig.by_name['DEF-hand.R']]
  up_axis = max(range(3), key=lambda i: abs(head[i] - foot[i]))
  UP = [0.0, 0.0, 0.0]
  UP[up_axis] = 1.0 if head[up_axis] > foot[up_axis] else -1.0
  fwd = [toe[i] - foot[i] for i in range(3)]
  fwd[up_axis] = 0.0
  m = math.sqrt(sum(c * c for c in fwd)) or 1.0
  FWD = [c / m for c in fwd]
  # RIGHT = FWD x UP (right-handed; sign checked against the actual hand bones)
  RIGHT = [
    FWD[1] * UP[2] - FWD[2] * UP[1],
    FWD[2] * UP[0] - FWD[0] * UP[2],
    FWD[0] * UP[1] - FWD[1] * UP[0],
  ]
  lr = [handR[i] - handL[i] for i in range(3)]
  if sum(RIGHT[i] * lr[i] for i in range(3)) < 0:
    RIGHT = [-c for c in RIGHT]
  print('axes  UP', UP, ' FWD', [round(c, 2) for c in FWD], ' RIGHT', [round(c, 2) for c in RIGHT])

  def P():
    return Pose(rig)

  # calibrate rotation signs empirically: probe a small rotation and observe
  # which way the end effector actually moves, so pose verbs read as intended
  # regardless of how the rig's rest orientation is authored.
  dot = lambda a, b: sum(a[i] * b[i] for i in range(3))
  sub = lambda a, b: [a[i] - b[i] for i in range(3)]

  def probe(bone, axis, effector):
    p0 = Pose(rig)
    _, w0 = rig.world(p0.local)
    p1 = Pose(rig).rot(bone, axis, 10)
    _, w1 = rig.world(p1.local)
    return sub(w1[rig.by_name[effector]], w0[rig.by_name[effector]])

  # +pitch must lift the hand forward and up
  d = probe('DEF-upper_arm.R', RIGHT, 'DEF-hand.R')
  PITCH = 1.0 if (dot(d, FWD) + dot(d, UP)) > 0 else -1.0
  # +out must move the right hand outward (along +RIGHT)
  d = probe('DEF-upper_arm.R', FWD, 'DEF-hand.R')
  OUT_R = 1.0 if dot(d, RIGHT) > 0 else -1.0
  # +lean must move the head forward
  d = probe('DEF-spine.001', RIGHT, 'DEF-spine.006')
  LEAN = 1.0 if dot(d, FWD) > 0 else -1.0
  print('signs  PITCH', PITCH, ' OUT_R', OUT_R, ' LEAN', LEAN)

  ARM_R = ['DEF-shoulder.R', 'DEF-upper_arm.R', 'DEF-upper_arm.R.001',
           'DEF-forearm.R', 'DEF-forearm.R.001', 'DEF-hand.R']
  ARM_L = ['DEF-shoulder.L', 'DEF-upper_arm.L', 'DEF-upper_arm.L.001',
           'DEF-forearm.L', 'DEF-forearm.L.001', 'DEF-hand.L']
  SPINE = ['DEF-spine.001', 'DEF-spine.002', 'DEF-spine.003']
  HEAD = ['DEF-spine.004', 'DEF-spine.005', 'DEF-spine.006']

  def raise_arm(pose, side, fwd_deg, out_deg=0.0, elbow_deg=0.0):
    # rotate the whole arm chain about the shoulder: pitch forward/up around
    # RIGHT axis (negative lifts the arm forward given arms rest downward),
    # swing outward around FWD, then bend the elbow further around RIGHT.
    ua, uat, fa, fat, hand = (
      ('DEF-upper_arm.R', 'DEF-upper_arm.R.001', 'DEF-forearm.R', 'DEF-forearm.R.001', 'DEF-hand.R')
      if side == 'R' else
      ('DEF-upper_arm.L', 'DEF-upper_arm.L.001', 'DEF-forearm.L', 'DEF-forearm.L.001', 'DEF-hand.L')
    )
    sign = 1.0 if side == 'R' else -1.0
    pose.rot(ua, RIGHT, PITCH * fwd_deg)
    if out_deg:
      pose.rot(ua, FWD, OUT_R * sign * out_deg)
    if elbow_deg:
      pose.rot(fa, RIGHT, PITCH * elbow_deg)
    return pose

  def lean(pose, deg):  # + = lean forward
    for b in SPINE:
      pose.rot(b, RIGHT, LEAN * deg / len(SPINE))
    return pose

  def twist(pose, deg):  # + = twist toward the right
    for b in SPINE:
      pose.rot(b, UP, -deg / len(SPINE))
    return pose

  def head_tilt(pose, deg):
    for b in HEAD:
      pose.rot(b, RIGHT, LEAN * deg / len(HEAD))
    return pose

  clips = {}

  # 1. anim_cast: looping two-handed channel, hands weaving in front (chibi:
  #    big raise, bouncy wobble). Loop-safe: last key == first key.
  base_cast = lambda: lean(
    raise_arm(raise_arm(P(), 'R', 65, 12, 55), 'L', 65, 12, 55), -6)
  k0 = base_cast()
  k1 = base_cast()
  raise_arm(k1, 'R', 12, 0, -8)
  raise_arm(k1, 'L', -8, 6, 8)
  head_tilt(k1, -4)
  k2 = base_cast()
  raise_arm(k2, 'R', -8, 6, 8)
  raise_arm(k2, 'L', 12, 0, -8)
  head_tilt(k2, 4)
  clips['anim_cast'] = [(0.0, k0), (0.3, k1), (0.6, k0), (0.9, k2), (1.2, k0)]

  # 2. anim_castshoot: one-shot release, both hands thrust forward.
  w = lean(raise_arm(raise_arm(P(), 'R', 95, 10, 70), 'L', 95, 10, 70), -12)
  r = lean(raise_arm(raise_arm(P(), 'R', 80, 4, 5), 'L', 80, 4, 5), 14)
  head_tilt(r, 6)
  clips['anim_castshoot'] = [(0.0, P()), (0.18, w), (0.34, r), (0.7, P())]

  # 3. anim_attack_chop: overhead right-arm slam (warrior/paladin).
  w = head_tilt(lean(twist(raise_arm(P(), 'R', 165, 18, 30), 18), -14), -8)
  s = head_tilt(lean(twist(raise_arm(P(), 'R', 55, 6, 10), -14), 22), 10)
  clips['anim_attack_chop'] = [(0.0, P()), (0.2, w), (0.34, s), (0.65, P())]

  # 4. anim_attack_slash: horizontal cross-body swing (rogue flavor).
  w = lean(twist(raise_arm(P(), 'R', 85, 55, 25), 30), -6)
  s = lean(twist(raise_arm(P(), 'R', 80, -35, 5), -28), 10)
  clips['anim_attack_slash'] = [(0.0, P()), (0.18, w), (0.32, s), (0.6, P())]

  # 5. anim_shoot: bow draw and release (hunter): left arm extended, right
  #    hand drawn back to the cheek, then snapped forward.
  aim = twist(raise_arm(raise_arm(P(), 'L', 85, 8, 5), 'R', 70, -20, 95), -22)
  rel = twist(raise_arm(raise_arm(P(), 'L', 85, 8, 5), 'R', 78, -6, 30), -18)
  clips['anim_shoot'] = [(0.0, P()), (0.28, aim), (0.42, rel), (0.75, P())]

  # 6. anim_hit: flinch back, shoulders up, head snap.
  f = head_tilt(lean(P(), -16), -18)
  f.rot('DEF-shoulder.L', UP, 8).rot('DEF-shoulder.R', UP, -8)
  raise_arm(f, 'R', 25, 20, 30)
  raise_arm(f, 'L', 25, 20, 30)
  clips['anim_hit'] = [(0.0, P()), (0.1, f), (0.45, P())]

  # --- numeric sanity: gesture actually moves the hands where intended ------
  _, rest = rig.world({})
  _, castp = rig.world(clips['anim_cast'][0][1].local)
  hR, sR = rig.by_name['DEF-hand.R'], rig.by_name['DEF-upper_arm.R']
  rest_fwd = dot(sub(rest[hR], rest[sR]), FWD)
  cast_fwd = dot(sub(castp[hR], castp[sR]), FWD)
  print(f'hand.R forward of shoulder: rest {rest_fwd:.3f} -> cast {cast_fwd:.3f}')
  assert cast_fwd > rest_fwd + 0.1, 'cast pose failed to bring hands forward'
  _, chopw = rig.world(clips['anim_attack_chop'][1][1].local)
  print(f'hand.R height: rest {rest[hR][1]:.3f} -> chop windup {chopw[hR][1]:.3f} (head {head[1]:.3f})')
  assert chopw[hR][1] > rest[hR][1] + 0.2, 'chop windup failed to raise the hand'

  # --- bake each clip into every target GLB ---------------------------------
  for target in TARGETS:
    g, b = read_glb(target)
    existing = {a['name'] for a in g.get('animations', [])}
    node_of = {}
    for j in g['skins'][0]['joints']:
      node_of[g['nodes'][j].get('name', '')] = j
    missing = [n for n in rig.names if n not in node_of]
    assert not missing, f'{target}: rig mismatch, missing {missing[:3]}'
    added = []
    for cname, keys in clips.items():
      if cname in existing:
        continue
      times = [t for t, _ in keys]
      anim = {'name': cname, 'channels': [], 'samplers': []}

      def push_accessor(vals, atype, amin=None, amax=None):
        n = NCOMP[atype]
        while len(b) % 4:
          b.append(0)
        off = len(b)
        for v in vals:
          b.extend(struct.pack('<' + 'f' * n, *v))
        g['bufferViews'].append({'buffer': 0, 'byteOffset': off, 'byteLength': len(vals) * n * 4})
        acc = {'bufferView': len(g['bufferViews']) - 1, 'componentType': 5126,
               'count': len(vals), 'type': atype}
        if amin is not None:
          acc['min'], acc['max'] = amin, amax
        g['accessors'].append(acc)
        return len(g['accessors']) - 1

      t_acc = push_accessor([(t,) for t in times], 'SCALAR', [times[0]], [times[-1]])
      t2_acc = push_accessor([(times[0],), (times[-1],)], 'SCALAR', [times[0]], [times[-1]])
      for name in rig.names:
        ji = rig.by_name[name]
        tgt = node_of[name]
        # rotation: keyed; keep quaternion sign-continuous for LERP
        quats = []
        prev = None
        for _t, pose in keys:
          q = pose.local.get(ji, rig.base_r[ji])
          if prev is not None and dot4(q, prev) < 0:
            q = tuple(-c for c in q)
          quats.append(q)
          prev = q
        r_acc = push_accessor(quats, 'VEC4')
        anim['samplers'].append({'input': t_acc, 'output': r_acc, 'interpolation': 'LINEAR'})
        anim['channels'].append({'sampler': len(anim['samplers']) - 1,
                                 'target': {'node': tgt, 'path': 'rotation'}})
        # translation + scale: static 2-key tracks pinning the idle base pose
        tr = rig.base_t[ji]
        s_acc = push_accessor([tr, tr], 'VEC3')
        anim['samplers'].append({'input': t2_acc, 'output': s_acc, 'interpolation': 'LINEAR'})
        anim['channels'].append({'sampler': len(anim['samplers']) - 1,
                                 'target': {'node': tgt, 'path': 'translation'}})
        sc = rig.base_s[ji]
        sc_acc = push_accessor([sc, sc], 'VEC3')
        anim['samplers'].append({'input': t2_acc, 'output': sc_acc, 'interpolation': 'LINEAR'})
        anim['channels'].append({'sampler': len(anim['samplers']) - 1,
                                 'target': {'node': tgt, 'path': 'scale'}})
      g.setdefault('animations', []).append(anim)
      added.append(cname)
    g['buffers'][0]['byteLength'] = len(b) + (-len(b) % 4)
    write_glb(target, g, b)
    print(f'{target.name}: +{added}')


def dot4(a, b):
  return sum(a[i] * b[i] for i in range(4))


if __name__ == '__main__':
  sys.exit(main())
