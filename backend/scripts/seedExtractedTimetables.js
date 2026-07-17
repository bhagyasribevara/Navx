const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const Faculty = require('../models/Faculty');
const Timetable = require('../models/Timetable');
const Campus = require('../models/Campus');

const extractedJsonPath = path.resolve(__dirname, './extracted_timetables.json');

const periodsMapping = {
  1: { start: '09:00 AM', end: '10:00 AM' },
  2: { start: '10:00 AM', end: '11:00 AM' },
  3: { start: '11:10 AM', end: '12:10 PM' },
  4: { start: '12:10 PM', end: '01:10 PM' },
  5: { start: '02:00 PM', end: '03:00 PM' },
  6: { start: '03:00 PM', end: '04:00 PM' },
  7: { start: '04:00 PM', end: '05:00 PM' },
  8: { start: '05:00 PM', end: '06:00 PM' }
};

async function run() {
  try {
    if (!fs.existsSync(extractedJsonPath)) {
      throw new Error(`File not found: ${extractedJsonPath}`);
    }
    const rawData = fs.readFileSync(extractedJsonPath, 'utf8');
    const items = JSON.parse(rawData);

    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    const campus = await Campus.findOne({ name: 'GMRIT' });
    if (!campus) throw new Error("No GMRIT campus found");
    const campusId = campus._id;

    for (const item of items) {
      if (!item.data) {
        console.log(`Skipping ${item.source} because data is null.`);
        continue;
      }
      const data = item.data;
      const department = data.branch;
      const semester = data.semester || "3";
      
      console.log(`\nProcessing ${department} Semester ${semester} from ${item.source}...`);

      // We won't blindly delete all timetables for department/sem unless we process all at once.
      // Better to delete sections as we encounter them.
      const sectionsProcessed = data.sections.map(s => s.section);
      console.log(`Clearing existing timetables for ${department} Sem ${semester}, Sections: ${sectionsProcessed.join(', ')}...`);
      await Timetable.deleteMany({ campusId, department, semester, section: { $in: sectionsProcessed } });

      const facultyDocs = {};

      // Prepare faculty mapping
      const mapping = data.facultyMapping || [];
      const getFacultyDetails = (initials, providedName) => {
        const found = mapping.find(m => m.initials && initials && m.initials.toLowerCase() === initials.toLowerCase());
        const name = found ? found.name : (providedName || initials);
        const shortcut = initials || providedName || "UNKNOWN";
        return {
          shortcut,
          name,
          email: `${shortcut.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmr.edu`
        };
      };

      for (const sectionData of data.sections) {
        const { section, room, schedule } = sectionData;
        console.log(`  Seeding Section ${section}...`);

        for (const [day, slots] of Object.entries(schedule)) {
          if (!Array.isArray(slots)) continue;
          
          for (const slot of slots) {
            const { period, code, subject, facultyName, facultyInitials } = slot;
            if (!period || !subject) continue; // Skip empty slots

            // Use generic handling for special blocks
            if (["SDA", "LIBRARY", "COUNSELLING", "SPORTS"].includes((code || "").toUpperCase()) || 
                ["SDA", "LIBRARY", "COUNSELLING", "SPORTS"].includes((subject || "").toUpperCase())) {
              continue;
            }

            const facDetails = getFacultyDetails(facultyInitials, facultyName);
            const username = facDetails.shortcut.toLowerCase().replace(/[^a-z0-9]/g, '');
            if(!username) continue; // skip if invalid username

            if (!facultyDocs[username]) {
              const passwordHash = bcrypt.hashSync('faculty123', 10);
              let facultyDoc = await Faculty.findOne({ username });
              if (!facultyDoc) {
                // Ensure valid department enum
                const validDepts = ['CSE', 'CSE-AIML', 'CSE-DS', 'IT', 'ECE', 'EEE', 'Mechanical', 'Civil', 'MBA', 'MCA'];
                const fDept = validDepts.includes(department) ? department : 'CSE';

                facultyDoc = new Faculty({
                  campusId,
                  name: facDetails.name,
                  employeeId: `EMP-${facDetails.shortcut}-${Date.now().toString().slice(-4)}`,
                  department: fDept,
                  designation: 'Assistant Professor',
                  email: facDetails.email,
                  phone: "1234567890",
                  facultyRoom: "Staff Room",
                  username,
                  password: passwordHash,
                  status: 'active'
                });
                await facultyDoc.save();
                console.log(`    Created new faculty: ${facDetails.name} (${username})`);
              }
              facultyDocs[username] = facultyDoc;
            }

            const facultyId = facultyDocs[username]._id;
            
            // Assign subject section
            const exists = facultyDocs[username].assignedSubjectsSections.some(
              s => s.subject === (code || subject) && s.section === section && s.semester === semester
            );
            if (!exists) {
              facultyDocs[username].assignedSubjectsSections.push({ subject: (code || subject), section, semester });
              await facultyDocs[username].save();
            }

            const periodInfo = periodsMapping[period] || { start: '09:00 AM', end: '10:00 AM' };
            
            const tt = new Timetable({
              campusId,
              department,
              semester,
              section,
              dayOfWeek: day,
              period,
              subject: subject || code,
              roomName: room || "TBD",
              facultyId,
              facultyName: facDetails.name,
              startTime: periodInfo.start,
              endTime: periodInfo.end
            });
            await tt.save();
          }
        }
      }
    }
    
    console.log("All timetables successfully seeded!");
    process.exit(0);
  } catch (err) {
    console.error("Error seeding timetables:", err);
    process.exit(1);
  }
}

run();
