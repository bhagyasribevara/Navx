const { MongoClient } = require('mongodb');

const ATLAS_URI = 'mongodb+srv://yusufabdul0709:Yusuf%40007@navx.y3jltar.mongodb.net/navx?retryWrites=true&w=majority';

async function fixDistances() {
  let client;
  try {
    client = await MongoClient.connect(ATLAS_URI);
    const db = client.db('navx');
    const nodesCollection = db.collection('navnodes');
    const pathsCollection = db.collection('navpaths');

    const paths = await pathsCollection.find({}).toArray();
    let updatedCount = 0;

    for (const path of paths) {
      const nodeA = await nodesCollection.findOne({ _id: path.nodeA });
      const nodeB = await nodesCollection.findOne({ _id: path.nodeB });
      
      if (nodeA && nodeB) {
        const dx = (nodeA.x - nodeB.x) * 111320;
        const dy = (nodeA.y - nodeB.y) * 111320 * Math.cos(nodeA.x * Math.PI / 180);
        const newDistance = Math.round(Math.sqrt(dx * dx + dy * dy));
        
        await pathsCollection.updateOne(
          { _id: path._id },
          { $set: { distance: newDistance } }
        );
        updatedCount++;
      }
    }
    console.log(`Updated ${updatedCount} paths to use true lat/lng meters.`);
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    if (client) await client.close();
  }
}

fixDistances();
