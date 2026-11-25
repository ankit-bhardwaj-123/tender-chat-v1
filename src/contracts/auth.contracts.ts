import { z } from "zod";

// One schema per form. The browser form and the API route parse the same schema,
// so the rules and messages can never drift apart.

export interface SignupInput {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

// Trim + lowercase: "A@x.com " and "a@x.com" are the same account.
const email = z.string().trim().toLowerCase().min(1, "Enter your email");

export const signupSchema: z.ZodType<SignupInput> = z
  .object({
    fullName: z.string().trim().min(1, "Enter your full name"),
    email,
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

// No length rule on login: a wrong password gets the same "Email or password is wrong" as a wrong email.
export const loginSchema: z.ZodType<LoginInput> = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
});
