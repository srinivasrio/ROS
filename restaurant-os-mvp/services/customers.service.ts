import { supabase } from '@/lib/supabase';
import { createCustomerService } from './customers-core';

export type { Customer, CustomerListResult } from './customers-core';

export const CustomerService = createCustomerService(supabase);
