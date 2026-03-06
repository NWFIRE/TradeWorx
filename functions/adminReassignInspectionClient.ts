/**
 * Base44 Backend Action: adminReassignInspectionClient
 * - Admin-only
 * - Updates Inspection.client_id
 * - Optionally logs history if InspectionReassignHistory exists
 */

function nowIso() {
  return new Date().toISOString();
}

async function listOne(entityName, filter) {
  const res = await base44.asServiceRole.entities[entityName].list();
  return res?.find(item => Object.entries(filter).every(([k, v]) => item[k] === v)) ?? null;
}

async function safeRead(entityName, id) {
  const list = await base44.asServiceRole.entities[entityName].list();
  return list.find(item => item.id === id) ?? null;
}

async function requireAdmin() {
  if (!session?.user?.id) throw new Error("Not logged in");

  const profile = await listOne("UserProfile", { user_id: session.user.id });
  if (!profile) throw new Error("No UserProfile for current user");
  if (profile.role !== "admin") throw new Error("Forbidden: admin only");
}

export default async function adminReassignInspectionClient(input) {
  await requireAdmin();

  const inspectionId = input?.inspectionId;
  const newClientId = input?.newClientId;

  if (!inspectionId) throw new Error("Missing inspectionId");
  if (!newClientId) throw new Error("Missing newClientId");

  // Load inspection
  const inspection = await safeRead("Inspection", inspectionId);
  if (!inspection) throw new Error("Inspection not found");

  const oldClientId = inspection.client_id;
  if (!oldClientId) throw new Error("Inspection has no client_id set");
  if (oldClientId === newClientId) {
    return { ok: true, message: "No change needed (already assigned to that client)." };
  }

  // Confirm new client exists
  const newClient = await safeRead("Client", newClientId);
  if (!newClient) throw new Error("New client not found");

  // Update inspection
  await base44.asServiceRole.entities.Inspection.update(inspectionId, {
    client_id: newClientId,
    reassigned_at: nowIso(),
    reassigned_by_user_id: session.user.id,
    reassigned_from_client_id: oldClientId
  });

  // Optional history log
  if (base44.asServiceRole.entities.InspectionReassignHistory) {
    await base44.asServiceRole.entities.InspectionReassignHistory.create({
      inspectionId,
      fromClientId: oldClientId,
      toClientId: newClientId,
      changedByUserId: session.user.id,
      changedAt: nowIso(),
    });
  }

  return {
    ok: true,
    message: "Inspection reassigned to new client.",
    inspectionId,
    fromClientId: oldClientId,
    toClientId: newClientId,
  };
}