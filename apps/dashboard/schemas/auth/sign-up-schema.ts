import { z } from 'zod';

import { passwordValidator } from '@workspace/auth/password';

export const signUpSchema = z.object({
  firstName: z
    .string({
      required_error: 'First name is required.',
      invalid_type_error: 'First name must be a string.'
    })
    .trim()
    .min(2, 'Minimum 2 characters required.')
    .max(50, 'Maximum 50 characters allowed.')
    .regex(/^[a-zA-Z\s'-]+$/, 'First name can only contain letters.'),
  lastName: z
    .string({
      required_error: 'Last name is required.',
      invalid_type_error: 'Last name must be a string.'
    })
    .trim()
    .min(2, 'Minimum 2 characters required.')
    .max(50, 'Maximum 50 characters allowed.')
    .regex(/^[a-zA-Z\s'-]+$/, 'Last name can only contain letters.'),
  phoneCode: z
    .string({
      required_error: 'Country code is required.',
      invalid_type_error: 'Country code must be a string.'
    })
    .trim()
    .min(1, 'Country code is required.')
    .max(10, 'Maximum 10 characters allowed.'),
  phone: z
    .string({
      required_error: 'Phone number is required.',
      invalid_type_error: 'Phone number must be a string.'
    })
    .trim()
    .min(7, 'Minimum 7 digits required.')
    .max(15, 'Maximum 15 digits allowed.')
    .regex(/^\d+$/, 'Phone number must contain digits only.'),
  email: z
    .string({
      required_error: 'Email is required.',
      invalid_type_error: 'Email must be a string.'
    })
    .trim()
    .min(1, 'Email is required.')
    .max(255, 'Maximum 255 characters allowed.')
    .email('Enter a valid email address.'),
  businessUrl: z
    .string({
      required_error: 'Business website URL is required.',
      invalid_type_error: 'Business website URL must be a string.'
    })
    .trim()
    .min(1, 'Business website URL is required.')
    .max(2048, 'Maximum 2048 characters allowed.')
    .refine(
      (val) => {
        try {
          const url = val.startsWith('http') ? val : `https://${val}`;
          new URL(url);
          return /^(https?:\/\/|www\.)/.test(val) || val.includes('.');
        } catch {
          return false;
        }
      },
      { message: 'Business URL not correct' }
    ),
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the Terms & Conditions.' })
  }),
  password: z
    .string({
      required_error: 'Password is required.',
      invalid_type_error: 'Password must be a string.'
    })
    .min(1, 'Password is required.')
    .max(72, 'Maximum 72 characters allowed.')
    .refine((arg) => passwordValidator.validate(arg).success, {
      message: 'Password does not meet requirements.'
    })
});

export type SignUpSchema = z.infer<typeof signUpSchema>;
