import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { email } = await req.json();

        if (!email) {
            return Response.json({ error: 'Email is required' }, { status: 400 });
        }

        // Find user by email
        const users = await base44.asServiceRole.entities.User.filter({ email });
        
        if (!users.length) {
            return Response.json({ error: `User with email ${email} not found` }, { status: 404 });
        }

        const user = users[0];

        // Delete UserProfile
        const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_id: user.id });
        if (profiles.length) {
            await base44.asServiceRole.entities.UserProfile.delete(profiles[0].id);
        }

        return Response.json({ success: true, message: `User ${email} profile deleted successfully` });
    } catch (err) {
        console.error("Error deleting user:", err);
        return Response.json({ error: `Failed to delete user: ${err.message}` }, { status: 500 });
    }
});