export const id_to_name = {
    2: {
        name: "Tasks",
        id: 2,
        key: "TODOS",
    },
    3: {
        name: "Discussions",
        id: 3,
        key: "DISCUSSIONS",
    },
    4: {
        name: "Milestones",
        id: 4,
        key: "MILESTONES",
    },
    5: {
        name: "Time",
        id: 5,
        key: "TIME",
    },
    6: {
        name: "Files",
        id: 6,
        key: "FILES",
    },
    7: {
        name: "Invoices",
        id: 7,
        key: "INVOICES",
    },
    13: {
        name: "Issue Tracker",
        id: 13,
        key: "BUGTRACKER",
    },
    14: {
        name: "Wikis",
        id: 14,
        key: "WIKI",
    },
    16: {
        name: "CRM",
        id: 16,
        key: "CRM",
    },
    17: {
        name: "Passwords",
        id: 17,
        key: "PASSMAN",
    },
    19: {
        name: "Calendar",
        id: 19,
        key: "CALENDAR",
    },
    20: {
        name: "Invoices",
        id: 20,
        key: "INVOICESPLUS",
    },
    37: {
        name: "Overview",
        id: 37,
        key: "PEOPLE",
    },
    47: {
        name: "Planner",
        id: 47,
        key: "PLANNER",
    },
    48: {
        name: "Translations",
        id: 48,
        key: "TRANSLATIONS",
    },
};
export const name_to_app_id = (name) => {
    let resultId = 2;
    Object.keys(id_to_name).map((key) => {
        if (id_to_name[key].name === name) {
            resultId = id_to_name[key].id;
        }
    });
    return resultId;
};
export const statuses = {
    STATUS_NOT_STARTED: 0,
    STATUS_COMPLETED: 1,
    STATUS_IN_PROGRESS: 2,
    STATUS_INVALID: 3,
    STATUS_REVIEW: 4,
};

export const filterMap = {
    due_date_from: "due_date[from]",
    due_date_to: "due_date[to]",
    created_date_from: "created_date[from]",
    created_date_to: "created_date[to]",
};

export const status_ids = {
    0: "STATUS_NOT_STARTED",
    1: "STATUS_COMPLETED",
    2: "STATUS_IN_PROGRESS",
    3: "STATUS_INVALID",
    4: "STATUS_REVIEW",
};

export const priorities = {
    none: 0,
    low: 1,
    medium: 2,
    high: 3,
};

export const priority_ids = {
    0: "none",
    1: "low",
    2: "medium",
    3: "high",
};

export const apps = {
    BACKUPS: 0,
    TODOS: 2,
    DISCUSSIONS: 3,
    MILESTONES: 4,
    TIME: 5,
    FILES: 6,
    INVOICES: 7, // removed
    BUGTRACKER: 13,
    WIKI: 14,
    CRM: 16,
    PASSMAN: 17,
    TASKY: 18,
    CALENDAR: 19,
    INVOICESPLUS: 20,
    PEOPLE: 37,
    PLANNER: 47,
    TRANSLATIONS: 48,
};
export const names = {
    TODOS: "tasks",
    MILESTONES: "milestones",
    BUGTRACKER: "issuetracker",
    DISCUSSIONS: "discussions",
    CALENDAR: "calendar",
    WIKI: "wiki",
    TIME: "time",
    FILES: "files",
    PLANNER: "planner",
    TRANSLATIONS: "translations",
    PEOPLE: "overview",
    PASSMAN: "passwords",
    CRM: "crm",
    INVOICESPLUS: "invoicesplus",
};

export const action_types = {
    1: "ACTION_ADD",
    2: "ACTION_EDIT",
    9: "ACTION_COMMENT",
    19: "ACTION_ADD_VERSION",
    50: "ACTION_ADD_INVITE",
};

// Not in the web app's constants; observed in real notification responses.
export const observed_action_types = {
    4: "ACTION_ASSIGN",
    21: "ACTION_STATUS",
};

export const APP_WIKI = "14";
export const ASSIGNED_NOONE = "0";

export const ONE_MINUTE_SECONDS = 60;
export const ONE_HOUR_SECONDS = 60 * 60;
export const ONE_DAY_SECONDS = 60 * 60 * 24;

export const PRIORITY_NONE = 0;
export const PRIORITY_LOW = 1;
export const PRIORITY_MEDIUM = 2;
export const PRIORITY_HIGH = 3;

export const APP_ITEM_NAMES_UNTRANSLATED = {
    1: "Wall status",
    2: "Task",
    3: "Discussion",
    4: "Milestone",
    5: "Time record",
    6: "File",
    7: "Invoice",
    13: "Issue",
    14: "Wiki",
    16: "CRM record",
    17: "Password",
    19: "Calendar Event",
    20: "Invoice",
    37: "People",
    1601: "CRM Task",
    1602: "CRM Call",
    1603: "CRM Contact",
    1604: "CRM Campaign",
};
