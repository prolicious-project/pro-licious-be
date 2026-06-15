import { Router, Request } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import { authMiddleware } from "../middleware/auth";
import { roleGuard } from "../middleware/roleGuard";
import { successResponse } from "../utils/responses";
import * as svc from "../services/admin.service";

const router = Router();
router.use(authMiddleware, roleGuard("ADMIN", "SUPER_ADMIN"));
const uid = (req: Request) => req.user!.id;

/** Admin routes — 17+ endpoints */
router.get("/dashboard/live", asyncHandler(async (_req, res) => successResponse(res, await svc.liveDashboard())));
router.get("/analytics/daily", asyncHandler(async (_req, res) => successResponse(res, await svc.dailyAnalytics())));
router.get("/analytics/demand-supply", asyncHandler(async (_req, res) => successResponse(res, await svc.demandSupply())));
router.get("/orders", asyncHandler(async (req, res) => successResponse(res, await svc.listOrders(req.query.status as string))));
router.get("/orders/:id", asyncHandler(async (req, res) => successResponse(res, await svc.getOrder(+req.params.id))));
router.patch("/orders/:id/cancel", asyncHandler(async (req, res) => successResponse(res, await svc.cancelOrder(uid(req), +req.params.id, req.body.notes))));
router.post("/refunds", asyncHandler(async (req, res) => successResponse(res, await svc.createRefund(uid(req), req.body), "Refund created", 201)));
router.get("/vendors", asyncHandler(async (_req, res) => successResponse(res, await svc.listVendors())));
router.post("/vendors", asyncHandler(async (req, res) => successResponse(res, await svc.createVendor(uid(req), req.body), "Vendor created", 201)));
router.patch("/vendors/:id/status", asyncHandler(async (req, res) => successResponse(res, await svc.updateVendorStatus(uid(req), +req.params.id, req.body.status))));
router.get("/vendors/:id/documents", asyncHandler(async (req, res) => successResponse(res, await svc.listVendorDocuments(+req.params.id))));
router.patch("/vendors/:id/documents/:docId", asyncHandler(async (req, res) => successResponse(res, await svc.verifyVendorDocument(uid(req), +req.params.id, +req.params.docId, req.body.status))));
router.get("/riders", asyncHandler(async (_req, res) => successResponse(res, await svc.listRiders())));
router.post("/riders", asyncHandler(async (req, res) => successResponse(res, await svc.createRider(uid(req), req.body), "Rider created", 201)));
router.patch("/riders/:id/status", asyncHandler(async (req, res) => successResponse(res, await svc.updateRiderStatus(uid(req), +req.params.id, req.body.status))));
router.get("/riders/:id/documents", asyncHandler(async (req, res) => successResponse(res, await svc.listRiderDocuments(+req.params.id))));
router.patch("/riders/:id/documents/:docId", asyncHandler(async (req, res) => successResponse(res, await svc.verifyRiderDocument(uid(req), +req.params.id, +req.params.docId, req.body.status))));
router.get("/tickets", asyncHandler(async (_req, res) => successResponse(res, await svc.listTickets())));
router.post("/tickets/:id/respond", asyncHandler(async (req, res) => successResponse(res, await svc.respondTicket(uid(req), +req.params.id, req.body.response))));
router.get("/complaints", asyncHandler(async (_req, res) => successResponse(res, await svc.listComplaints())));
router.post("/complaints/:id/respond", asyncHandler(async (req, res) => successResponse(res, await svc.respondComplaint(uid(req), +req.params.id, req.body.response))));
router.get("/audit-logs", asyncHandler(async (_req, res) => successResponse(res, await svc.auditLogs())));
router.get("/fraud-flags", asyncHandler(async (_req, res) => successResponse(res, await svc.listFraudFlags())));
router.patch("/fraud-flags/:id", asyncHandler(async (req, res) => successResponse(res, await svc.reviewFraudFlag(uid(req), +req.params.id, req.body.status))));

export default router;
