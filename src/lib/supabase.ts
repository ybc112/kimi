import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://kvftphweyxhilpnxbsri.supabase.co";
const supabaseKey = "sb_publishable_xZ6m5C1TAUAX_Ly8oL4rzw_OGMcQ-Oq";

export const supabase = createClient(supabaseUrl, supabaseKey);
