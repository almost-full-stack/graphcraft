'use strict';

const { Sequelize } = require('sequelize');

function buildAncestry(resourceRn) {
  const parts = resourceRn.split('::');
  const out = [];

  for (let i = parts.length; i > 0; i--) {
    out.push(parts.slice(0, i).join('::'));
  }

  return out;
}

async function getUserWithRole(models, userId) {
  const { User, Role } = models;

  const user = await User.findByPk(userId, { include: [{ model: Role }] });

  return user;
}

async function getOwnerRole(models, resourceRn) {
  const { ResourceIndex, Role } = models;

  const res = await ResourceIndex.findByPk(resourceRn, {
    include: [{ association: ResourceIndex.associations.owner, include: [Role] }]
  });

  return res && res.owner ? res.owner.Role : null;
}

async function hasPermission(models, { userId, resourceRn, permission, enableOwnerFallback = true }) {
  const { PermissionAssignment } = models;

  const user = await getUserWithRole(models, userId);

  if (!user) throw new Error('User not found');

  const actingRole = user.Role;
  const ancestry = buildAncestry(resourceRn);

  const rows = await PermissionAssignment.findAll({
    where: { roleId: actingRole.id, resourceRn: ancestry, permission },
    order: [[Sequelize.literal('LENGTH("resourceRn")'), 'DESC']]
  });

  if (rows.length) {
    return rows[0].allow === true;
  }

  if (enableOwnerFallback) {
    const ownerRole = await getOwnerRole(models, resourceRn);

    if (ownerRole && actingRole.rank > ownerRole.rank) return true;
  }

  return false;
}

async function getAllowedFields(models, { userId, resourceRn, modelName, action, allFields = [] }) {
  const { FieldPolicy } = models;

  const user = await getUserWithRole(models, userId);

  if (!user) throw new Error('User not found');

  const roleId = user.roleId;
  const ancestry = buildAncestry(resourceRn);

  const rows = await FieldPolicy.findAll({
    where: { roleId, model: modelName, action, resourceRn: ancestry }
  });

  rows.sort((a, b) => {
    const rnDelta = b.resourceRn.length - a.resourceRn.length;

    if (rnDelta !== 0) return rnDelta;
    const aWild = a.field === '*';
    const bWild = b.field === '*';

    return aWild === bWild ? 0 : aWild ? 1 : -1;
  });

  const allowed = new Set();

  for (const p of rows) {
    if (p.field === '*') {
      if (p.allow) {
        (allFields.length ? allFields : []).forEach((f) => allowed.add(f));
      } else {
        allowed.clear();
      }
    } else if (p.allow) {
      allowed.add(p.field);
    } else {
      allowed.delete(p.field);
    }
  }

  return Array.from(allowed);
}

function projectAttributes(attributes, allowedFields) {
  return attributes.filter((a) => allowedFields.includes(a));
}

function sanitizePayload(payload, allowedFields) {
  return Object.fromEntries(
    Object.entries(payload).filter(([k]) => allowedFields.includes(k))
  );
}

module.exports = {
  buildAncestry,
  hasPermission,
  getAllowedFields,
  projectAttributes,
  sanitizePayload
};
