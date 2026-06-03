import { Router, Request } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import { authMiddleware } from "../middleware/auth";
import { roleGuard } from "../middleware/roleGuard";
import { successResponse } from "../utils/responses";
import * as svc from "../services/rider.service";

const router = Router();
router.use(authMiddleware, roleGuard("RIDER"));
const uid = (req: Request) => req.user!.id;

/** Rider routes — 18 endpoints */
router.patch("/availability", asyncHandler(async (req, res) => successResponse(res, await svc.setAvailability(uid(req), req.body.isOnline))));
router.post("/location", asyncHandler(async (req, res) => successResponse(res, await svc.pushLocation(uid(req), req.body))));
router.get("/orders", asyncHandler(async (req, res) => successResponse(res, await svc.listOrders(uid(req)))));
router.get("/orders/:id", asyncHandler(async (req, res) => successResponse(res, await svc.getOrder(uid(req), +req.params.id))));
router.patch("/orders/:id/accept", asyncHandler(async (req, res) => successResponse(res, await svc.acceptOrder(uid(req), +req.params.id))));
router.patch("/orders/:id/reject", asyncHandler(async (req, res) => successResponse(res, await svc.rejectOrder(uid(req), +req.params.id))));
router.patch("/orders/:id/arrived-vendor", asyncHandler(async (req, res) => successResponse(res, await svc.arrivedVendor(uid(req), +req.params.id))));
router.patch("/orders/:id/picked-up", asyncHandler(async (req, res) => successResponse(res, await svc.pickedUp(uid(req), +req.params.id))));
router.patch("/orders/:id/arrived-customer", asyncHandler(async (req, res) => successResponse(res, await svc.arrivedCustomer(uid(req), +req.params.id))));
router.post("/orders/:id/deliver", asyncHandler(async (req, res) => successResponse(res, await svc.deliverOrder(uid(req), +req.params.id, req.body.otp))));
router.get("/earnings", asyncHandler(async (req, res) => successResponse(res, await svc.listEarnings(uid(req)))));
router.get("/earnings/summary", asyncHandler(async (req, res) => successResponse(res, await svc.earningsSummary(uid(req)))));
router.get("/shifts", asyncHandler(async (req, res) => successResponse(res, await svc.listShifts(uid(req)))));
router.get("/settlements", asyncHandler(async (req, res) => successResponse(res, await svc.listSettlements(uid(req)))));
router.get("/payouts", asyncHandler(async (req, res) => successResponse(res, await svc.listPayouts(uid(req)))));
router.get("/notifications", asyncHandler(async (req, res) => successResponse(res, await svc.listNotifications(uid(req)))));

export default router;
