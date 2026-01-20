import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { scrypt, randomBytes, timingSafeEqual, createHash } from "crypto";
import { promisify } from "util";
import { users, type SelectUser } from "../shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { pool } from "./db";

function generateResetToken(): string {
  return randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);
const PostgresSessionStore = connectPg(session);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

async function getUserByEmail(email: string) {
  return db.select().from(users).where(eq(users.email, email)).limit(1);
}

export function setupAuth(app: Express) {
  const store = new PostgresSessionStore({
    pool,
    createTableIfMissing: false,
    tableName: "sessions",
  });

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        const [user] = await getUserByEmail(email);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: "Invalid email or password" });
        }
        return done(null, user);
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    done(null, user || null);
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const [existingUser] = await getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const [user] = await db
        .insert(users)
        .values({
          email,
          password: await hashPassword(password),
          firstName: firstName || null,
          lastName: lastName || null,
        })
        .returning();

      req.session.regenerate((err) => {
        if (err) return next(err);
        req.login(user, (err) => {
          if (err) return next(err);
          const { password: _, ...userWithoutPassword } = user;
          res.status(201).json(userWithoutPassword);
        });
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: SelectUser | false, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      req.session.regenerate((err) => {
        if (err) return next(err);
        req.login(user, (err) => {
          if (err) return next(err);
          const { password: _, ...userWithoutPassword } = user;
          res.status(200).json(userWithoutPassword);
        });
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy((err) => {
        if (err) return next(err);
        res.clearCookie("connect.sid");
        res.status(200).json({ message: "Logged out successfully" });
      });
    });
  });

  app.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const { password: _, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });

  // Forgot password - generates reset token
  app.post("/api/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const [user] = await getUserByEmail(email);
      
      // Always return success to prevent email enumeration
      if (!user) {
        return res.status(200).json({ 
          message: "If an account exists with this email, a reset link has been generated",
          // In production, you would NOT return the token - it would be emailed
          // For demo purposes, we indicate no user found without exposing it
        });
      }

      // Generate reset token
      const resetToken = generateResetToken();
      const hashedToken = hashToken(resetToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Save hashed token to database
      await db
        .update(users)
        .set({
          passwordResetToken: hashedToken,
          passwordResetExpires: expiresAt,
        })
        .where(eq(users.id, user.id));

      // In a real app, you would email this link
      // For demo, we return the token directly
      const resetUrl = `/reset-password?token=${resetToken}`;
      
      console.log(`Password reset requested for ${email}. Reset URL: ${resetUrl}`);
      
      res.status(200).json({ 
        message: "If an account exists with this email, a reset link has been generated",
        // Return reset URL for demo purposes only - remove in production
        resetUrl,
        token: resetToken,
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Failed to process request" });
    }
  });

  // Reset password - uses token to set new password
  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ message: "Token and password are required" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const hashedToken = hashToken(token);

      // Find user with valid token
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.passwordResetToken, hashedToken))
        .limit(1);

      if (!user) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      // Check if token has expired
      if (!user.passwordResetExpires || new Date() > user.passwordResetExpires) {
        return res.status(400).json({ message: "Reset token has expired" });
      }

      // Update password and clear reset token
      await db
        .update(users)
        .set({
          password: await hashPassword(password),
          passwordResetToken: null,
          passwordResetExpires: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      res.status(200).json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });
}

export function isAuthenticated(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}

export function isAdmin(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: "Admin access required" });
  }
  return next();
}
