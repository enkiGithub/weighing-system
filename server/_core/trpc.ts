import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

/**
 * 创建基于模块的权限检查中间件
 * 管理员始终放行，操作员根据 userPermissions 表检查
 */
export function createModuleViewProcedure(moduleId: string) {
  return protectedProcedure.use(
    t.middleware(async ({ ctx, next }) => {
      // protectedProcedure 已保证 ctx.user 不为 null
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED', message: UNAUTHED_ERR_MSG });
      if (ctx.user.role === 'admin') return next({ ctx: { ...ctx, user: ctx.user } });
      const { checkUserPermission } = await import('../db');
      const allowed = await checkUserPermission(ctx.user.id, moduleId, 'view');
      if (!allowed) {
        throw new TRPCError({ code: 'FORBIDDEN', message: `无权查看该模块` });
      }
      return next({ ctx: { ...ctx, user: ctx.user } });
    })
  );
}

export function createModuleOperateProcedure(moduleId: string) {
  return protectedProcedure.use(
    t.middleware(async ({ ctx, next }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED', message: UNAUTHED_ERR_MSG });
      if (ctx.user.role === 'admin') return next({ ctx: { ...ctx, user: ctx.user } });
      const { checkUserPermission } = await import('../db');
      const allowed = await checkUserPermission(ctx.user.id, moduleId, 'operate');
      if (!allowed) {
        throw new TRPCError({ code: 'FORBIDDEN', message: `无权操作该模块` });
      }
      return next({ ctx: { ...ctx, user: ctx.user } });
    })
  );
}
