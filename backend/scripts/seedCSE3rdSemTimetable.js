require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Faculty = require('../models/Faculty');
const Timetable = require('../models/Timetable');
const Campus = require('../models/Campus');

// --- Timetable Data Configuration ---
const semester = "3";
const department = "CSE";

const subjectsMap = {
  "23CS301": "Problem solving using Python",
  "23HSX10": "Engineering Economics and Project Management",
  "23CS303": "Design and Analysis of Algorithms",
  "23CS304": "Digital Logic Design",
  "23CS305": "Discrete Mathematical Structures",
  "23CS306": "Object Oriented Programming with JAVA",
  "23CS307": "Design and Analysis of Algorithms Lab",
  "23CS308": "JAVA Lab",
  "23ESX01": "Employability Skills I",
  "SDA": "SDA",
  "LIBRARY": "LIBRARY",
  "COUNSELLING": "COUNSELLING"
};

// Map shortcuts to full names and generate emails
const facultyMap = {
  "AB": { name: "Mrs.A.Bhavani", email: "a.bhavani@gmr.edu" },
  "PKD": { name: "Mr.P.Kedar", email: "p.kedar@gmr.edu" },
  "DSK": { name: "Dr.D.Srinivasa Kumar", email: "d.srinivasa.kumar@gmr.edu" },
  "BiSK": { name: "Mr.Baisakh", email: "baisakh@gmr.edu" },
  "YNPK": { name: "Mr.Y.Naga Pramod Kumar", email: "y.naga.pramod.kumar@gmr.edu" },
  "SS": { name: "Ms.Santhoshini Sahu", email: "santhoshini.sahu@gmr.edu" },
  "GSL": { name: "Mr.G.Suneel", email: "g.suneel@gmr.edu" },
  "GDR": { name: "Mr.G.Dharma Raju", email: "g.dharma.raju@gmr.edu" },
  "MSK": { name: "Mr.M.Santhosh Kumar", email: "m.santhosh.kumar@gmr.edu" },
  "BSR": { name: "Dr.B.Sanyasi Rao", email: "b.sanyasi.rao@gmr.edu" },
  "YAD": { name: "Dr.Y.Aditya", email: "y.aditya@gmr.edu" },
  "MSN": { name: "Mrs.M.Sravani", email: "m.sravani@gmr.edu" },
  "SJS": { name: "Mr.Suraj Soren", email: "suraj.soren@gmr.edu" },
  "KVSP": { name: "Dr.K.V.S.Prasad", email: "k.v.s.prasad@gmr.edu" },
  "AV": { name: "Mrs.A.Vineela", email: "a.vineela@gmr.edu" },
  "BDK": { name: "Ms.Binodhini Kar", email: "binodhini.kar@gmr.edu" },
  "DRR": { name: "Dr.D.Radha Rani", email: "d.radha.rani@gmr.edu" },
  "RVS": { name: "Mr.S.Ravi Sankar", email: "s.ravi.sankar@gmr.edu" },
  "DSR": { name: "Mr.D.Srinuvasa Rao", email: "d.srinuvasa.rao@gmr.edu" },
  "SVK": { name: "Mr.S.Vinod Kumar", email: "s.vinod.kumar@gmr.edu" },
  "SKM": { name: "Ms.Sucheta Krupalini M", email: "sucheta.krupalini.m@gmr.edu" },
  "SAA": { name: "Dr.S.Akila Agnes", email: "s.akila.agnes@gmr.edu" },
  "TAS": { name: "Mrs.T.Anusha", email: "t.anusha@gmr.edu" },
  "MMS": { name: "Mrs.M.Maanasa", email: "m.maanasa@gmr.edu" },
  "MAS": { name: "Mr.Md.Aamir Sohail", email: "md.aamir.sohail@gmr.edu" },
  "KVL": { name: "Ms.K.Venkata Lakshmi", email: "k.venkata.lakshmi@gmr.edu" },
  "GRK": { name: "Mr.G.Ravi Kumar", email: "g.ravi.kumar@gmr.edu" },
  "KKV": { name: "Dr.K.Kavitha", email: "k.kavitha@gmr.edu" },
  "MSG": { name: "Mrs.S.Geetha", email: "s.geetha@gmr.edu" },
  "GNA": { name: "Mrs.G.Nirosha", email: "g.nirosha@gmr.edu" }
};

// Add fallback generic faculty for multi-assigned labs or unmapped shortcuts
const getFaculty = (shortcut) => {
  // If multiple (e.g. YNPK/SS), split and take first for primary timetable mapping for simplicity
  const primary = shortcut.split('/')[0].split('-')[0];
  if (facultyMap[primary]) {
    return { shortcut: primary, ...facultyMap[primary] };
  }
  return { shortcut, name: shortcut, email: `${shortcut.toLowerCase()}@gmr.edu` };
};

