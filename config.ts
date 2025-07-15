const config = {
  auth: {
    enabled: true,
    provider: 'supabase' as 'supabase' | 'clerk', // Default to Supabase
  },
  payments: {
    enabled: true,
  },
};

export default config;
