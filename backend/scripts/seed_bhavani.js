const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const Campus = require('../models/Campus');
const Faculty = require('../models/Faculty');
const Timetable = require('../models/Timetable');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB.");

  const campus = await Campus.findOne({ name: 'GMRIT' }) || await Campus.findOne();
  if (!campus) {
    console.log("No campus found.");
    process.exit(1);
  }

  // Create or Update Bhavani madam
  let bhavani = await Faculty.findOne({ employeeId: 'EMP-BHAVANI' });
  if (!bhavani) {
    bhavani = new Faculty({
      campusId: campus._id,
      name: 'Bhavani Madam',
      employeeId: 'EMP-BHAVANI',
      department: 'CSE',
      designation: 'Assistant Professor',
      email: 'bhavani@gmrit.edu',
      phone: '9876543210',
      facultyRoom: 'CSE-101',
      username: 'bhavani_cse',
      password: 'password123',
      status: 'active',
      leaveStatus: 'Present',
      officeHours: '3:00 PM - 5:00 PM',
      subjects: ['Web Technologies', 'Software Engineering']
    });
  } else {
    bhavani.leaveStatus = 'Present';
    bhavani.officeHours = '3:00 PM - 5:00 PM';
    bhavani.department = 'CSE';
  }
  await bhavani.save();
  console.log("Bhavani Madam seeded:", bhavani._id);

  // Clear existing classes for her
  await Timetable.deleteMany({ facultyId: bhavani._id });

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = days[new Date().getDay() - 1] || 'Monday'; // simplified for seeding today's classes

  // Add some classes for today
  const newClasses = [
    {
      campusId: campus._id,
      department: 'CSE',
      semester: '5',
      section: 'A',
      dayOfWeek: 'Monday',
      period: 2,
      startTime: '10:00 AM',
      endTime: '10:50 AM',
      subject: 'Web Technologies',
      roomName: 'LT-10',
      facultyName: 'Bhavani Madam',
      facultyId: bhavani._id
    },
    {
      campusId: campus._id,
      department: 'CSE',
      semester: '5',
      section: 'A',
      dayOfWeek: 'Tuesday',
      period: 3,
      startTime: '11:00 AM',
      endTime: '11:50 AM',
      subject: 'Web Technologies',
      roomName: 'LT-10',
      facultyName: 'Bhavani Madam',
      facultyId: bhavani._id
    },
    {
      campusId: campus._id,
      department: 'CSE',
      semester: '5',
      section: 'B',
      dayOfWeek: 'Wednesday',
      period: 4,
      startTime: '11:50 AM',
      endTime: '12:40 PM',
      subject: 'Software Engineering',
      roomName: 'LT-11',
      facultyName: 'Bhavani Madam',
      facultyId: bhavani._id
    },
    {
      campusId: campus._id,
      department: 'CSE',
      semester: '5',
      section: 'A',
      dayOfWeek: 'Thursday',
      period: 2,
      startTime: '10:00 AM',
      endTime: '10:50 AM',
      subject: 'Web Technologies',
      roomName: 'LT-10',
      facultyName: 'Bhavani Madam',
      facultyId: bhavani._id
    },
    {
      campusId: campus._id,
      department: 'CSE',
      semester: '5',
      section: 'B',
      dayOfWeek: 'Friday',
      period: 1,
      startTime: '09:00 AM',
      endTime: '09:50 AM',
      subject: 'Software Engineering',
      roomName: 'LT-11',
      facultyName: 'Bhavani Madam',
      facultyId: bhavani._id
    },
    {
      campusId: campus._id,
      department: 'CSE',
      semester: '5',
      section: 'B',
      dayOfWeek: 'Saturday',
      period: 5,
      startTime: '01:30 PM',
      endTime: '02:20 PM',
      subject: 'Software Engineering',
      roomName: 'LT-11',
      facultyName: 'Bhavani Madam',
      facultyId: bhavani._id
    }
  ];
  
  // Add today's class explicitly if not in the array above
  const currentDay = days[new Date().getDay() - 1]; // 0 is Sunday, so if today is Sunday, currentDay is undefined
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  
  const currentHour = new Date().getHours();
  let periodNum = 1;
  let startTime = '09:00 AM';
  let endTime = '09:50 AM';
  
  if (currentHour >= 9 && currentHour < 16) {
      periodNum = currentHour - 8;
      let ampmStart = currentHour < 12 ? 'AM' : 'PM';
      let ampmEnd = (currentHour + 1) < 12 ? 'AM' : 'PM';
      let hStart = currentHour > 12 ? currentHour - 12 : currentHour;
      let hEnd = (currentHour + 1) > 12 ? (currentHour + 1) - 12 : (currentHour + 1);
      
      startTime = `${hStart.toString().padStart(2, '0')}:00 ${ampmStart}`;
      endTime = `${hStart.toString().padStart(2, '0')}:50 ${ampmStart}`; 
  }
  
  newClasses.push({
      campusId: campus._id,
      department: 'CSE',
      semester: '5',
      section: 'A',
      dayOfWeek: todayName === 'Sunday' ? 'Monday' : todayName, // Assuming Monday if Sunday
      period: periodNum,
      startTime: startTime,
      endTime: endTime,
      subject: 'Web Technologies (Active)',
      roomName: 'LT-10',
      facultyName: 'Bhavani Madam',
      facultyId: bhavani._id
  });

  await Timetable.insertMany(newClasses);
  console.log("Timetable seeded for Bhavani Madam with a class dynamically set to today at the current hour.");

  process.exit(0);
}

run();
