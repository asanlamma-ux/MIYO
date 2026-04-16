import { Redirect } from 'expo-router';

/**
 * OAuth redirect landing (Google via Supabase). Session is usually set before this screen shows.
 */
export default function AuthCallbackScreen() {
  return <Redirect href="/(tabs)/settings" />;
}
