const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('Collections:', collections.map(c => c.name));

  const chunksCol = mongoose.connection.db.collection('documentchunks');
  const docsCol = mongoose.connection.db.collection('documents');

  const psychDocs = await docsCol.find({
    $or: [
      { title: { $regex: 'psychology', $options: 'i' } },
      { originalName: { $regex: 'psychology', $options: 'i' } }
    ]
  }).toArray();
  console.log('Psychology docs:', psychDocs.map(d => ({ id: d._id, title: d.title, originalName: d.originalName })));

  const psychChunks = await chunksCol.find({
    content: { $regex: 'psychology', $options: 'i' }
  }).toArray();
  console.log(`Found ${psychChunks.length} chunks mentioning psychology:`);
  psychChunks.forEach((c, i) => {
    console.log(`\n--- Chunk ${i + 1} (ID: ${c._id}) ---`);
    console.log(`DocumentId: ${c.documentId}, Heading: ${c.metadata?.heading}, Page: ${c.metadata?.pageNumber || c.metadata?.page}`);
    console.log(`Content:\n${c.content}`);
  });

  await mongoose.disconnect();
}
check().catch(console.error);
