import { z } from 'zod';

import { passwordValidator } from '@workspace/auth/password';

export const acceptInvitationSignupSchema = z.object({
  token: z.string().uuid('Invalid invitation token.'),
  firstName: z
    .string({ required_error: 'First name is required.' })
    .trim()
    .min(1, 'First name is required.')
    .max(50, 'Maximum 50 characters allowed.'),
  lastName: z
    .string({ required_error: 'Last name is required.' })
    .trim()
    .min(1, 'Last name is required.')
    .max(50, 'Maximum 50 characters allowed.'),
  password: z
    .string({ required_error: 'Password is required.' })
    .min(1, 'Password is required.')
    .max(72, 'Maximum 72 characters allowed.')
    .refine((arg) => passwordValidator.validate(arg).success, {
      message: 'Password does not meet requirements.'
    })
});

export type AcceptInvitationSignupSchema = z.infer<
  typeof acceptInvitationSignupSchema
>;
