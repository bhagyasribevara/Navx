/**
 * NavX AI Assistant — Campus Knowledge Service
 * Fetches real campus data from MongoDB and builds structured context
 * for injection into the AI system prompt.
 */

const Campus = require('../models/Campus');
const Block = require('../models/Block');
const Floor = require('../models/Floor');
const Room = require('../models/Room');
const Landmark = require('../models/Landmark');
const Announcement = require('../models/Announcement');
const NavNode = require('../models/NavNode');
const LiveMeetSession = require('../models/LiveMeetSession');
const QRCode = require('../models/QRCode');
const Beacon = require('../models/Beacon');
const Faculty = require('../models/Faculty');
const Timetable = require('../models/Timetable');
const { ROOM_EMOJI } = require('./aiConstants');

// ─── Cache for campus context (avoid hitting DB on every message) ────────
const contextCache = new Map();
const CACHE_TTL = 120_000; // 2 minutes

/**
 * Get comprehensive campus context for AI prompt injection.
 * @param {string} campusId - MongoDB campus ID
 * @returns {object} Structured campus data
 */
async function getCampusContext(campusId) {
  if (!campusId) return null;

  const cacheKey = campusId.toString();
  const cached = contextCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];
    const queryDay = (today === 'Sunday' || today === 'Saturday') ? 'Monday' : today;

    const [campus, blocks, floors, rooms, landmarks, announcements, faculties, todayTimetable] = await Promise.all([
      Campus.findById(campusId).lean(),
      Block.find({ campusId, isActive: true }).lean(),
      Floor.find({ campusId, isActive: true }).lean(),
      Room.find({ campusId, isActive: true }).lean(),
      Landmark.find({ campusId, isActive: true }).lean(),
      Announcement.find({ campusId, isActive: true }).sort({ createdAt: -1 }).limit(10).lean(),
      Faculty.find({ campusId, status: { $ne: 'disabled' } }).lean(),
      Timetable.find({ campusId, dayOfWeek: queryDay }).lean(),
    ]);

    if (!campus) return null;

    const data = {
      campus: {
        name: campus.name || campus.campusName,
        code: campus.campusCode,
        description: campus.description,
        address: campus.address,
        venueType: campus.venueType,
        contactInfo: campus.contactInfo,
        operatingHours: campus.operatingHours,
        emergencyState: campus.emergencyState,
      },
      blocks: blocks.map(b => ({
        id: b._id.toString(),
        name: b.name,
        description: b.description,
        domain: b.domain,
        floorCount: b.floorCount,
      })),
      floors: floors.map(f => ({
        id: f._id.toString(),
        name: f.name,
        level: f.level,
        blockId: f.blockId.toString(),
        blockName: blocks.find(b => b._id.toString() === f.blockId.toString())?.name || '',
      })),
      rooms: rooms.map(r => ({
        id: r._id.toString(),
        name: r.name,
        type: r.type,
        roomNumber: r.roomNumber,
        description: r.description,
        blockId: r.blockId.toString(),
        blockName: blocks.find(b => b._id.toString() === r.blockId.toString())?.name || '',
        floorId: r.floorId.toString(),
        floorName: floors.find(f => f._id.toString() === r.floorId.toString())?.name || '',
        floorLevel: floors.find(f => f._id.toString() === r.floorId.toString())?.level ?? 0,
        accessible: r.accessible,
        capacity: r.capacity,
        amenities: r.amenities,
      })),
      landmarks: landmarks.map(l => ({
        id: l._id.toString(),
        data: l.landmarkData,
      })),
      announcements: announcements.map(a => ({
        id: a._id.toString(),
        data: a.announcementData,
        createdAt: a.createdAt,
      })),
      faculties: faculties.map(f => ({
        id: f._id.toString(),
        name: f.name,
        department: f.department,
        facultyRoom: f.facultyRoom,
        leaveStatus: f.leaveStatus,
        officeHours: f.officeHours,
        subjects: f.subjects
      })),
      todayTimetable: todayTimetable.map(t => ({
        facultyId: t.facultyId.toString(),
        facultyName: t.facultyName,
        subject: t.subject,
        roomName: t.roomName,
        startTime: t.startTime,
        endTime: t.endTime,
        period: t.period
      })),
      stats: {
        totalBlocks: blocks.length,
        totalFloors: floors.length,
        totalRooms: rooms.length,
        roomsByType: {},
      },
    };

    // Count rooms by type
    for (const room of rooms) {
      data.stats.roomsByType[room.type] = (data.stats.roomsByType[room.type] || 0) + 1;
    }

    // Cache the result
    contextCache.set(cacheKey, { data, timestamp: Date.now() });

    // Limit cache size
    if (contextCache.size > 20) {
      const oldest = contextCache.keys().next().value;
      contextCache.delete(oldest);
    }

    return data;
  } catch (err) {
    console.error('[CampusKnowledge] Error fetching campus context:', err.message);
    return null;
  }
}

