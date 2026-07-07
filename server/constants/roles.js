const USER_ROLES = Object.freeze({
    STUDENT: "student",
    TEACHER: "teacher",
    FACULTY: "faculty",
    ADMIN: "admin",
    SUPER_ADMIN: "super_admin"
});

const SELF_REGISTRATION_ROLES = Object.freeze([
    USER_ROLES.STUDENT,
    USER_ROLES.TEACHER,
    USER_ROLES.FACULTY
]);

const ADMIN_ROLES = Object.freeze([
    USER_ROLES.ADMIN,
    USER_ROLES.SUPER_ADMIN
]);

module.exports = {
    USER_ROLES,
    SELF_REGISTRATION_ROLES,
    ADMIN_ROLES
};
