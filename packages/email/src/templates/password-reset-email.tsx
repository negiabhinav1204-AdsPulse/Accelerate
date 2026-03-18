import * as React from 'react';
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text
} from '@react-email/components';
import { Tailwind } from '@react-email/tailwind';

export type PasswordResetEmailProps = {
  appName: string;
  name: string;
  resetPasswordLink: string;
};

export function PasswordResetEmail({
  appName,
  name,
  resetPasswordLink
}: PasswordResetEmailProps): React.JSX.Element {
  return (
    <Html>
      <Head />
      <Preview>Reset your Accelerate password</Preview>
      <Tailwind>
        <Body className="m-auto bg-white px-2 font-sans">
          <Container className="mx-auto my-[40px] max-w-[465px] rounded-sm border border-solid border-[#eaeaea]">
            {/* Header */}
            <Section className="bg-[#EFF6FF] px-[20px] py-[24px] rounded-t-sm text-center">
              <div style={{ display: 'inline-block', textAlign: 'center' }}>
                <Text className="text-[10px] font-medium text-[#6B7280] uppercase tracking-widest m-0 p-0">
                  inmobi
                </Text>
                <Text className="text-[22px] font-bold text-[#2563EB] m-0 p-0 leading-tight">
                  accelerate
                </Text>
              </div>
            </Section>
            {/* Body */}
            <Section className="px-[20px] py-[20px]">
              <Heading className="mx-0 my-[20px] p-0 text-[22px] font-semibold text-black">
                Reset your password
              </Heading>
              <Text className="text-[14px] leading-[24px] text-black">
                Hi {name},
              </Text>
              <Text className="text-[14px] leading-[24px] text-black">
                Someone recently requested a password reset for your {appName}{' '}
                account. If this was you, click the button below to set a new
                password:
              </Text>
              <Section className="my-[32px] text-center">
                <Button
                  className="rounded-md bg-[#2563EB] px-6 py-3 text-center text-[14px] font-semibold text-white no-underline w-full"
                  href={resetPasswordLink}
                >
                  Reset Password
                </Button>
              </Section>
              <Text className="text-[13px] leading-[22px] text-[#555555]">
                Or copy and paste this URL into your browser:{' '}
                <Link
                  href={resetPasswordLink}
                  className="text-blue-600 no-underline"
                >
                  {resetPasswordLink}
                </Link>
              </Text>
              <Hr className="mx-0 my-[26px] w-full border border-solid border-[#eaeaea]" />
              <Text className="text-[12px] leading-[20px] text-[#888888]">
                This link expires in 72 hours. If you didn&apos;t request a
                password reset, you can safely ignore this email. To keep your
                account secure, please don&apos;t forward this email to anyone.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
