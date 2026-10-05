import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifySuperAdmin } from '@/lib/superadmin-guard';

export async function GET(request: Request) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const statusParam = searchParams.get('status');

        let query = supabaseAdmin
            .from('support_tickets')
            .select('*')
            .order('created_at', { ascending: false });

        if (statusParam && statusParam !== 'ALL') {
            query = query.eq('status', statusParam.toLowerCase());
        }

        const [ticketsRes, restRes] = await Promise.all([
            query,
            supabaseAdmin.from('restaurants').select('id, name')
        ]);

        if (ticketsRes.error) {
            return NextResponse.json({ error: ticketsRes.error.message }, { status: 500 });
        }

        const rawTickets = ticketsRes.data || [];
        const restMap = new Map();
        (restRes.data || []).forEach(r => restMap.set(r.id, r.name));

        const formatted = rawTickets.map((t: any) => ({
            ...t,
            ticketId: t.ticket_number || t.id,
            restaurantName: restMap.get(t.restaurant_id) || 'General Inquiry',
            status: (t.status || 'open').toUpperCase(),
            priority: (t.priority || 'medium').toUpperCase(),
        }));

        const counts = {
            open: rawTickets.filter((t) => (t.status || '').toLowerCase() === 'open').length,
            in_progress: rawTickets.filter((t) => (t.status || '').toLowerCase() === 'in_progress').length,
            waiting: rawTickets.filter((t) => (t.status || '').toLowerCase() === 'waiting').length,
            resolved: rawTickets.filter((t) => ['resolved', 'closed'].includes((t.status || '').toLowerCase())).length,
        };

        return NextResponse.json({
            success: true,
            tickets: formatted,
            counts,
        });
    } catch (err: any) {
        console.error('Super Admin support API error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: 403 });
        }

        const body = await request.json();
        const { ticketId, status, internalNote, assignedTo } = body;

        if (!ticketId) {
            return NextResponse.json({ error: 'ticketId is required' }, { status: 400 });
        }

        const updates: Record<string, any> = {
            updated_at: new Date().toISOString(),
        };

        if (status) {
            const rawStatus = status.toLowerCase();
            updates.status = rawStatus;
            if (rawStatus === 'resolved' || rawStatus === 'closed') {
                updates.resolved_at = new Date().toISOString();
            }
        }
        if (assignedTo) updates.assigned_to = assignedTo;

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ticketId);

        if (internalNote) {
            let noteQuery = supabaseAdmin.from('support_tickets').select('internal_notes');
            noteQuery = isUuid ? noteQuery.eq('id', ticketId) : noteQuery.eq('ticket_number', ticketId);
            const { data: current } = await noteQuery.maybeSingle();

            const existingNotes = Array.isArray(current?.internal_notes)
                ? current.internal_notes
                : current?.internal_notes
                ? [current.internal_notes]
                : [];

            updates.internal_notes = [
                ...existingNotes,
                {
                    note: internalNote,
                    actor: auth.user.email || 'Super Admin',
                    timestamp: new Date().toISOString(),
                },
            ];
        }

        let updateQuery = supabaseAdmin.from('support_tickets').update(updates);
        updateQuery = isUuid ? updateQuery.eq('id', ticketId) : updateQuery.eq('ticket_number', ticketId);
        const { error: updateError } = await updateQuery;

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        // Audit log
        await supabaseAdmin.from('audit_logs').insert({
            user_id: auth.user.userId,
            action: `super_admin_update_ticket_${status ? status.toLowerCase() : 'note'}`,
            details: { ticketId, status, timestamp: new Date().toISOString() },
        });

        return NextResponse.json({ success: true, message: 'Ticket updated successfully.' });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: 403 });
        }

        const body = await request.json();
        const { restaurantId, subject, description, priority, category } = body;

        if (!subject || !description) {
            return NextResponse.json({ error: 'Subject and description are required' }, { status: 400 });
        }

        const validPriorities = ['low', 'medium', 'high', 'urgent'];
        const cleanPriority = validPriorities.includes(priority?.toLowerCase()) ? priority.toLowerCase() : 'medium';

        const validCategories = ['billing', 'hardware', 'branch'];
        const cleanCategory = validCategories.includes(category?.toLowerCase()) ? category.toLowerCase() : 'billing';

        const ticketNum = `TICK-${Math.floor(1000 + Math.random() * 9000)}`;

        const { data: newTicket, error: insertError } = await supabaseAdmin
            .from('support_tickets')
            .insert({
                ticket_number: ticketNum,
                restaurant_id: restaurantId || null,
                subject: subject.trim(),
                description: description.trim(),
                priority: cleanPriority,
                category: cleanCategory,
                status: 'open',
                user_email: auth.user.email,
                user_name: auth.user.name || auth.user.email?.split('@')[0] || 'Super Admin',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (insertError) {
            return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, ticket: newTicket });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
