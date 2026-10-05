import { supabaseAdmin } from '@/lib/supabase-admin';
import { createCustomerService } from './customers-core';

export type { Customer, CustomerListResult } from './customers-core';

export const CustomerService = createCustomerService(supabaseAdmin);
