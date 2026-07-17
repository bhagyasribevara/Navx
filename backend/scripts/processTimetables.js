const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
// Using gemini-1.5-flash as it is fast and supports multimodal (PDF/images)
const model = genAI.getGenerativeModel({ model: 'gemini-flash-lite-latest' });

const timetablesDir = path.resolve(__dirname, '../../timetables');
const outputJson = path.resolve(__dirname, './extracted_timetables.json');

function getFiles(dir, filesList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getFiles(fullPath, filesList);
    } else {
      if (file.match(/\.(pdf|jpe?g|png)$/i)) {
        filesList.push(fullPath);
      }
    }
  }
  return filesList;
}

function fileToGenerativePart(filePath) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
      mimeType: filePath.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'
    },
  };
}

async function extractTimetable(filePath) {
  const fileName = path.basename(filePath);
  console.log(`Processing ${fileName}...`);
  const filePart = fileToGenerativePart(filePath);
  
  const prompt = `
Extract the timetable and faculty information from this document.
Return ONLY a raw JSON object (no markdown formatting, no backticks).
The JSON MUST follow this structure exactly:
{
  "branch": "Extracted Branch Name (e.g. Civil, IT, ECE)",
  "semester": "Extracted Semester (e.g. 3)",
  "sections": [
    {
      "section": "Section name (e.g. A, B)",
      "room": "Room number/name",
      "schedule": {
        "Monday": [
          { "period": 1, "code": "Subject Code", "subject": "Subject Name", "facultyName": "Full Faculty Name", "facultyInitials": "Initials" }
        ]
      }
    }
  ],
  "facultyMapping": [
    { "initials": "...", "name": "Full Name from the legend/table in the document" }
  ]
}
Note: For each period, use the actual faculty name if available, otherwise use initials in 'facultyName'.
`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await model.generateContent([prompt, filePart]);
      const text = result.response.text();
      const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (error) {
      console.error(`Attempt ${attempt} failed for ${fileName}:`, error.message);
      if (attempt === 3) return null;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

async function run() {
  const files = getFiles(timetablesDir);
  console.log(`Found ${files.length} timetable files to process.`);
  
  let allData = [];
  for (const file of files) {
    const data = await extractTimetable(file);
    if (data) {
      allData.push({ source: path.basename(file), data });
    }
    // Simple delay to avoid rate limits
    await new Promise(r => setTimeout(r, 2000));
  }
  
  fs.writeFileSync(outputJson, JSON.stringify(allData, null, 2));
  console.log(`Extraction complete. Saved to ${outputJson}`);
}

run();