const periods = [
  { id: 1, start: '09:00 AM', end: '10:00 AM' },
  { id: 2, start: '10:00 AM', end: '11:00 AM' },
  { id: 3, start: '11:10 AM', end: '12:10 PM' },
  { id: 4, start: '12:10 PM', end: '01:10 PM' },
  { id: 5, start: '02:00 PM', end: '03:00 PM' },
  { id: 6, start: '03:00 PM', end: '04:00 PM' },
  { id: 7, start: '04:00 PM', end: '05:00 PM' }
];

const timetableGrid = {
  "A": {
    room: "5-S-10",
    schedule: {
      "Monday": [
        { period: 1, code: "23CS303", faculty: "BiSK" },
        { period: 2, code: "23CS301", faculty: "AB" },
        { period: 3, code: "23CS306", faculty: "GDR" },
        { period: 4, code: "23ESX01", faculty: "BSR" },
        { period: 5, code: "23CS304", faculty: "YNPK" },
        { period: 6, code: "23CS307", faculty: "BiSK" },
        { period: 7, code: "23CS307", faculty: "BiSK" }
      ],
      "Tuesday": [
        { period: 1, code: "23CS304", faculty: "YNPK" },
        { period: 2, code: "23CS304", faculty: "YNPK" },
        { period: 3, code: "23HSX10", faculty: "DSK" },
        { period: 4, code: "23CS301", faculty: "AB" },
        { period: 5, code: "23CS303", faculty: "BiSK" },
        { period: 6, code: "23CS304", faculty: "YNPK" },
        { period: 7, code: "23CS305", faculty: "GSL" }
      ],
      "Wednesday": [
        { period: 1, code: "23CS306", faculty: "GDR" },
        { period: 2, code: "23ESX01", faculty: "MSK" },
        { period: 3, code: "23CS307", faculty: "BiSK" },
        { period: 4, code: "23CS307", faculty: "BiSK" },
        { period: 5, code: "23HSX10", faculty: "DSK" },
        { period: 6, code: "SDA", faculty: "SDA" },
        { period: 7, code: "SDA", faculty: "SDA" }
      ],
      "Thursday": [
        { period: 1, code: "23CS305", faculty: "GSL" },
        { period: 2, code: "23HSX10", faculty: "DSK" },
        { period: 3, code: "23ESX01", faculty: "SS" },
        { period: 4, code: "23ESX01", faculty: "SS" },
        { period: 5, code: "23CS306", faculty: "GDR" },
        { period: 6, code: "23CS301", faculty: "AB" },
        { period: 7, code: "COUNSELLING", faculty: "COUNSELLING" }
      ],
      "Friday": [
        { period: 1, code: "23CS304", faculty: "YNPK" },
        { period: 2, code: "23HSX10", faculty: "DSK" },
        { period: 3, code: "23CS303", faculty: "BiSK" },
        { period: 4, code: "23CS305", faculty: "GSL" },
        { period: 5, code: "23CS301", faculty: "AB" },
        { period: 6, code: "23CS301", faculty: "AB" },
        { period: 7, code: "LIBRARY", faculty: "LIBRARY" }
      ]
    }
  },
  "B": {
    room: "5-S-13",
    schedule: {
      "Monday": [
        { period: 1, code: "23CS305", faculty: "YAD" },
        { period: 2, code: "23HSX10", faculty: "KVSP" },
        { period: 3, code: "23CS307", faculty: "SS" },
        { period: 4, code: "23CS307", faculty: "SS" },
        { period: 5, code: "23CS301", faculty: "MSN" },
        { period: 6, code: "23CS303", faculty: "SS" },
        { period: 7, code: "LIBRARY", faculty: "LIBRARY" }
      ],
      "Tuesday": [
        { period: 1, code: "23CS301", faculty: "MSN" },
        { period: 2, code: "23CS306", faculty: "DRR" },
        { period: 3, code: "23CS304", faculty: "AV" },
        { period: 4, code: "23CS304", faculty: "AV" },
        { period: 5, code: "23HSX10", faculty: "KVSP" },
        { period: 6, code: "23CS303", faculty: "SS" },
        { period: 7, code: "COUNSELLING", faculty: "COUNSELLING" }
      ],
      "Wednesday": [
        { period: 1, code: "23CS301", faculty: "MSN" },
        { period: 2, code: "23CS301", faculty: "MSN" },
        { period: 3, code: "23CS305", faculty: "YAD" },
        { period: 4, code: "23CS304", faculty: "AV" },
        { period: 5, code: "23ESX01", faculty: "BSR" },
        { period: 6, code: "SDA", faculty: "SDA" },
        { period: 7, code: "SDA", faculty: "SDA" }
      ],
      "Thursday": [
        { period: 1, code: "23HSX10", faculty: "KVSP" },
        { period: 2, code: "23CS303", faculty: "SS" },
        { period: 3, code: "23ESX01", faculty: "SVK" },
        { period: 4, code: "23ESX01", faculty: "SVK" },
        { period: 5, code: "23CS305", faculty: "YAD" },
        { period: 6, code: "23CS304", faculty: "AV" },
        { period: 7, code: "23CS306", faculty: "DRR" }
      ],
      "Friday": [
        { period: 1, code: "23CS306", faculty: "DRR" },
        { period: 2, code: "23CS301", faculty: "MSN" },
        { period: 3, code: "23HSX10", faculty: "KVSP" },
        { period: 4, code: "23ESX01", faculty: "MSK" },
        { period: 5, code: "23CS304", faculty: "AV" },
        { period: 6, code: "23CS307", faculty: "SS" },
        { period: 7, code: "23CS307", faculty: "SS" }
      ]
    }
  },
  "C": {
    room: "5-S-12",
    schedule: {
      "Monday": [
        { period: 1, code: "23CS301", faculty: "SKM" },
        { period: 2, code: "23HSX10", faculty: "DSK" },
        { period: 3, code: "23CS304", faculty: "MMS" },
        { period: 4, code: "23CS304", faculty: "MMS" },
        { period: 5, code: "23CS305", faculty: "YAD" },
        { period: 6, code: "23CS303", faculty: "TAS" },
        { period: 7, code: "LIBRARY", faculty: "LIBRARY" }
      ],
      "Tuesday": [
        { period: 1, code: "23HSX10", faculty: "DSK" },
        { period: 2, code: "23ESX01", faculty: "MSK" },
        { period: 3, code: "23CS307", faculty: "TAS" },
        { period: 4, code: "23CS307", faculty: "TAS" },
        { period: 5, code: "23CS304", faculty: "MMS" },
        { period: 6, code: "23CS303", faculty: "TAS" },
        { period: 7, code: "23CS305", faculty: "YAD" }
      ],
      "Wednesday": [
        { period: 1, code: "23CS306", faculty: "GSL" },
        { period: 2, code: "23CS301", faculty: "SKM" },
        { period: 3, code: "23HSX10", faculty: "DSK" },
        { period: 4, code: "23ESX01", faculty: "BSR" },
        { period: 5, code: "23ESX01", faculty: "AB" },
        { period: 6, code: "23ESX01", faculty: "AB" },
        { period: 7, code: "SDA", faculty: "SDA" }
      ],
      "Thursday": [
        { period: 1, code: "23CS304", faculty: "MMS" },
        { period: 2, code: "23CS301", faculty: "SKM" },
        { period: 3, code: "23CS306", faculty: "GSL" },
        { period: 4, code: "23CS303", faculty: "TAS" },
        { period: 5, code: "23CS307", faculty: "TAS" },
        { period: 6, code: "23CS307", faculty: "TAS" },
        { period: 7, code: "COUNSELLING", faculty: "COUNSELLING" }
      ],
      "Friday": [
        { period: 1, code: "23CS301", faculty: "SKM" },
        { period: 2, code: "23CS301", faculty: "SKM" },
        { period: 3, code: "23CS304", faculty: "MMS" },
        { period: 4, code: "23CS305", faculty: "YAD" },
        { period: 5, code: "23HSX10", faculty: "DSK" },
        { period: 6, code: "23CS306", faculty: "GSL" },
        { period: 7, code: "SDA", faculty: "SDA" }
      ]
    }
  },
  "D": {
    room: "5-S-11",
    schedule: {
      "Monday": [
        { period: 1, code: "23CS306", faculty: "GRK" },
        { period: 2, code: "23ESX01", faculty: "BSR" },
        { period: 3, code: "23CS301", faculty: "SVK" },
        { period: 4, code: "23CS301", faculty: "SVK" },
        { period: 5, code: "23CS303", faculty: "PKD" },
        { period: 6, code: "23CS305", faculty: "AB" },
        { period: 7, code: "LIBRARY", faculty: "LIBRARY" }
      ],
      "Tuesday": [
        { period: 1, code: "23CS305", faculty: "AB" },
        { period: 2, code: "23CS301", faculty: "SVK" },
        { period: 3, code: "23HSX10", faculty: "KVSP" },
        { period: 4, code: "23CS306", faculty: "GRK" },
        { period: 5, code: "23CS304", faculty: "GNA" },
        { period: 6, code: "23CS307", faculty: "PKD" },
        { period: 7, code: "23CS307", faculty: "PKD" }
      ],
      "Wednesday": [
        { period: 1, code: "23CS304", faculty: "GNA" },
        { period: 2, code: "23CS304", faculty: "GNA" },
        { period: 3, code: "23HSX10", faculty: "KVSP" },
        { period: 4, code: "23ESX01", faculty: "MSK" },
        { period: 5, code: "23CS301", faculty: "SVK" },
        { period: 6, code: "SDA", faculty: "SDA" },
        { period: 7, code: "SDA", faculty: "SDA" }
      ],
      "Thursday": [
        { period: 1, code: "23CS303", faculty: "PKD" },
        { period: 2, code: "23CS304", faculty: "GNA" },
        { period: 3, code: "23CS307", faculty: "PKD" },
        { period: 4, code: "23CS307", faculty: "PKD" },
        { period: 5, code: "23HSX10", faculty: "KVSP" },
        { period: 6, code: "23CS301", faculty: "SVK" },
        { period: 7, code: "COUNSELLING", faculty: "COUNSELLING" }
      ],
      "Friday": [
        { period: 1, code: "23HSX10", faculty: "KVSP" },
        { period: 2, code: "23CS305", faculty: "AB" },
        { period: 3, code: "23CS303", faculty: "PKD" },
        { period: 4, code: "23CS304", faculty: "GNA" },
        { period: 5, code: "23CS306", faculty: "GRK" },
        { period: 6, code: "23ESX01", faculty: "BDK" },
        { period: 7, code: "23ESX01", faculty: "BDK" }
      ]
    }
  }
};


