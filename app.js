// CONFIGURATION: Replace with your actual Sheety API base URL
const API_BASE_URL = '[Replace with Your Sheetly Base URL]';

// DOM Elements
const adminView = document.getElementById('admin-view');
const volunteerView = document.getElementById('volunteer-view');
const eventForm = document.getElementById('event-form');
const activitiesContainer = document.getElementById('activities-container');
const addActivityBtn = document.getElementById('add-activity-btn');
const linkShareBox = document.getElementById('link-share-box');
const generatedLinkInput = document.getElementById('generated-link');

// Lifecycle initialization
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('event');

    if (eventId) {
        // Switch view to Volunteer mode if "?event=id" is present
        adminView.classList.add('hidden');
        volunteerView.classList.remove('hidden');
        loadVolunteerPage(eventId);
    } else {
        // Otherwise setup the Admin page structure
        addActivityRow(); // Add an initial empty row
    }
});

// --- ADMIN CONTROLLERS ---

// Dynamically add rows for activities when creating an event
addActivityBtn.addEventListener('click', addActivityRow);

function addActivityRow() {
    const row = document.createElement('div');
    row.className = 'flex gap-2 items-center activity-row';
    row.innerHTML = `
        <input type="text" placeholder="Activity (e.g., Setup)" required class="flex-1 p-2 border rounded-md text-sm activity-name">
        <input type="number" placeholder="Qty" min="1" required class="w-20 p-2 border rounded-md text-sm activity-count">
        <button type="button" class="text-red-500 hover:text-red-700 font-bold px-2 remove-row-btn">&times;</button>
    `;
    
    row.querySelector('.remove-row-btn').addEventListener('click', () => row.remove());
    activitiesContainer.appendChild(row);
}

// Handle Admin Form Submission
eventForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('event-title').value;
    const description = document.getElementById('event-desc').value;
    const eventId = 'event-' + Date.now(); // Generate clean simple unique ID

    // 1. Save Event Master Row
    const eventPayload = { event: { eventId, title, description } };
    
    try {
        await fetch(`${API_BASE_URL}/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(eventPayload)
        });

        // 2. Loop through activity UI inputs and prepare separate Slot Rows
        const rows = document.querySelectorAll('.activity-row');
        for (let row of rows) {
            const name = row.querySelector('.activity-name').value;
            const count = parseInt(row.querySelector('.activity-count').value);

            // Create individual records for every single required human spot
            for (let i = 0; i < count; i++) {
                const slotPayload = {
                    slot: {
                        slotId: 'slot-' + Math.random().toString(36).substr(2, 9),
                        eventId: eventId,
                        activityName: name,
                        volunteerName: '',
                        volunteerContact: ''
                    }
                };
                
                await fetch(`${API_BASE_URL}/slots`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(slotPayload)
                });
            }
        }

        // Show the user the generated shareable link
        const shareUrl = `${window.location.origin}${window.location.pathname}?event=${eventId}`;
        generatedLinkInput.value = shareUrl;
        linkShareBox.classList.remove('hidden');
        eventForm.reset();
        
    } catch (err) {
        alert('Error creating event. Please verify your Sheety API configuration.');
        console.error(err);
    }
});


// --- VOLUNTEER CONTROLLERS ---

async function loadVolunteerPage(eventId) {
    try {
        // Fetch Event details
        const eventRes = await fetch(`${API_BASE_URL}/events?eventId=${eventId}`);
        const eventData = await eventRes.json();
        // Sheety queries return arrays. Find exact match.
        const currentEvent = eventData.events.find(e => e.eventId === eventId);

        if (!currentEvent) {
            document.getElementById('view-event-title').innerText = "Event Not Found";
            return;
        }

        document.getElementById('view-event-title').innerText = currentEvent.title;
        document.getElementById('view-event-desc').innerText = currentEvent.description;

        // Fetch companion slots
        const slotsRes = await fetch(`${API_BASE_URL}/slots?eventId=${eventId}`);
        const slotsData = await slotsRes.json();
        const eventSlots = slotsData.slots.filter(s => s.eventId === eventId);

        renderSlots(eventSlots);

    } catch (err) {
        console.error('Error fetching event data:', err);
    }
}

function renderSlots(slots) {
    const container = document.getElementById('slots-list');
    container.innerHTML = ''; // Wipe existing markup

    slots.forEach(slot => {
        const slotEl = document.createElement('div');
        slotEl.className = 'p-4 border rounded-md flex flex-col md:flex-row md:items-center justify-between bg-gray-50';

        if (slot.volunteerName) {
            // Taken Slot Style (Hides contact details completely)
            slotEl.classList.add('bg-gray-100', 'border-gray-300');
            slotEl.innerHTML = `
                <div>
                    <span class="font-semibold text-gray-700">${slot.activityName}</span>
                </div>
                <div class="text-sm font-medium text-gray-600 bg-gray-200 px-3 py-1 rounded-full mt-2 md:mt-0 max-w-max">
                    👤 Filled by ${slot.volunteerName}
                </div>
            `;
        } else {
            // Open Slot Form Style
            slotEl.innerHTML = `
                <div class="mb-3 md:mb-0">
                    <span class="font-semibold text-indigo-900">${slot.activityName}</span>
                    <span class="text-xs text-green-600 block">🟢 Available Spot</span>
                </div>
                <form class="flex flex-wrap gap-2 items-center signup-submit-form" data-slot-id="${slot.id}">
                    <input type="text" placeholder="Your Name" required class="p-1.5 text-sm border rounded bg-white vol-name">
                    <input type="email" placeholder="Your Email" required class="p-1.5 text-sm border rounded bg-white vol-contact">
                    <button type="submit" class="bg-emerald-600 text-white text-sm py-1.5 px-3 rounded hover:bg-emerald-700 transition">Sign Up</button>
                </form>
            `;

            // Bind individual submission handlers inline to keep things modular
            slotEl.querySelector('.signup-submit-form').addEventListener('submit', (e) => handleSignup(e, slot.id));
        }
        container.appendChild(slotEl);
    });
}

async function handleSignup(e, rowId) {
    e.preventDefault();
    const form = e.target;
    const name = form.querySelector('.vol-name').value;
    const contact = form.querySelector('.vol-contact').value;

    // Use a PUT request to update the explicit sheet row targeted by rowId
    const updatePayload = {
        slot: {
            volunteerName: name,
            volunteerContact: contact
        }
    };

    try {
        const res = await fetch(`${API_BASE_URL}/slots/${rowId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload)
        });

        if (res.ok) {
            // Re-fetch URL params to smoothly reload current UI context
            const urlParams = new URLSearchParams(window.location.search);
            loadVolunteerPage(urlParams.get('event'));
        } else {
            alert('Could not complete sign-up. Try again.');
        }
    } catch (err) {
        console.error('Error during update:', err);
    }
}