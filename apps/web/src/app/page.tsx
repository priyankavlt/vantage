import { redirect } from 'next/navigation';

// proxy.ts sends signed-in users to /app and everyone else to /sign-in.
export default function HomePage() {
  redirect('/sign-in');
}
