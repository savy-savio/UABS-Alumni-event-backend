import { before, after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { EventModel, ParticipantCategoryModel, ParticipantModel, AdministratorModel, AttendanceModel, InvitationModel, ActivityLogModel } from '../src/models';

let mongo: MongoMemoryServer;
let eventA: mongoose.Types.ObjectId;
let eventB: mongoose.Types.ObjectId;
let category: mongoose.Types.ObjectId;

const makeEvent = (slug: string) => new EventModel({ name: 'Test Event', slug, eventDate: new Date('2027-01-01'), venue: 'Main Hall', address: 'Abuja', city: 'Abuja', country: 'Nigeria' });
const makeParticipant = (eventId: mongoose.Types.ObjectId, email = 'person@example.com', registrationId = `REG-${Math.random().toString(36).slice(2, 10)}`) => new ParticipantModel({
  fullName: 'Test Person', email, phone: '+2348012345678', eventId, categoryId: category, registrationId,
});

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([EventModel.init(), ParticipantCategoryModel.init(), ParticipantModel.init(), AdministratorModel.init(), AttendanceModel.init(), InvitationModel.init(), ActivityLogModel.init()]);
});
after(async () => { await mongoose.disconnect(); await mongo.stop(); });
beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})));
  const a = await makeEvent('test-event-a').save();
  const b = await makeEvent('test-event-b').save();
  eventA = a._id; eventB = b._id;
  const cat = await new ParticipantCategoryModel({ eventId: eventA, name: 'Guests' }).save();
  category = cat._id;
});

describe('Mongoose models and database constraints', () => {
  it('creates a valid event and rejects invalid event dates', async () => {
    assert.ok((await makeEvent('valid-event').save())._id);
    const invalid = makeEvent('invalid-event');
    invalid.endDate = new Date('2026-01-01');
    await assert.rejects(invalid.validate());
  });
  it('requires participant fields and validates email', async () => {
    await assert.rejects(new ParticipantModel({}).validate());
    const participant = makeParticipant(eventA, 'not-an-email');
    await assert.rejects(participant.validate());
  });
  it('enforces unique registration IDs and email per event, while allowing cross-event email', async () => {
    await makeParticipant(eventA, ' PERSON@example.com ', 'REG-00001').save();
    await assert.rejects(makeParticipant(eventA, 'other@example.com', 'REG-00001').save(), { name: 'MongoServerError' });
    await assert.rejects(makeParticipant(eventA, 'person@example.com', 'REG-00002').save(), { name: 'MongoServerError' });
    const otherEventCategory = await new ParticipantCategoryModel({ eventId: eventB, name: 'Guests' }).save();
    const crossEvent = makeParticipant(eventB, 'person@example.com', 'REG-00003');
    crossEvent.categoryId = otherEventCategory._id;
    await crossEvent.save();
  });
  it('enforces unique matriculation number only within an event', async () => {
    const one = makeParticipant(eventA, 'one@example.com', 'REG-10001'); one.matriculationNumber = 'MAT-1'; await one.save();
    const two = makeParticipant(eventA, 'two@example.com', 'REG-10002'); two.matriculationNumber = 'MAT-1';
    await assert.rejects(two.save(), { name: 'MongoServerError' });
  });
  it('enforces one attendance record per participant and event', async () => {
    const participant = await makeParticipant(eventA).save();
    await new AttendanceModel({ eventId: eventA, participantId: participant._id, registrationId: participant.registrationId }).save();
    await assert.rejects(new AttendanceModel({ eventId: eventA, participantId: participant._id, registrationId: participant.registrationId }).save(), { name: 'MongoServerError' });
  });
  it('enforces unique normalized administrator email', async () => {
    await new AdministratorModel({ fullName: 'Admin One', email: ' ADMIN@example.com ', passwordHash: 'a'.repeat(60), role: 'SUPER_ADMIN' }).save();
    await assert.rejects(new AdministratorModel({ fullName: 'Admin Two', email: 'admin@example.com', passwordHash: 'b'.repeat(60), role: 'VIEWER' }).save(), { name: 'MongoServerError' });
  });
  it('enforces one invitation per event participant', async () => {
    const participant = await makeParticipant(eventA).save();
    const invitation = { eventId: eventA, participantId: participant._id, referenceCode: 'INV-000001', emailAddress: participant.email };
    await new InvitationModel(invitation).save();
    await assert.rejects(new InvitationModel({ ...invitation, referenceCode: 'INV-000002' }).save(), { name: 'MongoServerError' });
  });
  it('creates activity logs and blocks ordinary updates/deletes', async () => {
    const admin = await new AdministratorModel({ fullName: 'Admin', email: 'admin@example.com', passwordHash: 'a'.repeat(60), role: 'VIEWER' }).save();
    const log = await new ActivityLogModel({ administratorId: admin._id, action: 'ADMIN_LOGIN', description: 'Administrator signed in' }).save();
    assert.ok(log._id);
    await assert.rejects(ActivityLogModel.updateOne({ _id: log._id }, { $set: { description: 'changed' } }));
    await assert.rejects(ActivityLogModel.deleteOne({ _id: log._id }));
  });
});
