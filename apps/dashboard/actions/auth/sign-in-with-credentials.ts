'use server';

import { redirect } from 'next/navigation';
import { returnValidationErrors } from 'next-safe-action';

import { signIn } from '@workspace/auth';
import { CredentialsSignin } from '@workspace/auth/errors';
import { Provider } from '@workspace/auth/providers.types';
import { routes } from '@workspace/routes';

import { actionClient } from '~/actions/safe-action';
import { passThroughCredentialsSchema } from '~/schemas/auth/pass-through-credentials-schema';

export const signInWithCredentials = actionClient
  .metadata({ actionName: 'signInWithCredentials' })
  .inputSchema(passThroughCredentialsSchema)
  .action(async ({ parsedInput }) => {
    try {
      await signIn(Provider.Credentials, {
        ...parsedInput,
        redirect: false
      });
    } catch (e) {
      if (e instanceof CredentialsSignin) {
        return returnValidationErrors(passThroughCredentialsSchema, {
          _errors: [e.code]
        });
      }
      throw e;
    }

    // Always send to /organizations — it redirects to /onboarding for first-time users
    // or shows the org list for returning users.
    redirect(routes.dashboard.organizations.Index);
  });
