import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

/**
 * 注册本地认证路由（替代OAuth）
 * POST /api/auth/login - 用户名+密码登录
 */
export function registerOAuthRoutes(app: Express) {
  // 本地登录API
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: "用户名和密码不能为空" });
      return;
    }

    try {
      const user = await db.getUserByUsername(username);
      if (!user) {
        res.status(401).json({ error: "用户名或密码错误" });
        return;
      }

      const isValid = await db.verifyPassword(password, user.passwordHash);
      if (!isValid) {
        res.status(401).json({ error: "用户名或密码错误" });
        return;
      }

      // 更新最后登录时间
      await db.updateLastSignedIn(user.id);

      // 签发JWT session token
      const sessionToken = await sdk.createSessionToken(user.id, {
        username: user.username,
        name: user.name || user.username,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
        },
      });
    } catch (error) {
      console.error("[Auth] Login failed", error);
      res.status(500).json({ error: "登录失败，请稍后重试" });
    }
  });

  // 保留旧的OAuth回调路由（返回404，不再使用）
  app.get("/api/oauth/callback", (_req: Request, res: Response) => {
    res.status(404).json({ error: "OAuth is disabled. Use local authentication." });
  });
}
