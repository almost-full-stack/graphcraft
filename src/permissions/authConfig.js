const roles = [
  { name: 'admin', rank: 100 },
  { name: 'manager', rank: 50 },
  { name: 'staff', rank: 20 },
];

const users = [
  { username: 'alice_admin', role: 'admin' },
  { username: 'bob_manager', role: 'manager' },
  { username: 'carol_staff', role: 'staff' },
];

const resourceIndex = [
  { resourceRn: 'rn::class:1', model: 'Class', owner: 'bob_manager' },
  { resourceRn: 'rn::class:1::group:1', model: 'Group', owner: 'carol_staff' },
  { resourceRn: 'rn::class:1::group:1::student:1', model: 'Student', owner: 'carol_staff' },
  { resourceRn: 'rn::class:2', model: 'Class', owner: 'alice_admin' },
];

// Multiple RNs allowed per entry
const permissionAssignments = [
  { role: 'manager', resourceRns: ['rn::class:1'], permission: 'edit', allow: true },
  { role: 'staff', resourceRns: ['rn::class:1::group:1'], permission: 'read', allow: true },
  { role: 'staff', resourceRns: ['rn::class:1::group:1'], permission: 'edit', allow: false },

  { role: 'admin', resourceRns: ['rn::class:*'], permission: 'manage', allow: true },
  { role: 'manager', resourceRns: ['rn::class:*::group:*', 'rn::*::group:1'], permission: 'read', allow: true },
];

// Single RN per entry here, but multiple fields allowed
const fieldPolicies = [
  { role: 'manager', model: 'Student', resourceRn: 'rn::class:1', fields: ['*'], action: 'read', allow: true },
  { role: 'manager', model: 'Student', resourceRn: 'rn::class:1', fields: ['ssn'], action: 'read', allow: false },
  { role: 'manager', model: 'Student', resourceRn: 'rn::class:1', fields: ['grade'], action: 'write', allow: true },

  { role: 'staff', model: 'Student', resourceRn: 'rn::class:1::group:1', fields: ['name', 'grade'], action: 'read', allow: true },

  { role: 'admin', model: 'Student', resourceRn: 'rn::class:*', fields: ['*'], action: 'read', allow: true },
];

module.exports = { roles, users, resourceIndex, permissionAssignments, fieldPolicies };
