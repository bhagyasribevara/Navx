const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const cloudinary = require('../utils/cloudinaryConfig');
const StreetViewSession = require('../models/StreetViewSession');
const StreetViewNode = require('../models/StreetViewNode');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 50, fileSize: 10 * 1024 * 1024 }
});

router.post('/upload-session', upload.array('images', 50), async (req, res) => {
  try {
    const { telemetry, campusId, blockId, floorId, adminId } = req.body;
    const telemetryData = JSON.parse(telemetry || '[]');
    const images = req.files || [];

    if (images.length === 0 || telemetryData.length === 0) {
      return res.status(400).json({ success: false, message: 'Images and telemetry are required' });
    }

    const session = new StreetViewSession({
      campusId, blockId, floorId, admin: adminId, status: 'processing'
    });
    await session.save();

    const createdNodes = [];
    let totalDistance = 0;
    const doorTags = [];

    for (let i = 0; i < images.length; i++) {
      const file = images[i];
      const tData = telemetryData.find(t => t.stepIndex === i || t.nodeIndex === i) || telemetryData[i] || {};

      let imageUrl = '';
      let cloudinaryPublicId = `placeholder_${Date.now()}_${i}`;

      try {
        const buffer = await sharp(file.buffer)
          .resize({ width: 2048, withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer();

        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: `navx-campus/${campusId}/${blockId}/${floorId}` },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.end(buffer);
        });
        imageUrl = uploadResult.secure_url;
        cloudinaryPublicId = uploadResult.public_id;

        // Generate thumbnail from the first image
        if (i === 0) {
          try {
            const thumbBuffer = await sharp(file.buffer)
              .resize({ width: 400, height: 300, fit: 'cover' })
              .webp({ quality: 60 })
              .toBuffer();
            const thumbResult = await new Promise((resolve, reject) => {
              const stream = cloudinary.uploader.upload_stream(
                { folder: `navx-campus/${campusId}/${blockId}/${floorId}/thumbs` },
                (error, result) => {
                  if (error) reject(error);
                  else resolve(result);
                }
              );
              stream.end(thumbBuffer);
            });
            session.thumbnailUrl = thumbResult.secure_url;
            await session.save();
          } catch (thumbErr) {
            console.error('Thumbnail generation failed:', thumbErr);
          }
        }
      } catch (err) {
        console.error('Cloudinary upload failed, using placeholder:', err);
        imageUrl = '/api/streetView/placeholder-image';
      }

      const node = new StreetViewNode({
        campusId, blockId, floorId,
        sessionId: session._id,
        nodeIndex: i,
        imageUrl,
        cloudinaryPublicId,
        // Map mobile telemetry fields to model fields
        position: tData.relativeCoords || tData.position || { x: 0, y: 0, z: 0 },
        orientation: {
          heading: tData.compassHeading ?? tData.orientation?.heading ?? 0,
          pitch: tData.pitch ?? tData.orientation?.pitch ?? 0
        },
        isDoorway: tData.isDoorway || false,
        isStaircase: tData.isStaircase || false,
        doorDetails: tData.isDoorway ? {
          roomName: tData.targetRoomName || null,
          relativeAngle: tData.compassHeading ?? 0
        } : undefined
      });
      await node.save();
      createdNodes.push(node);

      if (node.isDoorway) {
        doorTags.push({
          nodeIndex: i,
          roomName: node.doorDetails?.roomName,
          taggedAt: new Date()
        });
      }
    }

    // Synthesize edges
    for (let i = 0; i < createdNodes.length; i++) {
      const node = createdNodes[i];
      const edges = [];
      
      if (i > 0) {
        const prevNode = createdNodes[i - 1];
        const dx = node.position.x - prevNode.position.x;
        const dz = node.position.z - prevNode.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const bearing = (Math.atan2(dx, dz) * 180 / Math.PI + 360) % 360;
        edges.push({
          targetNodeId: prevNode._id,
          direction: 'backward',
          distance: dist,
          bearing
        });
      }
      if (i < createdNodes.length - 1) {
        const nextNode = createdNodes[i + 1];
        const dx = nextNode.position.x - node.position.x;
        const dz = nextNode.position.z - node.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const bearing = (Math.atan2(dx, dz) * 180 / Math.PI + 360) % 360;
        edges.push({
          targetNodeId: nextNode._id,
          direction: 'forward',
          distance: dist,
          bearing
        });
        totalDistance += dist;
      }
      
      node.connectedEdges = edges;
      await node.save();
    }

    session.status = 'completed';
    session.totalNodes = createdNodes.length;
    session.totalDistance = totalDistance;
    session.completedAt = new Date();
    session.doorTags = doorTags;
    await session.save();

    res.json({ success: true, session, nodeCount: createdNodes.length });
  } catch (error) {
    console.error('Upload session error:', error);
    res.status(500).json({ success: false, message: 'Upload failed', error: error.message });
  }
});

