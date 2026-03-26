'use client';

import * as React from 'react';
import { AlertCircleIcon, LockIcon, UserIcon } from 'lucide-react';
import { type SubmitHandler } from 'react-hook-form';

import { Alert, AlertDescription } from '@workspace/ui/components/alert';
import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  type CardProps
} from '@workspace/ui/components/card';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormProvider
} from '@workspace/ui/components/form';
import { InputPassword } from '@workspace/ui/components/input-password';
import { InputWithAdornments } from '@workspace/ui/components/input-with-adornments';
import { cn } from '@workspace/ui/lib/utils';

import { acceptInvitationSignup } from '~/actions/invitations/accept-invitation-signup';
import { PasswordFormMessage } from '~/components/auth/password-form-message';
import { useZodForm } from '~/hooks/use-zod-form';
import {
  acceptInvitationSignupSchema,
  type AcceptInvitationSignupSchema
} from '~/schemas/invitations/accept-invitation-signup-schema';

export type InvitationSignupCardProps = CardProps & {
  token: string;
  organizationName: string;
  email: string;
};

export function InvitationSignupCard({
  token,
  organizationName,
  email,
  className,
  ...other
}: InvitationSignupCardProps): React.JSX.Element {
  const [errorMessage, setErrorMessage] = React.useState<string>();
  const methods = useZodForm({
    schema: acceptInvitationSignupSchema,
    mode: 'onSubmit',
    defaultValues: {
      token,
      firstName: '',
      lastName: '',
      password: ''
    }
  });
  const password = methods.watch('password');
  const canSubmit = !methods.formState.isSubmitting;

  const onSubmit: SubmitHandler<AcceptInvitationSignupSchema> = async (
    values
  ) => {
    if (!canSubmit) return;
    setErrorMessage(undefined);
    const result = await acceptInvitationSignup(values);
    if (result?.serverError || result?.validationErrors) {
      setErrorMessage(
        result?.serverError ?? 'Something went wrong. Please try again.'
      );
    }
  };

  return (
    <FormProvider {...methods}>
      <Card
        className={cn(
          'w-full px-4 py-8 border-transparent dark:border-border',
          className
        )}
        {...other}
      >
        <CardHeader>
          <CardTitle className="text-sm font-normal text-muted-foreground">
            You have been invited to join
            <span className="block text-xl font-semibold text-foreground">
              {organizationName}
            </span>
          </CardTitle>
          <CardDescription>
            Create your account to accept the invitation.
            <span className="block mt-1 font-medium text-foreground break-all">
              {email}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={methods.handleSubmit(onSubmit)}
          >
            <input type="hidden" {...methods.register('token')} />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={methods.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <InputWithAdornments
                        type="text"
                        maxLength={50}
                        autoComplete="given-name"
                        disabled={methods.formState.isSubmitting}
                        startAdornment={
                          <UserIcon className="size-4 shrink-0" />
                        }
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={methods.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <InputWithAdornments
                        type="text"
                        maxLength={50}
                        autoComplete="family-name"
                        disabled={methods.formState.isSubmitting}
                        startAdornment={
                          <UserIcon className="size-4 shrink-0" />
                        }
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={methods.control}
              name="password"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <InputPassword
                      maxLength={72}
                      autoCapitalize="off"
                      startAdornment={<LockIcon className="size-4 shrink-0" />}
                      disabled={methods.formState.isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <PasswordFormMessage password={password} />
                </FormItem>
              )}
            />

            {errorMessage && (
              <Alert variant="destructive">
                <AlertCircleIcon className="size-[18px] shrink-0" />
                <AlertDescription className="inline">
                  {errorMessage}
                </AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              loading={methods.formState.isSubmitting}
              disabled={!canSubmit}
              onClick={methods.handleSubmit(onSubmit)}
            >
              Create account &amp; join
            </Button>
          </form>
        </CardContent>
      </Card>
    </FormProvider>
  );
}
