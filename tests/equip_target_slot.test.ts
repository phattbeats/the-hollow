import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/sim/data';
import { slotAcceptsItem } from '../src/sim/equipment_rules';
import { Sim } from '../src/sim/sim';

describe('aimed paperdoll equip', () => {
  it('accepts only the item declared slot', () => {
    const helm = ITEMS.cryptbone_helm;
    expect(slotAcceptsItem(helm, 'helmet')).toBe(true);
    expect(slotAcceptsItem(helm, 'chest')).toBe(false);
    expect(slotAcceptsItem(ITEMS.minor_healing_potion, 'chest')).toBe(false);
  });

  it('refuses a forged wrong slot without moving or consuming the item', () => {
    const sim = new Sim({ seed: 11, playerClass: 'warrior', noPlayer: true });
    const pid = sim.addPlayer('warrior', 'Aimer');
    sim.setPlayerLevel(20, pid);
    sim.addItem('cryptbone_helm', 1, pid);

    sim.equipItemToSlot('cryptbone_helm', 'chest', pid);

    const equipment = (sim as unknown as { players: Map<number, { equipment: Record<string, string> }> })
      .players.get(pid)!.equipment;
    expect(equipment.chest).toBe('recruit_tunic');
    expect(equipment.helmet).toBeUndefined();
    expect(sim.countItem('cryptbone_helm', pid)).toBe(1);
    expect(sim.drainEvents()).toContainEqual({
      type: 'error',
      pid,
      text: 'You cannot equip that.',
    } as never);
  });

  it('equips into the aimed valid slot and sends the additive wire field', async () => {
    const sim = new Sim({ seed: 11, playerClass: 'warrior', noPlayer: true });
    const pid = sim.addPlayer('warrior', 'Aimer');
    sim.setPlayerLevel(20, pid);
    sim.addItem('cryptbone_helm', 1, pid);
    sim.equipItemToSlot('cryptbone_helm', 'helmet', pid);
    expect(
      (sim as unknown as { players: Map<number, { equipment: Record<string, string> }> }).players.get(
        pid,
      )!.equipment.helmet,
    ).toBe('cryptbone_helm');

    const { ClientWorld } = await import('../src/net/online');
    const world = Object.create(ClientWorld.prototype) as { cmd: (payload: unknown) => void };
    const sent: unknown[] = [];
    world.cmd = (payload) => sent.push(payload);
    ClientWorld.prototype.equipItemToSlot.call(world, 'cryptbone_helm', 'helmet');
    expect(sent).toEqual([{ cmd: 'equip', item: 'cryptbone_helm', slot: 'helmet' }]);
  });
});