const router = require('express').Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Faculty = require('../models/Faculty');
const Timetable = require('../models/Timetable');
const AppUser = require('../models/AppUser');
const Attendance = require('../models/Attendance');
const Mark = require('../models/Mark');

const JWT_SECRET = process.env.JWT_SECRET || 'navx_fallback_secret_key_2025';

// Middleware to authenticate faculty
const authenticateFaculty = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required. No token provided.' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const faculty = await Faculty.findById(decoded.facultyId);
    if (!faculty || faculty.status !== 'active') {
      return res.status(403).json({ error: 'Faculty account is disabled or does not exist.' });
    }
    req.faculty = faculty;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired faculty token.' });
  }
};

// POST /api/faculty/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const faculty = await Faculty.findOne({ username });
    if (!faculty || faculty.status !== 'active') {
      return res.status(401).json({ error: 'Invalid credentials or inactive account' });
    }

    let isMatch = (password === faculty.password);
    if (!isMatch) {
      try {
        isMatch = await bcrypt.compare(password, faculty.password);
      } catch (e) {
        isMatch = false;
      }
    }

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ facultyId: faculty._id, username: faculty.username, role: 'faculty' }, JWT_SECRET, { expiresIn: '30d' });
    
    res.json({
      success: true,
      token,
      faculty: {
        id: faculty._id,
        name: faculty.name,
        employeeId: faculty.employeeId,
        department: faculty.department,
        designation: faculty.designation,
        email: faculty.email,
        phone: faculty.phone,
        facultyRoom: faculty.facultyRoom,
        officeHours: faculty.officeHours,
        subjects: faculty.subjects,
        assignedSections: faculty.assignedSections
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/faculty/dashboard
router.get('/dashboard', authenticateFaculty, async (req, res) => {
  try {
    const faculty = req.faculty;
    const campusId = faculty.campusId;

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = days[new Date().getDay()];
    const queryDay = (currentDay === 'Sunday' || currentDay === 'Saturday') ? 'Monday' : currentDay;

    // Get all classes of today for this faculty
    const todayClasses = await Timetable.find({
      campusId,
      facultyId: faculty._id,
      dayOfWeek: queryDay
    }).sort({ period: 1 });

    // Identify current and upcoming periods
    const currentHour = new Date().getHours();
    let currentClass = null;
    let upcomingClasses = [];

    for (const entry of todayClasses) {
      const match = entry.startTime.match(/^(\d+):/);
      if (match) {
        let startHour = parseInt(match[1]);
        if (entry.startTime.includes('PM') && !entry.startTime.startsWith('12')) {
          startHour += 12;
        }
        if (startHour === currentHour || (startHour < currentHour && startHour + 1 > currentHour)) {
          currentClass = entry;
        } else if (startHour > currentHour) {
          upcomingClasses.push(entry);
        }
      }
    }

    // Fallback if no matching active class currently
    if (!currentClass && todayClasses.length > 0) {
      currentClass = todayClasses[0];
    }

    // Load faculty's entire weekly timetable
    const fullTimetable = await Timetable.find({ campusId, facultyId: faculty._id }).sort({ period: 1 });

    res.json({
      success: true,
      todayClasses,
      currentClass,
      upcomingClasses,
      fullTimetable
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/faculty/students
router.get('/students', authenticateFaculty, async (req, res) => {
  try {
    const { department, section } = req.query;
    if (!department || !section) {
      return res.status(400).json({ error: 'Department and section are required' });
    }

    // Load students in department and section
    const students = await AppUser.find({
      role: 'student',
      department,
      section
    }).select('-password').sort({ username: 1 });

    res.json({ success: true, students });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/faculty/attendance
router.post('/attendance', authenticateFaculty, async (req, res) => {
  try {
    const { studentId, subject, date, status, period } = req.body;
    if (!studentId || !subject || !date || !status) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const formattedDate = new Date(date);
    formattedDate.setHours(0, 0, 0, 0);

    // Create or update attendance
    const attendance = await Attendance.findOneAndUpdate(
      { studentId, subject, date: formattedDate, period: period || 1 },
      { campusId: req.faculty.campusId, status },
      { new: true, upsert: true }
    );

    res.json({ success: true, attendance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/faculty/attendance/bulk-upload
router.post('/attendance/bulk-upload', authenticateFaculty, async (req, res) => {
  try {
    const { attendanceRecords } = req.body; // Array of { studentId, subject, date, status, period }
    if (!Array.isArray(attendanceRecords)) {
      return res.status(400).json({ error: 'attendanceRecords array is required' });
    }

    const bulkOps = attendanceRecords.map(rec => {
      const formattedDate = new Date(rec.date);
      formattedDate.setHours(0, 0, 0, 0);
      return {
        updateOne: {
          filter: { studentId: rec.studentId, subject: rec.subject, date: formattedDate, period: rec.period || 1 },
          update: { campusId: req.faculty.campusId, status: rec.status },
          upsert: true
        }
      };
    });

    await Attendance.bulkWrite(bulkOps);
    res.json({ success: true, message: `${attendanceRecords.length} attendance records uploaded successfully!` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/faculty/marks
router.post('/marks', authenticateFaculty, async (req, res) => {
  try {
    const { studentId, subject, marksType, obtainedMarks, totalMarks, comments } = req.body;
    if (!studentId || !subject || !marksType || obtainedMarks === undefined || !totalMarks) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const mark = await Mark.findOneAndUpdate(
      { studentId, subject, marksType },
      { campusId: req.faculty.campusId, obtainedMarks, totalMarks, comments: comments || '' },
      { new: true, upsert: true }
    );

    res.json({ success: true, mark });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/faculty/marks/bulk-upload
router.post('/marks/bulk-upload', authenticateFaculty, async (req, res) => {
  try {
    const { marksRecords } = req.body; // Array of { studentId, subject, marksType, obtainedMarks, totalMarks, comments }
    if (!Array.isArray(marksRecords)) {
      return res.status(400).json({ error: 'marksRecords array is required' });
    }

    const bulkOps = marksRecords.map(rec => {
      return {
        updateOne: {
          filter: { studentId: rec.studentId, subject: rec.subject, marksType: rec.marksType },
          update: { campusId: req.faculty.campusId, obtainedMarks: rec.obtainedMarks, totalMarks: rec.totalMarks, comments: rec.comments || '' },
          upsert: true
        }
      };
    });

    await Mark.bulkWrite(bulkOps);
    res.json({ success: true, message: `${marksRecords.length} grades uploaded successfully!` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/faculty/analytics
router.get('/analytics', authenticateFaculty, async (req, res) => {
  try {
    const { subject, department, section } = req.query;
    if (!subject || !department || !section) {
      return res.status(400).json({ error: 'Subject, department and section are required' });
    }

    // Load students to restrict analysis to specific section
    const students = await AppUser.find({ role: 'student', department, section });
    const studentIds = students.map(s => s._id);

    // Get marks
    const marks = await Mark.find({
      studentId: { $in: studentIds },
      subject,
      marksType: 'Semester'
    });

    if (marks.length === 0) {
      return res.json({
        success: true,
        passPercentage: 0,
        averageMarks: 0,
        weakStudents: [],
        strongStudents: []
      });
    }

    let totalObtained = 0;
    let passCount = 0;
    const weakStudents = [];
    const strongStudents = [];

    marks.forEach(m => {
      const percent = (m.obtainedMarks / m.totalMarks) * 100;
      totalObtained += percent;
      const stud = students.find(s => s._id.toString() === m.studentId.toString());
      const name = stud ? stud.username : 'Unknown';

      if (percent >= 40) passCount++;
      
      if (percent < 50) {
        weakStudents.push({ name, percentage: Math.round(percent) });
      } else if (percent >= 80) {
        strongStudents.push({ name, percentage: Math.round(percent) });
      }
    });

    res.json({
      success: true,
      passPercentage: Math.round((passCount / marks.length) * 100),
      averageMarks: Math.round(totalObtained / marks.length),
      weakStudents,
      strongStudents
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/faculty/ai-action
router.post('/ai-action', authenticateFaculty, async (req, res) => {
  try {
    const { actionType, promptText } = req.body;
    if (!actionType || !promptText) {
      return res.status(400).json({ error: 'Action type and prompt description are required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    let resultText = '';

    if (apiKey && apiKey !== 'your_gemini_api_key_here') {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

        const systemPrompt = `You are an Agentic AI Faculty Copilot. Your job is to perform administrative and teaching tasks for university professors.
Depending on the requested action, you should generate highly formatted, professional outputs in Markdown.
Action Types:
1. CREATE_PPT: Generate slide-by-slide text contents (Slide 1: Title, Slide 2: Table of Contents, Slide 3... Slide 10).
2. CREATE_ASSIGNMENT: Generate assignment questions with evaluation rubrics and deadlines.
3. CREATE_QUESTION_PAPER: Generate a formal exam question paper containing Section A (short answer) and Section B (long answer) with marks allocation.
4. CREATE_LESSON_PLAN: Generate a structured weekly lesson syllabus detailing lecture topics, textbook chapters, and classroom activities.
5. GENERATE_EXCEL_TEMPLATE: Return a simulated CSV/text-based template for grades/attendance.
6. ANALYZE_PERFORMANCE: Analyze test records and output descriptive, helpful feedback.
7. CO_PO_REPORT: Map Course Outcomes (CO) to Program Outcomes (PO) in a clean table format.

Provide a comprehensive, complete, professional output without placeholders.`;

        const response = await model.generateContent([systemPrompt, `Action: ${actionType}\nPrompt: ${promptText}`]);
        resultText = response.response.text();
      } catch (aiErr) {
        console.error('Gemini error inside Faculty Copilot:', aiErr);
        resultText = `Failed to contact Gemini. Executing fallback template...`;
      }
    }

    // Fallback Mock Templates if API key is missing or failed
    if (!resultText || resultText.includes('Failed to contact Gemini')) {
      if (actionType === 'CREATE_PPT') {
        resultText = `# Presentation Outline: ${promptText}\n\n## Slide 1: Introduction\n- Overview of the subject\n- Core definition and history\n\n## Slide 2: Key Architecture\n- Diagram layout blocks\n- Functional requirements\n\n## Slide 3: Practical Implementation\n- Standard industry use-cases\n- Code Snippet / Design diagram\n\n## Slide 4: Q&A and References\n- Discussion questions\n- Textbook reference reading`;
      } else if (actionType === 'CREATE_ASSIGNMENT') {
        resultText = `# Assignment: ${promptText}\n\n**Instructions:** Please write complete solutions and upload them in PDF format by next Friday.\n\n### Questions\n1. Explain the fundamental design rules in detail. (5 Marks)\n2. Differentiate between architectural layers. (5 Marks)\n\n### Evaluation Rubric\n- Accuracy of concept: 60%\n- Presentation and layout: 20%\n- Real-world examples: 20%`;
      } else if (actionType === 'CREATE_QUESTION_PAPER') {
        resultText = `# End Semester Examination: ${promptText}\n\n**Duration:** 3 Hours | **Maximum Marks:** 100\n\n## Section A (Answer all questions - 10 x 2 = 20 Marks)\n1. Define the primary constraints.\n2. Write down the core mathematical expression.\n\n## Section B (Answer any five questions - 5 x 16 = 80 Marks)\n3. Explain the architecture with a neat diagram.\n4. Design a prototype system for campus automation.`;
      } else {
        resultText = `# Generated Report / Material: ${promptText}\n\nHere is the optimized outline matching your institutional requirements.\n\n- Course Code: CS301\n- Objective: Program execution analysis\n- Syllabus Outcomes: Satisfied under PO1 and PO4.`;
      }
    }

    res.json({ success: true, result: resultText });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
