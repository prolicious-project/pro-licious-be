import { Router, Request } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import { authMiddleware } from "../middleware/auth";
import { roleGuard } from "../middleware/roleGuard";
import { successResponse } from "../utils/responses";
import * as svc from "../services/vendor.service";

const router = Router();
router.use(authMiddleware, roleGuard("VENDOR"));
const uid = (req: Request) => req.user!.id;

/** Vendor routes — 24 endpoints */
router.get("/profile", asyncHandler(async (req, res) => successResponse(res, await svc.getProfile(uid(req)))));
router.patch("/profile", asyncHandler(async (req, res) => successResponse(res, await svc.updateProfile(uid(req), req.body))));
router.get("/branches", asyncHandler(async (req, res) => successResponse(res, await svc.listBranches(uid(req)))));
router.patch("/branches/:id/status", asyncHandler(async (req, res) => successResponse(res, await svc.updateBranchStatus(uid(req), +req.params.id, req.body.status))));
router.get("/operating-hours", asyncHandler(async (req, res) => successResponse(res, await svc.getOperatingHours(uid(req)))));
router.put("/operating-hours", asyncHandler(async (req, res) => successResponse(res, await svc.setOperatingHours(uid(req), req.body))));
router.get("/categories", asyncHandler(async (req, res) => successResponse(res, await svc.listCategories(uid(req)))));
router.post("/categories", asyncHandler(async (req, res) => successResponse(res, await svc.createCategory(uid(req), req.body), "Created", 201)));
router.patch("/categories/:id", asyncHandler(async (req, res) => successResponse(res, await svc.updateCategory(uid(req), +req.params.id, req.body))));
router.delete("/categories/:id", asyncHandler(async (req, res) => successResponse(res, await svc.deleteCategory(uid(req), +req.params.id))));
router.get("/menu", asyncHandler(async (req, res) => successResponse(res, await svc.listMenu(uid(req)))));
router.post("/menu", asyncHandler(async (req, res) => successResponse(res, await svc.createMenuItem(uid(req), req.body), "Created", 201)));
router.patch("/menu/:id", asyncHandler(async (req, res) => successResponse(res, await svc.updateMenuItem(uid(req), +req.params.id, req.body))));
router.delete("/menu/:id", asyncHandler(async (req, res) => successResponse(res, await svc.deleteMenuItem(uid(req), +req.params.id))));
router.patch("/menu/:id/availability", asyncHandler(async (req, res) => successResponse(res, await svc.toggleMenuAvailability(uid(req), +req.params.id, req.body.status))));
router.get("/orders", asyncHandler(async (req, res) => successResponse(res, await svc.listOrders(uid(req), req.query.status as string))));
router.get("/orders/:id", asyncHandler(async (req, res) => successResponse(res, await svc.getOrder(uid(req), +req.params.id))));
router.patch("/orders/:id/accept", asyncHandler(async (req, res) => successResponse(res, await svc.acceptOrder(uid(req), +req.params.id))));
router.patch("/orders/:id/reject", asyncHandler(async (req, res) => successResponse(res, await svc.rejectOrder(uid(req), +req.params.id))));
router.patch("/orders/:id/preparing", asyncHandler(async (req, res) => successResponse(res, await svc.markPreparing(uid(req), +req.params.id))));
router.patch("/orders/:id/ready", asyncHandler(async (req, res) => successResponse(res, await svc.markReady(uid(req), +req.params.id))));
router.get("/analytics/summary", asyncHandler(async (req, res) => successResponse(res, await svc.analyticsSummary(uid(req)))));
router.get("/analytics/daily", asyncHandler(async (req, res) => successResponse(res, await svc.analyticsDaily(uid(req)))));
router.get("/transactions", asyncHandler(async (req, res) => successResponse(res, await svc.listTransactions(uid(req)))));
router.get("/settlements", asyncHandler(async (req, res) => successResponse(res, await svc.listSettlements(uid(req)))));
router.get("/performance", asyncHandler(async (req, res) => successResponse(res, await svc.getPerformance(uid(req)))));

export default router;
