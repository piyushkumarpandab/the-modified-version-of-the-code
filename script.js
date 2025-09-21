// Dark/Light mode toggle
const modeToggle = document.getElementById('modeToggle');
let darkMode = false;
modeToggle.addEventListener('click', function() {
    darkMode = !darkMode;
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : '');
    modeToggle.textContent = darkMode ? '☀️ Light Mode' : '🌙 Dark Mode';
});
// UI Navigation
document.getElementById('startBtn').addEventListener('click', function() {
    document.querySelector('.landing').style.display = 'none';
    document.getElementById('adminSection').style.display = 'flex';
    document.getElementById('schedulerSection').style.display = 'block';
});

// File upload handlers
let facultyData = null, courseData = null, roomData = null;

function handleDataUpload(inputElem, setter) {
    inputElem.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const ext = file.name.split('.').pop().toLowerCase();
        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                let data;
                if (ext === 'json') {
                    data = JSON.parse(evt.target.result);
                } else if (ext === 'csv') {
                    // Simple CSV to array of objects
                    const text = evt.target.result;
                    const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
                    const headers = headerLine.split(',').map(h => h.trim());
                    data = lines.map(line => {
                        const values = line.split(',');
                        let obj = {};
                        headers.forEach((h, i) => obj[h] = values[i] ? values[i].trim() : '');
                        return obj;
                    });
                } else if (ext === 'xlsx' && window.XLSX) {
                    const workbook = window.XLSX.read(evt.target.result, { type: 'binary' });
                    const firstSheet = workbook.SheetNames[0];
                    data = window.XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);
                } else {
                    throw new Error('Unsupported file type or missing SheetJS for Excel.');
                }
                setter(data);
                inputElem.style.borderColor = '#4caf50';
            } catch (err) {
                alert('Invalid or unsupported file! ' + err.message);
                inputElem.style.borderColor = '#f44336';
            }
        };
        if (ext === 'xlsx') {
            reader.readAsBinaryString(file);
        } else {
            reader.readAsText(file);
        }
    });
}

handleDataUpload(document.getElementById('facultyFile'), data => facultyData = data);
handleDataUpload(document.getElementById('courseFile'), data => courseData = data);
handleDataUpload(document.getElementById('roomFile'), data => roomData = data);

// Timetable generation (JSON-driven only)
document.getElementById('generateBtn').addEventListener('click', function() {
    const aiStatus = document.getElementById('aiStatus');
    aiStatus.textContent = 'Generating timetable ...';
    setTimeout(() => {
        aiStatus.textContent = 'Timetable generated using your data!';
        generateTimetableWithJson();
    }, 1200);
});

function getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
function generateTimetableWithJson() {
    const times = [
        '09:30 - 10:30',
        '10:30 - 11:30',
        '11:30 - 11:45', // Short Break
        '11:45 - 12:45',
        '12:45 - 01:45',
        '01:45 - 02:30', // Lunch Break
        '02:30 - 03:30',
        '03:30 - 04:30'
    ];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const tbody = document.querySelector('#timetable tbody');
    tbody.innerHTML = '';

    if (!Array.isArray(courseData) || !Array.isArray(facultyData) || !Array.isArray(roomData)) {
        return;
    }

    // Build a flat list of all slots (day, time)
    const slots = [];
    for (let i = 0; i < times.length; i++) {
        for (let j = 0; j < days.length; j++) {
            slots.push({ timeIdx: i, dayIdx: j, time: times[i], day: days[j] });
        }
    }

    // Remove break slots from assignment
    const assignableSlots = slots.filter(s => s.time !== '11:30 - 11:45' && s.time !== '01:45 - 02:30');

    // Calculate total periods needed for each course based on credits
    // (e.g., 1 credit = 1 period per week)
    let coursePeriods = [];
    courseData.forEach(course => {
        for (let c = 0; c < course.credits; c++) {
            coursePeriods.push(course.code);
        }
    });

    // Shuffle coursePeriods for random distribution
    for (let i = coursePeriods.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [coursePeriods[i], coursePeriods[j]] = [coursePeriods[j], coursePeriods[i]];
    }


    // Track faculty and room usage per slot to avoid clashes
    const slotAssignments = Array(assignableSlots.length).fill(null);
    let usedSlots = new Set();
    let facultyUsage = {};
    let roomUsage = {};

    coursePeriods.forEach(courseCode => {
        // Find all available slots not yet used
        let availableSlots = assignableSlots.filter((s, idx) => !usedSlots.has(idx));
        // Shuffle availableSlots for randomness
        for (let i = availableSlots.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [availableSlots[i], availableSlots[j]] = [availableSlots[j], availableSlots[i]];
        }
        // Try to find a slot where a faculty with expertise is available and a room matches, and neither is double-booked
        let assigned = false;
        for (let tryIdx = 0; tryIdx < availableSlots.length; tryIdx++) {
            const slot = availableSlots[tryIdx];
            const course = courseData.find(c => c.code === courseCode);
            const eligibleFaculty = facultyData.filter(f => f.expertise.includes(course.code) && f.availability.includes(slot.day));
            const eligibleRooms = roomData.filter(r => r.type.toLowerCase() === course.type.toLowerCase());
            // Shuffle for randomness
            let shuffledFaculty = eligibleFaculty.slice();
            let shuffledRooms = eligibleRooms.slice();
            for (let i = shuffledFaculty.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffledFaculty[i], shuffledFaculty[j]] = [shuffledFaculty[j], shuffledFaculty[i]];
            }
            for (let i = shuffledRooms.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffledRooms[i], shuffledRooms[j]] = [shuffledRooms[j], shuffledRooms[i]];
            }
            for (let f of shuffledFaculty) {
                for (let r of shuffledRooms) {
                    // Check if faculty or room is already used in this slot (timeIdx, dayIdx)
                    const slotKey = `${slot.timeIdx}-${slot.dayIdx}`;
                    if ((facultyUsage[slotKey] && facultyUsage[slotKey].includes(f.id)) || (roomUsage[slotKey] && roomUsage[slotKey].includes(r.id))) {
                        continue;
                    }
                    // Assign
                    slotAssignments[assignableSlots.indexOf(slot)] = {
                        course,
                        faculty: f,
                        room: r
                    };
                    usedSlots.add(assignableSlots.indexOf(slot));
                    facultyUsage[slotKey] = (facultyUsage[slotKey] || []).concat(f.id);
                    roomUsage[slotKey] = (roomUsage[slotKey] || []).concat(r.id);
                    assigned = true;
                    break;
                }
                if (assigned) break;
            }
            if (assigned) break;
        }
        // If not assigned, skip (no available slot/faculty/room)
    });




    // Render timetable
    for (let i = 0; i < times.length; i++) {
        const tr = document.createElement('tr');
        const timeTd = document.createElement('td');
        timeTd.textContent = times[i];
        tr.appendChild(timeTd);
        for (let j = 0; j < days.length; j++) {
            const td = document.createElement('td');
            // Short Break
            if (times[i] === '11:30 - 11:45') {
                td.innerHTML = '<b style="color:#f76b1c;">Short Break</b>';
                td.contentEditable = false;
                td.style.background = '#ffe0b2';
                tr.appendChild(td);
                continue;
            }
            // Lunch Break
            if (times[i] === '01:45 - 02:30') {
                td.innerHTML = '<b style="color:#f76b1c;">Lunch Break</b>';
                td.contentEditable = false;
                td.style.background = '#ffd180';
                tr.appendChild(td);
                continue;
            }
            td.contentEditable = true;
            td.setAttribute('tabindex', '0');
            td.title = 'Click to edit';
            // Find assignment for this slot
            const slotIdx = assignableSlots.findIndex(s => s.timeIdx === i && s.dayIdx === j);
            const assignment = slotAssignments[slotIdx];
            if (assignment) {
                td.innerHTML =
                    `<b>${assignment.course.name}</b><br>` +
                    `<span class=\"faculty\">${assignment.faculty.name}</span><br>` +
                    `<span style='color:#8e44ad;font-size:0.95em;'>Room: ${assignment.room.name}</span>`;
                // ...no data attributes needed...
            } else {
                td.innerHTML = '<b style="color:#009688;">Library</b>';
            }
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
}