import { describe, expect, it } from 'vitest';
import { MAIL_MAX_ATTACHMENTS, MAIL_POSTAGE } from '../src/sim/mail/post_office';
import { Sim } from '../src/sim/sim';
import type { Entity } from '../src/sim/types';
import { groundHeight } from '../src/sim/world';

function makeWorld() {
  return new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true });
}

function ravenpost(sim: Sim): Entity {
  for (const e of sim.entities.values()) if (e.templateId === 'the_ravenpost') return e;
  throw new Error('the Ravenpost was not spawned');
}

function standAtRavenpost(sim: Sim, pid: number) {
  const r = ravenpost(sim);
  const e = sim.entities.get(pid)!;
  e.pos.x = r.pos.x;
  e.pos.z = r.pos.z;
  e.pos.y = groundHeight(e.pos.x, e.pos.z, sim.cfg.seed);
  e.prevPos = { ...e.pos };
}

function teleport(sim: Sim, pid: number, x: number, z: number) {
  const e = sim.entities.get(pid)!;
  e.pos.x = x;
  e.pos.z = z;
  e.pos.y = groundHeight(x, z, sim.cfg.seed);
  e.prevPos = { ...e.pos };
}

function copperOf(sim: Sim, pid: number): number {
  return sim.players.get(pid)!.copper;
}

function errorsSince(sim: Sim): string[] {
  return sim.events.filter((e) => e.type === 'error').map((e) => (e as { text: string }).text);
}

