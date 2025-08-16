const { loadPolicyFromFile } = require('./dslLoader');
const { makeEngine } = require('./authEngine');

const cfg = loadPolicyFromFile('./src/permissions/example.policy');
const engine = makeEngine(cfg);

// sample RN & fields
const rn = 'rn::class:1::group:1::student:1';
const allStudentFields = ['id', 'name', 'email', 'ssn', 'grade'];

console.log('manager edit? ', engine.hasPermission({ username: 'bob_manager', resourceRn: rn, permission: 'edit' })); // true
console.log('staff   edit? ', engine.hasPermission({ username: 'carol_staff', resourceRn: rn, permission: 'edit' })); // false
console.log('admin manage? ', engine.hasPermission({ username: 'alice_admin', resourceRn: rn, permission: 'manage' })); // true

const mgrReadable = engine.getAllowedFields({ username: 'bob_manager', resourceRn: rn, modelName: 'Student', action: 'read', allFields: allStudentFields });
const mgrWritable = engine.getAllowedFields({ username: 'bob_manager', resourceRn: rn, modelName: 'Student', action: 'write', allFields: allStudentFields });

console.log('manager readable:', mgrReadable);
console.log('manager writable:', mgrWritable);

const incoming = { name: 'Neo', grade: 'A+', ssn: '999-99-9999' };

console.log('sanitized write (manager):', engine.sanitizePayload(incoming, mgrWritable));

const staffReadable = engine.getAllowedFields({ username: 'carol_staff', resourceRn: rn, modelName: 'Student', action: 'read', allFields: allStudentFields });

console.log('staff readable:', staffReadable);