router.get('/sessions', async (req, res) => {
  try {
    const { campusId, blockId, floorId, isPublished } = req.query;
    const query = {};
    if (campusId) query.campusId = campusId;
    if (blockId) query.blockId = blockId;
    if (floorId) query.floorId = floorId;
    if (isPublished !== undefined) query.isPublished = isPublished === 'true';

    const sessions = await StreetViewSession.find(query)
      .populate('blockId', '_id name')
      .populate('floorId', '_id name')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, sessions });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Fetch failed', error: error.message });
  }
});

router.get('/graph/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const nodes = await StreetViewNode.find({ sessionId }).sort({ nodeIndex: 1 });
    res.json({ success: true, nodes, sessionId });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Graph fetch failed', error: error.message });
  }
});

router.patch('/session/:id/publish', async (req, res) => {
  try {
    const session = await StreetViewSession.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: 'Not found' });
    
    session.isPublished = !session.isPublished;
    await session.save();
    res.json({ success: true, session });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Publish failed', error: error.message });
  }
});

router.delete('/session/:id', async (req, res) => {
  try {
    const sessionId = req.params.id;
    const nodes = await StreetViewNode.find({ sessionId });
    
    const publicIds = nodes.map(n => n.cloudinaryPublicId).filter(id => !id.startsWith('placeholder_'));
    if (publicIds.length > 0) {
      try {
        await cloudinary.api.delete_resources(publicIds);
      } catch (err) {
        console.error('Cloudinary delete error:', err);
      }
    }

    await StreetViewNode.deleteMany({ sessionId });
    await StreetViewSession.findByIdAndDelete(sessionId);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Delete failed', error: error.message });
  }
});

