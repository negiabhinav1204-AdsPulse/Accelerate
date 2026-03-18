import * as React from 'react';
import { type Metadata } from 'next';

import { SignUpCard } from '~/components/auth/sign-up/sign-up-card';
import { createTitle } from '~/lib/formatters';

export const metadata: Metadata = {
  title: createTitle('Sign up')
};

export default function SignUpPage(): React.JSX.Element {
  return <SignUpCard />;
}
