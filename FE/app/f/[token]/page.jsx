import { redirect } from 'next/navigation';

export default async function FRedirectPage({ params }) {
  const resolvedParams = await params;
  const token = resolvedParams?.token;
  if (token) {
    redirect(`/customer/order-documents/${token}`);
  }
  redirect('/');
}