/**
 * Build a compact text summary of campus data for the AI system prompt.
 * This is injected as context so the AI can give accurate answers.
 * @param {string} campusId
 * @returns {string} Text summary
 */
async function buildContextString(campusId) {
  const ctx = await getCampusContext(campusId);
  if (!ctx) return 'No campus data available.';

  let text = '';

  // Campus info
  text += `CAMPUS: "${ctx.campus.name}"`;
  if (ctx.campus.venueType) text += ` (Type: ${ctx.campus.venueType})`;
  if (ctx.campus.address) text += ` | Address: ${ctx.campus.address}`;
  if (ctx.campus.operatingHours) text += ` | Hours: ${ctx.campus.operatingHours}`;
  text += '\n';

  // Emergency state
  if (ctx.campus.emergencyState && ctx.campus.emergencyState.isActive) {
    text += `⚠️ ACTIVE EMERGENCY: ${ctx.campus.emergencyState.type} — ${ctx.campus.emergencyState.message}\n`;
  }

  // Contact info
  if (ctx.campus.contactInfo) {
    const c = ctx.campus.contactInfo;
    if (c.phone || c.email) {
      text += `Contact: ${c.phone || ''} ${c.email || ''}\n`;
    }
  }

  // Blocks
  text += `\nBLOCKS (${ctx.blocks.length}):\n`;
  for (const block of ctx.blocks) {
    text += `  • ${block.name}`;
    if (block.domain) text += ` [${block.domain}]`;
    if (block.floorCount) text += ` (${block.floorCount} floors)`;
    if (block.description) text += ` — ${block.description}`;
    text += '\n';
  }

  // Rooms grouped by block
  // Note: We intentionally omit the full list of rooms here to keep the prompt small and fast.
  // Specific rooms are dynamically injected into the context by searchFacilities() in ai.js based on user intent.
  text += `\nROOMS: There are ${ctx.rooms.length} rooms across the campus. Detailed room data is dynamically retrieved based on user queries.\n`;

  // Room type summary
  text += `\nFACILITY SUMMARY:\n`;
  for (const [type, count] of Object.entries(ctx.stats.roomsByType)) {
    const emoji = ROOM_EMOJI[type] || '📍';
    text += `  ${emoji} ${type}: ${count}\n`;
  }

  // Announcements
  if (ctx.announcements.length > 0) {
    text += `\nRECENT ANNOUNCEMENTS:\n`;
    for (const ann of ctx.announcements.slice(0, 5)) {
      const data = ann.data;
      if (typeof data === 'string') {
        text += `  • ${data}\n`;
      } else if (data && data.title) {
        text += `  • ${data.title}`;
        if (data.message) text += `: ${data.message}`;
        text += '\n';
      } else if (data) {
        text += `  • ${JSON.stringify(data).substring(0, 150)}\n`;
      }
    }
  }

  // Landmarks
  if (ctx.landmarks.length > 0) {
    text += `\nLANDMARKS:\n`;
    for (const lm of ctx.landmarks) {
      const data = lm.data;
      if (data && data.name) {
        text += `  📌 ${data.name}`;
        if (data.description) text += `: ${data.description}`;
        text += '\n';
      }
    }
  }

  // Faculty Directory & Schedule
  if (ctx.faculties && ctx.faculties.length > 0) {
    text += `\nFACULTY DIRECTORY & TODAY'S CLASSES:\n`;
    for (const fac of ctx.faculties) {
      text += `  • ${fac.name} (${fac.department}) | Room: ${fac.facultyRoom} | Status: ${fac.leaveStatus} | Office Hours: ${fac.officeHours}\n`;
      const facClasses = ctx.todayTimetable.filter(t => t.facultyId === fac.id || (t.facultyName && t.facultyName.includes(fac.name)));
      if (facClasses.length > 0) {
        text += `    Classes today: ${facClasses.sort((a,b)=>a.period-b.period).map(c => `P${c.period} ${c.subject} in ${c.roomName} (${c.startTime}-${c.endTime})`).join(', ')}\n`;
      } else {
        text += `    Classes today: No classes scheduled.\n`;
      }
    }
  }

  return text;
}

/**
 * Search for rooms matching a query string within a campus.
 * @param {string} campusId
 * @param {string} query
 * @returns {Array} Matching rooms
 */
