const INTENTS = Object.freeze({
    GREETING: "greeting",
    ADMISSION: "admission",
    FEES: "fees",
    SCHOLARSHIP: "scholarship",
    HOSTEL: "hostel",
    LIBRARY: "library",
    FACULTY: "faculty",
    PLACEMENT: "placement",
    DEPARTMENTS: "departments",
    COURSES: "courses",
    EVENTS: "events",
    ACADEMIC_CALENDAR: "academic_calendar",
    DOCUMENT_QUESTION: "document_question",
    ANNOUNCEMENT: "announcement",
    GENERAL_CHAT: "general_chat",
    COLLEGE_INFORMATION: "college_information",
    NEARBY_PLACES: "nearby_places",
    LOCATION: "location",
    TRAVEL_ROUTE: "travel_route",
    TRANSPORT: "transport",
    DISTANCE: "distance",
    TRAVEL_COST: "travel_cost",
    ETA: "eta",
    EMERGENCY: "emergency",
    UNKNOWN: "unknown"
});

const INSTITUTIONAL_INTENTS = Object.freeze([
    INTENTS.ADMISSION,
    INTENTS.FEES,
    INTENTS.SCHOLARSHIP,
    INTENTS.HOSTEL,
    INTENTS.LIBRARY,
    INTENTS.FACULTY,
    INTENTS.PLACEMENT,
    INTENTS.DEPARTMENTS,
    INTENTS.COURSES,
    INTENTS.EVENTS,
    INTENTS.ACADEMIC_CALENDAR,
    INTENTS.DOCUMENT_QUESTION,
    INTENTS.ANNOUNCEMENT,
    INTENTS.COLLEGE_INFORMATION,
    INTENTS.TRANSPORT
]);

module.exports = {
    INTENTS,
    INSTITUTIONAL_INTENTS
};
