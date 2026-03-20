'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  AlertCircleIcon,
  ChevronDownIcon,
  GlobeIcon,
  MailIcon,
  PhoneIcon,
  SearchIcon,
  UserIcon
} from 'lucide-react';
import { type SubmitHandler } from 'react-hook-form';

import { routes } from '@workspace/routes';
import { Alert, AlertDescription } from '@workspace/ui/components/alert';
import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { InputWithAdornments } from '@workspace/ui/components/input-with-adornments';
import { cn } from '@workspace/ui/lib/utils';

import { signUp } from '~/actions/auth/sign-up';
import { useZodForm } from '~/hooks/use-zod-form';
import { signUpSchema, type SignUpSchema } from '~/schemas/auth/sign-up-schema';

// Country dial codes for dropdown
const COUNTRY_CODES = [
  { code: '+91', label: 'IN +91', country: 'India' },
  { code: '+1', label: 'US +1', country: 'United States' },
  { code: '+44', label: 'GB +44', country: 'United Kingdom' },
  { code: '+61', label: 'AU +61', country: 'Australia' },
  { code: '+49', label: 'DE +49', country: 'Germany' },
  { code: '+33', label: 'FR +33', country: 'France' },
  { code: '+81', label: 'JP +81', country: 'Japan' },
  { code: '+86', label: 'CN +86', country: 'China' },
  { code: '+65', label: 'SG +65', country: 'Singapore' },
  { code: '+971', label: 'AE +971', country: 'UAE' },
  { code: '+55', label: 'BR +55', country: 'Brazil' },
  { code: '+52', label: 'MX +52', country: 'Mexico' },
  { code: '+82', label: 'KR +82', country: 'South Korea' },
  { code: '+60', label: 'MY +60', country: 'Malaysia' },
  { code: '+62', label: 'ID +62', country: 'Indonesia' },
  { code: '+27', label: 'ZA +27', country: 'South Africa' },
  { code: '+20', label: 'EG +20', country: 'Egypt' },
  { code: '+234', label: 'NG +234', country: 'Nigeria' },
  { code: '+7', label: 'RU +7', country: 'Russia' },
  { code: '+39', label: 'IT +39', country: 'Italy' }
];

