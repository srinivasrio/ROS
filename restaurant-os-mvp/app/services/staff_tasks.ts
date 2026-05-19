import { supabase } from '@/lib/supabase';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export interface StaffTask {
    id: string;
    restaurant_id: string;
    task_type: string;
    task_ref_id: string;
    assigned_staff_id: string | null;
    status: 'pending' | 'ongoing' | 'completed' | 'cancelled';
    priority: 'low' | 'normal' | 'high' | 'urgent';
    created_at: string;
    completed_at: string | null;
    metadata: any;
}

export const StaffTaskService = {
    /**
     * Fetch active tasks for a specific staff member.
     */
    async fetchMyTasks(staffId: string, restaurantId: string) {
        const { data, error } = await supabase
            .from('staff_tasks')
            .select('*')
            .eq('assigned_staff_id', staffId)
            .eq('restaurant_id', restaurantId)
            .neq('status', 'completed')
            .neq('status', 'cancelled')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as StaffTask[];
    },

    /**
     * Subscribe to tasks assigned to a specific staff member.
     */
    subscribeToMyTasks(staffId: string, restaurantId: string, onChange: (payload: RealtimePostgresChangesPayload<StaffTask>) => void) {
        const channel = supabase
            .channel(`staff-tasks-${staffId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'staff_tasks',
                    filter: `assigned_staff_id=eq.${staffId}`
                },
                (payload) => onChange(payload as RealtimePostgresChangesPayload<StaffTask>)
            )
            .subscribe();

        return { unsubscribe: () => supabase.removeChannel(channel) };
    },

    /**
     * Update task status (ongoing -> completed).
     */
    async updateTaskStatus(taskId: string, status: StaffTask['status']) {
        const { error } = await supabase
            .from('staff_tasks')
            .update({ status })
            .eq('id', taskId);

        if (error) throw error;
    },

    /**
     * Manually reassign a task.
     */
    async reassignTask(taskId: string, newStaffId: string) {
        const { error } = await supabase
            .from('staff_tasks')
            .update({ assigned_staff_id: newStaffId })
            .eq('id', taskId);

        if (error) throw error;
    }
};
