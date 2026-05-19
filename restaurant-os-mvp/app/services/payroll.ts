import { createClient } from '@/lib/supabase';

export interface Employee {
    id: string;
    restaurant_id: string;
    name: string;
    phone: string;
    role: string;
    branch_id: string | null;
    monthly_salary: number;
    per_day_salary: number | null;
    overtime_per_hour: number | null;
    joining_date: string;
    status: 'active' | 'inactive';
    employee_id: string | null;
    created_at?: string;
    updated_at?: string;
    branch?: {
        id: string;
        name: string;
    } | null;
}

export interface Attendance {
    id: string;
    restaurant_id: string;
    employee_id: string;
    date: string;
    status: 'present' | 'absent' | 'half_day' | 'leave';
    created_at?: string;
    updated_at?: string;
}

export interface PayrollRun {
    id: string;
    restaurant_id: string;
    month: number;
    year: number;
    status: 'draft' | 'paid';
    created_at?: string;
    updated_at?: string;
}

export interface PayrollItem {
    id: string;
    payroll_run_id: string;
    employee_id: string;
    monthly_salary: number;
    present_days: number;
    absent_days: number;
    half_days: number;
    overtime_hours: number;
    deductions: number;
    overtime_pay: number;
    final_salary: number;
    payment_status: 'pending' | 'paid';
    paid_at: string | null;
    created_at?: string;
    updated_at?: string;
    employee?: Employee;
}

export interface Branch {
    id: string;
    restaurant_id: string;
    name: string;
    address?: string;
}

function mapDBToEmployee(dbRow: any): Employee {
    return {
        id: dbRow.id,
        restaurant_id: dbRow.restaurant_id,
        name: dbRow.name,
        phone: dbRow.mobile,
        role: dbRow.role,
        branch_id: dbRow.branch_id,
        monthly_salary: Number(dbRow.monthly_salary) || 0,
        per_day_salary: dbRow.per_day_salary !== null ? Number(dbRow.per_day_salary) : null,
        overtime_per_hour: dbRow.overtime_per_hour !== null ? Number(dbRow.overtime_per_hour) : null,
        joining_date: dbRow.joining_date,
        status: dbRow.status,
        employee_id: dbRow.employee_id,
        created_at: dbRow.created_at,
        updated_at: dbRow.updated_at,
        branch: dbRow.branch
    };
}

function mapEmployeeToDB(employee: Partial<Employee>): any {
    const dbRow: any = {};
    if (employee.restaurant_id !== undefined) dbRow.restaurant_id = employee.restaurant_id;
    if (employee.name !== undefined) dbRow.name = employee.name;
    if (employee.phone !== undefined) dbRow.mobile = employee.phone;
    if (employee.role !== undefined) dbRow.role = employee.role;
    if (employee.branch_id !== undefined) dbRow.branch_id = employee.branch_id;
    if (employee.monthly_salary !== undefined) dbRow.monthly_salary = employee.monthly_salary;
    if (employee.per_day_salary !== undefined) dbRow.per_day_salary = employee.per_day_salary;
    if (employee.overtime_per_hour !== undefined) dbRow.overtime_per_hour = employee.overtime_per_hour;
    if (employee.joining_date !== undefined) dbRow.joining_date = employee.joining_date;
    if (employee.status !== undefined) dbRow.status = employee.status;
    if (employee.employee_id !== undefined) dbRow.employee_id = employee.employee_id;
    return dbRow;
}