router.get('/viewer', (req, res) => {
  const { floorId, nodeId, apiBase } = req.query;
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>NavX Street View</title>
  <style>
    body { margin: 0; overflow: hidden; background: #111; color: white; font-family: sans-serif; }
    #container { width: 100vw; height: 100vh; }
    #ui { position: absolute; bottom: 30px; left: 0; right: 0; display: flex; justify-content: center; align-items: center; gap: 40px; pointer-events: none; }
    .nav-btn { pointer-events: auto; background: rgba(0,0,0,0.6); border: 2px solid #fff; border-radius: 50%; width: 50px; height: 50px; display: flex; justify-content: center; align-items: center; cursor: pointer; font-size: 24px; user-select: none; }
    .nav-btn:active { background: rgba(255,255,255,0.3); }
    #counter { pointer-events: auto; background: rgba(0,0,0,0.6); padding: 5px 15px; border-radius: 20px; font-size: 14px; }
    #loading { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 18px; }
    .door-label { position: absolute; background: rgba(0,0,0,0.7); padding: 5px 10px; border-radius: 5px; border: 1px solid #4CAF50; color: #4CAF50; font-weight: bold; font-size: 14px; transform: translate(-50%, -50%); pointer-events: none; display: none; }
  </style>
</head>
<body>
  <div id="loading">Loading...</div>
  <div id="container"></div>
  <div class="door-label" id="doorLabel">Room</div>
  <div id="ui">
    <div class="nav-btn" id="btnPrev">❮</div>
    <div id="counter">0 of 0</div>
    <div class="nav-btn" id="btnNext">❯</div>
  </div>

  <script src="https://unpkg.com/three@0.158.0/build/three.min.js"></script>
  <script type="module">
    import { OrbitControls } from 'https://unpkg.com/three@0.158.0/examples/jsm/controls/OrbitControls.js';
    
    const apiBase = '${apiBase || '/api'}';
    const floorId = '${floorId || ''}';
    let startNodeId = '${nodeId || ''}';
    
    let nodes = [];
    let currentIndex = 0;
    
    let scene, camera, renderer, controls, cylinder, textureLoader;

    async function init() {
      try {
        const res = await fetch(\`\${apiBase}/streetView/graph/\${floorId}\`);
        const data = await res.json();
        if (!data.success || !data.nodes || data.nodes.length === 0) {
          document.getElementById('loading').innerText = 'No street view data found.';
          return;
        }
        nodes = data.nodes;
        
        if (startNodeId) {
          const idx = nodes.findIndex(n => n._id === startNodeId);
          if (idx >= 0) currentIndex = idx;
        }
        
        initThree();
        loadNode(currentIndex);
      } catch (err) {
        document.getElementById('loading').innerText = 'Error loading data.';
        console.error(err);
      }
    }

    function initThree() {
      const container = document.getElementById('container');
      
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.set(0, 0, 0.1);

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      container.appendChild(renderer.domElement);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.minPolarAngle = Math.PI / 2 - 0.3;
      controls.maxPolarAngle = Math.PI / 2 + 0.3;

      textureLoader = new THREE.TextureLoader();
      textureLoader.setCrossOrigin('anonymous');

      const geometry = new THREE.CylinderGeometry(50, 50, 40, 64);
      geometry.scale(-1, 1, 1);
      const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
      cylinder = new THREE.Mesh(geometry, material);
      scene.add(cylinder);

      window.addEventListener('resize', onWindowResize);
      animate();
      
      document.getElementById('loading').style.display = 'none';
      
      document.getElementById('btnPrev').addEventListener('click', () => {
        if (currentIndex > 0) loadNode(currentIndex - 1);
      });
      document.getElementById('btnNext').addEventListener('click', () => {
        if (currentIndex < nodes.length - 1) loadNode(currentIndex + 1);
      });
    }

    function loadNode(index) {
      const node = nodes[index];
      currentIndex = index;
      
      document.getElementById('loading').style.display = 'block';
      textureLoader.load(node.imageUrl, (texture) => {
        cylinder.material.map = texture;
        cylinder.material.needsUpdate = true;
        document.getElementById('loading').style.display = 'none';
        
        cylinder.rotation.y = THREE.MathUtils.degToRad(node.orientation?.heading || 0);
      }, undefined, (err) => {
        console.error('Texture load error', err);
        document.getElementById('loading').style.display = 'none';
      });

      document.getElementById('counter').innerText = \`\${index + 1} of \${nodes.length}\`;
      
      document.getElementById('btnPrev').style.opacity = index > 0 ? 1 : 0.3;
      document.getElementById('btnNext').style.opacity = index < nodes.length - 1 ? 1 : 0.3;
      
      const doorLabel = document.getElementById('doorLabel');
      if (node.isDoorway && node.doorDetails && node.doorDetails.roomName) {
        doorLabel.innerText = node.doorDetails.roomName;
        doorLabel.style.display = 'block';
        doorLabel.style.left = '50%';
        doorLabel.style.top = '30%';
      } else {
        doorLabel.style.display = 'none';
      }
    }

    function onWindowResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }

    init();
  </script>
</body>
</html>
  `;
  res.send(html);
});

router.get('/placeholder-image', async (req, res) => {
  try {
    const buffer = await sharp({
      create: {
        width: 400,
        height: 300,
        channels: 4,
        background: { r: 128, g: 128, b: 128, alpha: 1 }
      }
    })
    .composite([{
      input: Buffer.from(`<svg width="400" height="300">
        <text x="50%" y="50%" font-family="sans-serif" font-size="24" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">No Image</text>
      </svg>`),
      top: 0,
      left: 0,
    }])
    .png()
    .toBuffer();
    
    res.type('image/png').send(buffer);
  } catch (error) {
    res.status(500).send('Error generating placeholder');
  }
});

module.exports = router;