function CountryCodePicker({
  value,
  onChange,
  disabled
}: {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const ref = React.useRef<HTMLDivElement>(null);

  const filtered = COUNTRY_CODES.filter(
    (c) =>
      c.country.toLowerCase().includes(search.toLowerCase()) ||
      c.code.includes(search)
  );

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = COUNTRY_CODES.find((c) => c.code === value) ?? COUNTRY_CODES[0];

  return (
    <div
      className="relative"
      ref={ref}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 items-center gap-1 rounded-md border border-input bg-background px-3 text-sm text-foreground hover:bg-accent transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        <span>{selected?.code}</span>
        <ChevronDownIcon className="size-3 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-md border border-border bg-popover shadow-md">
          <div className="p-2 border-b border-border">
            <div className="flex items-center gap-2 px-2 py-1 rounded bg-muted">
              <SearchIcon className="size-3 text-muted-foreground shrink-0" />
              <input
                autoFocus
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                placeholder="Search country..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.map((c) => (
              <button
                key={c.code}
                type="button"
                className={cn(
                  'flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent transition-colors',
                  c.code === value && 'bg-accent'
                )}
                onClick={() => {
                  onChange(c.code);
                  setOpen(false);
                  setSearch('');
                }}
              >
                <span>{c.country}</span>
                <span className="text-muted-foreground">{c.code}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No results.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function SignUpCard({
  className,
  ...other
}: CardProps): React.JSX.Element {
  const [errorMessage, setErrorMessage] = React.useState<string>();
  const methods = useZodForm({
    schema: signUpSchema,
    mode: 'onSubmit',
    defaultValues: {
      firstName: '',
      lastName: '',
      phoneCode: '+91',
      phone: '',
      email: '',
      businessUrl: '',
      termsAccepted: undefined
    }
  });
  const termsAccepted = methods.watch('termsAccepted');

  const onSubmit: SubmitHandler<SignUpSchema> = async (values) => {
    setErrorMessage(undefined);
    const result = await signUp(values);
    if (result?.serverError || result?.validationErrors) {
      if (result?.validationErrors?.email?._errors?.[0]) {
        setErrorMessage(result.validationErrors?.email?._errors?.[0]);
      } else if (result?.validationErrors?.businessUrl?._errors?.[0]) {
        setErrorMessage('Business URL not correct');
      } else {
        setErrorMessage('An error occurred during sign up.');
      }
    }
  };

  return (
    <Card
      className={cn(
        'w-full px-4 py-8 border-transparent dark:border-border',
        className
      )}
      {...other}
    >
      <CardHeader>
        <CardTitle className="text-base lg:text-lg">
          Create your account
        </CardTitle>
        <CardDescription>
          Please fill in the details to get started.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FormProvider {...methods}>
          <form
            className="flex flex-col gap-4"
            onSubmit={methods.handleSubmit(onSubmit)}
          >
            {/* First Name + Last Name */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={methods.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem className="flex w-full flex-col">
                    <FormLabel>First Name*</FormLabel>
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
                  <FormItem className="flex w-full flex-col">
                    <FormLabel>Last Name*</FormLabel>
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

            {/* Phone Code + Phone Number */}
            <div className="grid grid-cols-[auto_1fr] gap-3 items-end">
              <FormField
                control={methods.control}
                name="phoneCode"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Code</FormLabel>
                    <FormControl>
                      <CountryCodePicker
                        value={field.value}
                        onChange={field.onChange}
                        disabled={methods.formState.isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={methods.control}
                name="phone"
                render={({ field }) => (
                  <FormItem className="flex w-full flex-col">
                    <FormLabel>Phone Number*</FormLabel>
                    <FormControl>
                      <InputWithAdornments
                        type="tel"
                        maxLength={15}
                        autoComplete="tel-national"
                        disabled={methods.formState.isSubmitting}
                        startAdornment={
                          <PhoneIcon className="size-4 shrink-0" />
                        }
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Email */}
            <FormField
              control={methods.control}
              name="email"
              render={({ field }) => (
                <FormItem className="flex w-full flex-col">
                  <FormLabel>Email*</FormLabel>
                  <FormControl>
                    <InputWithAdornments
                      type="email"
                      maxLength={255}
                      autoComplete="username"
                      disabled={methods.formState.isSubmitting}
                      startAdornment={<MailIcon className="size-4 shrink-0" />}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Business Website URL */}
            <FormField
              control={methods.control}
              name="businessUrl"
              render={({ field }) => (
                <FormItem className="flex w-full flex-col">
                  <FormLabel>Business Website URL*</FormLabel>
                  <FormControl>
                    <InputWithAdornments
                      type="url"
                      maxLength={2048}
                      placeholder="https://yourbusiness.com"
                      disabled={methods.formState.isSubmitting}
                      startAdornment={
                        <GlobeIcon className="size-4 shrink-0" />
                      }
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground mt-1">
                    We&apos;ll auto-prefill your business details from this URL.
                    You can edit later.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Terms & Conditions */}
            <FormField
              control={methods.control}
              name="termsAccepted"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <div className="flex items-start gap-3">
                    <FormControl>
                      <input
                        type="checkbox"
                        id="termsAccepted"
                        className="mt-0.5 h-4 w-4 rounded border-input accent-primary cursor-pointer"
                        checked={field.value === true}
                        onChange={(e) =>
                          field.onChange(e.target.checked ? true : undefined)
                        }
                        disabled={methods.formState.isSubmitting}
                      />
                    </FormControl>
                    <label
                      htmlFor="termsAccepted"
                      className="text-sm text-muted-foreground leading-snug cursor-pointer"
                    >
                      I agree to the{' '}
                      <Link
                        prefetch={false}
                        href={routes.marketing.TermsOfUse}
                        className="text-foreground underline"
                        target="_blank"
                      >
                        Terms &amp; Conditions
                      </Link>{' '}
                      and{' '}
                      <Link
                        prefetch={false}
                        href={routes.marketing.PrivacyPolicy}
                        className="text-foreground underline"
                        target="_blank"
                      >
                        Privacy Policy
                      </Link>
                    </label>
                  </div>
                  <FormMessage />
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
              disabled={
                methods.formState.isSubmitting || termsAccepted !== true
              }
              loading={methods.formState.isSubmitting}
            >
              Sign Up
            </Button>
          </form>
        </FormProvider>
      </CardContent>
      <CardFooter className="flex justify-center gap-1 text-sm text-muted-foreground">
        <span>Have An Account?</span>
        <Link
          href={routes.dashboard.auth.SignIn}
          className="text-foreground underline"
        >
          Sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