async function searchFacilities(campusId, query) {
  if (!campusId || !query) return [];

  try {
    const cleanQuery = query.trim().replace(/\s+/g, ' ');
    if (!cleanQuery) return [];

    const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedWords = cleanQuery.split(' ').map(w => escapeRegExp(w));
    const regex = new RegExp(escapedWords.map(w => `(?=.*${w})`).join(''), 'i');

    const rooms = await Room.find({
      campusId,
      isActive: true,
      $or: [
        { name: { $regex: regex } },
        { roomNumber: { $regex: regex } },
        { description: { $regex: regex } },
        { type: { $regex: regex } },
      ],
    })
      .populate('floorId', 'name level')
      .populate('blockId', 'name')
      .limit(10)
      .lean();

    return rooms.map(r => ({
      id: r._id.toString(),
      name: r.name,
      type: r.type,
      roomNumber: r.roomNumber,
      block: r.blockId?.name || '',
      floor: r.floorId?.name || '',
      floorLevel: r.floorId?.level ?? 0,
      accessible: r.accessible,
    }));
  } catch (err) {
    console.error('[CampusKnowledge] Search error:', err.message);
    return [];
  }
}

/**
 * Get rooms of a specific type (for "nearest washroom" type queries).
 * @param {string} campusId
 * @param {string} type - Room type (restroom, cafeteria, library, etc.)
 * @returns {Array} Matching rooms
 */
async function getRoomsByType(campusId, type) {
  if (!campusId || !type) return [];

  try {
    const rooms = await Room.find({
      campusId,
      isActive: true,
      type,
    })
      .populate('floorId', 'name level')
      .populate('blockId', 'name')
      .lean();

    return rooms.map(r => ({
      id: r._id.toString(),
      name: r.name,
      type: r.type,
      block: r.blockId?.name || '',
      floor: r.floorId?.name || '',
      floorLevel: r.floorId?.level ?? 0,
      accessible: r.accessible,
    }));
  } catch (err) {
    console.error('[CampusKnowledge] getRoomsByType error:', err.message);
    return [];
  }
}

/**
 * Get active Live Meet session info.
 * @param {string} sessionId
 * @returns {object|null}
 */
async function getLiveMeetInfo(sessionId) {
  if (!sessionId) return null;

  try {
    const session = await LiveMeetSession.findOne({ sessionId })
      .populate('campusId', 'name')
      .lean();

    if (!session) return null;

    return {
      sessionId: session.sessionId,
      status: session.status,
      creatorName: session.creatorName,
      joinerName: session.joinerName,
      creatorLocation: session.creatorLocation,
      joinerLocation: session.joinerLocation,
      destinationLabel: session.destinationLabel,
      expiresAt: session.expiresAt,
      campusName: session.campusId?.name,
    };
  } catch (err) {
    console.error('[CampusKnowledge] LiveMeet error:', err.message);
    return null;
  }
}

/**
 * Get emergency-relevant information for a campus.
 * @param {string} campusId
 * @returns {object}
 */
async function getEmergencyInfo(campusId) {
  if (!campusId) return null;

  try {
    const [campus, exits, medicalRooms] = await Promise.all([
      Campus.findById(campusId).lean(),
      Room.find({ campusId, isActive: true, type: { $in: ['exit', 'entrance'] } })
        .populate('floorId', 'name level')
        .populate('blockId', 'name')
        .lean(),
      Room.find({
        campusId,
        isActive: true,
        $or: [
          { type: 'emergency' },
          { name: { $regex: /medical|first aid|health|clinic|security/i } },
        ],
      })
        .populate('floorId', 'name level')
        .populate('blockId', 'name')
        .lean(),
    ]);

    return {
      emergencyState: campus?.emergencyState,
      exits: exits.map(r => ({
        name: r.name,
        block: r.blockId?.name || '',
        floor: r.floorId?.name || '',
      })),
      medicalFacilities: medicalRooms.map(r => ({
        name: r.name,
        type: r.type,
        block: r.blockId?.name || '',
        floor: r.floorId?.name || '',
      })),
      contactInfo: campus?.contactInfo,
    };
  } catch (err) {
    console.error('[CampusKnowledge] Emergency info error:', err.message);
    return null;
  }
}

/**
 * Invalidate the context cache for a campus (call when admin updates data).
 * @param {string} campusId
 */
function invalidateCache(campusId) {
  if (campusId) {
    contextCache.delete(campusId.toString());
  } else {
    contextCache.clear();
  }
}

module.exports = {
  getCampusContext,
  buildContextString,
  searchFacilities,
  getRoomsByType,
  getLiveMeetInfo,
  getEmergencyInfo,
  invalidateCache,
};
