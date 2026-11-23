import { z } from "zod";

export const accountEmail = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .max(254);
export const registrationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Enter your full name.")
      .max(100)
      .regex(/^[^\u0000-\u001f\u007f]*$/, "Enter a name on one line."),
    email: accountEmail,
    password: z
      .string()
      .refine(
        (value) => Array.from(value).length >= 8,
        "Use at least 8 characters for your password.",
      )
      .refine(
        (value) => new TextEncoder().encode(value).length <= 72,
        "This password is too long. Use a shorter passphrase.",
      ),
  })
  .strict();
export const loginSchema = z.object({
  email: accountEmail,
  password: z.string().min(1).max(1024),
});
