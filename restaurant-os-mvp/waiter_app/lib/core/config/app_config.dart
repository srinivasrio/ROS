class AppConfig {
  static const String appName = 'Dine in One Waiter';
  static const String appVersion = '1.0.0';
  
  // Supabase Configuration matching Dine in One Backend
  static const String supabaseUrl = 'https://jmcsygpphwdubnanwjwz.supabase.co';
  static const String supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptY3N5Z3BwaHdkdWJuYW53and6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMjUyMTIsImV4cCI6MjA4NTgwMTIxMn0.uQyoWluprn9Gr-ypserxqF9WM_85MWUMAO7Uch1jN14';

  // Backend API URL for authentication & backend commands
  // Works across local Wi-Fi for wireless iPhone and Android devices
  static const String baseApiUrl = 'http://192.168.1.12:3000';
  static const String fallbackApiUrl = 'http://192.168.1.12:3000';

  // Currency & Formatting
  static const String currencySymbol = '₹';
  static const String countryCode = '+91';

  // Realtime Channels
  static const String tablesTable = 'tables';
  static const String ordersTable = 'orders';
  static const String orderItemsTable = 'order_items';
  static const String serviceRequestsTable = 'service_requests';
}
