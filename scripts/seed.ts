import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { EventModel, ParticipantCategoryModel } from '../src/models';

const seed = async (): Promise<void> => {
  await connectDatabase();

  // The one and only event
  const event = await EventModel.findOneAndUpdate(
    { slug: 'uabs-model-launch-grand-alumni-launch-conference-gala-2026' },
    { $setOnInsert: {
      name: 'UABS Model Launch, Grand Alumni Launch Conference, and Gala 2026',
      institution: 'University of Abuja Business School',
      organizingBody: 'University of Abuja Business School Alumni Association',
      slug: 'uabs-model-launch-grand-alumni-launch-conference-gala-2026',
      eventDate: new Date('2026-11-25T00:00:00.000Z'),
      venue: 'NAF Conference Center', address: 'Kado, Abuja, Nigeria', city: 'Abuja', country: 'Nigeria',
      theme: 'Thriving amid economic challenges: Transforming business and society through innovation, resilience and inclusive growth.',
      registrationOpen: false, status: 'DRAFT',
    } },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
  );

  // The single participant category used by the public registration form
  await ParticipantCategoryModel.updateOne(
    { eventId: event._id, name: 'Postgraduate Students' },
    { $setOnInsert: {
      name: 'Postgraduate Students',
      description: 'Current postgraduate students.',
      requiredFields: ['matriculationNumber', 'enrolledProgramme'],
      optionalFields: [],
      eventId: event._id,
      isActive: true,
    } },
    { upsert: true, runValidators: true },
  );

  console.info(`Seed complete for event ${event.slug}; category "Postgraduate Students" ensured.`);
};

seed()
  .catch(() => {
    console.error('Database seed failed. Check database connectivity and schema validation.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
    await mongoose.disconnect().catch(() => undefined);
  });