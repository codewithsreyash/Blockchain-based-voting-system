const express = require("express");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const User = require("../models/User");
const { signToken } = require("../utils/auth");
const { asyncHandler } = require("../utils/asyncHandler");
const { createHttpError } = require("../utils/httpError");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

function getTrimmedLength(value) {
  return typeof value === "string" ? value.trim().length : 0;
}

const signupSchema = z
  .object({
    fullName: z
      .string({ required_error: "Full name is required" })
      .trim()
      .min(2, "Full name must be at least 2 characters long"),
    email: z
      .string({ required_error: "Email is required" })
      .trim()
      .min(1, "Email is required")
      .email("Enter a valid email address"),
    password: z
      .string({ required_error: "Password is required" })
      .min(8, "Password must be at least 8 characters long"),
    role: z.enum(["student", "teacher"], {
      errorMap: () => ({ message: "Role must be student or teacher" }),
    }),
    studentId: z.string().optional(),
    major: z.string().optional(),
    department: z.string().optional(),
    employeeId: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.role === "student") {
      if (!getTrimmedLength(value.studentId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["studentId"], message: "Student ID is required" });
      } else if (getTrimmedLength(value.studentId) < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["studentId"],
          message: "Student ID must be at least 3 characters long",
        });
      }

      if (!getTrimmedLength(value.major)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["major"], message: "Major is required" });
      } else if (getTrimmedLength(value.major) < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["major"],
          message: "Major must be at least 3 characters long",
        });
      }
    }

    if (value.role === "teacher") {
      if (!getTrimmedLength(value.department)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["department"], message: "Department is required" });
      } else if (getTrimmedLength(value.department) < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["department"],
          message: "Department must be at least 3 characters long",
        });
      }

      if (!getTrimmedLength(value.employeeId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["employeeId"], message: "Employee ID is required" });
      } else if (getTrimmedLength(value.employeeId) < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["employeeId"],
          message: "Employee ID must be at least 3 characters long",
        });
      }
    }
  });

const loginSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  password: z
    .string({ required_error: "Password is required" })
    .min(8, "Password must be at least 8 characters long"),
});

router.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const payload = signupSchema.parse(req.body);
    const existingUser = await User.findOne({ email: payload.email.toLowerCase() });

    if (existingUser) {
      throw createHttpError(409, "An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(payload.password, 12);
    const user = await User.create({
      fullName: payload.fullName,
      email: payload.email.toLowerCase(),
      passwordHash,
      role: payload.role,
      studentId: payload.role === "student" ? payload.studentId?.trim() : undefined,
      major: payload.role === "student" ? payload.major?.trim() : undefined,
      department: payload.role === "teacher" ? payload.department?.trim() : undefined,
      employeeId: payload.role === "teacher" ? payload.employeeId?.trim() : undefined,
    });

    const token = signToken(user);
    res.status(201).json({ token, user });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const payload = loginSchema.parse(req.body);
    const user = await User.findOne({ email: payload.email.toLowerCase() }).select("+passwordHash");

    if (!user) {
      throw createHttpError(401, "Invalid email or password");
    }

    const isPasswordValid = await bcrypt.compare(payload.password, user.passwordHash);
    if (!isPasswordValid) {
      throw createHttpError(401, "Invalid email or password");
    }

    const token = signToken(user);
    res.json({ token, user: user.toJSON() });
  })
);

router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  })
);

module.exports = router;