export const PayrollService = {
    async fetchEmployees(restaurantId: string): Promise<Employee[]> {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('staff')
            .select(`
                *,
                branch:branch_id (
                    id,
                    name
                )
            `)
            .eq('restaurant_id', restaurantId)
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching employees:', error);
            return [];
        }
        return (data || []).map(mapDBToEmployee);
    },

    async createEmployee(employee: Omit<Employee, 'id'>): Promise<Employee> {
        const supabase = createClient();
        const dbPayload = mapEmployeeToDB(employee);
        const { data, error } = await supabase
            .from('staff')
            .insert(dbPayload)
            .select(`
                *,
                branch:branch_id (
                    id,
                    name
                )
            `)
            .single();

        if (error) throw error;
        return mapDBToEmployee(data);
    },

    async updateEmployee(id: string, updates: Partial<Employee>): Promise<void> {
        const supabase = createClient();
        const dbPayload = mapEmployeeToDB(updates);
        const { error } = await supabase
            .from('staff')
            .update(dbPayload)
            .eq('id', id);

        if (error) throw error;
    },

    async deleteEmployee(id: string): Promise<void> {
        const supabase = createClient();
        const { error } = await supabase
            .from('staff')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    async fetchBranches(restaurantId: string): Promise<Branch[]> {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('branches')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching branches:', error);
            return [];
        }
        return data as Branch[];
    },

    async fetchAttendance(restaurantId: string, date: string): Promise<Attendance[]> {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('attendance')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .eq('date', date);

        if (error) {
            console.error('Error fetching attendance:', error);
            return [];
        }
        return data as Attendance[];
    },

    async saveAttendance(
        restaurantId: string,
        date: string,
        records: { employee_id: string; status: 'present' | 'absent' | 'half_day' | 'leave' }[]
    ): Promise<void> {
        const supabase = createClient();
        const payload = records.map(r => ({
            restaurant_id: restaurantId,
            date,
            employee_id: r.employee_id,
            status: r.status,
            updated_at: new Date().toISOString()
        }));

        const { error } = await supabase
            .from('attendance')
            .upsert(payload, { onConflict: 'employee_id,date' });

        if (error) throw error;
    },

    async fetchPayrollRuns(restaurantId: string): Promise<PayrollRun[]> {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('payroll_runs')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order('year', { ascending: false })
            .order('month', { ascending: false });

        if (error) {
            console.error('Error fetching payroll runs:', error);
            return [];
        }
        return data as PayrollRun[];
    },

    async createPayrollRun(restaurantId: string, month: number, year: number): Promise<PayrollRun> {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('payroll_runs')
            .insert({
                restaurant_id: restaurantId,
                month,
                year,
                status: 'draft'
            })
            .select()
            .single();

        if (error) throw error;
        return data as PayrollRun;
    },

    async fetchPayrollRunById(id: string): Promise<PayrollRun | null> {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('payroll_runs')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) {
            console.error('Error fetching payroll run by id:', error);
            return null;
        }
        return data as PayrollRun;
    },

    async fetchPayrollItems(payrollRunId: string): Promise<PayrollItem[]> {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('payroll_items')
            .select(`
                *,
                employee:employee_id (
                    *,
                    branch:branch_id (
                        id,
                        name
                    )
                )
            `)
            .eq('payroll_run_id', payrollRunId);

        if (error) {
            console.error('Error fetching payroll items:', error);
            return [];
        }
        return (data || []).map((item: any) => ({
            ...item,
            employee: item.employee ? mapDBToEmployee(item.employee) : undefined
        })) as unknown as PayrollItem[];
    },

    async generatePayrollItems(
        payrollRunId: string,
        restaurantId: string,
        month: number,
        year: number
    ): Promise<void> {
        const supabase = createClient();

        // 1. Fetch all active employees
        const { data: rawEmployees, error: empError } = await supabase
            .from('staff')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .eq('status', 'active');

        if (empError) throw empError;
        if (!rawEmployees || rawEmployees.length === 0) return;

        const employees = rawEmployees.map(mapDBToEmployee);

        // 2. Fetch attendance for this month
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        // Last day of month
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        const { data: attendance, error: attError } = await supabase
            .from('attendance')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .gte('date', startDate)
            .lte('date', endDate);

        if (attError) throw attError;

        // 3. For each employee, compute payroll values
        const payrollItemsToUpsert = employees.map(emp => {
            const empAttendance = (attendance || []).filter(a => a.employee_id === emp.id);
            
            const present_days = empAttendance.filter(a => a.status === 'present').length;
            const absent_days = empAttendance.filter(a => a.status === 'absent').length;
            const half_days = empAttendance.filter(a => a.status === 'half_day').length;
            
            // Calculate salary structure
            const baseSalary = Number(emp.monthly_salary) || 0;
            const perDaySalary = Number(emp.per_day_salary) || (baseSalary > 0 ? Number((baseSalary / 30).toFixed(2)) : 0);
            
            // Overtime
            const overtimePerHour = Number(emp.overtime_per_hour) || 0;
            // Standard MVP: overtime hours default to 0 unless specified or let's assume we can input them in the payroll list itself.
            // Let's preserve current overtime_hours if they already exist, otherwise default to 0.
            const overtime_hours = 0; 
            const overtime_pay = overtime_hours * overtimePerHour;

            // Deductions: 1 day per day salary for absent, 0.5 day for half day
            const deductions = Number(((absent_days * perDaySalary) + (half_days * perDaySalary * 0.5)).toFixed(2));
            
            const final_salary = Math.max(0, Number((baseSalary - deductions + overtime_pay).toFixed(2)));

            return {
                payroll_run_id: payrollRunId,
                employee_id: emp.id,
                monthly_salary: baseSalary,
                present_days,
                absent_days,
                half_days,
                overtime_hours,
                deductions,
                overtime_pay,
                final_salary,
                payment_status: 'pending' as const
            };
        });

        // 4. Upsert payroll items
        for (const item of payrollItemsToUpsert) {
            const { error: upsertError } = await supabase
                .from('payroll_items')
                .upsert(item, { onConflict: 'payroll_run_id,employee_id' });

            if (upsertError) {
                console.error('Error upserting payroll item:', upsertError);
            }
        }
    },

    async updatePayrollItem(
        itemId: string,
        updates: Partial<Omit<PayrollItem, 'id'>>
    ): Promise<void> {
        const supabase = createClient();
        const { error } = await supabase
            .from('payroll_items')
            .update(updates)
            .eq('id', itemId);

        if (error) throw error;
    },

    async updatePayrollItemStatus(
        itemId: string,
        paymentStatus: 'pending' | 'paid',
        paidAt?: string | null
    ): Promise<void> {
        const supabase = createClient();
        const { error } = await supabase
            .from('payroll_items')
            .update({
                payment_status: paymentStatus,
                paid_at: paidAt || (paymentStatus === 'paid' ? new Date().toISOString() : null)
            })
            .eq('id', itemId);

        if (error) throw error;
    },

    async updatePayrollRunStatus(runId: string, status: 'draft' | 'paid'): Promise<void> {
        const supabase = createClient();
        
        // Begin transaction-like sequence:
        // Update the run status
        const { error: runError } = await supabase
            .from('payroll_runs')
            .update({ status })
            .eq('id', runId);

        if (runError) throw runError;

        // If payroll run is marked as PAID, mark all items as PAID
        if (status === 'paid') {
            const { error: itemsError } = await supabase
                .from('payroll_items')
                .update({
                    payment_status: 'paid',
                    paid_at: new Date().toISOString()
                })
                .eq('payroll_run_id', runId);
            
            if (itemsError) throw itemsError;
        }
    }
};
