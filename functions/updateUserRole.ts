import { base44 } from "@base44/sdk";

export async function updateUserRole(email, newRole, clientId = null) {
    // Find the User by email
    const users = await base44.asServiceRole.entities.User.list();
    const user = users.find(u => u.email === email);
    
    if (!user) {
        throw new Error("User not found");
    }
    
    // Find the UserProfile for this user
    const profiles = await base44.asServiceRole.entities.UserProfile.list();
    const userProfile = profiles.find(p => p.user_id === user.id);
    
    if (!userProfile) {
        throw new Error("User profile not found");
    }
    
    // Update the role and optionally the client_id
    const updateData = { role: newRole };
    if (clientId) {
        updateData.client_id = clientId;
    }
    
    await base44.asServiceRole.entities.UserProfile.update(userProfile.id, updateData);
    
    return { success: true, message: `User role updated to ${newRole}` };
}