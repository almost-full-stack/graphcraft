// demo.js
const { loadPolicyFromFile } = require('./dslLoader');
const { makeEngine } = require('./authEngine');
const { parseRn } = require('./rnUtils');

console.log(parseRn('rn::club:1::member:101::safeguarding:1'));
return;

function line(title = '') {
  console.log('\n' + '-'.repeat(40) + (title ? ' ' + title : ''));
}

function show(label, val) {
  console.log(label.padEnd(28), val);
}

(async function main() {
  const cfg = loadPolicyFromFile('./src/permissions/example.policy');
  const engine = makeEngine(cfg);

  // Sanity summary
  line('SUMMARY');
  show('roles', cfg.roles.length);
  show('users', cfg.users.length);
  show('resourceIndex', cfg.resourceIndex.length);
  show('permissionAssignments', cfg.permissionAssignments.length);
  show('fieldPolicies', cfg.fieldPolicies.length);

  const rnMember = 'rn::club:1::member:101';
  const rnSafeguard = 'rn::club:1::member:101::safeguarding:1';
  const rnDiscipline = 'rn::club:1::discipline:1';
  const rnCompetition = 'rn::club:1::event:1::competition:1';

  // 1) GIAdmin: should be allowed everywhere
  line('GIAdmin (gi_root)');
  show('manage any', engine.hasPermission({ username: 'gi_root', resourceRn: 'rn::club:2', permission: 'manage' }));
  show('edit discipline', engine.hasPermission({ username: 'gi_root', resourceRn: rnDiscipline, permission: 'edit' }));
  show('delete competition', engine.hasPermission({ username: 'gi_root', resourceRn: rnCompetition, permission: 'delete' }));

  // 2) ClubAdmin on their own club
  line('ClubAdmin on own club (club1_admin)');
  show('manage member', engine.hasPermission({ username: 'club1_admin', resourceRn: rnMember, permission: 'manage' })); // via explicit manage
  show('manage safeguarding', engine.hasPermission({ username: 'club1_admin', resourceRn: rnSafeguard, permission: 'manage' })); // via explicit manage
  show('read discipline', engine.hasPermission({ username: 'club1_admin', resourceRn: rnDiscipline, permission: 'read' })); // allowed (or owner)
  show('edit discipline', engine.hasPermission({ username: 'club1_admin', resourceRn: rnDiscipline, permission: 'edit' })); // denied

  // 3) Owner override test (resource-level): Viewer owns nothing, ClubAdmin owns club 1
  line('"or owner" behavior');
  // ClubAdmin is the owner of rnDiscipline via resourceIndex; rule has "or owner" for read
  show('owner read discipline', engine.hasPermission({ username: 'club1_admin', resourceRn: rnDiscipline, permission: 'read' })); // true
  // Not owner -> still read via role rule (ClubAdmin has read); try edit (denied)
  show('owner edit discipline', engine.hasPermission({ username: 'club1_admin', resourceRn: rnDiscipline, permission: 'edit' })); // false

  // 4) Viewer: read-only everywhere; but owner-only field rule for competition.private_notes
  line('Viewer (viewer_joe)');
  show('read discipline', engine.hasPermission({ username: 'viewer_joe', resourceRn: rnDiscipline, permission: 'read' })); // true (viewer read on rn::*)
  show('edit member', engine.hasPermission({ username: 'viewer_joe', resourceRn: rnMember, permission: 'edit' })); // false

  // Field-level tests
  const allMemberFields = ['id', 'name', 'email', 'phone', 'status', 'dob', 'ssn', 'national_id', 'medical_notes'];
  const allCompetitionFields = ['id', 'title', 'date', 'private_notes'];

  line('Field-level: ClubAdmin on Member at club:1');
  const caReadable = engine.getAllowedFields({ username: 'club1_admin', resourceRn: rnMember, modelName: 'Member', action: 'read', allFields: allMemberFields });
  const caWritable = engine.getAllowedFields({ username: 'club1_admin', resourceRn: rnMember, modelName: 'Member', action: 'write', allFields: allMemberFields });

  show('ClubAdmin readable', JSON.stringify(caReadable));
  show('ClubAdmin writable', JSON.stringify(caWritable));

  line('Field-level: Viewer on Competition (owner-only private_notes)');
  const vReadableComp = engine.getAllowedFields({ username: 'viewer_joe', resourceRn: rnCompetition, modelName: 'Competition', action: 'read', allFields: allCompetitionFields });

  show('Viewer readable competition', JSON.stringify(vReadableComp)); // likely without private_notes

  line('Field-level: ClubAdmin on Competition (not granted private_notes)');
  const caReadableComp = engine.getAllowedFields({ username: 'club1_admin', resourceRn: rnCompetition, modelName: 'Competition', action: 'read', allFields: allCompetitionFields });

  show('ClubAdmin readable competition', JSON.stringify(caReadableComp));

  // Try sanitize write
  line('Sanitize write payload (ClubAdmin → Member)');
  const payload = { name: 'Updated', email: 'x@y.z', status: 'active', medical_notes: 'secret' };
  const clean = engine.sanitizePayload(payload, caWritable);

  show('incoming', JSON.stringify(payload));
  show('sanitized', JSON.stringify(clean));

  console.log('\n✅ Demo complete.');
}());