describe('the Ravenpost — in-game mail', () => {
  it('spawns a single Ravenpost NPC', () => {
    const sim = makeWorld();
    const posts = [...sim.entities.values()].filter((e) => e.templateId === 'the_ravenpost');
    expect(posts.length).toBe(1);
  });

  it('requires standing at the Ravenpost to send', () => {
    const sim = makeWorld();
    const sender = sim.addPlayer('warrior', 'Sender');
    const recipient = sim.addPlayer('mage', 'Recipient');
    teleport(sim, sender, 500, 500);
    sim.players.get(sender)!.copper = 1000;
    sim.events.length = 0;

    sim.mailSend('Recipient', 'hi', 'hello', 0, [], sender);

    expect(errorsSince(sim).length).toBeGreaterThan(0);
    expect(sim.mailInfoFor(recipient)).toBeNull();
  });

  it('escrows postage and coin, delivers after the raven flight time, and lets the recipient take it', () => {
    const sim = makeWorld();
    const sender = sim.addPlayer('warrior', 'Sender');
    const recipient = sim.addPlayer('mage', 'Recipient');
    standAtRavenpost(sim, sender);
    standAtRavenpost(sim, recipient);
    sim.players.get(sender)!.copper = 1000;
    sim.events.length = 0;

    sim.mailSend('Recipient', 'Hello', 'A letter for you', 200, [], sender);

    expect(errorsSince(sim)).toEqual([]);
    expect(copperOf(sim, sender)).toBe(1000 - 200 - MAIL_POSTAGE);
    // not yet delivered: the raven is still in flight
    expect(sim.mailInfoFor(recipient)!.messages.length).toBe(0);

    // fast-forward past the delivery window
    for (let i = 0; i < 60 * 20; i++) sim.tick();

    const info = sim.mailInfoFor(recipient)!;
    expect(info.messages.length).toBe(1);
    const msg = info.messages[0];
    expect(msg.senderName).toBe('Sender');
    expect(msg.copper).toBe(200);
    expect(msg.read).toBe(false);

    sim.mailTake(msg.id, recipient);
    expect(copperOf(sim, recipient)).toBe(200);
    expect(sim.mailInfoFor(recipient)!.messages[0].copper).toBe(0);
  });

  it('refuses to send without enough coin for postage plus attachment', () => {
    const sim = makeWorld();
    const sender = sim.addPlayer('warrior', 'Sender');
    sim.addPlayer('mage', 'Recipient');
    standAtRavenpost(sim, sender);
    sim.players.get(sender)!.copper = MAIL_POSTAGE; // not enough to also attach coin
    sim.events.length = 0;

    sim.mailSend('Recipient', 'Hello', '', 1, [], sender);

    expect(errorsSince(sim).length).toBeGreaterThan(0);
    expect(copperOf(sim, sender)).toBe(MAIL_POSTAGE);
  });

  it('refuses an empty letter with no subject, body, coin, or attachments', () => {
    const sim = makeWorld();
    const sender = sim.addPlayer('warrior', 'Sender');
    sim.addPlayer('mage', 'Recipient');
    standAtRavenpost(sim, sender);
    sim.players.get(sender)!.copper = 1000;
    sim.events.length = 0;

    sim.mailSend('Recipient', '', '', 0, [], sender);

    expect(errorsSince(sim).length).toBeGreaterThan(0);
    expect(copperOf(sim, sender)).toBe(1000);
  });

  it('refuses more than the max attachment stacks and refuses mailing yourself', () => {
    const sim = makeWorld();
    const sender = sim.addPlayer('warrior', 'Sender');
    sim.addPlayer('mage', 'Recipient');
    standAtRavenpost(sim, sender);
    sim.players.get(sender)!.copper = 1000;
    sim.events.length = 0;

    const tooMany = Array.from({ length: MAIL_MAX_ATTACHMENTS + 1 }, () => ({
      itemId: 'wolf_fang',
      count: 1,
    }));
    sim.mailSend('Recipient', 'x', '', 0, tooMany, sender);
    expect(errorsSince(sim).length).toBeGreaterThan(0);

    sim.events.length = 0;
    sim.mailSend('Sender', 'x', 'y', 0, [], sender);
    expect(errorsSince(sim).length).toBeGreaterThan(0);
  });

  it('escrows item attachments out of the sender bags and delivers them on take', () => {
    const sim = makeWorld();
    const sender = sim.addPlayer('warrior', 'Sender');
    const recipient = sim.addPlayer('mage', 'Recipient');
    standAtRavenpost(sim, sender);
    standAtRavenpost(sim, recipient);
    sim.players.get(sender)!.copper = 1000;
    sim.addItem('wolf_fang', 2, sender);
    sim.events.length = 0;

    sim.mailSend('Recipient', 'Fang', '', 0, [{ itemId: 'wolf_fang', count: 2 }], sender);

    expect(errorsSince(sim)).toEqual([]);
    expect(sim.countItem('wolf_fang', sender)).toBe(0);

    for (let i = 0; i < 60 * 20; i++) sim.tick();
    const msg = sim.mailInfoFor(recipient)!.messages[0];
    sim.mailTake(msg.id, recipient);
    expect(sim.countItem('wolf_fang', recipient)).toBe(2);
  });

  it('refuses to dupe an item by splitting one held stack across duplicate attachment slots', () => {
    const sim = makeWorld();
    const sender = sim.addPlayer('warrior', 'Sender');
    const recipient = sim.addPlayer('mage', 'Recipient');
    standAtRavenpost(sim, sender);
    sim.players.get(sender)!.copper = 1000;
    sim.addItem('wolf_fang', 5, sender);
    sim.events.length = 0;

    const dupeSlots = [
      { itemId: 'wolf_fang', count: 5 },
      { itemId: 'wolf_fang', count: 5 },
      { itemId: 'wolf_fang', count: 5 },
    ];
    sim.mailSend('Recipient', 'x', '', 0, dupeSlots, sender);

    expect(errorsSince(sim).length).toBeGreaterThan(0);
    expect(sim.countItem('wolf_fang', sender)).toBe(5);
    expect(sim.mailInfoFor(recipient)).toBeNull();
  });

  it('refuses to delete a letter with unclaimed attachments, but allows it once claimed', () => {
    const sim = makeWorld();
    const sender = sim.addPlayer('warrior', 'Sender');
    const recipient = sim.addPlayer('mage', 'Recipient');
    standAtRavenpost(sim, sender);
    standAtRavenpost(sim, recipient);
    sim.players.get(sender)!.copper = 1000;
    sim.events.length = 0;

    sim.mailSend('Recipient', 'Hello', '', 50, [], sender);
    for (let i = 0; i < 60 * 20; i++) sim.tick();
    const msg = sim.mailInfoFor(recipient)!.messages[0];

    sim.events.length = 0;
    sim.mailDelete(msg.id, recipient);
    expect(errorsSince(sim).length).toBeGreaterThan(0);
    expect(sim.mailInfoFor(recipient)!.messages.length).toBe(1);

    sim.mailTake(msg.id, recipient);
    sim.mailDelete(msg.id, recipient);
    expect(sim.mailInfoFor(recipient)!.messages.length).toBe(0);
  });

  it('tracks the unread count independent of standing at the Ravenpost', () => {
    const sim = makeWorld();
    const sender = sim.addPlayer('warrior', 'Sender');
    const recipient = sim.addPlayer('mage', 'Recipient');
    standAtRavenpost(sim, sender);
    standAtRavenpost(sim, recipient);
    sim.players.get(sender)!.copper = 1000;
    sim.mailSend('Recipient', 'Hello', '', 0, [], sender);

    for (let i = 0; i < 60 * 20; i++) sim.tick();
    expect(sim.mailUnreadFor(recipient)).toBe(1);

    // walking away still reports the unread count (the HUD envelope indicator)
    teleport(sim, recipient, 500, 500);
    expect(sim.mailUnreadFor(recipient)).toBe(1);
    expect(sim.mailInfoFor(recipient)).toBeNull();

    standAtRavenpost(sim, recipient);
    const msg = sim.mailInfoFor(recipient)!.messages[0];
    sim.mailMarkRead(msg.id, recipient);
    expect(sim.mailUnreadFor(recipient)).toBe(0);
  });

  it('round-trips serializeMail/loadMail across a save boundary', () => {
    // characterId pinned (the market's stable-key convention): a fresh Sim
    // hands out entity ids from scratch, so only the DB-stable characterId
    // (not the offline entityId) survives a real save/restart boundary.
    const sim = makeWorld();
    const sender = sim.addPlayer('warrior', 'Sender', { characterId: 1 });
    sim.addPlayer('mage', 'Recipient', { characterId: 55 });
    standAtRavenpost(sim, sender);
    sim.players.get(sender)!.copper = 1000;
    sim.mailSend('Recipient', 'Hello', 'body text', 75, [], sender);

    const save = sim.serializeMail();
    expect(save.mail.length).toBe(1);

    const sim2 = makeWorld();
    sim2.loadMail(save);
    const recipient2 = sim2.addPlayer('mage', 'Recipient', { characterId: 55 });
    standAtRavenpost(sim2, recipient2);
    for (let i = 0; i < 60 * 20; i++) sim2.tick();
    const info = sim2.mailInfoFor(recipient2)!;
    expect(info.messages.length).toBe(1);
    expect(info.messages[0].copper).toBe(75);
    expect(info.messages[0].subject).toBe('Hello');
  });

  it('rekeys mail addressed to an old name after a character rename', () => {
    const sim = makeWorld();
    const sender = sim.addPlayer('warrior', 'Sender');
    const recipient = sim.addPlayer('mage', 'OldName');
    standAtRavenpost(sim, sender);
    sim.players.get(sender)!.copper = 1000;
    sim.mailSend('OldName', 'Hello', '', 0, [], sender);

    const rekeyed = sim.rekeyMailRecipient(recipient, 'OldName', 'NewName');
    expect(rekeyed).toBe(true);

    sim.players.get(recipient)!.name = 'NewName';
    sim.entities.get(recipient)!.name = 'NewName';
    standAtRavenpost(sim, recipient);
    for (let i = 0; i < 60 * 20; i++) sim.tick();
    expect(sim.mailInfoFor(recipient)!.messages.length).toBe(1);
  });
});