async function run() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);

    const campus = await Campus.findOne();
    if (!campus) throw new Error("No campus found");
    const campusId = campus._id;

    console.log(`Clearing existing timetables for ${department} Semester ${semester}...`);
    await Timetable.deleteMany({ campusId, department, semester });

    const facultyDocs = {}; // Cache of faculty models
    
    // Process sections
    for (const [section, data] of Object.entries(timetableGrid)) {
      console.log(`Processing Section ${section}...`);
      const { room, schedule } = data;
      
      for (const [day, slots] of Object.entries(schedule)) {
        for (const slot of slots) {
          const { period, code, faculty: shortcut } = slot;
          
          if (["SDA", "LIBRARY", "COUNSELLING"].includes(code)) continue;

          const facDetails = getFaculty(shortcut);
          let facultyId;

          if (!facultyDocs[facDetails.shortcut]) {
            // Upsert faculty
            const username = facDetails.shortcut.toLowerCase();
            const passwordHash = bcrypt.hashSync('faculty123', 10);
            
            let facultyDoc = await Faculty.findOne({ username });
            if (!facultyDoc) {
              facultyDoc = new Faculty({
                campusId,
                name: facDetails.name,
                employeeId: `EMP-${facDetails.shortcut}`,
                department: department,
                designation: 'Assistant Professor',
                email: facDetails.email,
                phone: "1234567890",
                facultyRoom: "Staff Room",
                username,
                password: passwordHash,
                status: 'active'
              });
              await facultyDoc.save();
              console.log(`Created new faculty: ${facDetails.name} (${username})`);
            } else {
              // Ensure default password matches exactly what we want, just in case
              if (facultyDoc.password && !facultyDoc.password.startsWith('$2b$')) {
                facultyDoc.password = passwordHash;
              }
              // We won't overwrite existing hashes if they are already hashed
              await facultyDoc.save();
            }
            facultyDocs[facDetails.shortcut] = facultyDoc;
          }
          
          facultyId = facultyDocs[facDetails.shortcut]._id;

          // Push assigned subject section to faculty if not exists
          const exists = facultyDocs[facDetails.shortcut].assignedSubjectsSections.some(
            s => s.subject === code && s.section === section && s.semester === semester
          );
          if (!exists) {
            facultyDocs[facDetails.shortcut].assignedSubjectsSections.push({ subject: code, section, semester });
            await facultyDocs[facDetails.shortcut].save();
          }

          // Create Timetable Slot
          const periodInfo = periods.find(p => p.id === period);
          
          const tt = new Timetable({
            campusId,
            department,
            semester,
            section,
            dayOfWeek: day,
            period,
            subject: subjectsMap[code] || code,
            roomName: room,
            facultyId,
            facultyName: facDetails.name,
            startTime: periodInfo.start,
            endTime: periodInfo.end
          });
          await tt.save();
        }
      }
    }
    
    console.log("Timetable successfully seeded!");
    process.exit(0);
  } catch (err) {
    console.error("Error seeding timetable:", err);
    process.exit(1);
  }
}

run();
