const express = require("express");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const User = require("../models/User");
const { signToken } = require("../utils/auth");
const { asyncHandler } = require("../utils/asyncHandler");
const { createHttpError } = require("../utils/httpError");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

const signupSchema = z
  .object({
    fullName: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(["student", "teacher"]),
    studentId: z.string().optional(),
    major: z.string().optional(),
    department: z.string().optional(),
    employeeId: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.role === "student") {
      if (!value.studentId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["studentId"], message: "Student ID is required" });
      }

      if (!value.major) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["major"], message: "Major is required" });
      }
    }

    if (value.role === "teacher") {
      if (!value.department) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["department"], message: "Department is required" });
      }

      if (!value.employeeId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["employeeId"], message: "Employee ID is required" });
      }
    }
  });

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
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
      studentId: payload.role === "student" ? payload.studentId : undefined,
      major: payload.role === "student" ? payload.major : undefined,
      department: payload.role === "teacher" ? payload.department : undefined,
      employeeId: payload.role === "teacher" ? payload.employeeId : undefined,
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
